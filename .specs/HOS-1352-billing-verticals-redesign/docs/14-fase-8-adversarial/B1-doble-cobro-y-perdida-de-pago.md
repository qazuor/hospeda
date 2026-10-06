---
title: "FASE 8 · B1 — doble cobro y pérdida de pago"
linear: HOS-1354
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8 · B1 — doble cobro y pérdida de pago

Pasada adversarial sobre la épica de billing (`HOS-1354`) y el núcleo, con un solo vector: **los
caminos por los que a alguien se le cobra dos veces, o entra plata que el sistema no registra, o se
cobra sin entregar y se entrega sin cobrar.**

Dieciocho hallazgos. **Ocho `CRITICA`** — de las cuales tres hacen imposible ejecutar una operación
que el diseño da por resuelta, y cinco sacan o dejan de entrar plata real.

Regla de lectura: cada hallazgo se apoya en una cita textual. Donde una medición de la matriz
sostiene el ataque, va su id de fila.

---

## CRITICA

### F-8B1-001 — La restricción de unicidad de la base hace inejecutable TODO upgrade y TODO cambio de ciclo

**Qué se rompe.** Ninguna de las dos operaciones se puede ejecutar como está diseñada. Cualquier
atajo que elija quien implemente es, o un cliente que se queda sin servicio habiendo pagado, o un
cliente con dos autorizaciones vivas cobrando en paralelo.

**El camino.**

1. Un cliente `ACTIVE` en Alojamiento pide pasar de mensual a anual (o de Basic a Pro).
2. `DEC-SUB-006` y `DEC-SUB-007` mandan **crear un preapproval nuevo en estado pendiente** y mandar
   al cliente al checkout. Del lado nuestro eso es S1, que nace en `PENDING_AUTHORIZATION`.
3. La vieja sigue `ACTIVE`, porque la decisión prohíbe cancelarla antes.
4. Los dos estados están en la lista de «vivos», y las dos filas son de clase **principal**, del
   mismo `user` y la misma `vertical`. **La restricción de la base rechaza el `INSERT`.**
5. Además, la condición de S1 —*«no hay otra viva para ese `user + vertical`»*— tampoco se cumple,
   así que la transición no dispara ni siquiera antes de llegar a la base.

De ahí salen tres salidas y las tres son malas: cancelar la vieja primero (lo que la decisión
prohíbe por escrito, y deja sin nada a quien abandone el checkout), sacar
`PENDING_AUTHORIZATION` de la lista de vivos (y entonces nada impide una tercera, una cuarta y una
décima creación simultánea, que es lo que `DEC-CONC-001` fue a evitar), o marcar la nueva como «no
principal» (y entonces el §11 deja de significar algo).

**Dónde lo permite el diseño.**

`HOS-1354/docs/02-modelo-de-datos.md` §2.2:

> **`UNIQUE(user_id, vertical) WHERE clase = principal AND estado ∈ {vivos}`** — es el §11,
> **impuesto por la base y no por un chequeo**

y, tres párrafos abajo, en el mismo §2.2:

> Los «vivos» de la restricción del §11 son: `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`,
> `PAUSED`, `SUSPENDED` y `CANCEL_SCHEDULED`.

Contra `01-decision-log.md`, `DEC-SUB-006` implicación 1:

> **La suscripción vieja se cancela al recibir el webhook de autorizada, NUNCA antes.** Si se
> cancela al iniciar el cambio y el cliente abandona el checkout, **se queda sin nada**.

Y `HOS-1354/docs/03-maquinas-de-estado.md` §3.2, condición de S1: *«no hay otra viva para ese
`user + vertical`»*.

**Severidad**: `CRITICA`. No es un borde: es el camino principal de dos operaciones que el diseño
declara resueltas, y `EX-6` —*«dos autorizadas del mismo pagador conviven sin conflicto»*— es
justamente lo que el modelo local prohíbe representar.

**Necesita decisión del owner**: **no**. Es una corrección de diseño: o la unicidad se acota a los
estados que representan un compromiso ya autorizado, o el cambio de compromiso necesita una forma
explícita de «sucesión» que la base entienda. La política no cambia.

---

### F-8B1-002 — `RECONCILIATION_REQUIRED` deja el preapproval vivo y habilita una segunda: dos cobros

**Qué se rompe.** El cliente paga dos veces la misma vertical, todos los meses, y el sistema lo
considera correcto. La plata sale de la tarjeta de un cliente real y entra a nuestra cuenta por dos
autorizaciones distintas.

**El camino.**

1. Una divergencia lleva la suscripción a `RECONCILIATION_REQUIRED` (S14). El preapproval del
   proveedor **sigue `authorized`**, porque el §22.1 prohíbe decisiones destructivas automáticas: no
   se lo cancela.
2. El estado está deliberadamente **fuera** de la lista de vivos, así que la persona puede contratar
   de nuevo. Lo hace: alta normal, checkout, `ACTIVE`.
3. Ahora hay dos preapprovals autorizados del mismo pagador para la misma vertical. `EX-6` midió que
   conviven sin conflicto — hasta seis a la vez en producción —, así que **el proveedor no los va a
   frenar**.
4. Los dos cobran. `RF-7` y el barrido no ven un problema: los dos ids están en `provider_link`, los
   dos cobros son de suscripciones que el inventario conoce, y el §3 del capítulo 09 compara cada
   suscripción **contra sí misma**, nunca dos entre sí.
5. Y la red que debería atajarlo está anulada por la misma definición: la condición 3 del capítulo
   05 §3 —*«no hay otra suscripción viva»*— lee la misma lista de «vivos» que excluye a
   `RECONCILIATION_REQUIRED`. O sea que un **pago tardío** sobre la suscripción en conflicto se
   considera **seguro de reactivar** aunque haya otra `ACTIVE`, que es exactamente el caso que esa
   condición existe para detener.

**Dónde lo permite el diseño.**

`HOS-1354/docs/02-modelo-de-datos.md` §2.2:

> Quedan afuera `ABANDONED`, `CANCELLED` y `RECONCILIATION_REQUIRED` — el último a propósito: si una
> suscripción necesita intervención humana, la persona tiene que poder contratar de nuevo sin
> esperar a que alguien resuelva un caso.

`HOS-1354/docs/03-maquinas-de-estado.md` §3.2, efectos de S14:

> §22.1: evento crítico, correo a `SUPER_ADMIN`, alerta en Admin, **cero decisiones destructivas
> automáticas**

`HOS-1354/docs/05-idempotencia-y-concurrencia.md` §3, condición 3:

> **no hay otra suscripción viva** para ese `user + vertical` — si la hay, el pago es de una
> suscripción superada y reactivar le daría **dos**

