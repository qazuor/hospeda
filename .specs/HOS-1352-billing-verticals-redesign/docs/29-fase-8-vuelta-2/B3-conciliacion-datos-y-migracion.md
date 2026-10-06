---
title: "FASE 8 vuelta 2 · B3 — conciliación, datos y migración"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 2 · B3 — conciliación, datos y migración

Ataqué la conciliación contra Mercado Pago (`B/09` entero: inventario por id, huérfanas por
webhook, las comparaciones del barrido, las cuatro salvedades, las comprobaciones de cero
llamadas, el reintento de cancelaciones, la vida del barrido), el modelo de datos de billing
(`B/02` §2.2, §2.3, §2.6, §4 y §5), el desempate de cobros de `B/05` §3, la terminación de promos
de `B/14` §1 y §2.4, la migración (`B/21`) y el corte (`16-fase-7-del-paraguas.md` §4). Contrasté
cada supuesto sobre el proveedor contra `06-mp-validation-matrix.md` y, donde el diseño describe
el sistema viejo, contra el código actual. Medido sobre el worktree en HEAD `1cccd9119d`.

Son **9 hallazgos**: **0 CRITICA, 3 ALTA, 5 MEDIA y 1 BAJA**. La idea más grave: **nadie compara
el monto que el proveedor efectivamente COBRÓ contra el esperado** —el barrido mira el monto del
preapproval y `P1` acredita cualquier importe—, así que un cobro de más en un ciclo es invisible
para siempre; y el corte promete que el cobro en vuelo sin marca es cosa de minutos cuando la
matriz dice que el registro de cobro vive un ciclo entero.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

Ninguno.

## ALTA

### F-8V2B3-001 — El monto COBRADO no lo compara nadie: un cobro de más en un ciclo es invisible

**Qué se rompe.** El barrido compara el monto esperado contra el `transaction_amount` **del
preapproval**, y el §4 de `B/09` lee los registros de cobro sólo para contestar *«¿cobró?»*
(`payment.status`), nunca *«¿cuánto?»*. `P1` acredita el pago con el monto que traiga, y además
decrementa el contador de la promo. La única comparación del monto de un cobro contra el esperado
del período es la condición 2 de `B/05` §3, y ese § **no corre** sobre una fila que puede recibir
el cobro. Resultado: cuando el proveedor cobra un importe distinto del esperado para ese ciclo y
el preapproval ya muestra el monto correcto, los dos lados «coinciden» y el cobro de más queda
asentado sin marca. La matriz sólo midió que el proveedor cobra el monto vigente **cuando la
mutación ocurrió mucho antes del cobro**; qué importe usa un registro de cobro ya creado (o en
reintento, que vive un ciclo) cuando la mutación cae en medio, no está medido.

**El camino.**

1. Juan tiene un plan de ARS 30.000 con `next_payment_date` a las 13:13 de hoy.
2. A las 13:40 canjea una promo de 50 % «primer cobro». El sistema muta el preapproval a 15.000 y
   la relectura lo confirma (`D5`).
3. El proveedor ejecuta el lote de las 14:02 sobre el registro del ciclo, creado antes de la
   mutación, y cobra 30.000 (comportamiento no medido; el diseño no lo descarta).
4. Llega el webhook; `P1` acredita el pago de 30.000, decrementa `cobros_restantes` a 0 y corre
   `S30`, que muta el preapproval de vuelta a 30.000.
5. El barrido del día siguiente: monto esperado (sin promo, contador en 0) = 30.000 =
   `transaction_amount`. Coincide. Ninguna marca, ninguna alerta.
6. Juan pagó precio entero, perdió su promo, y la única pista es un correo del proveedor
   («El vendedor Hospeda cambió el monto») que le llega a él y no a nosotros.

