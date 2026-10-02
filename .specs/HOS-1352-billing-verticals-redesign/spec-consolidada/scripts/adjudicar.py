#!/usr/bin/env python3
"""Adjudication of the ambiguous items (DEC-METH-019 point 7; owner AI): every MIXTO row and
every 📌 that falls in prose over another 📌 or over its decision gets a verdict, with a
verbatim citation and the sha256 of its source line at the frozen SHA.

    python3 adjudicar.py <inventario.json> <salida adjudicacion.json>

Verdicts:
  VIVO     the live (non-struck) text can be taken literally, and is complete.
  PARCIAL  the item lives, but a part of its live text is overtaken by a later source that did
           not strike it: `muerto` says which part, `evidencia` where it was overtaken.
  MUERTO   the whole item is overtaken: it goes to 90-retirados.
`efecto` (pins only) says what the 📌 does to the text it lands on: agrega | reemplaza parte |
reemplaza todo. `cambia_sentido` is true only when the verdict itself picks a reading that no
later source states: those go to the owner (AI). Every citation is checked against the line at
the SHA; a citation that is not there aborts the run.
"""
import json
import re
import sys

from comun import B, D, SHA, V, line_hash, lines

LOG = D + '01-decision-log.md'
D16 = D + '16-fase-7-del-paraguas.md'
BD = B + 'descomposicion.md'
VD = V + 'descomposicion.md'
B03 = B + 'docs/03-maquinas-de-estado.md'
B02 = B + 'docs/02-modelo-de-datos.md'
N08 = D + 'nucleo/08-auditoria-y-observabilidad.md'
OWN41 = D + '41-corte-del-mvp/10-decisiones-del-owner.md'

C8 = (B03, None, '(La guarda `admiteAltas` salió con la revisión del owner, 2026-09-28, C8: las verticales no se discontinúan.)')
AV = (OWN41, None, 'las tablas del modelo de addons pasan de `B4` a `B3`, y `payment` nace en `B5` con su columna de la instancia')
AB_AP = (D16, None, '| la migración estructural de `partners`: borra `starts_at`, `ends_at` y `tier` con su índice')
G35 = (D16, None, '~~34~~ 35: entra `G19`, de `V5`')
DOCE = (LOG, 7511, 'son **doce**, no once como dicen los 📌 de O-A y P-C de esta decisión y el de `DEC-ARCH-006`')
ACC25 = (N08, None, '**Es la vigesimosexta**')
MERGE_V6 = (LOG, 7361, 'fija el owner **antes del merge de `V6`**, y no antes del ensayo del corte en `staging`, como')
SIMPL = 'simplificación del corte (FASE 5, owner 2026-09-30)'

