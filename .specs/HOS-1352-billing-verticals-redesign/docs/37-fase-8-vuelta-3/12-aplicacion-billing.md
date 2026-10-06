---
title: "FASE 9 vuelta 3 · aplicación — billing"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 9
---

# FASE 9 vuelta 3 · aplicación — billing (grupo B)

Grupo B. Archivos tocados, todos de `$B`: `spec.md`, `descomposicion.md` y en `docs/` los capítulos
02, 03, 05, 06, 09, 16, 19, 21 y 22. Medido en el worktree
`hospeda-spec-hos-1352-billing-redesign`, sin commits (los hace el orquestador). No se tocó ningún
archivo de V ni de N; lo que les toca va al §4.

## 1. Qué se aplicó

### Lote E (R6: `F-8V3B2-001`, `F-8V3B1-001`, `F-8V3B1-002`, `F-8V3B1-003`)

- `A3` sólo confirma y nunca crea; con id de orden relee por id, sin id abandona sin reenviar
  (`B/03` §8). `B/03:2528` «`A3` sólo confirma, nunca crea»
- La rama sin id, que deja la instancia `ABANDONED` sin id y remite a la búsqueda del barrido.
  `B/03:2528` «Sin id de orden, `A3` ocurre sin reenviar nada»
- Identidad de la compra en `A1`, para las dos clases de cobro. `B/03:2526` «la identidad de la
  compra es `(dueño, producto, objetivo)`»
- La misma identidad es el candado del addon recurrente contra el doble clic. `B/03:2526` «en el
  recurrente es el candado contra el doble clic»
- El candado en el modelo: `UNIQUE` parcial sobre las pendientes, con el objetivo nulo comparable.
  `B/02:565` «Y `UNIQUE(dueño, producto, objetivo) WHERE estado = 'PENDING_AUTHORIZATION'`, para las
  dos clases de cobro»
- La pantalla nueva que encuentra una compra sin resolver no deja comprar otra (`B/16` §1.4).
  `B/16:112` «una pantalla nueva que encuentra una compra del mismo producto sobre el mismo objetivo
  sin»
- La declaración de `EX-41` acotada al reenvío inmediato. `B/16:96` «Eso vale para el reenvío
  inmediato, el del mismo pedido»
- La comprobación de órdenes pagadas busca también por el identificador del pedido (`B/09` §3).
  `B/09:831` «Por eso la comprobación busca también por el identificador del pedido»
- Condicionada a la medición. `B/09:836` «Que el proveedor permita buscar una orden por esa
  referencia no está medido»
- Si la medición da que no, el caso queda sin detector y declarado (`B/09`, NO cierra; el mismo
  texto está en el NO cierra de `B/16`). `B/09:1200` «La orden de un addon de única vez que `A3`
  abandonó sin id sólo se ve si el proveedor deja buscarla por el identificador del pedido»
- La fila de `EX-43` corregida: ya no condiciona `A3` (la cita a `EX-41` era de un reenvío
  inmediato). `B/06:448` «Ya no condiciona `A3`, que sólo confirma y nunca reenvía»
- La orden lleva el identificador del pedido como referencia (`B/06` §3.2), que es por donde la
  busca el barrido. `B/06:124` «La orden lleva como `external_reference` el identificador del
  pedido»
- `B/05` §1.2, la frase del reenvío de `A3`. `B/05:82` «`A3` sólo confirma, nunca reenvía»
- `spec.md`, la fila de `EX-43`. `$B/spec.md:268` «Ya no condiciona `A3`, que sólo confirma y nunca
  reenvía»
- `descomposicion.md` §2.7, la fila de `EX-43`. `$B/descomposicion.md:427` «`A3` ya no reenvía, sólo
  confirma»
- El motivo 23 (`B/02` §2.5) alcanza la orden encontrada por la búsqueda. `B/02:1035` «o, sin id de
  orden guardado, la que la búsqueda por el identificador del pedido encuentra pagada, si el
  proveedor la permite»

