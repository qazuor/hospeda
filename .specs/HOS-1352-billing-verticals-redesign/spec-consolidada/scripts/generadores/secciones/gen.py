#!/usr/bin/env python3
"""Write the body of the «sections the row assigns» blocks of six pieces (H-ORQ-2, pattern P2).

    python3 gen.py [--salida=<dir>]   (default: rewrites the six piece files of the spec in place)

Six pieces announce «Las secciones de <cap>, que la columna de capítulos de la fila le asigna:» and
used to follow it with a bare `Origen:` line and no body (trazar R21). This generator transcribes,
under that announcement, every source section the `Origen:` line cites, in source order, from the
FROZEN commit: the text without struck spans, dead table rows dropped and links neutralized (the
same cleaning as g3). Each section keeps its own `Origen:` with the cited lines that fall in it, so
the union of all the `Origen:` lines is exactly the original citation list.

The citation list of each block is kept in `fuentes.json` next to this file the first time the
generator runs, so later runs replace the generated block between its markers instead of
re-reading a bare `Origen:` line that no longer exists.
"""
import json
import os
import re
import sys

# Paths are relative to this file: generadores/<grupo>/ -> scripts/ -> spec-consolidada/.
HERE = os.path.dirname(os.path.abspath(__file__))
C = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(C, 'scripts'))
from comun import cells, dead_row, lines  # noqa: E402

PIEZAS = ('10-corte/B11.md', '10-corte/B13a.md', '10-corte/B9a.md',
          '20-fase-2/B8b.md', '20-fase-3/B10.md', '20-fase-3/B12.md')
ANUNCIO = re.compile(r'^Las secciones de .*que la columna de capítulos de la fila le asigna:\s*$')
INICIO = '<!-- g-secciones: inicio (generado por scripts/generadores/secciones/gen.py; no editar a mano) -->'
FIN = '<!-- g-secciones: fin -->'
FUENTES = os.path.join(HERE, 'fuentes.json')

INV = json.load(open(C + '/_trabajo/inventario.json', encoding='utf-8'))['items']
SECS = sorted((i for i in INV if i['fuente'] == 'SEC'), key=lambda i: (i['archivo'], i['linea']))

LINK = re.compile(r'\[([^\]]*)\]\(([^)\s]*)\)')
Bp = '.specs/HOS-1354-billing-cobro-y-proveedor/'
CORTO = {Bp + 'docs/': 'B/', Bp: 'B/'}


def corto(path):
    for k, v in CORTO.items():
        if path.startswith(k):
            return v + path[len(k):]
    return path


def _rep(m):
    """Keep one blank between two words a struck span used to separate (same rule as g3, plus a
    closing emphasis marker counts as punctuation: «**x ~~y~~**» must not become «**x **»)."""
    g1, g2 = m.group(1), m.group(2)
    if g1 and g2:
        return ' '
    b, a = m.string[m.start() - 1:m.start()], m.string[m.end():m.end() + 1]
    if (g1 or g2) and b and a and not b.isspace() and not a.isspace() and a not in ',.;:)»*' and b not in '(«':
        return ' '
    return ''


def limpiar(t):
    """Drop struck spans and neutralize links; nothing else changes the source wording."""
    t = re.sub(r'([ \t]?)~~.*?~~([ \t]?)', _rep, t, flags=re.S)
    return LINK.sub(lambda m: f'{m.group(1)} (`{m.group(2)}`)' if m.group(2) else m.group(1), t)


def sec_de(path, n):
    """The leaf SEC of the inventory that contains line ``n`` of ``path``."""
    hit = [s for s in SECS if s['archivo'] == path and s['linea'] <= n <= s['fin']]
    if not hit:
        sys.exit(f'✗ {path}:{n} no cae en ninguna sección del inventario')
    return max(hit, key=lambda s: s['linea'])


