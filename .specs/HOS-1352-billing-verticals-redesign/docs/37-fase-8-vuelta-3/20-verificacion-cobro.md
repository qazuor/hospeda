---
title: "FASE 9 vuelta 3 · verificación corta — cobro"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 9
---

# FASE 9 vuelta 3 · verificación corta: cobro

Tramo de billing y su frontera. Verifica lo que aplicaron `12-aplicacion-billing.md`,
`15-aplicacion-lotes-p-a-aa.md` (lotes R, U, V, W, X, Y, Z) y `16-aplicacion-log-y-matriz.md`
(filas `EX-57` a `EX-59`), corrido contra sus dominios. Medido en el worktree
`hospeda-spec-hos-1352-billing-redesign` sobre HEAD `c021d8c6c8`, sólo lectura salvo este informe.

## 1. Qué se verificó

| mecanismo | dominio corrido | veredicto |
|---|---|---|
| lotes D y Z: `puedeCobrarle` sobre la cancelación confirmada y `provider_link.cancelado_visto_en` | los seis estados vivos, las doce terminales de la salvedad 4, `S17`, el espejo, `S16` con y sin llamada; quién escribe la columna, quién la vacía (relectura `authorized`/`pending`/`paused`), sus tres lectores (exención, plazo 16, acción 24); contrato §4.1, glosario 27 y 12, `NUCLEO/08` §1.3 y §3, `G-R1-E`/`G-R1-F`, 📌 de `DEC-ARCH-006` con AD | **HALLAZGO** (02) |
| lotes E e Y: identidad de compra, `A3` que sólo confirma, búsqueda por el identificador del pedido (`EX-57`), candado del recurrente con uno vivo | `UNA_VEZ` y recurrente; pendiente, vivo, resuelto; objetivo `LISTING` y nulo; doble clic, pantalla recargada, recompra; `A3` con y sin id de orden; la rama «no se puede» de `EX-57` | **LIMPIO** |
| lotes K y U: ventana de relectura, suscripción revivida, motivo 2, `S16`, `EX-45`, `RC-7`, `EX-55` | `S16` sin llamada y espejo tras un rechazo; revivida `authorized`, `pending`, `paused` dentro y fuera de la ventana; reloj de los 3 días; correo antes; cobros entrados; alta sin `expire_date`; `404` por id | **HALLAZGO** (01, 09) |
| lote L: `S36` sobre el `UNA_VEZ`, `RF1`/`RF2`/`RF3` por la orden, `EX-58` | pago dentro y fuera de los 10 días; total, parcial, `2084`, reenvío, id de la devolución, contracargo previo | **HALLAZGO** (07) |
| R7: id de la devolución, reenvío con la misma clave, motivo 18 | respuesta perdida, `201`, `200` vacío, dos candidatas del mismo monto, fila `CONFIRMED` sin id | **LIMPIO** |
| R16: devolución que lee el contracargo y contracargo sobre `REFUNDED` | `RF2` con relectura previa, `RF5`, `P6` fuera de `REFUNDED`, listado de `B/19` §6, fila del motivo 17 | **LIMPIO** |
| lote W: `MP6` y los bordes declarados en `B/03` | segunda transferencia de un período pagado; transferencia sobre `CANCELLED` con su última cuota `REGISTERED`, `DECLARED_UNPAID` o sin cuota; tarjeta sin cuotas; de más dentro de una cuota abierta; `UNIQUE` de `covered_period` y de `manual_payment` | **HALLAZGO** (03, 06) |
| lote R: plazos 16 a 18 con 7/7/180 y sus espejos | `NUCLEO/02` §1.5, `D/16` paso 3, `B/09` §3 y NO cierra, `B/06` §11, `descomposicion.md` §2.7, `B/22`, el log (`DEC-DATA-008`) | **HALLAZGO** (05, 08) |
| lote V: sondas en el código, `B/06` §9, `B/09` §2.4 | `D/16` §4.2, `B/09` §2.4, `B/06` §9, unidad `B11`; «si falta» | **LIMPIO** |
| R26, R28, R29 del lado billing | R26 es el lote W; R28 declarado en el NO cierra de `B/03`; R29 contra la acción 20 de `NUCLEO/08` §3 y `B/02` §2.4 | **LIMPIO** (R26 va por 03) |
| conteos de billing | motivos 24 (y 9 con `SÍ`), transiciones vivas 34, dependencias entre épicas 12, matriz 117 = 61 · 16 · 24 · 16, con sus espejos en `$B` | **HALLAZGO** (04) |