**Severidad**: `CRITICA`. La comodidad de «que pueda contratar de nuevo» está comprada con la
autorización vieja sin cancelar, y el documento no nombra ese costo en ningún lado.

**Necesita decisión del owner**: **sí**. Quién puede cancelar el preapproval de una suscripción en
conflicto —y si eso cuenta como «decisión destructiva automática»— es precisamente el límite que el
§22.1 fijó, y moverlo es una decisión, no una corrección.

---

### F-8B1-003 — La recuperación tras un timeout usa un filtro que en producción devuelve un subconjunto

**Qué se rompe.** El único mecanismo que el diseño tiene para el caso *«mandamos crear, el proveedor
creó y cobró, la respuesta se perdió»* puede contestar **«no existe»** cuando existe. Reintentamos y
el cliente paga dos veces, con una de las dos autorizaciones huérfana cobrando todos los meses.

**El camino.**

1. Alta con `card_token_id`. El proveedor crea y autoriza; `PA-3` mide que en producción el cobro
   real llega ~26 minutos después. Nuestra respuesta se pierde: sólo tenemos un timeout.
2. El capítulo 05 manda preguntar **por el pagador y el estado**: *«¿este pagador tiene alguna
   suscripción autorizada que yo no tenga registrada?»*.
3. Ese filtro compuesto está medido **en sandbox**, sobre 153 sujetos. En **producción** el mismo
   buscador tiene un tercer modo de falla que el sandbox no tenía: con un `status` válido devuelve
   **un subconjunto plausible**, sin ninguna señal de que falte nada.
4. La respuesta vuelve sin la suscripción recién creada. Concluimos que no se creó.
5. Reintentamos. `EX-17` midió que el proveedor **no deduplica por ningún mecanismo**: segundo
   preapproval, segundo id, segunda autorización, segundo cobro.
6. `provider_link` guarda **el segundo**. El primero queda huérfano y vivo. El capítulo 09 §2.1 lo
   dice con todas las letras: *«una suscripción cuyo id se pierde es invisible para el barrido»*.

**Dónde lo permite el diseño.**

`HOS-1354/docs/05-idempotencia-y-concurrencia.md` §1.2:

> **Sólo se resuelve preguntándole al proveedor, y no por nuestra referencia.** [...] La que sí la
> tiene es **«¿este pagador tiene alguna suscripción autorizada que yo no tenga registrada?»**, por
> correo del pagador y estado, que sí filtran y se componen.

Contra `06-mp-validation-matrix.md`, fila `RC-1`:

> **En PRODUCCIÓN (2026-09-15, sonda 21) aparece un tercer defecto que el sandbox no tenía: el
> filtro devuelve un SUBCONJUNTO.** `status=cancelled` trae **15** filas [...] y recorriendo las 76
> sin filtro hay **69** canceladas. Faltan 54 y no hay ninguna señal de que falten.

Y la regla que el propio programa escribió, `HOS-1354/docs/06-proveedor.md` §8, regla 1:

> **Toda fila lleva fecha y entorno**, y una fila medida sólo en sandbox **no responde por
> producción**.

**Severidad**: `CRITICA`. El capítulo 05 aplica su regla de método al revés justo en el único
mecanismo que cubre el caso que ningún candado cubre.

**Necesita decisión del owner**: **no**. Pero sí necesita una medición: el subconjunto se midió
sobre `status`, no sobre `payer_email + status`, y qué tan incompleta es la composición en producción
decide si el mecanismo sirve o hay que cambiarlo entero.

---

### F-8B1-004 — La fecha de primer cobro es un `free_trial` que el proveedor otorga sin mecanismo conocido

**Qué se rompe.** La precondición de seguridad de **todo** cambio de plan y de ciclo (`D8`) depende
de un comportamiento que el proveedor decide por su cuenta y que está medido como **no
determinista**. Cuando no lo otorga, la suscripción nueva cobra en el acto mientras la vieja sigue
viva: el cliente paga dos veces, y paga de nuevo días que ya había pagado.

**El camino.**

1. Cliente mensual a mitad de ciclo pide pasar a anual. Se crea el preapproval nuevo con
   `start_date` a +N días, que es como se compensan los días pagados.
2. `EX-38` midió que el proveedor **convierte esa fecha en un `free_trial` por su cuenta**: el
   request no lo nombra y el objeto queda con uno.
3. `EX-29` midió que el otorgamiento del `free_trial` **no lo decide el request**, que el patrón es
   reproducible (`✅ ✅ ❌`) y que **el mecanismo no está identificado**. Dos altas idénticas del
   mismo pagador, con tres segundos de diferencia, salen distintas.
4. En la que sale `❌`, la relectura muestra `free_trial: null` y `next_payment_date` **en el
   instante del alta en vez de mañana**. El preapproval cobra ya.
5. La vieja sigue viva —se cancela recién al llegar el webhook de la nueva—, así que el período en
   curso está cobrado dos veces. Y el cliente ya había pagado esos días.
6. **Nada en el diseño aborta.** La regla de relectura del capítulo 06 §4.1 está escrita sobre
   *mutaciones*; una creación no lo es. `EX-29` deja escrito que hay que releer **para mostrar** la
   fecha, no para **frenar** el cambio. `G11` vigila que no le pidamos un trial al proveedor, no que
   la fecha haya quedado donde la pedimos.

**Dónde lo permite el diseño.**

`nucleo/04-invariantes.md` §3, `D8`:

> **Una fecha de primer cobro futura es la precondición de seguridad de todo cambio de plan o de
> ciclo** — `DEC-SUB-006` — servicio; sin ella la nueva cobra mientras la vieja sigue viva

`HOS-1354/docs/06-proveedor.md` §4.3:

> Como la fecha futura es la **precondición de seguridad** de todo cambio de plan y de ciclo
> (`DEC-SUB-006`), esto no se puede evitar [...] **Un guard que busque `free_trial` en el payload no
> ve nada** [...] El guard tiene que mirar la relectura.

`06-mp-validation-matrix.md`, `EX-29`:

> **NO lo decide el request, el patrón es reproducible y el mecanismo NO está identificado.**

**Sobre la fila huérfana de la matriz.** La nota al pie que `04-open-decisions.md` señaló —*«es la
condición de `DEC-SUB-006`, y no está medida»*— está **desactualizada**: `EX-33` mide exactamente esa
pregunta, `VERIFIED`, **en producción con tarjeta real, tres veces sobre el mismo pagador,
autorizando a mano en el checkout**. El riesgo residual no es que nadie haya probado el checkout: es
que las tres mediciones de `EX-33` cayeron del lado `✅` de un mecanismo que `EX-29` declara
desconocido, y `EX-33` lo dice de sí misma —*«se midieron tres y no una porque `EX-29` había
encontrado el patrón `✅ ✅ ❌`»*—. Tres éxitos sobre un sorteo cuyo sesgo no se conoce no son una
garantía.

