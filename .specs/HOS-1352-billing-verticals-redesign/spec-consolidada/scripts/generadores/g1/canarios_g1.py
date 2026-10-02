#!/usr/bin/env python3
"""Canaries for the checks gen01.py gained in the first blind-verification round (2026-10-02): the run
with the real omisiones.json passes (exit 0), and each mutation must make it fail (exit 1) with its
message. A canary that passes is a blind check.

    python3 canarios_g1.py

  pipe      a table row split at every «|», escaped or not, leaves a cell ending in «\\» (5a of the
            FASE 9 completa) and partir() refuses it.
  caducada  a letter its own file declares caducated, rendered without its ⚠️ (G2-4 out of
            `letras_muertas`).
  promesa   a PARCIAL note that promises «la muestra bajo el 📌6» with nothing relocated there
            (`reubicar` emptied).
"""
import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GEN = os.path.join(HERE, 'gen01.py')
OMIT = json.load(open(os.path.join(HERE, 'omisiones.json'), encoding='utf-8'))


def run(omit):
    d = tempfile.mkdtemp(prefix='canario-g1-')
    p = os.path.join(d, 'omisiones.json')
    json.dump(omit, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    r = subprocess.run([sys.executable, GEN, '--salida=' + d, '--omisiones=' + p], capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def pipe():
    """partir() on the real 5a row, first as written (keeps FAILED), then with a naive separator."""
    sys.argv = [GEN]
    sys.path.insert(0, HERE)
    import gen01  # noqa: E402  (main() does not run on import)
    from comun import D, lines  # noqa: E402
    path = D + '26-fase-9-completa/10-decisiones-del-owner.md'
    row = next(l for l in lines(path) if '\\|' in l and l.startswith('|'))
    ok = any('| FAILED' in c for c in gen01.partir(row))
    gen01.PIPE = re.compile(r'\|')
    try:
        gen01.partir(row)
        return ok, 0, 'partir aceptó una celda terminada en «\\»'
    except SystemExit as e:
        return ok, 1, str(e)


def main():
    fallas = 0
    code, out = run(OMIT)
    print(f'{"✓" if code == 0 else "✗"} base: exit {code}' + ('' if code == 0 else '\n' + out))
    fallas += code != 0
    ok, code, out = pipe()
    good = ok and code == 1 and 'celda partida' in out
    print(f'{"✓" if good else "✗ CIEGO"} pipe     exit {code} · la fila 5a se lee entera, y partida en cada «|» falla')
    fallas += not good
    m = json.loads(json.dumps(OMIT))
    m['letras_muertas'].pop('OWN:28-fase-9-vuelta-1:t1:G2-4')
    code, out = run(m)
    good = code == 1 and 'se rinde sin ⚠️' in out
    print(f'{"✓" if good else "✗ CIEGO"} caducada exit {code} · G2-4 sin su ⚠️, con la nota de caducidad de su archivo')
    fallas += not good
    m = json.loads(json.dumps(OMIT))
    m['reubicar'] = {}
    code, out = run(m)
    good = code == 1 and 'promete mostrar' in out
    print(f'{"✓" if good else "✗ CIEGO"} promesa  exit {code} · la nota del 📌7 promete el 📌6 y nada se reubica')
    fallas += not good
    print(f'\n4 canarios · {fallas} fallas')
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main())
