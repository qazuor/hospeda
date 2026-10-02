#!/usr/bin/env python3
"""Verifica el grafo de las piezas del corte del MVP: ninguna pieza del corte depende de una posterior.

Lee, siempre por encabezado y nunca por número de línea:
  - la lista de piezas y su «cuándo»: la tabla `| pieza | unidad | cuándo | fuente |` de D/16 §4.6;
  - las filas de la tabla de dependencias entre épicas, B/descomposicion.md §2.6, y compara las
    piezas que nombra cada fila viva (columna «quién lee» y la última) con su transcripción.

El grafo está transcripto abajo, a nivel de pieza, desde V/descomposicion.md §3 y §2.14,
B/descomposicion.md §3 y §2.12, D/16 §4.6 (U1-U3) y las filas de B/§2.6. Una flecha (a, b)
quiere decir «b depende de a».

Sale 1 si algo no cierra: una violación, una pieza del grafo que no está en la lista (o al revés),
o una fila de §2.6 que no coincide con su transcripción.
"""
import os
import re
import sys

W = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')) + '/'
B = 'HOS-1354-billing-cobro-y-proveedor/descomposicion.md'
D16 = 'HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md'
PIEZA = r'[UVB]\d+[ab]?'


def seccion(path, encabezado):
    """Las líneas desde el encabezado que matchea hasta el siguiente de su nivel o mayor."""
    lineas = open(W + path, encoding='utf-8').read().split('\n')
    for i, l in enumerate(lineas):
        m = re.match(r'(#+) ', l)
        if m and re.search(encabezado, l):
            nivel = len(m.group(1))
            fin = next((j for j in range(i + 1, len(lineas))
                        if re.match(r'#{1,%d} ' % nivel, lineas[j])), len(lineas))
            return lineas[i:fin]
    sys.exit(f'✗ no encontré el encabezado /{encabezado}/ en {path}')


def tabla(lineas, cabecera):
    """Las filas (como listas de celdas) de la primera tabla cuya cabecera matchea."""
    for i, l in enumerate(lineas):
        if l.startswith('|') and re.search(cabecera, l):
            filas = []
            for f in lineas[i + 2:]:
                if not f.startswith('|'):
                    break
                filas.append([c.strip() for c in f.strip().strip('|').split('|')])
            return filas
    sys.exit(f'✗ no encontré la tabla /{cabecera}/')


def piezas_en(celda):
    celda = re.sub(r'~~.*?~~', '', celda)
    return set(re.findall(r'\*\*(' + PIEZA + r')\*\*', celda))


fallas = []
# 1. la lista de piezas
piezas = {f[0].strip('`'): f[2]
          for f in tabla(seccion(D16, r'^### 4\.6 '), r'^\| pieza \| unidad \| cuándo \|')}
despues = {p for p, c in piezas.items() if c == 'después'}

# 2. las filas de B/§2.6, por encabezado
CRUZADAS = [('V2', 'B2', '1'), ('V4', 'B4', '2'), ('V2', 'B7', '3'), ('V2', 'B8b', '4'),
            ('V2', 'B8b', '5'), ('V2', 'B12', '6'), ('V2', 'B3', '7'), ('V6', 'B10', '9'),
            ('V2', 'B10', '9'), ('V4', 'B9b', '10'), ('V6', 'B10', '11'), ('V9b', 'B10', '11'),
            ('V2', 'B9a', '12'), ('B1', 'V4', '14'),
            # BC (owner 2026-10-01): action 6 of V7 runs on B5's manual payment; row 15, residue 2026-10-02
            ('B5', 'V7', '15')]
filas = tabla(seccion(B, r'^### 2\.6 '), r'^\| # \| quién lee \|')
vivas, tachadas = {}, []
for f in filas:
    m = re.match(r'(\d+)\b', f[0])
    if m:
        vivas[m.group(1)] = piezas_en(f[1]) | piezas_en(f[-1])
    elif re.match(r'~~\d+~~', f[0]):
        tachadas.append(re.sub(r'\D', '', f[0]))
