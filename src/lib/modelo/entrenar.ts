// Orquestador del entrenamiento: construye el dataset, compara algoritmos con
// validación cruzada estratificada y deja listo el artefacto del modelo elegido.

import {
  entrenarArbol,
  importanciaArbol,
  reglasArbol,
  type ImportanciaVariable,
  type NodoArbol,
  type ReglaArbol,
} from "./arbol"
import { entrenarBayes } from "./bayes"
import { entrenarBosque } from "./bosque"
import { entrenarKnn } from "./knn"
import {
  calcularMetricas,
  desviacionEstandar,
  particionesEstratificadas,
  type MatrizConfusion,
  type MetricasClase,
} from "./metricas"
import { predecirConArtefacto, type Artefacto } from "./prediccion"
import { construirDataset, objetivosPosibles, resolverObjetivo } from "./dataset"
import type {
  AlgoritmoModelo,
  ComparacionAlgoritmo,
  Dataset,
  DefinicionColumna,
  PoliticaObjetivo,
  PreguntaEntrada,
  VotoEntrada,
} from "./tipos"
import { ALGORITMOS } from "./tipos"

export const MINIMO_REGISTROS = 20

export interface OpcionesEntrenamiento {
  preguntaObjetivoId?: string | null
  algoritmo?: AlgoritmoModelo
  politica?: PoliticaObjetivo
  semilla?: number
  kFolds?: number
  maxProfundidad?: number
}

export interface ResultadoEntrenamiento {
  preguntaObjetivoId: string
  textoObjetivo: string
  claveObjetivo?: string
  algoritmo: AlgoritmoModelo
  politica: PoliticaObjetivo
  semilla: number
  kFolds: number
  totalVotos: number
  nRegistros: number
  nExcluidos: number
  clases: string[]
  clasePositiva: string
  distribucion: Record<string, number>
  columnas: DefinicionColumna[]
  exactitud: number
  precision: number
  exhaustividad: number
  f1: number
  macroF1: number
  matriz: MatrizConfusion
  porClase: MetricasClase[]
  comparacion: ComparacionAlgoritmo[]
  importancias: ImportanciaVariable[]
  reglas: ReglaArbol[]
  artefacto: Artefacto
  arbol: NodoArbol | null
}

function etiquetaDe(algoritmo: AlgoritmoModelo): string {
  return ALGORITMOS.find((a) => a.value === algoritmo)?.label ?? algoritmo
}

function crearArtefacto(
  algoritmo: AlgoritmoModelo,
  dataset: Dataset,
  opciones: OpcionesEntrenamiento
): Artefacto {
  switch (algoritmo) {
    case "arbol":
      return {
        algoritmo: "arbol",
        arbol: entrenarArbol(dataset, {
          maxProfundidad: opciones.maxProfundidad ?? 6,
        }),
      }
    case "naive_bayes":
      return { algoritmo: "naive_bayes", modelo: entrenarBayes(dataset) }
    case "knn":
      return { algoritmo: "knn", modelo: entrenarKnn(dataset, 5) }
    case "bosque":
      return {
        algoritmo: "bosque",
        modelo: entrenarBosque(dataset, {
          semilla: opciones.semilla ?? 20261012,
          maxProfundidad: (opciones.maxProfundidad ?? 6) + 2,
        }),
      }
    default:
      return { algoritmo: "arbol", arbol: entrenarArbol(dataset) }
  }
}

