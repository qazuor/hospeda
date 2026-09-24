#!/usr/bin/env python3
"""Cuenta las filas de 06-mp-validation-matrix.md por estado.

NO ES CÓDIGO PRODUCTIVO. Herramienta de FASE 1C (PDR §4).

POR QUÉ EXISTE
--------------
Los conteos del encabezado y del resumen de la matriz se escribieron a mano una
vez y quedaron mal. Un total equivocado en un documento que decide qué se puede
implementar (§61: nada con fila `UNKNOWN`) no es un detalle de prolijidad: es
la diferencia entre "faltan 20 mediciones" y "faltan 18".

Así que el conteo se RECALCULA leyendo las filas, nunca sumando a mano.

CÓMO LEE EL ESTADO
------------------
Las tablas de la matriz no tienen todas las mismas columnas: las del §60 llevan
el estado en la tercera, y las de "huecos estructurales" en la cuarta, porque
agregan una columna "Para qué". Por eso no se lee por posición: se recorren las
celdas de izquierda a derecha y se toma **la primera** que contenga uno de los
cuatro estados. El estado siempre está antes de la conclusión, así que la
primera coincidencia es la correcta aunque la conclusión nombre otro estado.

Sólo se cuentan las filas cuya primera celda es un identificador de fila
(`PA-1`, `EX-17`, `RF-4 ✚`, …): eso descarta los encabezados, las tablas de
resumen y las de "qué espera cada decisión", que hablan DE las filas sin ser
filas.

CORREGIDO EL 2026-09-24 — el identificador puede venir en NEGRITA
-----------------------------------------------------------------
El patrón estaba anclado en `^`, así que una primera celda escrita `**GR-3**`
—la forma que la matriz usa para DESTACAR una fila recién cerrada— no
matcheaba, y la fila **se descartaba entera y en silencio**: ni se contaba ni
aparecía en el aviso de "filas SIN estado reconocible", porque ese aviso es
para filas que el patrón sí reconoce.

Eran cuatro: `GR-3`, `RC-5`, `RC-6` y `RC-7`, las cuatro del 2026-09-22. El
conteo devolvía **89 filas** contra **93** reales, y el error tenía un sesgo
que lo vuelve peor que aleatorio: **el script era ciego justamente a las filas
más nuevas**, porque la negrita es lo que marca lo recién cerrado.

Y la consecuencia de método es al revés de lo que el programa asume: el bloque
de resumen escrito A MANO nombraba a las cuatro correctamente, y el script
—declarado la única fuente de conteo, precisamente para no sumar a mano— era
el que estaba mal.

Se tolera ahora cualquier combinación de `*`, `` ` `` y espacios alrededor del
identificador, y se avisa de toda celda que parezca una fila y no se pueda
clasificar.

    python3 contar-filas-de-la-matriz.py [ruta]
"""

import re
import sys
from collections import Counter

ESTADOS = ("VERIFIED", "PARTIALLY_SUPPORTED", "NOT_SUPPORTED", "UNKNOWN")
# El orden importa: `NOT_SUPPORTED` contiene `SUPPORTED`, y `PARTIALLY_SUPPORTED`
# también, así que se buscan como palabra completa y del más largo al más corto.
ORDEN = sorted(ESTADOS, key=len, reverse=True)
# El identificador puede venir pelado (`GR-3`), en negrita (`**GR-3**`) o entre
# backticks. Se tolera cualquier envoltorio de `*`, `` ` `` y espacios: anclar en
# `^` sin ellos descartaba cuatro filas en silencio (ver el docstring).
ID = re.compile(r"^[*`\s]*((?:PA|FR|RN|GR|PS|CN|PC|UP|DW|CT|GT|WH|RC|RF|EX)-\d+)")

ruta = sys.argv[1] if len(sys.argv) > 1 else "06-mp-validation-matrix.md"

cuenta = Counter()
filas = []
sin_estado = []

for linea in open(ruta, encoding="utf-8"):
    if not linea.lstrip().startswith("|"):
        continue
    celdas = [c.strip() for c in linea.strip().strip("|").split("|")]
    if not celdas or not ID.match(celdas[0]):
        continue
    fid = ID.match(celdas[0]).group(1)
    estado = None
    for celda in celdas[1:]:
        for e in ORDEN:
            if re.search(rf"\b{e}\b", celda):
                estado = e
                break
        if estado:
            break
    if estado is None:
        sin_estado.append(fid)
        continue
    cuenta[estado] += 1
    filas.append((fid, estado))

total = sum(cuenta.values())
print(f"archivo: {ruta}")
print(f"filas contadas: {total}\n")
for e in ESTADOS:
    print(f"  {e:22} {cuenta[e]:3}")

if sin_estado:
    print(f"\n⚠ filas SIN estado reconocible: {', '.join(sin_estado)}")

duplicadas = [f for f, n in Counter(f for f, _ in filas).items() if n > 1]
if duplicadas:
    print(f"\n⚠ identificadores repetidos: {', '.join(duplicadas)}")

print("\nsin cerrar (UNKNOWN):")
print("  " + ", ".join(f for f, e in filas if e == "UNKNOWN"))
