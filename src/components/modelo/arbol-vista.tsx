"use client"

import { contarNodos, profundidadArbol, redondear, type NodoArbol } from "@/lib/modelo/arbol"
import { cn } from "@/lib/utils"

function sumaDistribucion(distribucion: Record<string, number>): number {
  return Object.values(distribucion).reduce((suma, valor) => suma + valor, 0)
}

function Nodo({
  nodo,
  clasePositiva,
}: {
  nodo: NodoArbol
  clasePositiva: string
}) {
  if (nodo.tipo === "hoja") {
    const total = sumaDistribucion(nodo.distribucion)
    const probabilidad = total > 0 ? (nodo.distribucion[clasePositiva] ?? 0) / total : 0
    const positiva = nodo.clase === clasePositiva

    return (
      <div
        className={cn(
          "inline-flex w-fit flex-col gap-0.5 rounded-xl border px-3 py-2 text-xs",
          positiva
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
            : "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300"
        )}
      >
        <span className="font-semibold">{nodo.clase}</span>
        <span className="opacity-80">
          n = {nodo.n} · P({clasePositiva}) = {Math.round(probabilidad * 100)}%
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="inline-flex w-fit items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs font-medium shadow-xs">
        <span>
          {nodo.criterio === "numerico"
            ? `${nodo.texto} ≤ ${redondear(nodo.umbral ?? 0)}`
            : nodo.texto}
        </span>
        <span className="text-muted-foreground">n = {nodo.n}</span>
      </div>

      <div className="ml-2 flex flex-col gap-3 border-l border-dashed pl-4">
        {nodo.ramas.map((rama) => (
          <div key={rama.valor} className="flex flex-col gap-1.5">
            <span className="w-fit text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {nodo.criterio === "numerico"
                ? rama.valor === "<="
                  ? `≤ ${redondear(nodo.umbral ?? 0)}`
                  : `> ${redondear(nodo.umbral ?? 0)}`
                : rama.valor}{" "}
              · n = {rama.n}
            </span>
            <Nodo nodo={rama.nodo} clasePositiva={clasePositiva} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ArbolVista({
  arbol,
  clasePositiva,
}: {
  arbol: NodoArbol
  clasePositiva: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{contarNodos(arbol)} nodos</span>
        <span aria-hidden>·</span>
        <span>profundidad {profundidadArbol(arbol)}</span>
        <span aria-hidden>·</span>
        <span>la clase positiva es «{clasePositiva}»</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-muted/20 p-4">
        <Nodo nodo={arbol} clasePositiva={clasePositiva} />
      </div>
    </div>
  )
}
