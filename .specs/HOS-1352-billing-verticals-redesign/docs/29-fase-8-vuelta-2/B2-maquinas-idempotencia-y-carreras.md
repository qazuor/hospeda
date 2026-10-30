---
title: "FASE 8 vuelta 2 · B2 — máquinas, idempotencia y carreras"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 2 · B2 — máquinas, idempotencia y carreras

Ataqué las máquinas de billing de `B/03` (suscripción `S1`-`S36`, pago `P1`-`P7`, reembolso
`RF1`-`RF5`, pago manual `MP1`-`MP5`, instancia de addon `A1`-`A6`) y la regla de no-retroceso
del §10, contra los seis cruces y el pago tardío de `B/05`, el barrido y la búsqueda de creaciones
de `B/09`, el cobro de única vez de `B/16` §1.4, el contrato de reembolso de `B/06` §4.6, el
modelo de `B/02`, las reglas de lectura de `NUCLEO/03` y el outbox de `NUCLEO/07`. Recontré con
script las filas de las tablas y la lista de filas que llevan el correo antes de cancelar. Medí
todo contra el HEAD `1cccd9119d` del worktree.

Son **5 hallazgos**: **0 CRITICA, 3 ALTA, 2 MEDIA y 0 BAJA**. La idea más grave: las
transiciones que cancelan el preapproval **antes** de escribir su estado (`S6`, `S3`) pueden
perder la carrera de la concurrencia optimista contra el pago que entra; la fila queda viva con
el preapproval ya cancelado, y el espejo del §10.1 la da de baja sin marca, con el período recién
cobrado adentro.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

Ninguno.

## ALTA

### F-8V2B2-001 — `S6` y `S3` cancelan y después pierden la escritura; el espejo corta a quien pagó

**Qué se rompe.** `S6` (y también `S3`) manda la cancelación del preapproval **y recién después**
escribe su transición. Entre la llamada y la escritura, el pago que entra corre `S5` (o el
webhook de autorizada corre `S2`) y le sube la versión a la fila. La escritura de `S6` choca,
relee, ve `ACTIVE` y, como manda el §10.3, no se ejecuta. Pero la cancelación ya está aplicada en
el proveedor. `S5` no relee el preapproval: a diferencia de `S7`, no tiene rama hacia
`CANCEL_SCHEDULED`. La fila queda `ACTIVE` con un preapproval `cancelled`, y el par
`cancelled` × *«cualquier estado vivo»* del §10.1 la espeja como baja del proveedor: `CANCELLED`
en el acto, sin marca. La salvedad que el §10.1 escribió para este mismo estado intermedio (*«ya
mandó esa cancelación y todavía no escribió»*) sólo cubre la fila que sigue en `GRACE_PERIOD`.
Juan pagó el mes, tiene su `covered_period` escrito, se queda sin servicio y nadie le propone
devolverle nada.

**El camino.**

1. Juan está en `GRACE_PERIOD`. El último día le llega el aviso y cambia la tarjeta. `GR-1` midió
   que ese cambio dispara el reintento del proveedor en uno o dos minutos.
2. Corre el barrido. `S6` lee *«intentó y se rechazó»* (el reintento todavía no entró), encola el
   correo, espera a que salga y manda cancelar el preapproval.
3. En ese intervalo el proveedor aprueba el reintento. El aviso del cobro entra por la otra
   instancia: `S5` cumple las cuatro condiciones del `B/05` §3, asienta `P1` y pasa la fila a
   `ACTIVE`.
4. `S6` intenta escribir `SUSPENDED`, la versión no coincide, relee `ACTIVE` y no escribe nada. La
   cancelación ya se aplicó.
5. Llega el aviso de `cancelled` de nuestra propia llamada, o lo ve el barrido al otro día:
   `cancelled` × `ACTIVE` sin baja programada. Se espeja la baja y la fila pasa a `CANCELLED`.
