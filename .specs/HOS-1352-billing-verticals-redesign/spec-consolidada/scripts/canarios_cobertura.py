#!/usr/bin/env python3
"""Canaries for cobertura.py: a minimal coverage map that passes (exit 0), and one mutation per rule
that must make it fail (exit 1) naming that rule. A canary that passes is a blind rule.

    python3 canarios_cobertura.py [inventario.json]

The fixture uses REAL inventory items and REAL lines at the frozen SHA: the 30 pieces (citable),
items derived by script (a guard, a transition of B §2.12, a piece row and its exit criterion, a
schema row) and items adjudicated by reading (a decision, two transitions of verticales, one of
billing whose B §2.12 row is left out on purpose, a phase gate).
"""
import copy
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from comun import B, D, V, line_hash  # noqa: E402
from cobertura import frag_con, rx_pieza  # noqa: E402

INV = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '_trabajo', 'inventario.json')
ADJ = os.path.join(HERE, '..', '_trabajo', 'adjudicacion.json')
VD, BD, D16, LOG = V + 'descomposicion.md', B + 'descomposicion.md', D + '16-fase-7-del-paraguas.md', D + '01-decision-log.md'
IDS = ['GUARD:G7', 'TPZ:S2', 'TRANS:B:S2', 'FILA:B2', 'LISTA:B2', 'ESQ:1', 'DEC-TRIAL-010', 'TRANS:V:PB4',
       'TRANS:V:PB9', 'TRANS:B:S21', 'GATE:FP.F1', 'L:L1', 'INV:17']
LISTA = {'INV:17': ['BA', '`INV:17`']}  # the closed list of the fixture (replaces defs.SOLO_CITABLES)


def c(path, n, *tokens):
    return dict(archivo=path, linea=n, cita=frag_con(path, n, *tokens), hash=line_hash(path, n))


def own(it, tok):
    return c(it['archivo'], it['linea'], tok)


def fixture(inv):
    by = {i['id']: i for i in inv['items']}
    mini = dict(sha=inv['sha'], items=[copy.deepcopy(by[k]) for k in IDS]
                + [copy.deepcopy(i) for i in inv['items'] if i['fuente'] == 'PIEZA'])
    E = {
        'DEC-TRIAL-010': dict(pieza='V4', citas=[c(VD, 64, 'DEC-TRIAL-010'), c(VD, 64, rx_pieza('V4'))],
                              razon='la fila de V4 la nombra'),
        'TRANS:V:PB4': dict(pieza='V6', citas=[own(by['TRANS:V:PB4'], 'PB4'), c(VD, 66, '`PB4`')],
                            razon='la fila de V6 lleva la máquina entera'),
        'TRANS:V:PB9': dict(pieza='V9b', citas=[own(by['TRANS:V:PB9'], 'PB9'), c(VD, 73, '`PB9`')],
                            razon='V §2.14: PB9 va con V9b'),
        'TRANS:B:S21': dict(pieza='B5', citas=[own(by['TRANS:B:S21'], 'S21'), c(D16, 954, '`S21`')],
                            razon='D/16 §4.6: B5 suma S21 (AV)'),
        'GATE:FP.F1': dict(pieza='CORTE', citas=[own(by['GATE:FP.F1'], 'V9b')],
                           razon='gate de proceso de la fase 1'),
    }
    return mini, {'entradas': E, 'sin_pieza': {}}


def run(mini, lect, lista=None):
    d = tempfile.mkdtemp(prefix='canario-cob-')
    for name, obj in (('inv.json', mini), ('lect.json', lect), ('lista.json', lista or LISTA)):
        json.dump(obj, open(os.path.join(d, name), 'w', encoding='utf-8'), ensure_ascii=False)
    r = subprocess.run([sys.executable, os.path.join(HERE, 'cobertura.py'), os.path.join(d, 'inv.json'), ADJ,
                        os.path.join(d, 'lect.json'), os.path.join(d, 'out.json'),
                        '--lista-solo-citables=' + os.path.join(d, 'lista.json')], capture_output=True, text=True)
    shutil.rmtree(d)
    return r.returncode, r.stdout + r.stderr


