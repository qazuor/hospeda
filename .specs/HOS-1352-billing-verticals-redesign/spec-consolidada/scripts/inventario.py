#!/usr/bin/env python3
"""Closed inventory of HOS-1352 for the consolidated spec (DEC-METH-019 point 1).

Reads every source at the frozen SHA (comun.SHA) and emits one item per traceable unit:
    {fuente, id, local, archivo, linea, hash, estado, ...extra}
``id`` is canonical and carries its source prefix; ``hash`` is the sha256 of the source line.

Sources, by name (the 18 of the method, then the ones the cut added, then the net):
   1 DEC     decisions of the log                       ### DEC-*-NNN
   2 PIN     each 📌 inside a decision block              DEC-X#📌n
   3 MATRIZ  MP validation matrix rows                    MP:<id>
   4 PIEZA   the 30 pieces (D/16 §4.6, the single list)  PIEZA:<p>
     FILA    what each piece leaves working (V/B §2 rows, D/16 U-table; split units as origin)  FILA:<u>
   5 GUARD   guards, per piece column, defined in V/20, B/20 or D/16  GUARD:<g>
   6 DEP     cross-epic dependencies (B §2.6)             DEP:<n>     (+ arrows)
   7 LISTA   «lista cuando» exit criterion per piece      LISTA:<p>
   8 INV     invariants (nucleo/04 §2 and §3)             INV:<n>
   9 TRANS   transitions of the machines (V/03, B/03)     TRANS:<V|B>:<t>
  10 ACC     administrative actions (nucleo/08 §3)        ACC:<n>
  11 PLAZO   configurable terms (nucleo/02 §1.5)          PLAZO:<n>
  12 MOT     reasons of the mark (B/02 §2.5)              MOT:<n>
  13 LOCK    locks (B/05)                                 LOCK:<C>
  14 RP      real-provider rules (B/20)                   RP:<n>
  15 M       fake-provider lies (B/20)                    M:<n>
  16 L       translation table of the cut (V/21)          L:<n>
  17 PASO    steps of the cut (D/16 §4.2)                 PASO:<n>
  18 OWN     owner letters, per folder and table          OWN:<carpeta>:t<n>:<letra>
  -- added by the cut (owner 2026-10-01, AP-AV) --
  19 ESQ     schema of later pieces created at the cut (D/16 §4.6)   ESQ:<n>
  20 TPZ     Subscription transition -> piece (B §2.12)              TPZ:<S>
  21 GATE    acceptance gates (D/16 §4.7), and the later phases of AW   GATE:<slug>, GATE:FP.F<n>
  22 APZ     addon-instance transition -> piece (B/03 §8 + D/16 §4.6) APZ:<A>
  -- added by this inventory (inferred, see report) --
  23 PROH    transitions that do NOT exist (B/03 §3.3)    PROH:B:<n>
  24 VAL     panel validations that keep a guard name (V/20 §2)       VAL:<g>
  -- coverage net --
  25 SEC     every heading of the 38 design files         SEC:<archivo>:<linea>

    python3 inventario.py [--json OUT] [--check]

``--check`` exits 1 when a structural expectation of the cut does not hold (see ``checks``).
"""
import collections
import json
import re
import sys

from comun import (B, D, PIEZA_RX, SHA, V, cells, corpus_38, line_hash, lines, ls, row_state,
                   section, table_after, unstrike)

ITEMS = []
FAILS = []


def add(fuente, cid, local, path, n, estado, **extra):
    ITEMS.append(dict(fuente=fuente, id=cid, local=local, archivo=path, linea=n,
                      hash=line_hash(path, n), estado=estado, **extra))


