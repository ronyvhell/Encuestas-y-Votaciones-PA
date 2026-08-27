import type { IPregunta, IVoto } from "@/lib/models"
import { esTipoConOpciones } from "@/lib/constants"

export interface ResultadoPregunta {
  preguntaId: string
  total: number
  conteoOpciones?: Record<string, number>
  valores?: (string | number)[]
  verdadero?: number
  falso?: number
}

export function computarResultados(preguntas: IPregunta[], votos: IVoto[]): ResultadoPregunta[] {
  return preguntas.map((pregunta) => {
    const respuestas = votos
      .map((voto) => voto.respuestas.find((r) => r.preguntaId === pregunta._id.toString()))
      .filter((r): r is NonNullable<typeof r> => !!r)

    const resultado: ResultadoPregunta = {
      preguntaId: pregunta._id.toString(),
      total: respuestas.length,
    }

    if (esTipoConOpciones(pregunta.tipoPregunta) || pregunta.tipoPregunta === "verdadero_falso") {
      const conteo: Record<string, number> = {}
      for (const respuesta of respuestas) {
        const valores = Array.isArray(respuesta.valor) ? respuesta.valor : [respuesta.valor]
        for (const valor of valores) {
          const clave = String(valor)
          conteo[clave] = (conteo[clave] ?? 0) + 1
        }
      }
      if (pregunta.tipoPregunta === "verdadero_falso") {
        resultado.verdadero = conteo["true"] ?? 0
        resultado.falso = conteo["false"] ?? 0
      } else {
        resultado.conteoOpciones = conteo
      }
    } else {
      resultado.valores = respuestas
        .map((respuesta) => respuesta.valor as string | number)
        .filter((valor) => valor !== "" && valor !== null && valor !== undefined)
        .slice(0, 50)
    }

    return resultado
  })
}