El mismo agujero alcanza al downgrade de `DEC-SUB-008` (que muta el monto en el acto) y a
cualquier reintento de un ciclo en grace que cruce una mutación.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:271`
  — "el monto coincide con el esperado para el período que cubre"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:271`
  — "un monto distinto puede ser otro cobro, un cambio de precio no propagado, o un error"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:270`
  — "Este § no corre sobre una fila que puede recibir el cobro ni sobre la lápida del corte"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:235`
  — "Se decrementa UNA vez por cobro confirmado, y «confirmado» tiene una sola lectura"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:246`
  — "el monto se muta cuando el cliente lo pide. Lo que corre al fin del ciclo no lleva"
- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:42`
  — "el proveedor cobra el monto VIGENTE al momento del cobro, no el del alta"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:923`
  — "reintenta y en qué estado deja la suscripción —cuatro intentos dentro de un ciclo, y al vencer"

Silencio: `rg -n "monto cobrado|monto del cobro|monto que cobr"` sobre `B/`, `NUCLEO/` no
devuelve ninguna regla que compare el importe de un registro de cobro con el esperado.

**Qué haría falta decidir o escribir.** Si `P1` (o la comparación de cobros del barrido) compara
el importe cobrado contra el monto esperado del período del registro, con qué motivo marca, y si
el decremento de la promo espera a que el cobro haya salido con descuento. Y medir en el paso 0
qué importe cobra un registro ya creado cuando la mutación cae antes del lote o durante sus
reintentos.

### F-8V2B3-002 — El cobro en vuelo del corte no es de «minutos»: el registro reintenta un ciclo entero

**Qué se rompe.** `G3-1` acepta que el cobro en vuelo del corte se asiente sobre la lápida sin
marca y sin devolución, y lo declara con una población acotada a *«la ventana de minutos del paso
1b»*. La matriz dice otra cosa: el registro de cobro reintenta **durante un ciclo** (un mes en un
plan mensual), el estado `recycling` se midió justamente **sobre preapprovals que el proveedor ya
había cancelado**, y cambiar el medio de pago dispara un reintento inmediato que cobra. Que
cancelar el preapproval cierre esa puerta es diseño, no medición (`GR-2` sigue `UNKNOWN`). Así, un
cliente del viejo con su renovación rechazada al momento del corte puede ser cobrado **días o
semanas después**, y ese cobro cae en la regla de «sin marca», fuera del desempate y fuera de la
comparación de cobros. El detector declarado no lo alcanza: la re-verificación de `B/21` §1.3 se
mide el día del corte, antes del cobro, y *«una consulta que lista»* las lápidas con `payment` no
tiene quién ni cuándo la corra.

**El camino.**

1. El 25/11 rechaza la renovación de Juan en el sistema viejo; el registro queda reintentando
   (ventana de un ciclo) y el proveedor le manda correos pidiéndole actualizar la tarjeta.
2. El 05/12 el paso 1b cancela su preapproval; el paso 2 lo relee `cancelled`; el paso 4 le
   escribe una lápida del corte. Al llamarlo, el owner le dice que arranca de cero con trial.
3. El 12/12 Juan hace caso al correo del proveedor y cambia la tarjeta; el reintento del registro
   abierto cobra (`GR-1`: el cambio dispara el reintento), si cancelar no cortó el reciclado.
4. El handler nuevo encuentra la lápida por su `provider_link` y asienta el `payment` sin marca.
5. Ningún listado lo muestra, el barrido no compara cobros sobre la lápida, y la lista con la que
   el owner llamó es del 05/12. Juan pagó un mes de un servicio que ya no existe y nadie lo ve.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:398`
  — "Población: los clientes con un cobro en vuelo en la ventana de minutos del paso 1b"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:75`
  — "viva en el sistema viejo, medida el día del corte"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:923`
  — "reintenta y en qué estado deja la suscripción —cuatro intentos dentro de un ciclo, y al vencer"
- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:280`
  — "medido sobre las altas que el proveedor canceló al rechazar el primer cobro"
- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:200`
  — "El cambio de medio dispara un reintento inmediato"
- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:201`
  — "sobre el pagador con tarjeta la contesta el DISEÑO, no una medición, y deja de bloquear"

**Qué haría falta decidir o escribir.** O se mide en el paso 0 si cancelar un preapproval corta
el reciclado de un registro abierto, o la declaración de `G3-1` tiene que nombrar la población
real (todo cliente del viejo con un registro abierto al corte, durante un ciclo) y un detector que
corra **después** del corte —por ejemplo, que el cobro sobre una lápida del corte entre al listado
aunque no se proponga devolverlo—. Es del owner si la decisión de no devolver se sostiene con esa
población.

### F-8V2B3-003 — Entre el paso 3 y el paso 4 el handler nuevo convierte los ids del corte en lápidas de recepción

**Qué se rompe.** En el paso 3 el handler nuevo queda recibiendo los webhooks del proveedor; las
lápidas del corte recién se escriben en el paso 4. En esa ventana, todo evento de un preapproval
cancelado en el 1b llega como desconocido, no nombra ninguna fila nueva, y el handler escribe una
**lápida de recepción** con su `provider_link`. La ventana no está vacía: durante el rollout del
paso 3 el contenedor viejo está apagado, así que los eventos de ese rato fallan y el proveedor
los reentrega después (+18 min, +35 min, +6 h, `WH-4`); y el código viejo **devuelve 500 a
propósito** ante un cobro de un preapproval que no resuelve, que es exactamente la autorización
que sólo estaba en el proveedor. Dos consecuencias:

- **El cobro en vuelo recibe el tratamiento opuesto al decidido.** Sobre una lápida de recepción
  el motivo es `PAGO_TARDÍO_RECHAZADO` con la propuesta de devolver; `G3-1` decidió no devolver.
  Y como `origen_de_lápida` es inmutable, no hay forma de corregirlo después.
- **El paso 4 choca con la base.** `provider_link` es único por id del proveedor, así que la
  herramienta de B11 no puede escribir la lápida del corte de ese id. Qué hace ante el choque
  (abortar, saltear, fallar la tanda) no está escrito, y el paso 4 es condición del paso 5
  (abrir altas), ya pasado el punto de no retorno.

**El camino.**

1. Juan tiene la autorización viva que sólo estaba en el proveedor (como `f6d89f71…`). Su cobro
   entra justo durante el 1b; el handler viejo responde 500 (`SubscriptionNotResolvedError`).
2. El paso 3 apaga el contenedor viejo y apunta la URL al handler nuevo.
3. A los 35 minutos el proveedor reentrega el cobro; el handler nuevo no encuentra el id, el
   `external_reference` no nombra ninguna fila nueva, y escribe una lápida de recepción con el
   `payment` y la marca `PAGO_TARDÍO_RECHAZADO` con default de devolver.
4. El paso 4 intenta sembrar la lápida del corte de ese id y choca con el `UNIQUE`.
5. Según quién implemente la herramienta, el corte queda trabado con las altas cerradas, o sigue
   y alguien le devuelve a Juan un cobro que el owner decidió no devolver.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:131`
  — "y verificados, conocidos por la base o no, sondas incluidas salvo las del manifiesto"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:146`
  — "Durante el rollout del paso 3 el contenedor viejo no atiende el webhook ni corre crons"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:162`
  — "porque desde R6 todo id cancelado y verificado tiene una, conocido por la"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:316`
  — "desconocido: el handler le escribe una lápida de recepción y la marca"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:51`
  — "una suscripción tiene a lo sumo un vínculo, y el vínculo no tiene estado"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:47`
  — "e inmutable, porque el motivo de un cobro sobre la lápida depende de quién la escribió"
- `apps/api/src/routes/webhooks/mercadopago/error-classification.ts:43` (código actual)
  — "resolvable local subscription, deliberately re-thrown to force a retry)"
- `apps/api/src/routes/webhooks/mercadopago/event-handler.ts:265` (código actual)
  — "with no resolvable local subscription) lands here by design: it carries no"

Silencio: `rg -n -i "paso 3 y el paso 4|antes del paso 4|ON CONFLICT|ya tiene lápida"` sobre
`16-fase-7…`, `B/21`, `B/09`, `B/02` y la descomposición de billing no devuelve ninguna regla para
esta ventana ni para el choque.

**Qué haría falta decidir o escribir.** Si el handler nuevo retiene (o no trata como desconocidos)
los eventos de ids del manifiesto del 1b hasta que el paso 4 cierre, o si el paso 4 se hace antes
de apuntar la URL; y qué hace la herramienta del paso 4 cuando el id ya tiene lápida de recepción.

## MEDIA

### F-8V2B3-004 — El handler de desconocidos cancela las sondas que el corte deja vivas a propósito

**Qué se rompe.** El corte exceptúa del 1b las sondas con una medición abierta, y describe que
sus cobros siguientes se cuelgan de una sola marca. Pero desde `X-1` el handler que escribe la
lápida de recepción **cancela el preapproval en el mismo acto**: la primera vez que la sonda
emite un evento, la medición que justificaba dejarla viva muere, y el texto del corte sigue
describiendo cobros que ya no van a ocurrir. Lo mismo alcanza a la sonda de la entrega del paso
3: el handler le escribe una lápida de recepción, abre `TRANSICIÓN_NO_DECLARADA` y la cancela en
paralelo con la herramienta, un residuo en producción que ningún paso declara. Dos
implementadores resuelven distinto si los ids del manifiesto se exceptúan del handler.

**El camino.**

1. El owner deja viva la sonda `S` para terminar de medir `GR-2`; queda en el manifiesto.
2. Tras el corte, `S` emite su primer evento; el handler no la conoce, escribe la lápida de
   recepción y manda cancelarla.
3. La medición abierta se pierde; su fila de la matriz queda `UNKNOWN` sin sujeto, y una persona
   tiene en el listado una marca con default de devolverle al owner su propio cobro.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:134`
  — "salvo las que tengan una medición abierta el día"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:144`
  — "siguientes se cuelgan de esa misma marca, un solo caso por sonda"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:87`
  — "Y en el mismo acto el handler manda cancelar su"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:75`
  — "así que esa cancelación no alcanza a un cliente actual: alcanza a una autorización del"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:128`
  — "La sonda se da de alta con una llamada directa a la API del proveedor desde la herramienta del corte"

