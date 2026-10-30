---
title: "FASE 8 vuelta 2 · C2 — liberación, coexistencia y migración"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 2 · C2 — liberación, coexistencia y migración

Ataqué el corte del sistema viejo al nuevo como una secuencia que se ejecuta una vez, con dos
sistemas vivos a la vez y un proveedor que reintenta: el orden del `16-fase-7-del-paraguas.md` §4
(pasos 0 a 5, la rama de aborto y el §4.3), las dos mitades del capítulo 21 (`B/21`, `V/21`), la
lápida de recepción y la re-vinculación de `B/09` §2.4, la forma de fila de `B/02` §2.2 y lo que el
código actual del viejo hace con un evento que no reconoce (el handler de cobros, el de estado y la
recuperación de preapprovals). Medí contra el HEAD `1cccd9119d` del worktree
`hospeda-spec-hos-1352-billing-redesign`, sin mover el árbol.

Son **7 hallazgos**: **0 CRITICA, 4 ALTA, 2 MEDIA y 1 BAJA**. La idea más grave: el corte razona
como si el viejo tragara en silencio todo evento desconocido, pero el código viejo devuelve 500 a
un cobro que no reconoce y Mercado Pago lo reintenta; ese reintento cruza el despliegue y puede
llegar al handler nuevo **antes** de las lápidas, donde choca con la regla del cobro en vuelo y con
la unicidad del `provider_link`. Y la rama de aborto vuelve a la imagen vieja sin devolver la URL de
notificación, así que quien se re-suscribe después de un aborto paga sin que nadie lo vea.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

Ninguno.

## ALTA

### F-8V2C2-001 — La rama de aborto no devuelve la URL de notificación al handler viejo

**Qué se rompe.** El paso 3 apunta la URL de notificación de la aplicación del proveedor a la ruta
del handler nuevo. Si el paso 3 falla después de eso y se aborta, la rama de aborto vuelve a
desplegar la imagen vieja y reenciende su webhook y sus crons, pero **no nombra devolver la URL**.
El sistema viejo queda corriendo sin recibir un solo evento. La rama de aborto le pide a los
clientes cancelados en el 1b que se re-suscriban por el link reactivado, y el proveedor les cobra en
el acto porque no repite el trial. Esa alta llega por un link de plan (un preapproval que la base
vieja no creó), y el código viejo la vincula **sólo** desde el webhook (el fallback HOS-191/HOS-276).
Sin webhook no hay vínculo. Juan paga y en Hospeda no queda ninguna suscripción ni ficha arriba, y
ningún detector lo ve: el reintento del viejo sólo cubre eventos que recibió. Queda condicionado a
que la ruta nueva sea distinta de `/api/v1/webhooks/mercadopago`: el diseño dice *«la ruta del
handler nuevo»* y no fija el path.

**El camino.**

1. El paso 1b le cancela el preapproval a Juan, cliente `trialing`. El paso 2 cierra y se toma el
   backup del 2b.
2. El paso 3 despliega y apunta la URL de notificación del proveedor a la ruta del handler nuevo.
3. El 3b falla. Se aborta: se reactivan los planes, se restaura el backup, se vuelve a desplegar la
   imagen vieja y se reencienden su webhook y sus crons. Nadie toca la URL.
4. Juan, siguiendo la rama de aborto, se re-suscribe por el link del plan reactivado. Mercado Pago no
   le da trial y le cobra ARS 18.000 en el acto.
5. Mercado Pago notifica a la ruta nueva, que no existe en la imagen vieja. Después de los
   reintentos, el evento se pierde.
