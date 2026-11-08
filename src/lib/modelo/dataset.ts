// Convierte una encuesta + sus votos en una matriz tabular lista para entrenar.
// La variable objetivo siempre queda reducida a DOS clases (por ejemplo Sí / No).

import { esTipoConOpciones } from "@/lib/constants"
import type {
  Dataset,
  DefinicionColumna,
  FilaEntrenamiento,
  ObjetivoPosible,
  PoliticaObjetivo,
  PreguntaEntrada,
  ValorColumna,
  VotoEntrada,
} from "./tipos"

const SIN_RESPUESTA = "(sin respuesta)"

const RE_NO_SE =
  /^(no se|ns\/?nc|no sabe|no sabria|no estoy seguro|no estoy segura|tal vez|quiza|depende|a veces)$/
const RE_POSITIVA =
  /^(si|true|verdadero|de acuerdo|totalmente|muy de acuerdo|alta|alto|excelente)$/

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function idDe(pregunta: PreguntaEntrada): string {
  return pregunta._id === undefined ? "" : String(pregunta._id)
}

/**
 * Preguntas que pueden usarse como variable objetivo: deben producir dos clases.
 * - Verdadero/falso: dos clases naturales.
 * - Selección única con 2 opciones.
 * - Selección única con 3 opciones cuando una es "No sé" (se aplica la política).
 */
export function objetivosPosibles(preguntas: PreguntaEntrada[]): ObjetivoPosible[] {
  const lista: ObjetivoPosible[] = []

  for (const pregunta of preguntas) {
    const preguntaId = idDe(pregunta)
    if (!preguntaId) continue

    if (pregunta.tipoPregunta === "verdadero_falso") {
      lista.push({
        preguntaId,
        texto: pregunta.texto,
        tipo: "verdadero_falso",
        opciones: ["Verdadero", "Falso"],
        positiva: "Sí",
        negativa: "No",
        tieneNoSe: false,
      })
      continue
    }

    if (pregunta.tipoPregunta !== "seleccion_unica") continue

    const opciones = (pregunta.opciones ?? []).map((o) => String(o).trim()).filter(Boolean)
    if (opciones.length < 2 || opciones.length > 3) continue

    const neutral = opciones.find((o) => RE_NO_SE.test(normalizar(o)))
    if (opciones.length === 3 && !neutral) continue

    const utiles = neutral ? opciones.filter((o) => o !== neutral) : opciones
    if (utiles.length !== 2) continue

    const positiva = utiles.find((o) => RE_POSITIVA.test(normalizar(o))) ?? utiles[0]
    const negativa = utiles.find((o) => o !== positiva) ?? utiles[1]

    lista.push({
      preguntaId,
      texto: pregunta.texto,
      tipo: "seleccion_unica",
      opciones,
      positiva,
      negativa,
      tieneNoSe: Boolean(neutral),
    })
  }

  // Las preguntas de selección única con dos opciones son un objetivo más
  // explícito que un verdadero/falso, que suele funcionar mejor como predictor.
  // El orden dentro de cada grupo se conserva.
  return lista.sort((a, b) =>
    a.tipo === b.tipo ? 0 : a.tipo === "seleccion_unica" ? -1 : 1
  )
}

/** Busca el objetivo por id; si no se indica, devuelve el primero válido. */
export function resolverObjetivo(
  preguntas: PreguntaEntrada[],
  objetivoId?: string | null
): ObjetivoPosible | null {
  const objetivos = objetivosPosibles(preguntas)
  if (objetivos.length === 0) return null
  if (!objetivoId) return objetivos[0]
  return objetivos.find((o) => o.preguntaId === objetivoId) ?? objetivos[0]
}

const etiquetaPositiva = (objetivo: ObjetivoPosible) => objetivo.positiva
const etiquetaNegativa = (objetivo: ObjetivoPosible) => objetivo.negativa

