import { notFound } from "next/navigation"

import { connectDB } from "@/lib/db"
import { Encuesta } from "@/lib/models"
import { auth } from "@/auth"
import { CreateSurveyForm } from "@/components/create-survey-form"
import type { EncuestaUI } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function EditarEncuestaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  await connectDB()

  const encuesta = await Encuesta.findById(id).populate("tipos", "nombre").lean()
  if (!encuesta) {
    notFound()
  }

  const session = await auth()
  if (session?.user?.id !== encuesta.creador.toString()) {
    notFound()
  }

  const datos: EncuestaUI = {
    _id: encuesta._id.toString(),
    titulo: encuesta.titulo,
    descripcion: encuesta.descripcion,
    imagenPortada: encuesta.imagenPortada,
    estado: encuesta.estado,
    tipos: (encuesta.tipos as { _id: { toString(): string }; nombre: string }[]).map((t) => ({
      _id: t._id.toString(),
      nombre: t.nombre,
    })),
    preguntas: encuesta.preguntas.map((p: { _id: { toString(): string }; texto: string; tipoPregunta: string; opciones: string[]; config: { min: number | null; max: number | null }; requerida: boolean }) => ({
      _id: p._id.toString(),
      texto: p.texto,
      tipoPregunta: p.tipoPregunta,
      opciones: p.opciones,
      config: { min: p.config.min ?? null, max: p.config.max ?? null },
      requerida: p.requerida,
    })),
    votos: encuesta.votos,
  }

  return <CreateSurveyForm encuesta={datos} />
}
