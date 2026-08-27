import Link from "next/link"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CoverImage } from "@/components/cover-image"
import { ListChecksIcon, MessageSquareIcon } from "lucide-react"
import type { EncuestaListaUI } from "@/lib/types"

function fechaCorta(fecha: string) {
  return new Date(fecha).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function SurveyCard({ encuesta }: { encuesta: EncuestaListaUI }) {
  const esBorrador = encuesta.estado === "borrador"

  return (
    <Link href={`/encuestas/${encuesta._id}`} className="block h-full">
      <Card className="group h-full overflow-hidden transition-shadow hover:shadow-md">
        <CardContent className="p-0">
          {encuesta.imagenPortada ? (
            <div className="relative">
              <CoverImage
                src={encuesta.imagenPortada}
                alt={encuesta.titulo}
                className="aspect-video w-full object-cover"
              />
              {esBorrador && <Badge className="absolute top-3 left-3">Borrador</Badge>}
            </div>
          ) : (
            <div className="relative flex aspect-video w-full items-center justify-center bg-muted">
              <ListChecksIcon className="size-8 text-muted-foreground/40" />
              {esBorrador && <Badge className="absolute top-3 left-3">Borrador</Badge>}
            </div>
          )}
          <CardHeader className="gap-1.5 p-4 pb-2">
            <CardTitle className="line-clamp-1 text-base">{encuesta.titulo}</CardTitle>
            {encuesta.descripcion && (
              <CardDescription className="line-clamp-2">{encuesta.descripcion}</CardDescription>
            )}
          </CardHeader>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-2 p-4 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {encuesta.tipos.length > 0 ? (
              encuesta.tipos.slice(0, 3).map((tipo) => (
                <Badge key={tipo._id} variant="secondary" className="text-xs">
                  {tipo.nombre}
                </Badge>
              ))
            ) : (
              <Badge variant="outline" className="text-xs">Sin tipo</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquareIcon className="size-3.5" />
              {encuesta.preguntas} preg.
            </span>
            <span className="flex items-center gap-1">
              <ListChecksIcon className="size-3.5" />
              {encuesta.votos} votos
            </span>
            <span>{fechaCorta(encuesta.createdAt)}</span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  )
}
