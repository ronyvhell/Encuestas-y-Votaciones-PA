// Aplana los votos (que guardan un array `respuestas`) a un formato tabular
// (una fila por encuestado) y genera CSV y ARFF (Weka).
// Solo debe usarse desde el servidor; la autorización la hace el route handler.

import type { IPregunta, IVoto } from "@/lib/models"

export type TipoColumna = "fecha" | "numerico" | "nominal" | "texto"

export interface ColumnaExport {
  encabezado: string
  texto?: string
  tipo: TipoColumna
  valores?: string[]
}

export type FilaExport = Record<string, string | number>

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

/**
 * Quita tildes y diéresis conservando el resto del texto.
 * Las etiquetas del ARFF van sin acentos para que Weka las lea con cualquier
 * configuración regional; el texto original queda en los comentarios `%`.
 */
export function sinAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export function slugTitulo(titulo: string): string {
  const slug = normalizar(titulo).split("_").filter(Boolean).join("_")
  return slug || "encuesta"
}

function encabezadoPregunta(pregunta: IPregunta, indice: number): string {
  if (pregunta.clave && /^[a-zA-Z0-9_]+$/.test(pregunta.clave)) return pregunta.clave
  const slug = normalizar(pregunta.texto).split("_").filter(Boolean).slice(0, 4).join("_")
  return slug || `pregunta_${indice + 1}`
}

// Una pregunta es numérica si es selección única y TODAS sus opciones son números.
function esNumerica(pregunta: IPregunta): boolean {
  if (pregunta.tipoPregunta !== "seleccion_unica") return false
  const opciones = (pregunta.opciones ?? []).map((o) => o.trim()).filter(Boolean)
  return opciones.length >= 2 && opciones.every((o) => /^-?\d+(\.\d+)?$/.test(o))
}

function tipoColumna(pregunta: IPregunta): TipoColumna {
  if (esNumerica(pregunta)) return "numerico"
  if (pregunta.tipoPregunta === "texto") return "texto"
  return "nominal"
}

export function aplanarVotos(
  preguntas: IPregunta[],
  votos: IVoto[]
): { columnas: ColumnaExport[]; filas: FilaExport[] } {
  const ordenadas = [...preguntas].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))

  // Encabezados únicos: dos preguntas pueden normalizarse al mismo slug.
  const usados = new Set<string>(["fecha"])
  const definiciones = ordenadas.map((pregunta, indice) => {
    const base = encabezadoPregunta(pregunta, indice)
    let encabezado = base
    let sufijo = 2
    while (usados.has(encabezado)) {
      encabezado = `${base}_${sufijo}`
      sufijo += 1
    }
    usados.add(encabezado)
    return { pregunta, encabezado, tipo: tipoColumna(pregunta) }
  })

  // La fecha del voto es útil para el tablero (series de tiempo); Weka la ignora.
  const columnas: ColumnaExport[] = [
    { encabezado: "fecha", tipo: "fecha" },
    ...definiciones.map((d) => ({
      encabezado: d.encabezado,
      texto: d.pregunta.texto,
      tipo: d.tipo,
    })),
  ]

  const valoresNominales = new Map<string, Set<string>>()
  for (const d of definiciones) {
    if (d.tipo === "nominal") valoresNominales.set(d.encabezado, new Set())
  }

  const filas: FilaExport[] = votos.map((voto) => {
    const fila: FilaExport = {
      fecha: voto.createdAt ? new Date(voto.createdAt).toISOString().slice(0, 10) : "",
    }

    for (const d of definiciones) {
      const respuesta = voto.respuestas.find((r) => r.preguntaId === d.pregunta._id.toString())
      let valor: string | number = ""

      if (d.tipo === "numerico") {
        const n = Number(respuesta?.valor)
        valor = Number.isFinite(n) ? n : ""
      } else if (d.pregunta.tipoPregunta === "verdadero_falso") {
        const v = respuesta?.valor
        valor = v === true || v === "true" ? "true" : v === false || v === "false" ? "false" : ""
      } else if (Array.isArray(respuesta?.valor)) {
        valor = respuesta.valor.join(" | ")
      } else {
        valor = respuesta?.valor == null ? "" : String(respuesta.valor)
      }

      fila[d.encabezado] = valor
      if (d.tipo === "nominal" && valor !== "") {
        valoresNominales.get(d.encabezado)!.add(String(valor))
      }
    }

    return fila
  })

  for (const col of columnas) {
    if (col.tipo === "nominal") {
      col.valores = [...(valoresNominales.get(col.encabezado) ?? [])]
    }
  }

  return { columnas, filas }
}

function escaparCsv(valor: unknown): string {
  const s = String(valor ?? "")
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function generarCsv(columnas: ColumnaExport[], filas: FilaExport[]): string {
  const cabecera = columnas.map((c) => c.encabezado).join(",")
  const lineas = filas.map((fila) => columnas.map((c) => escaparCsv(fila[c.encabezado])).join(","))
  return [cabecera, ...lineas].join("\r\n")
}

function arffEtiqueta(valor: string): string {
  // Las etiquetas nominales con espacios o caracteres especiales van entre comillas simples.
  if (/^[a-zA-Z0-9_.\-]+$/.test(valor)) return valor
  return `'${valor.replace(/'/g, "\\'")}'`
}

export function generarArff(titulo: string, columnas: ColumnaExport[], filas: FilaExport[]): string {
  const lineas: string[] = []
  const columnasMineras = columnas.filter((c) => c.tipo !== "fecha")

  lineas.push(`@relation ${slugTitulo(titulo)}`)
  lineas.push("")

  // Diccionario legible: Weka ignora las líneas que empiezan por "%", pero el
  // texto original (con acentos) queda documentado en el propio archivo.
  lineas.push("% Diccionario de variables (texto original de la encuesta)")
  for (const col of columnasMineras) {
    if (col.texto) lineas.push(`% ${col.encabezado}: ${col.texto}`)
  }

  const traducciones: string[] = []
  for (const col of columnasMineras) {
    for (const valor of col.valores ?? []) {
      const limpio = sinAcentos(valor)
      if (limpio !== valor) traducciones.push(`% ${col.encabezado}: "${valor}" -> "${limpio}"`)
    }
  }
  if (traducciones.length > 0) {
    lineas.push("%")
    lineas.push("% Etiquetas sin acentos para que Weka las lea en cualquier configuración")
    lineas.push(...traducciones)
  }
  lineas.push("")

  for (const col of columnasMineras) {
    if (col.tipo === "numerico") {
      lineas.push(`@attribute ${col.encabezado} numeric`)
    } else if (col.tipo === "texto") {
      lineas.push(`@attribute ${col.encabezado} string`)
    } else {
      const valores = (col.valores ?? []).map((valor) => arffEtiqueta(sinAcentos(valor))).join(",")
      lineas.push(`@attribute ${col.encabezado} {${valores}}`)
    }
  }
  lineas.push("")
  lineas.push("@data")

  for (const fila of filas) {
    lineas.push(
      columnasMineras
        .map((col) => {
          const valor = fila[col.encabezado]
          if (valor === "" || valor == null) return "?"
          if (col.tipo === "numerico") return String(valor)
          return arffEtiqueta(sinAcentos(String(valor)))
        })
        .join(",")
    )
  }

  return lineas.join("\n") + "\n"
}
