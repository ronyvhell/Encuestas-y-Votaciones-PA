// Tipos que consume la interfaz (sin dependencias del servidor).

import type { AnalisisFactores } from "./analisis"
import type { NodoArbol } from "./arbol"
import type { ComparacionAlgoritmo, DefinicionColumna } from "./tipos"

export interface MatrizVista {
  vp: number
  vn: number
  fp: number
  fn: number
}

export interface ClaseVista {
  clase: string
  soporte: number
  precision: number
  exhaustividad: number
  f1: number
}

export interface ReglaVista {
  condiciones: string[]
  clase: string
  n: number
  confianza: number
}

export interface ImportanciaVista {
  columna: string
  texto: string
  importancia: number
}

export interface ModeloVista {
  _id: string
  version: number
  algoritmo: string
  etiquetaAlgoritmo: string
  preguntaObjetivoId: string
  textoObjetivo: string
  politica: string
  createdAt: string
  nRegistros: number
  nExcluidos: number
  totalVotos: number
  clases: string[]
  clasePositiva: string
  distribucion: Record<string, number>
  exactitud: number
  precision: number
  exhaustividad: number
  f1: number
  macroF1: number
  matriz: MatrizVista
  porClase: ClaseVista[]
  comparacion: ComparacionAlgoritmo[]
  columnas: DefinicionColumna[]
  importancias: ImportanciaVista[]
  reglas: ReglaVista[]
  arbol: NodoArbol | null
}

export interface HistorialVista {
  _id: string
  version: number
  algoritmo: string
  etiquetaAlgoritmo: string
  createdAt: string
  exactitud: number
  f1: number
  nRegistros: number
  textoObjetivo: string
}

export interface EjemploVista {
  votoId: string
  fecha: string
  perfil: Array<{ texto: string; valor: string }>
  /** Respuestas crudas del voto, para poder cargarlas en el simulador. */
  respuestas: Record<string, unknown>
  real: string
  prediccion: string
  probabilidadPositiva: number
  acierto: boolean
}

export interface ObjetivoVista {
  preguntaId: string
  texto: string
  opciones: string[]
  positiva: string
  negativa: string
  tieneNoSe: boolean
}

export interface PreguntaVista {
  _id: string
  texto: string
  tipoPregunta: string
  opciones: string[]
  requerida: boolean
  config: { min: number | null; max: number | null }
}

export interface DatosModeloPage {
  encuestaId: string
  tituloEncuesta: string
  totalVotos: number
  preguntas: PreguntaVista[]
  objetivos: ObjetivoVista[]
  analisis: AnalisisFactores
  modelo: ModeloVista | null
  historial: HistorialVista[]
  ejemplos: EjemploVista[]
}
