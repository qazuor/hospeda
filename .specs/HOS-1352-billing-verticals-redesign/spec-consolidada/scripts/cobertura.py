#!/usr/bin/env python3
"""Coverage map of the consolidated spec (DEC-METH-019 points 3, 8-10; owner AL, AN, AX, AZ): for
every live NORMATIVE item, the ONE piece that owns its acceptance criteria, the citation that says
why that piece implements it, the other pieces that also exercise it, and the minimum test types.

    python3 cobertura.py <inventario.json> <adjudicacion.json> <cobertura-lectura.json> <salida.json>
           [--sellar]            write the sha256 of every cited line into the lectura file
           [--fragmento]         validate the lectura file alone (partial: no completeness rule)
           [--candidatos ID]     print the partition lines that name ID together with a piece
           [--lista-solo-citables=<json>]  replace defs.SOLO_CITABLES (for the canaries only)

Two methods. `script`: derived from a table that maps the item to its piece (the piece's own row,
the guards column, B §2.12, the schema table and the phases of D/16 §4.6-§4.7, the dependency
table of B §2.6, the addon-instance machine of the inventory). `lectura`: adjudicated by reading,
from a versioned file whose every citation carries the sha256 of its line at the frozen SHA.

RULES (exit 1 when any fails)
  C1  every live normative item has an owner piece (a lectura entry in `sin_pieza` still fails: it
      is a question for the owner, not an answer).
  C2  the owner piece and every `tambien` piece exist (or the owner is the pseudo-piece CORTE, BE).
  C3  timing: an item the sources put at the cut is owned by a cut piece (or CORTE), an
      item they put later by a later piece, and a phase gate by a piece of that phase.
  C4  one citation is the item itself (inside its own block) or names its local id; one citation
      names the owner piece and lives in the partition (V/B descomposicion, D/16) or is the item.
  C5  every citation is verbatim in its line at the SHA, and its stored hash is that line's hash.
  C6  a `tambien` piece with role `implementa` is not an ancestor of the owner in the graph of
      41-corte-del-mvp/aristas.py, nor a cut piece when the owner is a later one (the owner is the
      one that implements it first).
  C7  an item is derived once: never by script and by lectura, never a dead or citable-only item.
  C8  the closed list of citable-only items (defs.SOLO_CITABLES, owner BA and BB) is valid: every id
      in the inventory, named by its owner row, row hash unchanged. Those items need no owner.
"""
import collections
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import B, D, SHA, V, cells, line_hash, lines, section, table_after, unstrike  # noqa: E402
from defs import (MUERTOS, NORMATIVAS, NO_NORMATIVAS_PREFIJOS, SOLO_CITABLES, TIPOS_TEST, VIVOS,  # noqa: E402
                  solo_citables_fallas)

D16 = D + '16-fase-7-del-paraguas.md'
VD, BD = V + 'descomposicion.md', B + 'descomposicion.md'
ARISTAS = D + '41-corte-del-mvp/aristas.py'
CORTE = 'CORTE'  # the pseudo-piece of owner BE: what only the cut does; its AC live in 30-el-corte.md
ROLES = ('implementa', 'usa', 'provee', 'lee')
PARTICION = (VD, BD, D16)
CUALQUIERA = '≥1 de cualquier tipo de la lista cerrada'


# --- the frozen graph and the timing the sources declare ------------------------------------------
def grafo():
    """Edges (a, b) = «b depends on a», transcribed in aristas.py at the SHA (INTRA + CRUZADAS)."""
    txt = '\n'.join(lines(ARISTAS))
    edges = set()
    for name in ('CRUZADAS', 'INTRA'):
        blk = re.search(name + r' = \[(.*?)\n\]', txt, re.S).group(1)
        edges |= set(re.findall(r"\('(\w+)', '(\w+)'", blk))
    anc = collections.defaultdict(set)
    changed = True
    for a, b in edges:
        anc[b].add(a)
    while changed:
        changed = False
        for b in list(anc):
            new = set().union(*(anc[a] for a in anc[b])) - anc[b]
            if new:
                anc[b] |= new
                changed = True
    return anc


TOKEN = re.compile(r'`((?:PB|PP|MP|RF|[STPA])\d+[a-z]?|G-R\d+(?:-[A-F])?|G\d+)`')


