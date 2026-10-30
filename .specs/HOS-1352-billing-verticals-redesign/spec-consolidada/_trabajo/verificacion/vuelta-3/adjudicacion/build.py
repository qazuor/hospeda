#!/usr/bin/env python3
"""Build the adjudication of blind-verification round 3 (HOS-1352).

Writes hallazgos.json, correcciones.txt and canarios-resultado.txt. Every correction names a `sale`
fragment that must be found verbatim on the given line of the REAL spec (v3-pristina = HEAD
a10f010e78, no canaries) — or of the g8 source for B4-B7, which has the same line numbers — and every
anchor an `entra` links to must exist; the script aborts otherwise.
"""
import json
import os
import re
import sys

D = os.path.dirname(os.path.abspath(__file__))
SP = os.path.dirname(D)
SPEC = os.path.join(SP, 'v3-pristina')
G8 = os.path.join(SP, 'v3', 'generadores', 'g8', 'src')

P = '.specs/HOS-1352-billing-verticals-redesign/docs/'
V = '.specs/HOS-1353-verticales-capacidades-y-autorizacion/'
B = '.specs/HOS-1354-billing-cobro-y-proveedor/'
G8N = 'scripts/generadores/g8/src/{}.md:{} (mismo texto y misma línea; regenerar con `gen.py {}`)'

H = []


def c(archivo, linea, sale, entra, generado=False, donde_va=None):
    return dict(archivo=archivo, linea=linea, generado=generado, donde_va=donde_va, sale=sale, entra=entra)


def g8(pieza, linea, sale, entra):
    return c(f'10-corte/{pieza}.md', linea, sale, entra, True, G8N.format(pieza, linea, pieza))


def h(id, veredicto, clase, resumen, verif, evid, corr=None, fuente=None, owner=None, causa='', patron=None,
      miembros=None):
    H.append(dict(id=id, grupo=None, miembros=miembros or [id], veredicto=veredicto, clase_final=clase,
                  relacionados=[], resumen=resumen, verificadores=verif, respaldo='adjudicador',
                  evidencia=evid, correccion=corr, correccion_fuente=fuente, pregunta_owner=owner,
                  causa=causa, patron=patron))


# ================================================================= GENERADOR ========================
h('H3-G1-3', 'GENERADOR', 'MENOR',
  'Cinco letras del registro salen sin «⚠️ Caducada en parte» aunque una letra o un 📌 posterior las '
  'corrigió: B de 38-fase-5 t4 («asignado al aprobar la postulación», corregida por F), F de t6 («o el alta '
  'directa del admin con dueño», corregida por N), H de t6 («`starts_at` y `ends_at` quedan hasta la unidad '
  'de socios», precisada por O), y `G5-3` y `G2-1` de 28-fase-9-vuelta-1 (su predicado y su «en el mismo '
  'acto» murieron tachados en el log, L3 y L1). La cabecera promete esa marca. Sólo citables.',
  ['G1'],
  [P + '38-fase-5/10-decisiones-del-owner.md:133 «| F | … el rol de socio se da en el acto que fija al dueño de la presencia (…), no al aprobar la postulación»',
   P + '38-fase-5/10-decisiones-del-owner.md:153 «| N | … F se lee *«cuando queda con dueño»*»; :154 «| O | … `V7` borra `partners.starts_at` y `partners.ends_at` con su migración»',
   P + '01-decision-log.md:1921-1926 «~~Una pausa de menos de un ciclo que cruza una fecha de cobro salteada regala ese ciclo~~ **Toda pausa que cruza …** … el barrido lista ~~esas pausas~~ **las pausas con regalo neto positivo**»',
   P + '01-decision-log.md:2523 «emitido ~~en el mismo acto de `PB9` y de `PB12`~~ **por el mismo acto** de `PB9` y de `PB12`, **después de su commit**»',
   'spec 01-decisiones-vigentes.md:3024 y :6144 ya tratan como «Parte sin efecto» las mismas frases en los 📌; :11013 promete la marca ⚠️ Caducada',
   'scripts/generadores/g1/gen01.py:426-468: P-H sólo mira RONDAS_CITADAS (26, 28, 29, 37; no 38-fase-5) y sólo citas del ID de la letra dentro de ~~…~~; no ve una letra corregida por otra letra del mismo archivo ni el contenido tachado que la letra produjo'],
  [c('01-decisiones-vigentes.md', 13018, 'asignado al aprobar la postulación',
     '(sin cambio a mano: el generador agrega debajo de cada una de las cinco letras su línea «⚠️ **Caducada en parte**: … (Origen: …). Sólo citable; no se implementa.»)',
     True,
     'scripts/generadores/g1/omisiones.json, clave `letras_muertas`, cinco entradas `alcance: "en parte"`: '
     '«OWN:38-fase-5:t4:B» (por: «el rol de socio se da en el acto que fija al dueño, no al aprobar (F)», origen 38-fase-5/10-decisiones-del-owner.md:133); '
     '«OWN:38-fase-5:t6:F» (por: «el alta directa del admin no fija dueño; F se lee «cuando queda con dueño» (N)», origen :153); '
     '«OWN:38-fase-5:t6:H» (por: «`V7` borra `starts_at` y `ends_at` con su migración (O)», origen :154); '
     '«OWN:28-fase-9-vuelta-1:t1:G5-3» (por: «el barrido lista las pausas con regalo neto positivo, dure lo que dure (L3)», origen 01-decision-log.md:1921); '
     '«OWN:28-fase-9-vuelta-1:t1:G2-1» (por: «emitido por el mismo acto de PB9/PB12, después de su commit (L1)», origen 01-decision-log.md:2523). '
     'Y en gen01.py, P-H: (a) por cada letra, si otra letra POSTERIOR del mismo archivo la nombra («F se lee», «precisa B») o tacha su frase, falla salvo que esté en `letras_muertas`/`letras_vivas_revisadas`; '
     '(b) la celda «qué decide»/«elige» se busca (≥ 8 palabras seguidas) dentro de ~~…~~ en las fuentes posteriores; si aparece, falla igual; (c) 38-fase-5 entra en el barrido')],
  causa='el detector P-H sólo ve citas tachadas del ID de la letra, en cuatro rondas; no ve letras corregidas por letras posteriores ni contenido tachado',
  patron='P-H', miembros=['H3-G1-3', 'H3-G1-4', 'H3-G1-5', 'H3-G1-6', 'H3-G1-7'])

h('H3-G2-10', 'GENERADOR', 'MENOR',
  'g3 (y el inventario del que lee) da por MUERTA toda sección cuyo TÍTULO está tachado y no adjunta su '
  'cuerpo vivo: se pierden los ~6,4 mil caracteres vivos de V/03:365-479 («Sale entera… el panel no deja pasar '
  'los días de prueba de 0 a más de 0», las «Seis cosas que la tabla fija») y el residuo de B/03:944-956 y '
  'V/03:1339-1351. Las reglas operativas están en las filas T1–T8, V4, 03-contrato y 90-retirados.',
  ['G2'],
  [V + 'docs/03-maquinas-de-estado.md:365 «#### ~~La fila de los días en cero …~~» con cuerpo vivo hasta :479 (:424 «**Seis cosas que la tabla fija y conviene leer explícitas:**»)',
   B + 'docs/03-maquinas-de-estado.md:950-955 «los pares con dos filas pasan de cuatro a tres (`NUCLEO/03` §1 regla 7), y `S10` vuelve a ser la única salida de `PAUSED` por su evento»',
   V + 'docs/03-maquinas-de-estado.md:1346-1349 «El reconciliador sigue haciendo lo que hacía por cada dueño»',
   '_trabajo/inventario.json: 7 SEC en estado MUERTO, todas por título; 6 tienen cuerpo vivo fuera de ~~…~~ (12-contrato:581, V/03:365 y :1339, B/03:944, B/10:229, B/14:634); la única sin cuerpo vivo es B/03:942',
   'scripts/generadores/g3/gen.py:329 `if … i[\'estado\'] == \'VIVO\'` en `_secs`'],
  [c('04-catalogos.md', None, None,
     '(sin cambio a mano: regenerar g3 después de corregir el inventario; el texto vivo entra adjunto a TRANS:V:T1…T8 y a TRANS:B:S10 por la regla de `_destino`)',
     True,
     'el armado del inventario: una SEC de título tachado con texto fuera de ~~…~~ en el cuerpo es `MIXTO`, no `MUERTO`; '
     'scripts/generadores/g3/gen.py:329: `_secs` acepta `VIVO` y `MIXTO` (de una MIXTA va el cuerpo limpio, sin el título tachado, con el «**Sale entera**…» vivo); '
     'y un guard en gen.py: falla si una SEC `MUERTO` tiene texto vivo')],
  causa='el estado de una sección se decide por su título, no por su cuerpo', patron='P-M',
  miembros=['H3-G2-10', 'H3-G2-11'])

