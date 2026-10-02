#!/usr/bin/env python3
"""Canaries for trazar.py: a minimal spec that passes (exit 0), and one mutation per rule that
must make it fail (exit 1) naming that rule. A canary that passes is a blind rule.

    python3 canarios.py [inventario.json]

The fixture uses REAL inventory items (so R6 reads real source lines at the frozen SHA): one
piece (B2) with its row, its exit criterion and its guard, a decision, an invariant, a
transition, a forbidden transition, a MIXTO term (adjudicated), a dead row and one section.
"""
import copy
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
INV = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '_trabajo', 'inventario.json')

IDS = ['DEC-SUB-008', 'INV:1', 'TRANS:B:S2', 'PROH:B:1', 'GUARD:G7', 'LISTA:B2', 'PIEZA:B2',
       'FILA:B2', 'PLAZO:16', 'L:L1', 'INV:17', 'PASO:0', 'OWN:28-fase-9-vuelta-1:t1:📌A',
       'SEC:.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:40']
SEC51 = 'SEC:.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:51'
PLANTILLA_TXT = None


def item(inv, cid):
    return next(i for i in inv['items'] if i['id'] == cid)


def origen(it):
    return f"Origen: {it['archivo']}:{it['linea']}"


def fixture(inv):
    from defs import PLANTILLA
    I = {c: item(inv, c) for c in IDS}
    files = {}
    files['01-decisiones-vigentes.md'] = f"""# Decisiones vigentes

<a id="dec-sub-008"></a>
**DEC-SUB-008** — el downgrade muta el monto ya.
{origen(I['DEC-SUB-008'])}

<a id="own-28-fase-9-vuelta-1-t1-pa"></a>
**📌 A** — letra del owner cuyo id local lleva un blanco.
{origen(I['OWN:28-fase-9-vuelta-1:t1:📌A'])}
"""
    files['02-nucleo.md'] = f"""# Núcleo

<a id="inv-1"></a>
**INV:1** — invariante uno.
{origen(I['INV:1'])}

<a id="plazo-16"></a>
**PLAZO:16** — plazo dieciséis (adjudicado VIVO).
{origen(I['PLAZO:16'])}

<a id="inv-17"></a>
**INV:17** — sólo citable (owner BA).
{origen(I['INV:17'])}
"""
    files['03-contrato-de-cobertura.md'] = """# Contrato de cobertura

Sólo citables (owner BA y BB): [INV:17](02-nucleo.md#inv-17)
"""
    files['30-el-corte.md'] = f"""# El corte

<a id="paso-0"></a>
**Paso 0** — el ensayo.
{origen(I['PASO:0'])}

<a id="ac-corte-1"></a>
**AC:CORTE:1**
- Dado el ensayo en staging
- Cuando corre el paso 0
- Entonces termina verde
Fuente: [paso-0](30-el-corte.md#paso-0)

<a id="test-corte-1"></a>
**TEST:CORTE:1**
Tipo: smoke manual
Etiqueta: staging
Cubre: [AC:CORTE:1](30-el-corte.md#ac-corte-1)
Fuente: [paso-0](30-el-corte.md#paso-0)
"""
    files['04-catalogos.md'] = f"""# Catálogos

<a id="trans-b-s2"></a>
**S2** — transición.
{origen(I['TRANS:B:S2'])}

<a id="proh-b-1"></a>
**PROH:B:1** — no existe.
{origen(I['PROH:B:1'])}

<a id="guard-g7"></a>
**G7** — guard del precio.
{origen(I['GUARD:G7'])}
"""
    files['90-retirados.md'] = f"""# Retirados

<a id="l-l1"></a>
**L1** — tabla de traducción, retirada.
{origen(I['L:L1'])}
"""
    files['80-abiertos.md'] = '# Abiertos\n\nNinguno.\n'
    ref = lambda s, f: f'[{s}]({f}#{s})'  # noqa: E731
    secciones = []
    for h in PLANTILLA:
        if h == 'Historias de usuario y criterios de aceptación':
            body = f"""<a id="pieza-b2"></a>
**B2** es pieza del corte.
{origen(I['PIEZA:B2'])}

<a id="fila-b2"></a>
Lo que deja funcionando.
{origen(I['FILA:B2'])}

<a id="lista-b2"></a>
Lista cuando.
{origen(I['LISTA:B2'])}

<a id="us-b2-1"></a>
**US:B2:1** — como admin quiero un precio.
Actor: admin
Fuente: {ref('dec-sub-008', '../01-decisiones-vigentes.md')}

<a id="ac-b2-1"></a>
**AC:B2:1**
- Dado un plan
- Cuando cambia el precio
- Entonces el monto se muta
Fuente: {ref('dec-sub-008', '../01-decisiones-vigentes.md')} {ref('inv-1', '../02-nucleo.md')} {ref('trans-b-s2', '../04-catalogos.md')} {ref('proh-b-1', '../04-catalogos.md')} {ref('guard-g7', '../04-catalogos.md')} {ref('lista-b2', 'B2.md')} {ref('plazo-16', '../02-nucleo.md')} {ref('fila-b2', 'B2.md')}
"""
        elif h == 'Testing esperado':
            body = f"""<a id="test-b2-1"></a>
**TEST:B2:1**
Tipo: integración con DB
Cubre: [AC:B2:1](B2.md#ac-b2-1)
Fuente: {ref('trans-b-s2', '../04-catalogos.md')}

<a id="test-b2-2"></a>
**TEST:B2:2**
Tipo: guard estático
Mutación: se agrega un ciclo sin monto entero y el guard falla
Cubre: [AC:B2:1](B2.md#ac-b2-1)
Fuente: {ref('guard-g7', '../04-catalogos.md')}
"""
        elif h == 'Smoke y etiquetas':
            body = """<a id="test-b2-3"></a>
**TEST:B2:3**
Tipo: smoke manual
Etiqueta: staging
Cubre: [AC:B2:1](B2.md#ac-b2-1)
Fuente: [dec-sub-008](../01-decisiones-vigentes.md#dec-sub-008)
"""
        else:
            body = 'N/A — no aplica a esta pieza de prueba.'
        secciones.append(f'## {h}\n\n{body}\n')
    files['10-corte/B2.md'] = '# B2\n\n' + '\n'.join(secciones)
    mini = dict(sha=inv['sha'], items=[copy.deepcopy(I[c]) for c in IDS])
    adj = {'veredictos': {'PLAZO:16': dict(veredicto='VIVO', hash=I['PLAZO:16']['hash'])}}
    # the coverage map (cobertura.py): every normative item of the fixture is owned by B2
    cob = {'items': {c: {'pieza': 'B2', 'tipos_exigidos_por_familia': ['≥1 de cualquier tipo de la lista cerrada'],
                         'tipos_solo_del_texto': []}
                     for c in IDS if not c.startswith(('PIEZA:', 'L:', 'SEC:', 'INV:17', 'PASO:', 'OWN:'))}}
    cob['items']['TRANS:B:S2']['tipos_exigidos_por_familia'] = ['integración con DB']
    cob['items']['GUARD:G7']['tipos_exigidos_por_familia'] = ['guard estático']
    cob['items']['DEC-SUB-008']['tipos_solo_del_texto'] = ['smoke manual · staging']
    cob['items']['PASO:0'] = {'pieza': 'CORTE'}
    return files, mini, adj, cob