# (id, verdict, cita in the item's own line or None = the item's text after its marker,
#  efecto, muerto, [evidence (path, line|None, cita)], base, razon)
V_ = 'VIVO'
P_ = 'PARCIAL'
M_ = 'MUERTO'
MIXTO = [
    ('FILA:B10', V_, 'su modelo, que va al corte en `B3` (corte del MVP, owner 2026-10-01, AV)', None, None, [AV], 'AV',
     'el resto de AA quedó tachado y reemplazado en la fuente (AY)'),
    ('FILA:B4', V_, 'la fuente `ADDON` real, que contesta leyendo la tabla vacía hasta que `B10` venda', None, None, [], None,
     'lo tachado es lo retirado (discontinuación, C8; el modelo, AV) y el texto vivo lo dice sin contradicción'),
    ('FILA:B6', V_, 'las tablas del modelo de la instancia las crea `B3` y la venta es de `B10`', None, None, [AV], 'AV',
     'el resto quedó tachado y reemplazado en la fuente (AY)'),
    ('FILA:B8', V_, 'las tablas del modelo del complemento las crea `B3`', None, None, [AV], 'AV',
     'fila de origen de `B8a` y `B8b`; el resto quedó tachado y reemplazado en la fuente (AY)'),
    ('FILA:B13b', V_, '*(pasan a `B13a`: corte del MVP, owner 2026-10-01, BH)*', None, None, [], 'BH',
     'tachado y reemplazo explícitos: las filas 13 y 13-bis van a `B13a` (BH)'),
    ('FILA:U1', V_, 'la limpieza del principio y, al terminarla, el package del contrato vacío; nada más', None, None, [], None,
     'tachado y reemplazo explícitos (lote P-C)'),
    ('FILA:V2', V_, 'con que billing lee de una `addon_version` su `addon`', None, None, [], None,
     '`situaciónDeVertical` salió con C8 y lo dice la misma fila'),
    ('DEP:6', V_, '**Es la misma fila y no una nueva**', None, None, [], None, 'C8 tachado y anotado en la fila'),
    ('DEP:7', V_, 'desde la FASE 9 vuelta 1 `S1` rechaza también una versión retirada', None, None, [], None,
     '`admiteAltas` salió con C8, anotado en la fila'),
    ('LISTA:B6', V_, 'reembolso sale sin su clave de idempotencia persistida antes', None, None, [], None,
     'el 🔒 tachado era el estado previo al diseño del capítulo 13'),
    ('INV:32', V_, '**el agrupamiento viejo de Gastronomía y Experiencia no existe, ni como histórico**', None, None, [], None,
     'cada tachado tiene su reemplazo en la misma celda'),
    ('TRANS:V:T5', V_, '**aparece un título que convierte**', None, None, [], None, 'reemplazo explícito (DEC-TRIAL-010)'),
    ('TRANS:V:PB1', V_, '**o `UNPUBLISHED_BY_BILLING`** (FASE 9 vuelta 1, R1)', None, None, [], None, 'reemplazos explícitos'),
    ('TRANS:V:PB4', V_, '**el día del plazo de archivado de inactividad (90 al inicio), con la versión de plazos que guarda la ficha**',
     None, None, [], None, 'reemplazo explícito (C9, C11)'),
    ('TRANS:V:PB9', V_, '**Es también *«se borra la ficha destino»* de `A6`**', None, None, [], None,
     'lo tachado (hecho 4, orfandad por borrado) salió con C8 y K-9, anotado en la fila'),
    ('TRANS:B:S1', V_, C8[2], None, None, [], None, 'la guarda `admiteAltas` está tachada y anotada'),
    ('TRANS:B:S4', V_, '**la fila tiene al menos un pago acreditado**', None, None, [], None, 'reemplazo explícito'),
    ('TRANS:B:S9', V_, '**dos disparadores, un mismo acto**', None, None, [], None, 'el tercer disparador salió con C8'),
    ('TRANS:B:S38', V_, '`ACTIVE` **o `GRACE_PERIOD`**', None, None, [], None,
     'los ⚠️ tachados quedaron decididos en la misma fila (G-A, I-A, I-B); «Construye **B8**» se lee `B8b` (B §2.12)'),
    ('TRANS:B:P2', V_, '**vence la ventana del proveedor sin cobro**', None, None, [], None, 'reemplazo explícito (R1)'),
    ('TRANS:B:RF3', V_, '**En una orden el id de cada devolución siempre viene**', None, None, [], None,
     'las ramas tachadas salieron con el lote 5 F; la fila lo dice'),
    ('ACC:1', V_, '**uno no mensual —trimestral, semestral o anual—**', None, None, [], None, 'reemplazo explícito'),
    ('ACC:5', V_, '**el alta directa de un Partner por el admin no fija dueño', None, None, [], None,
     'tachado y reemplazo explícitos (lotes F y N)'),
    ('ACC:24', V_, '**dar de baja una cuenta a pedido de su dueño**', None, None, [], None,
     'cada ⚠️ tachado quedó decidido en la misma celda; «la unidad, `V8`» se lee `V8a` (V §2, fila `V8a`)'),
    ('ACC:26', V_, 'asignar o quitar el rol `SUPER_ADMIN` a una cuenta', None, None, [], None, 'lote AC, explícito'),
    ('PLAZO:16', V_, '**7 días** (FASE 9 vuelta 3, owner 2026-09-30, lote R)', None, None, [], None, 'el valor reemplaza al «sin valor»'),
    ('PLAZO:17', V_, '**7 días** (FASE 9 vuelta 3, owner 2026-09-30, lote R)', None, None, [], None, 'el valor reemplaza al «sin valor»'),
    ('PLAZO:18', V_, '**180 días** (FASE 9 vuelta 3, owner 2026-09-30, lote R)', None, None, [], None, 'el valor reemplaza al «sin valor»'),
    ('MOT:15', V_, '`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN` (el nombre, revisión del owner, 2026-09-28, C8)',
     None, None, [], None, 'C8, explícito'),
    ('MOT:19', V_, '**El camino de `P1` pasó al 20**', None, None, [], None, 'reemplazos explícitos'),
    ('PASO:0b', V_, '**bloquear toda escritura: una sola regla en el borde (Cloudflare)', None, None, [], None, SIMPL),
    ('PASO:1a', V_, '**el script del corte**, con cada llamada verificada', None, None, [], None, SIMPL),
    ('PASO:1b', V_, '**incluidas las sondas salvo las enumeradas abajo**', None, None, [], None, SIMPL),
    ('PASO:3a', V_, '**la migración de datos única del catálogo**', None, None, [], None, 'reemplazos explícitos'),
    ('PASO:3b', V_, '**con la versión que elige quien opera el corte, aceptada sólo si `políticaDePlan(v).vigente`**',
     None, None, [], None, 'reemplazos explícitos'),
    ('PASO:4b', V_, '**Este paso no mueve nada, sólo mira.**', None, None, [], None, SIMPL),
    ('PASO:4c', V_, '**revalidar las páginas públicas de las fichas que la migración del paso 3 borró y que el viejo servía',
     None, None, [], None, SIMPL),
    ('PASO:5', V_, '**levantar la regla del 0b y prender los crons**', None, None, [], None, 'lote 3 E'),
    ('PASO:5b', V_, '**borrar las fotos en el almacenamiento externo y revocar en el proveedor el token de calendario de toda ficha que no es de las cinco**',
     None, None, [], None, 'lote 1 J y lote P'),
]

