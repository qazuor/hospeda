#!/usr/bin/env python3
"""Work lists of the second drafting pass of the consolidated spec (HOS-1352).

    python3 pasada2.py --inv-viejo=<inventario.json at the old SHA> --reanclar=<reanclar.json>
                       [--salida=<dir>]   (default: _trabajo/pasada2/)

For every drafting group (same split as the first pass) it writes one markdown file listing, per
spec file of the group:
  1. new items to define (R1) and new AC/tests (R7, R7b, R18), with their owner piece;
  2. items whose source text changed between the old SHA and comun.SHA (old and new citation and a
     word diff), so the drafter updates what was derived from them (US, AC, tests, rules);
  3. citations left on changed text by reanclar.py;
  4. the R17 sections without any citation that are routed to the group, with the citation that
     justifies the route and whether their content is already in the spec under another citation
     ("ya cubierto, falta sólo la cita") or not ("contenido ausente").
Sections with no deducible destination go to preguntas.md. Nothing here edits the spec.

Later passes reuse it (pasada3.py): they replace GRUPOS, TITULO and SCRIPT, and append sections
through EXTRA, a list of callables ``f(ctx)`` run after the four sections above; ``ctx`` carries
``add(file, section, line)``, ``archivo_de``, ``err`` and the inventories, and ``f`` returns the
names of the sections it filled, in the order they must be written.
"""
import collections
import difflib
import json
import os
import re
import subprocess
import sys
import types

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import trazar  # noqa: E402
from comun import ROOT, SHA, SPEC, slug  # noqa: E402
from defs import VIVOS  # noqa: E402

C = os.path.join(ROOT, SPEC)
TR = os.path.join(C, '_trabajo')

GRUPOS = collections.OrderedDict([
    ('g1-decisiones', ['01-decisiones-vigentes.md']),
    ('g2-nucleo-contrato', ['02-nucleo.md', '02-nucleo-auditoria.md', '02-nucleo-glosario.md',
                            '02-nucleo-modelo-y-maquinas.md', '02-nucleo-outbox.md',
                            '03-contrato-de-cobertura.md']),
    ('g3-catalogos', ['04-catalogos.md']),
    ('g4-corte-indice', ['00-indice.md', '30-el-corte.md', '80-abiertos.md', '90-retirados.md']),
    ('g5-u-v1-v4', ['U1', 'U2', 'U3', 'V1', 'V2', 'V3', 'V4']),
    ('g6-v5-v9', ['V5', 'V6', 'V8a', 'V9a', 'V9b', 'V7', 'V8b']),
    ('g7-b1-b3', ['B1', 'B2', 'B3']),
    ('g8-b4-b7', ['B4', 'B5', 'B6', 'B7']),
    ('g9-b8-b13', ['B8a', 'B9a', 'B11', 'B13a', 'B8b', 'B9b', 'B10', 'B12', 'B13b']),
])
TITULO = 'Pasada 2'
SCRIPT = 'scripts/pasada2.py'
EXTRA = []
GENERADOS = {'01-decisiones-vigentes.md': 'g1/gen01.py', '04-catalogos.md': 'g3/gen.py',
             '10-corte/B4.md': 'g8/src/B4.md', '10-corte/B5.md': 'g8/src/B5.md',
             '10-corte/B6.md': 'g8/src/B6.md', '10-corte/B7.md': 'g8/src/B7.md'}

Vp = '.specs/HOS-1353-verticales-capacidades-y-autorizacion/'
Bp = '.specs/HOS-1354-billing-cobro-y-proveedor/'
Dp = '.specs/HOS-1352-billing-verticals-redesign/docs/'


def corto(p):
    for k, v in ((Vp + 'docs/', 'V/'), (Bp + 'docs/', 'B/'), (Vp, 'V/'), (Bp, 'B/'), (Dp, 'D/')):
        if p.startswith(k):
            return v + p[len(k):]
    return p


def git_lines(sha, path):
    r = subprocess.run(['git', '-C', ROOT, 'show', f'{sha}:{path}'], capture_output=True)
    return r.stdout.decode('utf-8').split('\n') if r.returncode == 0 else []


