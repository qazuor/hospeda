#!/usr/bin/env python3
"""Build hallazgos.json and correcciones.txt for the blind-verification round 2 (HOS-1352).

Every correction names a `sale` fragment that must be found verbatim on the given line of the REAL
spec (HEAD 200317c484); the script aborts if it is not, so no correction points at a wrong line.
"""
import json
import os
import sys

R = '/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign/.specs/HOS-1352-billing-verticals-redesign/spec-consolidada'
OUT = os.path.dirname(os.path.abspath(__file__))
G8 = 'scripts/generadores/g8/src/{}.md:{} (mismo texto, con `{{{{ID}}}}` y `@B`; regenerar con `gen.py {}`)'
GSEC = 'tramo g-secciones (scripts/generadores/secciones/gen.py): no se edita el .md'

H = []


def c(archivo, linea, sale, entra, generado=False, donde_va=None):
    return dict(archivo=archivo, linea=linea, generado=generado, donde_va=donde_va, sale=sale, entra=entra)


def g8(pieza, linea, sale, entra):
    return c(f'10-corte/{pieza}.md', linea, sale, entra, True, G8.format(pieza, linea, pieza))


def h(id, veredicto, clase, resumen, verif, evid, corr=None, fuente=None, owner=None, causa='', patron=None,
      miembros=None):
    H.append(dict(id=id, grupo=None, miembros=miembros or [id], veredicto=veredicto, clase_final=clase,
                  relacionados=[], resumen=resumen, verificadores=verif, respaldo='adjudicador',
                  evidencia=evid, correccion=corr, correccion_fuente=fuente, pregunta_owner=owner,
                  causa=causa, patron=patron))


B = '.specs/HOS-1354-billing-cobro-y-proveedor/'
P = '.specs/HOS-1352-billing-verticals-redesign/docs/'
V = '.specs/HOS-1353-verticales-capacidades-y-autorizacion/'

# ---------------------------------------------------------------- VB-01 ----------------------------
h('H2-VB01-3', 'REAL', 'MENOR',
  'El índice da el recuento del grafo «después de BL a BR» con 62 flechas; el 📌 de CD (DEC-ARCH-017#📌9) lo recontó a 63 con la flecha `B5 → V7` de BC, y 01 ya lo dice.',
  ['VB-01'],
  [P + '01-decision-log.md:8027 «recontado con `41-corte-del-mvp/`: 30 piezas, 22 al corte, 35 guards con 34 al corte, 63 flechas —la de BC, `B5 → V7`— y cero violaciones»',
   'spec 01-decisiones-vigentes.md:6675 (DEC-ARCH-017#📌9) «63 flechas —la de BC, `B5 → V7`—»',
   'spec 00-indice.md:91-93 «30 piezas, 22 al corte, 35 guards con 34 al corte, 62 flechas y cero violaciones»'],
  [c('00-indice.md', 93, 'con 34 al corte, 62 flechas y cero violaciones**. Las dos flechas nuevas son las de',
     'con 34 al corte, 63 flechas y cero violaciones** (la 63 es la fila 15 de `DEP`, `B5 → V7`, de [BC](01-decisiones-vigentes.md#own-41-corte-del-mvp-t7-bc), recontada con CD: [DEC-ARCH-017#📌9](01-decisiones-vigentes.md#dec-arch-017-p9)). Las dos flechas de BR son las de')],
  causa='recuento anterior a una letra posterior (CD) que no bajó al índice', patron='P-B')

h('H2-VB01-4', 'REAL', 'MENOR',
  'El índice manda la regla «ante un reclamo, mirar el PAGO, nunca el correo» a `#dec-mp-006`; vive en DEC-MAIL-001, implicación 1.',
  ['VB-01'],
  ['spec 01-decisiones-vigentes.md:4778 (bloque `dec-mail-001`, ancla en :4720) «1. **Regla para soporte, que sale directo de la medición: ante un reclamo, mirar el PAGO, nunca el correo.**»',
   'spec 01-decisiones-vigentes.md:2369 `dec-mp-006` es «El reloj de cobro es del proveedor»'],
  [c('00-indice.md', 1411, 'proveedor en [01-decisiones-vigentes.md](01-decisiones-vigentes.md#dec-mp-006).',
     'proveedor en [DEC-MAIL-001](01-decisiones-vigentes.md#dec-mail-001), implicación 1.')],
  causa='enlace a un ancla equivocada', patron='P-E')

# ---------------------------------------------------------------- VB-02 ----------------------------
h('H2-VB02-4', 'REAL', 'MENOR',
  'ACC:19 en el núcleo no lleva el predicado de CC (cuenta como cliente de una versión la fila con un `S38` encolado hacia ella), aunque su `Origen:` (08:209) lo trae; B2 y B3 sí lo tienen.',
  ['VB-02', 'VA-A1'],
  [P + 'nucleo/08-auditoria-y-observabilidad.md:209 «**y cuenta como cliente de una versión la fila con un `S38` encolado hacia ella, un descenso ya pedido** (corte del MVP, owner 2026-10-02, CC; `B/12` §3.2)»',
   'spec 02-nucleo.md:1237-1239 (ACC:19) «sobre una versión de plan **sin clientes** fija el precio; sobre una **con clientes se rechaza y se publica una versión nueva**, que rige para las altas nuevas» — sin CC',
   'spec 10-corte/B2.md:25, :48 y 10-corte/B3.md:186 (LISTA:B3 punto 12) sí lo traen'],
  [c('02-nucleo.md', 1239, 'altas nuevas ([DEC-MP-002](01-decisiones-vigentes.md#dec-mp-002), parte 1). El aviso y la mutación a',
     'altas nuevas ([DEC-MP-002](01-decisiones-vigentes.md#dec-mp-002), parte 1); **y cuenta como cliente de una versión la fila con un `S38` encolado hacia ella, un descenso ya pedido** (corte del MVP, owner 2026-10-02, [CC](01-decisiones-vigentes.md#own-41-corte-del-mvp-t12-cc); `B/12` §3.2). El aviso y la mutación a')],
  causa='letra del 2026-10-02 (CC) aplicada a la pieza y no al ítem del núcleo', patron='P-B')

# ---------------------------------------------------------------- VB-03 ----------------------------
h('H2-VB03-4', 'REAL', 'MENOR',
  'La cabecera de 03-contrato dice «las doce dependencias vivas entre épicas»; la fuente y el propio archivo (:1734) dicen trece desde que BC sumó la fila 15.',
  ['VB-03'],
  [B + 'descomposicion.md:330 «son ~~…~~ TRECE»', B + 'descomposicion.md:391 «**y BC suma la 15: son trece**»',
   'spec 03-contrato-de-cobertura.md:1734 «Son **trece**»'],
  [c('03-contrato-de-cobertura.md', 4, 'vigente (`docs/12-contrato-de-cobertura.md`, sin tachados), las doce dependencias vivas entre',
     'vigente (`docs/12-contrato-de-cobertura.md`, sin tachados), las trece dependencias vivas entre')],
  causa='texto propio de la spec anterior a un residuo corregido el 2026-10-02', patron='P-B')

h('H2-VB03-5', 'REAL', 'MENOR',
  '03-contrato:1777-1778 copia «Con el corte del MVP siguen siendo doce … cambian sus piezas, no su número» sin la cola «y BC suma la 15: son trece» que la fuente agregó (residuo corregido el 2026-10-02). La frase de :1770 «las doce siguen» es residuo de la fuente misma (descomposicion:361) y se deja anotada.',
  ['VB-03'],
  [B + 'descomposicion.md:391 «**Con el corte del MVP las filas siguen siendo doce** (…Z) **y BC suma la 15: son trece** (…BC; residuo corregido el 2026-10-02)»',
   'spec 03-contrato-de-cobertura.md:1777-1778 «**Con el corte del MVP siguen siendo doce** (corte del MVP, owner 2026-10-01, Z): cambian sus piezas, no su número.»',
   B + 'descomposicion.md:361 «las ~~once~~ doce dependencias siguen» (la fuente no lo actualizó)'],
  [c('03-contrato-de-cobertura.md', 1778, 'doce** (corte del MVP, owner 2026-10-01, Z): cambian sus piezas, no su número. La 4 y la 5 pasan a',
     'doce** (corte del MVP, owner 2026-10-01, Z) **y BC suma la 15: son trece** (corte del MVP, owner 2026-10-01, [BC](01-decisiones-vigentes.md#own-41-corte-del-mvp-t7-bc); residuo corregido el 2026-10-02): cambian sus piezas, no su número. La 4 y la 5 pasan a')],
  fuente=[{'archivo': B + 'descomposicion.md', 'linea': 361, 'nota': '«las doce dependencias siguen» quedó de antes de BC: dice trece'}],
  causa='residuo corregido el 2026-10-02 en la fuente que no bajó a la spec', patron='P-B')

# ---------------------------------------------------------------- VB-04 ----------------------------
h('H2-VB04-3', 'REAL', 'MENOR',
  'La fila 1 de la tabla de V1 para Partner dice «no se enciende en esta versión (V/11 §8, desarrollado en V4)»; la fuente, corregida el 2026-10-02, dice que el panel rechaza pasarlo de 0 a más de 0, y ese rechazo es de V2 (acción 18).',
  ['VB-04'],
  [V + 'docs/10-verticales-planes-billing-options.md:39 «~~Declararlo es el paso 1 del encendido…~~ el panel rechaza pasarlo de 0 a más de 0 (cap. 11 §8; revisión del owner, 2026-09-28, N7; residuo corregido el 2026-10-02, segunda vuelta del triage)»',
   V + 'descomposicion.md:491 «el rechazo del panel va con la unidad que construya la edición de los días de prueba: **`V2`**»',
   'spec 10-corte/V1.md:275'],
  [c('10-corte/V1.md', 275, 'y no se enciende en esta versión (`V/11` §8, desarrollado en `V4`)',
     'el panel rechaza pasarlo de 0 a más de 0 (`V/11` §8; N7; residuo corregido el 2026-10-02): lo rechaza la acción 18 de [V2](V2.md#pieza-v2)')],
  causa='residuo corregido el 2026-10-02 en la fuente que no bajó a la spec', patron='P-B')

# ---------------------------------------------------------------- VB-05 ----------------------------
h('H2-VB05-3', 'FUENTE', 'MENOR',
  'V3:419 dice que el reconciliador se dispara porque «toda transición de la máquina de suscripción está en la lista de invalidación (abajo)»; esa fila está tachada en V/02 y reemplazada por «llega el aviso de cobertura». La spec copia V/15 §2.6, que no se actualizó.',
  ['VB-05'],
  [V + 'docs/02-modelo-de-datos.md:678 «| ~~toda transición de la máquina de suscripción~~ **llega el aviso de cobertura**»',
   V + 'docs/15-entitlements-y-limits.md:203 «El recálculo ya ocurre: *«toda transición de la máquina de suscripción»* es…» (sin actualizar)',
   'spec 10-corte/V3.md:419 y su tabla (V3.md:647) con la fila nueva'],
  [c('10-corte/V3.md', 419, 'dispara por el recálculo, que ya ocurre porque toda transición de la máquina de suscripción está en',
     'dispara por el recálculo, que ya ocurre porque llegar el aviso de cobertura está en')],
  fuente=[{'archivo': V + 'docs/15-entitlements-y-limits.md', 'linea': 203, 'nota': 'cambiar la cita a «llega el aviso de cobertura», como V/02:678'}],
  causa='la fuente V/15 §2.6 quedó vieja frente a V/02 §2.6', patron='P-F')

