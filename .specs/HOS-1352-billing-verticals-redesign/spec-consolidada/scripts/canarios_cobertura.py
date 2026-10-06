#!/usr/bin/env python3
"""Canaries for cobertura.py: a minimal coverage map that passes (exit 0), and one mutation per rule
that must make it fail (exit 1) naming that rule. A canary that passes is a blind rule.

    python3 canarios_cobertura.py [inventario.json]

The fixture uses REAL inventory items and REAL lines at the frozen SHA: the 30 pieces (citable),
items derived by script (a guard, a transition of B §2.12, a piece row and its exit criterion, a
schema row) and items adjudicated by reading (a decision, two transitions of verticales, one of
billing whose B §2.12 row is left out on purpose, a phase gate; and, with their real lectura
entries, DEC-MP-009, PASO:3 and GATE:M1 for the type limits).

The minimum test types never fail a run, so their canaries read the output instead: each case
asserts what the rule does and then shows the rule is not blind, by running the same fixture with
the condition flipped (another CREA_ESQUEMA list) and asserting the result changes.
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
from comun import B, D, V, line_hash, lines  # noqa: E402
from cobertura import frag_con, rx_pieza  # noqa: E402

INV = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '_trabajo', 'inventario.json')
ADJ = os.path.join(HERE, '..', '_trabajo', 'adjudicacion.json')
VD, BD, D16, LOG = V + 'descomposicion.md', B + 'descomposicion.md', D + '16-fase-7-del-paraguas.md', D + '01-decision-log.md'
IDS = ['GUARD:G7', 'TPZ:S2', 'TRANS:B:S2', 'FILA:B2', 'LISTA:B2', 'ESQ:1', 'DEC-TRIAL-010', 'TRANS:V:PB4',
       'TRANS:V:PB9', 'TRANS:B:S21', 'GATE:FP.F1', 'L:L1', 'INV:17', 'DEC-MP-009', 'PASO:3', 'GATE:M1',
       'DEC-ARCH-006', 'TRANS:B:S10', 'TPZ:S10']
REALES = ('DEC-MP-009', 'PASO:3', 'GATE:M1', 'DEC-ARCH-006')  # entries copied from the real lectura file
LECT = os.path.join(HERE, '..', '_trabajo', 'cobertura-lectura.json')
LISTA = {'INV:17': ['BA', '`INV:17`']}  # the closed list of the fixture (replaces defs.SOLO_CITABLES)


def ln(path, frag):
    """The one line of ``path`` at the SHA that contains ``frag`` (the fixture survives re-freezes)."""
    hits = [n for n, l in enumerate(lines(path), 1) if frag in l]
    assert len(hits) == 1, (path, frag, len(hits))
    return hits[0]


B5_PIEZA = '| `B5` | `B5` | corte | entera; `payment` nace con la columna de la instancia'
V4_PIEZA = '| `V4` | `V4` | corte | entera; suma la función del seudónimo'
LOG_V4 = 'la función del seudónimo pasa de `V9` a `V4`, que la usa'


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
        'TRANS:B:S21': dict(pieza='B5', citas=[own(by['TRANS:B:S21'], 'S21'), c(D16, ln(D16, B5_PIEZA), '`S21`')],
                            razon='D/16 §4.6: B5 suma S21 (AV)'),
        'GATE:FP.F1': dict(pieza='CORTE', citas=[own(by['GATE:FP.F1'], 'V9b')],
                           razon='gate de proceso de la fase 1'),
    }
    real = json.load(open(LECT, encoding='utf-8'))['entradas']
    E.update({k: copy.deepcopy(real[k]) for k in REALES})
    return mini, {'entradas': E, 'sin_pieza': {}}


def run(mini, lect, lista=None, crea=None, salida=False, sinmig=None):
    d = tempfile.mkdtemp(prefix='canario-cob-')
    for name, obj in (('inv.json', mini), ('lect.json', lect), ('lista.json', lista or LISTA)):
        json.dump(obj, open(os.path.join(d, name), 'w', encoding='utf-8'), ensure_ascii=False)
    extra = []
    if crea is not None:
        json.dump(crea, open(os.path.join(d, 'crea.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        extra = ['--crea-esquema=' + os.path.join(d, 'crea.json')]
    if sinmig is not None:
        json.dump(sinmig, open(os.path.join(d, 'sin.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        extra += ['--sin-migracion=' + os.path.join(d, 'sin.json')]
    r = subprocess.run([sys.executable, os.path.join(HERE, 'cobertura.py'), os.path.join(d, 'inv.json'), ADJ,
                        os.path.join(d, 'lect.json'), os.path.join(d, 'out.json'),
                        '--lista-solo-citables=' + os.path.join(d, 'lista.json')] + extra, capture_output=True, text=True)
    out = json.load(open(os.path.join(d, 'out.json'), encoding='utf-8')) if salida and os.path.exists(os.path.join(d, 'out.json')) else None
    shutil.rmtree(d)
    return (r.returncode, r.stdout + r.stderr, out) if salida else (r.returncode, r.stdout + r.stderr)


def tipos_canarios(mini, lect):
    """The type limits (triage of the open items, 2026-10-02). Each returns (ok, detail)."""
    from cobertura import SMOKE_RX, bloque, unstrike
    from defs import CREA_ESQUEMA
    base = {k: list(v) for k, v in CREA_ESQUEMA.items()}
    _, _, out = run(mini, lect, crea=base, salida=True)
    it = out['items']
    sin_b3 = {k: v for k, v in base.items() if k != 'B3'}
    res = []
    # 1. the owner does not create schema: the migration type moves to the «tambien» that does
    mp9 = it['DEC-MP-009']
    movido = [(x['tipo'], x['pieza']) for x in mp9['tipos_trasladados']]
    ok1 = mp9['pieza'] == 'B1' and ('migración desde cero', 'B3') in movido and 'migración desde cero' not in mp9['tipos_de_test_minimos']
    _, _, out2 = run(mini, lect, crea=sin_b3, salida=True)
    mp9b = out2['items']['DEC-MP-009']
    ok1b = not mp9b['tipos_trasladados'] and any(x['tipo'] == 'migración desde cero' for x in mp9b['tipos_descartados'])
    res.append(('T1', 'dueña que no crea esquema: la migración pasa a B3, que la crea (DEC-MP-009)', ok1, movido))
    res.append(('T1b', 'sin B3 en la lista, la misma migración se descarta (la regla no es ciega)', ok1b, mp9b['tipos_descartados']))
    # 2. the owner creates schema: the migration type stays with it (FILA:B2, «tabla versionada»)
    fb2 = it['FILA:B2']
    ok2 = fb2['pieza'] == 'B2' and 'migración desde cero' in fb2['tipos_de_test_minimos'] and not fb2['tipos_trasladados']
    sin_b2 = {k: v for k, v in base.items() if k != 'B2'}
    _, _, out3 = run(mini, lect, crea=sin_b2, salida=True)
    fb2b = out3['items']['FILA:B2']
    ok2b = 'migración desde cero' not in fb2b['tipos_de_test_minimos']
    res.append(('T2', 'dueña que crea esquema: la migración se queda (FILA:B2)', ok2, fb2['tipos_de_test_minimos']))
    res.append(('T2b', 'sin B2 en la lista, la migración deja de obligar a B2 (la regla no es ciega)', ok2b, fb2b['tipos_de_test_minimos']))
    # 3. CORTE takes only smoke manual or guard estático; the migration goes to V6, which provides it
    p3 = it['PASO:3']
    okc = p3['pieza'] == 'CORTE' and all(t.startswith(('smoke manual', 'guard estático', '≥1')) for t in p3['tipos_de_test_minimos']) \
        and ('migración desde cero', 'V6') in [(x['tipo'], x['pieza']) for x in p3['tipos_trasladados']]
    res.append(('T3', 'CORTE sólo lleva smoke o guard: la migración del paso 3 pasa a V6', okc, p3['tipos_trasladados']))
    # 4. a CI/merge gate takes no smoke from the word, though its text has one
    m1 = it['GATE:M1']
    i = next(x for x in mini['items'] if x['id'] == 'GATE:M1')
    a, b = bloque(i)
    tiene = bool(SMOKE_RX.search(unstrike(' '.join(lines(i['archivo'])[a - 1:b]))))
    okm = tiene and not any(t.startswith('smoke') for t in m1['tipos_de_test_minimos'])
    res.append(('T4', 'el momento 1 no toma smoke por la palabra, aunque su texto la tenga', okm, m1['tipos_de_test_minimos']))
    # 5. an item exempted with its cited reason loses the text-derived migration (DEC-ARCH-006)
    a6 = it['DEC-ARCH-006']
    ok5 = not any(t.startswith('migración') for t in a6['tipos_de_test_minimos']) and \
        any(x['por_que'].startswith('exento') for x in a6['tipos_descartados'])
    _, _, out5 = run(mini, lect, crea=base, salida=True, sinmig={})
    ok5b = any(t.startswith('migración') for t in out5['items']['DEC-ARCH-006']['tipos_de_test_minimos'])
    res.append(('T5', 'un ítem exento, con su cita, pierde la migración leída en su texto (DEC-ARCH-006)', ok5, a6['tipos_descartados']))
    res.append(('T5b', 'sin la exención, la misma migración vuelve (la regla no es ciega)', ok5b, out5['items']['DEC-ARCH-006']['tipos_de_test_minimos']))
    # 6. TRANS:B:S10, derived by script, carries B9b in «tambien» (BO)
    s10 = it['TRANS:B:S10']
    ok6 = s10['pieza'] == 'B8b' and ('B9b', 'implementa') in [(t['pieza'], t['rol']) for t in s10['tambien_lo_ejercen']]
    res.append(('T6', 'S10, derivada por script, lleva a B9b en «también» (BO)', ok6, s10['tambien_lo_ejercen']))
    return res


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
        citas=[c(VD, 63, rx_pieza('V3')), c(D16, ln(D16, V4_PIEZA), rx_pieza('V4'))])))
    can('C4', 'la pieza sólo la nombra una línea fuera de la partición (el log)', f=mut(lambda e: e['DEC-TRIAL-010'].update(
        citas=[c(LOG, by['DEC-TRIAL-010']['linea'], 'DEC-TRIAL-010'),
               c(LOG, ln(LOG, LOG_V4), rx_pieza('V4'))])))
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
    from defs import CREA_ESQUEMA
    crea = {k: list(v) for k, v in CREA_ESQUEMA.items()}
    canarios_c9 = [
        ('C9', 'una pieza que crea esquema con un fragmento que no está en su archivo', dict(crea, B2=[crea['B2'][0], 'texto inventado'])),
        ('C9', 'una pieza que crea esquema citada con la línea de otra pieza', dict(crea, V4=list(crea['B2']))),
    ]
    from defs import SIN_MIGRACION_DEL_TEXTO
    sinmal = {k: list(v) for k, v in SIN_MIGRACION_DEL_TEXTO.items()}
    sinmal['DEC-ARCH-006'] = [sinmal['DEC-ARCH-006'][0], 'fragmento inventado', 'x']

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
    for rule, name, cr in canarios_c9:
        code, out = run(mini, lect, crea=cr)
        ok = code == 1 and f'✗ {rule} ' in out
        fallas += not ok
        print(f'{"✓" if ok else "✗ CIEGO"} {rule:3} exit {code} · {name}')
    code, out = run(mini, lect, sinmig=sinmal)
    ok = code == 1 and '✗ C10 ' in out
    fallas += not ok
    print(f'{"✓" if ok else "✗ CIEGO"} C10 exit {code} · una exención con un fragmento que no está en su archivo')
    tc = tipos_canarios(mini, lect)
    for rule, name, ok, det in tc:
        fallas += not ok
        print(f'{"✓" if ok else "✗ CIEGO"} {rule:3} tipos · {name}' + ('' if ok else f'\n    {det}'))
    print(f'\n{len(canarios) + len(canarios_c9) + 1 + len(tc)} canarios · {fallas} fallas')
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main())
