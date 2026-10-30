---
title: "FASE 8 vuelta 1 · el consolidado de los 100 hallazgos"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 1 — el consolidado

Nueve agentes adversariales (Opus, `DEC-METH-014`) atacaron el diseño vigente el 2026-09-26. Es la
**vuelta 1 de 2** del tope de `DEC-METH-013`, que empezó a contar después de la FASE 8 completa del
24/09. El alcance fue el núcleo, las dos épicas con sus descomposiciones, el contrato de cobertura
y el corte (`16-fase-7-del-paraguas.md`). Trabajaron **ciegos entre sí y ciegos del historial**:
no leyeron `14-`…`26-` ni los rastros. Ninguno escribió código ni tocó otro archivo que su informe.

Este documento no repite los hallazgos: los **agrupa por causa**. La convergencia entre agentes
ciegos es la señal de severidad.

> **Lo que este documento NO hace.** No propone soluciones y no decide nada. Donde sube una
> severidad lo dice como **propuesta del consolidador**, con su razón. Qué racimo se arregla y cuál
> se declara con causa lo decide el owner, racimo por racimo.

---

## 1. Los números, recontados

Contados con script sobre los nueve archivos (encabezados `###` bajo cada `## SEVERIDAD`), no a
mano. La columna **owner** es juicio del consolidador sobre cada hallazgo (§3), no un campo de los
informes.

| informe | vector | hallazgos | CRÍT | ALTA | MEDIA | BAJA | owner |
|---|---|---|---|---|---|---|---|
| `A1` | acceso cruzado y autorización | 9 | 0 | 5 | 4 | 0 | 2 |
| `A2` | máquinas, carreras y huérfanos | 10 | 0 | 2 | 6 | 2 | 3 |
| `A3` | datos, migración y acoplamiento | 15 | 0 | 5 | 7 | 3 | 7 |
| `B1` | doble cobro y pérdida de pago | 8 | 0 | 4 | 3 | 1 | 2 |
| `B2` | máquinas, idempotencia y carreras | 11 | 0 | 3 | 5 | 3 | 0 |
| `B3` | conciliación, datos y migración | 7 | 0 | 2 | 4 | 1 | 1 |
| `C1` | la costura | 15 | 0 | 3 | 8 | 4 | 4 |
| `C2` | liberación, coexistencia y migración | 15 | 1 | 2 | 8 | 4 | 3 |
| `D1` | coherencia del conjunto | 10 | 0 | 2 | 2 | 6 | 1 |
| | **total** | **100** | **1** | **28** | **47** | **24** | **23** |

**Las citas se verificaron con script.** `verificar-citas.py` (en esta carpeta) encuentra las
**435** citas literalmente a ±5 líneas de la línea citada: 435 ok, 0 desplazadas, 0 fallas.
**Ninguna cita inventada.** El consolidador volvió a correrlo el 2026-09-26 con el mismo resultado.

---

## 2. Los racimos

Un racimo es un conjunto de hallazgos de **agentes distintos** con **una sola causa**. Van
ordenados por lo que está en juego: plata y acceso de la cartera primero, después la costura,
después registro. Hallazgos del mismo agente con la misma causa no forman racimo: no aportan
convergencia y van en la tabla del §3.

| racimo | causa | sev. | agentes | owner |
|---|---|---|---|---|
| **R1** | la ficha vieja no tiene estado de nacimiento ni salida del dueño | **CRÍT** | 4 | sí |
| **R2** | la llegada a `PURGED` no tiene camino declarado hasta `A6` | ALTA → **CRÍT** (propuesta) | 3 | sí |
| **R3** | el addon recurrente sólo muere por orfandad o borrado | ALTA | 2 | sí |
| **R4** | el desempate de motivos es lista cerrada y de un solo productor | ALTA → **CRÍT** (propuesta) | 4 | parcial |
| **R5** | nada congela las ventas durante la ventana del corte | ALTA | 3 | no |
| **R6** | la lápida no tiene fuente para sus columnas ni dueño | MEDIA | 4 | no* |
| **R7** | la población del aviso previo se contó en suscripciones | MEDIA | 2 | no |
| **R8** | el inventario de lo que cruza la frontera no es el real | MEDIA | 2 | sí |
| **R9** | el aviso de cobertura no tiene censo de emisores ni de consumidores | MEDIA | 2 | no |
| **R10** | la regla del botón «suscribirse» vive en dos espejos distintos | MEDIA | 2 | no |
| **R11** | lo que la matriz cerró no llegó a todos los textos | BAJA | 2 | no |
| **R12** | el vínculo fila ↔ preapproval no está definido | MEDIA | 2 | no |

\* salvo que la respuesta sea leer las tablas viejas (ver R6).

En racimos quedan **44** hallazgos; los **56** restantes no convergen con nadie (§3). Críticos:
**1 declarado** (`F-8V1C2-001`, en R1) y **2 racimos propuestos** para subir (R2 y R4).

### R1 · La ficha vieja nace sin estado declarado y el dueño no puede sacarla de `UNPUBLISHED_BY_BILLING` — CRÍT, 4 agentes

`2g` (`DEC-MIG-005`) decide que la cartera actual se trata como nueva y estrena el trial: *«su
próxima publicación arranca el trial por `T1`»*. Pero el corte no dice en qué estado de la máquina
nueva nace cada ficha vieja (`F-8V1A3-001`), y el estado que el texto supone —`PUBLISHED`, bajada
el primer día por `PB2`— es `UNPUBLISHED_BY_BILLING`, desde donde **el dueño no tiene ninguna
transición**: `PB1` sale sólo de `DRAFT`, `PB6` sólo de `PUBLISHED`, `PB3`/`PB7` exigen
cobertura. Sin `PB1` no hay evento de activación y `T1` no dispara. El único camino que el guion
le nombra (*«se los llama, contratan»*) cobra el primer ciclo en el acto. Y qué es *«ya publicó»*
para quien publicó sólo en el sistema viejo no está escrito, así que el botón de la fila 23 lo
manda al checkout o a publicar algo que no puede publicar.

`F-8V1A3-001` agrega las otras caras de la misma causa: una ficha nacida `ARCHIVED` se borra el día
180 sin el aviso del archivado, una despublicada por el dueño la republica `PB3`, una `PENDING` de
moderación se publica sin aprobar, y `is_featured` sobrevive sin la capacidad.

