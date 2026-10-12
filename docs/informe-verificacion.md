# Informe de verificación y entregables — PA Encuestas y Votaciones

Este documento resume la verificación de los datos del seed, los entregables
generados y cómo subir todo a producción.

---

## 1. Verificación de los datos (seed)

El script [`scripts/seed-encuesta.mjs`](../scripts/seed-encuesta.mjs) genera una
encuesta de clima laboral con **420 votos y 11 preguntas**. La verificación
([`scripts/verificar-seed.mjs`](../scripts/verificar-seed.mjs)) dio estos resultados:

| Verificación | Resultado |
| --- | --- |
| Votos esperados vs. exportados | 420 / 420 ✅ |
| Respuestas por voto | 11 de 11 ✅ |
| Valores faltantes | 0 ✅ |
| `voterId` duplicados | 0 ✅ |
| `encuestaId` consistente en todos los votos | Sí ✅ |
| Fechas dentro del rango (jun–oct 2026) | Sí ✅ |

### Variables

| Variable | Tipo | Valores / escala |
| --- | --- | --- |
| `area` | nominal | Administrativa, Operativa, Comercial, Tecnología, Talento humano |
| `antiguedad` | nominal | Menos de 1 año, 1 a 3 años, 3 a 5 años, Más de 5 años |
| `edad` | nominal | 18 a 25, 26 a 35, 36 a 45, 46 o más |
| `modalidad` | nominal | Presencial, Híbrida, Remota |
| `comunicacion` | numérica 1–5 | claridad de la comunicación |
| `reconocimiento` | numérica 1–5 | reconocimiento del trabajo |
| `carga` | numérica 1–5 | sostenibilidad de la carga laboral |
| `equipo` | numérica 1–5 | ambiente del equipo |
| `salario` | numérica 1–5 | satisfacción salarial |
| `recomendaria` | nominal (true/false) | recomendaría la empresa |
| `sigue` | nominal (**clase**) | Sí / No / No sé (intención de seguir) |

### Distribución de la clase objetivo (`sigue`)

| Valor | Frecuencia | % |
| --- | --- | --- |
| No sé | 195 | 46.4 % |
| Sí | 117 | 27.9 % |
| No | 108 | 25.7 % |

### Correlaciones que Weka puede encontrar

| Predictor | 4–5 → "Sí" | 1–2 → "Sí" |
| --- | --- | --- |
| comunicación | 55 % | 5 % |
| reconocimiento | 53 % | 5 % |
| carga | 58 % | 12 % |
| equipo | 47 % | 7 % |
| salario | 51 % | 8 % |

Las escalas de satisfacción predicen con claridad la intención de quedarse, que
es exactamente lo que se necesita para entrenar un **clasificador en Weka**
(ej. J48, Random Forest, Naive Bayes).

**Veredicto: los datos cumplen** para el tablero de control y para la minería
de datos.

---

## 2. Entregables generados

| Entregable | Ubicación | Uso |
| --- | --- | --- |
| Integrantes del grupo | [`docs/integrantes.txt`](integrantes.txt) | copiar y pegar en el informe |
| Diagrama de la BD (Mermaid) | [`docs/diagrama-base-de-datos.md`](diagrama-base-de-datos.md) | documento / GitHub |
| Diagrama de la BD (imagen) | [`docs/diagrama-base-de-datos.png`](diagrama-base-de-datos.png) | pegar en Word/informe |
| Datos para tablero (CSV) | [`entregables/datos-clima-laboral.csv`](../entregables/datos-clima-laboral.csv) | Excel / Power BI |
| Datos para tablero (Excel) | [`entregables/datos-clima-laboral.xlsx`](../entregables/datos-clima-laboral.xlsx) | Excel (hojas Datos + Diccionario) |
| Datos para Weka (ARFF) | [`entregables/datos-clima-laboral.arff`](../entregables/datos-clima-laboral.arff) | Weka Explorer |
| JSON listo para Atlas | [`export-atlas/`](../export-atlas/) | poblar la base en Atlas |
| Script de generación | [`scripts/generar-entregables.py`](../scripts/generar-entregables.py) | regenerar todo en un paso |