# 1 · DEC and 2 · PIN ----------------------------------------------------------------------------
LOG = D + '01-decision-log.md'
L = lines(LOG)
PIN_TOP = re.compile(r'^-\s+(?:~~)?\**\s*📌')               # «- 📌 **Precisada…**» bullet
PIN_ANY = re.compile(r'^\s*(?:>\s*)?(?:[-*]\s+|\d+\.\s+)?(?:~~)?\**\s*📌|\*\*📌')
heads = [(i + 1, m.group(1)) for i, l in enumerate(L) if (m := re.match(r'^### (DEC-[A-Z]+-\d{3})\b', l))]
for k, (n, did) in enumerate(heads):
    end = heads[k + 1][0] - 1 if k + 1 < len(heads) else len(L)
    end = next((j for j in range(n, end) if L[j].startswith('## ')), end)  # «## Resumen» is no block
    blk = L[n - 1:end]
    # the Estado field may span several lines: up to the next «- **Field**» bullet
    e0 = next(j for j, l in enumerate(blk) if '**Estado**' in l)
    e1 = next((j for j in range(e0 + 1, len(blk)) if re.match(r'^- \*\*', blk[j])), len(blk))
    estado_txt = ' '.join(blk[e0:e1])
    estado_txt = estado_txt.split('**Estado**:', 1)[1].split('· **Decide**')[0]
    if re.search(r'SUPERSEDED EN PARTE|SUPERSEDED.*sólo', estado_txt):
        e = 'SUPERSEDED_PARCIAL'
    elif 'SUPERSEDED' in estado_txt:
        e = 'SUPERSEDED'
    else:
        e = 'ACCEPTED' if 'ACCEPTED' in estado_txt else 'OTRO'
    precisada = bool(re.search(r'precisad|recontad|enmendad|cerrad', estado_txt, re.I)) and 'SUPERSEDED' not in estado_txt
    # a wrapped reference («… el 📌 de `DEC-X`») is not a pin: 📌 + «de»/«del» without bold/bullet
    pins = [n + j for j, l in enumerate(blk) if PIN_ANY.search(l)
            and not re.match(r'^\s*📌 (?:de|del)\b', l)]
    add('DEC', did, did, LOG, n, e, precisada=precisada, pins=len(pins), fin=end)
    for j, pl in enumerate(pins, 1):
        t = L[pl - 1]
        struck = bool(re.match(r'^\s*(?:[-*]\s+|\d+\.\s+)?~~[^~]*📌', t))
        # a pin inside a decision that is SUPERSEDED as a whole goes with it to the retired annex
        add('PIN', f'{did}#📌{j}', f'📌{j}', LOG, pl, 'MUERTO' if struck or e == 'SUPERSEDED' else 'VIGENTE',
            dec=did, forma='bullet' if PIN_TOP.match(t) else 'prosa',
            motivo='DEC SUPERSEDED' if e == 'SUPERSEDED' else ('tachado' if struck else None))

# 3 · MATRIZ (same logic as docs/contar-filas-de-la-matriz.py) ----------------------------------
MAT = D + '06-mp-validation-matrix.md'
IDM = re.compile(r'^[*`\s]*((?:PA|FR|RN|GR|PS|CN|PC|UP|DW|CT|GT|WH|RC|RF|EX)-\d+)')
EST = sorted(('VERIFIED', 'PARTIALLY_SUPPORTED', 'NOT_SUPPORTED', 'UNKNOWN'), key=len, reverse=True)
for n, l in enumerate(lines(MAT), 1):
    if not l.lstrip().startswith('|'):
        continue
    c = [x.strip() for x in cells(l)]
    m = IDM.match(c[0])
    if not m:
        continue
    st = None
    for cell in c[1:]:
        st = next((e for e in EST if re.search(rf'\b{e}\b', re.sub(r'~~.*?~~', '', cell))), None)
        if st:
            break
    if st:
        add('MATRIZ', 'MP:' + m.group(1), m.group(1), MAT, n, st,
            no_se_mide='🚫 **No se mide, por decisión' in l)

# 4 · PIEZA: the single list is D/16 §4.6 (`| pieza | unidad | cuándo | fuente |`) ---------------
D16 = D + '16-fase-7-del-paraguas.md'
S46 = section(D16, r'^### 4\.6 ')
PIEZAS = {}
for n, c in table_after(D16, S46, r'^\| pieza \| unidad \| cuándo \|'):
    p = c[0].strip().strip('`')
    PIEZAS[p] = dict(unidad=c[1].strip().strip('`'), cuando=c[2].strip(), linea=n)
    add('PIEZA', f'PIEZA:{p}', p, D16, n, 'VIVO', unidad=PIEZAS[p]['unidad'], cuando=c[2].strip())


def guards_of(cell):
    return sorted(set(re.findall(r'`(G(?:-R\d+(?:-[A-F])?|\d+))`', unstrike(cell))))


