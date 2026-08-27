import { NextResponse } from "next/server"

import { connectDB } from "@/lib/db"
import { SurveyType } from "@/lib/models"
import { TIPOS_ENCUESTA_DEFAULT } from "@/lib/constants"
import { auth } from "@/auth"

async function sembrarTiposSiVacio() {
  const total = await SurveyType.countDocuments()
  if (total > 0) return
  for (const nombre of TIPOS_ENCUESTA_DEFAULT) {
    await SurveyType.updateOne({ nombre }, { $setOnInsert: { nombre } }, { upsert: true })
  }
}

export async function GET() {
  try {
    await connectDB()
    await sembrarTiposSiVacio()
    const tipos = await SurveyType.find().sort({ nombre: 1 }).lean()
    return NextResponse.json(
      tipos.map((t) => ({
        _id: t._id.toString(),
        nombre: t.nombre,
        descripcion: t.descripcion ?? "",
      }))
    )
  } catch (error) {
    console.error("Error al listar tipos de encuesta:", error)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : ""

    if (!nombre || nombre.length < 2) {
      return NextResponse.json({ error: "El nombre del tipo debe tener al menos 2 caracteres." }, { status: 400 })
    }
    if (nombre.length > 40) {
      return NextResponse.json({ error: "El nombre del tipo no puede superar los 40 caracteres." }, { status: 400 })
    }

    await connectDB()

    const existente = await SurveyType.findOne({ nombre: { $regex: new RegExp(`^${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } })
    if (existente) {
      return NextResponse.json(
        { error: "Ya existe un tipo con ese nombre.", _id: existente._id.toString(), nombre: existente.nombre },
        { status: 409 }
      )
    }

    const creado = await SurveyType.create({ nombre })
    return NextResponse.json({ _id: creado._id.toString(), nombre: creado.nombre }, { status: 201 })
  } catch (error) {
    console.error("Error al crear tipo de encuesta:", error)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}
