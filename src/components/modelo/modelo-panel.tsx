"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { sileo } from "sileo"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArbolVista } from "./arbol-vista"
import { FactoresAnalisis } from "./factores-analisis"
import { Simulador, type PrefillSimulador } from "./simulador"
import { ALGORITMOS, type AlgoritmoModelo, type PoliticaObjetivo } from "@/lib/modelo/tipos"
import type { DatosModeloPage, EjemploVista, HistorialVista, ModeloVista } from "@/lib/modelo/vista"
import { cn } from "@/lib/utils"
import { BrainIcon, ChartNoAxesColumnIcon, SparklesIcon, TriangleAlertIcon } from "lucide-react"

function porcentaje(valor: number): string {
  return `${Math.round(valor * 100)}%`
}

function porcentajeDecimal(valor: number): string {
  return `${(Math.round(valor * 1000) / 10).toFixed(1)}%`
}

function fechaCorta(iso: string): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return iso
  // Se formatea en UTC para que el servidor y el navegador rendericen lo mismo
  // (evita diferencias de hidratación cuando el servidor está en otra zona).
  const dos = (valor: number) => String(valor).padStart(2, "0")
  return `${dos(fecha.getUTCDate())}/${dos(fecha.getUTCMonth() + 1)}/${fecha.getUTCFullYear()}`
}

function TarjetaMetrica({
  etiqueta,
  valor,
  detalle,
}: {
  etiqueta: string
  valor: string
  detalle: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border p-4">
      <span className="text-xs text-muted-foreground">{etiqueta}</span>
      <span className="font-heading text-2xl font-semibold tabular-nums">{valor}</span>
      <span className="text-[11px] text-muted-foreground">{detalle}</span>
    </div>
  )
}