6. El viejo nunca vincula ese preapproval. Juan pagó y su ficha sigue abajo. Cada mes vuelve a
   cobrarle.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:128`
  — "y apuntar la URL de notificación de la aplicación del proveedor a la ruta del handler nuevo"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:280`
  — "se vuelve a desplegar la imagen vieja, se reencienden su"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:281`
  — "webhook y sus crons (lo inverso de `DB-5`) y se verifican los dos"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:287`
  — "Los clientes cuyos preapprovals se cancelaron en el paso 1b se re-suscriben por el link"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:290`
  — "ya no les da el trial, porque lo concede una vez por pagador y plan"
- `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts:692` (código actual)
  — "'HOS-191: linked share-link checkout preapproval to local subscription via webhook fallback'"
- El silencio. `rg -n "notificaci|notification_url|URL de" 16-fase-7-del-paraguas.md` da una sola
  línea, la 128 (el paso 3). La rama de aborto (líneas 262 a 295) no la nombra.

**Qué haría falta decidir o escribir.** Si la rama de aborto incluye devolver la URL de
notificación a la ruta del viejo, verificada con una entrega real, igual que su apuntado en el paso 3.
También, si la ruta del handler nuevo es la misma que la del viejo, en cuyo caso el hallazgo no
existe y conviene decirlo.

### F-8V2C2-002 — Un cobro reintentado llega al handler nuevo antes de las lápidas y choca con el paso 4

**Qué se rompe.** El corte da por hecho que el handler viejo se traga el evento desconocido y que
Mercado Pago no reintenta. Eso vale para los eventos de **estado**. Para un **cobro**, el código
viejo responde 500 a propósito (HOS-276) y Mercado Pago lo reintenta. Además, durante el rollout del
paso 3 el viejo está apagado, así que **todo** evento de esa ventana falla y se reintenta. Esos
reintentos llegan a la ruta del handler nuevo en cuanto la URL se apunta, que es en el paso 3,
**antes** del paso 4 que siembra las lápidas. En ese intervalo el id no tiene lápida del corte y el
`external_reference` viejo no nombra ninguna fila nueva. El handler escribe entonces una **lápida de
recepción** con `PAGO_TARDÍO_RECHAZADO`, que le propone a una persona devolver el cobro (lo opuesto a
`G3-1`), y manda cancelar. Después, el paso 4 intenta escribir la lápida del corte sobre el mismo id
y choca con `UNIQUE(proveedor, id_del_proveedor)`. El diseño no dice si la herramienta de B11 aborta
o saltea. Si aborta, el corte queda a medias pasado el punto de no retorno. Si saltea, el mismo
cobro en vuelo recibe tratamientos distintos según el minuto en que llegó.

**El camino.**

1. Juan conoció la plataforma por el link público del plan Basic y su preapproval no está en la base.
   El 1b se lo cancela, pero un cobro ya estaba en vuelo.
2. El evento del cobro llega al webhook viejo, que no encuentra fila y responde 500. Mercado Pago
   programa el reintento.
3. Arranca el paso 3: se apaga el viejo, se despliega el nuevo y se apunta la URL.
4. El reintento llega al handler nuevo. No hay lápida del corte todavía, así que escribe una lápida
   de recepción con el `payment` y la marca `PAGO_TARDÍO_RECHAZADO`.
5. Una persona ve la propuesta de devolver y contesta SÍ. La plata sale, contra la decisión `G3-1`.
6. El operador corre la herramienta del paso 4 y el id de Juan choca con la unicidad del
   `provider_link`.

**La evidencia.**

- `apps/api/src/routes/webhooks/mercadopago/subscription-payment-handler.ts:1223` (código actual)
  — "// `response.error(message, 500)` — an actual non-2xx, so MercadoPago"
- `apps/api/src/routes/webhooks/mercadopago/subscription-payment-handler.ts:1224` (código actual)
  — "// retries the delivery instead of us swallowing a settled charge."
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:146`
  — "Durante el rollout del paso 3 el contenedor viejo no atiende el webhook ni corre crons"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:149`
  — "que no conoce (`local_row_not_found`), y MercadoPago no reintenta."
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:162`
  — "del paso 4, su lápida, porque desde R6 todo id cancelado y verificado tiene una"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:86`
  — "§2.5— y su `provider_link`, y de ella cuelgan el `payment` y la marca, `PAGO_TARDÍO_RECHAZADO` si"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:236`
  — "encuentra la lápida por su `provider_link` y se asienta sobre ella sin marca: se escribe su"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:51`
  — "una suscripción tiene a lo sumo un vínculo, y el vínculo no tiene estado."
- El silencio. `rg -n "paso 3 y el (paso )?4|antes de las lápidas|antes de sembrar" $D/nucleo $V
  $B $D/12-contrato-de-cobertura.md $D/16-fase-7-del-paraguas.md` sólo devuelve las filas 128 y 130
  del orden. Ninguna trata un evento que llegue entre el paso 3 y el 4.

**Qué haría falta decidir o escribir.** Qué hace el handler nuevo con un id del manifiesto del 1b
antes del paso 4. Hay tres salidas posibles: sembrar las lápidas antes de apuntar la URL, que el
handler consulte el manifiesto, o que la herramienta del paso 4 convierta una lápida de recepción en
lápida del corte. También falta la regla de la herramienta del paso 4 ante un `provider_link` que ya
existe y, en general, si las herramientas del 3b y del paso 4 se pueden correr dos veces.

### F-8V2C2-003 — Al titular de una autorización que sólo el proveedor conoce se le cancela sin aviso ni detector

**Qué se rompe.** El censo del 1b sale del proveedor precisamente porque la base no ve todas las
autorizaciones: ya se encontró una viva, creada desde un link de plan. Pero la población a avisar y
la lista con la que el owner llama salen **de la base**: fichas y suscripciones del sistema viejo.
El titular de una autorización que sólo existe en el proveedor queda afuera de las dos. Se le
cancela en el 1b sin llamada ni correo, y el correo de baja del viejo tampoco sale porque el handler
de estado no encuentra fila. Lo que haya pagado por el período en curso se pierde, como declara
`G1-4`, pero la declaración se apoya en que *«el aviso previo lo dice»* y en un detector que lee la
base. Para esta persona las dos cosas son falsas. Es plata cobrada sin asiento del lado de Hospeda y
sin que nadie sepa a quién llamar.

**El camino.**

1. Juan se suscribió desde el link público del plan Basic. El vínculo del viejo falló y en la base no
   hay fila suya. Mercado Pago le cobró ARS 18.000 el día 20.
2. El día del corte, el owner mide la población de `B/21` §1.3 en la base y Juan no aparece. No
   recibe llamada ni correo.
3. El 1b recorre el proveedor, encuentra el preapproval de Juan y lo cancela. El paso 4 le escribe
   una lápida sin usuario.
4. El handler viejo recibe la cancelación, responde `local_row_not_found` y no manda correo de baja.
5. Juan pagó un mes que no usa, su preapproval desapareció y nadie de Hospeda lo contacta. La
   re-verificación del §1.3 no lo lista.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:125`
  — "tomados del recorrido sin filtro del proveedor y no de nuestra base."
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:251`
  — "filtro de los 108 preapprovals de la cuenta encontró una autorización viva, del propio owner, que"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:74`
  — "La población a avisar es toda persona con una ficha que no sea `L1` o con una suscripción"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:381`
  — "§1.3 lista quién pagó y qué, y es la lista con la que el owner llama; un reclamo que llegue"
- `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts:706` (código actual)
  — "return { success: true, statusChanged: false, outcome: 'local_row_not_found' };"

**Qué haría falta decidir o escribir.** Qué se hace con los ids del censo que no están en la base: si
el manifiesto del 1b trae el pagador (el preapproval tiene `payer_email`) y si esa persona entra a la
población a avisar, o si se declara que se la cancela sin aviso, con su causa y su población.

### F-8V2C2-004 — El gate del paso 2 relee una vez, y el código viejo registra cancelaciones que se deshicieron horas después

**Qué se rompe.** El paso 2 es el gate que vuelve segura la secuencia: relee cada id y exige
`cancelled`. La fila `PA-5` de la matriz dice que la cancelación es irreversible, pero lo midió en
sandbox. El código actual documenta seis preapprovals que leyeron `cancelled` en el `PUT` y en un
`GET` inmediato, y horas después leyeron `authorized` o `pending`. Si eso le pasa a un id del corte,
el gate da verde y el preapproval vuelve a cobrar después del corte. Ese cobro cae sobre una lápida
del corte, y por `G3-1` se asienta **sin marca** y sin propuesta de devolver: no entra al desempate
ni a la comparación de cobros. La salvedad 4 marca el estado a los 3 días, pero el cobro de ese
preapproval no es un «cobro en vuelo» y el diseño lo trata igual. Si además Juan ya contrató en el
sistema nuevo, paga dos veces.

**El camino.**

1. El 1b cancela el preapproval de Juan. El paso 2 lo relee `cancelled` y el corte avanza.
2. Horas después Mercado Pago lo muestra `authorized`, como en los seis casos del código.
3. Juan, que ya recibió el aviso, publica su ficha en el sistema nuevo y luego contrata.
4. Llega la fecha de cobro del preapproval viejo y Mercado Pago le cobra ARS 18.000.
5. El handler nuevo encuentra la lápida del corte y asienta el cobro sin marca. Nadie propone
   devolverlo.
6. Juan pagó el ciclo en los dos sistemas. La marca de la salvedad 4, a los 3 días, habla del estado
   del preapproval y no del cobro.

**La evidencia.**

- `apps/api/src/services/billing/preapproval-recovery.service.ts:22` (código actual)
  — "* second `GET`, never acted on immediately. Six preapprovals were observed"
- `apps/api/src/services/billing/preapproval-recovery.service.ts:23` (código actual)
  — "* reporting `cancelled` on both the `PUT` and an immediate `GET`, then"
- `apps/api/src/services/billing/preapproval-recovery.service.ts:24` (código actual)
  — "* reading `authorized`/`pending` hours later. This module's deferral"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:152`
  — "El paso 2 es el gate, y es lo único que vuelve segura la secuencia: si algún plan o preapproval"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:238`
  — "propone devolverlo. La lápida del corte (`origen_de_lápida = CORTE`) no entra al desempate de"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:240`
  — "su preapproval no abren nada, sean del sistema viejo o del cobro en vuelo. Es la posición de `2d`"
