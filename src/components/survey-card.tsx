import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CoverImage } from "@/components/cover-image"
import { cn } from "@/lib/utils"
import { ListChecksIcon, MessageSquareIcon } from "lucide-react"
import type { EncuestaListaUI } from "@/lib/types"

function fechaCorta(fecha: string) {
  return new Date(fecha).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function SurveyCard({
  encuesta,
  modoSeleccion = false,
  seleccionada = false,
}: {
  encuesta: EncuestaListaUI
  modoSeleccion?: boolean
  seleccionada?: boolean
}) {
  const esBorrador = encuesta.estado === "borrador"

  return (
    <Link href={`/encuestas/${encuesta._id}`} className="group block h-full">
      <Card
        className={cn(
          "h-full gap-0 overflow-hidden py-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-lg hover:shadow-foreground/5",
          seleccionada && "border-primary/60 ring-2 ring-primary"
        )}
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          {encuesta.imagenPortada ? (
            <CoverImage
              src={encuesta.imagenPortada}
              alt={encuesta.titulo}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/40">
              <ListChecksIcon className="size-8 text-muted-foreground/40" />
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />

          {esBorrador && (
            <Badge className="absolute top-3 left-3 border-transparent bg-background/90 text-foreground backdrop-blur-sm">
              Borrador
            </Badge>
          )}
          {!modoSeleccion && encuesta.tipos[0] && (
            <Badge
              variant="secondary"
              className="absolute top-3 right-3 border-transparent bg-background/90 text-foreground backdrop-blur-sm"
            >
              {encuesta.tipos[0].nombre}
            </Badge>
          )}
        </div>

        <CardHeader className="gap-1.5 p-5 pb-2">
          <CardTitle className="line-clamp-1 text-base font-medium">{encuesta.titulo}</CardTitle>
          <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
            {encuesta.descripcion || "Sin descripción."}
          </p>
        </CardHeader>

        <CardContent className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 p-5 pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MessageSquareIcon className="size-3.5" />
            {encuesta.preguntas} preg.
          </span>
          <span className="flex items-center gap-1.5">
            <ListChecksIcon className="size-3.5" />
            {encuesta.votos} {encuesta.votos === 1 ? "voto" : "votos"}
          </span>
          <span className="ml-auto">{fechaCorta(encuesta.createdAt)}</span>
        </CardContent>
      </Card>
    </Link>
  )
}