**Severidad**: `CRITICA`. Es la única precondición de seguridad del diseño y está tercerizada a un
comportamiento no explicado del proveedor, sin ninguna verificación que la confirme antes de dejar
el cambio en pie.

**Necesita decisión del owner**: **no** para el arreglo obvio (releer el preapproval nuevo y abortar
el cambio si `next_payment_date` no quedó donde se pidió, antes de cancelar la vieja). **Sí** para lo
que se hace con el cliente cuando la relectura dice que no: revertir cuesta un reembolso sobre la
capacidad que el capítulo 06 §10 declara en riesgo de plataforma.

---

### F-8B1-005 — Una cortesía sobre un ciclo no mensual regala el ciclo entero: doce meses por uno

**Qué se rompe.** Plata nuestra, en la dirección «se entrega y no se cobra». `SUPER_ADMIN` otorga
una cortesía de un mes y el sistema entrega hasta doce sin emitir un cobro.

**El camino.**

1. Cliente con suscripción **anual** `ACTIVE`, renovación el día 20 del mes que viene.
2. `SUPER_ADMIN` le otorga una cortesía temporal de un mes. `DEC-GRANT-003` la implementa
   **pausando** en el proveedor.
3. La condición de S9 es sólo *«no hay pausa vigente»*. **No pasa por `puedePausar()`**, que es donde
   vive el requisito de ciclo mensual, ni por la composición `capacidades(suscripción)` del capítulo
   06 §7. O sea que una cortesía se puede otorgar sobre cualquier ciclo.
4. Durante la pausa vence el ciclo anual. `PS-6` midió que **el ciclo que vence estando pausada
   avanza `next_payment_date` un ciclo entero sin cobrar**, y que al reanudar **no hay cobro de
   recuperación ni deuda acumulada** (`PS-5`, `PS-6`).
5. Nuestro reloj reanuda al mes. El cliente vuelve a `ACTIVE` con la renovación anual corrida doce
   meses y ningún cobro emitido. Regalamos once meses que nadie decidió regalar.
6. El barrido del capítulo 09 §3 **no lo reporta**: la fecha del próximo cobro *«se registra; no es
   por sí sola una divergencia, porque el proveedor la mueve solo en casos medidos (`PS-6`)»*.

**Dónde lo permite el diseño.**

`HOS-1354/docs/03-maquinas-de-estado.md` §3.2, S9:

> S9 | `ACTIVE` | `SUPER_ADMIN` otorga cortesía | `PAUSED` *(motivo `COURTESY`)* | no hay pausa
> vigente (`DEC-GRANT-004`) | se pausa en el proveedor y **el servicio se sostiene de nuestro lado**

Contra `nucleo/01-glosario.md` §3, donde el ciclo mensual sólo aparece en la función que S9 no
invoca:

> ```text
> puedePausar(suscripción) =
>       estado == ACTIVE
>   AND billingOption.ciclo == mensual
> ```

Y el argumento de `DEC-SUB-010` que sostiene «los días no usados se pierden» está escrito sobre
ciclos mensuales y no vale acá — `spec.md` §3.4: *«con ciclos enteros el cliente vuelve el mismo día
del mes, así que lo perdido se compensa con lo que gana al volver»*.

**Severidad**: `CRITICA`. Hoy no muerde porque las ocho suscripciones vivas son mensuales
(`21-migracion.md` §1.2), pero el catálogo vende cuatro ciclos y `04-open-decisions.md` ya tiene
anotado *«el día que exista un ciclo anual»* como disparador de revisión para las otras dos
decisiones de la misma familia.

**Necesita decisión del owner**: **no**. O la cortesía se restringe a los ciclos donde la pausa
compensa sola, o para el resto se usa otro mecanismo. Lo que no puede quedar es que el costo dependa
de en qué día del ciclo cayó el regalo.

---

### F-8B1-006 — El preapproval huérfano sigue cobrando y el detector que el diseño nombra no lo mira

**Qué se rompe.** Un débito mensual recurrente a alguien que ya no es cliente, sostenido en el
tiempo. Es el caso que el capítulo 16 declara *«el que no puede fallar»*, y el detector que nombra
está explícitamente excluido por el capítulo 09.

**El camino.**

1. Un cliente tiene un addon recurrente. `DEC-ADDON-002`: es un preapproval aparte, con su propio
   cobro.
2. Borra la ficha destino, o cancela la vertical, o la suscripción principal llega a `CANCELLED`. El
   addon queda huérfano y pasa a `CANCELLED` por A5 o A6.
3. El preapproval del addon **no se entera**: cancelar el plan no cancela los addons. Sigue
   `authorized` y sigue cobrando.
4. El capítulo 16 dice que lo detecta el barrido. El barrido **no lo mira**: el capítulo 09 §3
   ordena recorrer *«cada suscripción de nuestro inventario que no esté en un estado terminal»* y
   nombra `CANCELLED` como terminal por escrito.
5. Lo que queda es el webhook del cobro. Pero ese cobro llega de un preapproval **conocido** —está
   en `provider_link`—, así que no es la huérfana del §2.2; resuelve a una suscripción `CANCELLED`,
   para la que no existe ninguna transición, y termina en `RECONCILIATION_REQUIRED`. Es decir: **se
   detecta después del primer débito indebido, y a mano.**

**Dónde lo permite el diseño.**

`HOS-1354/docs/16-addons.md` §4.3:

> **Falla hacia cobrar de más, y por eso es el que no puede fallar.** [...] Lo que lo hace detectable
> es el barrido del capítulo 09, que compara contra **nuestro** inventario (`DEC-CONC-002`): un addon
> en estado terminal con su preapproval vivo es una discrepancia que el barrido ve.

`HOS-1354/docs/09-conciliacion.md` §3:

> **Los estados terminales no se barren**: `CANCELLED` y `ABANDONED` no pueden divergir hacia nada
> que nos importe, y barrerlos es gastar llamadas sobre la parte de la cartera que más crece.

Las dos frases no pueden ser ciertas a la vez, y la del capítulo 09 es la que va a terminar en el
código porque es la que describe el barrido.

**Severidad**: `CRITICA`. Dos capítulos escritos el mismo día se contradicen exactamente sobre el
mecanismo que evita cobrarle a un ex cliente.

**Necesita decisión del owner**: **no**. Es una corrección: un estado terminal **con vínculo de
proveedor vivo** no es terminal a los efectos del barrido.

---