6. Juan ve su ficha despublicada al día siguiente de haber pagado. No se abre ninguna marca: el
   espejo es una transición declarada, y el cobro ya estaba asentado como bueno.

Con `S3` es el mismo camino: Juan autoriza en el último minuto de su ventana de 72 h, `S2` gana
la escritura y `S3` ya canceló. El primer cobro del checkout pago entra antes que el aviso de
`cancelled`, y el espejo corta la fila.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:361`
  — "`charged_back`, o el acto de `MP2`—. La transición se escribe después de la llamada, como ya dice"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2801`
  — "y una escritura que no coincide no reintenta a ciegas: vuelve a leer y reevalúa la"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:90`
  — "Si el pago se acredita primero, la transición `GRACE_PERIOD → SUSPENDED` ya no corresponde"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:151`
  — "se apaga el reloj. Y cuando corre porque la relectura de `S6` mostró que el período cobró"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:153`
  — "o `CANCEL_SCHEDULED` si el cobro entró sobre un preapproval que `S6` ya canceló"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2747`
  — "`S12` si hay una baja programada; si no, espejar la baja decidida por el proveedor"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2747`
  — "y salvo sobre una fila en `GRACE_PERIOD` cuyo reloj del §4 ya se agotó: eso es `S6`"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:165`
  — "el reintento en el momento, ≈1-2 min después del cambio y fuera del lote del minuto :02. Por"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1574`
  — "llegue tarde es una carrera real, no un caso teórico. Sin la relectura, el job le cancela la"

**Qué haría falta decidir o escribir.** Qué pasa con una transición que ya mandó su cancelación
y pierde la escritura: si la reevaluación del §10.3 tiene que mirar también el efecto remoto que
ya salió, o si `S5` y `S2` tienen que releer el preapproval y caer en `CANCEL_SCHEDULED` como
`S7`. Y si el espejo del §10.1 sobre una fila con un `covered_period` vigente puede cortar sin
abrir marca.

### F-8V2B2-002 — `RF3` no sabe qué devolución está mirando, y con parciales asienta de más

**Qué se rompe.** La fila de `refund` guarda un solo monto y ningún identificador de la
devolución del proveedor. Su paso a `EXECUTED` depende de que *«la relectura por id del pago
muestra la devolución acreditada»*. Pero el mismo `RF2` parte la devolución en varios parciales
con claves propias, y el pago puede traer reembolsos anteriores. Con un solo parcial acreditado
y el otro rechazado, un implementador asienta `EXECUTED` por el monto confirmado (el acumulado
del pago dice que se devolvió todo) y otro deja la fila en `CONFIRMED` o la pasa a `FAILED` por
`RF5`, que *«no mueve el pago»*. En el primer caso a Juan le falta plata y ningún detector lo ve:
la comprobación del barrido sólo mira el sentido opuesto, *«más reembolsado que nuestros
`refund`»*. En el segundo, el barrido marca como fuera del flujo una devolución que salió por el
flujo.

**El camino.**

1. Juan revoca dentro de los 10 días. `S36` crea `RF1` por el total de su último pago, 15.000.
2. Una persona confirma (`RF2`). El total da `2084`, que `RF-8` mide como errático. Se parte en
   dos parciales de 7.500, cada uno con su clave: el primero entra y el segundo vuelve a dar `2084`.
3. Llega el aviso del reembolso. La relectura del pago muestra *una* devolución acreditada.
4. La implementación A corre `RF3`: la fila pasa a `EXECUTED` con 15.000, corre `P3`, el pago
   queda `REFUNDED` y el período se libera. Juan recibió 7.500. El barrido lee 7.500 en el
   proveedor contra 15.000 nuestros, que no es *«más reembolsado»*, así que no abre nada.
5. La implementación B no corre `RF3` porque falta la mitad. El barrido lee 7.500 contra 0
   ejecutados y abre `REEMBOLSO_FUERA_DEL_FLUJO`. La persona asienta un `RF4` por 7.500 y la fila
   `CONFIRMED` sigue viva, esperando un `RF3` que después sumaría otra vez.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1855`
  — "partido en parciales que suman lo confirmado —`RF-2` midió que se acumulan—, cada uno con su propia clave"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1856`
  — "la relectura por id del pago muestra la devolución acreditada (`D17`) | `EXECUTED`"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1858`
  — "o el proveedor la rechaza sin monto que reintentar —p. ej. un cobro más viejo que su plazo"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:356`
  — "el acumulado nunca supera el monto del pago; sólo un `refund` en `EXECUTED` suma al acumulado del pago"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:668`
  — "reembolsado, o con más reembolsado que nuestros `refund`, sin que el reembolso haya pasado por nuestro flujo"
