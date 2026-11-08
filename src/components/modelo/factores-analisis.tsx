"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import type { AnalisisFactores } from "@/lib/modelo/analisis"
import { cn } from "@/lib/utils"

function porcentaje(valor: number): string {
  return `${Math.round(valor * 10) / 10}%`
}

function Barra({
  etiqueta,
  valor,
  detalle,
  destacar,
}: {
  etiqueta: string
  valor: number
  detalle: string
  destacar?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={cn("truncate", destacar && "font-medium")}>{etiqueta}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{detalle}</span>
      </div>
      <Progress value={Math.max(0, Math.min(100, valor))} />
    </div>
  )
}

export function FactoresAnalisis({ analisis }: { analisis: AnalisisFactores }) {
  const ranking = [...analisis.preguntas]
    .filter((pregunta) => !pregunta.esObjetivo)
    .sort((a, b) => b.poderPredictivo - a.poderPredictivo)

  const totalClases = Object.values(analisis.distribucion).reduce((suma, valor) => suma + valor, 0)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Resumen del conjunto de datos</CardTitle>
          <CardDescription>
            Análisis de todos los factores de la encuesta, no solo de la variable objetivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border p-3">
              <p className="text-xs text-muted-foreground">Votos registrados</p>
              <p className="font-heading text-2xl font-semibold tabular-nums">{analisis.totalVotos}</p>
            </div>
            <div className="rounded-2xl border p-3">
              <p className="text-xs text-muted-foreground">Votos usados en el modelo</p>
              <p className="font-heading text-2xl font-semibold tabular-nums">{analisis.filasModelo}</p>
            </div>
            <div className="rounded-2xl border p-3">
              <p className="text-xs text-muted-foreground">Excluidos («No sé»)</p>
              <p className="font-heading text-2xl font-semibold tabular-nums">{analisis.excluidos}</p>
            </div>
            <div className="rounded-2xl border p-3">
              <p className="text-xs text-muted-foreground">Clase positiva</p>
              <p className="truncate font-heading text-lg font-semibold">{analisis.clasePositiva || "—"}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Distribución de la respuesta</span>
            {Object.entries(analisis.distribucion).map(([clase, conteo]) => (
              <Barra
                key={clase}
                etiqueta={clase}
                valor={totalClases > 0 ? (conteo / totalClases) * 100 : 0}
                detalle={`${conteo} · ${porcentaje(totalClases > 0 ? (conteo / totalClases) * 100 : 0)}`}
                destacar={clase === analisis.clasePositiva}
              />
            ))}
            {Object.keys(analisis.distribucion).length === 0 && (
              <p className="text-sm text-muted-foreground">Sin votos suficientes todavía.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ranking de factores</CardTitle>
          <CardDescription>
            Poder predictivo de cada pregunta sobre la respuesta objetivo (ganancia de información).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {ranking.map((pregunta, indice) => (
              <li key={pregunta.preguntaId} className="flex flex-col gap-1.5 px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="secondary" className="tabular-nums">
                      {indice + 1}
                    </Badge>
                    <span className="truncate text-sm font-medium">{pregunta.texto}</span>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums font-medium">
                    {porcentaje(pregunta.poderPredictivo * 100)}
                  </span>
                </div>
                <Progress value={pregunta.poderPredictivo * 100} />
              </li>
            ))}
            {ranking.length === 0 && (
              <li className="px-5 py-6 text-sm text-muted-foreground">
                No hay factores analizables en esta encuesta.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      {analisis.preguntas.map((pregunta, indice) => (
        <Card key={pregunta.preguntaId}>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">
                {indice + 1}. {pregunta.texto}
              </CardTitle>
              <CardDescription>
                {pregunta.total} respuesta{pregunta.total === 1 ? "" : "s"}
                {pregunta.promedio !== undefined
                  ? ` · promedio ${pregunta.promedio.toFixed(2)}`
                  : ""}
                {" · "}poder predictivo {porcentaje(pregunta.poderPredictivo * 100)}
              </CardDescription>
            </div>
            {pregunta.esObjetivo && <Badge>Variable objetivo</Badge>}
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {pregunta.filas.length > 0 && (
              <div className="flex flex-col gap-2.5">
                {pregunta.filas.map((fila) => (
                  <div key={fila.valor} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{fila.valor}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {fila.n} ({porcentaje(fila.porcentaje)})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={fila.porcentaje} className="flex-1" />
                      <span
                        className={cn(
                          "w-24 shrink-0 text-right text-[11px] tabular-nums",
                          fila.nModelo > 0 ? "text-muted-foreground" : "text-muted-foreground/60"
                        )}
                        title={`Porcentaje de «${analisis.clasePositiva}» en este grupo`}
                      >
                        {fila.nModelo > 0
                          ? `${porcentaje(fila.porcentajePositivo)} «${analisis.clasePositiva}»`
                          : "sin datos"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pregunta.muestra && (
              <div className="flex flex-col gap-1.5">
                <Separator />
                <span className="text-xs font-medium text-muted-foreground">
                  Respuestas de texto (muestra)
                </span>
                {pregunta.muestra.map((texto, posicion) => (
                  <span
                    key={posicion}
                    className="truncate rounded-xl bg-muted px-3 py-1.5 text-sm"
                  >
                    {texto}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
