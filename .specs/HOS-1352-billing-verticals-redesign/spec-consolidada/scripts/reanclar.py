#!/usr/bin/env python3
"""Re-anchor the `archivo:línea` citations of the hand-written spec files from one frozen source
commit to another (HOS-1352, second drafting pass).

    python3 reanclar.py --desde=<sha-viejo> [--hasta=<sha-nuevo>] [--escribir]
                        [--reporte=<json>] [archivo.md ...]

Without file arguments it walks every hand-written file of the consolidated spec: every `*.md`
of the spec dir, `10-corte/`, `20-fase-*/`, minus the generated ones (01, 04 and B4-B7, which
are rebuilt by their generators), plus the g8 generator sources (`generadores/g8/src/*.md`,
whose `@B`/`@D`/`@V` prefixes expand into B4-B7). `--hasta` defaults to comun.SHA.

How a cited line is mapped, per source file (difflib over the whole file, old vs new):
  - inside an `equal` block            -> the new line number (status MOVIDA, or IGUAL);
  - outside, but the exact text occurs exactly once in each version -> its new position
    (MOVIDA: a block moved, the text did not change);
  - blank in the old version, or anything else -> NOT remapped (CAMBIADA): the line's content
    changed, so pointing at its new position would be a blind guess. It is reported with the
    closest candidate of the replaced block so the drafter can decide.
Citations to files that do not exist at the old SHA are reported (DESCONOCIDA) and left alone.

Only the line numbers are rewritten; the citation's spelling (full path, `B/docs/…`,
`NUCLEO/…`, `@B…`) is kept. Without `--escribir` it is a dry run that only prints the report.
"""
import collections
import difflib
import glob
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import ROOT, SHA, D, V, B, SPEC  # noqa: E402

GENERADOS = {'01-decisiones-vigentes.md', '04-catalogos.md',
             '10-corte/B4.md', '10-corte/B5.md', '10-corte/B6.md', '10-corte/B7.md'}

# Short prefixes the drafters used, longest first so `B/docs/` wins over `B/`. Each maps to the
# candidate directories, tried in order (the generators' `B/` means `B/docs/` or the epic root).
PREFIJOS = [
    ('@Bdocs/', [B + 'docs/']), ('@B', [B]), ('@D', [D]), ('@V', [V]),
    ('B/docs/', [B + 'docs/']), ('V/docs/', [V + 'docs/']),
    ('NUCLEO/', [D + 'nucleo/']),
    ('B/', [B + 'docs/', B]), ('V/', [V + 'docs/', V]), ('D/', [D]),
]
FULL = '.specs/'
# A citation: an optional known prefix or a full `.specs/` path, a `.md` path, `:`, a line, and
# an optional `–`/`-` range end. The look-behind keeps us from matching inside a longer token.
CITA = re.compile(
    r'(?<![A-Za-z0-9_./\-@])'
    r'((?:\.specs/|@Bdocs/|@B|@D|@V|B/docs/|V/docs/|NUCLEO/|B/|V/|D/)[A-Za-z0-9_./\-]*?\.md)'
    r':(\d+)(?:([–-])(\d+))?')


def git_show(sha, path):
    r = subprocess.run(['git', '-C', ROOT, 'show', f'{sha}:{path}'], capture_output=True)
    return None if r.returncode else r.stdout.decode('utf-8').split('\n')


def resolver(cita, sha):
    """Repository path a spelled citation points to at ``sha`` (None if none exists)."""
    if cita.startswith(FULL):
        return cita if git_show(sha, cita) is not None else None
    for pre, dirs in PREFIJOS:
        if cita.startswith(pre):
            resto = cita[len(pre):]
            for d in dirs:
                if git_show(sha, d + resto) is not None:
                    return d + resto
            return None
    return None


