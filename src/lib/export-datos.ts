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

  const definiciones = ordenadas.map((pregunta, indice) => ({
    pregunta,
    encabezado: encabezadoPregunta(pregunta, indice),
    tipo: tipoColumna(pregunta),
  }))

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
  for (const col of columnasMineras) {
    if (col.tipo === "numerico") {
      lineas.push(`@attribute ${col.encabezado} numeric`)
    } else if (col.tipo === "texto") {
      lineas.push(`@attribute ${col.encabezado} string`)
    } else {
      const valores = (col.valores ?? []).map(arffEtiqueta).join(",")
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
          if (col.tipo === "texto") return `'${String(valor).replace(/'/g, "\\'")}'`
          return arffEtiqueta(String(valor))
        })
        .join(",")
    )
  }

  return lineas.join("\n") + "\n"
}
