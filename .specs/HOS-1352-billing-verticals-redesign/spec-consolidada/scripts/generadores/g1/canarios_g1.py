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
  tachada   (second round, P-H) the letter T of 37-fase-8-vuelta-3, which 16-fase-7 strikes (S-27),
            out of `letras_muertas` (H2-G1-10).
  revisada  the letter F, cited only struck but kept alive by «lo del lote F sigue», out of
            `letras_vivas_revisadas`.
  parentes  the inline 📌1 of DEC-GRANT-004 cut by line again (cierre_en_linea disabled): its tail
            stays in the 📌 and the body keeps an open «(» (H2-G1-9).

Third round (H3-G1-3, P-H over the content):
  cinco     the base run marks «⚠️ Caducada en parte» the five letters the adjudication listed (B, F
            and H of 38-fase-5; G5-3 and G2-1 of 28-fase-9-vuelta-1).
  nombra    F of 38-fase-5 out of `letras_muertas`: N, a later letter of its file, says «F se lee».
  precisa   (fifth and sixth rounds) AP/BN/BU/CC marked partially dead; removing any warning fails. BY keeps BL alive.
  paso3     (sixth-round propagation) removing either BM load-step omission fails.
  contenido L3-a out of `letras_muertas`: what it decides is struck in 16-fase-7 and live nowhere.
"""
import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GEN = os.path.join(HERE, 'gen01.py')
sys.path.insert(0, os.path.normpath(os.path.join(HERE, '..', '..')))  # scripts/, for comun
OMIT = json.load(open(os.path.join(HERE, 'omisiones.json'), encoding='utf-8'))


CINCO = ('OWN:38-fase-5:t4:B', 'OWN:38-fase-5:t6:F', 'OWN:38-fase-5:t6:H',
         'OWN:28-fase-9-vuelta-1:t1:G5-3', 'OWN:28-fase-9-vuelta-1:t1:G2-1')
SALIDA = {}


def run(omit):
    d = tempfile.mkdtemp(prefix='canario-g1-')
    p = os.path.join(d, 'omisiones.json')
    json.dump(omit, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    r = subprocess.run([sys.executable, GEN, '--salida=' + d, '--omisiones=' + p], capture_output=True, text=True)
    s = os.path.join(d, '01-decisiones-vigentes.md')
    SALIDA['txt'] = open(s, encoding='utf-8').read() if os.path.exists(s) else ''
    return r.returncode, r.stdout + r.stderr


def marcada(txt, cid):
    """Whether the block of ``cid`` (its anchor up to the next anchor) carries «⚠️ Caducada en parte»."""
    from comun import slug  # noqa: E402
    a = txt.find(f'<a id="{slug(cid)}"></a>')
    if a < 0:
        return False
    b = txt.find('<a id=', a + 1)
    return '⚠️ **Caducada en parte**' in txt[a:b if b > 0 else len(txt)]


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


def parentesis():
    """gen01 in a fresh process with cierre_en_linea() disabled: the old line-wise cut of an inline 📌."""
    d = tempfile.mkdtemp(prefix='canario-g1-')
    code = (f'import sys; sys.argv = [{GEN!r}, "--salida={d}"]; sys.path.insert(0, {HERE!r}); import gen01; '
            'gen01.cierre_en_linea = lambda a, fin: None; gen01.main()')
    r = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def main():
    fallas = 0
    code, out = run(OMIT)
    print(f'{"✓" if code == 0 else "✗"} base: exit {code}' + ('' if code == 0 else '\n' + out))
    fallas += code != 0
    sin = [c for c in CINCO if not marcada(SALIDA['txt'], c)]
    print(f'{"✓" if not sin else "✗ CIEGO"} cinco    las cinco letras de la adjudicación llevan su ⚠️'
          + (f' (faltan: {", ".join(sin)})' if sin else ''))
    fallas += bool(sin)
    for clave, letra, que in (('nombra', 'OWN:38-fase-5:t6:F', 'F se lee'),
                              ('contenido', 'OWN:30-revision-del-owner:t5:L3-a', 'arma la lista')):
        m = json.loads(json.dumps(OMIT))
        m['letras_muertas'].pop(letra, None)
        code, out = run(m)
        good = code == 1 and 'letra corregida por una letra posterior o por un tachado' in out and que in out
        print(f'{"✓" if good else "✗ CIEGO"} {clave:9} exit {code} · {letra} fuera de `letras_muertas`')
        fallas += not good
    for letra, cid in (('AP', 'OWN:41-corte-del-mvp:t3:AP'),
                       ('BN', 'OWN:41-corte-del-mvp:t9:BN'),
                       ('BU', 'OWN:41-corte-del-mvp:t9:BU'),
                       ('CC', 'OWN:41-corte-del-mvp:t12:CC')):
        # First prove the corrected rendering carries a partial warning, then remove just that entry.
        code, out = run(OMIT)
        base_ok = code == 0 and marcada(SALIDA['txt'], cid)
        m = json.loads(json.dumps(OMIT))
        m['letras_muertas'].pop(cid, None)
        code, out = run(m)
        good = base_ok and code == 1 and 'precisión sin revisión o marca' in out and cid in out
        print(f'{"✓" if good else "✗ CIEGO"} precisa-{letra} exit {code} · marca parcial presente; quitarla se detecta')
        fallas += not good
    for cid in ('DEC-MP-002#📌2', 'DEC-ARCH-013'):
        m = json.loads(json.dumps(OMIT))
        m.pop(cid, None)
        code, out = run(m)
        good = code == 1 and cid in out and 'sin ninguna omisión aplicada' in out
        print(f'{"✓" if good else "✗ CIEGO"} paso3 · exit {code} · {cid} sin omitir la carga en 3a')
        fallas += not good
    # BY is additive: reviewing its relation must not mark BL as dead.
    code, out = run(OMIT)
    from comun import slug
    bl = 'OWN:41-corte-del-mvp:t9:BL'
    good = code == 0 and f'<a id="{slug(bl)}"></a>' in SALIDA['txt'] and not marcada(SALIDA['txt'], bl)
    print(f'{"✓" if good else "✗ CIEGO"} precisa-BY · BL se conserva sin caducidad')
    fallas += not good
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
    m = json.loads(json.dumps(OMIT))
    m['letras_muertas'].pop('OWN:37-fase-8-vuelta-3:t1:T')
    code, out = run(m)
    good = code == 1 and 'letra tachada en una fuente posterior' in out and ':T' in out
    print(f'{"✓" if good else "✗ CIEGO"} tachada  exit {code} · T sin su ⚠️, con su única cita tachada en 16-fase-7 (S-27)')
    fallas += not good
    m = json.loads(json.dumps(OMIT))
    m['letras_vivas_revisadas'].pop('OWN:37-fase-8-vuelta-3:t1:F')
    code, out = run(m)
    good = code == 1 and 'letra tachada en una fuente posterior' in out and ':F' in out
    print(f'{"✓" if good else "✗ CIEGO"} revisada exit {code} · F fuera de las vivas revisadas')
    fallas += not good
    code, out = parentesis()
    good = code == 1 and 'DEC-GRANT-004' in out and 'paréntesis desbalanceados' in out
    print(f'{"✓" if good else "✗ CIEGO"} parentes exit {code} · el 📌1 de DEC-GRANT-004 cortado por línea')
    fallas += not good
    print(f'\n17 canarios · {fallas} fallas')
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main())
