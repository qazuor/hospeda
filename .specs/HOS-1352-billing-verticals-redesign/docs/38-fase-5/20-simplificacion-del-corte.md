# FASE 5 — simplificación del corte a la luz de `DEC-MIG-007`

> Programa HOS-1352. Es el lote propio anunciado en el lote 3 de
> [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md): un barrido del diseño del corte y de
> la migración contra las premisas del owner (`DEC-MIG-007`, `01-decision-log.md:6680`) y contra la
> J del lote 1 de la FASE 5 (las fichas de las cuentas que no son las cinco se borran en el corte).
> Sólo diseño: no edita ningún otro documento. Lo aprobado se aplica en una pasada aparte.

## 0. Cómo leer este documento

**Las cinco premisas que se aplican**, con la etiqueta que usa cada fila:

| etiqueta | premisa | fuente |
|---|---|---|
| `P1` | no conviven la versión vieja y la nueva | `DEC-MIG-007` punto 1 |
| `P2` | un usuario que entre durante el corte no se diseña (o se bloquea todo antes) | `DEC-MIG-007` punto 2 |
| `P3` | sólo importan cinco cuentas (tres en prueba o pagando, dos de cortesía), con una ficha cada una; el resto no importa | `DEC-MIG-007` punto 3 |
| `P4` | a las cinco les avisa el owner por privado; nada programado | `DEC-MIG-007` punto 4 |
| `J` | las fichas de las demás cuentas se borran en el corte; la migración sólo carga las cinco | lote 1, J, de la FASE 5 |

**Lo que este barrido NO toca**, porque la premisa simplifica la migración y no el producto: el
receptor de avisos de Mercado Pago y su lápida de recepción (`B/09` §2.4), los ciclos de cobro de
las cinco cuentas en el sistema nuevo, el catálogo y los plazos que carga el paso 3, los dos grants
de cortesía, el ensayo en `staging`, la foto del paso 6 y todo lo que el sistema nuevo necesita para
funcionar desde el paso 5.

**Tres verbos**, siempre el primero de la última columna:

- **RETIRAR**: la pieza se borra del diseño.
- **SIMPLIFICAR**: la pieza queda, más chica; la celda dice cómo, en una frase.
- **MANTENER**: la premisa no la toca; está acá sólo porque alguien podría creer que sí.

Cuando una propuesta depende de una elección del owner, la celda nombra la letra de la sección 15
(«lote A» a «lote E») y describe la opción recomendada.

Abreviaturas de lugar: `16` = `16-fase-7-del-paraguas.md`; `V/21` y `B/21` = los capítulos de
migración de cada épica; `V/desc` y `B/desc` = las descomposiciones; `log` = `01-decision-log.md`;
`matriz` = `06-mp-validation-matrix.md`. Los números de línea son del worktree del programa al
2026-09-30.

## 1. Clasificación de fichas `L1`–`L8`

