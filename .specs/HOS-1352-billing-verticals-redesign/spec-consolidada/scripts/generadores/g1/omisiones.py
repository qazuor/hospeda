"""Writes omisiones.json next to it: per PARCIAL item of 01 (a 📌 or a whole DEC), what gen01.py
replaces by «[…]».

Owner letter BK (point 7 of DEC-METH-019 widened), same policy as g3/omisiones.py: a PARCIAL verdict
makes the consolidated spec omit what died with «[…]» and keep a note. Three sources, in this order:

- LEGADO: the spans written by hand before the policy existed (g1, first and second pass). Kept as
  they are; each was reviewed against its verdict when it was written.
- EXTRA: dead parts that `muerto` names without quoting them, or quotes in a form that cannot be
  omitted verbatim without breaking the markdown around it. Each carries the words of `muerto` that
  justify it, and this script fails if those words are not in `muerto`.
- Derived: every «quoted» span of `muerto` (trazar.r19_citas: split at «[…]», minus the ones the
  verdict marks alive) is written as {"cita": …}; gen01.py omits it verbatim, line breaks aside,
  unless an earlier span already removed it.

gen01.py fails if a PARCIAL item of 01 ends up with no span applied, if a {"de"} span is not found
exactly once, or if a dead quote of `muerto` (R19's length) is still in the rendered block.

Two more keys, from the first blind-verification round (2026-10-02):

- `letras_muertas`: owner letters a later source left without effect. gen01.py renders them with a
  «⚠️ Caducada» line, and fails if a letter named by a caducity note of its own file («> **Caducada…**»)
  is rendered without it (H-VA-A8-r2-5, r2-6).
- `reubicar`: text the source glued to the wrong 📌. The PARCIAL verdict of the 📌 that carries it says
  «la consolidada la muestra bajo el 📌N»; gen01.py renders it under that 📌, and fails if a verdict
  promises a 📌 that does not receive it (H-VA-A8-r2-7).
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
C = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(C, 'scripts'))
from trazar import r19_citas, r19_norm, R19_MIN  # noqa: E402
from comun import D, B, lines  # noqa: E402

ADJ = json.load(open(C + '/_trabajo/adjudicacion.json', encoding='utf-8'))['veredictos']
ASG = json.load(open(C + '/_trabajo/asignacion.json', encoding='utf-8'))['items']

# Hand-written spans that predate the policy: {item: [(span, replacement)]}.
LEGADO = {
 "DEC-CONC-002#📌1": [("Once filas de\n`B/03`", "[…] Filas de\n`B/03`")],
 "DEC-CONC-002#📌3": [(" —que desde\nentonces cuenta las dos lápidas, la del corte y la de recepción—", " […]")],
 "DEC-ADDON-002#📌2": [("`S26` la\naplica a los `USER`/`GLOBAL` compatibles con la vertical que discontinúa. ", "[…] "),
                        ("una de las\ncatorce transiciones", "una de las\n[…] transiciones")],
 "DEC-MIG-002#📌1": [(": una regla de Cloudflare cierra las rutas que crean o re-autorizan algo en el\nproveedor.", ": […].")],
 "DEC-MIG-003#📌1": [(" si el despliegue falla: el costo, aceptado, es que los\nclientes cancelados se re-suscriben sin trial, y **qué se hace con esa diferencia no está\ndecidido**.", " si el despliegue falla […].")],
 "DEC-MIG-003#📌2": [("escribe sigue siendo: las lápidas (paso 4), los dos", "escribe sigue siendo: […] los dos")],
 "DEC-MIG-003#📌3": [("- La rama de aborto devuelve la URL de notificación a la ruta del viejo y la verifica con\n  una entrega real.\n", "- […]\n"),
                      ("- El borrado del contenido de las `L1` pasa al paso 5b, después de abrir altas, porque el\n  backup no restaura fotos ni tokens.\n", "- […]\n"),
                      ("- El apuntado de la URL es el paso 4b, después de las lápidas. El paso 3", "- […] El paso 3"),
                      ("- El recuento de fichas de Gastronomía y de Experiencia se hace antes del 1a, y el corte no\n  arranca si da una fila; el gate del paso 2 lo repite como segundo control, y si ahí da una\n  fila el corte entra en la rama de aborto (`V/21` §2.4).\n", "- […]\n"),
                      ("- El paso 4c, después del 4b y fuera de la rama, revalida las páginas públicas de las fichas\n  que nacieron despublicadas.", "- […]")],
 "DEC-MIG-003#📌5": [("; el borde la cierra antes de apagar el\ncontenedor viejo en el paso 3 y la abre al final del paso 4, con las lápidas verificadas;\nmientras está cerrada, el proveedor recibe error y reintenta a la misma URL.", "; […]."),
                      ("vuelve\na cerrar la ruta si hace falta, redespliega", "[…] redespliega")],
 "DEC-DATA-002#📌1": [("**tiene seis hechos**", "**tiene […] hechos**")],
 "DEC-TEST-001#📌1": [("el total de 31 guards no\ncambia", "el total de […] guards no\ncambia")],
 "DEC-RF-008#📌1": [("**quince**\nacciones", "**[…]**\nacciones"), ("dicen quince.", "dicen […].")],
 "DEC-ADDON-004#📌1": [("`S11` o por `S26`—", "`S11` […]—")],
 "DEC-ARCH-006#📌8": [(", las filas vivas sin\n`CANCEL_SCHEDULED`,", ", […],"), ("y siguen siendo once.", "y […].")],
 "DEC-ARCH-006#📌9": [("siguen en once.", "siguen en […].")],
 "DEC-SUB-013#📌1": [("`S24`, `S26`)", "`S24`, […])"), ("`S21`, `S28`)", "`S21`, […])")],
 "DEC-TEST-001#📌2": [("pasa a 32 guards", "pasa a […] guards")],
 "DEC-TEST-001#📌3": [("queda en 33 guards", "queda en […] guards")],
 "DEC-TEST-001#📌4": [("sigue en 33\nguards", "sigue en […]\nguards")],
 "DEC-TEST-001#📌5": [("pasa de 33 a **34 guards distintos**", "pasa de 33 a **[…] guards distintos**"), ("; queda para el owner.", "; […].")],
 "DEC-TEST-001#📌6": [("**18 de verticales, 15\nde billing y 1 de `U1`**", "**[…]**")],
 "DEC-RF-004#📌1": [("`S12`-vía-`S26` ya no depende de transportar la causa:\n`S21` la lee en la fecha de fin en la fila de `vertical_discontinuation` de la vertical de la\nprincipal, y abre el 15. ", "[…] "),
                     (" La lectura es por la vertical y no\npor la fila, así que también alcanza a la baja que la persona pidió antes del anuncio y termina\ndespués.", " […]")],
 "DEC-RF-006#📌2": [("el `USER`/`GLOBAL` que `S26`\ncanceló y todo complemento cuya principal mató `S12` sobre una vertical con fila en\n`vertical_discontinuation`.", "[…].")],
 "DEC-MP-008#📌2": [("una pausa o una cancelación hecha por el pagador", "[…] una cancelación hecha por el pagador")],
 "DEC-SUB-021#📌1": [("1. **La frase *«los reintentos del proveedor cobran con ella»* queda CONDICIONADA a `GR-1`**, como\n   `DEC-SUB-010` lo está a su segunda lectura. El *Contexto medido* no la mide: `EX-36` mide que la\n   tarjeta **se puede** cambiar, no que el reintento de un cobro ya abierto use la nueva; y `GR-3`", "1. […] `GR-3`"),
                     (" **Se mide con el próximo rechazo mensual real.** Mientras tanto, **la\n   pantalla y los correos del grace no prometen que el reintento use la tarjeta nueva**. La\n   decisión no cambia; cambia lo que se le promete al cliente.", " […]")],
 "DEC-MIG-005#📌5": [(" El titular que sólo conoce el proveedor tiene detector sólo si alguna lectura medida en\nsandbox trae su pagador (`EX-59`); si ninguna, queda declarado sin detector.", " […]")],
 "DEC-RF-008#📌3": [("de dieciséis a veintiuna vivas", "de dieciséis a […] vivas")],
 "DEC-RF-008#📌4": [("de veintiuna a veintitrés vivas", "de […] a […] vivas"), ("las dos las construye `V8`", "las dos las construye […]")],
 "DEC-ENT-006#📌1": [(", que se asigna al aprobar la postulación,", ", […],")],
 "DEC-ENT-006#📌2": [(" o\nel alta directa del admin con dueño.", "\n[…]."), ("; `starts_at` y `ends_at` quedan hasta la unidad de socios (H; ver el\n📌 de `DEC-ARCH-014`)", "; […] (H; ver el\n📌 de `DEC-ARCH-014`)")],
 "DEC-ENT-006#📌3": [("**los borra `V7` con su migración, junto con sus lectores del panel**", "**los borra […], junto con sus lectores del panel**")],
 "DEC-ENT-006#📌4": [("sale en la misma migración de `V7` que `starts_at` y `ends_at`", "sale en […] que `starts_at` y `ends_at`")],
 "DEC-MIG-006#📌2": [("la escribe\ndespués el script del corte, con la función", "la escribe\n[…], con la función")],
 "DEC-ARCH-013#📌1": [("se congelan con\nsus valores adentro, en el mismo cambio que lo borra, y salen en el paso 6 del corte.", "[…]."), ("antes del ensayo del\ncorte en staging.", "[…].")],
 "DEC-ARCH-013#📌3": [("los escribe\ndespués el script del corte, con la función", "los escribe\n[…], con la función")],
 "DEC-ARCH-013#📌4": [("**Ese\ncontrol cuenta como guard: los guards pasan de 33 a 34**", "**Ese\ncontrol cuenta como guard: […]**")],
 "DEC-ARCH-014#📌1": [("El\nprograma pasa a 23 unidades y el reparto de guards a 17 de verticales, 15 de billing y 1 de `U1`,\n33 en total. `U1` no es de ninguna épica, así que las dependencias entre épicas siguen en once.", "[…] `U1` no es de ninguna épica […]."),
                       ("; el\nborde la cierra desde que se apaga el contenedor viejo hasta que las lápidas del paso 4 están\nverificadas, el proveedor recibe error y reintenta a la misma URL, y el 4b sólo verifica", "; […] el 4b sólo verifica"),
                       (" Qué código\ncontesta el borde cerrado, para que el proveedor reintente, y qué pasa con lo que se pierda si el\ncierre pasa la escalera de reintentos quedaron para el owner\n(`30-revision-del-owner/35-aplicacion-lote-o.md` §3).", " […]")],
 "DEC-ARCH-014#📌2": [(" **P-A**: la ruta de avisos\nno la cierra una regla de bloqueo, que contesta un `4xx` sin reintento medido, sino un Worker del\nborde que contesta `500`, el único código con reintento medido (`WH-4`), con una cabecera propia\nque lo distingue de un `500` de la aplicación; se prende antes de apagar el contenedor viejo, se\napaga al final del paso 4, vive con el script del corte y lo deja listo el ensayo del paso 0\n(`DEC-MIG-003`). **P-B**: lo que se pierda durante el cierre lo lista el detector del día\nsiguiente al corte, sin abrir marca ni asentar (`DEC-MIG-005`).", " […]"),
                       ("Las dependencias entre épicas siguen en once y los guards en 33, con el\nmismo reparto: `G14` sigue en `V1`.", "[…] `G14` sigue en `V1`.")],
 "DEC-ARCH-014#📌5": [("; `starts_at` y `ends_at` quedan hasta la unidad de socios (H; ver el\n📌 de `DEC-ENT-006`)", "; […] (H; ver el\n📌 de `DEC-ENT-006`)"), ("33, pasan a **34**:", "33, pasan a **[…]**:")],
 "DEC-DATA-008#📌1": [("los fija el owner antes del ensayo del corte en staging, y", "los fija el owner […], y")],
 "DEC-DATA-008#📌3": [("con los quince valores,", "con los […] valores,"), ("los cinco sin valor escrito\nantes del ensayo del corte en `staging`.", "los cinco sin valor escrito\n[…].")],
 "DEC-DATA-008#📌4": [("los sigue fijando el owner antes\ndel ensayo del corte en `staging`.", "los sigue fijando el owner […].")],
 "DEC-ARCH-017#📌1": [("\naddons, `B4`, que le agrega a `payment` la columna de la instancia—", "\n[…]—")],
}

# Dead parts named but not quoted by `muerto` (or not omissible verbatim): {item: [(span, replacement,
# words of `muerto`)]}. Spans match with any run of blanks for a blank, so line breaks do not matter.
EXTRA = {
    'DEC-ARCH-017#📌1': [('promos y cortesías, `B9a`; […]', '[…]', '«promos y cortesías, `B9a`»')],
    'DEC-ARCH-014#📌7': [('Ninguna unidad depende de ella; la necesitan el ensayo (paso 0) y los pasos 1a, 1b '
                         'y 2. Y `U1` suma una cosa: **reapunta la regla de smoke del `CLAUDE.md` raíz** al '
                         'checklist del sistema nuevo (letra B; ver `DEC-ARCH-016`). Dónde: '
                         '`16-fase-7-del-paraguas.md` §2, §4.2 y §4.6; las dos descomposiciones, §3 y §4; '
                         '`spec.md`. Origen: (FASES 6 y 7, owner 2026-09-30, F).', '[…]',
                         'la cola «Ninguna unidad depende de ella')],
    'DEC-MIG-002': [('y **se transcriben a mano cuando el rediseño esté listo**, con el mismo procedimiento '
                     'del §2.3 que `DEC-MIG-001` fijó para las cinco relaciones vivas', '[…]',
                     '«y se transcriben a mano cuando el rediseño esté listo» (la decisión)'),
                    ('**la cohorte a transcribir crece mientras dure el rediseño.** Hoy son 5; cada alta '
                     'nueva suma una. **Si el ritmo de altas se acelera hay que volver a mirar esto** — no '
                     'porque la decisión haya sido mala, sino porque habría cambiado la condición que la '
                     'hacía barata. Queda anotado en [`04-open-decisions.md`](../docs/04-open-decisions.md) '
                     '§ *«Para revisar más adelante»*.', '[…]',
                     'el riesgo de que *«la cohorte a transcribir crece»*')],
    'DEC-DATA-002': [('**Lo que se implementó es equivalente en el resultado, y conviene decir que no es '
                      'idéntico: el reloj SÍ corre durante la pausa, y se reinicia al reanudar.** El daño '
                      'residual es **cero**, y por una razón aritmética: el tope de una pausa son **4 '
                      'pausas-mes ≈ 120 días** contra los **180** del hard delete, y cada reanudación '
                      'reinicia — así que las pausas encadenadas tampoco acumulan. La ficha se archiva, sí, '
                      'pero **vuelve sola por `PB7`** y **nunca se borra**.', '[…]',
                      'que el reloj corre durante la pausa'),
                     ('**`D16`, y es la pieza que evita que todo esto sea una premisa que envejece sola**: '
                      '*«el tope de una pausa, en días, es menor que el día del hard delete»*, con guard '
                      '`G-R5` que compara las dos cifras y falla si la primera alcanza a la segunda. **Las '
                      'dos son configuración**, así que el invariante es **la relación** y nunca los '
                      'números. Sin `D16`, todo el arreglo descansa en una desigualdad entre dos valores '
                      'que nadie vuelve a mirar — que es exactamente el quinto modo de falla que '
                      '`DEC-METH-010` declara **no cubierto** por ninguna búsqueda.',
                      '[…]', 'la desigualdad que lo protegía (`D16`, con `G-R5`)')],
    'DEC-MP-003': [('**un motivo nuevo de pausa, `PROVIDER_DUNNING`.** El espejo lo escribe en lugar de '
                    '`CUSTOMER_REQUEST`. Los motivos pasan de **dos a tres**, y **todo lo que lee el motivo '
                    'de pausa hay que recorrerlo** — empezando por `puedePausar()`, los topes del §26 y las '
                    'salidas `S10`, `S22` y `PB*`.', '[…]',
                    'la decisión, *«un motivo nuevo de pausa»*, y lo que manda recorrer')],
    'DEC-SUB-019': [('La pausa con motivo `PROVIDER_DUNNING` de `DEC-MP-003` **no se borra** —el espejo tiene '
                     'que saber leerla si ocurre, por ejemplo si alguien reactiva un preapproval a mano—, pero '
                     'deja de ser un camino que haya que diseñar.', '[…]',
                     '«La pausa con motivo `PROVIDER_DUNNING` de `DEC-MP-003` **no se borra**»')],
    'DEC-METH-006': [('**se repite hasta que una pasada de FASE 8 no produzca ningún `CRITICA` nuevo.**', '[…]',
                      '*«se repite hasta que una pasada de FASE 8 no produzca ningún `CRITICA` nuevo»*')],
    'DEC-ADDON-003': [('**La condición de huérfano no se toca: sigue con tres mitades.**', '[…]',
                       '«La condición de huérfano no se toca: sigue con tres mitades»')],
    'DEC-DATA-004': [('y la lista de los cinco', 'y la lista de los […]', 'la cifra «cinco» del título'),
                     ('la lista de los cinco consumidores', 'la lista de los […] consumidores',
                      'y de `H1` (*«la lista de los cinco consumidores')],
}


# Owner letters a later source left without effect: {OWN id: (alcance, por, (path, fragment of the line
# that says so), inferred)}. `inferido` marks a letter the adjudication did not list and that follows
# its criterion (a letter whose premise leaves with C8, C12 or S-40 to S-45).
LOG = D + '01-decision-log.md'
C8_S1 = (B + 'docs/03-maquinas-de-estado.md', '(La guarda `admiteAltas` salió con la revisión del owner, 2026-09-28, C8: las verticales no se discontinúan.)')
C8_ARCH011 = (LOG, '### DEC-ARCH-011 — Una vertical que deja de admitir altas')
CAD_28 = (D + '28-fase-9-vuelta-1/10-decisiones-del-owner.md', '`G1-1` y R1, en lo que decían de la cartera: los reemplaza `DEC-MIG-006` (C12)')
CAD_29 = (D + '29-fase-8-vuelta-2/10-decisiones-del-owner.md', '`R15`, entera: cae con `DEC-MIG-006` (C12, `L1-b`)')
DISC = ('entera', 'la discontinuación de una vertical salió (C8); su 📌 está en [90-retirados.md](90-retirados.md#dec-arch-011-p1)', C8_ARCH011)
LETRAS_MUERTAS = {
    'OWN:28-fase-9-vuelta-1:t1:G1-1': ('en parte', 'en lo que decía de la cartera la reemplaza `DEC-MIG-006` (C12)', CAD_28, False),
    'OWN:28-fase-9-vuelta-1:t1:G2-4': ('entera', '`T7` salió (N7, `DEC-TRIAL-003`)', CAD_28, False),
    'OWN:29-fase-8-vuelta-2:t1:R15': ('entera', 'cae con `DEC-MIG-006` (C12, `L1-b`), y con ella `N-B-01`', CAD_29, False),
    'OWN:29-fase-8-vuelta-2:t1:R5': DISC + (False,),
    'OWN:29-fase-8-vuelta-2:t1:Q-ALTAS': DISC + (False,),
    'OWN:29-fase-8-vuelta-2:t1:Q-ALTAS-b': DISC + (False,),
    'OWN:29-fase-8-vuelta-2:t1:R24': DISC + (False,),
    'OWN:29-fase-8-vuelta-2:t1:Q-FECHA': DISC + (False,),
    'OWN:29-fase-8-vuelta-2:t1:Q-ANUNCIO': DISC + (True,),
    'OWN:29-fase-8-vuelta-2:t1:Q-ACC16': ('entera', 'la acción 16 salió (C8); su 📌 está en [90-retirados.md](90-retirados.md#dec-rf-008-p2)',
                                          (D + 'nucleo/08-auditoria-y-observabilidad.md', '**sale de la tabla** (revisión del owner, 2026-09-28, C8)'), False),
    'OWN:29-fase-8-vuelta-2:t1:R2': ('entera', 'su 📌 de `DEC-MIG-005` quedó `SUPERSEDED`; está en [90-retirados.md](90-retirados.md#dec-mig-005-p1)',
                                     (LOG, 'ni las va a haber antes del corte). Quedan **`SUPERSEDED`**: el 📌 del 2026-09-27 (`R2`, `R21`'), False),
    'OWN:29-fase-8-vuelta-2:t1:R21': ('entera', 'su 📌 de `DEC-MIG-005` quedó `SUPERSEDED`; está en [90-retirados.md](90-retirados.md#dec-mig-005-p1)',
                                      (LOG, 'ni las va a haber antes del corte). Quedan **`SUPERSEDED`**: el 📌 del 2026-09-27 (`R2`, `R21`'), False),
    'OWN:29-fase-8-vuelta-2:t1:R21-b': ('entera', 'su 📌 de `DEC-MIG-005` quedó `SUPERSEDED`; está en [90-retirados.md](90-retirados.md#dec-mig-005-p1)',
                                        (LOG, 'ni las va a haber antes del corte). Quedan **`SUPERSEDED`**: el 📌 del 2026-09-27 (`R2`, `R21`'), False),
    'OWN:26-fase-9-completa:t1:6a': ('entera', '`admiteAltas` salió con C8', C8_S1, False),
    'OWN:26-fase-9-completa:t1:6b': ('entera', '`admiteAltas` y `fin_de_servicio` salieron con C8', C8_S1, False),
}

# Text the source glued to the wrong 📌: {the 📌 that carries it: (the 📌 it belongs to, the verbatim
# span, its letter)}. The span is the {"de"} of EXTRA, so it is omitted from the first and shown under
# the second.
REUBICAR = {
    'DEC-ARCH-014#📌7': ('DEC-ARCH-014#📌6', EXTRA['DEC-ARCH-014#📌7'][0][0], 'F'),
}


def linea_de(path, frag):
    hits = [n for n, l in enumerate(lines(path), 1) if frag in l]
    if len(hits) != 1:
        sys.exit(f'✗ {path}: {len(hits)} líneas contienen «{frag[:60]}»')
    return hits[0]


def main():
    parcial = {k for k, v in ADJ.items()
               if v['veredicto'] == 'PARCIAL' and (ASG.get(k, {}).get('destino') or '').startswith('01')}
    assert set(LEGADO) <= parcial, set(LEGADO) - parcial
    assert set(EXTRA) <= parcial, set(EXTRA) - parcial
    out = {}
    for cid in sorted(parcial):
        spans = [{'de': a, 'a': b} for a, b in LEGADO.get(cid, [])]
        for de, a, por in EXTRA.get(cid, []):
            assert por in ADJ[cid]['muerto'], (cid, por)
            spans.append({'de': de, 'a': a})
        spans += [{'cita': c} for c in r19_citas(ADJ[cid]['muerto']) if len(r19_norm(c)) >= R19_MIN]
        out[cid] = spans
    out['letras_muertas'] = {k: {'alcance': a, 'por': por, 'origen': f'{p}:{linea_de(p, frag)}', 'inferido': inf}
                             for k, (a, por, (p, frag), inf) in LETRAS_MUERTAS.items()}
    out['reubicar'] = {k: {'a': a, 'texto': txt, 'letra': letra} for k, (a, txt, letra) in REUBICAR.items()}
    # indent=4 plus a final newline is exactly what the pre-commit's biome format leaves
    with open(os.path.join(HERE, 'omisiones.json'), 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=4)
        fh.write('\n')
    print(len(out) - 2, sum(len(s) for k, s in out.items() if k not in ('letras_muertas', 'reubicar')),
          'letras muertas', len(out['letras_muertas']), 'reubicados', len(out['reubicar']))


if __name__ == '__main__':
    main()
