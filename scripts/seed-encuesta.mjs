// Pobla la base con una encuesta de clima laboral y votos simulados.
// Los votos tienen correlaciones intencionales (comunicación, reconocimiento y
// carga de trabajo influyen en "¿Piensas seguir?"), para que Weka encuentre patrones.
//
// Uso:
//   npm run seed              borra la simulación anterior y vuelve a poblar
//   npm run seed -- --borrar  solo borra los datos simulados (seed: true)
//   npm run seed -- --email=tu@correo.com   deja la encuesta a nombre de tu usuario real
//                             (también vale SEED_EMAIL); debes haberte registrado antes
//   npm run seed -- --limpiar             SIMULACIÓN: muestra cuántas encuestas y votos se borrarían
//   npm run seed -- --limpiar --confirmar borra TODAS las encuestas y votos (guarda respaldo en /backups)
//                             y luego siembra. No toca usuarios ni tipos de encuesta.
//   npm run seed -- --exportar --creador=<_id>   NO usa MongoDB: genera archivos JSON en
//                             export-atlas/ para pegarlos en Atlas (Browse Collections > Insert Document).
//                             <_id> es el _id de tu usuario en la colección users.
//
// Usa MONGODB_URI de .env.local. Por seguridad no escribe en un servidor remoto
// (Atlas) salvo que definas SEED_REMOTO=1.

import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import mongoose from "mongoose"
import bcrypt from "bcryptjs"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")

const TOTAL_VOTOS = 420
const SEMILLA = 20261012 // misma semilla = mismos datos en cada ejecución
const TITULO = "Clima y comunicación laboral"
const DESCRIPCION = "Encuesta de clima laboral. Datos simulados para dashboard y minería de datos."
const PORTADA = "/portada-clima-laboral.svg"
const INICIO = new Date("2026-06-01T08:00:00-05:00")
const FIN = new Date("2026-10-11T18:00:00-05:00")
const EMAIL_CREADOR = "datos.simulados@encuestas.local"
const ESCALA = ["1", "2", "3", "4", "5"]

const AREAS = ["Administrativa", "Operativa", "Comercial", "Tecnología", "Talento humano"]
const PESO_AREAS = [25, 30, 20, 15, 10]
const ANTIGUEDAD = ["Menos de 1 año", "1 a 3 años", "3 a 5 años", "Más de 5 años"]
const PESO_ANTIGUEDAD = [30, 35, 20, 15]
const EDAD = ["18 a 25", "26 a 35", "36 a 45", "46 o más"]
const PESO_EDAD = [25, 40, 22, 13]
const MODALIDAD = ["Presencial", "Híbrida", "Remota"]
const PESO_MODALIDAD = [45, 35, 20]

// Definición de preguntas. "clave" enlaza la pregunta con el valor generado.
const PREGUNTAS_DEF = [
  { clave: "area", tipo: "seleccion_unica", texto: "¿En qué área trabajas?", opciones: AREAS },
  { clave: "antiguedad", tipo: "seleccion_unica", texto: "¿Cuánto tiempo llevas en la empresa?", opciones: ANTIGUEDAD },
  { clave: "edad", tipo: "seleccion_unica", texto: "¿En qué rango de edad estás?", opciones: EDAD },
  { clave: "modalidad", tipo: "seleccion_unica", texto: "¿Cuál es tu modalidad de trabajo?", opciones: MODALIDAD },
  { clave: "comunicacion", tipo: "seleccion_unica", texto: "¿Qué tan clara es la comunicación con tu jefe? (1 = nada clara, 5 = muy clara)", opciones: ESCALA },
  { clave: "reconocimiento", tipo: "seleccion_unica", texto: "¿Sientes que tu trabajo es reconocido? (1 = nunca, 5 = siempre)", opciones: ESCALA },
  { clave: "carga", tipo: "seleccion_unica", texto: "¿Qué tan sostenible es tu carga laboral? (1 = insostenible, 5 = muy sostenible)", opciones: ESCALA },
  { clave: "equipo", tipo: "seleccion_unica", texto: "¿Cómo describes el ambiente de tu equipo? (1 = malo, 5 = excelente)", opciones: ESCALA },
  { clave: "salario", tipo: "seleccion_unica", texto: "¿Qué tan satisfecho estás con tu salario? (1 = nada, 5 = totalmente)", opciones: ESCALA },
  { clave: "recomendaria", tipo: "verdadero_falso", texto: "Recomendarías esta empresa como lugar para trabajar", opciones: [] },
  { clave: "sigue", tipo: "seleccion_unica", texto: "¿Piensas seguir en la empresa el próximo año?", opciones: ["Sí", "No", "No sé"] },
]

