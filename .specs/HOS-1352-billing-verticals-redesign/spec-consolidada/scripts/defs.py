#!/usr/bin/env python3
"""Closed lists of the consolidated spec (DEC-METH-019 points 8-11; owner AL-AO), and a
diagnostic that finds WHERE every id family is defined in the frozen sources.

Imported by trazar.py (the constants) and runnable on its own (the diagnostic):

    python3 defs.py [inventario.json] [FAMILIA ...]

The diagnostic lists every id family that appears as the first cell of a table row or in a
heading across the epics and the umbrella design docs, and — given the inventory — marks the
families that NO inventory source covers. A family listed there is either a known non-item
(finding ids, letters of other rounds…) or a source the inventory is missing.
"""
import collections
import hashlib
import json
import re
import sys

from comun import D, SHA, B, V, lines, ls

# --- AM: the shape of user stories and acceptance criteria ------------------------------------
ACTORES = ('anfitrión', 'dueño de comercio', 'partner', 'admin', 'turista', 'sistema/cron')

# --- AN: closed list of test types --------------------------------------------------------------
TIPOS_TEST = ('unitario', 'integración con DB', 'ruta API', 'guard estático',
              'migración desde cero', 'migración sobre datos', 'e2e web', 'e2e admin',
              'smoke manual')
ETIQUETAS_SMOKE = ('local', 'staging', 'prod')

# --- AO: the template of every piece file, in order (a section that does not apply says
#     «N/A — <reason>» and is never deleted). AO's last item, «abiertos y Origen:», is split in
#     two headings so each can be checked on its own (inferred). ----------------------------
PLANTILLA = (
    'Objetivo, alcance y fuera de alcance',
    'Historias de usuario y criterios de aceptación',
    'Reglas',
    'Modelo de datos y migraciones',
    'API',
    'UI web y admin, e i18n',
    'Cron y outbox',
    'Variables de entorno',
    'Auditoría y observabilidad',
    'Seguridad',
    'Testing esperado',
    'Smoke y etiquetas',
    'Dependencias, rollback y despliegue',
    'Labels de Linear',
    'Abiertos',
    'Origen',
)

# --- the files of the consolidated spec (owner AH; structure approved with the task) ----------
ARCHIVOS_FIJOS = ('00-indice.md', '01-decisiones-vigentes.md', '02-nucleo.md',
                  '03-contrato-de-cobertura.md', '04-catalogos.md', '30-el-corte.md',
                  '80-abiertos.md', '90-retirados.md')

# --- item states ----------------------------------------------------------------------------
VIVOS = {'VIVO', 'ACCEPTED', 'VIGENTE', 'ORIGEN', 'SUPERSEDED_PARCIAL', 'PARCIAL',
         'VERIFIED', 'PARTIALLY_SUPPORTED', 'NOT_SUPPORTED', 'UNKNOWN'}
MUERTOS = {'MUERTO', 'SUPERSEDED'}

# --- which sources are NORMATIVE (every live item needs ≥1 AC, AL) and which are only
#     citable: owner AX (2026-10-01, the 1; DEC-METH-019, its 📌). AX names decisions (minus
#     DEC-METH-*), 📌, piece rows, «Lista cuando», guards, invariants, transitions, actions, terms,
#     reasons, locks, RP, M, steps, gates and the moves of the cut (ESQ, TPZ, APZ); citable only:
#     the matrix, the owner letters and the list of pieces. Owner AZ (the 1) adds PROH (the
#     forbidden transitions), VAL (validations that kept a guard name) and DEP (cross-epic
#     dependencies) to the normative set.
NORMATIVAS = {'DEC', 'PIN', 'FILA', 'LISTA', 'GUARD', 'VAL', 'DEP', 'INV', 'TRANS', 'PROH',
              'ACC', 'PLAZO', 'MOT', 'LOCK', 'RP', 'M', 'PASO', 'ESQ', 'TPZ', 'APZ', 'GATE'}
CITABLES = NORMATIVAS | {'MATRIZ', 'OWN', 'PIEZA'}
# methodology decisions (and their 📌) govern how the program is run, not what is built: citable,
# never required to be covered by an AC (owner AX)
NO_NORMATIVAS_PREFIJOS = ('DEC-METH-',)