def cuando_de_fuente():
    """{token: (cuando, 'file:line')} from the timing tables: D/16 §4.6 pieces (column «fuente»),
    B §2.12 and V §2.14 (column «de dónde sale»), read only BEFORE the word «salvo» (what follows
    «salvo» in a later row is what goes to the cut)."""
    out, conflict = {}, set()

    def put(tok, cuando, where):
        if tok in out and out[tok][0] != cuando:
            conflict.add(tok)
        out.setdefault(tok, (cuando, where))

    for n, c in table_after(D16, section(D16, r'^### 4\.6 '), r'^\| pieza \| unidad \| cuándo \|'):
        for t in TOKEN.findall(unstrike(c[3]).split('salvo')[0]):
            put(t, c[2].strip(), f'{D16}:{n}')
    for path, rx in ((BD, r'^### 2\.12 '), (VD, r'^### 2\.14 ')):
        for n, c in table_after(path, section(path, rx), r'^\| pieza \| cuándo \| de dónde sale \|'):
            cuando = 'corte' if 'corte' in c[1] else 'después'
            for t in TOKEN.findall(unstrike(c[2]).split('salvo')[0]):
                put(t, cuando, f'{path}:{n}')
    for t in conflict:
        out.pop(t)
    return out


# --- references ---------------------------------------------------------------------------------
def sin_tachar(t):
    """The live text of a line: struck spans out, italic asides kept (they are live notes)."""
    return re.sub(r'~~.*?~~', '', t)


def rx_id(s):
    return r'(?<![\w-])' + re.escape(s) + r'(?![\w])'


def ref(i):
    """Regex of a mention of item ``i`` in a foreign line (None: only its own block counts)."""
    f, loc = i['fuente'], i['local']
    if f == 'DEC':
        return re.escape(loc)
    if f == 'PIN':  # the log never numbers its 📌 outside the decision: a pin is named by its DEC
        return re.escape(i['dec'])
    if f in ('FILA', 'LISTA', 'PIEZA', 'TRANS', 'TPZ', 'APZ', 'LOCK', 'RP', 'M', 'GUARD', 'VAL'):
        return r'(?<![\w-])' + re.escape(loc) + r'(?![\w-])'
    if f == 'INV':
        return (r'invariantes?\b[^|]{0,40}?' + rx_id(loc)) + (r'|`' + loc + '`' if loc.startswith('D') else '')
    if f == 'ACC':
        return r'acci[oó]n(?:es)?(?: administrativas?)?[^|]{0,30}?(?<![\w-])' + loc + r'(?!\d)'
    if f == 'MOT':
        return re.escape(i.get('nombre', '\x00')) + r'|motivos? (?:\d+, )*(?:\d+ y )?' + loc + r'(?!\d)'
    if f == 'PLAZO':
        return r'plazos? (?:\d+, )*(?:\d+ y )?' + loc + r'(?!\d)'
    if f == 'PASO':
        return r'pasos? (?:[0-9][a-z]?, )*(?:[0-9][a-z]? y )?' + re.escape(loc) + r'(?![\w])'
    if f == 'GATE' and re.fullmatch(r'M\d', loc):
        return r'[Mm]omento ' + loc[1]
    return None


def bloque(i):
    """(first, last) lines of the item's own block at the SHA."""
    L = lines(i['archivo'])
    a = i['linea']
    if i.get('fin'):
        return a, i['fin']
    t = L[a - 1]
    m = re.match(r'^(#+) ', t)
    if m:
        for j in range(a, len(L)):
            m2 = re.match(r'^(#+) ', L[j])
            if m2 and len(m2.group(1)) <= len(m.group(1)):
                return a, j
        return a, len(L)
    if t.startswith('|'):
        return a, a
    b = a
    while b < len(L) and L[b].strip() and re.match(r'^\s+\S', L[b]) and not re.match(r'^\s*(?:[-*]|\d+\.)\s', L[b]):
        b += 1
    return a, b


def rx_pieza(p):
    return r'(?<![\w-])' + re.escape(p) + r'(?![\w])'


def en_particion(path, n):
    if path in (VD, BD):
        return True
    if path == D16:
        return any(a <= n <= b for a, b in (section(D16, r'^### 4\.2 '), section(D16, r'^### 4\.6 '),
                                           section(D16, r'^### 4\.7 ')))
    return False


