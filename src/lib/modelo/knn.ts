// k-NN sobre una codificación numérica (normalización + one-hot de nominales).

import type { Dataset, ValorColumna } from "./tipos"

export type ColumnaKnn =
  | { id: string; tipo: "numerico"; min: number; max: number }
  | { id: string; tipo: "nominal"; valores: string[] }

export interface ModeloKnn {
  tipo: "knn"
  k: number
  clases: string[]
  columnas: ColumnaKnn[]
  filas: Array<{ vector: number[]; clase: string }>
}

export interface PrediccionKnn {
  clase: string
  probabilidades: Record<string, number>
}

function codificar(columnas: ColumnaKnn[], valores: Record<string, ValorColumna>): number[] {
  const vector: number[] = []

  for (const columna of columnas) {
    if (columna.tipo === "numerico") {
      const valor = Number(valores[columna.id])
      const rango = columna.max - columna.min
      vector.push(Number.isFinite(valor) && rango > 0 ? (valor - columna.min) / rango : 0.5)
      continue
    }

    const texto = String(valores[columna.id] ?? "")
    for (const opcion of columna.valores) {
      vector.push(texto === opcion ? 1 : 0)
    }
  }

  return vector
}

export function entrenarKnn(dataset: Dataset, k = 5): ModeloKnn {
  const columnas: ColumnaKnn[] = dataset.columnas.map((columna) => {
    if (columna.tipo === "numerico") {
      const valores = dataset.filas
        .map((fila) => Number(fila.valores[columna.id]))
        .filter((valor) => Number.isFinite(valor))
      return {
        id: columna.id,
        tipo: "numerico",
        min: valores.length > 0 ? Math.min(...valores) : 0,
        max: valores.length > 0 ? Math.max(...valores) : 1,
      }
    }

    const valores =
      columna.opciones.length > 0
        ? columna.opciones
        : [...new Set(dataset.filas.map((fila) => String(fila.valores[columna.id])))]
    return { id: columna.id, tipo: "nominal", valores }
  })

  return {
    tipo: "knn",
    k,
    clases: dataset.clases,
    columnas,
    filas: dataset.filas.map((fila) => ({
      vector: codificar(columnas, fila.valores),
      clase: fila.clase,
    })),
  }
}

export function predecirKnn(
  modelo: ModeloKnn,
  valores: Record<string, ValorColumna>
): PrediccionKnn {
  const vector = codificar(modelo.columnas, valores)

  const distancias = modelo.filas.map((fila) => {
    let suma = 0
    const longitud = Math.min(vector.length, fila.vector.length)
    for (let i = 0; i < longitud; i++) {
      const diferencia = fila.vector[i] - vector[i]
      suma += diferencia * diferencia
    }
    return { clase: fila.clase, distancia: Math.sqrt(suma) }
  })

  distancias.sort((a, b) => a.distancia - b.distancia)

  const k = Math.max(1, Math.min(modelo.k, distancias.length))
  const pesos: Record<string, number> = {}
  for (let i = 0; i < k; i++) {
    const vecino = distancias[i]
    const peso = 1 / (vecino.distancia + 1e-6)
    pesos[vecino.clase] = (pesos[vecino.clase] ?? 0) + peso
  }

  const total = Object.values(pesos).reduce((a, b) => a + b, 0) || 1
  const probabilidades: Record<string, number> = {}
  for (const clase of modelo.clases) probabilidades[clase] = (pesos[clase] ?? 0) / total

  const clase = modelo.clases.reduce(
    (mejor, actual) => (probabilidades[actual] > (probabilidades[mejor] ?? 0) ? actual : mejor),
    modelo.clases[0] ?? ""
  )

  return { clase, probabilidades }
}