### Lote L (R27, `F-8V3B1-006`)

- `S36` crea `RF1` por el total del pago de cada `UNA_VEZ` que su orfandad apaga dentro de los
  10 días. `B/03:184` «esta fila crea `RF1` por el total de ese pago»
- `RF2` devuelve el pago de un `UNA_VEZ` por su orden (sonda 56, sandbox). `B/03:1844` «sobre el
  `payment` de una instancia `UNA_VEZ`, por su orden: `POST /v1/orders/{id}/refund`»
- `RF3` relee la orden. `B/03:1845` «Sobre el pago de una instancia `UNA_VEZ`, la relectura es la de
  su orden por id»
- `B/06` §3.2: el endpoint de devolución de órdenes, con lo que falta medir. `B/06:127` «Y se
  devuelve por su propio endpoint,»
- `B/22` §2.2: la revocación alcanza al addon de única vez. `B/22:126` «Y el addon de única vez
  comprado en la misma ventana también»

### Lote K (R17: `F-8V3B3-002`, y la aplicación de `F-8V3B3-004` y `F-8V3B3-005`)

- El criterio de exención: la terminal cancelada por el proveedor tras un rechazo se sigue releyendo
  durante la ventana. `B/09:208` «rechazado, recién cuando pasó la ventana de relectura de la
  cancelación por rechazo»
- Desde cuándo se cuenta, alineado con el reloj que N escribió para el plazo 16. `B/09:229` «cuenta
  desde la primera relectura que lo vio `cancelled`»
- Si vuelve `authorized` durante la ventana, la fila la lee la fila de estado; mandar la cancelación
  es pregunta abierta (§6). `B/09:234` «Si en cambio el barrido debe mandar la cancelación que `S16`
  habría mandado es pregunta abierta»
- `S16` en `B/03` §3.2. `B/03:164` «el barrido la sigue releyendo durante la ventana de relectura de
  la cancelación por rechazo»
- `EX-45` deja de estar acotada al corte, en `B/06` §11. `B/06:450` «y también esta épica: el
  criterio de exención del barrido y la salida de `S16`»
- En `spec.md`. `$B/spec.md:270` «Y también esta épica: el criterio de exención del barrido y la
  salida de `S16`»
- En `descomposicion.md` §2.7. `$B/descomposicion.md:429` «y también el criterio de exención del
  barrido, que la ventana de relectura de la cancelación por rechazo cubre mientras tanto»
- `F-8V3B3-004`: un registro sin `expire_date` cierra sólo con `processed`. `B/09:205` «Un registro
  sin `expire_date` cierra sólo con `processed`»
- `F-8V3B3-005`: el registro que da `404` por id se contesta con el pago que el listado nombra
  (`B/09` §4). `B/09:917` «un registro que el listado devuelve y cuya lectura por id da `404`»
- El residuo pasada la ventana, declarado (`B/09`, NO cierra). `B/09:1214` «Si el preapproval de una
  fila cancelada por el proveedor tras un rechazo vuelve a leerse vivo»

### Lote D (R4) en billing

- La definición de `CANCEL_SCHEDULED` (`B/03` §3.1) deja de decir dada de baja en el proveedor.
  `B/03:55` «con la baja pedida y mandada al proveedor, que la confirma recién cuando la relectura
  lo ve `cancelled`»
- La fila de `B4` con la respuesta de `puedeCobrarle` sobre la cancelación confirmada.
  `$B/descomposicion.md:128` «contesta sobre la cancelación confirmada y no sobre el estado de la
  fila»

### Lotes G, F, C y N en `B/21`

- G: el detector del titular desconocido, condicionado a la medición. `B/21:91` «Si ninguna lectura
  trae el pagador, esa persona no tiene detector»
- G, en el NO cierra. `B/21:526` «condicionado a la medición del lote G»
- F: el guion sin lo compensa; no se devuelve para nadie. `B/21:499` «No se devuelve, para nadie, y
  el trial no se presenta como compensación»