- `F-8V1C2-001` CRÍT · `F-8V1A2-001` · `F-8V1A3-002` · `F-8V1D1-001` · `F-8V1A3-001`
- Convergencia: `A2`, `A3`, `C2` y `D1`, ciegos, llegan al mismo par *(estado sin salida, trial
  prometido)*. Además `A1` y `C1` lo anotan en su «fuera de mi vector». Seis de nueve lo vieron.

**Juan.**

1. Juan tiene una ficha de Alojamiento publicada en el sistema viejo; el owner le avisa que va a
   tener su trial.
2. Corte: amanece en `PRE_TRIAL`, sin fila de `trial`. El reconciliador del primer día corre `PB2`
   y la ficha pasa a `UNPUBLISHED_BY_BILLING`.
3. Juan busca «volver a publicar»: no hay acción, porque ninguna fila del dueño sale de ese estado
   salvo borrar (`PB12`).
4. Toca «suscribirme»: como ya publicó, va al checkout y paga el primer mes en el acto. `PB3` le
   devuelve la ficha. El trial regalado no existió, y nada lo detecta.

**Qué hace falta decidir.** Decisión del owner, porque es la ejecución de `2g`: *¿en qué estado
nace cada ficha vieja, y por qué camino estrena Juan su trial (salida del dueño desde
`UNPUBLISHED_BY_BILLING` hacia `DRAFT` o publicando con `T1`, ficha nacida `DRAFT`, o checkout de
cliente actual que arranque el trial)?* El texto vigente supone una publicación del dueño, así que
la opción más cercana al diseño es una salida del dueño que ejerza `T1`. Después es aplicación: la
tabla de traducción de columnas viejas a los seis estados (`V/21` §2.4) y qué es *«publicó»* para
el botón. La traducción de la moderación también es del owner (`F-8V1A3-001`).

### R2 · La llegada a `PURGED` no tiene camino declarado hasta `A6` — ALTA, 3 agentes, **propuesta CRÍT**

Desde `K-9` la única fila que apaga un addon `LISTING` al borrarse su ficha es `A6`, y su evento es
un hecho de verticales (`PB9` o `PB12`). Ese hecho no llega a billing por ningún lado: el contrato
transporta hechos sólo de billing a verticales y la vuelta son tres consultas de política
(`F-8V1A3-003`, `F-8V1C1-001`). Y lo que sí está escrito en verticales apunta al lugar viejo: las
notas de `PB9`/`PB12` en `V/03` siguen mandando el borrado a la orfandad de `A5` (`F-8V1A2-002`,
`F-8V1C1-013`), y el inventario de *fila viva* del glosario no lista a `A6` (`F-8V1D1-009`). Son
eslabones distintos de la misma cadena sin declarar: **`K-9` se aplicó en billing y no cruzó la
costura** ni hacia el contrato ni hacia verticales.

- `F-8V1A3-003` · `F-8V1C1-001` · `F-8V1A2-002` · `F-8V1C1-013` · `F-8V1D1-009`
- Vecino, con otra causa: el hard delete del admin fuera de `PB9`/`PB12` tampoco corre `A6`
  (`F-8V1A1-003`, tercer punto). Queda en §3, porque su causa es el catálogo del admin.

**Juan.**

1. Juan paga Premium de Alojamiento y un destaque mensual (`LISTING`) sobre «Cabañas del Río».
2. Borra esa ficha (`PB12`): llega a `PURGED`. Sigue pagando Premium por sus otras fichas.
3. Billing no se entera del borrado; `A5` no corre porque la principal está viva.
4. El preapproval del destaque cobra todos los meses sobre una ficha que no existe. El barrido
   compara proveedor contra nuestras filas, que coinciden: no lo ve nadie.

**Por qué se propone CRÍT (propuesta del consolidador).** Tres agentes ciegos (`A2`, `A3`, `C1`)
llegan al mismo desenlace, el daño es plata del cliente **sin tope y sin detector**, y el camino es
un acto ordinario del dueño (borrar una ficha destacada). Es la misma clase que `F-8CA2-003`, que
la vuelta del 24/09 dio CRÍT.

**Qué hace falta decidir.** Decisión del owner, porque amplía el contrato (`DEC-ARCH-006`): *¿se
declara un hecho verticales → billing («la ficha llegó a `PURGED`») con transporte y red, o `A6`
se comprueba en el barrido de billing consultando a verticales?* El diseño vigente no sugiere
ninguna de las dos. Corregir las notas de `V/03` y el glosario a `A6` es aplicación sin decisión.

### R3 · El addon recurrente sólo muere por orfandad o borrado: todo estado sin servicio lo deja cobrando — ALTA, 2 agentes

Un addon recurrente tiene su propio preapproval (`DEC-ADDON-002`) y sólo lo apagan dos cosas: que
no quede principal viva en ese `user + vertical`, o `A6`. Ningún estado **sin servicio** del
título o de la ficha lo alcanza. `SUSPENDED` es fila viva y no tiene salida por reloj, y la pausa
de complementos de `S32` se decidió sólo para la pausa del cliente (`F-8V1B1-002`). Una ficha
`MODERATED` (sin reloj) o bajada por excedente sigue existiendo, así que tampoco hay orfandad ni
borrado (`F-8V1A2-007`). `DEC-ADDON-001` aceptó perder días de un addon con fecha de fin, no un
débito mensual sin horizonte. Y el aviso de suspensión dice *«ya no se te va a cobrar»*.

- `F-8V1B1-002` · `F-8V1A2-007`
- `C1` anota el caso `MODERATED` en su «fuera de mi vector».

**Juan.**

1. Juan tiene Alojamiento (ARS 18.000) y un destaque recurrente (ARS 3.000), dos preapprovals.
2. El cobro de 18.000 rechaza y el de 3.000 entra; pasan los diez días de grace y corre `S6`.
3. La principal queda `SUSPENDED`; el correo dice que ya no se le cobra.
4. El destaque sigue `ACTIVE` y cobra cada mes; el barrido ve `ACTIVE` contra `authorized` y no
   marca nada. Lo descubre en el resumen de la tarjeta.

**Qué hace falta decidir.** Decisión del owner, porque extiende `DEC-ADDON-001` y la decisión 4a:
*¿el complemento recurrente sigue la suerte de su título suspendido o de su ficha moderada o
excedente (pausa o cancelación), o se sigue cobrando con aviso honesto y detector?* El diseño
vigente (4a) dice que sigue cobrando; lo que no tuvo delante es que el débito no tiene tope.

### R4 · El desempate de motivos se escribió como lista cerrada y para un solo productor — ALTA, 4 agentes, **propuesta CRÍT**

