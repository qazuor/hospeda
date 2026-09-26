---
title: "FASE 8 vuelta 1 · B3 — conciliación, datos y migración"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 1 · B3 — conciliación, datos y migración

Ataqué el diseño vigente de la conciliación (`$B/docs/09-conciliacion.md`), el modelo de datos
de billing (`$B/docs/02-modelo-de-datos.md`, sobre todo §2.2, §2.3 y §2.5), la migración de
billing (`$B/docs/21-migracion.md`) y el procedimiento del corte (`$D/16-fase-7-del-paraguas.md`
§4), contrastando cada afirmación sobre el proveedor contra `$D/06-mp-validation-matrix.md`. Busqué
divergencias que nadie detecta, marcas `requiere_conciliación` sin fila donde colgarse o con un
motivo que dice lo contrario de lo que pasó, columnas que el corte tiene que llenar sin fuente, y
cobros del sistema viejo que atraviesan el corte sin asiento.

Son **7 hallazgos**: **0 CRITICA, 2 ALTA, 4 MEDIA y 1 BAJA**. La idea más grave: el único camino
automático que el diseño le da a un cobro viejo que llega tarde —abrir la marca— **no tiene fila
donde escribirse**, porque la marca y el pago cuelgan de una suscripción que ese cobro no tiene.

Regla de lectura: cada hallazgo se apoya en una cita textual, copiada literal de una sola línea del
archivo, con su `archivo:línea`. `$B` es `.specs/HOS-1354-billing-cobro-y-proveedor` y `$D` es
`.specs/HOS-1352-billing-verticals-redesign/docs`, medidos en el worktree
`hospeda-spec-hos-1352-billing-redesign`.

## ALTA

### F-8V1B3-001 — El cobro de un preapproval desconocido no tiene fila donde anotarse: la marca que el diseño le abre no se puede escribir

**Qué se rompe.** La regla de re-vinculación (owner, `2b`) manda que todo preapproval desconocido
cuyo `external_reference` no nombre una fila nuestra **abra la marca** con motivo
`TRANSICIÓN_NO_DECLARADA`. Pero `reconciliation_mark` cuelga de una suscripción y `payment` exige
una suscripción o una instancia de addon (CHECK de exactamente una no nula). El desconocido, por
definición, no tiene ninguna de las dos: ni la marca ni el pago tienen dónde escribirse. Lo único
que queda es la correlación de logs de `NUCLEO/08` §2.2, que no es el listado accionable. Y aunque
la fila existiera, el motivo 6 dice «no hay plata que devolver» y manda «decidir qué estado vale»:
el cobro viejo que llega tarde **es** plata del cliente que devolver, sin `payment` contra el cual
abrir `RF1` ni asentar `RF4`.

**El camino.**

1. Juan es uno de los tres `trialing`. El owner lo llama y el paso 1b cancela su preapproval viejo
   a las 13:35.
2. El cobro ya estaba en vuelo (el diseño lo admite: `B/05` C2). El proveedor lo procesa en el lote
   de las 14:02, unos 26 minutos después.
3. A las 13:50 se apagó el contenedor viejo para desplegar (paso 3), así que el aviso lo recibe el
   sistema nuevo. La lápida del paso 4 todavía no existe: se escribe «en la misma tanda en la que
   se habla con la gente».
4. El preapproval es desconocido y su `external_reference` es un nonce del sistema viejo, que no
   nombra ninguna fila: la regla manda abrir la marca. No hay `subscription_id` que ponerle. El
   cobro de Juan no queda en ningún listado y el barrido no lo vuelve a ver, porque su inventario
   sale de nuestra base.
5. La misma forma, sin carrera ninguna: toda sonda enumerada en el manifiesto cobra todos los meses
   la tarjeta del owner y «cae en la marca», que no existe.

**La evidencia.**

- `$B/docs/09-conciliacion.md:73`:
  «Todo otro desconocido —uno que no nombra ninguna fila, o que»
- `$B/docs/21-migracion.md:153`:
  «lápida porque su id sólo estaba en el proveedor, una sonda que siguió viva—»
