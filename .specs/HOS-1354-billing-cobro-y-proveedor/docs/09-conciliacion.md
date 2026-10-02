---
title: Master Spec 09 — Conciliación
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-27
status: CURRENT
fase: 2
capitulo: 9
---

# 09 · Conciliación

El §23 pide un proceso periódico contra el proveedor que detecte webhooks faltantes,
duplicados, pagos y suscripciones huérfanas, estados que no coinciden y preapprovals
desconocidos.

`DEC-CONC-002` ya decidió la forma. Este capítulo la ejecuta: qué corre, cuándo, qué compara y
qué hace con cada diferencia.

---

## 1. Por qué la forma canónica no aplica

Lo normal sería extraer dos inventarios en paralelo —el nuestro y el del proveedor— y
enfrentarlos. **Acá uno de los dos no se puede obtener**, y no es una opinión: está medido.

El buscador de suscripciones del proveedor **falla en tres direcciones y no avisa en ninguna**
(`RC-1`):

| lo que se le pide | lo que devuelve |
|---|---|
| filtrar por nuestra referencia | **la ignora** y devuelve todo |
| filtrar por un estado inválido | **cero resultados con `200`** — no un error |
| filtrar por un estado válido | **un subconjunto plausible**: en producción, `cancelled` trajo **15 de 69** |

**El tercero es el peor**: un barrido que liste desde el proveedor procesa parte de la cartera y
**termina en verde**. Y para cerrar el punto, el buscador devuelve **menos campos** que el `GET`
por id (`RC-4`), mientras que leer **por id sí es confiable** (~~`RC-2`~~ `RC-1`;
FASE 9 vuelta 2, `F-8V2C2-007`).

---

## 2. Las cuatro partes

### 2.1 El inventario sale de nuestra base

Se guarda el id de cada suscripción y se leen **de a una, por id**. **El buscador del proveedor
no es fuente de verdad de nada.**

**Consecuencia que conviene decir en voz alta**: guardar ese id deja de ser una comodidad y pasa
a ser **la condición de que la conciliación exista**. Una suscripción cuyo id se pierde es
invisible para el barrido, y sólo reaparece si cobra y emite un webhook.

### 2.2 Las huérfanas se detectan por webhook, no por barrido

Si sólo miramos los ids que ya tenemos, una suscripción que **nunca registramos** no aparecería
jamás. La cubre el otro lado: **toda suscripción que cobra emite un webhook**, así que uno que
llegue de un preapproval desconocido **es** la detección.

**Y lo que el proveedor NO avisa de un preapproval que ya conocemos lo ve la relectura, no un
aviso** (mediciones del 2026-09-29, punto 7): la cancelación que hace él mismo tras un cobro
rechazado no se notifica por ningún canal (`WH-5`, 3 de 3 en sandbox), mientras el aviso de ese
cobro rechazado sí llega. Si es el primer cobro, lo ve la lectura de `S16`, que relee el
preapproval antes de cancelarlo (`B/03` §3.2); si no, la comparación de estado de este barrido
(§3), a más tardar al día siguiente, como ya acota la rama de la sucesora de `S4`.

### 2.3 Un barrido diario para lo que el webhook no cubre

Sobre todo para lo que **diverge en silencio**. El caso exacto: **mutar el monto no emite
webhook** (`EX-15`), así que un cambio de precio que el proveedor aceptó y no aplicó no tiene
ninguna vía de aviso — sólo aparece releyendo.

**Y lista una cosa que no es divergencia**: las pausas ~~de menos de un ciclo~~ que cruzaron una fecha de
cobro salteada **y regalaron días netos** (la cuenta está en `NUCLEO/08` §4.1; FASE 9 vuelta 1,
`N-2`), como un tipo del resumen de `DEC-OBS-001` sin marca. Es el detector del costo que
el owner aceptó al dejar libre la vuelta anticipada (owner 2026-09-26, `G5-3`); la definición está
en `NUCLEO/08` §4.1. **Y lista una segunda: los cobros por debajo del monto esperado del período**,
con el sujeto y la diferencia, que salen de la misma comparación de cobros del §3 y tampoco abren
marca (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-f`; la definición está en `NUCLEO/08`
§4.1).

### 2.4 Sólo se repara el vínculo automáticamente

Re-vincular una huérfana reescribiendo su `external_reference` **no cambia plata ni estado**:
sólo dice de quién es. Y está medido que se puede hacer sobre una suscripción viva (`EX-19`).

**Y tiene una precondición** (owner 2026-09-25; FASE 9 completa, decisión 2b, `F-8CB3-008`):
**se re-vincula sólo si el `external_reference` del preapproval nombra una fila nuestra que no
tenga otro `provider_link` vivo**. Todo otro desconocido —uno que no nombra ninguna fila, o que
nombra una que ya tiene su vínculo vivo— **no se re-vincula: abre la marca con motivo
`TRANSICIÓN_NO_DECLARADA`** (`B/02` §2.5, motivo 6) **—o, si lo que llega es un cobro aprobado,
`PAGO_TARDÍO_RECHAZADO` (`B/05` §3), porque es plata que la fila no puede tomar—** y lo mira una
persona (FASE 9 vuelta 1, `F-8V1B3-001`). **La marca cuelga de la fila que nombra, si nombra una;
si no nombra ninguna, de una lápida de recepción** (owner 2026-09-26, `G3-2`): el handler escribe
una `subscription` con la forma de fila ~~de la lápida del corte~~ de lápida —la de R6, `B/02` §2.2~~ y `B/21`
§2.5~~— (FASE 5, simplificación del corte, S-40 y S-70: la lápida del corte salió; la forma de fila
queda para ésta) y su `provider_link`, y de ella cuelgan el `payment` y la marca, `PAGO_TARDÍO_RECHAZADO` si
trae cobro y `TRANSICIÓN_NO_DECLARADA` si no. **Y en el mismo acto el handler manda cancelar su
preapproval** (owner 2026-09-26, `X-1`; FASE 9 vuelta 1, `N-G3V-03`, `N-G1-02`): con la relectura
de la regla de `S17` —la relectura, no el *«si falla, no ocurre»*— y el correo antes, que sin
destinatario conocido no bloquea (`B/03` §3.2). La lápida nace `CANCELLED` pase lo que pase con la
llamada, y si la llamada no se aplicó **la reintenta el barrido por la salvedad 4** del §3, con la
marca `CANCELACIÓN_SIN_CONFIRMAR` a los 3 días: el `CANCELLED` que exige la forma de fila de R6 es
verdad eventual, como en las otras filas de esa salvedad, y ninguna lápida de recepción queda
terminal con el preapproval cobrando cuando una persona levanta su marca. El cobro siguiente del
mismo preapproval —si la cancelación todavía no se aplicó— ya es
conocido y se cuelga de la marca abierta (`B/03` `S14`, acumulativo), así que una sonda que cobra
todos los meses da **un solo caso**.

> **Y antes de mandar cancelar, el handler consulta el manifiesto de sondas del corte** (FASE 9
> vuelta 2, `F-8V2B3-004`, `F-8V2C2-005`): los ids que `16-fase-7…` §4.2 exceptúa del 1b porque
> tienen una medición abierta —enumerados en el manifiesto versionado de `mp-probes/`~~, que el
> despliegue lleva consigo~~—. **Esa carpeta es de la spec, está marcada no productiva (`B/06`
> §9) y sale del repositorio al cerrar HOS-1352, así que el handler de producción no puede
> depender de ella** (FASE 9 vuelta 3, `F-8V3B3-006`): ~~**de dónde lee la lista y qué hace si le
> falta es pregunta abierta** (registro de la FASE 9 vuelta 3, B), porque las dos respuestas
> tienen daños distintos; `16-fase-7…` §4.2 recomienda el código del package del cobro,
> importado como módulo, sin rama *«si le falta»*, y la decide el owner (FASE 9 vuelta 3, `F-8V3C2-008`);
> hasta que se conteste, el test de **B11** que la ejercita no cierra.~~ **la lista vive en el código
> del package del cobro, versionada con él, y el handler la importa como un módulo: si falta, el
> build no compila, así que no hay rama *«si le falta»*** (FASE 9 vuelta 3, owner 2026-09-30, lote V; `16-fase-7…` §4.2). Agregar o
> sacar una sonda es un cambio de código con su despliegue. El test de **B11** que la ejercita
> importa la lista del módulo.
> **Sobre uno de esos ids el handler escribe la lápida de recepción,
> el `payment` y la marca, y no manda cancelar**, y el barrido tampoco: sin llamada nuestra no
> entra a la salvedad 4 del §3, y la sigue la salvedad 2 mientras la marca esté abierta. La marca
> la levanta una persona sin devolver —es la tarjeta del owner, y el id está en el manifiesto—
> aunque nazca con la propuesta de devolver, que es lo que el motivo 7 propone siempre (declarado
> en *«lo que este capítulo NO cierra»*; FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-p`), y
> la sonda la cancela quien cierra la medición, releída, sacándola del manifiesto. Sin esto la
> excepción del 1b duraba hasta el primer evento de la sonda. **La sonda de la entrega del paso
> 4b no está en ese manifiesto**: su evento escribe la lápida de recepción y la marca
> `TRANSICIÓN_NO_DECLARADA`, que son la evidencia de que el handler la recibió; la cancelación del
> handler repite la de la herramienta, y la marca la levanta por `S15` quien opera el corte, en el
> mismo paso (`16-fase-7…` §4.2).

Cada preapproval del
sistema nuevo nace con ~~nuestro `external_reference` (`PA-2`)~~ **el `id` de su fila de
`subscription`** como `external_reference` (`PA-2`, `B/02` §2.2; FASE 9 vuelta 1, R12), así que una huérfana legítima siempre
nombra su fila; lo que viene del sistema viejo, o de una sonda, no la nombra y termina en una
persona. Sin la precondición, un cobro en vuelo de un preapproval viejo se imputaba al ciclo nuevo
de la misma persona —*«el candidato plausible»*— y pagaba dos veces con una sola registrada, porque
`provider_link` es único sólo por id del proveedor (`B/02` §2.2).

**Toda divergencia de monto, estado o cobro pone la marca `requiere_conciliación` y la mira una
persona.** Es el criterio del owner aplicado por tercera vez: **la línea no es «automático contra
manual», es «toca plata o no toca plata»**.

**Terminar una cancelación NUESTRA ya decidida no es reparar una divergencia** (FASE 8 completa,
`F-8CB1-013`, owner 2026-09-25; `DEC-CONC-002` punto 4, su 📌). Cuando una fila llegó a su estado
terminal por una transición nuestra que manda cancelar el preapproval y la relectura lo ve
todavía vivo, **el barrido vuelve a mandar esa cancelación** —con el correo antes y la relectura
después— y **si los 3 días de la transición que decidió la cancelación la relectura sigue sin verla `cancelled`, abre la marca** y avisa; **abierta
la marca, deja de reintentar**. **Y vale igual para la fila que la cancelación dejó VIVA en
`CANCEL_SCHEDULED`** —la de `S11` ~~y `S26`~~ (`S26` salió con la revisión del owner, 2026-09-28, C8)—, sin esperar a que `S12` la vuelva terminal (owner
2026-09-25). El caso entero, con su población, está en las salvedades 1 y 4 del §3 y en el
reintento que las sigue. **No toca plata**: cancelar no
cobra ni devuelve nada, sólo impide cobros futuros. **Un preapproval vivo sobre una fila que
NUNCA mandamos cancelar sigue siendo divergencia de estado, y la mira una persona**, como dice el
párrafo de arriba.

> **Y la marca dice CUÁL de las ~~quince~~ ~~dieciséis~~ ~~diecinueve~~ ~~veinte~~ ~~veintidós~~ ~~veintitrés~~ veinticuatro cosas pasó** (`B/02` §2.5; el 16 llegó con
> `F-8CB1-013`, y el 17, el 18 y el 19 con `F-8CB3-009`, `DEC-SUB-020` y `F-8CB3-003`, FASE 8
> completa, owner 2026-09-25; y el 20, `COBRO_DUPLICADO`, con la pendiente 6; y el 21 y el 22 con la
> FASE 9 completa, 3d y `F-8CB2-003`; y el 23, `ORDEN_PAGADA_SIN_INSTANCIA`, con `R4`, y el 24, `IMPORTE_COBRADO_DE_MÁS`, con `R20`, FASE 9 vuelta 2). El criterio de arriba manda que
> todas terminen en la misma bandeja; **lo que no se sigue de él es que lleguen ahí
> indistinguibles**. ~~Seis~~ ~~Siete~~ ~~Ocho~~ Nueve de los ~~quince~~ ~~dieciséis~~ ~~diecinueve~~ ~~veinte~~ ~~veintidós~~ ~~veintitrés~~ veinticuatro motivos significan *«hay plata del cliente que devolver»*,
> y ésos son los que la demora le cobra al cliente. **Los ~~seis~~ ~~siete~~ ~~ocho~~ nueve se leen en la última columna de esa
> tabla y ninguno pide mirar otra cosa**: `DEC-RF-004` había dejado uno que sí —la marca que abre
> `S21`, cuya propuesta dependía del disparador—, y `DEC-RF-006` lo partió en dos motivos, de los
> cuales el **15** es el que entra a esta lista. El **20** entró con la pendiente 6 (owner 2026-09-25), y el **23** con `R4` y el **24** con `R20` (owner 2026-09-27).

---

## 3. Qué compara el barrido, campo por campo

Por cada fila de nuestro inventario —suscripción principal o suscripción de complemento
(`DEC-ADDON-002`)— que no esté en un estado terminal, **más las terminales que las cuatro
salvedades de abajo devuelven al barrido**:

