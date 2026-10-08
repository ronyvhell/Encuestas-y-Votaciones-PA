"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { sileo } from "sileo"

import { SurveyCard } from "@/components/survey-card"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CheckIcon, CheckSquareIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EncuestaListaUI } from "@/lib/types"

export function SurveyGrid({ encuestas }: { encuestas: EncuestaListaUI[] }) {
  const router = useRouter()
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const propias = encuestas.filter((e) => e.esPropietario)

  function entrarSeleccion(id: string) {
    setModoSeleccion(true)
    setSeleccionados((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  function alternar(id: string) {
    setSeleccionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function salirSeleccion() {
    setModoSeleccion(false)
    setSeleccionados([])
  }

  function editar() {
    if (seleccionados.length !== 1) return
    router.push(`/encuestas/${seleccionados[0]}/editar`)
  }

  async function eliminar() {
    setEliminando(true)
    try {
      const res = await fetch("/api/surveys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: seleccionados }),
      })
      const datos = await res.json().catch(() => null)

      if (!res.ok) {
        sileo.warning({
          title: "No se pudieron eliminar",
          description: datos?.error ?? "Intenta de nuevo.",
        })
        return
      }

      const total = datos?.eliminadas ?? seleccionados.length
      sileo.success({
        title: total === 1 ? "Encuesta eliminada" : "Encuestas eliminadas",
        description: total === 1 ? "La encuesta y sus votos fueron eliminados." : `${total} encuestas y sus votos fueron eliminados.`,
      })
      setConfirmarEliminar(false)
      salirSeleccion()
      router.refresh()
    } catch {
      sileo.error({ title: "Error inesperado", description: "No se pudieron eliminar las encuestas." })
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {propias.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {modoSeleccion
              ? seleccionados.length > 0
                ? `${seleccionados.length} seleccionada${seleccionados.length === 1 ? "" : "s"}`
                : "Toca tus encuestas para seleccionarlas."
              : "Mantén presionada una encuesta tuya para seleccionarla."}
          </p>
          {modoSeleccion ? (
            <Button variant="ghost" size="sm" onClick={salirSeleccion}>
              <XIcon data-icon="inline-start" />
              Cancelar
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setModoSeleccion(true)}>
              <CheckSquareIcon data-icon="inline-start" />
              Seleccionar
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {encuestas.map((encuesta) => {
          const seleccionable = !!encuesta.esPropietario
          return (
            <TarjetaSeleccionable
              key={encuesta._id}
              encuesta={encuesta}
              seleccionable={seleccionable}
              modoSeleccion={modoSeleccion}
              seleccionada={seleccionados.includes(encuesta._id)}
              onEntrar={entrarSeleccion}
              onAlternar={alternar}
            />
          )
        })}
      </div>

      {seleccionados.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border bg-background/95 p-1.5 pl-4 shadow-lg backdrop-blur">
            <span className="text-sm font-medium tabular-nums">
              {seleccionados.length} seleccionada{seleccionados.length === 1 ? "" : "s"}
            </span>
            <div className="mx-1 h-6 w-px bg-border" />
            <Button size="sm" variant="ghost" onClick={editar} disabled={seleccionados.length !== 1}>
              <PencilIcon data-icon="inline-start" />
              Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmarEliminar(true)}
            >
              <Trash2Icon data-icon="inline-start" />
              Eliminar
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={salirSeleccion} aria-label="Cancelar selección">
              <XIcon />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmarEliminar} onOpenChange={setConfirmarEliminar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar{" "}
              {seleccionados.length === 1
                ? "esta encuesta"
                : `estas ${seleccionados.length} encuestas`}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán las encuestas seleccionadas y todos sus votos. Esta acción no se puede
              deshacer.
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

function TarjetaSeleccionable({
  encuesta,
  seleccionable,
  modoSeleccion,
  seleccionada,
  onEntrar,
  onAlternar,
}: {
  encuesta: EncuestaListaUI
  seleccionable: boolean
  modoSeleccion: boolean
  seleccionada: boolean
  onEntrar: (id: string) => void
  onAlternar: (id: string) => void
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const presionLarga = useRef(false)

  function iniciarPresion() {
    if (!seleccionable) return
    presionLarga.current = false
    timer.current = setTimeout(() => {
      presionLarga.current = true
      onEntrar(encuesta._id)
    }, 500)
  }

  function cancelarPresion() {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  return (
    <div
      className="relative h-full select-none [-webkit-touch-callout:none]"
      onPointerDown={iniciarPresion}
      onPointerUp={cancelarPresion}
      onPointerLeave={cancelarPresion}
      onPointerCancel={cancelarPresion}
      onClickCapture={(e) => {
        if (!seleccionable) return
        if (presionLarga.current) {
          presionLarga.current = false
          e.preventDefault()
          e.stopPropagation()
          return
        }
        if (modoSeleccion) {
          e.preventDefault()
          e.stopPropagation()
          onAlternar(encuesta._id)
        }
      }}
    >
      <SurveyCard
        encuesta={encuesta}
        modoSeleccion={modoSeleccion && seleccionable}
        seleccionada={seleccionada}
      />
      {modoSeleccion && seleccionable && (
        <div
          className={cn(
            "pointer-events-none absolute top-3 right-3 flex size-6 items-center justify-center rounded-full shadow-sm transition-colors",
            seleccionada
              ? "bg-primary text-primary-foreground"
              : "bg-background/90 text-transparent ring-1 ring-border"
          )}
        >
          <CheckIcon className="size-3.5" />
        </div>
      )}
    </div>
  )
}
