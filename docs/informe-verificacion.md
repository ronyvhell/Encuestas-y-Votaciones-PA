# Informe de verificación y entregables — PA Encuestas y Votaciones

Este documento resume la verificación de los datos del seed, los entregables
generados, el modelo predictivo integrado en la aplicación y cómo subir todo a
producción.

---

## 1. Verificación de los datos (seed)

El script [`scripts/seed-encuesta.mjs`](../scripts/seed-encuesta.mjs) genera una
encuesta de clima laboral con **420 votos y 11 preguntas** y una **variable
objetivo binaria** (`Sí` / `No`). La verificación
([`scripts/verificar-seed.mjs`](../scripts/verificar-seed.mjs)) dio estos resultados:

| Verificación | Resultado |
| --- | --- |
| Votos esperados vs. exportados | 420 / 420 ✅ |
| Respuestas por voto | 11 de 11 ✅ |
| Valores faltantes | 0 ✅ |
| `voterId` duplicados | 0 ✅ |
| `encuestaId` consistente en todos los votos | Sí ✅ |
| Fechas dentro del rango (jun–oct 2026) | Sí ✅ |
| Clases de la variable objetivo | 2 (`Sí`, `No`) ✅ |

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
| `sigue` | nominal (**clase**) | Sí / No (intención de seguir) |

### Distribución de la clase objetivo (`sigue`)

| Valor | Frecuencia | % |
| --- | --- | --- |
| Sí | 218 | 51.9 % |
| No | 202 | 48.1 % |

La línea base es **50 %** (dos clases balanceadas).

### Correlaciones que el modelo (y Weka) encuentran

| Predictor | 4–5 → "Sí" | 1–2 → "Sí" |
| --- | --- | --- |
| comunicación | 73 % | 25 % |
| reconocimiento | 72 % | 26 % |
| carga | 76 % | 38 % |
| equipo | 68 % | 34 % |
| salario | 73 % | 29 % |

Las escalas de satisfacción predicen con claridad la intención de quedarse, que
es exactamente lo que se necesita para entrenar un **clasificador binario**.

**Veredicto: los datos cumplen** para el tablero de control, para el modelo de la
app y para la minería de datos en Weka.

> **Encuestas sembradas antes del cambio:** si una encuesta antigua todavía tiene
> la opción «No sé», se puede convertir con
> [`scripts/migrar-binario.mjs`](../scripts/migrar-binario.mjs) (por defecto
> simula; con `--confirmar` aplica y guarda respaldo), o dejar que la app
> aplique la política al entrenar (excluir o contar como «No»).

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

### Acentos en la exportación

| Archivo | Tratamiento |
| --- | --- |
| CSV | UTF-8 **con BOM** y acentos conservados (`Sí`, `Tecnología`) → Excel los muestra bien |
| XLSX | UTF-8 con acentos |
| ARFF | Etiquetas **sin acentos** (`Si`, `No`, `Tecnologia`, `Hibrida`) para que Weka las lea con cualquier configuración |
| ARFF | Diccionario en comentarios `%` con el texto original acentuado y el mapeo `"Sí" -> "Si"` |

Ejemplo del encabezado del ARFF:

```
% area: ¿En qué área trabajas?
% sigue: ¿Piensas seguir en la empresa el próximo año?
%
% Etiquetas sin acentos para que Weka las lea en cualquier configuracion
% sigue: "Sí" -> "Si"

@attribute sigue {No,Si}
```

---

## 3. Modelo predictivo integrado en la aplicación

### 3.1 Qué se añadió

1. **Motor de minería de datos en TypeScript** (`src/lib/modelo/`): árbol de
   decisión J48 (razón de ganancia, poda), Naive Bayes, k-NN y bosque aleatorio,
   con validación cruzada estratificada y métricas fuera de muestra.
2. **Colección `modelos`** (5.ª colección): una versión por entrenamiento, con
   métricas, matriz de confusión, variables, reglas y artefacto serializado.
3. **API** (solo para el creador de la encuesta):
   - `POST /api/surveys/[id]/modelo` — entrena.
   - `GET /api/surveys/[id]/modelo` — historial.
   - `POST /api/surveys/[id]/modelo/predecir` — predice un caso.
   - `DELETE /api/surveys/[id]/modelo?modeloId=…` — elimina una versión.
4. **Página `/encuestas/[id]/modelo`** con cuatro pestañas:
   - **Entrenamiento:** variable objetivo, algoritmo, política de «No sé»,
     botón de reentrenamiento, comparación de algoritmos e historial.
   - **Modelo:** métricas, matriz de confusión, árbol de decisión, reglas e
     importancia de variables.
   - **Predicción:** simulador de respuestas y ejemplos reales del conjunto de
     datos.
   - **Factores:** análisis de todas las preguntas (distribución, promedio,
     % de «Sí» por grupo y poder predictivo).
5. **Acceso desde la encuesta:** botón **«Modelo predictivo»** junto a
   Publicar / Exportar.

### 3.2 Verificación automática

[`scripts/verificar-modelo.mjs`](../scripts/verificar-modelo.mjs) prueba el flujo
completo contra una instancia en marcha (inicia sesión con credenciales,
entrena, reentrena y predice). Resultado sobre los 420 votos del seed:

