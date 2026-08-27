"use client"

import { useRouter } from "next/navigation"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cerrarSesion } from "@/lib/actions"
import {
  ClipboardListIcon,
  LogOutIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
} from "lucide-react"

export function AppHeader({ user }: { user: { id: string; name?: string; email?: string } | null }) {
  const { resolvedTheme, setTheme } = useTheme()
  const router = useRouter()
  const autenticado = !!user

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2">
        {autenticado && <SidebarTrigger />}
      </div>

      <div className="flex items-center gap-2">
        {!autenticado ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => router.push("/login")}>
              <PlusIcon data-icon="inline-start" />
              Crear encuesta
            </Button>
            <Button variant="default" size="sm" onClick={() => router.push("/login")}>
              Iniciar sesión
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Cambiar tema"
            >
              {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
            </Button>

            <Button variant="default" size="sm" onClick={() => router.push("/encuestas/nueva")}>
              <PlusIcon data-icon="inline-start" />
              Crear Encuesta
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/encuestas")}>
              <ClipboardListIcon data-icon="inline-start" />
              Visualizar Encuestas
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Cuenta" />
                }
              >
                <Avatar className="size-6">
                  <AvatarFallback className="text-xs">
                    {(user.name ?? user.email ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex flex-col">
                    <span className="truncate text-sm font-medium">{user.name}</span>
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {user.email}
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    cerrarSesion()
                  }}
                >
                  <LogOutIcon data-icon="inline-start" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </header>
  )
}
