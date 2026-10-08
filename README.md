# PA — Encuestas y Votaciones

Plataforma para crear encuestas, publicarlas y votar en ellas.

- **Stack:** Next.js 16 (App Router, Turbopack) + React 19, MongoDB vía Mongoose, Auth.js v5.
- **Producción:** Vercel (branch `master`) + MongoDB Atlas.
- **Colecciones:** `users`, `surveytypes`, `encuestas`, `votos` (base `encuestas`).

---

## 1. Requisitos

- **Node.js 20+** y npm.
- **MongoDB**, una de estas dos opciones:
  - Tu servidor MongoDB local (recomendado si quieres que los datos persistan).
  - El MongoDB en memoria incluido en el proyecto (`npm run db`), sin instalar nada; los datos se borran al detenerlo.
- **MongoDB Database Tools** (`mongodump` / `mongorestore`) solo si vas a migrar datos a Atlas:
  ```powershell
  winget install MongoDB.DatabaseTools
  ```
  (o descárgalas desde https://www.mongodb.com/try/download/database-tools y agrega la carpeta `bin` al `PATH`).

> En PowerShell, si `npm`/`npx` están bloqueados por ExecutionPolicy, usa `npm.cmd` / `npx.cmd`.

---

## 2. Configuración

```powershell
npm install
copy .env.example .env.local
```

Edita `.env.local`:

| Variable      | Descripción                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| `MONGODB_URI` | Cadena de conexión. Local: `mongodb://127.0.0.1:27017/encuestas`             |
| `AUTH_SECRET` | Secreto de sesiones de Auth.js. Genera uno con `npx auth secret` o `openssl rand -base64 32` |

`MONGODB_URI` es obligatoria: la app lanza un error si falta. No hace falta `NEXTAUTH_URL` ni `AUTH_TRUST_HOST` (el código usa `trustHost: true`).

---

## 3. Ejecutar en local

### Opción A — Con tu MongoDB local (datos persistentes)

1. Asegúrate de que el servicio de MongoDB esté corriendo en tu servidor local (por defecto `127.0.0.1:27017`). En Windows:
   ```powershell
   Get-Service MongoDB        # debe decir Running
   Start-Service MongoDB      # si está detenido
   ```
2. Apunta `MONGODB_URI` en `.env.local` a ese servidor, p. ej. `mongodb://127.0.0.1:27017/encuestas` (o la IP/usuario de tu servidor: `mongodb://usuario:password@192.168.x.x:27017/encuestas?authSource=admin`).
3. Levanta solo Next.js:
   ```powershell
   npm run dev
   ```

> **No uses `npm run local` en este caso:** ese comando arranca además el MongoDB en memoria en el mismo puerto 27017 y chocaría con tu servidor.

### Opción B — Con MongoDB en memoria (sin instalar nada)

```powershell
npm run local
```

Levanta el MongoDB en memoria (`scripts/dev-db.mjs`) y Next.js juntos. Los datos son efímeros.

En ambos casos la app queda en **http://localhost:3000**. Las colecciones se crean solas al registrar el primer usuario / crear la primera encuesta.

### Otros comandos

| Comando             | Qué hace                                           |
| ------------------- | -------------------------------------------------- |
| `npm run build`     | Build de producción                                 |
| `npm run start`     | Sirve el build de producción                        |
| `npm run lint`      | ESLint                                              |
| `npx tsc --noEmit`  | Chequeo de tipos (después de haber corrido `dev`/`build`) |

---

## 4. Restaurar producción (Atlas caído + Vercel)

El proyecto ya está en Vercel; lo que falta es tener de nuevo una base en Atlas, cargarle los datos desde tu MongoDB local y apuntar Vercel a ella.

### 4.1 Recuperar o crear el cluster en Atlas

1. Entra a https://cloud.mongodb.com.
2. Si el cluster aparece **Paused** (los M0 gratuitos se pausan tras inactividad), pulsa **Resume** y espera a que quede en verde. Si fue eliminado, crea uno nuevo: **Create → M0 (Free)**.
3. **Database Access → Add New Database User**: usuario + contraseña con rol *Read and write to any database* (o verifica que el anterior siga existiendo).
4. **Network Access → Add IP Address → Allow access from anywhere** (`0.0.0.0/0`). Vercel no tiene IP fija, así que es necesario. **No marques** la casilla *"This entry is temporary and will be deleted in…"*: si la marcas, Atlas borra la regla al cumplirse el plazo (p. ej. 1 semana) y la app deja de conectarse. Lo mismo aplica al usuario de base de datos (*Temporary User*).
5. **Connect → Drivers** y copia la cadena. Agrega el nombre de la base `/encuestas` antes del `?`:
   ```
   mongodb+srv://USUARIO:PASSWORD@cluster0.xxxxx.mongodb.net/encuestas?retryWrites=true&w=majority&appName=Cluster0
   ```
   Si la contraseña tiene caracteres especiales (`@ : / ? # %`), codifícalos en URL (p. ej. `@` → `%40`).

### 4.2 Copiar los datos de tu MongoDB local a Atlas

Con el MongoDB local corriendo:

```powershell
# 1. Exportar la base local
mongodump --uri "mongodb://127.0.0.1:27017/encuestas" --out .\backup

# 2. Importarla en Atlas (--drop reemplaza lo que haya en Atlas con lo local)
mongorestore --uri "mongodb+srv://USUARIO:PASSWORD@cluster0.xxxxx.mongodb.net" --nsInclude "encuestas.*" --drop .\backup
```

Verifica en Atlas → **Browse Collections** que la base `encuestas` tenga `users`, `surveytypes`, `encuestas` y `votos`.

> La carpeta `backup/` contiene datos de usuarios (hashes de contraseñas incluidos): no la subas a git.

Si no necesitas conservar datos, puedes saltarte este paso: la app crea las colecciones sola.

### 4.3 Probar Atlas desde local (opcional pero recomendado)

Cambia temporalmente `MONGODB_URI` en `.env.local` por la cadena de Atlas, corre `npm run dev` e inicia sesión con un usuario existente. Si funciona, la cadena es correcta. Luego vuelve a dejar la URI local.

### 4.4 Actualizar Vercel

1. Vercel → tu proyecto → **Settings → Environment Variables**.
2. Edita `MONGODB_URI` con la nueva cadena de Atlas (entornos *Production* y *Preview*).
3. Verifica que `AUTH_SECRET` exista. Si lo cambias, todas las sesiones se cierran (los datos se conservan).
4. **Redeploy obligatorio:** los cambios de variables no se aplican a deploys existentes. Ve a **Deployments → (último) → ⋯ → Redeploy**, o haz push a `master`.

Con la CLI (alternativa):

```powershell
npm i -g vercel
vercel login
vercel link
vercel env rm MONGODB_URI production
vercel env add MONGODB_URI production
vercel --prod
```

### 4.5 Verificación

1. Abre la URL de Vercel e inicia sesión (o regístrate).
2. Crea y publica una encuesta; vota desde una ventana de incógnito.
3. Si algo falla: Vercel → **Deployments → Logs / Runtime Logs**. Errores típicos:
   - `MONGODB_URI no está definida` → falta la variable o no se hizo redeploy.
   - `MongoServerSelectionError` / timeout → falta `0.0.0.0/0` en Network Access o el cluster sigue pausado.
   - `bad auth : authentication failed` → usuario/contraseña incorrectos o sin codificar.

Más detalle en [`docs/guia-despliegue.md`](docs/guia-despliegue.md).

---

## 5. Notas

- **Portadas subidas:** se guardan en `public/uploads/`, que en Vercel es efímero (se pierden en cada deploy). En producción usa una **URL de imagen** como portada.
- **Votos duplicados:** se evitan con una cookie `vid` + IP hasheada; en local la IP loopback se ignora, así que solo aplica la cookie.
- El creador de una encuesta no puede votar en ella; ve directamente los resultados.
- Si una encuesta ya tiene votos, al editarla solo cambian los metadatos, no las preguntas.
