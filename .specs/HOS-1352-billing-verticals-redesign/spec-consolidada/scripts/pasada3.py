#!/usr/bin/env python3
"""Work lists of the third drafting pass of the consolidated spec (HOS-1352).

    python3 pasada3.py --inv-viejo=<inventario.json at the old SHA, or <commit>:<path>>
                       --reanclar=<reanclar.json> --lote=<lote.md> [--salida=<dir>]
                       (default: _trabajo/pasada3/)

Same four sections as pasada2.py (new AC/tests, changed source text, citations left on changed
text, R17 sections), split in the three groups of the third pass, plus:
  5. the `Origen:` lines R6 still rejects (an item block whose citation sits on changed text);
  6. «Lo que la redacción tiene que cambiar después del lote», the last section of the owner batch
     BY-CB (``--lote``), split per spec file: every top-level bullet goes to every spec file it
     names, with its sub-bullets.
The generated files (01 and 04) belong to no drafting group: what lands on them goes to
`generados.md`, which is informational (they are rebuilt by their generators, never by hand).
"""
import collections
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pasada2  # noqa: E402

pasada2.TITULO = 'Pasada 3'
pasada2.SCRIPT = 'scripts/pasada3.py'
pasada2.GRUPOS = collections.OrderedDict([
    ('verticales', ['U1', 'U2', 'U3', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V8a', 'V9a', 'V9b', 'V7',
                    'V8b']),
    ('billing', ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8a', 'B9a', 'B11', 'B13a', 'B8b', 'B9b',
                 'B10', 'B12', 'B13b']),
    ('transversal', ['00-indice.md', '02-nucleo.md', '02-nucleo-auditoria.md', '02-nucleo-glosario.md',
                     '02-nucleo-modelo-y-maquinas.md', '02-nucleo-outbox.md',
                     '03-contrato-de-cobertura.md', '30-el-corte.md', '80-abiertos.md', '90-retirados.md',
                     '_trabajo/']),
    ('generados', ['01-decisiones-vigentes.md', '04-catalogos.md']),
])

S_R6 = 'Origen corrido (R6): el bloque cita una línea cuyo texto cambió'
S_LOTE = 'Lo que la redacción tiene que cambiar después del lote BY a CB'
NOMBRE = re.compile(r'`((?:10-corte/|20-fase-\d/)?[0-9A-Za-z][\w.-]*\.md|_trabajo/)`')


def opt(k):
    return next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith(f'--{k}=')), None)


def r6(ctx):
    """Every block R6 rejects, on the file that holds it."""
    for e in ctx.err.get('R6 Origen no cita la posición del ítem', []):
        m = re.match(r'^(\S+) \((.+):(\d+)\)$', e)
        ctx.add(m.group(2), S_R6, f'- `{m.group(1)}` (línea {m.group(3)}): su `Origen:` apunta a una línea '
                                  'que reanclar.py no remapeó porque su texto cambió; ver la cita en '
                                  '«Citas sobre texto cambiado» y fijar la línea nueva a mano')
    return [S_R6]


def lote(ctx):
    """The last section of the owner batch, per spec file it names."""
    path = opt('lote')
    if not path:
        sys.exit('falta --lote=<lote.md>')
    L = open(path, encoding='utf-8').read().split('\n')
    k = next(i for i, l in enumerate(L) if l.startswith('## Lo que la redacción tiene que cambiar'))
    bullets, cur = [], None
    for l in L[k + 1:]:
        if l.startswith('## '):
            break
        if l.startswith('- '):
            cur = [l]
            bullets.append(cur)
        elif cur is not None and (l.startswith('  ') or not l.strip()):
            if l.strip():
                cur.append(l)
    n = 0
    for b in bullets:
        head = b[0].split(':', 1)[0]
        names = list(dict.fromkeys(NOMBRE.findall(head)))
        if not names:
            sys.exit(f'bullet del lote sin archivo: {b[0]!r}')
        for f in names:
            ctx.add(f, S_LOTE, '\n'.join(b))
            n += 1
    print('lote: bullets', len(bullets), 'asignaciones', n)
    return [S_LOTE]


pasada2.EXTRA = [r6, lote]

if __name__ == '__main__':
    if not any(a.startswith('--salida=') for a in sys.argv[1:]):
        sys.argv.append('--salida=' + os.path.join(pasada2.TR, 'pasada3'))
    pasada2.main()