# --- script derivations -------------------------------------------------------------------------
def cita(path, n, frag=None):
    t = lines(path)[n - 1]
    frag = frag or t.strip()[:160]
    return dict(archivo=path, linea=n, cita=frag, hash=line_hash(path, n))


def frag_con(path, n, *tokens):
    """A short verbatim span of line n around the first token found, in the order given."""
    t = lines(path)[n - 1]
    for tok in tokens:
        m = re.search(tok, sin_tachar(t))
        if m:
            w = re.search(re.escape(m.group(0)), t)
            if w:
                return t[max(0, w.start() - 60):w.end() + 60]
    return t.strip()[:160]


def por_script(items, todos, piezas, anc):
    """Script owners of the normative ``items``; ``todos`` is the whole inventory (tables live there)."""
    out, pend = {}, []
    tpz = {i['local']: i for i in todos if i['fuente'] == 'TPZ'}
    apz = {i['local']: i for i in todos if i['fuente'] == 'APZ'}

    def primero(ps):
        """Owner = the piece no other listed piece precedes in the graph; corte before later."""
        ps = sorted(ps, key=lambda p: (piezas[p]['cuando'] != 'corte', len(anc[p]), p))
        return ps[0], ps[1:]

    for i in items:
        f, loc = i['fuente'], i['local']
        rec = None
        if f in ('FILA', 'LISTA'):
            if loc in piezas:
                rec = dict(pieza=loc, citas=[cita(i['archivo'], i['linea'], frag_con(i['archivo'], i['linea'], rx_pieza(loc)))],
                           razon=f'la fila de la pieza {loc}', tambien=[])
            else:  # origin row of a split unit: the half a implements it first (aristas: a -> b)
                a, b = loc + 'a', loc + 'b'
                rec = dict(pieza=a, citas=[cita(i['archivo'], i['linea'], frag_con(i['archivo'], i['linea'], rx_pieza(a), rx_pieza(b)))],
                           razon=f'fila de origen de {a} y {b} (Z): la mitad a va al corte y precede a la b',
                           tambien=[dict(pieza=b, rol='implementa', citas=[cita(i['archivo'], i['linea'], frag_con(i['archivo'], i['linea'], rx_pieza(b)))])])
        elif f == 'GUARD':
            p, ln = i['fila_pieza'].rsplit(':', 1)
            rec = dict(pieza=i['pieza'], citas=[cita(p, int(ln), frag_con(p, int(ln), rx_pieza(i['pieza']), ref(i)))],
                       razon='columna «guards» de la fila de la pieza', tambien=[])
        elif f in ('TPZ', 'TRANS') and (f == 'TPZ' or (i['id'].startswith('TRANS:B:S') and loc in tpz)):
            t = tpz[loc] if f == 'TRANS' else i
            own, rest = primero(t['piezas'])
            mk = lambda p: cita(t['archivo'], t['linea'], frag_con(t['archivo'], t['linea'], ref(t), rx_pieza(p)))  # noqa: E731
            rec = dict(pieza=own, citas=[mk(own)], razon='B §2.12, la transición pieza por pieza',
                       tambien=[dict(pieza=p, rol='implementa', citas=[mk(p)]) for p in rest])
        elif f in ('APZ', 'TRANS') and (f == 'APZ' or (i['id'].startswith('TRANS:B:A') and loc in apz)):
            a = apz[loc] if f == 'TRANS' else i
            p = a['pieza']
            src, n = a['fuente_pieza'].rsplit(':', 1)
            cands = [(src, int(n))] + [(r['archivo'], r['linea']) for r in todos if r['fuente'] == 'FILA' and r['local'] == p]
            hit = next(((path, n) for path, n in cands if re.search(rx_pieza(p), lines(path)[n - 1])
                        and re.search(ref(a), sin_tachar(lines(path)[n - 1]))), None)
            if hit:
                rec = dict(pieza=p, citas=[cita(hit[0], hit[1], frag_con(hit[0], hit[1], ref(a), rx_pieza(p)))],
                           razon='la instancia de addon -> pieza (D/16 §4.6, AV), o la fila de la pieza que la nombra', tambien=[])
            else:
                pend.append(i['id'])
        elif f == 'ESQ':
            rec = dict(pieza=i['crea'], citas=[cita(i['archivo'], i['linea'], frag_con(i['archivo'], i['linea'], rx_pieza(i['crea'])))],
                       razon='D/16 §4.6, «esquema | de | lo crea»: lo crea la pieza del corte (AP)',
                       tambien=[dict(pieza=i['de'], rol='usa', citas=[cita(i['archivo'], i['linea'], frag_con(i['archivo'], i['linea'], rx_pieza(i['de'])))])])
        elif f == 'VAL':
            # the panel validation keeps the guard name; the piece row names it (struck as a guard)
            hits = [r for r in todos if r['fuente'] == 'FILA' and r['local'] in piezas
                    and re.search(ref(i), lines(r['archivo'])[r['linea'] - 1])]
            if len(hits) == 1:
                r = hits[0]
                rec = dict(pieza=r['local'], citas=[cita(i['archivo'], i['linea'], frag_con(i['archivo'], i['linea'], ref(i))),
                                                    cita(r['archivo'], r['linea'], frag_con(r['archivo'], r['linea'], rx_pieza(r['local'])))],
                           razon='la fila de la pieza nombra la validación que construye (tachada como guard, viva como validación)',
                           tambien=[])
            else:
                pend.append(i['id'])
        elif f == 'DEP':
            c = cells(lines(i['archivo'])[i['linea'] - 1])
            lee = [p for p in re.findall(r'\*\*([UVB]\d+[ab]?)\*\*', unstrike(c[1])) if p in piezas]
            contra = [p for p in re.findall(r'\*\*([UVB]\d+[ab]?)\*\*', unstrike(c[-1])) if p in piezas]
            if lee:
                own, rest = primero(lee)
                mk = lambda p: cita(i['archivo'], i['linea'], frag_con(i['archivo'], i['linea'], r'\*\*' + p + r'\*\*'))  # noqa: E731
                rec = dict(pieza=own, citas=[mk(own)], razon='B §2.6: la pieza que lee la dirección inversa',
                           tambien=[dict(pieza=p, rol='implementa', citas=[mk(p)]) for p in rest]
                           + [dict(pieza=p, rol='provee', citas=[mk(p)]) for p in contra if p not in lee])
            else:
                pend.append(i['id'])
        if rec:
            rec['metodo'] = 'script'
            out[i['id']] = rec
    return out, pend