- `$B/docs/02-modelo-de-datos.md:379`:
  «**no admite una marca de conciliación**, porque `reconciliation_mark` cuelga de una suscripción»
  (lo dice del pago de addon; la misma FK deja afuera al desconocido).
- `$B/docs/02-modelo-de-datos.md:326`:
  «Más un CHECK de que exactamente una de las dos referencias»
- `$B/docs/02-modelo-de-datos.md:924`:
  «decidir qué estado vale y ejecutar la transición de la tabla que lo permita (`S15`)»
- `$D/16-fase-7-del-paraguas.md:149`:
  «reconoce y la recoge, después del paso 4, la marca de la re-vinculación»
- `$D/16-fase-7-del-paraguas.md:165`:
  «una lista conocida, en la misma tanda en la que se habla con la gente.»
- `$D/16-fase-7-del-paraguas.md:134`:
  «Durante el rollout del paso 3 el contenedor viejo no atiende el webhook ni corre crons»
- `$D/16-fase-7-del-paraguas.md:131`:
  «llega como desconocida. Las enumeradas cobran la tarjeta del owner y caen en la marca por la»
- `$B/docs/09-conciliacion.md:766`:
  «de sandbox, ~26 en producción, ~100 segundos en un alta.»
- `$D/nucleo/08-auditoria-y-observabilidad.md:131`:
  «detección de una huérfana (`DEC-CONC-002`), y arranca su propia correlación»

Matriz: `GT-1` (citada en `B/05` C2) mide que cancelar frena el cobro agendado, pero no hay fila
que mida el cobro ya en vuelo. El diseño lo da por posible y construye sobre eso.

**Qué haría falta decidir o escribir.** Dónde vive un hecho del proveedor que no nombra ninguna
fila nuestra —una entidad propia para el desconocido, o una marca que no cuelgue de una
suscripción— y con qué motivo, que diga «hay plata que devolver» y deje abrir un reembolso sobre
un pago sin suscripción. Y fijar que el paso 4 corre en el mismo acto que el paso 3, no en la
tanda de llamadas. Lo segundo es de procedimiento; lo primero toca el modelo y el catálogo cerrado
de `B/02` §2.5.

### F-8V1B3-002 — La primera relectura de cada lápida manda a «asentar, no hay nada que devolver» los cobros del sistema viejo

**Qué se rompe.** La lápida vuelve al barrido por la salvedad 4, y el barrido compara «cobros del
período» leyendo los `authorized_payments` del preapproval. Una lápida no tiene período ni cobros
asentados en el sistema nuevo. Cualquier registro `approved` de ese preapproval —el cobro legítimo
del 2026-09-26 o uno en vuelo durante la ventana del corte— cumple al pie de la letra la
condición de `COBRO_SIN_REGISTRAR`. Ese motivo dice que no hay nada que devolver y manda crear el
`payment`, correr `P1`, emitir comprobante correlativo y escribir `covered_period`. Dos
implementadores lo resuelven distinto. Uno compara sólo el estado, y el cobro en vuelo queda
invisible. El otro compara también los cobros y le escribe al sistema nuevo pagos que el owner
decidió no conservar, con comprobantes que se conservan «íntegro, siempre». En los dos casos, el
cobro en vuelo, que no compra nada, se trata como plata bien cobrada.

**El camino.**

1. Juan es el compromiso 1: le cobraron el 2026-09-26 bajo el sistema viejo, suscripción
   `ed00a8fd…`.
2. En el corte se cancela su preapproval. El paso 4 le escribe la lápida.
3. En la primera corrida del barrido, la lápida entra aunque el paso 2 ya la haya visto
   `cancelled`. El listado de registros de cobro devuelve el del 26/09 `approved`, sin `payment`
   nuestro.
4. Se abre `COBRO_SIN_REGISTRAR`. La persona sigue la instrucción: crea el `payment`, corre `P1`,
   se emite un comprobante nuevo y se escribe la cobertura sobre una fila `CANCELLED`.