# ---------------------------------------------------------------------------------- trazar ----
def correr_trazar():
    """Run trazar.main and keep its full error dict (it prints only three examples per rule)."""
    vistos = []

    class Rec(collections.defaultdict):
        def __init__(self, *a):
            super().__init__(*a)
            vistos.append(self)

    trazar.collections = types.SimpleNamespace(defaultdict=Rec, Counter=collections.Counter)
    import io
    import contextlib
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        trazar.main(os.path.join(TR, 'inventario.json'), os.path.join(TR, 'adjudicacion.json'), C,
                    cobertura=os.path.join(TR, 'cobertura.json'))
    errs = [d for d in vistos if d and all(re.match(r'R\d', k) for k in d)]
    return errs[0] if errs else {}, buf.getvalue()


# -------------------------------------------------------------------------- item text diff ----
def bloque(L, it):
    """The item's text: its [linea, fin] block, its table row, or its paragraph."""
    if not L or it['linea'] > len(L):
        return ''
    if 'fin' in it and it.get('fin'):
        out = L[it['linea'] - 1:it['fin']]
        if it['fuente'] == 'DEC':  # its pins are items of their own
            out = [x for x in out if '📌' not in x]
        return '\n'.join(out)
    first = L[it['linea'] - 1]
    if first.startswith('|'):
        return first
    out = [first]
    for x in L[it['linea']:it['linea'] + 80]:
        if not x.strip() or x.startswith('|') or re.match(r'^#+ ', x) or '📌' in x:
            break
        out.append(x)
    return '\n'.join(out)


def worddiff(a, b, lim=600):
    wa, wb = a.split(), b.split()
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, wa, wb, autojunk=False).get_opcodes():
        if op == 'equal':
            continue
        if i2 > i1:
            out.append('[-' + ' '.join(wa[i1:i2]) + '-]')
        if j2 > j1:
            out.append('{+' + ' '.join(wb[j1:j2]) + '+}')
    s = ' … '.join(out)
    return s if len(s) <= lim else s[:lim] + ' …(cortado)'


# ------------------------------------------------------------------------ R17 routing --------
def num_de(head):
    m = re.match(r'^#+\s+(?:~~[^~]*~~\s*)?(\d+(?:\.\d+)*)\.?\s', head)
    return m.group(1) if m else None


def numero(L, linea):
    """Section number of the heading at ``linea``; an unnumbered sub-heading inherits its parent's;
    a «Lo que … NO cierra/decide» closing section is 'NC'."""
    h = L[linea - 1]
    if re.search(r'Lo que .*NO (cierra|decide)', h):
        return 'NC'
    n = num_de(h)
    if n:
        return n
    lvl = len(h) - len(h.lstrip('#'))
    for k in range(linea - 2, -1, -1):
        m = re.match(r'^(#+)\s', L[k])
        if m and len(m.group(1)) < lvl:
            return num_de(L[k]) or 'NC'
    return None


def dentro(n, *prefs):
    return n is not None and any(n == p or n.startswith(p + '.') for p in prefs)


# Every rule: (short-path regex, predicate over the section number, [destinations], why).
# A destination is a piece name or a spec file. The first is the primary; the rest are «también».
R = []


def regla(rx, pred, dest, why):
    R.append((re.compile(rx), pred, dest, why))


T = lambda *p: (lambda n: dentro(n, *p))  # noqa: E731
TODO = lambda n: True  # noqa: E731
FV = 'V/descomposicion.md'
FB = 'B/descomposicion.md'
ORQ = 'regla del orquestador de la pasada 2'
regla(r'^D/11-', T('3'), ['03-contrato-de-cobertura.md'],
      'D/11 §3 «un hecho y un aviso» es la interfaz que el contrato (`D/12`, consolidado en 03) fija en su §2 (el hecho) y §3 (el aviso); ' + ORQ + ' (D/11 → 00-indice o 03-contrato)')