- El silencio. `rg -n "HOS-937|horas después|hours later" $D/06-mp-validation-matrix.md $D/nucleo
  $V $B $D/12-contrato-de-cobertura.md $D/16-fase-7-del-paraguas.md` no encuentra la observación de
  los seis preapprovals en ningún documento del diseño.

**Qué haría falta decidir o escribir.** Si el gate del paso 2 exige una relectura diferida (horas,
no segundos) antes del paso 3, y si un cobro sobre una lápida del corte cuyo preapproval el barrido
volvió a ver vivo sigue asentándose sin marca o pasa a proponer la devolución.

## MEDIA

### F-8V2C2-005 — Las sondas del manifiesto «siguen vivas», pero el handler nuevo las cancela en su primer evento

**Qué se rompe.** El paraguas exime del 1b a las sondas que tienen una medición abierta, para que la
medición siga, y describe cómo caen sus cobros *«siguientes»* sobre la misma marca. Pero `X-1` hace
que el handler, al escribir la lápida de recepción, **mande cancelar el preapproval en el mismo
acto**. La sonda eximida muere en su primer evento después del corte y la medición que la eximió se
pierde. No mueve plata de un cliente, pero dos implementadores leerían distinto si el handler tiene
que respetar el manifiesto.

**El camino.**

