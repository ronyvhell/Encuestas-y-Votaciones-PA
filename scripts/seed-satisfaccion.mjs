// Pobla la base con una encuesta de satisfacción y experiencia de compra en línea.
// Los votos tienen correlaciones intencionales (producto, envío, precio, app y
// atención influyen en la intención de volver a comprar), para que el modelo y
// Weka encuentren patrones.
//
// Uso:
//   npm run seed:satisfaccion                      520 votos con un usuario simulado
//   npm run seed:satisfaccion -- --email=tu@correo.com   deja la encuesta a tu nombre
//   npm run seed:satisfaccion -- --total=800       cambia el número de votos
//   npm run seed:satisfaccion -- --borrar          elimina solo estos datos simulados
//   npm run seed:satisfaccion -- --exportar --creador=<_id>
//                                                  genera JSON en export-atlas-satisfaccion/
//
// Usa MONGODB_URI de .env.local. Por seguridad no escribe en un servidor remoto
// (Atlas) salvo que definas SEED_REMOTO=1.

import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import mongoose from "mongoose"
import bcrypt from "bcryptjs"

if (existsSync(".env.local")) process.loadEnvFile(".env.local")

const arg = (nombre) => process.argv.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3)

const SEMILLA = 20261015
const SEED_CLAVE = "satisfaccion"
const TITULO = "Satisfacción y experiencia de compra en línea"
const DESCRIPCION =
  "Encuesta de satisfacción del cliente. Datos simulados para el tablero y el modelo predictivo."
const PORTADA = "/portada-compra-en-linea.svg"
const INICIO = new Date("2026-02-01T08:00:00-05:00")
const FIN = new Date("2026-10-05T18:00:00-05:00")
const EMAIL_CREADOR = "datos.satisfaccion@encuestas.local"
const CARPETA_EXPORT = "export-atlas-satisfaccion"
const ESCALA = ["1", "2", "3", "4", "5"]

const totalArgumento = Number(arg("total"))
const TOTAL_VOTOS =
  Number.isFinite(totalArgumento) && totalArgumento >= 100 ? Math.round(totalArgumento) : 520

const FRECUENCIA = ["Varias veces por semana", "Una vez por semana", "Una vez al mes", "Cada varios meses"]
const PESO_FRECUENCIA = [20, 30, 35, 15]
const DISPOSITIVO = ["Celular", "Computador", "Tablet"]
const PESO_DISPOSITIVO = [60, 30, 10]
const CATEGORIA = ["Tecnología", "Moda", "Hogar", "Alimentos", "Belleza"]
const PESO_CATEGORIA = [25, 25, 20, 20, 10]
const EDAD = ["18 a 25", "26 a 35", "36 a 45", "46 o más"]
const PESO_EDAD = [28, 40, 22, 10]

