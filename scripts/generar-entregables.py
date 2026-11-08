# -*- coding: utf-8 -*-
"""Genera los entregables del proyecto a partir de export-atlas/:
- export-atlas/1-encuesta.json con `clave` en cada pregunta (nombres de columna legibles)
- entregables/datos-clima-laboral.csv  (UTF-8 BOM, para Excel/Power BI)
- entregables/datos-clima-laboral.arff (para Weka)
- entregables/datos-clima-laboral.xlsx (Excel, con hoja Diccionario)
- docs/diagrama-base-de-datos.png      (diagrama entidad-relación)
"""
import json
import os
from collections import OrderedDict

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ATLAS = os.path.join(RAIZ, "export-atlas")
ENTREGABLES = os.path.join(RAIZ, "entregables")
DOCS = os.path.join(RAIZ, "docs")

# Orden de las preguntas -> clave legible (mismo orden que el seed)
CLAVES = [
    "area", "antiguedad", "edad", "modalidad",
    "comunicacion", "reconocimiento", "carga", "equipo", "salario",
    "recomendaria", "sigue",
]


def cargar():
    encuesta = json.load(open(os.path.join(ATLAS, "1-encuesta.json"), encoding="utf-8"))[0]
    votos = []
    for i in range(1, 5):
        votos += json.load(open(os.path.join(ATLAS, f"2-votos-parte-{i}.json"), encoding="utf-8"))
    return encuesta, votos


def es_numerica(pregunta):
    opciones = [o for o in pregunta.get("opciones", []) if str(o).strip()]
    if pregunta.get("tipoPregunta") != "seleccion_unica" or len(opciones) < 2:
        return False
    return all(_es_numero(o) for o in opciones)


def _es_numero(s):
    try:
        float(str(s).strip())
        return True
    except ValueError:
        return False


def sin_acentos(texto):
    """Quita tildes y diéresis (las etiquetas del ARFF van sin acentos)."""
    import unicodedata
    return "".join(
        ch for ch in unicodedata.normalize("NFD", str(texto))
        if unicodedata.category(ch) != "Mn"
    )


def arff_etiqueta(v):
    s = sin_acentos(str(v))
    if all(c.isalnum() or c in "_.-" for c in s):
        return s
    return "'" + s.replace("'", "\\'") + "'"