**Qué haría falta decidir o escribir.** Si los ids del manifiesto de sondas (y la sonda de la
entrega) quedan exceptuados de la cancelación del handler, o si se acepta que el corte mata toda
medición abierta y el §4.2 deja de prometer cobros siguientes.

### F-8V2B3-005 — Qué corre al asentar un cobro sobre una lápida no está escrito, y la lápida no tiene usuario

**Qué se rompe.** El cobro sobre una lápida (la del corte sin marca, la de recepción con marca)
*«se asienta»*: se escribe un `payment`. Pero el diseño no dice si ese asiento es `P1` entero, y
`P1` emite el comprobante numerado y, siendo el primer pago acreditado de la fila, el aviso de
cobertura a verticales, que lleva usuario y vertical. La lápida no tiene ninguno de los dos. Un
implementador corre `P1` y emite un comprobante sin destinatario y un aviso con usuario nulo; otro
no lo corre y deja un `payment` en `PENDING`. Si el aviso falla dentro de la transacción del
asiento, el `payment` no se escribe, y ése es el único detector que `G3-1` declara.

**El camino.**

1. Llega el cobro en vuelo de Juan sobre su lápida del corte.
2. El handler escribe el `payment` y corre `P1`: comprobante con número correlativo y sin
   cliente; aviso de cobertura con `user` nulo.