Recuentos con script: 24 filas de motivos en `B/02` §2.5 (nueve con `SÍ`: 1, 2, 3, 7, 12, 15, 20,
23, 24); 34 filas `S` vivas en `B/03` §3.2 (tachadas `S25` a `S28`); 12 filas vivas en
`descomposicion.md` §2.6 (1 a 7, 9 a 12 y 14); `contar-filas-de-la-matriz.py` da 117 = 61 · 16 ·
24 · 16, con 15 `UNKNOWN` de billing. `$B/spec.md` y `descomposicion.md` §2.7 dicen 117;
`descomposicion.md` §2.7 lista las quince.

## 2. Hallazgos

### VC3-cobro-01 · BLOQUEA · el lote U no llegó a la tabla del §10.1 de `B/03`, que dice lo contrario

El lote U decidió que, si el proveedor revive dentro de la ventana una suscripción que canceló tras
un rechazo, el barrido manda la cancelación, sobre la fila de `S16` y sobre la del espejo, con 3
días contados desde la relectura que la vio viva. `B/09` §3 lo dice; la tabla de pares del §10.1
de `B/03`, que es la que el barrido ejecuta, no se tocó y dice otra cosa en los dos casos.

- `B/09:244` «el barrido manda la cancelación que `S16` habría mandado»
- `B/09:246` «sobre la del espejo, que la ventana sigue por igual»
- `B/09:248` «contados desde la relectura que la vio viva»
- `B/03:2767` «Una fila terminal que no está en esa lista no entra en este par»
- `B/03:2767` «un preapproval vivo sobre ella sigue siendo divergencia real, y marca»
- `B/03:2767` «recién a los 3 días de la transición que decidió la cancelación»

Caso: a Juan le rechazan el primer cobro, Mercado Pago cancela el preapproval, `S16` lo relee
`cancelled` y no manda nada. Si su preapproval lo había cancelado el espejo (una renovación
rechazada en `GRACE_PERIOD`), el día 3 vuelve `authorized`: según `B/09` el barrido cancela, y según
`B/03` §10.1 abre una marca de divergencia y no cancela. Si lo había llevado `S16`, que sí está en
la lista del par, la marca `CANCELACIÓN_SIN_CONFIRMAR` corre desde `S16` y no desde la relectura:
revivido el día 5, `B/03` la abre en la primera corrida y `B/09` le da 3 días de reintento.

Dos cabos más del mismo hueco. Primero, el lote U nombra `authorized` y `pending`, y la columna del
lote Z se vacía también con `paused`, así que un preapproval revivido en `paused` vuelve a la ventana
sin que se diga qué hace el barrido:

- `B/09:239` «durante la ventana la relectura lo ve `authorized` o `pending`»
- `B/09:271` «Una relectura posterior que lo ve `authorized`, `pending` o `paused` la vacía»

Segundo, el correo antes de esa cancelación no tiene clave. La precisión 3 la ata a la transición
que decidió la cancelación, y acá no hay transición: la decide el barrido al ver la fila viva.

- `B/09:327` «porque su ocurrencia es la transición que decidió la»

Recomendación (sin elección): un par nuevo en `B/03` §10.1, `authorized`/`paused`/`pending` sobre
una terminal de `S16` sin llamada o del espejo tras un rechazo, con `cancelado_visto_en` escrito y
dentro del plazo 16, con el veredicto del lote U: cancelar, 3 días desde esa relectura, marca 16.
Sacar de la exclusión del par el espejo tras un rechazo. Decir que `paused` entra igual, y que la
ocurrencia del correo es la relectura que vio la fila viva.

### VC3-cobro-02 · BLOQUEA · `puedeCobrarle` suelta la cancelación por rechazo que el barrido todavía no suelta

`puedeCobrarle` cuenta una terminal sólo si la canceló una llamada nuestra sin confirmar, y deja de
contar cuando una relectura la ve `cancelled`. La cancelación que el proveedor escribe tras un
rechazo (`S16` sin llamada, o el espejo) no entra nunca, ni con la columna vacía. Pero el lote K
decidió justo que esa cancelación no es definitiva hasta que pase la ventana: la exención del
barrido la sigue leyendo 7 días.

- `$D/12-contrato-de-cobertura.md:1121` «o una `CANCEL_SCHEDULED` o una fila terminal cuyo preapproval canceló una llamada nuestra que ninguna relectura vio todavía `cancelled`»
- `$D/12-contrato-de-cobertura.md:1121` «Una suscripción deja de contar cuando una relectura de su preapproval lo ve `cancelled`»
- `nucleo/01:569` «Qué relectura confirmó la cancelación lo guarda `provider_link.cancelado_visto_en`»
- `B/09:217` «rechazado, recién cuando pasó la ventana de relectura de la cancelación por rechazo»
- `B/03:166` «el barrido la sigue releyendo durante la ventana de relectura de la cancelación por rechazo»

