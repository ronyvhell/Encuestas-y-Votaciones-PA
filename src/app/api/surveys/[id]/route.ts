import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { connectDB } from "@/lib/db"
import { Encuesta, Voto } from "@/lib/models"
import { computarResultados } from "@/lib/results"
import { parseEncuestaInput } from "@/lib/encuesta-input"
import { hashIp, obtenerIp } from "@/lib/ip"
import { auth } from "@/auth"

export async function GET(request: Request, ctx: RouteContext<"/api/surveys/[id]">) {
  try {
    const { id } = await ctx.params

    await connectDB()

    const encuesta = await Encuesta.findById(id).populate("tipos", "nombre").lean()
    if (!encuesta) {
      return NextResponse.json({ error: "Encuesta no encontrada." }, { status: 404 })
    }

    const session = await auth()
    const esPropietario = session?.user?.id === encuesta.creador.toString()

    if (encuesta.estado !== "publicada" && !esPropietario) {
      return NextResponse.json({ error: "Encuesta no encontrada." }, { status: 404 })
    }

    const cookieStore = await cookies()
    const vid = cookieStore.get("vid")?.value ?? null
    const ip = obtenerIp(request)
    const ipHash = ip ? hashIp(ip) : ""

    const duplicados: Record<string, unknown>[] = []
    if (vid) duplicados.push({ voterId: vid })
    if (ipHash) duplicados.push({ ipHash })
    const yaVoto =
      duplicados.length > 0
        ? await Voto.exists({ encuestaId: encuesta._id, $or: duplicados })
        : null

    let resultados = null
    if (yaVoto || esPropietario) {
      const votos = await Voto.find({ encuestaId: encuesta._id }).lean()
      resultados = computarResultados(encuesta.preguntas, votos)
    }

    return NextResponse.json({
      _id: encuesta._id.toString(),
      titulo: encuesta.titulo,
      descripcion: encuesta.descripcion,
      imagenPortada: encuesta.imagenPortada,
      estado: encuesta.estado,
      tipos: (encuesta.tipos as { _id: string; nombre: string }[]).map((t) => ({ _id: t._id.toString(), nombre: t.nombre })),
      preguntas: encuesta.preguntas.map((p: { _id: { toString(): string }; texto: string; tipoPregunta: string; opciones: string[]; config: { min: number | null; max: number | null }; requerida: boolean }) => ({
        _id: p._id.toString(),
        texto: p.texto,
        tipoPregunta: p.tipoPregunta,
        opciones: p.opciones,
        config: { min: p.config.min ?? null, max: p.config.max ?? null },
        requerida: p.requerida,
      })),
      votos: encuesta.votos,
      hasVoted: !!yaVoto,
      esPropietario,
      resultados,
    })
  } catch (error) {
    console.error("Error al obtener encuesta:", error)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/surveys/[id]">) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 })
  }

  try {
    const { id } = await ctx.params
    const body = await request.json().catch(() => null)

    await connectDB()

    const encuesta = await Encuesta.findById(id)
    if (!encuesta) {
      return NextResponse.json({ error: "Encuesta no encontrada." }, { status: 404 })
    }
    if (encuesta.creador.toString() !== session.user.id) {
      return NextResponse.json({ error: "No tienes permisos sobre esta encuesta." }, { status: 403 })
    }

    if (body?.estado === "publicada" || body?.estado === "borrador") {
      if (body.estado === "publicada" && encuesta.preguntas.length === 0) {
        return NextResponse.json({ error: "No puedes publicar una encuesta sin preguntas." }, { status: 400 })
      }
      encuesta.estado = body.estado
      await encuesta.save()
      return NextResponse.json({ ok: true, estado: encuesta.estado })
    }

    const parsed = parseEncuestaInput(body)
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { data } = parsed
    encuesta.set("titulo", data.titulo)
    encuesta.set("descripcion", data.descripcion)
    encuesta.set("imagenPortada", data.imagenPortada)
    encuesta.set("tipos", data.tipos)
    if (encuesta.votos === 0) {
      encuesta.set("preguntas", data.preguntas)
    }
    await encuesta.save()

    return NextResponse.json({ ok: true, preguntasBloqueadas: encuesta.votos > 0 })
  } catch (error) {
    console.error("Error al actualizar encuesta:", error)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/surveys/[id]">) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 })
  }

  try {
    const { id } = await ctx.params

    await connectDB()

    const encuesta = await Encuesta.findById(id)
    if (!encuesta) {
      return NextResponse.json({ error: "Encuesta no encontrada." }, { status: 404 })
    }
    if (encuesta.creador.toString() !== session.user.id) {
      return NextResponse.json({ error: "No tienes permisos sobre esta encuesta." }, { status: 403 })
    }

    await Voto.deleteMany({ encuestaId: encuesta._id })
    await encuesta.deleteOne()

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error al eliminar encuesta:", error)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}
