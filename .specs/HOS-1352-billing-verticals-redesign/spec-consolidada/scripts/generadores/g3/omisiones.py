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
    # indent=4 plus a final newline is exactly what the pre-commit's biome format leaves
    with open(os.path.join(HERE, 'omisiones.json'), 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=4)
        fh.write('\n')
    print(len(out), sum(len(s) for s in out.values()))


if __name__ == '__main__':
    main()