El desempate de `B/05` §3 reparte un cobro que entra sobre una fila que no puede recibirlo, y está
escrito como **enumeración de transiciones y estados**, pensando en **un** productor (el evento).
Tres huecos de la misma causa:

- no clasifica estados que no nombra: `CANCEL_SCHEDULED` (con tres destinos posibles y uno que
  recorta el piso de la discontinuación, `F-8V1B2-002`) ni `CHARGE_DECLINED` (`F-8V1B1-007`);
- no clasifica filas que no nacen de una transición: la lápida cae en el comodín
  (`F-8V1C2-013`, `F-8V1B1-007`);
- el **barrido** es un segundo productor con el default opuesto: sobre una fila terminal abre
  `COBRO_SIN_REGISTRAR` (*«no hay nada que devolver: asentarlo»*) donde el evento habría abierto un
  motivo con devolución (`F-8V1B2-003`). Sobre la lápida pasa **en la primera corrida**, sin
  carrera, con cualquier cobro histórico `approved` del preapproval (`F-8V1B3-002`).

- `F-8V1B2-003` · `F-8V1B3-002` · `F-8V1B2-002` · `F-8V1B1-007` · `F-8V1C2-013`
- Entre ciegos hay una lectura opuesta que confirma la causa: `C2` da por resistido *«el cobro
  tardío sobre una lápida sin devolución: los tres motivos de `B/05` devuelven plata»*. Mira sólo
  el productor evento; `B3` muestra que el barrido llega primero con el motivo 19.

**Juan.**

1. Juan está en `GRACE_PERIOD` y pide la baja: `S24` lo pasa a `CANCELLED` y corta el servicio.
2. La cancelación en el proveedor falla de forma transitoria; el reintento de la cuota cobra.
3. El aviso del cobro se pierde (`WH-5`).
4. El barrido ve un `approved` sin `payment` y abre `COBRO_SIN_REGISTRAR`: la bandeja le propone a
   la operadora **asentarlo**. Juan pagó un mes sin servicio y la herramienta dice que no se le
   debe nada.

**Por qué se propone CRÍT (propuesta del consolidador).** Cuatro agentes ciegos (`B1`, `B2`, `B3`,
`C2`), tres `ALTA`, todas sobre plata que hay que devolver. El camino de la lápida es
**determinístico** —no depende de una carrera— y alcanza a todo compromiso viejo con un cobro
registrado (el compromiso 1 lo tiene desde el 26/09). La persona que mira la marca no es defensa
si la marca le dice lo contrario de lo que pasó.

**Qué hace falta decidir.** Mayormente aplicación sin decisión: que el motivo 19 aplique sólo
sobre una fila que puede recibir el cobro, que el barrido derive al motivo del desempate, dos
celdas más (`CHARGE_DECLINED`, lápida) y una regla de `max` para la fecha de `S26`. **Una pregunta
es del owner** (`F-8V1B3-002`): *¿el cobro en vuelo de la ventana del corte que sale bien se
devuelve?* `DEC-MIG-005` resignó la diferencia de la rama de aborto, no ese cobro.

### R5 · Nada congela las ventas durante la ventana del corte — ALTA, 3 agentes

El §4.2 del corte razona la ventana entre el censo y el apagado sólo en términos de **cobros de lo
que ya estaba en el censo**. Ningún paso cierra las **altas**. El checkout viejo ya no usa
`preapproval_plan` (HOS-1221), así que cerrar los planes en 1a no lo frena (`F-8V1C2-003`). La
`Preference` de addons del viejo dura 30 minutos (`F-8V1B3-006`). Y el sistema nuevo atiende altas
durante el paso 3, antes de que la rama de aborto restaure el backup encima (`F-8V1A3-005`). En los
tres casos queda un preapproval o un pago vivo que ninguna base conoce.

- `F-8V1C2-003` · `F-8V1A3-005` · `F-8V1B3-006`
- El desenlace escrito («llega desconocido y abre la marca») depende además de `F-8V1B3-001`, que
  muestra que esa marca **no se puede escribir** (§3).

**Juan.**

1. 10:00 corre el censo (1b); 10:20 cierra el control del paso 2.
2. 10:30 Juan se suscribe en el sitio viejo, que sigue corriendo: preapproval sin plan, primer
   cobro.
3. 11:00 se apaga el viejo y se despliega; el pago se pierde con las tablas viejas.
4. Juan amanece sin suscripción y su ficha baja. Un mes después el proveedor le cobra de nuevo.

**Por qué no se propone CRÍT.** Tres agentes y plata, pero no es el camino principal: la
población es la de una ventana de minutos el día del corte, y la ventana es controlable por
procedimiento.

**Qué hace falta decidir.** Trabajo de aplicación: un paso que apague las altas vieja y nueva
(checkout de suscripción y de addons) antes del 1b y hasta cerrar el paso 4, verificado como el
apagado de webhooks, y qué hecho marca el fin del paso 3. Conviene avisarle al owner que por esos
minutos se suspende `DEC-MIG-002` (altas abiertas).

### R6 · La lápida es una `subscription` escrita a mano sin fuente para sus columnas ni dueño — MEDIA, 4 agentes

La lápida es una `subscription` en `CANCELLED`, y esa entidad exige `user`, vertical, versión
anclada y billing option. Los planes viejos no existen en el catálogo nuevo (`F-8V1A3-012`). El
corte no lee tablas viejas y el proveedor devuelve `payer_email` vacío (`EX-19`), así que no hay
de dónde sacar el `user` (`F-8V1B3-003`). Y quién la escribe está dicho tres veces distinto: *«el
sistema nuevo»* en la tabla del §4.2, *«a mano»* en su prosa, *«una persona»* en `B/21`
(`F-8V1C2-005`, `F-8V1D1-010`).

- `F-8V1A3-012` · `F-8V1B3-003` · `F-8V1C2-005` · `F-8V1D1-010`

**Juan.**

1. El paso 1b cancela el preapproval viejo de Juan (plan `owner-pro`).
2. En el paso 4 el operador siembra su lápida: no hay `owner-pro` ni `user_id` legible.
3. La ancla al Pro nuevo o la deja sin escribir.
4. Si la ancla, el barrido compara el cobro tardío contra un precio que Juan nunca pagó; si no la
   escribe, el cobro tardío cae en `F-8V1B3-001`.

**Qué hace falta decidir.** Aplicación: qué columnas admiten nulo en una lápida (o un tipo de
fila propio), el conjunto exacto de ids, quién la escribe, y la unidad que la construye. Pasa a
ser del owner **sólo** si la respuesta es leer las tablas viejas antes de retirarlas, porque eso
contradice `DEC-MIG-005` punto 1.

