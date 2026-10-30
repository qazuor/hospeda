#!/usr/bin/env python3
"""Assignment of every inventory item to the file of the consolidated spec that defines it
(owner AH; structure approved with the consolidation task).

    python3 asignar.py <inventario.json> <adjudicacion.json> <salida asignacion.json>

One rule per source (REGLAS below). A dead item (MUERTO/SUPERSEDED, or adjudicated MUERTO) goes to
90-retirados.md whatever its source. The eight later pieces go to `20-fase-<n>/<pieza>.md`, with
the phase the owner fixed in AW (D/16 §4.7, «Las fases posteriores»; read by inventario.py). An item marked `inferido` follows a rule the sources do not state
literally; the report lists them.
"""
import collections
import json
import sys

from comun import SHA
from defs import MUERTOS

REGLAS = {
    'DEC': '01-decisiones-vigentes.md',
    'PIN': '01-decisiones-vigentes.md (con su decisión)',
    'OWN': '01-decisiones-vigentes.md (registro de las letras del owner)',
    'INV': '02-nucleo.md', 'ACC': '02-nucleo.md', 'PLAZO': '02-nucleo.md',
    'DEP': '03-contrato-de-cobertura.md (inferido: son lecturas de la otra épica por el contrato)',
    'MATRIZ': '04-catalogos.md', 'GUARD': '04-catalogos.md', 'VAL': '04-catalogos.md',
    'TRANS': '04-catalogos.md', 'PROH': '04-catalogos.md', 'MOT': '04-catalogos.md',
    'LOCK': '04-catalogos.md', 'RP': '04-catalogos.md', 'M': '04-catalogos.md', 'L': '04-catalogos.md',
    'PIEZA': 'el archivo de la pieza', 'FILA': 'el archivo de la pieza (la de origen, en su mitad a)',
    'LISTA': 'el archivo de la pieza (la de origen, en su mitad a)',
    'ESQ': 'el archivo de la pieza del corte que lo crea («lo crea»)',
    'TPZ': 'el archivo de la pieza (la primera, si es compartida)',
    'APZ': 'el archivo de la pieza (A5 en B5 por AV; el resto en B10, inferido de «entera, salvo»)',
    'PASO': '30-el-corte.md', 'GATE': '30-el-corte.md',
    'SEC': 'red de cobertura: sin destino propio (trazar.py R17)',
}
CATALOGO = {'MATRIZ', 'GUARD', 'VAL', 'TRANS', 'PROH', 'MOT', 'LOCK', 'RP', 'M', 'L'}
NUCLEO = {'INV', 'ACC', 'PLAZO'}


def main(inv_p, adj_p, out_p):
    inv = json.load(open(inv_p, encoding='utf-8'))['items']
    adj = json.load(open(adj_p, encoding='utf-8'))['veredictos']
    piezas = {i['local']: i['cuando'] for i in inv if i['fuente'] == 'PIEZA'}
    tpz = {i['local']: i['piezas'] for i in inv if i['fuente'] == 'TPZ'}
    apz = {i['local']: i['pieza'] for i in inv if i['fuente'] == 'APZ'}

    fases = {i['local']: i.get('fase') for i in inv if i['fuente'] == 'PIEZA'}

    def archivo_de(p):
        return f'10-corte/{p}.md' if piezas[p] == 'corte' else f'20-fase-{fases[p]}/{p}.md'

    out = {}
    for i in inv:
        f, st = i['fuente'], i['estado']
        v = adj.get(i['id'], {}).get('veredicto')
        muerto = (v == 'MUERTO') or (v is None and st in MUERTOS)
        rec = dict(fuente=f, estado=st, veredicto=v)
        if f == 'SEC':
            rec['destino'] = None
        elif muerto:
            rec['destino'] = '90-retirados.md'
        elif f in ('DEC', 'PIN', 'OWN'):
            rec['destino'] = '01-decisiones-vigentes.md'
        elif f in NUCLEO:
            rec['destino'] = '02-nucleo.md'
        elif f == 'DEP':
            rec['destino'] = '03-contrato-de-cobertura.md'
            rec['inferido'] = True
        elif f in CATALOGO:
            rec['destino'] = '04-catalogos.md'
            if f == 'TRANS' and i['id'].startswith('TRANS:B:S') and i['local'] in tpz:
                rec['piezas'] = tpz[i['local']]
            if f == 'TRANS' and i['id'].startswith('TRANS:B:A') and i['local'] in apz:
                rec['piezas'] = [apz[i['local']]]
            if f == 'GUARD':
                rec['pieza'] = i['pieza']
        elif f in ('PASO', 'GATE'):
            rec['destino'] = '30-el-corte.md'
        elif f in ('PIEZA', 'FILA', 'LISTA'):
            p = i['local']
            if p in piezas:
                rec['destino'] = archivo_de(p)
            else:  # split unit: origin of its halves
                rec['destino'] = archivo_de(p + 'a')
                rec['tambien'] = [archivo_de(p + 'b')]
        elif f == 'ESQ':
            rec['destino'] = archivo_de(i['crea'])
            rec['tambien'] = [archivo_de(i['de'])]
        elif f == 'TPZ':
            rec['destino'] = archivo_de(i['piezas'][0])
            if len(i['piezas']) > 1:
                rec['tambien'] = [archivo_de(p) for p in i['piezas'][1:]]
        elif f == 'APZ':
            rec['destino'] = archivo_de(i['pieza'])
            rec['inferido'] = bool(i['derivado'])
        else:
            sys.exit(f'✗ fuente sin regla: {f}')
        out[i['id']] = rec
    cuenta = collections.Counter(r['destino'] or 'red (SEC)' for r in out.values())
    por_archivo = dict(sorted(cuenta.items()))
    pendientes = sorted({r['destino'] for r in out.values() if r['destino'] and '?' in r['destino']})
    if pendientes:
        sys.exit(f'✗ destinos sin resolver: {pendientes}')
    doc = dict(sha=SHA, reglas=REGLAS,
               fases={f'20-fase-{n}': sorted(p for p, f in fases.items() if f == n) for n in (1, 2, 3, 4)},
               por_archivo=por_archivo, archivos_pendientes=pendientes,
               inferidos=sorted(k for k, r in out.items() if r.get('inferido')), items=out)
    json.dump(doc, open(out_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=4)
    print(f'SHA {SHA} · {len(out)} ítems')
    for k, n in por_archivo.items():
        print(f'  {n:5}  {k}')
    print(f'  inferidos: {len(doc["inferidos"])} · destinos pendientes: {len(pendientes)} · fases: {doc["fases"]}')


if __name__ == '__main__':
    main(*sys.argv[1:4])