h('H3-G2-12', 'GENERADOR', 'MENOR',
  'B9a dice transcribir «el capítulo `14`, entero», pero g-secciones no trae el preámbulo de B/14 (la tabla '
  'de entrada promo → monto, cortesía → pausa «sólo sobre planes mensuales y en meses enteros», grant → '
  'obligación, l. 17-31) ni el residuo vivo de §4.6 (l. 634-644: una cortesía sobre un plan retirado no tiene '
  'nada que resolver; el diferimiento del saldo tiene un solo escritor, `S18`). Las dos reglas viven en otros §§.',
  ['G2'],
  [B + 'docs/14-promos-cortesias-y-grants.md:19-30 (tabla de los tres instrumentos, antes del primer `##`)',
   B + 'docs/14-promos-cortesias-y-grants.md:634-644 «### ~~4.6 …~~ … **Sale entero** … Una cortesía sobre un plan **retirado** no tiene nada que resolver … un solo escritor, el cierre de `S18` (§4.4)»',
   'scripts/generadores/secciones/fuentes.json `10-corte/B9a.md` arranca en B/14:32; el inventario no tiene SEC para el texto entre el `#` del título y el primer `##`, y §4.6 es una SEC MUERTO (H3-G2-10)',
   'spec 10-corte/B9a.md:57 «Las secciones de el capítulo `14`, entero, que la columna de capítulos de la fila le asigna»'],
  [c('10-corte/B9a.md', 57, 'Las secciones de el capítulo `14`, entero,',
     '(sin cambio a mano: regenerar g-secciones)', True,
     'el inventario corta una SEC de preámbulo (texto entre el `#` del capítulo y su primer `##`) y la marca VIVO; '
     'scripts/generadores/secciones/fuentes.json `10-corte/B9a.md`: sumar `[B/14, 13]` (preámbulo) y `[B/14, 634]` (§4.6, MIXTO tras H3-G2-10); '
     'y gen.py: cuando la fila de capítulos dice «entero», compara la lista de fuentes.json con TODAS las SEC no MUERTO del capítulo y falla si falta una')],
  causa='«entero» se arma de una lista a mano sobre un inventario sin preámbulos y sin secciones mixtas', patron='P-M')

h('H3-G2-13', 'GENERADOR', 'MENOR',
  'secciones/gen.py descarta como muerta una fila cuya celda id está tachada entera aunque otra celda traiga '
  'texto vivo normativo («**sale** …»): se pierde «sin lápida del corte, un cobro tardío de un débito viejo '
  'entra como desconocido y lo toma la lápida de recepción» (B11) y «una vertical con todos sus planes retirados '
  'no ofrece checkout … fila 29 de `V/19` §4» (B13a). Las dos reglas viven en otra fila u otra pieza.',
  ['G2'],
  [B + 'docs/09-conciliacion.md:308 «| ~~la **lápida** del corte → `CANCELLED`~~ | — | **sale** (…): sin lápida del corte, un cobro tardío de un débito viejo entra como desconocido y lo toma la lápida de recepción de la fila de abajo |»',
   B + 'docs/19-superficies.md:140 «| ~~20~~ | ~~…~~ | **sale** (…): no hay vertical que deje de admitir altas. Una vertical con todos sus planes retirados no ofrece checkout porque no tiene versión vendible, y lo dice la fila 29 de `V/19` §4 |»',
   'scripts/generadores/secciones/gen.py:78-88 `sin_texto_vivo`: devuelve sin error con `_tachada_entera(cs[0])`, sin mirar las demás celdas; el «**Sale**» que acepta es de la celda 2 y con mayúscula'],
  [c('10-corte/B11.md', None, None, '(sin cambio a mano: regenerar g-secciones; igual B13a)', True,
     'scripts/generadores/secciones/gen.py:78-88: una fila es muerta sin aviso sólo si TODAS sus celdas no vacías están tachadas enteras; '
     'si alguna trae texto vivo que empieza con «**sale**» (sin distinguir mayúsculas), la fila sale de la tabla y ese texto vivo va como nota debajo («*(fila retirada: …)*»); cualquier otro texto vivo hace fallar el generador')],
  causa='la fila se declara muerta por su celda id, no por todas sus celdas', patron='P-K')

# ================================================================= FALSO ============================
h('H3-G2-14', 'FALSO', None,
  'El verificador pide que la introducción de la matriz en 04 transcriba las reglas 1, 2, 3, 5 y 7, el '
  'Procedimiento y la Composición de D/06.',
  ['G2'],
  ['vuelta 2, H2-G2-4 (FALSO): las reglas 2, 3 y 7 de D/06 las precisa `B/06` §8 (posterior) y las recoge B1 (10-corte/B1.md, re-verificación por capability); la 1 y la 5 (ninguna fila sin experimento; sondas versionadas) y el Procedimiento/Composición son reglas del proceso de diseño de la matriz, no de lo que se construye',
   'spec 01-decisiones-vigentes.md:9509 y 30-el-corte.md:1316 traen la regla 2'],
  causa='re-reporta un FALSO ya adjudicado en la vuelta 2 (H2-G2-4)')

h('H3-VB06-3', 'FALSO', None,
  'El retiro de `USER_IMPERSONATE` de la base (enum recreado y migración de datos) es más fuerte que la fuente.',
  ['VB-06'],
  ['spec 10-corte/V5.md:279-283 lleva «*(Derivado: la fuente dice sólo «el permiso no existe en el enum», `V/descomposicion.md:544`; el carril sale del principio de `F5-AUT-023` …; lo marco.)*»',
   'vuelta 2, criterio: «USER_IMPERSONATE, H-VB-B6-3/H-VB-B4-3: FALSO en sustancia y REAL en el marcado»; el marcado ya está'],
  causa='la derivación está marcada; FALSO conocido de las vueltas 1 y 2')

h('H3-VB06-4', 'FALSO', None,
  'AC:V5:23 corre «los casos de AC:V5:1 a AC:V5:16» y el verificador lee que deja afuera AC:V5:24.',
  ['VB-06'],
  ['spec 10-corte/V5.md:331: el ancla `ac-v5-24` está entre `ac-v5-14` (:319) y `ac-v5-15` (:341), así que el rango en orden del documento la incluye',
   'vuelta 2, H2-VB06-7: el mismo hallazgo, FALSO'],
  causa='FALSO conocido de la vuelta 2 (H2-VB06-7)')

h('H3-VB10-3', 'FALSO', None,
  'B7 atribuye a BW (y a DEC-ARCH-017#📌7) que la rama 4 de las seis vaya detrás de la interfaz que llama `S13`; '
  'el verificador dice que BW sólo decide quién crea `domain_event` y que la rama 4 sale de BL.',
  ['VB-10'],
  ['spec 01-decisiones-vigentes.md, DEC-ARCH-017#📌7 (el 📌 de BW, «corte del MVP, BW, la 1»): «**Y la regla de BL alcanza también la rama 4 del criterio de `B7`**: `S13` es de `B9a`, que llega después, así que `B7` escribe esa rama entera y la llama por interfaz»',
   P + '01-decision-log.md: el mismo 📌, en DEC-ARCH-017'],
  causa='el verificador leyó la celda de BW en la tabla de letras y no el 📌 que la aplica, que sí suma la rama 4')

h('H3-VB14-3', 'FALSO', None,
  'AC:CORTE:2 hace condición de avance el tope de purgas verificado; el verificador dice que la fuente sólo hace bloqueante a `EX-49`.',
  ['VB-14'],
  [P + '16-fase-7-del-paraguas.md:146 (paso 0): «**tres cosas** …: el despliegue ensayado entero en `staging` y verde, la medición … (`EX-49`) y la verificación del tope de purgas del borde» y «se verifica el tope de purgas … antes del 4c: cuál es, y que las 22 purgas por destino del 4c entran en él»',
   P + '16-fase-7-del-paraguas.md:146, última columna: «lo irreversible (paso 1) sólo arranca cuando lo que puede fallar (paso 3) ya se probó»: el paso 0 completo es condición del paso 1'],
  causa='la verificación es una de las tres cosas del paso 0, que precede al irreversible; que no esté en la lista de ocho gates del momento 4 no la saca del paso 0')

# ================================================================= FUENTE ===========================
h('H3-VA10-6', 'FUENTE', 'MENOR',
  'La glosa de GUARD:G-R1-F dice que la cláusula hace cumplir que otorgar un grant **no** cierre un saldo '
  'diferido (DEC-GRANT-011); DEC-GRANT-013, posterior, dice que lo CIERRA con `GRANT_PERMANENTE_OTORGADO`. '
  'La spec copia `B/20` §2, que quedó vieja. El predicado del guard (motivo de la enumeración cerrada) sigue valiendo.',
  ['VA-A10'],
  [B + 'docs/20-testing.md:61 «es la mitad que hace cumplir que otorgar un grant **no** cierre un saldo diferido (cap. 14 §4.3, `DEC-GRANT-011`)»',
   B + 'docs/14-promos-cortesias-y-grants.md:476-477 «**Entonces el grant CIERRA el saldo, y el cierre se declara.** Se escriben `saldo_cerrado_en` y `motivo_cierre = GRANT_PERMANENTE_OTORGADO`»',
   P + '01-decision-log.md:5203 «### DEC-GRANT-013 — Otorgar un `Free Forever` CIERRA el saldo de una cortesía diferida del mismo beneficiario»',
   'spec 04-catalogos.md:7941 (GUARD:G-R1-F) copia la glosa vieja; contradice AC:B9a:3'],
  [c('04-catalogos.md', 7941, 'es la mitad que hace cumplir que otorgar un grant **no** cierre un saldo diferido',
     '(sin cambio a mano: lo trae la fuente corregida al regenerar g3)', True,
     'corregir la fuente (abajo) y regenerar g3 con el SHA nuevo')],
  [dict(archivo=B + 'docs/20-testing.md', linea=61,
        nota='«es la mitad que hace cumplir que otorgar un grant **no** cierre un saldo diferido (cap. 14 §4.3, `DEC-GRANT-011`)» → «es la mitad que hace cumplir que sólo cierren un saldo diferido los actos que la enumeración nombra, otorgar un grant entre ellos (`GRANT_PERMANENTE_OTORGADO`; cap. 14 §4.3, `DEC-GRANT-013`)»; y sumar `DEC-GRANT-013` a la columna de fuentes de la fila')],
  causa='la fuente B/20 §2 no recogió DEC-GRANT-013', patron='P-F')

