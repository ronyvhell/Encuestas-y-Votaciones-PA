import { NextResponse } from "next/server"
import mongoose from "mongoose"

import { connectDB } from "@/lib/db"
import { Encuesta, Voto } from "@/lib/models"
import { parseEncuestaInput } from "@/lib/encuesta-input"
import { auth } from "@/auth"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get("q") ?? "").trim()

    await connectDB()

    const filtro: Record<string, unknown> = { estado: "publicada" }
    if (q) {
      filtro.$or = [
        { titulo: { $regex: q, $options: "i" } },
        { descripcion: { $regex: q, $options: "i" } },
      ]
    }

    const encuestas = await Encuesta.find(filtro)
      .populate("tipos", "nombre")
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json(
      encuestas.map((e) => ({
        _id: e._id.toString(),
        titulo: e.titulo,
        descripcion: e.descripcion,
        imagenPortada: e.imagenPortada,
        estado: e.estado,
        tipos: (e.tipos as { _id: string; nombre: string }[]).map((t) => ({
          _id: t._id.toString(),
          nombre: t.nombre,
        })),
        preguntas: e.preguntas.length,
        votos: e.votos,
        createdAt: e.createdAt,
      }))
    )
  } catch (error) {
    console.error("Error al listar encuestas:", error)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Debes iniciar sesión para crear encuestas." }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    const parsed = parseEncuestaInput(body)
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    await connectDB()

    const encuesta = await Encuesta.create({
      ...parsed.data,
      estado: "borrador",
      creador: session.user.id,
    })

    return NextResponse.json({ _id: encuesta._id.toString() }, { status: 201 })
  } catch (error) {
    console.error("Error al crear encuesta:", error)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    const idsRaw: unknown[] = Array.isArray(body?.ids) ? body.ids : []
    const ids = idsRaw.filter(
      (id): id is string => typeof id === "string" && mongoose.isValidObjectId(id)
    )

    if (ids.length === 0) {
      return NextResponse.json({ error: "No se seleccionó ninguna encuesta." }, { status: 400 })
    }

    await connectDB()

    const propias = await Encuesta.find({ _id: { $in: ids }, creador: session.user.id })
      .select("_id")
      .lean()

    if (propias.length === 0) {
      return NextResponse.json({ error: "No tienes permisos sobre esas encuestas." }, { status: 403 })
    }

    const idsPropias = propias.map((e) => e._id)
    await Voto.deleteMany({ encuestaId: { $in: idsPropias } })
    await Encuesta.deleteMany({ _id: { $in: idsPropias } })

    return NextResponse.json({ ok: true, eliminadas: idsPropias.length })
  } catch (error) {
    console.error("Error al eliminar encuestas:", error)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}