# --- minimum test types (AN) --------------------------------------------------------------------
SMOKE_RX = re.compile(r'\bsmoke\b|checklist de smoke|\bensayo\b|\b5c\b')
MIG_RX = re.compile(r'migraci[oó]n (?:estructural|de datos)|\btablas?\b|\bcolumnas?\b|`UNIQUE`|`CHECK`|\benums?\b|\besquema\b')
DATOS_RX = re.compile(r'migraci[oó]n de datos|sobre datos|preexistente|filas? (?:vivas|existentes|de producción)|`partners`')


def tipos(i, rec):
    """AN, per family, plus what the item's own text asks for (marked as derived from text)."""
    f = i['fuente']
    base = {'TRANS': ['integración con DB'], 'TPZ': ['integración con DB'], 'APZ': ['integración con DB'],
            'PROH': ['integración con DB'], 'GUARD': ['guard estático'], 'ESQ': ['migración desde cero']}
    ts, por_que = list(base.get(f, [CUALQUIERA])), []
    a, b = bloque(i)
    txt = unstrike(' '.join(lines(i['archivo'])[a - 1:b]))
    if f in ('FILA', 'LISTA', 'ESQ', 'DEC', 'PIN', 'PASO') and MIG_RX.search(txt):
        if 'migración desde cero' not in ts:
            ts.append('migración desde cero')
        por_que.append(f'esquema: «{MIG_RX.search(txt).group(0)}»')
        if DATOS_RX.search(txt):
            ts.append('migración sobre datos')
            por_que.append(f'datos: «{DATOS_RX.search(txt).group(0)}»')
    if SMOKE_RX.search(txt):
        et = 'prod' if re.search(r'\b5c\b|producción', txt) else 'staging'
        ts.append(f'smoke manual · {et}')
        por_que.append(f'smoke: «{SMOKE_RX.search(txt).group(0)}»')
    for t in rec.get('tipos') or []:
        if t not in ts:
            ts.append(t)
    if len(ts) > 1 and CUALQUIERA in ts:
        ts.remove(CUALQUIERA)
    return ts, por_que