h('H3-VA8-2', 'FUENTE', 'MENOR',
  'DEC-CONC-001 (parte 2) dice que la recuperación tras un timeout pregunta «por `payer_email` + `status`»; '
  'B/05 §1.1 y B/09 lo corrigieron (F-8CB3-011): se filtra en el proveedor SÓLO por correo, y el estado se '
  'mira de nuestro lado. El log nunca recogió la corrección y ningún 📌 la precisa. Las piezas llevan la '
  'regla correcta (B11:1092, :1094, AC:B11:23).',
  ['VA-A8'],
  [B + 'docs/05-idempotencia-y-concurrencia.md:58 «~~por correo del pagador y estado, que sí filtran y se componen~~ **filtrando en el proveedor SÓLO por correo del pagador y el estado de NUESTRO lado**»',
   B + 'docs/09-conciliacion.md:1083, :1094 «filtra sólo por `payer_email`»',
   P + '01-decision-log.md:1531 «que yo no tenga registrada?»**, por `payer_email` + `status`.»',
   'spec 01-decisiones-vigentes.md:8625 (generado por g1) lo copia'],
  [c('01-decisiones-vigentes.md', 8625, 'por `payer_email` + `status`',
     '(sin cambio a mano: lo trae la fuente corregida al regenerar g1)', True, 'corregir el log (abajo) y regenerar g1')],
  [dict(archivo=P + '01-decision-log.md', linea=1531,
        nota='«por `payer_email` + `status`» → «~~por `payer_email` + `status`~~ **filtrando en el proveedor sólo por `payer_email`, y el estado de nuestro lado** (FASE 8, `F-8CB3-011`; `B/05` §1.1)»; la medición `RC-1` de :1517 (el buscador sí filtra por los dos) queda: es un hecho medido, no la regla')],
  causa='el decision log no recogió una corrección de la FASE 8 hecha en B/05 y B/09', patron='P-F')

h('H3-VB03-3', 'FUENTE', 'MENOR',
  '03-contrato:507 dice que `S36` desde `ACTIVE` o `CANCEL_SCHEDULED` «es una de las diez»; el mismo archivo '
  'cuenta nueve (:493, :561), y nueve incluyen a `S36`. La fuente tiene el mismo residuo (12-contrato:480 vivo).',
  ['VB-03'],
  [P + '12-contrato-de-cobertura.md:465 «de las ~~**ocho**~~ ~~**diez**~~ ~~**nueve**~~ ~~**die…**~~ … **nueve**» y :548 «Las … **nueve** transiciones»',
   P + '12-contrato-de-cobertura.md:480 «`CANCEL_SCHEDULED` es una de las diez» (vivo, sin tachar)',
   'spec 03-contrato-de-cobertura.md:493 «de las **nueve** transiciones» y :561 «Las **nueve** transiciones … y `S36` desde `ACTIVE` o `CANCEL_SCHEDULED`»'],
  [c('03-contrato-de-cobertura.md', 507, '`CANCEL_SCHEDULED` es una de las diez',
     '`CANCEL_SCHEDULED` es una de las nueve')],
  [dict(archivo=P + '12-contrato-de-cobertura.md', linea=480, nota='«es una de las diez» → «es una de las ~~diez~~ **nueve**» (residuo del recuento de :465)')],
  causa='residuo de un recuento en la fuente', patron='P-F')

h('H3-VB14-5', 'FUENTE', 'MENOR',
  '30-el-corte:1434-1435 dice que los precios del corte «los carga el paso 3a»; el paso 3a del mismo archivo '
  '(:610-612) dice que se cargan en la migración estructural del paso 3 y el 3a sólo los verifica. Copia a la '
  'letra la aplicación de BM (16-fase-7:1125), que quedó vieja frente a la tabla de pasos.',
  ['VB-14'],
  [P + '16-fase-7-del-paraguas.md:1125 «**los precios del corte son los vigentes hoy**; los carga el paso 3a con el catálogo»',
   P + '16-fase-7-del-paraguas.md:153 (paso 3a) y spec 30-el-corte.md:610-612 «**Se cargan dentro de la migración estructural del [paso 3](#paso-3) …; este paso sólo los verifica**»'],
  [c('30-el-corte.md', 1435, 'carga el paso 3a y **ningún precio cambia',
     'carga la migración estructural del [paso 3](#paso-3) y los verifica el 3a, y **ningún precio cambia')],
  [dict(archivo=P + '16-fase-7-del-paraguas.md', linea=1125, nota='«los carga el paso 3a con el catálogo» → «los carga la migración estructural del paso 3 con el catálogo y los verifica el 3a»')],
  causa='la aplicación de BM nombró el paso que verifica como el que carga', patron='P-F')

# ================================================================= OWNER ============================
h('H3-VB07-7', 'OWNER', None,
  'Quién retira la ruta de borrado físico de CUENTAS (`user/admin/hardDelete.ts`): la fila de `V6` de la '
  'descomposición dice que con `V6` «desaparecen el borrado físico de fichas y de cuentas», y la tabla de '
  'puertas de la misma descomposición le da la de cuentas a `V8a` (Z). La spec sigue a las dos: V4:920 y '
  'AC:V6:25 la ponen en `V6`; 03-contrato:1664 en `V8a`, que no la menciona.',
  ['VB-07'],
  [V + 'descomposicion.md:66 (fila V6) «… y desaparecen el borrado físico de fichas y de cuentas y la restauración** (lote 3 C)»',
   V + 'descomposicion.md:547 «| las puertas de borrado y restauración … y `user/admin/hardDelete.ts` | lote 3 C | **V6** *(las de fichas)* · ~~**V8**~~ **V8a** (…, Z) *(la de cuentas, que reemplaza la acción 24)*»',
   'spec 10-corte/V4.md:920 «El retiro de esa ruta es de `V6`» (sin marca de derivado); 10-corte/V6.md AC:V6:25 «no hay borrado físico de fichas ni de cuentas»; 03-contrato-de-cobertura.md:1664 la da a `V8a`; 10-corte/V8a.md no la nombra'],
  owner={'letra': 'CJ'},
  causa='dos lugares vivos de la misma descomposición asignan la misma ruta a piezas distintas; Z sólo renombró V8 → V8a',
  patron='P-L')

# ================================================================= REAL BLOQUEA =====================
h('H3-VA6-2', 'REAL', 'BLOQUEA',
  'Que el `external_reference` de todo preapproval nuevo sea el `id` de su fila de `subscription`, «principal '
  'o de complemento», sólo está para la principal (AC:B3 de `S1`). B10, que crea el preapproval del complemento '
  'recurrente (`A2`), no lo dice en ningún AC, y B3 no lo pone en `provider_link`: un complemento sin la '
  'referencia es invisible para el barrido (`B/09` §2.4).',
  ['VA-A6'],
  [B + 'docs/02-modelo-de-datos.md:60 «**El `external_reference` de todo preapproval que crea el sistema nuevo es el `id` de su fila de `subscription`**, principal o de complemento. Se escribe en el cuerpo de la creación, con la clave ya persistida (…) una suscripción cuyo id se pierde **es invisible para el barrido**»',
   'spec 10-corte/B3.md:213 (sólo `S1`); 20-fase-3/B10.md:1285-1292 (AC:B10:3, `A2`) sin `external_reference`; 04-catalogos.md TRANS:B:A1/A2 tampoco; B3.md:913 `provider_link` sin la regla'],
  [c('20-fase-3/B10.md', 1289, '  checkout del proveedor y con su ciclo alineado al del plan sólo al crearlo; la de única vez con',
     '  checkout del proveedor, con `external_reference` igual al `id` de su fila de suscripción de\n'
     '  complemento, escrito en el cuerpo de la creación con la clave ya persistida (`B/02` §2.2), y con su\n'
     '  ciclo alineado al del plan sólo al crearlo; la de única vez con'),
   c('10-corte/B3.md', 913,
     '- **`provider_link`** (`B/02` §2.2): la suscripción que vincula, el id del proveedor, cuál es el proveedor,',
     '- **`provider_link`** (`B/02` §2.2) —y el `external_reference` de **todo** preapproval que crea el sistema\n'
     '  nuevo, principal o de complemento, es el `id` de su fila de `subscription`, escrito en el cuerpo de la\n'
     '  creación con la clave ya persistida—: la suscripción que vincula, el id del proveedor, cuál es el proveedor,')],
  causa='la regla del modelo se bajó sólo al AC de la principal', patron='P-D')

h('H3-VB07-4', 'REAL', 'BLOQUEA',
  'En la rama del correo sin usuario, quién escribe `owner_user_id`: `V/02` §2.7 dice que el acto de reclamar '
  'es la validación de ese correo. V7 (AC:V7:4) crea el usuario y manda la validación y no dice que validarla '
  'vincula; ningún AC/TEST ni regla de V7 lo recoge. Siguiendo la spec, el Partner aprobado de esa rama queda '
  'sin dueño, sin rol de socio y sin camino para obtenerlo.',
  ['VB-07'],
  [V + 'docs/02-modelo-de-datos.md:641 «`owner_user_id` es **nulo hasta el reclamo** y lo escribe **sólo** el acto de reclamar (`18` §2.4): en la rama del correo sin usuario, la validación de ese correo; en la del correo que ya es de un usuario, el reclamo desde esa casilla, **con sesión**»',
   V + 'docs/18-partner.md:269 «el correo **no** corresponde a ningún usuario | se crea el usuario y se le manda la validación — el §17.3 tal cual»',
   'spec 20-fase-4/V7.md:198-205 (AC:V7:4) y :611 (transcripción) sin la escritura; AC:V7:7 sólo cubre la rama con cuenta'],
  [c('20-fase-4/V7.md', 205, '  (§17.3).',
     '  (§17.3); **en esa rama la validación de ese correo es el reclamo**: al validarse, la cuenta creada\n'
     '  queda en `owner_user_id` y recibe el rol de socio (`V/02` §2.7: *«en la rama del correo sin usuario,\n'
     '  la validación de ese correo»*).')],
  causa='la escritura de la columna vive en el modelo de V/02 y no bajó a la pieza', patron='P-D')