# the row of each piece / unit, with its guards column (logic of 41-corte-del-mvp/contar.py)
ROWS = {}
for path in (V + 'descomposicion.md', B + 'descomposicion.md'):
    rng = section(path, r'^## 2\. ')
    hdr_line = next(l for l in lines(path)[rng[0] - 1:rng[1]] if l.startswith('| # | unidad'))
    ig = [h.strip() for h in cells(hdr_line)].index('guards')
    for n, c in table_after(path, rng, r'^\| # \| unidad \|'):
        m = re.match(r'\*\*(' + PIEZA_RX + r')\*\*', c[0].strip())
        if m:
            ROWS[m.group(1)] = dict(archivo=path, linea=n, guards=guards_of(c[ig]), estado=row_state(c))
UROWS = table_after(D16, S46, r'^\| unidad \| qué deja funcionando \| guards \|')
for n, c in UROWS:
    m = re.match(r'\*\*(' + PIEZA_RX + r')\*\*', c[0].strip())
    if m:
        # the «lista cuando» column is source 7 (LISTA); the row state reads columns 1-3
        ROWS[m.group(1)] = dict(archivo=D16, linea=n, guards=guards_of(c[2]), estado=row_state(c[:3]))
ORIGENES = sorted(u for u in ROWS if u + 'a' in ROWS or u + 'b' in ROWS)
# 4b · FILA: what each piece (and each split unit, as origin of its halves) leaves working
for u, r in sorted(ROWS.items()):
    add('FILA', f'FILA:{u}', u, r['archivo'], r['linea'], r['estado'], origen=u in ORIGENES,
        mitades=[u + 'a', u + 'b'] if u in ORIGENES else [])
for u in ORIGENES:
    if ROWS[u]['guards']:
        FAILS.append(f'origin row {u} keeps live guards {ROWS[u]["guards"]}')
if set(ROWS) - set(ORIGENES) != set(PIEZAS):
    FAILS.append(f'pieces without row {sorted(set(PIEZAS) - set(ROWS))} · rows without piece '
                 f'{sorted(set(ROWS) - set(ORIGENES) - set(PIEZAS))}')

# 5 · GUARD: assigned on the piece rows, defined in a catalog row (V/20 §2, B/20 §2, D/16) -------
GDEF = collections.defaultdict(list)
for path in (V + 'docs/20-testing.md', B + 'docs/20-testing.md', D16):
    for n, l in enumerate(lines(path), 1):
        m = re.match(r'^\|\s*(~~)?[*`\s]*(G(?:-R\d+(?:-[A-F])?|\d+))\b[`*]*(~~)?', l)
        if m:
            GDEF[m.group(2)].append((path, n, bool(m.group(1) or m.group(3)), l))
ASIG = {}
for p in PIEZAS:
    for g in ROWS.get(p, {}).get('guards', []):
        if g in ASIG:
            FAILS.append(f'guard {g} in two pieces: {ASIG[g]} and {p}')
        ASIG[g] = p
for g, p in sorted(ASIG.items()):
    live = [x for x in GDEF.get(g, []) if not x[2]]
    path, n = (live[0][0], live[0][1]) if live else (ROWS[p]['archivo'], ROWS[p]['linea'])
    add('GUARD', f'GUARD:{g}', g, path, n, 'VIVO', pieza=p, cuando=PIEZAS[p]['cuando'],
        fila_pieza=f"{ROWS[p]['archivo']}:{ROWS[p]['linea']}", sin_fila_catalogo=not live)
# 24 · VAL: catalog rows that keep a guard name but «deja de ser un guard»
for g, defs in sorted(GDEF.items()):
    live = [x for x in defs if not x[2]]
    if g not in ASIG and live:
        path, n, _, l = live[0]
        if re.search(r'[Dd]eja de ser un guard', l):
            add('VAL', f'VAL:{g}', g, path, n, 'VIVO')
        else:
            FAILS.append(f'catalog row of {g} without piece and not a validation: {path}:{n}')