regla(r'^D/11-', TODO, ['00-indice.md'], ORQ + ' (D/11 partición → 00-indice)')
regla(r'^[VB]/spec\.md$', TODO, ['00-indice.md'], ORQ + ' (V/spec.md y B/spec.md → 00-indice: AG las vuelve stubs)')
regla(r'^V/descomposicion\.md$', T('2.4'), ['V6'], f'`{FV}:66`, capítulos de V6: `15` §4 (el excedente)')
regla(r'^V/descomposicion\.md$', T('2.7'), ['90-retirados.md'], f'`{FB}:514`: `G-R5` retirado (C14); la sección es la historia de su reparto')
regla(r'^V/descomposicion\.md$', T('2.8'), ['V4'], f'`{FV}:184`: `G-R6` → V4 en la tabla de guards')
regla(r'^V/descomposicion\.md$', T('1', '3', '5', '6'), ['00-indice.md'], ORQ + ' (criterio, orden y lugar de las unidades: misma familia que la partición)')
regla(r'^B/descomposicion\.md$', T('1', '5', '6'), ['00-indice.md'], ORQ + ' (criterio, orden y lugar de las unidades: misma familia que la partición)')
regla(r'^B/descomposicion\.md$', T('2.1'), ['04-catalogos.md'], f'`{FB}` §2.1: los dos guards «ya no viven» acá, están en `20` §2, el catálogo de guards (04)')
regla(r'^B/descomposicion\.md$', T('2.2'), ['B1'], f'`{FB}:135`, capítulos de B1: `06` entero (el adaptador y el proveedor falso)')
regla(r'^B/descomposicion\.md$', T('2.5'), ['B4'], f'`{FB}:138`, capítulos de B4: el contrato §2')
regla(r'^B/descomposicion\.md$', T('2.9'), ['B3'], f'`{FB}` §2.9 punto 1: «la tabla es capítulo de **B3**» (`{FB}:137`, `02` §2.2 y §2.5)')
# V chapters, from the «capítulos» column of V/descomposicion.md §2
regla(r'^V/02-', T('2.1'), ['V2'], f'`{FV}:62`, capítulos de V2: `02` §2.1')
regla(r'^V/02-', T('2.2'), ['V4'], f'`{FV}:64`, capítulos de V4: `02` §2.2')
regla(r'^V/02-', T('2.5'), ['V6'], f'`{FV}:66`, capítulos de V6: `02` §2.5')
regla(r'^V/02-', lambda n: n == '2', ['V2', 'V4', 'V6'], f'encabezado de `02` §2: sus subsecciones son de V2, V4 y V6 (`{FV}:62`, `:64`, `:66`)')
regla(r'^V/02-', T('3'), ['V3'], f'`{FV}:63`, capítulos de V3: `02` §3')
regla(r'^V/02-', T('4'), ['V9b'], f'`{FV}:73`, capítulos de V9b: `02` §4')
regla(r'^V/10-', T('1'), ['V1'], f'`{FV}:61`, capítulos de V1: `10` §1')
regla(r'^V/10-', T('2'), ['V2'], f'`{FV}:62`, capítulos de V2: `10` §2')
regla(r'^V/11-', TODO, ['V4'], f'`{FV}:64`, capítulos de V4: `11` entero')
regla(r'^V/15-', T('1', '2', '3'), ['V3'], f'`{FV}:63`, capítulos de V3: `15` §1–3')
regla(r'^V/15-', T('4'), ['V6'], f'`{FV}:66`, capítulos de V6: `15` §4')
regla(r'^V/15-', TODO, ['V3'], f'⚠ fuera del `15` §1–3 de la fila de V3 (`{FV}:63`); asignada por la ' + ORQ + ' (V/15 → V3): confirmar')
regla(r'^V/17-', TODO, ['V5'], f'`{FV}:65`, capítulos de V5: `17` entero (la ' + ORQ + ' pide la pieza que construye cada regla: V5 es la que la fila nombra)')
regla(r'^V/18-', T('2'), ['V7', 'V8b'], f'`{FV}:67`, capítulos de V7: `18` entero; V8b tiene el panel de postulaciones (`{FV}:70`)')
regla(r'^V/18-', TODO, ['V7'], f'`{FV}:67`, capítulos de V7: `18` entero (V6 sólo el esquema de V7, `{FV}:66`)')
regla(r'^V/19-', TODO, ['V8a', 'V8b'], f'`{FV}:69`, capítulos de V8a: `19` salvo las filas de Partner, que son de V8b (`{FV}:70`)')
regla(r'^V/21-', T('2.4'), ['V6'], f'`{FV}:66`, capítulos de V6: `21` §2.4 (la escritura `C`)')
regla(r'^V/21-', T('4'), ['V7', '30-el-corte.md'], f'`{FV}:67`, capítulos de V7: `21` §4 (el 410 que pasa a 404); el resto de lo que no se migra lo ejecuta el corte (' + ORQ + ')')
regla(r'^V/21-', T('2'), ['30-el-corte.md'], '⚠ ninguna fila nombra `V/21` §2 fuera del §2.4; asignada por la ' + ORQ + ' (migración → 30-el-corte): confirmar')
regla(r'^V/22-', T('3'), ['V9b'], f'`{FV}:73`, capítulos de V9b: `22` §3')
# B chapters, from the «capítulos» column of B/descomposicion.md §2
regla(r'^B/02-', T('2.1'), ['B2'], f'`{FB}:136`, capítulos de B2: `02` §2.1')
regla(r'^B/02-', T('2.2', '2.5'), ['B3'], f'`{FB}:137`, capítulos de B3: `02` §2.2 y §2.5')
regla(r'^B/02-', T('2.3'), ['B5'], f'`{FB}:139`, capítulos de B5: `02` §2.3')
regla(r'^B/02-', T('2.4'), ['B9a', 'B9b', 'B10'], f'`{FB}:146–148`: `02` §2.4 en B9a, B9b y B10')
regla(r'^B/02-', T('2.6'), ['B8b'], f'`{FB}:144`, capítulos de B8b: `02` §2.6')
regla(r'^B/02-', lambda n: n == '2', ['B2', 'B3', 'B5'], f'encabezado de `02` §2: sus subsecciones son de B2, B3, B5, B8b, B9 y B10 (`{FB}:136–148`)')
regla(r'^B/06-', T('4.6'), ['B6', 'B1'], f'`{FB}:140`, capítulos de B6: `06` §4.6 (y B1, `06` entero, `{FB}:135`)')
regla(r'^B/06-', T('5'), ['B2', 'B1'], f'`{FB}:136`, capítulos de B2: `06` §5 (y B1, `06` entero)')
regla(r'^B/06-', TODO, ['B1'], f'`{FB}:135`, capítulos de B1: `06` entero')
regla(r'^B/12-', T('1', '4', '5'), ['B7'], f'`{FB}:141`, capítulos de B7: `12` §1, §4, §5')
regla(r'^B/12-', T('2', '3', '6', '7'), ['B8b'], f'`{FB}:144`, capítulos de B8b: `12` §2, §3, §6, §7')
regla(r'^B/20-', T('2', '3', '4.1', '5.1', '6'), ['B1'], f'`{FB}:135`, capítulos de B1: `20` §2–§3, §4.1, §5.1, §6')
regla(r'^B/21-', T('2.4'), ['30-el-corte.md', 'B9a'], f'la cartera se cancela en el corte (' + ORQ + ': B/21 → V6/U1/30-el-corte); B9a toma `21` §2.4 por los grants del corte (`{FB}:146`)')
regla(r'^B/21-', T('4'), ['U1'], f'`D/16-fase-7-del-paraguas.md` §4.6 punto 1: `U1` borra «el archivo de configuración de planes y lo que lo lee (`B/21` §4)»')
regla(r'^B/21-', T('1', '2', '3'), ['30-el-corte.md'], '⚠ ninguna fila nombra `B/21` §1–§3 fuera del §2.4; asignada por la ' + ORQ + ' (B/21 → V6/U1/30-el-corte): confirmar')
regla(r'^B/22-', T('2.2'), ['B5'], f'`{FB}:139`, capítulos de B5: `22` §2.2')