AG, RP, RT = 'agrega', 'reemplaza parte', 'reemplaza todo'
PINES = [
    # --- 📌 en prosa (los 41 que no son una viñeta de primer nivel de su decisión) ---------
    ('DEC-PROMO-001#📌1', V_, None, RP, None, [], None, 'cierra la mitad «piso del apilado» de `A-PROMO-01` que el punto 5 daba abierta'),
    ('DEC-PROMO-001#📌2', V_, None, AG, None, [], None, 'agrega el texto del motivo al 📌 anterior'),
    ('DEC-DATA-001#📌1', V_, None, RT, None, [], 'DEC-DATA-005',
     'cierra el punto 4; la advertencia sobre las copias del §49 sigue como riesgo declarado'),
    ('DEC-CONC-002#📌1', P_, None, RP, '«Once filas»: cifra de su fecha; la nota de la misma decisión dice trece',
     [(LOG, None, 'decisión; hoy son **trece** de las catorce filas «no», con `S31` y `S16`')], None, 'cifra'),
    ('DEC-CONC-002#📌2', V_, None, RP, None,
     [(LOG, None, 'La regla de re-vinculación por `external_reference` del segundo 📌 no cambia (S-49).')], None,
     'el 📌 del 2026-09-30 dice que no cambia'),
    ('DEC-CONC-002#📌3', P_, None, AG, '«cuenta las dos lápidas, la del corte y la de recepción»: queda sólo la de recepción',
     [(LOG, None, '**una sola lápida, la de recepción**: la lápida del corte sale del diseño.')], 'S-40', ''),
    ('DEC-CONC-002#📌4', V_, None, RP, None, [], None, ''),
    ('DEC-CONC-002#📌5', V_, None, AG, None, [], None, ''),
    ('DEC-MAIL-001#📌1', V_, None, RP, None, [], None, 'excepción al punto 1 con su razón'),
    ('DEC-MAIL-001#📌2', V_, None, AG, None, [], None, ''),
    ('DEC-MAIL-001#📌3', V_, None, AG, None, [(B03, None, '**lo cancela en el proveedor, con la regla de relectura de `S17` y con nuestro correo antes**')], None,
     '«`A3` sólo confirma» (lote E) es de la orden `UNA_VEZ`; el recurrente sigue cancelando, como dice `B/03` §8'),
    ('DEC-RF-001#📌1', V_, None, AG, None, [], None, ''),
    ('DEC-RF-001#📌2', V_, None, RP, None, [], None, 'acota «cae al reembolso total» al caso total'),
    ('DEC-RF-001#📌3', V_, None, RP, None, [], None, 'el punto 4 saca el botón, no el derecho'),
    ('DEC-RF-001#📌4', V_, None, AG, None, [], None, ''),
    ('DEC-SUB-010#📌1', V_, None, AG, None, [], None, ''),
    ('DEC-GRANT-003#📌1', V_, None, RT, None, [], None, 'la implicación 6 «estaba equivocada», dicho por el 📌'),
    ('DEC-GRANT-004#📌1', V_, None, RP, None, [], None, '«días» del punto 3 pasa a meses'),
    ('DEC-ADDON-002#📌1', V_, None, RP, None, [], None, 'el punto 6 queda: la instancia no se apaga con el plan; el cobro del complemento sí se cancela'),
    ('DEC-ADDON-002#📌2', P_, None, AG,
     '«`S26` la aplica a los `USER`/`GLOBAL` compatibles con la vertical que discontinúa» (C8) y la cifra «catorce transiciones» (son once)',
     [C8, (BD, 148, '~~catorce~~ once desde que salieron `S25`, `S27` y `S28` con C8')], 'C8', ''),
    ('DEC-ARCH-005#📌1', V_, None, RP, None, [], None, 'el Problema caducó; la partición sigue por la otra razón'),
    ('DEC-ARCH-006#📌1', V_, None, AG, None, [], None, ''),
    ('DEC-ARCH-006#📌2', V_, None, AG, None, [], None, ''),
    ('DEC-MIG-002#📌1', P_, None, AG,
     '«una regla de Cloudflare cierra las rutas que crean o re-autorizan algo en el proveedor»: es una sola regla que bloquea toda escritura',
     [(LOG, 2710, 'Y el 📌 `G4-1` queda precisado por el lote B: no')], 'lote B (simplificación del corte)', ''),
    ('DEC-MIG-003#📌1', P_, None, AG,
     'la rama de aborto (ahora: restaurar el backup y volver a la imagen vieja, con la escritura bloqueada hasta el reintento) y «qué se hace con esa diferencia no está decidido»',
     [(LOG, 3129, 'La rama de aborto del 📌 del')], 'lotes D y A', ''),
    ('DEC-MIG-003#📌2', P_, None, AG, 'su punto 5: las lápidas del paso 4 (el corte ya no escribe lápidas)',
     [(LOG, 3123, 'del paso 4 que nombran el 📌 del 2026-09-25 (punto 5) y el de O-B: el corte ya no escribe')], 'S-40', ''),
    ('DEC-MIG-003#📌3', P_, None, AG,
     'la URL que devuelve la rama de aborto y el apuntado del 4b (la URL no cambia), el recuento de fichas de Gastronomía y Experiencia, el 5b como contenido de las `L1` y el 4c sobre fichas que nacieron despublicadas',
     [(LOG, 3128, 'fichas de Gastronomía y de Experiencia del 📌 del 2026-09-27 (S-07)'),
      (LOG, 3132, 'Y el borrado del 5b del 📌 del 2026-09-27 ya no es el contenido de las `L1`')], 'S-07, S-28, S-40, lote O-B', ''),
    ('DEC-MIG-003#📌4', V_, None, AG, None, [], None, 'coincide con el paso 4c vivo (D/16 §4.2)'),
    ('DEC-MIG-003#📌5', P_, None, AG, 'el cierre y la apertura de la ruta por el borde y las lápidas del paso 4',
     [(LOG, 3125, 'el 📌 del 2026-09-29, lote P-A (el Worker), y con')], 'S-40, S-45', '«la URL no cambia» sigue'),
    ('DEC-MIG-003#📌6', M_, None, AG, 'entero: el Worker del borde salió',
     [(LOG, 3125, 'el 📌 del 2026-09-29, lote P-A (el Worker), y con')], 'S-45', ''),
    ('DEC-MIG-003#📌7', V_, None, AG, None, [], None, ''),
    ('DEC-MIG-003#📌8', V_, None, RP, None, [], None, 'es el que retira lo de los anteriores'),
    ('DEC-MIG-003#📌9', V_, None, RP, None, [], None, ''),
    ('DEC-MIG-003#📌10', V_, None, AG, None, [], None, ''),
    ('DEC-MIG-004#📌2', M_, None, AG, 'entero: la decisión está SUPERSEDED, y las lápidas del corte salieron (S-40)', [], 'DEC SUPERSEDED', ''),
    ('DEC-DATA-002#📌1', P_, None, RP, '«seis hechos»: el cuarto (fin de servicio de una vertical discontinuada) salió con C8; son cinco',
     [(VD, None, '~~seis~~ cinco hechos de reinicio')], 'C8', ''),
    ('DEC-TEST-001#📌1', P_, None, AG, 'la cifra «31 guards» (hoy 35)', [G35], None, 'cifra; `G13` en `V4` sigue'),
    ('DEC-MP-003#📌1', V_, None, AG, None, [], None, 'nota de cita, no regla'),
    ('DEC-MP-006#📌1', V_, None, RP, None, [], None, 'cierra la cláusula 1 y conserva la 2'),
    ('DEC-RF-008#📌1', P_, None, AG, 'la cifra «quince» (hoy 25 vivas); la acción 15 sigue', [ACC25], None, 'cifra'),
    ('DEC-RF-008#📌2', M_, None, AG, 'entero: la acción 16, discontinuar una vertical, salió con C8',
     [(LOG, 6523, 'sale la 16, discontinuar')], 'C8', ''),
    # --- 📌 sobre otro 📌: el destino de una referencia que lo retira o lo cambia ----------
    ('DEC-ADDON-004#📌1', P_, None, AG, '«o por `S26`» (C8)', [(LOG, 3878, '`S25` a `S28` salieron')], 'C8', ''),
    ('DEC-ARCH-006#📌4', M_, None, AG, 'entero: `finDeServicio`, `vertical_discontinuation` y el hecho 4 salieron con C8', [C8], 'C8', ''),
    ('DEC-ARCH-006#📌5', M_, None, AG, 'entero: `finDeServicio` y el hecho 4 salieron con C8', [C8], 'C8', ''),
    ('DEC-ARCH-006#📌8', P_, None, AG,
     '«las filas vivas sin `CANCEL_SCHEDULED`» (contesta sobre la cancelación confirmada, lote D) y «siguen siendo once» (doce)',
     [(LOG, 2564, 'contesta sobre la cancelación confirmada por Mercado Pago'), DOCE], 'lote D', ''),
    ('DEC-ARCH-006#📌9', P_, None, AG, '«siguen en once» (doce)', [DOCE], None, 'cifra'),
    ('DEC-SUB-013#📌1', P_, None, AG, '`S26` y `S28` entre las diez salidas (C8)', [(LOG, 4078, '`S25` a `S28` salieron')], 'C8', ''),
    ('DEC-TEST-001#📌2', P_, None, AG, 'la cifra «32 guards» (hoy 35)', [G35], None, 'cifra'),
    ('DEC-TEST-001#📌3', P_, None, AG, 'la cifra «33 guards» (hoy 35)', [G35], None, 'cifra'),
    ('DEC-TEST-001#📌4', P_, None, AG, 'la cifra «33 guards» (hoy 35)', [G35], None, 'cifra'),
    ('DEC-TEST-001#📌5', P_, None, AG, 'la cifra «34» y «queda para el owner» (lo cerró el 📌 siguiente: `G18` en `V1`)',
     [(LOG, 4621, 'Cierra lo que el 📌 anterior dejaba para el owner.'), G35], None, ''),
    ('DEC-TEST-001#📌6', P_, None, AG, 'el reparto «18 de verticales, 15 de billing y 1 de `U1`» (hoy 19, 15 y 1: `G19`)', [G35], None, 'cifra'),
    ('DEC-RF-004#📌1', P_, None, AG, '`S12`-vía-`S26` y la lectura de `vertical_discontinuation` (C8); «queda del lado de la regla sólo `S17`» sigue',
     [(LOG, 5160, 'Con C8 el disparador 2')], 'C8', ''),
    ('DEC-RF-006#📌2', P_, None, AG, 'el `USER`/`GLOBAL` de `S26` y la vertical con fila en `vertical_discontinuation` (C8)',
     [(LOG, 5458, 'Con C8 el disparador 2'), (B02, None, '(las causas de la discontinuación salieron con la revisión del owner, 2026-09-28, C8)')], 'C8', ''),
    ('DEC-MP-008#📌2', P_, None, AG, 'la pausa hecha por el pagador deja de estar pendiente (`EX-53`); la cancelación desde su cuenta sigue pendiente',
     [(LOG, 5886, 'la pausa deja de estar pendiente en el 📌 anterior (N8)')], None, ''),
    ('DEC-SUB-021#📌1', P_, None, AG, 'la condición de su punto 1 (`GR-1` pasó a `VERIFIED`)',
     [(LOG, 5988, 'Levanta la condición del')], None, ''),
    ('DEC-MIG-005#📌1', M_, None, AG, 'entero', [(LOG, 6456, 'Quedan **`SUPERSEDED`**: el 📌 del 2026-09-27 (`R2`, `R21`')], 'S-37, S-41, S-42', ''),
    ('DEC-MIG-005#📌2', M_, None, AG, 'entero (`EX-48` y `EX-50` no se miden)', [(LOG, 6456, 'Quedan **`SUPERSEDED`**')], 'S-57, S-58', ''),
    ('DEC-MIG-005#📌4', M_, None, AG, 'entero (el detector del día siguiente)', [(LOG, 6456, 'Quedan **`SUPERSEDED`**')], 'S-42', ''),
    ('DEC-MIG-005#📌5', P_, None, AG, 'la parte del lote G (el detector del titular que sólo conoce el proveedor); lo del lote F sigue',
     [(LOG, 6461, '📌 del 2026-09-30, la parte del lote G')], 'S-38', ''),
    ('DEC-RF-008#📌3', P_, None, AG, 'la cifra «veintiuna» (hoy 25 vivas)', [(LOG, 6527, 'pasan de veintiuna a veintitrés vivas'), ACC25], None, 'cifra'),
    ('DEC-RF-008#📌4', P_, None, AG, 'la cifra «veintitrés» (hoy 25) y «las construye `V8`», que es `V8a`',
     [ACC25, (VD, None, 'y las acciones administrativas 15, 23 y 24')], 'Z', ''),
    ('DEC-ENT-006#📌1', P_, None, AG, '«se asigna al aprobar la postulación»: el rol llega con el reclamo',
     [(LOG, 6682, 'El rol de socio del')], 'lotes F y N', ''),
    ('DEC-ENT-006#📌2', P_, None, AG, '«o el alta directa del admin con dueño» y «`starts_at` y `ends_at` quedan hasta la unidad de socios»',
     [(LOG, 6693, 'del 📌 anterior se lee *«cuando queda con dueño»*'), AB_AP], 'lotes N y O; AB y AP', ''),
    ('DEC-ENT-006#📌3', P_, None, AG, '«los borra `V7` con su migración»: la migración estructural de `V7` la lleva `V6` al corte',
     [AB_AP], 'AB y AP', ''),
    ('DEC-ENT-006#📌4', P_, None, AG, '«en la misma migración de `V7`»: la lleva `V6` al corte', [AB_AP], 'AB y AP', ''),
    ('DEC-MIG-006#📌1', M_, None, AG, 'entero', [(LOG, 6937, 'Su 📌 del 2026-09-29 sale entero:')], 'S-28', ''),
    ('DEC-MIG-006#📌2', P_, None, AG, '«la escribe después el script del corte»: la escribe la herramienta del corte de `V6`',
     [(LOG, 6943, '**los escribe la herramienta del corte')], 'lote B', ''),
    ('DEC-ARCH-013#📌1', P_, None, AG,
     'las 11 migraciones «se congelan» (las saca `U1`) y «antes del ensayo del corte» (antes del merge de `V6`)',
     [(LOG, 7284, 'ya no se congelan hasta el paso 6: las saca de la rama'), MERGE_V6], 'lote 1 C, lote 3 D', ''),
    ('DEC-ARCH-013#📌3', P_, None, AG, '«las escribe después el script del corte»: la herramienta del corte de `V6`',
     [(LOG, 7297, '**los escribe la herramienta del corte de `V6`**')], 'lote B', ''),
    ('DEC-ARCH-013#📌4', P_, None, AG, 'la cifra «de 33 a 34» (hoy 35)', [G35], None, 'cifra'),
    ('DEC-ARCH-014#📌1', P_, None, AG, 'O-B: el cierre de la ruta hasta las lápidas del paso 4; las cifras «23 unidades», «33» y «once»',
     [(LOG, 7516, 'lote P pierde el Worker del borde (P-A) y el detector del día siguiente al corte (P-B), y el de'), DOCE, G35], 'S-40, S-45', ''),
    ('DEC-ARCH-014#📌2', P_, None, AG, 'P-A (el Worker) y P-B (el detector); las cifras «once» y «33»; P-C sigue',
     [(LOG, 7516, 'lote P pierde el Worker del borde (P-A)'), DOCE], 'S-42, S-45', ''),
    ('DEC-ARCH-014#📌5', P_, None, AG, '«`starts_at` y `ends_at` quedan hasta la unidad de socios» (los borra `V6` al corte) y la cifra «34»',
     [AB_AP, G35], 'AB y AP', ''),
    ('DEC-DATA-008#📌1', P_, None, AG, '«antes del ensayo del corte en staging» (antes del merge de `V6`)', [MERGE_V6], 'lote 3 D', ''),
    ('DEC-DATA-008#📌3', P_, None, AG, '«antes del ensayo» y la cifra «quince valores» (dieciocho)',
     [MERGE_V6, (LOG, 7353, 'pasa de quince a dieciocho plazos')], 'lote 3 D; lotes K y R', ''),
    ('DEC-DATA-008#📌4', P_, None, AG, '«antes del ensayo del corte en `staging`» (antes del merge de `V6`)', [MERGE_V6], 'lote 3 D', ''),
    ('DEC-ARCH-017#📌1', P_, None, AG, 'el renglón de addons de AP: «addons, `B4`, que le agrega a `payment` la columna»: las tablas son de `B3` y la columna nace con `payment` en `B5`',
     [(LOG, 7839, '**las tablas del modelo de addons'), AV], 'AV', ''),
]


