"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { ClipboardListIcon, LayoutDashboardIcon, SearchIcon } from "lucide-react"

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const qUrl = searchParams.get("q") ?? ""
  const [termino, setTermino] = useState(qUrl)

  const [prevQ, setPrevQ] = useState(qUrl)
  if (pathname === "/encuestas" && prevQ !== qUrl) {
    setPrevQ(qUrl)
    setTermino(qUrl)
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      const q = termino.trim()
      router.replace(q ? `/encuestas?q=${encodeURIComponent(q)}` : "/encuestas")
    }, 350)
    return () => clearTimeout(timeout)
  }, [termino, router])

  return (
    <Sidebar variant="sidebar">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex size-7 items-center justify-center rounded-xl bg-primary text-xs font-semibold text-primary-foreground">
            PA
          </div>
          <span className="truncate text-sm font-medium">Encuestas y Votaciones</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/dashboard")}
                  render={<Link href="/dashboard" />}
                >
                  <LayoutDashboardIcon data-icon="inline-start" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/encuestas")}
                  render={<Link href="/encuestas" />}
                >
                  <ClipboardListIcon data-icon="inline-start" />
                  <span>Encuestas</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarGroup>
          <SidebarGroupLabel>Buscar encuestas</SidebarGroupLabel>
          <SidebarGroupContent>
            <InputGroup>
              <InputGroupInput
                placeholder="Buscar por nombre..."
                value={termino}
                onChange={(e) => setTermino(e.target.value)}
                aria-label="Buscar encuestas"
              />
              <InputGroupAddon align="inline-end">
                <SearchIcon />
              </InputGroupAddon>
            </InputGroup>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  )
}
