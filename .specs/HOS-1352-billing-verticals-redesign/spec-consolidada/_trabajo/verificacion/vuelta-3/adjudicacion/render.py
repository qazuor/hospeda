#!/usr/bin/env python3
"""Render correcciones.txt and canarios-resultado.txt from hallazgos.json (round 3, HOS-1352)."""
import json
import os
from collections import Counter, defaultdict

D = os.path.dirname(os.path.abspath(__file__))
J = json.load(open(os.path.join(D, 'hallazgos.json'), encoding='utf-8'))
U = J['unicos']

GEN = {'01-decisiones-vigentes.md': 'scripts/generadores/g1/ (gen01.py, omisiones.json)',
       '04-catalogos.md': 'scripts/generadores/g3/gen.py (y el inventario)',
       '10-corte/B4.md': 'scripts/generadores/g8/src/B4.md', '10-corte/B5.md': 'scripts/generadores/g8/src/B5.md',
       '10-corte/B6.md': 'scripts/generadores/g8/src/B6.md', '10-corte/B7.md': 'scripts/generadores/g8/src/B7.md'}


def clase(x):
    return x['veredicto'] + (' ' + x['clase_final'] if x['clase_final'] else '')


# --- correcciones.txt --------------------------------------------------------------------------------
por = defaultdict(list)
for x in U:
    for k in x['correccion'] or []:
        por[k['archivo']].append((k['linea'] or 0, x, k))
out = ['# Correcciones de la adjudicación ciega, vuelta 3 (HOS-1352)', '',
       'Generado por `render.py` desde `hallazgos.json`. Líneas de la spec REAL (`v3-pristina` = HEAD',
       '`a10f010e78`, sin canarios); fuentes congeladas en `591034c665`. Toda `sale` se verificó contra su',
       'línea con `build.py`, y toda ancla de un `entra` existe. Un archivo *generado* se corrige en su',
       'generador, su `omisiones.json` o su fuente, nunca en el `.md`; B4–B7 se corrigen en `g8/src`, que',
       'tiene las mismas líneas; un tramo g-secciones se corrige en la fuente o en `secciones/` y se regenera.',
       '', '## Conteo', '']
cnt = Counter(clase(x) for x in U)
for k in ('REAL BLOQUEA', 'REAL MENOR', 'GENERADOR MENOR', 'FUENTE MENOR', 'FALSO', 'OWNER'):
    out.append(f'- {k}: {cnt.get(k, 0)}')
out += [f'- únicos: {len(U)}; hallazgos no canario agrupados: {sum(len(x["miembros"]) for x in U)}', '',
        '## Por archivo de la spec', '']
for f in sorted(por):
    g = GEN.get(f)
    out.append(f'### `{f}`' + (f' — generado: `{g}`' if g else ''))
    out.append('')
    for ln, x, k in sorted(por[f], key=lambda t: t[0]):
        out.append(f"- **{x['id']}** · {clase(x)} · l. {ln or '—'} — {x['resumen']}")
        if len(x['miembros']) > 1:
            out.append(f"  - agrupa: {', '.join(x['miembros'])}")
        if k.get('donde_va'):
            out.append(f"  - dónde: {k['donde_va']}")
        if k['sale']:
            out.append('  - sale:')
            out += ['    ' + s for s in k['sale'].split('\n')]
        out.append('  - entra:')
        out += ['    ' + s for s in k['entra'].split('\n')]
        out.append('')
out += ['## En las fuentes (residuos; piden otro SHA congelado)', '']
for x in U:
    for k in x.get('correccion_fuente') or []:
        out.append(f"- **{x['id']}** · `{k['archivo']}`" + (f":{k['linea']}" if k['linea'] else '') + f" — {k['nota']}")
out += ['', '## FALSO (sin corrección)', '']
for x in U:
    if x['veredicto'] == 'FALSO':
        out.append(f"- **{x['id']}** ({', '.join(x['verificadores'])}) — {x['resumen']} **Por qué es falso**: {x['causa']}. "
                   + ' · '.join(x['evidencia']))
out += ['', '## OWNER', '']
for x in U:
    if x['veredicto'] == 'OWNER':
        out.append(f"- **{x['id']}** → letra **{x['pregunta_owner']['letra']}** de `owner.txt`.")
out.append('')
open(os.path.join(D, 'correcciones.txt'), 'w', encoding='utf-8').write('\n'.join(out))

# --- canarios-resultado.txt --------------------------------------------------------------------------
C = J['canarios']
t = ['# Canarios de la vuelta 3 (HOS-1352): quién detectó cada uno', '',
     'Copia ciega `s/a10f010e/` con 42 canarios (`v3-canarios.txt`); salidas de los 26 verificadores en `v3/salidas/`.',
     '«Detectado» = algún verificador lo reportó como hallazgo, aunque fuera desde otro bloque. Cada atribución',
     'se confirmó leyendo el hallazgo (la regla que nombra), no por cercanía de línea.', '',
     '| # | bloque | tipo | dónde (copia) | detectado por | su bloque |', '|---|---|---|---|---|---|']
