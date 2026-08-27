"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { CoverImage } from "@/components/cover-image"
import {
  TIPOS_PREGUNTA,
  esTipoConOpciones,
} from "@/lib/constants"
import type {
  EncuestaUI,
  RespuestasUI,
  ResultadoUI,
} from "@/lib/types"

function TituloTipoPregunta({ tipo }: { tipo: string }) {
  return (
    <span className="text-xs font-normal text-muted-foreground">
      {TIPOS_PREGUNTA.find((t) => t.value === tipo)?.label ?? tipo}
    </span>
  )
}

function OpcionVerdaderoFalso({
  preguntaId,
  valor,
  onChange,
  disabled,
}: {
  preguntaId: string
  valor: boolean | undefined
  onChange?: (preguntaId: string, valor: boolean) => void
  disabled?: boolean
}) {
  return (
    <RadioGroup
      value={valor === undefined ? "" : String(valor)}
      onValueChange={(v) => onChange?.(preguntaId, v === "true")}
      disabled={disabled}
    >
      <div className="flex items-center gap-2">
        <RadioGroupItem value="true" id={`${preguntaId}-vf-true`} disabled={disabled} />
        <Label htmlFor={`${preguntaId}-vf-true`} className="font-normal">Verdadero</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="false" id={`${preguntaId}-vf-false`} disabled={disabled} />
        <Label htmlFor={`${preguntaId}-vf-false`} className="font-normal">Falso</Label>
      </div>
    </RadioGroup>
  )
}

function OpcionesCheckbox({
  preguntaId,
  opciones,
  valores,
  onChange,
  disabled,
}: {
  preguntaId: string
  opciones: string[]
  valores: string[] | undefined
  onChange?: (preguntaId: string, valor: string[]) => void
  disabled?: boolean
}) {
  const seleccion = valores ?? []
  return (
    <div className="flex flex-col gap-2.5">
      {opciones.map((opcion) => (
        <div key={opcion} className="flex items-center gap-2">
          <Checkbox
            id={`${preguntaId}-${opcion}`}
            checked={seleccion.includes(opcion)}
            disabled={disabled}
            onCheckedChange={(chequeado) => {
              const nuevos = chequeado
                ? [...seleccion, opcion]
                : seleccion.filter((o) => o !== opcion)
              onChange?.(preguntaId, nuevos)
            }}
          />
          <Label htmlFor={`${preguntaId}-${opcion}`} className="font-normal">
            {opcion}
          </Label>
        </div>
      ))}
    </div>
  )
}

function BarraResultado({
  etiqueta,
  conteo,
  total,
}: {
  etiqueta: string
  conteo: number
  total: number
}) {
  const porcentaje = total > 0 ? Math.round((conteo / total) * 100) : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate">{etiqueta}</span>
        <span className="shrink-0 text-muted-foreground">
          {conteo} ({porcentaje}%)
        </span>
      </div>
      <Progress value={porcentaje} aria-label={etiqueta} />
    </div>
  )
}

