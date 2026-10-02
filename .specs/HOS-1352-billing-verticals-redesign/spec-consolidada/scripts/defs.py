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
#     the matrix, the owner letters and the list of pieces. PROH (the forbidden transitions, which
#     AN tests), VAL (validations that kept a guard name) and DEP are not named by AX and are kept
#     normative here (inferred; question AZ).
NORMATIVAS = {'DEC', 'PIN', 'FILA', 'LISTA', 'GUARD', 'VAL', 'DEP', 'INV', 'TRANS', 'PROH',
              'ACC', 'PLAZO', 'MOT', 'LOCK', 'RP', 'M', 'PASO', 'ESQ', 'TPZ', 'APZ', 'GATE'}
CITABLES = NORMATIVAS | {'MATRIZ', 'OWN', 'PIEZA'}
# methodology decisions (and their 📌) govern how the program is run, not what is built: citable,
# never required to be covered by an AC (owner AX)
NO_NORMATIVAS_PREFIJOS = ('DEC-METH-',)

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
