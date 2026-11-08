// Métricas de clasificación binaria y particiones estratificadas.

export function crearAzar(semilla: number) {
  let s = semilla >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface MatrizConfusion {
  /** Verdaderos positivos */
  vp: number
  /** Verdaderos negativos */
  vn: number
  /** Falsos positivos */
  fp: number
  /** Falsos negativos */
  fn: number
}

export function matrizConfusion(
  reales: readonly string[],
  predichos: readonly string[],
  positiva: string
): MatrizConfusion {
  const matriz: MatrizConfusion = { vp: 0, vn: 0, fp: 0, fn: 0 }
  const total = Math.min(reales.length, predichos.length)
  for (let i = 0; i < total; i++) {
    const real = reales[i]
    const predicho = predichos[i]
    if (real === positiva) {
      if (predicho === positiva) matriz.vp += 1
      else matriz.fn += 1
    } else if (predicho === positiva) {
      matriz.fp += 1
    } else {
      matriz.vn += 1
    }
  }
  return matriz
}

export interface MetricasClase {
  clase: string
  soporte: number
  precision: number
  exhaustividad: number
  f1: number
}

export interface Metricas {
  exactitud: number
  precision: number
  exhaustividad: number
  f1: number
  macroF1: number
  matriz: MatrizConfusion
  porClase: MetricasClase[]
}

const division = (a: number, b: number) => (b > 0 ? a / b : 0)

export function calcularMetricas(
  reales: readonly string[],
  predichos: readonly string[],
  clases: readonly string[],
  positiva: string
): Metricas {
  const matriz = matrizConfusion(reales, predichos, positiva)
  const total = reales.length

  const precision = division(matriz.vp, matriz.vp + matriz.fp)
  const exhaustividad = division(matriz.vp, matriz.vp + matriz.fn)
  const f1 = division(2 * precision * exhaustividad, precision + exhaustividad)

  const porClase: MetricasClase[] = clases.map((clase) => {
    const soporte = reales.filter((r) => r === clase).length
    if (clase === positiva) {
      return { clase, soporte, precision, exhaustividad, f1 }
    }
    const precisionClase = division(matriz.vn, matriz.vn + matriz.fn)
    const exhaustividadClase = division(matriz.vn, matriz.vn + matriz.fp)
    return {
      clase,
      soporte,
      precision: precisionClase,
      exhaustividad: exhaustividadClase,
      f1: division(2 * precisionClase * exhaustividadClase, precisionClase + exhaustividadClase),
    }
  })

  const macroF1 = porClase.length
    ? porClase.reduce((suma, c) => suma + c.f1, 0) / porClase.length
    : 0

  return {
    exactitud: division(matriz.vp + matriz.vn, total),
    precision,
    exhaustividad,
    f1,
    macroF1,
    matriz,
    porClase,
  }
}

/**
 * Divide los índices en k particiones manteniendo la proporción de clases.
 * El reparto es determinista: la misma semilla produce las mismas particiones.
 */
export function particionesEstratificadas(
  clases: readonly string[],
  k: number,
  semilla: number
): number[][] {
  const folds: number[][] = Array.from({ length: Math.max(2, k) }, () => [])
  const azar = crearAzar(semilla)
  const porClase = new Map<string, number[]>()
  clases.forEach((clase, indice) => {
    const lista = porClase.get(clase)
    if (lista) lista.push(indice)
    else porClase.set(clase, [indice])
  })

  for (const [, indices] of porClase) {
    // Fisher-Yates con el generador determinista.
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1))
      const tmp = indices[i]
      indices[i] = indices[j]
      indices[j] = tmp
    }
    indices.forEach((indice, posicion) => {
      folds[posicion % folds.length].push(indice)
    })
  }

  return folds
}

export function desviacionEstandar(valores: number[]): number {
  if (valores.length < 2) return 0
  const media = valores.reduce((a, b) => a + b, 0) / valores.length
  const varianza = valores.reduce((a, b) => a + (b - media) ** 2, 0) / valores.length
  return Math.sqrt(varianza)
}
