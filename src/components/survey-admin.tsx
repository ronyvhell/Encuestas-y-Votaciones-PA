"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { sileo } from "sileo"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { RocketIcon, Trash2Icon, Undo2Icon } from "lucide-react"

export function SurveyAdmin({
  encuestaId,
  estado,
}: {
  encuestaId: string
  estado: string
}) {
  const router = useRouter()
  const [cambiando, setCambiando] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const publicada = estado === "publicada"

  async function cambiarEstado() {
    setCambiando(true)
    try {
      const res = await fetch(`/api/surveys/${encuestaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: publicada ? "borrador" : "publicada" }),
      })
      const datos = await res.json().catch(() => null)

      if (res.ok) {
        sileo.success({
          title: publicada ? "Encuesta despublicada" : "Encuesta publicada",
          description: publicada
            ? "Ya no está visible para votar."
            : "Ya está visible para que la voten.",
        })
        router.refresh()
        return
      }
      sileo.warning({ title: "No se pudo cambiar el estado", description: datos?.error })
    } catch {
      sileo.error({ title: "Error inesperado" })
    } finally {
      setCambiando(false)
    }
  }

  async function eliminar() {
    setEliminando(true)
    try {
      const res = await fetch(`/api/surveys/${encuestaId}`, { method: "DELETE" })
      if (res.ok) {
        sileo.success({ title: "Encuesta eliminada" })
        router.push("/encuestas")
        router.refresh()
        return
      }
      const datos = await res.json().catch(() => null)
      sileo.warning({ title: "No se pudo eliminar", description: datos?.error })
    } catch {
      sileo.error({ title: "Error inesperado" })
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {publicada ? (
        <Badge variant="default">Publicada</Badge>
      ) : (
        <Badge variant="secondary">Borrador</Badge>
      )}

      <Button size="sm" variant={publicada ? "outline" : "default"} onClick={cambiarEstado} disabled={cambiando}>
        {publicada ? (
          <>
            <Undo2Icon data-icon="inline-start" />
            {cambiando ? "Cambiando..." : "Despublicar"}
          </>
        ) : (
          <>
            <RocketIcon data-icon="inline-start" />
            {cambiando ? "Cambiando..." : "Publicar"}
          </>
        )}
      </Button>

      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              <Trash2Icon data-icon="inline-start" />
              Eliminar
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta encuesta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán la encuesta y todos sus votos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={eliminar} disabled={eliminando}>
              {eliminando ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
