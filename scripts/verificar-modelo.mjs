// Verificación end-to-end del modelo predictivo contra una instancia en marcha.
//
// Uso:
//   node scripts/verificar-modelo.mjs
//   node scripts/verificar-modelo.mjs --base=http://127.0.0.1:3000 --email=... --password=...
//
// Comprueba: inicio de sesión, entrenamiento, reentrenamiento (nueva versión),
// predicción de un perfil favorable y otro desfavorable, y render de la página.

const arg = (nombre, defecto) =>
  process.argv.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3) ?? defecto

const BASE = arg("base", "http://127.0.0.1:3000")
const EMAIL = arg("email", "admin@encuestas.local")
const PASSWORD = arg("password", "encuestas123")

const jar = new Map()

function guardarCookies(res) {
  const cookies = res.headers.getSetCookie?.() ?? []
  for (const cookie of cookies) {
    const par = cookie.split(";")[0]
    const indice = par.indexOf("=")
    const nombre = par.slice(0, indice).trim()
    const valor = par.slice(indice + 1)
    if (valor === "") jar.delete(nombre)
    else jar.set(nombre, valor)
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([nombre, valor]) => `${nombre}=${valor}`).join("; ")
}

async function pedir(ruta, opciones = {}) {
  const res = await fetch(`${BASE}${ruta}`, {
    ...opciones,
    headers: { cookie: cookieHeader(), ...(opciones.headers ?? {}) },
    redirect: opciones.redirect ?? "follow",
  })
  guardarCookies(res)
  return res
}

function fallar(mensaje) {
  console.error(`\n✗ ${mensaje}`)
  process.exitCode = 1
}

async function iniciarSesion() {
  const resCsrf = await pedir("/api/auth/csrf")
  const { csrfToken } = await resCsrf.json()

  const cuerpo = new URLSearchParams({
    csrfToken,
    email: EMAIL,
    password: PASSWORD,
    callbackUrl: `${BASE}/encuestas`,
  })

  await pedir("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: cuerpo,
    redirect: "manual",
  })

  const resSesion = await pedir("/api/auth/session")
  const sesion = await resSesion.json()
  if (!sesion?.user?.email) {
    fallar(`No se pudo iniciar sesión como ${EMAIL}. Revisa el usuario y la contraseña.`)
    return null
  }
  console.log(`✓ Sesión iniciada como ${sesion.user.email}`)
  return sesion.user
}