def rutear(short, n):
    for rx, pred, dest, why in R:
        if rx.search(short) and pred(n):
            return dest, why
    return None, None


# ---------------------------------------------------------------------- coverage check -------
def norm(t):
    t = re.sub(r'~~.*?~~', ' ', t, flags=re.S)
    t = re.sub(r'\]\([^)]*\)', ']', t)
    t = re.sub(r'[*`_>|\[\]#«»"“”]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip().lower()


def tejas(t, k=7):
    w = t.split()
    return {' '.join(w[i:i + k]) for i in range(len(w) - k + 1)}


def corpus_spec():
    out = {}
    for f in trazar.archivos(C, sin=('scripts', '_trabajo')):
        out[os.path.relpath(f, C)] = norm(open(f, encoding='utf-8').read())
    return out


def cobertura_de(texto, corpus):
    sh = tejas(norm(texto))
    if not sh:
        return 0.0, None
    best, frac = None, 0.0
    tot = set()
    for f, t in corpus.items():
        hit = {s for s in sh if s in t}
        tot |= hit
        if len(hit) / len(sh) > frac:
            best, frac = f, len(hit) / len(sh)
    return len(tot) / len(sh), best


# ------------------------------------------------------------------------------- main ---------
def main():
    opt = lambda k: next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith(f'--{k}=')), None)  # noqa: E731
    out_dir = opt('salida') or os.path.join(TR, 'pasada2')
    os.makedirs(out_dir, exist_ok=True)
    inv_new = json.load(open(os.path.join(TR, 'inventario.json'), encoding='utf-8'))
    iv = opt('inv-viejo')
    if os.path.exists(iv):
        inv_old = json.load(open(iv, encoding='utf-8'))
    else:  # <commit>:<path>, read through git so the old inventory needs no copy in the tree
        inv_old = json.loads('\n'.join(git_lines(*iv.split(':', 1))))
    old_sha, new_sha = inv_old['sha'], inv_new['sha']
    assert new_sha == SHA, 'the inventory is not at comun.SHA'
    asg = json.load(open(os.path.join(TR, 'asignacion.json'), encoding='utf-8'))
    cob = json.load(open(os.path.join(TR, 'cobertura.json'), encoding='utf-8'))['items']
    rean = json.load(open(opt('reanclar'), encoding='utf-8'))
    piezas = {k[len('PIEZA:'):]: v['destino'] for k, v in asg['items'].items() if k.startswith('PIEZA:')}

    def archivo_de(x):
        if x == 'CORTE':
            return '30-el-corte.md'
        return piezas.get(x, x)

    grupo_de = {}
    for g, fs in GRUPOS.items():
        for f in fs:
            grupo_de[archivo_de(f)] = g
    grupo_de.setdefault('02-nucleo.md', 'g2-nucleo-contrato')  # a later pass may route it elsewhere

    def g_of(f):
        return grupo_de.get(f.split(' ')[0], '??')

    # entries[group][file][section] -> list of lines
    E = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(list)))
    cuenta = collections.defaultdict(collections.Counter)

    def add(f, sec, line):
        f = f.split(' ')[0]
        E[g_of(f)][f][sec].append(line)
        cuenta[g_of(f)][sec] += 1

    by_new = {i['id']: i for i in inv_new['items']}
    by_old = {i['id']: i for i in inv_old['items']}
    err, salida = correr_trazar()

    # 1. new items and new AC/tests ------------------------------------------------------------
    S1, S2 = 'Ítems nuevos a definir (R1)', 'AC y tests nuevos (R7 · R7b · R18)'
    for cid in err.get('R1 vivo sin definición única fuera de 90-', []):
        it = by_new[cid]
        dest = asg['items'].get(cid, {}).get('destino') or '??'
        dueña = cob.get(cid, {}).get('pieza', '—')
        add(dest, S1, f'- `{cid}` — {corto(it["archivo"])}:{it["linea"]} — se define acá (asignacion.json); dueña del AC: **{dueña}**')
    fallas = collections.defaultdict(list)
    for k in ('R7 ítem normativo vivo sin AC', 'R7b el AC del ítem no está en su pieza dueña',
              'R18 falta un tipo de test que AN exige por familia'):
        for e in err.get(k, []):
            cid = e.split(' -> ')[0]
            fallas[cid].append(k.split(' ')[0] + ('' if ' -> ' not in e or ': ' not in e else ' ' + e.split(': ', 1)[1]))
    for cid, fs in fallas.items():
        it = by_new[cid]
        c = cob.get(cid, {})
        p = c.get('pieza', '??')
        tam = ', '.join(f"{t['pieza']} ({t['rol']})" for t in c.get('tambien_lo_ejercen', [])) or '—'
        nuevo = '' if cid in by_old else ' · **nuevo desde ' + old_sha[:10] + '**'
        add(archivo_de(p), S2, f'- `{cid}` — {corto(it["archivo"])}:{it["linea"]}{nuevo} — dueña **{p}**; también: {tam}; falla: {"; ".join(sorted(set(fs)))}; tipos exigidos: {", ".join(c.get("tipos_exigidos_por_familia", []))}')

    # 2. changed source text ------------------------------------------------------------------
    S3 = 'Ítems con contenido de fuente cambiado desde ' + old_sha[:10]
    cache = {}

    def L(sha, p):
        if (sha, p) not in cache:
            cache[(sha, p)] = git_lines(sha, p)
        return cache[(sha, p)]

    cambiados = []
    for cid, n in by_new.items():
        o = by_old.get(cid)
        if not o or n['fuente'] == 'SEC':
            continue
        a, b = bloque(L(old_sha, o['archivo']), o), bloque(L(new_sha, n['archivo']), n)
        if ' '.join(a.split()) != ' '.join(b.split()):
            cambiados.append((cid, o, n, worddiff(a, b)))
    for cid, o, n, wd in cambiados:
        dest = asg['items'].get(cid, {}).get('destino') or '??'
        dueña = cob.get(cid, {}).get('pieza')
        st = by_new[cid]['estado']
        base = (f'`{cid}` ({st}) — vieja `{corto(o["archivo"])}:{o["linea"]}` → nueva `{corto(n["archivo"])}:{n["linea"]}` — cambio: {wd}')
        d0 = dest.split(' ')[0]
        if d0 in ('01-decisiones-vigentes.md', '04-catalogos.md'):
            gen = ' *(archivo generado desde la fuente: ya regenerado sobre ' + new_sha[:10] + ')*'
        elif d0 in GENERADOS:
            gen = f' *(editar la fuente del generador `scripts/generadores/{GENERADOS[d0]}` y regenerar)*'
        else:
            gen = ''
        add(dest, S3, f'- **define**{gen}: {base}')
        if dueña and archivo_de(dueña) != dest.split(' ')[0]:
            add(archivo_de(dueña), S3, f'- **dueña del AC**: {base}')

    # 3. citations on changed text ------------------------------------------------------------
    S4 = 'Citas sobre texto cambiado (reanclar.py, sin remapear)'
    for f, r in rean['archivos'].items():
        dest = f
        m = re.match(r'scripts/generadores/g8/src/(B\d)\.md$', f)
        if m:
            dest = archivo_de(m.group(1))
        for c in r['cambiadas']:
            nota = f' *(editar la fuente del generador `{f}`)*' if m else ''
            add(dest, S4, f'- línea {c["linea"]}{nota}: `{corto(c["cita"]) if c["cita"].startswith(".specs/") else c["cita"]}` — texto en {old_sha[:10]}: «{(c["texto_viejo"] or "").strip()[:220]}» — candidata en {new_sha[:10]}: `{corto(c["fuente"])}:{c["candidata"]}` «{(c["texto_candidata"] or "").strip()[:220]}»')

    # 4. R17 sections ---------------------------------------------------------------------------
    S5 = 'Secciones R17 sin citar asignadas'
    corpus = corpus_spec()
    preguntas, resumen17 = [], collections.Counter()
    for sid in err.get('R17 sección sin ninguna línea citada', []):
        it = by_new[sid]
        Ls = L(new_sha, it['archivo'])
        short = corto(it['archivo'])
        head = Ls[it['linea'] - 1].strip()
        n = numero(Ls, it['linea'])
        body = '\n'.join(Ls[it['linea']:it['fin']])
        frac, donde = cobertura_de(body if body.strip() else head, corpus)
        if it['fin'] - it['linea'] <= 1:
            estado = 'encabezado (sin cuerpo propio): falta sólo la cita'
        elif frac >= 0.5:
            estado = f'**ya cubierto, falta sólo la cita** ({frac:.0%} del texto en la spec; sobre todo en `{donde}`)'
        elif frac >= 0.15:
            estado = f'**parcial** ({frac:.0%} del texto en la spec; sobre todo en `{donde}`): revisar qué falta'
        else:
            estado = f'**contenido ausente** ({frac:.0%})'
        rango = f'`{short}:{it["linea"]}–{it["fin"]}`'
        dest, why = rutear(short, n)
        if not dest and frac >= 0.5:
            # No row names it, but its text already lives in one spec file: that file is where it is.
            dest = [donde]
            why = f'ninguna fila la nombra; su texto ya está en `{donde}` ({frac:.0%} de sus tejas de 7 palabras): el destino es donde ya vive'
        if not dest:
            preguntas.append(f'- {rango} {head} — §{n} — {estado} — **sin destino deducible**: ninguna fila de pieza nombra esta sección en su columna de capítulos, ni `D/16` §4.6, ni cobertura.json')
            resumen17['pregunta'] += 1
            continue
        tam = f' — también: {", ".join(dest[1:])}' if len(dest) > 1 else ''
        add(archivo_de(dest[0]), S5, f'- {rango} {head} — §{n}{tam} — por qué acá: {why} — {estado}')
        resumen17['ausente' if 'ausente' in estado else 'parcial' if 'parcial' in estado else 'cubierto'] += 1
        cuenta[g_of(archivo_de(dest[0]))]['R17 ' + ('ausente' if 'ausente' in estado else 'parcial' if 'parcial' in estado else 'cubierto')] += 1

    # extra sections of a later pass ----------------------------------------------------------
    orden = [S1, S2, S3, S4, S5]
    ctx = types.SimpleNamespace(add=add, archivo_de=archivo_de, err=err, by_new=by_new, by_old=by_old,
                                old_sha=old_sha, new_sha=new_sha, asg=asg, cob=cob)
    for f in EXTRA:
        orden += [x for x in f(ctx) if x not in orden]

    # write ------------------------------------------------------------------------------------
    cab = (f'> Generado por `{SCRIPT}` sobre el HEAD `{subprocess.run(["git", "-C", ROOT, "rev-parse", "--short=10", "HEAD"], capture_output=True, text=True).stdout.strip()}`; '
           f'fuentes `{old_sha[:10]}` → `{new_sha[:10]}`. Los archivos generados (01, 04, B4–B7) no se editan a mano: '
           'lo que les toca se arregla en su generador (`scripts/generadores/`).\n')
    for g in GRUPOS:
        txt = [f'# {TITULO} · {g}', '', cab]
        c = cuenta[g]
        txt.append('| qué | cuántos |')
        txt.append('|---|---|')
        for s in orden:
            txt.append(f'| {s} | {c[s]} |')
        for k in ('R17 cubierto', 'R17 parcial', 'R17 ausente'):
            txt.append(f'| {k} | {c[k]} |')
        txt.append('')
        for f in sorted(E[g]):
            txt.append(f'## `{f}`' + (f' *(generado por `scripts/generadores/{GENERADOS[f]}`)*' if f in GENERADOS else ''))
            txt.append('')
            for s in orden:
                if E[g][f][s]:
                    txt.append(f'### {s}')
                    txt.append('')
                    txt += E[g][f][s]
                    txt.append('')
        if not E[g]:
            txt.append('Nada para este grupo.\n')
        open(os.path.join(out_dir, g + '.md'), 'w', encoding='utf-8').write('\n'.join(txt).rstrip() + '\n')
    pq = [f'# {TITULO} · secciones R17 sin destino deducible', '', cab,
          'Cada una es una pregunta para el orquestador: a qué archivo de la spec va su contenido.', ''] + preguntas
    open(os.path.join(out_dir, 'preguntas.md'), 'w', encoding='utf-8').write('\n'.join(pq).rstrip() + '\n')
    res = {'trazar': {k: len(v) for k, v in err.items()}, 'por_grupo': {g: dict(cuenta[g]) for g in GRUPOS},
           'r17': dict(resumen17), 'cambiados': len(cambiados),
           '??': {s: dict(v) for s, v in E.get('??', {}).items()}}
    json.dump(res, open(os.path.join(out_dir, 'resumen.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps(res, ensure_ascii=False, indent=1)[:4000])


if __name__ == '__main__':
    main()
