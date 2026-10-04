---
title: "Revisión del owner · aplicación del lote al log y a la matriz"
linear: HOS-1352
statusSource: linear
created: 2026-09-28
updated: 2026-09-28
status: CURRENT
fase: 9
---

# Revisión del owner · aplicación del lote al log y a la matriz

El lote de [`14-aplicacion-transversal-y-lote.md`](./14-aplicacion-transversal-y-lote.md) §4 (4.1 a
4.5), escrito en `$D/01-decision-log.md` y `$D/06-mp-validation-matrix.md` con el **OK explícito del
owner del 2026-09-28** al lote entero ([`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md),
*El lote del log y la matriz*). Editado en el worktree `hospeda-spec-hos-1352-billing-redesign` sobre
el HEAD `37c41d6e8e`, sin commits. El PDR no se tocó; `10-decisiones-del-owner.md` tampoco (su
cambio sin commitear es del owner). `D/01` es el log, `D/06` la matriz, `B/` es `HOS-1354…/docs`,
`$B/` y `$D/` las raíces.

**Antes de escribir** grepeé cada ID: no existían `DEC-MIG-006`, `DEC-DATA-006`, `DEC-DATA-007`,
`DEC-DATA-008`, `DEC-SUB-023`, `DEC-TEST-003`, `DEC-ARCH-012`, `DEC-ARCH-013`, `EX-51`, `EX-52`,
`EX-53` ni `WH-6`, y ninguna de las treinta decisiones que reciben 📌 tenía uno de esta revisión.

**Forma.** Los textos van exactos de `14-` §4.1 a §4.3 (o del registro que §4.3 nombra: `12-` §3
puntos 6 y 12, `13-` §3 puntos 1, 5 y 6), sin las comillas de propuesta; sólo cambió el ajuste de
línea, al ancho de 100 del log. **La raya larga aparece sólo donde el formato del log ya la usa**: el
separador entre el ID y el título de una entrada, la cadena de precisiones del *Estado* y
el guion de celda vacía de las filas `UNKNOWN` de la matriz. Ningún texto de prosa nueva la usa.

## 1. Qué se escribió

### 4.1 · las ocho decisiones nuevas

Al final del log, antes de `## Resumen`, como hace el log con cada tanda (el orden es cronológico,
no por prefijo). Cada una con *Fecha · Estado · Decide*, *Problema* (de los puntos del owner en
[`00-puntos.md`](./00-puntos.md) y `10-`), *Decisión*, *Reemplaza a* o lo que toca, *Dónde* y
*Origen*. `DEC-ARCH-012` lleva además su apartamiento del §55.1, con el texto del PDR verificado
(regla 5 del log); `DEC-DATA-008` deja escrito que el apartamiento del §25 no está decidido (`14-`
§3, punto 46).

| # | decisión | dónde |
|---|---|---|
| 1 | `DEC-MIG-006` | `D/01:6327` «El corte publica las fichas que estaban a la vista y le arranca a» |
| 2 | `DEC-DATA-006` | `D/01:6354` «La pausa pedida por el dueño detiene el reloj de retención de» |
| 3 | `DEC-DATA-007` | `D/01:6376` «La moderación tiene dos niveles: pedir un arreglo o bajar la» |
| 4 | `DEC-SUB-023` | `D/01:6400` «Migrar a los clientes de un plan retirado es un tercer camino» |
| 5 | `DEC-TEST-003` | `D/01:6429` «El Mercado Pago falso miente sólo lo medido, y una batería» |
| 6 | `DEC-ARCH-012` | `D/01:6456` «El agrupamiento viejo de Gastronomía y Experiencia desaparece» |
| 7 | `DEC-ARCH-013` | `D/01:6487` «La configuración de planes vive 100 % en la base, y cambia sólo» |
| 8 | `DEC-DATA-008` | `D/01:6519` «Todo plazo que decide cuándo pasa algo es configurable, y cada» |

### 4.2 · los SUPERSEDED

Las cuatro enteras cambian `ACCEPTED` por el texto de §4.2 punto 9, como hicieron `DEC-SUB-003` y
`DEC-SUB-001`; `DEC-ARCH-011` conserva detrás su cadena de precisiones. `DEC-DATA-002` pasa a
`SUPERSEDED EN PARTE por DEC-DATA-006`, como `DEC-MIG-002`, y conserva su precisión del 25/09.
`G1-1` y la cota de 6 meses de `G-R5-B`, sin `DEC` propio, quedan dichos en *Reemplaza a* de
`DEC-MIG-006` y de `DEC-DATA-008` (§4.2 punto 11).

| # | decisión | dónde |
|---|---|---|
| 1 | `DEC-SUB-015` | `D/01:4052` «SUPERSEDED (revisión del owner, 2026-09-28, C8): las verticales no se discontinúan. Discontinuar» |
| 2 | `DEC-SUB-018` | `D/01:5095` «SUPERSEDED (revisión del owner, 2026-09-28, C8): las verticales no se discontinúan. Discontinuar» |
| 3 | `DEC-GRANT-010` | `D/01:4375` «SUPERSEDED (revisión del owner, 2026-09-28, C8): las verticales no se discontinúan. Discontinuar» |
| 4 | `DEC-ARCH-011` | `D/01:6233` «SUPERSEDED (revisión del owner, 2026-09-28, C8): las verticales no se discontinúan. Discontinuar» |
| 5 | `DEC-DATA-002` | `D/01:3459` «SUPERSEDED EN PARTE por `DEC-DATA-006` (2026-09-28, revisión del owner, C14): se cae que el reloj» |

### 4.3 · los treinta 📌 y su *Estado*

Cada 📌 va al final de su entrada, después de *Origen* o del último 📌, con cabecera
*Precisada el 2026-09-28, con OK del owner (revisión del owner, puntos)*; los que precisan un punto
lo nombran en la cabecera (`DEC-MIG-001` implicación 5, `DEC-MIG-005` punto 3 de la decisión,
`DEC-ENT-002` y `DEC-TRIAL-004` implicación 2, `DEC-ARCH-004` definición 2 e implicación 5). El
*Estado* suma *precisada el 2026-09-28, con OK del owner (revisión del owner, puntos; ver su 📌)*, o
*y precisada…* con *ver su último 📌* donde ya había precisiones. `DEC-DATA-002` recibe un solo 📌
con las tandas 1 y 4 juntas, como pide §4 (el condicional sobre `DEC-DATA-004` se cayó y no se
escribió).

| `14-` §4.3 | decisión | *Estado* | 📌 |
|---|---|---|---|
| 12 | `DEC-ARCH-006` | línea 2352 | `D/01:2453` «Precisada el 2026-09-28, con OK del owner (revisión del owner, N6, `L1-d`, C4, C14): El contrato vive en un package compartido del» |
| 13 | `DEC-RF-004` | línea 4816 | `D/01:4908` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C8): Con C8 el disparador 2 de `S21` ya no se parte y el motivo 15 se llama» |
| 13 | `DEC-RF-006` | línea 5121 | `D/01:5198` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C8): Con C8 el disparador 2 de `S21` ya no se parte y el motivo 15 se llama» |
| 14 | `DEC-RF-008` | línea 6073 | `D/01:6112` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C8, C15, N1, C9): Las acciones administrativas pasan de dieciséis a» |
| 15 | `DEC-ADDON-004` | línea 3590 | `D/01:3643` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C8): `S25` a `S28` salieron con la revisión del owner (C8).» |
| 15 | `DEC-SUB-013` | línea 3768 | `D/01:3843` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C8): `S25` a `S28` salieron con la revisión del owner (C8).» |
| 16 | `DEC-OBS-001` | línea 2124 | `D/01:2165` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C8): Su resumen ya no lleva la acción 16 (`V2-s`).» |
| 17 | `DEC-ARCH-007` | línea 2463 | `D/01:2515` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C2, `L3-b`): Cómo se integra sin activar: no se activa nada; la épica vive» |
| 18 | `DEC-MIG-001` | línea 399 | `D/01:432` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C2, sobre la implicación 5): No se convive.» |
| 19 | `DEC-MIG-005` | línea 5981 | `D/01:6065` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C12, sobre el punto 3 de la decisión): Precisado por `DEC-MIG-006`: no se» |
| 20 | `DEC-TRIAL-008` | línea 3304 | `D/01:3338` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C14): La frontera se abrió lo mínimo por otro caso (`DEC-DATA-006`): la» |
| 21 | `DEC-DATA-002` | línea 3459 | `D/01:3525` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C8, C9, N7): El hecho del fin de servicio de una vertical sale de la lista» |
| 22 | `DEC-ENT-002` | línea 610 | `D/01:633` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C4, sobre la implicación 2): Cerrada (revisión del owner, C4): la cuota» |
| 23 | `DEC-ENT-001` | línea 577 | `D/01:604` «Precisada el 2026-09-28, con OK del owner (revisión del owner, `L2-f1`): La cuota de trial también se renueva cada mes, desde el día en que» |
| 24 | `DEC-TRIAL-003` | línea 363 | `D/01:392` «Precisada el 2026-09-28, con OK del owner (revisión del owner, N7, N1): Encender o apagar la prueba de una vertical queda fuera de esta» |
| 24 | `DEC-TRIAL-006` | línea 513 | `D/01:543` «Precisada el 2026-09-28, con OK del owner (revisión del owner, N7, N1): Encender o apagar la prueba de una vertical queda fuera de esta» |
| 25 | `DEC-TRIAL-004` | línea 437 | `D/01:480` «Precisada el 2026-09-28, con OK del owner (revisión del owner, N7, `g2`, sobre la implicación 2): Teléfono, identificador fiscal y» |
| 26 | `DEC-DATA-005` | línea 5738 | `D/01:5780` «Precisada el 2026-09-28, con OK del owner (revisión del owner, N7, `g1`): La baja de cuenta pedida por el usuario queda fuera de esta» |
| 27 | `DEC-AUTH-003` | línea 6305 | `D/01:6320` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C7): "Entrar como" el cliente se agrega en una versión posterior, con la» |
| 28 | `DEC-ARCH-004` | línea 2172 | `D/01:2261` «Precisada el 2026-09-28, con OK del owner (revisión del owner, N2, sobre la definición 2 y la implicación 5): `qzpay` no se absorbe: se» |
| 29 | `DEC-SUB-007` | línea 1160 | `D/01:1228` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C15): La migración de un plan retirado (`DEC-SUB-023`) es un tercer camino» |
| 29 | `DEC-SUB-008` | línea 1234 | `D/01:1285` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C15): La migración de un plan retirado (`DEC-SUB-023`) es un tercer camino» |
| 30 | `DEC-MP-002` | línea 1350 | `D/01:1430` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C15, C9): La migración de un plan retirado usa la regla de esta decisión» |
| 31 | `DEC-MP-008` | línea 5566 | `D/01:5619` «Precisada el 2026-09-28, con OK del owner (revisión del owner, N8): Pendiente de medición (revisión del owner, N8): una pausa o una» |
| 31 | `DEC-SUB-009` | línea 1291 | `D/01:1343` «Precisada el 2026-09-28, con OK del owner (revisión del owner, N8): Pendiente de medición (revisión del owner, N8): una pausa o una» |
| 32 | `DEC-DATA-001` | línea 919 | `D/01:950` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C9, C11): El día 90 y el día 180 son los valores iniciales de los plazos 1 y» |
| 33 | `DEC-TRIAL-007` | línea 550 | `D/01:572` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C9): Los N meses son el plazo 3 de `NUCLEO/02` §1.5, validado contra el» |
| 34 | `DEC-SUB-016` | línea 4776 | `D/01:4809` «Precisada el 2026-09-28, con OK del owner (revisión del owner, C9): Las 72 horas con tarjeta y los siete días con pago manual son el valor» |
| 35 | `DEC-SUB-002` | línea 695 | `D/01:716` «Precisada el 2026-09-28, con OK del owner (revisión del owner, N1): La gracia sigue colgando de la versión de plan; al publicar una versión» |
| 36 | `DEC-TEST-001` | línea 4215 | `D/01:4366` «Precisada el 2026-09-28, con OK del owner (revisión del owner, N1, C9): `G-R3` y `G-R5-B` dejan de ser guards y pasan a ser validaciones» |

