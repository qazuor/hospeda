#!/usr/bin/env python3
"""Canaries for the check gen.py gained in the second blind-verification round (H2-G2-5, pattern P-I):
the run with the real omisiones.json passes (exit 0), and each mutation must make it fail (exit 1) with
its message. A canary that passes is a blind check.

    python3 canarios_g3.py

  defecto   «4. Grace» (`B/03:1589`), whose title names no id, out of «adjuntar»: it used to land
            silently under `TRANS:B:S1`; now the run must stop.
  sobrante  an «adjuntar» entry for a line that is no attachable section (a stale map).
  ajeno     an «adjuntar» entry that sends a section to an id that is not an item of 04.

Third round (H3-G2-10, pattern P-M):
  mixto     the base run carries the live body of two sections whose title is struck entire
            (`V/03:365`, «el panel no deja pasar los días de prueba»; `B/03:944`, «`S10` vuelve a ser la
            única salida de `PAUSED`»): they are MIXTO and attached like live ones.
  muerto    the inventory as the title-only rule wrote it (those MIXTO sections back to MUERTO): the
            run must stop instead of dropping their live text.
"""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GEN = os.path.join(HERE, 'gen.py')
C = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
OMIT = json.load(open(os.path.join(HERE, 'omisiones.json'), encoding='utf-8'))
GRACE = 'B/03-maquinas-de-estado.md:1589'
VIVOS_DE_MIXTAS = ('el panel no deja pasar los días de prueba de una vertical de 0 a',
                   '`S10` vuelve a ser la\núnica salida de `PAUSED` por su evento')


def run(omit, inv=None):
    d = tempfile.mkdtemp(prefix='canario-g3-')
    p = os.path.join(d, 'omisiones.json')
    json.dump(omit, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    extra = []
    if inv is not None:
        extra = ['--inventario=' + os.path.join(d, 'inventario.json')]
        json.dump(inv, open(os.path.join(d, 'inventario.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    r = subprocess.run([sys.executable, GEN, '--salida=' + d, '--omisiones=' + p] + extra, capture_output=True, text=True)
    salida = os.path.join(d, '04-catalogos.md')
    txt = open(salida, encoding='utf-8').read() if os.path.exists(salida) else ''
    return r.returncode, r.stdout + r.stderr, txt


def main():
    fallas = 0
    code, out, txt = run(OMIT)
    print(f'{"✓" if code == 0 else "✗"} base: exit {code}' + ('' if code == 0 else '\n' + out))
    fallas += code != 0
    faltan = [v for v in VIVOS_DE_MIXTAS if v not in txt]
    print(f'{"✓" if not faltan else "✗ CIEGO"} mixto    el cuerpo vivo de dos secciones de título tachado va adjunto'
          + ''.join(f'\n    falta: {v!r}' for v in faltan))
    fallas += bool(faltan)
    inv = json.load(open(os.path.join(C, '_trabajo', 'inventario.json'), encoding='utf-8'))
    n = 0
    for i in inv['items']:
        if i['fuente'] == 'SEC' and i['estado'] == 'MIXTO':
            i['estado'], n = 'MUERTO', n + 1
    code, out, _ = run(OMIT, inv)
    good = n > 0 and code == 1 and 'sección MUERTO con texto vivo' in out
    print(f'{"✓" if good else "✗ CIEGO"} muerto   exit {code} · {n} secciones MIXTO devueltas a MUERTO (la regla del título)')
    fallas += not good
    m = json.loads(json.dumps(OMIT))
    m['adjuntar'].pop(GRACE)
    code, out, _ = run(m)
    good = code == 1 and GRACE in out and 'no nombra un id' in out
    print(f'{"✓" if good else "✗ CIEGO"} defecto  exit {code} · «4. Grace» sin entrada en «adjuntar»')
    fallas += not good
    m = json.loads(json.dumps(OMIT))
    m['adjuntar']['B/03-maquinas-de-estado.md:1590'] = {'a': 'TRANS:B:S4', 'por': 'canario', 'hereda': True}
    code, out, _ = run(m)
    good = code == 1 and 'no son una sección adjuntable' in out
    print(f'{"✓" if good else "✗ CIEGO"} sobrante exit {code} · una entrada que no es una sección')
    fallas += not good
    m = json.loads(json.dumps(OMIT))
    m['adjuntar'][GRACE] = {'a': 'TRANS:B:S99', 'por': 'canario', 'hereda': True}
    code, out, _ = run(m)
    good = code == 1 and 'no es un ítem de 04' in out
    print(f'{"✓" if good else "✗ CIEGO"} ajeno    exit {code} · una entrada hacia un id que no es de 04')
    fallas += not good
    print(f'\n6 canarios · {fallas} fallas')
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main())