| id | qué es y dónde | premisa | propuesta |
|---|---|---|---|
| S-01 | la tabla de traducción `L1`–`L8`, que clasifica toda ficha preexistente por las columnas viejas (`V/21` §2.4, l.201-248; `16` §4.2 paso 3, l.137; `V/desc` l.59 y l.478; `spec` de V l.427-432) | `J`, `P3` | **RETIRAR**: la migración carga una lista cerrada de cinco fichas con su estado de nacimiento (lote A); ninguna otra se clasifica |
| S-02 | el estado de nacimiento de *toda* ficha preexistente, escrito por la migración (`16` l.137 y l.215-217) | `J` | **SIMPLIFICAR**: las cinco de la lista nacen `PUBLISHED` (o lo que diga la lista), y la misma migración borra las filas de todas las demás, que el backup del 2b restaura si hay aborto |
| S-03 | las altas que el sistema viejo sigue tomando hasta el corte (`DEC-MIG-002`; `B/21` §3.3, l.395-418) | `J` contra `DEC-MIG-002` | **SIMPLIFICAR** (lote A): **contradicción** — con la J, la ficha de quien se suscriba en el viejo después de hoy se borra en el corte; la lista de las cinco la fija el owner y él suma a quien quiera conservar |
| S-04 | `L1` nace `PURGED` y el paso 5b le borra el contenido en la base, las fotos y el token de calendario (`16` l.144; `V/21` l.235 y l.261-271) | `J` | **SIMPLIFICAR**: el 5b pasa a borrar las fotos y el token de calendario de toda ficha que no es de las cinco; la base ya la borró la migración (S-02). Queda después del paso 5, por la misma razón: lo externo no lo restaura ningún backup |
| S-05 | «una ficha borrada por un admin y no por su dueño pierde su contenido» («NO cierra» de `V/21`, l.637-642) | `J` | **RETIRAR**: la J borra todas las que no son de las cinco, sin distinguir quién |
| S-06 | `REJECTED` no se traduce y se lista para que el admin la modere (`V/21` l.252-257; `B/21` l.82-84) | `J`, `P3` | **RETIRAR** |
| S-07 | el recuento de fichas de Gastronomía y Experiencia, tres veces (antes del 1a, en el paso 2 y en el paso 3), que detiene el corte o dispara la rama de aborto (`16` l.133, l.135, l.137 y l.393; `V/21` l.205-217; `B/21` l.73-79; 📌 del 27/09 de `DEC-MIG-003`; `V/desc` l.418) | `J`, `P3` | **RETIRAR**: la tabla que hacía falta proteger ya no existe; cualquier ficha de esas verticales que no sea de las cinco se borra |
| S-08 | el dueño con más de una ficha a la vista: recuento en el paso 0 y en el paso 3, y su «no se diseña» (`16` l.131 y l.137; `V/21` l.195-199, l.418-419 y l.624-629; `DEC-MIG-006` y su 📌) | `P3` | **RETIRAR**: una ficha por cuenta es premisa |
| S-09 | `owner_suspended`, `plan_restricted` y `billing_unpublished_at` sobreviven a `U1` «porque la tabla las lee para `L5` y `L7`», y se borran «después de la clasificación» (`16` §4.6 l.611-620 y l.137; `V/21` l.219-231; `B/21` l.447-457) | `J` | **SIMPLIFICAR**: siguen vivas hasta `V6` por la B del lote 3 (sus lectores fuera del cobro), no por la tabla; sale la razón `L5`/`L7` y la condición de orden. No reabre la B |
| S-10 | el texto de R1 sobre cómo vuelve la cartera (`PB3`, `PB7`, *«cuáles vuelven»* por `created_at`, la llamada que tarda) y la regla `R15` (`V/21` l.273-304, l.346-369 y l.613-623) | `P3`, `P4` | **RETIRAR**: ya estaba superado por C12 y ahora tampoco tiene población |
| S-11 | «en una vertical sin trial, el dueño del corte no tiene trial» («NO cierra» de `V/21`, l.630-636) | `P3` | **RETIRAR**: las cinco son de Alojamiento (`DEC-MIG-001`, `G1-3`) |
| S-12 | la prueba activa a cada `(dueño, vertical)` con una `L8` (`V/21` l.390-433; `DEC-MIG-006`) | `P3` | **SIMPLIFICAR**: a las cinco cuentas de la lista; la escribe el script del corte con la función de la aplicación (lote 2 D) |
| S-13 | las dos cuentas de cortesía reciben prueba y grant, y `T2` convierte en el acto (`DEC-MIG-006`; `V/21` l.161-165; `16` l.139) | — | **MANTENER**: está decidido y es inofensivo; sacarles la prueba no ahorra nada |
| S-14 | la escritura `C`: `inactiva_desde` = instante del corte (`V/21` l.306-329; `G-R6-B`) | — | **MANTENER**: la columna no admite nulo; pasan a ser cinco filas |

## 2. Restauraciones, rama de aborto y los lotes J y AH de la FASE 9 vuelta 3

| id | qué es y dónde | premisa | propuesta |
|---|---|---|---|
| S-15 | la rama de aborto reactiva los planes del 1a, levanta el cierre del 0b, deja que los clientes se re-suscriban por el link y acepta que paguen sin trial (`16` l.398-404 y l.438-446; `DEC-MIG-005` punto 2) | `P1`, `P4` | **SIMPLIFICAR** (lote D): abortar es restaurar el backup y redesplegar la imagen vieja, sin reabrir la venta; las cinco esperan el reintento |
| S-16 | la mitad del paso 0 en producción: cancelar, reactivar y abrir en el navegador un plan propio, *«porque la rama de aborto reactiva planes»* (`16` l.131) | `P4` | **RETIRAR** si se elige D1: pierde su única razón |
| S-17 | situación 2 del §4.3: un aborto borra los pagos que el receptor nuevo ya asentó (`16` l.504-511, lote J) | `P3` | **RETIRAR**: su población son las tres cuentas conocidas |
| S-18 | situación 4 del §4.3: un aborto borra lo que el viejo asentó después del backup, cobros y cuentas nuevas (`16` l.519-528, lote AH) | `P2`, `P3` | **RETIRAR**: con el bloqueo del lote B no entran cuentas ni fichas, y el cobro en vuelo es de una de las tres |
| S-19 | situación 1 del §4.3: restaurar el backup del paso 6 deja preapprovals vivos sin fila (`16` l.496-503) | — | **MANTENER**: son clientes nuevos que contratan después del paso 5, no la migración |
| S-20 | situación 3 del §4.3: después de un aborto `main` sigue con el sistema nuevo (`16` l.512-518) | — | **MANTENER**: es de ramas y despliegue, no de población |
| S-21 | «estas cuatro se releen antes del ensayo» (`16` l.530-534) | — | **SIMPLIFICAR**: se releen las dos que quedan |
| S-22 | backup del 2b, restaurarlo, redesplegar la imagen vieja y reencender su webhook y sus crons (`16` l.136 y l.405-437) | — | **MANTENER**: es lo que hace reversible el paso 3 |
| S-23 | los inversos de la rama sobre lo que el corte tocó afuera: (b) la sonda del 4b y (c) el pago chico (`16` l.423-425) | — | **MANTENER**: el 4b sigue (S-49) |
| S-24 | el inverso (a) de la rama: cerrar y abrir la ruta de avisos en el borde (`16` l.417-423) | `P3` | **RETIRAR** si se elige C1, con el Worker (S-45) |