### R7 · La población del aviso previo se contó en suscripciones, y la despublicación alcanza a todo dueño con ficha — MEDIA, 2 agentes

El costo de «no migrar» se midió en suscripciones (*«tres llamadas»*), pero el reconciliador baja
la ficha publicada de **todo** dueño sin título. El inventario cuenta 12 alojamientos contra 3
suscripciones vivas, y la re-verificación de `B/21` §1.3 mira tablas de billing. El *«cero»* de
gastronomía, experiencia y partner no sale de una consulta reproducible.

- `F-8V1A3-011` · `F-8V1C2-009`

**Juan.**

1. Juan cargó un alojamiento en 2025 y nunca tuvo suscripción.
2. No está entre las tres llamadas.
3. El día del corte su ficha baja sin aviso.
4. Se entera por el aviso previo al archivado del día 90.

**Qué hace falta decidir.** Aplicación: que la re-verificación cuente fichas publicadas por dueño
en las cinco verticales el día del corte, y que el aviso vaya a esa población.

### R8 · El inventario de lo que cruza la frontera no es el real — MEDIA, 2 agentes

El §4.1 del contrato declara tres consultas y siete campos, y la regla del §4.2 dice que toda
lectura fuera de ellos es un acoplamiento no mirado. El diseño vigente ya tiene lecturas y hechos
que no entran, en las dos direcciones:

- billing lee de verticales fuera de los siete campos: la vertical y el dueño de la ficha objetivo
  en `A1`, la vigencia y el scope del addon, el linaje de `addon_version`, la enumeración de la
  pricing, el conjunto efectivo en Mi Suscripción (`F-8V1A3-008`, `F-8V1C1-008`);
- billing necesita **escribir** en verticales la extensión de trial por promo o cortesía, sin
  canal (`F-8V1C1-009`);
- verticales necesita de billing quién está anclado a un plan y cuál es la versión vigente de un
  grant para resolver e invalidar el caché (`F-8V1A3-009`, `F-8V1C1-004`);
- y los siete campos mismos no calzan: la regla dispara sobre el veredicto de `direcciónDeCambio`
  (`F-8V1A3-014`) y `díasDeTrial` no tiene lector en billing (`F-8V1C1-015`).

- `F-8V1A3-008` · `F-8V1C1-008` · `F-8V1C1-009` · `F-8V1A3-009` · `F-8V1C1-004` ·
  `F-8V1A3-014` · `F-8V1C1-015`
- R2 es de la misma familia (un hecho de verticales sin canal) y `C1` lo dice así en su primer
  Key Learning. Va aparte porque su daño es plata y tiene su propia convergencia.

**Juan.**

1. Juan canjea un código de «+7 días de trial».
2. Billing tiene que saber si el trial está en `TRIAL_ACTIVE` y si el techo lo admite.
3. No hay operación declarada: el implementador escribe directo sobre `trial`.
4. Si cada lado cuenta el techo por su cuenta, se consume un código que verticales rechazó.

**Qué hace falta decidir.** Decisión del owner, porque cambia el contrato (`DEC-ARCH-006`): *¿las
lecturas y escrituras legítimas se declaran como consultas del §4.1, o las superficies se
declaran una capa de composición fuera de las dos épicas?* Hay una segunda pregunta en la misma
línea: *¿quién resuelve la versión vigente del grant, billing con una consulta `versiónVigente` o
verticales con `referencia` = plan?* Corregir la regla (tres preguntas y no siete campos) y
`díasDeTrial` es aplicación.

### R9 · El aviso de cobertura no tiene censo de emisores ni de consumidores al día — MEDIA, 2 agentes

El contrato tiene un censo de consumidores de `cubierto` y no uno de emisores del aviso. Ninguna
fila de suscripción, cortesía, grant ni addon declara que emite, y la implementación de arranque
no dice que emita en `T1`/`T3` (`F-8V1C1-006`). La lista de quién espera el aviso del primer pago
nombra `T2`/`T5` y no `T8` (`F-8V1A2-010`). El ⚠️ del reconciliador declara la pérdida para
`T2`/`T5` y no para `T8`, que la red diaria no rescata (`F-8V1C1-010`). Y el censo de consumidores
de `cubierto` no incluye a `PB1` (`F-8V1C1-012`).

- `F-8V1C1-006` · `F-8V1C1-010` · `F-8V1A2-010` · `F-8V1C1-012`

**Juan.**

1. Juan se suscribe, publica en la ventana del primer cobro y `T6` no dispara.
2. Llega el primer pago; su aviso se pierde. `T8` no corre y la red diaria no corre la máquina de
   trial.
3. Un año después Juan cancela y publica sin cobertura: `T1` le da un trial entero, siendo alguien
   que ya fue cliente.

**Qué hace falta decidir.** Aplicación: un censo de emisores con la forma del de consumidores,
`T8` y `PB1` en sus listas, y declarar la pérdida de `T8` en el ⚠️ o darle a la máquina de trial
una relectura diaria.

### R10 · La regla del botón «suscribirse» vive en dos espejos que no enumeran las mismas causas — MEDIA, 2 agentes

La fila 21 de `V/19` dice *«suscribite para publicar»* incluso cuando la causa es que la vertical
no admite altas, y ahí billing no ofrece checkout (`F-8V1A1-008`). La fila 23 de `V/19` y su
espejo, la fila 21 de `B/19`, no nombran las mismas causas: con días de trial en cero, `B/19`
manda a publicar a quien no puede, y `PB1` lo devuelve al botón (`F-8V1D1-004`).

- `F-8V1A1-008` · `F-8V1D1-004`
- Vecino, con otra causa: `F-8V1A2-006` (las campañas del trial siguen pidiendo suscribirse en una
  vertical discontinuada). Su causa son las campañas del outbox, no la regla del botón.
- También vecino de R1: qué es *«publicó»* para la cartera vieja cambia a dónde manda esta fila.

**Juan.**

1. Una vertical nueva sale con días de trial en cero.
2. Juan, que nunca publicó ahí, toca «suscribirme»: lo manda a publicar.
3. Publicar no dispara `T1` y no está cubierto: «suscribite para publicar».
4. Vuelve al botón y lo manda otra vez a publicar. No puede comprar.

**Qué hace falta decidir.** Aplicación: una sola regla, escrita en un lugar y citada por el otro,
partida por causa (sin altas, días en cero, sin evento declarado).

### R11 · Lo que la matriz cerró no llegó a todos los textos — BAJA, 2 agentes

