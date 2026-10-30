---
title: "FASE 8 vuelta 3 · B3 — conciliación, datos y migración"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 8
---

# FASE 8 vuelta 3 · B3 — conciliación, datos y migración

Ataqué la conciliación entera de `$B/docs/09-conciliacion.md` (inventario por id, huérfanas por
webhook, las cuatro salvedades y el criterio de exención de las terminales, el reintento de las
cancelaciones nuestras, las seis comprobaciones de cero llamadas, la de pagos acreditados y la de
órdenes, el §4 de «¿cobró?», el vigía), el modelo de datos de billing de `$B/docs/02-modelo-de-datos.md`
(`subscription` y sus lápidas, `provider_link`, `reconciliation_mark` y sus 24 motivos, `payment`,
`covered_period`, `provider_notification`), los plazos de `$D/nucleo/02-modelo-de-datos.md` §1.5, la
migración de `$B/docs/21-migracion.md` y el orden del corte de `$D/16-fase-7-del-paraguas.md` §4.2 y
§4.3, contrastando cada supuesto sobre Mercado Pago contra `$D/06-mp-validation-matrix.md`. Medí
contra el HEAD `923b23586b` del worktree `hospeda-spec-hos-1352-billing-redesign`.

Son **7 hallazgos**: **0 CRITICA, 3 ALTA, 3 MEDIA y 1 BAJA**. La idea más grave: el diseño apoya
dos detectores de plata en datos que nadie tiene, el correo del pagador de una autorización que la
base no conoce (que la matriz mide vacío en producción) y el plazo de escalamiento de las marcas y
la ventana de pagos y órdenes (que no están en la lista cerrada de plazos ni tienen valor), y además
lee la observación de cancelaciones que se deshacen como si sólo tocara al corte, cuando cae justo
sobre la población que el barrido exime.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

Ninguno.

## ALTA

### F-8V3B3-001 — El detector de los titulares que la base no conoce lee un correo que el proveedor devuelve vacío

**Qué se rompe.** Para el titular de una autorización viva que sólo conoce el proveedor, el corte
declara la pérdida de lo que pagó (`G1-4`) y dice que lo cubre un detector: la pasada de sólo
lectura y el manifiesto del 1b, «con su `payer_email`», que suman a esa persona al aviso previo y a
la lista de llamadas. La matriz mide en producción que la lectura por id del preapproval devuelve
`payer_email` vacío, nunca el correo real, y que ni `payer_id` identifica a la persona (`EX-56`). El
recorrido sin filtro del censo es el buscador, y que el buscador devuelva el correo no está medido
(`RC-4` enumera los campos que coinciden con el `GET` y el correo no está entre ellos). El único
dato con que el diseño pensaba encontrar a esa persona es, medido, un campo vacío: la declaración
de que la pérdida «se declara con su detector» es falsa para esta población.

**El camino.**

1. Juan se suscribió en el sistema viejo por el link público de un plan, y la base vieja nunca
   vinculó su preapproval (el caso de `f6d89f71…` del 2026-09-24).
2. Antes del aviso previo, el script recorre el proveedor sin filtro y lista las autorizaciones
   vivas; la de Juan aparece, pero su `payer_email` viene vacío (o sin medir, si viene del buscador).
3. El owner arma su lista de llamadas: Juan no tiene ficha, ni fila en la base, ni correo. No lo
   llama.