- F: el hecho del owner sobre las anuales. `B/21:114` «Hecho aportado por el owner: no hay anuales
  vivas en el sistema viejo ni las va a haber»
- C: el catálogo en la migración estructural del paso 3; el 3a sólo verifica. `B/21:159` «se carga
  en la migración estructural del paso 3, antes de la prueba del corte, como los plazos, y el 3a
  sólo lo verifica»
- N: la frase de la salvaguarda, corregida con las tres columnas que sobreviven a `U1`. `B/21:442`
  «Salvo tres columnas de `accommodations`,»

### R7 (`F-8V3B1-004`, `F-8V3B2-003`)

- `RF2`: quién reenvía (el barrido), con la misma clave, y la cita a `RF-6` corregida. `B/03:1844`
  «Una llamada sin respuesta la reenvía el barrido, con la misma clave y el mismo cuerpo»
- De dónde sale el id si el reenvío no lo trae. `B/03:1844` «así que el id sale de la relectura del
  pago»
- `B/09` §3: el reenvío antes de clasificar. `B/09:797` «Y antes de separar los dos grupos, el
  barrido reenvía las llamadas sin respuesta»
- La clasificación con una fila `CONFIRMED` sin id del mismo pago. `B/09:795` «Salvo que el mismo
  pago tenga una fila en `CONFIRMED` con una llamada sin id»

### R16 (`F-8V3B2-002`)

- `RF2` relee el pago antes de mandar. `B/03:1844` «Y antes de mandar cualquier devolución, se relee
  el pago por id»
- `RF5` gana el evento del contracargo. `B/03:1847` «o la relectura previa de `RF2` ve el pago
  contracargado»
- La comprobación relee también los `REFUNDED`, y un contracargo ahí sólo abre la marca. `B/09:747`
  «Sobre un pago `REFUNDED` no corre `P6`, que no sale de ese estado»
- El listado de `B/19` §6. `B/19:243` «Y un pago colgado que el banco ya le»
- La fila del motivo 17 en `B/02` §2.5. `B/02:1029` «Y por eso una devolución nuestra sobre ese
  mismo pago no sale»

### R9 (`F-8V3B3-006`), lado billing

- El handler no depende de `docs/mp-probes/`; de dónde lee y qué hace si falta, pregunta abierta.
  `B/09:111` «Esa carpeta es de la spec, está marcada no productiva»
- `B/06` §9. `B/06:388` «Ningún proceso de producción las lee»

### R18 (`F-8V3B3-003`), lado billing

- La ventana de pagos, citada por el nombre y el número que N le dio. `B/09:764` «el plazo 18 de la
  lista cerrada de»
- La de órdenes, la misma ventana. `B/09:816` «(el plazo 18 de `NUCLEO/02` §1.5, una sola ventana
  para las dos comprobaciones: FASE 9 vuelta 3, `F-8V3B3-003`)»
- El escalamiento. `B/09:866` ««el escalamiento de una marca abierta», el plazo 17 de»

### R26, R28, R29 y R20

- R26 (`F-8V3B1-005`): declarado, con la pregunta abierta de dónde se asienta (§6). `B/03:3030` «La
  transferencia de un pagador manual que no cae en una cuota abierta no tiene dónde»
- R28 (`F-8V3B2-004`): residuo de borde declarado en el NO cierra de `B/03`. `B/03:3019` «El espejo
  reconoce una cancelación nuestra por el correo «antes de cancelar», no por la»
- R29 (`F-8V3C1-007`), lado billing: quién re-apunta `addon_product.version_id`, alineado con la
  acción 20 que N ya escribió. `B/02:564` «Y el único que lo re-apunta es la mitad de billing de la
  acción administrativa «publicar una versión de complemento»»
