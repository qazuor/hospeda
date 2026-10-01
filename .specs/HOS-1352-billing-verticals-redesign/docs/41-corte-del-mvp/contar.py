#!/usr/bin/env python3
"""Cuenta las piezas del corte del MVP y sus guards.

Lee, siempre por encabezado y nunca por número de línea:
  - la lista de piezas: la tabla `| pieza | unidad | cuándo | fuente |` de D/16 §4.6;
  - la columna *guards* de la tabla de unidades de V/descomposicion.md §2 y de
    B/descomposicion.md §2, y la de la tabla de U1-U3 de D/16 §4.6.

Saca lo tachado (~~...~~) y los comentarios en itálica (*(...)*). Una unidad partida (V8, V9,
B8, B9, B13) deja de ser pieza: su fila queda como origen de sus mitades, y si conserva un guard
vivo es un error, porque se contaría dos veces.

Y verifica dos traslados del corte (owner 2026-10-01, AP a AU), también por encabezado:
  - la tabla `| transición | pieza | nota |` de B/descomposicion.md §2.12 contra las filas vivas de
    B/docs/03-maquinas-de-estado.md §3.2: cada transición viva aparece una vez, su pieza existe, y
    las que trasladan AR y AS caen en una pieza del corte. Una celda sin pieza —la marca `AV` que
    usó la pregunta abierta, ya contestada— es una falla;
  - la tabla `| esquema | de | lo crea | fuente |` de D/16 §4.6: cada fila va de una pieza posterior
    a una pieza del corte (AD: una fase posterior no trae migración estructural).

Sale 1 si algo no cierra: piezas sin fila, filas sin pieza, guards repetidos, origen con guard, o
un traslado que no cumple lo de arriba.
"""
import os
import re
import sys

W = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')) + '/'
V = 'HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md'
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
            cols = [c.strip() for c in l.strip().strip('|').split('|')]
            filas = []
            for f in lineas[i + 2:]:
                if not f.startswith('|'):
                    break
                filas.append([c.strip() for c in f.strip().strip('|').split('|')])
            return cols, filas
    sys.exit(f'✗ no encontré la tabla /{cabecera}/')


def limpio(celda):
    celda = re.sub(r'~~.*?~~', '', celda)
    return re.sub(r'\*\([^*]*?\)\*', '', celda)


def guards(celda):
    return sorted(set(re.findall(r'`(G(?:-R\d+(?:-[A-F])?|\d+))`', limpio(celda))))


def id_de(celda):
    m = re.match(r'\*\*(' + PIEZA + r')\*\*', celda)
    return m.group(1) if m else None


fallas = []
# 1. la lista de piezas
cols, filas = tabla(seccion(D16, r'^### 4\.6 '), r'^\| pieza \| unidad \| cuándo \|')
piezas = {}
for f in filas:
    p = f[0].strip('`')
    if p in piezas:
        fallas.append(f'pieza repetida en D/16 §4.6: {p}')
    piezas[p] = f[2]
corte = sorted(p for p, c in piezas.items() if c == 'corte')
despues = sorted(p for p, c in piezas.items() if c == 'después')
otras = sorted(p for p, c in piezas.items() if c not in ('corte', 'después'))
if otras:
    fallas.append(f'piezas sin «corte» ni «después»: {otras}')

# 2. los guards por fila
G = {}
for path in (V, B):
    cols, filas = tabla(seccion(path, r'^## 2\. '), r'^\| # \| unidad \|')
    ig = cols.index('guards')
    for f in filas:
        u = id_de(f[0])
        if u:
            G[u] = guards(f[ig])
cols, filas = tabla(seccion(D16, r'^### 4\.6 '), r'^\| unidad \| qué deja funcionando \| guards \|')
for f in filas:
    u = id_de(f[0])
    if u:
        G[u] = guards(f[cols.index('guards')])

origenes = sorted({u for u in G if u + 'a' in G or u + 'b' in G})
for u in origenes:
    if G[u]:
        fallas.append(f'la fila de origen {u} conserva guards vivos: {G[u]}')