## 3. Recuentos, gates del paso 0 y el bloqueo del corte

| id | qué es y dónde | premisa | propuesta |
|---|---|---|---|
| S-25 | el 0b: una regla del borde por criterio (todo canal que cree o re-autorice un preapproval, una `Preference` o un pago), verificada con una petición a cada ruta (`16` l.132; 📌 de `DEC-MIG-002`) | `P2` | **SIMPLIFICAR** (lote B): una sola regla que rechaza toda escritura, salvo la ruta de avisos, desde el 0b hasta el paso 5 |
| S-26 | el paso 3 despliega el sistema nuevo con sus rutas de alta cerradas hasta el paso 5 (`16` l.137, última celda, y l.143) | `P2` | **SIMPLIFICAR** (lote B): es la misma regla de S-25, sin lista propia |
| S-27 | los recuentos repetidos en el paso 3 con el viejo apagado, *«porque el viejo acepta cuentas y fichas hasta que se apaga»* (`16` l.137; lote T de la FASE 9 vuelta 3) | `P2`, `J` | **RETIRAR**: lo que medían ya no existe (S-07, S-08, S-36), y con el bloqueo nadie crea nada |
| S-28 | el recuento del paso 0 que decide si el 4c corre: *«si el viejo servía alguna ficha que nace `PURGED` o en `DRAFT`; si da cero, el 4c se saltea»* (`16` l.131 y l.142; `V/21` l.190-193; `V/desc` l.603) | `J` | **SIMPLIFICAR**: **contradicción** — la J borra fichas que el viejo mostraba (la población a avisar tenía doce alojamientos, `V/21` l.513), así que el 4c siempre tiene sujeto. Corre siempre, sobre las fichas borradas que el viejo servía, las tres colecciones y los 22 destinos; sale el recuento |
| S-29 | la re-verificación de `B/21` §1.3: suscripciones soft-deleted, compras de addon, canjes, grants de destaque, `entity_subscriptions` y fichas por dueño, *«para saber a quién hay que llamar»* (`B/21` l.66-84) | `P3`, `P4` | **RETIRAR** |
| S-30 | «la medición caduca y se re-verifica antes de la FASE 10» (`B/21` l.60-64 y l.125-128) | `P3` | **RETIRAR**: el tamaño de la cartera ya no decide nada |
| S-31 | el gate de completitud del paso 2: el recorrido iguala el `total` y contiene todo id conocido (`16` l.135; 📌 del 25/09 de `DEC-MIG-003`, punto 1) | — | **MANTENER**: protege plata (que ningún débito viejo quede vivo) y no depende de la población |
| S-32 | 1a y 1b: cancelar los planes viejos y todo preapproval vivo que da el recorrido del proveedor, y releerlos (`16` l.133-135) | — | **MANTENER**: sin esto el viejo le sigue cobrando a Juan después del corte; es que el sistema viejo deje de cobrar, no migración |
| S-33 | el tope de purgas del borde, verificado en el paso 0 (`16` l.131, `V2-z3`) | — | **MANTENER**: el 4c sigue purgando 22 destinos |
| S-34 | el ensayo en `staging` y la verificación del journal contra la tabla de migraciones aplicadas (`16` l.131 y l.137) | — | **MANTENER** |

## 4. Seudónimo y lista de proveedores

| id | qué es y dónde | premisa | propuesta |
|---|---|---|---|
| S-35 | la lista de proveedores del seudónimo, medida (`EX-49`) y cerrada antes del despliegue (`16` l.131; `V/21` l.424-426; `DEC-MIG-006`) | — | **MANTENER**: la usa la primera prueba de cualquier cliente nuevo desde el paso 5, y el seudónimo no se recalcula |
| S-36 | el recuento de cuentas de la cartera que comparten seudónimo en la misma vertical, como gate antes del 1a, en el paso 2 y en el paso 3 (`16` l.135 y l.137; `V/21` l.427-429; `DEC-MIG-006`) | `P3` | **RETIRAR**: son cinco filas, que el script escribe y se verifican a mano (lote 2 D) |

## 5. Detector del titular, manifiesto, pasada del proveedor, lápidas y ventana del corte