### F-8B1-007 — Un descuento que cae entre cero y el piso se ejecuta como pausa: el cliente paga cero

**Qué se rompe.** Un descuento del 90 % se convierte en un 100 %, por una regla que sólo razonó el
caso del 100 %. Plata nuestra que no entra, por un plazo que nadie definió, en un estado que el
dominio no puede representar.

**El camino.**

1. Un plan de ARS 100 con dos promos apilables: 50 % y ARS 40. La regla de composición da
   `100 → 50 → 10`.
2. ARS 10 está por debajo del piso medido del proveedor, ARS 15 (`PC-2`).
3. La regla del capítulo 14 §1.3 punto 2 es incondicional: por debajo del piso, el descuento **no se
   aplica mutando el monto** y se ejecuta **con el mecanismo de la cortesía**, o sea pausando.
4. Pausado no se cobra nada. Le prometimos un 90 % de descuento y le cobramos cero. La diferencia es
   nuestra.
5. El punto 3 de esa misma sección —*«un descuento del 100 % no es un descuento: es una cortesía»*—
   cubre el caso `monto = 0`, no el intervalo `(0, 15)`, que es el que la aritmética produce todo el
   tiempo.
6. Y el estado resultante no existe en el dominio: la pausa lleva **motivo obligatorio** y el
   dominio es cerrado, `CUSTOMER_REQUEST` o `COURTESY`. Un descuento-bajo-el-piso no es ninguno de
   los dos. Como **el reloj que reanuda lee el motivo**, escribirlo como `COURTESY` lo pone bajo el
   reloj de las cortesías, que vence en otra fecha; escribirlo como `CUSTOMER_REQUEST` le consume la
   cuota de pausas al cliente. No hay tercera opción y el capítulo 14 no elige ninguna.
7. Un descuento `forever` por esta vía es una pausa **sin fecha de fin**: el débito no vuelve nunca,
   y `EX-11` midió que estando pausada **no se puede modificar nada**, así que tampoco se puede
   restaurar el monto sin reanudar primero.

**Dónde lo permite el diseño.**

`HOS-1354/docs/14-promos-cortesias-y-grants.md` §1.3, punto 2:

> **Si el resultado cae por debajo del piso, el descuento NO se aplica mutando el monto.** Se ejecuta
> con el mecanismo de la cortesía: **pausar en el proveedor y sostener el servicio de nuestro lado**
> (`DEC-GRANT-003`). Bajar al piso en vez de pausar le cobraría **ARS 15 por ciclo** a alguien a
> quien le dijimos que no iba a pagar.

Contra `nucleo/01-glosario.md` §2.2:

> El motivo es un valor cerrado —`CUSTOMER_REQUEST` o `COURTESY`— y **el reloj que reanuda lee el
> motivo, nunca el estado del proveedor**.

**Severidad**: `CRITICA`. El argumento del punto 2 es correcto para el 100 % y se generalizó sin
mirar el intervalo intermedio, que es el caso frecuente con un piso de ARS 15.

**Necesita decisión del owner**: **sí**. Cobrar el piso y comerse la diferencia, redondear el
descuento hacia arriba, o rechazar la composición, son tres políticas comerciales distintas y ninguna
se deduce del diseño.

---

### F-8B1-008 — El reembolso no tiene clave persistida antes de la llamada: la plata sale y no queda fila

**Qué se rompe.** Plata que sale de nuestra cuenta hacia el cliente y no queda registrada. El
acumulado reembolsado del pago queda corto, y un segundo reembolso sobre el mismo pago se autoriza
contra un saldo que ya no existe.

**El camino.**

1. Se confirma un reembolso (revocación, o un duplicado de `DEC-CONC-001` parte 3). Llamamos a
   `POST /v1/payments/{id}/refunds` con su `X-Idempotency-Key`.
2. El proveedor reembolsa y la respuesta se pierde. Timeout.
3. Reintentamos con la **misma** clave. `RF-6` midió que la repetición devuelve **`200`, no `201`**,
   con **cuerpo vacío**, y **sin el refund original adentro**.
4. No tenemos id de reembolso. El capítulo 02 §2.3 define `refund` como *«pago, monto, motivo,
   estado, quién lo confirmó»* y **no tiene ninguna restricción de unicidad contra el id del
   proveedor**, ni ninguna regla que obligue a persistir la clave antes de llamar.
5. La fila no se escribe, o se escribe sin el id. El `monto reembolsado acumulado` del `payment`
   queda corto respecto de lo que el proveedor ya devolvió.
6. Un segundo reembolso parcial se valida contra nuestro saldo —que es mayor que el real— y sale. El
   proveedor lo frena por `RF-2` (valida contra el saldo) **sólo si el monto excede el saldo real**;
   si entra, devolvimos de más.

`D4` existe exactamente para esto y **está escrito sólo para la creación**: *«El candado de
idempotencia se persiste ANTES de la primera llamada al proveedor»* — el capítulo 02 §2.3 lo ancla a
`idempotency_key`, y el capítulo 05 §1.1 lo justifica sobre `EX-17`, que es una fila de
`/preapproval`. El reembolso es el **único** endpoint donde el header es obligatorio y se respeta
(`RF-4`, `RF-6`), y es donde el diseño no lo exige.

**Dónde lo permite el diseño.**

`06-mp-validation-matrix.md`, `RF-6`:

> Dos trampas para quien implemente: la repetición devuelve **`200`, no `201`** (un cliente que sólo
> acepte `201` trata una reentrega correcta como fallo), y **no devuelve el refund original** en el
> cuerpo, así que hay que tenerlo guardado.

`HOS-1354/docs/02-modelo-de-datos.md` §2.3, fila `refund`: *«pago, monto, motivo, estado, quién lo
confirmó | el acumulado nunca supera el monto del pago»* — sin clave, sin unicidad, sin orden de
persistencia.

**Para qué sirve `RF-6`, que la matriz dejaba en `—`**: sostiene la idempotencia del reintento de
reembolso, o sea `DEC-CONC-001` parte 3 (el duplicado que ya cobró) y `DEC-RF-001` (la revocación).
Si esa fila se da vuelta —si el proveedor dejara de respetar la clave—, **cada reintento de reembolso
pasa a ser un reembolso nuevo**, y la operación más cara del sistema se vuelve no repetible.

**Severidad**: `CRITICA`. Plata que sale sin registro, sobre la única capacidad que el capítulo 06
§10 declara con riesgo de plataforma.

**Necesita decisión del owner**: **no**.

---

## ALTA

### F-8B1-009 — La limpieza de las 72 h cancela sin releer, y destruye una autorización recién conseguida

