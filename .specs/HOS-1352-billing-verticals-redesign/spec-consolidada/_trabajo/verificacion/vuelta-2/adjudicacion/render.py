#!/usr/bin/env python3
"""Add canaries and the owner question to hallazgos.json and render correcciones.txt from it."""
import json
import os
from collections import defaultdict

D = os.path.dirname(os.path.abspath(__file__))
J = json.load(open(os.path.join(D, 'hallazgos.json'), encoding='utf-8'))

CANARIOS = [
    # (bloque, dónde, tipo, detectado_por)
    ('VB-01', '00-indice.md:463 (sub-épicas cortan de staging)', 'MODIFICA', ['VB-01']),
    ('VB-01', '02-nucleo-glosario.md:41 (hasta diez fichas por vertical)', 'AGREGA', ['VB-01', 'VA-A1']),
    ('VB-02', '02-nucleo.md:1570 (PLAZO:5 10, 5, 3 y 0)', 'MODIFICA', ['VB-02', 'VA-A1']),
    ('VB-02', '02-nucleo-auditoria.md:43 (un evento por sesión)', 'AGREGA', ['VB-02', 'VA-A1']),
    ('VB-03', '03-contrato-de-cobertura.md:93 (el reloj es nuestro)', 'MODIFICA', ['VB-03', 'VA-A2']),
    ('VB-03', '02-nucleo-modelo-y-maquinas.md:69 (precio de piso en el catálogo)', 'AGREGA', ['VB-03', 'VA-A1']),
    ('VB-04', '10-corte/U1.md:27 (cuatro package.json)', 'MODIFICA', ['VB-04']),
    ('VB-04', '10-corte/U2.md:25 (tope diario global)', 'AGREGA', ['VB-04']),
    ('VB-05', '10-corte/V4.md:536 (techo de trial por user sumando verticales)', 'MODIFICA', ['VB-05', 'VA-A4']),
    ('VB-05', '10-corte/V3.md:467 (clave global 30 días tras vencer el addon)', 'AGREGA', ['VB-05', 'VA-A4']),
    ('VB-06', '10-corte/V5.md:711 (responde prohibido)', 'MODIFICA', ['VB-06', 'VA-A4']),
    ('VB-06', '10-corte/V6.md:872 (reconciliador a lo sumo una vez por hora)', 'AGREGA', ['VB-06', 'VA-A4']),
    ('VB-07', '10-corte/V8a.md:388 (MODERATED: no editarla ni borrarla)', 'MODIFICA', ['VB-07', 'VA-A4', 'VA-A5']),
    ('VB-07', '20-fase-4/V7.md:416 (Silver, tope de tres enlaces)', 'AGREGA', ['VB-07']),
    ('VB-08', '10-corte/B2.md:199 (plazo 15 = 48 h)', 'MODIFICA', ['VB-08']),
    ('VB-08', '10-corte/B3.md:300 (prórroga única de 24 h)', 'AGREGA', ['VB-08']),
    ('VB-09', '10-corte/B6.md:327 (buscador de seis meses)', 'MODIFICA', ['VB-09']),
    ('VB-09', '10-corte/B5.md:177 (sin relectura si el aviso tiene < 10 min)', 'AGREGA', ['VB-09', 'VA-A8']),
    ('VB-10', '10-corte/B7.md:748 (tres intentos)', 'MODIFICA', ['VB-10', 'VA-A9']),
    ('VB-10', '10-corte/B8a.md:166 (LISTING de ficha MODERATED no entra en S11)', 'AGREGA', ['VB-10']),
    ('VB-11', '10-corte/B9a.md:860 (motivo de revocación de catálogo cerrado)', 'MODIFICA', ['VB-11', 'VA-A6']),
    ('VB-11', '20-fase-1/V9b.md:571 (sal anual y descarte a los dos años)', 'AGREGA', []),
    ('VB-12', '20-fase-3/B13b.md:37 (filas 24 y 26)', 'MODIFICA', ['VB-12', 'VA-A6']),
    ('VB-12', '10-corte/B11.md:1342 (relectura semanal tras tres barridos)', 'AGREGA', ['VB-12', 'VA-A8']),
    ('VB-13', '80-abiertos.md:56 (RF-3 mayor que 90 días)', 'MODIFICA', []),
    ('VB-13', '20-fase-3/B10.md:1262 (cinco addons LISTING por vertical)', 'AGREGA', ['VB-13']),
    ('VB-14', '30-el-corte.md:100 (regla del borde hasta el paso 4)', 'MODIFICA', ['VB-14', 'VA-A2']),
    ('VB-14', '90-retirados.md:30 (pagador manual baja de plan en grace)', 'AGREGA', ['VB-14']),
    ('G1', '01-decisiones-vigentes.md:5476 (tachado revivido: «una ficha»)', 'MODIFICA', ['G1']),
    ('G1', '01-decisiones-vigentes.md:183 (32 usuarios)', 'MODIFICA', ['G1']),
    ('G2', '04-catalogos.md:8213 (GR-3 ~12 h)', 'MODIFICA', ['G2', 'VA-A5']),
    ('G2', '20-fase-3/B12.md:110 (rank se libera con la última anclada)', 'MODIFICA', ['G2', 'VA-A9']),
    ('VA-A1', '02-nucleo-outbox.md:151, U2.md:184/389 («tres días antes» = día de calendario)', 'OMITE', ['VA-A1', 'VB-02']),
    ('VA-A2', '30-el-corte.md:436, 01:7100, 01:12959 (igualdad de commit en el paso 3)', 'OMITE', ['G1']),
    ('VA-A3', '10-corte/V4.md:801 (un rechazo de canje no escribe nada)', 'OMITE', []),
    ('VA-A4', 'V4.md:589, V3.md:175/241/614, 01:2733 (cuota de trial fuera del trinquete)', 'OMITE', ['VA-A4', 'G1']),
    ('VA-A5', '20-fase-4/V7.md:427 (no hace falta un quinto scope para la presencia)', 'OMITE', ['VB-07']),
    ('VA-A6', 'V2.md:380, B10.md:1356/1791, 03-contrato:1174 (re-apuntar sólo dentro del mismo addon)', 'OMITE', ['VA-A2', 'VB-03']),
    ('VA-A7', '01:2029/2091, B12.md:214/342/438, 04:4006 (el empate lo gana el cliente)', 'OMITE', ['G1', 'G2']),
    ('VA-A8', '04:6215, B8b.md:657/1254 (qué dice el aviso de C4)', 'OMITE', ['VA-A8', 'G2']),
    ('VA-A9', 'B5.md:793, 02-nucleo:1749, 01:8932 (24 horas de la Res. 424/2020)', 'OMITE', ['VA-A9', 'VA-A1', 'VB-02', 'VB-09', 'G1']),
    ('VA-A10', 'B9a.md:321/682, B9b.md:371, 80-abiertos:350, B13a.md:150 (extensión de trial sí para el pagador manual)', 'OMITE', ['VA-A10', 'G2']),
]
J['canarios'] = [dict(bloque=b, donde=d, tipo=t, detectado_por=p, detectado=bool(p),
                      por_su_bloque=b in p) for b, d, t, p in CANARIOS]