| id | qué es y dónde | premisa | propuesta |
|---|---|---|---|
| S-37 | la pasada de sólo lectura sobre el proveedor antes del aviso, que suma a la población a los titulares que la base no conoce (`R21-b`; `16` l.248-258; `B/21` l.96-105; 📌 del 27/09 de `DEC-MIG-005`) | `P3`, `P4` | **RETIRAR** |
| S-38 | el titular que sólo conoce el proveedor: su detector condicionado a `EX-59` y su declaración (`16` §4.3 l.536-543; `B/21` l.86-93 y l.525-541; 📌 del 30/09 de `DEC-MIG-005`) | `P3` | **RETIRAR**: el lote 3 ya descartó `R5-22` por la misma premisa |
| S-39 | el manifiesto del 1b con el pagador de cada id, fuera del repositorio y guardado hasta el día siguiente a la segunda corrida del detector (`16` l.318-325) | `P3`, `P4` | **SIMPLIFICAR**: ids cancelados y releídos, sin datos de personas; se borra al terminar el corte (si C1; con C3 queda como está) |
| S-40 | la lápida del corte: el paso 4, la herramienta de `B11`, los dos choques del `UNIQUE` y `origen_de_lápida = CORTE` (`16` l.140; `B/21` l.184-294; `B/desc` l.137 y l.851) | `P3` | **RETIRAR** (lote C): un cobro tardío de un débito viejo entra por la lápida de recepción, como cualquier desconocido |
| S-41 | la ventana del corte: un cobro del día del corte sobre la lápida se asienta sin marca y uno posterior abre `PAGO_TARDÍO_RECHAZADO` (`G3-1`, `R2`; `B/21` l.295-339) | `P3` | **RETIRAR** (lote C) |
| S-42 | el detector posterior al corte: dos corridas, la lista de cobros del día sin `payment` y la issue con fecha (`16` l.342-353; `B/21` l.542-585; 📌 del 29/09 de `DEC-MIG-005`) | `P3`, `P4` | **RETIRAR** (lote C) |
| S-43 | vencer por API las `Preference` del cambio de plan del viejo en el 1a, con su relectura (`16` l.133 y l.132; `Y-1`) | `P3` | **RETIRAR** (lote C): quien tenga una abierta es una de las cinco, a quien el owner le pide no pagar nada en el viejo |
| S-44 | el pago de una `Preference` del viejo que se acredita días después (efectivo) y *«no cae en ningún lugar»* (`16` §4.3 l.470-486) | `P3` | **RETIRAR** la parte del corte; el «NO cierra» de `B/09` sobre el pago de única vez es producto y queda |
| S-45 | el Worker del borde que cierra la ruta de avisos con `500` y cabecera propia, del paso 3 al 4, ensayado en el paso 0 con la duración del cierre (`16` l.137, l.140 y l.361-371; 📌 del 29/09, P-A, de `DEC-MIG-003`) | `P3` | **RETIRAR** (lote C): existía para que ningún aviso llegara antes de las lápidas; sin ellas, un aviso de un débito viejo es un desconocido más |
| S-46 | la lápida de recepción y la marca `PAGO_TARDÍO_RECHAZADO` con la propuesta de devolver (`B/09` §2.4; `G3-2`) | — | **MANTENER**: es producto, y es lo que recoge un cobro tardío de Juan si se elige C1 |
| S-47 | el manifiesto de sondas vivas, importado como módulo del package del cobro (`16` l.147-170) | — | **MANTENER**: es del handler, no de la población |
| S-48 | el 4b: la sonda de Webhooks y el pago chico con la tarjeta del owner (`16` l.141) | — | **MANTENER**: verifica que el receptor nuevo recibe en producción |
| S-49 | la regla de re-vinculación de un desconocido por su `external_reference` (`B/21` l.234-254; `DEC-CONC-002`) | — | **MANTENER**: producto |

## 6. Comunicaciones

| id | qué es y dónde | premisa | propuesta |
|---|---|---|---|
| S-50 | el guion del aviso, cinco puntos (`16` l.265-289) | `P4` | **RETIRAR**: qué les dice el owner es suyo |
| S-51 | la lista de a quién avisar que arma el script, y la población a avisar de `B/21` §1.3 (`16` l.241-245 y l.329-332; `B/21` l.80-82) | `P4` | **RETIRAR**: son las cinco de la lista |
| S-52 | *«el aviso va antes del paso 1»* y el riesgo de que la prueba corra sin que el dueño lo sepa (`16` l.235-237; `V/21` l.431-433) | `P4` | **SIMPLIFICAR**: una línea — el owner elige cuándo avisa |
| S-53 | *«no queda constancia de que se avisó»*, declarado dos veces (`16` l.296-301; `B/21` l.519-523) | `P4` | **RETIRAR**: lo cubre `DEC-MIG-007` |
| S-54 | el correo de baja que el viejo manda al recibir cada cancelación del 1b (`16` l.303-309) | — | **MANTENER**: lo manda el código viejo a las tres que tienen débito; no se programa nada nuevo |
| S-55 | la campaña previa al vencimiento de la prueba de las cinco (`V/21` l.400-401, §10.7) | — | **MANTENER**: es el aviso de toda prueba, no uno del corte; `P4` habla de comunicar el corte |
| S-56 | el umbral de unas veinte personas y su condición de caducidad (`V/21` §2.5, l.509-519; ⚠️ de `DEC-MIG-003`; `B/21` l.408 y l.418) | `P3` | **RETIRAR** |