4. El 1b cancela el preapproval de Juan. Juan pierde lo que le quedaba del período pagado, sin
   aviso, y si su cobro del día del corte estaba en vuelo se asienta sobre la lápida sin marca: el
   detector del día siguiente lo lista, pero sin nadie a quien llamar.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:334`
  — "`payer_email` NO: `200` y no cambia, y el `GET` lo devuelve vacío, nunca el mail real"
- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:413`
  — "`payer_id` no es una identidad estable por mail"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:88`
  — "El manifiesto del 1b trae, por cada id, su pagador —el `payer_email` del"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:497`
  — "Detector: la pasada y el manifiesto, con su `payer_email`, que suman esas personas a la lista"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:294`
  — "que trae, por cada id, su pagador (`payer_email`)"

**Qué haría falta decidir o escribir.** De dónde sale el pagador de un id que la base no conoce si
el `GET` no lo trae: medir si el buscador sin filtro lo devuelve, o si lo trae otra lectura (el
pago embebido de un registro de cobro, `/v1/payments/{id}`), y como condición de qué paso del
corte. Y si no hay ninguna fuente, la declaración de `G1-4` para esta población tiene que decir que
no tiene detector, no que lo tiene.

### F-8V3B3-002 — Las cancelaciones que se deshacen caen sobre la población que el barrido exime, y el diseño dice que no son de esta épica

**Qué se rompe.** El criterio de exención del barrido suelta una terminal cuando «lo canceló el
proveedor» o cuando una relectura confirmó nuestra llamada, y `S16` sale de la salvedad 4 en la
primera relectura que ve `cancelled`. Las dos ramas asumen que un `cancelled` leído es definitivo.
El código actual documenta seis preapprovals **cancelados por Mercado Pago ante un rechazo de
tarjeta** que se leyeron `cancelled` en el `PUT` y en un `GET` inmediato y horas después decían
`authorized` o `pending`: es exactamente la población del espejo y de `S16` exenta. El diseño trae
esa observación como `EX-45` y la acota a «el gate del paso 2 del corte y el cobro sobre su lápida»,
«nada de esta épica». Una vez exenta, la fila sólo vuelve a verse si el aviso del cobro llega, y
`WH-5` mide que un aviso puede no llegar nunca.

**El camino.**

1. Juan contrata; su primer cobro se rechaza y Mercado Pago cancela el preapproval, como en los
   seis casos del código actual.
2. `S16` relee, ve `cancelled`, no manda ninguna llamada y la fila queda `CHARGE_DECLINED`; la
   salvedad 4 la suelta en la primera relectura, y cuando cierra el registro de cobro sale del
   barrido.
3. Horas después el preapproval vuelve a leerse `authorized`; Juan cargó otra tarjeta en su cuenta
   y Mercado Pago cobra.
4. Si el aviso de ese cobro se pierde (`WH-5`), ninguna comparación mira la fila: Juan paga todos
   los meses sin servicio y sin marca, y la fila dice `CHARGE_DECLINED`.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:199`
  — "canceló el proveedor, o nuestra llamada ya fue confirmada por una relectura"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:220`
  — "salvo cuando la relectura ya lo ve `cancelled`, que es lo medido ante el antifraude"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/06-proveedor.md:446`
  — "nada de esta épica: condiciona el gate del paso 2 del corte y el cobro sobre su lápida"
- `apps/api/src/services/billing/preapproval-recovery.service.ts:16` (código actual)
  — "`cancelled` — MercadoPago cancelled the object over a card rejection."
- `apps/api/src/services/billing/preapproval-recovery.service.ts:23` (código actual)
  — "reporting `cancelled` on both the `PUT` and an immediate `GET`, then"

**Qué haría falta decidir o escribir.** Si `EX-45` condiciona el criterio de exención de B11 (y
entonces bloquea o no esa unidad), y qué hace el barrido mientras no está medida: exigir que el
`cancelled` que exime se haya leído en dos relecturas separadas por horas, o aceptar y declarar el
residuo con su población (las terminales cuyo preapproval canceló el proveedor).

### F-8V3B3-003 — El plazo de escalamiento de las marcas y la ventana de pagos y órdenes no son de nadie ni tienen valor

