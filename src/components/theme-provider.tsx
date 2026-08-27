"use client"

import { createContext, useContext, useSyncExternalStore } from "react"

import {
  getTemaServerSnapshot,
  getTemaSnapshot,
  setTema,
  subscribirTema,
} from "@/lib/theme-store"

const ThemeContext = createContext<{
  resolvedTheme: "light" | "dark"
  setTheme: (tema: "light" | "dark") => void
}>({ resolvedTheme: "light", setTheme: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const resolvedTheme = useSyncExternalStore(
    subscribirTema,
    getTemaSnapshot,
    getTemaServerSnapshot
  )

  return (
    <ThemeContext.Provider value={{ resolvedTheme, setTheme: setTema }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
