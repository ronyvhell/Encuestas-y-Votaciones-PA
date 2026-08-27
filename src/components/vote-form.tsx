"use client"

import { useState } from "react"
import { sileo } from "sileo"

import { Button } from "@/components/ui/button"
import { SurveyRender } from "@/components/survey-render"
import type { EncuestaUI, RespuestasUI, ResultadoUI } from "@/lib/types"
import { SendIcon } from "lucide-react"

export function VoteForm({ encuesta }: { encuesta: EncuestaUI }) {
  const [valores, setValores] = useState<RespuestasUI>({})
  const [enviando, setEnviando] = useState(false)
  const [resultados, setResultados] = useState<ResultadoUI[] | null>(null)
  const [totalVotos, setTotalVotos] = useState(encuesta.votos)

  async function enviar() {
    setEnviando(true)
    try {
      const res = await fetch(`/api/surveys/${encuesta._id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respuestas: Object.entries(valores).map(([preguntaId, valor]) => ({ preguntaId, valor })) }),
      })
      const datos = await res.json().catch(() => null)

      if (res.ok) {
        setResultados(datos.resultados)
        setTotalVotos(datos.totalVotos)
        sileo.success({
          title: "¡Respuesta enviada!",
          description: "Gracias por participar en esta encuesta.",
        })
        return
      }

      if (res.status === 409) {
        sileo.warning({
          title: "Ya has votado",
          description: "Solo se permite una respuesta por encuesta.",
        })
        return
      }

      sileo.warning({
        title: "No se pudo enviar",
        description: datos?.error ?? "Revisa tus respuestas e inténtalo de nuevo.",
      })
    } catch {
      sileo.error({ title: "Error inesperado", description: "No se pudo enviar tu respuesta." })
    } finally {
      setEnviando(false)
    }
  }

  if (resultados) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="font-heading text-lg font-semibold tracking-tight">Resultados</h3>
            <p className="text-sm text-muted-foreground">
              {totalVotos} voto{totalVotos === 1 ? "" : "s"} registrado{totalVotos === 1 ? "" : "s"} en esta encuesta.
            </p>
          </div>
        </div>
        <SurveyRender encuesta={encuesta} mode="results" resultados={resultados} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <SurveyRender encuesta={encuesta} mode="vote" valores={valores} onChange={(id, valor) => setValores((prev) => ({ ...prev, [id]: valor }))} />
      <div className="flex justify-end">
        <Button onClick={enviar} disabled={enviando}>
          <SendIcon data-icon="inline-start" />
          {enviando ? "Enviando..." : "Enviar respuestas"}
        </Button>
      </div>
    </div>
  )
}
