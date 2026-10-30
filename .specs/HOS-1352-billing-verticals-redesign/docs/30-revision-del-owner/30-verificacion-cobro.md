---
title: "Revisión del owner · verificación corta de lo aplicado: el cobro"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · verificación corta de lo aplicado: el cobro

Verificación adversarial, de sólo lectura, del tramo del cobro de lo aplicado desde la revisión del
owner (registros `13-`, `18-`, `28-` y `29-`; decisiones `10-`, `16-` y `27-`). Leído en el worktree
`hospeda-spec-hos-1352-billing-redesign`, sin editar el diseño. Abreviaturas: `B/` es
`HOS-1354…/docs`, `D/12` el contrato, `D/16` la FASE 7 del paraguas, `nucleo/` el núcleo, `$B/` y
`$D/` las raíces. Cada mecanismo se corrió contra su dominio entero: los estados de la fila, los
actores, los caminos por los que llega y se va, y el corte.

## 1. Qué se verificó

| # | mecanismo | dominio corrido | veredicto |
|---|---|---|---|
| 1a | `S37` (la mutación de la migración, 7 días antes) | `ACTIVE`, `GRACE_PERIOD`, `PAUSED` (las dos pausas, la cortesía temporal incluida), `SUSPENDED` de tarjeta y de pago manual, `CANCEL_SCHEDULED` por `S11` y por `S7`, terminales (`S12`, `S13`, `S23`, `S24`, espejo de una baja del proveedor, L-A), sucesora de tarjeta antes y después de `S37`, pagador manual, `PARA_RESOLVER`, cohorte con el propio `SUPER_ADMIN`, cancelar la migración antes y dentro de los 7 días, el barrido de montos en la ventana `S37`→`S38` | **HALLAZGO** (`VC-cobro-01`, `02`, `03`, `11`) |
| 1b | `S38` (la cola de cambios programados) | `ACTIVE`, `GRACE_PERIOD` (se aplica), `SUSPENDED` (espera a `S7`), `PAUSED` (espera a `S10`), `CANCEL_SCHEDULED` de `S7` (se aplica) y de `S11` (colisión 3), terminal (se descarta), sucesora de tarjeta (muere con la vieja), las cuatro colisiones del `B/12` §2.2, el censo de emisores de `D/12` §3.1 | **LIMPIO** |
| 1c | el conteo de transiciones vivas | recontadas las filas `S<n>` sin tachar de `B/03` §3.2 (38 − 4 retiradas = 34) y el reparto por unidad de `$B/descomposicion.md` §2 (B3 6, B7 5, B8 12, B9 4, B10 4, B12 1, B5 2 = 34); `$B/spec.md` dice `S1`–`S38` | **LIMPIO** |
| 2 | `A7` (un rechazo cierra la compra de pago único) | `EX-30`, `EX-41`, `EX-55`; el candado de `DEC-CONC-001` (clave persistida antes, `UNIQUE(pedido)`); `A3` y su reenvío; la comprobación de órdenes pagadas del barrido; doble clic; segundo intento concurrente; un `402` que no llega (timeout); `D5`/`D17` | **HALLAZGO** (`VC-cobro-05`, `06`) |
| 3 | `provider_notification` | el receptor procesa sólo el `payment` de Webhooks; nadie la lee (tampoco el receptor para deduplicar); el orden guardar/procesar y la regla del error; el paso 4b del corte y su vuelta atrás; los 180 días en `nucleo/02` §1.5 y `B/02` §4.1; `G17` (c) y el criterio de `B1` | **HALLAZGO** (`VC-cobro-07`, `08`) |
| 4 | la copia del pagador en `receipt` (K-A) | cobro sobre una lápida, addon de pago único, cuota manual (`MP1`, `MP4`), reembolso (no emite), la acción 24, un cobro que llega después de la acción 24 | **HALLAZGO** (`VC-cobro-09`) |
| 5 | la lectura por id con su instante (caso 35) y la interfaz del reloj | `D17`, `G17` (b), el barrido por sujeto, la acción administrativa (instante de la confirmación), `S37`; el reloj en el package del contrato, `G14`, la raíz de `apps/api`, `B1` | **LIMPIO** |
| 6a | `card_validation` de ARS 0 | autorización (`PA-3`), cambio de tarjeta (`EX-36`), tarjeta nueva rechazada, llegada por IPN, el camino de la huérfana (que es sólo para preapprovals) | **LIMPIO** |
| 6b | *«un error al crear no prueba que no se creó»* y `payer_id` | alta por checkout, `/v1/orders`, barrido de creaciones sin respuesta por `payer_email`; ningún vínculo por `payer_id` en el diseño | **LIMPIO** |
| 6c | L-A (la baja desde la app de Mercado Pago corta en el acto) | `B/12` §1.4 y su «NO cierra», el par `cancelled` × vivo de `B/03` §10.1, `DEC-SUB-009`, `B/19` §5, `B/22`; desde `ACTIVE`, `PAUSED`, `GRACE_PERIOD` y la predecesora de una sucesión | **HALLAZGO** (`VC-cobro-10`; y cruza `VC-cobro-01`) |
| 7a | el package del cobro con dependencias internas (caso 30) | `$B/spec.md` §3.1, `D/16` §4.5, `B/20` §2, `$B/descomposicion.md` `B1`, el log (el 📌 posterior precisa al anterior) | **LIMPIO** |
| 7b | `G16` | su predicado (a) contra el sistema viejo, que corre con `qzpay` hasta el corte | **HALLAZGO** (`VC-cobro-04`) |

