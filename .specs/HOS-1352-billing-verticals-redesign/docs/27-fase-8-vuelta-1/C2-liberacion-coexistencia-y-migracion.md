---
title: "FASE 8 vuelta 1 · C2 — liberación, coexistencia y migración"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 1 · C2 — liberación, coexistencia y migración

Ataqué cómo se libera el programa entero y qué pasa en el corte: el orden de los pasos del
`$D/16-fase-7-del-paraguas.md` §4, las dos mitades del capítulo 21, la coexistencia del sistema
viejo con el nuevo (cobros y altas vivas en la ventana, webhooks, contenedores, la rama de aborto),
qué ve la cartera actual el día del corte y en los días siguientes, quién construye las
herramientas del corte según las dos descomposiciones, y lo legal que el corte dispara. Medí contra
las máquinas de `V/03` (trial y publicación), la conciliación de `B/09`, los motivos de `B/05` y la
matriz, y contra el código viejo cuando el corte depende de lo que ese código hace en la ventana.

Son **15 hallazgos**: **1 CRITICA, 2 ALTA, 8 MEDIA y 4 BAJA**. La idea más grave: el trial que
el owner les regala a los clientes actuales (`2g`) no se puede alcanzar por ningún camino
escrito, y el camino que el diseño les indica —contratar— les cobra el primer mes en el acto.

Regla de lectura: cada hallazgo se apoya en una cita textual, copiada literal de una sola línea
del archivo con su `archivo:línea`. `$D`, `$V` y `$B` son las carpetas de la base de reglas;
`CLAUDE.md` y `apps/…` son rutas desde la raíz del worktree.

## CRITICA

### F-8V1C2-001 — El trial que `2g` regala a la cartera actual no es alcanzable, y contratar cobra

**Qué se rompe.** El owner decidió que los clientes actuales se tratan como nuevos y estrenan el
trial. Pero la ficha que el corte deja publicada la baja `PB2` a `UNPUBLISHED_BY_BILLING`, y de
ahí el dueño no tiene transición para volver a publicarla: `PB1` sale sólo de `DRAFT`, `PB6` sólo
de `PUBLISHED`, y `PB3`/`PB7` exigen cobertura. El único camino que el diseño le nombra a esa
persona es *«contratan»*, y el checkout nuevo cobra el primer ciclo sin trial (el trial es local y
arranca con `T1` al publicar). El botón de suscribirse tampoco lo salva: manda a publicar sólo a
quien *«todavía no publicó»*, y qué es haber publicado para quien publicó en el sistema viejo no
está escrito — si cuenta la ficha, lo manda al checkout; si cuenta el registro nuevo, lo manda a
publicar algo que no puede publicar.

**El camino.**

1. Juan tiene una ficha de Alojamiento publicada y una suscripción `trialing` en el sistema viejo.
   El owner lo llama antes del corte: *«se cancela, contratá de nuevo y la ficha vuelve sola»*.
2. Corre el corte. Juan amanece en `PRE_TRIAL` sin fila de `trial`, con la ficha `PUBLISHED`.
3. Dentro del primer día, el reconciliador diario corre `PB2`: la ficha pasa a
   `UNPUBLISHED_BY_BILLING`.
4. Juan quiere su trial regalado. No tiene ningún `DRAFT` en esa vertical, así que no hay `PB1`
   que dispare `T1`. Su ficha no se puede volver a publicar a mano.
5. Juan aprieta *«suscribirme»*. Como ya publicó, el botón lo manda al checkout (fila 23). Paga el
   primer mes en el acto. La ficha vuelve por `PB3`. El trial que el owner le regaló no existió.
6. La única salida escrita hacia el trial es esperar 90 días a que `PB4` archive la ficha, `PB8`
   la reactive a `DRAFT` y `PB1` dispare `T1`; o, dentro del primer día y antes del reconciliador,
   despublicar a mano (`PB6`) y republicar — un truco que nadie le va a decir.

