import { TIPOS_PREGUNTA } from "@/lib/constants"

export interface PreguntaInput {
  texto: string
  tipoPregunta: string
  opciones: string[]
  config: { min: number | null; max: number | null }
  requerida: boolean
  orden: number
}

export interface EncuestaInput {
  titulo: string
  descripcion: string
  imagenPortada: string
  tipos: string[]
  preguntas: PreguntaInput[]
}

export function parseEncuestaInput(body: unknown): { data: EncuestaInput } | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Datos inválidos." }
  }

  const b = body as Record<string, unknown>
  const titulo = typeof b.titulo === "string" ? b.titulo.trim() : ""
  const descripcion = typeof b.descripcion === "string" ? b.descripcion.trim() : ""
  const imagenPortada = typeof b.imagenPortada === "string" ? b.imagenPortada.trim() : ""
  const tipos = Array.isArray(b.tipos)
    ? b.tipos.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean)
    : []
  const preguntas: unknown[] = Array.isArray(b.preguntas) ? b.preguntas : []

  if (!titulo) {
    return { error: "El título de la encuesta es obligatorio." }
  }
  if (titulo.length > 120) {
    return { error: "El título no puede superar los 120 caracteres." }
  }
  if (descripcion.length > 500) {
    return { error: "La descripción no puede superar los 500 caracteres." }
  }
  if (preguntas.length === 0) {
    return { error: "Debes agregar al menos una pregunta." }
  }

  const preguntasValidas: PreguntaInput[] = []

  for (let indice = 0; indice < preguntas.length; indice++) {
    const p = preguntas[indice] as {
      texto?: unknown
      tipoPregunta?: unknown
      opciones?: unknown
      config?: unknown
      requerida?: unknown
    }
    const texto = typeof p.texto === "string" ? p.texto.trim() : ""
    const tipoPregunta = p.tipoPregunta
    const config = (p.config ?? {}) as { min?: unknown; max?: unknown }
    const requerida = p.requerida === true

    const conOpciones =
      tipoPregunta === "checklist" ||
      tipoPregunta === "seleccion_multiple" ||
      tipoPregunta === "seleccion_unica"

    const opciones = Array.isArray(p.opciones)
      ? (p.opciones as unknown[])
          .filter((o) => typeof o === "string")
          .map((o) => String(o).trim())
          .filter((o) => o.length > 0)
          .slice(0, 20)
      : []

    if (!texto) {
      return { error: `La pregunta ${indice + 1} no tiene texto.` }
    }
    if (!TIPOS_PREGUNTA.some((t) => t.value === tipoPregunta)) {
      return { error: `La pregunta ${indice + 1} tiene un tipo no válido.` }
    }
    if (conOpciones && opciones.length < 2) {
      return { error: `La pregunta ${indice + 1} necesita al menos 2 opciones.` }
    }

    const min = typeof config.min === "number" && Number.isFinite(config.min) ? config.min : null
    const max = typeof config.max === "number" && Number.isFinite(config.max) ? config.max : null

    preguntasValidas.push({
      texto,
      tipoPregunta: tipoPregunta as string,
      opciones: conOpciones ? opciones : [],
      config: { min, max },
      requerida,
      orden: indice,
    })
  }

  return { data: { titulo, descripcion, imagenPortada, tipos, preguntas: preguntasValidas } }
}