Caso: el primer cobro de Juan se rechaza el lunes, Mercado Pago cancela, `S16` lo ve `cancelled` y
la fila queda en `CHARGE_DECLINED`. El martes Juan pide la baja de su cuenta; soporte corre la
acción 24 y `puedeCobrarle` contesta `no`, así que la cuenta se da de baja. El jueves el preapproval
vuelve `authorized` (`EX-45`, seis casos en el código actual) y cobra. El barrido cancela y propone
devolver por el motivo 2, pero la baja ya se hizo, que es lo que el paso 1 promete que no pasa:

- `nucleo/08:102` «Alcanza con que ninguna pueda cobrar»
- `nucleo/08:104` «una cuenta que se borra con una autorización viva sigue cobrando»

No se relitiga el lote D: el owner eligió «la cancelación confirmada por Mercado Pago», y el lote K
dice que, tras un rechazo, confirmada es pasada la ventana. Lo que falla es la aplicación.

Recomendación:

1. **Que cuente** (recomendada): `puedeCobrarle` contesta `sí` también por una terminal que el
   proveedor canceló tras un rechazo mientras no haya pasado el plazo 16 desde
   `cancelado_visto_en`. Cambian el contrato §4.1, la fila 27 del glosario, `NUCLEO/08` §1.3 y la
   acción 24, y un caso de `B4`. Costo: la baja espera hasta 7 días en ese caso.
2. **Declararlo**: queda en el «NO cierra» de `B/09` y del contrato, con su causa, y el cobro lo
   recupera el motivo 2. Costo: un cobro sobre una cuenta ya dada de baja, que el paso 1 dice
   evitar.

### VC3-cobro-03 · BLOQUEA · `MP6` sobre una `CANCELLED` cuya última cuota quedó impaga no choca con nada

`MP6` toma el período de la última cuota y cuenta con que el `UNIQUE` de `covered_period` choque
porque ese período ya estaba pagado. En una fila que se fue debiendo, no lo estaba: la baja desde
`GRACE_PERIOD` (`S24`) o desde `SUSPENDED` (`S23`) deja la última cuota en `DECLARED_UNPAID` por
`MP3` o `MP2`, sin cobertura.

- `B/03:1871` «con el período de la última cuota de la suscripción»
- `B/03:1871` «Intenta escribir la cobertura y choca con el `UNIQUE` de `covered_period`»
- `B/03:1868` «la cuota impaga de quien se va no queda viva»
- `B/02:1036` «el período ya tenía un cobro acreditado»

Caso: Juan, pagador manual, no paga la cuota de octubre, entra al grace y pide la baja: `S24` le
corta el servicio en el acto y `MP3` cierra la cuota en `DECLARED_UNPAID`. Una semana después
transfiere octubre. El admin la registra por `MP6`, la única puerta sin cuota abierta. El período
de octubre no tiene cobertura, la escritura no choca, la cobertura queda escrita sobre una fila
terminal y no se abre ninguna marca: Juan pagó un mes sin servicio y nada propone devolvérselo. La
confirmación del admin dice además que es un segundo pago que se propone devolver, y no lo es.
Los bordes declarados de `B/03` (de más dentro de una cuota abierta; una suscripción sin ningún
cobro ni cuota) no lo nombran:

- `B/03:3042` «Lo que queda, declarado por»

Recomendación:

1. **Motivo 2** (recomendada): sobre una fila terminal, `MP6` no escribe cobertura y cuelga el
   `manual_payment` de `COBRO_POSTERIOR_A_LA_BAJA`, que ya propone devolver. Choque o no, es lo que
   la tabla de desempate de `B/05` §3 le da a un cobro sobre una terminal, y el lote U ya lo usa así.
2. **Guarda**: `MP6` corre sólo si el período elegido tiene cobertura; si no, se declara con los
   otros dos bordes y la plata se devuelve por fuera.

### VC3-cobro-04 · MENOR · espejos de la matriz atrasados en `B/06` y en `$B/spec.md` §5.2

La matriz tiene 117 filas y 16 `UNKNOWN`, 15 de billing. `16-` §4 dejó estos espejos para el
orquestador, y `f43ad1358f` actualizó el paraguas y no éstos.

- `B/06:27` «112 filas»
- `B/06:28` «quedan catorce `UNKNOWN` y trece son de este capítulo»
- `B/06:433` «Doce de las catorce filas de 114»
- `$B/spec.md:249` «doce filas que siguen `UNKNOWN`»
- `$B/spec.md:257` «acá se listan doce»

La tabla de `B/06` §11 no tiene filas para `EX-57` ni `EX-59`; la de `$B/spec.md` §5.2 sí, y lista
catorce (falta `EX-54`, que ya se declaraba sin fila). Recomendación: 117 filas y 101 medidas en
`B/06:27`; dieciséis y quince en `B/06:28`; «Catorce de las dieciséis filas de 117» con las filas
de `EX-57` y `EX-59` en `B/06` §11; «quince» en el título de `$B/spec.md` §5.2 y «de las dieciséis,
se listan catorce» en su texto.