filas_pieza = {u: g for u, g in G.items() if u not in origenes}
if set(filas_pieza) != set(piezas):
    fallas.append(f'piezas sin fila: {sorted(set(piezas) - set(filas_pieza))} · '
                  f'filas sin pieza: {sorted(set(filas_pieza) - set(piezas))}')


def orden(s):
    return (s[0], int(re.sub(r'\D', '', s)), s)


todos = [g for gs in filas_pieza.values() for g in gs]
for u in sorted(filas_pieza, key=orden):
    marca = 'corte' if piezas.get(u) == 'corte' else 'después'
    print(f'{u:5} {marca:8} {len(filas_pieza[u]):2} {" ".join(filas_pieza[u])}')
if len(todos) != len(set(todos)):
    fallas.append(f'guards en más de una pieza: {sorted({g for g in todos if todos.count(g) > 1})}')
al_corte = [g for u, gs in filas_pieza.items() if piezas.get(u) == 'corte' for g in gs]
afuera = sorted(g for u, gs in filas_pieza.items() if piezas.get(u) == 'después' for g in gs)
print(f'\npiezas: {len(piezas)} · al corte: {len(corte)} · después: {len(despues)} '
      f'· partidas (origen, no son pieza): {" ".join(origenes)}')
print(f'después: {" ".join(sorted(despues, key=orden))}')
print(f'guards: {len(todos)} · distintos: {len(set(todos))} · al corte: {len(al_corte)} '
      f'· después: {len(afuera)} {" ".join(afuera)}')
print('por familia:', ' · '.join(f'{k}: {sum(len(g) for u, g in filas_pieza.items() if u[0] == k)}'
                                 for k in 'VBU'))
# 3. los traslados: transiciones (B §2.12) y esquema (D/16 §4.6)
B03 = 'HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md'
vivas = set()
for l in seccion(B03, r'^### 3\.2 '):
    m = re.match(r'\| (\*\*)?(S\d+)(\*\*)?( ✚)? \|', l)
    if m:
        vivas.add(m.group(2))
cols, filas = tabla(seccion(B, r'^### 2\.12 '), r'^\| transición \| pieza \| nota \|')
vistas, pendientes = [], []
for f in filas:
    s = f[0].strip('`')
    vistas.append(s)
    dueñas = re.findall(r'`(' + PIEZA + r')`', f[1])
    if not dueñas and f[1]:
        pendientes.append(s)
    if not dueñas:
        fallas.append(f'transición {s} sin pieza (celda: «{f[1]}»)')
    for x in dueñas:
        if x not in piezas:
            fallas.append(f'transición {s}: la pieza {x} no existe')
        elif re.fullmatch(r'AR|AS', f[2]) and piezas[x] != 'corte':
            fallas.append(f'transición {s} ({f[2]}) en {x}, que no es del corte')
if sorted(vistas) != sorted(set(vistas)):
    fallas.append(f'transiciones repetidas: {sorted({s for s in vistas if vistas.count(s) > 1})}')
if set(vistas) != vivas:
    fallas.append(f'vivas sin fila: {sorted(vivas - set(vistas))} · '
                  f'filas que no están vivas: {sorted(set(vistas) - vivas)}')
print(f'transiciones: {len(vivas)} vivas en 03 §3.2 · {len(set(vistas))} en la tabla de B §2.12 '
      f'· sin pieza (marca abierta): {" ".join(pendientes) or "ninguna"}')
cols, filas = tabla(seccion(D16, r'^### 4\.6 '), r'^\| esquema \| de \| lo crea \|')
for f in filas:
    de, crea = f[1].strip('`'), f[2].strip('`')
    if piezas.get(crea) != 'corte':
        fallas.append(f'esquema «{f[0][:40]}…»: lo crea {crea}, que no es una pieza del corte')
    if piezas.get(de) != 'después':
        fallas.append(f'esquema «{f[0][:40]}…»: es de {de}, que no es una pieza posterior')
print(f'esquema de lo posterior creado al corte: {len(filas)} filas · '
      f'piezas que lo crean: {" ".join(sorted({f[2].strip("`") for f in filas}, key=orden))}')
for f in fallas:
    print('✗', f)
sys.exit(1 if fallas else 0)