- R29 en la fila de §2.10 de la descomposición. `$B/descomposicion.md:644` «y su mitad de billing es
  el único acto que re-apunta `addon_product.version_id`»
- R20 (`F-8V3C1-008`), lado billing. `$B/descomposicion.md:332` «Y `B1` no consume el simulador
  desde su arranque»

### R12

- `F-8V3B1-007`, `S11`. `B/03:159` «Sale: `S26` y `vertical_discontinuation` se retiraron con la
  revisión del owner»
- `F-8V3B1-007`, `S12`. `B/03:160` «sale con C8: la tabla ya no existe; FASE 9 vuelta 3,
  `F-8V3B1-007`»
- `F-8V3B1-007`, la fila de `B10`. `$B/descomposicion.md:134` «(sale con C8: la tabla ya no existe;
  FASE 9 vuelta 3, `F-8V3B1-007`)»
- `F-8V3B3-007` y la mitad de `F-8V3B1-007` en `B/02` §2.3 (la BAJA de `B3`). `B/02:443` «admite una
  sola marca, la del motivo 23»
- `F-8V3C2-009`, `B/21` §2.5. `B/21:187` «escribe una prueba activa, no un rastro, por cada `(dueño,
  vertical)` con una ficha `L8`»
- `F-8V3C2-009`, `B/21` §4. `B/21:425` «Verticales escribe una prueba activa por cada `(dueño,
  vertical)` con una ficha `L8`»
- `F-8V3D1-006`, `B/03` §7.1. `B/03:1938` «salió con la revisión del owner, 2026-09-28, C8: quedan
  el 1, el 2, el 3, el 5 y el 6»
- `F-8V3D1-006`, `descomposicion.md` §2.9. `$B/descomposicion.md:601` «el cuarto salió con C8: FASE
  9 vuelta 3, `F-8V3D1-006`»
- `F-8V3D1-007`, la cita en `B/02` §2.3. `B/02:402` «§2.2, que no tiene §2.4: FASE 9 vuelta 3,
  `F-8V3D1-007`»

### Unidades y criterios

- Toda comprobación, regla y plazo nuevo tiene unidad y caso en la subsección nueva.
  `$B/descomposicion.md:649` «Lo que la FASE 9 vuelta 3 agregó, y qué unidad lo construye»

## 2. Lo que no se aplicó y por qué

- **La fila de guards de billing por el lote N**: `G16`, el único guard de limpieza de billing,
  mira `@qazuor/qzpay` y los imports de `apps/`, no columnas; las tres columnas las admiten `G8`
  (de `U1`, en `V/20`) y la regla del paraguas, que escriben V y N.
- **Dónde vive el manifiesto de sondas y qué hace el handler si falta** (R9): no hay mecanismo
  existente que lo resuelva y las dos lecturas tienen daños distintos; queda en el §6.
- **Qué pasa con una fila que vuelve `authorized` en la ventana de relectura** (lote K): a la letra
  de hoy la toma la fila de estado; mandar la cancelación es la otra lectura, §6.
- **R26**: cualquier asiento nuevo es mecanismo que ninguna decisión pidió; quedó declarado en
  `B/03` NO cierra y la pregunta en el §6.
- **R28**: sin arreglo sin mecanismo (persistir la llamada de cancelación es un registro nuevo);
  declarado como residuo de borde.
- **La fecha de la segunda corrida del detector para un registro de alta sin `expire_date`**
  (`F-8V3B3-004`): el procedimiento es de `16-`; en `B/21` quedó dicho que es pregunta abierta
  (§6).
- **`F-8V3D1-007` en `NUCLEO/08`**: es de N.
- De la lista, nada más quedó sin aplicar en archivos de B.

## 3. Conteos recontados

Ninguna lista con conteo congelado de billing cambió. Recontado con `rg` sobre los archivos de B:

- motivos de la marca: 24 → 24 (`rg -o "^\| [0-9]+ ✚? ?\|" $B/docs/02-modelo-de-datos.md | wc -l`
  da 24; no se agregó ninguno: el motivo 23 amplía su productor, y R26 quedó sin motivo);