LISTA = {'INV:17': ['BA', '`INV:17`']}  # the closed list of the fixture (replaces defs.SOLO_CITABLES)


def run(files, mini, adj, cob, lista=None):
    d = tempfile.mkdtemp(prefix='canario-')
    spec = os.path.join(d, 'spec')
    for rel, txt in files.items():
        p = os.path.join(spec, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, 'w', encoding='utf-8').write(txt)
    json.dump(mini, open(os.path.join(d, 'inv.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(adj, open(os.path.join(d, 'adj.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(cob, open(os.path.join(d, 'cob.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(lista or LISTA, open(os.path.join(d, 'lista.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    r = subprocess.run([sys.executable, os.path.join(HERE, 'trazar.py'), os.path.join(d, 'inv.json'),
                        os.path.join(d, 'adj.json'), spec, '--cobertura=' + os.path.join(d, 'cob.json'),
                        '--lista-solo-citables=' + os.path.join(d, 'lista.json')],
                       capture_output=True, text=True)
    shutil.rmtree(d)
    return r.returncode, r.stdout + r.stderr


def sub(files, rel, old, new, count=1):
    f = dict(files)
    assert old in f[rel], f'canary text not found in {rel}: {old[:40]}'
    f[rel] = f[rel].replace(old, new, count)
    return f


def main():
    sys.path.insert(0, HERE)
    inv = json.load(open(INV, encoding='utf-8'))
    files, mini, adj, cob = fixture(inv)
    B2 = '10-corte/B2.md'
    canarios = []

    def c(rule, name, f=None, m=None, a=None, k=None, li=None, aviso=None, sin=None):
        canarios.append((rule, name, f or files, m or mini, a or adj, k or cob, li, aviso, sin))

    c('R1', 'un ítem vivo definido dos veces', sub(files, '04-catalogos.md', '<a id="guard-g7"></a>',
      '<a id="guard-g7"></a>\nx\nOrigen: x.md:1\n\n<a id="guard-g7"></a>'))
    c('R1', 'un ítem vivo definido sólo en 90-retirados',
      sub(sub(files, '04-catalogos.md', '<a id="proh-b-1"></a>', ''), '90-retirados.md', '# Retirados',
          '# Retirados\n\n<a id="proh-b-1"></a>\n' + origen(item(inv, 'PROH:B:1'))))
    c('R2', 'un ítem muerto definido fuera de 90-retirados',
      sub(sub(files, '90-retirados.md', '<a id="l-l1"></a>', ''), '04-catalogos.md', '# Catálogos',
          '# Catálogos\n\n<a id="l-l1"></a>\n' + origen(item(inv, 'L:L1'))))
    c('R3', 'un MIXTO sin adjudicar', a={'veredictos': {}})
    c('R3', 'una adjudicación con el hash de otra línea',
      a={'veredictos': {'PLAZO:16': dict(veredicto='VIVO', hash='0' * 64)}})
    c('R3', 'un veredicto fuera de VIVO|MUERTO|PARCIAL',
      a={'veredictos': {'PLAZO:16': dict(veredicto='QUIZÁS', hash=item(inv, 'PLAZO:16')['hash'])}})
    m = copy.deepcopy(mini)
    fake = hashlib.sha256(b'otra').hexdigest()
    next(i for i in m['items'] if i['id'] == 'PLAZO:16')['hash'] = fake
    c('R3b', 'la fuente cambió desde el SHA (hash del inventario ≠ árbol de trabajo)', m=m,
      a={'veredictos': {'PLAZO:16': dict(veredicto='VIVO', hash=fake)}})
    c('R4', 'una referencia colgada', sub(files, B2, 'Lo que deja funcionando.',
      'Lo que deja funcionando, ver [X](../04-catalogos.md#no-existe).'))
    c('R5', 'un ancla inventada con Origen', sub(files, '01-decisiones-vigentes.md', '# Decisiones vigentes',
      '# Decisiones vigentes\n\n<a id="dec-sub-999"></a>\nInventada.\nOrigen: x.md:1\n'))
    c('R6', 'una definición sin Origen', sub(files, '02-nucleo.md', origen(item(inv, 'INV:1')), ''))
    c('R6', 'un Origen que no cita la posición del ítem', sub(files, '02-nucleo.md',
      origen(item(inv, 'INV:1')), f"Origen: {item(inv, 'INV:1')['archivo']}:43"))
    m = copy.deepcopy(mini)
    next(i for i in m['items'] if i['id'] == 'DEC-SUB-008')['local'] = 'DEC-SUB-009'
    c('R6', 'la línea citada no contiene el id local', m=m)
    m = copy.deepcopy(mini)
    next(i for i in m['items'] if i['id'] == 'OWN:28-fase-9-vuelta-1:t1:📌A')['local'] = '📌A'
    c('R6', 'una letra del owner guardada sin su blanco («📌A» por «📌 A»)', m=m)
    c('R7', 'un ítem normativo vivo sin AC', sub(files, B2, "[inv-1](../02-nucleo.md#inv-1)", ''))
    k = copy.deepcopy(cob)
    k['items']['INV:1']['pieza'] = 'B3'
    c('R7b', 'el AC que cita el ítem está en otra pieza que la dueña de cobertura.json', k=k)
    k = copy.deepcopy(cob)
    k['items']['GUARD:G7']['pieza'] = 'B99'
    c('R7b', 'cobertura.json le da al ítem una pieza sin ningún AC', k=k)
    c(None, 'un ítem de la lista cerrada que igual recibe un AC pasa', sub(files, B2,
      "{ref}".format(ref="[fila-b2](B2.md#fila-b2)"), "[fila-b2](B2.md#fila-b2) [inv-17](../02-nucleo.md#inv-17)"))
    c('R7', 'el mismo ítem fuera de la lista cerrada y sin AC falla', li={'INV:1': ['BA', '`INV:17`']})
    c('R7c', 'una lista cerrada con un ítem que no existe', li={'INV:17': ['BA', '`INV:17`'], 'INV:999': ['BA', '`INV:17`']})
    c('R7c', 'una lista cerrada cuyo fragmento no está en la fila de su letra', li={'INV:17': ['BA', '`INV:18`']})
    c('R7c', 'un ítem de la lista sin declarar en 03-contrato-de-cobertura.md',
      sub(files, '03-contrato-de-cobertura.md', '[INV:17](02-nucleo.md#inv-17)', ''))
    c('R11', 'un AC:CORTE definido fuera de 30-el-corte.md', sub(sub(files, '30-el-corte.md',
      '<a id="ac-corte-1"></a>\n**AC:CORTE:1**\n- Dado el ensayo en staging\n- Cuando corre el paso 0\n- Entonces termina verde\n'
      'Fuente: [paso-0](30-el-corte.md#paso-0)\n', ''), B2, '<a id="us-b2-1"></a>',
      '<a id="ac-corte-1"></a>\n**AC:CORTE:1**\n- Dado x\n- Cuando y\n- Entonces z\nFuente: [paso-0](../30-el-corte.md#paso-0)\n\n'
      '<a id="us-b2-1"></a>'))
    c('R11', 'una US de CORTE', sub(files, '30-el-corte.md', '<a id="ac-corte-1"></a>',
      '<a id="us-corte-1"></a>\n**US:CORTE:1**\nActor: admin\nFuente: [paso-0](30-el-corte.md#paso-0)\n\n<a id="ac-corte-1"></a>'))
    c('R12', 'un TEST:CORTE que no es smoke manual ni guard estático', sub(files, '30-el-corte.md',
      'Tipo: smoke manual\nEtiqueta: staging', 'Tipo: unitario'))
    k = copy.deepcopy(cob)
    k['items']['PASO:0']['pieza'] = 'B2'
    c('R7b', 'un ítem del corte cuyo AC está en CORTE pero cobertura.json lo da a B2', k=k)
    c('R8', 'un AC sin test', sub(sub(sub(files, B2, 'Cubre: [AC:B2:1](B2.md#ac-b2-1)', 'Cubre:'),
      B2, 'Cubre: [AC:B2:1](B2.md#ac-b2-1)', 'Cubre:'), B2, 'Cubre: [AC:B2:1](B2.md#ac-b2-1)', 'Cubre:'))
    f = sub(files, B2, '<a id="test-b2-1"></a>',
            '<a id="ac-b2-2"></a>\n**AC:B2:2**\n- Dado algo\n- Cuando pasa\n- Entonces inventado\nFuente:\n\n'
            '<a id="test-b2-1"></a>')
    c('R9', 'un AC inventado, sin fuente (y con test, para que sólo falte la fuente)',
      sub(f, B2, 'Cubre: [AC:B2:1](B2.md#ac-b2-1)\nFuente: [trans',
          'Cubre: [AC:B2:1](B2.md#ac-b2-1) [AC:B2:2](B2.md#ac-b2-2)\nFuente: [trans'))
    c('R9', 'un test que cita sólo un ancla de US (no un ítem fuente)', sub(files, B2,
      "Fuente: [trans-b-s2](../04-catalogos.md#trans-b-s2)\n", 'Fuente: [US](B2.md#us-b2-1)\n'))
    f = sub(files, B2, '<a id="us-b2-1"></a>\n**US:B2:1** — como admin quiero un precio.\nActor: admin\n'
            "Fuente: [dec-sub-008](../01-decisiones-vigentes.md#dec-sub-008)\n", '')
    c('R10', 'una US dentro de 80-abiertos', sub(f, '80-abiertos.md', 'Ninguno.',
      '<a id="us-b2-1"></a>\n**US:B2:1** — pregunta\nActor: admin\n'
      'Fuente: [dec-sub-008](01-decisiones-vigentes.md#dec-sub-008)'))
    c('R11', 'un AC sin Entonces', sub(files, B2, '- Entonces el monto se muta\n', ''))
    c('R11', 'una US con un actor fuera de la lista', sub(files, B2, 'Actor: admin', 'Actor: cliente'))
    c('R11', 'un AC cuyo id visible no coincide con el ancla', sub(files, B2, '**AC:B2:1**', '**AC:B2:7**'))
    c('R11', 'una pieza sin AC de salida', sub(files, B2, "[lista-b2](B2.md#lista-b2)", ''))
    c('R11', 'un AC de una pieza inexistente', sub(files, B2, '<a id="us-b2-1"></a>',
      '<a id="ac-b99-1"></a>\n**AC:B99:1**\n\n<a id="us-b2-1"></a>'))
    c('R12', 'un tipo de test fuera de la lista cerrada', sub(files, B2, 'Tipo: integración con DB', 'Tipo: integración'))
    c('R12', 'un smoke sin etiqueta', sub(files, B2, 'Etiqueta: staging\n', ''))
    c('R13', 'una invariante sin test (citada por un AC sin test)',
      sub(sub(files, B2, "[inv-1](../02-nucleo.md#inv-1)", ''), B2, '<a id="test-b2-1"></a>',
          '<a id="ac-b2-3"></a>\n**AC:B2:3**\n- Dado x\n- Cuando y\n- Entonces z\n'
          'Fuente: [inv-1](../02-nucleo.md#inv-1)\n\n<a id="test-b2-1"></a>'))
    c('R14', 'una transición sin test de integración con DB', sub(files, B2, 'Tipo: integración con DB', 'Tipo: unitario'))
    c('R15', 'un guard sin prueba de mutación', sub(files, B2,
      'Mutación: se agrega un ciclo sin monto entero y el guard falla\n', ''))
    c('R16', 'una sección de la plantilla borrada', sub(files, B2, '## Seguridad\n\nN/A — no aplica a esta pieza de prueba.\n', ''))
    c('R16', 'un N/A sin razón', sub(files, B2, '## Seguridad\n\nN/A — no aplica a esta pieza de prueba.', '## Seguridad\n\nN/A —'))
    f = dict(files)
    f['20-fase-1/B2.md'] = f.pop(B2).replace('../', '../')
    c('R16', 'una pieza del corte en la carpeta de una fase posterior', f)
    m = copy.deepcopy(mini)
    m['items'].append(dict(next(i for i in inv['items'] if i['id'] ==
                                'SEC:.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:51')))
    c('R17', 'una sección del diseño sin ninguna línea citada', m=m)
    prosa = f"\n## Prosa del núcleo\n\nTexto sin ítem.\nOrigen: {item(inv, SEC51)['archivo']}:{item(inv, SEC51)['linea'] + 1}\n"
    c(None, 'esa sección, citada por un Origen de prosa fuera de todo bloque, pasa',
      sub(files, '02-nucleo.md', origen(item(inv, 'INV:17')) + '\n', origen(item(inv, 'INV:17')) + '\n' + prosa), m=m)
    c('R17', 'el mismo Origen dentro de un bloque de código no cuenta',
      sub(files, '02-nucleo.md', origen(item(inv, 'INV:17')) + '\n',
          origen(item(inv, 'INV:17')) + '\n' + prosa.replace('Origen:', '```\nOrigen:') + '```\n'), m=m)
    f = dict(files)
    f['scripts/generadores/g8/src/B2.md'] = files[B2]
    c(None, 'la plantilla de un generador en scripts/ (anclas y Origen repetidos) no es la spec: pasa', f)
    k = copy.deepcopy(cob)
    k['items']['INV:1']['tipos_exigidos_por_familia'] = ['migración desde cero']
    c('R18', 'un ítem sin el tipo de test que AN exige por su familia', k=k)
    k = copy.deepcopy(cob)
    k['items']['INV:1']['tipos_solo_del_texto'] = ['e2e web']
    c(None, 'un tipo derivado sólo del texto que falta pasa, con aviso', k=k, aviso='⚠ R18 ')
    k = copy.deepcopy(cob)
    k['items']['DEC-SUB-008']['tipos_exigidos_por_familia'] = ['smoke manual · prod']
    c('R18', 'un smoke con la etiqueta equivocada no cumple el tipo «smoke manual · prod»', k=k)

    # R19: a PARCIAL verdict whose dead span is still in its block
    h8 = item(inv, 'DEC-SUB-008')['hash']
    a19 = copy.deepcopy(adj)
    a19['veredictos']['DEC-SUB-008'] = dict(veredicto='PARCIAL', hash=h8, muerto='«el downgrade muta el monto ya»: lo supera otra')
    c('R19', 'un PARCIAL cuyo texto muerto sigue en el cuerpo de su bloque', a=a19)
    f19 = sub(files, '01-decisiones-vigentes.md', '**DEC-SUB-008** — el downgrade muta el monto ya.',
              '**DEC-SUB-008** — […]\n\n> **Parte sin efecto** (adjudicación `PARCIAL`): «el downgrade muta el monto ya».')
    c(None, 'el mismo PARCIAL omitido con «[…]» y citado sólo en su nota pasa', f19, a=a19)
    a19b = copy.deepcopy(adj)
    a19b['veredictos']['DEC-SUB-008'] = dict(veredicto='PARCIAL', hash=h8, muerto='otra parte; «el downgrade muta el monto ya» sigue')
    c(None, 'un tramo que el veredicto da por vivo («…» sigue) pasa', a=a19b)

    # R20: a struck span of a frozen source alive in the spec (first blind-verification round)
    from trazar import r20_tramos
    t20 = sorted(r20_tramos())[0]  # deterministic: the first span in order, whatever the freeze
    c('R20', 'un tramo tachado de una fuente, vivo en la spec', sub(files, '02-nucleo.md', 'invariante uno.', f'invariante uno, {t20}.'))
    c(None, 'el mismo tramo en 90-retirados pasa', sub(files, '90-retirados.md', 'tabla de traducción, retirada.',
      f'tabla de traducción, retirada: {t20}.'))
    c(None, 'el mismo tramo tachado en la spec pasa', sub(files, '02-nucleo.md', 'invariante uno.', f'invariante uno, ~~{t20}~~.'))

    # R21 and R17: a section announced with «:» and only its Origen
    sec = item(inv, SEC51)
    vacia = (f"\n## Secciones asignadas\n\nLas secciones del capítulo que la fila le asigna:\n\n"
             f"Origen: {sec['archivo']}:{sec['linea'] + 1}\n")
    f21 = sub(files, '02-nucleo.md', origen(item(inv, 'INV:17')) + '\n', origen(item(inv, 'INV:17')) + '\n' + vacia)
    c('R21', 'un «:» seguido directo de Origen: (sección sin cuerpo)', f21)
    m = copy.deepcopy(mini)
    m['items'].append(dict(sec))
    c('R17', 'ese Origen sin cuerpo no cubre su sección', f21, m=m)
    c(None, 'con un cuerpo entre el «:» y el Origen, la sección queda cubierta y pasa',
      sub(files, '02-nucleo.md', origen(item(inv, 'INV:17')) + '\n', origen(item(inv, 'INV:17')) + '\n'
          + vacia.replace('le asigna:\n\n', 'le asigna:\n\nEl texto de la sección, escrito.\n')), m=m)

    # R22 (warning): an AC whose «Entonces» remits to a chapter section
    ac22 = ('<a id="ac-b2-9"></a>\n**AC:B2:9**\n- Dado un plan\n- Cuando cambia el precio\n- Entonces {e}\n'
            'Fuente: [dec-sub-008](../01-decisiones-vigentes.md#dec-sub-008)\n\n<a id="test-b2-1"></a>')
    f22 = lambda e: sub(sub(files, B2, '<a id="test-b2-1"></a>', ac22.format(e=e)), B2,  # noqa: E731
                        'Cubre: [AC:B2:1](B2.md#ac-b2-1)\nFuente: [trans', 'Cubre: [AC:B2:1](B2.md#ac-b2-1) [AC:B2:9](B2.md#ac-b2-9)\nFuente: [trans')
    c(None, 'un AC que remite a `B/12` §3.2 sin enunciar la regla pasa, con aviso',
      f22('se aplica según `B/12` §3.2'), aviso='⚠ R22 ')
    c(None, 'el mismo AC con la regla enunciada pasa sin aviso (la regla no es ciega)',
      f22('el monto que se mutó al pedir el descenso se conserva hasta el fin del ciclo y ningún aumento entra por esa puerta (`B/12` §3.2)'),
      sin='⚠ R22 ')

    code, out = run(files, mini, adj, cob)
    print(f'{"✓" if code == 0 else "✗"} base: exit {code}' + ('' if code == 0 else '\n' + out))
    fallas = 0 if code == 0 else 1
    for rule, name, f, m, a, k, li, aviso, sin in canarios:
        code, out = run(f, m, a, k, li)
        ok = (code == 0) if rule is None else (code == 1 and f'✗ {rule} ' in out)
        ok = ok and (aviso is None or aviso in out) and (sin is None or sin not in out)
        fallas += not ok
        print(f'{"✓" if ok else "✗ CIEGO"} {rule or "pasa":4} exit {code} · {name}')
        if not ok:
            print('   ', out.strip().replace('\n', '\n    '))
    print(f'\n{len(canarios)} canarios · {fallas} fallas')
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main())
