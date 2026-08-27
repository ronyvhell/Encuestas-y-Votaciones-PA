export const TIPOS_PREGUNTA = [
  { value: "texto", label: "Texto libre" },
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

export const PALETA_BADGES = [
  "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  "border-lime-500/25 bg-lime-500/10 text-lime-700 dark:text-lime-300",
  "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300",
] as const

export function colorBadge(indice: number) {
  return PALETA_BADGES[indice % PALETA_BADGES.length]
}

export const TIPOS_ENCUESTA_DEFAULT = [
  "Satisfacción",
  "Opinión general",
  "Eventos",
  "Personalizada",
]

export const ESTADOS_ENCUESTA = ["borrador", "publicada"] as const
export type EstadoEncuesta = (typeof ESTADOS_ENCUESTA)[number]
