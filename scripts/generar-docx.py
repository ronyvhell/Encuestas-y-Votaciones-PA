# -*- coding: utf-8 -*-
"""Convierte docs/documentacion-tecnica.md en un DOCX con formato académico.

Fuente: Montserrat 12 para el cuerpo, títulos en negrita y tablas en 10.5.
Uso: python scripts/generar-docx.py
"""
import os
import re

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRADA = os.path.join(RAIZ, "docs", "documentacion-tecnica.md")
SALIDA = os.path.join(
    RAIZ, os.environ.get("DOCX_SALIDA", os.path.join("docs", "documentacion-tecnica.docx"))
)
IMAGEN = os.path.join(RAIZ, "docs", "diagrama-base-de-datos.png")

FUENTE = os.environ.get("DOCX_FUENTE", "Montserrat")
TAM_CUERPO = 12
TAM_TABLA = 10.5
NEGRO = RGBColor(0x00, 0x00, 0x00)
GRIS = RGBColor(0x59, 0x59, 0x59)

INLINE = re.compile(r"(\*\*[^*]+\*\*|`[^`]+`)")
SEPARADOR = re.compile(r"^:?-{3,}:?$")


def aplicar_fuente(run, tamano=TAM_CUERPO, negrita=None, color=None):
    run.font.name = FUENTE
    run.font.size = Pt(tamano)
    if negrita is not None:
        run.bold = negrita
    if color is not None:
        run.font.color.rgb = color
    r_pr = run._element.get_or_add_rPr()
    r_fonts = r_pr.find(qn("w:rFonts"))
    if r_fonts is None:
        r_fonts = OxmlElement("w:rFonts")
        r_pr.append(r_fonts)
    for atributo in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        r_fonts.set(qn(atributo), FUENTE)


def escribir_texto(parrafo, texto, tamano=TAM_CUERPO):
    """Escribe texto con **negrita** y `código` en línea."""
    for parte in INLINE.split(texto):
        if not parte:
            continue
        if parte.startswith("**") and parte.endswith("**") and len(parte) > 4:
            run = parrafo.add_run(parte[2:-2])
            aplicar_fuente(run, tamano, negrita=True)
        elif parte.startswith("`") and parte.endswith("`") and len(parte) > 2:
            run = parrafo.add_run(parte[1:-1])
            run.font.name = "Consolas"
            run.font.size = Pt(tamano - 1)
        else:
            run = parrafo.add_run(parte)
            aplicar_fuente(run, tamano)


def sombrear(celda, color="E7E6E6"):
    tc_pr = celda._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), color)
    tc_pr.append(shd)


def agregar_pie(documento):
    pie = documento.sections[0].footer
    parrafo = pie.paragraphs[0]
    parrafo.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = parrafo.add_run("Documentación técnica · Plataforma de Encuestas y Votaciones · ")
    aplicar_fuente(run, 9, color=GRIS)

    run_pagina = parrafo.add_run()
    aplicar_fuente(run_pagina, 9, color=GRIS)
    inicio = OxmlElement("w:fldChar")
    inicio.set(qn("w:fldCharType"), "begin")
    instruccion = OxmlElement("w:instrText")
    instruccion.set(qn("xml:space"), "preserve")
    instruccion.text = "PAGE"
    fin = OxmlElement("w:fldChar")
    fin.set(qn("w:fldCharType"), "end")
    run_pagina._r.append(inicio)
    run_pagina._r.append(instruccion)
    run_pagina._r.append(fin)


def agregar_portada(documento):
    for _ in range(5):
        documento.add_paragraph()

    def centrado(texto, tamano, negrita=False, espacio=6):
        parrafo = documento.add_paragraph()
        parrafo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        parrafo.paragraph_format.space_after = Pt(espacio)
        run = parrafo.add_run(texto)
        aplicar_fuente(run, tamano, negrita=negrita)

    centrado("BASE DE DATOS II", 24, negrita=True, espacio=18)
    centrado("Entregado por:", 12, negrita=True, espacio=10)
    for nombre in [
        "RONY ANDRES VALDELAMAR VERGARA",
        "VICTOR ROCHA RAMOS",
        "ANIBAL MEZA ANAYA",
        "JAIR JOSÉ SÁNCHEZ PÉREZ",
    ]:
        centrado(nombre, 13, negrita=True, espacio=6)

    for _ in range(3):
        documento.add_paragraph()

    centrado("UNIVERSIDAD FUNDACIÓN ACADÉMICA", 14, negrita=True, espacio=4)
    centrado("TECNOLÓGICO COMFENALCO", 14, negrita=True, espacio=4)
    centrado("INGENIERÍA EN SISTEMAS SEMESTRE", 12, espacio=4)
    centrado("14/10/2026", 12, espacio=4)

    documento.add_page_break()


def agregar_tabla(documento, filas):
    columnas = max(len(fila) for fila in filas)
    tabla = documento.add_table(rows=len(filas), cols=columnas)
    tabla.style = "Table Grid"
    tabla.alignment = WD_TABLE_ALIGNMENT.CENTER
    tabla.autofit = True

    for i, fila in enumerate(filas):
        for j in range(columnas):
            celda = tabla.cell(i, j)
            parrafo = celda.paragraphs[0]
            parrafo.paragraph_format.space_after = Pt(2)
            parrafo.paragraph_format.line_spacing = 1.0
            texto = fila[j] if j < len(fila) else ""
            escribir_texto(parrafo, texto, TAM_TABLA)
            if i == 0:
                for run in parrafo.runs:
                    run.bold = True
                sombrear(celda)

    fila_cabecera = tabla.rows[0]._tr.get_or_add_trPr()
    cabecera = OxmlElement("w:tblHeader")
    cabecera.set(qn("w:val"), "true")
    fila_cabecera.append(cabecera)

    espacio = documento.add_paragraph()
    espacio.paragraph_format.space_after = Pt(4)
    return tabla