**Fuera del diseño**: el registro `29-` § 3 dice *«las 33 transiciones vivas de la suscripción»*;
el diseño dice 34 y es correcto (entró `S38` con `18-`). No es un espejo del diseño.

## 2. Hallazgos

### VC-cobro-01 · BLOQUEA · una fila de alcance `PENDIENTE` sobre una suscripción que se va por otro camino no tiene salida

**El caso.** Juan está en un plan retirado y recibe el aviso de la migración. El día 10 del aviso
cancela desde la app de Mercado Pago: por L-A su fila pasa a `CANCELLED` en el acto. Su fila de
alcance sigue `PENDIENTE`: nadie la mueve, porque `FUERA` tiene dos motivos y ninguno lo escribe una
transición. A 30 y a 7 días de una renovación que ya no existe le llegan los correos no suprimibles
*«tu plan cambia»*; si el `SUPER_ADMIN` cancela la migración, le llega *«ya no cambia nada»*.

Lo mismo le pasa a toda fila que termina por un camino que no es *«cambió de plan»* ni *«se dio de
baja»* por su cuenta: la baja del proveedor (antifraude, o su panel), `S13` (un grant que cancela
toda fila principal), el pagador con tarjeta suspendido que vuelve como sucesora **antes** de `S37`
(la vieja termina y la sucesora nace en un plan vendible), `S12` tras un `CANCEL_SCHEDULED` de `S7`,
y una `PENDING_AUTHORIZATION` de la cohorte que termina `ABANDONED`. **Ninguna transición de
`B/03` escribe `FUERA`** (grepeado: la palabra sólo aparece en `B/10` §3.7 y en `B/02` §2.2), y
qué estados entran a la cohorte al anunciar tampoco está escrito.

- `B/02:62` «el motivo de un `FUERA` (cambió de plan o se dio de baja)»
- `B/10:208` «Si el cliente cambia de plan o se da de baja por su cuenta durante el aviso, sale de la migración»
- `B/03:187` «Pausadas y en grace no corren acá»
- `B/03:2759` «y la que la persona da desde su cuenta de Mercado Pago cae acá»
- `B/12:141` «se espeja como una del proveedor: corta en el acto»
- `B/03:163` «toda fila viva PRINCIPAL»
- `nucleo/07:239` «30 días y 7 días antes de la fecha de renovación de ese cliente»
- `nucleo/07:240` «a cada cliente que todavía no se aplicó»

**Recomendación.** Una regla que no dependa de por qué terminó la fila:

1. **Toda llegada a un estado terminal** (y la muerte de la predecesora en una sucesión) **pasa su
   fila de alcance `PENDIENTE` a `FUERA`**, con un tercer motivo, *«terminó»*, en el mismo acto.
   Una regla, un lugar; los correos dejan de salir porque leen `PENDIENTE`. Con L-A la baja desde
   Mercado Pago cae acá sin tener que distinguirla.
2. **Que los correos y `S37` relean el estado de la suscripción** y salteen las terminales, sin
   tocar la fila de alcance. Más barato, pero deja filas `PENDIENTE` para siempre y el `UNIQUE`
   parcial las sigue contando como migración viva.

Recomiendo la 1, y escribir en la misma línea qué estados entran a la cohorte al anunciar.