def at(path, line, cita):
    L = lines(path)
    if line is None:
        hits = [n for n, l in enumerate(L, 1) if cita in l]
        if len(hits) != 1:
            sys.exit(f'✗ cita en {path}: {len(hits)} líneas contienen «{cita[:60]}»')
        line = hits[0]
    if line > len(L) or cita not in L[line - 1]:
        # the line moved when the sources were re-frozen: relocate it only if the quote is unique
        hits = [n for n, l in enumerate(L, 1) if cita in l]
        if len(hits) != 1:
            sys.exit(f'✗ cita ausente en {path}:{line}: «{cita[:60]}» ({len(hits)} líneas la contienen)')
        line = hits[0]
    return dict(archivo=path, linea=line, cita=cita, hash=line_hash(path, line))


def main(inv_p, out_p):
    inv = {i['id']: i for i in json.load(open(inv_p, encoding='utf-8'))['items']}
    out, vistos = {}, set()
    for kind, rows in (('MIXTO', MIXTO), ('PIN', PINES)):
        for cid, ver, cita, efecto, muerto, evid, base, razon in rows:
            it = inv.get(cid)
            if not it:
                sys.exit(f'✗ {cid} no está en el inventario')
            if cid in vistos:
                sys.exit(f'✗ {cid} adjudicado dos veces')
            vistos.add(cid)
            texto = lines(it['archivo'])[it['linea'] - 1]
            if cita is None:  # a pin: its own text after the marker, verbatim
                cita = re.sub(r'^[\s>\-\d.]*', '', texto).strip()[:140]
            if cita not in texto:
                sys.exit(f'✗ {cid}: la cita no está en su línea ({it["archivo"]}:{it["linea"]})')
            if ver != 'VIVO' and not muerto:
                sys.exit(f'✗ {cid}: {ver} sin «muerto»')
            out[cid] = dict(clase=kind, veredicto=ver, archivo=it['archivo'], linea=it['linea'], hash=it['hash'],
                            cita=cita, efecto=efecto, muerto=muerto,
                            evidencia=[at(*e) for e in evid], base=base, razon=razon,
                            cambia_sentido=False)
    faltan = sorted(i for i, it in inv.items() if it['estado'] == 'MIXTO' and i not in out)
    prosa = sorted(i for i, it in inv.items() if it['fuente'] == 'PIN' and it['forma'] == 'prosa' and i not in out)
    if faltan or prosa:
        sys.exit(f'✗ sin adjudicar: MIXTO {faltan} · 📌 en prosa {prosa}')
    resumen = {}
    for v in out.values():
        resumen.setdefault(v['clase'], {}).setdefault(v['veredicto'], 0)
        resumen[v['clase']][v['veredicto']] += 1
    doc = dict(sha=SHA, criterio=__doc__.split('Verdicts:')[1].strip(), resumen=resumen,
               cambian_el_sentido=[k for k, v in out.items() if v['cambia_sentido']], veredictos=out)
    json.dump(doc, open(out_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=4)
    print(f'SHA {SHA} · {len(out)} veredictos · {resumen} · cambian el sentido: {doc["cambian_el_sentido"]}')


if __name__ == '__main__':
    main(*sys.argv[1:3])