## 7. Mediciones de la matriz que sólo sirven al corte

| id | qué es y dónde | premisa | propuesta |
|---|---|---|---|
| S-57 | `EX-48`: qué campo del pago trae el instante de su aprobación; condición del 1b (matriz l.405) | `P3` | **RETIRAR** si C1: pasa a «no se mide, por decisión»; su único sujeto es la ventana (S-41) |
| S-58 | `EX-50`: cuántas anuales vivas hay en el viejo (matriz l.407) | `P3` | **RETIRAR**: pasa a «no se mide, por decisión»; además el owner ya dio el hecho (cero) |
| S-59 | `EX-42`: si la llamada del script vence una `Preference` (matriz l.399) | `P3` | **RETIRAR** si C1: pasa a «no se mide, por decisión» |
| S-60 | `EX-44` y `EX-45`: si cancelar corta el reciclado y si una cancelación sigue `cancelled` horas después, «en el paso 0» (matriz l.401-402) | `P3` | **SIMPLIFICAR**: pierden el sujeto del corte y quedan por su uso de producto (exención del barrido, `S16`, `B/09` §3); se miden en sandbox antes de `B11`, fuera del paso 0 |
| S-61 | `EX-47`: si un registro de cobro cobra el monto viejo o el nuevo, «en el paso 0» (matriz l.404) | — | **SIMPLIFICAR**: igual que S-60; es de producto (`B/09` §3) y se mide antes de `B11` |
| S-62 | `EX-59`: si otra lectura trae el pagador (matriz l.416, ya `PARTIALLY_SUPPORTED`) | `P3` | **RETIRAR** su sujeto: la fila queda como está, con una nota de que el detector que la usaba salió |
| S-63 | el 🚧 de `EX-40`: que el link de un plan reactivado vuelva a vender (matriz l.397) | `P4` | **RETIRAR** si D1: nadie reactiva planes |
| S-64 | `EX-49`: la lista de proveedores del seudónimo (matriz l.406) | — | **MANTENER**: ver S-35 |
| S-65 | `EX-46`: a qué URL va un reintento (matriz l.403) | — | **MANTENER**: ya estaba sin sujeto y «no se mide» desde el lote O-B |

## 8. Guards, unidades y herramientas

| id | qué es y dónde | premisa | propuesta |
|---|---|---|---|
| S-66 | `B11`: la lápida del corte, la ventana y el detector, con sus criterios (`B/desc` l.137, l.442-446, l.696 y l.851; `spec` de B l.269-278) | `P3` | **SIMPLIFICAR**: la unidad sigue (conciliación es producto); salen esas piezas y sus criterios si C1 |
| S-67 | `V6`: la tabla `L1`–`L8`, los recuentos, el 4c condicional, el 5b sobre `L1` y los criterios *«sobre una base con `L1`-`L8`»* (`V/desc` l.59, l.410, l.418, l.478 y l.603) | `J`, `P3` | **SIMPLIFICAR**: `V6` carga cinco fichas, borra el resto, corre el 4c siempre y el 5b sobre lo borrado |
| S-68 | `B9`: los dos `permanent_grant` del paso 3b (`B/desc` fila B9) | — | **MANTENER** |
| S-69 | el script del corte en `scripts/cutover/` (`16` l.311-341) | `P3`, `P4` | **SIMPLIFICAR**: queda censo, cancelación, relectura y completitud; sale la pasada, la lista de a quién avisar, el vencimiento de `Preference` y el pagador del manifiesto |
| S-70 | las menciones a la lápida del corte en capítulos de producto: `B/02` (7), `B/05` (5), `B/09` (2), `B/06` (2), `B/16` (1) | `P3` | **SIMPLIFICAR** si C1: limpieza de texto; `origen_de_lápida` queda con un solo valor y puede salir la columna |
| S-71 | los guards (`G8`, `G16`, `G-R6-B`, los que enumeran escritores de `trial`) | — | **MANTENER**: ninguno existe sólo para el corte; `G-R6-B` admite la escritura `C`, que sigue (S-14) |

## 9. Plazos que sólo aplican a cuentas migradas