// Generador pseudoaleatorio reproducible (mulberry32).
function crearAzar(semilla) {
  let s = semilla >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const azar = crearAzar(SEMILLA)

const clamp = (x, min, max) => Math.min(max, Math.max(min, x))
const elegir = (lista) => lista[Math.floor(azar() * lista.length)]

function ponderado(opciones, pesos) {
  const total = pesos.reduce((a, b) => a + b, 0)
  let r = azar() * total
  for (let i = 0; i < opciones.length; i++) {
    r -= pesos[i]
    if (r < 0) return opciones[i]
  }
  return opciones[opciones.length - 1]
}

// Normal estándar (Box-Muller).
function normal() {
  const u = Math.max(azar(), 1e-12)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * azar())
}

const hex8 = () => Math.floor(azar() * 0x100000000).toString(16).padStart(8, "0")

// Genera un respondiente. Las escalas comparten un "clima" latente, así que
// se mueven juntas; "sigue" depende sobre todo de ellas y de la antigüedad.
function generarRespondiente() {
  const area = ponderado(AREAS, PESO_AREAS)
  const antiguedad = ponderado(ANTIGUEDAD, PESO_ANTIGUEDAD)
  const edad = ponderado(EDAD, PESO_EDAD)
  const modalidad = ponderado(MODALIDAD, PESO_MODALIDAD)

  const clima = normal()
  const nota = (efecto) => clamp(Math.round(3 + efecto + normal() * 0.7), 1, 5)

  const comunicacion = nota(0.9 * clima)
  const reconocimiento = nota(0.9 * clima + (area === "Comercial" ? 0.3 : 0))
  const carga = nota(0.4 * clima + (area === "Operativa" ? -0.7 : 0) + (modalidad === "Remota" ? 0.2 : 0))
  const equipo = nota(0.7 * clima + (modalidad === "Presencial" ? 0.3 : 0))
  const salario = nota(0.5 * clima)

  const puntaje =
    0.3 * (comunicacion - 3) +
    0.25 * (reconocimiento - 3) +
    0.2 * (carga - 3) +
    0.15 * (equipo - 3) +
    0.1 * (salario - 3)

  const bonoAntiguedad = antiguedad === "Más de 5 años" ? 0.4 : antiguedad === "Menos de 1 año" ? -0.3 : 0
  const s = puntaje + bonoAntiguedad + normal() * 0.6
  let sigue = s > 0.6 ? "Sí" : s < -0.6 ? "No" : "No sé"
  if (azar() < 0.08) sigue = elegir(["Sí", "No", "No sé"]) // ruido realista

  const recomendaria = puntaje + normal() * 0.7 > 0

  return {
    area, antiguedad, edad, modalidad,
    comunicacion: String(comunicacion),
    reconocimiento: String(reconocimiento),
    carga: String(carga),
    equipo: String(equipo),
    salario: String(salario),
    recomendaria,
    sigue,
  }
}