1. Juan (el owner) tiene abierta la sonda 49, que mide el ciclo mensual. La enumera en el manifiesto
   y el 1b no la cancela.
2. Después del corte, la sonda cobra. El handler nuevo no la conoce y escribe una lápida de recepción
   con la marca.
3. En el mismo acto manda cancelar el preapproval. La medición que justificó la excepción termina en
   su primer cobro.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:134`
  — "Las sondas también se cancelan en el paso 1b, salvo las que tengan una medición abierta el día"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:143`
  — "siguientes se cuelgan de esa misma marca, un solo caso por sonda (`B/09` §2.4, `B/21` §2.5; owner"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:149`
  — "escribe sobre las sondas del manifiesto, que siguen vivas."
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:87`
  — "trae cobro y `TRANSICIÓN_NO_DECLARADA` si no. Y en el mismo acto el handler manda cancelar su"

**Qué haría falta decidir o escribir.** Si el handler exceptúa los ids del manifiesto de sondas de la
cancelación de `X-1`, o si se acepta que el corte termina toda medición abierta y la excepción del 1b
sólo corre la muerte de la sonda unos días.

### F-8V2C2-006 — El corte despublica por escritura directa y el caché de páginas públicas no se entera

**Qué se rompe.** La migración del paso 3 hace nacer `UNPUBLISHED_BY_BILLING` a toda ficha que
estaba a la vista, con una escritura directa y no con una transición. El código actual sirve las
páginas públicas con revalidación ISR, y la detección de páginas viejas mira una ventana de 48 h.
Ningún paso del corte purga ni revalida esas páginas, y el `V/02` §3 sólo habla del caché de
entitlements. Durante horas la ficha que el corte bajó se sigue mostrando en el buscador y en su
página, y el diseño no dice si eso es aceptable.

**El camino.**

1. La ficha de Juan estaba publicada. El paso 3 la hace nacer `UNPUBLISHED_BY_BILLING`.
2. La página pública de su alojamiento está en el caché ISR y en el borde. Nadie programa la
   revalidación, porque ninguna transición corrió.