### 4.4 · las notas de caducidad

Una nota al pie de cada registro histórico, con el texto de §4.4, los IDs y la decisión que los
reemplaza; el cuerpo de los registros no se tocó. **Dos agrupamientos de §4.4 no coinciden con el
registro real**, y la nota va donde vive el ID, con la discrepancia dicha en ella: `G2-4` es de la
FASE 9 vuelta 1 (§4.4 lo pone en la vuelta 2) y `F-8CA2-012` es un hallazgo de la FASE 8 completa
resuelto en la FASE 9 completa. `N-B-01` lleva nota en su registro (`22-verificado-C-D.md`) y en el
de `R15`, porque su arreglo era dentro de ella. `B-4` lo cerró la tanda 2 con el texto de N7, no con
una `DEC`.

| `14-` §4.4 | registro | nota |
|---|---|---|
| 37 | `29-fase-8-vuelta-2/24-decisiones-del-owner-verificacion.md:96` | «Enteras, `V2-g`, `V2-h`, `V2-i`, `V2-n`, `V2-s` y `V2-z1`» |
| 38, 39 | `28-fase-9-vuelta-1/10-decisiones-del-owner.md:71` | «`G1-1` y R1, en lo que decían de la cartera: los reemplaza `DEC-MIG-006` (C12)» |
| 39 | `29-fase-8-vuelta-2/10-decisiones-del-owner.md:75` | «`R15`, entera: cae con `DEC-MIG-006` (C12, `L1-b`)» |
| 39 | `29-fase-8-vuelta-2/22-verificado-C-D.md:506` | «`N-B-01`: su arreglo era dentro de `R15`» |
| 39 | `26-fase-9-completa/08-R13-F8CA1001-partner-y-vertical-de-la-ficha.md:471` | «`F-8CA2-012`, en lo que pedía del encendido de Partner» |
| 40 | `25-fase-8-completa/A2-maquinas-carreras-y-huerfanos.md:737` | «`F-8CA2-014`, en la cota de 6 meses literales de `G-R5-B`» |
| 41 | `26-fase-9-completa/05-R9-F8CA2004-reloj-y-publicacion.md:535` | «`K-5`, `B-2` y `B-3`, el espacio entre archivado y borrado» |