**Qué se rompe.** Un cliente autoriza, el proveedor le manda *«Pagaste la suscripción»*, y minutos
después le cancelamos el preapproval de forma irreversible. Si el cobro ya salió —`PA-3`: ~26 minutos
entre autorizar y cobrar—, hay plata cobrada contra una suscripción `ABANDONED` que no tiene ninguna
transición para recibirla.

**El camino.**

1. Alta a las 00:00 del día 1. `PENDING_AUTHORIZATION`, ventana de 72 h.
2. El cliente autoriza en el checkout a las 23:45 del día 3.
3. El job de limpieza corre a las 00:00 del día 4 sobre el lote que armó minutos antes. Su condición
   —*«pasaron 72 h sin autorizar»*— se evaluó **antes** de que el cliente autorizara.
4. Lleva la fila a `ABANDONED` y **cancela el preapproval en el proveedor**. `PA-5`: irreversible.
5. Dos desenlaces, los dos malos. Si el cobro no salió todavía, el cliente tiene en su casilla un
   correo del proveedor que dice que pagó, y no tiene nada — y el proveedor **no comunica nada** sobre
   el `pending` ni sobre su cancelación (`EX-3`, ampliación 2026-09-19), así que el único canal somos
   nosotros y le acabamos de decir lo contrario. Si el cobro salió, hay dinero cobrado sobre una fila
   `ABANDONED`, y el capítulo 03 §3.3 declara que `ABANDONED → ACTIVE` **no existe**.

**Dónde lo permite el diseño.**

`HOS-1354/docs/03-maquinas-de-estado.md` §3.4, punto 2:

> **Limpieza**: un job recorre las vencidas, las lleva a `ABANDONED` y **cancela el preapproval en el
> proveedor**. Sin ese segundo paso queda una autorización viva que puede cobrar.

El diseño ya escribió la regla que falta acá, pero sólo para los trials —
`HOS-1354/docs/14-promos-cortesias-y-grants.md` §3.3:

> **El job de vencimiento re-lee la fecha de fin dentro de su propia transacción**, no actúa sobre la
> que leyó al armar el lote.

**Severidad**: `ALTA`. Se arregla dentro del diseño actual: releer el preapproval por id —que es el
camino confiable (`RC-2`)— dentro de la transacción, antes de cancelar.

**Necesita decisión del owner**: **no**.

---

### F-8B1-010 — «Ningún pago acreditado» es un booleano de por vida: diez días gratis repetibles

**Qué se rompe.** El agujero que el capítulo 12 §4 declara cerrado sigue abierto para cualquiera que
haya pagado **una vez** en esa vertical. Diez días de servicio completo por intento, repetibles, sin
cobrar un peso.

**El camino.**

1. Una persona se suscribe a Alojamiento y paga un mes. Tiene un pago acreditado para ese
   `user + vertical`, para siempre.
2. Cancela. Vuelve a suscribirse con una tarjeta que no va a pagar.
3. El primer cobro falla. La regla de §4.3 sólo manda a `SUSPENDED` directo a quien **no tenga ningún
   pago acreditado**. Ésta lo tiene, así que entra en `GRACE_PERIOD`.
4. El §20 da servicio completo durante el grace: fichas publicadas, edición, entitlements.
5. Se agota el reloj, `SUSPENDED`, cancela, vuelve a empezar. La restricción de unicidad no lo frena
   —la anterior está `CANCELLED`, que no es un estado vivo— y el trial tampoco, porque no está usando
   trial. **Es el mismo camino que el capítulo 12 §4.2 describe, con un pago acreditado adelante.**
6. Y el proveedor tampoco lo corta: `04-open-decisions.md` y el capítulo 12 §4.4 miden que MP cancela
   en el acto una suscripción cuyo **primer** cobro es rechazado — o sea que cada vuelta le sale
   gratis también en el otro lado, y nuestra suspensión llega por nuestro reloj, diez días tarde.

**Dónde lo permite el diseño.**

`HOS-1354/docs/12-suscripcion.md` §4.3:

> **El grace no es un beneficio de entrada.** Una suscripción cuyo **primer** cobro falla, para un
> `user + vertical` **sin ningún pago acreditado**, no pasa por `GRACE_PERIOD`: va directo a
> `SUSPENDED`.

y §4.5, punto 1:

> **«Ningún pago acreditado» se cuenta por `user + vertical`, no por suscripción.**

Ese punto cierra el reseteo por resuscripción y, en el mismo acto, convierte la condición en un
booleano histórico que nunca vuelve a ser falso.

**Severidad**: `ALTA`. El argumento de §4.3 —*«alguien que venía pagando y tuvo un problema»*— es
sobre la **relación vigente**, no sobre la historia. Contarlo sobre la suscripción anterior inmediata,
o sobre una ventana, conserva el argumento sin abrir el agujero.

**Necesita decisión del owner**: **sí**, en un punto: si un cliente que pagó hace dos años y volvió
hoy merece grace.

---

### F-8B1-011 — La revocación y el cruce C2 se contradicen: se reembolsa Y se extiende el servicio

**Qué se rompe.** El cliente ejerce el derecho de arrepentimiento, le devolvemos la plata, y el
sistema le extiende el servicio hasta cubrir el cobro que acabamos de reembolsar. Plata devuelta más
servicio prestado.

**El camino.**

1. El cliente pide la revocación. `DEC-RF-001` la ejecuta como **una sola operación: reembolso total
   más cancelación**.
2. El cobro del ciclo está en vuelo. `PA-3`/`RN-1` miden entre 26 y 33 minutos de retraso entre la
   fecha del hecho y su aparición.
3. Llega. Su **fecha del hecho** es anterior a la cancelación, que es el criterio que C2 fija.
4. C2 manda extender la fecha de fin de servicio hasta cubrirlo, con el argumento de que *«pagó el
   período que va a usar»*.
5. Pero ese cobro es justamente el que la revocación reembolsa. Quedan las dos cosas: el dinero de
   vuelta en su tarjeta y el servicio prestado hasta el fin del período.

C2 razona sobre la baja voluntaria de `DEC-SUB-009`, que **no** mueve plata. La revocación sí la
mueve, y el capítulo 05 no distingue los dos caminos de cancelación en ningún lado.

**Dónde lo permite el diseño.**

`HOS-1354/docs/05-idempotencia-y-concurrencia.md` §2, C2:

> el cobro es **anterior** a la cancelación | es legítimo: el cobro es **por adelantado**, así que
> pagó el período que va a usar. **Se extiende la fecha de fin de servicio** hasta cubrirlo

Contra `HOS-1354/docs/03-maquinas-de-estado.md` §6:

> Por eso la revocación del derecho de arrepentimiento es **una sola operación: reembolso +
> cancelación**

**Severidad**: `ALTA`.