### VC-cobro-02 · BLOQUEA · la migración no tiene regla para el pagador manual

**El caso.** Juan paga por transferencia (pagador manual) un plan retirado. `S37` exige releer el
preapproval y leerlo `authorized`; Juan no tiene preapproval, así que `S37` no ocurre nunca, no se
encola el cambio de versión y `S38` no tiene qué aplicar. Recibe los tres correos con *«precio
nuevo»* y *«fecha»*, y la fecha pasa sin que cambie nada; su fecha de aplicación no se recalcula,
porque eso sólo se hace en `PAUSED` y `GRACE_PERIOD`. Para él no hay monto que mutar: su cuota sale
de la versión anclada, así que la migración entera es el cambio de versión.

- `B/03:187` «Relee el preapproval por id antes de actuar»
- `B/03:187` «si no lo lee `authorized`, `S37` no ocurre y la fila espera como una pausada o una en grace»
- `B/02:62` «La fecha de aplicación se recalcula mientras la fila está `PAUSED` o en `GRACE_PERIOD`»
- `B/02:376` «El monto no se guarda: es el esperado para ese período, que se resuelve de la versión de plan anclada»
- `B/03:173` «sobre un pagador manual no hay nada que mandar»
- `B/10:175` «Si el destino ofrece su ciclo, se cambia el monto sobre la misma autorización»
- `nucleo/01:394` «regularizar un pago — el pagador manual, registrando la cuota»

**Recomendación.** (1) **Sobre un pagador manual, `S37` no muta ni relee**: sólo encola el cambio
de versión para la fecha de aplicación y pasa la fila a `APLICADA`, y `S38` cambia la versión antes
de que `MP5` abra la cuota de ese período (la cuota ya sale con el precio destino). (2) Dejar a los
pagadores manuales fuera de la migración, en `PARA_RESOLVER`. Recomiendo la 1: el pagador manual es
el caso más simple, no hay proveedor que autorice nada.

### VC-cobro-03 · BLOQUEA · entre `S37` y `S38` el barrido compara contra el precio de la versión retirada

**El caso.** `S37` le muta a Juan el monto al precio destino siete días antes de la renovación, y
la versión sigue siendo la retirada hasta que `S38` la cambie ese día. El barrido diario compara
el `transaction_amount` releído con el *«monto esperado»*, que se deriva del precio **de la versión
de la fila**, la retirada. Los dos difieren desde el primer día. Como la divergencia la abrió una
mutación nuestra (`S37`), el barrido reintenta tres días y después abre `DIVERGENCIA_DE_MONTO`:
**a cada cliente migrado le sale una marca falsa**, o, si el reintento apunta al monto esperado, el
barrido **deshace la mutación de `S37`**. Para el downgrade esta ventana tiene su regla (el monto
esperado es el del plan nuevo desde el pedido); para la migración no hay ninguna. Y el mismo
comprobante de `S37` depende de esto: *«si la mutación no se aplica, la retoma el barrido»*
presupone que el barrido sabe cuál es el monto correcto.

- `B/09:173` «el precio de la versión de plan»
- `B/14:306` «Entre el pedido de un downgrade y el acto que lo aplica, el monto esperado es el del plan»
- `B/14:297` «o `S37`, la de una migración»
- `B/03:187` «es ahí, y no acá, donde la fila cambia de versión»
- `B/03:187` «Si la mutación no se aplica, la retoma el barrido»

Del mismo origen, sin medir el orden: el motivo 24 compara el cobro de la renovación contra el
precio de la versión *«a la fecha del cobro»*; si ese cobro se procesa antes que `S38` el mismo
día, un aumento de migración se lee como cobrado de más.

- `B/02:1031` «derivado con el precio de la versión y los aumentos vigentes a la fecha del cobro»

**Recomendación.** Una línea gemela de la del downgrade en `B/14` §2.4 y `B/09` §3: *«entre `S37`
y el `S38` que aplica ese cambio, el monto esperado es el precio de lista de la versión destino
para su ciclo, sin promos»*, y que el motivo 24 derive el precio de la versión que rige el período
que cubre el cobro (la destino, si su cambio está encolado para ese período).

### VC-cobro-04 · BLOQUEA · `G16` (a) nace rojo mientras el sistema viejo vive, y nadie saca `qzpay` del repo

