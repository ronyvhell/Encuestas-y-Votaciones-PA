// Análisis de todos los factores de la encuesta (no solo la variable objetivo):
// distribuciones, promedios, porcentaje de la clase positiva por grupo y
// poder predictivo de cada variable.

import { construirDataset } from "./dataset"
import type {
  DefinicionColumna,
  FilaEntrenamiento,
  ObjetivoPosible,
  PoliticaObjetivo,
  PreguntaEntrada,
  VotoEntrada,
} from "./tipos"

export interface FilaAnalisis {
  valor: string
  /** Votos (de todos los emitidos) que eligieron este valor. */
  n: number
  /** Porcentaje sobre el total de votos con respuesta a la pregunta. */
  porcentaje: number
  /** Porcentaje de la clase positiva entre los votos que entraron al modelo. */
  porcentajePositivo: number
  nModelo: number
}

export interface AnalisisPregunta {
  preguntaId: string
  texto: string
  tipoPregunta: string
  /** Votos con alguna respuesta a esta pregunta. */
  total: number
  promedio?: number
  filas: FilaAnalisis[]
  muestra?: string[]
  /** Ganancia de información normalizada respecto de la clase (0 a 1). */
  poderPredictivo: number
  esObjetivo: boolean
}

export interface AnalisisFactores {
  totalVotos: number
  filasModelo: number
  excluidos: number
  clases: string[]
  clasePositiva: string
  distribucion: Record<string, number>
  preguntas: AnalisisPregunta[]
}

function entropia(clases: string[]): number {
  const total = clases.length
  if (total === 0) return 0
  const conteo = new Map<string, number>()
  for (const clase of clases) conteo.set(clase, (conteo.get(clase) ?? 0) + 1)

  let valor = 0
  for (const cantidad of conteo.values()) {
    const p = cantidad / total
    valor -= p * Math.log2(p)
  }
  return valor
}

function gananciaNormalizada(filas: FilaEntrenamiento[], columnaId: string): number {
  if (filas.length === 0) return 0
  const entropiaGlobal = entropia(filas.map((fila) => fila.clase))
  if (entropiaGlobal <= 0) return 0

  const grupos = new Map<string, string[]>()
  for (const fila of filas) {
    const clave = String(fila.valores[columnaId])
    const lista = grupos.get(clave)
    if (lista) lista.push(fila.clase)
    else grupos.set(clave, [fila.clase])
  }
  if (grupos.size < 2) return 0

  let condicionada = 0
  for (const clases of grupos.values()) {
    condicionada += (clases.length / filas.length) * entropia(clases)
  }

  return Math.max(0, Math.min(1, (entropiaGlobal - condicionada) / entropiaGlobal))
}

function porcentaje(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : 0
}

export function analizarFactores(
  preguntas: PreguntaEntrada[],
  votos: VotoEntrada[],
  objetivo: ObjetivoPosible,
  politica: PoliticaObjetivo = "excluir"
): AnalisisFactores {
  const dataset = construirDataset(preguntas, votos, objetivo, politica)
  const clasePorVoto = new Map(dataset.filas.map((fila) => [fila.votoId, fila.clase]))

  const columnasPorPregunta = new Map<string, DefinicionColumna[]>()
  for (const columna of dataset.columnas) {
    const lista = columnasPorPregunta.get(columna.preguntaId)
    if (lista) lista.push(columna)
    else columnasPorPregunta.set(columna.preguntaId, [columna])
  }

  const analisis: AnalisisPregunta[] = []

  for (const pregunta of preguntas) {
    const preguntaId = pregunta._id === undefined ? "" : String(pregunta._id)
    if (!preguntaId) continue

    const esObjetivo = preguntaId === objetivo.preguntaId
    const conteos = new Map<string, number>()
    const conteosModelo = new Map<string, number>()
    const positivos = new Map<string, number>()
    const muestra: string[] = []
    let total = 0
    let suma = 0
    let cantidadNumerica = 0

    votos.forEach((voto, indice) => {
      const idVoto = voto._id === undefined ? `voto-${indice}` : String(voto._id)
      const respuestas = new Map<string, unknown>()
      for (const respuesta of voto.respuestas ?? []) {
        respuestas.set(String(respuesta.preguntaId), respuesta.valor)
      }

      const crudo = respuestas.get(preguntaId)
      if (crudo === null || crudo === undefined || crudo === "") return

      let valores: string[] = []
      if (pregunta.tipoPregunta === "verdadero_falso") {
        if (crudo === true || crudo === "true") valores = ["Verdadero"]
        else if (crudo === false || crudo === "false") valores = ["Falso"]
      } else if (pregunta.tipoPregunta === "texto") {
        const texto = String(crudo).trim()
        if (texto === "") return
        total += 1
        if (muestra.length < 8) muestra.push(texto)
        return
      } else if (Array.isArray(crudo)) {
        valores = crudo.map((valor) => String(valor)).filter((valor) => valor !== "")
      } else {
        valores = [String(crudo).trim()]
      }

      if (valores.length === 0) return
      total += 1

      const clase = clasePorVoto.get(idVoto)
      for (const valor of valores) {
        conteos.set(valor, (conteos.get(valor) ?? 0) + 1)
        if (clase !== undefined) {
          conteosModelo.set(valor, (conteosModelo.get(valor) ?? 0) + 1)
          if (clase === dataset.clasePositiva) {
            positivos.set(valor, (positivos.get(valor) ?? 0) + 1)
          }
        }
        if (pregunta.tipoPregunta === "seleccion_unica") {
          const numero = Number(valor)
          if (Number.isFinite(numero)) {
            suma += numero
            cantidadNumerica += 1
          }
        }
      }
    })

    // Opciones declaradas + valores observados (por si la encuesta cambió).
    const opciones = new Map<string, true>()
    for (const opcion of pregunta.opciones ?? []) {
      const texto = String(opcion).trim()
      if (texto !== "") opciones.set(texto, true)
    }
    for (const valor of conteos.keys()) opciones.set(valor, true)

    const filas: FilaAnalisis[] = [...opciones.keys()].map((valor) => {
      const n = conteos.get(valor) ?? 0
      const nModelo = conteosModelo.get(valor) ?? 0
      return {
        valor,
        n,
        porcentaje: porcentaje(n, total),
        porcentajePositivo: porcentaje(positivos.get(valor) ?? 0, nModelo),
        nModelo,
      }
    })

    if (pregunta.tipoPregunta === "seleccion_unica") {
      const numerica = filas.every((fila) => Number.isFinite(Number(fila.valor)))
      if (numerica) filas.sort((a, b) => Number(a.valor) - Number(b.valor))
    }

    let poderPredictivo = 0
    const columnas = columnasPorPregunta.get(preguntaId) ?? []
    if (!esObjetivo && columnas.length > 0) {
      poderPredictivo = Math.max(
        ...columnas.map((columna) => gananciaNormalizada(dataset.filas, columna.id))
      )
    }

    analisis.push({
      preguntaId,
      texto: pregunta.texto,
      tipoPregunta: pregunta.tipoPregunta,
      total,
      promedio: cantidadNumerica > 0 ? Math.round((suma / cantidadNumerica) * 100) / 100 : undefined,
      filas,
      muestra: muestra.length > 0 ? muestra : undefined,
      poderPredictivo,
      esObjetivo,
    })
  }

  return {
    totalVotos: dataset.totalVotos,
    filasModelo: dataset.filas.length,
    excluidos: dataset.excluidos,
    clases: dataset.clases,
    clasePositiva: dataset.clasePositiva,
    distribucion: dataset.distribucion,
    preguntas: analisis,
  }
}
