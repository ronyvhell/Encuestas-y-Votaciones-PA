"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { sileo } from "sileo"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { CoverImage } from "@/components/cover-image"
import { SurveyRender } from "@/components/survey-render"
import { PreviewPanel } from "@/components/preview-panel"
import {
  TIPOS_PREGUNTA,
  colorBadge,
  esTipoConOpciones,
} from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { EncuestaUI, RespuestasUI, TipoUI } from "@/lib/types"
import {
  CheckIcon,
  EyeIcon,
  InfoIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

type PreguntaForm = {
  key: string
  texto: string
  tipoPregunta: string
  opciones: string[]
  requerida: boolean
}

let contadorLocal = 0
function nuevaKey() {
  contadorLocal += 1
  return `p-${Date.now()}-${contadorLocal}`
}

function Seccion({
  numero,
  titulo,
  descripcion,
  children,
}: {
  numero: number
  titulo: string
  descripcion: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {numero}
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className="font-heading text-lg font-semibold tracking-tight">{titulo}</h2>
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function BadgeTipoSeleccionado({
  nombre,
  color,
  onRemove,
}: {
  nombre: string
  color: string
  onRemove: () => void
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit items-center gap-1 rounded-full border pl-2.5 pr-1 text-xs font-medium",
        color
      )}
    >
      {nombre}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 transition-colors hover:bg-foreground/10"
        aria-label={`Quitar ${nombre}`}
      >
        <XIcon className="size-3" />
      </button>
    </span>
  )
}

function TipoPreguntaPills({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (tipo: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TIPOS_PREGUNTA.map((tipo, i) => {
        const activo = value === tipo.value
        return (
          <button
            key={tipo.value}
            type="button"
            onClick={() => onChange(activo ? "" : tipo.value)}
            disabled={disabled}
            aria-pressed={activo}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              activo
                ? colorBadge(i)
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tipo.label}
          </button>
        )
      })}
    </div>
  )
}