# ================================================================= REAL MENOR =======================
h('H3-VA10-3', 'REAL', 'MENOR',
  'La fila 19-bis de `B/19` §4 (antes de confirmar el checkout de un alta con el trial corriendo: pierde los '
  'días al acreditarse el primer cobro, y si se rechaza sigue en su trial) no tiene AC ni TEST: está sólo en '
  'la transcripción de B13a y en la prosa de V4, que dice que la superficie es de B13a.',
  ['VA-A10'],
  [B + 'docs/19-superficies.md:139 «| 19-bis | al **suscribirse estando en trial** … antes de confirmar | **las dos mitades de la regla** …»',
   'spec 10-corte/V4.md:757-760 «Es la fila 19-bis de `B/19` §4 (la superficie es de `B13a`)»; 10-corte/B13a.md:172 (transcripción); AC:B13a:5 (:595-605) cubre la fila 19, no la 19-bis'],
  [c('10-corte/B13a.md', 605, '  se llena con lo medido y no se inventa.',
     '  se llena con lo medido y no se inventa. **Y antes de confirmar el checkout de un alta con el trial\n'
     '  corriendo en esa vertical** (fila 19-bis), la pantalla dice las dos mitades: que al acreditarse el\n'
     '  primer cobro el trial termina y pierde los días que le quedaban, y que si ese cobro se rechaza sigue\n'
     '  en su trial, con esos días ([DEC-TRIAL-010](../01-decisiones-vigentes.md#dec-trial-010)).')],
  causa='superficie transcrita sin AC', patron='P-D')

h('H3-VA10-4', 'REAL', 'MENOR',
  'ESQ:8 (B3 crea `addon_product`) lista sólo `version_id`: faltan el precio, la recurrencia (el cobro lo '
  'declara el producto: única vez o periódico) y las verticales compatibles de `B/02` §2.4.',
  ['VA-A10'],
  [B + 'docs/02-modelo-de-datos.md:574 «| **`addon_product`** | **precio, recurrencia y verticales compatibles**, más **`version_id`** …»',
   B + 'docs/16-addons.md:40 «**el cobro lo declara el producto (`addon_product`, billing)**»',
   'spec 10-corte/B3.md:968-985 (ESQ:8)'],
  [c('10-corte/B3.md', 970, 'Son `addon_product` —con `version_id` → `addon_version` **no anulable**: sin ella el producto no se puede',
     'Son `addon_product` —su precio, su recurrencia (el cobro lo declara el producto: de única vez o periódico) y\n'
     'sus verticales compatibles, con `version_id` → `addon_version` **no anulable**: sin ella el producto no se puede')],
  causa='el ESQ resume la fila del modelo', patron='P-A')

h('H3-VA10-5', 'REAL', 'MENOR',
  'Ningún AC/TEST de B13a pide que cada cosa de Mi Suscripción y de la pricing diga en qué vertical vale (y '
  'lo global como global), ni la pricing por vertical con las tres situaciones del §47; está sólo en la '
  'sección UI de B13a (:905-908).',
  ['VA-A10'],
  [B + 'docs/19-superficies.md:60 «**cada cosa que se muestra dice en qué vertical vale.**»; :303-305 «una pricing por vertical, Turista incluida, y define tres situaciones»',
   'spec 10-corte/B13a.md:679-688 (AC:B13a:11) sin scope ni situaciones'],
  [c('10-corte/B13a.md', 684, '- **Entonces** lee la versión vigente y sólo si es vendible —un plan retirado no aparece—; y a esa',
     '- **Entonces** hay una pricing por vertical, Turista incluida, con las tres situaciones del §47 —primer\n'
     '  uso, trial y activo; el cambio de plan del activo con el aviso de AU hasta `B8b`—; cada cosa que\n'
     '  muestra, y cada cosa de Mi Suscripción, dice en qué vertical vale, y lo global se muestra como global\n'
     '  (`B/19` §3 y §7); lee la versión vigente y sólo si es vendible —un plan retirado no aparece—; y a esa')],
  causa='requisito de superficie en la sección UI y no en un AC', patron='P-D')

h('H3-VA10-7', 'REAL', 'MENOR',
  'Dos AC citan `B/14` §3.4 («Un canje rechazado no se consume») para reglas que están en §4.3 (cortesía '
  'temporal + grant permanente): AC:B9b:7 (el ancla viva) y AC:B13a:6 (otorgar termina la cortesía y cierra '
  'el saldo diferido). La cita de B13a la introdujo la corrección H2-VA10-3 de la vuelta 2.',
  ['VA-A10', 'VB-11', 'VB-12'],
  [B + 'docs/14-promos-cortesias-y-grants.md:385 «### 3.4 Un canje rechazado no se consume»; :416 «### 4.3 Cortesía temporal + grant permanente»; :422 y :436-477',
   'vuelta 2, hallazgos.json H2-VA10-3: su `entra` para B13a.md:613 trae «(`B/14` §3.4)»'],
  [c('20-fase-2/B9b.md', 185, '(`B/14` §3.4).', '(`B/14` §4.3).'),
   c('10-corte/B13a.md', 616, '(`B/14` §3.4)', '(`B/14` §4.3)')],
  causa='cita de sección mal puesta; una de ellas, por una corrección de la vuelta anterior', patron='P-E',
  miembros=['H3-VA10-7', 'H3-VB11-3', 'H3-VB12-5'])

h('H3-VA2-3', 'REAL', 'MENOR',
  'AC:CORTE:1 (el ensayo) trae en su «Dado» `U3` mergeada, los plazos y la copia, pero no que se releyeron '
  'las dos situaciones que una restauración no deshace (§4.3), condición del momento 3. Está en GATE:M3, '
  'que el AC cita.',
  ['VA-A2', 'VB-14'],
  [P + '16-fase-7-del-paraguas.md:1095-1096 «Antes de arrancarlo: `U3` está mergeada (F); se releyeron las dos situaciones que una restauración no deshace (§4.3); los plazos sin valor …»',
   'spec 30-el-corte.md:1388-1390 (GATE:M3) y :416 (paso 2b) la traen'],
  [c('30-el-corte.md', 1564, '- **Dado** que [U3](10-corte/U3.md#pieza-u3) está mergeada, los plazos sin valor tienen el suyo desde',
     '- **Dado** que [U3](10-corte/U3.md#pieza-u3) está mergeada, se releyeron las dos situaciones que una restauración\n'
     '  no deshace ([paso 2b](#paso-2b), §4.3), los plazos sin valor tienen el suyo desde')],
  causa='el AC resume la condición del gate', patron='P-D', miembros=['H3-VA2-3', 'H3-VB14-4'])

h('H3-VA3-3', 'REAL', 'MENOR',
  'AC:V9b:4 (lo que cuelga de la ficha en `PB9`) no pide dos filas de la lista cerrada de `V/02` §4.1, que '
  'vale igual para `PB9` y `PB12`: que llegar a `PURGED` no escribe `deleted_at` (el trigger de extras borraría '
  'los favoritos) y que el pedido de arreglo se cierra sin correo y se conserva. AC:V6:13 sí las pide para '
  '`PB12`; V9b las tiene sólo en la transcripción (:367-368). Contra la costumbre del repo (soft delete por '
  'defecto), es justo la que un implementador escribiría al revés.',
  ['VA-A3'],
  [V + 'docs/02-modelo-de-datos.md:787 «Vale igual para `PB9` y para `PB12`»; :798 «**Y llegar a `PURGED` no escribe `deleted_at`**»; :799 «**se cierra en el mismo acto, sin correo, y la fila se conserva como registro de la moderación**»',
   'spec 20-fase-1/V9b.md:156-166 (AC:V9b:4)'],
  [c('20-fase-1/V9b.md', 160, '  dueño, y datos del dueño que sólo sirven a esa ficha',
     '  dueño, un favorito de un turista, un pedido de arreglo abierto, y datos del dueño que sólo sirven a\n  esa ficha'),
   c('20-fase-1/V9b.md', 164, '  del dueño que sólo servía a la ficha no tiene filas de ella; la configuración de revalidación no se',
     '  del dueño que sólo servía a la ficha no tiene filas de ella; `PB9` no escribe `deleted_at`, así que\n'
     '  el favorito sigue (el trigger de extras no corre); el pedido de arreglo queda cerrado en el mismo acto,\n'
     '  sin correo, y su fila se conserva; la configuración de revalidación no se')],
  causa='la lista del modelo se bajó entera a PB12 y a medias a PB9', patron='P-D')