| se compara | contra | si difieren |
|---|---|---|
| estado | el del proveedor, leído por id | **no se escribe el del proveedor**: se evalúa la transición contra la tabla del cap. 03. Si no existe, se abre la **marca** con motivo **`TRANSICIÓN_NO_DECLARADA`** (`B/02` §2.5). **Salvo el par de una cancelación nuestra sin confirmar** —fila terminal de las salvedades 1 o 4, **o fila en `CANCEL_SCHEDULED` por `S11`** ~~**o `S26`**~~ (owner 2026-09-25; `S26` salió con la revisión del owner, 2026-09-28, C8), contra un preapproval `authorized`, `paused` o `pending` (`B/03` §10.1)—: ahí **se reintenta la cancelación** y la marca se abre recién a los 3 días de la transición que decidió la cancelación, con motivo **`CANCELACIÓN_SIN_CONFIRMAR`** (ver abajo, *«el reintento de una cancelación nuestra»*; FASE 8 completa, `F-8CB1-013`, owner 2026-09-25) |
| ~~monto vigente~~ **monto esperado, derivado**: el precio de la versión de plan —**el vigente de la versión, con los aumentos de `DEC-MP-002` ya aplicados** (orquestador, FASE 8 completa, pendiente 8)— menos las promos vivas según su contador (`B/14` §2.4) —**no es una columna**—, **redondeado una sola vez y hacia abajo, con el mismo cálculo que usa quien muta** (`B/14` §1.2; FASE 9 vuelta 2, `F-8V2B3-008`). **No se compara sobre una fila `PAUSED`** (orquestador, pendiente 8), **ni sobre una fila cuyo preapproval la relectura ve `cancelled`** —la `CANCEL_SCHEDULED` y la `SUSPENDED` de tarjeta—: su `transaction_amount` ya no se puede mutar, y un aumento la haría divergir para siempre sin acción posible; el cobro que todavía salga de ella lo mira la comparación de cobros (FASE 9 vuelta 2, `F-8V2B3-007`) | `transaction_amount`, **releído por id** | ~~se abre la **marca** con motivo **`DIVERGENCIA_DE_MONTO`**~~ **si la divergencia la abrió una mutación NUESTRA** —`S30`, un aumento de precio de `DEC-MP-002` **o `S37`, la de una migración** (revisión del owner, 2026-09-28, C15)— **se reintenta la mutación durante 3 días, contados desde esa transición**, por tiempo y no por corridas, como el reintento de una cancelación nuestra (abajo), **y después** se abre la **marca** con motivo **`DIVERGENCIA_DE_MONTO`** (FASE 8 completa, pendiente 7, owner 2026-09-25); **cualquier otra divergencia de monto abre `DIVERGENCIA_DE_MONTO` en el acto** (orquestador, pendiente 8, derivado de `DEC-CONC-002` punto 4) — es el caso que no avisa por ningún canal. ~~⚠️ Desde qué instante corren los 3 días cuando la divergencia no la abrió una transición nuestra, y qué pasa sobre una fila `PAUSED` (`EX-11`), queda abierto en `B/14` (*«lo que este capítulo NO cierra»*)~~ **Cerrado en la pendiente 8**: sin mutación nuestra no hay reintento, y **al reanudar una `PAUSED`, `S10` es la transición desde la que corren los 3 días** (`B/14` §2.4). ~~⚠️ **Lo que queda** —el instante de un aumento, que no tiene fila en `B/03` §3.2, y el monto esperado en medio de un downgrade— está en *«lo que este capítulo NO cierra»* de `B/14`~~ **Cerrado (FASE 8 completa, owner 2026-09-25)**: ~~**en un aumento de `DEC-MP-002` los 3 días corren desde su fecha efectiva**~~ (desde BZ, corte del MVP, owner 2026-10-02, el aumento a un anclado es `S37`, y los 3 días corren desde esa transición; residuo corregido el 2026-10-02), y **entre el pedido de un downgrade y el acto que lo aplica, el monto esperado es el del plan ~~vigente~~ nuevo, sin promos** (`B/14` §2.4; FASE 9 completa, contradicción 1 de `03` §R6.5: el pedido termina la promo y muta al precio de lista del plan nuevo). **Y entre `S37` y el `S38` que aplica ese cambio, el monto esperado es el precio de lista de la versión destino para su ciclo, sin promos**: la ventana gemela, en una migración (`B/14` §2.4; verificación corta, 2026-09-29, lote M-C) |
| fecha del próximo cobro | `next_payment_date` | se registra; **no es por sí sola una divergencia**, porque el proveedor la mueve solo en casos medidos (`PS-6`) |
| cobros del período | los `authorized_payments` del preapproval | ver §4. **Y si la lectura del §4 ve un registro con `payment.status` = `approved` que nosotros no tenemos acreditado** —sin fila de `payment`, o con la fila en `PENDING`—, **el barrido no lo escribe**: ~~se abre la **marca** con motivo **`COBRO_SIN_REGISTRAR`**~~ **sobre una fila que puede recibir el cobro** (`B/05` §3) se abre la **marca** con motivo **`COBRO_SIN_REGISTRAR`** (`B/02` §2.5) y lo asienta una persona (`DEC-CONC-002` punto 4; FASE 8 completa, `F-8CB3-003`), **con la regla con la que esa fila recibe el cobro** —`S2`, `P1`, `C2` primera fila con `max`, o la retención de `S19`, según la lista del `B/05` §3; no `P1` a secas— (FASE 9 vuelta 1, `N-G3V-02`); **lo mismo sobre una `GRACE_PERIOD` o `SUSPENDED` cuyas cuatro condiciones del `B/05` §3 se cumplen, donde la tabla no asigna motivo porque nada falla: el asiento corre `S5` o `S7`, lo que el evento habría corrido** (FASE 9 vuelta 1, `N-G3V-01`); **sobre cualquier otra, el motivo que asigna la tabla de desempate del `B/05` §3**, con el cobro colgado (FASE 9 vuelta 1, R4, `F-8V1B2-003`). **Y cada registro aprobado que sí tenemos acreditado se compara por IMPORTE** (owner 2026-09-27, FASE 9 vuelta 2, `R20`, `F-8V2B3-001`): el importe que el proveedor cobró, contra **el monto esperado del período que ese cobro cubre** —el de la fila de arriba, derivado con el precio **de la versión que rige el período que cubre ese cobro (la destino, si una migración encoló su cambio para ese período; verificación corta, 2026-09-29, lote M-C)** y los aumentos vigentes a la fecha del cobro y con las promos vivas según su contador **antes** de ese cobro, con el mismo redondeo—. **Si cobró de más, se abre la marca con motivo `IMPORTE_COBRADO_DE_MÁS`** (`B/02` §2.5, motivo 24), con el cobro colgado, que propone devolver la diferencia; **no se abre sobre un pago que ya cuelga de otra marca abierta**, **ni sobre un pago que ya tuvo un 24 levantado, y el exceso se cuenta neto de las devoluciones ejecutadas de ese pago** (FASE 9 vuelta 2, verificación, `N-C-02`, arreglo de texto: la comparación se repite cada día y el importe cobrado no cambia al resolver la marca, así que sin esto el 24 volvía a abrirse con la propuesta de devolver otra vez). **Y si cobró de menos, no se abre marca: el cobro va como una línea del resumen de `DEC-OBS-001`, con el sujeto y la diferencia** (`NUCLEO/08` §4.1; FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-f`), sin mover el conteo de motivos: es plata de Hospeda, el costo se mide y no se cobra. La fila del monto no lo ve: compara el `transaction_amount` del preapproval, que puede estar ya corregido cuando el registro del ciclo, creado antes de la mutación, cobró el viejo —si lo hace no está medido: ~~es la fila propuesta al owner en el registro de la FASE 9 vuelta 2~~ es `EX-47`, que el owner aceptó (`Q-UNKNOWN`), y se mide en sandbox antes de `B11`, fuera del paso 0 (FASE 5, simplificación del corte, S-61)—; si la mutación bajó el monto, ese cobro es de más y lo ve el motivo 24, y si lo subió, es de menos y lo ve esta línea del resumen. **Y la promo se decrementa sólo sobre un cobro que salió con el descuento** (`P1`, `B/14` §2.4), así que el cobro de más no le gasta un ciclo. ~~**Sobre una lápida del corte no se comparan los cobros del día del corte ni los anteriores** (`B/21` §2.5): los registros de su preapproval —los del sistema viejo, que no se conserva (`B/21` §4), y el que estaba en vuelo cuando el paso 1b lo canceló— no abren nada; el evento de ese cobro lo asienta sobre la lápida sin marca (`B/05` §3), y lo que eso deja está en el «NO cierra» de `B/21` (owner 2026-09-26, `G3-1`, contra la recomendación). **Esta misma lectura la hace el detector del día siguiente al corte, que lista, por cada lápida del corte, los registros aprobados con un pago del día del corte que no tienen `payment`, sin abrir marca ni asentar** (`B/21`, «NO cierra»; verificación corta, 2026-09-29, lote P-B): el barrido no los compara, pero dejan de ser invisibles. **Un registro aprobado cuyo pago aprobado es posterior al día del corte** (la fecha del pago que aprobó el registro, leído por id, y no el `date_created` del registro, que no se mueve con un reintento: `B/21` §2.5; FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-a`) **sí se compara, y abre `PAGO_TARDÍO_RECHAZADO` con el cobro colgado**, lo mismo que abre su evento (owner 2026-09-27, FASE 9 vuelta 2, `R2`: *«no devolver»* vale sólo para la ventana del corte). La salvedad 4 la sigue releyendo por estado.~~ **Sale la lápida del corte, su ventana y el detector del día siguiente** (FASE 5, simplificación del corte, S-40, S-41 y S-42): un cobro tardío de un débito viejo llega como cualquier desconocido, y lo recoge la lápida de recepción con `PAGO_TARDÍO_RECHAZADO` y la propuesta de devolver (§2.4), que decide el owner. Antes no había motivo para *«cobro que no tenemos»* y el caso no tenía ningún camino a la base. **Salvo cuando esa lectura es la de *«cobró»* de `S6` sobre una fila en `GRACE_PERIOD` y corre `S5`**: `S5` asienta el cobro en el mismo acto, y si no puede, no ocurre en esa corrida (`B/03` §3.2; FASE 8 completa, pendiente 6, owner 2026-09-25). **Y si la lectura del §4 da *«intentó y se rechazó»* sobre el período en curso de una fila `ACTIVE` con al menos un pago acreditado, corre `S4`** (owner 2026-09-25; FASE 9 completa, 9a, opción 1 de `01` R1-a): es el aviso del primer rechazo que no llegó (`WH-5`), leído por id como pide `B/12` §1.2, y el reloj del grace cuenta desde esa lectura (9b). Es la lectura que el barrido ya hace, y cumple `D17`; sin esta rama la fila quedaba `ACTIVE` un ciclo entero, sin grace ni avisos, hasta que la pausa del proveedor corría `S6` |
| ~~la `version` del recurso~~ **el `last_modified` del recurso** | ~~la última que aplicamos~~ **el de la última relectura, guardado en `provider_link`** (`B/02` §2.2) | si el del proveedor es posterior, **el recurso cambió sin avisarnos**: se relee entero. **Era la `version` y no puede serlo**: la lectura por id **no trae `version`** —viene en el cuerpo del webhook (`EX-2`)— y lo que trae es `last_modified` (`RC-9`, `NOT_SUPPORTED`, producción 2026-09-25; FASE 8 completa, `F-8CB3-010`). ⚠️ **Que `last_modified` se mueva con una mutación de monto no está medido**: el caso de `EX-15` lo sigue viendo la fila del monto |

**Y la sucesora en grace que nunca cobró se relee cada corrida, con una consecuencia propia**
(owner 2026-09-25; FASE 9 completa, decisión 3c). Desde 3c, la sucesora cuya predecesora venía
pagando entra al grace por `S4` si su primer cobro se rechaza, en vez de morir por `S16` (`B/03`
§3.2). Es un grace sobre una autorización que el proveedor pudo haber cancelado al rechazar
(`PA-6`, `UNKNOWN`), así que la fila de estado de arriba **no espera a que haya divergencia**:
**si la relectura por id (`D17`) da `cancelled` o `paused`, corre `S6` en esa misma corrida** —por
su quinto evento sobre `cancelled`, o por el segundo sobre `paused`—, con la cancelación de nuestro
lado de lo que quede vivo y el aviso de suspensión con *«volvé a suscribirte»* (`B/19` §4 fila 10).
Es la forma de `DEC-MP-008`, y acota el riesgo de `PA-6` a un día. Sobre `cancelled` no es el
espejo de la baja del proveedor (`B/03` §10.1), por la salvedad que ese par escribe.

**Los estados terminales de una SUSCRIPCIÓN —`CANCELLED`, `ABANDONED` y `CHARGE_DECLINED`— no se
barren cuando ya no pueden divergir hacia nada que nos importe**, y barrerlos ahí es gastar
llamadas sobre la parte de la cartera que más crece. **La condición no es el estado**: es la de
abajo, y las cuatro salvedades son las poblaciones que no la cumplen.

**Y la exención vale por la razón que hace terminal a cada uno, no por la palabra «terminal».** La
razón, escrita como criterio y no como lista, es una sola:

> **Una fila terminal está exenta cuando su autorización quedó imposibilitada de cobrar por algo
> que NO depende de que una llamada nuestra haya salido bien.** Son dos casos y nada más: **lo
> canceló el proveedor**, o **nuestra llamada ya fue confirmada por una relectura**. **Y en los
> dos, recién cuando cerró el registro de cobro del último ciclo de su preapproval** —pasó a
> `processed` o venció su `expire_date` (`RC-6`, `RC-7`)— (owner 2026-09-27, FASE 9 vuelta 2,
> `R2`; `F-8V2B3-006`). **Un registro sin `expire_date` cierra sólo con `processed`**: es el del
> alta, que `RC-7` mide sin ese campo, y es justo la población en que se midió `recycling`
> (FASE 9 vuelta 3, `F-8V3B3-004`). **Y si lo canceló el proveedor después de un cobro
> rechazado, recién cuando pasó la ventana de relectura de la cancelación por rechazo**
> (`NUCLEO/02` §1.5) **con el preapproval releído todavía `cancelled`**: el proveedor deshace esa
> cancelación (`EX-45`; seis casos en el código actual, horas después) (FASE 9 vuelta 3, owner
> 2026-09-30, lote K, `F-8V3B3-002`).

**Por qué el registro y no sólo la cancelación.** Que un preapproval cancelado no cobre es diseño y
no medición (`GR-2` sigue `UNKNOWN`): el estado `recycling` se midió justamente sobre preapprovals
que el proveedor ya había cancelado (`RC-6`), y cambiar el medio de pago dispara un reintento que
cobra (`GR-1`). Mientras ese registro esté abierto, la fila sigue en el barrido y la comparación de
cobros del período la lee como a cualquier otra; si cobra, abre el motivo que le asigna la tabla de
desempate del `B/05` §3 —sobre una terminal, `COBRO_POSTERIOR_A_LA_BAJA`—. No suma una salvedad: es
parte de *«imposibilitada de cobrar»*, y no mueve las cifras de la tabla de abajo ni de las
salvedades. Si la medición ~~del paso 0 del corte (`16-fase-7…` §4.2)~~ de `EX-44`, en sandbox antes de
`B11` y fuera del paso 0 (FASE 5, simplificación del corte, S-60), muestra que cancelar corta el
reciclado, la condición queda como defensa sin población; si muestra que no, es la que lo ve.

**Por qué la ventana de relectura, y qué pasa si el preapproval vuelve** (FASE 9 vuelta 3, owner
2026-09-30, lote K, `F-8V3B3-002`). Un `cancelled` que el proveedor escribió ante un rechazo de
tarjeta no es definitivo: el código actual registra seis que se leyeron `cancelled` en el `PUT` y
en un `GET` inmediato y horas después decían `authorized` o `pending` (`EX-45`). Es la población
que esta exención soltaba en la primera relectura (la de `S16` sin llamada, y la del espejo), y
una vez fuera del barrido sólo el aviso del cobro la devolvía, que puede no llegar (`WH-5`). **Se
cuenta desde la primera relectura que lo vio `cancelled`**, y su valor es el del plazo 16 de la
lista cerrada (`NUCLEO/02` §1.5), 7 días al inicio (FASE 9 vuelta 3, owner 2026-09-30, lote R). **Si
durante la ventana la relectura lo ve ~~`authorized` o `pending`~~ `authorized`, `pending` o `paused`**
(FASE 9 vuelta 3, verificación, VC3-cobro-01), ~~la fila está en el barrido y la
lee la fila de estado del §3: un preapproval vivo sobre una fila que nunca mandamos cancelar es
divergencia de estado y la mira una persona (§2.4), y si cobra, la comparación de cobros lo
cuelga con el motivo de la tabla de desempate del `B/05` §3. **Si en cambio el barrido debe mandar
la cancelación que `S16` habría mandado es pregunta abierta** (registro de la FASE 9 vuelta 3, B).~~
**el barrido manda la cancelación que `S16` habría mandado** (FASE 9 vuelta 3, owner 2026-09-30, lote U): la misma llamada, con
el correo antes y la relectura después (la regla de `S17`, `B/03` §3.2), sobre la fila de `S16` y
sobre la del espejo, que la ventana sigue por igual. Desde esa relectura la fila entra a la
salvedad 4 como una cancelación nuestra sin confirmar: **el barrido la reintenta durante 3 días,
contados desde la relectura que la vio viva, y si no la ve `cancelled` abre la marca
`CANCELACIÓN_SIN_CONFIRMAR`** (`B/02` §2.5, motivo 16). **Los cobros que entraron mientras tanto
quedan propuestos para devolver**: la fila es terminal, así que la comparación de cobros los cuelga
con el motivo que la tabla de desempate del `B/05` §3 le da a una terminal,
`COBRO_POSTERIOR_A_LA_BAJA` (motivo 2), que ya propone devolver; no hace falta un motivo nuevo. Si
la persona reautorizó a propósito, se le corta algo que igual no le daba servicio: la fila está
terminal y no vuelve por esto. La relectura que la vio viva vacía `cancelado_visto_en` (abajo), así
que la exención y la ventana vuelven a contar desde la próxima relectura que la vea `cancelled`.
La tabla que lo ejecuta es la de pares del `B/03` §10.1, con un par propio para esta población, y
el correo de antes tiene por ocurrencia la relectura que la vio viva, porque no hay transición que
decida esta cancelación (`B/03` §3.2, precisión 3; FASE 9 vuelta 3, verificación, VC3-cobro-01).

~~⚠️ **Qué dato guarda que una relectura vio `cancelled` no está escrito** (FASE 9 vuelta 3,
lote D). Lo leen tres cosas: la exención de arriba (*«nuestra llamada ya fue confirmada por una
relectura»*), el reloj del plazo 16 (*«desde la primera relectura que lo vio `cancelled`»*) y
`puedeCobrarle`, que `12-contrato…` §4.1 manda escribir acá. `provider_link` (`B/02` §2.2)
guarda sólo el `last_modified` de la última relectura, y el registro de corridas del §7.1 no
tiene entidad. Dónde vive es pregunta abierta del owner; hasta que conteste, `B4` y `B11` no
tienen de dónde leerlo.~~
**Que una relectura vio `cancelled` lo guarda `provider_link.cancelado_visto_en`** (FASE 9 vuelta 3, owner 2026-09-30, lote Z):
el instante de la primera relectura por id que vio el preapproval `cancelled` (`B/02` §2.2). Lo
escribe esa relectura, sea del barrido, del handler o de la de una transición, y no lo reescriben
las siguientes que lo sigan viendo `cancelled`. **Lo leen tres cosas**: la exención de arriba
(*«nuestra llamada ya fue confirmada por una relectura»* es una fila con la columna escrita), el
reloj del plazo 16 (*«desde la primera relectura que lo vio `cancelled`»* es la columna) y
`puedeCobrarle` (`12-contrato…` §4.1), que deja de contar una suscripción cuando la columna está
escrita, **salvo la que canceló el proveedor tras un cobro rechazado, que deja de contar recién
cuando pasa el plazo 16 desde la columna con el preapproval todavía `cancelled`**, lo mismo que
esta exención (FASE 9 vuelta 3, owner 2026-09-30, lote AE; verificación, VC3-cobro-02). **Una
relectura posterior que lo ve `authorized`, `pending` o `paused` la vacía**: el
proveedor deshizo la cancelación (`EX-45`), y ninguna de las tres puede seguir leyéndola como
confirmada. *(Que la vacía lo derivé y lo marco: sin eso, un preapproval revivido seguía contando
como cancelado para la baja de cuenta.)* La construye `B4`, con la relectura que la escribe en
`B11`.

**Escrita como enumeración de transiciones, la garantía era falsa, y hay que decir dónde.** La
versión anterior nombraba tres —`S3`, `S12`/`S17` y `CHARGE_DECLINED`— sobre un conjunto de
~~**quince**~~ ~~**dieciséis**~~ ~~**diecisiete**~~ ~~**dieciocho**~~ ~~**quince**~~ **catorce** puertas a un estado terminal (sale la lápida del corte: FASE 5, simplificación del corte, S-40; la decimosexta, `S31`, FASE 8 completa, owner 2026-09-25; **la decimoséptima, `S36`**, FASE 9 vuelta 1; **la decimoctava, la lápida de recepción**, owner 2026-09-26, `X-1`; y salen `S25`, `S27` y `S28` con la revisión del owner, 2026-09-28, C8, recontadas sobre la tabla), y de las tres que nombraba una era al revés —**y desde la FASE 8 completa otra más, `CHARGE_DECLINED`**, porque `S16` cancela de nuestro lado (owner 2026-09-25): las exentas quedan en **dos**, el espejo y `S17`, recontadas sobre la tabla—:

| puerta a un estado terminal | ¿quién dejó el preapproval sin poder cobrar? | ¿exenta? |
|---|---|---|
| `S16` → `CHARGE_DECLINED` | ~~**el proveedor**, en el mismo milisegundo del rechazo (`B/12` §4.4, medido el 2026-09-17)~~ **nuestra llamada**, con la relectura de `S17`: `S16` cancela el preapproval de nuestro lado y la fila llega a `CHARGE_DECLINED` pase lo que pase con la llamada (`B/03` §3.2; FASE 8 completa, owner 2026-09-25). Que el proveedor cancele solo está medido únicamente ante el antifraude (`B/12` §4.4); con otro motivo no se sabe (`PA-6`, `UNKNOWN`), y el diseño dejó de depender de eso | ~~**sí**~~ **no** — **salvo cuando la relectura ya lo ve `cancelled`**, que es lo medido ante el antifraude: ahí no se manda ninguna llamada y la salvedad 4 ~~lo suelta en la primera relectura, por su condición de corte~~ lo sigue releyendo hasta que pase la ventana de relectura de la cancelación por rechazo con el preapproval todavía `cancelled` (FASE 9 vuelta 3, owner 2026-09-30, lote K) |
| el **espejo** del §10.1 → `CANCELLED` | **el proveedor**, por su cuenta: el espejo copia ese hecho | **sí** — **cerrado el registro de cobro del ciclo** (criterio de arriba; FASE 9 vuelta 2, `F-8V2B3-006`) **y, si la cancelación siguió a un cobro rechazado, pasada la ventana de relectura de la cancelación por rechazo** (FASE 9 vuelta 3, lote K) |
| `S17` → `CANCELLED` | nuestra llamada, **pero con relectura**: si falla, `S17` **no ocurre** y la fila no llega a terminal (`B/03` §3.2) | **sí**, por construcción — **cerrado el registro de cobro del ciclo** (ídem) |
| `S12` → `CANCELLED` | nuestra llamada: la de `S11`, *«de inmediato»* (`DEC-SUB-009`), emitida un tiempo antes y **no confirmada al llegar acá** | **no** |
| `S3` → `ABANDONED` | **nuestra llamada**: el job que recorre las vencidas *«cancela el preapproval en el proveedor»* (`B/03` §3.4 punto 2), y `B/06` §6 lo subraya con `EX-1` ~~todavía `UNKNOWN`~~ (`PARTIALLY_SUPPORTED` desde el 2026-09-23: un `pending` no vence solo; FASE 9 vuelta 1, `F-8V1D1-005`) — *«es lo único que impide una autorización viva que puede cobrar»* | **no** — **con la misma salvedad de `S23` y `S24`: sobre un pagador manual sí está exenta**, porque ahí no hubo llamada que confirmar (`B/06` §7) y la fila es **la de un alta que nunca pagó su primera cuota** (`B/03` §7.2). No mueve el conteo de la salvedad 4: `S3` sigue siendo una de sus ~~**once**~~ ~~**doce**~~ ~~**trece**~~ ~~**catorce**~~ ~~**quince**~~ **doce** filas, igual que `S23` y `S24` (~~**catorce**~~ con `S36`, FASE 9 vuelta 1, §4 punto 4 de `25-verificado-G5`; **quince** con la lápida de recepción, owner 2026-09-26, `X-1`; **doce** sin `S25`, `S27` ni `S28`, revisión del owner, 2026-09-28, C8) |
| `S13` → `CANCELLED` | **nuestra llamada**, y `S13` no tiene rama de fallo declarada: su destino es `CANCELLED` pase lo que pase con la llamada | **no** |
| `S20` → `CANCELLED` — la **suscripción de complemento** que el grant convierte a costo $0 (`B/03` §3.2, `B/16` §3.4) | **nuestra llamada**, y como `S13` no tiene rama de fallo declarada: el addon pasa a $0 pase lo que pase con la llamada, porque el §35.2 lo declara gratis desde el acto | **no** |
| `S21` → `CANCELLED` — la **suscripción de complemento** cuya instancia se apagó por `A5` o por `A6` (`B/03` §3.2 y §8, `B/16` §4.4) | **nuestra llamada**, la que `A5`/`A6` mandan sobre **este mismo** preapproval —hay uno solo—, y `S21` no tiene rama de fallo: la fila llega a `CANCELLED` pase lo que pase con la llamada, porque la instancia ya está apagada | **no** |
| `S22` → `CANCELLED` — la **baja pedida estando pausado** (`B/03` §3.2) | **nuestra llamada**, *«de inmediato»* como la de `S11`, y sin rama de fallo: la persona pidió irse y la fila llega a `CANCELLED` pase lo que pase con la llamada | **no** |
| `S23` → `CANCELLED` — la **baja pedida estando suspendido** (`B/03` §3.2) | **nuestra llamada** si el preapproval seguía vivo, con la misma forma que `S22` | **no** — **salvo sobre un pagador manual, que sí está exenta**: ahí no hubo llamada porque no hay débito que detener (`B/06` §7), así que no queda ninguna autorización que pueda cobrar ni ninguna relectura que confirmar |
| `S24` → `CANCELLED` — la **baja pedida en medio del grace** (`B/03` §3.2, `DEC-SUB-014`) | **nuestra llamada**, con la misma forma que `S22`: *«de inmediato»* y sin rama de fallo | **no** — **y con la misma salvedad de `S23`**: sobre un pagador manual no hubo llamada, así que esa mitad está exenta |
| ~~`S25` → `CANCELLED` — el fin de una pausa sobre un plan que ya no se presta~~ | — | **sale** (revisión del owner, 2026-09-28, C8): las verticales no se discontinúan |
| ~~`S27` → `CANCELLED` — la suspendida alcanzada por la discontinuación~~ | — | **sale** (revisión del owner, 2026-09-28, C8): las verticales no se discontinúan |
| ~~`S28` → `ABANDONED` — la que esperaba autorización cuando se discontinuó su vertical~~ | — | **sale** (revisión del owner, 2026-09-28, C8): las verticales no se discontinúan |
| **`S31`** → `ABANDONED` o `CANCELLED` — la **sucesora que se corta porque un contracargo cortó a su predecesora** (`B/03` §3.2; FASE 8 completa, owner 2026-09-25) | **nuestra llamada**, con la forma de `S3`: se cancela con relectura y la fila llega a su destino —`ABANDONED` desde `PENDING_AUTHORIZATION`, `CANCELLED` desde `ACTIVE`— pase lo que pase con la llamada | **no** — **y con la misma salvedad de `S3` y `S23`**: sobre un pagador manual no hubo llamada, así que esa mitad está exenta |
| **`S36`** → `CANCELLED` — la **revocación del derecho de arrepentimiento** que registra una persona (`B/03` §3.2, `DEC-RF-001`; owner 2026-09-26, `G5-4`) | **nuestra llamada**, con la misma forma que `S24`: cancela con la regla de relectura, el correo antes, y corta el servicio en el acto; desde `CANCEL_SCHEDULED` la relectura ya lo ve `cancelled` por `S11`. **Y sin rama de fallo, como `S24`**: la fila llega a `CANCELLED` pase lo que pase con la llamada, y si la llamada no se aplicó la reintenta el barrido por la salvedad 4; de la regla de `S17` toma la relectura, no el *«si falla, no ocurre»*, porque su evento es un acto humano que nadie reevalúa (FASE 9 vuelta 1, `N-4` de `25-verificado-G5`) | **no** — **y con la misma salvedad de `S23`**: sobre un pagador manual no hubo llamada, así que esa mitad está exenta (FASE 9 vuelta 1, residuo 2 de `17-`: la fila faltaba desde que entró `S36`) |
| ~~la **lápida** del corte → `CANCELLED`~~ | — | **sale** (FASE 5, owner 2026-09-30, simplificación del corte, S-40): sin lápida del corte, un cobro tardío de un débito viejo entra como desconocido y lo toma la lápida de recepción de la fila de abajo |
| **la lápida de recepción** → `CANCELLED` — la que el handler escribe para un preapproval desconocido que no nombra ninguna fila (§2.4; owner 2026-09-26, `G3-2`) | **nuestra llamada**: el handler la cancela en el mismo acto de escribirla, con la relectura de la regla de `S17` y el correo antes (sin destinatario conocido no bloquea, `B/03` §3.2), y **sin rama de fallo**: la fila nace `CANCELLED` —lo exige la forma de fila de R6— pase lo que pase con la llamada (owner 2026-09-26, `X-1`; FASE 9 vuelta 1, `N-G3V-03`, `N-G1-02`) | **no** — si la llamada no se aplicó, la reintenta el barrido por la salvedad 4 y marca a los 3 días. Antes de `X-1` ninguna fila la cancelaba y esta tabla no la nombraba: levantada su marca, quedaba terminal, fuera del barrido y con el preapproval cobrando |

**Las cuatro salvedades que devuelven una terminal al barrido, y por qué cada una.** La exención
vale por el criterio de arriba, así que se cae exactamente donde ese criterio no alcanza:

| # | qué vuelve al barrido | hasta cuándo | por qué la exención no la cubre |
|---|---|---|---|
| 1 | **la suscripción de complemento de una instancia de addon en estado terminal** — seleccionada **por el estado terminal de la instancia** y, desde `S21`, también **por el suyo propio** cuando llegó a `CANCELLED` junto con ella (`B/16` §4.4) | hasta que la relectura la vea `cancelled` | su preapproval lo cancelamos **nosotros**, con una llamada que puede fallar — ver abajo. **Y mientras la relectura lo vea vivo, el barrido vuelve a mandar la cancelación que ~~`A5`/`A6`~~ `A3`/`A5`/`A6` mandaron** (**`A3`** desde la FASE 9 completa, C-R5-2), con el correo antes y la relectura después; **marca recién a los 3 días de la transición que decidió la cancelación** (ver abajo, *«el reintento de una cancelación nuestra»*; FASE 8 completa, `F-8CB1-013`, owner 2026-09-25) |
| 2 | **una suscripción terminal con al menos una marca `requiere_conciliación` abierta** | hasta que una persona **las levante todas** (`S15`, que levanta **una por vez**) | la exención es sobre *«no puede divergir hacia nada que nos importe»*, y una fila marcada **ya divergió**: lo que el barrido le aporta no es la comparación con el proveedor sino **el reloj de la marca**, que es lo único que hace que el caso no quede abierto para siempre. **Y el reloj existe desde la FASE 9-bis-4**: es `puesta_en`, por marca (`B/02` §2.2 y §2.5). Mientras la marca era un booleano no había *«desde cuándo»*, así que esta salvedad declaraba como su razón de existir un dato que la base no tenía y el escalamiento de más abajo **no se podía evaluar** |
| 3 | **una suscripción terminal con un pago acreditado pendiente de resolución** por `S19` — un `payment` **o un `manual_payment`**, porque `S19` retiene el pago del período impago entre por la puerta que entre (`B/03` §3.2) | hasta que la bandera se apague | es plata del cliente en nuestra cuenta. Las ramas **1, 5 y 6** de `B/12` §5.3 dejan la predecesora en `CANCELLED` **con una marca `REEMBOLSO_POR_CONFIRMAR`** (`B/02` §2.5), así que sin esta salvedad los desenlaces que mueven dinero son los únicos que ningún proceso vuelve a mirar |
| 4 | **una suscripción terminal cuyo preapproval lo canceló una llamada NUESTRA todavía sin confirmar** — ~~**once** de las **doce**~~ ~~**doce** de las **trece**~~ ~~**trece** de las **catorce**~~ ~~**catorce** de las **quince**~~ ~~**quince** de las **dieciséis**~~ ~~**doce** de las **trece**~~ **once** de las **doce** filas *«no»* de la tabla de arriba (revisión del owner, 2026-09-28, C8: salen `S25`, `S27` y `S28`; FASE 5, simplificación del corte, S-40: sale la lápida del corte): `S12`, `S3`, `S13`, **`S16`**, **`S20`**, **`S22`**, **`S23`**, **`S24`**, ~~**`S25`**, **`S27`**, **`S28`**,~~ **`S31`**, **`S36`** y ~~la lápida~~ ~~**las dos lápidas, la del corte y la de recepción**~~ **la lápida de recepción** (**la de recepción** desde el owner 2026-09-26, `X-1`; **`S36`** desde la FASE 9 vuelta 1, residuo 2 de `17-`; `S31` desde la FASE 8 completa, owner 2026-09-25; **`S16`** desde la FASE 8 completa, owner 2026-09-25, residuo A de `R12`: pasó de *«sí»* a *«no»* al cancelar de nuestro lado). **La ~~duodécima~~ ~~decimotercera~~ ~~decimocuarta~~ ~~decimoquinta~~ ~~decimosexta~~ ~~decimotercera~~ duodécima, `S21`, entra por la 1 y no por acá** (ver abajo). **`S20` es de complemento y las otras ~~diez~~ ~~once~~ ~~doce~~ ~~trece~~ ~~catorce~~ ~~once~~ diez son principales** (~~las dos lápidas~~ la lápida de recepción, con su clase propia, cuenta de este lado) ~~—`S27` y `S28` alcanzan a las dos clases (`B/10` §4.3), así que aportan filas a los dos lados—~~, y eso no cambia nada acá: lo que la salvedad mira es **quién canceló**, no de qué clase es la fila. **Y ~~`S23`, `S24` y `S31`~~ ~~`S3`, `S23`, `S24`, `S27`, `S28` y `S31`~~ ~~`S3`, `S23`, `S24`, `S27`, `S28`, `S31` y `S36`~~ `S3`, `S23`, `S24`, `S31` y `S36` entran sólo cuando hubo llamada** (FASE 9 completa, C-R5-4: la tabla de arriba da la misma salvedad a las ~~seis~~ ~~siete~~ cinco; `S36`, FASE 9 vuelta 1; sin `S27` ni `S28` desde la revisión del owner, 2026-09-28, C8): sobre un pagador manual no la hubo, así que esa mitad ya está exenta en la tabla de arriba y no vuelve al barrido a esperar una relectura que no existe | hasta que la relectura lo vea `cancelled` —**y después, hasta que cierre el registro de cobro del ciclo, por el criterio de la exención** (FASE 9 vuelta 2, `F-8V2B3-006`)—; **sobre la de `S16` que el proveedor ya había cancelado, hasta que pase la ventana de relectura de la cancelación por rechazo** (FASE 9 vuelta 3, lote K). **Sobre ~~una lápida —cualquiera de las dos—~~ la lápida de recepción la relectura mira ~~sólo el estado~~ el estado y los cobros, no el monto** (~~de la del corte, sólo los cobros posteriores al día del corte; FASE 9 vuelta 2, `R2`~~ la ventana del corte salió: FASE 5, simplificación del corte, S-41): no tiene versión contra la cual comparar un monto (`B/02` §2.2; FASE 9 vuelta 1, R6) | es la salvedad 1 aplicada a la suscripción, y por la misma razón exacta: ~~cancelar **no emite webhook** (`EX-15`), así que si la llamada no se aplicó~~ el aviso de cancelación existe **sólo si la cancelación se aplicó** (`EX-15` mide que cancelar sí notifica), así que si la llamada no se aplicó (FASE 9 vuelta 1, `F-8V1B3-007`) **no hay ninguna otra vía de aviso** y el primer aviso es el cobro. El costo está acotado por su condición de corte —deja de barrerse apenas la relectura confirma—, así que no es la cartera terminal entera sino la cola de las que todavía no confirmaron. **Y mientras la relectura lo vea vivo, el barrido vuelve a mandar la cancelación**, con el correo antes y la relectura después; **marca recién a los 3 días de la transición que decidió la cancelación** (ver abajo, *«el reintento de una cancelación nuestra»*; FASE 8 completa, `F-8CB1-013`, owner 2026-09-25) |

**El reintento de una cancelación nuestra: lo que el barrido hace con las salvedades 1 y 4** (FASE
8 completa, `F-8CB1-013`, owner 2026-09-25; `DEC-CONC-002` punto 4, su 📌). Las dos salvedades
devuelven al barrido filas cuyo estado terminal lo decidió **una transición nuestra que manda
cancelar el preapproval**: las ~~**once**~~ ~~**doce**~~ ~~**trece**~~ ~~**catorce**~~ ~~**quince**~~ ~~**doce**~~ **once** de la 4 —`S12`, `S3`, `S13`, **`S16`**, `S20`, `S22`, `S23`, `S24`,
~~`S25`, `S27`, `S28`,~~ **`S31`**, **`S36`** (FASE 9 vuelta 1) y ~~la lápida~~ ~~**las dos lápidas**~~ **la lápida de recepción** (owner 2026-09-26, `X-1`; la del corte salió: FASE 5, simplificación del corte, S-40)— y, por la 1, la cancelación que ~~`A5` o `A6`~~ `A3`, `A5` o `A6` mandan sobre el
preapproval de la suscripción de complemento (`S21`; **`A3`** desde la FASE 9 completa, C-R5-2: su
efecto es el de `S3`, `B/03` §8). Todas llegan a terminal *«pase lo que pase
con la llamada»*, así que un timeout o un correo que no salió (`DEC-MAIL-001`) dejaba la fila
terminal con el preapproval vivo. **Cuando la relectura lo ve vivo —`authorized`, `paused` o
`pending`—**:

1. **El barrido NO abre la marca: vuelve a mandar la cancelación.** Es el mismo acto que la
   transición ya decidió, no uno nuevo, y va con la misma forma: **el correo antes**
   (`DEC-MAIL-001`, *«el correo antes de cancelar»* de `B/03` §3.2, con sus ~~dos~~ tres ramas —la tercera, el correo que agota sus reintentos, no bloquea: owner 2026-09-25, FASE 9 completa, decisión 1—) **y la
   relectura después**. **El correo sale UNA vez por cancelación, antes del primer intento**: un
   reintento no lo repite si ya se entregó, porque su ocurrencia es la transición que decidió la
   cancelación y no la corrida (`B/03` §3.2, precisión 3; owner 2026-09-25). **Sobre la terminal
   que el proveedor canceló tras un rechazo y revivió dentro de la ventana, la ocurrencia y el
   reloj de los 3 días son la relectura que la vio viva** (arriba, *«qué pasa si el preapproval
   vuelve»*; FASE 9 vuelta 3, verificación, VC3-cobro-01).
2. **Si los 3 días de la transición que decidió la cancelación la relectura todavía no la ve `cancelled`**, recién entonces **abre la marca con motivo
   `CANCELACIÓN_SIN_CONFIRMAR`** (`B/02` §2.5, motivo 16) **y avisa** por el canal de
   `DEC-OBS-001`. **El plazo se cuenta por tiempo, no por corridas** (owner 2026-09-25): el instante
   de la transición ya está registrado —toda transición es auditable, con su *«cuándo»*
   (`NUCLEO/08` §1.1 criterio 2 y §1.2)—, así que no hace falta ninguna columna, y si un día el
   barrido no corre el plazo sigue corriendo igual. Mientras tanto, cada corrida en que la
   relectura no ve `cancelled` —la llamada no salió, el correo transitorio la bloqueó, o salió y el
   preapproval sigue vivo— reintenta. **Abierta la marca, el barrido deja de reintentar**: el caso
   es de una persona (owner 2026-09-25). La fila sigue en el barrido por la salvedad 2, pero para
   el reloj de la marca, no para volver a llamar.
   **Sobre ~~una lápida~~ la lápida de recepción no hay transición** (FASE 9 completa, C-R5-3): los 3 días se cuentan desde
   que se escribió (~~`B/21` §2.5, paso 4 de `16-fase-7…` §4.2~~ §2.4), ~~y el reintento sale **sin** correo
   *«antes de cancelar»*: la comunicación del corte es la del corte, no la de una baja~~ (FASE 5,
   simplificación del corte, S-40 y S-70: esa excepción del correo era de la lápida del corte, que
   salió; ~~⚠️ si el reintento sobre la de recepción repite el correo del handler vuelve al owner,
   registro `17-aplicacion-cobro-capitulos-b.md`~~). **El reintento sobre la lápida de recepción
   sigue la regla de toda cancelación nuestra, la del punto 1: el correo sale una sola vez, el del
   handler antes del primer intento, y no se repite si se entregó**; si no había destinatario, el
   reintento lo intenta de nuevo sin efecto y no bloquea (`B/03` §3.2) (FASE 5, lote de la
   aplicación, owner 2026-09-30, K).