h('H2-VB05-4', 'REAL', 'MENOR',
  'El «Dado» de AC:V4:15 (salida) pide «V3 y B1 mergeadas» y omite U2, aunque AC:V4:16 y «Espera a» exigen U2 (flecha U2→V4 de BR).',
  ['VB-05'],
  [V + 'descomposicion.md:64 y :623 (BR, flecha `U2→V4`)', 'spec 10-corte/V4.md:407 «`V4` no se mergea antes que `U2`»; V4.md:413'],
  [c('10-corte/V4.md', 413, '- **Dado** el PR de `V4` a la rama, con `V3` y `B1` mergeadas',
     '- **Dado** el PR de `V4` a la rama, con `V3`, `B1` y `U2` mergeadas (BR)')],
  causa='letra BR aplicada a un AC y no a la salida', patron='P-B')

# ---------------------------------------------------------------- VB-06 ----------------------------
h('H2-VB06-3', 'REAL', 'BLOQUEA',
  'AC:V6:3 enumera las transiciones que toman el lock del `user + vertical` y deja afuera `PB11`, que lo toma desde C10 porque comparte `MODERATED` con `PB12`; ni el AC ni su `Fuente:` nombran `PB11`, así que la carrera PB11∥PB12 queda sin cerrar.',
  ['VB-06', 'VA-A3'],
  [V + 'docs/03-maquinas-de-estado.md:890 «**`PB11` y `PB13` lo toman** (revisión del owner, 2026-09-28, C10): comparten `MODERATED` con `PB12`»',
   'spec 10-corte/V6.md:291-293 «cada una de `PB1`, …, `PB10`, `PB12` y `PB13` toma el lock»'],
  [c('10-corte/V6.md', 292, '`PB6`, `PB7`, `PB8`, `PB10`, `PB12` y `PB13` toma el lock del `user + vertical` y relee adentro su',
     '`PB6`, `PB7`, `PB8`, `PB10`, `PB11`, `PB12` y `PB13` toma el lock del `user + vertical` y relee adentro su'),
   c('10-corte/V6.md', 290, '`PB12` mientras `PB3` restituye, `PB6`/`PB10` contra `PB2`, y `PB8` contra `PB7`',
     '`PB12` mientras `PB3` restituye, `PB6`/`PB10` contra `PB2`, `PB8` contra `PB7`, y `PB11` contra `PB12` sobre una `MODERATED` (C10)')],
  causa='el AC enumera una lista cerrada y pierde un elemento que C10 agregó', patron='P-D')

h('H2-VB06-4', 'REAL', 'MENOR',
  'V5 (AC:V5:10, Modelo de datos y Abiertos) presenta como regla de la fuente que el enum de la base se recrea sin `USER_IMPERSONATE` y que una migración de datos saca sus filas «por el principio del lote 1 I»; es correcto en sustancia (vuelta 1, H-VB-B6-3, FALSO), pero es derivación y no va marcada: la vuelta 1 sólo la marcó en 80-abiertos.',
  ['VB-06'],
  [V + 'descomposicion.md:544 «el permiso no existe en el enum»', V + 'docs/17-autorizacion.md:476-478',
   'vuelta-1 H-VB-B4-3 (REAL MENOR: marcar la derivación) y H-VB-B6-3 (FALSO en sustancia)',
   'spec 10-corte/V5.md:277-280, :1207-1211, :1517-1520'],
  [c('10-corte/V5.md', 280, '§4.3: los permisos que salen, salen de la base).',
     '§4.3: los permisos que salen, salen de la base). *(Derivado: la fuente dice sólo «el permiso no existe en el enum», `V/descomposicion.md:544`; el carril sale del principio de `F5-AUT-023`, que la fuente fija para `U1`; lo marco.)*')],
  causa='derivación sin marcar (la corrección de la vuelta 1 se aplicó en un solo lugar)', patron='P-C')

h('H2-VB06-5', 'REAL', 'MENOR',
  'V5:800 enlaza «la decimotercera, moderar una ficha» a ACC:13, que es Reembolsar; moderar es ACC:12 (nota N1 del núcleo).',
  ['VB-06'],
  ['spec 02-nucleo.md:934-937 «la que las fuentes llaman «acción 13» o «la decimotercera» (moderar…) es [ACC:12]»', 'spec 02-nucleo.md:1140 «ACC:13 — Reembolsar»'],
  [c('10-corte/V5.md', 800, '([ACC:13](../02-nucleo.md#acc-13); FASE 8 completa',
     '([ACC:12](../02-nucleo.md#acc-12); FASE 8 completa')],
  causa='enlace a un ítem equivocado por la numeración N1', patron='P-E')

h('H2-VB06-6', 'REAL', 'MENOR',
  'El «Dado» de AC:V6:22 describe la versión 1 de los plazos de verticales con los plazos 1, 2, 3, 4, 7, 8 y 9 y omite el 5 y el 6, que son de verticales y tienen valor inicial escrito.',
  ['VB-06'],
  [P + 'nucleo/02-modelo-de-datos.md:175-176 (filas 5 y 6: «verticales», «10, 5, 2 y 0 días antes», «+1, +5, +15, +30 y +60 días»)', P + 'nucleo/02-modelo-de-datos.md:251 «la tabla de plazos de cada mitad … **`V6`** en verticales»'],
  [c('10-corte/V6.md', 535, '= 180 días, y los plazos 3, 4, 7, 8 y 9 con el valor que el owner fijó antes del merge de `V6`)',
     '= 180 días, plazo 5 = 10, 5, 2 y 0 días antes, plazo 6 = +1, +5, +15, +30 y +60 días, y los plazos 3, 4, 7, 8 y 9 con el valor que el owner fijó antes del merge de `V6`)')],
  causa='enumeración que resume la tabla y pierde dos filas', patron='P-D')

h('H2-VB06-7', 'FALSO', None,
  'AC:V5:23 corre «los casos de AC:V5:1 a AC:V5:16» y el verificador lee que deja afuera AC:V5:24.',
  ['VB-06'],
  ['spec 10-corte/V5.md: el ancla `ac-v5-24` está en el archivo entre `ac-v5-14` y `ac-v5-15`, así que el rango en orden del documento la incluye',
   'spec 10-corte/V5.md:422 «las trece cláusulas de su *«Lista cuando»* se cumplen»; V5.md:1206 la lista «sólo SUPER_ADMIN» es la cláusula 13 de LISTA:V5'],
  causa='el verificador leyó el rango por número y no por posición; la cláusula 13 de la salida cubre lo mismo')

# ---------------------------------------------------------------- VB-07 ----------------------------
h('H2-VB07-4', 'REAL', 'MENOR',
  '«El reparto» de V9a da el punto 4 (los tres avisos) a V9b; por BL el aviso «al archivar» lo encola V6 con PB4/PB5. La fila de V9b y V8a ya lo dicen bien; el reparto es texto propio de la spec.',
  ['VB-07'],
  [V + 'descomposicion.md:73 (V9b) «de los tres avisos, suma los dos previos y su job: el «al archivar» ya lo encola `V6` con `PB4` y `PB5` (…BL)»',
   'spec 10-corte/V9a.md:47-48; rg «el resto (1, 2, 4» en fuentes: 0'],
  [c('10-corte/V9a.md', 47, '**El reparto** (Z y AC): el punto 5 es de `V9a`; el 3, de `V4`; el resto (1, 2, 4, 6, 7 y 8), de',
     '**El reparto** (Z, AC y BL): el punto 5 es de `V9a`; el 3, de `V4`; del 4, el aviso *«al archivar»* lo encola `V6` con `PB4` y `PB5` (BL); el resto (1, 2, los dos avisos previos del 4, 6, 7 y 8), de')],
  causa='texto propio de la spec anterior a BL', patron='P-B')

# ---------------------------------------------------------------- VB-08 ----------------------------
h('H2-VB08-3', 'REAL', 'BLOQUEA',
  'B3 lista entre lo que crea «la tabla de deduplicación por id del hecho, UNIQUE(proveedor, id_del_hecho)»; en la fuente la restricción vive en `payment`, que nace en B5 (BN/AV), y B5 ya la pone ahí. Una tabla extra en el esquema del corte no se puede sacar después (DEC-ARCH-017 punto 7).',
  ['VB-08', 'VA-A6'],
  [B + 'docs/02-modelo-de-datos.md:379 «`payment` … `UNIQUE(proveedor, id_del_hecho)` — es la deduplicación del cap. 03 §10.2»',
   B + 'docs/02-modelo-de-datos.md:1291 «19 · los webhooks son idempotentes | `UNIQUE(proveedor, id_del_hecho)` en `payment`»',
   'spec 10-corte/B5.md:823 (la misma restricción en `payment`); rg «tabla de deduplicación» en fuentes: 0'],
  [c('10-corte/B3.md', 874, '- **La tabla de deduplicación por id del hecho**, `UNIQUE(proveedor, id_del_hecho)` ([LOCK:C6](../04-catalogos.md#lock-c6); [INV:19](../02-nucleo.md#inv-19)).',
     '- *(La deduplicación por id del hecho no es una tabla: es `UNIQUE(proveedor, id_del_hecho)` sobre `payment`, que nace en [`B5`](B5.md#fila-b5) —`B/02` §2.3 y §5; [LOCK:C6](../04-catalogos.md#lock-c6); [INV:19](../02-nucleo.md#inv-19); BN—.)*')],
  causa='invención de una tabla que el modelo no tiene', patron='P-G')

h('H2-VB08-4', 'REAL', 'MENOR',
  'B1:381-383 dice derivar quién demuestra cada defensa de la columna «qué defensa obliga a probar» «de las dos listas»; sólo la lista M tiene esa columna, la RP no.',
  ['VB-08'],
  [B + 'docs/20-testing.md:501 (encabezado de la lista M con la columna)', B + 'docs/20-testing.md:532-533 (encabezado de la lista RP: «qué exige el proveedor | fila»)'],
  [c('10-corte/B1.md', 382, 'la pieza que construye el mecanismo que nombra la columna *«qué defensa obliga a probar»* de las dos',
     'la pieza que construye el mecanismo que nombra la columna *«qué defensa obliga a probar»* de la lista M y, en la RP, que no tiene esa columna, la que construye lo que la fila exige; las dos')],
  causa='derivación con una premisa falsa sobre la fuente', patron='P-C')

h('H2-VB08-5', 'REAL', 'MENOR',
  'AC:B3:35 (salida) dice «los once puntos de LISTA:B3» y enumera once; la lista tiene doce desde CC/CF (el rechazo de la acción 19 con un S38 encolado).',
  ['VB-08'],
  [B + 'descomposicion.md:1057 (criterio de B3 con el punto de CC/CF)', 'spec 10-corte/B3.md:185-186 (LISTA:B3 punto 12)'],
  [c('10-corte/B3.md', 641, '- **Entonces** se cumplen los once puntos de [LISTA:B3](#lista-b3): diez altas simultáneas dejan una fila, un id y',
     '- **Entonces** se cumplen los doce puntos de [LISTA:B3](#lista-b3) —el 12, el rechazo de la acción 19 con un `S38` encolado, por [AC:B3:40](#ac-b3-40) (CC, CF)—: diez altas simultáneas dejan una fila, un id y')],
  causa='letra del 2026-10-02 (CC/CF) sumada a la lista y no a la salida', patron='P-B')

# ---------------------------------------------------------------- VB-09 (g8) -----------------------
h('H2-VB09-1', 'REAL', 'MENOR',
  'AC:B4:4 y TEST:B4:3 (la `retenciónDetenida` real) no piden `pausaTerminadaEn`, que la firma del contrato devuelve y leen V6/V9b; la regla sí está en las Reglas de B4 (l. 254).',
  ['VB-09'],
  [P + '12-contrato-de-cobertura.md:1084 y :1116 «`retenciónDetenida` devuelve también `pausaTerminadaEn` … La construye `B4` en la real»',
   'spec 10-corte/B4.md:140-145 (AC:B4:4) sin el campo; B4.md:254 «devuelve el fin de la última pausa … real en `B4`»'],
  [g8('B4', 146, 'falso ya lo devuelve—, o `NINGUNO` si nunca la perdió.',
      'falso ya lo devuelve—, o `NINGUNO` si nunca la perdió; y `pausaTerminadaEn`, el `fin_real` de la última pausa por `CUSTOMER_REQUEST` en esa vertical, o `NINGUNO` si nunca tuvo una (contrato §4.1, caso F-A).')],
  causa='el AC resume la firma del contrato y pierde un campo', patron='P-D')