- transiciones: sin filas nuevas (`RF5` gana un evento y `S36` un efecto, en las mismas filas);
- comprobaciones de cero llamadas: 6 → 6 (la búsqueda por el identificador del pedido es parte de
  la comprobación de órdenes, que no es de cero llamadas);
- salvedades del barrido: 4 → 4;
- filas `UNKNOWN`: 12 de billing, sin cambios (las mediciones nuevas van como propuesta, §5);
- dependencias entre épicas: 11 → 11; unidades: 13 → 13;
- plazos: la lista es de N (`NUCLEO/02` §1.5, 15 → 18, recontada por N); en B no hay espejo con
  cifra (`rg -n -i "quince (plazos|valores)" $B` da cero).
- hechos de reinicio: 6 → 5 en `B/03` §7.1 y `descomposicion.md` §2.9, que es la corrección de
  `F-8V3D1-006` y no un cambio de lista.

## 4. Para otro grupo

- **N · `D/16`, línea 313** (el manifiesto de salida del 1b): hoy dice que trae, por cada id, su
  pagador (`payer_email`). Texto propuesto: *con manifiesto de salida, que trae por cada id su
  pagador si alguna lectura lo da (el `GET` devuelve `payer_email` vacío, `EX-19`; el buscador sin
  filtro y el pago asociado se miden en sandbox, lote G); si ninguna, el id va sin pagador y su
  titular no tiene detector*. Razón: lote G; `B/21` §1.3 ya lo dice así.
- **N · `D/16`, línea 246** (la pasada de sólo lectura): *lista las autorizaciones vivas con su
  pagador si la medición del lote G encuentra una lectura que lo traiga*. Razón: la misma.
- **N · `D/16` §4.2, la segunda corrida del detector**: la fecha sale del último `expire_date`, y
  un registro de alta no lo trae (`RC-7`); texto a agregar: *un registro abierto de un alta, sin
  `expire_date`, fecha la segunda corrida según la respuesta a la pregunta abierta de
  `37-fase-8-vuelta-3/12-aplicacion-billing.md` §6*. Razón: `F-8V3B3-004`.
- **N · `NUCLEO/02` §1.5, plazo 16**: coincide con lo escrito en `B/09` §3 (se cuenta desde la
  primera relectura que lo vio `cancelled`). Si N cambia el reloj, `B/09` §3 lo repite y hay que
  avisarle a B. Sin cambio propuesto.
- **N · contrato §4.1 y glosario 27 (`puedeCobrarle`)**: la fila `B4` de `$B/descomposicion.md`
  ya dice que contesta sobre la cancelación confirmada, incluida la `CANCEL_SCHEDULED` en su
  ventana de reintento, y remite al texto del núcleo. Que la redacción del contrato nombre esa
  población en esos términos. Razón: lote D.
- **N · contrato §4.1, la entrada de publicar una versión de addon**: billing escribe en `B/02`
  §2.4 que su acto re-apunta la columna y fija el precio, y nunca edita `addon_version`. Sin
  cambio propuesto; alineado con la acción 20 de `NUCLEO/08` §3.
- **N · R9 (`F-8V3C2-007`, `F-8V3C2-008`)**: si N resuelve dónde vive el manifiesto del 1b con un
  lugar que el código posea, la misma respuesta puede servir para el manifiesto de sondas del
  handler (la pregunta abierta del §6 de este registro). Razón: son la misma pregunta de dónde.
- **V**: ninguno.

## 5. Propuestas para el log y la matriz

Grepeado antes: `rg -n "EX-57|EX-58|EX-59" $D/06-mp-validation-matrix.md` da cero; la última fila
es `EX-56`. Los números son tentativos: si otro grupo propone la misma medición, se unifica en una
fila.

