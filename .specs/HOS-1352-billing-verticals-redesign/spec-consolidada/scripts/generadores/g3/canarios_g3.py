#!/usr/bin/env python3
"""Canaries for the check gen.py gained in the second blind-verification round (H2-G2-5, pattern P-I):
the run with the real omisiones.json passes (exit 0), and each mutation must make it fail (exit 1) with
its message. A canary that passes is a blind check.

    python3 canarios_g3.py

  defecto   «4. Grace» (`B/03:1589`), whose title names no id, out of «adjuntar»: it used to land
            silently under `TRANS:B:S1`; now the run must stop.
  sobrante  an «adjuntar» entry for a line that is no attachable section (a stale map).
  ajeno     an «adjuntar» entry that sends a section to an id that is not an item of 04.
"""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GEN = os.path.join(HERE, 'gen.py')
OMIT = json.load(open(os.path.join(HERE, 'omisiones.json'), encoding='utf-8'))
GRACE = 'B/03-maquinas-de-estado.md:1589'


def run(omit):
    d = tempfile.mkdtemp(prefix='canario-g3-')
    p = os.path.join(d, 'omisiones.json')
    json.dump(omit, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    r = subprocess.run([sys.executable, GEN, '--salida=' + d, '--omisiones=' + p], capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def main():
    fallas = 0
    code, out = run(OMIT)
    print(f'{"✓" if code == 0 else "✗"} base: exit {code}' + ('' if code == 0 else '\n' + out))
    fallas += code != 0
    m = json.loads(json.dumps(OMIT))
    m['adjuntar'].pop(GRACE)
    code, out = run(m)
    good = code == 1 and GRACE in out and 'no nombra un id' in out
    print(f'{"✓" if good else "✗ CIEGO"} defecto  exit {code} · «4. Grace» sin entrada en «adjuntar»')
    fallas += not good
    m = json.loads(json.dumps(OMIT))
    m['adjuntar']['B/03-maquinas-de-estado.md:1590'] = {'a': 'TRANS:B:S4', 'por': 'canario', 'hereda': True}
    code, out = run(m)
    good = code == 1 and 'no son una sección adjuntable' in out
    print(f'{"✓" if good else "✗ CIEGO"} sobrante exit {code} · una entrada que no es una sección')
    fallas += not good
    m = json.loads(json.dumps(OMIT))
    m['adjuntar'][GRACE] = {'a': 'TRANS:B:S99', 'por': 'canario', 'hereda': True}
    code, out = run(m)
    good = code == 1 and 'no es un ítem de 04' in out
    print(f'{"✓" if good else "✗ CIEGO"} ajeno    exit {code} · una entrada hacia un id que no es de 04')
    fallas += not good
    print(f'\n4 canarios · {fallas} fallas')
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main())