h('H3-VA4-3', 'REAL', 'MENOR',
  'La precisión 7 de `V/17` §1.2 (conversaciones, reseñas y comentarios son de quien los escribe, sólo sobre '
  'una ficha `PUBLISHED`; sobre una que no lo está contesta «no existe») tiene criterio de demostración propio '
  'para V5 en la descomposición, pero V5 la tiene sólo en la prosa (:632-650): ni AC, ni TEST, ni LISTA:V5.',
  ['VA-A4'],
  [V + 'descomposicion.md:515 «| **las conversaciones, las reseñas y los comentarios, de quien los escribe** … | **V5** | un turista le escribe a una ficha publicada ajena y deja una reseña; sobre una ficha en borrador ajena contesta lo mismo que sobre un identificador que no existe; su conversación sobre una `PURGED` se lee entera y no admite mensajes |»',
   V + 'docs/17-autorizacion.md:219 (precisión 7)'],
  [c('10-corte/V5.md', 418, None,
     '<a id="ac-v5-25"></a>\n'
     '**AC:V5:25** — Conversaciones, reseñas y comentarios: de quien los escribe, sobre una ficha que exista para él.\n\n'
     '- **Dado** un turista, una ficha `PUBLISHED` ajena, una en borrador ajena y una `PURGED` sobre la que ya\n'
     '  tenía una conversación\n'
     '- **Cuando** le escribe a cada una y deja una reseña\n'
     '- **Entonces** sobre la publicada la conversación y la reseña se crean (el paso 4 pregunta por el dueño\n'
     '  de la conversación o de la reseña, que es quien escribe); sobre la borrador contesta lo mismo que\n'
     '  sobre un identificador que no existe; y su conversación sobre la `PURGED` se lee entera y no admite\n'
     '  mensajes.\n'
     'Fuente: [LISTA:V5](#lista-v5), [FILA:V5](#fila-v5)\n'
     'Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:515\n',
     False, 'un AC nuevo antes de AC:V5:23 (l. 418); AC:V5:23 lo suma a su rango, LISTA:V5 suma la cláusula y un TEST:V5 de integración lo cubre')],
  causa='criterio de demostración de la fuente sin AC', patron='P-D')

h('H3-VA4-4', 'REAL', 'MENOR',
  'La consolidación de la campaña del trial («una sola pieza por persona y por hito, que nombra todas las '
  'verticales», antes que la supresión del tope diario) está en la prosa de V4 (:661-665) y en ningún AC/TEST.',
  ['VA-A4'],
  [V + 'docs/11-trial.md:312 «Una sola pieza por persona y por hito, que nombra todas las verticales que le corresponden. La consolidación pasa antes que la supresión del capítulo 07»',
   'spec 10-corte/V4.md:401-415 (AC:V4:16) no la pide'],
  [c('10-corte/V4.md', 414, '  mergea antes que `U2`.',
     '  mergea antes que `U2`. **Y los hitos de varias verticales que caen el mismo día salen en una sola\n'
     '  pieza por persona y por hito, que nombra todas las verticales**: la consolidación pasa antes que la\n'
     '  supresión del tope diario (`V/11` §6.2).')],
  causa='regla de la prosa sin AC', patron='P-D')

h('H3-VA5-3', 'REAL', 'MENOR',
  'AC:V6:18 (la herramienta del corte escribe las cinco pruebas) no pide lo que la prosa de V6 (:974-995) sí '
  'trae de `V/21`: el plan de trial, las versiones y el fin tomados del catálogo que la migración del paso 3 ya '
  'cargó, la campaña previa agendada, y que correr la herramienta dos veces no escribe dos.',
  ['VA-A5'],
  [V + 'docs/21-migracion.md:503-522',
   'spec 10-corte/V6.md:485-494 (AC:V6:18)'],
  [c('10-corte/V6.md', 491, '  siembran trials consumidos; y se verifican a mano. El script suelto del corte no importa código de',
     '  siembran trials consumidos; cada fila lleva el plan de trial, las versiones y el fin tomados del\n'
     '  catálogo que la migración del paso 3 ya cargó, y su campaña previa agendada; correr la herramienta\n'
     '  dos veces no escribe dos (`UNIQUE(user_id, vertical)`); y se verifican a mano. El script suelto del corte no importa código de')],
  causa='el AC resume la escritura de la herramienta', patron='P-D')

h('H3-VA6-3', 'REAL', 'MENOR',
  'ESQ:5 (B3 crea `plan_migration` y `plan_migration_subscription`) ya lista las columnas (corrección H2-VA6-5) '
  'pero no las restricciones de `B/02` §2.2: FK a `plan_version` para las dos versiones, las dos de la misma '
  'vertical, el plazo del aviso no menor que el mínimo de `DEC-MP-002`, y los valores del estado y del motivo '
  'de un FUERA. Como B12 no puede traer migración estructural, si B3 no las crea no nacen.',
  ['VA-A6'],
  [B + 'docs/02-modelo-de-datos.md:61 «FK a `plan_version` para las dos versiones, y **las dos de la misma vertical**. El plazo del aviso **no es menor que el mínimo del aviso de aumento** de `DEC-MP-002`»; :62 «**su estado** (`PENDIENTE`, `APLICADA`, `FUERA`, `PARA_RESOLVER` o `CANCELADA`)»',
   'spec 10-corte/B3.md:943-950 (ESQ:5); B3.md:984-985 (el drift guard prohíbe migración estructural en las fases)'],
  [c('10-corte/B3.md', 949, "`UNIQUE(subscription_id) WHERE estado = 'PENDIENTE'` en la segunda.",
     "`UNIQUE(subscription_id) WHERE estado = 'PENDIENTE'` en la segunda; en la primera, FK a `plan_version` para\n"
     'las dos versiones, **las dos de la misma vertical**, y el plazo del aviso **no menor que el mínimo del aviso\n'
     'de aumento** de `DEC-MP-002`; el estado de la segunda es `PENDIENTE`, `APLICADA`, `FUERA`, `PARA_RESOLVER`\n'
     'o `CANCELADA`, y el motivo de un `FUERA`, *cambió de plan*, *se dio de baja* o *terminó*.')],
  causa='la corrección de la vuelta 2 bajó las columnas y no las restricciones', patron='P-A')

h('H3-VA9-3', 'REAL', 'MENOR',
  'AC:B3:19 dice que «una pausa dada desde la cuenta del pagador, que tampoco se distingue, se trata como la del '
  'proveedor por mora»: se apoya en el 📌 N8, que el 📌 de `EX-53` (2026-09-29) superó: el pagador no puede '
  'pausar desde su cuenta. El desenlace (`S6` por mora) es el mismo.',
  ['VA-A9', 'VB-08'],
  [P + '01-decision-log.md:5921-5924 «📌 **Precisada el 2026-09-29** … (`EX-53`…): el pagador no puede pausar desde su cuenta de Mercado Pago. Un `paused` sin un `PUT` nuestro es, entonces, la mora … y la pausa deja de estar pendiente en el 📌 anterior (N8)»',
   B + 'docs/12-suscripcion.md:1190 «cerrado: el pagador no puede pausar (`EX-53`…)»'],
  [c('10-corte/B3.md', 450, '  ya pagó (consecuencia aceptada); y una pausa dada desde la cuenta del pagador, que tampoco se distingue,',
     '  ya pagó (consecuencia aceptada); y el pagador no puede pausar desde su cuenta (`EX-53`, medido el'),
   c('10-corte/B3.md', 451, '  se trata como la del proveedor por mora.',
     '  2026-09-29): un `paused` sin un `PUT` nuestro es la mora del proveedor.')],
  causa='premisa de un 📌 superado por uno posterior', patron='P-F', miembros=['H3-VA9-3', 'H3-VB08-3'])

h('H3-VB01-3', 'REAL', 'MENOR',
  'El índice dice que `U2` «va antes de las piezas que encolan: `V6`, `V9a`, `V9b`, `B4` y `B12`»: `V9a` no '
  'encola (espera a `U2` por la flecha que heredó de `V9`), y el mismo índice lo dice en :670.',
  ['VB-01'],
  [V + 'descomposicion.md:641 «que `V9a` espere a `U2` lo dejé por regla —heredó la flecha de `V9`— aunque el registro no encola»',
   P + 'nucleo/07-outbox-y-notificaciones.md:70 (lo vivo: primero `V4` y `B3`, y por transitividad el resto)'],
  [c('00-indice.md', 375, "va antes de las piezas que encolan**: `V6`, `V9a`, `V9b`, `B4` y `B12` (FASE 5, owner 2026-09-30, lote 2 A; `NUCLEO/07` §1.4)",
     "va antes de las piezas que encolan**: `V6`, `V9b`, `B4` y `B12` (FASE 5, owner 2026-09-30, lote 2 A; `NUCLEO/07` §1.4; `V9a` no encola: la espera por la flecha que heredó de `V9`)")],
  causa='lista de la FASE 5 con `V9` partido sin revisar quién encola', patron='P-B')

h('H3-VB01-4', 'REAL', 'MENOR',
  'El índice y 80-abiertos dicen que las fuentes están congeladas en `c7a3fac…` «después de aplicar las letras '
  'BK a CB»; la spec cita y aplica hasta CI, y 01 y 04 dicen `591034c665`, el SHA real del congelado.',
  ['VB-01'],
  ['spec 01-decisiones-vigentes.md:5 «Fuente congelada: `591034c665b56336d49eab894a4e4ce3c38d5abe`»; 04-catalogos.md:5 «(`591034c665`)»',
   P + '41-corte-del-mvp/10-decisiones-del-owner.md:204 «## Lote CH y CI (2026-10-02)»'],
  [c('00-indice.md', 26, 'Todo sale de las fuentes congeladas en el commit `c7a3fac90070b154e3a811944d06e0de08cba5df`',
     'Todo sale de las fuentes congeladas en el commit `591034c665b56336d49eab894a4e4ce3c38d5abe`'),
   c('00-indice.md', 27, '(re-congeladas después de aplicar las letras BK a CB del owner): cada',
     '(re-congeladas después de aplicar las letras BK a CI del owner): cada'),
   c('80-abiertos.md', 7, '`c7a3fac90070b154e3a811944d06e0de08cba5df`. Abreviaturas',
     '`591034c665b56336d49eab894a4e4ce3c38d5abe`. Abreviaturas')],
  causa='la etiqueta del congelado no se actualizó al re-congelar', patron='P-B')