for i, c in enumerate(C, 1):
    det = ', '.join(c['detectado_por']) if c['detectado_por'] else '**NO DETECTADO**'
    if c['nota']:
        det += f" ({c['nota']})"
    t.append(f"| {i} | {c['bloque']} | {c['tipo']} | {c['donde']} | {det} | {'sí' if c['por_su_bloque'] else 'no'} |")
t += ['', '## Tasas', '', '| dirección | canarios | detectados por alguien | detectados por su propio bloque |', '|---|---|---|---|']
tot = [0, 0, 0]
for nombre, pref in (('VB (spec → fuente)', 'VB'), ('G (generados)', 'G'), ('VA (fuente → spec)', 'VA')):
    s = [c for c in C if c['bloque'].startswith(pref) and (pref != 'G' or c['bloque'] in ('G1', 'G2'))]
    n, d, o = len(s), sum(c['detectado'] for c in s), sum(c['por_su_bloque'] for c in s)
    tot = [tot[0] + n, tot[1] + d, tot[2] + o]
    t.append(f'| {nombre} | {n} | {d} ({100 * d / n:.1f} %) | {o} ({100 * o / n:.1f} %) |')
t.append(f'| **total** | {tot[0]} | {tot[1]} ({100 * tot[1] / tot[0]:.1f} %) | {tot[2]} ({100 * tot[2] / tot[0]:.1f} %) |')
t += ['', '## No detectados (falsos negativos)', '',
      '- **VA-A2 · `30-el-corte.md:60`** (OMITE): «Sondear por SMTP no sirve.», del paso 0 (la medición de `EX-49`).',
      '  VA-A2 recorrió `16-fase-7` 1–1212 y declaró ~180 reglas revisadas con 0 ausentes; VB-14 leyó `30-el-corte`',
      '  entero y no lo vio. Es una prohibición de MÉTODO dentro de un párrafo largo de procedimiento (cuentas',
      '  receptoras, Message-ID, «nada a los 30 minutos»): sin un verbo normativo fuerte, el cotejo la leyó como',
      '  narración. La vuelta 2 tuvo el mismo patrón (VA-A3, la cláusula «un rechazo no escribe nada»).',
      '', '## Detectados sólo fuera de su bloque', '',
      '- **VA-A3** (desempate de las fichas que vuelven, 04:944), **VA-A5** (fila sin fecha = `UNKNOWN`, 04:7982) y',
      '  **VA-A10** (simulación prendida por defecto, 04:6384): los tres los vio sólo **G2**, y los tres viven en el',
      '  **texto adjunto de 04-catalogos** (notas que g3 cuelga de un ítem). Los VA cotejan su capítulo contra las',
      '  piezas y contra las filas del catálogo, pero no contra los adjuntos: es el mismo hueco de la vuelta 2',
      '  (VA-A7, el empate, sólo lo vieron G1 y G2).',
      '', '## Detección parcial', '',
      '- **VA-A6** (`cobros_restantes` nunca negativo): VA-A6 vio el ESQ:6 (B3:956) y no la mitad del TEST:B3:31',
      '  (B3:1283, «y rechaza un negativo»).',
      '- **VA-A9** (la ventana de 60 días no aplica al cambio elegido): VA-A9 y G2 vieron B12:163; la viñeta de Reglas',
      '  de B8b (:816) no la nombró nadie, aunque VA-A9 cita AC:B8b:7 como cobertura.',
      '', '## Clase asignada por los verificadores', '',
      '- Tres canarios OMITE se reportaron **MENOR** por su propio bloque y **BLOQUEA** por G2: VA-A8-3 (el receptor',
      '  de hoy, «decisión de no-trabajo»), VA-A9-2 («sin efecto práctico», contra G2-3) y VA-A6-4 («el camino normal',
      '  no cambia»). Los tres argumentos son ciertos en el camino normal; no cambian la tasa, y como el',
      '  criterio de la vuelta 2 pone BLOQUEA cuando la pieza y su Fuente pierden la regla, la clase está',
      '  subestimada en los tres.',
      '- Los 32 canarios VB y G se reportaron todos **BLOQUEA**.',
      '', '## Comparación con la vuelta 2', '',
      '| dirección | vuelta 2 (alguien / propio) | vuelta 3 (alguien / propio) |', '|---|---|---|',
      '| VB | 26/28 / 26/28 | 28/28 / 28/28 |', '| G | 4/4 / 4/4 | 4/4 / 4/4 |', '| VA | 9/10 / 5/10 | 9/10 / 6/10 |',
      '| total | 39/42 / 35/42 | 41/42 / 38/42 |', '']
open(os.path.join(D, 'canarios-resultado.txt'), 'w', encoding='utf-8').write('\n'.join(t))
print('ok', sum(len(v) for v in por.values()), 'correcciones en', len(por), 'archivos;', tot)