3. El consumidor de verticales rechaza el aviso; si el aviso va en la misma transacción, todo se
   revierte y el cobro de Juan queda sin fila, sin marca y fuera del barrido.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:236`
  — "y se asienta sobre ella sin marca: se escribe su"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:150`
  — "y nada más: ni usuario, ni vertical, ni versión, ni billing option"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1771`
  — "Y si es el primer pago acreditado de una suscripción, emite el aviso de cobertura"

**Qué haría falta decidir o escribir.** En qué estado nace el `payment` sobre una lápida, si emite
comprobante y si emite aviso de cobertura (lo natural es que no, pero hay que escribirlo en `P1`).

### F-8V2B3-006 — La exención de las terminales descansa en «cancelado = no puede cobrar», que no está medido

**Qué se rompe.** El criterio que saca del barrido a una terminal es que su autorización *«quedó
imposibilitada de cobrar»* porque el proveedor la canceló o una relectura confirmó nuestra
cancelación. La matriz midió registros de cobro en `recycling` **sobre preapprovals ya
cancelados**, y cambiar la tarjeta dispara un reintento que cobra. Si un registro abierto cobra
después de la cancelación confirmada, la fila (`S16`, `S17`, el espejo) ya salió del barrido, y el
único camino que lo ve es el webhook del pago; si esa entrega se pierde o tarda días (`WH-2`,
`WH-5`), nadie lo ve. Es un residuo de borde porque el webhook lo cubre en el caso normal.

**El camino.**

1. El primer cobro de Juan se rechaza; `S16` cancela su preapproval, la relectura lo ve
   `cancelled` y la fila sale del barrido en `CHARGE_DECLINED`.
2. Juan cambia la tarjeta en su cuenta del proveedor; el registro abierto reintenta y cobra.
3. La entrega del webhook del pago se pierde; el barrido no relee la fila. Juan pagó y no tiene
   servicio ni marca.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:168`
  — "Una fila terminal está exenta cuando su autorización quedó imposibilitada de cobrar por algo"
- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:280`
  — "medido sobre las altas que el proveedor canceló al rechazar el primer cobro"
- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:201`
  — "los bordes: un cobro ya en vuelo en el instante de"

**Qué haría falta decidir o escribir.** Una fila en la matriz que mida si un registro en
`recycling` cobra después de cancelado el preapproval, o que la exención espere a que el registro
abierto del ciclo pase a `processed` (su `expire_date` ya lo trae, `RC-7`).

### F-8V2B3-007 — La comparación de monto marca a toda fila viva cuyo preapproval ya está cancelado

**Qué se rompe.** El monto esperado se deriva con los aumentos de `DEC-MP-002` aplicados, y la
comparación sólo exceptúa a `PAUSED`. Pero `CANCEL_SCHEDULED` y la `SUSPENDED` de tarjeta son
filas vivas con el preapproval **cancelado** (`S11`, `S6`), cuyo `transaction_amount` ya no se
puede mutar. Después de un aumento, cada una diverge para siempre: el barrido reintenta tres días
una mutación imposible y abre `DIVERGENCIA_DE_MONTO`. El listado accionable se llena de marcas sin
acción posible, que tapan las divergencias reales.

**El camino.**

1. Juan pide la baja: `S11` lo deja `CANCEL_SCHEDULED` hasta fin de ciclo, preapproval cancelado.
2. Entra en vigencia un aumento del plan; el monto esperado de Juan sube.
3. El barrido compara 36.000 esperado contra 30.000 del preapproval cancelado; la mutación da
   `400`; a los 3 días abre `DIVERGENCIA_DE_MONTO` sobre Juan, y lo mismo sobre cada suspendido.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:271`
  — "Ese precio es el vigente de la versión, con los"
- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:220`
  — "Cancelación inmediata e irreversible, igual que"

Silencio: `rg -n "No se compara|no compara el monto"` sobre `B/09` y `B/14` sólo encuentra la
excepción de `PAUSED`; ninguna para `CANCEL_SCHEDULED` ni para `SUSPENDED` con tarjeta.

**Qué haría falta decidir o escribir.** Que la comparación de monto no corra sobre una fila cuyo
preapproval la relectura ve `cancelled`, o que el aumento no alcance a esas filas.

### F-8V2B3-008 — No hay regla de redondeo para el monto derivado en centavos

**Qué se rompe.** Los montos son enteros en la unidad mínima, y el monto esperado se deriva
multiplicando porcentajes. Dos porcentajes apilados sobre un precio en centavos dan fracciones de
centavo, y el diseño no dice cómo se redondea ni en qué paso (la afirmación de que las
operaciones «conmutan» deja de ser cierta con redondeo por paso). El barrido compara ese derivado
contra el `transaction_amount` releído: si el que muta y el que compara redondean distinto, la
divergencia es permanente, y como un canje no está en la lista de mutaciones nuestras, marca en
el acto.

**El camino.**