**El caso.** `G16` (a) falla si `@qazuor/qzpay` aparece en cualquier `package.json` o import **del
repo**, y lo construye `B1`, la primera unidad. Pero el sistema viejo corre con `qzpay` hasta el
corte, y su handler sigue desplegado hasta el paso 4b (la URL apunta al viejo hasta entonces), así
que el código viejo está en la rama que despliega el paso 3. Medido hoy en el worktree: cinco
`package.json` lo declaran (`apps/api`, `apps/admin`, `packages/billing`, `packages/db`,
`packages/service-core`). `G16` está rojo desde que nace hasta que alguien borra el cobro viejo, y
**ninguna unidad lo borra**: `D/16` §4.5 archiva el repositorio de `qzpay` después del corte, no
saca sus dependencias de Hospeda. Es la forma de `G8`, que el owner resolvió con una lista de
pendientes (lote A, caso 8).

- `B/20:67` «aparece `@qazuor/qzpay`, cualquiera de sus paquetes, en un `package.json` o en un import del repo»
- `B/20:70` «y los tres son de `B1`»
- `D/16:472` «el sistema viejo corre con él hasta el corte»
- `D/16:141` «apuntar la URL de notificación de la aplicación del proveedor a la ruta del handler nuevo»
- `D/16:477` «Después del corte, se archiva.»

**Recomendación.** (1) **Acotar (a) al package del cobro** (su `package.json` y sus imports), que
es lo que dice el nombre del guard, *«el cobro vuelve a depender de lo que dejó»*; y nombrar la
unidad o el paso que borra el cobro viejo después del corte. (2) Dejar (a) sobre el repo con una
lista de pendientes cerrada, como `G8`, que vacía el commit que borra el cobro viejo. Recomiendo la
1: no inventa un pendiente y vigila exactamente lo que N2 prohíbe.

### VC-cobro-05 · MENOR · `A7` decide con la respuesta de la llamada, sin releer

`A7` admite leer el rechazo *«en la respuesta de la llamada de `A2` o en su relectura por id»*. La
respuesta de una creación no es una lectura por id, y la regla dura del proveedor y `D17` dicen que
un código de estado no cierra una mutación y que lo que dice el proveedor no se actúa sin
releerlo. `A2`, en el mismo camino, confirma con la respuesta **y** releyendo. El daño de un
`402` mal leído es chico (se cierra una compra), pero es una excepción a `D17` que no está
declarada.

- `B/03:2528` «leído en la respuesta de la llamada de `A2` o en su relectura por id»
- `B/06:150` «El código de estado no cierra ninguna mutación»
- `nucleo/04:141` «Lo que dice el proveedor no se escribe ni se actúa sin releerlo por id»
- `B/06:141` «la orden se confirma con la respuesta y releyéndola»

**Recomendación.** (1) Que `A7` relea la orden por el id que vino en el error antes de cerrar (una
llamada; el tipo lleva su instante). (2) Declararla como tercera excepción de `D17`. Recomiendo la 1.

### VC-cobro-06 · MENOR · un `402` que no llega deja la compra colgada 72 horas, que es lo que L-C quiso evitar

**El caso.** Juan compra *«destacar 7 días»*, la tarjeta se rechaza y la respuesta se pierde (timeout).
La instancia queda `PENDING_AUTHORIZATION` con su clave y sin id de orden, así que `A7` no tiene
con qué dispararse. Juan aprieta *«pagar»* otra vez: es el mismo pedido, y la regla del doble clic
encuentra la instancia y **no manda nada**. La compra queda pendiente hasta que `A3` reenvía con la
misma clave al vencer la ventana, 72 horas. Si en cambio prueba otra tarjeta con el mismo pedido,
es otro cuerpo con la misma clave y el proveedor contesta `409`, un caso que la pantalla no tiene
escrito.

- `B/16:103` «el segundo pedido trae el mismo identificador, encuentra la instancia que ya»
- `B/03:2524` «si el reenvío tampoco tiene respuesta, `A3` no ocurre en esa corrida»
- `B/16:124` «la pantalla arranca un pedido nuevo»

**Recomendación.** Que el segundo pedido que encuentra una instancia con clave y **sin** id de orden
reenvíe con la misma clave y el mismo cuerpo (seguro por `EX-41`): vuelve el `402` y corre `A7`. Y
que un `409` en la pantalla se trate como el rechazo: pedido nuevo.

### VC-cobro-07 · MENOR · *«no pudo procesar ni guardar»* se lee como que un fallo sólo de procesar contesta `200`