**Qué se rompe.** Tres detectores de plata cuelgan de números que el diseño llama «configuración»:
el plazo tras el cual una marca abierta escala (por motivo, incluidos los nueve que devuelven plata
del cliente), la ventana de la comprobación de pagos acreditados (el respaldo del contracargo y del
reembolso hecho desde el panel) y, por remisión, la ventana de la comprobación de órdenes pagadas,
que es el **único** productor del motivo 23 (`ORDEN_PAGADA_SIN_INSTANCIA`, con **SÍ**). El núcleo
fija que todo plazo que decide cuándo pasa algo lo configura el `SUPER_ADMIN` desde una lista
**cerrada** de quince, cada uno con valor inicial y reloj; ninguno de estos tres está en esa lista
ni en la de plazos técnicos que la acompaña. No tienen valor inicial, ni pantalla, ni unidad que los
construya: un implementador pone un número fijo, otro los deja sin valor y la comprobación corre
sobre una ventana vacía.

**El camino.**

1. Juan compra un addon de única vez; `A3` abandona la instancia por un error de red, pero la orden
   se pagó.
2. El barrido tiene que releer esa orden «dentro de la misma ventana configurable de arriba»;
   nadie le dio valor a la ventana, y la unidad que lo implementó la dejó en cero (o en el día del
   barrido, antes de que el pago acredite).
3. La orden pagada de Juan nunca entra a la comprobación: no se abre el motivo 23, y nadie le
   devuelve lo que pagó por un addon que no recibió.
4. Si otra marca con plata de Juan sí se abre, «escala» pasado un plazo que tampoco existe: queda
   abierta sin cota.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:738`
  — "La ventana es un parámetro configurable, y su longitud NO está medida."
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:779`
  — "dentro de la misma ventana configurable de arriba, el barrido"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:814`
  — "abierta pasado su plazo, escala: es una divergencia de plata"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:131`
  — "cuándo pasa algo lo configura el `SUPER_ADMIN` desde el panel"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:142`
  — "La lista, cerrada. Cada mitad es dueña de sus claves, como del resto de su catálogo."
- El silencio, medido: `rg -n -i "escal|contracargo|pagos acreditados|puesta_en"
  .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md` no devuelve nada
  (exit 1).

**Qué haría falta decidir o escribir.** Si estos tres entran a la lista de §1.5 (con valor inicial,
mitad dueña y reloj) o a la de plazos técnicos (con su número escrito), qué valor tiene cada uno, y
qué hace concretamente «escalar» (a quién, por qué canal).

## MEDIA

### F-8V3B3-004 — La exención espera un `expire_date` que el registro del alta no trae

**Qué se rompe.** Una terminal sale del barrido «recién cuando cerró el registro de cobro del
último ciclo»: pasó a `processed` o venció su `expire_date`. La razón escrita es el reciclado medido
«justamente sobre preapprovals que el proveedor ya había cancelado», y `RC-6` midió `recycling`
sobre las **altas** canceladas al rechazar el primer cobro. Pero `RC-7` mide que el registro del
alta **no trae `expire_date`**: la población que motivó la condición es la única para la que su
segunda mitad no se puede evaluar. El diseño no dice qué hacer con un registro sin `expire_date`, y
lo mismo alcanza a la segunda corrida del detector del corte, que cae al día siguiente del «último
`expire_date`» de los registros abiertos.

**El camino.**

1. Juan contrata; su primer cobro se rechaza, `S16` cancela y la fila queda `CHARGE_DECLINED` con
   el registro del alta en `recycling`, sin `expire_date`.
2. Un implementador lee «no hay fecha de vencimiento» como vencida y exime la fila; otro la deja en
   el barrido para siempre.
3. Si la eximió, Juan cambia después el medio de pago en su cuenta, el reintento cobra (`GR-1`)
   y, si ese aviso se pierde, nadie compara la fila.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:201`
  — "`processed` o venció su `expire_date` (`RC-6`, `RC-7`)— (owner 2026-09-27, FASE 9 vuelta 2,"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:205`
  — "no medición (`GR-2` sigue `UNKNOWN`): el estado `recycling` se midió justamente sobre preapprovals"
- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:281`
  — "`recycling` —medido sobre las altas que el proveedor canceló al rechazar el primer cobro—"
- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:282`
  — "No aparece en el cobro del ALTA, sólo en las renovaciones"

**Qué haría falta decidir o escribir.** Qué cierra el registro de un alta sin `expire_date` (sólo
`processed`, o un plazo nuestro), y con qué fecha corre la segunda corrida del detector del corte
cuando el registro abierto es el de un alta.

### F-8V3B3-005 — Un registro que el listado devuelve y la lectura por id da `404` no tiene rama en «¿cobró?»

**Qué se rompe.** El §4 contesta «¿cobró?» leyendo el registro por id, y `S16` se dispara con «el
primer rechazo leído por id» en esa misma lectura. `EX-55` mide que el registro de un preapproval
que el proveedor canceló al rechazar el primer cobro aparece en el listado y da `404` por id. El §4
sólo nombra la falla de la lectura del **preapproval** («id de otra cuenta»); la del registro no
cae en ninguno de sus cuatro modos: no es lag (el contador coincide con el listado) ni «no cobró»
(no se leyó ninguno). La fila no avanza por `S16`, y como es una lectura fallida permanente, cada
corrida queda incompleta y el vigía alerta todos los días, que es el modo que el propio capítulo
declara que le quita sentido a la alerta.

**El camino.**

1. Juan contrata; el antifraude rechaza su primer cobro y el proveedor cancela el preapproval.
2. El barrido lista un registro y lo pide por id: `404`.
3. `S16` no corre y la fila sigue `ACTIVE`, dando servicio sin cobro; la corrida queda incompleta.
4. El vigía alerta cada día por esta fila; a la semana nadie mira la alerta, y el día que el
   barrido de verdad deja de correr, la alerta es la misma.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:412`
  — "Su `authorized_payment` aparece en `/authorized_payments/search` y da `404` por id (`EX-16`)"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:854`
  — "`payment.status` = `approved` del registro, leído por id con `GET /authorized_payments/{id}`"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:864`
  — "la lectura por id del preapproval falla"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:166`
  — "el primer rechazo leído por id en la lectura de `B/09` §4"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:1111`
  — "Una fila cuya lectura por id falla siempre vuelve incompleta toda corrida"

**Qué haría falta decidir o escribir.** Qué lee «¿cobró?» cuando el registro da `404` (el pago
embebido por `/v1/payments/{id}`, el propio listado, o una marca), y si esa falla cuenta como fila
fallida de la corrida.

### F-8V3B3-006 — El handler de producción consulta un manifiesto que vive en una carpeta declarada no productiva

**Qué se rompe.** Antes de cancelar un preapproval desconocido, el handler consulta el manifiesto
de sondas «versionado de `mp-probes/`, que el despliegue lleva consigo». Esa carpeta es
`docs/mp-probes/` de la spec, declarada «no productiva». El diseño no dice cómo llega ese archivo al
proceso que corre en producción, en qué formato, ni qué hace el handler si no lo encuentra; la
unidad B11 tiene su test («no manda cancelar un id del manifiesto») pero ninguna construye el
transporte. Un implementador lo empaqueta en la imagen, otro lo lee de la base, otro lo trata como
vacío si falta.

**El camino.**

1. El owner tiene una sonda con una medición abierta el día del corte, enumerada en el manifiesto.
2. La imagen del paso 3 no lleva `docs/`; el handler no encuentra el manifiesto y lo trata como
   vacío.
3. Llega el cobro de la sonda: el handler escribe la lápida de recepción y manda cancelar; la
   medición abierta se pierde, y la marca propone devolverle al owner su propio cobro.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:112`
  — "tienen una medición abierta —enumerados en el manifiesto versionado de `mp-probes/`, que el"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/06-proveedor.md:384`
  — "`docs/mp-probes/`, versionadas, marcadas como no productivas (§4 del PDR las permite como"

**Qué haría falta decidir o escribir.** Dónde vive en producción la lista de ids exceptuados (una
tabla, un archivo empaquetado), quién la escribe y la borra, y qué hace el handler si no la tiene.

## BAJA

### F-8V3B3-007 — El modelo de datos todavía dice que el pago de única vez no admite marca