print(f'filas vivas §2.6: {len(vivas)} {sorted(vivas, key=int)} · tachadas: {tachadas}')
transcriptas = {}
for a, b, n in CRUZADAS:
    transcriptas.setdefault(n, set()).update({a, b})
for n in sorted(set(vivas) | set(transcriptas), key=int):
    if vivas.get(n) != transcriptas.get(n):
        fallas.append(f'fila {n} de §2.6: el documento nombra {sorted(vivas.get(n, []))}, '
                      f'la transcripción {sorted(transcriptas.get(n, []))}')

# 3. el grafo, a nivel de pieza
INTRA = [
    # paraguas (D/16 §4.6)
    ('U1', 'U2'), ('U1', 'U3'), ('U1', 'V1'), ('U1', 'B1'),
    ('U2', 'V6'), ('U2', 'V9a'), ('U2', 'V9b'), ('U2', 'B4'), ('U2', 'B12'),
    # BR (owner 2026-10-02): encolan antes que las de arriba, el trial (V4) y el alta (B3)
    ('U2', 'V4'), ('U2', 'B3'),
    # verticales (V §3 y §2.14)
    ('V1', 'V2'), ('V2', 'V3'), ('V3', 'V4'), ('V4', 'V5'), ('V5', 'V6'), ('V5', 'V7'),
    ('V6', 'V8a'), ('V6', 'V8b'), ('V7', 'V8b'), ('V8a', 'V8b'),
    ('V4', 'V9a'), ('V6', 'V9a'), ('V4', 'V9b'), ('V6', 'V9b'), ('V9a', 'V9b'),
    # billing (B §3 y §2.12)
    ('B1', 'B3'), ('B2', 'B3'), ('B3', 'B4'), ('B3', 'B5'), ('B5', 'B4'), ('B5', 'B7'),
    ('B5', 'B11'), ('B5', 'B6'), ('B1', 'B6'),
    ('B7', 'B8a'), ('B7', 'B8b'), ('B8a', 'B8b'),
    ('B8a', 'B9a'), ('B4', 'B9a'), ('B8b', 'B9b'), ('B9a', 'B9b'),
    ('B9b', 'B10'), ('B10', 'B13b'),
    ('B8a', 'B13a'), ('B7', 'B13a'), ('B5', 'B13a'), ('B13a', 'B13b'), ('B13b', 'B12'),
    # BH (owner 2026-10-01): las filas 13 y 13-bis del 19 §4 pasan a B13a y confirman la acción 2 de B9a
    ('B9a', 'B13a'),
]
E = sorted(set(INTRA + [(a, b) for a, b, _ in CRUZADAS]))
nodos = {x for e in E for x in e}
if nodos != set(piezas):
    fallas.append(f'en el grafo y no en la lista: {sorted(nodos - set(piezas))} · '
                  f'en la lista y no en el grafo: {sorted(set(piezas) - nodos)}')
malas = [(a, b) for a, b in E if b not in despues and a in despues]
print(f'aristas: {len(E)} · intra: {len(set(INTRA))} · entre épicas: {len(CRUZADAS)} flechas en '
      f'{len(transcriptas)} filas')
print(f'piezas: {len(piezas)} · al corte: {len(set(piezas) - despues)} · después: {len(despues)}')
print(f'violaciones (una pieza del corte depende de una posterior): {len(malas)}')
for a, b in malas:
    fallas.append(f'{b} (corte) depende de {a} (después)')
if '-v' in sys.argv:
    for a, b in E:
        print(f'   {a:5}→ {b:5} {"después" if b in despues else "CORTE":8} '
              f'desde {"después" if a in despues else "CORTE"}')
for f in fallas:
    print('✗', f)
sys.exit(1 if fallas else 0)