`GR-1` quedó `VERIFIED` y `RN-3` `PARTIALLY_SUPPORTED`, pero `B/03` §4 sigue condicionando la
salida del grace a `GR-1` `UNKNOWN` y `B/06` §11 da `RN-3` como `UNKNOWN` (`F-8V1B1-008`). La
descomposición de billing, `B/06` y `B/09` cuentan filas o citan estados que el recuento del
script ya no da (`F-8V1D1-005`).

- `F-8V1B1-008` · `F-8V1D1-005`
- Distinto: `F-8V1B3-007` atribuye a `EX-15` lo contrario de lo que mide. No es un texto vencido,
  es una paráfrasis invertida; va en §3.

**Juan.** Juan entra en grace; la pantalla escrita desde `B/03` §4 no le promete que cambiar la
tarjeta reintenta el cobro; no la cambia y termina suspendido por un cobro que se recuperaba en
minutos.

**Qué hace falta decidir.** Aplicación: tachar las frases contra el recuento del script.

### R12 · El vínculo fila ↔ preapproval no está definido — MEDIA, 2 agentes

La re-vinculación exige que el `external_reference` *«nombre una fila nuestra que no tenga otro
`provider_link` vivo»*. Pero ningún capítulo fija qué valor lleva ese campo, qué hace «vivo» a un
vínculo ni cuántos puede tener una suscripción (`F-8V1B3-004`). El barrido de creaciones reusa un
`pending` encontrado sólo por `payer_email`, sin esa precondición (`F-8V1B2-007`). Y tras una
búsqueda vacía no dice cuándo se vuelve a crear, con lo que una fila puede terminar con dos
`pending` (`F-8V1B2-008`).

- `F-8V1B3-004` · `F-8V1B2-007` · `F-8V1B2-008`

**Juan.**

1. Juan contrata su plan y un addon recurrente en la misma sesión; las dos creaciones quedan sin
   respuesta.
2. El barrido de la fila del plan trae dos `pending` del correo de Juan y reusa el del addon.
3. Juan autoriza y el plan queda cobrando el monto del addon.
4. Lo detecta la comparación de monto, después del primer cobro.

**Qué hace falta decidir.** Aplicación: el valor exacto del `external_reference` (principal y
complemento), qué hace vivo a un `provider_link` y si hay `UNIQUE(subscription_id)`, la misma
precondición de §2.4 para el reuso, y la regla tras una búsqueda vacía.

---

## 3. Los que no convergen con nadie

Un solo agente no es señal débil cuando la cita es literal y el camino es corto. Van por
severidad. La columna **owner** marca si la pregunta que dejan es de producto o política (sí) o
trabajo de escritura (no).

### ALTA (15)

| ID | título | capítulo | owner |
|---|---|---|---|
| `F-8V1A1-001` | un admin que también es cliente se administra a sí mismo sin control | `N/08` §3, `V/17` §3 | sí |
| `F-8V1A1-002` | el bypass de staff del código actual pasa el guard del invariante 13 | `N/04` (inv. 13, `G6`) | no |
| `F-8V1A1-003` | escrituras del admin fuera del catálogo: el cap. 17 las permite, el núcleo no | `N/08` §3, `V/17`, `V/19` | sí |
| `F-8V1A1-004` | «la clave vigente» de la precisión 7 no dice cuál: un Silver puede tener página | `V/17` §1.2, `V/18` §1.6 | no |
| `F-8V1A1-005` | «hereda Turista VIP» es una columna que `G-R3` no mira y el contrato no transporta | `V/02`, `V/10`, contrato | no |
| `F-8V1A3-004` | el corte no tiene un paso que siembre el catálogo nuevo | `D/16` §4.2 | sí (ancla de los grants) |
| `F-8V1B1-001` | la pausa con vuelta anticipada regala un ciclo, o cobra uno sin servicio | `DEC-SUB-010`, `B/03` §5 | sí |
| `F-8V1B1-003` | `S16` deja entrar el alta nueva con el preapproval viejo todavía vivo | `B/03` `S16`, `B/12` §11 | no |
| `F-8V1B1-004` | la revocación tiene fila para el reembolso y ninguna para la cancelación | `B/03` §3.2 y §6.1, `DEC-RF-001` | no |
| `F-8V1B2-001` | levantar una marca y colgarle un pago no se serializan | `B/03` `S14`/`S15`, `B/05` | no |
| `F-8V1B3-001` | el cobro de un preapproval desconocido no tiene fila donde anotarse | `B/02` §2.3 y §2.5, `B/09` §2.4 | no |
| `F-8V1C1-002` | `direcciónDeCambio` no sabe qué es «bajar» en una clave donde menos es mejor | contrato §4.1, `V/15` | no |
| `F-8V1C1-003` | el orden entre el aviso, la invalidación y el commit no está escrito | `V/02` §3.2, contrato §3 | no |
| `F-8V1C2-002` | lo pagado en el viejo por un período o un addon que el corte corta se pierde sin decisión | `B/21` §4, `D/16` §4 | sí |
| `F-8V1D1-002` | «cobrada» significa dos cosas, y la única definición del paraguas es la estrecha | contrato §2.1, `B/16`, glosario | no |

Dos notas sobre esta tabla:

- `F-8V1C2-002` converge **en parte** con la última pregunta de `F-8V1B3-002` (R4): las dos dicen
  que `DEC-MIG-005`/`2d` cubrió la rama de aborto y no lo cobrado por el viejo en el corte que sale
  bien. Se deja fuera de racimo porque su objeto (el período prepagado y los addons) es otro.
- `F-8V1D1-002` choca con un ataque que `C1` dio por resistido (*«dos definiciones de
  "cobrada"»*): `C1` midió el efecto sobre la máquina de trial y no lo encontró; `D1` lo encuentra
  cuando las dos unidades comparten el predicado. No es convergencia, es una lectura que `C1` no
  hizo.

### MEDIA (27)

