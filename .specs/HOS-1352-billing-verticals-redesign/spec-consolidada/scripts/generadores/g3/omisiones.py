"""Writes omisiones.json next to it: per PARCIAL item of 04, the verbatim spans gen.py replaces by «[…]».

Owner letter BK (point 7 of DEC-METH-019 widened): a PARCIAL verdict with quote and hash makes the
consolidated spec omit what died with «[…]» and keep a note. The spans come from the verdict's
`muerto` in adjudicacion.json: every «quoted» passage of `muerto` is omitted as is (derived, not
listed here); EXTRA only adds the dead parts that `muerto` names without quoting them, each with
the words of `muerto` that justify it. gen.py fails if a PARCIAL item of 04 ends up with no span,
or if a span is not found exactly once in the item's text.
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
C = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
ADJ = json.load(open(C + '/_trabajo/adjudicacion.json', encoding='utf-8'))['veredictos']
ASG = json.load(open(C + '/_trabajo/asignacion.json', encoding='utf-8'))['items']

# Dead parts named but not quoted by `muerto`: {item: [(span, replacement, words of `muerto`)]}.
EXTRA = {
    'MP:EX-46': [('pasos 3, 4 y 4b', 'pasos […] y 4b', 'y los pasos 3 y 4 que nombra')],
}


# Prose sections of the source whose title names no id of the catalog they sit in (second blind-
# verification round, H2-G2-5, pattern P-I): gen.py attaches a section to the item its title names, or
# to the item its nearest titled ancestor names; the rest MUST be here, or gen.py fails. Keyed by
# «<short path>:<heading line>» at the frozen SHA. GENERAL marks the chapter-wide sections with no
# single row of their own: they go with the first item of the catalog, as gen.py used to do silently.
GENERAL = 'general del capítulo, sin fila propia: va con el primer ítem del catálogo'
_B03, _V03, _B05, _B20, _V20, _B02 = ('B/03-maquinas-de-estado.md', 'V/03-maquinas-de-estado.md',
                                      'B/05-idempotencia-y-concurrencia.md', 'B/20-testing.md',
                                      'V/20-testing.md', 'B/02-modelo-de-datos.md')
ADJUNTAR = {
    # B/03 §3: the subscription machine
    f'{_B03}:21': ('TRANS:B:S1', GENERAL),
    f'{_B03}:46': ('TRANS:B:S1', GENERAL),
    f'{_B03}:285': ('TRANS:B:S1', GENERAL + ' (una condición de toda fila que cancela en el proveedor)'),
    f'{_B03}:377': ('TRANS:B:S1', GENERAL + ' (el dominio de la sucesión, recorrido por la predecesora)'),
    f'{_B03}:886': ('TRANS:B:S11', 'la baja: sus cuatro filas son S11, S22, S23 y S24, y la primera es S11'),
    # third blind-verification round (H3-G2-10): a MIXTO section, struck title and live body; what is
    # alive is that S25-S28 left and «`S10` vuelve a ser la única salida de `PAUSED` por su evento»
    f'{_B03}:944': ('TRANS:B:S10', 'sección de título tachado con cuerpo vivo: «`S10` vuelve a ser la única salida '
                                   'de `PAUSED` por su evento»'),
    f'{_B03}:1484': ('PROH:B:1', GENERAL + ' (el cambio de plan que no se ofrece no es ninguna de las seis prohibidas)'),
    f'{_B03}:1520': ('TRANS:B:S1', 'las precisiones sobre `PENDING_AUTHORIZATION`, el estado al que entra S1'),
    f'{_B03}:1589': ('TRANS:B:S4', '«Entra por `S4`»: el grace nace de S4'),
    f'{_B03}:1656': ('TRANS:B:S8', '«Entra por S8 o S9»: la pausa nace de S8'),
    # B/03 §7: the manual payment. 7.1 is the late payment that reopens (MP4); 7.2 the instalment the
    # clock opens (MP5), except «cómo entra el grace», which is the first clause of MP3.
    f'{_B03}:1906': ('TRANS:B:MP4', '`DECLARED_UNPAID` que reabre: es MP4'),
    f'{_B03}:1931': ('TRANS:B:MP4', 'subsección de 7.1 (MP4)'),
    f'{_B03}:1990': ('TRANS:B:MP4', 'subsección de 7.1 (MP4)'),
    f'{_B03}:2012': ('TRANS:B:MP4', 'subsección de 7.1 (MP4)'),
    f'{_B03}:2068': ('TRANS:B:MP4', 'subsección de 7.1 (MP4)'),
    f'{_B03}:2095': ('TRANS:B:MP4', 'subsección de 7.1 (MP4)'),
    f'{_B03}:2111': ('TRANS:B:MP5', 'la cuota la abre el reloj: es MP5'),
    f'{_B03}:2142': ('TRANS:B:MP5', 'subsección de 7.2 (MP5): desde qué estados abre el reloj'),
    f'{_B03}:2179': ('TRANS:B:MP3', '«La primera cláusula de `MP3` sale de “se agota el grace”»'),
    f'{_B03}:2257': ('TRANS:B:MP5', 'subsección de 7.2 (MP5): la fecha del próximo cobro'),
    f'{_B03}:2410': ('TRANS:B:MP5', 'subsección de 7.2 (MP5): que el reloj no abra la cuota durante la pausa no contradice '
                                    '`B/06` §7 (la adjudicación proponía S8; la regla que defiende es la del reloj)'),
    f'{_B03}:2439': ('TRANS:B:MP5', 'subsección de 7.2 (MP5): el aviso de la cuota'),
    f'{_B03}:2462': ('TRANS:B:MP5', 'subsección de 7.2 (MP5)'),
    f'{_B03}:2505': ('TRANS:B:MP5', 'subsección de 7.2 (MP5)'),
    # B/03 §10 and the closing: the no-retreat rule and what the half does not close
    f'{_B03}:2689': ('TRANS:B:S1', GENERAL),
    f'{_B03}:2714': ('TRANS:B:S1', GENERAL),
    f'{_B03}:2748': ('TRANS:B:S1', GENERAL),
    f'{_B03}:2801': ('TRANS:B:S1', GENERAL),
    f'{_B03}:2833': ('TRANS:B:S1', GENERAL),
    f'{_B03}:2839': ('TRANS:B:S1', GENERAL),
    f'{_B03}:2849': ('TRANS:B:S1', GENERAL),
    # V/03: trial and publication
    f'{_V03}:91': ('TRANS:V:T1', GENERAL),
    f'{_V03}:123': ('TRANS:V:T2', 'la conversión con el primer pago acreditado: es T2'),
    f'{_V03}:655': ('TRANS:V:PB10', 'la moderación: PB10 es la primera de sus filas'),
    f'{_V03}:680': ('TRANS:V:PB10', 'la moderación en dos niveles (PB10)'),
    f'{_V03}:842': ('TRANS:V:PB1', 'publicar ocupa cupo: es PB1'),
    f'{_V03}:931': ('TRANS:V:PB3', 'cuáles vuelven cuando el cupo alcanza: es PB3'),
    f'{_V03}:1010': ('TRANS:V:PB7', 'las dos salidas de `ARCHIVED` son PB7 y PB8'),
    f'{_V03}:1146': ('TRANS:V:PB2', 'el reconciliador es la red de las filas que mueve `cubierto`, PB2 y PB3'),
    # B/05: locks and the late payment
    f'{_B05}:27': ('LOCK:C1', GENERAL),
    f'{_B05}:39': ('LOCK:C1', GENERAL),
    f'{_B05}:50': ('LOCK:C1', GENERAL),
    f'{_B05}:306': ('TRANS:B:S5', 'las cuatro condiciones del cap. 05 §3 son la condición de S5'),
    f'{_B05}:544': ('LOCK:C1', GENERAL),
    # B/20, V/20 and B/02: guards, the lying fake, the sandbox suite and the reconciliation flag
    f'{_B20}:447': ('GUARD:G7', GENERAL),
    f'{_V20}:352': ('GUARD:G1', GENERAL),
    f'{_B20}:466': ('M:M1', GENERAL),
    f'{_B20}:468': ('M:M1', GENERAL),
    f'{_B20}:482': ('M:M1', GENERAL),
    f'{_B20}:554': ('M:M1', GENERAL),
    f'{_B20}:566': ('M:M1', GENERAL),
    f'{_B20}:572': ('M:M1', GENERAL),
    f'{_B20}:618': ('M:M1', GENERAL),
    f'{_B20}:628': ('RP:RP1', GENERAL),
    f'{_B20}:651': ('RP:RP1', GENERAL),
    f'{_B02}:972': ('MOT:1', GENERAL),
}


def main():
    out = {}
    for cid, v in ADJ.items():
        if v['veredicto'] != 'PARCIAL' or not (ASG.get(cid, {}).get('destino') or '').startswith('04'):
            continue
        spans = [{'de': q, 'a': '[…]'} for q in re.findall(r'«([^»]+)»', v.get('muerto') or '')]
        for de, a, por in EXTRA.get(cid, []):
            assert por in v['muerto'], (cid, por)
            spans.append({'de': de, 'a': a})
        out[cid] = spans
    assert set(EXTRA) <= set(out), set(EXTRA) - set(out)
    # «hereda»: a sub-section with no id of its own inherits this destination; a GENERAL one does not
    # pass its default down, so a new sub-section under a general chapter still has to be listed.
    out['adjuntar'] = {k: {'a': a, 'por': por, 'hereda': not por.startswith(GENERAL)} for k, (a, por) in ADJUNTAR.items()}
    # indent=4 plus a final newline is exactly what the pre-commit's biome format leaves
    with open(os.path.join(HERE, 'omisiones.json'), 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=4)
        fh.write('\n')
    print(len(out) - 1, sum(len(s) for k, s in out.items() if k != 'adjuntar'), 'adjuntar', len(out['adjuntar']))


if __name__ == '__main__':
    main()
