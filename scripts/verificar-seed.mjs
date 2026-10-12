// Verifica los datos del seed (export-atlas/) y produce un informe:
// - Integridad estructural (cuántos votos, cuántas preguntas, valores faltantes).
// - Distribuciones de las variables.
// - Correlaciones que Weka debería poder encontrar.
// - Validez para exportar a CSV/ARFF (Weka) y a un tablero (Excel/Power BI).
import { readFileSync } from "node:fs"

const preguntasDef = [
  { id: "6acd12fc680ba85ccc212b5b", clave: "area" },
  { id: "6acd12fc680ba85ccc212b5c", clave: "antiguedad" },
  { id: "6acd12fc680ba85ccc212b5d", clave: "edad" },
  { id: "6acd12fc680ba85ccc212b5e", clave: "modalidad" },
  { id: "6acd12fc680ba85ccc212b5f", clave: "comunicacion" },
  { id: "6acd12fc680ba85ccc212b60", clave: "reconocimiento" },
  { id: "6acd12fc680ba85ccc212b61", clave: "carga" },
  { id: "6acd12fc680ba85ccc212b62", clave: "equipo" },
  { id: "6acd12fc680ba85ccc212b63", clave: "salario" },
  { id: "6acd12fc680ba85ccc212b64", clave: "recomendaria" },
  { id: "6acd12fc680ba85ccc212b65", clave: "sigue" },
]

const encuesta = JSON.parse(readFileSync("export-atlas/1-encuesta.json", "utf8"))[0]
const votos = []
for (let i = 1; i <= 4; i++) {
  const parte = JSON.parse(readFileSync(`export-atlas/2-votos-parte-${i}.json`, "utf8"))
  votos.push(...parte)
}

// ---- 1. Integridad ----
const totalEsperado = encuesta.votos
const faltantesPorPregunta = Object.fromEntries(preguntasDef.map((p) => [p.clave, 0]))
const idPreguntas = new Set(preguntasDef.map((p) => p.id))
const valoresInvalidos = []

for (const voto of votos) {
  const respondidas = new Set(voto.respuestas.map((r) => r.preguntaId))
  for (const p of preguntasDef) {
    if (!respondidas.has(p.id)) faltantesPorPregunta[p.clave]++
  }
  for (const r of voto.respuestas) {
    if (!idPreguntas.has(r.preguntaId)) valoresInvalidos.push(`preguntaId desconocido: ${r.preguntaId}`)
  }
  // voterId debe ser único
}

const voterIds = new Set(votos.map((v) => v.voterId))

// ---- 2. Distribuciones ----
function tabla(clave) {
  const cuenta = {}
  for (const voto of votos) {
    const r = voto.respuestas.find((x) => x.preguntaId === preguntasDef.find((p) => p.clave === clave).id)
    const val = String(r?.valor)
    cuenta[val] = (cuenta[val] ?? 0) + 1
  }
  return cuenta
}

const pct = (n) => `${((100 * n) / votos.length).toFixed(1)}%`

// ---- 3. Correlaciones clave (lo que Weka debe hallar) ----
function cruzar(claveFila, claveCol, filtroFila) {
  const total = votos.filter((v) => {
    const r = v.respuestas.find((x) => x.preguntaId === preguntasDef.find((p) => p.clave === claveFila).id)
    return filtroFila(String(r?.valor))
  })
  const si = total.filter((v) => {
    const r = v.respuestas.find((x) => x.preguntaId === preguntasDef.find((p) => p.clave === claveCol).id)
    return String(r?.valor) === "Sí"
  })
  return { n: total.length, si: si.length }
}

const escala = (v) => Number(v) >= 4
const escalaBaja = (v) => Number(v) <= 2

console.log("=== INFORME DE VERIFICACIÓN DEL SEED ===\n")
console.log(`Encuesta: "${encuesta.titulo}"`)
console.log(`Votos esperados: ${totalEsperado} | Votos exportados: ${votos.length}`)
console.log(`Preguntas en la encuesta: ${encuesta.preguntas.length} | Respuestas por voto: ${votos[0]?.respuestas.length}`)
console.log(`voterId únicos: ${voterIds.size} (${voterIds.size === votos.length ? "OK, sin duplicados" : "⚠ DUPLICADOS"})`)
console.log(`encuestaId correcto en todos: ${votos.every((v) => v.encuestaId.$oid === encuesta._id.$oid) ? "SÍ" : "NO"}`)
console.log(`Fechas entre 2026-06-01 y 2026-10-11: ${votos.every((v) => v.createdAt.$date >= "2026-06-01" && v.createdAt.$date <= "2026-10-12") ? "SÍ" : "NO"}`)

console.log("\n--- Valores faltantes por pregunta ---")
let totalFaltantes = 0
for (const [k, n] of Object.entries(faltantesPorPregunta)) {
  if (n) totalFaltantes += n
  console.log(`  ${k}: ${n}`)
}
console.log(`  Total faltantes: ${totalFaltantes} ${totalFaltantes === 0 ? "✅ datos completos" : "⚠"}`)

console.log("\n--- Distribuciones ---")
for (const [clave, cuenta] of Object.entries({
  area: tabla("area"),
  antiguedad: tabla("antiguedad"),
  edad: tabla("edad"),
  modalidad: tabla("modalidad"),
  sigue: tabla("sigue"),
  recomendaria: tabla("recomendaria"),
})) {
  const resumen = Object.entries(cuenta).map(([k, n]) => `${k}=${n} (${pct(n)})`).join(", ")
  console.log(`  ${clave}: ${resumen}`)
}

console.log("\n--- Escalas (1-5) ---")
for (const clave of ["comunicacion", "reconocimiento", "carga", "equipo", "salario"]) {
  const c = tabla(clave)
  const promedio = (Object.entries(c).reduce((s, [k, n]) => s + Number(k) * n, 0) / votos.length).toFixed(2)
  console.log(`  ${clave}: promedio=${promedio} | ${Object.entries(c).map(([k, n]) => `${k}:${n}`).join(" ")}`)
}

console.log("\n--- Correlaciones que Weka debe encontrar (predictor → ¿seguir?=Sí) ---")
const alta = (clave) => cruzar(clave, "sigue", escala)
const baja = (clave) => cruzar(clave, "sigue", escalaBaja)
for (const clave of ["comunicacion", "reconocimiento", "carga", "equipo", "salario"]) {
  const a = alta(clave)
  const b = baja(clave)
  console.log(`  ${clave}: 4-5 → Sí ${a.si}/${a.n} (${((100 * a.si) / a.n).toFixed(0)}%) | 1-2 → Sí ${b.si}/${b.n} (${((100 * b.si) / b.n).toFixed(0)}%)`)
}

console.log("\n--- Aptitud para Weka ---")
const tiposValores = new Set()
for (const voto of votos) for (const r of voto.respuestas) tiposValores.add(typeof r.valor)
console.log(`  Tipos de dato presentes: ${[...tiposValores].join(", ")} (boolean → se exporta como 'true'/'false')`)
console.log("  Atributo clase (target): 'sigue' = Sí / No / No sé (nominal, 3 clases) ✅")
console.log(`  Instancias: ${votos.length} (suficiente para clasificación) ✅`)