### Cómo usar cada archivo

- **CSV / XLSX (tablero):** una fila por encuestado, una columna por pregunta.
  La primera columna es `fecha`. Las escalas van como números (1–5), así Excel
  puede promediarlas directamente. La hoja `Diccionario` del XLSX explica cada
  columna.
- **ARFF (Weka):** ábralo en **Weka → Explorer → Preprocess → Open file**.
  La clase es el último atributo (`sigue`), que Weka toma por defecto. Luego en
  **Classify** elija un algoritmo (J48, Random Forest…) y presione *Start*.
  Si algún carácter acentuado se ve raro, abra el archivo con codificación
  UTF-8 (opción *Files of type* → *UTF-8*).

---

## 3. Cambios realizados al proyecto

1. **Exportador de datos solo para el creador de la encuesta** (lo que pediste):
   - API: `GET /api/surveys/[id]/export?formato=csv|arff` → verifica sesión y
     que `encuesta.creador` sea el usuario actual (si no, responde 403).
   - Botones en la página de la encuesta (**Exportar CSV** y **ARFF (Weka)**),
     visibles únicamente para el dueño (junto a Publicar / Compartir).
   - Lógica de aplanado en [`src/lib/export-datos.ts`](../src/lib/export-datos.ts).
2. **Campo `clave`** en las preguntas (nombre corto de columna) para que la
   exportación use nombres legibles (`area`, `sigue`, …). El seed ahora lo
   conserva; las encuestas creadas desde la UI no lo usan (se genera un nombre
   automático).
3. El JSON de `export-atlas/` incluye ahora `clave` en cada pregunta.

---

## 4. Subir a producción

### 4.1 Poblar la base (Atlas)

1. Crea el cluster en [cloud.mongodb.com](https://cloud.mongodb.com) y el
   usuario + IP (`0.0.0.0/0`). Ver [`docs/guia-despliegue.md`](guia-despliegue.md).
2. Pega los JSON en **Atlas → Browse Collections**:
   - `1-encuesta.json` → colección `encuestas` (Insert Document).
   - `2-votos-parte-1..4.json` → colección `votos`.
   > ⚠️ En `1-encuesta.json`, cambia `creador.$oid` por el `_id` real de tu
   > usuario en la colección `users` para poder administrar la encuesta al
   > iniciar sesión. (El valor actual es un placeholder.)
3. También crea tu usuario (regístrate en la app) y los tipos de encuesta si
   quieres que `tipos` no quede vacío.

### 4.2 Alternativa: sembrar con el script

Con un MongoDB local corriendo y tu usuario registrado:

```powershell
npm run seed -- --email=tu@correo.com
```

Esto crea la encuesta a tu nombre (la podrás administrar y exportar). Para
Atlas define `MONGODB_URI` y `SEED_REMOTO=1` si quieres sembrar directo.

### 4.3 Vercel

El proyecto ya está en Vercel (branch `master`). Actualiza `MONGODB_URI` y
`AUTH_SECRET` en **Settings → Environment Variables** y haz **Redeploy**.
Más detalle en [`docs/guia-despliegue.md`](guia-despliegue.md).

---

## 5. Recomendaciones

- **No cambies el modelo de datos:** el esquema actual ya cubre tablero y Weka.
- Para producción, siémbralo **a nombre de tu usuario real** (`--email`) para
  poder ver resultados y exportar.
- Si quieres más datos para Weka, el seed usa una semilla fija
  (`SEMILLA = 20261012`); cambia `TOTAL_VOTOS` en
  [`scripts/seed-encuesta.mjs`](../scripts/seed-encuesta.mjs) y vuelve a ejecutar.