class Mapa:
    """Old-line -> (new-line | None, status, candidate) for one source file."""

    def __init__(self, old, new):
        self.old, self.new = old, new
        self.m = {}
        cnt_o, cnt_n = collections.Counter(old), collections.Counter(new)
        pos_n = {}
        for j, l in enumerate(new, 1):
            pos_n.setdefault(l, j)
        sm = difflib.SequenceMatcher(None, old, new, autojunk=False)
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            for k in range(i1, i2):
                n = k + 1
                if op == 'equal':
                    nn = j1 + (k - i1) + 1
                    self.m[n] = (nn, 'IGUAL' if nn == n else 'MOVIDA', None)
                    continue
                l = old[k]
                if l.strip() and cnt_o[l] == 1 and cnt_n[l] == 1:
                    self.m[n] = (pos_n[l], 'MOVIDA', None)
                    continue
                cand = None
                if j2 > j1:
                    best = max(range(j1, j2), key=lambda j: difflib.SequenceMatcher(
                        None, l, new[j], autojunk=False).ratio())
                    cand = best + 1
                self.m[n] = (None, 'CAMBIADA', cand)

    def __call__(self, n):
        return self.m.get(n, (None, 'FUERA', None))


def archivos_por_defecto():
    c = os.path.join(ROOT, SPEC)
    out = []
    for pat in ('*.md', '10-corte/*.md', '20-fase-*/*.md'):
        for f in sorted(glob.glob(os.path.join(c, pat))):
            if os.path.relpath(f, c) not in GENERADOS:
                out.append(f)
    out += sorted(glob.glob(os.path.join(c, 'scripts', 'generadores', 'g8', 'src', '*.md')))
    return out


def main():
    opt = lambda k: next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith(f'--{k}=')), None)  # noqa: E731
    desde, hasta = opt('desde'), opt('hasta') or SHA
    if not desde:
        sys.exit(__doc__)
    escribir = '--escribir' in sys.argv
    files = [os.path.abspath(a) for a in sys.argv[1:] if not a.startswith('--')] or archivos_por_defecto()
    mapas, rutas = {}, {}
    reporte = {'desde': desde, 'hasta': hasta, 'archivos': {}}
    tot = collections.Counter()

    def mapa(path):
        if path not in mapas:
            mapas[path] = Mapa(git_show(desde, path), git_show(hasta, path) or [])
        return mapas[path]

    for f in files:
        rel = os.path.relpath(f, os.path.join(ROOT, SPEC))
        text = open(f, encoding='utf-8').read()
        L = text.split('\n')
        fence = False
        rep = {'cambiadas': [], 'desconocidas': [], 'remapeadas': 0, 'iguales': 0}
        for ln, line in enumerate(L):
            if line.lstrip().startswith('```'):
                fence = not fence
            if fence:
                continue

            def sub(m):
                spelled, a, sep, b = m.group(1), int(m.group(2)), m.group(3), m.group(4)
                key = (spelled, desde)
                if key not in rutas:
                    rutas[key] = resolver(spelled, desde)
                path = rutas[key]
                if path is None:
                    rep['desconocidas'].append({'linea': ln + 1, 'cita': m.group(0)})
                    tot['DESCONOCIDA'] += 1
                    return m.group(0)
                mp = mapa(path)
                na, sa, ca = mp(a)
                nb, sb, cb = mp(int(b)) if b else (None, None, None)
                ends = [(a, sa, ca)] + ([(int(b), sb, cb)] if b else [])
                bad = [(x, s, c) for x, s, c in ends if s in ('CAMBIADA', 'FUERA')]
                if bad:
                    for x, s, c in bad:
                        rep['cambiadas'].append({
                            'linea': ln + 1, 'cita': m.group(0), 'fuente': path, 'linea_vieja': x,
                            'estado': s, 'texto_viejo': mp.old[x - 1] if 0 < x <= len(mp.old) else None,
                            'candidata': c, 'texto_candidata': mp.new[c - 1] if c else None})
                    tot['CAMBIADA'] += 1
                    return m.group(0)
                if (na, nb) == (a, int(b) if b else None):
                    rep['iguales'] += 1
                    tot['IGUAL'] += 1
                    return m.group(0)
                rep['remapeadas'] += 1
                tot['MOVIDA'] += 1
                return f'{spelled}:{na}' + (f'{sep}{nb}' if b else '')

            L[ln] = CITA.sub(sub, line)
        new_text = '\n'.join(L)
        if escribir and new_text != text:
            open(f, 'w', encoding='utf-8').write(new_text)
        reporte['archivos'][rel] = rep
        print(f'{rel}: remapeadas {rep["remapeadas"]} · iguales {rep["iguales"]} · '
              f'sobre texto cambiado {len(rep["cambiadas"])} · desconocidas {len(rep["desconocidas"])}')
    print('TOTAL', dict(tot))
    if opt('reporte'):
        json.dump(reporte, open(opt('reporte'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