# 6 · DEP (B §2.6) with its arrows ------------------------------------------------------------
BD = B + 'descomposicion.md'
ARROWS = []
for n, c in table_after(BD, section(BD, r'^### 2\.6 '), r'^\| # \| quién lee \|'):
    m = re.match(r'^[\s*`~]*(\d+)', c[0])
    if not m:
        continue
    st = row_state(c)
    lect = set(re.findall(r'\*\*(' + PIEZA_RX + r')\*\*', unstrike(c[1])))
    contra = set(re.findall(r'\*\*(' + PIEZA_RX + r')\*\*', unstrike(c[-1])))
    flechas = sorted(f'{a}->{b}' for a in contra for b in lect if a != b) if st != 'MUERTO' else []
    ARROWS += flechas
    add('DEP', f'DEP:{m.group(1)}', m.group(1), BD, n, st, flechas=flechas)

# 7 · LISTA (exit criterion per piece; origin rows too) ------------------------------------------
for path in (V + 'descomposicion.md', B + 'descomposicion.md'):
    for n, c in table_after(path, section(path, r'^## 4\. '), r'^\| # \| la unidad está lista cuando'):
        m = re.match(r'\*\*(' + PIEZA_RX + r')\*\*', c[0].strip())
        if m:
            u = m.group(1)
            st = 'ORIGEN' if u in ORIGENES else row_state(c)
            add('LISTA', f'LISTA:{u}', u, path, n, st, estado_fila=row_state(c))
for n, c in UROWS:
    m = re.match(r'\*\*(' + PIEZA_RX + r')\*\*', c[0].strip())
    if m:
        add('LISTA', f'LISTA:{m.group(1)}', m.group(1), D16, n, row_state([c[0], c[-1]]))

# 8 · INV ----------------------------------------------------------------------------------------
P = D + 'nucleo/04-invariantes.md'
for rx, idrx in ((r'^## 2\. ', r'(\d+)\b'), (r'^## 3\. ', r'(D\d+)\b')):
    a, b = section(P, rx)
    for n in range(a, b + 1):
        l = lines(P)[n - 1]
        if l.startswith('|'):
            c = cells(l)
            m = re.match(r'^[\s*`~]*' + idrx, c[0])
            if m:
                add('INV', f'INV:{m.group(1)}', m.group(1), P, n, row_state(c))

# 9 · TRANS (first table appearance defines; a live re-listing keeps it alive) ----------------
for path, tag, fams in ((V + 'docs/03-maquinas-de-estado.md', 'V', ('T', 'PB', 'PP')),
                        (B + 'docs/03-maquinas-de-estado.md', 'B', ('S', 'P', 'A', 'MP', 'RF'))):
    first = {}
    for n, l in enumerate(lines(path), 1):
        if not l.lstrip().startswith('|'):
            continue
        c = cells(l)
        m = re.match(r'^[\s*`~]*((?:' + '|'.join(fams) + r')\d+[a-z]?)\b', c[0])
        if not m:
            continue
        t, st = m.group(1), row_state(c)
        if t not in first:
            first[t] = [n, st]
        elif first[t][1] != 'VIVO' and st == 'VIVO':
            first[t][1] = 'VIVO'
    for t, (n, st) in first.items():
        add('TRANS', f'TRANS:{tag}:{t}', t, path, n, st, maquina=re.sub(r'\d.*', '', t))

# 23 · PROH (B/03 §3.3, «lo que no existe») ---------------------------------------------------
B03 = B + 'docs/03-maquinas-de-estado.md'
for k, (n, c) in enumerate(table_after(B03, section(B03, r'^### 3\.3 '), r'^\| lo que no existe \|'), 1):
    add('PROH', f'PROH:B:{k}', c[0].strip(), B03, n, row_state(c))

# 10 · ACC (nucleo/08 §3, no id: ordinal of the row, struck rows included) --------------------
P = D + 'nucleo/08-auditoria-y-observabilidad.md'
a, b = section(P, r'^## 3\. ')
k = 0
for n in range(a, b + 1):
    l = lines(P)[n - 1]
    if l.startswith('| ') and not l.startswith('| acción') and not set(l.strip()) <= set('|-: '):
        k += 1
        c = cells(l)
        st = 'MUERTO' if re.match(r'^\s*(?:✚\s*)?~~.*~~\s*$', c[0]) else ('MIXTO' if '~~' in c[0] else 'VIVO')
        add('ACC', f'ACC:{k}', str(k), P, n, st)
    elif k and not l.startswith('|'):
        break