5. Si además hubo un cobro en vuelo en la ventana 1b–3, recibe el mismo trato: «asentarlo», con la
   columna de plata en «no». Juan pagó un mes que no va a usar, porque arranca de cero en el
   sistema nuevo, y la herramienta le dice a la persona que no hay nada que devolver.

**La evidencia.**

- `$B/docs/21-migracion.md:171`:
  «Entra al barrido aunque el paso 2 ya la haya visto `cancelled`»
- `$B/docs/09-conciliacion.md:123`:
  «ve un registro con `payment.status` = `approved` que nosotros no tenemos acreditado»
- `$B/docs/02-modelo-de-datos.md:937`:
  «asentarlo es crear la fila de `payment` en `PENDING` con el id del registro»
- `$B/docs/02-modelo-de-datos.md:937`:
  «así que no hay nada que devolver»
- `$B/docs/21-migracion.md:74`:
  «pago de su historia (la suscripción `ed00a8fd…`, compromiso 1 del §3.1)»
- `$B/docs/21-migracion.md:276`:
  «los hay desde el 2026-09-26, bajo el sistema viejo (§1.3), y»
- `$B/docs/02-modelo-de-datos.md:1124`:
  «pagos, reembolsos, comprobantes, el vínculo con el proveedor»
- `$B/docs/05-idempotencia-y-concurrencia.md:106`:
  «cobro puede estar ya en vuelo: el retraso del proveedor es»

Matriz: `EX-16` mide que el listado por `preapproval_id` filtra bien y trae todos los registros de
ese preapproval, sin acotarlos a ningún período nuestro. Por eso el del 26/09 aparece.

**Qué haría falta decidir o escribir.** Qué compara el barrido sobre una lápida: sólo estado, o
también cobros. Si también cobros, con qué corte temporal (¿sólo posteriores a la cancelación del
paso 1b?) y con qué motivo, porque «asentar» contradice `DEC-MIG-005`. Y si el cobro en vuelo de
la ventana se devuelve o no, que es una decisión del owner que `DEC-MIG-005` no tomó: resignó la
diferencia de la rama de aborto, no el cobro en vuelo del corte que sale bien.

## MEDIA

### F-8V1B3-003 — La lápida es una `subscription` con columnas que el corte no tiene de dónde sacar

**Qué se rompe.** La lápida se escribe como una `subscription` en `CANCELLED` con su
`provider_link`. Esa entidad lleva `user`, vertical, versión de plan anclada, billing option y la
fecha de primer cobro «que el proveedor confirmó». El corte declara que no lee las tablas viejas:
los ids salen del proveedor. Pero el proveedor no devuelve el correo del pagador por id, el
`external_reference` viejo es un nonce, y el plan viejo no existe en el catálogo nuevo. Ninguna
unidad de trabajo es dueña de esta escritura, así que cada implementador llena esas columnas a su
manera o no escribe la lápida.

**El camino.**

1. El paso 1b cancela el preapproval de Juan y el `f6d89f71…` que sólo estaba en el proveedor.
2. En el paso 4, quien siembra las lápidas necesita el `user_id` de cada uno. Ya no puede leer las
   tablas viejas (`2a`: «no queda nada que leer»), y el `GET` le devuelve `payer_email` vacío.
3. O la lápida se escribe con un usuario inventado o nulo, o no se escribe. Si no se escribe, el
   cobro tardío de Juan cae en F-8V1B3-001.

**La evidencia.**

- `$B/docs/21-migracion.md:129`:
  «El compromiso viejo se conserva como una `subscription` en `CANCELLED` con su `provider_link`,»
- `$B/docs/02-modelo-de-datos.md:47`:
  «`user`, vertical, versión de plan anclada, billing option, estado,»
- `$B/docs/02-modelo-de-datos.md:270`:
  «La fecha de primer cobro que se guarda es LA QUE EL PROVEEDOR CONFIRMÓ, no la que mandamos.»
- `$B/docs/21-migracion.md:286`:
  «los ids que cancela salen del proveedor»
- `$D/01-decision-log.md:5682`:
  «tablas; con el punto 3 no queda nada que leer.»
- `$D/06-mp-validation-matrix.md:333` (`EX-19`):
  «y el `GET` lo devuelve **vacío**, nunca el mail real»
