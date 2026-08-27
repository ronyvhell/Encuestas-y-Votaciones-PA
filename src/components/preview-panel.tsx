"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

export function PreviewPanel({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        <Dialog.Popup
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-popover text-popover-foreground shadow-xl outline-none transition duration-300 ease-in-out data-ending-style:translate-x-1/2 data-ending-style:opacity-0 data-starting-style:translate-x-1/2 data-starting-style:opacity-0 sm:max-w-md"
          data-slot="preview-panel"
        >
          <Dialog.Title className="sr-only">Previsualización de la encuesta</Dialog.Title>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-medium">Previsualización</span>
            <Dialog.Close
              render={<Button variant="ghost" size="icon-sm" aria-label="Cerrar previsualización" />}
            >
              <XIcon />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-6">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