# --- owner BA and BB (2026-10-01, the 1; 📌 on DEC-METH-019): normative items that no piece builds
#     are CITABLE ONLY, in this CLOSED list, which lives in 03-contrato-de-cobertura.md of the
#     consolidated spec. Each id carries its letter and the verbatim fragment of that letter's row in
#     41-corte-del-mvp/10-decisiones-del-owner.md that names it (a range or «con sus 📌» names
#     several). trazar.py R7 and cobertura.py C1 except them; `solo_citables_fallas` checks the list.
OWN41 = D + '41-corte-del-mvp/10-decisiones-del-owner.md'
_BA_RANGO = '`INV:33`–`INV:37`'
SOLO_CITABLES = {
    'INV:17': ('BA', '`INV:17`'), 'INV:33': ('BA', _BA_RANGO), 'INV:34': ('BA', _BA_RANGO),
    'INV:35': ('BA', _BA_RANGO), 'INV:36': ('BA', _BA_RANGO), 'INV:37': ('BA', _BA_RANGO),
    'DEC-CI-001': ('BA', '`DEC-CI-001` con sus 📌1 y 📌2'), 'DEC-CI-001#📌1': ('BA', '`DEC-CI-001` con sus 📌1 y 📌2'),
    'DEC-CI-001#📌2': ('BA', '`DEC-CI-001` con sus 📌1 y 📌2'), 'DEC-CI-002': ('BA', '`DEC-CI-002`'),
    'DEC-ARCH-005': ('BA', '`DEC-ARCH-005` con su 📌1'), 'DEC-ARCH-005#📌1': ('BA', '`DEC-ARCH-005` con su 📌1'),
    'DEC-ARCH-017#📌3': ('BA', '`DEC-ARCH-017#📌3`'), 'DEC-MIG-002': ('BA', '`DEC-MIG-002`'),
    'DEC-MIG-005#📌5': ('BA', '`DEC-MIG-005#📌5`'), 'DEC-AUTH-003#📌2': ('BA', '`DEC-AUTH-003#📌2`'),
    'DEC-DATA-005#📌4': ('BA', '`DEC-DATA-005#📌4`'), 'DEC-MP-008#📌2': ('BA', '`DEC-MP-008#📌2`'),
    'DEC-OBS-001#📌2': ('BB', '`DEC-OBS-001#📌2`'), 'DEC-ADDON-004#📌2': ('BB', '`DEC-ADDON-004#📌2`'),
    'DEC-SUB-013#📌2': ('BB', '`DEC-SUB-013#📌2`'), 'DEC-MP-003#📌1': ('BB', '`DEC-MP-003#📌1`'),
    'DEC-SUB-019#📌1': ('BB', '`DEC-SUB-019#📌1`'),
}
# sha256 of the BA and BB rows at the frozen SHA: a re-freeze that rewrites them voids the list
SOLO_CITABLES_HASH = {
    'BA': '4350775b538e7ffd6e5bdc5c4762af6757b9b418d9b3bcf54b74b546b5fa9036',
    'BB': 'dc27c55c0c2d4dd75e7f9efebe6f0e34898aab057167de9cec4a7f16769d2aa3',
}


def fila_de_letra(letra):
    """(line, text) of the owner row `| <letra> |` in OWN41 at the SHA, located by its letter."""
    hits = [(n, l) for n, l in enumerate(lines(OWN41), 1) if l.startswith(f'| {letra} |')]
    return hits[0] if len(hits) == 1 else (None, None)


def solo_citables_fallas(items_by_id, lista=None):
    """Errors of the closed list: an id that is not in the inventory, a fragment that is not in its
    letter's row, or a row whose hash changed since the list was written."""
    lista = SOLO_CITABLES if lista is None else lista
    out = []
    for cid, (letra, frag) in sorted(lista.items()):
        n, row = fila_de_letra(letra)
        if cid not in items_by_id:
            out.append(f'{cid}: no está en el inventario')
        elif row is None or frag not in row:
            out.append(f'{cid}: la fila {letra} no lo nombra («{frag}»)')
        elif hashlib.sha256(row.encode('utf-8')).hexdigest() != SOLO_CITABLES_HASH.get(letra):
            out.append(f'{cid}: la fila {letra} cambió desde que se escribió la lista (hash)')
    return out

# --- R6: what the cited Origen line must contain. 'id' = the local id; 'pin' = 📌; 'pos' = an
#     ordinal without text in the line, so only the exact position is checked. -------------
CHEQUEO_LOCAL = collections.defaultdict(lambda: 'id', {
    'PIN': 'pin', 'ACC': 'pos', 'ESQ': 'pos', 'PROH': 'pos', 'GATE': 'pos', 'SEC': 'pos'})


# --- diagnostic --------------------------------------------------------------------------------
ROW = re.compile(r'^\|\s*(?:~~)?[*`\s]*([A-Z][A-Z]*(?:-[A-Z]+)*-?\d+[a-z]?)\b')
HEAD = re.compile(r'^#{2,6}\s+.*?[`*]*([A-Z][A-Z]*(?:-[A-Z]+)*-?\d+[a-z]?)[`*]*\s*(?:[—·:\-]|$)')


def familias():
    files = [f for f in ls(V) + ls(B) if f.endswith('.md')]
    files += [f for f in ls(D + 'nucleo/') if f.endswith('.md')]
    files += [D + f for f in ('00-PDR.md', '01-decision-log.md', '04-open-decisions.md',
                              '06-mp-validation-matrix.md', '07-facts-inventory.md',
                              '11-particion-del-programa.md', '12-contrato-de-cobertura.md',
                              '16-fase-7-del-paraguas.md', '24-inventario-de-compensacion.md',
                              '41-corte-del-mvp/00-propuesta.md')]
    where = collections.defaultdict(collections.Counter)
    ids = collections.defaultdict(set)
    for f in files:
        for l in lines(f):
            for kind, rx in (('row', ROW), ('head', HEAD)):
                m = rx.match(l)
                if m:
                    k = re.sub(r'\d+[a-z]?$', '#', m.group(1))
                    where[k][(kind, f)] += 1
                    ids[k].add(m.group(1))
    return where, ids


def main(argv):
    inv = None
    if argv and argv[0].endswith('.json'):
        inv = json.load(open(argv.pop(0), encoding='utf-8'))
    where, ids = familias()
    cubiertas = set()
    if inv:
        for it in inv['items']:
            cubiertas.add(re.sub(r'\d+[a-z]?$', '#', it['local']))
    print(f'SHA {SHA}')
    for k in argv or sorted(where, key=lambda k: -sum(where[k].values())):
        marca = '' if not inv else ('  ✓ inventario' if k in cubiertas else '  · fuera del inventario')
        print(f'== {k}  distintos={len(ids[k])}{marca}')
        for (kind, rel), n in where[k].most_common(4):
            print(f'   {kind:4} {n:4}  {rel}')


if __name__ == '__main__':
    main(sys.argv[1:])
