#!/usr/bin/env python3
"""Mechanical traceability of the consolidated spec, both directions (DEC-METH-019 points 2-4,
8-11; owner AL-AO). Exit 0 only when every rule gives 0.

    python3 trazar.py <inventario.json> <adjudicacion.json> <dir-de-la-spec> [--sin-deriva]
                      [--cobertura=<cobertura.json>] [--lista-solo-citables=<json>]
    (--lista-solo-citables replaces defs.SOLO_CITABLES; it exists for the canaries only)

FORMAT the spec is written in (the contract this script enforces)
  item definition   <a id="<slug>"></a> on its own line, then the block (up to the next anchor
                    or `#`/`##` heading) with a line
                    `Origen: <archivo>:<línea>[, <archivo>:<línea>…]` (paths from the repo root).
                    slug = comun.slug(id): DEC-SUB-008 -> dec-sub-008, TRANS:B:S1 -> trans-b-s1.
  reference         [DEC-SUB-008](01-decisiones-vigentes.md#dec-sub-008)
  retired item      the same anchor, inside 90-retirados.md
  user story        <a id="us-<pieza>-<n>"></a> + a line with `US:<Pieza>:<n>`, `Actor: <actor>`,
                    `Fuente: [..](..#<slug>)…`
  acceptance crit.  <a id="ac-<pieza>-<n>"></a> + `AC:<Pieza>:<n>`, lines `Dado …`, `Cuando …`,
                    `Entonces …`, and `Fuente: …`
  test              <a id="test-<pieza>-<n>"></a> + `TEST:<Pieza>:<n>`, `Tipo: <tipo>`,
                    `Cubre: [AC:..](..#ac-..)…`, `Fuente: …`; a `smoke manual` adds
                    `Etiqueta: local|staging|prod` (and may add `MP sandbox`); a `guard estático`
                    that covers a guard adds `Mutación: <how it is broken on purpose>`.
  piece file        10-corte/<Pieza>.md or 20-fase-<n>/<Pieza>.md, with the `## ` headings of
                    defs.PLANTILLA in order; a section that does not apply says `N/A — <razón>`.

RULES
  R1  a live item has exactly one definition, outside 90-retirados.
  R2  a dead item has exactly one definition, inside 90-retirados.
  R3  a MIXTO item (and any item with an adjudication) carries a verdict VIVO|MUERTO|PARCIAL whose
      hash equals the inventory hash; R3b: the source line has not changed since the SHA
      (skipped with --sin-deriva).
  R4  every in-spec reference resolves to a defined anchor.
  R5  every anchor is an inventory item or an US/AC/TEST (nothing invented).
  R6  every definition has `Origen:`, cites the item's own position, and the cited line contains
      the item's local id (defs.CHEQUEO_LOCAL says how, per source).
  R7  every live NORMATIVE item is cited by ≥1 AC (AL); methodology decisions and the closed list of
      defs.SOLO_CITABLES (owner BA, BB) are citable only.
  R7b with --cobertura: that AC is in the item's OWNER piece of cobertura.json (one owner per item,
      so parallel writers neither leave it uncovered nor duplicate it); the owner may be the
      pseudo-piece CORTE (owner BE), whose AC live in 30-el-corte.md.
  R7c the closed list is valid (every id in the inventory, named by its owner row, row hash
      unchanged) and declared: 03-contrato-de-cobertura.md references every listed item.
  R8  every AC is covered by ≥1 TEST (AL).
  R9  every US/AC/TEST cites ≥1 existing citable item in `Fuente:` (AL).
  R10 no US/AC/TEST lives in 80-abiertos: what has no source is a question there, not a criterion.
  R11 shape (AM): US/AC/TEST ids are `<KIND>:<pieza>:<n>` of an existing piece, defined in that
      piece's file — or `AC:CORTE:n` / `TEST:CORTE:n` (owner BE: no US), defined in 30-el-corte.md;
      piece's file, slug matching; an AC has Dado/Cuando/Entonces; a US has an actor of the closed
      list; each piece has an exit AC citing its LISTA item (the «Lista cuando»).
  R12 test types (AN): `Tipo:` in the closed list; a smoke carries `Etiqueta:`; a TEST:CORTE is a
      `smoke manual` or a `guard estático` (owner BE).
  R13 every live INV is covered by ≥1 test (directly, or through an AC the test covers), except the
      closed list of citable-only items (owner BA: «no verificables»).
  R14 every live TRANS and PROH is covered by ≥1 `integración con DB` test.
  R15 every GUARD is covered by ≥1 `guard estático` test with `Mutación:`.
  R16 template (AO): every piece has its file in the right folder (cut -> 10-corte, later ->
      20-fase-<n> of its phase, AW), with every heading of the template, in order, and none empty.
  R17 coverage net: every live section of the 38 design files has ≥1 line cited by an `Origen:`
      line of ANY spec file (anchored block or plain prose; fenced code, `_trabajo/` and
      `scripts/` excluded).
  R18 with --cobertura: every owned live item has, in its owner piece, tests covering an AC that
      cites it, of every type AN demands for its family (`tipos_exigidos_por_familia`). The types
      read only in its text or by lectura (`tipos_solo_del_texto`) are reported as ⚠, never fail.
  R19 the dead part of a PARCIAL verdict is not rendered: for every PARCIAL item defined in the
      spec, no verbatim span the verdict quotes in `muerto` («…», split at «…»/«[…]», at least 12
      characters once struck spans, markdown marks and blanks are normalized) appears in the body
      of its block. The verdict's own note (`> **Parte sin efecto**…`, `- **Adjudicación**…`)
      quotes the dead text on purpose and does not count; a span the verdict marks as alive
      («…» sigue) does not count either.
"""
import collections
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import worktree_line_hash, lines, slug  # noqa: E402
from defs import (ACTORES, CHEQUEO_LOCAL, CITABLES, ETIQUETAS_SMOKE, MUERTOS, NORMATIVAS,  # noqa: E402
                  NO_NORMATIVAS_PREFIJOS, PLANTILLA, SOLO_CITABLES, TIPOS_TEST, VIVOS,
                  solo_citables_fallas)