# --- validation ---------------------------------------------------------------------------------
def estados(items, adj):
    """Live/dead per item, with the adjudicated verdicts (same reading as trazar.py R1-R3)."""
    out = {}
    for i in items:
        st, v = i['estado'], adj.get(i['id'])
        if v:
            st = 'MUERTO' if v.get('veredicto') == 'MUERTO' else 'VIVO'
        out[i['id']] = st
    return out


def normativo(i, st, lista):
    """Requires ≥1 AC: AX + AZ, minus methodology decisions and the closed list of BA and BB."""
    return (i['fuente'] in NORMATIVAS and not i['id'].startswith(NO_NORMATIVAS_PREFIJOS)
            and i['id'] not in lista and st.get(i['id']) in VIVOS)


def fuente_cuando(i, piezas, cf):
    """(expected timing, why) the sources declare for item ``i``, or (None, None)."""
    f, loc = i['fuente'], i['local']
    if f == 'GUARD':
        return i['cuando'], 'la pieza del guard (D/16 §4.6, AA y Z)'
    if f == 'ESQ':
        return 'corte', 'D/16 §4.6: lo crea una pieza del corte (AP)'
    if f == 'PASO':
        return 'corte', 'D/16 §4.2: un paso del corte'
    if f == 'GATE':
        m = re.match(r'FP\.F(\d)$', loc)
        if m:
            return f'fase-{m.group(1)}', 'D/16 §4.7, «Las fases posteriores» (AW)'
        return ('después', 'D/16 §4.7 (AT)') if i['id'].startswith('GATE:FP') else ('corte', 'D/16 §4.7, momentos 1 a 5')
    if f in ('TRANS', 'TPZ', 'APZ', 'VAL') and loc in cf:
        return cf[loc]
    return None, None


def check_cita(c, err, k):
    path, n, frag = c.get('archivo'), c.get('linea'), c.get('cita')
    try:
        L = lines(path)
    except SystemExit:
        err['C5 cita en un archivo que no existe en el SHA'].append(f'{k}: {path}')
        return None
    if not isinstance(n, int) or not 1 <= n <= len(L):
        err['C5 cita fuera del archivo'].append(f'{k}: {path}:{n}')
        return None
    if not frag or frag not in L[n - 1]:
        err['C5 cita que no está en su línea'].append(f'{k}: {path}:{n}')
        return None
    if c.get('hash') is None:
        err['C5 cita sin sellar (correr --sellar)'].append(f'{k}: {path}:{n}')
    elif c['hash'] != line_hash(path, n):
        err['C5 hash de la cita distinto al de su línea en el SHA'].append(f'{k}: {path}:{n}')
    return sin_tachar(L[n - 1])


def nombra_pieza(c, texto, p, own_block, i):
    if texto is None:
        return False
    propio = c['archivo'] == i['archivo'] and own_block[0] <= c['linea'] <= own_block[1]
    if p == CORTE:
        return propio and i['archivo'] == D16 or (c['archivo'] == D16 and en_particion(D16, c['linea'])
                                                   and 'corte' in texto)
    return bool(re.search(rx_pieza(p), texto)) and (propio or en_particion(c['archivo'], c['linea']))