function MetricasModelo({ modelo }: { modelo: ModeloVista }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <TarjetaMetrica
          etiqueta="Exactitud"
          valor={porcentaje(modelo.exactitud)}
          detalle="validación cruzada"
        />
        <TarjetaMetrica
          etiqueta={`F1 (${modelo.clasePositiva})`}
          valor={porcentaje(modelo.f1)}
          detalle="clase positiva"
        />
        <TarjetaMetrica etiqueta="Macro-F1" valor={porcentaje(modelo.macroF1)} detalle="ambas clases" />
        <TarjetaMetrica
          etiqueta="Registros"
          valor={String(modelo.nRegistros)}
          detalle={`${modelo.nExcluidos} excluidos`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matriz de confusión</CardTitle>
            <CardDescription>
              Predicciones fuera de muestra de la versión {modelo.version}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full max-w-md border-separate border-spacing-1 text-sm">
              <thead>
                <tr>
                  <th />
                  <th className="pb-1 text-center text-[11px] font-medium text-muted-foreground">
                    Predice «{modelo.clasePositiva}»
                  </th>
                  <th className="pb-1 text-center text-[11px] font-medium text-muted-foreground">
                    Predice «{modelo.clases[1] ?? "—"}»
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className="pr-2 text-left text-[11px] font-medium">
                    Real «{modelo.clasePositiva}»
                  </th>
                  <td className="rounded-xl bg-emerald-500/15 p-2 text-center text-base font-semibold tabular-nums">
                    {modelo.matriz.vp}
                  </td>
                  <td className="rounded-xl bg-rose-500/15 p-2 text-center text-base tabular-nums">
                    {modelo.matriz.fn}
                  </td>
                </tr>
                <tr>
                  <th className="pr-2 text-left text-[11px] font-medium">
                    Real «{modelo.clases[1] ?? "—"}»
                  </th>
                  <td className="rounded-xl bg-rose-500/15 p-2 text-center text-base tabular-nums">
                    {modelo.matriz.fp}
                  </td>
                  <td className="rounded-xl bg-emerald-500/15 p-2 text-center text-base font-semibold tabular-nums">
                    {modelo.matriz.vn}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              Verdaderos positivos {modelo.matriz.vp} · falsos positivos {modelo.matriz.fp} · falsos
              negativos {modelo.matriz.fn} · verdaderos negativos {modelo.matriz.vn}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Métricas por clase</CardTitle>
            <CardDescription>Precisión, exhaustividad y F1 de cada opción.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-5 py-2">Clase</th>
                  <th className="px-2 py-2 text-right">Prec.</th>
                  <th className="px-2 py-2 text-right">Exh.</th>
                  <th className="px-2 py-2 text-right">F1</th>
                  <th className="px-5 py-2 text-right">n</th>
                </tr>
              </thead>
              <tbody>
                {modelo.porClase.map((clase) => (
                  <tr key={clase.clase} className="border-b last:border-0">
                    <td className="px-5 py-2 font-medium">{clase.clase}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{porcentaje(clase.precision)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{porcentaje(clase.exhaustividad)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{porcentaje(clase.f1)}</td>
                    <td className="px-5 py-2 text-right tabular-nums text-muted-foreground">
                      {clase.soporte}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ArbolYReglas({ modelo }: { modelo: ModeloVista }) {
  const reglas = modelo.reglas.slice(0, 12)

  return (
    <div className="flex flex-col gap-4">
      {modelo.arbol ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Árbol de decisión</CardTitle>
            <CardDescription>
              Reglas que el modelo aprendió de los votos. Cada camino lleva a una predicción.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ArbolVista arbol={modelo.arbol} clasePositiva={modelo.clasePositiva} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reglas del modelo</CardTitle>
            <CardDescription>
              {modelo.etiquetaAlgoritmo} no genera un árbol visible; estas son sus variables más
              influyentes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Cambia el algoritmo a «{ALGORITMOS[0].label}» para ver el árbol completo y sus reglas.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reglas principales</CardTitle>
            <CardDescription>SI … ENTONCES …, ordenadas por cobertura.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {reglas.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Este algoritmo no produce reglas legibles.
              </p>
            ) : (
              <ul className="divide-y">
                {reglas.map((regla, indice) => (
                  <li key={indice} className="flex flex-col gap-1 px-5 py-3">
                    <p className="text-sm">
                      <span className="font-semibold text-primary">SI </span>
                      {regla.condiciones.length === 0
                        ? "sin condiciones"
                        : regla.condiciones.join(" Y ")}
                      <span className="font-semibold text-primary"> ENTONCES </span>
                      <span className="font-semibold">{regla.clase}</span>
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      n = {regla.n} · confianza {porcentaje(regla.confianza)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Importancia de las variables</CardTitle>
            <CardDescription>Cuánto aporta cada pregunta a la decisión.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {modelo.importancias.slice(0, 10).map((importancia) => (
              <div key={importancia.columna} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">{importancia.texto}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {porcentajeDecimal(importancia.importancia)}
                  </span>
                </div>
                <Progress value={importancia.importancia * 100} />
              </div>
            ))}
            {modelo.importancias.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin datos de importancia.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TablaComparacion({ modelo }: { modelo: ModeloVista }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b text-left text-[11px] tracking-wide text-muted-foreground uppercase">
            <th className="py-2 pr-3">Algoritmo</th>
            <th className="px-2 py-2 text-right">Exactitud</th>
            <th className="px-2 py-2 text-right">Precisión</th>
            <th className="px-2 py-2 text-right">Exhaustividad</th>
            <th className="px-2 py-2 text-right">F1</th>
            <th className="px-2 py-2 text-right">Macro-F1</th>
            <th className="py-2 pl-2 text-right">± DE</th>
          </tr>
        </thead>
        <tbody>
          {modelo.comparacion.map((fila) => {
            const activo = fila.algoritmo === modelo.algoritmo
            return (
              <tr
                key={fila.algoritmo}
                className={cn("border-b last:border-0", activo && "bg-muted/50")}
              >
                <td className="py-2 pr-3 font-medium">
                  <span className="flex items-center gap-2">
                    {fila.etiqueta}
                    {activo && <Badge variant="secondary">seleccionado</Badge>}
                  </span>
                </td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums">
                  {porcentaje(fila.exactitud)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{porcentaje(fila.precision)}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {porcentaje(fila.exhaustividad)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{porcentaje(fila.f1)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{porcentaje(fila.macroF1)}</td>
                <td className="py-2 pl-2 text-right tabular-nums text-muted-foreground">
                  {(fila.desviacion * 100).toFixed(1)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ListaHistorial({ historial }: { historial: HistorialVista[] }) {
  if (historial.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-muted-foreground">
        Aún no hay versiones entrenadas. Pulsa «Entrenar modelo» para crear la primera.
      </p>
    )
  }

  return (
    <ul className="divide-y">
      {historial.map((item) => (
        <li key={item._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">Versión {item.version}</span>
            <span className="text-xs text-muted-foreground">
              {fechaCorta(item.createdAt)} · {item.etiquetaAlgoritmo} · {item.nRegistros} registros
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="tabular-nums">
              Exactitud <strong>{porcentaje(item.exactitud)}</strong>
            </span>
            <span className="tabular-nums text-muted-foreground">
              F1 {porcentaje(item.f1)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function TarjetaEjemplo({
  ejemplo,
  clasePositiva,
  onProbar,
}: {
  ejemplo: EjemploVista
  clasePositiva: string
  onProbar: (respuestas: Record<string, unknown>) => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{ejemplo.fecha || "sin fecha"}</span>
        <Badge variant={ejemplo.acierto ? "default" : "destructive"}>
          {ejemplo.acierto ? "Acierto" : "Error"}
        </Badge>
      </div>

      <div className="flex flex-col gap-1 text-[11px]">
        {ejemplo.perfil.slice(0, 4).map((item, indice) => (
          <div key={indice} className="flex items-baseline justify-between gap-2">
            <span className="truncate text-muted-foreground">{item.texto}</span>
            <span className="shrink-0 font-medium">{item.valor}</span>
          </div>
        ))}
      </div>

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          Real: <strong>{ejemplo.real}</strong>
        </span>
        <span>
          Modelo: <strong>{ejemplo.prediccion}</strong> · P({clasePositiva}){" "}
          {porcentaje(ejemplo.probabilidadPositiva)}
        </span>
      </div>

      <Button size="sm" variant="outline" className="mt-1 w-fit" onClick={() => onProbar(ejemplo.respuestas)}>
        Probar en el simulador
      </Button>
    </div>
  )
}

export function ModeloPanel({ datos }: { datos: DatosModeloPage }) {
  const router = useRouter()
  const modelo = datos.modelo
  const [tab, setTab] = useState(modelo ? "modelo" : "entrenar")
  const [algoritmo, setAlgoritmo] = useState<AlgoritmoModelo>(
    (modelo?.algoritmo as AlgoritmoModelo) ?? "arbol"
  )
  const [objetivoId, setObjetivoId] = useState(
    modelo?.preguntaObjetivoId ?? datos.objetivos[0]?.preguntaId ?? ""
  )
  const [politica, setPolitica] = useState<PoliticaObjetivo>(
    modelo?.politica === "mapear_no" ? "mapear_no" : "excluir"
  )
  const [entrenando, setEntrenando] = useState(false)
  const [prefill, setPrefill] = useState<PrefillSimulador | null>(null)

  const objetivoActual = datos.objetivos.find((item) => item.preguntaId === objetivoId)

  async function entrenar() {
    setEntrenando(true)
    try {
      const res = await fetch(`/api/surveys/${datos.encuestaId}/modelo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preguntaObjetivoId: objetivoId,
          algoritmo,
          politica,
        }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        sileo.warning({
          title: "No se pudo entrenar el modelo",
          description: json?.error ?? "Revisa los datos e inténtalo de nuevo.",
        })
        return
      }

      sileo.success({
        title: `Modelo v${json?.modelo?.version} entrenado`,
        description: `Exactitud ${porcentaje(json?.modelo?.exactitud ?? 0)} en validación cruzada.`,
      })
      setTab("modelo")
      router.refresh()
    } catch {
      sileo.error({ title: "Error inesperado al entrenar el modelo" })
    } finally {
      setEntrenando(false)
    }
  }

  function probarEjemplo(respuestas: Record<string, unknown>) {
    setPrefill({ nonce: Date.now(), respuestas })
    setTab("prediccion")
  }

  if (datos.objetivos.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Empty>
            <EmptyMedia variant="icon">
              <TriangleAlertIcon />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>Esta encuesta no puede entrenar un modelo</EmptyTitle>
              <EmptyDescription>
                Necesita al menos una pregunta de selección única con dos opciones (por ejemplo
                Sí / No), o una pregunta de verdadero/falso, para usarla como variable objetivo.
                Edita la encuesta y añade esa pregunta.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    )
  }

  return (
    <Tabs value={tab} onValueChange={(valor) => setTab(String(valor))}>
      <TabsList className="w-full max-w-xl">
        <TabsTrigger value="entrenar">Entrenamiento</TabsTrigger>
        <TabsTrigger value="modelo">Modelo</TabsTrigger>
        <TabsTrigger value="prediccion">Predicción</TabsTrigger>
        <TabsTrigger value="factores">Factores</TabsTrigger>
      </TabsList>

      <TabsContent value="entrenar" className="mt-4 flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BrainIcon className="size-4 text-muted-foreground" />
              Entrenar el modelo predictivo
            </CardTitle>
            <CardDescription>
              El modelo se entrena dentro de la aplicación con los votos actuales. Cada
              entrenamiento crea una versión nueva.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Variable objetivo</span>
                <Select
                  value={objetivoId}
                  onValueChange={(valor) => setObjetivoId(String(valor))}
                  items={datos.objetivos.map((objetivo) => ({
                    value: objetivo.preguntaId,
                    label: objetivo.texto,
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {datos.objetivos.map((objetivo) => (
                      <SelectItem key={objetivo.preguntaId} value={objetivo.preguntaId}>
                        {objetivo.texto}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Algoritmo</span>
                <Select
                  value={algoritmo}
                  onValueChange={(valor) => setAlgoritmo(valor as AlgoritmoModelo)}
                  items={ALGORITMOS.map((item) => ({ value: item.value, label: item.label }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALGORITMOS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Votos «No sé» {objetivoActual?.tieneNoSe ? "" : "(no aplica)"}
                </span>
                <Select
                  value={politica}
                  onValueChange={(valor) => setPolitica(valor as PoliticaObjetivo)}
                  disabled={!objetivoActual?.tieneNoSe}
                  items={[
                    { value: "excluir", label: "Excluirlos del entrenamiento" },
                    { value: "mapear_no", label: "Contarlos como la clase negativa" },
                  ]}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excluir">Excluirlos del entrenamiento</SelectItem>
                    <SelectItem value="mapear_no">Contarlos como la clase negativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {ALGORITMOS.find((item) => item.value === algoritmo)?.descripcion}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={entrenar} disabled={entrenando}>
                <SparklesIcon data-icon="inline-start" />
                {entrenando ? "Entrenando..." : modelo ? "Reentrenar con los votos actuales" : "Entrenar modelo"}
              </Button>
              <span className="text-xs text-muted-foreground">
                {datos.totalVotos} votos registrados
                {modelo ? ` · última versión usó ${modelo.nRegistros} registros` : ""}
              </span>
            </div>

            {datos.totalVotos < 20 && (
              <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                Se necesitan al menos 20 votos con respuesta a la variable objetivo. Comparte la
                encuesta para recolectar más.
              </p>
            )}
          </CardContent>
        </Card>

        {modelo && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comparación de algoritmos</CardTitle>
              <CardDescription>
                Resultados de la validación cruzada de {modelo.nRegistros} registros. El
                seleccionado es el que se usa para predecir.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TablaComparacion modelo={modelo} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de versiones</CardTitle>
            <CardDescription>
              Reentrenar con votos nuevos no borra las versiones anteriores.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ListaHistorial historial={datos.historial} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="modelo" className="mt-4 flex flex-col gap-4">
        {!modelo ? (
          <Card>
            <CardContent className="pt-6">
              <Empty>
                <EmptyMedia variant="icon">
                  <ChartNoAxesColumnIcon />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>Todavía no hay un modelo entrenado</EmptyTitle>
                  <EmptyDescription>
                    Ve a «Entrenamiento» y pulsa «Entrenar modelo» para generar la primera versión.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/30 px-4 py-3 text-sm">
              <Badge>Versión {modelo.version}</Badge>
              <span className="font-medium">{modelo.etiquetaAlgoritmo}</span>
              <span className="text-muted-foreground">·</span>
              <span className="truncate text-muted-foreground">
                Objetivo: «{modelo.textoObjetivo}»
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {fechaCorta(modelo.createdAt)}
              </span>
            </div>
            <MetricasModelo modelo={modelo} />
            <ArbolYReglas modelo={modelo} />
          </>
        )}
      </TabsContent>

      <TabsContent value="prediccion" className="mt-4 flex flex-col gap-4">
        {!modelo ? (
          <Card>
            <CardContent className="pt-6">
              <Empty>
                <EmptyMedia variant="icon">
                  <SparklesIcon />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>Entrena un modelo para predecir</EmptyTitle>
                  <EmptyDescription>
                    Cuando exista una versión entrenada podrás simular respuestas y ver la
                    predicción del modelo.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Simulador de respuestas</CardTitle>
                <CardDescription>
                  Responde como un encuestado hipotético y observa la predicción del modelo
                  ({modelo.etiquetaAlgoritmo}, versión {modelo.version}).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Simulador
                  key={prefill?.nonce ?? "simulador"}
                  encuestaId={datos.encuestaId}
                  modeloId={modelo._id}
                  clasePositiva={modelo.clasePositiva}
                  textoObjetivo={modelo.textoObjetivo}
                  preguntas={datos.preguntas}
                  prefill={prefill}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Casos reales del conjunto de datos</CardTitle>
                <CardDescription>
                  Votos reales de esta encuesta con la predicción del modelo y la respuesta real.
                  Puedes cargar cualquiera en el simulador.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {datos.ejemplos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay votos suficientes para mostrar ejemplos.
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {datos.ejemplos.map((ejemplo) => (
                      <TarjetaEjemplo
                        key={ejemplo.votoId}
                        ejemplo={ejemplo}
                        clasePositiva={modelo.clasePositiva}
                        onProbar={probarEjemplo}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </TabsContent>

      <TabsContent value="factores" className="mt-4">
        <FactoresAnalisis analisis={datos.analisis} />
      </TabsContent>
    </Tabs>
  )
}