| Comprobación | Resultado |
| --- | --- |
| Inicio de sesión | ✅ |
| Encuesta encontrada con 420 votos y 11 preguntas | ✅ |
| Modelo de árbol entrenado (versión 1) | ✅ exactitud 66 %, F1 70 %, macro-F1 66 % |
| Matriz de confusión fuera de muestra | VP 165 · VN 114 · FP 88 · FN 53 |
| Comparación de algoritmos | árbol 66 % · Naive Bayes 71 % · k-NN 63 % · bosque 68 % |
| Reentrenamiento | ✅ crea la versión 2 |
| Predicción de un perfil favorable | ✅ «Sí» con 93 % de probabilidad |
| Predicción de un perfil desfavorable | ✅ «No» con 3 % de probabilidad de «Sí» |
| Página del modelo | ✅ renderiza árbol, métricas y matriz |
| Otras páginas (`/encuestas`, `/dashboard`, detalle) | ✅ |
| ARFF sin acentos + diccionario | ✅ `@attribute sigue {No,Si}` |
| CSV con BOM y acentos | ✅ |
| Historial de versiones | ✅ |

Para repetir la verificación:

```powershell
npm run build
npm run start          # o npm run local en desarrollo
node scripts/verificar-modelo.mjs
```

Con credenciales distintas:

```powershell
node scripts/verificar-modelo.mjs --base=http://127.0.0.1:3000 --email=tu@correo.com --password=tuclave
```

### 3.3 Segunda encuesta de ejemplo

El segundo seed (`npm run seed:satisfaccion`) carga una encuesta de satisfacción
y experiencia de compra en línea con **520 votos y 12 preguntas**. Su
verificación se ejecuta con:

```powershell
node scripts/verificar-modelo.mjs --encuesta=satisfaccion
```

| Comprobación | Resultado |
| --- | --- |
| Encuesta encontrada con 520 votos y 12 preguntas | ✅ |
| Modelo de árbol (objetivo «¿Volverías a comprar?») | ✅ exactitud 81 %, F1 84 %, macro-F1 81 % |
| Matriz de confusión fuera de muestra | VP 257 · VN 166 · FP 57 · FN 40 |
| Comparación de algoritmos | árbol 81 % · Naive Bayes 80 % · k-NN 76 % · bosque 81 % |
| Predicción de un perfil favorable y uno desfavorable | ✅ «Sí» con 86 % y «No» con 7 % |
| ARFF sin acentos | ✅ `@attribute volveria {Si,No}` |

La encuesta de satisfacción obtiene mejor exactitud que la de clima laboral
porque su variable objetivo depende más directamente de las escalas de
experiencia (producto, envío y recomendación).

---

## 4. Cambios realizados al proyecto

1. **Variable objetivo binaria:** el seed genera solo `Sí` / `No`; el modelo
   siempre reduce la respuesta a dos clases.
2. **Entrenamiento en la app** con cuatro algoritmos, validación cruzada,
   comparación y métricas fuera de muestra.
3. **Visualización del modelo:** árbol navegable, reglas, matriz de confusión,
   importancia de variables, ejemplos reales y simulador.
4. **Reentrenamiento versionado:** cada entrenamiento crea una versión nueva;
   el historial conserva las anteriores.
5. **Análisis de todos los factores** (no solo la intención de permanencia).
6. **Exportación con acentos controlados** (ARFF sin acentos + diccionario, CSV
   y XLSX con acentos y BOM).
7. **Exportador de datos solo para el creador** (ya existía): la API
   `GET /api/surveys/[id]/export?formato=csv|arff` responde 403 a otros usuarios.
8. **Migración de encuestas antiguas** a variable binaria
   (`scripts/migrar-binario.mjs`).

---

## 5. Subir a producción

### 5.1 Poblar la base (Atlas)

1. Crea el cluster en [cloud.mongodb.com](https://cloud.mongodb.com) y el
   usuario + IP (`0.0.0.0/0`). Ver [`docs/guia-despliegue.md`](guia-despliegue.md).
2. Regenera los JSON con los datos binarios:

   ```powershell
   node scripts/seed-encuesta.mjs --exportar --creador=<_id de tu usuario>
   ```

3. Pega los JSON en **Atlas → Browse Collections**:
   - `1-encuesta.json` → colección `encuestas` (Insert Document).
   - `2-votos-parte-1..4.json` → colección `votos`.
   > ⚠️ En `1-encuesta.json`, el `creador.$oid` debe ser el `_id` real de tu
   > usuario en la colección `users` para poder administrar la encuesta y
   > entrenar su modelo al iniciar sesión.
4. Crea tu usuario (regístrate en la app) y los tipos de encuesta si quieres que
   `tipos` no quede vacío.
5. La colección `modelos` se crea sola al primer entrenamiento.

### 5.2 Alternativa: sembrar con el script

Con un MongoDB local corriendo y tu usuario registrado:

```powershell
npm run seed -- --email=tu@correo.com
```

Esto crea la encuesta a tu nombre (la podrás administrar, exportar y entrenar).
Para Atlas define `MONGODB_URI` y `SEED_REMOTO=1` si quieres sembrar directo.

### 5.3 Vercel

El proyecto ya está en Vercel (branch `master`). Actualiza `MONGODB_URI` y
`AUTH_SECRET` en **Settings → Environment Variables** y haz **Redeploy**.
Más detalle en [`docs/guia-despliegue.md`](guia-despliegue.md).

---

## 6. Recomendaciones

- **No cambies el modelo de datos:** el esquema actual cubre tablero, modelo en
  la app y Weka.
- Para producción, siémbralo **a nombre de tu usuario real** (`--email`) para
  poder ver resultados, exportar y entrenar el modelo.
- Si quieres más datos para el modelo, cambia `TOTAL_VOTOS` en
  [`scripts/seed-encuesta.mjs`](../scripts/seed-encuesta.mjs), vuelve a ejecutar
  el seed y pulsa **Reentrenar** en la app: la comparación de versiones mostrará
  el efecto.
- La semilla (`SEMILLA = 20261012`) hace que los resultados sean reproducibles;
  cámbiala solo si quieres un conjunto distinto.