**Qué se rompe.** La lista de «lo que esa fila NO tiene» del pago del addon de única vez afirma que
no admite una marca porque la marca cuelga de una suscripción. Desde `R4`, `reconciliation_mark`
admite la instancia de addon `UNA_VEZ` con el motivo 23, en la tabla del mismo capítulo. Es texto
vencido.

**El camino.**

1. Juan paga una orden de addon de única vez cuya instancia termina `ABANDONED`.
2. Quien implementa `payment` lee la lista de §2.3 y no prevé una marca colgada de la instancia; el
   que implementa la comprobación de órdenes lee §2.2 y la escribe.
3. Las dos piezas no encajan hasta la integración.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:442`
  — "no admite una marca de conciliación, porque `reconciliation_mark` cuelga de una suscripción"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57`
  — "o, sólo con el motivo 23, la instancia de addon `UNA_VEZ`, que no tiene suscripción"

**Qué haría falta decidir o escribir.** Actualizar la lista de §2.3 (y la del barrido que «no lo
ve») con la excepción del motivo 23.

## Ataques que intenté y el diseño resistió

- **Cobro viejo imputado a la suscripción nueva de la misma persona**: la regla de re-vinculación
  exige que el `external_reference` nombre una fila sin `provider_link`, y `UNIQUE(subscription_id)`
  en `provider_link` lo vuelve imposible (`B/09` §2.4, `B/02` §2.2).
- **Evento de un id del manifiesto que llega antes de su lápida del corte**: la ruta de avisos
  queda cerrada por el Worker del borde con `500` hasta que el paso 4 verificó las lápidas, y el
  proveedor reintenta (`WH-4`); la herramienta aborta ante un choque con otra fila del mismo id.
- **Segundo cobro de una fila sin terminar, una sola marca**: `reconciliation_mark_payment` acumula
  N pagos por marca y `S15` no levanta una marca con pagos sin resolver.
- **Reintento que cobra después del corte sobre un registro nacido antes**: la ventana se lee en la
  fecha del pago aprobado (`EX-48`), no en el `date_created` del registro, y el 1b no arranca sin
  ese dato.
- **Barrido listando desde el buscador**: todo se lee por id; el buscador sólo se usa con
  `payer_email` como filtro y el recorrido sin filtro del censo, que el paso 2 compara contra el
  `total` y los ids conocidos.
- **Montos en punto flotante**: todo monto es entero en la unidad mínima y el esperado se redondea
  una vez, con el mismo cálculo que usa quien muta (`B/02` §2.3, `B/14` §1.2).

## Fuera de mi vector

- **Resolver un pago colgado sin devolverlo**: el motivo 14 y la sonda del manifiesto proponen «no
  devolver», y `S15` exige que ningún pago colgado quede sin resolver; que `resuelto_en` se pueda
  escribir sin `refund` se lee en `B/02` §2.2 pero ninguna acción del catálogo lo nombra. Es del
  vector de superficies y acciones administrativas.
- **Correo del pagador en el checkout**: el barrido de creaciones filtra por el `payer_email` que
  mandamos; si en el alta por checkout el pagador inicia sesión con otra cuenta, el filtro puede no
  encontrarlo. No está medido; es del vector del proveedor y el alta.

## Key Learnings

1. Un campo que la matriz mide vacío (`payer_email` en el `GET`, `EX-19`) puede sostener un
   detector entero del corte sin que nadie lo cruce: hay que buscar cada campo que el diseño lee
   contra la fila que lo midió.
2. `EX-45` y el código de `preapproval-recovery.service.ts` hablan de cancelaciones **del
   proveedor** por rechazo de tarjeta, no de cancelaciones nuestras: su alcance es el criterio de
   exención del barrido, no sólo el corte.
3. La lista cerrada de plazos de `NUCLEO/02` §1.5 es un buen detector de «configuración» huérfana:
   todo número que un capítulo llame configurable y no esté ahí ni en los técnicos no tiene dueño.
4. `RC-7` (sin `expire_date` en el alta) y `EX-55` (registro con `404` por id) son bordes medidos
   que el §4 y el criterio de exención no nombran.
