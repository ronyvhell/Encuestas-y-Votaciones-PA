import { NextResponse } from "next/server"

import { connectDB } from "@/lib/db"
import { Encuesta, Modelo } from "@/lib/models"
import { prepararCaso, predecirConArtefacto, type Artefacto, type DefinicionColumna } from "@/lib/modelo"
import { auth } from "@/auth"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 })
  }

  const { id } = await ctx.params

  try {
    const body = await request.json().catch(() => null)
    const respuestas = body?.respuestas
    if (!respuestas || typeof respuestas !== "object" || Array.isArray(respuestas)) {
      return NextResponse.json({ error: "Faltan las respuestas del caso a predecir." }, { status: 400 })
    }

    await connectDB()

    const encuesta = await Encuesta.findById(id).lean()
    if (!encuesta) {
      return NextResponse.json({ error: "Encuesta no encontrada." }, { status: 404 })
    }
    if (encuesta.creador.toString() !== session.user.id) {
      return NextResponse.json(
        { error: "Solo el creador de la encuesta puede generar predicciones." },
        { status: 403 }
      )
    }

    const modelo =
      typeof body?.modeloId === "string" && body.modeloId.length > 0
        ? await Modelo.findOne({ _id: body.modeloId, encuestaId: encuesta._id }).lean()
        : await Modelo.findOne({ encuestaId: encuesta._id }).sort({ version: -1 }).lean()

    if (!modelo) {
      return NextResponse.json(
        { error: "Esta encuesta todavía no tiene un modelo entrenado." },
        { status: 404 }
      )
    }

    const columnas = (modelo.columnas ?? []) as DefinicionColumna[]
    const valores = prepararCaso(columnas, respuestas as Record<string, unknown>)
    const prediccion = predecirConArtefacto(
      modelo.artefacto as Artefacto,
      valores,
      modelo.clasePositiva
    )

    return NextResponse.json({
      ok: true,
      modeloId: modelo._id.toString(),
      version: modelo.version,
      algoritmo: modelo.algoritmo,
      textoObjetivo: modelo.textoObjetivo,
      clasePositiva: modelo.clasePositiva,
      clases: modelo.clases,
      clase: prediccion.clase,
      probabilidades: prediccion.probabilidades,
      probabilidadPositiva: prediccion.probabilidadPositiva,
      explicacion: prediccion.explicacion,
    })
  } catch (error) {
    console.error("Error al predecir:", error)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}