### VC3-cobro-05 · MENOR · quedan un «se le propone al owner» y un «propuestos a la matriz» ya decididos

El lote R fijó el plazo 16 en 7 días y el lote AB metió `EX-58` en la matriz. Tres frases siguen
diciendo que falta:

- `nucleo/02:169` «7 días (FASE 9 vuelta 3, owner 2026-09-30, lote R)»
- `B/06:452` «la medición informa el valor que se le propone al owner»
- `$B/descomposicion.md:439` «la medición informa el valor que se le propone al owner»
- `B/22:133` «un reenvío están propuestos a la matriz»

Recomendación: *«y la medición dice si los 7 días alcanzan»*, como ya escribe el NO cierra de
`B/09`; en `B/22`, *«no están medidos (`EX-58`)»*.

### VC3-cobro-06 · MENOR · la fila de `MP6` quedó con una plantilla sin llenar

Donde las demás filas dicen el origen, `MP6` dice `{W}`.

- `B/03:1871` «como una `CANCELLED` ({W}; `F-8V3B1-005`)»

Recomendación: *«FASE 9 vuelta 3, owner 2026-09-30, lote W»*.

### VC3-cobro-07 · MENOR · `EX-58` no tiene escrita la rama «no», y `RF3` sobre una orden depende de ella

`RF3` ata la devolución por los ids que nombra la relectura, y sobre un `UNA_VEZ` esa relectura es
la de la orden, que no se sabe si nombra el id (`EX-58`). `RF2` dice que la orden sigue la regla del
pago hasta medirlo, pero no qué pasa si la medición da que no. Tampoco tiene unidad: `EX-58` es
`PARTIALLY_SUPPORTED` y `descomposicion.md` §2.7 lista sólo las `UNKNOWN`.

- `B/03:1846` «hasta medirlo la fila de una orden sigue la misma regla que la de un pago»
- `B/03:1847` «las que nombran sus ids»
- `D/06:415` «Falta la parte que nombra la pregunta»

Caso: Juan revoca dentro de los 10 días y `S36` crea `RF1` por su destaque de única vez. Si la
relectura de la orden no nombra el id y el reenvío contesta vacío, `RF3` no puede ocurrir: la fila
queda en `CONFIRMED` y el barrido la relee para siempre. Recomendación: la rama «si no la nombra»
(la fila toma la devolución de la orden cuyo monto es el suyo, como ya hace con el pago cuando la
respuesta se perdió) y una unidad para la medición, probablemente `B6` o `B10`.

### VC3-cobro-08 · MENOR · el plazo 17 es uno y `B/09` §3 habla de un plazo por motivo

El lote R le dio al escalamiento un solo valor, 7 días, en una fila de la lista cerrada. El párrafo
que explica la columna sigue hablando de un plazo que cambia según el motivo, y de un «plazo corto».

- `nucleo/02:170` «el escalamiento de una marca abierta»
- `B/09:913` «que es lo que hace que el plazo pueda ser distinto según el motivo»
- `B/09:917` «el plazo corto le corresponde a él también»

Recomendación: *«que es lo que permite medir el plazo por marca»*, y sacar el «plazo corto»; si se
quiere un plazo por motivo, es otro plazo de la lista cerrada, que decide el owner.

### VC3-cobro-09 · MENOR · la fila `EX-45` de la matriz no nombra lo que el lote K le agregó

Desde el lote K, `EX-45` condiciona también la exención del barrido y la salida de `S16`, y
`B/06` §11 lo dice. La columna «para qué» de la matriz sigue nombrando sólo el corte.

- `D/06:402` «el gate del paso 2 y el cobro sobre la lápida del corte»
- `B/06:452` «y también esta épica: el criterio de exención del barrido y la salida de `S16`»

Recomendación: sumar *«y el criterio de exención del barrido y `S16`, con la ventana del plazo 16
(`B/09` §3; FASE 9 vuelta 3, lote K)»*.

## Key Learnings

1. Una decisión aplicada en el capítulo que la explica (`B/09`) no está aplicada hasta que llega
   a la tabla que se ejecuta (`B/03` §10.1): el lote U quedó en la prosa, y la tabla de pares
   seguía diciendo lo contrario.
2. Cuando una decisión nueva cambia qué quiere decir «confirmado» (lote K: tras un rechazo, recién
   pasada la ventana), hay que revisar a cada lector de esa palabra; `puedeCobrarle` se había
   escrito antes con la definición vieja.
3. Una transición que confía en que una restricción de la base «va a chocar» tiene que recorrer
   los estados en que no choca: `MP6` suponía un período pagado, y la baja desde el grace deja
   uno impago.
4. Un espejo de una cifra que no se enumera en el registro de aplicación queda atrasado aunque el
   paraguas se haya recontado: `B/06` sigue en 114.