# 11 · PLAZO, 12 · MOT ---------------------------------------------------------------------------
for fuente, pre, path, rx in (('PLAZO', 'PLAZO', D + 'nucleo/02-modelo-de-datos.md', r'^### 1\.5 '),
                             ('MOT', 'MOT', B + 'docs/02-modelo-de-datos.md', r'^### 2\.5 ')):
    a, b = section(path, rx)
    for n in range(a, b + 1):
        l = lines(path)[n - 1]
        if l.startswith('|'):
            c = cells(l)
            m = re.match(r'^[\s*`~]*(\d+)\b', c[0])
            if m:
                extra = {}
                if fuente == 'MOT':
                    names = re.findall(r'`([A-ZÁÉÍÓÚÑ_]+)`', c[1])
                    extra['nombre'] = names[-1] if names else '?'
                add(fuente, f'{pre}:{m.group(1)}', m.group(1), path, n, row_state(c), **extra)

# 13 · LOCK (B/05, headings C1..) ---------------------------------------------------------------
P = B + 'docs/05-idempotencia-y-concurrencia.md'
for n, l in enumerate(lines(P), 1):
    m = re.match(r'^#{2,4} .*?\b(C\d+)\b', l)
    if m:
        add('LOCK', f'LOCK:{m.group(1)}', m.group(1), P, n, 'MUERTO' if '~~' + m.group(1) in l else 'VIVO')

# 14 · RP, 15 · M (B/20) and 16 · L (V/21) -------------------------------------------------------
for path, rx, f in ((B + 'docs/20-testing.md', r'(RP\d+)\b', 'RP'), (B + 'docs/20-testing.md', r'(M\d+)\b', 'M'),
                    (V + 'docs/21-migracion.md', r'(L\d+)\b', 'L')):
    for n, l in enumerate(lines(path), 1):
        if l.startswith('|'):
            c = cells(l)
            m = re.match(r'^[\s*`~]*' + rx, c[0])
            if m:
                add(f, f'{f}:{m.group(1)}', m.group(1), path, n, row_state(c))

# 17 · PASO (D/16 §4.2, first table) ---------------------------------------------------------------
seen = set()
for n, c in table_after(D16, section(D16, r'^### 4\.2 '), r'^\| # \| paso \|'):
    m = re.match(r'^\s*(~~)?(\d+[a-z]?)(~~)?\s*(✚)?\s*$', c[0])
    if m and m.group(2) not in seen:
        seen.add(m.group(2))
        add('PASO', f'PASO:{m.group(2)}', m.group(2), D16, n, row_state(c))

# 18 · OWN (every row of every table of */10-decisiones-del-owner.md; letters are reused) ------
for path in sorted(f for f in ls(D) if f.endswith('/10-decisiones-del-owner.md')):
    carpeta = path.split('/')[-2]
    t, prev = 0, False
    L2 = lines(path)
    for n, l in enumerate(L2, 1):
        es = l.startswith('|')
        if es and not prev:
            t += 1
            head = n
        prev = es
        if not es or n <= head + 1:
            continue
        c = cells(l)
        letra = re.sub(r'[*`~✚\s]', '', c[0])
        st = 'MUERTO' if re.match(r'^\s*~~', c[0]) else 'VIVO'
        add('OWN', f'OWN:{carpeta}:t{t}:{letra}', letra, path, n, st)

# 19 · ESQ (D/16 §4.6, `| esquema | de | lo crea | fuente |`) ---------------------------------------
for k, (n, c) in enumerate(table_after(D16, S46, r'^\| esquema \| de \| lo crea \|'), 1):
    de, crea = c[1].strip().strip('`'), c[2].strip().strip('`')
    add('ESQ', f'ESQ:{k}', str(k), D16, n, 'VIVO', de=de, crea=crea)
    if PIEZAS.get(crea, {}).get('cuando') != 'corte':
        FAILS.append(f'ESQ:{k} is created by {crea}, not a cut piece')
    if PIEZAS.get(de, {}).get('cuando') != 'después':
        FAILS.append(f'ESQ:{k} belongs to {de}, not a later piece')

