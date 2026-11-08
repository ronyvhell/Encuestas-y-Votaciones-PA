// Convierte documentos de la colección `modelos` a los tipos que usa la UI.

import type { NodoArbol } from "./arbol"
import { ALGORITMOS, type ComparacionAlgoritmo } from "./tipos"
import type {
  ClaseVista,
  HistorialVista,
  ImportanciaVista,
  MatrizVista,
  ModeloVista,
  ReglaVista,
} from "./vista"

export interface ModeloAlmacenado {
  _id: { toString(): string }
  version: number
  algoritmo: string
  preguntaObjetivoId: string
  textoObjetivo: string
  politica: string
  createdAt: Date | string
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
  matriz: Partial<MatrizVista>
  porClase: unknown[]
  comparacion: unknown[]
  columnas: unknown[]
  importancias: unknown[]
  reglas: unknown[]
  artefacto: unknown
}

export function etiquetaAlgoritmo(algoritmo: string): string {
  return ALGORITMOS.find((a) => a.value === algoritmo)?.label ?? algoritmo
}

function fechaIso(valor: Date | string): string {
  return valor instanceof Date ? valor.toISOString() : String(valor)
}

function arbolDe(artefacto: unknown): NodoArbol | null {
  if (!artefacto || typeof artefacto !== "object") return null
  const candidato = artefacto as { algoritmo?: string; arbol?: NodoArbol }
  if (candidato.algoritmo === "arbol" && candidato.arbol) return candidato.arbol
  return null
}

export function aModeloVista(documento: ModeloAlmacenado): ModeloVista {
  const matriz = documento.matriz ?? {}
  return {
    _id: documento._id.toString(),
    version: documento.version,
    algoritmo: documento.algoritmo,
    etiquetaAlgoritmo: etiquetaAlgoritmo(documento.algoritmo),
    preguntaObjetivoId: documento.preguntaObjetivoId,
    textoObjetivo: documento.textoObjetivo,
    politica: documento.politica,
    createdAt: fechaIso(documento.createdAt),
    nRegistros: documento.nRegistros,
    nExcluidos: documento.nExcluidos,
    totalVotos: documento.totalVotos,
    clases: documento.clases ?? [],
    clasePositiva: documento.clasePositiva,
    distribucion: documento.distribucion ?? {},
    exactitud: documento.exactitud,
    precision: documento.precision,
    exhaustividad: documento.exhaustividad,
    f1: documento.f1,
    macroF1: documento.macroF1,
    matriz: {
      vp: matriz.vp ?? 0,
      vn: matriz.vn ?? 0,
      fp: matriz.fp ?? 0,
      fn: matriz.fn ?? 0,
    },
    porClase: (documento.porClase ?? []) as ClaseVista[],
    comparacion: (documento.comparacion ?? []) as ComparacionAlgoritmo[],
    columnas: (documento.columnas ?? []) as ModeloVista["columnas"],
    importancias: (documento.importancias ?? []) as ImportanciaVista[],
    reglas: (documento.reglas ?? []) as ReglaVista[],
    arbol: arbolDe(documento.artefacto),
  }
}

export function aHistorial(documento: ModeloAlmacenado): HistorialVista {
  return {
    _id: documento._id.toString(),
    version: documento.version,
    algoritmo: documento.algoritmo,
    etiquetaAlgoritmo: etiquetaAlgoritmo(documento.algoritmo),
    createdAt: fechaIso(documento.createdAt),
    exactitud: documento.exactitud,
    f1: documento.f1,
    nRegistros: documento.nRegistros,
    textoObjetivo: documento.textoObjetivo,
  }
}