| ID | título | capítulo | owner |
|---|---|---|---|
| `F-8V1A1-006` | el guest es un actor: el paso 1 no rechaza a nadie y el piso le da suscribirse | `V/17` §1.2, `V/02` | no |
| `F-8V1A1-007` | el correo sin verificar bloquea hasta la lectura de lo propio y la recuperación | `V/17` §1.2 | no |
| `F-8V1A1-009` | nada exige que la ficha objetivo de un addon `LISTING` sea del comprador | `B/03` `A1`, `B/02` | no |
| `F-8V1A2-003` | `T7` consume el trial de quien publicó con una suscripción que nunca cobró | `V/03` §2 (`T7`) | sí |
| `F-8V1A2-004` | `spec.md` describe `T8` al revés de la tabla | `V/spec.md` | no |
| `F-8V1A2-005` | la postulación de Partner tiene dos actos en la prosa que su tabla no declara | `V/03` §11, `V/18` | no |
| `F-8V1A2-006` | un trial en una vertical discontinuada sigue recibiendo campañas de suscripción | `V/03` §2, `N/07` | no |
| `F-8V1A2-008` | el reconciliador decide antes del lock y `PB2` no relee adentro | `V/03` §9 | no |
| `F-8V1A3-006` | las restricciones de `plan_version` no se pueden escribir sobre sus columnas | `V/02` §2.1, `B/02` | no |
| `F-8V1A3-007` | `subscription` guarda vertical, versión y billing option sin atarlos | `B/02` §2.2 | no |
| `F-8V1A3-010` | el borrado del día 180 enumera cuatro clases de contenido y la ficha tiene más | `V/02` §4 | sí (reseñas) |
| `F-8V1B1-005` | ante un `2084`, caer al total devuelve más de lo que una persona confirmó | `B/03` `RF2` | no |
| `F-8V1B1-006` | `S30` sale sólo de `ACTIVE` y el último cobro con descuento puede entrar en grace | `B/03` `S30`/`P1` | no |
| `F-8V1B2-004` | `S6` escribe después de la llamada y el espejo de su propio aviso lo gana | `B/03` `S6`, §10.1 | no |
| `F-8V1B2-005` | un pago de otro monto sobre la predecesora de una sucesión tiene dos filas | `B/03` `S19`, `B/05` §3 | no |
| `F-8V1B2-006` | `S31` corre por evento y `S17` por estado: si gana `S17`, la sucesora sobrevive | `B/03` `S17`/`S31` | no |
| `F-8V1B3-005` | el gate de completitud del censo no ve lo único que el censo existe para encontrar | `D/16` §4.2 | no |
| `F-8V1C1-005` | `B4` entrega `cobrada` y su aviso, pero corre antes de que exista el pago | `B/descomposicion` | no |
| `F-8V1C1-007` | si la sucesora entra en grace, la predecesora marcada vuelve a emitir | contrato §2.6 | no |
| `F-8V1C1-011` | el dueño de `G13` está escrito distinto en el contrato y las descomposiciones | contrato §5, descomposiciones | no |
| `F-8V1C2-004` | las herramientas del corte no son de ninguna unidad ni tienen camino a producción | `D/16` §4.2, `B/descomposicion` | no |
| `F-8V1C2-006` | el ensayo del paso 0 es en otra cuenta del proveedor y verifica producción | `D/16` §4.2 y §4.3 | no |
| `F-8V1C2-007` | la rama de aborto supone al viejo corriendo, pero el corte lo apagó | `D/16` §4.3 | no |
| `F-8V1C2-008` | ningún paso apunta ni verifica a dónde llega el webhook después del corte | `D/16` §4.2 | no |
| `F-8V1C2-010` | qué hace el viejo con sus propias cancelaciones en la ventana no está escrito | `D/16` §4.2 | no |
| `F-8V1C2-011` | el aviso del corte no deja la evidencia que el capítulo legal exige | `B/22`, `V/21` | sí |
| `F-8V1D1-003` | la regla 5 del núcleo cierra en `S3`/`S6` las lecturas del proveedor, y `S1` lee otra | `N/03` §1, `D17` | no |

### BAJA (14)

| ID | título | capítulo | owner |
|---|---|---|---|
| `F-8V1A2-009` | `T6` y `T8` escriben la misma fila de `trial` sin lock declarado | `V/03` §2 y §9 | no |
| `F-8V1A3-013` | el núcleo pone el invariante 2 entre los que sostiene la base | `N/04` §2.1 | no |
| `F-8V1A3-015` | una fila de invalidación contradice la inmutabilidad de la versión | `V/02` §3.2 | no |
| `F-8V1B2-009` | `S6` sobre una fila `ACTIVE` remite a `S5`, que no sale de `ACTIVE` | `B/03` `S5`/`S6` | no |
| `F-8V1B2-010` | dos filas del catálogo de marcas omiten a uno de sus escritores | `B/02` §2.5 | no |
| `F-8V1B2-011` | la lista de salidas del grace omite el espejo del proveedor | `B/03` §4 | no |
| `F-8V1B3-007` | `B/09` atribuye a `EX-15` que cancelar no emite webhook; la matriz dice lo contrario | `B/09` §3 | no |
| `F-8V1C1-014` | la descomposición de billing sigue contando tres fuentes, sin el addon | `B/descomposicion` §2.5 | no |
| `F-8V1C2-012` | el paso 3b no alcanza a evitar lo que dice evitar | `D/16` §4.2 | no |
| `F-8V1C2-014` | la lista de lo que se retira omite `partner_subscriptions` | `B/21` §4 | no |
| `F-8V1C2-015` | el §1 y el §3 del corte siguen diciendo que el rollback no existe | `D/16` §1 y §3 | no |
| `F-8V1D1-006` | las invariantes cuentan 117 decisiones y el índice 124 | `N/04` §3 | no |
| `F-8V1D1-007` | tres referencias apuntan a secciones de `B/09` que no existen | `B/02`, `B/06` | no |
| `F-8V1D1-008` | el spec de verticales sigue diciendo que no necesita leer billing | `V/spec.md` | no |

Conteo: 15 + 27 + 14 = **56**, más 44 en racimos = **100**.

---

## 4. Contradicciones chicas ya anotadas por el orquestador

Verificadas con `rg -n` con ruta explícita el 2026-09-26, sobre el worktree de la spec.

