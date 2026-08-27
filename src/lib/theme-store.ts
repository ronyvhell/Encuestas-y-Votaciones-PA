type Tema = "light" | "dark"

const listeners = new Set<() => void>()

function notificar() {
  for (const listener of listeners) listener()
}

export function subscribirTema(callback: () => void): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function claseActual(): Tema {
  if (typeof document === "undefined") return "light"
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

export function getTemaSnapshot(): Tema {
  return claseActual()
}

export function getTemaServerSnapshot(): Tema {
  return "light"
}

export function setTema(tema: Tema) {
  if (typeof document === "undefined") return
  try {
    localStorage.setItem("tema", tema)
  } catch {
    // localStorage puede no estar disponible (navegación privada)
  }
  document.documentElement.classList.toggle("dark", tema === "dark")
  notificar()
}

if (typeof window !== "undefined") {
  const mq = window.matchMedia("(prefers-color-scheme: dark)")

  const aplicarSistema = () => {
    let guardado: string | null = null
    try {
      guardado = localStorage.getItem("tema")
    } catch {
      // ignorar
    }
    if (guardado === "light" || guardado === "dark") return
    document.documentElement.classList.toggle("dark", mq.matches)
    notificar()
  }

  mq.addEventListener("change", aplicarSistema)
  window.addEventListener("storage", aplicarSistema)
}
