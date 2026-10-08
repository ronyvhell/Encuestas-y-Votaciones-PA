import Link from "next/link"
import { notFound } from "next/navigation"

import { connectDB } from "@/lib/db"
import { Encuesta, SurveyType, Voto } from "@/lib/models"
import { auth } from "@/auth"
import { QuickPublish } from "@/components/quick-publish"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  ActivityIcon,
  ArrowUpRightIcon,
  BarChart3Icon,
  ClipboardListIcon,
  FileCheckIcon,
  FilePlusIcon,
  ListChecksIcon,
  TagsIcon,
  TrendingUpIcon,
} from "lucide-react"

export const dynamic = "force-dynamic"

function fechaCorta(fecha: Date) {
  return fecha.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })
}

function tiempoRelativo(fecha: Date) {
  const diff = Date.now() - new Date(fecha).getTime()
  const minutos = Math.floor(diff / 60000)
  if (minutos < 1) return "hace un momento"
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias < 30) return `hace ${dias} d`
  return fechaCorta(fecha)
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) {
    notFound()
  }

  await connectDB()

  const [
    totalEncuestas,
    totalPublicadas,
    totalBorradores,
    totalVotos,
    totalTipos,
    recientes,
    topEncuestas,
    ultimosVotos,
  ] = await Promise.all([
    Encuesta.countDocuments(),
    Encuesta.countDocuments({ estado: "publicada" }),
    Encuesta.countDocuments({ estado: "borrador" }),
    Voto.countDocuments(),
    SurveyType.countDocuments(),
    Encuesta.find({ creador: session.user.id }).sort({ createdAt: -1 }).limit(5).lean(),
    Encuesta.find({ estado: "publicada" }).sort({ votos: -1 }).limit(5).select("titulo votos").lean(),
    Voto.find().sort({ createdAt: -1 }).limit(6).populate("encuestaId", "titulo").lean(),
  ])

  const nombre = session.user.name?.split(" ")[0]
  const pctPublicadas = totalEncuestas > 0 ? Math.round((totalPublicadas / totalEncuestas) * 100) : 0
  const promedioVotos = totalEncuestas > 0 ? (totalVotos / totalEncuestas).toFixed(1) : "0"
  const maxVotos = topEncuestas[0]?.votos ?? 0

  const votosRecientes = ultimosVotos as unknown as Array<{
    _id: { toString(): string }
    createdAt: Date
    encuestaId: { _id: { toString(): string }; titulo: string } | null
  }>

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
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Hola{nombre ? `, ${nombre}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Resumen general de la plataforma y de tu actividad.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {estadisticas.map((stat) => (
          <Card key={stat.etiqueta} className="py-4">
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">{stat.etiqueta}</span>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <stat.icono className="size-4" />
                </div>
              </div>
              <span className="font-heading text-2xl font-semibold tabular-nums">{stat.valor}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUpIcon className="size-4 text-muted-foreground" />
                Encuestas con más participación
              </CardTitle>
              <CardDescription>Las encuestas publicadas con más votos.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {topEncuestas.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aún no hay encuestas publicadas.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {topEncuestas.map((encuesta) => (
                  <Link
                    key={encuesta._id.toString()}
                    href={`/encuestas/${encuesta._id.toString()}`}
                    className="flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{encuesta.titulo}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {encuesta.votos} {encuesta.votos === 1 ? "voto" : "votos"}
                      </span>
                    </div>
                    <Progress value={maxVotos > 0 ? (encuesta.votos / maxVotos) * 100 : 0} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3Icon className="size-4 text-muted-foreground" />
              Estado de las encuestas
            </CardTitle>
            <CardDescription>Distribución y promedio de participación.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Publicadas</span>
                <span className="tabular-nums font-medium">
                  {totalPublicadas} · {pctPublicadas}%
                </span>
              </div>
              <Progress value={pctPublicadas} />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Borradores</span>
                <span className="tabular-nums font-medium">
                  {totalBorradores} · {totalEncuestas > 0 ? 100 - pctPublicadas : 0}%
                </span>
              </div>
              <Progress value={totalEncuestas > 0 ? 100 - pctPublicadas : 0} />
            </div>
            <div className="flex items-center justify-between rounded-2xl border bg-muted/40 px-4 py-3">
              <span className="text-sm text-muted-foreground">Promedio de votos</span>
              <span className="font-heading text-lg font-semibold tabular-nums">{promedioVotos}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">Tus encuestas recientes</CardTitle>
              <CardDescription>Las últimas 5 encuestas que has creado.</CardDescription>
            </div>
            <Link
              href="/encuestas"
              className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Ver todas
              <ArrowUpRightIcon className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recientes.length === 0 ? (
              <Empty className="border-0">
                <EmptyMedia variant="icon">
                  <ClipboardListIcon />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>Aún no tienes encuestas</EmptyTitle>
                  <EmptyDescription>Crea tu primera encuesta y aparecerá aquí.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="divide-y">
                {recientes.map((encuesta) => (
                  <li key={encuesta._id.toString()}>
                    <Link
                      href={`/encuestas/${encuesta._id.toString()}`}
                      className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-muted/50"
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ActivityIcon className="size-4 text-muted-foreground" />
              Actividad reciente
            </CardTitle>
            <CardDescription>Los últimos votos registrados en la plataforma.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {votosRecientes.length === 0 ? (
              <Empty className="border-0">
                <EmptyMedia variant="icon">
                  <ListChecksIcon />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>Sin actividad todavía</EmptyTitle>
                  <EmptyDescription>Los votos aparecerán aquí en cuanto ocurran.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="divide-y">
                {votosRecientes.map((voto) => (
                  <li
                    key={voto._id.toString()}
                    className="flex items-center justify-between gap-4 px-5 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <ListChecksIcon className="size-4" />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">
                          {voto.encuestaId?.titulo ?? "Encuesta eliminada"}
                        </span>
                        <span className="text-xs text-muted-foreground">Nuevo voto registrado</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {tiempoRelativo(voto.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