- Silencio: no hay columna ni texto que ate una fila de `refund` a la devolución del proveedor.

  ```text
  rg -n -i "id del reembolso|id de la devoluci|refund_id|id del refund|provider_refund" \
    $B $D/nucleo $D/12-contrato-de-cobertura.md
  → sin resultados
  ```

**Qué haría falta decidir o escribir.** Qué identifica a una devolución del proveedor dentro de
una fila de `refund` (o si cada parcial es su propia fila), qué monto suma `RF3` al acumulado, qué
estado toma la fila con una parte devuelta y la otra rechazada, y qué detecta el caso *«menos
devuelto que lo asentado»*.

### F-8V2B2-003 — Doble clic en un addon de única vez: dos órdenes, dos cobros

**Qué se rompe.** El §51 pide diseñar para el doble clic y `B/05` lo nombra en su primera línea,
pero ninguno de sus seis cruces lo contesta. Para la suscripción lo para el candado `A`. Para la
instancia de addon no hay candado: `addon_instance` no tiene ninguna restricción de unicidad, la
clave de `/v1/orders` se acuña por llamada, y `EX-41` mide que la orden sólo se deduplica por la
misma clave y que `external_reference` no deduplica nada. Dos pedidos, dos `A1`, dos claves, dos
órdenes y dos pagos.

**El camino.**

1. Juan compra un destaque de única vez para su ficha y, como la página tarda, aprieta dos veces
   *«pagar»*.
2. Llegan dos pedidos. Cada uno corre `A1`: nacen dos instancias en `PENDING_AUTHORIZATION`,
   porque nada lo impide.
3. Cada una acuña y persiste su propia clave (`D4`) y manda su orden.
4. El proveedor ve dos claves distintas y cobra dos veces. `A2` pasa las dos instancias a
   `ACTIVE` y `P1` asienta los dos pagos, cada uno con su comprobante.
5. El pago de única vez no admite marca ni lo ve el barrido (`B/02` §2.3), así que el cobro doble
   sólo aparece si Juan reclama.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:17`
  — "El §51 pide diseñar explícitamente para el doble clic, los reintentos, los webhooks"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:98`
  — "y el `external_reference` no deduplica nada. Así que la clave se acuña y se persiste antes de la llamada"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2533`
  — "De única vez: su propio cobro por `/v1/orders`, sin preapproval"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:522`
  — "el objetivo corresponde al ~~tipo de scope del producto~~ tipo de scope de la versión anclada"
- Silencio: el doble clic no tiene respuesta en ningún documento del alcance.

  ```text
  rg -n -i "doble clic|doble click|double.click|dos clics" $B $D/nucleo \
    $D/12-contrato-de-cobertura.md $D/16-fase-7-del-paraguas.md $V
  → sólo B/05:17, la línea que lo pide
  ```

**Qué haría falta decidir o escribir.** De dónde sale la clave de una compra de addon (del pedido
del cliente o de cada llamada), y si la instancia pendiente del mismo producto sobre el mismo
objetivo tiene candado. Recomprar un destaque puede ser legítimo, así que la respuesta no es
necesariamente un `UNIQUE`: es qué identifica *este* pedido.

## MEDIA

### F-8V2B2-004 — La orden sin respuesta «se reenvía con la misma clave», pero nadie la reenvía

