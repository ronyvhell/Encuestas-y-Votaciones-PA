import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { auth } from "@/auth"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await auth()

  return (
    <SidebarProvider>
      {session?.user && <AppSidebar />}
      <div className="flex min-h-svh w-full flex-1 flex-col">
        <AppHeader
          user={
            session?.user
              ? {
                  id: session.user.id,
                  name: session.user.name ?? undefined,
                  email: session.user.email ?? undefined,
                }
              : null
          }
        />
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </SidebarProvider>
  )
}
