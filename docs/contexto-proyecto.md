# Plataforma de Encuestas y Votaciones — Contexto del Proyecto

## ¿Qué es este proyecto?

Una plataforma web para **crear encuestas breves**, publicarlas y permitir que
cualquier persona las responda (con un límite de **un voto por dispositivo/IP**).
Además incluye un **modelo predictivo que se entrena, se visualiza y se
reentrena dentro de la propia aplicación**.

Incluye:

- Registro e inicio de sesión de usuarios.
- Dashboard con estadísticas generales.
- Creación de encuestas en 3 pasos (tabs): información, tipo y preguntas.
- Previsualización en vivo de la encuesta (panel lateral, solo desktop).
- Estado **borrador / publicada** con publicación en 1 clic.
- Grilla de encuestas con búsqueda en tiempo real.
- Resultados de votación con barras de progreso.
- Análisis de **todos los factores** de la encuesta (promedios, distribución y
  porcentaje de la clase positiva por grupo).
- **Modelo predictivo binario** entrenado en la app, con comparación de
  algoritmos, árbol de decisión, reglas, matriz de confusión y simulador.
- **Reentrenamiento con los votos actuales**, conservando el historial de
  versiones.
- Exportación de datos a CSV y ARFF (Weka) solo para el creador.
- Tema claro/oscuro que sigue al sistema (con botón para alternar).
- Notificaciones (toasts) para todas las acciones.

---

## Stack (tecnologías)

- **Next.js 16** (App Router, TypeScript, Turbopack) con **React 19**.
- **Tailwind CSS v4** + **shadcn/ui** — interfaz con el diseño del preset
  `b3mPGFjE0` (estilo `base-rhea`, monocromático minimalista, iconos Lucide).
- **Sileo** — sistema de notificaciones (toasts).
- **Auth.js (NextAuth v5)** — login y registro con correo y contraseña,
  contraseñas cifradas con **bcrypt**, sesiones por cookie segura.
- **MongoDB** vía **Mongoose 9** como capa de acceso a datos. En desarrollo se
  levanta **en memoria** con `mongodb-memory-server` (no hay que instalar
  MongoDB; los datos son efímeros). En producción se usa MongoDB Atlas.
- **Motor de minería de datos propio** (`src/lib/modelo/`) en TypeScript puro:
  árbol de decisión J48, Naive Bayes, k-NN y bosque aleatorio, con validación
  cruzada estratificada. Sin dependencias nativas ni servicios externos, por lo
  que funciona en Vercel.

---

## Cómo levantarlo

1. Instala dependencias: `npm install`.
2. Levanta todo con un solo comando: `npm run local` (inicia MongoDB en memoria
   en `127.0.0.1:27017` y Next.js) → abre `http://localhost:3000`.
   - Alternativa en dos terminales: `npm run db` (base) y luego `npm run dev`
     (servidor).
   - La primera ejecución descarga el binario de MongoDB (~100 MB) una sola vez.
3. Otros comandos: `npm run build` (build de producción), `npm run lint`
   (revisión de código), `npm run start` (servir el build).
4. Configuración en `.env.local` (copia de `.env.example`):
   - `MONGODB_URI` — `mongodb://127.0.0.1:27017/encuestas` para local; la
     cadena de Atlas para producción.
   - `AUTH_SECRET` — clave secreta de las sesiones.

> **Datos en local:** el MongoDB en memoria se borra al cerrar el proceso (y se
> vuelve a sembrar solo los tipos por defecto). Para conservar datos, apunta
> `MONGODB_URI` a un MongoDB real o a Atlas; el código no cambia.

---

## Base de datos (estructura explicada)

La base se llama `encuestas` y guarda **5 colecciones** relacionadas entre sí:

- **`users` (Usuarios)** — las cuentas de la plataforma: nombre, correo
  (único) y contraseña cifrada.
- **`surveystypes` (Tipos de encuesta)** — los tipos disponibles para
  clasificar encuestas (ej. "Satisfacción", "Eventos"). Se pueden crear nuevos
  desde la interfaz con el botón "+".