ANCHOR = re.compile(r'<a id="([^"]+)"></a>')
REF = re.compile(r'\]\(([^)#\s]*)#([^)\s]+)\)')
KIND = re.compile(r'^(us|ac|test)-([uvb]\d+[ab]?|corte)-(\d+)$')
CORTE = 'CORTE'  # the pseudo-piece of owner BE: AC and TEST of what only the cut does
TIPOS_CORTE = ('smoke manual', 'guard estático')
ORIGEN = re.compile(r'^Origen:\s*(.+)$', re.M)
LOC = re.compile(r'([\w./\-]+\.md):(\d+)')


def archivos(spec_dir, sin=('scripts',)):
    """The spec's markdown files. `scripts/` is tooling (the generators' templates carry anchors
    and `Origen:` lines of their own), never part of the spec."""
    for f in sorted(glob.glob(os.path.join(spec_dir, '**', '*.md'), recursive=True)):
        if os.path.relpath(f, spec_dir).split(os.sep)[0] not in sin:
            yield f


def bloques(spec_dir):
    """Every anchor with its block: {slug: [(file, line, text)]}, plus all references."""
    defs, refs = collections.defaultdict(list), []
    for f in archivos(spec_dir):
        rel = os.path.relpath(f, spec_dir)
        L = open(f, encoding='utf-8').read().split('\n')
        for n, l in enumerate(L, 1):
            for a in ANCHOR.findall(l):
                body = []
                for x in L[n:]:
                    if ANCHOR.search(x) or re.match(r'^#{1,2} ', x):
                        break
                    body.append(x)
                defs[a].append((rel, n, '\n'.join(body)))
            refs += [(rel, n, s) for _, s in REF.findall(l)]
    return defs, refs