def validar(rec, items_by, piezas, anc, cf, err):
    for k, r in rec.items():
        i = items_by[k]
        own = r.get('pieza')
        if own != CORTE and own not in piezas:
            err['C2 pieza inexistente'].append(f'{k}: {own}')
            continue
        blk = bloque(i)
        rx = ref(i)
        tx = [(c, check_cita(c, err, k)) for c in r.get('citas', [])]
        if not any(t is not None and ((c['archivo'] == i['archivo'] and blk[0] <= c['linea'] <= blk[1])
                                      or (rx and re.search(rx, t))) for c, t in tx):
            err['C4 ninguna cita es el ítem ni nombra su id local'].append(k)
        if not any(nombra_pieza(c, t, own, blk, i) for c, t in tx):
            err['C4 ninguna cita de la partición nombra la pieza dueña'].append(f'{k}: {own}')
        vistos = {own}
        for t in r.get('tambien', []):
            p = t.get('pieza')
            if p not in piezas or p in vistos:
                err['C2 pieza de «tambien» inexistente o repetida'].append(f'{k}: {p}')
                continue
            vistos.add(p)
            if t.get('rol') not in ROLES:
                err['C2 rol fuera de la lista'].append(f'{k}: {p} {t.get("rol")}')
            ttx = [(c, check_cita(c, err, k)) for c in t.get('citas', [])]
            if not any(nombra_pieza(c, x, p, blk, i) for c, x in ttx):
                err['C4 «tambien» sin cita de la partición que nombre su pieza'].append(f'{k}: {p}')
            if t.get('rol') == 'implementa' and own != CORTE and p in anc[own]:
                err['C6 la dueña no es la primera del grafo (un «tambien» la precede)'].append(f'{k}: {p} -> {own}')
            if (t.get('rol') == 'implementa' and own in piezas and piezas[own]['cuando'] == 'después'
                    and piezas[p]['cuando'] == 'corte'):
                err['C6 la dueña es posterior y un «tambien» del corte también lo implementa'].append(f'{k}: {p} -> {own}')
        esperado, por_que = fuente_cuando(i, piezas, cf)
        if esperado:
            if own == CORTE:
                ok = i['fuente'] in ('PASO', 'GATE')
            elif esperado.startswith('fase-'):
                ok = piezas[own]['cuando'] == 'después' and piezas[own].get('fase') == int(esperado[5:])
            else:
                ok = piezas[own]['cuando'] == esperado
            if not ok:
                err['C3 la pieza no está en el momento que fija la fuente'].append(
                    f"{k}: {own} ({piezas[own]['cuando'] if own in piezas else CORTE}) vs {esperado} ({por_que})")


def sellar(lect):
    n = 0
    for e in list(lect.get('entradas', {}).values()):
        for c in e.get('citas', []) + [x for t in e.get('tambien', []) for x in t.get('citas', [])]:
            try:
                L = lines(c['archivo'])
            except SystemExit:
                continue
            if 1 <= c.get('linea', 0) <= len(L) and c.get('cita') and c['cita'] in L[c['linea'] - 1]:
                h = line_hash(c['archivo'], c['linea'])
                n += c.get('hash') != h
                c['hash'] = h
    return n


def candidatos(cid, items_by, piezas):
    i = items_by[cid]
    a, b = bloque(i)
    print(f'{cid} · {i["archivo"]}:{a}-{b}')
    rx = ref(i)
    if not rx:
        print('  (sin forma de mención fuera de su bloque)')
        return
    for path in PARTICION:
        for n, l in enumerate(lines(path), 1):
            t = sin_tachar(l)
            if re.search(rx, t) and en_particion(path, n):
                ps = sorted(p for p in piezas if re.search(rx_pieza(p), t))
                if ps:
                    print(f'  {path}:{n} · {" ".join(ps)} · {l.strip()[:110]}')