/** Convierte la respuesta del objetivo en una de las dos clases, o null si se excluye. */
export function claseDeRespuesta(
  objetivo: ObjetivoPosible,
  valor: unknown,
  politica: PoliticaObjetivo
): string | null {
  if (objetivo.tipo === "verdadero_falso") {
    if (valor === true || valor === "true") return etiquetaPositiva(objetivo)
    if (valor === false || valor === "false") return etiquetaNegativa(objetivo)
    return null
  }

  if (valor === null || valor === undefined) return null
  const texto = String(valor).trim()
  if (texto === "") return null

  const normalizado = normalizar(texto)
  if (normalizado === normalizar(objetivo.positiva)) return etiquetaPositiva(objetivo)
  if (normalizado === normalizar(objetivo.negativa)) return etiquetaNegativa(objetivo)

  // Valor "No sé" u otro no contemplado: se excluye o se cuenta como negativo.
  return politica === "mapear_no" ? etiquetaNegativa(objetivo) : null
}

function construirColumnas(
  preguntas: PreguntaEntrada[],
  objetivoId: string
): DefinicionColumna[] {
  const columnas: DefinicionColumna[] = []

  for (const pregunta of preguntas) {
    const preguntaId = idDe(pregunta)
    if (!preguntaId || preguntaId === objetivoId) continue
    // El texto libre no es una variable útil para un árbol ni para distancia.
    if (pregunta.tipoPregunta === "texto") continue

    if (pregunta.tipoPregunta === "verdadero_falso") {
      columnas.push({
        id: preguntaId,
        preguntaId,
        texto: pregunta.texto,
        tipo: "nominal",
        opciones: ["Verdadero", "Falso"],
        booleano: true,
      })
      continue
    }

    if (!esTipoConOpciones(pregunta.tipoPregunta)) continue

    const opciones = (pregunta.opciones ?? []).map((o) => String(o).trim()).filter(Boolean)
    if (opciones.length === 0) continue

    if (pregunta.tipoPregunta === "seleccion_unica") {
      const numerica =
        opciones.length >= 2 && opciones.every((opcion) => Number.isFinite(Number(opcion)))
      columnas.push({
        id: preguntaId,
        preguntaId,
        texto: pregunta.texto,
        tipo: numerica ? "numerico" : "nominal",
        opciones,
      })
      continue
    }

    // Checklist / selección múltiple: una columna marcada/no marcada por opción.
    for (const opcion of opciones) {
      columnas.push({
        id: `${preguntaId}::${opcion}`,
        preguntaId,
        texto: `${pregunta.texto} · ${opcion}`,
        tipo: "nominal",
        opciones: ["marcada", "sin marcar"],
        multiple: true,
      })
    }
  }

  return columnas
}

function valorDeColumna(columna: DefinicionColumna, respuestas: Map<string, unknown>): ValorColumna {
  const crudo = respuestas.get(columna.preguntaId)

  if (columna.multiple) {
    const opcion = columna.id.slice(columna.id.indexOf("::") + 2)
    const lista = Array.isArray(crudo)
      ? crudo.map((v) => String(v))
      : crudo === null || crudo === undefined || crudo === ""
        ? []
        : [String(crudo)]
    return lista.includes(opcion) ? "marcada" : "sin marcar"
  }

  if (columna.booleano) {
    if (crudo === true || crudo === "true") return "Verdadero"
    if (crudo === false || crudo === "false") return "Falso"
    return SIN_RESPUESTA
  }

  if (columna.tipo === "numerico") {
    if (crudo === null || crudo === undefined || crudo === "") return Number.NaN
    const numero = Number(crudo)
    return Number.isFinite(numero) ? numero : Number.NaN
  }

  if (crudo === null || crudo === undefined) return SIN_RESPUESTA
  const texto = Array.isArray(crudo) ? crudo.map((v) => String(v)).join(" | ") : String(crudo)
  return texto.trim() === "" ? SIN_RESPUESTA : texto.trim()
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0
  const ordenados = [...valores].sort((a, b) => a - b)
  const medio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 === 0
    ? (ordenados[medio - 1] + ordenados[medio]) / 2
    : ordenados[medio]
}

