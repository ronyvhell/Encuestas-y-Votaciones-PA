import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { randomUUID } from "node:crypto"

import { connectDB } from "@/lib/db"
import { Encuesta, Voto } from "@/lib/models"
import { computarResultados } from "@/lib/results"
import { esTipoConOpciones } from "@/lib/constants"
import { hashIp, obtenerIp } from "@/lib/ip"

export async function POST(request: Request, ctx: RouteContext<"/api/surveys/[id]/vote">) {
  try {
    const { id } = await ctx.params
    const body = await request.json().catch(() => null)
    if (!body || !Array.isArray(body.respuestas)) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 })
    }

    await connectDB()

    const encuesta = await Encuesta.findById(id).lean()
    if (!encuesta) {
      return NextResponse.json({ error: "Encuesta no encontrada." }, { status: 404 })
    }
    if (encuesta.estado !== "publicada") {
      return NextResponse.json({ error: "Esta encuesta aún no está publicada." }, { status: 400 })
    }

    const errores = validarRespuestas(encuesta.preguntas, body.respuestas)
    if (errores.length > 0) {
      return NextResponse.json({ error: errores.join(" ") }, { status: 400 })
    }

    const cookieStore = await cookies()
    let vid = cookieStore.get("vid")?.value ?? null
    const ipHash = hashIp(obtenerIp(request))
    const voterId = vid ?? ipHash

    const yaVoto = vid
      ? await Voto.exists({ encuestaId: encuesta._id, $or: [{ voterId: vid }, { ipHash }] })
      : await Voto.exists({ encuestaId: encuesta._id, voterId: ipHash })
    if (yaVoto) {
      return NextResponse.json({ error: "Ya has votado en esta encuesta." }, { status: 409 })
    }

    const respuestas = body.respuestas.map((r: { preguntaId: unknown; valor: unknown }) => ({
      preguntaId: String(r.preguntaId),
      valor: r.valor,
    }))

    try {
      await Voto.create({ encuestaId: encuesta._id, voterId, ipHash, respuestas })
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code: number }).code === 11000) {
        return NextResponse.json({ error: "Ya has votado en esta encuesta." }, { status: 409 })
      }
      throw error
    }

    await Encuesta.updateOne({ _id: encuesta._id }, { $inc: { votos: 1 } })

    const response = NextResponse.json({
      ok: true,
      resultados: computarResultados(encuesta.preguntas, [
        { respuestas, encuestaId: encuesta._id, voterId, ipHash } as never,
      ]),
      totalVotos: encuesta.votos + 1,
    })

    if (!vid) {
      vid = randomUUID()
      response.cookies.set("vid", vid, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      })
    }

    return response
  } catch (error) {
    console.error("Error al registrar voto:", error)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}

function validarRespuestas(
  preguntas: Array<{
    _id: { toString(): string }
    texto: string
    tipoPregunta: string
    opciones: string[]
    config: { min: number | null; max: number | null }
    requerida: boolean
  }>,
  respuestas: unknown[]
) {
  const errores: string[] = []

  for (const pregunta of preguntas) {
    const respuesta = respuestas.find((r) => {
      const row = r as { preguntaId?: unknown }
      return row?.preguntaId === pregunta._id.toString()
    }) as { valor?: unknown } | undefined

    const valor = respuesta?.valor

    if (valor === undefined || valor === null || valor === "") {
      if (pregunta.requerida) {
        errores.push(`La pregunta "${pregunta.texto}" es obligatoria.`)
      }
      continue
    }

    if (pregunta.tipoPregunta === "numerico") {
      const numero = Number(valor)
      if (!Number.isFinite(numero)) {
        errores.push(`La pregunta "${pregunta.texto}" debe ser un número.`)
      } else {
        if (pregunta.config.min !== null && numero < pregunta.config.min) {
          errores.push(`La pregunta "${pregunta.texto}" no puede ser menor a ${pregunta.config.min}.`)
        }
        if (pregunta.config.max !== null && numero > pregunta.config.max) {
          errores.push(`La pregunta "${pregunta.texto}" no puede ser mayor a ${pregunta.config.max}.`)
        }
      }
      continue
    }

    if (pregunta.tipoPregunta === "verdadero_falso") {
      if (valor !== true && valor !== false) {
        errores.push(`La pregunta "${pregunta.texto}" tiene una respuesta no válida.`)
      }
      continue
    }

    if (esTipoConOpciones(pregunta.tipoPregunta)) {
      const valores = Array.isArray(valor) ? (valor as unknown[]) : [valor]
      for (const v of valores) {
        if (!pregunta.opciones.includes(String(v))) {
          errores.push(`La pregunta "${pregunta.texto}" tiene una opción no válida.`)
          break
        }
      }
      if (pregunta.tipoPregunta === "seleccion_unica" && Array.isArray(valor) && valor.length > 1) {
        errores.push(`La pregunta "${pregunta.texto}" solo admite una opción.`)
      }
    }
  }

  return errores
}