### 4.5 · la matriz

`EX-51` a `EX-53` van al final de la tabla de `EX-50`; `WH-6`, debajo de `WH-5` en la de Webhooks.
Las dos reabiertas llevan el estado viejo tachado (como `RN-3`) y un ⚠️ al principio de la
conclusión con la causa; la conclusión medida sigue entera. `EX-42` tacha la pregunta vieja y no
cambia de estado.

| `14-` §4.5 | fila | dónde |
|---|---|---|
| 42 | `EX-51`, `VERIFIED` | `D/06:408` «¿A qué hora cobra el proveedor un registro de cobro con fecha dada?» |
| 43 | `EX-52`, `UNKNOWN` | `D/06:409` «Si el pagador cancela desde su cuenta de Mercado Pago, ¿qué aviso llega» |
| 44 | `EX-53`, `UNKNOWN` | `D/06:410` «¿Puede el pagador pausar desde su cuenta de Mercado Pago?» |
| 45 | `WH-6`, `UNKNOWN` | `D/06:270` «¿Qué entrega el proveedor por el canal IPN y qué por Webhooks» |
| 46 | `WH-5` reabierta | `D/06:269` «Reabierta el 2026-09-28 (revisión del owner, 2026-09-28, N9, `L3-g`): el mecanismo sigue» |
| 47 | `EX-15` reabierta | `D/06:336` «medida con el receptor escuchando sólo el canal Webhooks; el canal IPN queda sin medir hasta `WH-6`» |
| 48 | `EX-42` reformulada | `D/06:399` «¿La llamada del script del corte, directa a la API (`expiration_date_to` = ahora), vence una `Preference` de Checkout Pro» |
| encabezado | recuento | `D/06:17` «Recontado el 2026-09-28 tras la revisión del owner» |
| resumen | `VERIFIED` | `D/06:440` «el 2026-09-28 (revisión del owner) entró `EX-51`» |
| resumen | `PARTIALLY_SUPPORTED` | `D/06:441` «entraron dos el 2026-09-28 (revisión del owner, N9, `L3-g`): `WH-5`» |
| resumen | `UNKNOWN` | `D/06:444` «entraron tres más el 2026-09-28 (revisión del owner): `EX-52`, `EX-53` y `WH-6`» |
| resumen | pie | `D/06:449` «tras la revisión del owner: 55 · 17 · 23 · 16» |

