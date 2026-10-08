import { notFound } from "next/navigation"
import Link from "next/link"
import { cookies, headers } from "next/headers"

import { connectDB } from "@/lib/db"
import { Encuesta, Voto } from "@/lib/models"
import { computarResultados } from "@/lib/results"
import { hashIp, obtenerIpDeHeaders } from "@/lib/ip"
import { auth } from "@/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SurveyRender } from "@/components/survey-render"
import { VoteForm } from "@/components/vote-form"
import { SurveyAdmin } from "@/components/survey-admin"
import { ArrowLeftIcon, CheckCircle2Icon, InfoIcon } from "lucide-react"
import type { EncuestaUI } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function DetalleEncuestaPage({ params }: PageProps<"/encuestas/[id]">) {
  const { id } = await params

  await connectDB()

  const encuesta = await Encuesta.findById(id).populate("tipos", "nombre").lean()
  if (!encuesta) {
    notFound()
  }

  const session = await auth()
  const esPropietario = session?.user?.id === encuesta.creador.toString()

  if (encuesta.estado !== "publicada" && !esPropietario) {
    notFound()
  }

  const cookieStore = await cookies()
  const vid = cookieStore.get("vid")?.value ?? null

  const headerStore = await headers()
  const ip = obtenerIpDeHeaders((nombre) => headerStore.get(nombre))
  const ipHash = ip ? hashIp(ip) : ""

  const duplicados: Record<string, unknown>[] = []
  if (vid) duplicados.push({ voterId: vid })
  if (ipHash) duplicados.push({ ipHash })
  const yaVoto =
    duplicados.length > 0
      ? await Voto.exists({ encuestaId: encuesta._id, $or: duplicados })
      : null

  const datos: EncuestaUI = {
    _id: encuesta._id.toString(),
    titulo: encuesta.titulo,
    descripcion: encuesta.descripcion,
    imagenPortada: encuesta.imagenPortada,
    estado: encuesta.estado,
    tipos: (encuesta.tipos as { _id: string; nombre: string }[]).map((t) => ({
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
    hasVoted: !!yaVoto,
    esPropietario,
  }

  const resultados = yaVoto || esPropietario
    ? computarResultados(encuesta.preguntas, await Voto.find({ encuestaId: encuesta._id }).lean())
    : null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {esPropietario && (
        <div className="flex flex-col gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            nativeButton={false}
            render={<Link href="/encuestas" />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Volver
          </Button>
          <SurveyAdmin encuestaId={datos._id} estado={datos.estado} />
        </div>
      )}

      {yaVoto || esPropietario ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 rounded-2xl border bg-muted/40 px-4 py-3">
            {esPropietario ? (
              <InfoIcon className="size-4 text-primary" />
            ) : (
              <CheckCircle2Icon className="size-4 text-primary" />
            )}
            <p className="text-sm">
              {esPropietario
                ? "Eres el creador de esta encuesta, así que no puedes votar en ella. Estos son los resultados hasta ahora."
                : "Ya participaste en esta encuesta. Estos son los resultados hasta ahora."}
            </p>
          </div>
          <SurveyRender encuesta={datos} mode="results" resultados={resultados ?? undefined} />
        </div>
      ) : (
        <VoteForm encuesta={datos} />
      )}

      {datos.estado === "borrador" && esPropietario && (
        <Badge variant="secondary" className="w-fit">Borrador — solo tú puedes verla</Badge>
      )}
    </div>
  )
}