No hay detector: nada compara lo que el owner decidió regalar con lo que el checkout cobró.

**La evidencia.**

| archivo:línea | cita |
|---|---|
| `$V/docs/21-migracion.md:75` | «nuevo: los tomamos como clientes nuevos. Sólo les respetamos la ficha para que no la tengan que» |
| `$V/docs/21-migracion.md:153` | «se los llama, contratan, y la ficha vuelve sola por `PB3` cuando la cobertura vuelve.» |
| `$V/docs/21-migracion.md:155` | «publicar —o el botón de suscribirse, que manda a publicar a quien todavía no publicó en esa» |
| `$D/16-fase-7-del-paraguas.md:171` | «—es una consecuencia, no una falla (`V/21` §2.4)— y vuelven solas cuando cada dueño contrata.» |
| `$V/docs/03-maquinas-de-estado.md:516` | «el dueño no la republica —`PB1` sale sólo de `DRAFT`— y el sistema tampoco» |
| `$V/docs/19-superficies.md:69` | «El checkout queda para quien ya publicó o ya consumió su trial» |
| `$B/docs/19-superficies.md:137` | «y la regla de qué es *«publicó»* es de verticales» |
| `$V/docs/03-maquinas-de-estado.md:364` | «encendido sigue resolviendo a quien ejerció el evento **en el sistema nuevo**.» |

Nota: en la tabla de `V/03` §9 (líneas 506 a 517) `PB6` sale de `PUBLISHED` y `PB1` de `DRAFT`;
ninguna fila sale de `UNPUBLISHED_BY_BILLING` por acto del dueño. La cita de `:516` es la que lo
afirma en prosa.

**Qué haría falta decidir o escribir.** Una decisión del owner sobre cómo se ejecuta `2g`: o una
transición del dueño de `UNPUBLISHED_BY_BILLING` a `DRAFT` (o a publicar disparando `T1`), o que
el corte no deje la ficha llegar a `PB2` antes de que el dueño pueda estrenar el trial, o que el
checkout de un cliente actual arranque el trial. Y escribir, en verticales, qué es *«publicó»*
para quien sólo publicó en el sistema viejo, porque de eso depende a dónde lo manda el botón.

## ALTA

### F-8V1C2-002 — Lo que Juan pagó en el sistema viejo por un período o un addon que el corte corta, se pierde sin decisión

**Qué se rompe.** Desde el 2026-09-26 el sistema viejo cobra, y cobra por adelantado: el primer
cobro de cada alta cubre el mes que empieza. El corte cancela ese preapproval, descarta los pagos y
las compras de addon, y deja la ficha abajo dentro del primer día. Lo que queda del mes pagado —y
de un destaque de 30 días comprado la semana anterior— no se devuelve, no se prorratea y no se
compensa por escrito: `2d` (*«la diferencia no se devuelve»*) es de la rama de aborto, no del corte
que sale bien. El derecho de revocación de `B/22` §2.2 tampoco se puede ejercer sobre un pago que
el sistema nuevo no conoce. Y el aviso va antes del paso 1, mientras los links viejos todavía
venden: quien entiende *«contratá»* y contrata en ese momento paga en el sistema viejo un mes que
el corte le cancela días después.

**El camino.**

1. El compromiso 2 de `B/21` §3.1 cobra el 2026-11-25 el primer mes de Juan.
2. El corte se hace el 2026-12-05. El paso 1b cancela su preapproval; el paso 3 deja de leer
   `billing_*`; el reconciliador baja su ficha ese día.
3. Juan pagó veinte días que no recibe. No hay fila suya en el sistema nuevo contra la cual pedir
   un reembolso, ni comprobante que presentar (el `B/21` lo declara para contracargos, no para
   el período no usado).
4. Variante: Juan compró el `visibility-boost-30d` el 2026-12-01. El corte descarta la compra.

**La evidencia.**