def convertir():
    with open(ENTRADA, encoding="utf-8") as archivo:
        lineas = [linea.rstrip("\n").rstrip("\r") for linea in archivo]

    # Todo lo anterior al primer título es la portada, que se dibuja aparte.
    indice_inicio = next(
        (i for i, linea in enumerate(lineas) if linea.startswith("# ")), 0
    )
    lineas = lineas[indice_inicio:]

    documento = Document()

    estilo = documento.styles["Normal"]
    estilo.font.name = FUENTE
    estilo.font.size = Pt(TAM_CUERPO)
    estilo.paragraph_format.space_after = Pt(6)
    estilo.paragraph_format.line_spacing = 1.15
    r_pr = estilo.element.get_or_add_rPr()
    r_fonts = r_pr.find(qn("w:rFonts"))
    if r_fonts is None:
        r_fonts = OxmlElement("w:rFonts")
        r_pr.append(r_fonts)
    for atributo in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        r_fonts.set(qn(atributo), FUENTE)

    for nombre, tamano in (("Heading 1", 16), ("Heading 2", 13.5), ("Heading 3", 12)):
        estilo_titulo = documento.styles[nombre]
        estilo_titulo.font.name = FUENTE
        estilo_titulo.font.size = Pt(tamano)
        estilo_titulo.font.bold = True
        estilo_titulo.font.italic = False
        estilo_titulo.font.color.rgb = NEGRO
        estilo_titulo.paragraph_format.space_before = Pt(14)
        estilo_titulo.paragraph_format.space_after = Pt(6)
        estilo_titulo.paragraph_format.keep_with_next = True

    agregar_pie(documento)
    agregar_portada(documento)

    documento.core_properties.title = (
        "Plataforma de Encuestas y Votaciones — Documentación técnica"
    )
    documento.core_properties.author = "Rony Andrés Valdelamar Vergara y equipo"
    documento.core_properties.subject = "Base de Datos II"

    parrafo_actual = []
    tabla_actual = []
    total_imagenes = 0

    def cerrar_parrafo():
        if not parrafo_actual:
            return
        texto = " ".join(parrafo_actual).strip()
        parrafo_actual.clear()
        if not texto:
            return
        parrafo = documento.add_paragraph()
        parrafo.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        escribir_texto(parrafo, texto)

    def cerrar_tabla():
        if not tabla_actual:
            return
        filas = [fila for fila in tabla_actual if not all(SEPARADOR.match(c) for c in fila)]
        tabla_actual.clear()
        if filas:
            agregar_tabla(documento, filas)

    for linea in lineas:
        desnuda = linea.strip()

        if desnuda.startswith("|"):
            cerrar_parrafo()
            celdas = [c.strip() for c in desnuda.strip("|").split("|")]
            tabla_actual.append(celdas)
            continue
        cerrar_tabla()

        if not desnuda:
            cerrar_parrafo()
            continue

        if desnuda.startswith("!["):
            cerrar_parrafo()
            coincidencia = re.match(r"!\[(.*?)\]\((.*?)\)", desnuda)
            if coincidencia:
                alt, ruta = coincidencia.group(1), coincidencia.group(2)
                ruta_abs = os.path.join(RAIZ, "docs", ruta)
                if os.path.exists(ruta_abs):
                    parrafo = documento.add_paragraph()
                    parrafo.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    parrafo.add_run().add_picture(ruta_abs, width=Inches(6.2))
                    total_imagenes += 1
                    pie = documento.add_paragraph()
                    pie.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    run = pie.add_run(f"Figura {total_imagenes}. {alt}.")
                    aplicar_fuente(run, 10, color=GRIS)
            continue

        if desnuda.startswith("### "):
            cerrar_parrafo()
            documento.add_heading(desnuda[4:].replace("**", "").strip(), level=3)
            continue
        if desnuda.startswith("## "):
            cerrar_parrafo()
            documento.add_heading(desnuda[3:].replace("**", "").strip(), level=2)
            continue
        if desnuda.startswith("# "):
            cerrar_parrafo()
            documento.add_heading(desnuda[2:].replace("**", "").strip(), level=1)
            continue

        if re.match(r"^\*\s+", desnuda):
            cerrar_parrafo()
            parrafo = documento.add_paragraph(style="List Bullet")
            parrafo.paragraph_format.space_after = Pt(4)
            escribir_texto(parrafo, re.sub(r"^\*\s+", "", desnuda))
            continue

        if re.match(r"^\d+\.\s+", desnuda):
            cerrar_parrafo()
            parrafo = documento.add_paragraph(style="List Number")
            parrafo.paragraph_format.space_after = Pt(4)
            escribir_texto(parrafo, re.sub(r"^\d+\.\s+", "", desnuda))
            continue

        if desnuda in ("---", "***"):
            cerrar_parrafo()
            continue

        parrafo_actual.append(desnuda)

    cerrar_tabla()
    cerrar_parrafo()

    documento.save(SALIDA)

    parrafos = len(documento.paragraphs)
    tablas = len(documento.tables)
    print(f"DOCX generado: {SALIDA}")
    print(f"  Párrafos: {parrafos} · Tablas: {tablas} · Imágenes: {total_imagenes}")
    print(f"  Fuente: {FUENTE} {TAM_CUERPO:g} pt (tablas {TAM_TABLA:g} pt)")


if __name__ == "__main__":
    convertir()
