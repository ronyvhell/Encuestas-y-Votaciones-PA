// Convierte una encuesta ya existente en una encuesta "binaria": la pregunta
// objetivo se queda solo con dos opciones (por ejemplo Sí / No).
//
// Uso:
//   node scripts/migrar-binario.mjs                     (simulación: solo informa)
//   node scripts/migrar-binario.mjs --confirmar          aplica los cambios
//   node scripts/migrar-binario.mjs --encuesta=<_id>     elige la encuesta por id
//   node scripts/migrar-binario.mjs --titulo="Clima y comunicación laboral"
//   node scripts/migrar-binario.mjs --politica=mapear    cuenta "No sé" como la clase negativa
//   node scripts/migrar-binario.mjs --politica=borrar    elimina esos votos
//
// Antes de escribir nada guarda un respaldo en backups/.
// Usa MONGODB_URI de .env.local; para un servidor remoto exige SEED_REMOTO=1.

import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import mongoose from "mongoose"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")

const arg = (nombre) => process.argv.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3)
const confirmar = process.argv.includes("--confirmar")
const politica = (arg("politica") ?? "mapear").toLowerCase()
const tituloBuscado = arg("titulo") ?? "Clima y comunicación laboral"
const encuestaId = arg("encuesta") ?? ""

if (!["mapear", "borrar"].includes(politica)) {
  console.error("--politica debe ser 'mapear' (No sé -> No) o 'borrar' (elimina esos votos).")
  process.exit(1)
}

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("Falta MONGODB_URI en .env.local.")
  process.exit(1)
}
if (!/127\.0\.0\.1|localhost/.test(uri) && process.env.SEED_REMOTO !== "1") {
  console.error("MONGODB_URI apunta a un servidor remoto. Define SEED_REMOTO=1 para continuar.")
  process.exit(1)
}

const NO_SE = /^(no se|no sé|ns\/?nc|no sabe)$/i
const normalizar = (texto) =>
  String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()

await mongoose.connect(uri)
const db = mongoose.connection.db
console.log(`Conectado: ${uri.replace(/\/\/[^@]*@/, "//***@")}`)

const filtro = encuestaId
  ? { _id: new mongoose.Types.ObjectId(encuestaId) }
  : { titulo: tituloBuscado }

const encuestas = await db.collection("encuestas").find(filtro).toArray()
if (encuestas.length === 0) {
  console.error(`No se encontró ninguna encuesta con ${encuestaId ? `_id ${encuestaId}` : `título "${tituloBuscado}"`}.`)
  await mongoose.disconnect()
  process.exit(1)
}

let totalVotosBorrados = 0
let totalVotosMapeados = 0
const respaldos = []

for (const encuesta of encuestas) {
  const preguntas = encuesta.preguntas ?? []
  // Pregunta objetivo: la de clave "sigue" o la que tenga una opción "No sé".
  const objetivo =
    preguntas.find((p) => p.clave === "sigue") ??
    preguntas.find(
      (p) =>
        p.tipoPregunta === "seleccion_unica" &&
        (p.opciones ?? []).some((opcion) => NO_SE.test(normalizar(opcion)))
    )

  if (!objetivo) {
    console.log(`\n"${encuesta.titulo}": no tiene pregunta con opción "No sé". Se omite.`)
    continue
  }

  const neutral = (objetivo.opciones ?? []).find((opcion) => NO_SE.test(normalizar(opcion)))
  if (!neutral) {
    console.log(`\n"${encuesta.titulo}": la pregunta "${objetivo.texto}" ya es binaria. Se omite.`)
    continue
  }

  const restantes = objetivo.opciones.filter((opcion) => opcion !== neutral)
  const votos = await db
    .collection("votos")
    .find({ encuestaId: encuesta._id })
    .toArray()
  const afectados = votos.filter((voto) =>
    (voto.respuestas ?? []).some(
      (respuesta) =>
        String(respuesta.preguntaId) === String(objetivo._id) &&
        normalizar(respuesta.valor) === normalizar(neutral)
    )
  )

  console.log(`\nEncuesta "${encuesta.titulo}" (${encuesta._id})`)
  console.log(`  Pregunta objetivo: ${objetivo.texto}`)
  console.log(`  Opciones actuales: ${objetivo.opciones.join(" | ")}`)
  console.log(`  Opciones resultantes: ${restantes.join(" | ")}`)
  console.log(`  Votos con "${neutral}": ${afectados.length} de ${votos.length}`)
  console.log(`  Política: ${politica === "borrar" ? "eliminar esos votos" : `contar "${neutral}" como "${restantes[1]}"`}`)

  if (!confirmar) continue

  respaldos.push({
    nombre: `encuesta-${encuesta._id}`,
    contenido: JSON.stringify([encuesta], null, 2),
  })

  if (politica === "borrar") {
    if (afectados.length > 0) {
      await db.collection("votos").deleteMany({ _id: { $in: afectados.map((voto) => voto._id) } })
      totalVotosBorrados += afectados.length
    }
  } else {
    const claseNegativa = restantes[1] ?? "No"
    for (const voto of afectados) {
      const respuestas = (voto.respuestas ?? []).map((respuesta) =>
        String(respuesta.preguntaId) === String(objetivo._id) &&
        normalizar(respuesta.valor) === normalizar(neutral)
          ? { ...respuesta, valor: claseNegativa }
          : respuesta
      )
      await db.collection("votos").updateOne({ _id: voto._id }, { $set: { respuestas } })
    }
    totalVotosMapeados += afectados.length
  }

  // Se quita la opción neutra de la pregunta y se recalcula el contador de votos.
  const preguntasActualizadas = preguntas.map((pregunta) =>
    String(pregunta._id) === String(objetivo._id) ? { ...pregunta, opciones: restantes } : pregunta
  )
  const votosRestantes = await db.collection("votos").countDocuments({ encuestaId: encuesta._id })

  await db.collection("encuestas").updateOne(
    { _id: encuesta._id },
    {
      $set: {
        preguntas: preguntasActualizadas,
        votos: votosRestantes,
        updatedAt: new Date(),
      },
    }
  )
}

if (confirmar && respaldos.length > 0) {
  mkdirSync("backups", { recursive: true })
  const sello = new Date().toISOString().replace(/[:.]/g, "-")
  for (const respaldo of respaldos) {
    writeFileSync(`backups/${sello}-${respaldo.nombre}.json`, respaldo.contenido)
  }
  console.log(`\nRespaldo guardado en backups/ (${respaldos.length} encuesta/s).`)
  console.log(
    politica === "borrar"
      ? `Votos eliminados: ${totalVotosBorrados}.`
      : `Votos reetiquetados como clase negativa: ${totalVotosMapeados}.`
  )
} else if (!confirmar) {
  console.log("\nModo simulación: no se modificó nada. Agrega --confirmar para aplicar los cambios.")
}

await mongoose.disconnect()