| archivo:línea | cita |
|---|---|
| `$B/docs/21-migracion.md:276` | «los hay desde el 2026-09-26, bajo el sistema viejo (§1.3), y» |
| `$B/docs/21-migracion.md:281` | «`billing_*` entero (suscripciones, pagos, compras de addon, canjes de promo), los grants de» |
| `$B/docs/21-migracion.md:299` | «Un contracargo o un reclamo sobre un pago del sistema viejo no tiene comprobante del lado de» |
| `$D/16-fase-7-del-paraguas.md:171` | «**El aviso va ANTES del paso 1**, no después: es lo único que» |
| `$B/docs/22-lo-legal.md:101` | «**una sola operación** —reembolso total **más** cancelación—, porque está medido que reembolsar» |
| `CLAUDE.md:264` | «the paid path and nothing else, and `scripts/check-no-trial-to-mercadopago.sh`» |

**Qué haría falta decidir o escribir.** Decisión del owner: qué se hace con el período pagado y
no usado y con los addons comprados en el sistema viejo al momento del corte (devolver, compensar
con días, o aceptarlo por escrito con su causa). Y que el guion del aviso diga cuándo contratar,
para que nadie contrate en el sistema viejo después del aviso. Si se devuelve, el insumo es la
lista de pagos que la re-verificación de `B/21` §1.3 ya recorre antes de descartar las tablas.

### F-8V1C2-003 — El checkout viejo sigue vendiendo después del censo, y lo que vende sobrevive al corte

**Qué se rompe.** El paso 1a cierra los links de `preapproval_plan`, pero el checkout de la app
vieja ya no usa planes: desde HOS-1221 crea el preapproval sin plan. Nada en el §4.2 congela las
altas del sistema viejo entre el censo del paso 1b y el apagado del paso 3, y `DEC-MIG-002` las
mantiene abiertas. Un preapproval creado en esa ventana no está en el censo, no se cancela, no
tiene lápida y sigue cobrando en el sistema nuevo. Su `external_reference` es del sistema viejo,
así que cae en la marca `TRANSICIÓN_NO_DECLARADA` recién cuando cobra, un mes después; el primer
pago ya lo anotó el viejo y se descartó con sus tablas.

**El camino.**

1. A las 10:00 corre el paso 1b; a las 10:20 cierra el paso 2.
2. A las 10:30 Juan entra al sitio viejo, que todavía corre, y se suscribe. El checkout crea su
   preapproval sin plan y le cobra el primer mes.
3. A las 11:00 se apaga el contenedor viejo y se despliega. El pago de Juan se pierde con las
   tablas viejas.
4. Juan amanece en `PRE_TRIAL`, sin suscripción en el sistema nuevo; su ficha baja.
5. Un mes después MP le cobra de nuevo. El webhook llega por un preapproval desconocido, abre la
   marca y lo mira una persona. Juan pagó dos meses por un servicio que el sistema nuevo nunca
   supo que tenía.

**La evidencia.**

| archivo:línea | cita |
|---|---|
| `apps/api/src/services/billing/paid-subscription-create.ts:142` | «HOS-1221 stopped sending the plan (MercadoPago rejects that request), so» |
| `$D/16-fase-7-del-paraguas.md:145` | «**La ventana entre el paso 1 y el paso 3 es la parte incómoda, y se declara**: durante ese rato el» |
| `$D/16-fase-7-del-paraguas.md:147` | «registra el viejo~~ las suscripciones del censo canceladas. Si entra un cobro en vuelo de una que» |
| `$B/docs/09-conciliacion.md:74` | «nombra una que ya tiene su vínculo vivo— **no se re-vincula: abre la marca con motivo» |
| `$B/docs/21-migracion.md:277` | «**no se conservan** (FASE 9 completa, `CT-6` y `2a`).» |

**Qué haría falta decidir o escribir.** Un paso del corte, antes del 1b, que cierre las altas del
sistema viejo (checkout apagado o en mantenimiento) y se verifique como el apagado de webhooks del
`DB-5`; o que el control del paso 2 se repita inmediatamente antes de apagar el viejo. La ventana
que el §4.2 declara hoy sólo habla de cobros de lo que ya estaba en el censo.