O = next(x for x in J['unicos'] if x['veredicto'] == 'OWNER')
O['pregunta_owner'] = {
    'letra': 'CH',
    'contexto': 'B/09 §3 dice que `cancelado_visto_en` lo escribe la primera relectura que ve `cancelled`, sea del barrido, del handler o de una transición; el reparto de la misma letra Z (B/descomposicion §2.11) le da la escritura sólo al barrido de B11, y la spec copió el reparto. El handler y S16 son de B3, que llega antes que la columna (B4).',
    'opciones': [
        '1. Escriben todas las relecturas: B3 llama por interfaz interna, B4 la implementa al crear la columna, B11 la usa (BL). Costo: una interfaz y un caso sembrado; una línea en el reparto. Riesgo: bajo. Recomendada.',
        '2. Escribe sólo el barrido: se tacha «del handler o de una transición» en B/09 §3. Costo: ninguno. Riesgo: medio; hasta un día de `puedeCobrarle` = sí sobre un preapproval cancelado y el plazo 16 tarde.',
        '3. B11 cablea la escritura en el handler y S16. Costo: B11 toca código de B3. Riesgo: alto; contradice BL y DEC-ARCH-017 punto 2.'],
    'recomendada': 1}
O['correccion'] = None
J['por_id'] = {x['id']: x for x in J['unicos']}
json.dump(J, open(os.path.join(D, 'hallazgos.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# --- correcciones.txt ---------------------------------------------------------------------------
GEN = {'01-decisiones-vigentes.md': 'scripts/generadores/g1/ (gen01.py, omisiones.json)',
       '04-catalogos.md': 'scripts/generadores/g3/gen.py',
       '10-corte/B4.md': 'scripts/generadores/g8/src/B4.md', '10-corte/B5.md': 'scripts/generadores/g8/src/B5.md',
       '10-corte/B6.md': 'scripts/generadores/g8/src/B6.md', '10-corte/B7.md': 'scripts/generadores/g8/src/B7.md'}
por = defaultdict(list)
for x in J['unicos']:
    for k in x['correccion'] or []:
        por[k['archivo']].append((k['linea'], x, k))
out = ['# Correcciones de la adjudicación ciega, vuelta 2 (HOS-1352)', '',
       'Generado por `render.py` desde `hallazgos.json`. Líneas de la spec REAL (HEAD `200317c484`, sin',
       'canarios); fuentes congeladas en `69cbe79360`. Toda `sale` se verificó contra su línea con `build.py`.',
       'Un archivo marcado *generado* se corrige en su generador o en su `omisiones.json`, no en el `.md`; un',
       'tramo g-secciones (B9a, B10, B11, B12, B13a y B8b entre sus marcadores) se corrige en la fuente y se',
       'regenera.', '', '## Por archivo de la spec', '']
for f in sorted(por):
    g = GEN.get(f)
    out.append(f'### `{f}`' + (f' — generado: `{g}`' if g else ''))
    out.append('')
    for ln, x, k in sorted(por[f], key=lambda t: t[0]):
        cl = x['veredicto'] + (' ' + x['clase_final'] if x['clase_final'] else '')
        out.append(f"- **{x['id']}** · {cl} · l. {ln} — {x['resumen']}")
        if k.get('donde_va'):
            out.append(f"  - dónde: {k['donde_va']}")
        if k['sale']:
            out.append('  - sale:')
            out += ['    ' + s for s in k['sale'].split('\n')]
        out.append('  - entra:')
        out += ['    ' + s for s in k['entra'].split('\n')]
        out.append('')
fu = [x for x in J['unicos'] if x.get('correccion_fuente')]
out += ['## En las fuentes (residuos; piden otro SHA congelado)', '']
for x in fu:
    for k in x['correccion_fuente']:
        out.append(f"- **{x['id']}** · `{k['archivo']}`" + (f":{k['linea']}" if k['linea'] else '') + f" — {k['nota']}")
out += ['', '## FALSO (sin corrección)', '']
for x in J['unicos']:
    if x['veredicto'] == 'FALSO':
        out.append(f"- **{x['id']}** — {x['resumen']} **Por qué es falso**: {x['causa']}; " + ' · '.join(x['evidencia']))
out += ['', '## OWNER', '', '- **H2-VA8-7** → letra **CH** de `lote.txt`.', '']
open(os.path.join(D, 'correcciones.txt'), 'w', encoding='utf-8').write('\n'.join(out))
print('ok', sum(len(v) for v in por.values()), 'correcciones en', len(por), 'archivos')