- `apps/api/src/services/subscription-checkout.service.ts:928`:
  «HOS-209: stamp the per-checkout nonce as external_reference on the hosted»
- `$B/descomposicion.md:765`:
  «el resto, el corte del paraguas, es de `D/16` §4.2»
- `$B/docs/21-migracion.md:177`:
  «La lápida es la única fila `CANCELLED` de todo el sistema que ninguna transición produce»

**Qué haría falta decidir o escribir.** Qué columnas de `subscription` admiten nulo en una lápida,
o de dónde salen su usuario, su vertical y su versión de plan. Si salen de las tablas viejas, ese
paso tiene que correr antes de retirarlas, y `DEC-MIG-005` punto 1 deja de ser cierto. Y quién
construye y prueba esa escritura, que hoy no es de ninguna unidad.

### F-8V1B3-004 — La precondición de la re-vinculación se apoya en dos cosas que el modelo no define

**Qué se rompe.** «Nombra una fila nuestra que no tenga otro `provider_link` vivo» necesita dos
cosas. La primera es saber qué valor lleva el `external_reference` de un preapproval nuevo: ningún
capítulo lo fija. `B/09` y `B/21` sólo dicen que «nace con nuestro `external_reference`». La
segunda es saber qué es un `provider_link` «vivo»: la entidad no tiene estado, y ningún `UNIQUE`
acota cuántos vínculos tiene una suscripción. Un implementador pone el id de la suscripción, otro
el del usuario, y otro reusa el nonce del código actual si la FASE 5 decide reutilizar el checkout.
Con el nonce, toda huérfana legítima termina en una persona. Con el usuario, «fila nuestra» deja
de identificar un compromiso, y el emparejamiento por persona que la regla vino a cerrar vuelve.
Tampoco está escrito qué lee el barrido cuando una suscripción queda con dos vínculos después de
una re-vinculación.

**El camino.**

1. Juan contrata. La respuesta de la creación se pierde, y el barrido de creaciones reusa el
   `pending` P1 y lo vincula a su fila X.
2. Un reintento dejó otro preapproval, P2, que Juan termina autorizando. P2 llega desconocido,
   nombrando a X.
3. Con «vivo» igual a «fila viva», X tiene un vínculo vivo (P1) y va a persona. Con «vivo» igual a
   «preapproval no cancelado», también va a persona. Pero si P1 ya estaba `cancelled`, la segunda
   lectura re-vincula P2 a X y X queda con dos ids. Qué id relee el barrido no está escrito.

**La evidencia.**

- `$B/docs/09-conciliacion.md:72`:
  «se re-vincula sólo si el `external_reference` del preapproval nombra una fila nuestra que no»
- `$B/docs/09-conciliacion.md:76`:
  «sistema nuevo nace con nuestro `external_reference` (`PA-2`)»
- `$B/docs/02-modelo-de-datos.md:51`:
  «el id del proveedor de una suscripción, cuál es el proveedor,»
- `$B/docs/09-conciliacion.md:47`:
  «Se guarda el id de cada suscripción y se leen»
- `$D/nucleo/08-auditoria-y-observabilidad.md:126`:
  «la **vía de reparación** de un vínculo roto, así que cargarlo con dos significados lo vuelve»
- `$D/06-mp-validation-matrix.md:173` (`PA-2`):
  «`external_reference` se acepta y vuelve en la respuesta y en el `GET`.»

**Qué haría falta decidir o escribir.** Qué valor exacto lleva el `external_reference` de cada
preapproval nuevo, de principal y de complemento, y a qué tabla apunta. Qué hace «vivo» a un
`provider_link`. Y si una suscripción puede tener más de un vínculo: si puede, cuál relee el
barrido; si no puede, que haya un `UNIQUE(subscription_id)`.

### F-8V1B3-005 — El gate de completitud del censo no puede ver lo único que el censo existe para encontrar