h('H2-VB09-2', 'REAL', 'MENOR',
  'B4:277-278 extiende «contestando sobre la tabla vacía hasta B9b» a la fuente GRANT; al corte la tabla de grants no está vacía (el paso 3b escribe dos con la herramienta de B9a). La fuente es ambigua (descomposicion:146) pero AQ y la propuesta lo dicen sólo de CORTESÍA.',
  ['VB-09'],
  [P + '41-corte-del-mvp/00-propuesta.md:239 «fuente `CORTESÍA` | `B9a` (o `B4`) | tabla vacía hasta `B9b`»',
   B + 'descomposicion.md:146 (B9a) «la herramienta del paso 3b que escribe los dos `permanent_grant` del corte»'],
  [g8('B4', 278, '`CORTESÍA` y `GRANT` reales las trae `B9a`, contestando sobre la tabla vacía hasta `B9b` (AQ).',
      '`CORTESÍA` y `GRANT` reales las trae `B9a` (AQ): la de `CORTESÍA` contesta sobre la tabla vacía hasta `B9b`, y la de `GRANT` sobre los dos `permanent_grant` que escribe el paso 3b.')],
  causa='paráfrasis que toma la lectura amplia de una frase ambigua', patron='P-C')

h('H2-VB09-3', 'REAL', 'MENOR',
  'Los `Origen:` de los párrafos «Por la FASE 9 vuelta 3, además» de B4, B5 y B6 citan filas de `B/descomposicion.md` §2.11 corridas cinco líneas (apuntan a filas de B6/B11); las que los sostienen son +5.',
  ['VB-09'],
  [B + 'descomposicion.md:717 (RF2, B6), :720 (S36/RF1), :721 (EX-58), :722 (puedeCobrarle, B4), :726 (MP6), :729 (cancelado_visto_en), :730 (coberturaPerdidaEn)',
   'spec 10-corte/B4.md:55 (717, 724, 725), B5.md:68 (715, 721), B6.md:48 (712, 714, 715, 716)'],
  [g8('B4', 55, '' + B + 'descomposicion.md:717, ' + B + 'descomposicion.md:724, ' + B + 'descomposicion.md:725',
      '' + B + 'descomposicion.md:722, ' + B + 'descomposicion.md:729, ' + B + 'descomposicion.md:730'),
   g8('B5', 68, '' + B + 'descomposicion.md:715, ' + B + 'descomposicion.md:721',
      '' + B + 'descomposicion.md:720, ' + B + 'descomposicion.md:726'),
   g8('B6', 48, '' + B + 'descomposicion.md:712, ' + B + 'descomposicion.md:714, ' + B + 'descomposicion.md:715, ' + B + 'descomposicion.md:716',
      '' + B + 'descomposicion.md:717, ' + B + 'descomposicion.md:719, ' + B + 'descomposicion.md:720, ' + B + 'descomposicion.md:721')],
  causa='citas por línea tomadas de un SHA anterior de la fuente', patron='P-E', miembros=['H2-VB09-3', 'H2-VB09-6', 'H2-VB09-9'])

h('H2-VB09-5', 'REAL', 'MENOR',
  'TEST:B5:3 pide que un registro manual en paralelo «choque con el UNIQUE y falle»; AC:B5:3 y LOCK:C5 dicen que el manual que llega segundo no escribe cobertura y lo asienta MP6 con la marca 20.',
  ['VB-09'],
  ['spec 10-corte/B5.md:174-175 (AC:B5:3) «el registro manual que llega segundo no escribe cobertura: lo asienta `MP6` con la marca 20»',
   'spec 04-catalogos.md (LOCK:C5) «El registro manual que llega segundo no escribe cobertura, no compite: lo asienta `MP6` y abre `COBRO_DUPLICADO`»'],
  [g8('B5', 949, 'registro manual en paralelo choca con el `UNIQUE` y falla.',
      'registro manual en paralelo no escribe cobertura: lo asienta `MP6` y abre la marca 20 con el `manual_payment` colgado.')],
  causa='el TEST quedó con la regla anterior al lote W', patron='P-D')

h('H2-VB09-4b', 'REAL', 'MENOR',
  'AC:B5:3 termina «antes de registrar se relee si hay un pago del proveedor acreditado o en vuelo para ese período» sin la consecuencia: «y si lo hay, no se registra y se le dice al admin por qué».',
  ['VB-09', 'VA-A8'],
  [B + 'docs/05-idempotencia-y-concurrencia.md:261 «antes de registrar se relee si hay un pago del proveedor acreditado o en vuelo para ese período, y si lo hay, no se registra y se le dice al admin por qué»'],
  [g8('B5', 176, 'vuelo para ese período.', 'vuelo para ese período, y si lo hay, no se registra y se le dice al admin por qué (`B/05` C5).')],
  causa='el AC resume la regla y pierde su consecuencia', patron='P-D')

# ---------------------------------------------------------------- VB-10 ----------------------------
h('H2-VB10-2', 'REAL', 'BLOQUEA',
  'AC:B8a:2 (y su TEST) dan dos ramas del correo previo a cancelar (falla transitoria: no se cancela y se reintenta; sin destinatario: se cancela) y omiten la tercera: si el correo agota sus reintentos (`failed` definitivo) se cancela igual y se escala. Sin ella S11/S23/S24 reintentan para siempre y «cobraban las dos». B7 sí la tiene (AC:B7:7).',
  ['VB-10'],
  [B + 'docs/03-maquinas-de-estado.md:315-317 «**si agota sus reintentos** … **tampoco bloquea: se cancela igual y se escala como no-entregable, igual que sin destinatario**»',
   B + 'docs/03-maquinas-de-estado.md:322-325 (la regla vale para las filas que cancelan, `S11`, `S23`, `S24` incluidas)',
   'spec 04-catalogos.md TRANS:B:S11/S23/S24 copian sólo las dos ramas (la fuente las dejó así)'],
  [c('10-corte/B8a.md', 143, 'la cancelación **no se ejecuta en esta corrida** y se reintenta; si no hay destinatario, se cancela',
     'la cancelación **no se ejecuta en esta corrida** y se reintenta; **si agota sus reintentos —el `failed` definitivo de `NUCLEO/07` §1—, se cancela igual y se escala como no-entregable** (`B/03` §3.2); si no hay destinatario, se cancela')],
  fuente=[{'archivo': B + 'docs/03-maquinas-de-estado.md', 'linea': 0, 'nota': 'las filas S11, S23 y S24 (y las demás que cancelan) dicen sólo dos ramas aunque §3.2 dice que «la llevan escrita»: sumar la del `failed` definitivo'}],
  causa='el AC resume la regla y pierde una rama; la fila del catálogo la perdió en la fuente', patron='P-D')

h('H2-VB10-3', 'REAL', 'BLOQUEA',
  'AC:B8a:7 dice que la rama de S31 de `S12` (contracargo sobre una predecesora) «es de B8b»; por AS (ramas enteras al corte) y BL (la anterior escribe su rama y la llamada por interfaz; la posterior no toca código anterior), B8a escribe la rama y llama a S31 por interfaz, y B8b la implementa.',
  ['VB-10'],
  [P + '41-corte-del-mvp/10-decisiones-del-owner.md:137 (BL)', B + 'descomposicion.md:143 (B8a «con sus ramas enteras sobre el esquema vacío»)',
   'spec 04-catalogos.md TRANS:B:S12 «si la fila es la predecesora de una sucesión en curso, por el segundo evento corre `S31`»'],
  [c('10-corte/B8a.md', 218, 'fila es predecesora de una sucesión en curso, la rama de `S31` es de',
     'fila es predecesora de una sucesión en curso, **`B8a` escribe la rama entera y llama a `S31` por la interfaz interna**, que implementa')],
  causa='asignación de una rama contra BL/AS', patron='P-C')

h('H2-VB10-4', 'REAL', 'MENOR',
  'AC:B8a:7 y TEST:B8a:7 (S12 por contracargo) no dicen que el aviso a la persona es el correo de contracargo (fila 10-ter); lo trae TRANS:B:S12, que es su `Fuente:`.',
  ['VB-10'],
  ['spec 04-catalogos.md TRANS:B:S12 «**Y el aviso a la persona es el mismo correo de contracargo** (`NUCLEO/07` §6, `B/19` §4 fila 10-ter…)»', B + 'docs/19-superficies.md:120'],
  [c('10-corte/B8a.md', 217, 'ya lo canceló `S11`, y si esa cancelación no se confirmó la sigue el reintento del barrido—. Si la',
     'ya lo canceló `S11`, y si esa cancelación no se confirmó la sigue el reintento del barrido—; y el aviso a la persona es el correo de contracargo (fila 10-ter). Si la')],
  causa='el AC resume los efectos de la fila y pierde el aviso', patron='P-D')

h('H2-VB10-5', 'REAL', 'MENOR',
  'Ni AC:B8a:8 ni AC:B8a:9 dicen que S23/S24 sobre una predecesora disparan S18 (rama 6); AC:B7:25 se lo atribuye a «la rama escrita en B7», pero S23 y S24 son de B8a. Por BL la llamada a S18 por interfaz la escribe B8a.',
  ['VB-10'],
  ['spec 04-catalogos.md TRANS:B:S24 «Y si la fila es la predecesora de una sucesión en curso, dispara `S18`, igual que `S23`»',
   B + 'descomposicion.md:804 (BL aplicada: «`B5` (`S36`, `MP5`) y `B7` (`S6`, `S7`) llaman a `S18`»)', 'spec 10-corte/B7.md:452-454'],
  [c('10-corte/B8a.md', 231, 'nada**; **se libera el candado `A`**, así que la persona puede dar un alta nueva; y el acto es',
     'nada**; **se libera el candado `A`**, así que la persona puede dar un alta nueva; si la fila es predecesora de una sucesión en curso, llama a `S18` por la interfaz interna que implementa `B8b` (BL; rama 6); y el acto es'),
   g8('B7', 452, 'predecesora pide la baja por `S23` o `S24`, o revoca desde `GRACE_PERIOD` por `S36`)',
      'predecesora revoca desde `GRACE_PERIOD` por `S36`; la baja por `S23` o `S24` llama a `S18` desde la rama que escribe `B8a`)')],
  causa='llamada por interfaz asignada a la pieza que no es dueña de la transición', patron='P-C')

h('H2-VB10-7', 'REAL', 'MENOR',
  'B7:1528-1531 extiende la regla «dos ramas escritas y una prueba por rama» a `RN-3` (PARTIALLY_SUPPORTED); la fuente la da para filas UNKNOWN o que el proveedor no deja fabricar (`GR-2`, `PA-6`, `RC-8`), y ningún TEST de B7 cubre las ramas de RN-3.',
  ['VB-10'],
  [B + 'descomposicion.md:490-495 «una unidad que se apoya en una fila `UNKNOWN` … Vale para `B7` con `GR-2`, y para … (`PA-6`, `RC-8`)»'],
  [g8('B7', 1528, '`RN-3` y `GR-2` (grace), `PA-6` (la sucesora) y `RC-8` (el contracargo)',
      '`GR-2` (grace), `PA-6` (la sucesora) y `RC-8` (el contracargo)'),
   g8('B7', 1529, 'son filas `UNKNOWN` o `PARTIALLY_SUPPORTED` de la matriz en las que `B7` se apoya',
      'son filas `UNKNOWN` o que el proveedor no deja fabricar a voluntad, en las que `B7` se apoya')],
  causa='regla extendida más allá de su alcance', patron='P-G')