3. **Y la misma regla alcanza a la fila que la cancelación dejó VIVA**: la `CANCEL_SCHEDULED` de
   `S11` ~~y de `S26`, que mandan~~ (`S26` salió con la revisión del owner, 2026-09-28, C8), que manda la cancelación en el acto y no llega a terminal hasta `S12`. El
   barrido la reintenta ya ahí, por el par `authorized`/`paused`/`pending` × `CANCEL_SCHEDULED` de
   `B/03` §10.1, sin esperar a que `S12` la sume a la salvedad 4 (owner 2026-09-25; FASE 8
   completa, `F-8CB1-013`). **Cuenta como de `S11` la fila de complemento que el espejo de `R18`
   o `S7` llevan ahí por la regla de `S11`** (`B/03` §10.1; owner 2026-09-27, FASE 9 vuelta 2,
   `R18-b`), **y la que `S22` lleva ahí sobre una fila que vive del crédito, con sus
   complementos** (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-b`): la fila de `S22` de
   la tabla de arriba es la que va a `CANCELLED`. No hace falta una salvedad nueva: `CANCEL_SCHEDULED` es un estado vivo
   y el barrido ya la recorre.
4. **Un preapproval vivo sobre una fila que NUNCA mandamos cancelar sigue siendo divergencia**,
   y va a persona **como hoy**: por la comparación de estado, con la marca del par que le toque en
   `B/03` §10.1. Lo mismo vale para toda terminal fuera de esas dos salvedades —~~`S16` y~~ el espejo,
   que no mandó ninguna cancelación, y `S17`, que llega a terminal sólo con la suya ya
   confirmada por relectura—.

**No toca plata**: cancelar no cobra ni devuelve nada, sólo impide cobros futuros. Es la frontera
de §2.4 y no una excepción a ella.

~~**Dónde se cuentan las corridas seguidas no está escrito todavía**, y no se inventó acá una
columna.~~ **Resuelto el 2026-09-25 por el owner: no se cuentan corridas, se mide tiempo** (punto
2 de arriba). Por qué no se contaron corridas: la marca tiene reloj propio (`puesta_en`, `B/02`
§2.2), pero no existe hasta que se abre, así que no puede contar lo anterior; el §6.2 tampoco
declaraba dónde vivía su conteo; y el registro de corridas del §7 dice cuándo corrió el barrido,
no cuántas veces falló una fila. Contar corridas pedía una columna nueva; medir tiempo no pide
ninguna.

> **La 4 es la que cierra el caso de `S13`, y por eso `S13` no necesita una rama de fallo propia
> como la de `S17`.** `S17` puede no ocurrir porque su cierre depende de la cancelación; `S13`
> **tiene que ocurrir igual** —el §35.3 ordena cortar la obligación de pago y el acceso ya lo da
> el grant—, así que su fila llega a `CANCELLED` aunque la llamada falle. Lo que no puede pasar es
> que en ese caso salga del barrido: el beneficiario de un *Free Forever* seguiría pagando todos
> los meses y el único mecanismo declarado para lo que diverge en silencio tendría escrito que no
> lo mira. La 4 es ese mecanismo, y no cuesta ninguna decisión nueva: es la salvedad 1 con otro
> sujeto.
>
> **Y `S20` entra por la 4 y no por la 1, aunque su sujeto sea un complemento.** La 1 selecciona
> la suscripción de complemento **por el estado terminal de su instancia**, y en `S20` la
> instancia **no** es terminal: sigue `ACTIVE`, a costo $0 (`B/16` §3.4). La fila terminal es la
> suscripción, y la canceló una llamada nuestra que puede fallar — exactamente el sujeto de la
> 4. Si la 1 fuera la puerta, la población quedaría vacía y el preapproval seguiría cobrando el
> addon que acabamos de declarar gratis.
>
> **Y `S21` es el reverso exacto: entra por la 1 y no por la 4.** Allá la instancia sobrevive y la
> fila terminal es sólo la suscripción; **acá las dos llegan a terminal en el mismo acto**
> (`B/16` §4.4), que es justo el sujeto que la 1 selecciona, con la misma condición de corte —hasta
> que la relectura vea el preapproval `cancelled`— y sobre **el mismo** preapproval, porque hay uno
> solo (`DEC-ADDON-002`). Contarla también en la 4 sería barrer dos veces la misma fila por dos
> puertas que terminan en la misma llamada. **Las dos salvedades siguen siendo poblaciones
> distintas**: la 4 son suscripciones cuya cancelación no tiene ninguna instancia detrás, y la 1
> son las que sí.

**La 2 y la 3 se solapan a propósito, y no es redundancia**: la 2 cubre la fila que ya tiene la
marca, la 3 cubre la que **debería** tenerla y no la tiene porque `S18` no llegó a ponerla — que
es el caso que la segunda comprobación de más abajo detecta. Sin la 3, esa comprobación nombra una
rama que su propio alcance excluye.

**Y esto es lo que vuelve consistente la frase de más abajo** —*«una fila con la marca
`requiere_conciliación` SÍ se barre»*—, que hasta acá contradecía al encabezado de este § cada vez
que la fila marcada era terminal.

**Una instancia de addon en estado terminal SÍ se barre, hasta que la relectura la vea
`cancelled`.** Ahí la garantía no existe: su preapproval es propio (`DEC-ADDON-002`), el
proveedor no lo tocó y **lo cancelamos nosotros** cuando `A3`, `A5` —la que lo declara
huérfano, o la que revoca el grant del que colgaba su ancla-título— o `A6` la llevan a un estado terminal
(`B/03` §8) — una llamada que puede fallar,
y ~~**mutar o cancelar no emite webhook**~~ **mutar no emite webhook, y cancelar sólo avisa si se
aplicó** (FASE 9 vuelta 1, `F-8V1B3-007`)
(`EX-15`), así que no hay ninguna otra vía de aviso. Es exactamente el detector que `B/16` §4.3
declara —*«un addon en estado terminal con su preapproval vivo es una discrepancia que el barrido
ve»*—, y sin esta salvedad el addon salía del barrido **en el mismo acto** en que pasaba a ser
detectable: la exención de arriba lo apagaba. El costo está acotado por su propia condición de
corte —deja de barrerse apenas la relectura confirma la cancelación—, así que no es la cartera
terminal entera sino la cola de las que todavía no confirmaron.

> **El sujeto de esta salvedad son DOS filas, y conviene decir cuál es cuál.** El estado terminal
> es de la **instancia** (`A3`, `A5`, `A6` — `B/03` §8) y el preapproval es de su **suscripción de
> complemento** (`DEC-ADDON-002`, `B/02` §2.4): son dos entidades con dos columnas de estado. Lo
> que la salvedad devuelve al barrido es **la suscripción de complemento**, **seleccionada por el
> estado terminal de la instancia que cuelga de ella** — y eso es lo que hace evaluable el
> detector, porque lo que hay que releer es el preapproval y el preapproval es de la suscripción.
> **Y la instancia pudo llegar a terminal desde cualquiera de sus dos estados vivos**, no sólo
> desde `ACTIVE`: `A5` sale también de `PENDING_AUTHORIZATION` (`B/03` §8), y ahí el preapproval
> existe igual —es el que el checkout iba a autorizar—, así que la llamada que puede fallar es la
> misma y la salvedad lo cubre sin cambiar su condición de corte.
> **En qué estado queda esa suscripción de complemento cuando su instancia muere: `CANCELLED` en
> el acto, y ya está declarado.** Era el hueco que este § dejaba nombrado —ninguna transición del
> §3.2 la llevaba a un estado terminal por esa causa, y por la regla 1 del núcleo eso no se podía
> escribir— y lo cierra **`S21`** (`B/03` §3.2), con la decisión del owner del 2026-09-21 (`DEC-ADDON-004`): **sin
> período de gracia y sin sostener servicio**, porque la capacidad ya la apagó `A5` y lo que un
> `CANCEL_SCHEDULED` sostendría es la fila de un cobro, no un servicio. El razonamiento entero
> —incluido por qué **no** se aplica el patrón de `DEC-SUB-009`, y por qué el período ya cobrado
> **no se reembolsa** automáticamente (`DEC-RF-002`)— está en `B/16` §4.4.
>
> **Y la salvedad ya puede nombrar su sujeto de las dos maneras, que es lo que cambió acá.** Antes
> sólo lo podía seleccionar **por el estado terminal de la instancia**, justamente porque la fila
> de complemento no tenía estado propio que declarara nada; ahora lo tiene. **La selección
> indirecta no sobra por eso, y es la mitad que hace falta escribir**: es la única que ve la
> corrida que ejecutó `A5` y no llegó a `S21`, donde la fila de complemento sigue diciendo `ACTIVE`
> y para las cinco comparaciones de arriba eso **coincide**.
>
> **`S20` es el otro caso y sigue siendo otro.** Ahí la causa es el grant, la instancia
> **sobrevive** y la fila terminal es sólo la suscripción; acá la instancia **muere** y la pregunta
> era qué pasa con su cobro. Dos huecos distintos con el mismo sujeto, y **los dos cerrados**: uno
> por `S20`, el otro por `S21`.
>
> **`A4` no está en esa lista y antes sí estaba.** `A4` es *«llega su fecha de fin → `EXPIRED`»*,
> o sea la vigencia `DÍAS_FIJOS`, y un preapproval propio existe **sólo** si el cobro es
> `PERIÓDICO` (`B/16` §1.2): la taxonomía declara que **`PERIÓDICO` + `DÍAS_FIJOS` no existe**
> (`B/16` §1.3). Nombrarla hacía contar una población vacía y escribir una rama muerta.

**Y hay una comprobación que no le pregunta nada al proveedor: la sucesión abierta sobre una fila
muerta.** Si una fila que el barrido alcanza tiene `sucede_a` **no nulo** y la predecesora a la
que apunta **ya no es fila viva** (`NUCLEO/01` §2.4), la sucesión debería estar cerrada y no lo
está: `S18` no corrió. Se abre la **marca** con motivo **`SUCESIÓN_ABIERTA_SOBRE_FILA_MUERTA`**
(`B/02` §2.5). Cuesta cero llamadas —las dos filas están en nuestra
base— y vigila el único estado que deja el candado `A` **vacío**, que es el que permite que un
alta nueva entre sin que nada la rechace y queden dos preapprovals cobrando. La rama legítima de
ese estado —la cancelación de `S17` que falló sobre un preapproval vivo— **ya trae la marca
puesta**, así que esto no la duplica: lo que encuentra es la que llegó ahí **sin** marca, o sea
por un camino que `G-R1-C` no alcanzó a impedir.

> **Y la comprobación NO lleva excepción para la sucesora en `PENDING_AUTHORIZATION`: llevaba
> una, y era el agujero.** El argumento decía que `S18` exige la sucesora **`ACTIVE`**, que las
> transiciones por las que la predecesora se muere sola —`S12`, `S13`, `S16` y el espejo del
> §10.1— dejan a la sucesora esperando autorización, y que ahí `S18` *«no es que no corrió:
> todavía no puede correr»*. La premisa se cayó: **desde `B/03` §3.2, `S18` también sale de
> `PENDING_AUTHORIZATION`** cuando la predecesora murió por `S12`, por `S16` o por el espejo,
> justamente para que la sucesora ocupe el candado `A`. En esos tres casos `S18` **sí puede
> correr**, así que una sucesión abierta sobre una predecesora muerta es un incidente y se marca,
> sin esperar nada.
>
> **Y la razón que daba la excepción miraba el lado equivocado del candado.** Decía que *«mientras
> la sucesora no autorizó no hay dos autorizaciones que puedan cobrar, que es la condición del
> candado `A`»*. La condición del candado `A` **no es** que haya dos autorizaciones cobrando: es
> que haya **una fila viva con `sucede_a` nulo** que lo ocupe. Mientras no la hay, el `INSERT` de
> un tercero **no se rechaza** — y `B/12` §4.4 le pide al cliente al que le rechazaron el primer
> cobro que haga exactamente eso. Las dos autorizaciones aparecían **después**, y para entonces la
> sucesión ya no se podía cerrar: `S18` tendría que limpiar `sucede_a` y la base rechazaría la
> escritura por colisión en `A`.
>
> **Lo único que esta comprobación no marca es `S13`**, y no por excepción sino por su propio
> estado: `S13` alcanza también a la sucesora, así que no queda ninguna sucesión abierta sobre una
> fila muerta —quedan **las dos** muertas—, y no hay candado vacío que aprovechar. **Lo que sí
> queda por mirar es el preapproval**, porque el efecto de `S13` es una llamada nuestra que puede
> fallar: eso lo cubre la **salvedad 4**, que devuelve las dos filas al barrido hasta que la
> relectura las vea `cancelled`. Las dos mitades son distintas y hacen falta las dos: una vigila
> el candado, la otra la autorización.

**Y una segunda que tampoco le pregunta nada al proveedor: el pago pendiente por `S19` cuya
sucesión ya terminó.** Si una fila tiene un pago acreditado **pendiente de resolución**
(`B/03` §3.2, `S19`) y ya **no** es la predecesora de una sucesión en curso —la sucesora murió, o
la sucesión se cerró—, su destino estaba determinado y nadie lo ejecutó: se resuelve por la rama
que le corresponda de las seis de `B/12` §5.3, y si la rama no es determinable, se abre la
**marca** con motivo **`PAGO_PENDIENTE_SIN_RAMA`** (`B/02` §2.5), **con el pago colgado de ella** (§2.2):
es uno de los motivos sobre los que la persona puede terminar devolviendo plata, así que el
listado no lo muestra como una divergencia más. Cuesta cero llamadas y cubre el único estado que el arreglo de `S19` puede dejar
colgado: **un pago retenido para siempre**, que del lado del cliente se lee como un cobro sin
servicio y sin devolución. Hace falta porque el reloj del grace **no corre** mientras ese pago
esté pendiente (`S6`): sin esta comprobación no hay nada que lo destrabe solo.

> **Los dos casos que enumera son alcanzables, y uno de ellos sólo lo es por la salvedad 3.**
> *«La sucesora murió»* deja la predecesora en `GRACE_PERIOD` o `SUSPENDED`, que el barrido
> recorre por su estado. *«La sucesión se cerró»* la deja en `CANCELLED` por `S17` — **terminal**,
> y sin la salvedad 3 esta mitad de la comprobación era inalcanzable por construcción: nombraba
> justo la rama que su propio alcance excluía. Es la rama que mueve dinero, y la única de las
> cuatro que lo hace.
>
> **Y es un backstop, no el disparador.** En el curso normal los cuatro actos de `B/03` §3.2 ya
> resolvieron el pago antes de que el barrido llegue: `S18` abre la marca
> `REEMBOLSO_POR_CONFIRMAR` —por la rama 1, por la 5 **y por la 6**—, `S3` lo reevalúa, `S13` apaga
> la bandera. Esta comprobación existe para la corrida en
> que alguno no se ejecutó. **Y el motivo con que la abre no es el de esta comprobación**: `S18`
> sabe cuál es la rama y por eso puede decir *«devolvé»*; ésta llega cuando la rama **no** es
> determinable, y ahí lo que la persona tiene que hacer es decidirla (`B/02` §2.5, motivos 1 y 4).

**Y una tercera, que tampoco le pregunta nada al proveedor: la vertical que `S13` —o `S20`— no
alcanzó a cerrar.** Si un beneficiario tiene un **ancla viva** en la vertical V —una fila de
`permanent_grant_vertical` cuyo grant tiene **`revocado_en` nulo** (`B/02` §2.4, `NUCLEO/01`
§2.4)— y además **una de estas dos cosas**, el fan-out no terminó de correr y se abre la
**marca** con motivo **`FAN_OUT_DE_GRANT_INCOMPLETO`** (`B/02` §2.5):

| qué no debería existir | qué acto quedó a medias | qué le está pasando al beneficiario |
|---|---|---|
| una **fila viva principal** suya en V | `S13` | **paga todos los meses una vertical que el grant le regaló**, con el §35.3 ordenando lo contrario |
| una **fila viva de complemento** suya cuyo addon es **compatible con V**, si el grant lleva `includesAddons: true` | `S20` (`B/03` §3.2, `B/16` §3.4) | **paga todos los meses un addon que el flag le declaró gratis**, con el §35.2 ordenando lo contrario |

Cuesta cero llamadas —todas esas filas están en nuestra base, **incluida la columna que contesta
si el grant sigue vivo**— y cubre el único estado que ese fan-out puede dejar colgado. **Es una
comprobación y no dos**: los dos actos corren en el mismo instante, fallan del mismo modo y se
arreglan reanudando lo mismo, así que partirla sería contar dos veces el mismo barrido. **Y la
segunda fila no corre si el flag es `false`**: ahí el complemento vivo es lo correcto, no una
divergencia.

> **La segunda fila alcanza también a la corrida que `S20` cortó ENTRE sus dos escrituras, y eso
> depende del orden en que están declaradas** (`B/03` §3.2). `S20` escribe primero el ancla-título
> sobre la instancia y recién después cancela el cobro, así que una corrida cortada deja la fila
> de complemento **todavía viva** — que es exactamente lo que esta comprobación pregunta. Con el
> orden inverso preguntaba por la mitad que ya se había ejecutado y la población le quedaba
> vacía.
>
> **Hace falta porque ése es, con esas palabras, el estado que el diseño declara indetectable.**
> `B/03` §3.2 lo escribe al justificar el alcance de `S13`: *«la fila está `ACTIVE`, el proveedor
> dice `authorized`, y para el barrido eso **coincide**»*. Las cinco comparaciones de arriba no lo
> ven —los dos lados dicen lo mismo— y las otras cinco comprobaciones miran `sucede_a`, el pago
> pendiente y **una instancia de addon**, no las filas de suscripción del beneficiario. **La
> cuarta sí mira un ancla** —su segunda mitad pregunta si la que era título de una instancia se
> retiró—, y aun así no ve esto: su sujeto es la **instancia**, y acá el que quedó colgado es un
> **cobro**, con su instancia perfectamente sana.
>
> **Y cubre los dos disparadores de `S13`, no uno.** Desde que el scope son anclas, `S13` lo lanza
> el **otorgamiento** y también el **anclaje de una vertical nueva a un grant vivo**
> (`12-contrato…` §2.8), así que la ejecución parcial tiene dos orígenes. La comprobación no
> pregunta por el acto: pregunta por el **resultado**, que es el mismo en los dos.
>
> **No necesita excepción por carrera.** `S13` corre en el mismo acto del otorgamiento o del
> anclaje y el barrido es diario (§7); no hay ventana legítima en la que un ancla viva conviva con
> una fila viva principal en su vertical. Si alguna vez la hubiera, el desenlace es la marca —una
> persona—, no una cancelación automática.
>
> **Y la segunda fila tampoco la necesita, aunque `S20` sí tenga una ventana interna.** Entre sus
> dos escrituras —el ancla-título primero, el cobro después (`B/03` §3.2)— existe un instante en
> que el ancla ya está viva y la fila de complemento todavía también. Esa ventana **no es
> legítima: es el estado que esta comprobación tiene que levantar**, y dura lo que dura el acto
> frente a un barrido diario. Exentarla sería apagar el detector justo sobre la población que lo
> obliga a existir.
>
> **Es el detector de un racimo, no de un caso.** La misma comprobación ve la vertical que `S13`
> no alcanzó por una corrida cortada, la que no alcanzó porque **el acto nuevo no la disparó**, y
> la que alcanzó con la llamada al proveedor fallida —esa última la ve **además** la salvedad 4,
> por el otro lado—. Ninguna de las tres la cierra; las tres las detecta. **Y las mismas tres
> valen para `S20`**, con el complemento en lugar de la principal: es el mismo fan-out, en el
> mismo acto, con la misma llamada por fila.
>
> **En `S20` la primera de las tres tiene una granularidad más fina, y siguen siendo tres.** Una
> corrida de `S20` puede cortarse **dentro de una fila**, entre sus dos escrituras, porque `S20`
> escribe sobre dos entidades (`B/03` §3.2). Es el mismo caso —*«el fan-out no llegó»*— visto más
> de cerca, no uno nuevo, y lo ve esta misma comprobación **gracias al orden**: la fila de
> complemento sigue viva hasta la segunda escritura.

**Y una cuarta, que tampoco le pregunta nada al proveedor: la instancia de addon viva cuyo
objetivo ya murió.** Si una instancia está en uno de sus **dos** estados con autorización que
puede cobrar —`PENDING_AUTHORIZATION` o `ACTIVE` (`B/03` §8)— y su objetivo **ya cumple la
condición de orfandad del `B/16` §4.2**, **o el ancla que era su título ya no es la de un grant
vivo** —el `permanent_grant` de esa ancla tiene **`revocado_en` escrito** (`B/02` §2.4,
`NUCLEO/01` §2.4)—, `A5` no
corrió: se abre la **marca** con motivo **`ADDON_SIN_APAGAR`** (`B/02` §2.5). **O, en scope
`LISTING`, su ficha da `fichaPurgada: sí`** (`12-contrato…` §4.1) —el empuje de `PB9`/`PB12` que
dispara `A6` no llegó o `A6` no se pudo ejecutar (owner 2026-09-26, `G2-1`)—: **en ese caso el
barrido corre primero `A6`** (`B/03` §8), **y marca sólo si `A6` no se pudo ejecutar**. Es la red
del empuje, que no tiene transporte durable (`12-contrato…` §3.1): desde `K-9` el borrado de la
ficha no está en la condición del §4.2, así que sin esta mitad la comprobación no veía el caso
(FASE 9 vuelta 1, `F-8V1A3-003`, `F-8V1C1-001`). Cuesta cero llamadas **al proveedor** —la instancia, su objetivo y el ancla del
grant están todos en nuestra base; la mitad de `fichaPurgada` es una consulta interna al
contrato— y **no reescribe el predicado: lo delega** en el §4.2, que es
su único dueño.

> **La segunda mitad no es un adorno del enunciado: sin ella la comprobación es ciega a tres de
> los cuatro scopes.** El evento de `A5` tiene **tres** cláusulas desde `B/03` §8, y la tercera
> —*«se revoca el grant del que cuelga el ancla que era su título»*— es la única que corta un
> addon de scope `LISTING`,
> `USER` o `GLOBAL` cuyo título era un grant: su objetivo es una ficha o una cuenta que **siguen
> existiendo**, así que la condición de orfandad **no se cumple nunca** y una comprobación
> escrita sólo sobre el objetivo no encuentra a nadie. **Desde la FASE 8 completa, para
> `LISTING` esto vale sólo cuando el dueño no tiene fila principal en esa vertical**
> (`F-8CA2-003`, owner 2026-09-25): su orfandad remite ahora a la condición de
> `VERTICAL_SUBSCRIPTION` sobre la principal de la vertical de la ficha (`B/16` §4.2), así que la
> primera mitad de esta comprobación también lo ve — sin cambiar el enunciado, que delega. Es la misma delegación: el predicado de la
> tercera cláusula vive en `B/03` §8, no acá. **Y se lee igual de barata con el enunciado nuevo**:
> que el grant del ancla siga vivo es un dato de nuestra base **desde que es una columna**
> —`permanent_grant.revocado_en`, `B/02` §2.4—, así que la comprobación sigue costando **cero
> llamadas**.
>
> **Esa frase se escribió antes que la columna, y hasta la FASE 9-bis-4 era falsa.** `B/02` §2.4
> no declaraba para el grant **ni estado ni revocación**, así que *«que siga vivo»* no era un dato
> de nuestra base: era un acto que nadie había guardado, y esta mitad del predicado —como la
> tercera comprobación entera y como la tercera mitad de la orfandad— **no se podía evaluar**.
> Lo que cambió no es el enunciado sino contra qué se lee.
>
> **Y la pregunta se hace DESPUÉS de la revocación, que es por qué el ancla no se borra.** Si
> revocar borrara las filas de `permanent_grant_vertical`, esta mitad se quedaría sin sujeto
> —`addon_instance` apuntaría a una fila que no existe— justo en el instante en que tiene que
> contestar. Revocar **marca el instrumento**; las anclas sobreviven como filas y dejan de ser
> vivas todas a la vez (`B/02` §2.4).
>
> **Es el reverso exacto de la salvedad 1, y hacen falta las dos.** La salvedad 1 mira una
> instancia **terminal** con el preapproval **vivo** —`A5` corrió y la llamada al proveedor no se
> aplicó, **o corrió `A5` y no `S21`**—; ésta mira una instancia **viva** con el objetivo
> **muerto** —`A5` no corrió—. Ninguna de las dos ve el caso de la otra, y entre las dos cubren
> las dos mitades del *«el que no puede fallar»* del `B/16` §4.3. **Y `S21` no agrega ninguna**:
> su ejecución parcial no pide comprobación propia, porque su fila ya vuelve al barrido por la 1.
> La quinta, que sí existe, es la de la pausa vencida y llegó por otro sujeto (más abajo).
>
> **Hace falta porque este estado es indetectable por comparación, con las mismas palabras que el
> de `S13`**: la instancia dice `ACTIVE`, el proveedor dice `authorized`, y para las cinco
> comparaciones de arriba eso **coincide**. El detector que el `B/16` §4.3 declara —*«un addon en
> estado terminal con su preapproval vivo»*— busca justo lo contrario, así que sobre esta
> población está apagado.
>
> **Es un backstop, no el disparador.** En el curso normal `A5` ya cerró la instancia en alguno de
> los **cuatro** momentos que el `B/16` §4.3 enumera —el cuarto es la revocación del grant o el
> retiro de un ancla—. Esta comprobación existe para la corrida en que ninguno se ejecutó, y su
> desenlace es la marca —una persona—, nunca una cancelación automática.

**Y una quinta, que tampoco le pregunta nada al proveedor: la pausa vencida que no reanudó.** Si
hay una `subscription_pause` **sin `fin_real`** cuyo **`fin_previsto` ya pasó** (`B/02` §2.2) y su
suscripción sigue en `PAUSED`, `S10` —o `S33`, si es de complemento— no corrió: se abre la **marca** con motivo
**`REANUDACIÓN_NO_APLICADA`** —el mismo que escribe la rama de fallo de `S10`, porque es el mismo
caso visto por el otro lado (`B/02` §2.5)—. Cuesta cero llamadas —la
pausa y la suscripción están las dos en nuestra base— y cubre el único estado que **la salida que
devuelve el servicio** puede dejar colgado.

**Las otras ~~tres~~ ~~cuatro~~ ~~seis~~ ~~siete~~ seis salidas de `PAUSED` no producen ese estado, y por eso la comprobación no las
nombra** (revisión del owner, 2026-09-28, C8: sale `S25`). `S22` —la baja—, `S13` —el grant—, **`S17`** —la sucede otra fila—, ~~**`S25`** —el fin de la pausa sobre un plan que ya
no se presta (`DEC-SUB-015`)—,~~ **`S36`** —la revocación, desde el owner 2026-09-26, `X-2`— **y el espejo de la baja decidida por el proveedor** (`B/03` §10.1) mandan la fila a `CANCELLED`, **y `S6` —un contracargo sobre una
cortesía, desde la pendiente 8 (owner 2026-09-25)— la manda a `SUSPENDED`**, así que la tercera
condición de arriba (*«su suscripción sigue en `PAUSED`»*) **deja de cumplirse** y el caso sale
del detector por donde corresponde. ~~`S22`, `S25` **y `S6`** además escriben~~ ~~**Las seis**~~ ~~**Las siete**~~ **Las seis
escriben además** el `fin_real` de la pausa, que
es la primera condición. Una pausa cerrada por cualquiera de las ~~tres~~ ~~cuatro~~ ~~seis~~ ~~siete~~ seis **no queda colgada y no
produce un falso positivo** (FASE 9 completa, contradicción 2 de `03` §R4.5: la cuenta omitía `S17` y
el espejo, y el espejo no escribía `fin_real`, `B/03` §10.1). **Y en una fila de complemento pausada
por `S32`** (owner 2026-09-25, 4a) la comprobación vale igual: su reanudación es `S33` y no `S10`, y
sus terminales `S20` y `S21` también escriben `fin_real` (`B/03` §3.2).

~~**Y `S25` es la que más cerca estuvo de volverla ciega**, así que conviene decir por qué no lo
hace: comparte evento con `S10`, o sea que se dispara **en el mismo instante** en que esta
comprobación esperaría una reanudación. Lo que la separa es que `S25` **escribe las dos columnas
que el detector mira** —`fin_real` en la pausa y `CANCELLED` en la suscripción—, mientras que la
rama de fallo de `S10` no escribe ninguna de las dos. Si `S25` corriera sin escribir el
`fin_real`, el barrido reportaría todos los días una reanudación que nadie va a aplicar nunca.~~
(Sale con `S25`: revisión del owner, 2026-09-28, C8.)

> **Hace falta porque este estado es indetectable por comparación, y acá los dos lados dicen lo
> mismo de verdad.** `PS-4` mide que el proveedor **no tiene auto-reanudación**, así que su
> preapproval sigue `paused` igual que nuestra fila: para las cinco comparaciones de arriba eso
> **coincide**, exactamente como en el caso de `S13`. Y las otras cinco comprobaciones miran
> `sucede_a`, el pago pendiente de `S19`, las filas vivas bajo un ancla y una instancia de addon;
> **ninguna mira el reloj de una fila**.
>
> *(`D16` y `G-R5` salieron con la revisión del owner, 2026-09-28, C14: la pausa pedida por el
> cliente detiene el reloj de retención. La comprobación sigue siendo la única que mira el tiempo
> real de una fila, y con C14 lo que está en juego abajo cambia: el reloj ya no corre hacia el día
> 180 durante una pausa, queda detenido mientras la reanudación no ocurra. **Y esta comprobación es
> la que impide que quede detenido sin fin sin que nadie lo vea**: la marca que abre pone la pausa
> vencida delante de una persona; revisión del owner, casos vecinos, 2026-09-29, caso F-A, `12-contrato…` §4.1.)*
>
> **Es la comprobación que mira el TIEMPO REAL de una fila, y por eso no la cubre `D16`.** `D16`
> compara *«el tope de una pausa que declara el catálogo»* contra el día del hard delete
> (cap. 04 §3, núcleo) — **dos cifras de configuración**, las dos verdaderas mientras nadie las
> toque y **las dos ciegas a que una pausa concreta lleve 140 días abierta**. `G-R5` sigue en
> verde en ese escenario, y tiene razón: no es su pregunta.
>
> **Y lo que está en juego no es sólo el cobro.** Una reanudación que no ocurre deja al cliente
> **sin servicio y sin cobro** desde el día en que su pausa vencía, y —porque `cubierto` sigue
> falso— con el reloj de inactividad de verticales corriendo hacia el hard delete del día 180
> (`V/02` §4.1, `NUCLEO/01` §1.2). Es la única de las seis comprobaciones cuyo desenlace no
> atendido **borra datos del cliente**.
>
> **Es un backstop, no el disparador.** En el curso normal la rama de fallo de `S10` (`B/03` §3.2)
> ya puso la marca cuando la relectura vio el preapproval todavía `paused`. Esta comprobación
> existe para la corrida que **no se ejecutó nunca**, que es el modo que ninguna relectura
> produce. Su desenlace es la marca —una persona—, nunca una reanudación automática a ciegas.

**Y una sexta, que tampoco le pregunta nada al proveedor: la cortesía diferida que nadie
re-emitió.** Si hay un `courtesy_grant` con **`saldo_meses` no nulo y `saldo_cerrado_en` nulo** —o
sea **diferido**, `B/02` §2.4 y `NUCLEO/01` §2.6— y **ya existe la fila que tenía que recibirlo, en
`ACTIVE`**, `S9` no corrió: se abre la **marca**
con motivo **`CORTESÍA_SIN_RE_EMITIR`** (`B/02` §2.5). Cuesta cero llamadas —la cortesía y las dos
suscripciones están todas en nuestra base— y cubre el único estado que
`DEC-GRANT-007` puede dejar colgado: **la fila nueva cobra el precio entero por ~~días~~ meses que
`SUPER_ADMIN` había regalado** (en meses desde la FASE 8 completa, `F-8CB1-001`).

~~**Y *«la fila que tenía que recibirlo»* son DOS preguntas, una por cada disparador de `S9`**~~
**Y *«la fila que tenía que recibirlo»* es UNA pregunta** (revisión del owner, 2026-09-28, C8: el
segundo camino, `S25` con `DEC-GRANT-010`, salió) (`B/03` §3.2):

| de dónde viene el saldo | cómo se busca la fila que debía recibirlo |
|---|---|
| `S18` cerró una sucesión (`DEC-GRANT-007`) | la suscripción a la que la cortesía apunta tiene **`sucedida_por` no nulo**, y esa sucesora está en `ACTIVE` |
| ~~`S25` terminó una pausa sobre un plan que ya no se presta (`DEC-GRANT-010`)~~ | **sale** (revisión del owner, 2026-09-28, C8) |

~~**La segunda no se dispara cuando esa fila nueva no existe, y eso es deliberado.** Una vertical
discontinuada **queda cerrada a altas** (`B/10` §4.5, borde 4), así que ahí no va a haber nunca
una fila que reciba el saldo: marcar ese caso sería abrirle a una persona, **todos los días y para
siempre**, un caso que no tiene ninguna acción posible — que es lo contrario de para qué existe el
listado accionable. **El saldo queda diferido y declarado**, con su pregunta al owner en `B/14`
§4.6.~~

> **Hace falta porque este estado es indetectable por comparación, con las mismas palabras que el
> de `S13` y el de `S10`.** La sucesora dice `ACTIVE`, el proveedor dice `authorized`, y para las
> cinco comparaciones de arriba eso **coincide**. Y las otras cinco comprobaciones miran
> `sucede_a`, el pago pendiente de `S19`, las filas vivas bajo un ancla, una instancia de addon y
> el reloj de una pausa: **ninguna mira una cortesía**, que es literalmente lo que `B/14` §4.4 ya
> declaraba del caso hermano —*«el barrido no compara grants, la fila no queda marcada, y el
> cliente se entera cuando le cobran»*—. Ésta es la que lo compara.
>
> **Y no marca el instante entre `S2` y `S9`, que es legítimo.** `S9` corre en el mismo acto de la
> autorización; lo que esta comprobación levanta es la corrida que **no se ejecutó**, contra un
> barrido diario. El cobro que el proveedor pueda haber hecho en ese instante **no entra por acá**:
> entra por su propia marca, `COBRO_DURANTE_CORTESÍA`, que es el riesgo que `DEC-GRANT-007` aceptó
> por escrito.
>
> **Y el caso en que la sucesora NO llega a `ACTIVE` no es de esta comprobación, y desde
> `DEC-GRANT-011` tampoco es un caso abierto.** Si abandona el checkout, `S3` la manda a
> `ABANDONED` y el beneficiario **ya no tiene ninguna fila viva en esa vertical**, así que no hay
> obligación de pago que no cobrar —la razón exacta con que `DEC-GRANT-004` (2) bloquea otorgar una
> cortesía sobre una pausa—. **Ese saldo se CIERRA en la misma transición que manda la fila a
> `ABANDONED`** (`S3`, `B/03` §3.2), con `saldo_cerrado_en` y su `motivo_cierre`, y quien vuelva a
> suscribirse no recupera esos días (`DEC-GRANT-011`, owner, 2026-09-23). **Esta comprobación no lo
> ve y no tiene que verlo**: el saldo cerrado deja de ser *«cortesía diferida»* (`NUCLEO/01` §2.6),
> que es el término del que sale su población. **Lo que este § declaraba abierto era exactamente
> eso**, y la decisión eligió cerrar antes que esperar, porque un saldo esperando es *«un
> instrumento abierto sin fecha de cierre»* —la forma que `B/16` §1.3 rechaza por escrito— y esta
> comprobación, que es la única que mira una cortesía, **exige que la fila receptora ya exista en
> `ACTIVE`**, así que no lo levantaría nunca.
>
> **Y el caso en que la sucesora llega al grace sin que `S9` haya corrido queda afuera, y es
> deliberado** (owner 2026-09-26, P1; FASE 9 vuelta 1). Esta comprobación busca la sucesora **en
> `ACTIVE`** y no se ensancha a `GRACE_PERIOD`: ahí `S9` no tiene `desde`, así que una marca abierta
> sobre esa fila no tendría ninguna acción nombrada. La población sólo existe si `S9` **no se
> ejecutó** —un proceso caído entre `S2` y `S9`—: si intentó y el `PUT paused` no se aplicó, la
> fila ya tiene la marca `PAUSA_NO_APLICADA` (`B/02` §2.5). Y además hace falta que el primer cobro
> llegue antes del barrido, que se rechace y que la predecesora viniera pagando (`DEC-SUB-022`).
> Si la persona paga en el grace, `S5` devuelve la fila a `ACTIVE` y esta comprobación la levanta
> al día siguiente, con su devolución. Si termina en `SUSPENDED`, **el saldo queda diferido y sin
> emitir** ~~, como el que difirió `S25`~~, y **lo repara `SUPER_ADMIN` volviendo a otorgar la
> cortesía** cuando la fila vuelva a `ACTIVE`, que es el primer disparador de `S9` y no un
> mecanismo nuevo. Queda declarado en *«lo que este capítulo NO cierra»*.

**Y una comprobación que SÍ le pregunta al proveedor, y no sobre un preapproval sino sobre un
PAGO: los pagos acreditados de una ventana reciente** (FASE 8 completa, `F-8CB3-009`,
`DEC-SUB-020`, owner 2026-09-25). Las cinco comparaciones de arriba leen **el preapproval** y el §4
lee los **registros de cobro** para contestar *«¿cobró?»*; **ninguna vuelve a mirar un pago que ya
registramos como `SUCCEEDED`**, así que si después cambia —el cliente lo desconoce ante su banco, o
alguien lo reembolsa desde el panel del proveedor— la fila sigue diciendo cobrado, el período
sigue cubierto y el servicio sigue. **Por cada `payment` en `SUCCEEDED` —o `PARTIALLY_REFUNDED`
(FASE 9 completa, C-R7-3: la tabla de abajo ya valía sobre ése y la selección no lo leía), **o
`REFUNDED`** (FASE 9 vuelta 3, `F-8V3B2-002`: un contracargo sobre algo que ya devolvimos no lo
veía nadie)— cuya fecha del hecho cae
dentro de la ventana, el barrido lo relee por id** y compara su estado:

| lo que lee | qué se hace |
|---|---|
| lo mismo que tenemos | nada |
| **`charged_back`** | **`P6`** (`B/03` §6): el pago pasa a `CHARGED_BACK`, **`S14` abre la marca `CONTRACARGO`** y, si la suscripción está en `ACTIVE` o `GRACE_PERIOD` **—o en `PAUSED` con motivo `COURTESY`** (pendiente 8, owner 2026-09-25)—, **corre `S6` por su tercer evento** —suspende sin grace y cancela el preapproval— (`B/03` §3.2) —**aunque sea la predecesora de una sucesión en curso**—; **si está en `CANCEL_SCHEDULED`, pasa a `CANCELLED` ya por `S12`**; **en los dos casos, si es la predecesora de una sucesión en curso, `S31` corta a su sucesora** (pendiente 8); en cualquier otro estado, sólo la marca (FASE 8 completa, pendiente 6, owner 2026-09-25). **Vale igual sobre un pago `PARTIALLY_REFUNDED`**. **Sobre un pago `REFUNDED` no corre `P6`, que no sale de ese estado: `S14` abre la marca `CONTRACARGO` con el pago colgado y nada más se mueve**, porque la plata ya salió dos veces y lo que queda es la disputa, con el comprobante de la devolución (FASE 9 vuelta 3, `F-8V3B2-002`) |
| **reembolsado, o con más reembolsado que nuestros `refund`**, sin que el reembolso haya pasado por nuestro flujo | **`S14` abre la marca `REEMBOLSO_FUERA_DEL_FLUJO`** (`B/02` §2.5), **sin suspender**: fue un acto nuestro, no del cliente (`DEC-SUB-020`, *«lo que NO decide»*; `DEC-RF-007`). El `refund` que falta lo asienta la persona |

**Y los pagos en `CHARGED_BACK` también se releen, hasta que la disputa se resuelva** (FASE 8
completa, owner 2026-09-25). Por cada `payment` en `CHARGED_BACK`, el barrido lo relee por id
**hasta que su `status_detail` se resuelva** —`settled` o `reimbursed`—, así alguien lee el
resultado de la disputa aunque el aviso de contracargo del proveedor no llegue (`B/03` §10.2):

| lo que lee | qué se hace |
|---|---|
| todavía sin resolver | nada; se relee en la corrida siguiente |
| **`reimbursed`** | **`P7`** (`B/03` §6), y sale el correo *«la disputa se resolvió a nuestro favor»* (`NUCLEO/07` §6) |
| **`settled`** | el pago queda en `CHARGED_BACK` —`settled` no es fila, `B/03` §6—, y sale el correo *«la disputa se resolvió a favor de la persona»* (`NUCLEO/07` §6) |

Resuelta la disputa, el pago deja de releerse por esta vía.

**La ventana es un parámetro configurable, y su longitud NO está medida.** **Es «la ventana de las
comprobaciones de pagos acreditados y de órdenes pagadas», el plazo 18 de la lista cerrada de
`NUCLEO/02` §1.5, con su valor inicial ~~a proponer al owner~~ de 180 días** (FASE 9 vuelta 3, `F-8V3B3-003`; el valor, FASE 9 vuelta 3, owner 2026-09-30, lote R). No hay en la matriz una
fila que diga cuánto después de acreditado un pago puede llegarle un contracargo, y la del plazo
de reembolso (`RF-3`) sigue `UNKNOWN`; así que el número no se fija acá, se declara **como
configuración sin medir**, igual que el plazo de la marca (más abajo). **El costo, dicho**: es la
única comprobación del barrido cuyo tamaño crece con los **pagos** y no con las suscripciones —una
lectura por pago de la ventana—, y por eso la acota una ventana y no la cartera entera.

> **No es una de las seis comprobaciones de cero llamadas, y por eso no cambia ese conteo**: las
> seis leen sólo nuestra base; ésta relee por id cada pago de la ventana. **Y es el respaldo del
> aviso, no el disparador**: el proveedor documenta un aviso propio de contracargo
> (`topic_chargebacks_wh`, `B/03` §10.2), y cuando llega el pago se relee en el acto. Todo lo que
> este § afirma sobre el proveedor en un contracargo es **documental, no medido** (`RC-8`,
> `UNKNOWN`): qué estados devuelve, si el aviso llega, y **en qué lectura aparece**
> `charged_back` —el pago embebido del registro de cobro o `/v1/payments/{id}`, que sí se lee por
> id en producción (`RF-3`)—. Lo decidido es qué hacemos al leerlo, no cómo se comporta él.
>
> **Un pago de addon de única vez tampoco entra en esta marca**: cuelga de la instancia y no de
> una suscripción, y la marca cuelga de una suscripción (`B/02` §2.3). Es el mismo pendiente que
> ya estaba declarado para esa orden (*«lo que este capítulo NO cierra»*). **La orden que se pagó
> sin que su instancia llegara a `ACTIVE` sí tiene comprobación desde la FASE 9 vuelta 2**, abajo;
> lo que sigue sin comprobación es el pago de una instancia que sí llegó (`B/16`, NO cierra).

**Y la tabla de arriba lee las devoluciones POR SU ID, no por el acumulado** (FASE 9 vuelta 2,
`F-8V2B2-002`, `F-8V2B2-005`). Desde que cada fila de `refund` guarda el id de cada devolución
que mandó al proveedor (`B/02` §2.3, `B/03` §6.1 `RF2`), el barrido separa las devoluciones que
lee en el pago en dos grupos, y cada uno tiene su acto:

| lo que lee en el pago | qué se hace |
|---|---|
| **una devolución cuyo id está en una fila de `refund` nuestra en `CONFIRMED`** | es **nuestro flujo con el aviso perdido** (`WH-5`), no una divergencia: si las devoluciones de esa fila ya suman lo confirmado, **corre `RF3`**; si todavía no, nada, y la fila sigue la regla de `RF2`. **Y por eso el barrido relee también todo pago que tenga un `refund` en `CONFIRMED`**, esté o no en la ventana de arriba, hasta que la fila salga de ese estado |
| **una devolución cuyo id no está en ninguna fila de `refund`** | es la del panel, **fuera del flujo**: el motivo 18, como decía la fila de arriba. *«Con más reembolsado que nuestros `refund`»* se lee así desde ahora: sobra una devolución que ninguna fila nombra, no un monto. **Salvo que el mismo pago tenga una fila en `CONFIRMED` con una llamada sin id** (FASE 9 vuelta 3, `F-8V3B1-004`, `F-8V3B2-003`): ahí es **nuestro flujo con la respuesta perdida**, y la fila toma el id de la devolución cuyo monto es el de esa llamada; si hay más de una candidata del mismo monto, no elige ninguna y abre el motivo 18, con la fila `CONFIRMED` a la vista de quien lo resuelve |

**Y antes de separar los dos grupos, el barrido reenvía las llamadas sin respuesta** (FASE 9 vuelta
3, `F-8V3B1-004`, `F-8V3B2-003`). Por cada fila de `refund` en `CONFIRMED` con una llamada cuya
clave está persistida y cuyo id no volvió, reenvía esa llamada con la misma clave y el mismo
cuerpo (`B/03` §6.1, `RF2`): `201` trae el id y se guarda; `200` con el cuerpo vacío dice que la
devolución ya existía y no trae el id (`RF-6`), que la fila toma de la relectura del pago como
dice la tabla de arriba; un error la deja para la corrida siguiente. **Nunca con una clave nueva**:
sobre un parcial con saldo, eso devolvía dos veces. Como el reintento de una cancelación nuestra,
repite un acto que ya se decidió (acá, una persona lo confirmó); el de las órdenes sigue
prohibido, porque ahí el reenvío podía crear un cobro que nadie decidió.

**Sobre la devolución de una ORDEN no hay llamada sin id, y la rama del mismo monto no se usa**
(FASE 5, owner 2026-09-30, lote 5 F, `R5-27`; `EX-58`, `VERIFIED`, sandbox). El `200` con el
cuerpo vacío y sin id (`RF-6`) es del pago: en la orden, el reenvío con la misma clave y el mismo
cuerpo devuelve la misma devolución, con su id, y el `POST` devuelve **todas** las devoluciones de
la orden, así que **la nueva sale por resta contra las ya registradas**. Por eso **las
devoluciones de una misma orden se serializan**: dos a la vez vuelven ambigua la resta. **Un
`409` es un error de programación** (la clave se derivó mal), no *«ya estaba hecha»*. La tabla de
arriba y su *«salvo»* del mismo monto siguen valiendo para las devoluciones de un pago.

**Y el barrido manda la devolución de una orden que la base frenó** (FASE 5, lote de la aplicación, segunda tanda, owner 2026-09-30, M). El índice parcial
de `B/02` §2.3 deja a lo sumo una devolución de la orden esperando su id, así que la segunda que
se confirma a la vez queda en `CONFIRMED` sin llamada persistida. En su corrida siguiente, después
de reenviar las llamadas sin respuesta, el barrido mira cada orden con una fila de `refund` en
`CONFIRMED` sin llamada: **si ya no queda ninguna devolución de esa orden esperando su id, la
manda**, con su clave persistida antes (`B/03` §6.1, `RF2`); si todavía queda una, la deja para la
corrida siguiente. El mismo índice tampoco lo deja a él mandar dos de la misma orden a la vez.

Sin esto, la devolución hecha por nuestro flujo cuyo aviso se perdía terminaba en el motivo 18,
la persona asentaba un `RF4` por el mismo monto y la fila `CONFIRMED` seguía esperando un `RF3`
que lo sumaba otra vez al acumulado. **Y *«menos devuelto que lo asentado»* no pide detector**:
`RF3` ya no ocurre mientras las devoluciones de la fila no sumen lo confirmado, así que un
`EXECUTED` no puede asentar más de lo que el proveedor muestra.

**Y una comprobación más que le pregunta al proveedor, sobre una ORDEN: la de única vez que se
pagó sin que su instancia llegara a `ACTIVE`** (FASE 9 vuelta 2, owner 2026-09-27, `R4`,
`F-8V2B1-003`, `F-8V2B2-003`). **Por cada instancia de addon `UNA_VEZ` en `ABANDONED` con el id
de su orden guardado** (`B/02` §2.4), dentro de la misma ventana ~~configurable~~ de arriba **(el plazo 18 de `NUCLEO/02` §1.5, una sola ventana para las dos comprobaciones: FASE 9 vuelta 3, `F-8V3B3-003`)**, el barrido
**relee la orden por id**; si tiene un pago aprobado, **abre la marca con motivo
`ORDEN_PAGADA_SIN_INSTANCIA`** (`B/02` §2.5, el 23), colgada de la instancia. La persona devuelve
desde el panel del proveedor y lo asienta con la acción administrativa 14, que crea el `payment` y
el `refund` en `EXECUTED` (`RF4`). **El sujeto es `ABANDONED` y no *«cualquier instancia muerta»***:
una `EXPIRED` o una `CANCELLED` llegaron ahí desde `ACTIVE`, así que su orden pagada es el cobro
normal de lo que recibieron; la única que termina **sin haber estado nunca activa** es la que `A3`
~~abandonó~~ o `A7` abandonaron (`A7`, la orden rechazada: mediciones del 2026-09-29, lote L-C; su
orden quedó `failed` y la relectura no le encuentra un pago aprobado). **Y el barrido no reenvía nada**: reenviar con la clave puede crear la orden si nunca
existió, y cobrar por una instancia ya abandonada. ~~El reenvío es de `A3`, antes de abandonar; si
nunca tuvo respuesta, `A3` no abandona (`B/03` §8), **y `A7` abandona con el id que vino en el
error**, así que toda `ABANDONED` tiene el id de su
orden o no llegó a mandar ninguna.~~ **`A3` tampoco reenvía: sólo confirma, y sin id de orden
abandona sin reenviar** (`B/03` §8; FASE 9 vuelta 3, owner 2026-09-30, lote E), así que **una
`ABANDONED` puede no tener el id de una orden que sí existió**: la respuesta se perdió y el
proveedor igual la creó y la cobró. **Por eso la comprobación busca también por el identificador
del pedido**: por cada instancia `UNA_VEZ` en `ABANDONED` sin id de orden y con su clave
persistida (la clave se persiste antes de la llamada, así que sin clave no salió ninguna), dentro
de la misma ventana, el barrido busca en el proveedor la orden cuya referencia es el identificador
del pedido (`B/06` §3.2) y, si la encuentra con un pago aprobado, abre la misma marca con el
motivo 23. ~~**Que el proveedor permita buscar una orden por esa referencia no está medido**~~
~~(~~ ~~propuesto a la matriz, registro de la FASE 9 vuelta 3, B~~ ~~`EX-57`, `UNKNOWN`): si no lo permite, esa población queda
sin detector y declarada (*«lo que este capítulo NO cierra»*).~~ **El proveedor permite buscar una
orden por esa referencia** (`EX-57`, `VERIFIED` el 2026-09-30, en sandbox): `GET /v1/orders` con
la `external_reference` exacta encuentra la orden, la aprobada y la rechazada, con `begin_date` y
`end_date` obligatorias, que filtran por creación y abarcan como mucho 30 días; **así que la
búsqueda se hace con la ventana anclada a la creación local del pedido** (matriz, `EX-57`; estado
aplicado con OK del owner, FASE 5, lote C1; residuo corregido el 2026-10-02). Lo que la medición
no cubre está en *«lo que este capítulo NO cierra»*. La búsqueda sólo lee; no crea ni reenvía
nada.

> **No es una de las seis comprobaciones de cero llamadas**, igual que la de pagos acreditados:
> relee por id cada orden de la ventana. El conteo de seis no se mueve. **Tampoco lo mueve la
> búsqueda por el identificador del pedido**, que es parte de esta misma comprobación (FASE 9
> vuelta 3, lote E).

**Una fila con la marca `requiere_conciliación` SÍ se barre**, y conviene decir por qué, porque la
intuición contraria es fuerte y costaba caro.

Parecía razonable sacarla: ya divergió, hay una persona mirándola, y volver a compararla sólo
agrega ruido. **Pero lo que se apaga así no es el ruido: es el único detector.** Una suscripción a
la que el proveedor le cobra un monto distinto del pactado entra en un estado del que **el sistema
deja de hablar** —se alerta una vez, sale del barrido, y la marca además le bloquea al cliente el
único acto con el que podría salir—, y **el cobro equivocado sigue saliendo de su tarjeta todos los
meses**.

> **Lo que se agrega es el AVISO, nunca la comparación.** El barrido sigue corriendo sobre la fila;
> lo que no vuelve a emitir es una alerta por corrida sobre un caso ya abierto.

**Y no hace falta inventar el mecanismo: es el de `DEC-OBS-001`**, que ya decidió exactamente esto
para el mismo problema —*«el correo es agregado, con límite de frecuencia, en vez de uno por
evento»*— y cuyo canal primario es el listado accionable, no el correo.

**La marca lleva reloj, y desde la FASE 9-bis-4 lleva la columna que lo sostiene.** Si sigue
abierta pasado su plazo, **escala**: es una divergencia de plata
que nadie resolvió, y sin reloj el servicio que la fila sostiene **no tiene cota**. El plazo es
configuración, como todos los del §42: **«el escalamiento de una marca abierta»**, el plazo 17 de
la lista cerrada de `NUCLEO/02` §1.5, con su valor inicial ~~a proponer al owner~~ de 7 días (FASE 9 vuelta 3,
`F-8V3B3-003`; el valor, FASE 9 vuelta 3, owner 2026-09-30, lote R).

> **Esta frase se escribió antes que la columna, y hasta la FASE 9-bis-4 no se podía evaluar.**
> `requiere_conciliación` era un booleano: decía *«hay un caso»* y no *«desde cuándo»*, así que
> *«pasado su plazo»* no tenía contra qué medirse. Hoy es `puesta_en`, **por marca y no por fila**
> (`B/02` §2.2 y §2.5), que es lo que ~~hace que el plazo pueda ser distinto según el motivo~~
> permite medir el plazo por marca. **El plazo es uno solo, el 17 de la lista cerrada, para todos
> los motivos** (FASE 9 vuelta 3, owner 2026-09-30, lote R; verificación, VC3-cobro-08): un plazo
> por motivo sería otro plazo de la lista cerrada, y lo decide el owner. ~~— un
> `REEMBOLSO_POR_CONFIRMAR` tiene plata del cliente parada y un `TRANSICIÓN_NO_DECLARADA` no.
> **El ejemplo era `PAGO_TARDÍO_RECHAZADO` y se cambió porque dejó de ser cierto**: ese motivo
> lleva `SÍ` desde que se recorrieron sus cuatro condiciones (`B/02` §2.5), así que tiene plata
> parada igual que el 1 y el plazo corto le corresponde a él también.~~
> Lo que cambió no es el enunciado sino contra qué se lee.

---

## 4. «¿Cobró?» se lee cobro por cobro, y el contador sólo dice si ya están todos

> **Reescrito el 2026-09-24 (FASE 9-bis-5, familia 6, crítico `F-8fB3-001`).** La versión anterior
> se titulaba *«Los tres modos de «cero cobros»»* y resolvía *«no cobró nunca»* con *«el preapproval
> tiene `charged_quantity` en cero o nulo»*, y concluía que la conciliación *«concluye desde el
> contador del preapproval»*. **`RC-5` la volvió falsa**: sobre `792eb0064a…`, cuyo único cobro se
> rechazó, el contador quedó en **1** y la regla decía **«sí cobró»** sobre alguien que no pagó un
> peso. Y la otra mitad —*«usa el endpoint para traer el detalle»*— se apoyaba en el `status` del
> registro, que **`RC-6` midió que no dice si se cobró**. Las dos mitades estaban medidas como no
> aptas.

**Qué es cada cosa, medido.** El proveedor lleva **un registro por ciclo cobrado o intentado**
(`authorized_payment`), y **los reintentos de ese ciclo quedan adentro del mismo registro**: el
rechazo del 22/09 de los sujetos de `RN-3` es **un** registro con `retry_attempt: 4`, no cuatro.
Y **`charged_quantity` cuenta esos registros**, no los cobros: el 2026-09-24, sobre los cuatro
sujetos de producción que había, **5 contra 5, 5 contra 5, 7 contra 7 y 2 contra 2** (manifiesto
de `RN-3`, fuera del repo, y la lectura de la sonda 49). Por eso contaba el rechazo como un cobro
más: el rechazo **es** un registro.

**De dónde sale cada respuesta:**

| pregunta | se lee de | NO se lee de |
|---|---|---|
| **¿qué intentos hubo?** | el listado `GET /authorized_payments/search?preapproval_id=` —filtra bien por ese campo (`EX-16`)—, que da los ids | — |
| **¿cobró ese intento?** | **`payment.status` = `approved`** del registro, **leído por id** con `GET /authorized_payments/{id}` (`EX-16`, invariante `D17`) | el **`status`** del registro —`scheduled`, `recycling`, `processed` dicen **en qué etapa está**, no el resultado (`RC-6`)—; el **`status_detail`** leído temprano —es el del **último** intento y cambia entre reintentos (`RC-6`)—; **`charged_quantity`** (`RC-5`); **`last_charged_date`**, que **se mueve con un cobro rechazado** (medido el 2026-09-24 sobre dos sujetos) |
| **¿están todos los intentos?** | **`charged_quantity` del preapproval contra la cantidad de registros listados**: el contador se actualiza **antes** que el listado (medido: a las 21:33 decía `1` y el listado devolvía `0`; minutos después, `1`) | — |

**Con eso, los modos de «cero cobros» son cuatro, y el que faltaba es el de `RC-5`:**

| lo que se ve | qué es |
|---|---|
| contador en cero o nulo, listado vacío | **no hubo ningún intento**: no cobró nunca |
| contador **igual** a los registros listados, y **ninguno** con `payment.status` = `approved` | **intentó y se rechazó**: no cobró |
| contador **mayor** que los registros listados | **lag**: hay un intento que el listado todavía no indexó — **no se sabe todavía** |
| la lectura por id del preapproval falla | **el id es de otra cuenta** |
| **un registro que el listado devuelve y cuya lectura por id da `404`** (`EX-55`: el alta que el proveedor canceló al rechazar el primer cobro) | **se contesta con el pago que el listado nombra, leído por id** con `GET /v1/payments/{id}` —que en producción se lee por id (`RF-3`)—: `approved` es *«cobró»*, cualquier otro estado es *«intentó y se rechazó»*, y esa lectura es la que dispara `S16`. **No es una lectura fallida de la corrida**; si el listado no nombra pago, o esa lectura también falla, sí lo es (FASE 9 vuelta 3, `F-8V3B3-005`) |

**La regla:**

- **«Cobró» sólo si hay un registro del período con `payment.status` = `approved`, leído por id.**
- **«No cobró» sólo si el inventario está completo** —contador igual a registros listados— **y
  ninguno está aprobado.**
- **Cualquier otra cosa es «todavía no se sabe»**, y no es una divergencia: se relee en la corrida
  siguiente. Quien consulta este § y necesita una respuesta para actuar —`S6`, que antes de
  suspender pregunta si cobró— **trata «todavía no se sabe» como una lectura fallida y no actúa en
  esa corrida** (`B/03` §3.2).

**`charged_amount` no decide, pero sirve para verificar a mano**: sumó exactamente los aprobados
en los cinco sujetos medidos —`0` con un único rechazo (`RC-5`), `75` sobre cinco cobros de 15 más
un rechazo, y el 2026-09-24 `45`, `60` y `90`, siempre la suma de los `approved`—. No se usa como
regla porque **no se midió cuándo se actualiza** respecto del listado, y un campo cuyo instante no
conocemos no puede cerrar una pregunta de plata.

---

## 5. El bug vivo que pasa a ser caso de uso

Hay un error real en producción —webhooks de suscripción que fallan porque el preapproval no
resuelve a ninguna suscripción nuestra, la API responde `500` y los encola hasta cinco veces—
registrado durante FASE 1C y **no tocado**, porque el §4 prohíbe tocar código productivo.

**Ese error es exactamente el detector de §2.2 funcionando.** El sistema detecta la huérfana
bien; lo que está mal es lo que hace después. **Cuando se arregle, no debe silenciarse: tiene que
convertirse en el disparador de la re-vinculación.**

> Esto aparece acá como **modo de falla ya observado**, no como razón de diseño: la forma de la
> conciliación la fija `DEC-CONC-002`, no este incidente.

**Y se volvió a ver en producción el 2026-09-28** (mediciones del 2026-09-29, punto 9): un aviso de
registro de cobro sobre `80a633be…`, un preapproval que el proveedor había cancelado por antifraude
días antes, rechazado *«para forzar un reintento»*. Sobre un preapproval así el reintento nunca va a
encontrar la suscripción, y cada entrega fallida alimenta los reintentos y la supersesión del
proveedor (`WH-4`, `WH-5`). **En el diseño nuevo el disparador no es un error**: el receptor
escribe la lápida de recepción y su marca (§2.4) y contesta `200` (`B/03` §10.1). **El receptor de
hoy no se arregla aparte**: sigue forzando esos reintentos hasta el corte, en que desaparece, y no
se abre un issue para él (mediciones del 2026-09-29, lote L-D).

---

## 6. Dos límites que no se pueden correr

1. **Más allá de doce meses, la única fuente somos nosotros.** La documentación del proveedor
   dice que su buscador de pagos cubre sólo los últimos doce meses. El histórico es nuestro o no
   existe — y eso alcanza al histórico de reembolsos (`DEC-RF-001`).
2. **El cobro del proveedor llega tarde y el retraso es variable**: ~33 minutos en una renovación
   de sandbox, ~26 en producción, ~100 segundos en un alta. **El barrido no puede tratar como
   divergencia un cobro que todavía no apareció**, y por eso su ventana de tolerancia se fija
   contra el retraso medido, no contra la fecha nominal. **Y el retraso tiene forma, medida el
   2026-09-24 en producción**: el proveedor cobra en **lotes al minuto `:02`**, en el primero
   posterior a la hora de la fecha —trece renovaciones con fecha 13:13-13:28 `-04` entraron a las
   14:01-14:02, y una con fecha 17:43 entró a las 18:02—. **No está medido que los lotes corran
   todas las horas.** Con la regla del §4 esto ya no produce falsos positivos —un cobro que no llegó
   al listado es *«todavía no se sabe»*, no *«no cobró»*—, así que la tolerancia deja de ser la que
   sostiene la corrección y pasa a ser sólo cuántas corridas se espera antes de mirarlo.

   **Fijado por el owner el 2026-09-24: una corrida** —**precisado el 2026-09-25 a TIEMPO: más de
   un día después del `date_created` del registro de cobro**, que el registro ya trae, así que no
   hace falta contar corridas ni guardar nada—. Si un cobro sigue en *«todavía no se sabe»*
   en la corrida **siguiente** —o sea, más de un día después—, **se avisa** por el canal de
   `DEC-OBS-001` (listado accionable y correo agregado, como un tipo más del resumen), ~~**sin abrir
   una marca**: no hay plata divergente que resolver todavía, sólo un dato que el proveedor no
   terminó de publicar~~ todavía sin marca. El desfase medido es de **minutos**, así que un día de espera no debería
   producir falsas alarmas; lo que avisa es un caso trabado. **El barrido sigue releyéndolo** cada
   corrida hasta que se resuelva, igual que a una fila marcada (§3).

   **Y a los 3 días, marca** (owner 2026-09-25; FASE 9 completa, decisión 3d, `F-8CB3-004`): si
   pasaron 3 días desde el `date_created` del registro de cobro y la lectura sigue en *«todavía no
   se sabe»*, el barrido **abre la marca con motivo `COBRO_DEL_PERÍODO_SIN_RESOLVER`** (`B/02` §2.5,
   motivo 21), que entra al listado accionable y escala por `puesta_en`. Es el mismo plazo que
   `CANCELACIÓN_SIN_CONFIRMAR` y la misma forma: reintentar y, a los 3 días, marcar. Mientras
   tanto `S6` no corre (`B/03` §3.2), así que sin esta cota la fila tenía servicio completo sin
   cobrar mientras durara el desfase, sin nadie obligado a mirarla. Abierta la marca, el barrido
   sigue releyendo por la salvedad 2 del §3 y la resuelve una persona por `S15`.

---

## 7. Frecuencia y orden

| proceso | cuándo | por qué esa frecuencia |
|---|---|---|
| **detección por webhook** | continua | es el camino principal (§2.2) |
| **barrido de la cartera** | **diario** | es lo que `DEC-CONC-002` fijó, y alcanza para lo que diverge en silencio: un monto mal aplicado cuesta un ciclo, no un día |
| **barrido de creaciones sin respuesta** | **cada pocos minutos** | es el estado intermedio de `DEC-CONC-001`: una creación que quedó sin respuesta puede haber cobrado, y ahí el tiempo sí importa. **Busca filtrando en el proveedor SÓLO por `payer_email`**, **sin filtro de estado**, y clasifica lo que vuelve de nuestro lado: el filtro `status` del proveedor devuelve un subconjunto en producción (`RC-1`; `B/05` §1.2; FASE 8 completa, `F-8CB3-011`, `F-8CB2-014`, `F-8CB1-014`). **Si encuentra un preapproval `pending`, se reusa en vez de crear otro**, como la vigente de `B/03` §3.4 punto 4 (FASE 8 completa, pendiente 6, owner 2026-09-25), **sólo si su `external_reference` nombra esta fila**: el que nombra otra fila nuestra es de la búsqueda de ésa, y el que no nombra ninguna no se reusa nunca. **Si hay más de uno que nombra esta fila**, se reusa el de `date_created` más reciente y los otros se cancelan con la regla de relectura de `S17` y **sin** correo, porque no es una baja: un `pending` no cobró nada. **Tras una búsqueda vacía**, la corrida siguiente vuelve a crear, con una clave nueva acuñada y persistida antes de llamar (`B/05` §1.1). **Mientras la fila siga en `PENDING_AUTHORIZATION`**, el barrido sigue buscando por su `payer_email` y cancela así todo `pending` que la nombre y no sea su vínculo: es la creación perdida que apareció tarde (FASE 9 vuelta 1, R12, `F-8V1B2-007`, `F-8V1B2-008`). La regla *«no se crea otra»* de `B/03` §3.4 punto 4 no cambia: la creación nueva es de **la misma fila**, y el candado `A` sigue rechazando una segunda fila. **Una búsqueda vacía no prueba que no exista**: la completitud del filtro por `payer_email` en producción no está medida |

**Toda búsqueda ~~por `search`~~ de suscripciones (`/preapproval/search`) en este diseño filtra sólo por `payer_email`** (FASE 8 completa,
`F-8CB3-011`, `F-8CB2-014`, `F-8CB1-014`), **salvo el recorrido sin filtro del censo del corte**
(`16-fase-7…` §4.2), que no filtra nada. **El listado de registros de cobro
(`/authorized_payments/search`) filtra por `preapproval_id`**, que `EX-16` mide como filtro (§4)
(FASE 9 completa, C-R7-2: la regla tenía dos excepciones en el propio corpus). Es el único filtro que la matriz mide como filtro
(`RC-1`: basura → 0); `external_reference` se ignora y `status` devuelve **un subconjunto
plausible**, que es el peor de los tres modos del §1. El estado se filtra sobre lo que vuelve, y la
fuente de verdad de todo lo demás sigue siendo la lectura por id (§2.1).

**Los dos barridos son idempotentes**: correrlos dos veces no produce nada distinto, porque
ninguno escribe salvo la reparación de vínculo del §2.4 **y, el de la cartera, la cancelación
nuestra todavía sin confirmar de las salvedades 1 y 4 del §3** —y la de la `CANCEL_SCHEDULED` de
`S11` ~~y `S26`~~— (FASE 8 completa, `F-8CB1-013`, owner 2026-09-25), **y, el de creaciones, la
cancelación de un `pending` duplicado que nombra la fila** —sin plata y sin estado, con la regla de
relectura de `S17`— (FASE 9 vuelta 1, R12). La cancelación sale con la regla
de relectura de `S17` —si la relectura ya ve el preapproval `cancelled`, no se manda nada—, así que
una segunda corrida no la repite sobre un preapproval ya cancelado. ~~**Lo que sí se repite en cada
corrida que reintenta es el correo de antes**: ver *«lo que este capítulo NO cierra»*.~~ **El correo
de antes tampoco se repite**: sale una vez por cancelación y un reintento no lo vuelve a mandar si
ya se entregó (`B/03` §3.2, precisión 3; owner 2026-09-25). **Y lo que `P6` y las marcas escriben
por la comprobación de pagos acreditados** tampoco se duplica: un pago que ya está en
`CHARGED_BACK` no vuelve a pasar por `P6`, y una marca abierta del mismo motivo recibe el hecho en
vez de abrirse otra (`S14`, `B/03` §3.2).

### 7.1 La vida del barrido: si no corre, o corre a medias, se sabe por otro camino

**Todo lo que el barrido detecta depende de que el barrido corra** (FASE 8 completa,
`F-8CB3-007`): las seis comprobaciones de cero llamadas, las cuatro salvedades, el escalamiento de
las marcas, el reintento de las cancelaciones nuestras, la comprobación de pagos acreditados **y la
de órdenes pagadas** (FASE 9 vuelta 2, `R4`). Si
el job muere, o termina con la mitad de las lecturas por id fallidas, **todo eso se apaga a la vez
y en silencio** — el mismo modo de falla que el §1 le reprocha al buscador del proveedor, *«termina
en verde»*. Y el aviso no puede salir del propio barrido, porque es justamente lo que no corrió.

**Cada corrida deja un registro**: **inicio, fin, cuántas filas leyó y cuántas fallaron**. Es la
correlación de corrida que `NUCLEO/08` §2.3 ya le pide a todo job, con cuatro datos fijos. **La
correlación, el id de corrida y el huso del mercado en los jobs los agrega `U2`, el outbox común**
(FASE 5, owner 2026-09-30, lote 2 B); el reloj sigue en `B1`.
**Una corrida es completa** si tiene fin y **ninguna** fila fallida: las fallidas se releen en la
corrida siguiente (§6.2), pero una corrida que las dejó **no probó nada sobre ellas**.

**Si pasan 26 h sin una corrida completa, se avisa, y el aviso lo da otro proceso**: un vigía que
**no comparte ejecución con el barrido** ~~y lo único que hace es leer ese registro. Avisa por el
canal de `DEC-OBS-001` —el listado accionable y el correo agregado—~~. Las 26 h son el día del
barrido más un margen; **el margen no está medido**. ~~⚠️ **El corpus no tiene un monitor de crons ni
de salud que reusar**: se buscó en `NUCLEO/08` y no hay ninguno. Así que el vigía se declara como
requisito y **cómo se construye queda abierto**, con el riesgo que eso deja dicho: si el vigía
también muere, nadie avisa de ninguno de los dos.~~

**El vigía es un monitor de cron EXTERNO** (FASE 8 completa, pendiente 6, owner 2026-09-25): **el barrido le hace ping al
terminar una corrida completa**, y el monitor **alerta si pasan 26 h sin ping**. Corre fuera de
nuestra ejecución, así que no muere con el barrido. **Primer candidato: Sentry Cron Monitoring**
—Sentry ya está en el stack (`CLAUDE.md` de la raíz del repo, *«Monitoring: Sentry»*)—; **la
elección concreta queda para la FASE 10**. ⚠️ **Que el plan de Sentry contratado incluya el
monitoreo de crons no está verificado**, y **por qué canal llega la alerta** —el del monitor o el
de `DEC-OBS-001`— no está decidido. **Y tampoco entra en la excepción del correo
inmediato** de `NUCLEO/08` §4.1, que es una lista cerrada; si debería, es del owner.

**El mismo monitor vigila el reconciliador diario de cobertura de verticales** (`V/03` §9;
`DEC-ARCH-009`, owner 2026-09-25), con la misma regla: ping al terminar una corrida completa,
alerta a las 26 h sin ping. Lo que este § deja abierto del vigía vale igual para él.

**Y vigila también la batería que vigila a Mercado Pago** (`B/20` §4.1; revisión del owner,
2026-09-28, C13 y `L3-d`), con la misma regla sobre su cadencia: la batería le hace ping al terminar
una corrida completa, y el monitor alerta si pasa **una semana más un día** sin el de la cuenta de
pruebas, o **un mes más un día** sin el de producción. El día de margen es el mismo criterio de las
26 h del barrido, y **tampoco está medido**.

**Y vigila la corrida diaria que reintenta los borrados remotos de `PB9` y `PB12`** (`V/02` §4.1;
FASE 9 vuelta 3, `F-8V3A2-005`), con la regla del reconciliador: ping al terminar una corrida
completa, alerta a las 26 h sin ping. Si la elección concreta del monitor cuenta los jobs
vigilados, es uno más.

---

## Lo que este capítulo NO cierra

- ~~**`RF-3` sigue `UNKNOWN`**: qué pasa al reembolsar un pago de más de 180 días. Alcanza a la
  reparación de una divergencia vieja y es del capítulo 13.~~ **`RF-3` sigue `UNKNOWN` pero ya no
  bloquea**: `DEC-RF-007` decidió que reembolsar un cobro más viejo que el plazo del proveedor **no
  se implementa**, la reparación es manual y con rastro. El capítulo 13 no existe: se repartió
  (`nucleo/00-indice.md`).
- ~~**Las cinco filas del grace** (`RN-2`, `RN-3`, `GR-1`, `GR-2`, `GR-3`) se contestan el
  2026-09-17. Hasta entonces, **la ventana de tolerancia del §6.2 no se puede fijar para el caso
  de un cobro fallido**, porque no se sabe cuántas veces reintenta el proveedor ni en qué estado
  deja la suscripción mientras lo hace.~~ **Actualizado el 2026-09-24**: ya se sabe cuántas veces
  reintenta y en qué estado deja la suscripción —cuatro intentos dentro de **un ciclo**, y al vencer
  **pausa** (`GR-3`, sonda 49)—, y con `DEC-SUB-019` el grace cancela el preapproval antes de que
  eso pase. ~~Siguen `UNKNOWN` `RN-3`, `GR-1` y `GR-2`~~ (tachado 2026-09-26): `RN-3` salió a
  `PARTIALLY_SUPPORTED` el 25/09 noche y `GR-1` a `VERIFIED` el 26/09) **Sigue `UNKNOWN` `GR-2`**;
  ninguna bloquea este capítulo. El número que
  quedaba —cuántas corridas espera el barrido un cobro *«todavía no se sabe»*— **lo fijó el owner el
  mismo día: una** (§6.2), **y a los 3 días abre la marca con motivo `COBRO_DEL_PERÍODO_SIN_RESOLVER`**
  (§6.2; owner 2026-09-25, FASE 9 completa, 3d).
- **El pago del addon de única vez no está en el inventario de este capítulo** (corrección de
  diseño, FASE 8 completa, `F-8CB1-008`). Se cobra por `/v1/orders`, sin preapproval (`B/16` §1.4),
  y su `payment` cuelga de la instancia y no de una suscripción (`B/02` §2.3): el §2.1 arma el
  inventario de suscripciones, el §2.2 detecta huérfanas por *«un preapproval desconocido»* y el §4
  lee `authorized_payments`, así que **ninguna de las tres partes lo alcanza**. ~~Cómo se concilia una
  orden —y dónde se anota una divergencia sobre ella, si la marca cuelga de una suscripción— **no
  está escrito**.~~ **Desde la FASE 9 vuelta 2 (owner 2026-09-27, `R4`) hay una comprobación, y una
  marca que cuelga de la instancia**: la orden pagada cuya instancia terminó `ABANDONED` (§3, el
  motivo 23). **Lo que sigue sin escribir es el resto**: el pago de una instancia que llegó a
  `ACTIVE` no se relee —un contracargo o un reembolso desde el panel sobre él no lo ve nadie—. ~~**Y el mismo vacío alcanza al pago diferido de una `Preference` del sistema viejo**
  que acredita después del corte (efectivo, ticket; `16-fase-7-del-paraguas.md` §4.2, `F-8V1B3-006`):
  no trae preapproval, así que **no cae en la lápida de recepción** del §2.4 —que se escribe para
  un preapproval desconocido— **ni en ninguna marca**, y no lo ve nadie desde adentro. Declarado
  por `DEC-METH-015`: la población son las preferencias **de addon
  abiertas en los 30 minutos previos al 0b; las del cambio de plan del viejo, que no vencen, las
  vence por API la herramienta del corte en el paso 1a y las relee** (`16-fase-7-del-paraguas.md`
  §4.2, fila 1a, con la medición `EX-42` en el paso 0; owner 2026-09-26, `Y-1`; FASE 9 vuelta 1,
  `N-G4V-01`), y lo
  pagado en el viejo por lo que el corte corta se acepta y no se devuelve (owner 2026-09-26,
  `G1-4`). **Causa**: la conciliación de un pago sin preapproval no está escrita, y abrirla para una
  población acotada de una sola vez sería un mecanismo para un día (FASE 9 vuelta 1, `N-G4V-02`).~~
  **Sale la parte del corte** (FASE 5, owner 2026-09-30, simplificación del corte, S-43, S-44 y
  S-72): no se vencen por API las `Preference` del viejo ni cuenta la ventana de 30 minutos;
  quien tenga una abierta es una de las cinco cuentas, a quien el owner le pide no pagar nada en
  el viejo (`DEC-MIG-007`). El vacío de arriba, el del pago de única vez, es producto y queda.
- ~~**Dónde se cuentan las «tres corridas seguidas» del reintento de una cancelación nuestra**~~ **Cerrado el 2026-09-25**: se mide tiempo, 3 días desde la transición y 1 día desde el registro de cobro del §6.2 (§3, punto 2), y vale también para la `CANCEL_SCHEDULED` de `S11` ~~y `S26`~~ (FASE 8
  completa, `F-8CB1-013`; `S26` salió con la revisión del owner, 2026-09-28, C8).
- ~~**Qué pasa con el reintento DESPUÉS de abrir la marca.** La regla dice que a la tercera corrida
  se abre la marca y se avisa; **no dice si el barrido sigue mandando la cancelación** mientras la
  marca está abierta. La fila sigue en el barrido igual, por la salvedad 2.~~ **CERRADA** por el
  owner el 2026-09-25: **abierta la marca, el barrido deja de reintentar** (§3, *«el reintento de
  una cancelación nuestra»*, punto 2).
- ~~**El correo de antes se manda en cada corrida que reintenta**, así que el cliente puede recibir
  hasta tres *«antes de cancelar»* por la misma baja. La regla lo pide así —*«con el correo
  antes»*— y no dice si el segundo y el tercero se suprimen.~~ **CERRADA** por el owner el
  2026-09-25: **sale una vez por cancelación, antes del primer intento**, y los reintentos no lo
  repiten si ya se entregó (`B/03` §3.2, precisión 3).
- **La longitud de la ventana de la comprobación de pagos acreditados** (§3; FASE 8 completa,
  `F-8CB3-009`). Es configuración ~~y~~ **(entra a la lista cerrada de `NUCLEO/02` §1.5 con valor a
  proponer al owner; FASE 9 vuelta 3, `F-8V3B3-003`)** y
**no está medida**: ninguna fila de la matriz dice cuánto
  después de acreditado un pago puede llegarle un contracargo. Y todo el comportamiento del
  proveedor en un contracargo es **documental** (`RC-8`, `UNKNOWN`): no se puede fabricar uno a
  voluntad.
- ~~**El motivo `COBRO_SIN_REGISTRAR` mezcla dos poblaciones** (`B/02` §2.5, motivo 19; FASE 8
  completa, `F-8CB3-003`, `F-8CB1-011`): el cobro al que le faltaba el asiento y el que chocó con el
  `UNIQUE` de `covered_period`, que es un período con dos cobros. Lleva **puede** en la columna de
  la plata; si el segundo debería ser un motivo con `SÍ` —y con default en `B/19` §6— no se decidió.~~
  **Cerrado el 2026-09-25 (owner)**: el segundo es el motivo **20**, `COBRO_DUPLICADO`, con `SÍ` y
  default de devolución (`B/02` §2.5, `B/19` §6; FASE 8 completa, pendiente 6, owner 2026-09-25).
- ~~**El 19 conserva *«puede»* sin que nadie lo haya re-decidido.** Era la casilla del motivo
  mezclado; sin el segundo camino, si el cobro sin asiento debería llevar *«no»* no se decidió.~~
  **Cerrado el 2026-09-25 (orquestador, FASE 8 completa, pendiente 8)**: lleva **no** —la plata
  entró bien, falta asentarla—, y la columna se recontó entera: siete SÍ, tres puede, diez no
  (`B/02` §2.5).
- ~~**Mientras esa marca no se resuelve, `S6` puede leer «cobró» sobre un cobro sin fila** y correr
  `S5` (`B/03` §3.2): la suscripción se reactiva por un pago que todavía no está asentado. El
  asiento lo hace la persona que resuelve la marca; que `S5` espere a esa fila no está escrito.~~
  **Cerrado el 2026-09-25 (owner)**: `S5` asienta el cobro en el mismo acto —lo lee por id y corre
  `P1`, creando la fila si no existe—, y si no puede, no ocurre en esa corrida (`B/03` §3.2; FASE 8 completa, pendiente 6, owner 2026-09-25).
- ~~**El barrido de creaciones sin respuesta busca un `authorized`**, y en el modelo del checkout una
  creación deja un `pending` (`PA-1`, `EX-1`; FASE 8 completa, `F-8CB1-014`). El filtro se corrigió
  —sólo `payer_email`, estado de nuestro lado—; **qué estado se busca** no, porque eso no es una
  corrección de filtro.~~ **Cerrado el 2026-09-25 (owner)**: busca por `payer_email` sin filtro de
  estado, clasifica de nuestro lado y, si encuentra un `pending`, lo reusa (§7; FASE 8 completa, pendiente 6, owner 2026-09-25).
- **El registro de corridas del §7.1 no tiene entidad en `B/02`**~~, y **el vigía que lo lee no tiene
  mecanismo elegido**: el corpus no trae un monitor de crons que reusar~~ (FASE 8 completa,
  `F-8CB3-007`). **La mitad del vigía se cerró el 2026-09-25 (owner)**: es un monitor de cron
  externo que recibe un ping por corrida completa (§7.1; FASE 8 completa, pendiente 6, owner 2026-09-25). Siguen abiertos la
  elección concreta (FASE 10), si el plan contratado lo incluye y el canal de su alerta.
- **`COBRO_DUPLICADO` desde `P1` casi no tiene población** (FASE 9 completa, borde 1 de §R7.5.2 de
  `04`; declarado por `DEC-METH-015`). El período de un cobro del proveedor se identifica por el
  `date_created` de su registro (`B/02` §2.3), que es un instante y distinto en cada registro, así
  que el `UNIQUE` de `covered_period` sólo choca si dos cobros de la misma suscripción comparten
  registro, y eso lo resuelve antes `C6`. **Causa**: se eligió la fecha que no se mueve con un
  reintento, y ese mismo rasgo la vuelve única. Un doble cobro entre dos preapprovals de la misma
  persona sigue siendo el de la condición 3 de `B/05` §3, no éste.
- **Una fila cuya lectura por id falla siempre vuelve incompleta toda corrida** (FASE 9 completa,
  borde 2 de §R7.5.2 de `04`; declarado por `DEC-METH-015`). Es el modo *«id de otra cuenta»* del
  §4, y con él el vigía del §7.1 alerta todos los días. **Causa**: *«completa»* se definió como cero
  filas fallidas sin distinguir la falla transitoria de la permanente. Hasta que se distinga, una
  fila así se resuelve a mano antes de que la alerta pierda sentido.
- **Un `pending` duplicado que aparece recién después de `S2` queda vivo** (FASE 9 vuelta 1,
  `F-8V1B2-008`; declarado por `DEC-METH-015`). **Causa**: el barrido de creaciones deja de buscar
  cuando la fila sale de `PENDING_AUTHORIZATION` (§7), y un `pending` no vence (`EX-1`). No mueve
  plata: su enlace nunca se le mostró a nadie, porque la respuesta de esa creación se perdió. Si
  igual se autorizara y cobrara, llega como desconocido que nombra una fila vinculada:
  `PAGO_TARDÍO_RECHAZADO`, con **SÍ** (§2.4).
- **La cortesía diferida cuya sucesora cayó en `GRACE_PERIOD` sin que `S9` corriera no la ve
  nadie hasta que la fila vuelve a `ACTIVE`** (owner 2026-09-26, P1; FASE 9 vuelta 1). **Causa**:
  la sexta comprobación de cero llamadas del §3 busca la sucesora en `ACTIVE`, y se eligió no
  ensancharla porque sobre una fila en el grace `S9` no tiene `desde` y la marca no tendría acción
  posible. La población exige un proceso caído entre `S2` y `S9` —el `PUT` fallido ya deja
  `PAUSA_NO_APLICADA`—, un primer cobro antes del barrido, que se rechace y una predecesora que
  venía pagando (`DEC-SUB-022`). **Lo que deja**: si la persona no paga, `S6` la suspende, pierde
  acceso durante meses que tenía regalados, recibe avisos de mora por un período que la cortesía
  cubría, y el saldo queda diferido sin emitir —ninguno de los `motivo_cierre` de `B/02` §2.4
  describe ese desenlace ~~, igual que el de `S25` sobre una vertical discontinuada~~—. **La
  reparación**: `SUPER_ADMIN` vuelve a otorgar la cortesía cuando la fila vuelva a `ACTIVE`, el
  primer disparador de `S9`, con el mismo argumento que `DEC-GRANT-011`. Si paga en el grace, `S5`
  la devuelve a `ACTIVE` y la comprobación la levanta con su devolución.
- **La marca de la sonda del manifiesto nace proponiendo devolverle al owner su propio cobro**
  (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-p`; caso 3 de `29-fase-8-vuelta-2/12-` §5;
  declarado por `DEC-METH-015`). El cobro de una sonda enumerada en el manifiesto del corte abre
  `PAGO_TARDÍO_RECHAZADO` (§2.4), y el listado de `B/19` §6 propone devolver en toda marca de ese
  motivo, porque la propuesta no depende de nada más que el motivo (`DEC-RF-006`). **Lo que
  deja**: una propuesta que no se sigue, sobre la tarjeta del owner. **El owner la levanta sin
  devolver, y no hay motivo nuevo**: uno propio para la sonda rompía la regla de que la propuesta
  sale del motivo, por una población que es sólo del owner y se cierra con la medición. **Causa**:
  la sonda cobra por diseño mientras su medición está abierta, y el id que lo explica está en el
  manifiesto, no en la marca.