def main():
    inv = json.load(open(INV, encoding='utf-8'))
    mini, lect = fixture(inv)
    by = {i['id']: i for i in inv['items']}
    canarios = []

    def can(rule, name, m=None, f=None, li=None):
        canarios.append((rule, name, m or mini, f or lect, li))

    def mut(fn):
        x = copy.deepcopy(lect)
        fn(x['entradas'])
        return x

    can('C1', 'un ítem normativo sin entrada', f=mut(lambda e: e.pop('DEC-TRIAL-010')))
    x = mut(lambda e: e.pop('DEC-TRIAL-010'))
    x['sin_pieza'] = {'DEC-TRIAL-010': dict(motivo='ninguna fila lo nombra', pregunta='BA')}
    can('C1', 'un ítem en «sin_pieza», aun con su pregunta (no es una respuesta)', f=x)
    x = mut(lambda e: e.pop('DEC-TRIAL-010'))
    x['sin_pieza'] = {'DEC-TRIAL-010': dict(motivo='')}
    can('C1', 'un «sin_pieza» sin motivo ni pregunta', f=x)
    can('C1', 'el ítem sólo citable fuera de la lista y sin entrada falla', li={'INV:1': ['BA', '`INV:17`']})
    can('C8', 'una lista cerrada con un ítem que no existe', li={'INV:17': ['BA', '`INV:17`'], 'INV:999': ['BA', '`INV:17`']})
    can('C8', 'una lista cerrada cuyo fragmento no está en la fila de su letra', li={'INV:17': ['BA', '`INV:18`']})
    can('C7', 'una entrada para un ítem de la lista cerrada', f=mut(lambda e: e.update(
        {'INV:17': dict(pieza='V1', citas=[own(by['INV:17'], '17'), c(VD, 61, rx_pieza('V1'))], razon='x')})))
    can('C2', 'la dueña con el nombre viejo de la pseudo-pieza (30-el-corte en vez de CORTE)',
        f=mut(lambda e: e['GATE:FP.F1'].update(pieza='30-el-corte')))
    can('C2', 'una pieza inexistente', f=mut(lambda e: e['DEC-TRIAL-010'].update(pieza='V99')))
    can('C2', 'un «tambien» con una pieza inexistente', f=mut(lambda e: e['TRANS:V:PB4'].update(
        tambien=[dict(pieza='V99', rol='usa', citas=[c(VD, 66, '`PB4`')])])))
    can('C2', 'un «tambien» con un rol fuera de la lista', f=mut(lambda e: e['TRANS:V:PB4'].update(
        tambien=[dict(pieza='V8a', rol='mira', citas=[c(VD, 69, rx_pieza('V8a'))])])))
    can('C3', 'una pieza del corte cubre un ítem que la fuente pone después (PB9 en V6)', f=mut(lambda e: e['TRANS:V:PB9'].update(
        pieza='V6', citas=[own(by['TRANS:V:PB9'], 'PB9'), c(VD, 66, '`PB9`')])))
    can('C3', 'una pieza posterior cubre un ítem que la fuente pone al corte (S21 en B10)', f=mut(lambda e: e['TRANS:B:S21'].update(
        pieza='B10', citas=[own(by['TRANS:B:S21'], 'S21'), c(BD, 148, '`S21`')])))
    can('C3', 'un gate de la fase 1 en una pieza del corte', f=mut(lambda e: e['GATE:FP.F1'].update(
        pieza='B3', citas=[own(by['GATE:FP.F1'], 'V9b'), c(BD, 137, rx_pieza('B3'))])))
    m = copy.deepcopy(mini)
    next(i for i in m['items'] if i['id'] == 'GUARD:G7')['cuando'] = 'después'
    can('C3', 'un guard (por script) cuya fuente lo pone en otro momento que su pieza', m=m)
    can('C4', 'ninguna cita es el ítem ni nombra su id', f=mut(lambda e: e['DEC-TRIAL-010'].update(
        citas=[c(VD, 63, rx_pieza('V3')), c(D16, 942, rx_pieza('V4'))])))
    can('C4', 'la pieza sólo la nombra una línea fuera de la partición (el log)', f=mut(lambda e: e['DEC-TRIAL-010'].update(
        citas=[c(LOG, by['DEC-TRIAL-010']['linea'], 'DEC-TRIAL-010'),
               c(LOG, 7795, rx_pieza('V4'))])))
    can('C4', 'un «tambien» sin cita que nombre su pieza', f=mut(lambda e: e['TRANS:V:PB4'].update(
        tambien=[dict(pieza='V8a', rol='usa', citas=[c(VD, 66, '`PB4`')])])))
    can('C5', 'una cita que no está en su línea', f=mut(lambda e: e['TRANS:V:PB4']['citas'][1].update(cita='texto inventado')))
    can('C5', 'una cita con el hash de otra línea', f=mut(lambda e: e['TRANS:V:PB4']['citas'][1].update(hash='0' * 64)))
    can('C5', 'una cita sin sellar', f=mut(lambda e: e['TRANS:V:PB4']['citas'][1].pop('hash')))
    can('C5', 'una cita en un archivo que no existe en el SHA', f=mut(lambda e: e['TRANS:V:PB4']['citas'].append(
        dict(archivo=VD + '.no', linea=1, cita='x', hash='0' * 64))))
    can('C6', 'un «tambien» que implementa y es ancestro de la dueña (V2 antes de V6)', f=mut(lambda e: e['TRANS:V:PB4'].update(
        tambien=[dict(pieza='V2', rol='implementa', citas=[c(VD, 62, rx_pieza('V2'))])])))
    can('C6', 'una pieza posterior dueña con una del corte, no ancestro, que también lo implementa (V9b con B3)',
        f=mut(lambda e: e['TRANS:V:PB9'].update(tambien=[dict(pieza='B3', rol='implementa', citas=[c(BD, 137, rx_pieza('B3'))])])))
    can('C7', 'un ítem derivado por script y también por lectura', f=mut(lambda e: e.update(
        {'GUARD:G7': dict(pieza='B2', citas=[c(BD, 136, rx_pieza('B2'))], razon='x')})))
    can('C7', 'una entrada de un ítem muerto', f=mut(lambda e: e.update(
        {'L:L1': dict(pieza='V6', citas=[own(by['L:L1'], 'L1')], razon='x')})))
    can('C7', 'una entrada de un ítem sólo citable (la lista de piezas)', f=mut(lambda e: e.update(
        {'PIEZA:B2': dict(pieza='B2', citas=[c(BD, 136, rx_pieza('B2'))], razon='x')})))
    can('C7', 'una entrada de un ítem que no existe', f=mut(lambda e: e.update({'DEC-XXX-999': dict(pieza='B2', citas=[])})))

    code, out = run(mini, lect)
    print(f'{"✓" if code == 0 else "✗"} base: exit {code}' + ('' if code == 0 else '\n' + out))
    fallas = 0 if code == 0 else 1
    for rule, name, m, f, li in canarios:
        code, out = run(m, f, li)
        ok = code == 1 and f'✗ {rule} ' in out
        fallas += not ok
        print(f'{"✓" if ok else "✗ CIEGO"} {rule:3} exit {code} · {name}')
        if not ok:
            print('   ', out.strip().replace('\n', '\n    '))
    print(f'\n{len(canarios)} canarios · {fallas} fallas')
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main())