La regla del error del receptor, leída literal, contesta error sólo si fallaron **las dos cosas**.
Una entrega de Webhooks que se guardó en `provider_notification` y cuyo procesamiento falló
(una contención de la base, un deploy) contesta `200`, y el proveedor no la reintenta: el hecho
espera al barrido del día siguiente. Junto con el orden guardar/procesar, que `29-` § 5 dejó para
la implementación, la regla necesita decir *«cualquiera de las dos»*.

- `B/03:2723` «Sólo contesta error cuando no pudo procesar ni guardar»

**Recomendación.** Reescribir: *«contesta error si no pudo guardar la entrega o, si es de Webhooks,
no pudo procesarla»*. Un reintento es otra fila (la tabla no tiene `UNIQUE`), así que no rompe
nada.

### VC-cobro-08 · MENOR · el apuntado de la URL de IPN en el paso 4b no se verifica ni se deshace

El 4b apunta también la URL de IPN al receptor nuevo, pero lo verifica con el alta de una sonda,
que produce avisos de preapproval por Webhooks y **ninguno por IPN** (IPN entrega sólo `payment`).
Un apuntado equivocado no se ve hasta la revisión de HOS-1399, tres meses después, con la tabla sin
IPN. Y la vuelta atrás del §4.3 lista *«dos cosas»* que el corte cambia afuera de la base (la URL
de notificación y la sonda): la URL de IPN es una tercera, sin su inverso. No mueve plata (el
viejo descarta IPN), por eso es menor.

- `D/16:141` «Y la URL del canal IPN, que queda activo, se apunta en el mismo paso a la ruta de IPN del receptor nuevo»
- `B/06:519` «IPN entrega sólo `payment`»
- `D/16:366` «4b son dos cosas, cada una con su inverso»

**Recomendación.** Verificar el apuntado de IPN con una entrega real de `payment` (o aceptar
explícitamente que no se verifica), y sumar la URL de IPN a la vuelta atrás, que pasa a *«tres
cosas»*.

### VC-cobro-09 · MENOR · un cobro que llega después de la acción 24 copia el seudónimo al comprobante

La acción 24 sólo pide que no quede suscripción **viva**. Una fila `CANCELLED` puede seguir
cobrando: si la cancelación en el proveedor no se confirmó, el barrido reintenta, a los 3 días abre
`CANCELACIÓN_SIN_CONFIRMAR` y deja de reintentar, y el preapproval puede cobrar el ciclo siguiente.
Ese cobro corre `P1`, que copia el nombre y el correo de la fila de `user`, ya seudonimizada: el
comprobante sale a nombre del seudónimo y a un correo que no existe. El CHECK sólo admite las
columnas nulas sobre una lápida, así que la alternativa natural (dejarlas nulas) hoy la rechaza la
base.

- `B/02:378` «son nulas sólo en el comprobante de un cobro sobre una lápida»
- `B/03:1758` «leídos de la fila de `user` dueña del cobro en esta misma transacción»
- `nucleo/08:203` «Se rechaza mientras a la cuenta le cuelgue una suscripción viva»
- `B/03:2760` «Abierta la marca, el barrido deja de reintentar»

**Recomendación.** (1) Sobre una cuenta dada de baja, `P1` deja las dos columnas nulas y el
comprobante sin enviar, como en la lápida, y el CHECK lo admite. (2) Que la acción 24 se rechace
también mientras quede una marca `CANCELACIÓN_SIN_CONFIRMAR` abierta. Son compatibles; la 2 achica
la población y la 1 la cierra.

### VC-cobro-10 · MENOR · `B/12` §1.4 sigue diciendo que a la baja del proveedor se llega desde `GRACE_PERIOD`

Con L-A el mismo par del espejo recibe la baja que el pagador da desde la app de Mercado Pago, que
llega sobre todo desde `ACTIVE` (y desde `PAUSED`). El párrafo que sigue a L-A afirma que quien
llega a esta baja llega desde `GRACE_PERIOD` y que eso la cruza con la población de `S19`. Las
reglas que enumera (la predecesora que se muere sola, `S18`, la orfandad) no dependen del estado,
así que no hay regla contradicha: es una afirmación de población que dejó de ser cierta, en el §
que define la baja. L-A está dicho igual en `B/12` §1.4, su «NO cierra», `B/03` §10.1, la matriz y
el log.

