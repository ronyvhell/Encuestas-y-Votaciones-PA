export const TIPOS_PREGUNTA = [
  { value: "texto", label: "Texto libre" },
  { value: "numerico", label: "Campo numérico" },
  { value: "verdadero_falso", label: "Verdadero / Falso" },
  { value: "checklist", label: "Checklist" },
  { value: "seleccion_multiple", label: "Selección múltiple" },
  { value: "seleccion_unica", label: "Selección única" },
] as const

export type TipoPregunta = (typeof TIPOS_PREGUNTA)[number]["value"]

export function esTipoConOpciones(tipo: string) {
  return (
    tipo === "checklist" ||
    tipo === "seleccion_multiple" ||
    tipo === "seleccion_unica"
  )
}

export const TIPOS_ENCUESTA_DEFAULT = [
  "Satisfacción",
  "Opinión general",
  "Eventos",
  "Personalizada",
]

export const ESTADOS_ENCUESTA = ["borrador", "publicada"] as const
export type EstadoEncuesta = (typeof ESTADOS_ENCUESTA)[number]