/** Importancia por ganancia de información, usada cuando el modelo no es un árbol. */
function importanciaPorGanancia(dataset: Dataset): ImportanciaVariable[] {
  const total = dataset.filas.length
  const entropiaGlobal = entropiaClases(dataset.filas.map((fila) => fila.clase))
  if (total === 0 || entropiaGlobal === 0) {
    return dataset.columnas.map((columna) => ({
      columna: columna.id,
      texto: columna.texto,
      importancia: 0,
    }))
  }

  const importancias = dataset.columnas.map((columna) => {
    const grupos = new Map<string, string[]>()
    for (const fila of dataset.filas) {
      const clave = String(fila.valores[columna.id])
      const lista = grupos.get(clave)
      if (lista) lista.push(fila.clase)
      else grupos.set(clave, [fila.clase])
    }

    let condicionada = 0
    for (const [, clases] of grupos) {
      condicionada += (clases.length / total) * entropiaClases(clases)
    }
    const ganancia = Math.max(0, entropiaGlobal - condicionada)
    return { columna: columna.id, texto: columna.texto, importancia: ganancia / entropiaGlobal }
  })

  const suma = importancias.reduce((acumulado, item) => acumulado + item.importancia, 0)
  return importancias
    .map((item) => ({ ...item, importancia: suma > 0 ? item.importancia / suma : 0 }))
    .sort((a, b) => b.importancia - a.importancia)
}

function entropiaClases(clases: string[]): number {
  const total = clases.length
  if (total === 0) return 0
  const conteo = new Map<string, number>()
  for (const clase of clases) conteo.set(clase, (conteo.get(clase) ?? 0) + 1)

  let entropia = 0
  for (const valor of conteo.values()) {
    const p = valor / total
    entropia -= p * Math.log2(p)
  }
  return entropia
}

function promedioImportancias(listas: ImportanciaVariable[][]): ImportanciaVariable[] {
  const acumulado = new Map<string, { texto: string; total: number }>()
  for (const lista of listas) {
    for (const item of lista) {
      const actual = acumulado.get(item.columna)
      if (actual) actual.total += item.importancia
      else acumulado.set(item.columna, { texto: item.texto, total: item.importancia })
    }
  }
  const divisor = listas.length || 1
  return [...acumulado.entries()]
    .map(([columna, valor]) => ({
      columna,
      texto: valor.texto,
      importancia: valor.total / divisor,
    }))
    .sort((a, b) => b.importancia - a.importancia)
}

