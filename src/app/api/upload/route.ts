import { NextResponse } from "next/server"
import { writeFile, mkdir } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import path from "node:path"

import { auth } from "@/auth"

const MIMES_PERMITIDOS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
}

const TAMANO_MAXIMO = 5 * 1024 * 1024

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const archivo = formData.get("archivo")

    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 })
    }

    const mime = archivo.type
    if (!MIMES_PERMITIDOS[mime]) {
      return NextResponse.json(
        { error: "Formato no permitido. Usa PNG, JPG, WEBP o GIF." },
        { status: 400 }
      )
    }

    if (archivo.size > TAMANO_MAXIMO) {
      return NextResponse.json({ error: "La imagen no puede superar los 5 MB." }, { status: 400 })
    }

    const buffer = Buffer.from(await archivo.arrayBuffer())
    const nombreArchivo = `${randomUUID()}${MIMES_PERMITIDOS[mime]}`
    const directorio = path.join(process.cwd(), "public", "uploads")
    const ruta = path.join(directorio, nombreArchivo)

    await mkdir(directorio, { recursive: true })
    await writeFile(ruta, buffer)

    return NextResponse.json({ url: `/uploads/${nombreArchivo}` }, { status: 201 })
  } catch (error) {
    console.error("Error al subir imagen:", error)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}