# 20 · TPZ (B §2.12, `| transición | pieza | nota |`) ---------------------------------------------
TPZ = {}
for n, c in table_after(BD, section(BD, r'^### 2\.12 '), r'^\| transición \| pieza \| nota \|'):
    s = c[0].strip().strip('`')
    ps = re.findall(r'`(' + PIEZA_RX + r')`', c[1])
    TPZ[s] = ps
    add('TPZ', f'TPZ:{s}', s, BD, n, 'VIVO' if ps else 'SIN_PIEZA', piezas=ps, nota=c[2].strip())
    for p in ps:
        if p not in PIEZAS:
            FAILS.append(f'TPZ:{s} names piece {p}, which does not exist')
    if not ps:
        FAILS.append(f'TPZ:{s} without piece')

# 22 · APZ (addon-instance machine, B/03 §8; A5 -> B5 by AV, the rest stays in B10 «entera, salvo»)
APZ_SRC = {p: PIEZAS[p]['linea'] for p in ('B5', 'B10')}
b5_row = lines(D16)[APZ_SRC['B5'] - 1]
b10_row = lines(D16)[APZ_SRC['B10'] - 1]
for it in [i for i in ITEMS if i['fuente'] == 'TRANS' and i['maquina'] == 'A']:
    a = it['local']
    if re.search(r'`' + a + r'`', b5_row):
        pieza, src, der = 'B5', f"{D16}:{APZ_SRC['B5']}", False
    else:
        pieza, src, der = 'B10', f"{D16}:{APZ_SRC['B10']}", True
        if re.search(r'`' + a + r'`', b10_row) and not re.search(r'`' + a + r'`.*que van a', b10_row):
            der = False
    add('APZ', f'APZ:{a}', a, it['archivo'], it['linea'], it['estado'], pieza=pieza,
        fuente_pieza=src, derivado=der)

# 21 · GATE (D/16 §4.7: each #### heading, and each numbered condition under it) -----------------
a, b = section(D16, r'^### 4\.7 ')
cur = None
for n in range(a, b + 1):
    l = lines(D16)[n - 1]
    m = re.match(r'^#### (.*)$', l)
    if m:
        t = re.sub(r'[*`✚]', '', m.group(1)).strip()
        mm = re.match(r'Momento (\d)', t)
        cur = f'M{mm.group(1)}' if mm else ('FP' if 'posteriores' in t else 'SMOKE' if 'smoke' in t else re.sub(r'\W+', '-', t.lower()))
        add('GATE', f'GATE:{cur}', cur, D16, n, 'VIVO')
        continue
    m = re.match(r'^(\d+)\. ', l)
    if cur and m:
        st = 'MUERTO' if re.match(r'^\d+\. ~~.*~~\s*$', l) else 'VIVO'
        add('GATE', f'GATE:{cur}.{m.group(1)}', f'{m.group(1)}', D16, n, st)
    # AW: the later phases, one row per phase (`| fase | piezas | …`), inside «Las fases posteriores»
    m = re.match(r'^\| (\d) \| ((?:`[UVB]\d+[ab]?`,? ?)+) \|', l)
    if cur == 'FP' and m:
        ps = re.findall(r'`(' + PIEZA_RX + r')`', m.group(2))
        add('GATE', f'GATE:FP.F{m.group(1)}', m.group(1), D16, n, 'VIVO', piezas=ps)
        for p in ps:
            if PIEZAS.get(p, {}).get('cuando') != 'después':
                FAILS.append(f'phase {m.group(1)} names {p}, which is not a later piece')
            PIEZAS.setdefault(p, {})['fase'] = int(m.group(1))
for it in ITEMS:
    if it['fuente'] == 'PIEZA' and it['cuando'] == 'después':
        it['fase'] = PIEZAS[it['local']].get('fase')
        if it['fase'] is None:
            FAILS.append(f"later piece {it['local']} without a phase (AW)")