def main(argv):
    flags = {a for a in argv if a.startswith('--')}
    args = [a for a in argv if not a.startswith('--')]
    lst = next((a.split('=', 1)[1] for a in flags if a.startswith('--lista-solo-citables=')), None)
    lista = ({k: tuple(v) for k, v in json.load(open(lst, encoding='utf-8')).items()} if lst else SOLO_CITABLES)
    if '--candidatos' in flags:
        cid = args.pop()
    if len(args) != 4:
        sys.exit(__doc__)
    inv_p, adj_p, lect_p, out_p = args
    todos = json.load(open(inv_p, encoding='utf-8'))['items']
    adj = json.load(open(adj_p, encoding='utf-8'))['veredictos']
    st = estados(todos, adj)
    by = {i['id']: i for i in todos}
    piezas = {i['local']: dict(cuando=i['cuando'], fase=i.get('fase'), unidad=i['unidad'])
              for i in todos if i['fuente'] == 'PIEZA'}
    if '--candidatos' in flags:
        return candidatos(cid, by, piezas) or 0
    anc, cf = grafo(), cuando_de_fuente()
    norm = [i for i in todos if normativo(i, st, lista)]
    norm_ids = {i['id'] for i in norm}
    script, pend = por_script(norm, todos, piezas, anc)
    lect = json.load(open(lect_p, encoding='utf-8')) if os.path.exists(lect_p) else {}
    entradas, sin = lect.get('entradas', {}), lect.get('sin_pieza', {})
    if '--sellar' in flags:
        n = sellar(lect)
        json.dump(lect, open(lect_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print(f'sellado: {n} hashes nuevos o cambiados en {lect_p}')
    err = collections.defaultdict(list)
    for k in list(entradas) + list(sin):
        if k not in by:
            err['C7 entrada de un ítem que no existe'].append(k)
        elif k not in norm_ids:
            err['C7 entrada de un ítem muerto o sólo citable'].append(k)
        elif k in script:
            err['C7 ítem derivado dos veces (script y lectura)'].append(k)
        elif k in entradas and k in sin:
            err['C7 ítem con pieza y en «sin_pieza»'].append(k)
    for f in solo_citables_fallas(by, lista):
        err['C8 lista cerrada de sólo citables inválida'].append(f)
    rec = dict(script)
    for k, e in entradas.items():
        if k in norm_ids and k not in script:
            rec[k] = dict(e, metodo='lectura', tambien=e.get('tambien', []))
    if '--fragmento' not in flags:
        for i in norm:
            if i['id'] not in rec:
                key = 'C1 sin pieza: pregunta al owner' if i['id'] in sin else 'C1 sin pieza ni pregunta'
                err[key].append(i['id'])
    validar(rec, by, piezas, anc, cf, err)
    for k, e in sin.items():
        falta_pregunta = not e.get('pregunta') and ('--fragmento' not in flags or not e.get('causa'))
        if not e.get('motivo') or falta_pregunta:
            err['C1 «sin_pieza» sin motivo o sin pregunta'].append(k)
    items_out, cuenta = {}, collections.defaultdict(collections.Counter)
    for k in sorted(rec, key=lambda x: (by[x]['fuente'], x)):
        r, i = rec[k], by[k]
        ts, por_que = tipos(i, r)
        items_out[k] = dict(fuente=i['fuente'], pieza=r['pieza'], metodo=r['metodo'],
                            fuente_de_la_asignacion=r['citas'], razon=r.get('razon'),
                            tambien_lo_ejercen=r.get('tambien', []), tipos_de_test_minimos=ts,
                            tipos_derivados_del_texto=por_que)
        cuenta[r['pieza']][r['metodo']] += 1
        for t in r.get('tambien', []):
            cuenta[t['pieza']]['tambien'] += 1
    orden = list(piezas) + [CORTE]
    resumen = {p: dict(script=cuenta[p]['script'], lectura=cuenta[p]['lectura'],
                       dueña=cuenta[p]['script'] + cuenta[p]['lectura'], tambien=cuenta[p]['tambien'],
                       cuando=piezas[p]['cuando'] if p in piezas else '—') for p in orden}
    total = sum(len(v) for v in err.values())
    if '--fragmento' not in flags:
        doc = dict(sha=SHA, criterio=__doc__.split('RULES')[1].strip(), normativos=len(norm),
                   por_metodo=dict(collections.Counter(r['metodo'] for r in rec.values())),
                   por_pieza=resumen, sin_pieza=sin, preguntas=lect.get('preguntas', {}),
                   solo_citables={k: dict(letra=v[0], cita=v[1], destino='03-contrato-de-cobertura.md')
                                  for k, v in sorted(lista.items())},
                   script_pendiente_de_lectura=pend, fallas={k: v for k, v in sorted(err.items())}, items=items_out)
        json.dump(doc, open(out_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print(f'SHA {SHA[:10]} · {len(norm)} normativos · {len(rec)} con pieza · {doc["por_metodo"]} · sin pieza {len(sin)}')
        for p in orden:
            x = resumen[p]
            print(f'  {p:12} {x["cuando"]:8} dueña {x["dueña"]:4} (script {x["script"]:3}, lectura {x["lectura"]:3}) · también {x["tambien"]}')
    for k in sorted(err):
        print(f'✗ {k}: {len(err[k])}  ej: {err[k][:4]}')
    print('RESULTADO:', 'APROBADO (0)' if total == 0 else f'RECHAZADO ({total})')
    return 0 if total == 0 else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
