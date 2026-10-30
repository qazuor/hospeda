#!/usr/bin/env python3
"""Canaries for the dead-row rule g-secciones gained in the second blind-verification round (H2-VA8-3,
pattern P-K): the dry run with the real comun.py passes (exit 0), the fixtures hold, and the mutation
must make it fail (exit 1) with its message. A canary that passes is a blind check.

    python3 canarios_secciones.py

  fixtures  comun.dead_row on real rows at the frozen SHA: the three live rows g-secciones dropped
            (`B/09` §3, `monto esperado, derivado` and `last_modified`; `B/19` §4, motive 15) are
            alive; three rows struck entire with a parenthesis that dates the strike are dead.
  prefijo   comun.dead_row back to «the first cell STARTS with ~~»: gen.py must refuse to drop a row
            with live text (sin_texto_vivo), naming its line.

Third round (H3-G2-13, pattern P-K reversed, and H3-G2-12, pattern P-M):
  sale      the base run puts the live «**sale** …» of a row retired by its id cell under its table
            (`B/09`, the cut's tombstone; `B/19`, row 20): it used to go silently with the row.
  idcelda   sin_texto_vivo back to «the id cell struck entire is enough»: those notes disappear.
  otro      a retired row with live text that is no «**sale** …» stops the run.
  entero    B9a says «el capítulo `14`, entero»: fuentes.json without the chapter's preamble, and
            without its MIXTO §4.6, must stop the run.

Every run writes under a temporary --salida, never over the six pieces of the spec.
"""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GEN = os.path.join(HERE, 'gen.py')
C = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(C, 'scripts'))
from comun import B, V, cells, dead_row, lines  # noqa: E402

VIVAS = [(B + 'docs/09-conciliacion.md', '**monto esperado, derivado**'),
         (B + 'docs/09-conciliacion.md', '**el `last_modified` del recurso**'),
         (B + 'docs/19-superficies.md', '~~ `COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN`')]
MUERTAS = [(B + 'docs/03-maquinas-de-estado.md', '(`V2-d`, `V2-n`) | — | — | **sale**'),
           (V + 'docs/02-modelo-de-datos.md', '~~**llega el fin de servicio de la vertical**~~ (owner'),
           (B + 'descomposicion.md', '| **B12** | ~~se deja de cobrar antes de dejar de prestar~~')]


def fila(path, frag):
    hits = [(n, l) for n, l in enumerate(lines(path), 1) if l.startswith('|') and frag in l]
    if len(hits) != 1:
        sys.exit(f'✗ {path}: {len(hits)} filas con «{frag}»')
    return hits[0]


NOTAS = (('10-corte/B11.md', '*(fila retirada: **sale** (FASE 5, owner 2026-09-30, simplificación del corte, S-40): '
           'sin lápida del corte, un cobro tardío de un débito viejo entra como desconocido'),
         ('10-corte/B13a.md', 'Una vertical con todos sus planes retirados no ofrece checkout porque no tiene versión '
          'vendible, y lo dice la fila 29 de `V/19` §4)*'))
B14 = B + 'docs/14-promos-cortesias-y-grants.md'


def leer(d, rel):
    p = os.path.join(d, rel)
    return open(p, encoding='utf-8').read() if os.path.exists(p) else ''


def run_con(parche, fuentes=None):
    """gen.py in a fresh process with ``parche`` (python, after ``import gen``) applied before main()."""
    d = tempfile.mkdtemp(prefix='canario-secciones-')
    pre = ''
    if fuentes is not None:
        p = os.path.join(d, 'fuentes.json')
        json.dump(fuentes, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
        pre = f'gen.FUENTES = {p!r}\n'
    code = (f'import re, sys; sys.argv = [{GEN!r}, "--salida={d}"]; sys.path.insert(0, {HERE!r})\n'
            'import gen\n' + pre + parche + '\ngen.main()\n')
    r = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr, d


def run(prefijo=False):
    d = tempfile.mkdtemp(prefix='canario-secciones-')
    if not prefijo:
        r = subprocess.run([sys.executable, GEN, '--salida=' + d], capture_output=True, text=True)
        return r.returncode, r.stdout + r.stderr, d
    code = (f'import re, sys; sys.path.insert(0, {os.path.join(C, "scripts")!r}); import comun\n'
            'nuevo = comun.dead_row\n'
            'comun.dead_row = lambda cs: bool(re.match(r"^\\s*~~", cs[0])) or nuevo(cs)\n'
            f'sys.argv = [{GEN!r}, "--salida={d}"]; sys.path.insert(0, {HERE!r})\n'
            'import gen; gen.main()\n')
    r = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr, d


def main():
    fallas = 0
    code, out, d = run()
    print(f'{"✓" if code == 0 else "✗"} base: exit {code}' + ('' if code == 0 else '\n' + out))
    fallas += code != 0
    faltan = [t for rel, t in NOTAS if t not in leer(d, rel)]
    print(f'{"✓" if not faltan else "✗ CIEGO"} sale     el «**sale** …» vivo de una fila retirada por su id va como nota'
          + ''.join(f'\n    falta: {t[:70]!r}' for t in faltan))
    fallas += bool(faltan)
    code, out, d = run_con('gen.sin_texto_vivo = lambda path, n, cs: []')
    good = code == 0 and all(t not in leer(d, rel) for rel, t in NOTAS) and not faltan
    print(f'{"✓" if good else "✗ CIEGO"} idcelda  exit {code} · con la regla vieja las notas desaparecen (el canario «sale» las ve)')
    fallas += not good
    code, out, _ = run_con('import sys as _s; _s.exit(0 if gen.sin_texto_vivo("x", 1, ["~~a~~", "texto vivo"]) is None else 0)')
    good = code == 1 and 'fila descartada como muerta con texto vivo' in out
    print(f'{"✓" if good else "✗ CIEGO"} otro     exit {code} · una fila retirada con texto vivo que no es «**sale**»')
    fallas += not good
    base = json.load(open(os.path.join(HERE, 'fuentes.json'), encoding='utf-8'))
    for quitar, que in ((17, 'el preámbulo'), (634, 'el §4.6 MIXTO')):
        f = json.loads(json.dumps(base))
        f['10-corte/B9a.md'] = [c for c in f['10-corte/B9a.md'] if c != [B14, quitar]]
        code, out, _ = run_con('', fuentes=f)
        good = len(f['10-corte/B9a.md']) < len(base['10-corte/B9a.md']) and code == 1 and 'entero' in out
        print(f'{"✓" if good else "✗ CIEGO"} entero   exit {code} · B9a sin {que} de `B/14`')
        fallas += not good
    malas = []
    for path, frag in VIVAS:
        n, l = fila(path, frag)
        if dead_row(cells(l)):
            malas.append(f'{path}:{n} viva y dada por muerta')
    for path, frag in MUERTAS:
        n, l = fila(path, frag)
        if not dead_row(cells(l)):
            malas.append(f'{path}:{n} muerta y dada por viva')
    print(f'{"✓" if not malas else "✗"} fixtures · 3 vivas, 3 muertas' + ''.join('\n    ' + m for m in malas))
    fallas += bool(malas)
    code, out, _ = run(prefijo=True)
    good = code == 1 and 'fila descartada como muerta con texto vivo' in out
    print(f'{"✓" if good else "✗ CIEGO"} prefijo  exit {code} · dead_row vuelve a «la primera celda empieza con ~~»')
    fallas += not good
    print(f'\n8 canarios · {fallas} fallas')
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main())