**Qué se rompe.** `B/16` da por cerrada la recuperación de una orden de `/v1/orders` sin
respuesta: se reenvía con la misma clave. Pero no hay actor que lo haga. El barrido de creaciones
sin respuesta busca preapprovals por `payer_email`, y el pago de única vez no está en el
inventario de ningún barrido. Si el proceso muere entre la llamada y la respuesta, la instancia
queda en `PENDING_AUTHORIZATION` y `A3` la lleva a `ABANDONED` al vencer la ventana. La parte de
`A3` que relee al proveedor dice que no corre en la de única vez. El cobro queda hecho, sin
`payment`, sin addon y sin detector. La declaración de «lo que NO cierra» dice que la conciliación
no ve ese pago, pero da por resuelta la recuperación, que es justamente lo que falta.

**El camino.**

1. Juan compra un destaque de única vez. Se persiste la clave y se manda la orden.
2. El proveedor cobra. El contenedor que esperaba la respuesta se recicla en un despliegue antes
   de escribirla.
3. Nadie vuelve a mandar la orden con esa clave. La instancia sigue pendiente.
4. A las 72 h `A3` la abandona. Juan pagó y no tiene destaque, y ningún barrido ni marca lo
   muestra.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:98`
  — "una orden sin respuesta se recupera reenviándola con la misma clave: si ya existía, vuelve la misma"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:963`
  — "(idempotente por la clave; una orden sin respuesta se reenvía con la misma clave)"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2534`
  — "De única vez no hay preapproval y esta parte no corre"
- Silencio: ningún barrido ni transición reenvía una orden.

  ```text
  rg -n -i "reenvi|misma clave|orden sin respuesta" $B $D/nucleo $D/12-contrato-de-cobertura.md
  → B/05:74, B/16:94-98 y B/16:963 afirman el reenvío sin nombrar quién lo hace;
    B/03:1855 es la clave de los reembolsos
  ```

**Qué haría falta decidir o escribir.** Quién recorre las claves de orden persistidas sin
resultado y cuándo, y si `A3` sobre una instancia de única vez con una clave pendiente tiene que
preguntarle antes al proveedor, como hace con la recurrente.

### F-8V2B2-005 — Nadie relee un reembolso `CONFIRMED` cuyo aviso se perdió

**Qué se rompe.** `RF3` depende de una relectura del pago, y el único disparador escrito es el
aviso del proveedor. El barrido relee los pagos acreditados de la ventana, pero su tabla no tiene
fila para *«hay un `refund` `CONFIRMED` y el proveedor ya lo muestra devuelto»*: sólo sabe decir
*«sin que el reembolso haya pasado por nuestro flujo»*. Con el aviso perdido (`WH-5`), la
devolución hecha por nuestro flujo termina como `REEMBOLSO_FUERA_DEL_FLUJO`. La fila de `refund`
queda `CONFIRMED` para siempre, el período no se libera y las marcas que colgaban ese pago no se
pueden levantar, porque `S15` exige que ningún pago colgado quede sin resolver.

**El camino.**

1. A Juan le cobraron dos veces el mismo mes. `P1` abre `COBRO_DUPLICADO` con el segundo pago
   colgado.
2. Una persona propone devolver y confirma (`RF1`, `RF2`). El proveedor devuelve y el aviso no
   llega.
3. La fila queda en `CONFIRMED`. Al otro día el barrido relee el pago, lo ve devuelto, no
   encuentra un `refund` `EXECUTED` y abre `REEMBOLSO_FUERA_DEL_FLUJO`.
4. La persona que lo mira asienta un `RF4` por el monto. Ahora hay dos filas de `refund` para una
   sola devolución, y la `CONFIRMED` sigue viva, esperando un `RF3` que la sumaría otra vez al
   acumulado.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1856`
  — "la relectura por id del pago muestra la devolución acreditada (`D17`) | `EXECUTED`"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:660`
  — "el servicio sigue. Por cada `payment` en `SUCCEEDED` —o `PARTIALLY_REFUNDED`"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:668`
  — "reembolsado, o con más reembolsado que nuestros `refund`, sin que el reembolso haya pasado por nuestro flujo"