export function entrenarModelo(
  preguntas: PreguntaEntrada[],
  votos: VotoEntrada[],
  opciones: OpcionesEntrenamiento = {}
): ResultadoEntrenamiento {
  const objetivos = objetivosPosibles(preguntas)
  if (objetivos.length === 0) {
    throw new Error(
      "Esta encuesta no tiene una pregunta con dos opciones que pueda usarse como variable objetivo."
    )
  }

  const objetivo = resolverObjetivo(preguntas, opciones.preguntaObjetivoId)
  if (!objetivo) {
    throw new Error("No se pudo determinar la pregunta objetivo.")
  }

  const politica: PoliticaObjetivo = opciones.politica === "mapear_no" ? "mapear_no" : "excluir"
  const semilla = Number.isFinite(opciones.semilla) ? Number(opciones.semilla) : 20261012
  const kFolds = Math.min(10, Math.max(3, Number(opciones.kFolds) || 5))
  const algoritmo: AlgoritmoModelo =
    opciones.algoritmo && ALGORITMOS.some((a) => a.value === opciones.algoritmo)
      ? opciones.algoritmo
      : "arbol"

  const dataset = construirDataset(preguntas, votos, objetivo, politica)
  if (dataset.filas.length < MINIMO_REGISTROS) {
    throw new Error(
      `Se necesitan al menos ${MINIMO_REGISTROS} votos con respuesta a la pregunta objetivo. ` +
        `Actualmente hay ${dataset.filas.length}.`
    )
  }
  if (dataset.clases.some((clase) => (dataset.distribucion[clase] ?? 0) === 0)) {
    throw new Error(
      "La variable objetivo solo tiene una clase entre los votos disponibles; " +
        "se necesitan votos de las dos opciones para entrenar."
    )
  }

  const reales = dataset.filas.map((fila) => fila.clase)
  const folds = particionesEstratificadas(reales, kFolds, semilla)
  const comparacion: ComparacionAlgoritmo[] = []
  const prediccionesPorAlgoritmo = new Map<AlgoritmoModelo, string[]>()

  for (const definicion of ALGORITMOS) {
    const predicciones = new Array<string>(dataset.filas.length).fill("")
    const exactitudes: number[] = []

    for (const fold of folds) {
      if (fold.length === 0) continue
      const enPrueba = new Set(fold)
      const filasEntrenamiento = dataset.filas.filter((_, indice) => !enPrueba.has(indice))
      if (filasEntrenamiento.length === 0) continue

      const artefacto = crearArtefacto(definicion.value, { ...dataset, filas: filasEntrenamiento }, opciones)
      let aciertos = 0

      for (const indice of fold) {
        const fila = dataset.filas[indice]
        const prediccion = predecirConArtefacto(artefacto, fila.valores, dataset.clasePositiva)
        predicciones[indice] = prediccion.clase
        if (prediccion.clase === fila.clase) aciertos += 1
      }

      exactitudes.push(aciertos / fold.length)
    }

    const validas = predicciones.map((prediccion, indice) =>
      prediccion === ""
        ? (dataset.clases.find((clase) => clase !== dataset.filas[indice].clase) ?? dataset.clases[1])
        : prediccion
    )
    const metricas = calcularMetricas(reales, validas, dataset.clases, dataset.clasePositiva)

    prediccionesPorAlgoritmo.set(definicion.value, validas)
    comparacion.push({
      algoritmo: definicion.value,
      etiqueta: etiquetaDe(definicion.value),
      exactitud: metricas.exactitud,
      precision: metricas.precision,
      exhaustividad: metricas.exhaustividad,
      f1: metricas.f1,
      macroF1: metricas.macroF1,
      desviacion: desviacionEstandar(exactitudes),
    })
  }

  // El artefacto final se entrena con todos los votos; las métricas reportadas
  // salen de las predicciones fuera de muestra (validación cruzada).
  const artefactoFinal = crearArtefacto(algoritmo, dataset, opciones)
  const metricasElegidas = calcularMetricas(
    reales,
    prediccionesPorAlgoritmo.get(algoritmo) ?? [],
    dataset.clases,
    dataset.clasePositiva
  )

  let importancias: ImportanciaVariable[]
  let reglas: ReglaArbol[] = []
  let arbol: NodoArbol | null = null

  if (artefactoFinal.algoritmo === "arbol") {
    arbol = artefactoFinal.arbol
    importancias = importanciaArbol(arbol, dataset.columnas)
    reglas = reglasArbol(arbol)
  } else if (artefactoFinal.algoritmo === "bosque") {
    importancias = promedioImportancias(
      artefactoFinal.modelo.arboles.map((arbolito) => importanciaArbol(arbolito, dataset.columnas))
    )
  } else {
    importancias = importanciaPorGanancia(dataset)
  }

  return {
    preguntaObjetivoId: objetivo.preguntaId,
    textoObjetivo: objetivo.texto,
    claveObjetivo: preguntas.find((p) => String(p._id) === objetivo.preguntaId)?.clave,
    algoritmo,
    politica,
    semilla,
    kFolds,
    totalVotos: dataset.totalVotos,
    nRegistros: dataset.filas.length,
    nExcluidos: dataset.excluidos,
    clases: dataset.clases,
    clasePositiva: dataset.clasePositiva,
    distribucion: dataset.distribucion,
    columnas: dataset.columnas,
    exactitud: metricasElegidas.exactitud,
    precision: metricasElegidas.precision,
    exhaustividad: metricasElegidas.exhaustividad,
    f1: metricasElegidas.f1,
    macroF1: metricasElegidas.macroF1,
    matriz: metricasElegidas.matriz,
    porClase: metricasElegidas.porClase,
    comparacion,
    importancias,
    reglas,
    artefacto: artefactoFinal,
    arbol,
  }
}