- **Matriz, fila nueva `EX-57`** (lote E): *¿Se puede encontrar una orden de `/v1/orders` por su
  `external_reference` sin conocer su id (una búsqueda de órdenes, o `/v1/payments/search` por la
  referencia del pago de la orden)?* Condiciona: la búsqueda por el identificador del pedido de la
  comprobación de órdenes pagadas (`B/09` §3) y el motivo 23 sin id. Estado `UNKNOWN`, sandbox y
  producción. Si da que no: la población queda sin detector (`B/09`, NO cierra). Razón: la decisión
  E manda medirlo.
- **Matriz, fila nueva `EX-58`** (lote L): *¿`POST /v1/orders/{id}/refund` exige y respeta
  `X-Idempotency-Key`, qué devuelve un reenvío con la misma clave, y la relectura de la orden
  nombra el id de cada devolución?* Evidencia parcial: sonda 56 (batería IPN del 2026-09-29),
  total sin cuerpo y parcial con monto, `201`, releídos `refunded` y `partially_refunded`. Estado
  `PARTIALLY_SUPPORTED` (el endpoint devuelve; la idempotencia y el reenvío, sin medir).
  Condiciona `RF2`/`RF3` sobre el pago de un `UNA_VEZ` (`B/03` §6.1) y la revocación del addon de
  única vez (`B/22` §2.2). Razón: la decisión L manda confirmarlo en sandbox.
- **Matriz, fila nueva `EX-59`** (lote G, si N no la propone ya): *¿Alguna lectura trae el
  pagador de un preapproval creado por el link público de un plan: el buscador sin filtro, o el
  pago asociado por `/v1/payments/{id}`?* Condiciona el detector del titular desconocido
  (`B/21` §1.3 y NO cierra; `D/16` §4.2). Razón: la decisión G.
- **Matriz, 📌 en `RF-7`** (texto que la batería IPN ya propuso y no entró): *2026-09-29 (batería
  IPN, sonda 56), la Orders API en sandbox: un reembolso total y uno parcial de órdenes
  (`POST /v1/orders/{id}/refund`, `201`) no produjeron ninguna entrega por ningún canal*. Razón:
  `B/16` §1.4 ya lo afirma citando `RF-7`.
- **Log**: ninguna. Las decisiones E, K y L del owner se aplican sin precisar un `DEC-` existente
  que lo pida con su texto; si el orquestador quiere 📌 en `DEC-ADDON-001` (el `UNA_VEZ` se
  devuelve en la revocación dentro de los 10 días), el texto es: *📌 precisada el 2026-09-30, con
  OK del owner (FASE 9 vuelta 3, lote L): el addon de única vez comprado dentro de la ventana de
  revocación se devuelve por `RF1`, creado por `S36`; fuera de ella se consume.*

## 6. Preguntas abiertas

1. **Qué pasa con una fila que el proveedor canceló tras un rechazo si vuelve `authorized`
   dentro de la ventana de relectura** (lote K).
   - Lectura A: la regla de hoy, la fila de estado la pone delante de una persona y los cobros se
     cuelgan de una marca. Daño: mientras nadie actúa, el preapproval cobra y los cobros se
     acumulan con propuesta de devolver (visible, no silencioso).
   - Lectura B: el barrido manda la cancelación que `S16` habría mandado, con la regla de la
     salvedad 4 (3 días y marca). Daño: si la persona reautorizó a propósito, se le corta algo que
     igual no le daba servicio (la fila es terminal); agrega un reintento sobre una cancelación que
     no mandamos.
   - Recomendación: B, porque la fila terminal no da servicio y todo cobro sería sin contraparte.
