#!/usr/bin/env python3
"""Generates 04-catalogos.md of the consolidated spec (group g3-catalogos) from the frozen sources.

Every item is copied VERBATIM from its source line at the SHA, with only the struck spans (~~…~~)
removed and markdown links neutralized; nothing is paraphrased. Metadata (owner piece, también)
comes from cobertura.json and its citations; the TPZ/APZ notes from the inventory.

    python3 gen.py [--salida=<dir>]     (default: writes 04-catalogos.md into the spec)
"""
import collections
import json
import os
import re
import sys

# Paths are relative to this file: generadores/<grupo>/ -> scripts/ -> spec-consolidada/.
C = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
sys.path.insert(0, os.path.join(C, 'scripts'))
from comun import SHA, lines, slug  # noqa: E402

INV = json.load(open(C + '/_trabajo/inventario.json', encoding='utf-8'))['items']
ASG = json.load(open(C + '/_trabajo/asignacion.json', encoding='utf-8'))
ADJ = json.load(open(C + '/_trabajo/adjudicacion.json', encoding='utf-8'))['veredictos']
COB = json.load(open(C + '/_trabajo/cobertura.json', encoding='utf-8'))['items']
BYID = {i['id']: i for i in INV}
MINE = [k for k, v in ASG['items'].items() if (v['destino'] or '').startswith('04')]
SECS = [i for i in INV if i['fuente'] == 'SEC']
# BK: what a PARCIAL verdict declares dead is omitted with «[…]» (spans written by omisiones.py)
OMIT = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'omisiones.json'), encoding='utf-8'))
_sin_omision = [k for k in MINE if ADJ.get(k, {}).get('veredicto') == 'PARCIAL' and not OMIT.get(k)]
assert not _sin_omision, f'PARCIAL sin omisiones (correr omisiones.py): {_sin_omision}'

Bp = '.specs/HOS-1354-billing-cobro-y-proveedor/'
Vp = '.specs/HOS-1353-verticales-capacidades-y-autorizacion/'
Dp = '.specs/HOS-1352-billing-verticals-redesign/docs/'
CORTO = {Bp + 'docs/': 'B/', Vp + 'docs/': 'V/', Dp: 'D/', Bp: 'B/', Vp: 'V/'}

AVISOS = []


