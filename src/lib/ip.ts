import { createHash } from "node:crypto"

export function hashIp(ip: string): string {
  return createHash("sha256").update(`pa-encuestas::${ip}`).digest("hex")
}

type ObtenerHeader = (nombre: string) => string | null | undefined

function esIpLocal(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip === "localhost" ||
    ip === "0.0.0.0" ||
    ip === "desconocida"
  )
}

export function obtenerIpDeHeaders(obtenerHeader: ObtenerHeader): string | null {
  const forwarded = obtenerHeader("x-forwarded-for")
  const candidata = forwarded ? forwarded.split(",")[0].trim() : obtenerHeader("x-real-ip")?.trim()
  if (!candidata || esIpLocal(candidata)) return null
  return candidata
}

export function obtenerIp(request: Request): string | null {
  return obtenerIpDeHeaders((nombre) => request.headers.get(nombre))
}
