import { connectDB } from "@/lib/db"
import { Encuesta } from "@/lib/models"
import { SurveyCard } from "@/components/survey-card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { auth } from "@/auth"
import { ClipboardListIcon, SearchXIcon } from "lucide-react"
import type { EncuestaListaUI } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function EncuestasPage({ searchParams }: PageProps<"/encuestas">) {
  const query = await searchParams
  const q = typeof query.q === "string" ? query.q.trim() : ""

  await connectDB()

  const session = await auth()

  const filtro: Record<string, unknown> = {
    $or: [{ estado: "publicada" }],
  }
  if (session?.user?.id) {
    filtro.$or = [{ estado: "publicada" }, { creador: session.user.id }]
  }
  if (q) {
    filtro.$and = [
      {
        $or: [
          { titulo: { $regex: q, $options: "i" } },
          { descripcion: { $regex: q, $options: "i" } },
        ],
      },
    ]
  }

  const encuestas = await Encuesta.find(filtro)
    .populate("tipos", "nombre")
    .sort({ createdAt: -1 })
    .lean()

  const datos: EncuestaListaUI[] = encuestas.map((e) => ({
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
    createdAt: e.createdAt.toISOString(),
  }))

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Encuestas</h1>
        <p className="text-sm text-muted-foreground">
          {q ? (
            <>
              Resultados para <span className="font-medium text-foreground">“{q}”</span>
            </>
          ) : session?.user?.id ? (
            "Encuestas publicadas y tus borradores."
          ) : (
            "Encuestas publicadas disponibles para responder."
          )}
        </p>
      </div>

      {datos.length === 0 ? (
        <Empty className="border">
          <EmptyMedia variant="icon">
            {q ? <SearchXIcon /> : <ClipboardListIcon />}
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>{q ? "Sin resultados" : "No hay encuestas"}</EmptyTitle>
            <EmptyDescription>
              {q
                ? "Prueba con otro término de búsqueda."
                : session?.user?.id
                  ? "Crea una encuesta y publícala para que aparezca aquí."
                  : "Cuando alguien publique una encuesta, aparecerá aquí."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent />
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {datos.map((encuesta) => (
            <SurveyCard key={encuesta._id} encuesta={encuesta} />
          ))}
        </div>
      )}
    </div>
  )
}
