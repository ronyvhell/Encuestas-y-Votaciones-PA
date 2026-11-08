// Predicción unificada: recibe el artefacto almacenado y un conjunto de valores
// ya codificados con las mismas reglas del entrenamiento.

import { predecirArbol, redondear, type NodoArbol } from "./arbol"
import { predecirBayes, type ModeloBayes } from "./bayes"
import { predecirBosque, type ModeloBosque } from "./bosque"
import { predecirKnn, type ModeloKnn } from "./knn"
import type { ValorColumna } from "./tipos"

export type Artefacto =
  | { algoritmo: "arbol"; arbol: NodoArbol }
  | { algoritmo: "naive_bayes"; modelo: ModeloBayes }
  | { algoritmo: "knn"; modelo: ModeloKnn }
  | { algoritmo: "bosque"; modelo: ModeloBosque }

export interface ResultadoPrediccion {
  clase: string
  probabilidades: Record<string, number>
  /** Probabilidad de la clase positiva (0 a 1). */
  probabilidadPositiva: number
  /** Explicación legible: reglas del árbol o variables con más peso. */
  explicacion: string[]
}

export function predecirConArtefacto(
  artefacto: Artefacto,
  valores: Record<string, ValorColumna>,
  clasePositiva: string
): ResultadoPrediccion {
  if (artefacto.algoritmo === "arbol") {
    const prediccion = predecirArbol(artefacto.arbol, valores)
    return {
      clase: prediccion.clase,
      probabilidades: prediccion.probabilidades,
      probabilidadPositiva: prediccion.probabilidades[clasePositiva] ?? 0,
      explicacion: prediccion.camino.length > 0 ? prediccion.camino : ["Sin condiciones: hoja única."],
    }
  }

  const prediccion =
    artefacto.algoritmo === "naive_bayes"
      ? predecirBayes(artefacto.modelo, valores)
      : artefacto.algoritmo === "knn"
        ? predecirKnn(artefacto.modelo, valores)
        : predecirBosque(artefacto.modelo, valores)

  const probabilidades = redondearProbabilidades(prediccion.probabilidades)
  const explicacion =
    artefacto.algoritmo === "naive_bayes"
      ? [
          "Naive Bayes combina la probabilidad previa de cada clase con la de cada respuesta.",
          `P(${clasePositiva}) = ${formatear(probabilidades[clasePositiva] ?? 0)}`,
        ]
      : artefacto.algoritmo === "knn"
        ? [
            `k-NN compara este perfil con los ${artefacto.modelo.k} votos más parecidos del conjunto de entrenamiento.`,
            `Vecinos usados: ${artefacto.modelo.filas.length} votos disponibles.`,
          ]
        : [
            `Bosque aleatorio: promedio de ${artefacto.modelo.arboles.length} árboles entrenados con muestras distintas.`,
            `P(${clasePositiva}) = ${formatear(probabilidades[clasePositiva] ?? 0)}`,
          ]

  return {
    clase: prediccion.clase,
    probabilidades,
    probabilidadPositiva: probabilidades[clasePositiva] ?? 0,
    explicacion,
  }
}

function redondearProbabilidades(probabilidades: Record<string, number>): Record<string, number> {
  const salida: Record<string, number> = {}
  for (const [clase, valor] of Object.entries(probabilidades)) {
    salida[clase] = redondear(valor)
  }
  return salida
}

function formatear(valor: number): string {
  return `${Math.round(valor * 100)}%`
}