function ResultadosPregunta({
  pregunta,
  resultado,
}: {
  pregunta: EncuestaUI["preguntas"][number]
  resultado?: ResultadoUI
}) {
  const total = resultado?.total ?? 0

  if (pregunta.tipoPregunta === "verdadero_falso") {
    const verdadero = resultado?.verdadero ?? 0
    const falso = resultado?.falso ?? 0
    return (
      <div className="flex flex-col gap-3">
        <BarraResultado etiqueta="Verdadero" conteo={verdadero} total={total} />
        <BarraResultado etiqueta="Falso" conteo={falso} total={total} />
      </div>
    )
  }

  if (esTipoConOpciones(pregunta.tipoPregunta)) {
    const conteo = resultado?.conteoOpciones ?? {}
    return (
      <div className="flex flex-col gap-3">
        {pregunta.opciones.map((opcion) => (
          <BarraResultado
            key={opcion}
            etiqueta={opcion}
            conteo={conteo[opcion] ?? 0}
            total={total}
          />
        ))}
      </div>
    )
  }

  const valores = resultado?.valores ?? []
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-muted-foreground">
        {total} respuesta{total === 1 ? "" : "s"}
      </span>
      {valores.length === 0 ? (
        <span className="text-sm text-muted-foreground">Sin respuestas aún.</span>
      ) : (
        <div className="flex flex-col gap-1.5">
          {valores.map((valor, i) => (
            <span key={i} className="truncate rounded-xl bg-muted px-3 py-1.5 text-sm">
              {String(valor)}
            </span>
          ))}
          {total > valores.length && (
            <span className="text-sm text-muted-foreground">
              y {total - valores.length} más...
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function SurveyRender({
  encuesta,
  mode = "vote",
  valores,
  onChange,
  resultados,
}: {
  encuesta: EncuestaUI
  mode?: "preview" | "vote" | "results"
  valores?: RespuestasUI
  onChange?: (preguntaId: string, valor: RespuestasUI[string]) => void
  resultados?: ResultadoUI[]
}) {
  const soloLectura = mode === "results"
  const interactivo = mode !== "results"

  return (
    <div className="flex flex-col gap-6">
      {encuesta.imagenPortada && (
        <CoverImage
          src={encuesta.imagenPortada}
          alt={encuesta.titulo}
          className="aspect-video w-full rounded-2xl object-cover"
        />
      )}

      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          {encuesta.titulo || "Encuesta sin título"}
        </h2>
        {encuesta.descripcion && (
          <p className="text-sm text-muted-foreground">{encuesta.descripcion}</p>
        )}
        {encuesta.tipos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {encuesta.tipos.map((tipo) => (
              <Badge key={tipo._id} variant="secondary">{tipo.nombre}</Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {encuesta.preguntas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Esta encuesta aún no tiene preguntas.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {encuesta.preguntas.map((pregunta, indice) => (
            <div key={pregunta._id} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-base font-medium">
                  {indice + 1}. {pregunta.texto}
                  {pregunta.requerida && <span className="ml-1 text-destructive">*</span>}
                </h3>
                <TituloTipoPregunta tipo={pregunta.tipoPregunta} />
              </div>

              {mode === "results" ? (
                <ResultadosPregunta
                  pregunta={pregunta}
                  resultado={resultados?.find((r) => r.preguntaId === pregunta._id)}
                />
              ) : pregunta.tipoPregunta === "texto" ? (
                <Input
                  placeholder="Escribe tu respuesta..."
                  value={typeof valores?.[pregunta._id] === "string" ? (valores[pregunta._id] as string) : ""}
                  onChange={(e) => onChange?.(pregunta._id, e.target.value)}
                  disabled={soloLectura}
                />
              ) : pregunta.tipoPregunta === "numerico" ? (
                <Input
                  type="number"
                  placeholder={
                    pregunta.config.min !== null || pregunta.config.max !== null
                      ? `${pregunta.config.min ?? "∞"} — ${pregunta.config.max ?? "∞"}`
                      : "Escribe un número..."
                  }
                  min={pregunta.config.min ?? undefined}
                  max={pregunta.config.max ?? undefined}
                  value={
                    typeof valores?.[pregunta._id] === "number"
                      ? String(valores[pregunta._id])
                      : typeof valores?.[pregunta._id] === "string"
                        ? (valores[pregunta._id] as string)
                        : ""
                  }
                  onChange={(e) => {
                    const v = e.target.value
                    onChange?.(pregunta._id, v === "" ? undefined : Number(v))
                  }}
                  disabled={soloLectura}
                />
              ) : pregunta.tipoPregunta === "verdadero_falso" ? (
                <OpcionVerdaderoFalso
                  preguntaId={pregunta._id}
                  valor={typeof valores?.[pregunta._id] === "boolean" ? (valores[pregunta._id] as boolean) : undefined}
                  onChange={onChange}
                  disabled={soloLectura}
                />
              ) : pregunta.tipoPregunta === "seleccion_unica" ? (
                <RadioGroup
                  value={
                    typeof valores?.[pregunta._id] === "string"
                      ? (valores[pregunta._id] as string)
                      : ""
                  }
                  onValueChange={(v) => onChange?.(pregunta._id, v)}
                  disabled={soloLectura}
                >
                  {pregunta.opciones.map((opcion) => (
                    <div key={opcion} className="flex items-center gap-2">
                      <RadioGroupItem value={opcion} id={`${pregunta._id}-${opcion}`} disabled={soloLectura} />
                      <Label htmlFor={`${pregunta._id}-${opcion}`} className="font-normal">
                        {opcion}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <OpcionesCheckbox
                  preguntaId={pregunta._id}
                  opciones={pregunta.opciones}
                  valores={
                    Array.isArray(valores?.[pregunta._id])
                      ? (valores[pregunta._id] as string[])
                      : undefined
                  }
                  onChange={(id, nuevo) => onChange?.(id, nuevo)}
                  disabled={soloLectura}
                />
              )}

              {interactivo && pregunta.requerida && !valores?.[pregunta._id] && (
                <span className="text-xs text-destructive">Esta pregunta es obligatoria.</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