- **La orden de un addon de única vez que `A3` abandonó sin id sólo se ve si el proveedor deja
  buscarla por el identificador del pedido** (FASE 9 vuelta 3, owner 2026-09-30, lote E,
  `F-8V3B1-001`). ~~La medición está propuesta a la matriz.~~ ~~La medición es `EX-57`, `UNKNOWN`. **Si da que no se puede, ese caso queda
  sin detector**: la persona pagó, no recibió el addon y ninguna marca propone devolverle, hasta
  que reclame.~~ **El proveedor la deja buscar: `EX-57` es `VERIFIED` desde el 2026-09-30, en
  sandbox y con ventana, y la compra sin id de orden tiene detector** (§3, la comprobación de
  órdenes pagadas; residuo corregido el 2026-10-02). **Lo que queda abierto** es lo que la
  medición no cubrió: producción, que se lee sin mutar con la referencia de la primera orden real,
  y un pedido de más de 30 días, el rango máximo de la búsqueda (matriz, `EX-57`). **Causa**: `A3`
  dejó de reenviar para no crear órdenes que nadie pidió (`EX-43`, `UNKNOWN`), y sin el id de la
  orden ~~no hay otra lectura~~ **la única lectura es esa búsqueda**. Exige una respuesta perdida y un proveedor que igual creó
  y cobró la orden.
