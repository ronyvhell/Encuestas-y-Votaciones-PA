"use client"

import Link from "next/link"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon, MoonIcon, SunIcon } from "lucide-react"

export function CrearTopbar() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <div className="flex h-14 items-center justify-between gap-4 border-b px-4 md:px-6">
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<Link href="/encuestas" />}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Volver
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        aria-label="Cambiar tema"
      >
        {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
      </Button>
    </div>
  )
}