async function main() {
  console.log(`Verificando ${BASE}`)
  const usuario = await iniciarSesion()
  if (!usuario) return

  const resLista = await pedir("/api/surveys")
  const encuestas = await resLista.json()
  const encuesta =
    encuestas.find((item) => /clima/i.test(item.titulo)) ?? encuestas[0]

  if (!encuesta) {
    fallar("No hay encuestas publicadas en la base.")
    return
  }
  if (!encuesta.titulo.toLowerCase().includes("clima")) {
    console.log(`! No se encontró "Clima y comunicación laboral"; se usa "${encuesta.titulo}".`)
  }

  const id = encuesta._id
  console.log(`✓ Encuesta: "${encuesta.titulo}" (${id}) con ${encuesta.votos} votos`)

  const resDetalle = await pedir(`/api/surveys/${id}`)
  const detalle = await resDetalle.json()
  if (!resDetalle.ok) {
    fallar(`No se pudo leer la encuesta: ${detalle?.error ?? resDetalle.status}`)
    return
  }
  console.log(`✓ Preguntas: ${detalle.preguntas.length}`)

  // 1) Entrenamiento con árbol de decisión
  const resEntreno = await pedir(`/api/surveys/${id}/modelo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ algoritmo: "arbol" }),
  })
  const entreno = await resEntreno.json()

  if (!resEntreno.ok) {
    fallar(`Entrenamiento falló (${resEntreno.status}): ${entreno?.error ?? "sin detalle"}`)
    return
  }

  const modelo = entreno.modelo
  console.log(
    `✓ Modelo v${modelo.version} (${modelo.algoritmo}): exactitud ${Math.round(modelo.exactitud * 100)}%, ` +
      `F1 ${Math.round(modelo.f1 * 100)}%, macro-F1 ${Math.round(modelo.macroF1 * 100)}%, ` +
      `${modelo.nRegistros} registros (${modelo.nExcluidos} excluidos)`
  )
  console.log(
    `  matriz: VP=${modelo.matriz.vp} VN=${modelo.matriz.vn} FP=${modelo.matriz.fp} FN=${modelo.matriz.fn}`
  )
  console.log(
    "  comparación: " +
      modelo.comparacion
        .map((fila) => `${fila.algoritmo}=${Math.round(fila.exactitud * 100)}%`)
        .join(", ")
  )
  console.log(
    "  importancias: " +
      modelo.importancias
        .slice(0, 4)
        .map((fila) => `${fila.texto.slice(0, 28)}=${(fila.importancia * 100).toFixed(1)}%`)
        .join(" | ")
  )

  if (!(modelo.exactitud > 0.5)) {
    fallar(`La exactitud (${modelo.exactitud}) no supera el 50% del azar binario.`)
  }
  if (!modelo.clases || modelo.clases.length !== 2) {
    fallar(`El modelo debe tener exactamente 2 clases y tiene ${modelo.clases?.length}.`)
  }

  // 2) Reentrenamiento con bosque aleatorio: debe crear una versión nueva
  const resReentreno = await pedir(`/api/surveys/${id}/modelo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ algoritmo: "bosque" }),
  })
  const reentreno = await resReentreno.json()
  if (!resReentreno.ok) {
    fallar(`Reentrenamiento falló: ${reentreno?.error ?? resReentreno.status}`)
  } else if (!(reentreno.modelo.version > modelo.version)) {
    fallar(`El reentrenamiento debía crear una versión mayor a ${modelo.version}.`)
  } else {
    console.log(
      `✓ Reentrenado: v${reentreno.modelo.version} (${reentreno.modelo.algoritmo}) ` +
        `con exactitud ${Math.round(reentreno.modelo.exactitud * 100)}%`
    )
  }

  // 3) Predicciones: perfil favorable y desfavorable
  const porTexto = (fragmento) =>
    detalle.preguntas.find((pregunta) =>
      pregunta.texto.toLowerCase().includes(fragmento.toLowerCase())
    )

  function construirRespuestas(nivel) {
    const respuestas = {}
    const asignar = (fragmento, valor, filtro) => {
      const pregunta = porTexto(fragmento)
      if (!pregunta) return
      const opcion = filtro ? pregunta.opciones.find(filtro) : valor
      if (opcion !== undefined) respuestas[pregunta._id] = opcion
    }

    asignar("área", null, (o) => o === "Operativa")
    asignar("tiempo", null, (o) => o.includes("1 a 3"))
    asignar("edad", null, (o) => o.includes("26 a 35"))
    asignar("modalidad", null, (o) => o === "Presencial")
    for (const fragmento of ["comunicación", "reconocido", "carga", "ambiente", "salario"]) {
      asignar(fragmento, String(nivel))
    }
    const preguntaRecomendaria = porTexto("Recomendarías")
    if (preguntaRecomendaria) respuestas[preguntaRecomendaria._id] = nivel >= 4
    return respuestas
  }

  async function predecir(respuestas) {
    const res = await pedir(`/api/surveys/${id}/modelo/predecir`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ respuestas }),
    })
    return { ok: res.ok, datos: await res.json() }
  }

  const alto = await predecir(construirRespuestas(5))
  const bajo = await predecir(construirRespuestas(1))

  if (!alto.ok || !bajo.ok) {
    fallar(`Predicción falló: ${alto.datos?.error ?? bajo.datos?.error ?? "sin detalle"}`)
    return
  }

  console.log(
    `✓ Perfil favorable -> "${alto.datos.clase}" (P = ${Math.round(alto.datos.probabilidadPositiva * 100)}%)`
  )
  console.log(`  camino: ${alto.datos.explicacion.join(" / ")}`)
  console.log(
    `✓ Perfil desfavorable -> "${bajo.datos.clase}" (P = ${Math.round(bajo.datos.probabilidadPositiva * 100)}%)`
  )

  if (alto.datos.clase === bajo.datos.clase) {
    fallar("Los dos perfiles extremos reciben la misma predicción.")
  }
  if (alto.datos.probabilidadPositiva <= bajo.datos.probabilidadPositiva) {
    fallar("El perfil favorable no tiene mayor probabilidad de la clase positiva.")
  }

  // 4) La página del modelo renderiza
  const resPagina = await pedir(`/encuestas/${id}/modelo`)
  const html = await resPagina.text()
  const esperados = [
    "Modelo predictivo",
    "Matriz de confusión",
    "Importancia de las variables",
    "Árbol de decisión",
    "Reglas principales",
    "Árbol de decisión (J48)",
  ]
  for (const texto of esperados) {
    if (!html.includes(texto)) {
      fallar(`La página no contiene "${texto}" (status ${resPagina.status}).`)
    }
  }
  if (html.includes("Árbol de decisión")) console.log("✓ Página /encuestas/[id]/modelo renderiza árbol, matriz e importancias")

  // Otras páginas siguen respondiendo y el botón de acceso al modelo aparece
  for (const [ruta, marcador] of [
    ["/encuestas", "Encuestas"],
    ["/dashboard", "Resumen general"],
    [`/encuestas/${id}`, "Modelo predictivo"],
  ]) {
    const res = await pedir(ruta)
    const texto = await res.text()
    if (!res.ok || !texto.includes(marcador)) {
      fallar(`${ruta} no respondió correctamente (status ${res.status}, falta "${marcador}").`)
    }
  }
  console.log("✓ /encuestas, /dashboard y el detalle de la encuesta siguen funcionando")

  // 5) Exportación: ARFF sin acentos + diccionario; CSV con acentos y BOM
  const resArff = await pedir(`/api/surveys/${id}/export?formato=arff`)
  const arff = await resArff.text()
  const atributoSigue = arff.split("\n").find((linea) => linea.startsWith("@attribute sigue"))
  if (!resArff.ok) {
    fallar(`La exportación ARFF falló (status ${resArff.status}).`)
  } else {
    console.log(`✓ ARFF: ${atributoSigue}`)
    if (!atributoSigue || atributoSigue.includes("Sí")) {
      fallar("El atributo objetivo del ARFF conserva acentos.")
    }
    if (!/\bSi\b/.test(atributoSigue ?? "")) fallar("El ARFF no contiene la etiqueta Si.")
    if (!arff.includes("% area:")) fallar("El ARFF no incluye el diccionario de variables.")
    if (!arff.includes("% Etiquetas sin acentos")) fallar("El ARFF no documenta las etiquetas sin acentos.")
  }

  const resCsv = await pedir(`/api/surveys/${id}/export?formato=csv`)
  if (!resCsv.ok) {
    fallar(`La exportación CSV falló (status ${resCsv.status}).`)
  } else {
    // Response.text() elimina el BOM al decodificar: hay que mirar los bytes.
    const bytes = new Uint8Array(await resCsv.arrayBuffer())
    if (!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)) {
      fallar("El CSV no empieza con BOM UTF-8.")
    }
    const csv = new TextDecoder("utf-8").decode(bytes)
    if (!csv.includes("Sí")) fallar("El CSV debería conservar los acentos (p. ej. Sí).")
    console.log("✓ CSV con BOM UTF-8 y acentos conservados")
  }

  // 6) Historial: dos versiones guardadas
  const resHistorial = await pedir(`/api/surveys/${id}/modelo`)
  const historial = await resHistorial.json()
  if (!resHistorial.ok) {
    fallar(`Historial falló: ${historial?.error ?? resHistorial.status}`)
  } else {
    console.log(`✓ Historial: ${historial.total} versión(es) guardada(s)`)
    if (historial.total < 2) fallar("Se esperaban al menos 2 versiones en el historial.")
  }

  if (process.exitCode !== 1) {
    console.log("\n✓ Verificación completa: todo correcto.")
  }
}

main().catch((error) => {
  console.error("Error inesperado en la verificación:", error)
  process.exitCode = 1
})
