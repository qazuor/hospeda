#!/usr/bin/env python3
"""Expand {{ID}} placeholders and @B/@D/@V path prefixes of the g8 sources into the spec files.

    python3 gen.py B4 B5 B6 B7 [--salida=<dir>]   (src/<pieza>.md -> the piece file of the spec)
"""
import json
import os
import re
import sys

# Paths are relative to this file: generadores/<grupo>/ -> scripts/ -> spec-consolidada/.
C = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
sys.path.insert(0, os.path.join(C, 'scripts'))
from comun import slug  # noqa: E402

ASIG = json.load(open(C + '/_trabajo/asignacion.json', encoding='utf-8'))['items']
INV = {i['id'] for i in json.load(open(C + '/_trabajo/inventario.json', encoding='utf-8'))['items']}
PIEZAS = {i[len('PIEZA:'):]: v['destino'] for i, v in ASIG.items() if i.startswith('PIEZA:')}
PRE = {'@B': '.specs/HOS-1354-billing-cobro-y-proveedor/',
       '@D': '.specs/HOS-1352-billing-verticals-redesign/docs/',
       '@V': '.specs/HOS-1353-verticales-capacidades-y-autorizacion/'}
KIND = re.compile(r'^(US|AC|TEST):([A-Za-z0-9]+):(\d+)$')


def destino_de_salida(rel):
    """Where to write ``rel``: the spec itself, or ``--salida=<dir>`` (to compare without touching it)."""
    d = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--salida=')), C)
    p = os.path.join(d, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def destino(cid):
    m = KIND.match(cid)
    if m:
        p = m.group(2)
        return '30-el-corte.md' if p == 'CORTE' else PIEZAS[p]
    if cid not in ASIG:
        raise SystemExit(f'✗ id desconocido: {cid}')
    d = ASIG[cid]['destino']
    return d.split(' ')[0]


def link(cid, here):
    d = destino(cid)
    if d == here:
        rel = ''
    elif d.startswith('10-corte/') and here.startswith('10-corte/'):
        rel = os.path.basename(d)
    else:
        rel = '../' + d
    return f'[{cid}]({rel}#{slug(cid)})'


def expand(text, here):
    text = re.sub(r'\{\{([^}]+)\}\}', lambda m: link(m.group(1).strip(), here), text)
    for k, v in PRE.items():
        text = text.replace(k, v)
    return text


if __name__ == '__main__':
    for name in [a for a in sys.argv[1:] if not a.startswith('--')]:
        src = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', name + '.md')
        here = PIEZAS[name]
        out = expand(open(src, encoding='utf-8').read(), here)
        dst = destino_de_salida(here)
        open(dst, 'w', encoding='utf-8').write(out)
        print(dst, len(out.split('\n')))
