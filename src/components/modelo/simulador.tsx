"use client"

import { useMemo, useState } from "react"
import { sileo } from "sileo"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { SurveyRender } from "@/components/survey-render"
import { cn } from "@/lib/utils"
import type { EncuestaUI, RespuestasUI } from "@/lib/types"
import type { PreguntaVista } from "@/lib/modelo/vista"
import { RotateCcwIcon, SparklesIcon } from "lucide-react"

export interface PrefillSimulador {
  nonce: number
  respuestas: Record<string, unknown>
}

interface ResultadoPrediccion {
  clase: string
  probabilidades: Record<string, number>
  probabilidadPositiva: number
  explicacion: string[]
  version: number
}

function porcentaje(valor: number): string {
  return `${Math.round(valor * 100)}%`
}

export function Simulador({
  encuestaId,
  modeloId,
  clasePositiva,
  textoObjetivo,
  preguntas,
  prefill,
}: {
  encuestaId: string
  modeloId: string
  clasePositiva: string
  textoObjetivo: string
  preguntas: PreguntaVista[]
  prefill: PrefillSimulador | null
}) {
  // El panel remonta el simulador con una `key` distinta al cargar un ejemplo,
  // así que el estado inicial puede venir directamente de `prefill`.
  const [valores, setValores] = useState<RespuestasUI>(
    () => (prefill?.respuestas as RespuestasUI) ?? {}
  )
  const [resultado, setResultado] = useState<ResultadoPrediccion | null>(null)
  const [cargando, setCargando] = useState(false)

  const encuesta: EncuestaUI = useMemo(
    () => ({
      _id: encuestaId,
      titulo: "Simulador",
      descripcion: "",
      imagenPortada: "",
      estado: "publicada",
      tipos: [],
      votos: 0,
      preguntas: preguntas.map((pregunta) => ({
        _id: pregunta._id,
        texto: pregunta.texto,
        tipoPregunta: pregunta.tipoPregunta,
        opciones: pregunta.opciones,
        config: pregunta.config,
        requerida: false,
      })),
    }),
    [encuestaId, preguntas]
  )

  const respondidas = Object.values(valores).filter((valor) =>
    Array.isArray(valor) ? valor.length > 0 : valor !== undefined && valor !== ""
  ).length

  async function predecir() {
    setCargando(true)
    try {
      const res = await fetch(`/api/surveys/${encuestaId}/modelo/predecir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modeloId, respuestas: valores }),
      })
      const datos = await res.json().catch(() => null)

      if (!res.ok) {
        sileo.warning({ title: "No se pudo predecir", description: datos?.error })
        return
      }

      setResultado(datos as ResultadoPrediccion)
      sileo.success({
        title: `Predicción: ${datos.clase}`,
        description: `Probabilidad de «${clasePositiva}»: ${porcentaje(datos.probabilidadPositiva)}`,
      })
    } catch {
      sileo.error({ title: "Error inesperado al predecir" })
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Responde como si fueras un colaborador y el modelo estimará «{textoObjetivo}».
        </p>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{respondidas} de {preguntas.length} respondidas</Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setValores({})
              setResultado(null)
            }}
          >
            <RotateCcwIcon data-icon="inline-start" />
            Limpiar
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border p-4">
        <SurveyRender
          encuesta={encuesta}
          mode="vote"
          sinEncabezado
          valores={valores}
          onChange={(preguntaId, valor) =>
            setValores((previos) => ({ ...previos, [preguntaId]: valor }))
          }
        />
      </div>

      <Button onClick={predecir} disabled={cargando || respondidas === 0} className="w-fit">
        <SparklesIcon data-icon="inline-start" />
        {cargando ? "Calculando..." : "Predecir con el modelo"}
      </Button>

      {resultado && (
        <div className="flex flex-col gap-3 rounded-2xl border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-sm font-semibold",
                resultado.clase === clasePositiva
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
              )}
            >
              Predicción: {resultado.clase}
            </span>
            <span className="text-sm text-muted-foreground">
              P({clasePositiva}) = {porcentaje(resultado.probabilidadPositiva)} · modelo v
              {resultado.version}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {Object.entries(resultado.probabilidades).map(([clase, probabilidad]) => (
              <div key={clase} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{clase}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {porcentaje(probabilidad)}
                  </span>
                </div>
                <Progress value={probabilidad * 100} />
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {resultado.explicacion.length > 1 ? "Camino de decisión" : "Explicación"}
            </span>
            <ul className="flex flex-col gap-1 text-sm">
              {resultado.explicacion.map((linea, indice) => (
                <li key={indice} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  <span>{linea}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
