#!/usr/bin/env python3
"""Generator of 01-decisiones-vigentes.md (group g1-decisiones). Reads only frozen sources via comun.py.

    python3 gen01.py [--salida=<dir>]     (default: writes 01-decisiones-vigentes.md into the spec)

Inputs next to it: cabecera.md (the file's head) and omisiones.json (written by omisiones.py).

A PARCIAL verdict (owner BK) is applied to whatever block the item renders as: a 📌 or a whole DEC
(its title and body, not its pins). What died is replaced by «[…]» and a «Parte sin efecto» note
follows. The run fails if a PARCIAL item renders with no span applied, if a span is not found exactly
once, or if a dead quote of the verdict (R19 of trazar.py) is still in the block."""
import json
import os
import re
import sys

# Paths are relative to this file: generadores/<grupo>/ -> scripts/ -> spec-consolidada/.
C = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
sys.path.insert(0, os.path.join(C, 'scripts'))
from comun import ROOT as W, lines, slug, D, SHA  # noqa: E402
from trazar import r19_norm, r19_tramos  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
inv = json.load(open(C + '/_trabajo/inventario.json', encoding='utf-8'))
asg = json.load(open(C + '/_trabajo/asignacion.json', encoding='utf-8'))
adj = json.load(open(C + '/_trabajo/adjudicacion.json', encoding='utf-8'))['veredictos']
cob = json.load(open(C + '/_trabajo/cobertura.json', encoding='utf-8'))
cobi, solo = cob['items'], cob['solo_citables']
OMIT = json.load(open(os.path.join(HERE, 'omisiones.json'), encoding='utf-8'))

items = inv['items']
byid = {i['id']: i for i in items}
mine = {k for k, v in asg['items'].items() if (v['destino'] or '').startswith('01')}
LOG = D + '01-decision-log.md'
LL = lines(LOG)

# piece -> file in the consolidated spec
PFILE = {}
for f in asg['por_archivo']:
    m = re.match(r'^(10-corte|20-fase-\d)/(.+)\.md$', f)
    if m:
        PFILE[m.group(2)] = f


def pieza_link(p):
    if p == 'CORTE':
        return '[CORTE](30-el-corte.md)'
    return f'[{p}]({PFILE[p]}#{slug("PIEZA:" + p)})'