**Qué se rompe.** El censo del paso 1b sale del recorrido sin filtro porque la base no ve las
autorizaciones que nunca se vincularon. El gate del paso 2 verifica dos cosas. Una, que el conteo
iguale el `total` del mismo paginado, que no es un dato independiente del recorrido. Dos, que
aparezca todo id **conocido**. Una autorización desconocida que el recorrido omita pasa los dos
controles. La matriz ya registró que ese buscador omitió 54 filas «sin ninguna señal».

**El camino.**

1. Juan autorizó desde un link de plan viejo y su alta nunca se vinculó en la base, como pasó con
   `f6d89f71…`.
2. El recorrido sin filtro del día del corte no lo trae. Conteo y `total` coinciden, y todos los
   ids de la base y de los manifiestos aparecen.
3. El gate da verde, el preapproval de Juan sobrevive y cobra después del corte. Llega desconocido
   y cae en F-8V1B3-001.

**La evidencia.**

- `$D/16-fase-7-del-paraguas.md:122`:
  «el conteo del recorrido tiene que igualar el `total` del paginado»
- `$D/16-fase-7-del-paraguas.md:112`:
  «cuarta autorización viva que la base no conocía»
- `$D/06-mp-validation-matrix.md:275` (`RC-1`):
  «Faltan 54 y no hay ninguna señal de que falten.»

**Qué haría falta decidir o escribir.** Una segunda fuente independiente para la población
desconocida —por ejemplo, los pagos acreditados de la cuenta en una ventana, que no dependen del
buscador de preapprovals—, o declarar el residuo con su causa. Hoy el texto afirma que el control
«la vuelve condición del gate», y para los ids desconocidos no lo hace.

### F-8V1B3-006 — El corte cancela preapprovals y planes, pero no la venta de addons de única vez del sistema viejo

**Qué se rompe.** El sistema viejo vende addons de única vez con una `Preference` que dura 30
minutos. El procedimiento del corte sólo cierra `preapproval_plan` (1a) y preapprovals (1b). Una
compra que se aprueba en la ventana del despliegue llega al sistema nuevo como un pago que nadie
conoce. Las tablas viejas donde habría quedado la compra se descartan. Y el pago de única vez no
lo alcanza ninguna de las tres partes de la conciliación.

**El camino.**

1. Juan compra un destaque de 7 días a las 13:49, antes del aviso del paso 3.
2. Paga a las 13:52, con el contenedor viejo ya apagado. El aviso del pago llega al sistema nuevo
   y no nombra nada que conozca.
3. Juan pagó un addon que ningún sistema le presta, y nadie lo ve.

**La evidencia.**

- `$D/16-fase-7-del-paraguas.md:121`:
  «cancelar TODOS los preapprovals vivos de la cuenta»
- `apps/api/src/services/addon.service.ts:93`:
  «code, then creates a Preference with a 30-minute expiration window.»
- `$B/docs/21-migracion.md:281`:
  «`billing_*` entero (suscripciones, pagos, compras de addon, canjes de promo), los grants de»
- `$B/docs/09-conciliacion.md:887`:
  «así que **ninguna de las tres partes lo alcanza**»

**Qué haría falta decidir o escribir.** Un paso previo al 1a que apague el checkout de addons del
sistema viejo al menos 30 minutos antes de desplegar, o que se verifique que no hay `Preference`
abierta. Es de procedimiento, no de modelo. Lo acota la expiración de la preferencia. Qué medios
de pago acepta esa preferencia, y si alguno acredita días después, no lo medí.

## BAJA

### F-8V1B3-007 — `B/09` atribuye a `EX-15` que cancelar no emite webhook, y la matriz mide lo contrario

**Qué se rompe.** La salvedad 4 y la de addons justifican el reintento diciendo que cancelar «no
emite webhook (`EX-15`)». `EX-15` mide que cancelar **sí** notifica; lo que no notifica es mutar el
monto. La conclusión se sostiene igual: si la cancelación no se aplicó, no hay aviso de
cancelación. Pero la razón escrita es falsa contra la fuente de verdad, y alguien puede «corregir»
el barrido leyendo el aviso de cancelación como confirmación.

