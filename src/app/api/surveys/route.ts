import { NextResponse } from "next/server"

import { connectDB } from "@/lib/db"
import { Encuesta } from "@/lib/models"
import { TIPOS_PREGUNTA } from "@/lib/constants"
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
    if (!body) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 })
    }

    const titulo = typeof body.titulo === "string" ? body.titulo.trim() : ""
    const descripcion = typeof body.descripcion === "string" ? body.descripcion.trim() : ""
    const imagenPortada = typeof body.imagenPortada === "string" ? body.imagenPortada.trim() : ""
    const tipos: string[] = Array.isArray(body.tipos)
      ? body.tipos.filter((t: unknown) => typeof t === "string").map((t: unknown) => String(t))
      : []
    const preguntas: unknown[] = Array.isArray(body.preguntas) ? body.preguntas : []

    if (!titulo) {
      return NextResponse.json({ error: "El título de la encuesta es obligatorio." }, { status: 400 })
    }
    if (titulo.length > 120) {
      return NextResponse.json({ error: "El título no puede superar los 120 caracteres." }, { status: 400 })
    }
    if (descripcion.length > 500) {
      return NextResponse.json({ error: "La descripción no puede superar los 500 caracteres." }, { status: 400 })
    }
    if (preguntas.length === 0) {
      return NextResponse.json({ error: "Debes agregar al menos una pregunta." }, { status: 400 })
    }

    const preguntasValidas = preguntas.map((p, indice) => {
      const pregunta = p as { texto?: unknown; tipoPregunta?: unknown; opciones?: unknown; config?: unknown; requerida?: unknown }
      const texto = typeof pregunta.texto === "string" ? pregunta.texto.trim() : ""
      const tipoPregunta = pregunta.tipoPregunta
      const config = (pregunta.config ?? {}) as { min?: unknown; max?: unknown }
      const requerida = pregunta.requerida === true

      const conOpciones =
        tipoPregunta === "checklist" ||
        tipoPregunta === "seleccion_multiple" ||
        tipoPregunta === "seleccion_unica"

      const opciones = Array.isArray(pregunta.opciones)
        ? (pregunta.opciones as unknown[])
            .filter((o) => typeof o === "string")
            .map((o) => String(o).trim())
            .filter((o) => o.length > 0)
            .slice(0, 20)
        : []

      if (!texto) {
        return { error: `La pregunta ${indice + 1} no tiene texto.` }
      }
      if (!TIPOS_PREGUNTA.some((t) => t.value === tipoPregunta)) {
        return { error: `La pregunta ${indice + 1} tiene un tipo no válido.` }
      }
      if (conOpciones && opciones.length < 2) {
        return { error: `La pregunta ${indice + 1} necesita al menos 2 opciones.` }
      }

      const min = typeof config.min === "number" && Number.isFinite(config.min) ? config.min : null
      const max = typeof config.max === "number" && Number.isFinite(config.max) ? config.max : null

      return {
        texto,
        tipoPregunta,
        opciones: conOpciones ? opciones : [],
        config: { min, max },
        requerida,
        orden: indice,
      }
    })

    const errorPregunta = preguntasValidas.find((p) => "error" in p)
    if (errorPregunta) {
      return NextResponse.json({ error: errorPregunta.error }, { status: 400 })
    }

    await connectDB()

    const encuesta = await Encuesta.create({
      titulo,
      descripcion,
      imagenPortada,
      tipos,
      estado: "borrador",
      creador: session.user.id,
      preguntas: preguntasValidas,
    })

    return NextResponse.json({ _id: encuesta._id.toString() }, { status: 201 })
  } catch (error) {
    console.error("Error al crear encuesta:", error)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}
