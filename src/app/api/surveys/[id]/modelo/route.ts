import { NextResponse } from "next/server"

import { connectDB } from "@/lib/db"
import { Encuesta, Modelo, Voto } from "@/lib/models"
import { entrenarModelo, type AlgoritmoModelo, type PoliticaObjetivo } from "@/lib/modelo"
import { aHistorial, aModeloVista } from "@/lib/modelo/serializar"
import { auth } from "@/auth"

type Ctx = { params: Promise<{ id: string }> }

async function cargarEncuestaPropia(id: string, usuarioId: string) {
  const encuesta = await Encuesta.findById(id).lean()
  if (!encuesta) return { error: NextResponse.json({ error: "Encuesta no encontrada." }, { status: 404 }) }
  if (encuesta.creador.toString() !== usuarioId) {
    return {
      error: NextResponse.json(
        { error: "Solo el creador de la encuesta puede gestionar su modelo predictivo." },
        { status: 403 }
      ),
    }
  }
  return { encuesta }
}

export async function GET(_request: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 })
  }

  const { id } = await ctx.params

  try {
    await connectDB()
    const resultado = await cargarEncuestaPropia(id, session.user.id)
    if ("error" in resultado) return resultado.error

    const modelos = await Modelo.find({ encuestaId: resultado.encuesta._id })
      .sort({ version: -1 })
      .lean()

    return NextResponse.json({
      ok: true,
      historial: modelos.map((modelo) => aHistorial(modelo as never)),
      total: modelos.length,
    })
  } catch (error) {
    console.error("Error al listar modelos:", error)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}

export async function POST(request: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 })
  }

  const { id } = await ctx.params

  try {
    const body = await request.json().catch(() => null)

    await connectDB()
    const resultado = await cargarEncuestaPropia(id, session.user.id)
    if ("error" in resultado) return resultado.error

    const encuesta = resultado.encuesta
    const votos = await Voto.find({ encuestaId: encuesta._id }).lean()

    let entrenamiento
    try {
      entrenamiento = entrenarModelo(encuesta.preguntas as never, votos as never, {
        preguntaObjetivoId: typeof body?.preguntaObjetivoId === "string" ? body.preguntaObjetivoId : null,
        algoritmo: typeof body?.algoritmo === "string" ? (body.algoritmo as AlgoritmoModelo) : "arbol",
        politica:
          body?.politica === "mapear_no" ? ("mapear_no" as PoliticaObjetivo) : ("excluir" as PoliticaObjetivo),
        semilla: Number.isFinite(Number(body?.semilla)) ? Number(body?.semilla) : 20261012,
        kFolds: Number.isFinite(Number(body?.kFolds)) ? Number(body?.kFolds) : 5,
      })
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : "No se pudo entrenar el modelo."
      return NextResponse.json({ error: mensaje }, { status: 400 })
    }

    const ultimo = await Modelo.findOne({ encuestaId: encuesta._id })
      .sort({ version: -1 })
      .select("version")
      .lean()
    const version = (ultimo?.version ?? 0) + 1

    const creado = await Modelo.create({
      encuestaId: encuesta._id,
      creador: session.user.id,
      version,
      ...entrenamiento,
    })

    return NextResponse.json(
      { ok: true, modelo: aModeloVista(creado.toObject() as never) },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error al entrenar el modelo:", error)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 })
  }

  const { id } = await ctx.params

  try {
    const { searchParams } = new URL(request.url)
    const modeloId = searchParams.get("modeloId") ?? ""
    if (!modeloId) {
      return NextResponse.json({ error: "Falta el modelo a eliminar." }, { status: 400 })
    }

    await connectDB()
    const resultado = await cargarEncuestaPropia(id, session.user.id)
    if ("error" in resultado) return resultado.error

    const eliminado = await Modelo.findOneAndDelete({
      _id: modeloId,
      encuestaId: resultado.encuesta._id,
    })
    if (!eliminado) {
      return NextResponse.json({ error: "Modelo no encontrado." }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error al eliminar el modelo:", error)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}