| id | qué es y dónde | premisa | propuesta |
|---|---|---|---|
| S-72 | los 30 minutos entre el 0b verificado y el 1a, la vida de la `Preference` de addon del viejo (`16` l.132) | `P2`, `P3` | **RETIRAR** (lote B o C) |
| S-73 | la primera corrida del detector, el día siguiente al corte (`16` l.344-345) | `P3` | **RETIRAR** (lote C) |
| S-74 | la segunda corrida: el día siguiente al último `expire_date`, un alta con su creación más un ciclo, hasta un año sobre una anual, con su issue fechada (`16` l.344-352; `B/21` l.107-123) | `P3` | **RETIRAR** (lote C) |
| S-75 | la retención del manifiesto hasta el día siguiente a la segunda corrida (`16` l.322-325) | `P3`, `P4` | **RETIRAR** (lote C) |
| S-76 | la ventana *«el día del corte, en hora de Argentina»* (`B/21` l.306-308) | `P3` | **RETIRAR** (lote C) |
| S-77 | el límite de hecho del día 180 de la agenda de llamados (`V/21` l.331-344 y l.602-607; 📌 4 de `DEC-MIG-004`) | `P3`, `J` | **RETIRAR**: no hay agenda de llamados; las fichas sin dueño de las cinco se borran el día del corte |
| S-78 | los plazos sin valor que el owner fija antes del merge de `V6` (lote 3 D) | — | **MANTENER**: son del producto |

## 10. El corte que queda, si se eligen las recomendadas

1. **Paso 0**: el ensayo entero en `staging`, la medición de la lista de proveedores del seudónimo
   y el tope de purgas del borde. Nada en producción.
2. **0b**: una regla del borde rechaza toda escritura, salvo la ruta de avisos, hasta el paso 5.
3. **1a y 1b**: el script cancela los planes viejos y todo preapproval vivo del recorrido del
   proveedor.
4. **Paso 2**: relectura por id y completitud del recorrido.
5. **2b**: backup.
6. **Paso 3**: apagar el viejo, `hops db-migrate --pull` sobre el mismo commit (catálogo, plazos,
   las cinco fichas `PUBLISHED`, el borrado de las demás, la escritura `C`), levantar la imagen con
   los crons apagados, verificar el journal. Después el script escribe las cinco pruebas con sus
   seudónimos (lote 2 D).
7. **3a y 3b**: verificar el catálogo y escribir los dos grants.
8. **4b**: sonda de Webhooks y pago chico.
9. **4c**: revalidar las páginas de las fichas borradas, las colecciones y los 22 destinos.
10. **Paso 5**: levantar la regla y prender los crons.
11. **5b**: borrar fotos y tokens de calendario de las fichas borradas.
12. **Paso 6**: la foto de la base.

Desaparecen el paso 4 (lápidas), el Worker, el detector y su segunda corrida con fecha.

## 11. Decisiones del log que cambian si el owner aprueba

| decisión | qué le pasa | por qué |
|---|---|---|
| `DEC-MIG-002` (l.2624) | **precisada** con A1 (lo que entre hasta el corte no se conserva salvo que el owner lo sume a la lista), o **SUPERSEDED** con A2 (se cierran las altas del viejo); su 📌 `G4-1` queda precisado por el lote B | S-03, S-25 |
| `DEC-MIG-003` (l.2907) | **precisada**: siguen *no se migra*, el orden, el backup, *sólo hacia adelante* y la completitud; salen la precisión del 2026-09-20 (*«la única que se escribe es una lápida»*) y el 📌 del 29/09 P-A (Worker) con C1, el recuento de Gastronomía y Experiencia del 📌 del 27/09, y la ⚠️ condición de caducidad | S-07, S-40, S-45, S-56 |
| `DEC-MIG-004` (l.3263) | **SUPERSEDED por `DEC-MIG-007`**: su mecanismo humano es la premisa 4; los defectos #15 y #16, el umbral de veinte y el 📌 4 (día 180) quedan sin sujeto | S-56, S-77 |
| `DEC-MIG-005` (l.6210) | **precisada**: siguen los puntos 1 y 3 y el hecho del lote F; quedan **SUPERSEDED** sus 📌 del 27/09 (`R2`, `R21`, `R21-b`), el de `V2-a`/`V2-m`/`V2-r`, el del 29/09 y el del 30/09 (lote G); el punto 2 queda sin sujeto con D1 | S-37, S-38, S-41, S-42, S-15 |
| `DEC-MIG-006` (l.6648) | **precisada**: *«las fichas `L8`»* pasa a *«las cinco de la lista»*; sale el gate de seudónimos compartidos (queda el de la lista medida) y su 📌 del 29/09 con los dos recuentos | S-12, S-36, S-08, S-28 |
| `DEC-CONC-002` | **precisada** con C1: su tercer 📌 cuenta dos lápidas; queda una, la de recepción | S-40 |
| `DEC-ARCH-014` | **precisada** con C1: su 📌 del lote P pierde el Worker y el detector; el package del contrato que crea `U1` sigue | S-42, S-45 |
| `DEC-MIG-001`, `DEC-MIG-007`, `DEC-MP-009`, `DEC-TRIAL-004`, `DEC-DATA-008` | sin cambio | — |