# ---------------------------------------------------------------- VB-11 ----------------------------
h('H2-VB11-2', 'REAL', 'BLOQUEA',
  'AC:V9b:10 (y TEST:V9b:10) dicen que los dos avisos previos de retención releen la cobertura; la fuente exige además releer el estado de la ficha y la pausa: no salen sobre una MODERATED ni PURGED ni con `retenciónDetenida` = sí. V9b no nombra MODERATED en ningún lado.',
  ['VB-11'],
  [P + 'nucleo/07-outbox-y-notificaciones.md:274 «**Y releen además el estado de la ficha y la pausa** (revisión del owner, 2026-09-28, N7, C14): no salen sobre una ficha `MODERATED` ni `PURGED`, ni mientras la pregunta `retenciónDetenida` del contrato conteste `sí`»',
   'spec 02-nucleo-outbox.md:302 (la fila del catálogo) lo tiene; 20-fase-1/V9b.md:229-230 no'],
  [c('20-fase-1/V9b.md', 230, '  y no salen si el dueño está cubierto; el previo al borrado nunca antes de la fecha que anunció el',
     '  y no salen si el dueño está cubierto; **releen además el estado de la ficha y la pausa: no salen sobre una ficha `MODERATED` ni `PURGED`, ni mientras `retenciónDetenida` conteste `sí`** (`NUCLEO/07` §6; N7, C14); el previo al borrado nunca antes de la fecha que anunció el')],
  causa='el AC resume la regla y pierde su condición', patron='P-D')

h('H2-VB11-3', 'REAL', 'MENOR',
  'B9a:1023 dice «las cláusulas 4 (la mitad del grant) y 7 son de B9a; las demás, de B9b», y B9b lista 1, 2, 3, 5, 6, 8 y 9: la mitad cortesía de la cláusula 4 no queda en ninguna. Por AQ la fuente CORTESÍA real también es de B9a (AC:B9a:12 la cubre).',
  ['VB-11'],
  [B + 'descomposicion.md:1066 (criterio de B9a con «la fuente `CORTESÍA` real contesta desde los datos sobre la tabla vacía» (AQ))', 'spec 20-fase-2/B9b.md:231'],
  [c('10-corte/B9a.md', 1023, 'Las cláusulas 4 (la mitad del grant) y 7 son de `B9a`; las demás, de',
     'Las cláusulas 4 (entera: la fuente `GRANT` y, por AQ, la `CORTESÍA` real sobre la tabla vacía) y 7 son de `B9a`; las demás, de')],
  causa='reparto anterior a AQ', patron='P-B')

h('H2-VB11-4', 'REAL', 'MENOR',
  'B9b:56 da el segundo disparador de S9 (la re-emisión sobre la sucesora) a B8b; la fuente sólo dice que S9 es compartida (B8b, B9b). La asignación es coherente con BL (B8b llama, B9b implementa y prueba la cláusula 6), pero no va marcada como derivada.',
  ['VB-11'],
  [B + 'descomposicion.md:852 «| `S9` | `B8b` `B9b` | compartida |»', B + 'descomposicion.md:667 «B9b (`S9` y el `14` §4.4)»'],
  [c('20-fase-2/B9b.md', 56, 'disparador de `S9` (la re-emisión sobre la sucesora), en [B8b](B8b.md#tpz-s9); el esquema de promos',
     'disparador de `S9` (la re-emisión sobre la sucesora), en [B8b](B8b.md#tpz-s9), que lo llama por interfaz desde el cierre de la sucesión *(derivado: la fuente da `S9` como compartida, `B/descomposicion.md:852`, y el reparto sale de BL; la cláusula 6 la prueba esta pieza; lo marco)*; el esquema de promos')],
  causa='derivación sin marcar', patron='P-C')

h('H2-VB11-5', 'REAL', 'MENOR',
  'V9b:21 cita «DEC-ARCH-017 punto 7» para «no reescribe filas ni código del corte»; el punto 7 es el esquema. Lo de no tocar lo construido es el punto 2.',
  ['VB-11'],
  ['spec 01-decisiones-vigentes.md (DEC-ARCH-017) punto 2 «**Lo que se difiere llega sin tocar nada de lo construido.**»; punto 7 «El esquema … una fase posterior no trae migración estructural»'],
  [c('20-fase-1/V9b.md', 21, 'reescribe filas ni código del corte ([DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017) punto 7).',
     'reescribe filas ni código del corte ([DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017) puntos 2 y 7).')],
  causa='cita a un punto equivocado', patron='P-E')

# ---------------------------------------------------------------- VB-12 ----------------------------
h('H2-VB12-2', 'REAL', 'BLOQUEA',
  'AC:B11:16, AC:B11:12 y TEST:B11:15 hacen leer los plazos 16, 17 y 18 de la versión de plazos VIGENTE («con la versión cambiada, la marca escala con el valor nuevo»); el núcleo dice que cada reloj guarda la versión con la que arrancó (el 17, la marca al abrirse) y que un cambio vale para los relojes que arrancan después.',
  ['VB-12'],
  [P + 'nucleo/02-modelo-de-datos.md:222 «**Cada reloj guarda la versión de plazos con la que arrancó** … un cambio vale para los relojes que arrancan después»',
   P + 'nucleo/02-modelo-de-datos.md:187-189 (16: la suscripción, al leerse `cancelled`; 17: la marca, al abrirse (`puesta_en`); 18: el pago o la instancia)',
   'spec 10-corte/B11.md:1506, :1569-1570, :2092'],
  [c('10-corte/B11.md', 1569, '- **Entonces** escala; y los plazos 16, 17 y 18 se leen del valor de la versión de plazos vigente y',
     '- **Entonces** escala; y los plazos 16, 17 y 18 se leen de la versión de plazos que guarda su reloj —el 16, la suscripción al leerse `cancelled`; el 17, la marca al abrirse (`puesta_en`); el 18, el pago o la instancia— ([PLAZO:16](../02-nucleo.md#plazo-16)–[PLAZO:18](../02-nucleo.md#plazo-18)) y'),
   c('10-corte/B11.md', 1506, '  valor de la versión de plazos vigente (180 días al inicio).',
     '  valor de la versión de plazos que guarda el pago (180 días al inicio; [PLAZO:18](../02-nucleo.md#plazo-18)).'),
   c('10-corte/B11.md', 2092, 'Con la versión de plazos cambiada a otro valor, la marca escala con el valor nuevo y no con 7.',
     'Con la versión de plazos cambiada después de abrirse una marca, esa marca escala con los 7 días de la versión que guardó al abrirse, y una marca abierta después del cambio escala con el valor nuevo.')],
  causa='la spec redactó «vigente» donde el núcleo versiona por reloj', patron='P-G', miembros=['H2-VB12-2', 'H2-VB12-3'])

h('H2-VB12-4', 'REAL', 'MENOR',
  'AC:B11:10 enumera los destinos de un cobro sin asentar visto por el barrido y omite la primera fila del desempate (terminal → COBRO_POSTERIOR_A_LA_BAJA, motivo 2); MOT:2 y la transcripción del §3 sí lo tienen.',
  ['VB-12', 'VA-A8'],
  [B + 'docs/09-conciliacion.md:187 «sobre cualquier otra, el motivo que asigna la tabla de desempate del `B/05` §3»', B + 'docs/05-idempotencia-y-concurrencia.md:356',
   'spec 04-catalogos.md:5639 (MOT:2, «desde la comparación de cobros del `B/09` §3, sobre las filas de la primera fila del desempate»)'],
  [c('10-corte/B11.md', 1474, '  con la que esa fila recibe el cobro; sobre las filas de la segunda fila del desempate abre',
     '  con la que esa fila recibe el cobro; sobre las de la primera fila del desempate (las terminales) abre `COBRO_POSTERIOR_A_LA_BAJA` ([MOT:2](../04-catalogos.md#mot-2)); sobre las filas de la segunda fila del desempate abre')],
  causa='el AC resume la tabla de desempate y pierde una fila', patron='P-D')

h('H2-VB12-5', 'REAL', 'MENOR',
  'B13a:457-458 dice que el reparto por fila de la fuente no nombra la rama desde PAUSED de la fila 8 («residuo H-VA-A7a-14»), y FILA:B13a (l. 433) la omite; la fuente la nombra desde el residuo corregido el 2026-10-02.',
  ['VB-12'],
  [B + 'descomposicion.md:152 «**y la rama desde `PAUSED` (`S22`) de la 8** (BH con AR…; residuo corregido el 2026-10-02), a `B8b`»'],
  [c('10-corte/B13a.md', 457, '[B8b](../20-fase-2/B8b.md#pieza-b8b). El reparto por fila de la fuente no la nombra (residuo',
     '[B8b](../20-fase-2/B8b.md#pieza-b8b). El reparto por fila de la fuente la nombra (`B/descomposicion.md:152`; residuo corregido el 2026-10-02, antes'),
   c('10-corte/B13a.md', 433, '16-bis, 17, 17-bis y 17-ter a `B8b`; 7-bis y',
     '16-bis, 17, 17-bis y 17-ter, **y la rama desde `PAUSED` (`S22`) de la 8**, a `B8b`; 7-bis y')],
  causa='residuo corregido el 2026-10-02 en la fuente que no bajó a la spec', patron='P-B')

# ---------------------------------------------------------------- VB-13 ----------------------------
h('H2-VB13-2', 'REAL', 'BLOQUEA',
  'AC:B8b:10/24, LISTA:B8b y sus TEST hacen que S18 abra REEMBOLSO_POR_CONFIRMAR sobre la predecesora que retiene un pago por S19, salvo tras S36; falta la otra excepción viva: el pagador manual cuyo pago retenido ya entró al crédito de la sucesora (DEC-SUB-017) no abre marca y no se reembolsa. Está en B7 (AC del crédito) pero S18 real es de B8b, y TRANS:B:S18 tampoco la trae.',
  ['VB-13'],
  [B + 'docs/12-suscripcion.md:711 «**Salvo el pagador manual cuyo pago retenido ya entró al crédito de la sucesora por `DEC-SUB-017`: ahí NO se abre la marca y el pago queda como crédito, no se reembolsa**»',
   P + '01-decision-log.md:5325 (📌 de DEC-SUB-017)', B + 'docs/03-maquinas-de-estado.md:168 (fila S18 de la fuente, sin la excepción)',
   'spec 10-corte/B7.md:308-310; 20-fase-2/B8b.md:539-540'],
  [c('20-fase-2/B8b.md', 540, '`REEMBOLSO_POR_CONFIRMAR` con el pago colgado —salvo si murió por `S36`, cuyo `RF1` ya lo devuelve—.',
     '`REEMBOLSO_POR_CONFIRMAR` con el pago colgado —salvo si murió por `S36`, cuyo `RF1` ya lo devuelve, y salvo el pagador manual cuyo pago retenido ya entró al crédito de la sucesora: ahí no abre la marca y el pago queda como crédito ([DEC-SUB-017#📌1](../01-decisiones-vigentes.md#dec-sub-017-p1); `B/12` §5.3)—.')],
  fuente=[{'archivo': B + 'docs/03-maquinas-de-estado.md', 'linea': 168, 'nota': 'la fila S18 no trae la excepción de DEC-SUB-017 que `12` §5.3 sí: sumarla (y con ella TRANS:B:S18 vía g3)'}],
  causa='excepción viva en un capítulo que no bajó a la pieza dueña de la transición', patron='P-D')

h('H2-VB13-3', 'REAL', 'MENOR',
  'AC:B8b:20 (y TEST:B8b:20) ejercen la rama 6 sólo con una predecesora en SUSPENDED; la rama cubre también la baja desde GRACE_PERIOD (S24) y el default devolver vale para las dos.',
  ['VB-13'],
  [B + 'docs/12-suscripcion.md:716 «desde `SUSPENDED` (`S23`) o desde `GRACE_PERIOD` (`S24`)»'],
  [c('20-fase-2/B8b.md', 665, '- **Dado** una predecesora en `SUSPENDED` que retiene un pago por `S19` y se da de baja ella misma',
     '- **Dado** una predecesora en `SUSPENDED` o en `GRACE_PERIOD` que retiene un pago por `S19` y se da de baja ella misma (`S23` o `S24`)')],
  causa='el AC toma un caso de la rama y pierde el otro', patron='P-D')