def destino_de_salida(rel):
    """Where to write ``rel``: the spec itself, or ``--salida=<dir>`` (to compare without touching it)."""
    d = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--salida=')), C)
    p = os.path.join(d, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def unstrike(t):
    return re.sub(r'~~.*?~~', '', t, flags=re.S)


def relink(t, src):
    """Rewrite relative links of a source file so they resolve from the consolidated spec dir."""
    sd = os.path.dirname(os.path.join(W, src))

    def f(m):
        tgt = m.group(1)
        if re.match(r'^(?:[a-z]+:|#)', tgt):
            return m.group(0)
        path, _, frag = tgt.partition('#')
        new = os.path.relpath(os.path.normpath(os.path.join(sd, path)), C)
        return '](' + new + ('#' + frag if frag else '') + ')'
    return re.sub(r'\]\(([^)\s]+)\)', f, t)


def clean(text):
    """Drop lines left empty (or with a bare list marker) by unstriking."""
    out = []
    for l in text.split('\n'):
        if l.strip() == '' or not re.fullmatch(r'\s*(?:[-*>]|\d+\.)?\s*[·,;:.]?\s*', l):
            out.append(l.rstrip())
    # collapse 3+ blank lines
    s = re.sub(r'\n{3,}', '\n\n', '\n'.join(out))
    return s


def dedent(ls):
    ind = [len(l) - len(l.lstrip()) for l in ls if l.strip()]
    k = min(ind) if ind else 0
    return [l[k:] if len(l) >= k else l.lstrip() for l in ls]


def cobertura_lines(cid):
    out = []
    if cid in solo:
        s = solo[cid]
        own = next(i['id'] for i in items if i['fuente'] == 'OWN' and i['id'].startswith('OWN:41-corte-del-mvp:') and i['local'] == s['letra'])
        out.append(f'Cobertura: **sólo citable**, en la lista cerrada de `03-contrato-de-cobertura.md` (letra [{s["letra"]}](#{slug(own)}): {s["cita"]}); no lleva AC.')
    elif cid.startswith('DEC-METH-'):
        out.append('Cobertura: decisión de metodología, **sólo citable** (owner AX, ver el primer 📌 de [DEC-METH-019](#dec-meth-019)); no lleva AC.')
    elif cid in cobi:
        c = cobi[cid]
        out.append(f'Dueña del AC: {pieza_link(c["pieza"])}.')
        tam = c.get('tambien_lo_ejercen') or []
        if tam:
            out.append('También: ' + ' · '.join(f'{pieza_link(t["pieza"])} ({t["rol"]})' for t in tam) + '.')
        out.append('Tests mínimos: ' + '; '.join(c['tipos_de_test_minimos']) + '.')
    return out


# --- PARCIAL verdicts: omissions and note ----------------------------------------------------
APLICADAS = {}


def span_rx(span):
    """Verbatim match of ``span`` where any run of blanks INSIDE it (a line break and its indent
    included) matches any run of blanks; the blanks at its ends match literally, so a span that
    starts or ends with a blank or a line break keeps doing exactly that."""
    m = re.match(r'^(\s*)(.*?)(\s*)$', span, re.S)
    core = r'\s+'.join(re.escape(p) for p in re.split(r'\s+', m.group(2)))
    return re.compile(re.escape(m.group(1)) + core + re.escape(m.group(3)))


def omitir(cid, txt):
    """Apply the omissions of ``cid`` to ``txt`` (owner BK); fail as the module docstring says."""
    v = adj.get(cid)
    if not v or v['veredicto'] != 'PARCIAL':
        if cid in OMIT:
            sys.exit(f'omisiones para {cid}, que no es PARCIAL')
        return txt
    n = 0
    for o in OMIT.get(cid, []):
        if 'de' in o:
            hits = list(span_rx(o['de']).finditer(txt))
            if len(hits) != 1:
                sys.exit(f'omisión de {cid} encontrada {len(hits)} veces (se exige 1): {o["de"]!r}')
            txt = txt[:hits[0].start()] + o['a'] + txt[hits[0].end():]
            n += 1
            continue
        if r19_norm(o['cita']) not in r19_norm(txt):
            continue  # an earlier span already removed it
        hits = list(span_rx(o['cita']).finditer(txt))
        if len(hits) != 1:
            sys.exit(f'cita muerta de {cid} encontrada {len(hits)} veces tal cual (va un tramo en EXTRA): {o["cita"]!r}')
        txt = txt[:hits[0].start()] + '[…]' + txt[hits[0].end():]
        n += 1
    if n == 0:
        sys.exit(f'{cid} es PARCIAL y quedó sin ninguna omisión aplicada (completá omisiones.py)')
    vivos = [t for t in r19_tramos(v['muerto']) if t in r19_norm(txt)]
    if vivos:
        sys.exit(f'{cid}: texto muerto todavía en el bloque: {vivos[0]!r}')
    APLICADAS[cid] = n
    return txt


def nota_parcial(cid):
    v = adj.get(cid)
    if not v or v['veredicto'] != 'PARCIAL':
        return []
    ev = '; '.join(f'`{e["archivo"]}:{e["linea"]}` («{re.sub(r"~~(.*?)~~", r"[tachado: \1]", e["cita"])}»)' for e in v['evidencia'])
    return ['', f'> **Parte sin efecto** (adjudicación `PARCIAL`): {v["muerto"]}.' + (f' Lo supera: {ev}.' if ev else '')
            + ' Lo omitido del texto de arriba está marcado «[…]».']


# --- pins: segment extraction --------------------------------------------------------------
LIST = re.compile(r'^\s*(?:[-*]|\d+\.)\s')


def pin_start_col(line):
    k = line.find('📌')
    for pre in ('(**', '**'):
        if line[max(0, k - len(pre)):k] == pre:
            return k - len(pre) + (1 if pre == '(**' else 0)
    return k


def pin_segments(dec):
    pins = sorted((i for i in items if i['fuente'] == 'PIN' and i.get('dec') == dec['id']), key=lambda i: i['linea'])
    starts = {p['linea'] for p in pins}
    segs = []
    for p in pins:
        a = p['linea']
        first = LL[a - 1]
        ind = len(first) - len(first.lstrip())
        list_start = bool(LIST.match(first)) and first.lstrip()[:6].find('📌') >= 0 or bool(re.match(r'^\s*(?:[-*]|\d+\.)\s+\*\*📌', first)) or bool(re.match(r'^\s*[-*]\s+📌', first))
        quote = first.lstrip().startswith('>')
        b = a

        def cont(l):
            li = len(l) - len(l.lstrip())
            if l.strip() == '---' or re.match(r'^#{1,6} ', l):
                return False
            if quote:
                return l.lstrip().startswith('>')
            if li < ind or (li <= ind and LIST.match(l) and (list_start or li < ind)):
                return False
            if li == ind and re.match(r'^- \*\*', l):
                return False
            return True

        n = a + 1
        while n <= dec['fin']:
            l = LL[n - 1]
            if n in starts:
                break
            if not l.strip():
                k = n
                while k <= dec['fin'] and not LL[k - 1].strip():
                    k += 1
                if k > dec['fin'] or k in starts or not cont(LL[k - 1]):
                    break
                n = k
                continue
            if not cont(l):
                break
            b = n
            n += 1
        segs.append((p, a, b))
    return segs


def render_dec(dec):
    cid = dec['id']
    segs = pin_segments(dec)
    body, pins_out = [], []
    n = dec['linea'] + 1
    seg_at = {a: (p, a, b) for p, a, b in segs}
    while n <= dec['fin']:
        if n in seg_at:
            p, a, b = seg_at[n]
            line = LL[a - 1]
            col = pin_start_col(line)
            prefix = relink(line[:col], LOG)
            seg_lines = [relink(' ' * col + line[col:], LOG)] + [relink(x, LOG) for x in LL[a:b]]
            dead = p['estado'] in ('MUERTO',) or (adj.get(p['id'], {}).get('veredicto') == 'MUERTO')
            if dead or p['id'] not in mine:
                body.append(f'{prefix}→ {p["local"]} retirado: [{p["id"]}](90-retirados.md#{slug(p["id"])})')
            else:
                ef = adj.get(p['id'], {}).get('efecto')
                extra = f' ({ef} de lo anterior; adjudicación)' if ef in ('reemplaza parte', 'reemplaza todo') else ''
                body.append(f'{prefix}→ ver [{p["local"]}](#{slug(p["id"])}){extra}.')
                pins_out.append((p, seg_lines))
            n = b + 1
            continue
        body.append(relink(LL[n - 1], LOG))
        n += 1
    while body and body[-1].strip() in ('', '---'):
        body.pop()
    title = unstrike(LL[dec['linea'] - 1]).replace('### ', '', 1)
    title = re.sub(r'\s{2,}', ' ', title).strip()
    title_body = omitir(cid, '### ' + title + '\n\n' + clean(unstrike('\n'.join(body))).strip('\n'))
    title, body_txt = title_body.split('\n\n', 1)
    out = ['', f'<a id="{slug(cid)}"></a>', title, '', f'Origen: {LOG}:{dec["linea"]}', '']
    if dec['estado'] == 'SUPERSEDED_PARCIAL':
        v = adj.get(cid, {}).get('veredicto')
        out += [f'Estado en el inventario: `SUPERSEDED_PARCIAL`; adjudicación `{v}` en `adjudicacion.json`: sigue viva salvo '
                'lo que dice su nota «Parte sin efecto», al final del cuerpo.' if v == 'PARCIAL' else
                f'Estado en el inventario: `SUPERSEDED_PARCIAL` (sigue viva en lo que su propio campo *Estado* declara que sobrevive; '
                + (f'adjudicación `{v}` en `adjudicacion.json`).' if v else 'sin adjudicación en `adjudicacion.json`).'), '']
    cl = cobertura_lines(cid)
    if cl:
        out += cl + ['']
    out.append(body_txt)
    out += nota_parcial(cid)
    for p, seg in pins_out:
        first, rest = seg[0].lstrip(), list(seg[1:])
        if re.match(r'^\s*>', LL[p['linea'] - 1][:pin_start_col(LL[p['linea'] - 1])]):
            rest = [re.sub(r'^\s*>\s?', '', x) for x in rest]
        txt = '\n'.join([first] + dedent(rest))
        txt = clean(unstrike(txt)).strip('\n')
        txt = omitir(p['id'], txt)
        out += ['', f'<a id="{slug(p["id"])}"></a>', f'#### {p["local"]} de {cid}', '', f'Origen: {LOG}:{p["linea"]}', '']
        cl = cobertura_lines(p['id'])
        if cl:
            out += cl + ['']
        out.append(txt)
        out += nota_parcial(p['id'])
    return out


# --- owner letters ------------------------------------------------------------------------
def own_render(i):
    path = i['archivo']
    L = lines(path)
    n = i['linea']
    row = L[n - 1]
    k = n - 1
    while not re.match(r'^\|\s*-', L[k - 1]):
        k -= 1
    head = [c.strip() for c in L[k - 2].strip().strip('|').split('|')]
    cells = [c.strip() for c in row.strip().strip('|').split('|')]
    cells = [relink(clean(unstrike(c)), path).strip() for c in cells]
    out = ['', f'<a id="{slug(i["id"])}"></a>', f'**{head[0]} {cells[0]}**', '', f'Origen: {path}:{n}', '']
    for h, c in zip(head[1:], cells[1:]):
        out.append(f'- **{h}**: {c if c else "—"}')
    return out


def own_section_heading(path, n):
    L = lines(path)
    for k in range(n - 1, 0, -1):
        if re.match(r'^#{1,6} ', L[k - 1]):
            return L[k - 1].lstrip('#').strip(), k
    return None, None


def main():
    decs = [i for i in items if i['fuente'] == 'DEC' and i['id'] in mine]
    area_order = ['TRIAL', 'SUB', 'BILL', 'MP', 'ENT', 'LIM', 'ADDON', 'PROMO', 'AUTH', 'DATA', 'MAIL',
                  'ADMIN', 'ARCH', 'MIG', 'GRANT', 'LEGAL', 'TEST']
    extra = []
    for d in sorted(decs, key=lambda d: d['linea']):
        a = d['id'].split('-')[1]
        if a not in area_order and a not in extra and a != 'METH':
            extra.append(a)
    areas = area_order + extra + ['METH']
    out = []
    out += open(os.path.join(HERE, 'cabecera.md'), encoding='utf-8').read().rstrip('\n').split('\n')
    cnt = {'DEC': 0, 'PIN': 0, 'OWN': 0}
    for a in areas:
        ds = sorted((d for d in decs if d['id'].split('-')[1] == a), key=lambda d: int(d['id'].split('-')[2]))
        dead = sorted(i['id'] for i in items if i['fuente'] == 'DEC' and i['id'] not in mine and i['id'].split('-')[1] == a)
        if not ds and not dead:
            continue
        out += ['', f'## Área {a}', '']
        if dead:
            out.append('Retiradas de esta área (en `90-retirados.md`): ' + ', '.join(f'[{x}](90-retirados.md#{slug(x)})' for x in dead) + '.')
        for d in ds:
            r = render_dec(d)
            out += r
            cnt['DEC'] += 1
            cnt['PIN'] += sum(1 for l in r if l.startswith('<a id=') and '-p' in l and l != f'<a id="{slug(d["id"])}"></a>')
    # owner letters
    out += ['', '## Registro de las letras del owner', '',
            'Cada fila de las tablas `10-decisiones-del-owner.md` de las rondas de diseño, sin lo tachado. '
            'Son **sólo citables** (owner AX: «la matriz, las letras del owner y la lista de piezas son sólo citables»); '
            'la decisión que cada letra produjo vive en su DEC o su 📌 de arriba.']
    owns = [i for i in items if i['fuente'] == 'OWN']
    files = []
    for i in owns:
        if i['archivo'] not in files:
            files.append(i['archivo'])
    files.sort()
    for f in files:
        L = lines(f)
        h1 = next((l[2:].strip() for l in L if l.startswith('# ')), f)
        rel = f.split('/docs/')[1]
        out += ['', f'### {h1}', '', f'Fuente: `{rel}`.']
        last = None
        for i in sorted((x for x in owns if x['archivo'] == f), key=lambda x: x['linea']):
            h, k = own_section_heading(f, i['linea'])
            if k != last and not h.startswith(h1):
                out += ['', f'#### {h}']
            last = k
            if i['id'] in mine:
                out += own_render(i)
                cnt['OWN'] += 1
            else:
                out += ['', f'**{i["local"]}** — retirada: [{i["id"]}](90-retirados.md#{slug(i["id"])}).']
    parcial = {k for k, v in adj.items() if v['veredicto'] == 'PARCIAL' and k in mine}
    if parcial - set(APLICADAS):
        sys.exit(f'PARCIAL de 01 sin renderizar con sus omisiones: {sorted(parcial - set(APLICADAS))}')
    txt = '\n'.join(out).rstrip('\n') + '\n'
    txt = re.sub(r'\n{3,}', '\n\n', txt)
    open(destino_de_salida('01-decisiones-vigentes.md'), 'w', encoding='utf-8').write(txt)
    print(cnt, len(txt.split('\n')), 'PARCIAL', len(APLICADAS), 'tramos', sum(APLICADAS.values()))


main()
