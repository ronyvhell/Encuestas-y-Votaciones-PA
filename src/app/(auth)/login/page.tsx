"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { sileo } from "sileo"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { LogInIcon } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  async function iniciarSesion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCargando(true)

    try {
      const resultado = await signIn("credentials", {
        redirect: false,
        email,
        password,
      })

      if (resultado?.error) {
        sileo.error({
          title: "No pudimos iniciar sesión",
          description: "Revisa tu correo y contraseña.",
        })
        return
      }

      sileo.success({ title: "Sesión iniciada", description: "¡Bienvenido de nuevo!" })
      router.push("/dashboard")
      router.refresh()
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
        <CardTitle className="text-xl">Iniciar sesión</CardTitle>
        <CardDescription>
          Ingresa con tu correo y contraseña para administrar encuestas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={iniciarSesion} className="flex flex-col gap-5">
          <FieldGroup>
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
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          </FieldGroup>

          <Button type="submit" disabled={cargando} className="w-full">
            <LogInIcon data-icon="inline-start" />
            {cargando ? "Entrando..." : "Entrar"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-medium text-foreground underline underline-offset-4">
              Regístrate aquí
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
