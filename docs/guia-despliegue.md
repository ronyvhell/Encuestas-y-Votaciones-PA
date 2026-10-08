# Guía de despliegue — Vercel + MongoDB Atlas

Guía paso a paso para llevar la plataforma a producción:

- **Frontend/API:** Vercel (gratuito, Hobby).
- **Base de datos:** MongoDB Atlas (cluster M0 gratis).

> **Desarrollo local:** este documento cubre el paso a producción. Para trabajar
> en local no necesitas Atlas: usa `npm run local` (MongoDB en memoria). Ver
> `docs/contexto-proyecto.md`.

> **Aviso importante — Imágenes de portada:** el botón "Subir" guarda archivos en
> `public/uploads/`, y en Vercel el sistema de archivos es **efímero**: las
> imágenes subidas **se pierden en cada deploy** (y en cada ejecución). Para
> portadas en producción usa el **campo de URL** (funciona normal). Si quieres
> subida persistente más adelante, hay que integrar un almacenamiento externo
> (Cloudinary, S3, etc.). La URL de ejemplo de imágenes ya funciona sin cambios.

---

## Parte 1 — MongoDB Atlas (base de datos en la nube)

### 1. Crear cuenta y cluster

1. Ve a **https://www.mongodb.com/cloud/atlas/register** y crea una cuenta
   (gratis).
2. Después del login, haz clic en **Create** / **Build a Cluster**.
3. Elige el plan **M0 (Free)** — el cluster se crea solo. Deja la región por
   defecto (o la más cercana a ti, ej. `AWS / sa-east-1` para Sudamérica).
4. Espera ~2-3 minutos a que el cluster esté listo (estado verde
   "ACTIVE").

### 2. Crear usuario de base de datos

1. En el cluster, entra a **Database Access** (menú izquierdo) →
   **Add New Database User**.
2. Crea un usuario, por ejemplo:
   - `Authentication Method`: Password
   - `Username`: `admin`
   - `Password`: elige una contraseña segura (la guardas aparte).
   - `Database User Privileges`: `Read and write to any database`.
3. **Add User**.

### 3. Permitir conexión desde cualquier IP

1. Entra a **Network Access** → **Add IP Address**.
2. Selecciona **Allow access from anywhere** (`0.0.0.0/0`) → **Confirm**.
   - En producción esto abre el acceso público; es lo normal para apps web.
   - La seguridad real la da el usuario/contraseña de la conexión.

### 4. Obtener la cadena de conexión

1. En el cluster → botón **Connect** → **Drivers**.
2. Copia la cadena, que se ve así:

```
mongodb+srv://admin:<tu_password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
```

3. **Reemplaza `<tu_password>` por la contraseña del paso 2** (sin los signos
   `<>`).
4. Opcional: agrega `/encuestas` después del host para nombrar la base, o
   déjalo sin nombre (crea la base `test` por defecto; con Mongoose se puede
   crear cualquier nombre agregando `/encuestas`):

```
mongodb+srv://admin:<tu_password>@cluster0.xxxxx.mongodb.net/encuestas?retryWrites=true&w=majority&appName=Cluster0
```

### 5. Probar en local

Reemplaza el `MONGODB_URI` de tu `.env.local` con la cadena de Atlas y corre
`npm run dev`. Si todo funciona (puedes crear una encuesta), la base está en
la nube. Los datos locales **no se copian solos** — ver "Migrar datos" abajo.

---

## Parte 2 — Vercel (despliegue)

> El proyecto ya está en GitHub (`ronyvhell/PA---Encuestas-y-Votaciones`) con
> el branch `master`, así que lo más simple es importarlo desde el dashboard.

### Opción A — Desde el dashboard (recomendada)

1. Entra a **https://vercel.com** e inicia sesión (puedes usar tu cuenta de
   GitHub).
2. **Add New... → Project** → busca el repo
   `PA---Encuestas-y-Votaciones` y haz clic en **Import**.
   - Si no aparece, dale a **Adjust GitHub App Permissions** y autoriza el
     repo.
3. Vercel detecta Next.js solo. En la sección **Environment Variables**
   agrega las dos variables:

| Nombre         | Valor                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| `MONGODB_URI`  | La cadena de Atlas del paso 1.4 (con tu password real)                  |
| `AUTH_SECRET`  | Clave secreta de sesiones (generada abajo en el paso 2.4)               |

4. Clic en **Deploy**. En ~2 minutos tendrás tu app en línea
   (`https://pa-encuestas-y-votaciones.vercel.app`).
5. Deploy automático: cada push a `master` en GitHub dispara un nuevo
   deploy.

### Opción B — Con la CLI de Vercel

1. `npm i -g vercel` y `vercel login` (te abre el navegador).
2. En la carpeta del proyecto: `vercel` → responde las preguntas (linkea el
   proyecto, presiona Enter para los defaults).
3. `vercel env add MONGODB_URI` y `vercel env add AUTH_SECRET` (production,
   preview, development).
4. `vercel --prod` para el primer deploy.

### Variables de entorno (resumen)

- **`MONGODB_URI`** — cadena de conexión de Atlas. **Obligatoria** (la app no
  arranca sin ella).
- **`AUTH_SECRET`** — secreto de sesiones de Auth.js. **Obligatoria** en
  producción. Genera una con: `openssl rand -base64 32`
  (ejemplo ya generado: `6CVON2RAO4pVffwy9/zRWbMD5yKxpkgBHRS7fjuFVqs=`).
- No hace falta `AUTH_TRUST_HOST` ni `NEXTAUTH_URL`: el código ya usa
  `trustHost: true`.

> `AUTH_SECRET` **no** debe ser el mismo para siempre si el proyecto cambia de
> manos; si lo cambias, todas las sesiones se invalidan (todos vuelven a
> iniciar sesión, los votos se conservan).

---

## Parte 3 — Migrar los datos locales (opcional)

Los usuarios/encuestas/votos de tu MongoDB local **no** se copian a Atlas
automáticamente. Para migrarlos (si los quieres conservar):

1. **mongodump** de la base local:
   ```
   mongodump --db encuestas --out ./backup
   ```
2. **mongorestore** hacia Atlas:
   ```
   mongorestore --uri "mongodb+srv://admin:<password>@cluster0.xxxxx.mongodb.net" --nsInclude "encuestas.*" ./backup/encuestas
   ```

---

## Parte 4 — Verificación final

1. Abre la URL de Vercel → crea un usuario → inicia sesión.
2. Crea una encuesta (borrador), publícala y respóndela desde otra pestaña en
   modo incógnito (verás el bloqueo de doble voto por IP).
3. Abre la consola de Atlas → **Browse Collections** en la base `encuestas` y
   confirma que aparecen `users`, `surveytypes`, `encuestas` y `votos`.
4. Prueba el botón **Compartir** de una encuesta publicada (copia el link y
   ábrelo en incógnito).