- **Dos devoluciones parciales del mismo monto sobre el mismo pago, las dos con la respuesta
  perdida**, no se pueden atar solas a su fila (sobre una orden no pasa: sus devoluciones se
  serializan y la nueva sale por resta, §3; FASE 5, owner 2026-09-30, lote 5 F) (FASE 9 vuelta 3, `F-8V3B1-004`, `F-8V3B2-003`;
  declarado por `DEC-METH-015`): el reenvío de la misma clave no trae el id (`RF-6`) y la relectura
  del pago muestra dos candidatas iguales. El barrido no elige y abre el motivo 18 con la fila
  `CONFIRMED` a la vista; la persona que lo resuelve ve las dos. **Causa**: el proveedor no
  devuelve el id en la repetición. Es de borde: exige dos parciales iguales y dos respuestas
  perdidas.
- **Si el preapproval de una fila cancelada por el proveedor tras un rechazo vuelve a leerse vivo
  pasada la ventana de relectura de la cancelación por rechazo**, la fila ya salió del barrido y
  sólo la devuelve el aviso del cobro (FASE 9 vuelta 3, owner 2026-09-30, lote K, `F-8V3B3-002`).
  **Causa**: la ventana acota la relectura en el tiempo, que es lo que el owner eligió frente a
  releer para siempre; su valor ~~, a proponer, sale de la medición de `EX-45`~~ es de 7 días al inicio,
  fijado por el owner sin medición (FASE 9 vuelta 3, owner 2026-09-30, lote R), y `EX-45` dirá si
  alcanza. **Dentro de la ventana, en cambio, el barrido manda la cancelación** (lote U, §3).