def origenes(spec_dir):
    """Every line cited by an `Origen:` line of any spec file, outside fenced code: {path: {line}}.
    Prose without an item covers its section too (an `SEC` is never anchored, R5). The working
    notes (`_trabajo/`) are not the spec and cover nothing."""
    out = collections.defaultdict(set)
    for f in archivos(spec_dir, sin=('scripts', '_trabajo')):
        fence = False
        for l in open(f, encoding='utf-8').read().split('\n'):
            if l.lstrip().startswith('```'):
                fence = not fence
                continue
            m = None if fence else ORIGEN.match(l)
            if m:
                for p, ln in LOC.findall(m.group(1)):
                    out[p].add(int(ln))
    return out


def tipo_cumplido(req, tests):
    """Whether ``tests`` satisfy one minimum of cobertura.json: «≥1 de cualquier tipo…» asks for
    any test; «<tipo> · <etiqueta>» asks for that type with that smoke label; «<tipo>» for the type."""
    if req.startswith('≥1'):
        return bool(tests)
    tipo, _, et = (x.strip() for x in req.partition(' · '))
    return any(t['tipo'] == tipo and (not et or t.get('etiqueta') == et) for t in tests)


R19_NOTA = re.compile(r'^\s*(>\s*\*\*Parte sin efecto\*\*|-\s*\*\*Adjudicación\*\*)')
R19_MIN = 12


def r19_norm(t):
    t = re.sub(r'~~.*?~~', '', t, flags=re.S)
    t = re.sub(r'[*`_]', '', t).replace('«', '').replace('»', '')
    return re.sub(r'\s+', ' ', t).strip().lower()


def r19_tramos(muerto):
    """The verbatim dead spans a PARCIAL verdict quotes, normalized (R19)."""
    out = []
    for m in re.finditer(r'«(.*?)»(\s*sigue\b)?', muerto or ''):
        if m.group(2):
            continue
        for piece in re.split(r'\[…\]|…|\.\.\.', m.group(1)):
            p = r19_norm(piece)
            if len(p) >= R19_MIN:
                out.append(p)
    return out


def citas(text):
    return [m.group(2) for m in REF.finditer(text)]


