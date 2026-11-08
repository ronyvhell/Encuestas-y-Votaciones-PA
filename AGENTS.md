<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Notas del repositorio

Plataforma de encuestas y votaciones con Next.js 16 (App Router, Turbopack) + React 19. MongoDB vía Mongoose y Auth.js v5 beta. El código de dominio, los textos de UI y los mensajes de error están en **español** — mantén ese idioma (`titulo`, `encuesta`, `preguntas`, `votos`).

## Comandos
- `npm run local` — levanta MongoDB en memoria (`npm run db`) y Next.js juntos; un solo comando para desarrollo (http://localhost:3000, base en `mongodb://127.0.0.1:27017/encuestas`).
- `npm run db` — solo el MongoDB en memoria (`scripts/dev-db.mjs`, puerto 27017, datos efímeros).
- `npm run dev` — solo el servidor Next (requiere una base ya corriendo con `npm run db` o un MongoDB real).
- `npm run lint` — ejecuta `eslint` directamente (no existe `next lint`).
- `npm run build` / `npm run start`.
- No hay runner de tests ni script de typecheck. Usa `npx tsc --noEmit`; los tipos globales de rutas de Next solo existen después de haber corrido `dev`/`build`.
- En PowerShell `npm`/`npx` pueden estar bloqueados por ExecutionPolicy; usa `npm.cmd` / `npx.cmd`.

## Entorno
- `.env.local` (ignorado por git) debe definir `MONGODB_URI` y `AUTH_SECRET`; `src/lib/db.ts` lanza error si falta `MONGODB_URI`. Para local usa `mongodb://127.0.0.1:27017/encuestas` (ver `.env.example`).
- El destino de despliegue es Vercel + MongoDB Atlas en el branch `master`; ver `docs/guia-despliegue.md`.

## Particularidades de Next 16 (no es el Next.js anterior)
- `src/proxy.ts` es el proxy de peticiones (reemplaza a `middleware.ts`); reexporta `auth` como `proxy` y su matcher protege `/dashboard/*` y `/encuestas/nueva`.
- `LayoutProps<"/">`, `PageProps<...>` y `RouteContext<"/api/...">` son helpers generados globalmente — no los importes. En los route handlers, `params` es asíncrono: `const { id } = await ctx.params`.
- El bloque `nextjs-agent-rules` de arriba lo reescribe `next dev`; no lo elimines.

## Arquitectura
- `src/app` App Router: grupos `(app)` (shell con sidebar), `(auth)` (login/registro), `(crear)` (flujo de creación y edición `/encuestas/[id]/editar`); páginas bajo `/encuestas`, `/encuestas/[id]/modelo`, `/dashboard`.
- `src/app/api/*`: `surveys` (GET/POST/DELETE masivo), `surveys/[id]` (GET/PATCH contenido y estado/DELETE), `surveys/[id]/vote`, `surveys/[id]/modelo` (GET/POST/DELETE), `surveys/[id]/modelo/predecir`, `surveys/[id]/export`, `survey-types`, `upload`, `auth/*`.
- `src/lib/db.ts` exporta `connectDB()` con caché — llámalo al inicio de cada handler que toque la base de datos.
- `src/lib/models.ts` usa el patrón `models.X ?? model(...)` para sobrevivir al hot reload. Colecciones: `User`, `SurveyType`, `Encuesta`, `Voto`, `Modelo`.
- `src/lib/constants.ts` (`TIPOS_PREGUNTA`, `esTipoConOpciones`) es la única fuente de verdad de los tipos de pregunta, compartida por la validación de la API y la UI.
- `src/lib/encuesta-input.ts` (`parseEncuestaInput`) centraliza la validación/parseo del cuerpo de una encuesta; lo usan el POST de `surveys` y el PATCH de `surveys/[id]`.
- `src/auth.ts` contiene la configuración de NextAuth; usa `auth()` en server components y handlers.
- `src/lib/modelo/*` es el motor de minería de datos en TypeScript puro (sin Mongoose ni dependencias nativas, así que también se puede importar desde componentes cliente): `dataset.ts` (matriz tabular y binarización de la variable objetivo), `arbol.ts` (J48 con razón de ganancia y poda), `bayes.ts`, `knn.ts`, `bosque.ts`, `metricas.ts` (validación cruzada y métricas), `entrenar.ts` (orquestador), `prediccion.ts`, `analisis.ts` (factores) y `serializar.ts`/`pagina.ts` para la UI.
- `src/components/modelo/*`: panel del modelo (`modelo-panel.tsx`), árbol (`arbol-vista.tsx`), simulador (`simulador.tsx`) y análisis de factores (`factores-analisis.tsx`).

## Modelo predictivo
- Solo el **creador** entrena, predice y elimina versiones: las rutas comparan `encuesta.creador` y responden 403. La página `/encuestas/[id]/modelo` hace `notFound()` si no es el dueño.
- La variable objetivo siempre es **binaria**; `objetivosPosibles()` decide qué preguntas sirven (selección única con 2 opciones, o 3 con una opción «No sé» bajo política, o verdadero/falso).
- Cada entrenamiento crea un documento en `modelos` con `version` incremental; nunca sobrescribe. El artefacto serializado se guarda en `artefacto` (Mixed) junto con `columnas` para poder predecir después.
- Las métricas se calculan con predicciones **fuera de muestra** (validación cruzada estratificada, semilla fija `20261012`); no uses métricas de entrenamiento para reportar.
- La semilla y las particiones son deterministas: mismos datos + misma semilla = mismos resultados.

## Convenciones y trampas
- La UI es shadcn/ui sobre **Base UI** (`@base-ui/react`), estilo `base-rhea`, no Radix. Usa la skill `shadcn` al agregar componentes.
- Los toasts usan `sileo` (`Toaster` en `src/components/providers.tsx`, que además importa `sileo/styles.css`).
- La deduplicación de votos = cookie `vid` httpOnly + (si existe) IP hasheada con SHA-256, aplicada por el índice único `{ encuestaId, voterId }`; los duplicados devuelven 409. En local las IP loopback se ignoran, así que la cookie es el mecanismo efectivo.
- El creador de una encuesta no puede votar en ella: la página le muestra resultados y el POST a `vote` responde 403.
- La edición (`PATCH /api/surveys/[id]` con contenido) solo la puede hacer el creador; si la encuesta ya tiene votos, se actualizan los metadatos pero **no** las preguntas (para no romper los resultados).
- La grilla de `/encuestas` (`SurveyGrid`) permite seleccionar las encuestas propias (manteniendo presionado o con el botón "Seleccionar") y eliminarlas en lote vía `DELETE /api/surveys`.
- Las portadas subidas se guardan en `public/uploads/` (ignorado por git) y se pierden en cada redeploy; en producción usa una URL de imagen.