| # | contradicción | ¿la vio un agente? | estado |
|---|---|---|---|
| (a) | `G13`: el contrato §6.3 dice `V4`; las descomposiciones y `B/20` dicen `B4` | **sí**: `F-8V1C1-011` (contrato:1139 contra `V/descomposicion.md:94` y `B/descomposicion.md:299`) | vigente |
| (b) | `11-particion-del-programa.md` §1 y `DEC-ARCH-005` justifican la partición con «pasarela sin decidir» | no | **vigente**: `11-particion…:22` (*«no sabemos con qué pasarela vamos a cobrar»*) y `01-decision-log.md:2128-2129` (*«no está decidida la pasarela»*), en presente, aunque `11-particion…:287` registra la pasarela decidida (`DEC-MP-005`) |
| (c) | FASE 7 «cinco ítems» contra `16` (4 de 6 pendientes) | no (`F-8V1C2-004` cita `16:232`, *«Cuatro de los seis»*, pero para otra cosa) | **vigente**: `03-handoff.md:79`, `:154` y `:291` dicen *«los cinco ítems»*; `16-fase-7…:232` dice cuatro de seis. `03-handoff.md:96` ya lo anota |
| (d) | criterio de `V4` («`cobrada: no` arranca el trial») al revés del cap. 03 §2 | no (`F-8V1A2-004` es el mismo tipo de error, pero en `V/spec.md:220` y sobre `T8`) | **vigente**: `V/descomposicion.md:484` dice que publicar con `cobrada: no` *«arranca el trial (`T1`)»*; la tabla de `V/03` §2 (fila de `cobrada: no`) dice *«ninguna de las dos»* y la persona sigue en `PRE_TRIAL` |
| (e) | los «nueve pasos» de la autorización son siete más una precondición | no; `A1` repite *«los nueve pasos»* en su intro | **vigente**: `V/docs/17-autorizacion.md:58` (*«nueve pasos y una precondición»*) y la tabla del §1.2 tiene pasos 1–7. `:419` hereda el error: *«siete pasos: todos menos el 5 y el 6»* da siete sólo si fueran nueve; sobre siete, son cinco |

Sólo (a) la vio un agente. Las otras cuatro son texto vencido o mal contado; ninguna mueve plata,
pero (d) está en un **criterio de terminación**: un implementador de `V4` que lo siga escribe un
test que exige el comportamiento que la tabla prohíbe.

---

## 5. Contra la vuelta del 24/09

| | FASE 8 completa (24/09) | vuelta 1 (26/09) |
|---|---|---|
| hallazgos | 133 | **100** |
| CRÍT declarados | 15 | **1** (+2 racimos propuestos) |
| ALTA | 45 | 28 |
| MEDIA | 53 | 47 |
| BAJA | 20 | 24 |
| racimos con CRÍT | 8, más 2 sueltos | 1 declarado, 2 propuestos |

**Clases de causa que desaparecieron.** Ningún agente reabre un mecanismo que la resolución del
25/09 (§5 de `25-fase-8-completa/00-hallazgos.md`) cerró:

- el grace de tarjeta que no arrancaba (R1 del 24/09): sólo queda texto vencido (`F-8V1B1-008`);
- el correo que bloqueaba la cancelación (R5);
- el reloj de `inactiva_desde` que borraba contenido (R9): `A3` y `C2` atacaron el `created_at` y
  el diseño resistió;
- los cupos sin serializar (R14): `A1` y `A2` atacaron dos `PB1` simultáneos y resistieron;
- el trial quemado sin pago en su forma de entonces (R12): `T2`, `T5` y `T6` esperan el cobro;
- la presencia de Partner sin máquina (R13): sólo queda el nombre de la clave (`F-8V1A1-004`).

**Clases que persisten, con otra forma.**

- **Addons sin ciclo de vida** (R6 del 24/09, que tenía un CRÍT): ahora son la cadena `PURGED` →
  `A6` sin cruzar (R2) y los estados sin servicio (R3).
- **La conciliación que ve y no puede escribir** (R7): ahora es el desempate de un solo productor
  (R4), el desconocido sin fila (`F-8V1B3-001`) y el vínculo sin definir (R12).
- **El corte ciego a lo que vive en el proveedor** (R2, 3 CRÍT): ahora es la ventana sin congelar
  (R5), el gate que no ve desconocidos (`F-8V1B3-005`) y la lápida sin fuente (R6).
- **La cobertura que no avisa** (R10): el reconciliador diario la cerró para el daño grande; queda
  el censo de emisores (R9) y el orden respecto del commit (`F-8V1C1-003`).
- **Cortesía y pausa** (R4): la cortesía no vuelve; la pausa sí, por otro mecanismo (vuelta
  anticipada, `F-8V1B1-001`).
- **La regla vieja en el lugar viejo**: sigue siendo la forma más común de los `BAJA` (R11, las
  notas de `K-9` en R2, contradicciones (c) a (e)).

**Clases nuevas.**

- **Una decisión del owner sin camino ejecutable**: `2g` contra la máquina de publicación (R1). Es
  el único CRÍT declarado.
- **El actor que se administra a sí mismo y el bypass de staff** (`F-8V1A1-001`, `-002`, `-003`).
- **La infraestructura del corte**: webhook, imagen vieja en el aborto, ensayo en sandbox,
  herramientas sin unidad (`F-8V1C2-004` a `-008`).
- **La plata del sistema viejo en el corte que sale bien** (`F-8V1C2-002`, última pregunta de
  `F-8V1B3-002`).
- **El inventario real de la frontera** (R8): el contrato es simétrico en su enunciado y no en su
  contenido.

### El veredicto contra `DEC-METH-013`

El criterio es *«se deja de girar cuando la tanda de arreglos anterior dejó de generar
críticos»*, con tope de dos vueltas. **Esta vuelta generó críticos**: uno declarado
(`F-8V1C2-001`) y dos racimos que el consolidador propone subir (R2, R4). Leído al pie de la
letra, **el criterio de corte no se cumple** y queda la vuelta 2, que es la última: si a la
segunda sigue habiendo críticos, se pasa a declarar.

Dos matices que el owner tiene que tener delante, sin que esto decida por él:

- La cláusula 1 exige atribuir cada crítico a la tanda anterior **contra los diffs**. Este
  consolidado no lo hizo. Las citas de R1, R2 y R4 llevan todas la marca *«owner 2026-09-25,
  FASE 9 completa»* (`2g`, `6c`, `K-9`, `2a`), lo que hace plausible que los generó la tanda del
  25/09, pero plausible no es el dictamen que pide la cláusula.
- El único CRÍT declarado lo declaró un solo agente; los otros tres que llegaron a la misma causa
  lo pusieron en `ALTA`. Y los dos propuestos dependen de que el owner acepte la propuesta. Si
  rechaza las dos y la atribución de `F-8V1C2-001` no se sostiene contra el diff, esta vuelta
  **no** generó críticos atribuibles.

La cláusula 4 aplica en cualquier caso: R2 y R4 son de plata y no se declaran con causa sin que
el owner los lea.

---

## 6. Lo que le toca al owner

Cada pregunta sale de un racimo o de un hallazgo suelto. Entre paréntesis, la opción que el diseño
vigente sugiere cuando sugiere una.