h('H2-VB13-4', 'REAL', 'MENOR',
  '80-abiertos cita las líneas 197-204 de 41-corte-del-mvp/10-decisiones-del-owner.md para «Lo que la propuesta no pudo verificar» y sus seis puntos; en la fuente congelada son 228 y 230-235 (CF y CG se insertaron antes).',
  ['VB-13', 'VA-A2'],
  [P + '41-corte-del-mvp/10-decisiones-del-owner.md:228-235', 'spec 80-abiertos.md:15, 19, 32, 40, 41, 42'],
  [c('80-abiertos.md', 15, '(línea 197)', '(línea 228)'), c('80-abiertos.md', 19, '(línea 199)', '(línea 230)'),
   c('80-abiertos.md', 32, '(línea 201)', '(línea 232)'), c('80-abiertos.md', 40, '(línea 202)', '(línea 233)'),
   c('80-abiertos.md', 41, '(línea 203)', '(línea 234)'), c('80-abiertos.md', 42, '(línea 204)', '(línea 235)')],
  causa='citas por línea de un SHA anterior de la fuente', patron='P-E')

# ---------------------------------------------------------------- VB-14 ----------------------------
h('H2-VB14-2', 'REAL', 'BLOQUEA',
  'AC:CORTE:2 dice que en la lista del seudónimo «entra sólo lo que la medición confirma»: le exige confirmación a todas las entradas y pierde que lo que la medición muestre fuera de la tabla vuelve al owner y no se aplica mientras no conteste. El paso 0 (l. 68-71) lo dice bien.',
  ['VB-14'],
  [P + '16-fase-7-del-paraguas.md:146 «lo que la tabla de `V/02` §2.2 da como *«si la medición lo confirma»* entra sólo si lo confirma, y lo que la medición muestre fuera de la tabla vuelve al owner y, mientras no conteste, no se aplica»'],
  [c('30-el-corte.md', 1578, '- **Entonces** la lista del seudónimo queda cerrada y medida antes del corte, y entra sólo lo que la',
     '- **Entonces** la lista del seudónimo queda cerrada y medida antes del corte: lo que la tabla de `V/02` §2.2 da como *«si la medición lo confirma»* entra sólo si lo confirma, y lo que la medición muestre fuera de la tabla vuelve al owner y no se aplica mientras no conteste; y entra lo que la')],
  causa='el AC parafrasea la regla y cambia su alcance', patron='P-D')

h('H2-VB14-4', 'REAL', 'MENOR',
  '«Lo que la persona ve en la ventana» (30-el-corte:237-239) da la Causa sin el hecho que justifica: el viejo manda su correo de baja, no se suprime (lo anticipa el aviso en persona, C12) y no baja las fichas.',
  ['VB-14'],
  [P + '16-fase-7-del-paraguas.md:334-338'],
  [c('30-el-corte.md', 238, '`F-8V1C2-010`): al cancelar el 1b, el viejo recibe cada cancelación. **Causa**: tocar el código',
     '`F-8V1C2-010`): al cancelar el 1b, el viejo recibe cada cancelación y manda su correo de baja; no se suprime: lo anticipa el aviso en persona del owner (C12), y las fichas no las baja. **Causa**: tocar el código')],
  causa='resumen que pierde el hecho', patron='P-D')

h('H2-VB14-5', 'REAL', 'MENOR',
  '30-el-corte:570 y :1875 citan el decision log :2824-2830 como fuente de la condición de T; esas líneas son el 📌 de P y Q; T está en :2838-2844.',
  ['VB-14'],
  [P + '01-decision-log.md:2838-2844 «**Y el mismo día, con OK del owner (T)** … **El guard cuenta sólo los commits propios de la épica**»'],
  [c('30-el-corte.md', 570, '01-decision-log.md:2824-2830`)', '01-decision-log.md:2838-2844`)'),
   c('30-el-corte.md', 1875, '01-decision-log.md:2824-2830`).', '01-decision-log.md:2838-2844`).')],
  causa='cita por línea corrida', patron='P-E')

h('H2-VB14-6', 'REAL', 'MENOR',
  '30-el-corte:1520 dice que el checklist lo escribe `B13`; desde Z es `B13a` (el resto del archivo y la «Dueña del AC» ya lo dicen).',
  ['VB-14'],
  [P + '41-corte-del-mvp/10-decisiones-del-owner.md:20 (Z)', P + '16-fase-7-del-paraguas.md:146, :160 (B13a)'],
  [c('30-el-corte.md', 1520, 'que escribe `B13` en `docs/billing/`', 'que escribe `B13a` en `docs/billing/`')],
  causa='residuo de la fuente (16-fase-7:1181) copiado', patron='P-B')

h('H2-VB14-7', 'REAL', 'MENOR',
  'GATE:M5 no trae «Los precios, congelados hasta este momento» (BM), aunque 00-indice:1392 manda ahí la regla; la regla vive en B2, el índice y 01.',
  ['VB-14'],
  [P + '16-fase-7-del-paraguas.md:1125-1133 «**Los precios, congelados hasta este momento** (…BM…) … **Ningún precio cambia hasta que el momento 5 esté cumplido**»'],
  [c('30-el-corte.md', 1431, '[B13a](10-corte/B13a.md#pieza-b13a).',
     '[B13a](10-corte/B13a.md#pieza-b13a). **Los precios, congelados hasta este momento** ([BM](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bm)): los del corte son los vigentes hoy, los carga el paso 3a y **ningún precio cambia hasta que el momento 5 esté cumplido**; es una condición operativa, no un control del código: la acción 19 existe desde `B2` y su uso queda vedado hasta acá.')],
  causa='sección de la fuente que no bajó al gate al que remite el índice', patron='P-D')

# ---------------------------------------------------------------- G1 -------------------------------
h('H2-G1-9', 'REAL', 'MENOR',
  'En DEC-GRANT-004 el 📌 en línea del punto 3 se lleva la cola del cuerpo («, y el aviso dice la fecha de fin nueva, no «un mes más»») y deja en el cuerpo un «(» sin cerrar: g1 corta los 📌 en línea por líneas y no por el paréntesis que los cierra.',
  ['G1'],
  [P + '01-decision-log.md:2054-2055 «… impl. 6), y el aviso dice la **fecha de fin nueva**, no «un mes más».»', 'spec 01-decisiones-vigentes.md:7651 y :7691'],
  [c('01-decisiones-vigentes.md', 7651, '  3. **Cortesía sobre cortesía** → **se SUMAN los días, no se reemplazan** (→ ver [📌1](#dec-grant-004-p1) (reemplaza parte de lo anterior; adjudicación).',
     '  3. **Cortesía sobre cortesía** → **se SUMAN los días, no se reemplazan** (→ ver [📌1](#dec-grant-004-p1)), y el aviso dice la **fecha de fin nueva**, no «un mes más» (el 📌1 reemplaza parte de lo anterior; adjudicación).',
     True, 'scripts/generadores/g1/gen01.py:189-232 (pin_segments/render_dec): un 📌 que abre con «(**📌» termina en el «)» que balancea ese paréntesis, aunque esté en la línea siguiente; lo que sigue vuelve al cuerpo')],
  causa='g1 segmenta los 📌 en línea por línea y no por paréntesis', patron='P-H')

h('H2-G1-10', 'REAL', 'MENOR',
  'Las letras G, S y T de 37-fase-8-vuelta-3 salen en el registro sin ⚠️ Caducada: S y T las tachó 16-fase-7:152 (S-09, S-27) y G la dio por SUPERSEDED el decision log (:6499-6500, S-38).',
  ['G1'],
  [P + '16-fase-7-del-paraguas.md:152 «~~; el mismo despliegue, decidido: … lote S).~~» y «~~… lote T).~~ (Salen los recuentos repetidos: con la regla del 0b nadie crea nada; S-27.)»',
   P + '01-decision-log.md:6499-6500 «y del 📌 del 2026-09-30, la parte del lote G (el detector del titular que sólo conoce el proveedor, S-38)»',
   'spec 01-decisiones-vigentes.md:12411, :12531, :12541'],
  [c('01-decisiones-vigentes.md', 12541, '- **elige**: **1**: se repiten los recuentos con el viejo apagado, antes de migrar; si no coinciden, aborto (lo ya aplicado)',
     '(sin cambio en el .md: lo agrega el generador)', True,
     'scripts/generadores/g1/omisiones.json, clave `letras_muertas`: sumar «OWN:37-fase-8-vuelta-3:t1:G» (entera; «el detector del titular salió, S-38», origen 01-decision-log.md:6499), «…:t1:S» (entera; «la razón y el orden salieron, S-09», origen 16-fase-7-del-paraguas.md:152) y «…:t1:T» (entera; «salen los recuentos repetidos, S-27», origen 16-fase-7-del-paraguas.md:152); regenerar con gen01.py')],
  causa='g1 no detecta letras caducadas por una fuente posterior', patron='P-H', miembros=['H2-G1-10', 'H2-G1-11', 'H2-G1-12'])

# ---------------------------------------------------------------- G2 -------------------------------
h('H2-G2-4', 'FALSO', None,
  'El verificador lee que la introducción de la matriz en 04 (texto del generador) cambia la definición de UNKNOWN («no por antigüedad») y deja afuera las reglas 2, 3 y 7 de D/06.',
  ['G2'],
  [B + 'docs/06-proveedor.md:378-381 (§8 regla 2: «Una fila caduca cuando cambia lo que la sostiene, no por antigüedad»), posterior y más precisa que D/06:138; la regla 3 de B/06 §8 está en B1.md:598',
   'la regla 2 de D/06 está en 10-corte/B1.md:652; la 3 y la 7 son reglas del proceso de diseño (ninguna decisión con fila UNKNOWN; re-verificar antes de FASE 10), que B1 traduce a la re-verificación por capability'],
  causa='el verificador comparó contra D/06 sin ver que B/06 §8 lo precisa y que B1 recoge el resto')

h('H2-G2-5', 'REAL', 'MENOR',
  'g3 `_adjuntar` cuelga del ítem por defecto (TRANS:B:S1, TRANS:B:MP1, …) toda sección cuyo título no nombra un id: «4. Grace» y «5. Pausa» quedan bajo S1 y «La pausa: no contradice el B/06 §7» bajo MP1. El texto es fiel; el ítem, no.',
  ['G2'],
  ['spec 04-catalogos.md:2031, :2090 (bajo `trans-b-s1`), :4912 (bajo `trans-b-mp1`)', 'scripts/generadores/g3/gen.py:329-334 (`_adjuntar`, defecto cuando el título no nombra ids)'],
  [c('04-catalogos.md', 2031, '**Texto de la fuente — «4. Grace»**', '(se mueve bajo TRANS:B:S4)', True,
     'scripts/generadores/g3/gen.py:329-334: `_adjuntar` no usa el defecto en silencio; busca el primer id del rango en el cuerpo de la sección o en un mapa explícito de g3/omisiones.json («adjuntar»: {"B/03:1589": "TRANS:B:S4", "B/03:1656": "TRANS:B:S8", "B/03:2410": "TRANS:B:S8"}) y sale con error si no encuentra ninguno; regenerar 04')],
  causa='g3 adjunta por defecto las secciones sin id en el título', patron='P-I')

