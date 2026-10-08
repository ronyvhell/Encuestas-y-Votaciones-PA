"use client"

import "sileo/styles.css"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "sileo"
import { useTheme } from "@/components/theme-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()

  return (
    <TooltipProvider>
      {children}
      <Toaster position="top-center" theme={resolvedTheme} />
    </TooltipProvider>
  )
}