def main(inv_p, adj_p, spec_dir, deriva=True, cobertura=None, lista=None):
    inv = json.load(open(inv_p, encoding='utf-8'))
    items = inv['items']
    adj = json.load(open(adj_p, encoding='utf-8')) if os.path.exists(adj_p) else {}
    adj = adj.get('veredictos', adj)
    by_slug = {slug(i['id']): i for i in items if i['fuente'] != 'SEC'}
    piezas = {i['local']: i for i in items if i['fuente'] == 'PIEZA'}
    defs, refs = bloques(spec_dir)
    err = collections.defaultdict(list)
    estado = {}

    # R1-R3 ---------------------------------------------------------------------------------
    for i in items:
        if i['fuente'] == 'SEC':
            continue
        st, v = i['estado'], adj.get(i['id'])
        if v:
            if v.get('hash') != i['hash']:
                err['R3 adjudicación caduca (hash distinto)'].append(i['id'])
                continue
            if deriva and worktree_line_hash(i['archivo'], i['linea']) != i['hash']:
                err['R3b la fuente cambió desde el SHA'].append(i['id'])
            if v.get('veredicto') not in ('VIVO', 'MUERTO', 'PARCIAL'):
                err['R3 veredicto inválido'].append(i['id'])
                continue
            st = 'MUERTO' if v['veredicto'] == 'MUERTO' else 'VIVO'
        elif st == 'MIXTO':
            err['R3 MIXTO sin adjudicar'].append(i['id'])
            continue
        estado[i['id']] = st
        d = defs.get(slug(i['id']), [])
        fuera = [x for x in d if not x[0].startswith('90-')]
        dentro = [x for x in d if x[0].startswith('90-')]
        if st in VIVOS and (len(fuera) != 1 or dentro):
            err['R1 vivo sin definición única fuera de 90-'].append(i['id'])
        if st in MUERTOS and (len(dentro) != 1 or fuera):
            err['R2 retirado mal ubicado'].append(i['id'])

    # R4, R5 ----------------------------------------------------------------------------------
    for f, n, s in refs:
        if s not in defs:
            err['R4 referencia colgada'].append(f'{f}:{n}#{s}')
    for s in defs:
        if s not in by_slug and not KIND.match(s):
            err['R5 ancla sin ítem fuente (inventada)'].append(s)
        if len(defs[s]) > 1 and KIND.match(s):
            err['R5 US/AC/TEST definido dos veces'].append(s)

    # R6 (the first `Origen:` of an item's block) ---------------------------------------------
    for s, ds in defs.items():
        i = by_slug.get(s)
        if not i:
            continue
        for f, n, body in ds:
            o = ORIGEN.search(body)
            if not o:
                err['R6 sin Origen'].append(f'{s} ({f}:{n})')
                continue
            locs = [(p, int(ln)) for p, ln in LOC.findall(o.group(1))]
            if (i['archivo'], i['linea']) not in locs:
                err['R6 Origen no cita la posición del ítem'].append(f'{s} ({f}:{n})')
                continue
            modo = CHEQUEO_LOCAL[i['fuente']]
            texto = lines(i['archivo'])[i['linea'] - 1]
            if (modo == 'id' and i['local'] not in texto) or (modo == 'pin' and '📌' not in texto):
                err['R6 la línea citada no contiene el id local'].append(s)

    # US / AC / TEST ----------------------------------------------------------------------------
    us, ac, test = {}, {}, {}
    for s, ds in defs.items():
        m = KIND.match(s)
        if not m:
            continue
        kind, pz, k = m.groups()
        f, n, body = ds[0]
        if f.startswith('80-'):
            err['R10 US/AC/TEST dentro de 80-abiertos'].append(s)
        P = CORTE if pz == 'corte' else next((p for p in piezas if p.lower() == pz), None)
        tag = f'{kind.upper()}:{P}:{k}' if P else None
        if not P:
            err['R11 pieza inexistente'].append(s)
        elif P == CORTE and kind == 'us':
            err['R11 US de CORTE (sólo AC y TEST, owner BE)'].append(s)
        elif tag not in body:
            err['R11 id visible ≠ ancla'].append(s)
        elif os.path.basename(f) != (f'{P}.md' if P != CORTE else '30-el-corte.md'):
            err['R11 definido fuera del archivo de su pieza'].append(s)
        fuente = re.search(r'^Fuente:(.*)$', body, re.M)
        cit = [c for c in citas(fuente.group(1))] if fuente else []
        if not [c for c in cit if c in by_slug and by_slug[c]['fuente'] in CITABLES]:
            err['R9 sin fuente citable'].append(s)
        rec = dict(pieza=P, body=body, fuente=[c for c in cit if c in by_slug])
        if kind == 'us':
            a = re.search(r'^Actor:\s*(.+?)\s*$', body, re.M)
            if not a or a.group(1) not in ACTORES:
                err['R11 US sin actor de la lista cerrada'].append(s)
            us[s] = rec
        elif kind == 'ac':
            for w in ('Dado', 'Cuando', 'Entonces'):
                if not re.search(rf'^\s*(?:[-*]\s*)?\**{w}\b', body, re.M):
                    err[f'R11 AC sin {w}'].append(s)
            ac[s] = rec
        else:
            t = re.search(r'^Tipo:\s*(.+?)\s*$', body, re.M)
            rec['tipo'] = t.group(1) if t else None
            e = re.search(r'^Etiqueta:\s*(\w+)', body, re.M)
            rec['etiqueta'] = e.group(1) if e else None
            if rec['tipo'] not in TIPOS_TEST:
                err['R12 tipo de test fuera de la lista cerrada'].append(s)
            elif P == CORTE and rec['tipo'] not in TIPOS_CORTE:
                err['R12 TEST:CORTE que no es smoke manual ni guard estático'].append(s)
            if rec['tipo'] == 'smoke manual':
                e = re.search(r'^Etiqueta:\s*(\w+)', body, re.M)
                if not e or e.group(1) not in ETIQUETAS_SMOKE:
                    err['R12 smoke sin etiqueta'].append(s)
            c = re.search(r'^Cubre:(.*)$', body, re.M)
            rec['cubre'] = [x for x in citas(c.group(1))] if c else []
            rec['mutacion'] = bool(re.search(r'^Mutación:\s*\S', body, re.M))
            test[s] = rec

    # R7, R8, R13-R15 ----------------------------------------------------------------------
    citado_por_ac = {c for a in ac.values() for c in a['fuente']}
    lista = SOLO_CITABLES if lista is None else lista
    for i in items:
        if (i['fuente'] in NORMATIVAS and not i['id'].startswith(NO_NORMATIVAS_PREFIJOS)
                and i['id'] not in lista
                and estado.get(i['id']) in VIVOS and slug(i['id']) not in citado_por_ac):
            err['R7 ítem normativo vivo sin AC'].append(i['id'])
    for f in solo_citables_fallas({i['id']: i for i in items}, lista):
        err['R7c lista de sólo citables inválida'].append(f)
    p03 = os.path.join(spec_dir, '03-contrato-de-cobertura.md')
    en03 = {x for _, x in REF.findall(open(p03, encoding='utf-8').read())} if os.path.exists(p03) else set()
    for cid in lista:
        if slug(cid) not in en03:
            err['R7c sólo citable sin declarar en 03-contrato-de-cobertura.md'].append(cid)
    if cobertura:
        cob = json.load(open(cobertura, encoding='utf-8'))['items']
        for cid, c in cob.items():
            i = next((x for x in items if x['id'] == cid), None)
            if i is None or estado.get(cid) not in VIVOS:
                continue
            if not any(a['pieza'] == c['pieza'] and slug(cid) in a['fuente'] for a in ac.values()):
                err['R7b el AC del ítem no está en su pieza dueña'].append(f"{cid} -> {c['pieza']}")
    cubiertos = {a for t in test.values() for a in t['cubre']}
    for a in ac:
        if a not in cubiertos:
            err['R8 AC sin test'].append(a)
    for t in test.values():
        for x in t['cubre']:
            if x not in ac:
                err['R8 test que cubre un AC inexistente'].append(x)

    def por_tests(pred):
        """Item slugs reached by the tests that satisfy ``pred``, directly or through their ACs."""
        out = set()
        for t in test.values():
            if pred(t):
                out |= set(t['fuente'])
                for a in t['cubre']:
                    out |= set(ac.get(a, {}).get('fuente', []))
        return out

    alc_todos = por_tests(lambda t: True)
    alc_int = por_tests(lambda t: t['tipo'] == 'integración con DB')
    alc_guard = por_tests(lambda t: t['tipo'] == 'guard estático' and t['mutacion'])
    for i in items:
        s, st = slug(i['id']), estado.get(i['id'])
        if st not in VIVOS:
            continue
        if i['fuente'] == 'INV' and s not in alc_todos and i['id'] not in lista:
            err['R13 invariante sin test'].append(i['id'])
        if i['fuente'] in ('TRANS', 'PROH') and s not in alc_int:
            err['R14 transición sin test de integración con DB'].append(i['id'])
        if i['fuente'] == 'GUARD' and s not in alc_guard:
            err['R15 guard sin prueba de mutación'].append(i['id'])

    # R11 exit AC, R16 template ------------------------------------------------------------
    for p, it in piezas.items():
        lista = slug(f'LISTA:{p}')
        if not any(a['pieza'] == p and lista in a['fuente'] for a in ac.values()):
            err['R11 pieza sin AC de salida (Lista cuando)'].append(p)
        carpeta = '10-corte' if it['cuando'] == 'corte' else f"20-fase-{it.get('fase')}"
        fs = glob.glob(os.path.join(spec_dir, carpeta, f'{p}.md'))
        if len(fs) != 1:
            err['R16 pieza sin su archivo (o en la carpeta equivocada)'].append(p)
            continue
        txt = open(fs[0], encoding='utf-8').read()
        hs = [(m.start(), m.group(1).strip()) for m in re.finditer(r'^## (.+)$', txt, re.M)]
        nombres = [h for _, h in hs]
        if [h for h in nombres if h in PLANTILLA] != list(PLANTILLA):
            err['R16 plantilla incompleta o desordenada'].append(f'{p}: falta {[h for h in PLANTILLA if h not in nombres]}')
        for k, (pos, h) in enumerate(hs):
            fin = hs[k + 1][0] if k + 1 < len(hs) else len(txt)
            cuerpo = re.sub(r'^## .+$', '', txt[pos:fin], count=1, flags=re.M).strip()
            if h in PLANTILLA and (not cuerpo or re.fullmatch(r'N/A\s*[—-]?\s*', cuerpo)):
                err['R16 sección vacía o N/A sin razón'].append(f'{p}: {h}')

    # R17 coverage net: every `Origen:` line of the spec counts, anchored or not ---------------
    citadas = origenes(spec_dir)
    for i in items:
        if i['fuente'] == 'SEC' and i['estado'] in VIVOS:
            if not any(i['linea'] <= ln <= i['fin'] for ln in citadas.get(i['archivo'], ())):
                err['R17 sección sin ninguna línea citada'].append(i['id'])

    # R18 minimum test types (AN) of each owned item, in its owner piece --------------------
    avisos = collections.defaultdict(list)
    if cobertura:
        for cid, c in cob.items():
            if estado.get(cid) not in VIVOS:
                continue
            acs = {a for a, r in ac.items() if r['pieza'] == c['pieza'] and slug(cid) in r['fuente']}
            alc = [t for t in test.values() if t['pieza'] == c['pieza'] and acs & set(t['cubre'])]
            fam = c.get('tipos_exigidos_por_familia', c.get('tipos_de_test_minimos', []))
            txt = c.get('tipos_solo_del_texto', [])
            for req in fam:
                if not tipo_cumplido(req, alc):
                    err['R18 falta un tipo de test que AN exige por familia'].append(f"{cid} -> {c['pieza']}: {req}")
            for req in txt:
                if not tipo_cumplido(req, alc):
                    avisos['R18 aviso: falta un tipo derivado del texto (no falla)'].append(f"{cid} -> {c['pieza']}: {req}")

    # R19 the dead part of a PARCIAL verdict is not rendered ------------------------------
    for cid, v in adj.items():
        if v.get('veredicto') != 'PARCIAL':
            continue
        for f, n, body in [x for x in defs.get(slug(cid), []) if not x[0].startswith('90-')]:
            txt = r19_norm('\n'.join(l for l in body.split('\n') if not R19_NOTA.match(l)))
            vivos = [t for t in r19_tramos(v.get('muerto')) if t in txt]
            if vivos:
                err['R19 texto muerto de un PARCIAL en el cuerpo de su bloque'].append(f'{cid} ({f}:{n}): «{vivos[0][:60]}»')

    for k in sorted(err, key=lambda k: (int(re.match(r'R(\d+)', k).group(1)), k)):
        print(f'✗ {k}: {len(err[k])}  ej: {err[k][:3]}')
    for k in sorted(avisos):
        print(f'⚠ {k}: {len(avisos[k])}  ej: {avisos[k][:3]}')
    total = sum(len(v) for v in err.values())
    print('RESULTADO:', 'APROBADO (0)' if total == 0 else f'RECHAZADO ({total})')
    return 0 if total == 0 else 1


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 3:
        sys.exit(__doc__)
    opt = lambda k: next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith(f'--{k}=')), None)  # noqa: E731
    lst = opt('lista-solo-citables')
    lst = {k: tuple(v) for k, v in json.load(open(lst, encoding='utf-8')).items()} if lst else None
    sys.exit(main(*args, deriva='--sin-deriva' not in sys.argv, cobertura=opt('cobertura'), lista=lst))