### El `## Resumen` del log

Con el estilo tachado de las cifras anteriores, y una fila nueva al pie para la revisión del owner.

| fila | dónde |
|---|---|
| decisiones | `D/01:6557` «~~126~~ 134» |
| funcionales | `D/01:6559` «~~109~~ ~~111~~ 119» |
| precisadas sin `SUPERSEDED` | `D/01:6560` «~~44~~ ~~47~~ 58» |
| `SUPERSEDED` | `D/01:6562` «~~6~~ 11» |
| apartamientos del PDR | `D/01:6569` «~~8~~ 9 (2026-09-28: suma `DEC-ARCH-012`» |
| la revisión del owner | `D/01:6572` «8 nuevas, 30 📌 y 5 `SUPERSEDED`» |

## 2. Las cifras, recontadas

Todas coinciden con `14-` §4.6; ninguna se forzó.

| qué | cifra | comando (desde `$D`) |
|---|---|---|
| decisiones | **134** (119 funcionales, 15 `DEC-METH-*`) | `rg -o "^### DEC-[A-Z]+-\d+" 01-decision-log.md \| sort -u \| wc -l`; `rg -c "^### DEC-"` da 135 con la plantilla |
| precisadas sin `SUPERSEDED` | **58** | `python3 …/scratchpad/verif-v2/contar-precisadas.py 01-decision-log.md` |
| `SUPERSEDED` en su *Estado* | **11** | `rg -c "\*\*Estado\*\*.*SUPERSEDED" 01-decision-log.md` |
| 📌 de esta revisión | **30** | `rg -c "📌 \*\*Precisada el 2026-09-28, con OK del owner \(revisión del owner" 01-decision-log.md` |
| apartamientos del PDR | **9** | a mano: los ocho de antes más `DEC-ARCH-012` |
| filas de la matriz | **111**: 55 · 17 · 23 · 16 | `python3 contar-filas-de-la-matriz.py` |

Las `UNKNOWN`, según el script: `PA-6`, `GR-2`, `WH-6`, `RC-8`, `RF-3`, `EX-42` a `EX-50`, `EX-52` y
`EX-53`, las mismas que lista §4.6.

## 3. Espejos de las cifras en el texto vivo

Buscados por número y por palabra (*126 decisiones*, *107 filas*, *13 `UNKNOWN`*, *trece*, *94
cerradas*, *47 precisadas*) en las `spec.md` y `descomposicion.md` de las tres specs, en `nucleo/` y
en los capítulos. **Precisadas** no tiene espejo fuera del log. `HOS-1353` no tiene ninguno. No se
tocaron `03-handoff.md` (lo hace el owner), el worklog ni los registros históricos.

| espejo | dónde |
|---|---|
| decisiones en la tabla de documentos | `.specs/HOS-1352-billing-verticals-redesign/spec.md:80` «~~126 decisiones~~ 134 decisiones» |
| la matriz en la tabla de documentos | `.specs/HOS-1352-billing-verticals-redesign/spec.md:85` «~~107~~ 111 filas, ~~92~~ ~~93~~ ~~94~~ 95 cerradas» |
| la FASE 1C en la tabla de fases | `.specs/HOS-1352-billing-verticals-redesign/spec.md:137` «~~13~~ 16 `UNKNOWN`» |
| un *106 decisiones* del 24/09 que había quedado vivo | `.specs/HOS-1352-billing-verticals-redesign/spec.md:149` «134 decisiones, 15 de» |
| las fuentes admitidas, y la lista de `SUPERSEDED` que no son fuente | `nucleo/00:44` «~~126 al 2026-09-26~~ 134 al 2026-09-28» |
| el recuento de la matriz de billing | `$B/spec.md:247` «~~107~~ 111 filas» |
| el capítulo del proveedor | `B/06:27` «~~107~~ 111 filas, ~~92~~ ~~94~~ 95 medidas» |
| lo que sigue `UNKNOWN` | `B/06:408` «Doce de las dieciséis filas de 111» |
| dónde caen las `UNKNOWN` | `$B/descomposicion.md:405` «~~107~~ 111 filas de la matriz» |

**La lista de `SUPERSEDED` de `nucleo/00-indice.md`** (*Las SUPERSEDED no cuentan como fuente*) no
es una cifra pero es un espejo del mismo registro, el lugar donde un implementador busca qué
decisiones valen: se le sumaron las cuatro enteras y `DEC-DATA-002` en parte.

## 4. Lo que queda afuera

1. **Las tres `UNKNOWN` nuevas no tienen fila en las tablas por unidad** de `B/06` §11 y
   `$B/descomposicion.md` §2.7: asignarles unidad es diseño, no un recuento. Las dos lo dicen junto
   a la cifra. Recomiendo resolverlo con los casos vecinos.
2. **`## Qué espera cada decisión` de la matriz** no nombra `EX-52`, `EX-53` ni `WH-6`; `DEC-MP-008`
   y `DEC-SUB-009` dependen de las dos primeras (sus 📌 lo dicen). No es una cifra y no lo toqué.
3. **Los cincuenta casos vecinos de `14-` §3** siguen para la sesión siguiente, como dice `10-`.

## Key Learnings

1. Un lote que agrupa IDs por fase puede ubicarlos mal: `G2-4` y `F-8CA2-012` no viven donde §4.4
   los pone. La nota al pie va donde el grep encuentra el ID, no donde lo pone el agrupamiento.
2. Un reemplazo anclado en `## Resumen` sin el salto de línea encontró antes una mención entre
   backticks en el cuerpo del log y metió siete entradas en el medio de otra; hay que anclar en
   `\n## Resumen\n` y recontar después de escribir.
3. Un espejo viejo que ya estaba desactualizado antes de esta tanda (*106 decisiones*, del 24/09) no
   aparece buscando la cifra de hoy: aparece buscando la palabra *decisiones* junto a cualquier
   número.