export function construirDataset(
  preguntas: PreguntaEntrada[],
  votos: VotoEntrada[],
  objetivo: ObjetivoPosible,
  politica: PoliticaObjetivo = "excluir"
): Dataset {
  const columnas = construirColumnas(preguntas, objetivo.preguntaId)
  const clases = [etiquetaPositiva(objetivo), etiquetaNegativa(objetivo)]

  const parciales: FilaEntrenamiento[] = []
  let excluidos = 0

  votos.forEach((voto, indice) => {
    const respuestas = new Map<string, unknown>()
    for (const respuesta of voto.respuestas ?? []) {
      respuestas.set(String(respuesta.preguntaId), respuesta.valor)
    }

    const clase = claseDeRespuesta(objetivo, respuestas.get(objetivo.preguntaId), politica)
    if (clase === null) {
      excluidos += 1
      return
    }

    const valores: Record<string, ValorColumna> = {}
    for (const columna of columnas) {
      valores[columna.id] = valorDeColumna(columna, respuestas)
    }

    parciales.push({
      votoId: voto._id === undefined ? `voto-${indice}` : String(voto._id),
      valores,
      clase,
    })
  })

  // Imputación de numéricos con la mediana de los valores observados.
  for (const columna of columnas) {
    if (columna.tipo !== "numerico") continue
    const observados = parciales
      .map((fila) => fila.valores[columna.id])
      .filter((valor): valor is number => typeof valor === "number" && Number.isFinite(valor))
    columna.mediana = mediana(observados)
    for (const fila of parciales) {
      const valor = fila.valores[columna.id]
      if (typeof valor !== "number" || !Number.isFinite(valor)) {
        fila.valores[columna.id] = columna.mediana
      }
    }
  }

  // Si hay valores faltantes en nominales, la categoría queda declarada.
  for (const columna of columnas) {
    if (columna.tipo !== "nominal") continue
    const tieneFaltantes = parciales.some((fila) => fila.valores[columna.id] === SIN_RESPUESTA)
    if (tieneFaltantes && !columna.opciones.includes(SIN_RESPUESTA)) {
      columna.opciones = [...columna.opciones, SIN_RESPUESTA]
    }
  }

  const distribucion: Record<string, number> = {}
  for (const fila of parciales) {
    distribucion[fila.clase] = (distribucion[fila.clase] ?? 0) + 1
  }

  return {
    columnas,
    filas: parciales,
    clases,
    clasePositiva: etiquetaPositiva(objetivo),
    totalVotos: votos.length,
    excluidos,
    distribucion,
  }
}

/** Prepara un caso suelto (formulario del simulador) con la misma codificación del dataset. */
export function prepararCaso(
  columnas: DefinicionColumna[],
  respuestas: Record<string, unknown>
): Record<string, ValorColumna> {
  const valores: Record<string, ValorColumna> = {}

  for (const columna of columnas) {
    const crudo = respuestas[columna.preguntaId]

    if (columna.multiple) {
      const opcion = columna.id.slice(columna.id.indexOf("::") + 2)
      const lista = Array.isArray(crudo)
        ? crudo.map((v) => String(v))
        : crudo === null || crudo === undefined || crudo === ""
          ? []
          : [String(crudo)]
      valores[columna.id] = lista.includes(opcion) ? "marcada" : "sin marcar"
      continue
    }

    if (columna.booleano) {
      valores[columna.id] =
        crudo === true || crudo === "true"
          ? "Verdadero"
          : crudo === false || crudo === "false"
            ? "Falso"
            : SIN_RESPUESTA
      continue
    }

    if (columna.tipo === "numerico") {
      const numero = Number(crudo)
      valores[columna.id] =
        crudo === null || crudo === undefined || crudo === "" || !Number.isFinite(numero)
          ? (columna.mediana ?? 0)
          : numero
      continue
    }

    if (crudo === null || crudo === undefined) {
      valores[columna.id] = SIN_RESPUESTA
      continue
    }
    const texto = Array.isArray(crudo) ? crudo.map((v) => String(v)).join(" | ") : String(crudo)
    valores[columna.id] = texto.trim() === "" ? SIN_RESPUESTA : texto.trim()
  }

  return valores
}
