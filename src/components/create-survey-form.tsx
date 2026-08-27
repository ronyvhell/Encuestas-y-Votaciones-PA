"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { sileo } from "sileo"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { CoverImage } from "@/components/cover-image"
import { SurveyRender } from "@/components/survey-render"
import { PreviewPanel } from "@/components/preview-panel"
import {
  TIPOS_PREGUNTA,
  esTipoConOpciones,
} from "@/lib/constants"
import type { EncuestaUI, RespuestasUI, TipoUI } from "@/lib/types"
import {
  CheckIcon,
  EyeIcon,
  FileTextIcon,
  ListChecksIcon,
  PlusIcon,
  SaveIcon,
  TagsIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

type PreguntaForm = {
  key: string
  texto: string
  tipoPregunta: string
  opciones: string[]
  min: string
  max: string
  requerida: boolean
}

let contadorLocal = 0
function nuevaKey() {
  contadorLocal += 1
  return `p-${Date.now()}-${contadorLocal}`
}

const itemsTipoPregunta = [
  { label: "Selecciona un tipo de pregunta", value: null },
  ...TIPOS_PREGUNTA.map((t) => ({ label: t.label, value: t.value })),
]

export function CreateSurveyForm() {
  const router = useRouter()

  const [tab, setTab] = useState("informacion")
  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [imagenPortada, setImagenPortada] = useState("")
  const [subiendoImagen, setSubiendoImagen] = useState(false)

  const [tiposDisponibles, setTiposDisponibles] = useState<TipoUI[]>([])
  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>([])
  const [busquedaTipos, setBusquedaTipos] = useState("")
  const [creandoTipo, setCreandoTipo] = useState(false)
  const [nombreTipoNuevo, setNombreTipoNuevo] = useState("")
  const [guardandoTipo, setGuardandoTipo] = useState(false)

  const [preguntas, setPreguntas] = useState<PreguntaForm[]>([])
  const [guardando, setGuardando] = useState(false)

  const [previewAbierto, setPreviewAbierto] = useState(false)
  const [respuestasPreview, setRespuestasPreview] = useState<RespuestasUI>({})

  useEffect(() => {
    fetch("/api/survey-types")
      .then((res) => res.json())
      .then((datos: TipoUI[]) => {
        if (Array.isArray(datos)) setTiposDisponibles(datos)
      })
      .catch(() => {
        sileo.error({ title: "No se pudieron cargar los tipos de encuesta" })
      })
  }, [])

  const tiposFiltrados = useMemo(() => {
    const termino = busquedaTipos.trim().toLowerCase()
    if (!termino) return tiposDisponibles
    return tiposDisponibles.filter((t) => t.nombre.toLowerCase().includes(termino))
  }, [tiposDisponibles, busquedaTipos])

  function actualizarPregunta(key: string, cambios: Partial<PreguntaForm>) {
    setPreguntas((prev) => prev.map((p) => (p.key === key ? { ...p, ...cambios } : p)))
  }

  function agregarPregunta() {
    setPreguntas((prev) => [
      ...prev,
      { key: nuevaKey(), texto: "", tipoPregunta: "", opciones: ["", ""], min: "", max: "", requerida: false },
    ])
  }

  function quitarPregunta(key: string) {
    setPreguntas((prev) => prev.filter((p) => p.key !== key))
  }

  function toggleTipo(id: string) {
    setTiposSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    )
  }

  async function guardarTipo() {
    const nombre = nombreTipoNuevo.trim()
    if (nombre.length < 2) {
      sileo.warning({ title: "Escribe un nombre", description: "El tipo debe tener al menos 2 caracteres." })
      return
    }
    setGuardandoTipo(true)
    try {
      const res = await fetch("/api/survey-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre }),
      })
      const datos = await res.json().catch(() => null)

      if (res.ok) {
        setTiposDisponibles((prev) =>
          [...prev, { _id: datos._id, nombre: datos.nombre }].sort((a, b) => a.nombre.localeCompare(b.nombre))
        )
        setTiposSeleccionados((prev) => [...prev, datos._id])
        setCreandoTipo(false)
        setNombreTipoNuevo("")
        sileo.success({ title: "Tipo creado", description: `"${datos.nombre}" ya está disponible.` })
        return
      }

      if (res.status === 409 && datos?._id) {
        setTiposSeleccionados((prev) => (prev.includes(datos._id) ? prev : [...prev, datos._id]))
        setCreandoTipo(false)
        setNombreTipoNuevo("")
        sileo.warning({ title: "Ya existía", description: `Se seleccionó "${datos.nombre}" automáticamente.` })
        return
      }

      if (res.status === 401) {
        sileo.warning({ title: "Inicia sesión", description: "Debes iniciar sesión para crear tipos de encuesta." })
        return
      }

      sileo.warning({ title: "No se pudo crear el tipo", description: datos?.error ?? "Intenta de nuevo." })
    } catch {
      sileo.error({ title: "Error inesperado", description: "No se pudo crear el tipo." })
    } finally {
      setGuardandoTipo(false)
    }
  }

  async function subirImagen(archivo: File | undefined) {
    if (!archivo) return
    setSubiendoImagen(true)
    try {
      const formData = new FormData()
      formData.append("archivo", archivo)
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const datos = await res.json().catch(() => null)

      if (res.ok) {
        setImagenPortada(datos.url)
        sileo.success({ title: "Imagen subida", description: "La imagen de portada se actualizó." })
        return
      }
      if (res.status === 401) {
        sileo.warning({ title: "Inicia sesión", description: "Debes iniciar sesión para subir imágenes." })
        return
      }
      sileo.warning({ title: "No se pudo subir la imagen", description: datos?.error ?? "Intenta con otro archivo." })
    } catch {
      sileo.error({ title: "Error inesperado", description: "No se pudo subir la imagen." })
    } finally {
      setSubiendoImagen(false)
    }
  }

  function validarEncuesta(): string[] {
    const errores: string[] = []
    if (!titulo.trim()) errores.push("Falta el título de la encuesta.")
    if (preguntas.length === 0) errores.push("Agrega al menos una pregunta.")

    preguntas.forEach((p, indice) => {
      const n = indice + 1
      if (!p.texto.trim()) errores.push(`La pregunta ${n} no tiene texto.`)
      if (!p.tipoPregunta) errores.push(`La pregunta ${n} no tiene tipo de pregunta.`)
      if (esTipoConOpciones(p.tipoPregunta) && p.opciones.filter((o) => o.trim()).length < 2) {
        errores.push(`La pregunta ${n} necesita al menos 2 opciones.`)
      }
    })

    return errores
  }

  async function guardar() {
    const errores = validarEncuesta()
    if (errores.length > 0) {
      sileo.warning({
        title: "Revisa la encuesta",
        description: errores.join(" · "),
        duration: 8000,
      })
      return
    }

    setGuardando(true)

    const promesa = (async () => {
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          imagenPortada,
          tipos: tiposSeleccionados,
          preguntas: preguntas.map((p) => ({
            texto: p.texto.trim(),
            tipoPregunta: p.tipoPregunta,
            opciones: p.opciones.map((o) => o.trim()).filter((o) => o.length > 0),
            config: {
              min: p.min.trim() !== "" ? Number(p.min) : null,
              max: p.max.trim() !== "" ? Number(p.max) : null,
            },
            requerida: p.requerida,
          })),
        }),
      })
      const datos = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 401) throw new Error("Debes iniciar sesión para guardar encuestas.")
        throw new Error(datos?.error ?? "No se pudo guardar la encuesta.")
      }
      return datos as { _id: string }
    })()

    async function publicarAhora(encuestaId: string) {
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
        } else {
          const datos = await res.json().catch(() => null)
          sileo.warning({
            title: "No se pudo publicar",
            description: datos?.error ?? "Intenta desde la página de la encuesta.",
          })
        }
      } catch {
        sileo.error({ title: "Error inesperado" })
      }
    }

    sileo.promise(promesa, {
      loading: { title: "Guardando encuesta..." },
      success: {
        title: "Encuesta guardada",
        description: "Quedó en borradores.",
      },
      action: (datos) => ({
        title: "Encuesta guardada",
        description: "Quedó en borradores. ¿La publicas ahora?",
        duration: null,
        button: {
          title: "Publicar ahora",
          onClick: () => publicarAhora(datos._id),
        },
      }),
      error: (err) => ({
        title: "No se pudo guardar",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
      }),
    })

    try {
      const datos = await promesa
      router.push(`/encuestas/${datos._id}`)
      router.refresh()
    } catch {
      // el toast de error ya se mostró
    } finally {
      setGuardando(false)
    }
  }

  const encuestaPreview: EncuestaUI = {
    _id: "preview",
    titulo,
    descripcion,
    imagenPortada,
    estado: "borrador",
    tipos: tiposSeleccionados
      .map((id) => tiposDisponibles.find((t) => t._id === id))
      .filter((t): t is TipoUI => !!t),
    preguntas: preguntas
      .filter((p) => p.texto.trim())
      .map((p) => ({
        _id: p.key,
        texto: p.texto.trim(),
        tipoPregunta: p.tipoPregunta,
        opciones: p.opciones.map((o) => o.trim()).filter((o) => o.length > 0),
        config: {
          min: p.min.trim() !== "" ? Number(p.min) : null,
          max: p.max.trim() !== "" ? Number(p.max) : null,
        },
        requerida: p.requerida,
      })),
    votos: 0,
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Crear encuesta</h1>
        <p className="text-sm text-muted-foreground">
          Completa los pasos para armar tu encuesta.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v ?? "informacion")}>
        <TabsList className="w-full">
          <TabsTrigger value="informacion" className="flex-1">
            <FileTextIcon data-icon="inline-start" />
            Información
          </TabsTrigger>
          <TabsTrigger value="tipos" className="flex-1">
            <TagsIcon data-icon="inline-start" />
            Tipo de encuesta
          </TabsTrigger>
          <TabsTrigger value="preguntas" className="flex-1">
            <ListChecksIcon data-icon="inline-start" />
            Preguntas
          </TabsTrigger>
        </TabsList>

        {tab === "informacion" && (
          <FieldGroup className="mt-6">
            <Field>
              <FieldLabel htmlFor="titulo">Título de la encuesta</FieldLabel>
              <Input
                id="titulo"
                placeholder="Ej. ¿Cómo calificas nuestra atención?"
                maxLength={120}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="descripcion">Descripción breve</FieldLabel>
              <Textarea
                id="descripcion"
                placeholder="Cuéntale a las personas de qué trata la encuesta..."
                maxLength={500}
                rows={3}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="portada-url">Imagen de portada</FieldLabel>
              <FieldDescription>
                Puedes subir una imagen o pegar la URL de una.
              </FieldDescription>
              <FieldGroup>
                <InputGroup>
                  <InputGroupInput
                    id="portada-url"
                    placeholder="https://ejemplo.com/imagen.jpg"
                    value={imagenPortada.startsWith("http") ? imagenPortada : ""}
                    onChange={(e) => setImagenPortada(e.target.value.trim())}
                  />
                  <InputGroupAddon align="inline-end">
                    <label className="cursor-pointer">
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="sr-only"
                        onChange={(e) => subirImagen(e.target.files?.[0])}
                        disabled={subiendoImagen}
                      />
                      <InputGroupButton variant="outline" size="xs">
                        {subiendoImagen ? "Subiendo..." : "Subir"}
                      </InputGroupButton>
                    </label>
                  </InputGroupAddon>
                </InputGroup>

                {imagenPortada && (
                  <div className="relative w-fit">
                    <CoverImage
                      src={imagenPortada}
                      alt="Vista previa de la portada"
                      className="h-32 w-52 rounded-2xl object-cover"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="absolute -top-2 -right-2 rounded-full bg-secondary"
                      onClick={() => setImagenPortada("")}
                      aria-label="Quitar imagen de portada"
                    >
                      <XIcon />
                    </Button>
                  </div>
                )}
              </FieldGroup>
            </Field>
          </FieldGroup>
        )}

        {tab === "tipos" && (
          <div className="mt-6 flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="buscar-tipos">Tipo de encuesta</FieldLabel>
              <FieldDescription>
                Selecciona uno o varios tipos. Si no encuentras el tuyo, créalo con el botón +.
              </FieldDescription>
            </Field>

            <InputGroup>
              <InputGroupInput
                id="buscar-tipos"
                placeholder="Buscar tipo de encuesta..."
                value={busquedaTipos}
                onChange={(e) => setBusquedaTipos(e.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setCreandoTipo(true)}
                  aria-label="Crear tipo de encuesta"
                >
                  <PlusIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>

            {creandoTipo && (
              <div className="flex flex-col gap-3 rounded-2xl border p-4">
                <Field>
                  <FieldLabel htmlFor="nuevo-tipo">Nombre del nuevo tipo</FieldLabel>
                  <Input
                    id="nuevo-tipo"
                    autoFocus
                    placeholder="Ej. Clima laboral"
                    maxLength={40}
                    value={nombreTipoNuevo}
                    onChange={(e) => setNombreTipoNuevo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        guardarTipo()
                      }
                    }}
                  />
                  {nombreTipoNuevo.trim().length > 0 && nombreTipoNuevo.trim().length < 2 && (
                    <FieldError>Mínimo 2 caracteres.</FieldError>
                  )}
                </Field>
                <div className="flex gap-2">
                  <Button size="sm" onClick={guardarTipo} disabled={guardandoTipo}>
                    <CheckIcon data-icon="inline-start" />
                    {guardandoTipo ? "Guardando..." : "Guardar tipo"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCreandoTipo(false)
                      setNombreTipoNuevo("")
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {tiposFiltrados.length === 0 ? (
              <Empty className="border">
                <EmptyMedia variant="icon">
                  <TagsIcon />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>Sin tipos disponibles</EmptyTitle>
                  <EmptyDescription>
                    {busquedaTipos.trim()
                      ? "Ningún tipo coincide con tu búsqueda."
                      : "Crea el primer tipo de encuesta con el botón +."}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent />
              </Empty>
            ) : (
              <FieldSet>
                <FieldLegend variant="label">Tipos disponibles</FieldLegend>
                <div className="flex flex-col gap-1.5">
                  {tiposFiltrados.map((tipo) => (
                    <Field key={tipo._id} orientation="horizontal" className="items-center gap-2.5">
                      <Checkbox
                        id={`tipo-${tipo._id}`}
                        checked={tiposSeleccionados.includes(tipo._id)}
                        onCheckedChange={() => toggleTipo(tipo._id)}
                      />
                      <FieldLabel htmlFor={`tipo-${tipo._id}`} className="font-normal">
                        {tipo.nombre}
                      </FieldLabel>
                    </Field>
                  ))}
                </div>
              </FieldSet>
            )}
          </div>
        )}

        {tab === "preguntas" && (
          <div className="mt-6 flex flex-col gap-4">
            {preguntas.length === 0 ? (
              <Empty className="border">
                <EmptyMedia variant="icon">
                  <ListChecksIcon />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>Sin preguntas</EmptyTitle>
                  <EmptyDescription>
                    Agrega la primera pregunta para empezar a armar tu encuesta.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent />
              </Empty>
            ) : (
              <div className="flex flex-col gap-4">
                {preguntas.map((p, indice) => (
                  <Card key={p.key}>
                    <CardHeader className="flex flex-row items-center justify-between gap-2">
                      <CardTitle className="text-sm">Pregunta {indice + 1}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => quitarPregunta(p.key)}
                        aria-label={`Eliminar pregunta ${indice + 1}`}
                      >
                        <Trash2Icon />
                      </Button>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <Field>
                        <FieldLabel htmlFor={`texto-${p.key}`}>Pregunta</FieldLabel>
                        <Input
                          id={`texto-${p.key}`}
                          placeholder="Escribe la pregunta..."
                          value={p.texto}
                          onChange={(e) => actualizarPregunta(p.key, { texto: e.target.value })}
                        />
                      </Field>

                      <Field>
                        <FieldLabel htmlFor={`tipo-${p.key}`}>Tipo de pregunta</FieldLabel>
                        <Select
                          items={itemsTipoPregunta}
                          value={p.tipoPregunta || null}
                          onValueChange={(v) => actualizarPregunta(p.key, { tipoPregunta: v ?? "" })}
                        >
                          <SelectTrigger id={`tipo-${p.key}`} className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {itemsTipoPregunta.map((item) => (
                                <SelectItem key={item.value ?? "null"} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>

                      {esTipoConOpciones(p.tipoPregunta) && (
                        <FieldSet>
                          <FieldLegend variant="label">Opciones</FieldLegend>
                          <div className="flex flex-col gap-2">
                            {p.opciones.map((opcion, j) => (
                              <div key={j} className="flex items-center gap-2">
                                <Input
                                  value={p.opciones[j]}
                                  onChange={(e) => {
                                    const opciones = [...p.opciones]
                                    opciones[j] = e.target.value
                                    actualizarPregunta(p.key, { opciones })
                                  }}
                                  placeholder={`Opción ${j + 1}`}
                                  aria-label={`Opción ${j + 1} de la pregunta ${indice + 1}`}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => {
                                    const opciones = p.opciones.filter((_, k) => k !== j)
                                    actualizarPregunta(p.key, { opciones })
                                  }}
                                  aria-label={`Eliminar opción ${j + 1}`}
                                >
                                  <XIcon />
                                </Button>
                              </div>
                            ))}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-fit"
                            onClick={() => actualizarPregunta(p.key, { opciones: [...p.opciones, ""] })}
                          >
                            <PlusIcon data-icon="inline-start" />
                            Agregar opción
                          </Button>
                        </FieldSet>
                      )}

                      {p.tipoPregunta === "numerico" && (
                        <div className="flex gap-3">
                          <Field className="flex-1">
                            <FieldLabel htmlFor={`min-${p.key}`}>Valor mínimo</FieldLabel>
                            <Input
                              id={`min-${p.key}`}
                              type="number"
                              placeholder="Sin mínimo"
                              value={p.min}
                              onChange={(e) => actualizarPregunta(p.key, { min: e.target.value })}
                            />
                          </Field>
                          <Field className="flex-1">
                            <FieldLabel htmlFor={`max-${p.key}`}>Valor máximo</FieldLabel>
                            <Input
                              id={`max-${p.key}`}
                              type="number"
                              placeholder="Sin máximo"
                              value={p.max}
                              onChange={(e) => actualizarPregunta(p.key, { max: e.target.value })}
                            />
                          </Field>
                        </div>
                      )}

                      <Field orientation="horizontal" className="items-center gap-2.5">
                        <Checkbox
                          id={`req-${p.key}`}
                          checked={p.requerida}
                          onCheckedChange={(chequeado) => actualizarPregunta(p.key, { requerida: chequeado === true })}
                        />
                        <FieldLabel htmlFor={`req-${p.key}`} className="font-normal">
                          Pregunta obligatoria
                        </FieldLabel>
                      </Field>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Button variant="outline" className="w-fit" onClick={agregarPregunta}>
              <PlusIcon data-icon="inline-start" />
              Agregar pregunta
            </Button>
          </div>
        )}
      </Tabs>

      <div className="sticky bottom-0 z-30 -mx-4 border-t bg-background/90 px-4 py-3 backdrop-blur-sm md:-mx-8 md:px-8">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-end gap-2">
          <span className="mr-auto hidden text-xs text-muted-foreground md:block">
            Revisa cómo se verá antes de guardar.
          </span>
          <span className="mr-auto text-xs text-muted-foreground md:hidden">
            La previsualización solo está disponible en desktop.
          </span>
          <Button variant="outline" onClick={() => setPreviewAbierto(true)}>
            <EyeIcon data-icon="inline-start" />
            Previsualizar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            <SaveIcon data-icon="inline-start" />
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

      <PreviewPanel open={previewAbierto} onOpenChange={setPreviewAbierto}>
        <SurveyRender
          encuesta={encuestaPreview}
          mode="preview"
          valores={respuestasPreview}
          onChange={(preguntaId, valor) =>
            setRespuestasPreview((prev) => ({ ...prev, [preguntaId]: valor }))
          }
        />
      </PreviewPanel>
    </div>
  )
}
