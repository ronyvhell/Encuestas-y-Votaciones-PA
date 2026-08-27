"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { sileo } from "sileo"

import { Button } from "@/components/ui/button"
import { RocketIcon } from "lucide-react"

export function QuickPublish({ encuestaId }: { encuestaId: string }) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)

  async function publicar() {
    setCargando(true)
    try {
      const res = await fetch(`/api/surveys/${encuestaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "publicada" }),
      })
      if (res.ok) {
        sileo.success({
          title: "Encuesta publicada",
          description: "Ya está visible para que la voten.",
        })
        router.refresh()
        return
      }
      const datos = await res.json().catch(() => null)
      sileo.warning({
        title: "No se pudo publicar",
        description: datos?.error ?? "Intenta de nuevo.",
      })
    } catch {
      sileo.error({ title: "Error inesperado" })
    } finally {
      setCargando(false)
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={publicar} disabled={cargando}>
      <RocketIcon data-icon="inline-start" />
      {cargando ? "Publicando..." : "Publicar"}
    </Button>
  )
}