## MEDIA

### F-8V1C2-004 — Las herramientas del corte no son de ninguna unidad ni tienen camino a producción

**Qué se rompe.** El paso 1b lo tiene que ejecutar *«el sistema viejo»*: un recorrido sin filtro
de todos los preapprovals, la cancelación de cada uno y la verificación con el `total` del
paginado. Ese código no existe hoy en el sistema viejo, y ninguna descomposición lo asigna:
`B/descomposicion.md` manda el corte a `D/16` §4.2, y el `D/16` deja `rollout`, `coexistence`,
`feature flags` y `acceptance gates` pendientes. Lo mismo vale para la escritura de las lápidas y
de los dos grants. Además, el paso 0 exige que el paraguas esté en staging, y una vez ahí el flujo
de ramas no promueve nada de staging a main sin promover el paraguas: la herramienta del viejo
tendría que entrar antes o por la excepción de hotfix, que el diseño no nombra.

**El camino.** El día del corte no hay script de censo desplegado en producción. El operador
recorre y cancela a mano contra la API: exactamente el caso que el §4.2 dice existir para evitar.
Un preapproval de Juan se saltea y cobra después del corte.

**La evidencia.**

| archivo:línea | cita |
|---|---|
| `$B/descomposicion.md:765` | «**B11**; el resto, el corte del paraguas, es de `D/16` §4.2 (declarado por `DEC-METH-015`, FASE 9» |
| `$D/16-fase-7-del-paraguas.md:232` | «lo que hace al orden del corte.~~ **Cuatro de los seis ítems huérfanos** —`rollout`, `coexistence`,» |
| `$D/16-fase-7-del-paraguas.md:156` | «API del proveedor, sin idempotencia, sin registro y sin nadie que verifique — y es el caso que este» |
| `CLAUDE.md:730` | «ONLY when the user explicitly says so (after soak time in staging), merge `staging` → `main`.» |

**Qué haría falta escribir.** Una unidad (o una tarea del paraguas) dueña de las herramientas del
corte —censo, cancelación, verificación, lápidas, grants— y el camino por el que la mitad que
corre en el sistema viejo llega a producción antes de que el paraguas entre a staging.

### F-8V1C2-005 — La lápida: quién la escribe, sobre qué ids y anclada a qué plan

**Qué se rompe.** Tres documentos dicen tres cosas. La tabla del §4.2 dice que el paso 4 lo hace
*«el sistema nuevo»* sobre *«los ids cancelados»*; el mismo § dice que es *«la única escritura a
mano»*; `B/21` dice que *«la escribe una persona»* y que el id que sólo estaba en el proveedor
queda *«sin lápida»*. Y una `subscription` exige `user`, versión de plan anclada y billing option:
los planes viejos (`owner-basico`, `owner-pro`…) no existen en el catálogo nuevo, y un id que sólo
estaba en el proveedor no tiene `user` conocido.

**El camino.** El operador siembra la lápida del preapproval de Juan. No hay versión de plan a la
cual anclarla; ancla a la versión vendible actual. Cuando llega el cobro tardío, el barrido compara
contra ese plan un monto que no le corresponde y la marca dice otra cosa que *«cancelado durante el
corte»*.

**La evidencia.**

| archivo:línea | cita |
|---|---|
| `$D/16-fase-7-del-paraguas.md:126` | «**sembrar las lápidas** (`B/21` §2.5) con los ids cancelados» |
| `$D/16-fase-7-del-paraguas.md:160` | «a mano del corte. Las otras dos —`inactiva_desde` en toda ficha preexistente (`V/21` §2.4) y los» |
| `$B/docs/21-migracion.md:172` | «ninguna cifra del cap. 09: la escribe una persona, sin idempotencia ni registro de nuestro lado,» |
| `$B/docs/21-migracion.md:153` | «lápida porque su id sólo estaba en el proveedor, una sonda que siguió viva— no la nombra y termina» |
| `$B/docs/02-modelo-de-datos.md:47` | «`user`, vertical, versión de plan anclada, billing option, estado, **la fecha del próximo cobro**» |

**Qué haría falta escribir.** Quién la escribe (sistema o persona), el conjunto exacto (sólo ids
con `user` conocido, o todos), y qué valores toman las columnas no anulables de una lápida.

### F-8V1C2-006 — El ensayo del paso 0 es en otra cuenta del proveedor y le asignan verificar producción

**Qué se rompe.** Staging corre contra el sandbox; el censo, la cancelación, la reactivación de
planes y la completitud del recorrido operan sobre la cuenta de producción. La rama de aborto le
delega al ensayo del paso 0 verificar que el link de un plan reactivado vuelve a vender, y `EX-40`
lo midió en producción sin medir eso ni qué pasa con los suscriptores de un plan cancelado —que es
el orden 1a antes de 1b—. Un ensayo en sandbox no puede cerrar ninguna de las dos.

**El camino.** El paso 2 falla; se aborta; se reactivan los planes; el link de Juan no vende en el
navegador de producción; Juan no se puede re-suscribir y su ficha queda abajo sin corte.

**La evidencia.**

| archivo:línea | cita |
|---|---|
| `$D/16-fase-7-del-paraguas.md:119` | «**el despliegue, ensayado en staging y verde**» |
| `$D/16-fase-7-del-paraguas.md:195` | «navegador**: se verifica en el ensayo del paso 0.» |
| `$D/06-mp-validation-matrix.md:396` | «No mide: qué les pasa a los suscriptores existentes de un plan cancelado (la documentación dice que siguen cobrando),» |

**Qué haría falta escribir.** Qué parte del paso 0 corre contra producción (una sonda sobre un plan
propio, como la 50) y qué gate cierra la verificación del link reactivado antes del paso 1a.

### F-8V1C2-007 — La rama de aborto supone al viejo corriendo, pero el corte lo apagó y reemplazó

**Qué se rompe.** `DB-5` apaga el contenedor viejo (webhook y crons) antes de desplegar, y el
despliegue reemplaza su imagen. La rama de aborto dice que el viejo *«sigue corriendo»* y que,
restaurado el backup, *«vuelve a correr»*: volver a desplegar la imagen vieja y reencender webhook
y crons no es un paso, y lo que el contenedor nuevo alcanzó a confirmar a MP entre el paso 3 y el
aborto se pierde para el viejo.

**El camino.** El paso 3 falla a mitad de la migración. Se restaura el backup, pero en Coolify
queda la imagen nueva a medio levantar y el viejo apagado. Juan no puede re-suscribirse por el link
reactivado porque no hay sistema que registre el alta.

**La evidencia.**

| archivo:línea | cita |
|---|---|
| `$D/16-fase-7-del-paraguas.md:134` | «**Durante el rollout del paso 3 el contenedor viejo no atiende el webhook ni corre crons**: se» |
| `$D/16-fase-7-del-paraguas.md:196` | «2. El sistema viejo **sigue corriendo**: ~~no se desplegó nada.~~ **si el paso 3 alcanzó a escribir» |

**Qué haría falta escribir.** Los pasos de la rama de aborto sobre la infraestructura: redeploy de
la imagen vieja, reencendido de webhook y crons, verificación de ambos.

### F-8V1C2-008 — Ningún paso apunta ni verifica a dónde llega el webhook después del corte

**Qué se rompe.** Las preapprovals de producción no tienen `notification_url`: los webhooks van a
la URL configurada en la aplicación del proveedor. Si el handler nuevo no vive en esa misma ruta,
todo evento posterior al corte —incluidos los cobros tardíos que la lápida existe para reconocer—
cae en un 404 y se pierde por supersesión (`WH-5`). El §4.2 apaga el webhook viejo y no dice nada
del nuevo.

**El camino.** Juan contrata en el sistema nuevo el día del corte. Su autorización emite el
webhook a la ruta vieja; el handler nuevo está en otra. La fila queda esperando al barrido diario
y Juan no ve su suscripción activa hasta el día siguiente.

**La evidencia.**

| archivo:línea | cita |
|---|---|
| `$D/06-mp-validation-matrix.md:269` | «**las 108 preapprovals de producción son de `1890101689209057` y ninguna tiene `notification_url`**» |
| `$D/16-fase-7-del-paraguas.md:135` | «apagan antes de desplegar y se verifica como parte del paso (declarado por `DEC-METH-015`, FASE 9» |

**Qué haría falta escribir.** Un paso del corte (o del paso 0) que fije la URL del webhook de la
aplicación y verifique una entrega real al handler nuevo.

### F-8V1C2-009 — La lista de llamados son tres personas, y la población que pierde fichas es otra

**Qué se rompe.** El aviso previo es lo único que acota cuánto queda abajo cada ficha, y el diseño
lo dirige a *«las tres personas»*. Pero el reconciliador baja la ficha publicada de **todo** dueño
sin título: el inventario cuenta 12 alojamientos contra 3 suscripciones vivas de dueño y 2
cortesías del owner, y la re-verificación
de `B/21` §1.3, que existe *«para saber a quién hay que llamar»*, cuenta tablas de billing y no
fichas por dueño. Además, el *«cero»* de gastronomía, experiencia y partner que sostiene `V/21` §4
no sale de ninguna consulta reproducible del inventario.

**El camino.** Juan cargó una ficha de Alojamiento con ayuda del owner y nunca tuvo suscripción
(o abandonó el checkout). No está entre los tres. El día del corte su ficha desaparece sin aviso;
se entera por el aviso de archivado del día 90.

**La evidencia.**

| archivo:línea | cita |
|---|---|
| `$V/docs/21-migracion.md:343` | «**Cómo se le avisa a las tres personas y cuándo se cancelan sus suscripciones** es FASE 7: acá» |
| `$B/docs/21-migracion.md:70` | «owner 2026-09-25, FASE 9 completa, `2a`): es para saber **a quién hay que llamar** y qué le toca» |
| `$D/07-facts-inventory.md:149` | «UNION ALL SELECT 'alojamientos', count(*)::text FROM accommodations WHERE deleted_at IS NULL;» |
| `$V/docs/21-migracion.md:323` | «**Gastronomía, experiencia y partner**: cero filas. El rediseño de esas tres verticales no» |

**Qué haría falta escribir.** Que la re-verificación previa al corte cuente fichas publicadas por
dueño en las cinco verticales, y que el aviso vaya a esa población y no sólo a los suscriptos.

### F-8V1C2-010 — Qué hace el sistema viejo con sus propias cancelaciones en la ventana no está escrito

**Qué se rompe.** El paso 1b cancela desde el viejo, que sigue corriendo. Su webhook de
cancelación manda el correo de *«suscripción cancelada»* y dispara su reconciliador, que baja las
fichas del dueño. El §4.2 describe la ventana sólo en términos de cobros, y describe la
despublicación como obra del reconciliador nuevo, *«dentro del primer día»*. Lo que Juan ve —un
correo automático de baja horas después de la llamada del owner, y la ficha abajo antes del
despliegue— no está declarado, y el guion del aviso no lo puede anticipar.

**El camino.** El owner llama a Juan a la mañana. A las 10:00 corre el 1b; a las 10:01 le llega a
Juan un correo del sistema viejo diciendo que su suscripción se canceló, y su ficha se baja. Si el
aborto se dispara, la ficha queda abajo en el viejo sin que nadie la republique.

**La evidencia.**

| archivo:línea | cita |
|---|---|
| `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts:210` | «Sends for transitions TO cancelled, except when the subscription was already» |
| `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts:1422` | «(HOS-1181) republishes whatever billing had taken down now that they» |
| `$D/16-fase-7-del-paraguas.md:146` | «sistema viejo sigue corriendo con ~~tres suscripciones canceladas. Si entra un cobro en vuelo, **lo» |

**Qué haría falta escribir.** Si en la ventana se suprimen los correos y el reconciliador del
viejo, o se declara lo que Juan va a ver para que el aviso lo diga.

### F-8V1C2-011 — El aviso del corte no deja la evidencia que el propio capítulo legal exige

**Qué se rompe.** El corte es una baja unilateral más una despublicación, y el aviso es una
llamada. `B/22` fija que lo que decide un reclamo es la evidencia del envío y que el canal es el
correo transaccional con registro en el outbox. El corte no figura en el pliego legal ni tiene
plantilla ni fila de outbox.

**El camino.** Juan reclama que nunca le avisaron que su suscripción se cancelaba. Hospeda no tiene
más prueba que la memoria del owner.

**La evidencia.**

| archivo:línea | cita |
|---|---|
| `$B/docs/22-lo-legal.md:53` | «avisaron, lo que vale es la evidencia del envío»*.» |
| `$B/docs/22-lo-legal.md:73` | «**Correo transaccional**, por lo mismo. No una notificación dentro del producto, que no deja» |
| `$V/docs/21-migracion.md:344` | «está que no se migra, no el procedimiento de la conversación.» |

**Qué haría falta escribir.** Un aviso del corte por correo transaccional, registrado, además de la
llamada; y decidir si la baja unilateral de la cartera va al pliego de la consulta legal.

## BAJA

### F-8V1C2-012 — El paso 3b no alcanza a evitar lo que dice evitar

**Qué se rompe.** Los grants se escriben después de desplegar. Si el reconciliador diario corre
entre el paso 3 y el 3b, las dos cuentas del owner pasan por `cubierto` falso igual. Además el
mismo § dice que los grants los hace *«el sistema nuevo en el paso 3»*, contra la tabla que los
pone en el 3b.

**El camino.** El deploy termina a las 03:55 y el cron corre a las 04:00; el operador escribe los
grants a las 04:10. Las fichas de las dos cuentas bajan y vuelven.

**La evidencia.**

| archivo:línea | cita |
|---|---|
| `$D/16-fase-7-del-paraguas.md:125` | «antes del paso 4, para que esas dos cuentas no pasen por `cubierto` falso» |
| `$D/16-fase-7-del-paraguas.md:161` | «dos `permanent_grant` del paso 3b— las hace el sistema nuevo en el paso 3** (FASE 9 completa,» |

**Qué haría falta escribir.** Que el reconciliador no corra hasta cerrar el 3b, o aceptar el
residuo por escrito.

### F-8V1C2-013 — El cobro tardío sobre una lápida cae en el motivo comodín

**Qué se rompe.** El desempate de `B/05` enumera transiciones para `COBRO_POSTERIOR_A_LA_BAJA`, y
la lápida no nace de ninguna: cae en `PAGO_TARDÍO_RECHAZADO`. Es la trampa que `B/21` advierte
sobre las enumeraciones. Las dos devuelven plata; cambia lo que ve quien lo resuelve.

**El camino.** Llega un cobro tardío del preapproval de Juan; la marca dice *«pago tardío»* en vez
de *«acto nuestro que dejó cobrando»*, y la persona no revisa la cancelación del corte.

**La evidencia.**

| archivo:línea | cita |
|---|---|
| `$B/docs/05-idempotencia-y-concurrencia.md:307` | «`S11`/`S12`, `S17`, `S21`, `S22`, `S23`, `S24`, `S25`, `S27`, `S31` o el espejo del `B/03` §10.1» |
| `$B/docs/21-migracion.md:181` | «no aparece en ninguna enumeración de transiciones.» |

**Qué haría falta escribir.** Agregar la lápida a esa fila del desempate.

### F-8V1C2-014 — La lista de lo que se retira omite `partner_subscriptions`

**Qué se rompe.** Los partners viven en su propia tabla, fuera de `entity_subscriptions`, con su
propio reconciliador. `B/21` §4 enumera lo que se retira y no la nombra.

**El camino.** Tras el corte queda una tabla con el estado viejo del partner de Juan que nadie lee
y alguien, un día, vuelve a leer.

**La evidencia.**

| archivo:línea | cita |
|---|---|
| `CLAUDE.md:402` | «writing its own `partner_subscriptions` table (partners are NOT in» |
| `$B/docs/21-migracion.md:282` | «destaque, `entity_subscriptions` y las columnas denormalizadas que el código de hoy lee, como» |

**Qué haría falta escribir.** Nombrarla en la lista.

### F-8V1C2-015 — El §1 y el §3 del documento del corte siguen diciendo que el rollback no existe

**Qué se rompe.** Texto vencido: el rollback quedó decidido en el §4.3, y el §1 y el §3 siguen
afirmando que la palabra no aparece en ningún documento.

**El camino.** Juan no se entera; un implementador que lee el §1 cree que el rollback está abierto.

**La evidencia.**

| archivo:línea | cita |
|---|---|
| `$D/16-fase-7-del-paraguas.md:47` | «Cuatro de los seis tienen **cero apariciones en todo el diseño del programa**: `rollout`,» |
| `$D/16-fase-7-del-paraguas.md:72` | ««rollback» sin aparecer en un solo documento de diseño del programa**.» |

**Qué haría falta escribir.** Actualizar o tachar las dos frases.

## Ataques que intenté y el diseño resistió

- **Cobro viejo que se imputa a la suscripción nueva de la misma persona**: la precondición de
  re-vinculación (`B/09` §2.4) lo manda a persona, porque la fila nueva tiene su vínculo vivo.
- **Lápida escrita antes de cancelar**: el orden está fijado (cancelar, verificar, después
  escribir) y el paso 2 es gate.
- **Fichas viejas borradas en la primera corrida por su `created_at`**: la escritura `C` pone
  `inactiva_desde` en el instante del corte, y el aborto restaura el backup para que el reintento
  use su propio instante.
- **Censo tomado de la base**: sale del recorrido sin filtro del proveedor y el paso 2 exige que el
  conteo iguale el `total` y contenga todo id conocido.
- **Una épica liberada sin la otra**: `DEC-ARCH-007` lo excluye y el guard de `V4` impide que la
  implementación de arranque llegue a producción.
- **El cobro tardío sobre una lápida sin devolución**: los tres motivos de `B/05` devuelven plata.

## Fuera de mi vector

- Turista: con el corte los 22 usuarios amanecen en `PRE_TRIAL` de Turista; si tienen datos por
  encima del límite de la versión de pre-trial (colecciones, favoritos), qué pasa con el excedente
  no lo miré. Le toca a entitlements y limits.
- La pricing y las páginas cacheadas en Cloudflare con precios y links viejos después del corte:
  no hay paso de invalidación global en el §4.2. Le toca a superficies/caché.
- El guard de `V4` falla *«sobre un build destinado a producción»*; si el build de staging del
  paso 0 cuenta como tal no está escrito. Le toca a quien revise el contrato.

## Key Learnings

1. Una decisión que regala algo (`2g`) hay que recorrerla contra las máquinas: el trial nace sólo
   de `PB1` desde `DRAFT`, y la población a la que se lo regalan amanece en un estado que no tiene
   `DRAFT`.
2. El sistema viejo ya no usa `preapproval_plan` para vender (HOS-1221): cerrar los planes no cierra
   las altas, y el censo es una foto.
3. Los pagos por adelantado del sistema viejo convierten *«no se conserva nada»* en plata no
   devuelta por el período no usado; `2d` sólo cubre la rama de aborto.
4. Las herramientas que el corte le pide al sistema viejo no tienen unidad ni camino de ramas: el
   paraguas en staging bloquea la promoción normal de cualquier cambio del viejo.
5. Las preapprovals de producción no tienen `notification_url`; la URL del webhook es de la
   aplicación y el corte no la toca.