- `B/12:141` «se espeja como una del proveedor: corta en el acto»
- `B/12:150` «que llega a esta baja llega desde `GRACE_PERIOD`»

**Recomendación.** Acotar la frase a la baja del proveedor por mora y decir que la de L-A llega
desde cualquier estado vivo, también la predecesora `ACTIVE` de una sucesión en curso.

### VC-cobro-11 · MENOR · `PARA_RESOLVER` no tiene correo, salida ni cancelación escritos

Los tres correos dicen *«la fecha de ese cliente»* y el precio nuevo, que un cliente
`PARA_RESOLVER` no tiene (su ciclo no existe en el destino). No está escrito si los recibe, ni a qué
estado pasa su fila cuando una persona lo resuelve con él, y la cancelación de la migración alcanza
sólo a las `PENDIENTE`: una `PARA_RESOLVER` de una migración cancelada sigue en el listado, con su
antigüedad creciendo.

- `B/10:189` «Si el destino no ofrece su ciclo, no se lo mueve solo»
- `B/10:212` «alcanza a las filas en `PENDIENTE`, que pasan a `CANCELADA`»
- `B/19:123` «la fecha de ese cliente»

**Recomendación.** Tres líneas en `B/10` §3.7 punto 5: el cliente `PARA_RESOLVER` recibe sólo el
correo del anuncio, con un texto que dice que lo van a contactar; su fila sale a `FUERA` (*«cambió
de plan»*) cuando se resuelve; y cancelar la migración la pasa a `CANCELADA`.

## Resumen

Doce mecanismos verificados: seis limpios (`S38`, el conteo de 34 transiciones y sus espejos, el
instante de la lectura y el reloj, `card_validation`, el error al crear con `payer_id`, y el package
del cobro con dependencias internas) y seis con hallazgos. Once hallazgos:

- `VC-cobro-01` **BLOQUEA**: una fila de alcance `PENDIENTE` sobre una suscripción que termina por la baja del proveedor, L-A, `S13` o la sucesión no tiene salida, y le siguen llegando los correos.
- `VC-cobro-02` **BLOQUEA**: `S37` exige un preapproval, y el pagador manual no se migra nunca.
- `VC-cobro-03` **BLOQUEA**: entre `S37` y `S38` el monto esperado es el de la versión retirada, así que el barrido le abre `DIVERGENCIA_DE_MONTO` a cada cliente migrado, o deshace la mutación.
- `VC-cobro-04` **BLOQUEA**: `G16` (a) mira todo el repo y nace rojo mientras vive el cobro viejo con `qzpay`, y ninguna unidad lo saca.
- `VC-cobro-05` MENOR: `A7` puede cerrar con la respuesta de la llamada, sin releer (`D5`, `D17`).
- `VC-cobro-06` MENOR: un `402` que no llega deja la compra 72 h pendiente, porque el reintento del mismo pedido no reenvía.
- `VC-cobro-07` MENOR: *«no pudo procesar ni guardar»* se lee como que un procesamiento fallido contesta `200`.
- `VC-cobro-08` MENOR: la URL de IPN del 4b no se verifica ni tiene inverso en la vuelta atrás.
- `VC-cobro-09` MENOR: un cobro después de la acción 24 copia el seudónimo al comprobante.
- `VC-cobro-10` MENOR: `B/12` §1.4 dice que a esta baja se llega desde `GRACE_PERIOD`, y con L-A no es así.
- `VC-cobro-11` MENOR: `PARA_RESOLVER` no tiene correo, salida ni cancelación escritos.

## Key Learnings

1. Un estado de alcance nuevo (`plan_migration_subscription`) tiene que tener un escritor para cada
   salida. Si sólo nombra las salidas que el cliente elige, toda terminación por otro camino deja la
   fila viva para siempre, y se la sigue avisando.
2. Una transición que muta el monto antes de cambiar la versión abre una ventana en la que todo lo
   que deriva el monto de la versión mira el precio viejo. El downgrade tenía su regla para esa
   ventana y la migración, que copia su forma, la heredó sin ella.
3. Una condición *«releer el preapproval»* excluye en silencio a la población que no tiene
   preapproval (el pagador manual). Hay que correr cada guarda de una transición nueva contra los
   dos tipos de pagador.
4. Un guard que prohíbe algo *«en el repo»* hay que contrastarlo con lo que el corte mantiene vivo
   hasta el final. `G16` repite la forma de `G8`, que ya había necesitado una lista de pendientes.