h('H3-VB04-3', 'REAL', 'MENOR',
  'U1 deja «el nombre de *«las tres tablas»* de `is_featured` y `featured_by_entitlement`» a propuesta del PR '
  'y, en Abiertos (:828-830), lo da resuelto: son las tres tablas de fichas (`B/21` :511-513).',
  ['VB-04'],
  [B + 'docs/21-migracion.md:511-513 «en las tres tablas de fichas»'],
  [c('10-corte/U1.md', 562, 'Lo mismo vale para el nombre neutro de la bitácora y para el nombre de *«las tres',
     'Lo mismo vale para el nombre neutro de la bitácora. *«Las tres'),
   c('10-corte/U1.md', 563, '  tablas»* de `is_featured` y `featured_by_entitlement`.',
     '  tablas»* de `is_featured` y `featured_by_entitlement` no se proponen: son las tres tablas de fichas, las\n'
     '  de Alojamiento, Gastronomía y Experiencia (`B/21-migracion.md:511-513`).')],
  causa='dos secciones del mismo archivo, una sin actualizar', patron='P-B')

h('H3-VB05-4', 'REAL', 'MENOR',
  'V3:420 manda la lista de invalidación a `V/02` §2.6; está en §3.2 («Se invalida por evento»).',
  ['VB-05'],
  [V + 'docs/02-modelo-de-datos.md:662 «### 3.2 Se invalida por evento, no por tiempo»; :678 la fila «llega el aviso de cobertura»'],
  [c('10-corte/V3.md', 420, 'la lista de invalidación (abajo; `V/02` §2.6).', 'la lista de invalidación (abajo; `V/02` §3.2).')],
  causa='cita de sección mal puesta (la de `V/15` §2.6, que se copió)', patron='P-E')

h('H3-VB05-5', 'REAL', 'MENOR',
  'V3 dice que «la cuota restante que conviene mostrar y el total de trial son superficies de `V8a` y `B13a`»: '
  'DEC-ENT-002 sólo dice que *conviene* mostrar la cuota restante del mes, no asigna pieza, y ni V8a ni B13a la '
  'recogen. Es una asignación sin destino ni soporte.',
  ['VB-05'],
  [P + '01-decision-log.md:630-632 «Conviene que la UI muestre la cuota restante del mes para que no sea una sorpresa»',
   V + 'descomposicion.md:63 (fila V3) sin superficie'],
  [c('10-corte/V3.md', 719, 'N/A — la cuota restante que conviene mostrar y el total de trial son superficies de `V8a` y `B13a`',
     'N/A — `V3` no tiene pantalla. *(Que la UI muestre la cuota restante del mes es una recomendación de'),
   c('10-corte/V3.md', 720, '(`DEC-ENT-002`, implicación 3; `V/descomposicion.md` §2, fila `V3`).',
     '`DEC-ENT-002`, implicación 3 —*«conviene»*—, no un requisito: ninguna fila de la descomposición la asigna\ny ninguna pieza la construye en esta versión.)*')],
  causa='asignación inventada a partir de un «conviene»', patron='P-G')

h('H3-VB05-6', 'REAL', 'MENOR',
  'El «Dado» de AC:V4:2 enumera la normalización por proveedor sin Yahoo (`+` queda salvo medición) ni AOL, '
  'Zoho, GMX y los ISP argentinos (`+` queda); leído solo, los manda a «todo dominio que la lista no nombra» y '
  'les quita el `+`. La tabla completa está en V4:851-853.',
  ['VB-05'],
  [V + 'docs/02-modelo-de-datos.md:345-347 (filas Yahoo y AOL/Zoho/GMX/ISP: `+alias` queda)'],
  [c('10-corte/V4.md', 227, '  Fastmail y Yandex quitan el `+`; todo dominio que la lista no nombra cuenta como dominio propio y',
     '  Fastmail y Yandex quitan el `+`; Yahoo deja el `+` salvo que la medición confirme quitarlo, y AOL, Zoho,\n'
     '  GMX y los ISP argentinos lo dejan; todo dominio que la lista no nombra cuenta como dominio propio y')],
  causa='el AC resume una tabla cerrada y pierde filas', patron='P-D')

h('H3-VB06-5', 'REAL', 'MENOR',
  'Citas «l. N» corridas en la sección de fuentes de seis piezas de verticales: las filas de `V/descomposicion` '
  '§4 y de la lista de piezas, el esquema del corte y las fases posteriores de `16-fase-7` (entre +5 y +56).',
  ['VB-06', 'VB-07'],
  [V + 'descomposicion.md:716 (fila V5 de §4), :719-721 (V8, V8a, V8b)',
   P + '16-fase-7-del-paraguas.md:948-953 (V5…V9a en la lista de piezas), :984-985 (esquema, `V7` lo crea `V6`), :994-997 (nota del esquema), :1135-1177 (fases posteriores)'],
  [c('10-corte/V5.md', 1538, '§4, fila `V5` (l. 709).', '§4, fila `V5` (l. 716).'),
   c('10-corte/V5.md', 1541, '(lista de piezas, l. 943)', '(lista de piezas, l. 948)'),
   c('10-corte/V6.md', 1468, '(lista de piezas, l. 944; esquema del corte, l. 979–980).', '(lista de piezas, l. 949; esquema del corte, l. 984–985).'),
   c('20-fase-4/V7.md', 1061, '(lista de piezas, l. 945; esquema del corte, l. 979–980)', '(lista de piezas, l. 950; esquema del corte, l. 984–985)'),
   c('20-fase-4/V7.md', 1062, '(las fases posteriores, l. 1079–1111).', '(las fases posteriores, l. 1135–1177).'),
   c('10-corte/V8a.md', 645, '`V8a` (l. 712 y 713).', '`V8a` (l. 719 y 720).'),
   c('10-corte/V8a.md', 648, '§4.6 (l. 946)', '§4.6 (l. 951)'),
   c('20-fase-4/V8b.md', 302, 'fila `V8b` (l. 714)', 'fila `V8b` (l. 721)'),
   c('20-fase-4/V8b.md', 306, '(l. 947, nota del esquema l. 989–992)', '(l. 952, nota del esquema l. 994–997)'),
   c('10-corte/V9a.md', 311, '(lista de piezas, l. 948)', '(lista de piezas, l. 953)')],
  causa='citas de línea escritas contra un SHA anterior', patron='P-E',
  miembros=['H3-VB06-5', 'H3-VB06-6', 'H3-VB07-8', 'H3-VB07-9', 'H3-VB07-10', 'H3-VB07-11'])

h('H3-VB07-5', 'REAL', 'MENOR',
  'AC:V7:16 y TEST:V7:16 piden que «ningún archivo del repositorio» nombre `starts_at`, `ends_at` ni `tier` de '
  '`partners`; la fuente dice «ni la base ni ningún archivo del panel», y para `tier`, que la página y las rutas '
  'leen la clave. Leído a la letra, el test falla con las migraciones que borran esas columnas.',
  ['VB-07'],
  [V + 'descomposicion.md:718 «ni la base ni ningún archivo del panel las nombra» … «y tampoco `partners.tier` ni su índice: la página pública y las rutas del socio leen la clave»'],
  [c('20-fase-4/V7.md', 319, '  archivo del repositorio nombra `starts_at`, `ends_at` ni `tier` de `partners`.',
     '  archivo del panel, de la página pública ni de las rutas del socio nombra `starts_at`, `ends_at` ni\n'
     '  `tier` de `partners` (las migraciones que las borran, sí: son historia).'),
   c('20-fase-4/V7.md', 964, '**TEST:V7:16** — Unitario sobre el repositorio: ningún archivo nombra `starts_at`, `ends_at` ni `tier`',
     '**TEST:V7:16** — Unitario sobre el código de la aplicación, sin las migraciones: ningún archivo nombra `starts_at`, `ends_at` ni `tier`')],
  causa='alcance del AC más ancho que la fuente', patron='P-G')

h('H3-VB07-6', 'REAL', 'MENOR',
  'AC:V7:6 y TEST:V7:6 comprueban que la `PENDIENTE` atrasada «aparece marcada en el panel», pero el panel de '
  'postulaciones es de `V8b`, que se mergea después; `V7` es dueña del PLAZO:8 y de la lectura.',
  ['VB-07'],
  ['spec 20-fase-4/V7.md:827-828 «el panel de postulaciones es de `V8b`»; 20-fase-4/V8b.md:43 «la marca de atrasada la decide el PLAZO:8 (dueña `V7`) y el panel la muestra»'],
  [c('20-fase-4/V7.md', 223, '- **Entonces** ninguna cambia de estado; la `PENDIENTE` aparece marcada como atrasada en el panel y la',
     '- **Entonces** ninguna cambia de estado; la consulta de atrasadas (la que muestra el panel de `V8b`)\n  devuelve la `PENDIENTE`, y la')],
  causa='el AC prueba sobre una superficie de una pieza posterior', patron='P-G')

h('H3-VB08-4', 'REAL', 'MENOR',
  'AC:B3:31 dice que «ninguna transición de una lee el estado de la otra»; el invariante 9 no lo dice, y la '
  'misma pieza tiene cruces declarados (`S2` del plan cancela Turista VIP; la guarda de `S1` lee la herencia).',
  ['VB-08'],
  [P + 'nucleo/04-invariantes.md:60 «| 9 | verticales simultáneas en estados distintos | es una consecuencia del modelo: todo cuelga de `user + vertical` |»',
   'spec 10-corte/B3.md AC:B3:27/AC:B3:28'],
  [c('10-corte/B3.md', 618, '  otra `ACTIVE`, y ninguna transición de una lee el estado de la otra.',
     '  otra `ACTIVE`, y lo que le pasa a una no mueve a la otra (los cruces que el diseño declara —`S2`\n'
     '  sobre Turista VIP y la herencia que lee la guarda de `S1`— no están en este escenario).')],
  causa='afirmación más fuerte que el invariante', patron='P-G')

