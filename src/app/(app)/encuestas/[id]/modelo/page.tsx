import Link from "next/link"
import { notFound } from "next/navigation"

import { connectDB } from "@/lib/db"
import { Encuesta, Modelo, Voto } from "@/lib/models"
import { construirDatosPagina } from "@/lib/modelo/pagina"
import { auth } from "@/auth"
import { ModeloPanel } from "@/components/modelo/modelo-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function ModeloEncuestaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth()
  if (!session?.user?.id) notFound()

  await connectDB()

  const encuesta = await Encuesta.findById(id).lean()
  if (!encuesta || encuesta.creador.toString() !== session.user.id) notFound()

  const [votos, modelos] = await Promise.all([
    Voto.find({ encuestaId: encuesta._id }).sort({ createdAt: 1 }).lean(),
    Modelo.find({ encuestaId: encuesta._id }).sort({ version: -1 }).lean(),
  ])

  const datos = construirDatosPagina({
    encuesta: {
      _id: encuesta._id,
      titulo: encuesta.titulo,
      preguntas: encuesta.preguntas,
    },
    votos,
    modelos,
  })

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          nativeButton={false}
          render={<Link href={`/encuestas/${id}`} />}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a la encuesta
        </Button>

        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Modelo predictivo
            </h1>
            <Badge variant="secondary">{encuesta.titulo}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Entrena el modelo con los votos de esta encuesta, revisa sus métricas y prueba
            predicciones sin salir de la aplicación.
          </p>
        </div>
      </div>

      <ModeloPanel datos={datos} />
    </div>
  )
}
