// Construye todos los datos que necesita la página del modelo predictivo.
// Se ejecuta en el servidor: recibe la encuesta, sus votos y las versiones guardadas.

import { analizarFactores, type AnalisisFactores } from "./analisis"
import { claseDeRespuesta, objetivosPosibles, prepararCaso, resolverObjetivo } from "./dataset"
import { predecirConArtefacto, type Artefacto } from "./prediccion"
import { aHistorial, aModeloVista, type ModeloAlmacenado } from "./serializar"
import type { DefinicionColumna, PoliticaObjetivo, PreguntaEntrada, VotoEntrada } from "./tipos"
import type { DatosModeloPage, EjemploVista, PreguntaVista } from "./vista"

export interface ParametrosPaginaModelo {
  encuesta: {
    _id: { toString(): string }
    titulo: string
    preguntas: PreguntaEntrada[]
  }
  votos: VotoEntrada[]
  modelos: ModeloAlmacenado[]
}

function formatearValor(valor: unknown, pregunta: PreguntaEntrada): string {
  if (valor === null || valor === undefined || valor === "") return ""
  if (pregunta.tipoPregunta === "verdadero_falso") {
    return valor === true || valor === "true" ? "Verdadero" : "Falso"
  }
  if (Array.isArray(valor)) return valor.map((item) => String(item)).join(", ")
  return String(valor)
}

function aPreguntasVista(preguntas: PreguntaEntrada[]): PreguntaVista[] {
  return preguntas.map((pregunta) => ({
    _id: pregunta._id === undefined ? "" : String(pregunta._id),
    texto: pregunta.texto,
    tipoPregunta: pregunta.tipoPregunta,
    opciones: pregunta.opciones ?? [],
    requerida: pregunta.requerida === true,
    config: { min: null, max: null },
  }))
}

function construirEjemplos(
  preguntas: PreguntaEntrada[],
  votos: VotoEntrada[],
  objetivo: ReturnType<typeof resolverObjetivo>,
  politica: PoliticaObjetivo,
  modelo: ModeloAlmacenado,
  clasePositiva: string,
  columnas: DefinicionColumna[]
): EjemploVista[] {
  if (!objetivo) return []

  const artefacto = modelo.artefacto as Artefacto
  const preguntasPerfil = preguntas
    .filter((pregunta) => String(pregunta._id) !== objetivo.preguntaId)
    .filter((pregunta) => pregunta.tipoPregunta !== "texto")
    .slice(0, 8)

  const correctos: EjemploVista[] = []
  const errores: EjemploVista[] = []

  votos.forEach((voto, indice) => {
    if (correctos.length >= 6 && errores.length >= 4) return

    const idVoto = voto._id === undefined ? `voto-${indice}` : String(voto._id)
    const respuestas: Record<string, unknown> = {}
    for (const respuesta of voto.respuestas ?? []) {
      respuestas[String(respuesta.preguntaId)] = respuesta.valor
    }

    const real = claseDeRespuesta(objetivo, respuestas[objetivo.preguntaId], politica)
    if (!real) return

    const valores = prepararCaso(columnas, respuestas)
    const prediccion = predecirConArtefacto(artefacto, valores, clasePositiva)

    const perfil: Array<{ texto: string; valor: string }> = []
    for (const pregunta of preguntasPerfil) {
      const valor = formatearValor(respuestas[String(pregunta._id)], pregunta)
      if (valor === "") continue
      perfil.push({ texto: pregunta.texto, valor })
      if (perfil.length >= 6) break
    }

    const ejemplo: EjemploVista = {
      votoId: idVoto,
      fecha: voto.createdAt ? new Date(voto.createdAt).toISOString().slice(0, 10) : "",
      perfil,
      respuestas,
      real,
      prediccion: prediccion.clase,
      probabilidadPositiva: prediccion.probabilidadPositiva,
      acierto: prediccion.clase === real,
    }

    if (ejemplo.acierto) {
      if (correctos.length < 6) correctos.push(ejemplo)
    } else if (errores.length < 4) {
      errores.push(ejemplo)
    }
  })

  return [...correctos, ...errores]
}

export function construirDatosPagina({
  encuesta,
  votos,
  modelos,
}: ParametrosPaginaModelo): DatosModeloPage {
  const preguntas = encuesta.preguntas ?? []
  const objetivos = objetivosPosibles(preguntas)
  const modeloDoc = modelos[0] ?? null
  const objetivo = resolverObjetivo(preguntas, modeloDoc?.preguntaObjetivoId)

  const analisisVacio: AnalisisFactores = {
    totalVotos: votos.length,
    filasModelo: 0,
    excluidos: 0,
    clases: [],
    clasePositiva: "",
    distribucion: {},
    preguntas: [],
  }

  if (!objetivo) {
    return {
      encuestaId: encuesta._id.toString(),
      tituloEncuesta: encuesta.titulo,
      totalVotos: votos.length,
      preguntas: aPreguntasVista(preguntas),
      objetivos: [],
      analisis: analisisVacio,
      modelo: null,
      historial: modelos.map(aHistorial),
      ejemplos: [],
    }
  }

  const politica: PoliticaObjetivo = modeloDoc?.politica === "mapear_no" ? "mapear_no" : "excluir"
  const analisis = analizarFactores(preguntas, votos, objetivo, politica)
  const modeloVista = modeloDoc ? aModeloVista(modeloDoc) : null
  const ejemplos =
    modeloDoc && modeloVista
      ? construirEjemplos(
          preguntas,
          votos,
          objetivo,
          politica,
          modeloDoc,
          modeloVista.clasePositiva,
          modeloVista.columnas
        )
      : []

  return {
    encuestaId: encuesta._id.toString(),
    tituloEncuesta: encuesta.titulo,
    totalVotos: votos.length,
    preguntas: aPreguntasVista(preguntas),
    objetivos: objetivos.map((item) => ({
      preguntaId: item.preguntaId,
      texto: item.texto,
      opciones: item.opciones,
      positiva: item.positiva,
      negativa: item.negativa,
      tieneNoSe: item.tieneNoSe,
    })),
    analisis,
    modelo: modeloVista,
    historial: modelos.map(aHistorial),
    ejemplos,
  }
}