# ---------------------------------------------------------------- VA-A3 ----------------------------
h('H2-VA3-1', 'REAL', 'BLOQUEA',
  'Los dos borrados remotos de PB12 (fotos y token de calendario) con las filas marcadas pendientes, la corrida diaria que los reintenta, su ping al monitor (alerta a las 26 h) y el reporte como error de lo que sobrevive son de V6 (la fuente: «Lo construye V6, con PB12»); la spec se los da a V9b (fase 1) y V6 no tiene ni AC, ni cron, ni las marcas en su modelo. V9b declara «sin migración estructural» y escribe marcas que nadie crea.',
  ['VA-A3', 'VA-A8'],
  [V + 'docs/02-modelo-de-datos.md:828-838 «Lo construye V6, con `PB12`, que llega antes que `PB9`»',
   V + 'descomposicion.md:519 (dueña **V6**, «`PB9` de V9b lo usa»)', B + 'docs/09-conciliacion.md:1153 (ping al terminar la corrida, alerta a las 26 h)',
   'spec 10-corte/V6.md:1010-1031 (modelo sin marcas), :1062-1073 (cron sin la corrida); 20-fase-1/V9b.md:149-150, :393-395, :600, :605-606'],
  [c('10-corte/V6.md', 1071, '  commit y con reintento.',
     '  commit y con reintento: **la corrida diaria que reintenta los borrados remotos pendientes de `PB12` (y de `PB9`, que la usa desde `V9b`)**, con ping al monitor de cron externo al terminar una corrida completa y alerta a las 26 h sin ping; una pendiente que sobrevive a una corrida se reporta como error en cada corrida (`V/02` §4.1, `V/descomposicion.md:519`, `B/09` §6).'),
   c('10-corte/V6.md', 1022, '- La tabla versionada de plazos de verticales con su versión 1 ([DEC-DATA-008#📌6](../01-decisiones-vigentes.md#dec-data-008-p6)).',
     '- Las marcas de borrado remoto pendiente en la fila de cada foto y en la de la conexión de calendario (`V/02` §4.1: la transacción las marca, no las borra).\n- La tabla versionada de plazos de verticales con su versión 1 ([DEC-DATA-008#📌6](../01-decisiones-vigentes.md#dec-data-008-p6)).'),
   c('20-fase-1/V9b.md', 150, '  confirman, y la corrida diaria los reintenta hasta confirmarlos; las reseñas de terceros se',
     '  confirman, y la corrida diaria de `V6` los reintenta hasta confirmarlos ([V6](../10-corte/V6.md#pieza-v6) la construye con `PB12`); las reseñas de terceros se')],
  causa='mecanismo asignado a la pieza posterior que lo usa en vez de a la anterior que lo construye', patron='P-C',
  miembros=['H2-VA3-1', 'H2-VA8-8'])

h('H2-VA3-2', 'FUENTE', 'BLOQUEA',
  'La fila 3 del piso (V2:476) dice que el dueño borra su ficha «desde cualquier estado salvo MODERATED» (K-4); g3 dejó al dueño borrar una MODERATED y PB12 tiene MODERATED en su desde. La fuente V/02:229 no se actualizó; la spec la copia fiel y queda contra V5:514, 04-catalogos:721-723 y AC:V6:11.',
  ['VA-A3'],
  [V + 'docs/02-modelo-de-datos.md:229 (fila 3, con la salvedad)', P + '30-revision-del-owner/10-decisiones-del-owner.md:45 (g3) «verla, exportarla, editarla y borrarla, no publicarla»',
   P + '26-fase-9-completa/05-R9-F8CA2004-reloj-y-publicacion.md:501 (K-4 puso la salvedad porque PB12 no tenía MODERATED, y anotó que si el owner quería «también moderada» el cambio era de la tabla)'],
  [c('10-corte/V2.md', 476, 'desde cualquier estado salvo `MODERATED`**',
     'desde cualquier estado, `MODERATED` incluida** ([g3](../01-decisiones-vigentes.md#own-30-revision-del-owner-t2-g3), que amplió el `desde` de `PB12`; la salvedad de `K-4` cayó con ella)')],
  fuente=[{'archivo': V + 'docs/02-modelo-de-datos.md', 'linea': 229, 'nota': 'tachar «salvo `MODERATED`» de la fila 3, por g3'}],
  causa='la fuente quedó vieja frente a una letra posterior (g3)', patron='P-F')

h('H2-VA3-4', 'REAL', 'MENOR',
  'AC:V6:13 (PB12 a PURGED) no dice que la llegada a PURGED cierra el pedido_de_arreglo abierto en el mismo acto y sin correo, ni que no escribe deleted_at (el trigger de user_bookmarks); lo dice la prosa de V6 (l. 705-707) y la lista cerrada vive en V9b (fase 1), aunque V6 la aplica al corte.',
  ['VA-A3'],
  [V + 'docs/02-modelo-de-datos.md:452, :801-802'],
  [c('10-corte/V6.md', 421, '  borrados remotos después del commit y con reintento); sale el correo de confirmación de',
     '  borrados remotos después del commit y con reintento); el `pedido_de_arreglo` abierto se cierra en el mismo acto y sin correo; llegar a `PURGED` no escribe `deleted_at` (el trigger de los favoritos no se dispara: `V/02` §4.1); sale el correo de confirmación de')],
  causa='el AC resume la lista cerrada y pierde dos elementos', patron='P-D')

h('H2-VA3-5', 'REAL', 'MENOR',
  'Ninguna pieza lista la migración que vuelve anulable la FK de la conversación a la ficha (hoy `onDelete: restrict`, no anulable): V6 la usa (Lista cuando, AC:V6:13) pero su modelo de datos no la nombra, y V9b dice «sin migración estructural».',
  ['VA-A3'],
  [V + 'docs/02-modelo-de-datos.md:800 «es anulable, y leer la conversación no la exige. Hoy es `onDelete: restrict` y no anulable»'],
  [c('10-corte/V6.md', 1019, '- `pedido_de_arreglo` (la ficha, el motivo, una fecha sugerida anulable, si el dueño avisó que',
     '- `conversations`: la referencia a la ficha pasa a anulable (hoy `onDelete: restrict` y no anulable; `V/02` §4.1), para que `PB12` deje la conversación en sólo lectura.\n- `pedido_de_arreglo` (la ficha, el motivo, una fecha sugerida anulable, si el dueño avisó que')],
  causa='ESQ/modelo resume el esquema y pierde un cambio estructural', patron='P-A')

# ---------------------------------------------------------------- VA-A4 / VA-A5 --------------------
h('H2-VA4-3', 'REAL', 'MENOR',
  'V/11 §4.2 pide que el costo máximo por persona (cuota × verticales con trial × meses) sea visible para quien fija la cuota; sólo vive en la prosa de V4, ninguna superficie lo construye.',
  ['VA-A4'],
  [V + 'docs/11-trial.md:219-221 «Lo que sí hace falta es que el número de arriba sea visible para quien fija la cuota»', 'spec 10-corte/V4.md:579-581; V8a.md:409 (editor del catálogo) sin él'],
  [c('10-corte/V8a.md', 409, 'muestra la versión vigente al lado de la que se va a publicar, clave por clave, y cada rechazo de validación con su mensaje;',
     'muestra la versión vigente al lado de la que se va a publicar, clave por clave, y cada rechazo de validación con su mensaje; junto a la cuota de trial, el costo máximo por persona que resulta (cuota × verticales con trial encendido × meses que permite el techo; `V/11` §4.2) *(derivado: la superficie de quien fija la cuota es este editor; lo marco)*;')],
  causa='requisito de superficie sin pieza dueña', patron='P-J')

h('H2-VA5-2', 'REAL', 'BLOQUEA',
  'El e2e del trial completo (V/20 §5 punto 1: activación, campaña previa, vencimiento, recuperación y conversión tardía) no es AC ni TEST de ninguna pieza: B/20 §5.1 punto 3 reparte «cada flujo» por unidad y no nombra la del trial; V4 no tiene ningún e2e.',
  ['VA-A5'],
  [V + 'docs/20-testing.md:371-381', B + 'docs/20-testing.md:762-765 «Cada flujo del §5, y el trial completo de `V/20` §5 … **Cada unidad escribe la de su flujo**»',
   'spec 30-el-corte.md:1535-1544 (sólo como texto)'],
  [c('10-corte/V4.md', 410, '',
     '(antes de AC:V4:15, un AC nuevo) **AC:V4:17** — El trial completo, de punta a punta (`V/20` §5 punto 1; `B/20` §5.1 punto 3). Dado el arnés de `B/20` §5.1 —los builds, el falso como servidor, el reloj adelantable y el correo capturado—; Cuando se corre el trial completo: activación, campaña previa, vencimiento, campaña de recuperación y conversión tardía; Entonces se cumplen las aserciones sobre el contenido de los avisos y el orden de los correos, como en [AC:B3:33](B3.md#ac-b3-33). *(Derivado: «cada unidad escribe la de su flujo» y el flujo del trial es de `V4`; lo marco.)* Con su TEST e2e.')],
  causa='un flujo e2e exigido sin pieza dueña', patron='P-J')

h('H2-VA5-4', 'REAL', 'MENOR',
  'TEST:V6:16, mitad (c) de G-R6-B, rompe la lectura de `PB4` en vez de la del día 180 (PB9, que llega con V9b) sin declararlo, y no exige que el rojo diga «lector declarado que ya no lee» y lo nombre.',
  ['VA-A5'],
  [V + 'docs/20-testing.md:203-204 «el rojo tiene que decir *«lector declarado que ya no lee»* y nombrarlo»', V + 'docs/20-testing.md:257'],
  [c('10-corte/V6.md', 1214, 'de `PB4`; (d) quitar de `PB5` la consulta a `retenciónDetenida`, y en otro caso contar sólo desde',
     'de `PB4` *(la fuente rompe la del día 180, `PB9`, que llega con `V9b`; derivado, lo marco)*, y el rojo dice *«lector declarado que ya no lee»* y nombra a `PB4`; (d) quitar de `PB5` la consulta a `retenciónDetenida`, y en otro caso contar sólo desde')],
  causa='adaptación de la fuente sin marcar y con una exigencia menos', patron='P-C')

h('H2-VA5-5', 'FALSO', None,
  'El verificador pide que algún AC compruebe que ningún producto LISTING declare a Partner entre sus verticales compatibles.',
  ['VA-A5'],
  [V + 'docs/18-partner.md:68-72 «la incompatibilidad es **un dato**» (no un control); el propio verificador lo reconoce'],
  causa='el verificador pide un control que la fuente descarta')

# ---------------------------------------------------------------- VA-A6 ----------------------------
h('H2-VA6-3', 'FUENTE', 'MENOR',
  'EX-57 está VERIFIED desde el 2026-09-30 (descomposicion:470, 04-catalogos:9673, 00-indice:1510), pero B11 (g-secciones l. 925 y 1264; AC:B11:13), B10 (g-secciones) y la tabla de filas abiertas de B1 la dan UNKNOWN con la rama «si no lo permite». Las copias vienen de 09-conciliacion y 16-addons, que no se actualizaron.',
  ['VA-A6'],
  [B + 'descomposicion.md:470 «`EX-57` … `VERIFIED` desde el 2026-09-30»', B + 'docs/09-conciliacion.md:913, :1292 «`EX-57`, `UNKNOWN`»'],
  [c('10-corte/B11.md', 1519, '  reenviar nada al proveedor, con la propuesta de asentar y devolver. Si `EX-57` da que el proveedor',
     '  reenviar nada al proveedor, con la propuesta de asentar y devolver (`EX-57` está `VERIFIED` desde el 2026-09-30: la búsqueda existe). Si la búsqueda falla en una corrida, el proveedor'),
   c('10-corte/B1.md', 670, '| `EX-57` | si una orden de `/v1/orders` se encuentra por su `external_reference` sin conocer su id |',
     '(la fila sale de la tabla de filas abiertas: `EX-57` es `VERIFIED` desde el 2026-09-30, `B/descomposicion.md:470`)')],
  fuente=[{'archivo': B + 'docs/09-conciliacion.md', 'linea': 913, 'nota': '`EX-57`, `UNKNOWN` → `VERIFIED` (2026-09-30), y la rama «si no lo permite» pasa a «lo que no cierra» o sale; igual en :1292 y en 16-addons.md:1084; después regenerar g-secciones'}],
  causa='la fuente quedó vieja frente a la matriz', patron='P-F')