2. **Dónde lee el handler de producción el manifiesto de sondas y qué hace si le falta** (R9).
   - Dónde: A, una tabla que escribe quien opera el corte y borra quien cierra la medición; B, un
     archivo empaquetado con la app. Daño de A: una escritura manual en producción; de B: un
     despliegue para sacar una sonda.
   - Si falta: A, no cancela y marca (trata todo id desconocido como sonda). Daño: un desconocido
     real sigue cobrando con su marca abierta hasta que una persona actúe. B, lo trata como vacío y
     cancela. Daño: se pierde la medición abierta del owner y la marca propone devolverle su
     cobro.
   - Recomendación: tabla, y si falta, no cancelar y marcar: el daño queda a la vista.
3. **Dónde se asienta la transferencia del pagador manual que no cae en una cuota abierta** (R26).
   - Lectura A: una segunda fila de `manual_payment` del mismo período, registrada directo, que
     choca con el `UNIQUE` de `covered_period` y abre `COBRO_DUPLICADO` con ella colgada, y su
     devolución por `RF1`/`RF4`. Daño: acto nuevo del admin; no ve la de más, porque la fila no
     guarda monto.
   - Lectura B: no se asienta; el admin la devuelve por fuera, sin rastro. Daño: plata de un
     cliente sin fila, y un reclamo sin nada que mostrar.
   - Recomendación: A, porque es la simetría con la tarjeta y cuelga de un motivo que ya propone
     devolver.
4. **Con qué fecha entra a la segunda corrida del detector del corte un registro de alta sin
   `expire_date`** (`F-8V3B3-004`).
   - Lectura A: `date_created` más un ciclo, que es lo que `RC-7` mide en las renovaciones. Daño:
     no medido para altas; si el alta sigue en `recycling` después, la corrida llega antes.
   - Lectura B: esperar a que el registro se lea `processed`. Daño: la corrida no tiene fecha fija
     y alguien tiene que volver a mirar.
   - Recomendación: A, y que la segunda corrida liste igual todo registro que no esté `processed`.
5. **Dos instancias `ACTIVE` del mismo addon recurrente sobre el mismo objetivo**, compradas una
   después de resolverse la otra: la identidad de la compra no las frena. Si es recompra legítima o
   error del cliente no está decidido (declarado en `B/16`, NO cierra). Recomendación: extender el
   candado del recurrente a las instancias vivas, porque un segundo cobro mensual del mismo
   destaque sobre la misma ficha no compra nada.

## 7. Casos vecinos

- `B/19` §6, la fila del motivo 14, todavía dice que `S12` cuando su `CANCEL_SCHEDULED` lo puso
  `S26` va al 15 por `V2-n`: es el mismo texto vencido de C8 que `F-8V3B1-007` arregló en `S11` y
  `S12`. No estaba en la lista; no se tocó.
- `B/09` §3 dice que un pago de addon de única vez no entra en la marca de contracargo porque la
  marca cuelga de una suscripción: sigue cierto, pero el pago de una instancia que llegó a
  `ACTIVE` sigue sin ninguna comprobación (ya declarado).
- `B/03` §6.1, `RF4` sobre el pago de un `UNA_VEZ` corre `P3`/`P4`: con la devolución de órdenes
  medida sólo en sandbox, la persona que asienta una devolución de orden hecha desde el panel no
  tiene dónde leer el id de la devolución si la relectura de la orden no lo nombra (depende de
  `EX-58`).

## Key Learnings

1. Una clave de idempotencia protege lo que comparte su origen: el identificador de pantalla no
   alcanza a la pantalla recargada, y la identidad de la compra tiene que ser de negocio (dueño,
   producto, objetivo) y acotada a las pendientes para no impedir la recompra.
2. Un reenvío que puede crear no es una confirmación: la regla es que el barrido y `A3` sólo leen,
   y los únicos reenvíos que quedan son los que repiten algo que una persona ya decidió.
3. Antes de nombrar un plazo o una columna que otro grupo escribe, conviene leer su archivo en
   vivo: N ya había numerado los plazos 16 a 18 con otros nombres y otro reloj.
4. Los detectores que dependen de una medición sin hacer se escriben condicionados, con la rama
   sin detector declarada, en vez de afirmarlos.
