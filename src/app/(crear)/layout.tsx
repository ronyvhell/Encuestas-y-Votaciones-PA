import { CrearTopbar } from "@/components/crear-topbar"

export default function CrearLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <CrearTopbar />
      <main className="flex flex-1 overflow-x-hidden px-4 py-8 md:px-8">{children}</main>
    </div>
  )
}