1. Juan paga ARS 9.999 (999.900 centavos) y apila un 15 % y un 10 %: 764.923,5 centavos.
2. El canje muta el preapproval a 7.649,23; el barrido deriva 764.923,5 (o 764.924).
3. Divergencia de medio centavo todos los días: marca `DIVERGENCIA_DE_MONTO` sobre Juan.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:362`
  — "El monto es entero, en la unidad mínima de la moneda."
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:49`
  — "porcentajes se multiplican y los fijos se suman, y las dos operaciones conmutan."

Silencio: `rg -n -i "redonde|centavo|decimal"` sobre `B/` y `NUCLEO/` sólo encuentra el redondeo
de la fracción de mes de la cortesía, nada sobre montos.

**Qué haría falta decidir o escribir.** Una regla única de redondeo (cuándo y hacia dónde), usada
por quien muta y por quien compara.

## BAJA

### F-8V2B3-009 — El plan que anclan las cortesías del owner se describe con dos verticales

**Qué se rompe.** El paso 3b ancla *«el vendible de rank más alto de Alojamiento, en la vertical
en que tenían comp»*. Si alguna cortesía no era de Alojamiento, la frase pide anclar un plan de
Alojamiento en otra vertical, que la base rechaza (el plan del ancla pertenece a su vertical); el
texto sólo es coherente si las dos son de Alojamiento, y eso no está dicho.

**El camino.**

1. Una de las dos cuentas de demostración del owner tenía `comp` en Gastronomía.
2. La herramienta de B9 lee «el vendible de Alojamiento» y lo ancla en Gastronomía; la
   restricción del ancla lo rechaza y el paso 3 entra en la rama de aborto.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:130`
  — "más alto de Alojamiento, en la vertical en que tenían"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:110`
  — "vigente el día del corte, en la vertical en que tenían"

**Qué haría falta decidir o escribir.** Decir «de la vertical en que tenían `comp`» o afirmar que
las dos son de Alojamiento.

## Ataques que intenté y el diseño resistió

- **Imputar el cobro viejo a la suscripción nueva de la misma persona**: lo para la precondición
  de re-vinculación de `B/09` §2.4 más `UNIQUE(subscription_id)` en `provider_link`.
- **Listar desde el proveedor y terminar en verde**: el inventario sale de nuestra base y se lee
  por id (`RC-1`, `RC-2`); el buscador sólo filtra por `payer_email`.
- **Concluir «cobró» desde `charged_quantity`**: `B/09` §4 lo reescribió con `RC-5`/`RC-6`.
- **Comparar `version` sobre la relectura**: se compara `last_modified` (`RC-9`).
- **Cobro duplicado del mismo período**: `covered_period` con su `UNIQUE` parcial y
  `COBRO_DUPLICADO`.
- **Barrido muerto en silencio**: monitor externo con ping por corrida completa (§7.1).
- **Lápida del corte sobre un preapproval vivo**: el gate del paso 2 relee cada id antes de
  escribirla, así que la salvedad 4 sobre ella es redundante pero no dañina.

## Fuera de mi vector

- **Cómo se llega del webhook `payment` (que trae el id del pago) al id del registro de cobro**
  que `payment` usa como clave: es del capítulo de webhooks.
- **El borrado de la cuenta**: `V/02` declara el proceso de anonimización sin diseñar, y la FK de
  `subscription.user` no dice qué pasa al borrar; si cascadeara, borraría pagos y vínculos que
  `B/02` §4.1 conserva siempre. Es del vector de retención/verticales.

## Key Learnings

1. El diseño compara el monto del preapproval, nunca el del cobro: toda divergencia entre lo que
   se cobró y lo esperado en un ciclo concreto es invisible.
2. «Cancelar corta el reciclado» es premisa de diseño, no medición; sostiene la exención de las
   terminales y la declaración de «minutos» del cobro en vuelo del corte.
3. La ventana entre el paso 3 y el paso 4 del corte no está gobernada: el handler nuevo ya
   recibe eventos de ids que todavía no tienen lápida del corte.
4. Toda regla que el handler aplica a «desconocidos» alcanza también a las sondas propias; el
   manifiesto de sondas no es consultado por el handler.