h('H3-VB09-2', 'REAL', 'MENOR',
  'TEST:B4:10 pide «los tests 1 a 9 en verde»; TEST:B4:11 (anotar la cancelación vista, que cubre AC:B4:10 '
  'y AC:B4:11) queda afuera, también por posición: está entre el 9 y el 10.',
  ['VB-09'],
  ['spec 10-corte/B4.md:459 `test-b4-11` antes de :470 `test-b4-10`; AC:B4:10 exige las ocho cláusulas, la de AC:B4:11 incluida'],
  [g8('B4', 476, 'los tests 1 a 9 en verde', 'los tests 1 a 9 y el 11 en verde')],
  causa='rango numérico que no siguió al test agregado', patron='P-B')

h('H3-VB09-3', 'REAL', 'MENOR',
  'AC:B5:18 pone en el «Dado» una cuota `DECLARED_UNPAID` de una suscripción en `GRACE_PERIOD`: ninguna '
  'transición la produce (MP2 y la 1.ª cláusula de MP3 suspenden; la 3.ª sale del grace) y el «Entonces» no '
  'define efecto desde ahí.',
  ['VB-09'],
  [B + 'docs/03-maquinas-de-estado.md:1873-1874 (MP3, MP4: «la suscripción sale de `SUSPENDED` por `S7`»)'],
  [g8('B5', 359, 'que sigue en `SUSPENDED` o `GRACE_PERIOD`', 'que sigue en `SUSPENDED`')],
  causa='el «Dado» amplía el estado de origen sin soporte', patron='P-G')

h('H3-VB09-4', 'REAL', 'MENOR',
  'AC:B6:2 (el contracargo visto antes de `RF2`) no pide el efecto de `RF5` por contracargo: el pago colgado '
  'de la marca que proponía devolverlo queda resuelto sin devolver, con el contracargo anotado y visible junto a '
  '`CONTRACARGO`. Sin él, la guarda de `S15` no deja levantar la marca. Está en TRANS:B:RF5, que el AC cita.',
  ['VB-09'],
  [B + 'docs/03-maquinas-de-estado.md:1854 (RF5, efectos): «**Por el contracargo, el pago colgado de la marca que proponía devolverlo queda resuelto sin devolver**, con el contracargo anotado»'],
  [g8('B6', 104, '`FAILED`, sin mover el pago.',
      '`FAILED`, sin mover el pago; **el pago colgado de la marca que proponía devolverlo queda resuelto sin\n'
      'devolver**, con el contracargo anotado, y la persona lo ve en el listado junto a la marca `CONTRACARGO`.')],
  causa='el AC toma el destino de la transición y no su efecto', patron='P-D')

h('H3-VB10-4', 'REAL', 'MENOR',
  'AC:B7:9 (`paused` sin `PUT` nuestro → `S6` por su segundo evento) no pone las guardas de `S6`: con un pago '
  'del período pendiente de `S19` o con un cobro acreditado en la relectura, `S6` no ocurre y corre `S5`/`P1`. '
  'Están en TRANS:B:S6, que el AC cita, y en AC:B7:8 sólo para el primer evento.',
  ['VB-10'],
  [B + 'docs/03-maquinas-de-estado.md:156 (guarda de S6)'],
  [g8('B7', 204, 'con motivo `CUSTOMER_REQUEST`, y no hay un motivo de pausa propio del proveedor.',
      'con motivo `CUSTOMER_REQUEST`, y no hay un motivo de pausa propio del proveedor; **con las guardas de\n'
      '`S6`**: si hay un pago del período pendiente de `S19`, o la relectura muestra un cobro acreditado del\n'
      'período, `S6` no ocurre y corre lo que dice [AC:B7:8](#ac-b7-8) (`S5`, y `P1` sobre una fila `ACTIVE`).')],
  causa='el AC del segundo evento no repite las guardas del primero', patron='P-D')

h('H3-VB10-5', 'REAL', 'MENOR',
  'La cláusula 9 de LISTA:B7 (el pago manual en sucesión, «con su devolución asentada igual que la de un cobro '
  'del proveedor») no tiene AC propio: AC:B7:16 cubre la entrada del pago manual y no el asiento de su devolución.',
  ['VB-10'],
  [B + 'descomposicion.md:1066 (cláusula 9) y :965'],
  [g8('B7', 290, 'ninguna corrida deja un pago pendiente para siempre.',
      'ninguna corrida deja un pago pendiente para siempre; y cuando la rama termina en devolución, la de un\n'
      'pago registrado a mano se asienta igual que la de un cobro del proveedor (`03` §7, `02` §2.3).')],
  causa='cláusula de la lista sin AC que la ejerza', patron='P-D')

h('H3-VB12-3', 'REAL', 'MENOR',
  'AC:B11:13 (órdenes pagadas) busca por el identificador del pedido sobre toda `UNA_VEZ` en `ABANDONED` sin id '
  'de orden; la fuente lo acota a las que tienen la clave persistida (sin clave no salió ninguna orden).',
  ['VB-12'],
  [B + 'docs/09-conciliacion.md:908 «por cada instancia `UNA_VEZ` en `ABANDONED` sin id de orden **y con su clave persistida**»'],
  [c('10-corte/B11.md', 1539, '- **Dado** una instancia `UNA_VEZ` en `ABANDONED`, dentro de la ventana del plazo 18',
     '- **Dado** una instancia `UNA_VEZ` en `ABANDONED` con su clave persistida (se persiste antes de la\n'
     '  llamada, así que sin clave no salió ninguna orden), dentro de la ventana del plazo 18')],
  causa='el AC pierde una guarda de la fuente', patron='P-D')

h('H3-VB12-4', 'REAL', 'MENOR',
  'B11:2204 habla de «las veinte cláusulas del criterio»; LISTA:B11 tiene 21 (la 21, `cancelado_visto_en`, de CH).',
  ['VB-12'],
  [B + 'descomposicion.md:1074 (LISTA de B11, con la cláusula de CH)'],
  [c('10-corte/B11.md', 2204, 'Las veinte cláusulas del criterio', 'Las veintiuna cláusulas del criterio')],
  causa='conteo que no siguió a la letra CH', patron='P-B')

h('H3-VB13-4', 'REAL', 'MENOR',
  'TEST:B8b:24 comprueba que el diff no toca `B3`, `B5` ni `B7`; AC:B8b:24 (BL) dice también `B8a`.',
  ['VB-13'],
  ['spec 20-fase-2/B8b.md:723 «el diff de `B8b` no cambia el código de `B3`, `B5`, `B7` ni `B8a`»'],
  [c('20-fase-2/B8b.md', 1331, 'pieza no toca archivos de `B3`, `B5` ni `B7`.', 'pieza no toca archivos de `B3`, `B5`, `B7` ni `B8a`.')],
  causa='el TEST resume el AC', patron='P-D')

h('H3-VB13-5', 'REAL', 'MENOR',
  'TEST:B8b:23 (migración desde cero, sin migración estructural en la rama) cita `DEC-RF-003` (el default '
  'DEVOLVER de la rama 6), que no tiene que ver con lo que verifica.',
  ['VB-13'],
  [P + '01-decision-log.md:4397 (DEC-RF-003)', 'spec 20-fase-2/B8b.md:1312'],
  [c('20-fase-2/B8b.md', 1312, ' · [DEC-RF-003](../01-decisiones-vigentes.md#dec-rf-003) · [GATE:FP.3]', ' · [GATE:FP.3]')],
  causa='cita arrastrada de otro TEST', patron='P-E')

h('H3-VB13-6', 'REAL', 'MENOR',
  '80-abiertos:355 dice que, «precisado por BZ», los 3 días del reintento de un aumento corren desde `S37`; BZ '
  'no habla del reintento, y la fuente que transcribe dice «desde su fecha efectiva (§2.4)». Inferencia no marcada.',
  ['VB-13'],
  [B + 'docs/14-promos-cortesias-y-grants.md:741-742 «los 3 días del reintento de monto de un aumento corren desde su fecha efectiva (§2.4)»',
   P + '41-corte-del-mvp/10-decisiones-del-owner.md:169 (BZ) sin reintento'],
  [c('80-abiertos.md', 355, 'y los 3 días del reintento corren desde `S37`, como los de toda mutación nuestra (corte del MVP',
     'y los 3 días del reintento de monto corren desde su fecha efectiva (`B/14` §2.4), como dice la fuente (corte del MVP')],
  causa='inferencia propia atribuida a una letra', patron='P-G')

