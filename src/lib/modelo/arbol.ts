// Árbol de decisión binario con criterio de razón de ganancia (estilo C4.5 / J48).
// Soporta variables numéricas (umbral) y nominales (una rama por categoría).

import type { Dataset, DefinicionColumna, FilaEntrenamiento, ValorColumna } from "./tipos"

export interface HojaArbol {
  tipo: "hoja"
  clase: string
  distribucion: Record<string, number>
  n: number
}

export interface RamaArbol {
  /** En ramas numéricas vale "<=" o ">"; en nominales, la categoría. */
  valor: string
  nodo: NodoArbol
  n: number
}

export interface NodoDecision {
  tipo: "nodo"
  columna: string
  texto: string
  criterio: "numerico" | "nominal"
  umbral?: number
  ramas: RamaArbol[]
  n: number
  ganancia: number
}

export type NodoArbol = HojaArbol | NodoDecision

export interface OpcionesArbol {
  maxProfundidad?: number
  minHoja?: number
  minGanancia?: number
  maxRamas?: number
}

export interface PrediccionArbol {
  clase: string
  probabilidades: Record<string, number>
  camino: string[]
}

interface Grupo {
  valor: string
  filas: FilaEntrenamiento[]
}

interface Division {
  columna: DefinicionColumna
  criterio: "numerico" | "nominal"
  umbral?: number
  grupos: Grupo[]
  ganancia: number
  gananciaRatio: number
}

function contarClases(filas: FilaEntrenamiento[], clases: readonly string[]): Record<string, number> {
  const conteo: Record<string, number> = {}
  for (const clase of clases) conteo[clase] = 0
  for (const fila of filas) conteo[fila.clase] = (conteo[fila.clase] ?? 0) + 1
  return conteo
}

function claseMayoritaria(conteo: Record<string, number>, clases: readonly string[]): string {
  let mejor = clases[0] ?? ""
  let maximo = -1
  for (const clase of clases) {
    const valor = conteo[clase] ?? 0
    if (valor > maximo) {
      maximo = valor
      mejor = clase
    }
  }
  return mejor
}

function entropiaDeConteo(conteo: Record<string, number>): number {
  let total = 0
  for (const valor of Object.values(conteo)) total += valor
  if (total === 0) return 0
  let h = 0
  for (const valor of Object.values(conteo)) {
    if (valor === 0) continue
    const p = valor / total
    h -= p * Math.log2(p)
  }
  return h
}

function entropiaFilas(filas: FilaEntrenamiento[], clases: readonly string[]): number {
  return entropiaDeConteo(contarClases(filas, clases))
}

function agruparPorValor(
  filas: FilaEntrenamiento[],
  columnaId: string,
  maxRamas: number
): Map<string, FilaEntrenamiento[]> {
  const grupos = new Map<string, FilaEntrenamiento[]>()
  for (const fila of filas) {
    const valor = String(fila.valores[columnaId])
    const lista = grupos.get(valor)
    if (lista) lista.push(fila)
    else grupos.set(valor, [fila])
  }

  if (grupos.size <= maxRamas) return grupos

  // Demasiadas categorías: se conservan las más frecuentes y el resto va a "otros".
  const ordenados = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length)
  const conservados = ordenados.slice(0, maxRamas - 1)
  const resto = ordenados.slice(maxRamas - 1).flatMap(([, lista]) => lista)
  const reducido = new Map<string, FilaEntrenamiento[]>(conservados)
  const existente = reducido.get("otros")
  reducido.set("otros", existente ? [...existente, ...resto] : resto)
  return reducido
}

function evaluarDivision(
  columna: DefinicionColumna,
  criterio: "numerico" | "nominal",
  umbral: number | undefined,
  grupos: Grupo[],
  entropiaInicial: number,
  total: number,
  clases: readonly string[]
): Division | null {
  if (grupos.length < 2) return null

  let ponderada = 0
  let informacionDivision = 0
  for (const grupo of grupos) {
    const proporcion = grupo.filas.length / total
    if (proporcion === 0) continue
    ponderada += proporcion * entropiaDeConteo(contarClases(grupo.filas, clases))
    informacionDivision -= proporcion * Math.log2(proporcion)
  }

  const ganancia = entropiaInicial - ponderada
  if (ganancia <= 0) return null
  const gananciaRatio = informacionDivision > 0 ? ganancia / informacionDivision : 0

  return { columna, criterio, umbral, grupos, ganancia, gananciaRatio }
}

