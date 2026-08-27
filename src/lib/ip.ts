import { createHash } from "node:crypto"

export function hashIp(ip: string): string {
  return createHash("sha256").update(`pa-encuestas::${ip}`).digest("hex")
}

export function obtenerIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp
  return "desconocida"
}