# ---------------------------------------------------------------- canarios -------------------------
CANARIOS = [
    # (bloque, dónde (copia), tipo, detectado_por, nota)
    ('VB-01', '02-nucleo-glosario.md:367 (día 60 sale del sitio público)', 'MODIFICA', ['VB-01', 'VA-A1'], ''),
    ('VB-01', '00-indice.md:1201 (sin foto nace DRAFT)', 'AGREGA', ['VB-01'], ''),
    ('VB-02', '02-nucleo.md:1017 (MP2 lleva a CANCELLED)', 'MODIFICA', ['VB-02', 'VA-A1'], ''),
    ('VB-02', '02-nucleo-outbox.md:270 (reason de 60 caracteres)', 'AGREGA', ['VB-02', 'VA-A1'], ''),
    ('VB-03', '03-contrato-de-cobertura.md:1119 (reintento 5 días)', 'MODIFICA', ['VB-03', 'VA-A2', 'VA-A6'], ''),
    ('VB-03', '02-nucleo-modelo-y-maquinas.md:254 (evento 24 meses y compactación)', 'AGREGA', ['VB-03', 'VA-A1'], ''),
    ('VB-04', '10-corte/U3.md:169 (tolerancia del 1 %)', 'MODIFICA', ['VB-04'], ''),
    ('VB-04', '10-corte/V1.md:319 (clave sin uso se borra)', 'AGREGA', ['VB-04'], ''),
    ('VB-05', '10-corte/V2.md:435 (hasta tres borradores)', 'MODIFICA', ['VB-05', 'VA-A3'], ''),
    ('VB-05', '10-corte/V4.md:748 (segundo rechazo termina el trial)', 'AGREGA', ['VB-05', 'VA-A3', 'VA-A4'], ''),
    ('VB-06', '10-corte/V6.md:1045 (tres pedidos de arreglo abiertos)', 'MODIFICA', ['VB-06'], ''),
    ('VB-06', '10-corte/V5.md:1129 (24 meses en SUSPENDED retira el rol)', 'AGREGA', ['VB-06'], ''),
    ('VB-07', '10-corte/V9a.md:157 (sólo el valor nuevo)', 'MODIFICA', ['VB-07'], ''),
    ('VB-07', '20-fase-4/V8b.md:175 (postulación rechazada a los 60 días)', 'AGREGA', ['VB-07'], ''),
    ('VB-08', '10-corte/B1.md:428 (la auto-reanudación existe)', 'MODIFICA', ['VB-08', 'VA-A8'], ''),
    ('VB-08', '10-corte/B3.md:1047 (aviso de más de 10 min se descarta)', 'AGREGA', ['VB-08'], ''),
    ('VB-09', '10-corte/B4.md:276 (retenciónDetenida también con COURTESY)', 'MODIFICA', ['VB-09'], ''),
    ('VB-09', '10-corte/B6.md:400 (dos personas para más de la mitad)', 'AGREGA', ['VB-09'], ''),
    ('VB-10', '10-corte/B8a.md:335 (nunca recortando los 30 días)', 'MODIFICA', ['VB-10', 'VB-13'], 'VB-13 lo vio por la herencia de LISTA:B8 en AC:B8b:23'),
    ('VB-10', '10-corte/B7.md:1306 (reembolso dentro de 48 h)', 'AGREGA', ['VB-10'], ''),
    ('VB-11', '10-corte/B9a.md:787 (S13 con reembolso proporcional)', 'MODIFICA', ['VB-11', 'VA-A10'], ''),
    ('VB-11', '20-fase-2/B9b.md:420 (tres cortesías en doce meses)', 'AGREGA', ['VB-11'], ''),
    ('VB-12', '10-corte/B11.md:1369 (preapproval no se cancela hasta que el owner decida)', 'MODIFICA', ['VB-12'], ''),
    ('VB-12', '10-corte/B13a.md:899 (la baja pide la contraseña)', 'AGREGA', ['VB-12'], ''),
    ('VB-13', '20-fase-3/B10.md:1316 (el reloj del addon se congela)', 'MODIFICA', ['VB-13', 'VA-A10'], ''),
    ('VB-13', '80-abiertos.md:461 (tope del 20 % a los aumentos)', 'AGREGA', ['VB-13'], ''),
    ('VB-14', '30-el-corte.md:639 (rank más bajo)', 'MODIFICA', ['VB-14', 'VA-A2', 'VA-A9'], ''),
    ('VB-14', '90-retirados.md:403 (retirar el último plan cancela)', 'AGREGA', ['VB-14'], ''),
    ('G1', '01-decisiones-vigentes.md:4165 (tachado revivido: PB1)', 'MODIFICA', ['G1'], ''),
    ('G1', '01-decisiones-vigentes.md:9228 (tachado revivido: seis)', 'MODIFICA', ['G1'], ''),
    ('G2', '04-catalogos.md:8027 (PA-3 ~6 min)', 'MODIFICA', ['G2', 'VA-A5'], ''),
    ('G2', '20-fase-3/B10.md:598 (A6 con el motivo 12)', 'MODIFICA', ['G2'], ''),
    ('VA-A1', '02-nucleo-auditoria.md:200 (la huérfana arranca su correlación sin padre)', 'OMITE', ['VA-A1', 'VB-02'], ''),
    ('VA-A2', '30-el-corte.md:60 («Sondear por SMTP no sirve»)', 'OMITE', [], ''),
    ('VA-A3', '04-catalogos.md:944 (desempate por created_at y por id)', 'OMITE', ['G2'], ''),
    ('VA-A4', 'V4.md:486, V8a.md:377/212/439 (aviso al despublicar en trial, fila 2)', 'OMITE', ['VA-A4', 'VA-A5', 'VB-05', 'VB-07'], ''),
    ('VA-A5', '04-catalogos.md:7982 (fila sin fecha = UNKNOWN)', 'OMITE', ['G2'], ''),
    ('VA-A6', 'B3.md:956/1283 (cobros_restantes nunca negativo)', 'OMITE', ['VA-A6'], 'sólo la mitad del ESQ; la del TEST (:1283) nadie'),
    ('VA-A7', '04-catalogos.md:2756/3923 (la pausa de S32 no gasta cupo)', 'OMITE', ['VA-A7', 'VA-A6', 'G2'], ''),
    ('VA-A8', 'B11.md:1047 (el receptor de hoy no se arregla aparte)', 'OMITE', ['VA-A8', 'G2'], ''),
    ('VA-A9', 'B12.md:163, B8b.md:816 (la ventana de 60 días no aplica al cambio elegido)', 'OMITE', ['VA-A9', 'G2'], 'sólo la mitad de B12; la viñeta de B8b:816 nadie la nombró'),
    ('VA-A10', '04-catalogos.md:6384 (una simulación no puede estar prendida por defecto)', 'OMITE', ['G2'], ''),
]

J = dict(unicos=H)
J['por_id'] = {x['id']: x for x in H}
J['duplicados'] = {x['id']: x['miembros'] for x in H if len(x['miembros']) > 1}
J['canarios'] = [dict(bloque=b, donde=d, tipo=t, detectado_por=p, detectado=bool(p), por_su_bloque=b in p, nota=n)
                 for b, d, t, p, n in CANARIOS]
own = next(x for x in H if x['veredicto'] == 'OWNER')
own['pregunta_owner'] = {
    'letra': 'CJ',
    'contexto': own['resumen'],
    'opciones': [
        '1. La retira `V6`: se tacha «(la de cuentas, …) V8a» en V/descomposicion:547 y 03-contrato:1664 pasa a `V6`. Costo: dos líneas de fuente y una de la spec. Riesgo: bajo; AC:V6:25 ya la exige. Recomendada.',
        '2. La retira `V8a`: se saca «y de cuentas» de la fila de V6 (:66), AC:V6:25 pasa a «no hay borrado físico de fichas», V4:920 pasa a `V8a` y V8a gana un AC. Costo: cuatro lugares. Riesgo: medio; entre el merge de V6 y el de V8a la ruta vive contra la FK `RESTRICT` de V4.',
        '3. Las dos: V6 la deshabilita y V8a borra el archivo. Costo: dos AC. Riesgo: bajo, pero duplica un acto que la tabla de la fuente reparte por pieza.'],
    'recomendada': 1}

# ---------------------------------------------------------------- checks -----------------------------
def lineas(rel, gen):
    base = G8 if gen and rel.startswith('10-corte/B') and rel[9:11] in ('B4', 'B5', 'B6', 'B7') else SPEC
    p = os.path.join(base, os.path.basename(rel) if base == G8 else rel)
    return open(p, encoding='utf-8').read().split('\n')


anchors = {}
for root, _, fs in os.walk(SPEC):
    for f in fs:
        if f.endswith('.md'):
            rel = os.path.relpath(os.path.join(root, f), SPEC)
            anchors[rel] = set(re.findall(r'<a id="([^"]+)"', open(os.path.join(root, f), encoding='utf-8').read()))

err = []
for x in H:
    for k in x['correccion'] or []:
        if k['sale'] and k['linea']:
            L = lineas(k['archivo'], k['generado'])
            if k['sale'] not in L[k['linea'] - 1]:
                err.append(f"{x['id']}: «{k['sale'][:60]}» no está en {k['archivo']}:{k['linea']}")
            if k['archivo'].startswith('10-corte/B') and k['generado'] and k['archivo'][9:11] in ('B4', 'B5', 'B6', 'B7'):
                O = lineas(k['archivo'], False)
                if k['sale'] not in O[k['linea'] - 1]:
                    err.append(f"{x['id']}: la salida de g8 difiere de src en {k['archivo']}:{k['linea']}")
        for href in re.findall(r'\]\(([^)]+)\)', k['entra'] or ''):
            path, _, anc = href.partition('#')
            if not anc:
                continue
            tgt = os.path.normpath(os.path.join(os.path.dirname(k['archivo']), path)) if path else k['archivo']
            if anc not in anchors.get(tgt, set()) and not re.search(rf'<a id="{re.escape(anc)}"', k['entra']):
                err.append(f"{x['id']}: ancla #{anc} no existe en {tgt}")
if err:
    sys.exit('\n'.join(err))

json.dump(J, open(os.path.join(D, 'hallazgos.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok', len(H), 'únicos;', sum(len(x['miembros']) for x in H), 'miembros')