- Silencio: el barrido no nombra a los reembolsos en curso.

  ```text
  rg -n "CONFIRMED|REQUESTED" $B/docs/09-conciliacion.md $B/docs/19-superficies.md
  → sin resultados
  ```

**Qué haría falta decidir o escribir.** Quién relee un `refund` `CONFIRMED` sin aviso y cada
cuánto, y cómo distingue el barrido la devolución de un `refund` en curso de una hecha desde el
panel del proveedor.

## BAJA

Ninguno.

## Ataques que intenté y el diseño resistió

- **Doble clic en el alta de una suscripción**: el candado `A` de `B/02` §2.2 incluye
  `PENDING_AUTHORIZATION`, así que la base rechaza el segundo `INSERT` (`B/03` §3.4 punto 4).
- **El mismo id de cobro con otro estado (reintento aprobado dentro del registro)**: `C6` relee la
  fila existente y corre `P1` sobre ella, y la segunda instancia encuentra `SUCCEEDED`
  (`B/05` §2 C6, `B/03` §10.2).
- **Pago manual contra pago del proveedor por el mismo período**: el `UNIQUE` sobre
  `covered_period` excluye las dos tablas, y `P1` que llega segundo asienta y abre
  `COBRO_DUPLICADO` en vez de perder la plata (`B/05` C5, `B/03` §6).
- **`S14` colgando un pago mientras `S15` levanta la marca**: los dos escriben contra la versión de
  la marca, y el que pierde relee (`B/03` `S14`/`S15`).
- **Webhooks fuera de orden sobre el preapproval**: la `version` descarta los viejos y todo lo
  demás se relee por id (`B/03` §10.1).
- **Correo antes de cancelar que no sale nunca**: el `failed` definitivo ya no traba `S6` ni `S17`
  (`NUCLEO/07` §1.3), y el correo sale una sola vez por cancelación (`B/03` §3.2, precisión 3).
- **Envío duplicado del outbox**: al menos una vez, declarado (`NUCLEO/07`, `F-8CB2-011`, `DEC-METH-015`).
- **Suspensión escrita antes de que entre el cobro en vuelo**: `S7` relee, ve el preapproval
  `cancelled` y deja la fila en `CANCEL_SCHEDULED` con el período pagado (`B/03` `S7`). Lo que no
  resiste es el orden inverso (F-8V2B2-001).
- **Recuento de filas**: 36 filas en la tabla de suscripción, 7 en pago y 5 en reembolso; las
  filas que llevan el correo antes de cancelar son las 17 que declara el §3.2 (16 con la frase
  entera, más `S1`, que la escribe como *«el correo antes»*).

## Fuera de mi vector

- **Carrera entre la mutación de monto de `S30` y la de un downgrade pedido en el mismo ciclo**:
  las dos escriben `transaction_amount` y cada una verifica sólo lo que mandó ella. El barrido
  compara contra el monto esperado, así que hay detector. Le toca al vector de promos y precios.

## Key Learnings

1. Una transición que manda un efecto remoto **antes** de escribirse tiene dos resultados posibles
   frente a la concurrencia optimista, y el diseño sólo contempla el que gana. La que pierde deja
   un efecto remoto sin transición local que lo explique.
2. Leer una máquina de reembolso con parciales exige que cada fila sepa **qué** devolución del
   proveedor le corresponde. Sin eso, «la relectura muestra la devolución» no distingue una de
   otra.
3. Una recuperación descrita en voz pasiva («se reenvía») no está cerrada hasta que tiene un
   actor. Buscar quién la ejecuta es la forma rápida de saber si existe.
4. «Doble clic» pedido en la primera línea de un capítulo y contestado sólo para una entidad deja
   sin cubrir a las otras que cobran.
