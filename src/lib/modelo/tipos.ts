// Tipos compartidos por la librería del modelo predictivo.
// Este archivo NO importa mongoose: puede usarse desde componentes cliente.

export type AlgoritmoModelo = "arbol" | "naive_bayes" | "knn" | "bosque"

export type PoliticaObjetivo = "excluir" | "mapear_no"

export const ALGORITMOS: Array<{ value: AlgoritmoModelo; label: string; descripcion: string }> = [
  {
    value: "arbol",
    label: "Árbol de decisión (J48)",
    descripcion: "Interpretable: genera reglas legibles. Es el modelo principal del proyecto.",
  },
  {
    value: "naive_bayes",
    label: "Naive Bayes",
    descripcion: "Probabilístico y rápido; sirve de comparación.",
  },
  {
    value: "knn",
    label: "k-NN (k = 5)",
    descripcion: "Basado en vecinos más cercanos; no produce reglas.",
  },
  {
    value: "bosque",
    label: "Bosque aleatorio",
    descripcion: "Bagging de 25 árboles; suele mejorar la exactitud del árbol único.",
  },
]

/** Pregunta con la forma mínima que necesita la librería (compatible con IPregunta). */
export interface PreguntaEntrada {
  _id?: { toString(): string } | string
  texto: string
  tipoPregunta: string
  opciones: string[]
  requerida?: boolean
  orden?: number
  clave?: string
}

/** Voto con la forma mínima que necesita la librería (compatible con IVoto). */
export interface VotoEntrada {
  _id?: { toString(): string } | string
  respuestas: Array<{ preguntaId: string; valor: unknown }>
  createdAt?: Date | string
}

export type ValorColumna = number | string

export interface DefinicionColumna {
  /** Identificador único de la variable (id de pregunta, o `id::opción` en multi-respuesta). */
  id: string
  preguntaId: string
  texto: string
  tipo: "numerico" | "nominal"
  /** Valores posibles para variables nominales (para el modelo y la UI). */
  opciones: string[]
  /** Mediana para imputar valores faltantes en variables numéricas. */
  mediana?: number
  /** La pregunta es verdadero/falso. */
  booleano?: boolean
  /** Columna derivada de una opción de checklist / selección múltiple. */
  multiple?: boolean
}

export interface FilaEntrenamiento {
  votoId: string
  valores: Record<string, ValorColumna>
  clase: string
}

export interface Dataset {
  columnas: DefinicionColumna[]
  filas: FilaEntrenamiento[]
  /** [clase positiva, clase negativa] */
  clases: string[]
  clasePositiva: string
  totalVotos: number
  excluidos: number
  distribucion: Record<string, number>
}

export interface ObjetivoPosible {
  preguntaId: string
  texto: string
  tipo: "verdadero_falso" | "seleccion_unica"
  opciones: string[]
  positiva: string
  negativa: string
  tieneNoSe: boolean
}

export interface ComparacionAlgoritmo {
  algoritmo: AlgoritmoModelo
  etiqueta: string
  exactitud: number
  precision: number
  exhaustividad: number
  f1: number
  macroF1: number
  /** Desviación estándar de la exactitud entre particiones de la validación cruzada. */
  desviacion: number
}
