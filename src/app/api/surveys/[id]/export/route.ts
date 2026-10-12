import { NextResponse } from "next/server"

import { connectDB } from "@/lib/db"
import { Encuesta, Voto, type IPregunta, type IVoto } from "@/lib/models"
import { aplanarVotos, generarArff, generarCsv, slugTitulo } from "@/lib/export-datos"
import { auth } from "@/auth"

// Exporta los votos de una encuesta en CSV (tablero) o ARFF (Weka).
// Restringido al creador de la encuesta: los datos de otros usuarios no se exportan.
export async function GET(request: Request, ctx: RouteContext<"/api/surveys/[id]/export">) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 })
  }

  const { id } = await ctx.params
  const { searchParams } = new URL(request.url)
  const formato = (searchParams.get("formato") ?? "csv").toLowerCase()

  try {
    await connectDB()

    const encuesta = await Encuesta.findById(id).lean()
    if (!encuesta) {
      return NextResponse.json({ error: "Encuesta no encontrada." }, { status: 404 })
    }
    if (encuesta.creador.toString() !== session.user.id) {
      return NextResponse.json(
        { error: "Solo el creador de la encuesta puede exportar sus datos." },
        { status: 403 }
      )
    }

    const votos = await Voto.find({ encuestaId: encuesta._id }).lean()
    const { columnas, filas } = aplanarVotos(
      encuesta.preguntas as unknown as IPregunta[],
      votos as unknown as IVoto[]
    )

    const nombre = slugTitulo(encuesta.titulo)

    if (formato === "arff") {
      const contenido = generarArff(encuesta.titulo, columnas, filas)
      return new NextResponse(contenido, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${nombre}.arff"`,
        },
      })
    }

    // CSV con BOM UTF-8 para que Excel muestre bien los acentos.
    const contenido = generarCsv(columnas, filas)
    return new NextResponse("\uFEFF" + contenido, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nombre}.csv"`,
      },
    })
  } catch (error) {
    console.error("Error al exportar encuesta:", error)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}
