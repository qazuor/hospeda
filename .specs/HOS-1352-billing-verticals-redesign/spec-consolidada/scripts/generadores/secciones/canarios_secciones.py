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

Every run writes under a temporary --salida, never over the six pieces of the spec.
"""
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


def run(prefijo=False):
    d = tempfile.mkdtemp(prefix='canario-secciones-')
    if not prefijo:
        r = subprocess.run([sys.executable, GEN, '--salida=' + d], capture_output=True, text=True)
        return r.returncode, r.stdout + r.stderr
    code = (f'import re, sys; sys.path.insert(0, {os.path.join(C, "scripts")!r}); import comun\n'
            'nuevo = comun.dead_row\n'
            'comun.dead_row = lambda cs: bool(re.match(r"^\\s*~~", cs[0])) or nuevo(cs)\n'
            f'sys.argv = [{GEN!r}, "--salida={d}"]; sys.path.insert(0, {HERE!r})\n'
            'import gen; gen.main()\n')
    r = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def main():
    fallas = 0
    code, out = run()
    print(f'{"✓" if code == 0 else "✗"} base: exit {code}' + ('' if code == 0 else '\n' + out))
    fallas += code != 0
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
    code, out = run(prefijo=True)
    good = code == 1 and 'fila descartada como muerta con texto vivo' in out
    print(f'{"✓" if good else "✗ CIEGO"} prefijo  exit {code} · dead_row vuelve a «la primera celda empieza con ~~»')
    fallas += not good
    print(f'\n3 canarios · {fallas} fallas')
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main())