Por la implicación 2 de `DEC-MIG-007`, ninguna se marca sola: cada cambio de estado de esta tabla
entra con el OK del lote E.

## 12. Filas de la matriz

| fila | hoy | después |
|---|---|---|
| `EX-48` | `UNKNOWN`, espera medición en el paso 0; condición del 1b | `UNKNOWN`, **no se mide, por decisión** (C1) |
| `EX-50` | `UNKNOWN`, espera el conteo en el paso 0 | `UNKNOWN`, **no se mide, por decisión** |
| `EX-42` | `UNKNOWN`, espera medición en el paso 0; condición del 1a | `UNKNOWN`, **no se mide, por decisión** (C1) |
| `EX-44`, `EX-45`, `EX-47` | `UNKNOWN`, esperan medición en el paso 0 | `UNKNOWN`, **siguen esperando**, en sandbox antes de `B11` |
| `EX-49` | `UNKNOWN`, espera medición en el paso 0 | sin cambio |
| `EX-59` | `PARTIALLY_SUPPORTED` | sin cambio de estado; nota de sujeto retirado |
| `EX-40` | `VERIFIED`, con un 🚧 que se verifica en el paso 0 | sin cambio de estado; el 🚧 sale con D1 |

Al aplicarlo, las tres filas nuevas «no se miden» llevan la marca que el script reconoce
(`🚫 **No se mide, por decisión`), para que el conteo las vea.

## 13. Conteos

Contados con script: la matriz con `contar-filas-de-la-matriz.py` (117 filas: 63 · 16 · 24 · 14);
las filas de este documento y los gates con un recuento sobre las tablas de arriba y de §4.2.

| qué | hoy | con las recomendadas |
|---|---|---|
| unidades del programa | 24 | 24 (ninguna existe sólo para el corte) |
| guards | 33 | 33 (ninguno existe sólo para el corte) |
| plazos que sólo aplican a cuentas migradas | 6 (S-72 a S-77) | 0 |
| filas `UNKNOWN` de la matriz | 14 | 14 (ningún estado cambia) |
| de ellas, esperan medición | 12 | 9 |
| filas «no se miden, por decisión» | 6 | 9 |
| filas de la matriz que se miden en el paso 0 | 7 | 1 (`EX-49`) |
| cosas que hace el paso 0 | 12 | 3 |
| gates que detienen el corte | 19 | 8 |
| herramientas del corte (`16` l.311-374) | 6 | 5 (sale la de lápidas y detector) |

**Los 19 gates de hoy**: ensayo en `staging` verde; la mitad en producción; el Worker ensayado;
`EX-42` para el 1a; la lista del seudónimo medida; el recuento de Gastronomía y Experiencia antes
del 1a; el de seudónimos antes del 1a; `EX-48` para el 1b; el 0b verificado; cada id releído
`cancelled`; la completitud; Gastronomía y Experiencia en el paso 2; seudónimos en el paso 2;
Gastronomía y Experiencia en el paso 3; seudónimos en el paso 3; el journal; las validaciones del
3a; las lápidas verificadas antes de abrir la ruta; la entrega del 4b. **Quedan 8**: el ensayo, la
lista del seudónimo, el 0b verificado, la relectura, la completitud, el journal, el 3a y el 4b.

**Las filas de este documento, por verbo**: 78 piezas; **38 RETIRAR, 18 SIMPLIFICAR, 22
MANTENER** (detalle en §14). Los plazos llegan a cero con B1 o C1 para los 30 minutos (S-72) y con
C1 para los otros cinco; con C3 quedan cinco.

## 14. Recuento de piezas

Contado con un script sobre las filas `S-NN` de §1 a §9, tomando el verbo en negrita de la última
celda; las 78 filas son correlativas, sin huecos ni duplicados.

| sección | RETIRAR | SIMPLIFICAR | MANTENER |
|---|---|---|---|
| §1 clasificación de fichas | 7 | 5 | 2 |
| §2 restauraciones y aborto | 4 | 2 | 4 |
| §3 recuentos, gates y bloqueo | 3 | 3 | 4 |
| §4 seudónimo | 1 | 0 | 1 |
| §5 detector, manifiesto, lápidas y ventana | 8 | 1 | 4 |
| §6 comunicaciones | 4 | 1 | 2 |
| §7 mediciones de la matriz | 5 | 2 | 2 |
| §8 guards, unidades y herramientas | 0 | 4 | 2 |
| §9 plazos | 6 | 0 | 1 |
| **total** | **38** | **18** | **22** |

**De las 56 que se retiran o simplifican**, 32 son consecuencia directa de las premisas o de la J
(van al lote E) y 24 dependen de una letra: A, 2 (S-01, S-03); B, 4 (S-18, S-25, S-26, S-72); C,
15 (S-24, S-39 a S-43, S-45, S-57, S-59, S-66, S-70, S-73 a S-76); D, 3 (S-15, S-16, S-63).

