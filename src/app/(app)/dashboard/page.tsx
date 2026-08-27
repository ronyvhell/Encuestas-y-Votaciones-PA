import Link from "next/link"
import { notFound } from "next/navigation"

import { connectDB } from "@/lib/db"
import { Encuesta, SurveyType, Voto } from "@/lib/models"
import { auth } from "@/auth"
import { QuickPublish } from "@/components/quick-publish"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  ClipboardListIcon,
  FilePlusIcon,
  FileCheckIcon,
  ListChecksIcon,
  TagsIcon,
} from "lucide-react"

export const dynamic = "force-dynamic"

function fechaCorta(fecha: Date) {
  return fecha.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) {
    notFound()
  }

  await connectDB()

  const [totalEncuestas, totalPublicadas, totalBorradores, totalVotos, totalTipos, recientes] =
    await Promise.all([
      Encuesta.countDocuments(),
      Encuesta.countDocuments({ estado: "publicada" }),
      Encuesta.countDocuments({ estado: "borrador" }),
      Voto.countDocuments(),
      SurveyType.countDocuments(),
      Encuesta.find({ creador: session.user.id })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ])

  const estadisticas = [
    { etiqueta: "Encuestas", valor: totalEncuestas, icono: ClipboardListIcon },
    { etiqueta: "Publicadas", valor: totalPublicadas, icono: FileCheckIcon },
    { etiqueta: "Borradores", valor: totalBorradores, icono: FilePlusIcon },
    { etiqueta: "Votos registrados", valor: totalVotos, icono: ListChecksIcon },
    { etiqueta: "Tipos de encuesta", valor: totalTipos, icono: TagsIcon },
  ]

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Resumen general de la plataforma.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {estadisticas.map((stat) => (
          <Card key={stat.etiqueta}>
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <stat.icono className="size-4" />
                <span className="text-xs">{stat.etiqueta}</span>
              </div>
              <span className="font-heading text-2xl font-semibold tabular-nums">{stat.valor}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">Tus encuestas recientes</CardTitle>
            <CardDescription>Las últimas 5 encuestas que has creado.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recientes.length === 0 ? (
            <Empty className="border-0">
              <EmptyMedia variant="icon">
                <ClipboardListIcon />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>Aún no tienes encuestas</EmptyTitle>
                <EmptyDescription>
                  Crea tu primera encuesta y aparecerá aquí.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y">
              {recientes.map((encuesta) => (
                <li key={encuesta._id.toString()}>
                  <Link
                    href={`/encuestas/${encuesta._id.toString()}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-sm font-medium">{encuesta.titulo}</span>
                      <span className="text-xs text-muted-foreground">
                        {encuesta.preguntas.length} preguntas · {encuesta.votos} votos ·{" "}
                        {fechaCorta(encuesta.createdAt)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {encuesta.estado === "borrador" && (
                        <QuickPublish encuestaId={encuesta._id.toString()} />
                      )}
                      <Badge variant={encuesta.estado === "publicada" ? "default" : "secondary"}>
                        {encuesta.estado === "publicada" ? "Publicada" : "Borrador"}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