def cuerpo(sec, base, nivel_fuente):
    """Heading plus cleaned text of one source section, re-levelled under the piece heading."""
    L = lines(sec['archivo'])
    head = L[sec['linea'] - 1]
    m = re.match(r'^(#+)\s+(.*)$', head)
    if not m:
        sys.exit(f"✗ {sec['id']} no empieza con un encabezado")
    nivel = min(6, base + len(m.group(1)) - nivel_fuente)
    titulo = limpiar(m.group(2)).strip()
    out = []
    for k in range(sec['linea'] + 1, sec['fin'] + 1):
        l = L[k - 1]
        if l.startswith('|') and not re.match(r'^\|[\s:|-]+\|?\s*$', l) and dead_row(cells(l)):
            continue
        if re.match(r'^---\s*$', l):
            continue
        out.append(l)
    txt = limpiar('\n'.join(out))
    txt = '\n'.join(x.rstrip() for x in txt.split('\n'))
    txt = re.sub(r'\n{3,}', '\n\n', txt).strip()
    if re.search(r'^#{1,6}\s', txt, re.M):
        sys.exit(f"✗ {sec['id']}: la sección hoja trae un encabezado adentro")
    # A section whose tail is all struck ends announcing what it no longer has («queda tachado:»):
    # mark the omission with g3's «[…]» (BK) instead of leaving a «:» that R21 reads as no body.
    if txt.endswith(':'):
        txt += '\n\n[…]'
    return nivel, titulo, txt


def nivel_previo(L, k):
    """Level of the nearest heading above line index ``k`` of the piece."""
    for j in range(k - 1, -1, -1):
        m = re.match(r'^(#+)\s', L[j])
        if m:
            return len(m.group(1))
    return 1


def bloque(citas, base):
    """The generated block for one announcement: one sub-section per cited source section."""
    por_sec, orden = {}, []
    for path, n in citas:
        s = sec_de(path, n)
        if s['id'] not in por_sec:
            por_sec[s['id']] = (s, [])
            orden.append(s['id'])
        por_sec[s['id']][1].append(f'{path}:{n}')
    nivel_fuente = min(len(re.match(r'^(#+)', lines(por_sec[i][0]['archivo'])[por_sec[i][0]['linea'] - 1]).group(1))
                       for i in orden)
    partes, pendientes = [INICIO, ''], []
    for sid in orden:
        s, cit = por_sec[sid]
        nivel, titulo, txt = cuerpo(s, base, nivel_fuente)
        partes += [f"{'#' * nivel} {corto(s['archivo'])} · {titulo}", '']
        pendientes += cit
        # A heading-only section (a parent with no prose of its own) carries its citation to the
        # next section with text: a heading followed directly by `Origen:` is what R21 rejects.
        if txt:
            partes += [txt, '', 'Origen: ' + ', '.join(pendientes), '']
            pendientes = []
    if pendientes:
        sys.exit(f'✗ citas sin sección con texto que las lleve: {pendientes}')
    partes.append(FIN)
    return partes


def parse_origen(line):
    out = []
    for c in line[len('Origen:'):].split(','):
        p, n = c.strip().rsplit(':', 1)
        out.append((p, int(n)))
    return out


def main():
    salida = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--salida=')), C)
    fuentes = json.load(open(FUENTES, encoding='utf-8')) if os.path.exists(FUENTES) else {}
    nuevas = False
    for rel in PIEZAS:
        L = open(os.path.join(C, rel), encoding='utf-8').read().split('\n')
        anuncios = [k for k, l in enumerate(L) if ANUNCIO.match(l)]
        if len(anuncios) != 1:
            sys.exit(f'✗ {rel}: {len(anuncios)} anuncios, se esperaba uno')
        k = anuncios[0]
        j = k + 1
        while j < len(L) and not L[j].strip():
            j += 1
        if L[j] == INICIO:
            fin = L.index(FIN, j)
            citas = [tuple(x) for x in fuentes[rel]]
        elif L[j].startswith('Origen: '):
            fin = j
            citas = parse_origen(L[j])
            fuentes[rel] = citas
            nuevas = True
        else:
            sys.exit(f'✗ {rel}:{j + 1}: después del anuncio no hay ni Origen: ni bloque generado')
        nuevo = L[:k + 1] + [''] + bloque(citas, nivel_previo(L, k) + 1) + L[fin + 1:]
        dst = os.path.join(salida, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        open(dst, 'w', encoding='utf-8').write('\n'.join(nuevo))
        print(rel, len(citas), 'citas,', len(nuevo), 'líneas')
    # Written only when a bare `Origen:` was read, so a plain regeneration leaves the file alone.
    if salida == C and nuevas:
        json.dump(fuentes, open(FUENTES, 'w', encoding='utf-8'), ensure_ascii=False, indent=4)


if __name__ == '__main__':
    main()
