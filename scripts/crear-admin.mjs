// Crea (o actualiza la contraseña de) un usuario para entrar a la app.
// Uso: node scripts/crear-admin.mjs --email=tu@correo.com --password=xxxxxx [--nombre="Admin"]
// Usa MONGODB_URI (env o .env.local). Para Atlas define SEED_REMOTO=1.
import { existsSync } from "node:fs"
import mongoose from "mongoose"
import bcrypt from "bcryptjs"

if (existsSync(".env.local") && !process.env.MONGODB_URI) process.loadEnvFile(".env.local")

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const email = (arg("email") ?? "").trim().toLowerCase()
const password = arg("password") ?? ""
const nombre = (arg("nombre") ?? "Administrador").trim()

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) {
  console.error("Uso: --email=correo --password=minimo6 [--nombre=Nombre]")
  process.exit(1)
}
const uri = process.env.MONGODB_URI
if (!uri) { console.error("Falta MONGODB_URI."); process.exit(1) }
if (!/127\.0\.0\.1|localhost/.test(uri) && process.env.SEED_REMOTO !== "1") {
  console.error("URI remota. Define SEED_REMOTO=1 para continuar."); process.exit(1)
}

await mongoose.connect(uri)
const users = mongoose.connection.db.collection("users")
const passwordHash = await bcrypt.hash(password, 10)
const ahora = new Date()
const r = await users.updateOne(
  { email },
  { $set: { nombre, passwordHash, updatedAt: ahora }, $setOnInsert: { email, createdAt: ahora, __v: 0 } },
  { upsert: true }
)
console.log(r.upsertedCount ? `Usuario creado: ${email}` : `Usuario existente, contraseña actualizada: ${email}`)
await mongoose.disconnect()