**Necesita decisión del owner**: **no**.

---

### F-8B1-012 — El `2084` prescribe un reintento automático sobre un contrato de errores incompleto

**Qué se rompe.** Un reembolso que se reintenta solo, con montos distintos, contra un contrato de
errores incompleto. En el peor caso devuelve de más; en el mejor, deja un intento colgado que nadie
cierra.

**El camino.**

1. Se reembolsa un pago parcialmente reembolsado. El proveedor contesta `400 code 2084`.
2. El capítulo 03 §6 prescribe: *«Reintenta con otro monto o cae al total.»*
3. `RF-5` midió el contrato de errores sobre `cause[0].code` y dejó un hueco escrito: *«el rechazo
   por monto bajo el mínimo trae otro texto [...] y **su código no quedó registrado**»*.
4. `RF-8` midió que `2084` **no es una propiedad del pago** y que *«la regla real no se pudo
   determinar»* — cuatro hipótesis muertas. También midió que con 1 de saldo **tanto el monto chico
   como el total sin body volvieron a dar `2084`**, o sea que la caída al total tampoco funciona en
   el caso probado.
5. Un reintento automático que barre montos sobre un código cuyo significado no se conoce es el tipo
   de bucle que sólo se puede auditar después. Y la regla del programa —*«lo que toca plata no se
   ejecuta solo»*— dice lo contrario de lo que prescribe el capítulo 03 §6.

**Dónde lo permite el diseño.**

`HOS-1354/docs/03-maquinas-de-estado.md` §6:

> **Ante el rechazo `2084`, el sistema nunca concluye que el pago no se puede reembolsar.** Está
> medido que ese mensaje miente [...] Reintenta con otro monto o cae al total.

Contra `HOS-1354/descomposicion.md` §1.3, regla 3: *«Lo que toca plata no se ejecuta solo.»*

**Para qué sirve `RF-8`, que la matriz dejaba en `—`**: sostiene esta regla del capítulo 03 §6 y, por
ahí, la mecánica de `DEC-RF-001`. Si la fila se diera vuelta —si `2084` resultara ser un estado
terminal—, el reintento prescripto sería un bucle que nunca entra y la revocación quedaría sin camino
automático.

**Severidad**: `ALTA`.

**Necesita decisión del owner**: **sí**. Reintentar montos automáticamente sobre un rechazo no
explicado es una excepción a la regla de «lo que toca plata lo mira una persona», y hoy está tomada
dentro de un capítulo en vez de declarada.

---

### F-8B1-013 — Los tres avisos de un reembolso llevan el id del PAGO: C6 descarta la actualización

**Qué se rompe.** El reembolso ocurrió en el proveedor y nuestro acumulado reembolsado no se
actualiza, o se actualiza tres veces. En la primera dirección le negamos al cliente un reembolso que
le corresponde; en la segunda, nuestros libros dicen que devolvimos el triple.

**El camino.**

1. Se ejecuta un reembolso parcial de ARS 5 sobre un pago de ARS 15.
2. `RF-7` midió que el proveedor emite **tres entregas por reembolso, en dos formatos**, y las tres
   llevan **el id del pago**: `?data.id=<pago>&type=payment`, `?id=<pago>&topic=payment` y
   `?id=<pago>&topic=merchant_order`. **Ninguna trae el id del reembolso.**
3. C6 dice que la concurrencia la resuelve `UNIQUE(proveedor, id_del_hecho)`, y esa restricción vive
   en `payment` (capítulo 02 §2.3). La fila del pago **ya existe** desde el cobro, así que el primer
   `INSERT` falla y —según C6— *«la segunda instancia falla al insertar y no hace nada más»*. La
   actualización del reembolso se descarta.
4. Si en cambio se procesan las tres por el camino de la relectura, no hay ninguna clave que las
   colapse: `refund` no tiene unicidad contra el id del proveedor (ver `F-8B1-008`), y quedan tres
   filas de ARS 5 sobre un reembolso de ARS 5.
5. El tope *«el acumulado nunca supera el monto del pago»* deja pasar las tres (15 ≤ 15) y **bloquea
   el próximo reembolso legítimo** de los ARS 10 restantes.

**Dónde lo permite el diseño.**

`HOS-1354/docs/05-idempotencia-y-concurrencia.md` §2, C6:

> Lo resuelve `UNIQUE(proveedor, id_del_hecho)`: la segunda instancia falla al insertar y no hace
> nada más. **Sin lock y sin coordinación.**
>
> [...] **No alcanza con deduplicar por tipo de evento**: un reembolso emite **tres notificaciones en
> dos formatos distintos para el mismo hecho** (`RF-7`).

Las dos frases conviven en la misma sección y la primera no cubre el caso de la segunda, porque el
«hecho» del reembolso no trae id propio en ninguna de las tres entregas.

**Para qué sirve `RF-7`, que la matriz dejaba en `—`**: es la fila que sostiene la regla de
deduplicación del capítulo 03 §10.2 y el segundo aviso de C6. Lo que ninguno de los dos advirtió es
que la fila también dice **cuál es el id que llega**, y ese dato invalida el mecanismo que la cita.

**Severidad**: `ALTA`.

**Necesita decisión del owner**: **no**.

---

### F-8B1-014 — La reconciliación que `DEC-SUB-006` pidió por nombre no está en el capítulo 09

**Qué se rompe.** El caso *«la nueva quedó autorizada y la cancelación de la vieja falló»* —que la
decisión describe como *«el cliente paga dos veces en el ciclo siguiente»*— no tiene detector.

**El camino.**

1. Cambio de ciclo. La nueva suscripción queda autorizada; llega su webhook.
2. Cancelamos la vieja en el proveedor. La llamada falla, o la respuesta se pierde.
3. Quedan dos preapprovals autorizados del mismo pagador, los dos en `provider_link`.
4. El barrido del capítulo 09 §3 compara, **por cada suscripción de nuestro inventario**, su estado,
   su monto, su próxima fecha, sus cobros y su `version` **contra el proveedor**. Ninguna de las cinco
   comparaciones es *entre dos suscripciones nuestras*, así que dos vivas para el mismo
   `user + vertical` no aparece en ninguna columna.
5. La restricción de base del §11 tampoco lo ve: si la vieja quedó marcada como cancelada del lado
   nuestro —que es lo que el código va a hacer después de mandar la cancelación—, localmente hay una
   sola. El segundo cobro aparece como un cobro de una suscripción `CANCELLED`.

**Dónde lo permite el diseño.**

`01-decision-log.md`, `DEC-SUB-006` implicación 3:

> **Hace falta una reconciliación** para el caso en que la nueva quede autorizada y la cancelación de
> la vieja falle: quedan dos vivas y el cliente paga dos veces en el ciclo siguiente. `EX-6` garantiza
> que el estado intermedio no rompe nada, no que se limpie solo.

`HOS-1354/docs/09-conciliacion.md` §3 enumera las cinco comparaciones del barrido y ninguna la cubre;
§7 enumera los tres procesos y ninguno la nombra.

**Severidad**: `ALTA`. La decisión la pidió explícitamente y el capítulo que le correspondía no la
recogió.

**Necesita decisión del owner**: **no**.

---

## MEDIA

### F-8B1-015 — Un descuento de «N cobros» no declara qué consume un cobro, ni quién restaura el precio

**Qué se rompe.** Un descuento de tres cobros puede quedar aplicado para siempre, o retirarse antes de
tiempo. En la primera dirección es plata nuestra que no entra, todos los meses.

**El camino.** El capítulo 14 §2.2 dice qué **no** consume un cobro —*«el contador de N cobros sigue
donde estaba: cambiar de plan no consume un cobro»*— y en ningún lado dice qué sí lo consume, ni quién
restaura el monto cuando se agota. La restauración es una mutación del monto, y `EX-15` midió que
mutar el monto **no emite webhook**: si se acepta y no se aplica, nadie se entera desde adentro. La
única red es la comparación de monto del barrido diario (capítulo 09 §3), que lo levantaría como
`RECONCILIATION_REQUIRED` un día después — pero sólo si nuestro lado ya escribió el monto nuevo, que
es justo lo que `D5` prohíbe dar por hecho.

**Dónde lo permite el diseño.** `HOS-1354/docs/14-promos-cortesias-y-grants.md` §2.2, tercera fila de
la tabla: *«el contador de **N cobros** | **sigue donde estaba**: cambiar de plan no consume un
cobro»*. No hay ninguna sección que defina el evento de consumo.

**Severidad**: `MEDIA`. **Necesita decisión del owner**: no.

---

### F-8B1-016 — Una cortesía consume (o no) la cuota de pausas del cliente, y nadie lo dice

**Qué se rompe.** Un regalo que le cuesta al cliente un derecho que su plan le da. O, al revés, una
puerta para pausar sin límite pidiendo cortesías.

**El camino.** `DEC-GRANT-003` implementa la cortesía **pausando**, y la pausa vive en una sola tabla
—`subscription_pause`, con su columna `motivo`—. `DEC-SUB-004` cuenta la cuota **por
`user + vertical`**, sobre esa tabla. S9 no pasa por `puedePausar()`, así que no la verifica, pero
nada dice que la fila que escribe no cuente. Una cortesía de dos meses puede estar gastando dos de los
ocho pausa-mes anuales del cliente sin que él lo sepa, y el capítulo 19 §4 —la lista de lo que hay que
decir— no lo incluye.

**Dónde lo permite el diseño.** `HOS-1354/docs/02-modelo-de-datos.md` §2.2, fila `subscription_pause`:
*«suscripción, **motivo** (`CUSTOMER_REQUEST` o `COURTESY`), meses pedidos, inicio, fin previsto, fin
real»* — una sola tabla para los dos motivos, y `nucleo/01-glosario.md` §3 punto 2: *«La cuota se
cuenta por `user + vertical`»*.

**Severidad**: `MEDIA`. **Necesita decisión del owner**: **sí** — es una política, no un detalle.

---

### F-8B1-017 — El tope acumulado de reembolsos está declarado como restricción de base y no lo es

**Qué se rompe.** El único control contra devolver más de lo cobrado está escrito en la columna
«restricciones» del modelo de datos y es un agregado entre filas hermanas, que una restricción de
columna no puede sostener. Dos confirmaciones concurrentes de reembolsos parciales leen el mismo saldo
y las dos pasan.

**El camino.** `refund` declara *«el acumulado nunca supera el monto del pago»*. Eso es una suma sobre
las filas de `refund` del mismo pago, no una propiedad de una fila. El capítulo 04 §1 define el nivel
«base» como *«no admite ningún camino que lo esquive»*, y el capítulo 02 §5 lista los invariantes que
la base puede sostener sola: este no está. `RF-2` midió que el proveedor **sí** valida contra el
saldo, así que la red real es suya — lo cual contradice la premisa de `DEC-ARCH-004` de que el control
es nuestro, y deja de valer con una pasarela distinta.

**Dónde lo permite el diseño.** `HOS-1354/docs/02-modelo-de-datos.md` §2.3, fila `refund`, columna
«restricciones».

**Severidad**: `MEDIA`. **Necesita decisión del owner**: no.

---

### F-8B1-018 — El comprobante es correlativo «sin huecos» y no tiene contradocumento al reembolsar

**Qué se rompe.** Se emite un documento numerado y correlativo por cada cobro, y cuando ese cobro se
reembolsa entero no se emite nada que lo compense. El talonario afirma un cobro que ya no existe. Y la
promesa de «sin huecos» no sobrevive a un fallo de emisión.

**El camino.** El capítulo 02 §2.3 define `receipt` con `UNIQUE(numero), sin huecos` y el §54 lo emite
*por cada cobro*. La máquina de Pago tiene `REFUNDED` y `PARTIALLY_REFUNDED` (capítulo 03 §6) y ningún
capítulo emite un documento por el reembolso ni anula el original. Por el otro lado, garantizar una
secuencia sin huecos obliga a asignar el número en la misma transacción que registra el cobro; si la
generación del PDF es un efecto posterior que puede fallar —y el capítulo 07 §1.1 justamente saca los
efectos remotos de la transacción—, el hueco aparece.

**Dónde lo permite el diseño.** `HOS-1354/docs/02-modelo-de-datos.md` §2.3: *«`receipt` | pago,
número, PDF. **Comprobante no fiscal** (§54, `DEC-LEGAL-001`) | `UNIQUE(numero)`, sin huecos»*.

**Severidad**: `MEDIA`, y sube si la consulta legal del capítulo 22 dice algo sobre la numeración.
**Necesita decisión del owner**: **sí**, junto con el pliego legal.

---

## Ataques que intenté y el diseño resistió

Vale la pena decir qué aguantó, porque en varios casos la defensa es mejor que la media de la
industria.

- **Webhook duplicado.** `UNIQUE(proveedor, id_del_hecho)` en `payment` más la relectura por id del
  capítulo 03 §10.1. Dos instancias en paralelo no necesitan lock. Resiste — salvo para el reembolso,
  que no trae id propio (`F-8B1-013`).
- **Webhooks al revés.** No se apoya en ordenarlos sino en no necesitar el orden: el evento es un
  aviso, se relee el recurso y se escribe lo leído. Los dos órdenes terminan igual. Resiste, y está
  bien argumentado —*«un evento ordenado sigue sin decir el estado actual»*—.