# 25 · SEC (coverage net: every heading of the 38 design files, fenced code excluded) ---------
for path in corpus_38():
    fence, heads2 = False, []
    for n, l in enumerate(lines(path), 1):
        if l.lstrip().startswith('```'):
            fence = not fence
        if not fence and re.match(r'^#{1,6} ', l):
            heads2.append(n)
    for k, n in enumerate(heads2):
        l = lines(path)[n - 1]
        if not re.match(r'^#{2,6} ', l):
            continue
        fin = heads2[k + 1] - 1 if k + 1 < len(heads2) else len(lines(path))
        st = 'MUERTO' if re.match(r'^#+\s+~~.*~~\s*$', l) else 'VIVO'
        add('SEC', f'SEC:{path}:{n}', l.split(' ', 1)[0], path, n, st, fin=fin)


# --------------------------------------------------------------------------------------------
def checks():
    by = collections.defaultdict(list)
    for it in ITEMS:
        by[it['fuente']].append(it)
    corte = [p for p, x in PIEZAS.items() if x['cuando'] == 'corte']
    exp = {
        'decisiones (146)': (len(by['DEC']), 146),
        'precisadas sin SUPERSEDED (76)': (sum(1 for i in by['DEC'] if i['precisada']), 76),
        'filas de la matriz (117)': (len(by['MATRIZ']), 117),
        'piezas (30)': (len(PIEZAS), 30),
        'piezas al corte (22)': (len(corte), 22),
        'guards (35)': (len(by['GUARD']), 35),
        'guards al corte (34)': (sum(1 for i in by['GUARD'] if i['cuando'] == 'corte'), 34),
        'dependencias vivas (12)': (sum(1 for i in by['DEP'] if i['estado'] != 'MUERTO'), 12),
        'flechas entre épicas (14)': (len(ARROWS), 14),
        'transiciones con pieza (34)': (sum(1 for i in by['TPZ'] if i['piezas']), 34),
        'esquema del corte (9)': (len(by['ESQ']), 9),
    }
    vivas_s = {i['local'] for i in by['TRANS'] if i['id'].startswith('TRANS:B:S') and i['estado'] != 'MUERTO'}
    if vivas_s != set(TPZ):
        FAILS.append(f'live S transitions vs B §2.12: missing {sorted(vivas_s - set(TPZ))}, extra {sorted(set(TPZ) - vivas_s)}')
    for i in by['APZ']:
        if i['estado'] != 'MUERTO' and i['pieza'] not in PIEZAS:
            FAILS.append(f"{i['id']} without piece")
    lista = {i['local'] for i in by['LISTA']}
    if set(PIEZAS) - lista:
        FAILS.append(f'pieces without «lista cuando»: {sorted(set(PIEZAS) - lista)}')
    for k, (got, want) in exp.items():
        if got != want:
            FAILS.append(f'{k}: got {got}')
    return by, exp


def resumen(by, exp):
    print(f'SHA {SHA}')
    print(f'{"fuente":7} {"total":>5} {"vivos":>5} {"otros":>5} dup · estados')
    for f, its in by.items():
        c = collections.Counter(i['estado'] for i in its)
        ids = collections.Counter(i['id'] for i in its)
        dup = sorted(k for k, v in ids.items() if v > 1)
        muertos = sum(v for k, v in c.items() if k in ('MUERTO', 'SUPERSEDED'))
        print(f'{f:7} {len(its):5} {len(its) - muertos:5} {muertos:5} {len(dup):3} · {dict(c)}'
              + (f' · DUP {dup[:5]}' if dup else ''))
    print()
    for k, (got, want) in exp.items():
        print(f'  {"✓" if got == want else "✗"} {k}: {got}')
    print(f'  · MIXTO: {sum(1 for i in ITEMS if i["estado"] == "MIXTO")}'
          f' · 📌 en prosa: {sum(1 for i in by["PIN"] if i["forma"] == "prosa")}'
          f' · secciones: {len(by["SEC"])} en {len(corpus_38())} archivos')
    for f in FAILS:
        print('✗', f)


if __name__ == '__main__':
    by, exp = checks()
    resumen(by, exp)
    if '--json' in sys.argv:
        out = sys.argv[sys.argv.index('--json') + 1]
        json.dump(dict(sha=SHA, items=ITEMS, flechas=ARROWS, fallas=FAILS), open(out, 'w', encoding='utf-8'),
                  ensure_ascii=False, indent=4)
        print('\nJSON:', out, len(ITEMS), 'ítems')
    if '--check' in sys.argv and FAILS:
        sys.exit(1)