3. Un turista la ve y le escribe a Juan por la plataforma sobre una ficha que el sistema da por
   despublicada. Juan, avisado de que su ficha «queda en pausa», no entiende qué ve el turista.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:158`
  — "de la tabla de abajo, una sola vez, con la escritura `C`. La ficha que estaba a la vista nace"
- `apps/api/src/cron/jobs/page-revalidation.job.ts:11` (código actual)
  — "* - Stale detection: re-triggers revalidation for entities not refreshed in 48 h"
- El silencio. `rg -n -i "cach|revalid|ISR" 16-fase-7-del-paraguas.md V/docs/21-migracion.md
  B/docs/21-migracion.md` no devuelve ninguna línea sobre las páginas públicas. La única coincidencia
  es la 231 del paraguas, que habla de `entity_subscriptions`.

**Qué haría falta decidir o escribir.** Si el corte tiene un paso que revalida o purga las páginas de
las fichas que nacen despublicadas, y dónde va en el orden (después del 3, antes de dar el corte por
sano).

## BAJA

### F-8V2C2-007 — El paso 2 cita `RC-2` para «leer por id es confiable», y `RC-2` es el historial de pagos

**Qué se rompe.** La justificación del gate cita la fila equivocada de la matriz. Lo de que leer por
id es confiable está en `RC-1`. `RC-2` mide el historial de pagos. Texto vencido, sin daño directo.

**El camino.**

1. Juan, el implementador de la herramienta del corte, sigue la cita a `RC-2` para ver qué garantiza
   la relectura por id.
2. Encuentra dos caminos de búsqueda de pagos y ninguna medición sobre el `GET` por id.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:126`
  — "y `RC-2` mide que leer por id es confiable"
- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:276`
  — "Dos caminos funcionan: `/authorized_payments/search?preapproval_id=` y `/v1/payments/search?external_reference=`"

**Qué haría falta decidir o escribir.** Corregir la referencia a `RC-1`.

## Ataques que intenté y el diseño resistió

- **Un cron viejo re-autoriza un preapproval ya cancelado en la ventana 1b→3** (`courtesy-expiry`
  llama a `resume`): lo para `PA-5`, que mide que reautorizar un cancelado da `400`. Eso es con la
  salvedad de F-8V2C2-004.
- **Altas por el link público del plan entre el 0b y el 1a**: el censo del 1b se toma después del 1a
  y desde el proveedor, así que las ve (el problema de avisarles es F-8V2C2-003).
- **Preferencias del viejo sin vencimiento**: el 1a vence por API las del cambio de plan y las
  relee, y la de addon tiene 30 minutos en el código (`addon.checkout.ts:701`), que coincide con la
  espera del 0b.
- **Que el sistema nuevo cree algo en el proveedor antes de que termine la rama de aborto**: las
  rutas de alta del nuevo están cerradas en el borde hasta el paso 5, y la sonda de entrega tiene su
  relectura y cancelación antes de restaurar.
- **Que salga una sola épica**: `DEC-ARCH-007` lo excluye y el §5 del paraguas lo apoya ahí.

## Fuera de mi vector

- **La sonda de entrega del paso 3 abre una marca en producción**: es un desconocido que no nombra
  fila, así que el handler le escribe una lápida de recepción con `TRANSICIÓN_NO_DECLARADA`. Es ruido
  para la bandeja de conciliación del primer día. Le toca al vector de conciliación.

## Key Learnings

1. El viejo no trata igual a todo desconocido: los eventos de estado se confirman
   (`local_row_not_found`) y los de cobro devuelven 500 y se reintentan. Cualquier razonamiento del
   corte sobre «el evento se pierde» tiene que distinguirlos.
2. Todo reintento que cruza el despliegue llega al handler nuevo en el hueco entre apuntar la URL
   (paso 3) y sembrar las lápidas (paso 4), y ahí la lápida de recepción le gana a la del corte.
3. El censo sale del proveedor, pero la población a avisar sale de la base. Esa asimetría deja sin
   aviso justo a quien el censo del proveedor existe para encontrar.
4. El código actual tiene mediciones de proveedor (seis cancelaciones que se deshicieron) que la
   matriz no recoge. Un gate de relectura única depende de una irreversibilidad medida sólo en sandbox.