- **Doble clic en «suscribirme».** La clave se acuña y **se persiste antes** de la primera llamada
  (`D4`), y el capítulo 03 §3.4 punto 4 reusa la ventana vigente en vez de crear otra. Resiste el
  caso simple; el que no cubre es el timeout, que es `F-8B1-003`.
- **Pago manual mientras el cliente paga por el proveedor.** Es el único cruce que se lleva a la base:
  `UNIQUE(subscription_id, período) WHERE el pago está acreditado`, más una relectura previa para que
  el admin entienda el rechazo. Es la defensa más fuerte del capítulo 05 y no encontré forma de
  pasarla dentro de una misma suscripción.
- **Orden de aplicación de dos promos.** ARS 700 y nunca 720, con el argumento de por qué dentro de
  cada familia conmuta. Determinista de verdad, no por convención.
- **Promo porcentual sobre un cambio de plan.** Se recalcula sobre el precio nuevo; el fijo se
  traslada; el contador no se consume. Coherente.
- **Extensión de trial el día del vencimiento.** Gana el estado escrito, nunca la hora, con
  concurrencia optimista y el job releyendo dentro de su transacción. Es la resolución de carrera
  mejor escrita del programa — y por eso duele que la misma regla no se haya aplicado a S3
  (`F-8B1-009`).
- **Reembolsar creyendo que da de baja.** `DEC-RF-001` hace de la revocación un solo acto. Resiste.
- **Confundir sandbox con producción en el handler.** `live_mode` no sirve y el diseño lo sabe: el
  guard abre con `GET /users/me` y mira `tags`.
- **Cobrar en otra moneda.** La columna existe con un solo valor admitido y el argumento de por qué
  está bien escrito.
- **Mostrar el `init_point` crudo.** `G10`, y con la razón correcta: es un guard y no un test porque
  es un call site que alguien vuelve a escribir «bien».
- **Que el descuento se aplique dos veces sobre el mismo cobro.** No encontré el camino: el monto es
  un estado del preapproval, no una operación que se repita.

---

## Lo que cae en el hueco del capítulo 13

De mi vector, esto es lo que hoy **no tiene dónde resolverse**, porque su capítulo no existe:

1. **Quién tiene el reloj del cobro.** La spec §5.1 ya lo nombra como *«dos relojes sobre la misma
   autorización son el doble cobro»*. Es el hueco más grande de este vector y está declarado.
2. **La mecánica del reembolso entera**, incluida la clave persistida antes de la llamada
   (`F-8B1-008`), el reintento sobre `2084` (`F-8B1-012`) y `RF-3` en `UNKNOWN`.
3. **Los pagos manuales**, que el §65 mapea al `13` y que no viven en ningún otro capítulo. Lo que
   falta es del vector: **qué es el «período» de un pago manual** para la restricción de C5 —la única
   defensa fuerte del capítulo 05 depende de un concepto que el pago manual no define—, si se emite
   comprobante, y **cómo se devuelve** uno registrado por error, cuando el «proveedor» Manual
   implementa la capacidad 6 sin que exista ningún registro del otro lado.
4. **Qué se hace con un cobro que llega contra una suscripción `ABANDONED` o `CANCELLED`.** El
   capítulo 03 no tiene transición y el 05 no lo lista entre los seis cruces. Es plata entrada sin
   contraparte, y aparece en `F-8B1-006` y `F-8B1-009` por dos caminos distintos.
5. **El cambio de tarjeta sobre N preapprovals** (`EX-36`, `DEC-ADDON-002` implicación 3): cada uno
   con su validación de ARS 0 que puede fallar por separado, y el endpoint **no dice por qué falló**.
   Deja al cliente con parte de sus addons cobrando y parte no. El capítulo 16 lo manda al 13 por
   escrito.
6. **El reembolso prorrateado con que `SUPER_ADMIN` acorta la cola de una vertical discontinuada**
   (capítulo 10 §4.4). Es la única operación de dinero de ese capítulo y no tiene mecánica.
7. **El comprobante por cobro**, que es donde se resolvería `F-8B1-018`.

---

## Fuera de mi vector

Lo que vi y le toca a otro.

- **`NUCLEO` · el conteo de invariantes no cierra.** `nucleo/04-invariantes.md` cierra con
  *«Cuarenta y nueve invariantes, y ocho los sostiene la base»*, mientras su título, el índice del
  núcleo (*«51 invariantes numerados»*) y su propia tabla de §5 (37 + 14) dicen 51. Y §5 aclara que
  14 se reparten sobre 12 porque dos se apoyan dos veces — o sea que ni 49 ni 51 salen de la misma
  cuenta. `BAJA`, pero es el documento cuya utilidad depende de poder preguntar *«¿están todos?»*.
- **`NUCLEO` · no existe la transición «el proveedor canceló por mora».**
  `nucleo/03-maquinas-de-estado.md` §1 regla 1 dice que la tabla es exhaustiva y que lo que no
  está *«no se ejecuta»*, mientras el capítulo 12 §1.4 ordena *«se espeja, no se discute»*. La
  tabla de transiciones del capítulo 03 no
  tiene ninguna entrada para una baja decidida por el proveedor, así que el camino de mora entero
  termina en `RECONCILIATION_REQUIRED`. Es estado, no plata, pero atraviesa el capítulo 12.
- **El residuo declarado del capítulo 12 §4.4 punto 2**: `ABANDONED` significa hoy dos muertes
  distintas —*«nadie autorizó en 72 h»* y *«intentó y lo rechazaron»*— y el capítulo lo deja
  anotado sin resolver. Es vocabulario y comunicación.
- **El contrato de cobertura no define `hasta` para una suscripción en `GRACE_PERIOD` ni en
  `CANCEL_SCHEDULED`.** El campo se describe como *«la fecha hasta la que cubre»*, y en grace el
  período en curso **no se pagó** (capítulo 12 §5.2). Qué fecha cruza la frontera decide qué avisos
  con ventana muestra verticales. Es frontera y acoplamiento.
- **El cruce C4 permite comprar un addon sobre un downgrade programado**, y el capítulo 16 §2.2
  declara que una suscripción válida es `ACTIVE` *«y sólo `ACTIVE`»*. Durante la ventana de C4 la
  suscripción sigue `ACTIVE`, así que las dos reglas son compatibles — pero el excedente resultante
  es materia del reconciliador de la otra épica.
- **`WH-4` midió reintentos con backoff pero no cuántos**, y el diseño del outbox y del receptor se
  apoya en que el proveedor reintenta. Es idempotencia y huérfanos.
