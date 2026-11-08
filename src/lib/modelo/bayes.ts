// Clasificador Naive Bayes: gaussiano para variables numéricas y multinomial
// con suavizado de Laplace para variables nominales.

import type { Dataset, ValorColumna } from "./tipos"

export interface ColumnaBayesNumerica {
  id: string
  tipo: "numerico"
  medias: Record<string, number>
  varianzas: Record<string, number>
}

export interface ColumnaBayesNominal {
  id: string
  tipo: "nominal"
  probabilidades: Record<string, Record<string, number>>
}

export type ColumnaBayes = ColumnaBayesNumerica | ColumnaBayesNominal

export interface ModeloBayes {
  tipo: "naive_bayes"
  clases: string[]
  prior: Record<string, number>
  columnas: ColumnaBayes[]
}

export interface PrediccionBayes {
  clase: string
  probabilidades: Record<string, number>
}

const VARIANZA_MINIMA = 1e-6

export function entrenarBayes(dataset: Dataset): ModeloBayes {
  const total = dataset.filas.length
  const prior: Record<string, number> = {}

  for (const clase of dataset.clases) {
    const filas = dataset.filas.filter((fila) => fila.clase === clase).length
    prior[clase] = total > 0 ? filas / total : 0
  }

  const columnas: ColumnaBayes[] = dataset.columnas.map((columna) => {
    if (columna.tipo === "numerico") {
      const medias: Record<string, number> = {}
      const varianzas: Record<string, number> = {}

      for (const clase of dataset.clases) {
        const valores = dataset.filas
          .filter((fila) => fila.clase === clase)
          .map((fila) => Number(fila.valores[columna.id]))
          .filter((valor) => Number.isFinite(valor))

        const media =
          valores.length > 0 ? valores.reduce((suma, valor) => suma + valor, 0) / valores.length : 0
        const varianza =
          valores.length > 1
            ? valores.reduce((suma, valor) => suma + (valor - media) ** 2, 0) / valores.length
            : 1

        medias[clase] = media
        varianzas[clase] = Math.max(varianza, VARIANZA_MINIMA)
      }

      return { id: columna.id, tipo: "numerico", medias, varianzas }
    }

    const valores =
      columna.opciones.length > 0
        ? columna.opciones
        : [...new Set(dataset.filas.map((fila) => String(fila.valores[columna.id])))]

    const probabilidades: Record<string, Record<string, number>> = {}
    for (const clase of dataset.clases) {
      const filasClase = dataset.filas.filter((fila) => fila.clase === clase)
      const mapa: Record<string, number> = {}
      for (const valor of valores) {
        const conteo = filasClase.filter((fila) => String(fila.valores[columna.id]) === valor).length
        mapa[valor] = (conteo + 1) / (filasClase.length + valores.length)
      }
      probabilidades[clase] = mapa
    }

    return { id: columna.id, tipo: "nominal", probabilidades }
  })

  return { tipo: "naive_bayes", clases: dataset.clases, prior, columnas }
}

export function predecirBayes(
  modelo: ModeloBayes,
  valores: Record<string, ValorColumna>
): PrediccionBayes {
  const logPosterior: Record<string, number> = {}

  for (const clase of modelo.clases) {
    let acumulado = Math.log(Math.max(modelo.prior[clase] ?? 0, 1e-9))

    for (const columna of modelo.columnas) {
      if (columna.tipo === "numerico") {
        const valor = Number(valores[columna.id])
        if (!Number.isFinite(valor)) continue
        const media = columna.medias[clase] ?? 0
        const varianza = Math.max(columna.varianzas[clase] ?? 1, VARIANZA_MINIMA)
        acumulado +=
          -0.5 * Math.log(2 * Math.PI * varianza) - (valor - media) ** 2 / (2 * varianza)
        continue
      }

      const texto = String(valores[columna.id] ?? "(sin respuesta)")
      const mapa = columna.probabilidades[clase] ?? {}
      const categorias = Object.keys(mapa).length
      const probabilidad = mapa[texto] ?? (categorias > 0 ? 1 / (categorias + 1) : 1)
      acumulado += Math.log(Math.max(probabilidad, 1e-9))
    }

    logPosterior[clase] = acumulado
  }

  const maximo = Math.max(...modelo.clases.map((clase) => logPosterior[clase] ?? 0))
  const exponenciales: Record<string, number> = {}
  for (const clase of modelo.clases) {
    exponenciales[clase] = Math.exp((logPosterior[clase] ?? 0) - maximo)
  }
  const suma = Object.values(exponenciales).reduce((a, b) => a + b, 0) || 1

  const probabilidades: Record<string, number> = {}
  for (const clase of modelo.clases) probabilidades[clase] = exponenciales[clase] / suma

  const clase = modelo.clases.reduce(
    (mejor, actual) => (probabilidades[actual] > (probabilidades[mejor] ?? 0) ? actual : mejor),
    modelo.clases[0] ?? ""
  )

  return { clase, probabilidades }
}
