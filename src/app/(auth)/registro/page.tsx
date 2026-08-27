"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { sileo } from "sileo"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { UserPlusIcon } from "lucide-react"

export default function RegistroPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmar, setConfirmar] = useState("")

  async function registrarse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCargando(true)

    try {
      const respuesta = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, password, confirmar }),
      })

      const datos = await respuesta.json().catch(() => null)

      if (respuesta.ok) {
        sileo.success({
          title: "Cuenta creada",
          description: "Ahora puedes iniciar sesión.",
        })
        router.push("/login")
        return
      }

      if (respuesta.status === 409 || respuesta.status === 400) {
        sileo.warning({
          title: "Revisa los datos",
          description: datos?.error ?? "Algo salió mal con el registro.",
        })
        return
      }

      sileo.error({
        title: "Error inesperado",
        description: "Intenta de nuevo en unos momentos.",
      })
    } catch {
      sileo.error({
        title: "Error inesperado",
        description: "Intenta de nuevo en unos momentos.",
      })
    } finally {
      setCargando(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Crear cuenta</CardTitle>
        <CardDescription>
          Regístrate para crear y administrar encuestas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={registrarse} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nombre">Nombre</FieldLabel>
              <Input
                id="nombre"
                autoComplete="name"
                required
                minLength={2}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field data-invalid={confirmar.length > 0 && confirmar !== password}>
              <FieldLabel htmlFor="confirmar">Confirmar contraseña</FieldLabel>
              <Input
                id="confirmar"
                type="password"
                autoComplete="new-password"
                required
                aria-invalid={confirmar.length > 0 && confirmar !== password}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
              />
              {confirmar.length > 0 && confirmar !== password && (
                <FieldError>Las contraseñas no coinciden.</FieldError>
              )}
            </Field>
          </FieldGroup>

          <Button type="submit" disabled={cargando} className="w-full">
            <UserPlusIcon data-icon="inline-start" />
            {cargando ? "Creando cuenta..." : "Registrarme"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
              Inicia sesión aquí
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