// Construye la encuesta, sus preguntas y los votos. No toca la base de datos.
function construirDatos(creadorId, tipos) {
  // Preguntas embebidas en la encuesta, con el mismo formato que guarda Mongoose.
  const preguntas = PREGUNTAS_DEF.map((p, orden) => ({
    _id: new mongoose.Types.ObjectId(),
    texto: p.texto,
    tipoPregunta: p.tipo,
    opciones: p.opciones,
    config: { min: null, max: null },
    requerida: true,
    orden,
    clave: p.clave, // solo para este script; se quita antes de guardar
  }))

  const encuestaId = new mongoose.Types.ObjectId()
  const respondientes = Array.from({ length: TOTAL_VOTOS }, () => generarRespondiente())
  const fechas = respondientes
    .map(() => new Date(INICIO.getTime() + azar() * (FIN.getTime() - INICIO.getTime())))
    .sort((a, b) => a - b)

  const votos = respondientes.map((r, i) => ({
    _id: new mongoose.Types.ObjectId(),
    encuestaId,
    // Mismo criterio que la app: voterId único por encuesta (índice único encuestaId + voterId).
    voterId: `seed-${String(i + 1).padStart(4, "0")}-${hex8()}`,
    ipHash: hex8() + hex8() + hex8() + hex8() + hex8() + hex8() + hex8() + hex8(),
    respuestas: preguntas.map((p) => ({
      preguntaId: String(p._id),
      valor: p.tipoPregunta === "verdadero_falso" ? r.recomendaria : String(r[p.clave]),
    })),
    createdAt: fechas[i],
    updatedAt: fechas[i],
    __v: 0,
    seed: true,
  }))

  const encuesta = {
    _id: encuestaId,
    titulo: TITULO,
    descripcion: DESCRIPCION,
    imagenPortada: PORTADA,
    tipos,
    estado: "publicada",
    creador: creadorId,
    preguntas, // se conserva `clave` para que la exportación use nombres de columna legibles
    votos: votos.length, // contador igual al número real de votos
    createdAt: INICIO,
    updatedAt: FIN,
    __v: 0,
    seed: true,
  }

  return { encuesta, votos, respondientes }
}

// Resumen para verificar que las correlaciones existen.
function mostrarResumen(respondientes) {
  const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0)
  const siSeguira = (filtro) => {
    const grupo = respondientes.filter(filtro)
    return pct(grupo.filter((r) => r.sigue === "Sí").length, grupo.length)
  }
  console.log(`\nEncuesta "${TITULO}" con ${respondientes.length} votos.`)
  for (const op of ["Sí", "No", "No sé"]) {
    console.log(`  ¿Seguir? ${op}: ${respondientes.filter((r) => r.sigue === op).length}`)
  }
  console.log(`  % que sí seguirá con comunicación 4-5: ${siSeguira((r) => +r.comunicacion >= 4)}%`)
  console.log(`  % que sí seguirá con comunicación 1-2: ${siSeguira((r) => +r.comunicacion <= 2)}%`)
  console.log(`  % que sí seguirá con carga 4-5:        ${siSeguira((r) => +r.carga >= 4)}%`)
  console.log(`  % que sí seguirá con carga 1-2:        ${siSeguira((r) => +r.carga <= 2)}%`)
}

// Convierte ObjectId y Date a Extended JSON, el formato que acepta Atlas al pegar documentos.
function aEjson(valor) {
  if (valor && valor._bsontype === "ObjectId") return { $oid: valor.toString() }
  if (valor instanceof Date) return { $date: valor.toISOString() }
  if (Array.isArray(valor)) return valor.map(aEjson)
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, aEjson(v)]))
  }
  return valor
}