- **`encuestas` (Encuestas)** — el corazón del sistema. Cada encuesta tiene:
  título, descripción, imagen de portada, estado (borrador/publicada) y su
  creador. Guarda sus **preguntas dentro de sí misma** (embebidas) y se
  relaciona con los **tipos** que el usuario haya seleccionado.
- **`votos` (Votos/Respuestas)** — cada respuesta enviada a una encuesta,
  con un identificador del votante (cookie o huella de IP) que **evita votar
  dos veces**, y las respuestas a cada pregunta.
- **`modelos` (Modelos predictivos)** — una **versión por entrenamiento**:
  algoritmo, métricas, matriz de confusión, variables, reglas y el artefacto
  serializado con el que se predicen casos nuevos.

**Relaciones:** una encuesta pertenece a un **usuario** (creador), se clasifica
con uno o varios **tipos**, contiene varias **preguntas**, recibe muchos
**votos** y puede tener varias **versiones de modelo**.

---

## Cómo está organizado el código

- `src/app` — las páginas y la API:
  - Páginas: `/encuestas` (grilla), `/encuestas/nueva` (crear),
    `/encuestas/[id]` (detalle/votar), `/encuestas/[id]/modelo` (modelo
    predictivo), `/dashboard`, `/login`, `/registro`.
  - API: `/api/auth/*` (login, registro), `/api/surveys` (encuestas),
    `/api/surveys/[id]/vote` (votación), `/api/surveys/[id]/modelo` (entrenar
    y consultar), `/api/surveys/[id]/modelo/predecir` (predicción),
    `/api/surveys/[id]/export` (CSV/ARFF), `/api/survey-types` (tipos),
    `/api/upload` (imágenes de portada).
- `src/components` — piezas de interfaz (reutilizables) y componentes UI.
- `src/components/modelo` — panel del modelo: árbol, simulador, análisis de
  factores.
- `src/lib` — conexión a la base de datos, modelos, constantes y utilidades.
- `src/lib/modelo` — motor de minería de datos: dataset, árbol J48, Naive Bayes,
  k-NN, bosque, métricas, predicción y entrenamiento.

---

## Modelo predictivo (dentro de la app)

- **Acceso:** creador de la encuesta → botón **Modelo predictivo** (o
  `/encuestas/[id]/modelo`). La API responde 403 a cualquier otro usuario.
- **Variable objetivo:** se elige entre las preguntas que producen **dos
  clases** (selección única con dos opciones, o verdadero/falso). Si la pregunta
  tiene «No sé», se decide si excluir esos votos o contarlos como la clase
  negativa.
- **Entrenamiento:** validación cruzada estratificada (5 particiones) y
  comparación de 4 algoritmos; el artefacto final se entrena con todos los votos.
- **Visualización:** métricas, matriz de confusión, árbol navegable, reglas
  `SI … ENTONCES …`, importancia de variables, ejemplos reales y simulador.
- **Reentrenamiento:** cada ejecución guarda una **versión nueva**; el historial
  conserva las anteriores con sus métricas.

---

## Producción: MongoDB Atlas (online)

Para producción, la base de datos vive en **MongoDB Atlas** (nube, gratis en su
plan M0), de modo que la plataforma funcione sin depender del equipo local.

**Cómo funciona:** el código no cambia (Mongoose se conecta igual a local o a la
nube). Solo hay que:

1. Crear la cuenta y el cluster en `cloud.mongodb.com`.
2. Copiar la cadena de conexión que entrega Atlas.
3. Reemplazar `MONGODB_URI` en `.env.local` por esa cadena.
4. Listo: la app sigue trabajando igual, pero con la base en línea.

> Nota: al pasar a Atlas, las encuestas, usuarios y votos de la base local
> **no se copian automáticamente**; habría que migrar los datos si se quieren
> conservar (ver `docs/guia-despliegue.md`).