def destino_de_salida(rel):
    """Where to write ``rel``: the spec itself, or ``--salida=<dir>`` (to compare without touching it)."""
    d = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--salida=')), C)
    p = os.path.join(d, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def corto(path):
    for k, v in CORTO.items():
        if path.startswith(k):
            return v + path[len(k):]
    return path


# --- pieces ---------------------------------------------------------------------------------
FASE = {}
for carpeta, ps in ASG['fases'].items():
    for p in ps:
        FASE[p] = carpeta
PIEZAS = {i['local']: i for i in INV if i['fuente'] == 'PIEZA'}


def pieza_link(p):
    if p == 'CORTE':
        return '[CORTE](30-el-corte.md)'
    carpeta = '10-corte' if PIEZAS[p]['cuando'] == 'corte' else FASE[p]
    return f'[{p}]({carpeta}/{p}.md#{slug("PIEZA:" + p)})'


def own(letra):
    x = [i['id'] for i in INV if i['fuente'] == 'OWN' and i['id'].startswith('OWN:41-corte-del-mvp:')
         and i['id'].endswith(':' + letra)]
    assert len(x) == 1, letra
    return f'[{letra}](01-decisiones-vigentes.md#{slug(x[0])})'


# --- text helpers ---------------------------------------------------------------------------
LINK = re.compile(r'\[([^\]]*)\]\(([^)\s]*)\)')


def _rep(m):
    g1, g2 = m.group(1), m.group(2)
    if g1 and g2:
        return ' '
    b, a = m.string[m.start() - 1:m.start()], m.string[m.end():m.end() + 1]
    if (g1 or g2) and b and a and not b.isspace() and not a.isspace() and a not in ',.;:)»' and b not in '(«':
        return ' '
    return ''


def limpiar(t):
    """Drop struck spans and neutralize links; nothing else changes the source wording."""
    if t.count('~~') % 2:
        AVISOS.append(f'número impar de ~~: {t[:80]}')
    t = re.sub(r'([ \t]?)~~.*?~~([ \t]?)', _rep, t, flags=re.S)
    t = LINK.sub(lambda m: f'{m.group(1)} (`{m.group(2)}`)' if m.group(2) else m.group(1), t)
    return t.strip()


def split_row(line):
    s = line.strip()
    if s.startswith('|'):
        s = s[1:]
    if s.endswith('|') and not s.endswith('\\|'):
        s = s[:-1]
    out, cur, tick, i = [], '', False, 0
    while i < len(s):
        ch = s[i]
        if ch == '\\' and i + 1 < len(s) and s[i + 1] == '|':
            cur += '\\|'
            i += 2
            continue
        if ch == '`':
            tick = not tick
        if ch == '|' and not tick:
            out.append(cur)
            cur = ''
        else:
            cur += ch
        i += 1
    out.append(cur)
    return [c.strip() for c in out]


def naive_split(line):
    return [c.strip() for c in line.strip().strip('|').split('|')]


def header_of(path, n):
    """The header row (cells, line) of the table that line n belongs to."""
    L = lines(path)
    for k in range(n - 1, 0, -1):
        if L[k - 1].startswith('|') and k < len(L) and re.match(r'^\|\s*:?-', L[k]):
            return split_row(L[k - 1]), k
    raise SystemExit(f'sin encabezado: {path}:{n}')


def row_cells(path, n):
    L = lines(path)
    h, hl = header_of(path, n)
    c = split_row(L[n - 1])
    if len(c) != len(h):
        c2 = naive_split(L[n - 1])
        if len(c2) == len(h):
            c = c2
        else:
            AVISOS.append(f'{corto(path)}:{n} tiene {len(c)} celdas y el encabezado {len(h)}')
    return h, c


def sec_of(path, n):
    """The innermost SEC item containing line n."""
    s = [i for i in SECS if i['archivo'] == path and i['linea'] <= n <= i['fin']]
    return min(s, key=lambda i: i['fin'] - i['linea']) if s else None


# --- per-item metadata ------------------------------------------------------------------------
def meta(cid):
    out, locs = [], []
    c = COB.get(cid)
    if c:
        t = c['pieza']
        tam = ', '.join(f"{pieza_link(x['pieza'])} ({x['rol']})" for x in c['tambien_lo_ejercen'])
        inf = ' *(asignación inferida en `cobertura.json`)*' if 'inferid' in c['razon'] else ''
        out.append(f'- **Pieza dueña** (su AC vive en el archivo de la pieza): {pieza_link(t)}{inf}'
                   + (f' · **también**: {tam}' if tam else ''))
        cits = []
        for f in c['fuente_de_la_asignacion']:
            if (f['archivo'], f['linea']) == (BYID[cid]['archivo'], BYID[cid]['linea']):
                continue
            cits.append(f"`{corto(f['archivo'])}:{f['linea']}`")
            locs.append(f"{f['archivo']}:{f['linea']}")
        cits = list(dict.fromkeys(cits))
        if cits:
            out.append('- **Fuente de la asignación**: ' + '; '.join(cits))
    v = ADJ.get(cid)
    if v:
        # the BK family leaves `razon` empty and states what died in `muerto`
        motivo = v['razon'] or (f"lo muerto: {v['muerto']}" if v.get('muerto') else '')
        assert motivo, cid
        if OMIT.get(cid):
            out.append(f"- **Adjudicación** (`adjudicacion.json`, {own('BK')}): {v['veredicto']} — {motivo}; "
                       'lo muerto, aunque la fila no lo tache, se omite del texto de abajo y queda marcado «[…]»; '
                       'lo tachado de la fila también se omite, y lo vigente va entero.')
        else:
            out.append(f"- **Adjudicación** (`adjudicacion.json`): {v['veredicto']} — {motivo}; lo tachado "
                       'de la fila se omite y lo vigente va entero.')
    return out, locs


def bloque(cid, titulo, cuerpo, extra_locs=()):
    i = BYID[cid]
    m, locs = meta(cid)
    locs = [f"{i['archivo']}:{i['linea']}"] + list(extra_locs) + locs
    seen = []
    for l in locs:
        if l not in seen:
            seen.append(l)
    adj = []
    for (f, a, b) in ADJUNTOS.get(cid, []):
        head = limpiar(lines(f)[a - 1].lstrip('#').strip())
        t = nota(f, a, b, 'x')
        # plain prose, not an italic paragraph: markdownlint reads that as a heading (MD036)
        t = t.split('\n', 4)[4] if t else 'La sección no tiene texto vigente fuera de su título.'
        assert not re.search(r'^Origen:|<a id=', t, re.M), (f, a)
        adj += ['', f'**Texto de la fuente — «{head}»** (`{corto(f)}:{a}–{b}`, sin lo tachado):', '', t]
        L = lines(f)
        citar = [x for x in range(a, b + 1) if L[x - 1].strip()] if (f, a) in TODAS_LAS_LINEAS else [a]
        for x in citar:
            if f'{f}:{x}' not in seen:
                seen.append(f'{f}:{x}')
    return '\n'.join([f'<a id="{slug(cid)}"></a>', '', f'### {titulo}', ''] + m + cuerpo + adj
                      + ['', 'Origen: ' + ', '.join(seen), ''])


GLOSA = {'desde': 'estado origen', 'evento': 'disparador', 'hacia': 'estado destino',
         'condición': 'guardas', 'efectos': 'efectos', 'nota': 'guardas y efectos'}


def campos(h, c, saltar=('#',)):
    out = []
    for k, (hh, cc) in enumerate(zip(h, c)):
        if hh in saltar and k == 0:
            continue
        g = GLOSA.get(hh)
        etiqueta = f'**{hh}** ({g})' if g else f'**{limpiar(hh)}**'
        out.append(f'- {etiqueta}: {limpiar(cc) or "—"}')
    for extra in c[len(h):]:
        out.append(f'- *(celda sin encabezado en la fuente)*: {limpiar(extra)}')
    return out


def item_row(cid, titulo, pre=(), post=(), extra_locs=()):
    i = BYID[cid]
    h, c = row_cells(i['archivo'], i['linea'])
    cuerpo = campos(h, c)
    for o in OMIT.get(cid, []):
        n = sum(x.count(o['de']) for x in cuerpo)
        assert n == 1, f"omisión de {cid} encontrada {n} veces: {o['de']!r}"
        cuerpo = [x.replace(o['de'], o['a']) for x in cuerpo]
    return bloque(cid, titulo, list(pre) + cuerpo + list(post), extra_locs)


# --- notes: the source text around a table, minus the item rows ------------------------------
def nota(path, a, b, titulo, quitar=()):
    L = lines(path)
    quitar = set(quitar)
    body, tabla_quitada = [], False
    k = a
    # drop the section heading itself
    if re.match(r'^#+\s', L[a - 1]):
        k = a + 1
    rows = list(range(k, b + 1))
    skip = set()
    # whole table blocks that contain an item row are removed
    n = k
    while n <= b:
        if L[n - 1].startswith('|'):
            m = n
            while m + 1 <= b and L[m].startswith('|'):
                m += 1
            if any(x in quitar for x in range(n, m + 1)):
                skip |= set(range(n, m + 1))
            n = m + 1
        else:
            n += 1
    txt = '\n'.join(L[x - 1] for x in rows if x not in skip)
    txt = limpiar(txt)
    txt = re.sub(r'\n{3,}', '\n\n', txt).strip()
    if not txt or txt == '---':
        return ''
    txt = re.sub(r'^---\s*$', '', txt, flags=re.M).strip()
    assert not re.search(r'^#{1,2} ', txt, re.M), (path, a)
    return f'### {titulo}\n\nTexto de `{corto(path)}:{a}–{b}`, sin lo tachado:\n\n{txt}\n'


def notas_de(ids, titulo_base):
    """Notes of every SEC that contains one of ``ids``, in source order."""
    vistos, out = [], []
    rows = collections.defaultdict(set)
    for cid in ids:
        i = BYID[cid]
        rows[i['archivo']].add(i['linea'])
    for cid in ids:
        i = BYID[cid]
        s = sec_of(i['archivo'], i['linea'])
        if s and s['id'] not in vistos:
            vistos.append(s['id'])
            head = limpiar(lines(s['archivo'])[s['linea'] - 1].lstrip('#').strip())
            t = nota(s['archivo'], s['linea'], s['fin'], f'{titulo_base} — «{head}»', rows[s['archivo']])
            if t:
                out.append(t)
    return out


def sec_note(path, a, titulo):
    s = [i for i in SECS if i['archivo'] == path and i['linea'] == a]
    assert len(s) == 1, (path, a)
    head = limpiar(lines(path)[a - 1].lstrip('#').strip())
    return nota(path, a, s[0]['fin'], f'{titulo} — «{head}»')


def ids_de(prefix):
    return sorted([k for k in MINE if k.startswith(prefix)], key=lambda k: BYID[k]['linea'])


# --- prose sections of the source attached to the item they discuss --------------------------
ADJUNTOS = collections.defaultdict(list)
_B03 = Bp + 'docs/03-maquinas-de-estado.md'
_V03 = Vp + 'docs/03-maquinas-de-estado.md'
_B05 = Bp + 'docs/05-idempotencia-y-concurrencia.md'
_B20 = Bp + 'docs/20-testing.md'
_V20 = Vp + 'docs/20-testing.md'
_B02 = Bp + 'docs/02-modelo-de-datos.md'


def _secs(f, a, b):
    rows = {BYID[k]['linea'] for k in MINE if BYID[k]['archivo'] == f}
    out = []
    for i in SECS:
        if i['archivo'] == f and a <= i['linea'] <= b and i['estado'] == 'VIVO':
            if any(i['linea'] <= r <= i['fin'] for r in rows):
                continue  # its rows are items: the notes of that section go before the items
            out.append(i)
    return sorted(out, key=lambda i: i['linea'])


def _adjuntar(f, a, b, prefijo, defecto):
    loc = {BYID[k]['local']: k for k in MINE if k.startswith(prefijo)}
    for i in _secs(f, a, b):
        head = limpiar(lines(f)[i['linea'] - 1])
        ids = [x for x in re.findall(r'`([A-Z]+\d+)`', head) if x in loc]
        ADJUNTOS[loc[ids[0]] if ids else defecto].append((f, i['linea'], i['fin']))


_adjuntar(_B03, 21, 1446, 'TRANS:B:S', 'TRANS:B:S1')
_adjuntar(_B03, 1447, 1519, 'PROH:', 'PROH:B:1')
_adjuntar(_B03, 1520, 1739, 'TRANS:B:S', 'TRANS:B:S1')
_adjuntar(_B03, 1906, 2529, 'TRANS:B:MP', 'TRANS:B:MP1')
_adjuntar(_B03, 2549, 2687, 'TRANS:B:A', 'TRANS:B:A1')
_adjuntar(_B03, 2688, 3062, 'TRANS:B:S', 'TRANS:B:S1')
_adjuntar(_V03, 91, 479, 'TRANS:V:T', 'TRANS:V:T1')
_adjuntar(_V03, 655, 1338, 'TRANS:V:PB', 'TRANS:V:PB1')
_adjuntar(_B05, 27, 103, 'LOCK:', 'LOCK:C1')
_adjuntar(_B05, 306, 543, 'TRANS:B:S', 'TRANS:B:S5')
_adjuntar(_B05, 544, 557, 'LOCK:', 'LOCK:C1')
_adjuntar(_B20, 447, 465, 'GUARD:', 'GUARD:G7')
_adjuntar(_V20, 352, 370, 'GUARD:', 'GUARD:G1')
_adjuntar(_B20, 466, 498, 'M:', 'M:M1')
_adjuntar(_B20, 553, 626, 'M:', 'M:M1')
_adjuntar(_B20, 627, 704, 'RP:', 'RP:RP1')
_adjuntar(_B02, 972, 1007, 'MOT:', 'MOT:1')
ADJUNTOS['MOT:7'].append((_B02, 1125, 1154))
ADJUNTOS['MOT:1'].append((_B02, 1155, 1178))
# R17: `B/descomposicion.md` §2.1 assigns `G12` to `B1` and sends `G13` to `V4`; the guards themselves
# live in the catalog (`B/20` §2), so the section goes with `G12` and its `Origen:` cites every line.
_BDESC = Bp + 'descomposicion.md'
ADJUNTOS['GUARD:G12'].append((_BDESC, 176, 190))
TODAS_LAS_LINEAS = {(_BDESC, 176)}


# --- titles -----------------------------------------------------------------------------------
def corto_celda(t, n=70):
    t = limpiar(t)
    return t if len(t) <= n and '\n' not in t else None


def titulo_trans(cid):
    i = BYID[cid]
    h, c = row_cells(i['archivo'], i['linea'])
    d = dict(zip(h, c))
    a, b = corto_celda(d.get('desde', '')), corto_celda(d.get('hacia', ''))
    flecha = f' — {a} → {b}' if a and b else ''
    return f'`{cid}` · `{i["local"]}`{flecha}'


TEST_TRANS = (f'- **Test mínimo** ({own("AN")}): integración con DB, en la pieza dueña.')

# A guard an owner letter added to a row its source table never received (first blind-verification
# round, H-VA-A2-2): shown after the verbatim cells, never merged into them, with the letter's line.
_OWN41 = Dp + '41-corte-del-mvp/10-decisiones-del-owner.md'
assert 'tiene un plan vigente que herede Turista VIP' in lines(_OWN41)[123], (_OWN41, 124)
GUARDA_POSTERIOR = {
    'TRANS:B:S1': ([f'- **Guarda que suma el corte del MVP** ({own("BJ")}), que la fila de la fuente no '
                    'recibió: **y el `user` no tiene un plan vigente que herede Turista VIP** cuando compra '
                    'Turista VIP (el código de error del rechazo queda abierto).'], [f'{_OWN41}:124']),
}


def seccion_trans(titulo, prefix, intro=(), con_tpz=False, con_apz=False):
    ids = ids_de(prefix)
    out = [f'## {titulo}', ''] + list(intro)
    out += notas_de(ids, titulo)
    out += ['', f'## {titulo} — las transiciones', '']
    for cid in ids:
        i = BYID[cid]
        pre = []
        if con_tpz:
            t = BYID.get('TPZ:' + i['local'])
            if t:
                pz = t['piezas'][0]
                nt = f" — nota de la fuente: «{limpiar(t['nota'])}»" if t.get('nota') else ''
                pre.append(f"- **Traslado a pieza** (`B/descomposicion.md` §2.12): "
                           f"[TPZ:{i['local']}]({ '10-corte' if PIEZAS[pz]['cuando']=='corte' else FASE[pz]}/{pz}.md#{slug(t['id'])})"
                           f" → {', '.join(pieza_link(p) for p in t['piezas'])}{nt}")
        if con_apz:
            t = BYID.get('APZ:' + i['local'])
            if t:
                pz = t['pieza']
                pre.append(f"- **Traslado a pieza** (instancia de addon → pieza, `D/16` §4.6, {own('AV')}): "
                           f"[APZ:{i['local']}]({ '10-corte' if PIEZAS[pz]['cuando']=='corte' else FASE[pz]}/{pz}.md#{slug(t['id'])})"
                           f" → {pieza_link(pz)}")
        pre.append(TEST_TRANS)
        post, locs = GUARDA_POSTERIOR.get(cid, ((), ()))
        out.append(item_row(cid, titulo_trans(cid), pre=pre, post=post, extra_locs=locs))
    return out


# --- assembly ---------------------------------------------------------------------------------
def main():
    out = []
    out += ['# Catálogos', '',
            'Catálogo único de transiciones, transiciones prohibidas, motivos de la marca de conciliación, '
            'candados, reglas y mentiras del proveedor falso, guards, validaciones del panel y filas de la '
            'matriz de Mercado Pago (organización por pieza con catálogos únicos: '
            '[DEC-METH-019](01-decisiones-vigentes.md#dec-meth-019), punto 2, letra '
            f'{own("AH")}).', '',
            '**Cómo se lee.** Cada ítem lleva su ancla, su texto **copiado de la fuente congelada** '
            f'(`{SHA[:10]}`) con lo tachado omitido y nada parafraseado, y su línea `Origen:`. '
            'Las celdas van con el nombre de la columna de la fuente; entre paréntesis, a qué parte de la '
            'transición corresponde (estado origen, disparador, estado destino, guardas, efectos). '
            'La **pieza dueña** y las que también lo ejercen salen de `_trabajo/cobertura.json`, con la cita '
            'que las justifica; el AC y los tests de cada ítem viven en el archivo de su pieza, no acá '
            f'({own("AM")}, {own("AN")}). Los links a otros archivos de la fuente se dejaron como texto.', '',
            'Las secciones *«texto de la fuente»* traen, sin lo tachado, la prosa de la misma sección de '
            'la fuente que rodea cada tabla: son reglas de la tabla entera y se leen junto con sus filas.', '']

    V03 = Vp + 'docs/03-maquinas-de-estado.md'
    B03 = Bp + 'docs/03-maquinas-de-estado.md'
    out += seccion_trans('Trial (`V/03` §2)', 'TRANS:V:T')
    out += seccion_trans('Publicación de la ficha (`V/03` §9)', 'TRANS:V:PB')
    out += seccion_trans('Postulación de Partner (`V/03` §11)', 'TRANS:V:PP')
    out += seccion_trans('Suscripción (`B/03` §3.2)', 'TRANS:B:S', con_tpz=True)

    # PROH
    ids = ids_de('PROH:')
    t = 'Transiciones que no existen (`B/03` §3.3)'
    out += [f'## {t}', ''] + notas_de(ids, t) + ['', f'## {t} — las filas', '']
    for cid in ids:
        i = BYID[cid]
        h, c = row_cells(i['archivo'], i['linea'])
        out.append(item_row(cid, f'`{cid}` · {limpiar(c[0])}', pre=[
            f'- **Test mínimo** ({own("AN")}, {own("AZ")}): integración con DB que intenta la transición '
            'y comprueba que no ocurre, en la pieza dueña.']))

    out += seccion_trans('Pago (`B/03` §6)', 'TRANS:B:P')
    out += seccion_trans('Reembolso (`B/03` §6.1)', 'TRANS:B:RF')
    out += seccion_trans('Pago manual (`B/03` §7)', 'TRANS:B:MP')
    out += seccion_trans('Instancia de addon, A1–A7 (`B/03` §8)', 'TRANS:B:A', con_apz=True)

    # MOT
    B02 = Bp + 'docs/02-modelo-de-datos.md'
    ids = ids_de('MOT:')
    t = 'Motivos de la marca de conciliación (`B/02` §2.5)'
    out += [f'## {t}', '',
            'Cada motivo es un valor de la columna **`motivo`** de **`reconciliation_mark`**, '
            '*«enumeración cerrada, §2.5»* (`B/02` §2.2, línea 57). El nombre del valor va en el título de '
            'cada ítem.', '']
    out += notas_de(ids, t) + ['', f'## {t} — los veinticuatro', '']
    L57 = limpiar(lines(B02)[56])
    for cid in ids:
        i = BYID[cid]
        out.append(item_row(cid, f'`{cid}` · `{i["nombre"]}`', pre=[
            f'- **Valor del enum**: `reconciliation_mark.motivo` = `{i["nombre"]}`'], extra_locs=[f'{B02}:57']))

    # LOCK
    ids = ids_de('LOCK:')
    B05 = Bp + 'docs/05-idempotencia-y-concurrencia.md'
    t = 'Candados: los seis cruces (`B/05` §2)'
    out += [f'## {t}', '', 'Cada candado es la sección entera de la fuente, sin lo tachado.', '']
    for cid in ids:
        i = BYID[cid]
        s = [x for x in SECS if x['archivo'] == i['archivo'] and x['linea'] == i['linea']][0]
        L = lines(i['archivo'])
        body = limpiar('\n'.join(L[i['linea']:s['fin']]))
        body = re.sub(r'^---\s*$', '', body, flags=re.M)
        body = re.sub(r'\n{3,}', '\n\n', body).strip()
        assert not re.search(r'^#{1,2} |^Origen:|<a id=', body, re.M)
        head = limpiar(L[i['linea'] - 1].lstrip('#').strip())
        out.append(bloque(cid, f'`{cid}` · {head}', ['', body],
                          extra_locs=[f'{B05}:104'] if cid == 'LOCK:C1' else ()))

    # M and RP
    B20 = Bp + 'docs/20-testing.md'
    t = 'El proveedor falso: mentiras medidas y reglas propias (`B/20` §3.2)'
    idsM, idsRP = ids_de('M:'), ids_de('RP:')
    out += [f'## {t}', ''] + notas_de(idsM + idsRP, t)
    out += ['', '## Mentiras medidas, M1–M13 (`B/20` §3.2)', '']
    for cid in idsM:
        out.append(item_row(cid, f'`{cid}` · `{BYID[cid]["local"]}`'))
    out += ['', '## Reglas propias y comportamiento medido, RP1–RP12 (`B/20` §3.2)', '']
    for cid in idsRP:
        out.append(item_row(cid, f'`{cid}` · `{BYID[cid]["local"]}`'))

    # GUARDS
    V20 = Vp + 'docs/20-testing.md'
    t = 'Guards (`V/20` §2 y `B/20` §2)'
    gids = ids_de('GUARD:') + ids_de('VAL:')
    occ = collections.defaultdict(list)
    for f in (V20, B20):
        L = lines(f)
        h, hl = header_of(f, [BYID[g]['linea'] for g in gids if BYID[g]['archivo'] == f][0])
        n = hl + 2
        while n <= len(L) and L[n - 1].startswith('|'):
            c0 = split_row(L[n - 1])[0]
            if not c0.startswith('~~'):
                k = re.sub(r'[*`✚\s]|\(.*\)', '', c0)
                occ[k].append((f, n))
            n += 1
    out += [f'## {t}', '',
            sec_note(V20, 27, 'Dónde corren los guards (`V/20` §1)')]
    gv = sorted([g for g in gids if BYID[g]['archivo'] == V20], key=lambda g: BYID[g]['linea'])
    gb = sorted([g for g in gids if BYID[g]['archivo'] == B20], key=lambda g: BYID[g]['linea'])
    out += notas_de(gv, 'Guards de `V/20` §2') + notas_de(gb, 'Guards de `B/20` §2')
    out += ['', '## Guards — los treinta y cinco, y las dos validaciones del panel', '']
    for cid in gv + gb:
        i = BYID[cid]
        f = i['archivo']
        pre, extra = [], []
        if cid.startswith('GUARD:'):
            if cid == 'GUARD:G13':
                # first blind-verification round (H-VB-B3-1): G13 fails on a build bound for
                # production, not on the branch; its own row (the item's Origen line) says so
                pre.append(f'- **Dónde corre**: en CI, **sobre un build destinado a producción, no sobre la rama**: '
                           f'calla hasta que un build apunte a producción (`{corto(f)}` §2, fila `G13`).')
            else:
                pre.append(f'- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `{corto(f)}` §1: '
                           'qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.')
            pre.append(f'- **Test mínimo** ({own("AN")}): guard estático con su prueba de mutación (romperlo a '
                       f'propósito y ver que falla, `{corto(f)}` §2.1), en la pieza dueña.')
            extra.append(f'{f}:32')
        else:
            pre.append(f'- **Qué es**: una validación del panel que conserva nombre de guard; no corre en CI ni se '
                       f'cuenta entre los guards ({own("AZ")}). **Test mínimo**: ≥1 de cualquier tipo de la lista '
                       'cerrada, en la pieza dueña.')
        post = []
        for (f2, n2) in occ.get(i['local'], []):
            if (f2, n2) == (f, i['linea']):
                continue
            h2, c2 = row_cells(f2, n2)
            post.append(f'- **También en `{corto(f2)}` §2** (línea {n2}), con este texto:')
            post += ['  ' + x for x in campos(h2, c2)]
            extra.append(f'{f2}:{n2}')
        out.append(item_row(cid, f'`{cid}` · `{i["local"]}`', pre=pre, post=post, extra_locs=extra))

    # MATRIZ
    MAT = Dp + '06-mp-validation-matrix.md'
    ids = ids_de('MP:')
    t = 'Matriz de validación de Mercado Pago (`D/06`)'
    B06 = Bp + 'docs/06-proveedor.md'
    LM = lines(MAT)
    # first blind-verification round (H-VA-A8-r2-1, H-VA-A8-pista-9): rules 4 and 6 and the four
    # states of the matrix, verbatim, with B/06 §8 rule 2 for when a verified row expires
    for n, frag in ((122, 'Cada fila lleva'), (128, 'Un `PARTIALLY_SUPPORTED`'), (135, '`VERIFIED`'),
                    (136, '`NOT_SUPPORTED`'), (137, '`PARTIALLY_SUPPORTED`'), (138, '`UNKNOWN`')):
        assert frag in LM[n - 1], (MAT, n, frag)
    assert 'Una fila caduca cuando cambia lo que la sostiene' in lines(B06)[377], (B06, 378)
    out += [f'## {t}', '',
            f'Las filas de la matriz son **sólo citables** ({own("AX")}): no exigen AC propio; las citan los '
            'ítems y las piezas que se apoyan en ellas. Cada fila va con todas sus columnas.', '',
            '**Cómo se lee una fila** (`D/06` §Reglas, 4 y 6): cada fila lleva **fecha y entorno**, y una '
            'fila sin fecha se lee como `UNKNOWN` (`S-MP-02`); un `PARTIALLY_SUPPORTED` **tiene que nombrar '
            'qué parte**. Cuándo caduca una fila verificada: [B1](10-corte/B1.md#pieza-b1) (`B/06` §8, que '
            'cierra `S-MP-02`).', '',
            '**Estados** (`D/06` §Estados, §61): `VERIFIED`, se ejecutó y funciona como lo necesitamos, con '
            'evidencia; `NOT_SUPPORTED`, se ejecutó y el proveedor no lo permite, con evidencia; '
            '`PARTIALLY_SUPPORTED`, funciona con una restricción **nombrada**; `UNKNOWN`, no se probó, o la '
            'fila caducó —por un cambio en lo que la sostiene, no por antigüedad (`B/06` §8, regla 2: '
            '*«una fila caduca cuando cambia lo que la sostiene, no por antigüedad»*)—.', '',
            f'Origen: {MAT}:122, {MAT}:128, {MAT}:131, {MAT}:135, {MAT}:136, {MAT}:137, {MAT}:138, {B06}:378', '',
            ]
    L = lines(MAT)
    heads = [n for n in range(1, len(L) + 1) if re.match(r'^## ', L[n - 1])]
    def h_of(n):
        a = max(x for x in heads if x <= n)
        b = min([x for x in heads if x > a] + [len(L) + 1]) - 1
        return a, b
    grupos = collections.OrderedDict()
    for cid in ids:
        grupos.setdefault(h_of(BYID[cid]['linea']), []).append(cid)
    filas = {BYID[c]['linea'] for c in ids}
    for (a, b), cids in grupos.items():
        head = limpiar(L[a - 1].lstrip('#').strip())
        out += [f'## Matriz · {head}', '']
        out.append(nota(MAT, a, b, f'Matriz · {head} — texto de la fuente', filas))
        out += ['', f'## Matriz · {head} — las filas', '']
        for cid in cids:
            i = BYID[cid]
            h, c = row_cells(MAT, i['linea'])
            d = dict(zip(h, c))
            comp = corto_celda(d.get('Comportamiento', ''), 120)
            out.append(item_row(cid, f'`{cid}`' + (f' · {comp}' if comp else '')))

    txt = '\n'.join(out)
    txt = re.sub(r'\n{3,}', '\n\n', txt).rstrip() + '\n'
    # two quotes separated only by a blank line are one broken quote for markdownlint (MD028): the
    # matrix's orphan-row warning follows another quote, so a line of the catalog goes between them
    txt, k = re.subn(r'(\n>[^\n]*\n)\n(> ⚠️ \*\*Fila huérfana)',
                     r'\1\nNota del catálogo sobre la fila siguiente:\n\n\2', txt)
    assert k == 1, f'orphan-row quote found {k} times'
    open(destino_de_salida('04-catalogos.md'), 'w', encoding='utf-8').write(txt)
    for a in AVISOS:
        print('AVISO', a)
    print('ítems', len(MINE), 'bytes', len(txt.encode()), 'líneas', txt.count('\n'))


if __name__ == '__main__':
    main()
