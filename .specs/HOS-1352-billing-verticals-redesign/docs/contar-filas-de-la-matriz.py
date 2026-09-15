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

    python3 contar-filas-de-la-matriz.py [ruta]
"""

import re
import sys
from collections import Counter

ESTADOS = ("VERIFIED", "PARTIALLY_SUPPORTED", "NOT_SUPPORTED", "UNKNOWN")
# El orden importa: `NOT_SUPPORTED` contiene `SUPPORTED`, y `PARTIALLY_SUPPORTED`
# también, así que se buscan como palabra completa y del más largo al más corto.
ORDEN = sorted(ESTADOS, key=len, reverse=True)
ID = re.compile(r"^(PA|FR|RN|GR|PS|CN|PC|UP|DW|CT|GT|WH|RC|RF|EX)-\d+")

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
    fid = ID.match(celdas[0]).group(0)
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