function mejorDivision(
  filas: FilaEntrenamiento[],
  columnas: DefinicionColumna[],
  clases: readonly string[],
  minHoja: number,
  maxRamas: number
): Division | null {
  const total = filas.length
  const entropiaInicial = entropiaFilas(filas, clases)
  let mejor: Division | null = null

  for (const columna of columnas) {
    if (columna.tipo === "numerico") {
      const valores = filas
        .map((fila) => fila.valores[columna.id])
        .filter((valor): valor is number => typeof valor === "number" && Number.isFinite(valor))
      const unicos = [...new Set(valores)].sort((a, b) => a - b)

      for (let i = 0; i < unicos.length - 1; i++) {
        const umbral = (unicos[i] + unicos[i + 1]) / 2
        const izquierda: FilaEntrenamiento[] = []
        const derecha: FilaEntrenamiento[] = []
        for (const fila of filas) {
          const valor = Number(fila.valores[columna.id])
          if (valor <= umbral) izquierda.push(fila)
          else derecha.push(fila)
        }
        if (izquierda.length < minHoja || derecha.length < minHoja) continue

        const division = evaluarDivision(
          columna,
          "numerico",
          umbral,
          [
            { valor: "<=", filas: izquierda },
            { valor: ">", filas: derecha },
          ],
          entropiaInicial,
          total,
          clases
        )
        if (division && (!mejor || division.gananciaRatio > mejor.gananciaRatio)) mejor = division
      }
      continue
    }

    const grupos = agruparPorValor(filas, columna.id, maxRamas)
    const lista: Grupo[] = [...grupos.entries()]
      .map(([valor, subfilas]) => ({ valor, filas: subfilas }))
      .filter((grupo) => grupo.filas.length > 0)
    if (lista.length < 2) continue

    const division = evaluarDivision(columna, "nominal", undefined, lista, entropiaInicial, total, clases)
    if (division && (!mejor || division.gananciaRatio > mejor.gananciaRatio)) mejor = division
  }

  return mejor
}

/** Poda pesimista: si el subárbol apenas mejora la hoja, se colapsa. */
function podar(
  nodo: NodoDecision,
  filas: FilaEntrenamiento[],
  clases: readonly string[]
): NodoArbol {
  const conteo = contarClases(filas, clases)
  const mayoritaria = claseMayoritaria(conteo, clases)
  const aciertoHoja = filas.length > 0 ? (conteo[mayoritaria] ?? 0) / filas.length : 0

  let aciertosSubarbol = 0
  for (const fila of filas) {
    if (predecirArbol(nodo, fila.valores).clase === fila.clase) aciertosSubarbol += 1
  }
  const aciertoSubarbol = filas.length > 0 ? aciertosSubarbol / filas.length : 0

  if (aciertoSubarbol - aciertoHoja < 0.02) {
    return { tipo: "hoja", clase: mayoritaria, distribucion: conteo, n: filas.length }
  }
  return nodo
}

export function entrenarArbol(dataset: Dataset, opciones: OpcionesArbol = {}): NodoArbol {
  const {
    maxProfundidad = 6,
    minHoja = 5,
    minGanancia = 0.01,
    maxRamas = 8,
  } = opciones

  const construir = (filas: FilaEntrenamiento[], profundidad: number): NodoArbol => {
    const conteo = contarClases(filas, dataset.clases)
    const hoja = (): HojaArbol => ({
      tipo: "hoja",
      clase: claseMayoritaria(conteo, dataset.clases),
      distribucion: conteo,
      n: filas.length,
    })

    const presentes = dataset.clases.filter((clase) => (conteo[clase] ?? 0) > 0)
    if (presentes.length <= 1) return hoja()
    if (filas.length < minHoja * 2) return hoja()
    if (profundidad >= maxProfundidad) return hoja()

    const division = mejorDivision(filas, dataset.columnas, dataset.clases, minHoja, maxRamas)
    if (!division || division.gananciaRatio < minGanancia) return hoja()

    const ramas: RamaArbol[] = []
    for (const grupo of division.grupos) {
      if (grupo.filas.length === 0) continue
      ramas.push({
        valor: grupo.valor,
        nodo: construir(grupo.filas, profundidad + 1),
        n: grupo.filas.length,
      })
    }
    if (ramas.length < 2) return hoja()

    const nodo: NodoDecision = {
      tipo: "nodo",
      columna: division.columna.id,
      texto: division.columna.texto,
      criterio: division.criterio,
      umbral: division.umbral,
      ramas,
      n: filas.length,
      ganancia: division.gananciaRatio,
    }

    return podar(nodo, filas, dataset.clases)
  }

  return construir(dataset.filas, 0)
}