**El camino.** Un implementador lee la matriz y concluye que el aviso de `cancelled` sirve de
confirmación. Saca de la salvedad 4 la cancelación de Juan apenas llega ese aviso, que dispara una
relectura igual, y no hay pérdida. El riesgo es la próxima edición que se apoye en la frase.

**La evidencia.**

- `$B/docs/09-conciliacion.md:180`:
  «cancelar **no emite webhook** (`EX-15`), así que si la llamada no se aplicó»
- `$B/docs/09-conciliacion.md:274`:
  «y **mutar o cancelar no emite webhook**»
- `$D/06-mp-validation-matrix.md:335` (`EX-15`):
  «Crear, pausar, reanudar y cancelar **sí** notifican.»

**Qué haría falta decidir o escribir.** Reescribir las dos frases: el aviso de cancelación existe,
pero sólo si la cancelación se aplicó, así que su ausencia no avisa nada.

## Ataques que intenté y el diseño resistió

- **Doble cobro viejo + nuevo de una persona conocida.** Con la lápida escrita, el cobro viejo
  llega a una fila `CANCELLED` conocida y va a `COBRO_POSTERIOR_A_LA_BAJA` (motivo 2, SÍ). La
  suscripción nueva tiene su propio vínculo y la precondición `2b` le impide recibirlo.
- **La lápida ocupando el candado `A`.** `CANCELLED` no es un estado vivo, así que no bloquea el
  alta nueva de Juan.
- **Orden cancelar-antes-de-desplegar.** Está bien razonado: el código que sabe cancelar se va con
  el despliegue. Hay rama de aborto con backup, y el paso 2 relee por id (`RC-2`).
- **Divergencia de monto silenciosa (`EX-15`).** La ve la comparación del monto esperado derivado
  contra `transaction_amount` releído por id, con reintento de 3 días cuando la mutación es
  nuestra.
- **«¿Cobró?» con `charged_quantity`.** Resuelto contra `RC-5`/`RC-6`: se decide por
  `payment.status` leído por id, y lo indeterminado tiene cota de 3 días con motivo 21.
- **Marca con N cobros por ciclo.** `reconciliation_mark_payment` acumula, y `S15` no levanta una
  marca con pagos sin resolver.
- **Pago de addon de única vez fuera de la conciliación, y `COBRO_DUPLICADO` casi sin población.**
  Están declarados en el «NO cierra» de `B/09`, así que no los cuento.
- **Lo prepagado del sistema viejo, y la diferencia del aborto.** `DEC-MIG-005` decidió no
  conservar ni devolver. No lo reabro; F-8V1B3-002 sólo marca que el cobro en vuelo del corte que
  sale bien no está en esa decisión.

## Fuera de mi vector

- `B/16` «NO cierra»: un contracargo sobre el cobro de un addon periódico no dice si corre `S6`
  sobre la suscripción de complemento. Es de máquinas o addons.
- `V/21` §2.4: si los dos `permanent_grant` del owner se revocan, las cuentas quedan sin grant y
  sin trial (declarado). Le toca a quien ataque trial.
- Abortar el corte y reintentarlo cancela en el nuevo 1b los preapprovals que los clientes crearon
  por el link reactivado, que ya les cobró sin trial. El owner lo aceptó (`2d`), pero el costo se
  paga dos veces si el reintento tarda más de un ciclo.

## Key Learnings

1. Toda regla que manda «abrir la marca» hay que chequearla contra la FK de `reconciliation_mark`.
   Un hecho sin suscripción, sea un desconocido o una orden de única vez, no tiene dónde abrirla.
2. Una fila escrita a mano en el corte, como la lápida, hereda todas las comparaciones del barrido,
   incluidas las de cobros. Hay que decir cuáles le aplican.
3. «No se lee nada del sistema viejo» choca con cualquier fila nueva que necesite `user_id`: el
   proveedor no devuelve el correo del pagador por id (`EX-19`).
4. Un gate de completitud que sólo verifica ids conocidos no detecta a los desconocidos, que son
   justo la razón de hacer el censo desde el proveedor.
5. Una cita a la matriz puede tener la conclusión correcta y la razón invertida (`EX-15`). Hay que
   releer la fila, no la paráfrasis.