1. **R1**: ¿en qué estado nace cada ficha vieja y cómo estrena Juan su trial? (el texto de `2g`
   supone una publicación del dueño: una salida desde `UNPUBLISHED_BY_BILLING` que ejerza `T1`).
2. **R1**: ¿cómo se traduce el estado de moderación viejo (`PENDING`, `REJECTED`) al corte? (sin
   sugerencia).
3. **R2**: ¿se amplía el contrato con el hecho «la ficha llegó a `PURGED`», o `A6` se comprueba
   desde el barrido de billing? (sin sugerencia; `K-9` sólo fijó que `A6` es la única puerta).
4. **R3**: ¿el addon recurrente sigue la suerte de su título suspendido o de su ficha moderada o
   excedente? (hoy sigue cobrando por la decisión 4a).
5. **R4**: ¿el cobro en vuelo de la ventana del corte que sale bien se devuelve? (`DEC-MIG-005`
   no lo cubre; sólo resignó la diferencia del aborto).
6. **R8**: ¿las lecturas y escrituras legítimas entre épicas se declaran en el §4.1, o las
   superficies son una capa de composición fuera de las dos? (el contrato vigente dice que lo no
   declarado es acoplamiento, lo que empuja a declararlas).
7. **R8**: ¿quién resuelve la versión vigente del grant, billing o verticales? (el contrato dice
   que verticales, «el paso 6»; `B/02` dice que el grant).
8. **`F-8V1A1-001`**: ¿una acción administrativa puede tener `actor = sujeto`, y si sí, con qué
   segunda firma? (sin sugerencia; el costo es operativo).
9. **`F-8V1A1-003`**: ¿el admin tiene escrituras sobre fichas ajenas fuera de las catorce acciones?
   (el núcleo dice que no; el cap. 17 y soporte hoy suponen que sí).
10. **`F-8V1A2-003`**: ¿`T7` consume el trial de quien publicó con una suscripción que nunca
    cobró? (`DEC-TRIAL-010` sugiere que no: un alta que no ocurrió no consume).
11. **`F-8V1A2-007`** (junto con R3): ¿el destaque de una ficha moderada o excedente se sigue
    cobrando? (sin sugerencia).
12. **`F-8V1A3-004`**: ¿qué plan anclan los dos grants del owner en el catálogo nuevo? (sin
    sugerencia).
13. **`F-8V1A3-010`**: ¿qué pasa con las reseñas de terceros cuando una ficha llega a `PURGED`?
    (`DEC-DATA-005` sólo dice que la retención toca fichas).
14. **`F-8V1B1-001`**: ¿la vuelta anticipada de una pausa sigue libre, y qué se hace con el ciclo
    que el proveedor salteó? (la premisa de `DEC-SUB-010`, vuelta el mismo día del mes, ya no se
    exige).
15. **`F-8V1B1-002`** (junto con R3): ¿el aviso de suspensión deja de prometer que no se cobra, o
    el complemento se corta? (sin sugerencia).
16. **`F-8V1C2-002`**: ¿qué se hace con el período pagado en el viejo y los addons comprados al
    momento del corte? (sin sugerencia; `2d` es de la rama de aborto).
17. **`F-8V1C2-011`**: ¿la baja unilateral de la cartera va al pliego de la consulta legal, con un
    aviso por correo transaccional? (`B/22` dice que vale la evidencia del envío).
18. **Corte de `DEC-METH-013`**: ¿se aceptan las propuestas de subir R2 y R4, y se dictamina la
    atribución de `F-8V1C2-001` contra el diff antes de decidir la vuelta 2? (la cláusula 1
    exige el diff).

---

## 7. Notas del consolidador

Marcadas como tales: no son hallazgos de ningún agente.

- **Dos lecturas opuestas entre ciegos**: `C2` da por resistido el cobro tardío sobre una lápida
  (*«los tres motivos devuelven plata»*) y `B3` muestra que el barrido llega antes con el motivo
  19, que no devuelve. `C1` da por inocuas las dos definiciones de «cobrada» y `D1` encuentra el
  daño al compartir el predicado. En los dos casos el ataque «resistido» miró un solo productor o
  un solo consumidor.
- **`F-8V1B3-001` cambia el peso de R5**: tres desenlaces del corte (`F-8V1C2-003`,
  `F-8V1B3-006`, y el caso sin lápida de R6) terminan en «llega desconocido y abre la marca», y esa
  marca no se puede escribir. Si se arregla R5 sin `F-8V1B3-001`, el residuo que quede no tiene
  dónde anotarse.
- **La contradicción (d) está en un criterio de terminación**, y (e) la repitió un agente sin
  verla. Los textos vencidos del programa ya no están sólo en prosa lateral: llegan a criterios y
  a las intros de los propios revisores.
- **`F-8V1A2-008` y `F-8V1A2-009`** comparten causa (la regla del lock de `V/03` §9 se aplicó a
  las transiciones de cupo y no a sus vecinas), pero son del mismo agente y no forman racimo.
- **No se corrió el dictamen de atribución** de la cláusula 1 de `DEC-METH-013`: queda como paso
  previo a decidir la vuelta 2 (pregunta 18).

---

## Key Learnings

1. La convergencia más fuerte de esta vuelta (seis de nueve agentes, contando los «fuera de mi
   vector») no es sobre un mecanismo de cobro sino sobre una **decisión del owner ejecutada contra
   un estado sin salida** (`2g` y `UNPUBLISHED_BY_BILLING`): recorrer las decisiones desde el
   estado real del día del corte encuentra lo que recorrer las máquinas desde el estado inicial no.
2. Un arreglo que mueve una responsabilidad entre épicas (`K-9`: el borrado de `A5` a `A6`) deja
   tres eslabones sin actualizar a la vez: el canal en el contrato, las notas del emisor y el
   inventario del glosario. Los guards de conteo no ven ninguno.
3. Las reglas de desempate escritas como enumeración (de transiciones o de estados) y para un
   productor fallan por los dos lados: dejan afuera las filas que no nacen de una transición y al
   segundo productor con default opuesto.
4. «Ataque resistido» en un informe no es garantía cruzada: dos veces un agente dio por resistido
   algo que otro, ciego, rompió mirando otro productor u otro consumidor.
5. Una propuesta de subir severidad conviene apoyarla en dos cosas medibles: número de agentes
   ciegos y si el camino es determinístico o de carrera. La lápida de R4 es determinística; la
   ventana de R5 no es camino principal.
6. El criterio de corte de `DEC-METH-013` se lee por atribución contra diffs, no por conteo: un
   consolidado que cuenta críticos sin dictaminar su origen no alcanza para decidir la vuelta 2.