def preparar():
    encuesta, votos = cargar()

    # 1) Añade `clave` a cada pregunta (por su `orden`) y reescribe el JSON de Atlas
    #    solo si realmente cambió (así no se toca el archivo en cada ejecución).
    preguntas = sorted(encuesta["preguntas"], key=lambda p: p.get("orden", 0))
    cambios = False
    for p in preguntas:
        clave = CLAVES[p.get("orden", 0)]
        if p.get("clave") != clave:
            p["clave"] = clave
            cambios = True
    if cambios:
        json.dump([encuesta], open(os.path.join(ATLAS, "1-encuesta.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)

    # Mapa preguntaId -> (clave, tipo, texto)
    meta = {}
    for p in preguntas:
        meta[p["_id"]["$oid"]] = p

    columnas = []  # (clave, tipo, texto) en orden; tipo: fecha|numerico|nominal
    filas = []
    nominales = OrderedDict()

    for p in preguntas:
        tipo = "numerico" if es_numerica(p) else "nominal"
        columnas.append((p["clave"], tipo, p["texto"]))
        if tipo == "nominal":
            nominales[p["clave"]] = []

    for voto in votos:
        fila = {"fecha": voto["createdAt"]["$date"][:10]}
        for clave, tipo, _texto in columnas:
            pid = next((k for k, v in meta.items() if v["clave"] == clave), None)
            resp = next((r for r in voto["respuestas"] if r["preguntaId"] == pid), None)
            val = resp["valor"] if resp is not None else ""
            if tipo == "numerico":
                val = int(val) if str(val).lstrip("-").isdigit() else ""
            elif meta[pid]["tipoPregunta"] == "verdadero_falso":
                val = "true" if val is True else ("false" if val is False else str(val))
            else:
                val = "" if val is None else (val if isinstance(val, str) else str(val))
            fila[clave] = val
            if tipo == "nominal" and val != "" and val not in nominales[clave]:
                nominales[clave].append(val)
        filas.append(fila)

    return encuesta, columnas, filas, nominales


def escribir_csv(columnas, filas):
    encabezados = ["fecha"] + [c[0] for c in columnas]
    lineas = [",".join(encabezados)]
    for f in filas:
        linea = [str(f["fecha"])] + [str(f[c[0]]) for c in columnas]
        lineas.append(",".join(linea))
    contenido = "\ufeff" + "\r\n".join(lineas)
    open(os.path.join(ENTREGABLES, "datos-clima-laboral.csv"), "w", encoding="utf-8").write(contenido)


def escribir_arff(titulo, columnas, filas, nominales):
    def slug(t):
        import unicodedata, re
        t = unicodedata.normalize("NFD", t.lower())
        t = "".join(ch for ch in t if unicodedata.category(ch) != "Mn")
        t = re.sub(r"[^a-z0-9]+", "_", t).strip("_")
        return t or "encuesta"

    L = [f"@relation {slug(titulo)}", ""]
    # Weka ignora los comentarios "%"; sirven de diccionario con el texto original.
    L.append("% Diccionario de variables (texto original de la encuesta)")
    for clave, _tipo, texto in columnas:
        L.append(f"% {clave}: {texto}")

    traducciones = []
    for clave, tipo, _texto in columnas:
        if tipo != "nominal":
            continue
        for valor in nominales[clave]:
            limpio = sin_acentos(valor)
            if limpio != valor:
                traducciones.append(f'% {clave}: "{valor}" -> "{limpio}"')
    if traducciones:
        L.append("%")
        L.append("% Etiquetas sin acentos para que Weka las lea en cualquier configuracion")
        L.extend(traducciones)

    L.append("")
    for clave, tipo, _texto in columnas:
        if tipo == "numerico":
            L.append(f"@attribute {clave} numeric")
        else:
            vals = ",".join(arff_etiqueta(v) for v in nominales[clave])
            L.append(f"@attribute {clave} {{{vals}}}")
    L += ["", "@data"]
    for f in filas:
        L.append(",".join(arff_etiqueta(f[c[0]]) for c in columnas))
    open(os.path.join(ENTREGABLES, "datos-clima-laboral.arff"), "w", encoding="utf-8").write("\n".join(L) + "\n")


def escribir_xlsx(columnas, filas):
    wb = Workbook()
    ws = wb.active
    ws.title = "Datos"
    encabezados = ["fecha"] + [c[0] for c in columnas]
    ws.append(encabezados)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="334155")
    for f in filas:
        ws.append([f["fecha"]] + [f[c[0]] for c in columnas])
    for i, c in enumerate(encabezados, start=1):
        ws.column_dimensions[get_column_letter(i)].width = max(12, len(c) + 2)
    ws.freeze_panes = "A2"

    ws2 = wb.create_sheet("Diccionario")
    ws2.append(["columna", "tipo", "pregunta"])
    ws2.append(["fecha", "fecha", "Fecha en que se respondió la encuesta"])
    for clave, tipo, texto in columnas:
        ws2.append([clave, tipo, texto])
    for cell in ws2[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="334155")
    ws2.column_dimensions["A"].width = 16
    ws2.column_dimensions["B"].width = 12
    ws2.column_dimensions["C"].width = 70

    wb.save(os.path.join(ENTREGABLES, "datos-clima-laboral.xlsx"))


def dibujar_diagrama():
    from PIL import Image, ImageDraw, ImageFont

    def fuente(size, negrita=False):
        for p in ([r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"]
                  if negrita else [r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\segoeui.ttf"]):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
        return ImageFont.load_default()

    W, H = 1620, 1260
    img = Image.new("RGB", (W, H), "#ffffff")
    d = ImageDraw.Draw(img)

    def caja(x, y, w, h, titulo, campos, color="#334155"):
        d.rounded_rectangle([x, y, x + w, y + h], radius=14, outline=color, width=3, fill="#f8fafc")
        d.rounded_rectangle([x, y, x + w, y + 42], radius=14, outline=color, width=3, fill=color)
        d.text((x + 16, y + 9), titulo, fill="#ffffff", font=fuente(24, True))
        ty = y + 58
        for campo in campos:
            d.text((x + 16, ty), campo, fill="#1e293b", font=fuente(18))
            ty += 28

    def flecha(p1, p2, etiqueta, ex, ey):
        d.line([p1, p2], fill="#64748b", width=3)
        # punta de flecha simple
        import math
        ang = math.atan2(p2[1] - p1[1], p2[0] - p1[0])
        for da in (math.pi * 0.85, -math.pi * 0.85):
            d.line([p2, (p2[0] + 18 * math.cos(ang + da), p2[1] + 18 * math.sin(ang + da))], fill="#64748b", width=3)
        # Fondo blanco detrás de la etiqueta para que la línea no la atraviese.
        tipografia = fuente(20, True)
        caja_texto = d.textbbox((ex, ey), etiqueta, font=tipografia)
        d.rectangle(
            [caja_texto[0] - 8, caja_texto[1] - 4, caja_texto[2] + 8, caja_texto[3] + 4],
            fill="#ffffff",
        )
        d.text((ex, ey), etiqueta, fill="#0f172a", font=tipografia)

    d.text((40, 20), "Base de datos · PA Encuestas y Votaciones", fill="#0f172a", font=fuente(30, True))

    caja(60, 90, 360, 220, "users", [
        "_id", "nombre", "email (único)", "passwordHash (bcrypt)",
        "createdAt / updatedAt",
    ], "#2563eb")
    caja(1200, 90, 360, 210, "surveytypes", [
        "_id", "nombre (único)", "descripcion", "createdAt / updatedAt",
    ], "#7c3aed")
    caja(560, 380, 500, 390, "encuestas", [
        "_id", "titulo · descripcion", "imagenPortada",
        "tipos[]  → surveytypes", "creador → users",
        "estado (borrador|publicada)", "votos (contador)",
        "preguntas[] (embebidas):",
        "   _id · texto · tipoPregunta · opciones[]",
        "   config · requerida · orden · clave",
        "createdAt / updatedAt",
    ], "#0f766e")
    caja(60, 960, 460, 240, "votos", [
        "_id", "encuestaId → encuestas", "voterId (único por encuesta)",
        "ipHash", "respuestas[]: preguntaId · valor",
        "createdAt / updatedAt",
    ], "#dc2626")
    caja(1100, 880, 460, 350, "modelos", [
        "_id", "encuestaId → encuestas", "creador → users",
        "version · algoritmo · politica", "preguntaObjetivoId · clases[]",
        "clasePositiva · nRegistros", "exactitud · f1 · macroF1",
        "matriz · comparacion[] · importancias[]",
        "columnas[] · artefacto (árbol)", "createdAt / updatedAt",
    ], "#b45309")

    flecha((420, 200), (560, 470), "1 : N  (creador)", 340, 330)
    flecha((1380, 300), (1080, 420), "N : M  (tipos)", 1195, 340)
    flecha((700, 770), (290, 960), "1 : N  (votos)", 400, 840)
    flecha((920, 770), (1330, 880), "1 : N  (modelos)", 1030, 830)

    img.save(os.path.join(DOCS, "diagrama-base-de-datos.png"))
    return W, H


def main():
    os.makedirs(ENTREGABLES, exist_ok=True)
    os.makedirs(DOCS, exist_ok=True)
    encuesta, columnas, filas, nominales = preparar()

    escribir_csv(columnas, filas)
    escribir_arff(encuesta["titulo"], columnas, filas, nominales)
    escribir_xlsx(columnas, filas)
    w, h = dibujar_diagrama()

    # Verificación: reabrir el XLSX y contar.
    from openpyxl import load_workbook
    wb = load_workbook(os.path.join(ENTREGABLES, "datos-clima-laboral.xlsx"))
    ws = wb["Datos"]
    print(f"Encuesta: {encuesta['titulo']}")
    print(f"Votos: {len(filas)}")
    print(f"Columnas: {['fecha'] + [c[0] for c in columnas]}")
    print(f"XLSX: hoja 'Datos' {ws.max_row} filas x {ws.max_column} columnas; hoja 'Diccionario' {wb['Diccionario'].max_row} filas")
    print(f"CSV: entregables/datos-clima-laboral.csv")
    print(f"ARFF: entregables/datos-clima-laboral.arff")
    print(f"XLSX: entregables/datos-clima-laboral.xlsx")
    print(f"PNG: docs/diagrama-base-de-datos.png ({w}x{h})")


if __name__ == "__main__":
    main()
