import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

import { connectDB } from "@/lib/db"
import { User } from "@/lib/models"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 })
    }

    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : ""
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body.password === "string" ? body.password : ""
    const confirmar = typeof body.confirmar === "string" ? body.confirmar : ""

    if (!nombre || nombre.length < 2) {
      return NextResponse.json({ error: "El nombre debe tener al menos 2 caracteres." }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Correo electrónico no válido." }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 })
    }
    if (password !== confirmar) {
      return NextResponse.json({ error: "Las contraseñas no coinciden." }, { status: 400 })
    }

    await connectDB()

    const existente = await User.findOne({ email })
    if (existente) {
      return NextResponse.json({ error: "Ya existe una cuenta con ese correo." }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await User.create({ nombre, email, passwordHash })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error("Error al registrar usuario:", error)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}