// Modo sin base de datos: escribe archivos JSON para pegar en Atlas.
function exportar() {
  const idCreador = (process.argv.find((a) => a.startsWith("--creador="))?.slice(10) ?? process.env.SEED_CREADOR ?? "").trim()
  if (!/^[0-9a-f]{24}$/i.test(idCreador)) {
    console.error("Falta --creador=<_id de tu usuario>: 24 caracteres hexadecimales.")
    console.error("Cópialo de la colección users en Atlas (el _id de tu cuenta).")
    process.exitCode = 1
    return
  }

  // tipos va vacío: son ids propios de tu base; luego puedes asignarlos al editar la encuesta en la app.
  const { encuesta, votos, respondientes } = construirDatos(new mongoose.Types.ObjectId(idCreador), [])

  mkdirSync("export-atlas", { recursive: true })
  writeFileSync("export-atlas/1-encuesta.json", JSON.stringify([aEjson(encuesta)], null, 2))

  const partes = 4
  const tamano = Math.ceil(votos.length / partes)
  for (let i = 0; i < partes; i++) {
    const trozo = votos.slice(i * tamano, (i + 1) * tamano)
    writeFileSync(`export-atlas/2-votos-parte-${i + 1}.json`, JSON.stringify(trozo.map(aEjson)))
  }

  console.log("Archivos generados en export-atlas/:")
  console.log("  1-encuesta.json            -> colección encuestas (1 documento)")
  console.log(`  2-votos-parte-1..${partes}.json   -> colección votos (${votos.length} documentos en total)`)
  mostrarResumen(respondientes)
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error("Falta MONGODB_URI en .env.local.")
    process.exit(1)
  }
  const esLocal = /127\.0\.0\.1|localhost/.test(uri)
  if (!esLocal && process.env.SEED_REMOTO !== "1") {
    console.error("MONGODB_URI apunta a un servidor remoto. Para poblarlo de todas formas define SEED_REMOTO=1.")
    process.exit(1)
  }

  await mongoose.connect(uri)
  const db = mongoose.connection.db
  console.log(`Conectado: ${uri.replace(/\/\/[^@]*@/, "//***@")}`)

  // Con --email la encuesta queda a nombre de un usuario real de la app, para poder
  // administrarla y exportarla al iniciar sesión con esa cuenta.
  const correo = (process.argv.find((a) => a.startsWith("--email="))?.slice(8) ?? process.env.SEED_EMAIL ?? "")
    .trim()
    .toLowerCase()
  let creador = null
  if (correo) {
    creador = await db.collection("users").findOne({ email: correo })
    if (!creador) {
      console.error(`No existe un usuario con el correo ${correo}. Regístrate primero en la app.`)
      process.exitCode = 1
      return
    }
  }

  // Limpieza total de encuestas y votos (útil para dejar solo la encuesta simulada).
  // Sin --confirmar solo informa y termina. Con --confirmar guarda un respaldo y borra.
  if (process.argv.includes("--limpiar")) {
    const nEncuestas = await db.collection("encuestas").countDocuments()
    const nVotos = await db.collection("votos").countDocuments()
    console.log(`\nLimpieza total: se borrarían ${nEncuestas} encuesta(s) y ${nVotos} voto(s).`)
    console.log("Los usuarios y los tipos de encuesta NO se tocan.")
    if (!process.argv.includes("--confirmar")) {
      console.log("Modo simulación: no se borró nada. Agrega --confirmar para borrar de verdad.")
      return
    }
    mkdirSync("backups", { recursive: true })
    const sello = new Date().toISOString().replace(/[:.]/g, "-")
    for (const nombre of ["encuestas", "votos"]) {
      const docs = await db.collection(nombre).find().toArray()
      writeFileSync(`backups/${sello}-${nombre}.json`, JSON.stringify(docs, null, 2))
    }
    console.log(`Respaldo guardado en backups/${sello}-encuestas.json y -votos.json`)
    await db.collection("votos").deleteMany({})
    await db.collection("encuestas").deleteMany({})
    console.log("Encuestas y votos borrados.\n")
  }

  // Solo se borra lo que el propio script creó (seed: true).
  const votosBorrados = await db.collection("votos").deleteMany({ seed: true })
  const encuestasBorradas = await db.collection("encuestas").deleteMany({ seed: true })
  console.log(`Simulación anterior borrada: ${encuestasBorradas.deletedCount} encuesta(s), ${votosBorrados.deletedCount} voto(s).`)

  if (process.argv.includes("--borrar")) return

  // Creador por defecto: un usuario simulado que no inicia sesión.
  creador ??= await db.collection("users").findOne({ email: EMAIL_CREADOR })
  if (!creador) {
    const hash = await bcrypt.hash(`no-login-${SEMILLA}`, 10)
    const r = await db.collection("users").insertOne({
      nombre: "Datos simulados",
      email: EMAIL_CREADOR,
      passwordHash: hash,
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0,
    })
    creador = { _id: r.insertedId }
  }

  // Tipos de encuesta (se reutilizan si ya existen).
  const tipos = []
  for (const nombre of ["Satisfacción", "Opinión general"]) {
    let tipo = await db.collection("surveytypes").findOne({ nombre })
    if (!tipo) {
      const r = await db.collection("surveytypes").insertOne({
        nombre, descripcion: "", createdAt: new Date(), updatedAt: new Date(), __v: 0,
      })
      tipo = { _id: r.insertedId }
    }
    tipos.push(tipo._id)
  }

  const { encuesta, votos, respondientes } = construirDatos(creador._id, tipos)
  await db.collection("encuestas").insertOne(encuesta)
  await db.collection("votos").insertMany(votos, { ordered: true })
  mostrarResumen(respondientes)
}

if (process.argv.includes("--exportar")) {
  exportar()
} else {
  main()
    .catch((error) => {
      console.error("Error al poblar la base:", error)
      process.exitCode = 1
    })
    .finally(() => mongoose.disconnect())
}