export function CreateSurveyForm({ encuesta }: { encuesta?: EncuestaUI }) {
  const router = useRouter()
  const esEdicion = !!encuesta
  const bloqueado = esEdicion && (encuesta?.votos ?? 0) > 0

  const [titulo, setTitulo] = useState(encuesta?.titulo ?? "")
  const [descripcion, setDescripcion] = useState(encuesta?.descripcion ?? "")
  const [imagenPortada, setImagenPortada] = useState(encuesta?.imagenPortada ?? "")
  const [subiendoImagen, setSubiendoImagen] = useState(false)

  const [tiposDisponibles, setTiposDisponibles] = useState<TipoUI[]>([])
  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>(
    encuesta?.tipos.map((t) => t._id) ?? []
  )
  const [busquedaTipos, setBusquedaTipos] = useState("")
  const [creandoTipo, setCreandoTipo] = useState(false)
  const [nombreTipoNuevo, setNombreTipoNuevo] = useState("")
  const [guardandoTipo, setGuardandoTipo] = useState(false)

  const [preguntas, setPreguntas] = useState<PreguntaForm[]>(
    encuesta?.preguntas.map((p) => ({
      key: p._id,
      texto: p.texto,
      tipoPregunta: p.tipoPregunta,
      opciones: p.opciones.length > 0 ? p.opciones : ["", ""],
      requerida: p.requerida,
    })) ?? []
  )
  const [guardando, setGuardando] = useState(false)
  const [confirmarAbierto, setConfirmarAbierto] = useState(false)

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

  const tiposSeleccionadosDatos = useMemo(
    () =>
      tiposSeleccionados
        .map((id) => tiposDisponibles.find((t) => t._id === id))
        .filter((t): t is TipoUI => !!t),
    [tiposSeleccionados, tiposDisponibles]
  )

  function actualizarPregunta(key: string, cambios: Partial<PreguntaForm>) {
    setPreguntas((prev) => prev.map((p) => (p.key === key ? { ...p, ...cambios } : p)))
  }

  function agregarPregunta() {
    setPreguntas((prev) => [
      ...prev,
      { key: nuevaKey(), texto: "", tipoPregunta: "", opciones: ["", ""], requerida: false },
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

  function solicitarGuardar() {
    const errores = validarEncuesta()
    if (errores.length > 0) {
      sileo.warning({
        title: "Revisa la encuesta",
        description: errores.join(" · "),
        duration: 8000,
      })
      return
    }
    setConfirmarAbierto(true)
  }

  async function guardar() {
    setConfirmarAbierto(false)

    const errores = validarEncuesta()
    if (errores.length > 0) {
      sileo.warning({
        title: "Revisa la encuesta",
        description: errores.join(" · "),
        duration: 8000,
      })
      return
    }

    const payload = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      imagenPortada,
      tipos: tiposSeleccionados,
      preguntas: preguntas.map((p) => ({
        texto: p.texto.trim(),
        tipoPregunta: p.tipoPregunta,
        opciones: p.opciones.map((o) => o.trim()).filter((o) => o.length > 0),
        requerida: p.requerida,
      })),
    }

    if (esEdicion && encuesta) {
      setGuardando(true)
      try {
        const res = await fetch(`/api/surveys/${encuesta._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const datos = await res.json().catch(() => null)

        if (!res.ok) {
          sileo.warning({
            title: "No se pudieron guardar los cambios",
            description: datos?.error ?? "Intenta de nuevo.",
          })
          return
        }

        sileo.success({ title: "Cambios guardados", description: "Tu encuesta se actualizó." })
        router.push(`/encuestas/${encuesta._id}`)
        router.refresh()
      } catch {
        sileo.error({ title: "Error inesperado", description: "No se pudieron guardar los cambios." })
      } finally {
        setGuardando(false)
      }
      return
    }

    setGuardando(true)

    const promesa = (async () => {
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    tipos: tiposSeleccionadosDatos,
    preguntas: preguntas
      .filter((p) => p.texto.trim())
      .map((p) => ({
        _id: p.key,
        texto: p.texto.trim(),
        tipoPregunta: p.tipoPregunta,
        opciones: p.opciones.map((o) => o.trim()).filter((o) => o.length > 0),
        config: { min: null, max: null },
        requerida: p.requerida,
      })),
    votos: 0,
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {esEdicion ? "Editar encuesta" : "Crear encuesta"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {esEdicion
            ? "Actualiza la información de tu encuesta."
            : "Completa las secciones para armar tu encuesta."}
        </p>
      </div>

      <Seccion
        numero={1}
        titulo="Información"
        descripcion="Los datos generales de la encuesta."
      >
        <FieldGroup>
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
      </Seccion>

      <Separator />

      <Seccion
        numero={2}
        titulo="Tipo de encuesta"
        descripcion="Selecciona uno o varios tipos para clasificarla."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {tiposSeleccionadosDatos.length === 0 ? (
              <span className="text-sm text-muted-foreground">Ningún tipo seleccionado.</span>
            ) : (
              tiposSeleccionadosDatos.map((tipo, i) => (
                <BadgeTipoSeleccionado
                  key={tipo._id}
                  nombre={tipo.nombre}
                  color={colorBadge(i)}
                  onRemove={() => toggleTipo(tipo._id)}
                />
              ))
            )}
          </div>

          <InputGroup>
            <InputGroupInput
              id="buscar-tipos"
              placeholder="Buscar tipo de encuesta..."
              value={busquedaTipos}
              onChange={(e) => setBusquedaTipos(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreandoTipo(true)}
              >
                <PlusIcon data-icon="inline-start" />
                Añadir otro
              </Button>
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
            <p className="text-sm text-muted-foreground">
              {busquedaTipos.trim()
                ? "Ningún tipo coincide con tu búsqueda."
                : "Aún no hay tipos disponibles. Crea el primero con el botón Añadir otro."}
            </p>
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
      </Seccion>

      <Separator />

      <Seccion
        numero={3}
        titulo="Preguntas"
        descripcion="Define las preguntas que responderán las personas."
      >
        <div className="flex flex-col gap-4">
          {bloqueado && (
            <div className="flex items-start gap-2 rounded-2xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <InfoIcon className="mt-0.5 size-4 shrink-0" />
              <p>
                Esta encuesta ya tiene {encuesta?.votos}{" "}
                {encuesta?.votos === 1 ? "voto" : "votos"}, por lo que las preguntas no se pueden
                modificar. Solo puedes editar la información general.
              </p>
            </div>
          )}
          {preguntas.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aún no has agregado preguntas.
            </p>
          )}

          {preguntas.map((p, indice) => (
            <Card key={p.key}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-sm">Pregunta {indice + 1}</CardTitle>
                {!bloqueado && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => quitarPregunta(p.key)}
                    aria-label={`Eliminar pregunta ${indice + 1}`}
                  >
                    <Trash2Icon />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor={`texto-${p.key}`}>Pregunta</FieldLabel>
                  <Input
                    id={`texto-${p.key}`}
                    placeholder="Escribe la pregunta..."
                    value={p.texto}
                    disabled={bloqueado}
                    onChange={(e) => actualizarPregunta(p.key, { texto: e.target.value })}
                  />
                </Field>

                <Field>
                  <FieldLabel>Tipo de pregunta</FieldLabel>
                  <TipoPreguntaPills
                    value={p.tipoPregunta}
                    onChange={(tipo) => actualizarPregunta(p.key, { tipoPregunta: tipo })}
                    disabled={bloqueado}
                  />
                </Field>

                {esTipoConOpciones(p.tipoPregunta) && (
                  <FieldSet>
                    <FieldLegend variant="label">Opciones</FieldLegend>
                    <div className="flex flex-col gap-2">
                      {p.opciones.map((opcion, j) => (
                        <div key={j} className="flex items-center gap-2">
                          <Input
                            value={p.opciones[j]}
                            disabled={bloqueado}
                            onChange={(e) => {
                              const opciones = [...p.opciones]
                              opciones[j] = e.target.value
                              actualizarPregunta(p.key, { opciones })
                            }}
                            placeholder={`Opción ${j + 1}`}
                            aria-label={`Opción ${j + 1} de la pregunta ${indice + 1}`}
                          />
                          {!bloqueado && (
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
                          )}
                        </div>
                      ))}
                    </div>
                    {!bloqueado && (
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
                    )}
                  </FieldSet>
                )}

                <Field orientation="horizontal" className="items-center gap-2.5">
                  <Checkbox
                    id={`req-${p.key}`}
                    checked={p.requerida}
                    disabled={bloqueado}
                    onCheckedChange={(chequeado) => actualizarPregunta(p.key, { requerida: chequeado === true })}
                  />
                  <FieldLabel htmlFor={`req-${p.key}`} className="font-normal">
                    Pregunta obligatoria
                  </FieldLabel>
                </Field>
              </CardContent>
            </Card>
          ))}

          {!bloqueado && (
            <button
              type="button"
              onClick={agregarPregunta}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border p-6 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none"
            >
              <PlusIcon className="size-5" />
              <span className="text-sm font-medium">Agregar pregunta</span>
            </button>
          )}
        </div>
      </Seccion>

      <Separator />

      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Revisa cómo se verá antes de guardar. La previsualización solo está disponible en desktop.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setPreviewAbierto(true)}>
            <EyeIcon data-icon="inline-start" />
            Previsualizar
          </Button>
          <Button onClick={solicitarGuardar} disabled={guardando}>
            <SaveIcon data-icon="inline-start" />
            {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Guardar"}
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmarAbierto} onOpenChange={setConfirmarAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {esEdicion ? "¿Guardar los cambios?" : "¿Guardar esta encuesta?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {esEdicion
                ? "Se actualizará la información de la encuesta."
                : `Se guardará como borrador con ${preguntas.length} ${
                    preguntas.length === 1 ? "pregunta" : "preguntas"
                  }. Podrás publicarla cuando quieras.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Guardar borrador"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