// "clave" enlaza la pregunta con el valor generado.
const PREGUNTAS_DEF = [
  { clave: "frecuencia", tipo: "seleccion_unica", texto: "¿Con qué frecuencia compras en línea?", opciones: FRECUENCIA },
  { clave: "dispositivo", tipo: "seleccion_unica", texto: "¿Desde qué dispositivo sueles comprar?", opciones: DISPOSITIVO },
  { clave: "categoria", tipo: "seleccion_unica", texto: "¿Qué categoría de productos compras más?", opciones: CATEGORIA },
  { clave: "edad", tipo: "seleccion_unica", texto: "¿En qué rango de edad estás?", opciones: EDAD },
  { clave: "precio", tipo: "seleccion_unica", texto: "¿Qué tan satisfecho estás con el precio? (1 = nada, 5 = totalmente)", opciones: ESCALA },
  { clave: "envio", tipo: "seleccion_unica", texto: "¿Cómo calificas la rapidez y el estado del envío? (1 = muy malo, 5 = excelente)", opciones: ESCALA },
  { clave: "producto", tipo: "seleccion_unica", texto: "¿Cómo calificas la calidad del producto recibido? (1 = muy mala, 5 = excelente)", opciones: ESCALA },
  { clave: "atencion", tipo: "seleccion_unica", texto: "¿Cómo calificas la atención al cliente? (1 = muy mala, 5 = excelente)", opciones: ESCALA },
  { clave: "devoluciones", tipo: "seleccion_unica", texto: "¿Qué tan fácil te resultó devolver o cambiar un producto? (1 = muy difícil, 5 = muy fácil)", opciones: ESCALA },
  { clave: "app", tipo: "seleccion_unica", texto: "¿Qué tan fácil es usar la tienda o la app? (1 = muy difícil, 5 = muy fácil)", opciones: ESCALA },
  { clave: "recomendaria", tipo: "verdadero_falso", texto: "¿Recomendarías esta tienda a otra persona?", opciones: [] },
  // Variable objetivo BINARIA: solo dos resultados posibles (Sí / No).
  { clave: "volveria", tipo: "seleccion_unica", texto: "¿Volverías a comprar en esta tienda?", opciones: ["Sí", "No"] },
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

// Genera un comprador. Las escalas comparten una "experiencia" latente, así que
// se mueven juntas; "volveria" depende sobre todo de ellas y de la frecuencia.
function generarRespondiente() {
  const frecuencia = ponderado(FRECUENCIA, PESO_FRECUENCIA)
  const dispositivo = ponderado(DISPOSITIVO, PESO_DISPOSITIVO)
  const categoria = ponderado(CATEGORIA, PESO_CATEGORIA)
  const edad = ponderado(EDAD, PESO_EDAD)

  const experiencia = normal()
  const nota = (efecto, extra = 0) =>
    clamp(Math.round(3.1 + efecto * experiencia + extra + normal() * 0.65), 1, 5)

  const precio = nota(0.55, categoria === "Tecnología" ? -0.35 : categoria === "Belleza" ? 0.2 : 0)
  const envio = nota(0.75, categoria === "Alimentos" ? -0.3 : 0)
  const producto = nota(0.85, categoria === "Moda" ? -0.2 : 0)
  const atencion = nota(0.6, dispositivo === "Tablet" ? -0.2 : 0)
  const devoluciones = nota(0.5, categoria === "Tecnología" ? 0.2 : 0)
  const app = nota(0.7, dispositivo === "Celular" ? 0.25 : dispositivo === "Tablet" ? -0.15 : 0)

  const puntaje =
    0.3 * (producto - 3) +
    0.2 * (envio - 3) +
    0.15 * (precio - 3) +
    0.15 * (app - 3) +
    0.12 * (atencion - 3) +
    0.08 * (devoluciones - 3)

  const bonoFrecuencia =
    frecuencia === "Varias veces por semana" ? 0.35 : frecuencia === "Cada varios meses" ? -0.25 : 0
  const s = puntaje + bonoFrecuencia + normal() * 0.55

  // Objetivo binario: el cliente vuelve a comprar (Sí) o no vuelve (No).
  let volveria = s > 0 ? "Sí" : "No"
  if (azar() < 0.06) volveria = volveria === "Sí" ? "No" : "Sí" // ruido realista

  const recomendaria = s + normal() * 0.5 > 0

  return {
    frecuencia,
    dispositivo,
    categoria,
    edad,
    precio: String(precio),
    envio: String(envio),
    producto: String(producto),
    atencion: String(atencion),
    devoluciones: String(devoluciones),
    app: String(app),
    recomendaria,
    volveria,
  }
}

// Construye la encuesta, sus preguntas y los votos. No toca la base de datos.
function construirDatos(creadorId, tipos) {
  const preguntas = PREGUNTAS_DEF.map((p, orden) => ({
    _id: new mongoose.Types.ObjectId(),
    texto: p.texto,
    tipoPregunta: p.tipo,
    opciones: p.opciones,
    config: { min: null, max: null },
    requerida: true,
    orden,
    clave: p.clave, // se conserva para que la exportación use nombres de columna legibles
  }))

  const encuestaId = new mongoose.Types.ObjectId()
  const respondientes = Array.from({ length: TOTAL_VOTOS }, () => generarRespondiente())
  const fechas = respondientes
    .map(() => new Date(INICIO.getTime() + azar() * (FIN.getTime() - INICIO.getTime())))
    .sort((a, b) => a - b)

  const votos = respondientes.map((r, i) => ({
    _id: new mongoose.Types.ObjectId(),
    encuestaId,
    voterId: `seed-${SEED_CLAVE}-${String(i + 1).padStart(4, "0")}-${hex8()}`,
    ipHash: hex8() + hex8() + hex8() + hex8() + hex8() + hex8() + hex8() + hex8(),
    respuestas: preguntas.map((p) => ({
      preguntaId: String(p._id),
      valor: p.tipoPregunta === "verdadero_falso" ? r.recomendaria : String(r[p.clave]),
    })),
    createdAt: fechas[i],
    updatedAt: fechas[i],
    __v: 0,
    seed: true,
    seedClave: SEED_CLAVE,
  }))

  const encuesta = {
    _id: encuestaId,
    titulo: TITULO,
    descripcion: DESCRIPCION,
    imagenPortada: PORTADA,
    tipos,
    estado: "publicada",
    creador: creadorId,
    preguntas,
    votos: votos.length,
    createdAt: INICIO,
    updatedAt: FIN,
    __v: 0,
    seed: true,
    seedClave: SEED_CLAVE,
  }

  return { encuesta, votos, respondientes }
}

// Resumen para verificar que las correlaciones existen.
function mostrarResumen(respondientes) {
  const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0)
  const siVuelve = (filtro) => {
    const grupo = respondientes.filter(filtro)
    return pct(grupo.filter((r) => r.volveria === "Sí").length, grupo.length)
  }

  console.log(`\nEncuesta "${TITULO}" con ${respondientes.length} votos.`)
  for (const op of ["Sí", "No"]) {
    console.log(`  ¿Volvería? ${op}: ${respondientes.filter((r) => r.volveria === op).length}`)
  }
  console.log(`  % que volvería con producto 4-5:           ${siVuelve((r) => +r.producto >= 4)}%`)
  console.log(`  % que volvería con producto 1-2:           ${siVuelve((r) => +r.producto <= 2)}%`)
  console.log(`  % que volvería con envío 4-5:              ${siVuelve((r) => +r.envio >= 4)}%`)
  console.log(`  % que volvería con envío 1-2:              ${siVuelve((r) => +r.envio <= 2)}%`)
  console.log(`  % que volvería con app 4-5:                ${siVuelve((r) => +r.app >= 4)}%`)
  console.log(`  % que volvería comprando varias veces:     ${siVuelve((r) => r.frecuencia === "Varias veces por semana")}%`)
  console.log(`  % que sí recomendaría:                     ${pct(respondientes.filter((r) => r.recomendaria).length, respondientes.length)}%`)
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
  const idCreador = (arg("creador") ?? process.env.SEED_CREADOR ?? "").trim()
  if (!/^[0-9a-f]{24}$/i.test(idCreador)) {
    console.error("Falta --creador=<_id de tu usuario>: 24 caracteres hexadecimales.")
    console.error("Cópialo de la colección users en Atlas (el _id de tu cuenta).")
    process.exitCode = 1
    return
  }

  const { encuesta, votos, respondientes } = construirDatos(
    new mongoose.Types.ObjectId(idCreador),
    []
  )

  mkdirSync(CARPETA_EXPORT, { recursive: true })
  writeFileSync(`${CARPETA_EXPORT}/1-encuesta.json`, JSON.stringify([aEjson(encuesta)], null, 2))

  const partes = 4
  const tamano = Math.ceil(votos.length / partes)
  for (let i = 0; i < partes; i++) {
    const trozo = votos.slice(i * tamano, (i + 1) * tamano)
    writeFileSync(`${CARPETA_EXPORT}/2-votos-parte-${i + 1}.json`, JSON.stringify(trozo.map(aEjson)))
  }

  console.log(`Archivos generados en ${CARPETA_EXPORT}/:`)
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

  const correo = (arg("email") ?? process.env.SEED_EMAIL ?? "").trim().toLowerCase()
  let creador = null
  if (correo) {
    creador = await db.collection("users").findOne({ email: correo })
    if (!creador) {
      console.error(`No existe un usuario con el correo ${correo}. Regístrate primero en la app.`)
      process.exitCode = 1
      return
    }
  }

  // Solo se borra lo que creó este mismo seed, así puede convivir con el de clima laboral.
  const votosBorrados = await db.collection("votos").deleteMany({ seedClave: SEED_CLAVE })
  const encuestasBorradas = await db.collection("encuestas").deleteMany({ seedClave: SEED_CLAVE })
  console.log(
    `Simulación anterior borrada: ${encuestasBorradas.deletedCount} encuesta(s), ${votosBorrados.deletedCount} voto(s).`
  )

  if (process.argv.includes("--borrar")) return

  // Creador por defecto: un usuario simulado que no inicia sesión.
  creador ??= await db.collection("users").findOne({ email: EMAIL_CREADOR })
  if (!creador) {
    const hash = await bcrypt.hash(`no-login-${SEMILLA}`, 10)
    const r = await db.collection("users").insertOne({
      nombre: "Datos simulados · satisfacción",
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
  console.log(`\nEncuesta creada con _id ${encuesta._id} y ${votos.length} votos.`)
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