export function predecirArbol(
  nodo: NodoArbol,
  valores: Record<string, ValorColumna>
): PrediccionArbol {
  const camino: string[] = []
  let actual: NodoArbol = nodo

  while (actual.tipo === "nodo") {
    const valor = valores[actual.columna]

    if (actual.criterio === "numerico") {
      const numero = Number(valor)
      const umbral = actual.umbral ?? 0
      const clave = Number.isFinite(numero) && numero <= umbral ? "<=" : ">"
      camino.push(
        clave === "<=" ? `${actual.texto} ≤ ${redondear(umbral)}` : `${actual.texto} > ${redondear(umbral)}`
      )
      const rama = actual.ramas.find((r) => r.valor === clave)
      if (!rama) break
      actual = rama.nodo
      continue
    }

    const texto = String(valor)
    const rama =
      actual.ramas.find((r) => r.valor === texto) ??
      actual.ramas.find((r) => r.valor === "otros") ??
      actual.ramas[0]
    camino.push(`${actual.texto} = ${rama ? rama.valor : texto}`)
    if (!rama) break
    actual = rama.nodo
  }

  const distribucion = actual.tipo === "hoja" ? actual.distribucion : {}
  const total = Object.values(distribucion).reduce((suma, valor) => suma + valor, 0)
  const probabilidades: Record<string, number> = {}
  for (const [clase, conteo] of Object.entries(distribucion)) {
    probabilidades[clase] = total > 0 ? conteo / total : 0
  }

  return {
    clase: actual.tipo === "hoja" ? actual.clase : "",
    probabilidades,
    camino,
  }
}

export function redondear(valor: number): number {
  return Math.round(valor * 100) / 100
}

export interface ReglaArbol {
  condiciones: string[]
  clase: string
  n: number
  confianza: number
}

export function reglasArbol(arbol: NodoArbol, maximo = 80): ReglaArbol[] {
  const reglas: ReglaArbol[] = []

  const recorrer = (nodo: NodoArbol, condiciones: string[]): void => {
    if (nodo.tipo === "hoja") {
      const total = Object.values(nodo.distribucion).reduce((suma, valor) => suma + valor, 0)
      reglas.push({
        condiciones,
        clase: nodo.clase,
        n: nodo.n,
        confianza: total > 0 ? (nodo.distribucion[nodo.clase] ?? 0) / total : 0,
      })
      return
    }

    for (const rama of nodo.ramas) {
      const condicion =
        nodo.criterio === "numerico"
          ? `${nodo.texto} ${rama.valor === "<=" ? "≤" : ">"} ${redondear(nodo.umbral ?? 0)}`
          : `${nodo.texto} = ${rama.valor}`
      recorrer(rama.nodo, [...condiciones, condicion])
    }
  }

  recorrer(arbol, [])
  return reglas.sort((a, b) => b.n - a.n).slice(0, maximo)
}

export interface ImportanciaVariable {
  columna: string
  texto: string
  importancia: number
}

export function importanciaArbol(
  arbol: NodoArbol,
  columnas: DefinicionColumna[]
): ImportanciaVariable[] {
  const acumulado = new Map<string, number>()
  const textos = new Map(columnas.map((columna) => [columna.id, columna.texto]))

  const visitar = (nodo: NodoArbol): void => {
    if (nodo.tipo !== "nodo") return
    acumulado.set(nodo.columna, (acumulado.get(nodo.columna) ?? 0) + nodo.ganancia * nodo.n)
    for (const rama of nodo.ramas) visitar(rama.nodo)
  }
  visitar(arbol)

  const total = [...acumulado.values()].reduce((suma, valor) => suma + valor, 0)
  return [...acumulado.entries()]
    .map(([columna, valor]) => ({
      columna,
      texto: textos.get(columna) ?? columna,
      importancia: total > 0 ? valor / total : 0,
    }))
    .sort((a, b) => b.importancia - a.importancia)
}

export function contarNodos(arbol: NodoArbol): number {
  if (arbol.tipo === "hoja") return 1
  return 1 + arbol.ramas.reduce((suma, rama) => suma + contarNodos(rama.nodo), 0)
}

export function profundidadArbol(arbol: NodoArbol): number {
  if (arbol.tipo === "hoja") return 1
  return 1 + Math.max(...arbol.ramas.map((rama) => profundidadArbol(rama.nodo)))
}
