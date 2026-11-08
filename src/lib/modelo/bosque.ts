// Bosque aleatorio: bagging de árboles de decisión con subconjuntos de variables.

import { entrenarArbol, predecirArbol, type NodoArbol } from "./arbol"
import { crearAzar } from "./metricas"
import type { Dataset, FilaEntrenamiento, ValorColumna } from "./tipos"

export interface ModeloBosque {
  tipo: "bosque"
  clases: string[]
  arboles: NodoArbol[]
}

export interface PrediccionBosque {
  clase: string
  probabilidades: Record<string, number>
}

export interface OpcionesBosque {
  numeroArboles?: number
  semilla?: number
  fraccionColumnas?: number
  maxProfundidad?: number
  minHoja?: number
}

export function entrenarBosque(dataset: Dataset, opciones: OpcionesBosque = {}): ModeloBosque {
  const {
    numeroArboles = 25,
    semilla = 20261012,
    fraccionColumnas = 0.7,
    maxProfundidad = 8,
    minHoja = 3,
  } = opciones

  const azar = crearAzar(semilla)
  const totalFilas = dataset.filas.length
  const totalColumnas = dataset.columnas.length
  const columnasPorArbol = Math.max(2, Math.min(totalColumnas, Math.round(totalColumnas * fraccionColumnas)))
  const arboles: NodoArbol[] = []

  for (let i = 0; i < numeroArboles; i++) {
    if (totalFilas === 0) break

    // Muestreo con reemplazo (bootstrap).
    const muestra: FilaEntrenamiento[] = []
    for (let j = 0; j < totalFilas; j++) {
      muestra.push(dataset.filas[Math.floor(azar() * totalFilas)])
    }

    // Subconjunto aleatorio de variables (sin reemplazo, Fisher-Yates parcial).
    const indices = dataset.columnas.map((_, indice) => indice)
    for (let j = indices.length - 1; j > 0; j--) {
      const k = Math.floor(azar() * (j + 1))
      const tmp = indices[j]
      indices[j] = indices[k]
      indices[k] = tmp
    }
    const columnas = indices.slice(0, columnasPorArbol).map((indice) => dataset.columnas[indice])

    const subconjunto: Dataset = { ...dataset, columnas, filas: muestra }
    arboles.push(entrenarArbol(subconjunto, { maxProfundidad, minHoja, minGanancia: 0.005 }))
  }

  return { tipo: "bosque", clases: dataset.clases, arboles }
}

export function predecirBosque(
  modelo: ModeloBosque,
  valores: Record<string, ValorColumna>
): PrediccionBosque {
  const acumulado: Record<string, number> = {}
  for (const clase of modelo.clases) acumulado[clase] = 0

  for (const arbol of modelo.arboles) {
    const prediccion = predecirArbol(arbol, valores)
    for (const clase of modelo.clases) {
      acumulado[clase] += prediccion.probabilidades[clase] ?? 0
    }
  }

  const total = modelo.arboles.length || 1
  const probabilidades: Record<string, number> = {}
  for (const clase of modelo.clases) probabilidades[clase] = acumulado[clase] / total

  const clase = modelo.clases.reduce(
    (mejor, actual) => (probabilidades[actual] > (probabilidades[mejor] ?? 0) ? actual : mejor),
    modelo.clases[0] ?? ""
  )

  return { clase, probabilidades }
}