h('H2-VA6-5', 'REAL', 'MENOR',
  'ESQ:5 (B3 crea plan_migration y plan_migration_subscription) remite a «B/02 §2.2, l. 61-62» sin dar las columnas: `anunciada_en`, el plazo, quién la firmó, `cancelada_en` y quién la canceló (anulables), y en la segunda la fecha de aplicación, el estado, el motivo de un FUERA y `aplicada_en`. Nacen al corte y una fase posterior no trae migración estructural.',
  ['VA-A6'],
  [B + 'docs/02-modelo-de-datos.md:61-62'],
  [c('10-corte/B3.md', 890, 'Son `plan_migration` y `plan_migration_subscription` (`B/02` §2.2, l. 61-62), con',
     'Son `plan_migration` —la versión retirada y la destino, `anunciada_en`, el plazo del aviso con que se anunció, quién la firmó, y `cancelada_en` y quién la canceló, las dos anulables— y `plan_migration_subscription` —la suscripción, su fecha de aplicación, su estado, el motivo de un `FUERA` y `aplicada_en`— (`B/02` §2.2, l. 61-62), con')],
  causa='ESQ resume el esquema y pierde columnas', patron='P-A')

h('H2-VA6-6', 'REAL', 'MENOR',
  'B3 crea `subscription_pause` sin columnas ni su restricción («a lo sumo una sin fin_real por suscripción»); la restricción sólo aparece en los efectos de TRANS:B:S10 (B8b).',
  ['VA-A6'],
  [B + 'docs/02-modelo-de-datos.md:59 «`subscription_pause`: suscripción, motivo (`CUSTOMER_REQUEST` o `COURTESY`), meses pedidos, inicio, fin previsto, fin real | a lo sumo una sin `fin_real` por suscripción»'],
  [c('10-corte/B3.md', 870, '- **`subscription_pause`** (`B/02` §2.2), que cuelga de `subscription` y lee el espejo del §10.1.',
     '- **`subscription_pause`** (`B/02` §2.2): la suscripción, el motivo (`CUSTOMER_REQUEST` o `COURTESY`), los meses pedidos, el inicio, el fin previsto y el fin real; **a lo sumo una sin `fin_real` por suscripción** (índice parcial); cuelga de `subscription` y lee el espejo del §10.1.')],
  causa='ESQ resume el esquema y pierde una restricción', patron='P-A')

h('H2-VA6-7', 'REAL', 'MENOR',
  'B9a «lee, sin crearlo, el título de addon_instance, de B3»; el ancla del título apunta a `permanent_grant_vertical`, que crea B9a, y por BN la FK hacia una tabla que nace después nace con la dueña de la tabla destino. ESQ:8 tampoco lista la columna.',
  ['VA-A6'],
  [B + 'docs/02-modelo-de-datos.md:575 «**El ancla del título apunta a `permanent_grant_vertical` y sí es anulable**»', B + 'descomposicion.md:808-810 (BN)'],
  [c('10-corte/B9a.md', 1100, '  `motivo_cierre`), creadas por `B3` (BG); y el título de `addon_instance`, de `B3` (AV).',
     '  `motivo_cierre`), creadas por `B3` (BG).\n- **Crea, por BN**: la columna del ancla del título de `addon_instance` (anulable) con su FK a `permanent_grant_vertical`, que nace acá (`B/02` §2.4; [BN](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bn)).')],
  causa='columna con FK a una tabla posterior asignada contra BN', patron='P-A')

h('H2-VA6-8', 'REAL', 'MENOR',
  'La definición de `provider_link` en B3 no dice que no guarda al pagador del proveedor (`payer_id` no es identidad estable, ningún vínculo se apoya en él).',
  ['VA-A6'],
  [B + 'docs/02-modelo-de-datos.md:60'],
  [c('10-corte/B3.md', 868, '  id_del_proveedor)` y `UNIQUE(subscription_id)`. *(La columna `cancelado_visto_en` la asigna el',
     '  id_del_proveedor)` y `UNIQUE(subscription_id)`; **no guarda al pagador del proveedor, a propósito**: `payer_id` no es una identidad estable y ningún vínculo entre una cuenta nuestra y un pagador se apoya en él (`B/02` §2.2). *(La columna `cancelado_visto_en` la asigna el')],
  causa='ESQ resume el esquema y pierde una restricción negativa', patron='P-A')

h('H2-VA6-9', 'REAL', 'MENOR',
  'Las citas «l. N» en prosa de B1, B2 y B3 a `B/descomposicion.md` §3, §3.1, §4 y §5 están corridas entre 17 y 41 líneas (B3:947 «§3.1, l. 935-936» es «B4 es el hito»; «§3, l. 842» es el encabezado de §2.12; «§5, l. 1048-1050» cae en §4); los `Origen:` sí apuntan bien.',
  ['VA-A6'],
  [B + 'descomposicion.md:903 (B2 con B1), :924 (camino crítico del corte), :976-977 (pantalla mínima), :1055-1057 (§4 filas B1–B3), :1089-1091 (§5 filas B1–B3)'],
  [c('10-corte/B3.md', 947, '(`B/descomposicion.md` §3.1, l. 935-936)', '(`B/descomposicion.md` §3.1, l. 976-977)'),
   c('10-corte/B1.md', 901, '(`B/descomposicion.md` §3, l. 842)', '(`B/descomposicion.md` §3, l. 903)'),
   c('10-corte/B2.md', 506, '`B/descomposicion.md` §3, l. 842)', '`B/descomposicion.md` §3, l. 903)'),
   c('10-corte/B3.md', 18, '`B/descomposicion.md` §3, l. 883)', '`B/descomposicion.md` §3, l. 924)'),
   c('10-corte/B1.md', 913, '(`B/descomposicion.md` §5, l. 1048)', '(`B/descomposicion.md` §5, l. 1089)'),
   c('10-corte/B2.md', 529, '(`B/descomposicion.md` §5, l. 1049)', '(`B/descomposicion.md` §5, l. 1090)'),
   c('10-corte/B3.md', 1330, '(`B/descomposicion.md` §5, l. 1050)', '(`B/descomposicion.md` §5, l. 1091)')],
  causa='citas por línea en prosa tomadas de un SHA anterior de la fuente (las de «Origen:» se regeneraron, éstas no)', patron='P-E')

# ---------------------------------------------------------------- VA-A8 ----------------------------
h('H2-VA8-3', 'REAL', 'BLOQUEA',
  'g-secciones descarta como muerta toda fila cuya primera celda EMPIEZA con un tachado aunque siga texto vivo (`comun.dead_row`: `^\\s*~~`). Se perdieron tres filas vivas: en B11 §3 «el `last_modified` del recurso» (el recurso cambió sin avisarnos: se relee entero; ningún AC ni el cron de B11 lo recogen) y «monto esperado, derivado»; en B13a la de COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN (motivo 15), con lo que «las filas de la tabla son once» no cierra.',
  ['VA-A8', 'VA-A10'],
  [B + 'docs/09-conciliacion.md:185 «| ~~monto vigente~~ **monto esperado, derivado** …»', B + 'docs/09-conciliacion.md:188 «| ~~la `version` del recurso~~ **el `last_modified` del recurso** | … se relee entero»',
   B + 'docs/19-superficies.md:234 «| ~~`COMPLEMENTO_…_O_DISCONTINUACIÓN`~~ `COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN` (motivo **15** …) | **devolver** …»',
   'scripts/comun.py:113-121 (`dead_row`: «if re.match(r\'^\\s*~~\', cs[0]): return True»); barrido sobre todas las secciones de secciones/fuentes.json: son exactamente estas tres'],
  [c('10-corte/B11.md', 237, '', '(regenerado: entran las filas «monto esperado, derivado» y «el `last_modified` del recurso» del §3)', True,
     'scripts/comun.py:116-117: una fila es muerta por su primera celda sólo si la celda ENTERA está tachada (`STRUCK_CELL.match(cs[0])`), no si empieza con `~~`; después correr secciones/gen.py y g3/gen.py y revisar el diff (04 no debe cambiar; B11 y B13a ganan las tres filas)')],
  causa='el generador confunde «la primera celda empieza tachada» con «la fila está tachada»', patron='P-K',
  miembros=['H2-VA8-3', 'H2-VA8-4', 'H2-VA10-7'])

h('H2-VA8-4b', 'REAL', 'MENOR',
  'AC:B11:9 define el monto esperado como «derivado, redondeado una sola vez hacia abajo» y pierde que es el precio vigente de la versión con los aumentos de DEC-MP-002 ya aplicados, menos las promos vivas, con el mismo cálculo que usa quien muta.',
  ['VA-A8'],
  [B + 'docs/09-conciliacion.md:185'],
  [c('10-corte/B11.md', 1445, '- **Dado** una fila cuyo monto esperado —derivado, redondeado una sola vez hacia abajo— difiere del',
     '- **Dado** una fila cuyo monto esperado —derivado: el precio vigente de su versión de plan con los aumentos de `DEC-MP-002` ya aplicados, menos las promos vivas según su contador, redondeado una sola vez hacia abajo y con el mismo cálculo que usa quien muta— difiere del')],
  causa='el AC resume la definición y pierde sus términos', patron='P-D')

h('H2-VA8-9', 'REAL', 'MENOR',
  'El barrido que relee los pagos en CHARGED_BACK hasta que su status_detail se resuelva (settled o reimbursed), y la rama settled con su correo, no están en ningún AC ni TEST: AC:B11:12 selecciona sólo SUCCEEDED, PARTIALLY_REFUNDED y REFUNDED.',
  ['VA-A8'],
  [B + 'docs/09-conciliacion.md:809', 'spec 10-corte/B11.md:826-833 (transcripción)'],
  [c('10-corte/B11.md', 1512, '', '(AC nuevo, antes de AC:B11:13) **AC:B11:12-bis** — Dado un pago en `CHARGED_BACK`, Cuando el barrido lo relee por id cada día, Entonces sigue hasta que su `status_detail` se resuelve: `reimbursed` corre `P7`; `settled` lo deja en `CHARGED_BACK` y sale el correo *«la disputa se resolvió a favor de la persona»* (`B/09` §3; `NUCLEO/07` §6). Con su TEST.')],
  causa='regla del capítulo sin AC en la pieza dueña', patron='P-D')

h('H2-VA8-10', 'REAL', 'MENOR',
  'AC:B11:23 (barrido de creaciones) no prueba que, tras una búsqueda vacía, la corrida siguiente vuelve a crear con una clave nueva acuñada y persistida antes de llamar, ni que la búsqueda es sin filtro de estado.',
  ['VA-A8'],
  [B + 'docs/09-conciliacion.md:1083', B + 'docs/05-idempotencia-y-concurrencia.md:71'],
  [c('10-corte/B11.md', 1675, '  todavía en `PENDING_AUTHORIZATION`, aparece otro `pending` que la nombra, lo cancela igual.',
     '  todavía en `PENDING_AUTHORIZATION`, aparece otro `pending` que la nombra, lo cancela igual; la búsqueda es sin filtro de estado, y si vuelve vacía la corrida siguiente vuelve a crear con una clave nueva acuñada y persistida antes de llamar (`B/09` §6, `B/05` §1).')],
  causa='el AC prueba la mitad del mecanismo', patron='P-D')

