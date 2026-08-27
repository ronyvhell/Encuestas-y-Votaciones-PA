export type PreguntaUI = {
  _id: string
  texto: string
  tipoPregunta: string
  opciones: string[]
  config: { min: number | null; max: number | null }
  requerida: boolean
}

export type TipoUI = { _id: string; nombre: string }

export type ResultadoUI = {
  preguntaId: string
  total: number
  conteoOpciones?: Record<string, number>
  valores?: (string | number)[]
  verdadero?: number
  falso?: number
}

export type EncuestaUI = {
  _id: string
  titulo: string
  descripcion: string
  imagenPortada: string
  estado: string
  tipos: TipoUI[]
  preguntas: PreguntaUI[]
  votos: number
  hasVoted?: boolean
  esPropietario?: boolean
  resultados?: ResultadoUI[]
  createdAt?: string
}

export type EncuestaListaUI = {
  _id: string
  titulo: string
  descripcion: string
  imagenPortada: string
  estado: string
  tipos: TipoUI[]
  preguntas: number
  votos: number
  createdAt: string
}

export type RespuestasUI = Record<string, string | string[] | number | boolean | undefined>