## 15. Para el owner — lote de simplificación del corte

> Es lo único de este documento que necesita respuesta. Todo lo demás es consecuencia de tus
> premisas del 30/09 y de la J del lote 1.

### A · Cuáles son las cinco, y qué pasa con quien entre antes del corte

Dijiste que sólo importan cinco cuentas y que las fichas de las demás se borran en el corte. Pero
hoy el sistema viejo sigue tomando altas: si Juan se suscribe el mes que viene y paga, en el corte
su ficha se borraría.

1. **Una lista cerrada que fijás vos antes del corte**: cada cuenta con su única ficha. Si entra
   alguien que querés conservar, lo sumás a la lista; si trae más de una ficha, te vuelve.
   Costo: ninguno de diseño. Riesgo: olvidarte de sumar a alguien, y su ficha se borra.
   **Recomendada**.
2. **Cerrar ya las altas del sistema viejo** hasta el corte. Costo: comercial, nadie nuevo puede
   entrar en ese tiempo. Riesgo: ninguno sobre la lista.
3. **Sacar la lista de la base vieja** con una consulta (quién tiene una suscripción viva o de
   cortesía). Costo: una consulta. Riesgo: puede traer a alguien que no es de las cinco, o con dos
   fichas.

### B · Qué se bloquea durante el corte

Hoy el diseño cierra una lista de rutas del sitio viejo (las que cobran o crean un débito),
espera 30 minutos, y repite los recuentos con el viejo apagado por si Juan creó una ficha en el
medio. Vos dijiste que eso no se diseña, o que se bloquea todo.

1. **Una sola regla que bloquea toda escritura** (todo lo que no sea mirar) en el sitio viejo y en
   el nuevo, desde antes de cancelar nada hasta abrir el sistema nuevo; sólo queda abierta la
   entrada de avisos de Mercado Pago. Juan puede ver su ficha pero no loguearse ni editar esas
   horas. Costo: bajo. Riesgo: bajo. Sale la lista de rutas, la espera de 30 minutos y los
   recuentos repetidos. **Recomendada**.
2. **No se diseña**: se saca el cierre. Costo: cero. Riesgo: alguien que se suscribe en el viejo
   en el medio queda con un débito vivo que nadie canceló, y su ficha se borra.
3. **Como está hoy.** Costo: el que ya tiene.

### C · El rastro de los débitos viejos en Mercado Pago

Para un cobro tardío de un débito viejo de Juan, el diseño tiene hoy: una fila de rastro por cada
débito cancelado, una regla que distingue si el cobro fue el día del corte o después, un detector
que corre al día siguiente y otra vez semanas después, tres mediciones en Mercado Pago, una pasada
para averiguar el correo de quien no conocemos, vencer los links de pago del viejo, y un Worker que
cierra la entrada de avisos hasta escribir ese rastro. Todo eso existe para cobros de las tres
cuentas que ya conocés.

1. **Retirar todo eso.** Si a Juan le entra un cobro viejo después del corte, el sistema nuevo lo
   trata como a cualquier débito desconocido: lo anota, lo cancela y te pone delante una marca que
   propone devolverlo; vos decidís. Costo: bajo (texto). Riesgo: bajo; lo que cambia es que ese
   cobro te aparece para decidir, en vez de quedar anotado callado. **Recomendada**.
2. **Conservar el rastro y el Worker, pero sin detector, sin la regla del día ni las mediciones**:
   todo cobro sobre un débito viejo se anota sin marca y lo resolvés por privado. Costo: medio.
   Riesgo: un cobro que no ve nadie.
3. **Como está hoy.** Costo: alto; seis plazos, tres mediciones y una issue con fecha que puede caer
   meses después.

### D · Si el corte se aborta

Hoy, si algo falla, se reactivan los planes viejos para que el sistema viejo vuelva a vender y Juan
se re-suscriba por el link (pagando en el acto, sin trial). Eso obliga además a probar en
producción que un plan reactivado vende.

1. **Abortar es restaurar y volver a la imagen vieja, sin reabrir la venta**: las cinco esperan el
   reintento, y vos les avisás. Costo: bajo. Riesgo: mientras no se reintenta, nadie nuevo puede
   suscribirse al viejo. Sale la prueba en producción del paso 0. **Recomendada**.
2. **Como está hoy.** Costo: una prueba en producción y la re-suscripción sin trial de las tres.

### E · El OK a lo que no tiene alternativa

Las filas de §1 a §9 marcadas **RETIRAR** o **SIMPLIFICAR** sin letra son consecuencia directa de
tus premisas (la clasificación de fichas, los recuentos, el guion del aviso, la agenda de llamados,
el umbral de veinte personas) o de la J. Y el §11 dice qué decisiones del log cambian.

1. **OK a todas**, y se aplican con las letras que elijas. **Recomendada**.
2. **OK con excepciones**: nombrás las `S-NN` que querés discutir.