h('H2-VA8-11', 'REAL', 'MENOR',
  'Los dos guards del cap. 06 §9 —entorno (`GET /users/me`: todo lo que muta abre con él) y presupuesto (toda sonda que mueve plata aborta si el máximo no da el número autorizado)— viven sólo en las Reglas/tabla de B1 y en Seguridad; ningún AC de B1 ni guard del catálogo los recoge.',
  ['VA-A8'],
  [B + 'docs/06-proveedor.md:218, :402, :407', 'spec 10-corte/B1.md:545-550, :618-624, :745'],
  [c('10-corte/B1.md', 745, '- Los dos guards del cap. 06 §9, entorno y presupuesto, rigen sobre la batería (`B/20` §4.1 punto 3).',
     '- Los dos guards del cap. 06 §9, entorno y presupuesto, rigen sobre la batería (`B/20` §4.1 punto 3), y van como AC propio: toda sonda o mutación contra el proveedor abre con `GET /users/me` y aborta contra la cuenta equivocada; toda sonda que mueve plata aborta si el máximo a cobrar no da exactamente el número autorizado; con su TEST contra el falso.')],
  causa='regla del capítulo sin AC en la pieza dueña', patron='P-D', miembros=['H2-VA8-11', 'H2-VA8-12'])

# ---------------------------------------------------------------- VA-A10 ---------------------------
h('H2-VA10-2', 'REAL', 'BLOQUEA',
  'El job de vencimiento del trial (T3, de V4) tiene que releer la fecha de fin dentro de su transacción y no actuar sobre la que leyó al armar el lote: T3 no tiene otra condición. Sólo vive en la transcripción de B/14 §3.3 dentro de B9a; TRANS:V:T3 dice condición «—» y ningún AC/TEST de V4 lo pide.',
  ['VA-A10'],
  [B + 'docs/14-promos-cortesias-y-grants.md:376-378 «**El job de vencimiento re-lee la fecha de fin dentro de su propia transacción** … T3 no tiene ninguna otra condición»',
   'spec 10-corte/B9a.md:358-364; 10-corte/V4.md:39-41 (el lock, sin relectura de la fecha)'],
  [c('10-corte/V4.md', 40, '   siete transiciones**; `T4` con la fecha de fin sin pasar, y `T3` sin escribir el reloj (`03` §2;',
     '   siete transiciones**; `T4` con la fecha de fin sin pasar, y `T3` sin escribir el reloj y **releyendo la fecha de fin dentro de su transacción, no la que leyó al armar el lote** (`B/14` §3.3: es lo único que frena a `T3`) (`03` §2;')],
  causa='regla de una transición escrita en el capítulo de otra épica y no bajada a la pieza dueña', patron='P-D')

h('H2-VA10-3', 'REAL', 'BLOQUEA',
  'La confirmación de OTORGAR un grant tiene que decir que termina cualquier cortesía vigente (el estado en el proveedor pasa de paused a cancelled y llega el correo del proveedor) y el cierre del saldo diferido que S13 hace; ni ACC:2 ni AC:B13a:6/LISTA:B13a lo piden (cubren revocar y anclar).',
  ['VA-A10'],
  [B + 'docs/14-promos-cortesias-y-grants.md:436-438 «otorgar un grant termina cualquier cortesía vigente … la confirmación del capítulo 08 §3.1 tiene que decirlo»', B + 'docs/14-promos-cortesias-y-grants.md:495-498'],
  [c('10-corte/B13a.md', 612, '- **Cuando** revoca un grant, o le ancla una vertical nueva',
     '- **Cuando** otorga un grant, lo revoca, o le ancla una vertical nueva'),
   c('10-corte/B13a.md', 613, '- **Entonces** la confirmación de **revocar** dice que deja al cliente **sin servicio**, **pide el',
     '- **Entonces** la de **otorgar** dice que termina la cortesía vigente —el estado en el proveedor pasa de `paused` a `cancelled` y el cliente recibe el correo del proveedor— y cierra el saldo de una cortesía diferida con sus meses dichos (`B/14` §3.4); la confirmación de **revocar** dice que deja al cliente **sin servicio**, **pide el')],
  causa='exigencia de superficie fuera de la tabla de B/19 y sin pieza dueña', patron='P-J')

h('H2-VA10-4', 'REAL', 'BLOQUEA',
  'El e2e de la mora que escribe B7 (AC:B7:29, TEST:B7:17) sólo ve vencer el grace; B/20 §5.1 punto 2 pide los dos caminos de vuelta (tarjeta: suspensión con el preapproval cancelado y vuelta como sucesora; manual: regularización por MP4), la pausa del proveedor por mora con la fila ACTIVE (S6 por su segundo evento) con la sucesión que la frena, y las aserciones sobre B/19 §4 y el orden de los correos.',
  ['VA-A10'],
  [B + 'docs/20-testing.md:714-719', B + 'docs/20-testing.md:762-765'],
  [g8('B7', 505, '', '(AC nuevo, antes de AC:B7:30) **AC:B7:29-bis** — el ciclo de impago de punta a punta: con el arnés de `B/20` §5.1, los dos caminos de vuelta —tarjeta: cobro fallido → grace → suspensión con el preapproval cancelado → vuelta por el checkout como sucesora; pago manual: cuota impaga → grace → suspensión → `MP4`— y la pausa del proveedor por mora con la fila en `ACTIVE` (`S6` por su segundo evento), incluida la sucesión en curso que la frena; con aserciones sobre `B/19` §4 y sobre el orden *«nuestro correo antes que el del proveedor»* (`B/20` §5.1 punto 2 y punto 3).')],
  causa='el AC e2e toma un caso del flujo y pierde el resto', patron='P-D')

h('H2-VA10-5', 'REAL', 'MENOR',
  'El predicado «sobre un grant no se otorga cortesía: un ancla viva en esa vertical» falta en la condición de TRANS:B:S9 y en AC/TEST:B9b:7/8; sólo está en el glosario y en la transcripción de B9a.',
  ['VA-A10'],
  [B + 'docs/14-promos-cortesias-y-grants.md:418'],
  [c('20-fase-2/B9b.md', 172, '', '(en AC:B9b:7, cláusula nueva) «y sobre una vertical con un ancla viva de grant no se otorga cortesía: el predicado es el ancla viva, no que el beneficiario haya tenido un grant alguna vez (`B/14` §3.4)»')],
  causa='regla del capítulo sin AC en la pieza dueña', patron='P-D')

h('H2-VA10-6', 'REAL', 'MENOR',
  'AC:B13a:6 reduce la confirmación de anclar (fila 13-bis) a «qué cobro deja de ocurrir» y el saldo diferido; la fila exige también decir que termina la cortesía vigente en esa vertical y que el cliente recibe un correo del proveedor por cada preapproval (EX-3).',
  ['VA-A10'],
  [B + 'docs/19-superficies.md:125 (fila 13-bis)', B + 'docs/14-promos-cortesias-y-grants.md:441-447'],
  [c('10-corte/B13a.md', 616, '  y **cierra el saldo de una cortesía diferida con sus meses dichos**; y, sin complementos, la',
     '  y **cierra el saldo de una cortesía diferida con sus meses dichos**, que **termina la cortesía vigente en esa vertical** y que **llega un correo del proveedor por cada preapproval** (`EX-3`; fila 13-bis); y, sin complementos, la')],
  causa='el AC resume la fila y pierde dos contenidos', patron='P-D')

h('H2-VA10-8', 'REAL', 'MENOR',
  'AC:B5:39 (e2e de la revocación) no incluye el caso desde PAUSED que B/20 §5.1 punto 6 exige (preapproval pausado cancelado, subscription_pause con fin_real, corte como S22, RF1 por el total, S18 si era predecesora).',
  ['VA-A10'],
  [B + 'docs/20-testing.md:724-727'],
  [g8('B5', 604, '(`S36`)—', '(`S36`), también desde `PAUSED`: el preapproval pausado se cancela (`EX-11`), la `subscription_pause` queda con `fin_real`, el servicio se corta como en `S22` y, si la fila era predecesora, corre `S18`—')],
  causa='el AC e2e toma un caso del flujo y pierde otro', patron='P-D')

h('H2-VA10-9', 'REAL', 'MENOR',
  'AC:B8b:26 corre «los cambios de plan y la pausa» sin el cambio de ciclo como caso propio ni las dos formas de reanudar (al vencer y anticipada) que pide B/20 §5.1 puntos 3 y 4.',
  ['VA-A10'],
  [B + 'docs/20-testing.md:720-721'],
  [c('20-fase-2/B8b.md', 741, '- **Cuando** se corren los cambios de plan y la pausa, que son el flujo que le toca escribir a esta',
     '- **Cuando** se corren el cambio de plan, el cambio de ciclo (otro mecanismo), y la pausa con sus dos reanudaciones, al vencer y anticipada, que son el flujo que le toca escribir a esta')],
  causa='el AC e2e resume los casos del flujo', patron='P-D')

h('H2-VA10-10', 'REAL', 'MENOR',
  'AC:B12:11 (e2e de la migración de un plan retirado) sólo nombra el barrido entre S37 y S38; B/20 §5.1 punto 8 pide además los que salen (cambió de plan, se dio de baja, termina por otro camino), los que esperan (pausado, en grace) y el pagador manual que cambia de versión sin mutar.',
  ['VA-A10'],
  [B + 'docs/20-testing.md:730'],
  [c('20-fase-3/B12.md', 479, '  **incluido el barrido entre `S37` y `S38`, que no marca divergencia**.',
     '  **incluidos los que salen** (el que cambió de plan, el que se dio de baja y el que termina por otro camino), **los que esperan** (el pausado y el que está en grace), **el pagador manual**, que cambia de versión sin mutar nada, **y el barrido entre `S37` y `S38`, que no marca divergencia**.')],
  causa='el AC e2e resume los casos del flujo', patron='P-D')

# ---------------------------------------------------------------- OWNER ----------------------------
h('H2-VA8-7', 'OWNER', None,
  'Quién escribe `provider_link.cancelado_visto_en`: `B/09` §3 dice que lo escribe la primera relectura que ve `cancelled`, «sea del barrido, del handler o de la de una transición» (S16), pero el reparto de la fuente (descomposicion:729, lote Z) le da a B4 la columna y a B11 «la relectura que la escribe», y la spec (B4:290-292) dice sólo el barrido de B11. El handler y S16 son de B3, que se mergea antes que la columna exista (la crea B4).',
  ['VA-A8'],
  [B + 'docs/09-conciliacion.md:270-272 «Lo escribe esa relectura, sea del barrido, del handler o de la de una transición, y no lo reescriben las siguientes»',
   B + 'descomposicion.md:729 «**B4** *(la columna y `puedeCobrarle`)* · **B11** *(la relectura que la escribe y la exención que la lee)*»',
   'spec 10-corte/B4.md:290-292 «La escribe la relectura del barrido de `B11` y la vacía una relectura que lo ve vivo»; 04-catalogos.md:2248 (S16 «se la reconoce por `cancelado_visto_en` escrito»)'],
  owner={'letra': 'CH'}, causa='la fuente se contradice dentro del mismo lote Z (regla vs reparto)', patron='P-L')

# ---------------------------------------------------------------- verify + write -------------------
def check():
    bad = []
    for x in H:
        for k in x['correccion'] or []:
            if not k['sale'] or k['linea'] == 0:
                continue
            p = os.path.join(R, k['archivo'])
            L = open(p, encoding='utf-8').read().split('\n')
            line = L[k['linea'] - 1] if k['linea'] <= len(L) else ''
            if k['sale'].split('\n')[0] not in line:
                hits = [i + 1 for i, l in enumerate(L) if k['sale'].split('\n')[0] in l]
                bad.append((x['id'], k['archivo'], k['linea'], hits))
    return bad


if __name__ == '__main__':
    b = check()
    for x in b:
        print('✗', x)
    if b:
        sys.exit(1)
    por_id = {x['id']: x for x in H}
    dup = {x['id']: x['miembros'] for x in H if len(x['miembros']) > 1}
    json.dump({'unicos': H, 'por_id': por_id, 'duplicados': dup},
              open(os.path.join(OUT, 'hallazgos.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    from collections import Counter
    print(len(H), Counter((x['veredicto'], x['clase_final']) for x in H))
