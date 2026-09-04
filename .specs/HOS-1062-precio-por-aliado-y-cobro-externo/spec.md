---
title: Precio por aliado y cobro fuera de MercadoPago
linear: HOS-1062
statusSource: linear
created: 2026-09-04
type: feature
areas:
  - db
  - api
  - admin
  - billing
---

# Precio por aliado y cobro fuera de MercadoPago

> **Esta spec no implementa nada todavía.** Su producto es un documento sobre el
> que el dueño decide. Las cinco preguntas de §11 tienen que estar contestadas
> antes de abrir tareas; §10 dice qué se puede empezar sin esperarlas.

## 1. Summary

Un aliado se vende conversando, no en un formulario. El precio sale de esa charla
y no del catálogo, y a veces se paga en efectivo o por cheque. Hoy el sistema no
sabe hacer ninguna de las dos cosas: el monto lo pone el plan, y el único camino
de cobro que existe de verdad es un preapproval de MercadoPago.

El pedido del dueño (2026-09-01) lo dice con el ejemplo que lo hace obvio:

> «Se suscriben como partners la Municipalidad de Concepción del Uruguay y el
> Almacén de Josesito. Por más que ambas se suscriban al mismo plan y obtengan
> los mismos beneficios, yo no quiero cobrarle lo mismo a ambas: es lógico que la
> municipalidad puede y debe pagar mucho más.»

## 2. Problem

Son **dos huecos distintos** y conviene no mezclarlos, porque una de las
decisiones de §11 propone justamente colapsarlos en un mecanismo y esa propuesta
no se entiende si arrancan confundidos.

### 2.1 El flujo del aliado no es autoservicio, y eso está bien

```
1. Lead        /sumate/partner/ → POST /api/v1/public/alliance/leads
2. Conversan   (fuera del sistema)
3. Admin crea  la fila de partner y le asigna partner.planId
4. Admin genera el enlace de pago   apps/api/src/routes/partners/admin/send-link.ts
5. Paga        MercadoPago → /partners/checkout/pending
6. Queda       partner.subscriptionId → billing_subscriptions
```

La presentación comercial describe exactamente ese recorrido, así que el modelo
de venta y el código ya coinciden. Lo que no coincide es el precio y la forma de
pago.

### 2.2 Hueco 1 — el monto sale del PLAN, no del aliado

`partners` (`packages/db/src/schemas/partner/partner.dbschema.ts`) tiene
`planId`, `subscriptionId`, `subscriptionStatus`, `lifecycleState`, `startsAt`,
`endsAt`, la trilogía de revisión de contenido, la de revocación y el
`ownerUserId` que trajo HOS-278. **Cero columnas de monto.**

`send-link.ts:148-152` llama a `initiatePartnerMonthlySubscription({ planId:
partner.planId, ... })`, y adentro
(`apps/api/src/services/subscription-checkout.service.ts:1126,1156`) el monto es
`findMonthlyPrice(plan.prices).unitAmount`. La municipalidad y el almacén, ambos
en el mismo plan, pagan lo mismo. No hay forma de diferenciarlos sin moverlos de
plan.

### 2.3 Hueco 2 — el cobro externo existe a medias, no «no existe»

**El issue tiene acá un error de hecho que esta spec corrige.** El cobro fuera de
MercadoPago no es inexistente: es incompleto. Ya hay endpoint, servicio, permiso
y botón:

| pieza | dónde |
|---|---|
| Ruta | `apps/api/src/routes/partners/admin/manual-payment.ts` → `POST /api/v1/admin/partners/{id}/manual-payment` |
| Servicio | `packages/service-core/src/services/partner/partner.service.ts:393` → `registerManualPayment(actor, partnerId, note)` |
| UI | `apps/admin/src/routes/_authed/partners/$id.tsx` — tarjeta «Registrar pago manual», textarea + botón |
| Permiso | `PermissionEnum.PARTNER_MANAGE`, cuyo comentario ya nombra «manual payment» |

Y está bien gateado: `registerManualPayment` exige el mismo
`isPartnerContentApprovedForPayment` que `send-link` (AC-11 de HOS-278), así que
un pago en efectivo no publica contenido que nadie revisó.

Lo que le falta es todo lo demás:

- **No captura nada del pago.** Ni monto, ni fecha, ni medio, ni comprobante. El
  único dato que entra es un `note` opcional de 500 caracteres que va a un
  `auditLog()` genérico — y el servicio tiene, sin resolver, un
  `// TODO: Log manual payment in audit log with note` en la línea 439.
- **No crea fila en `billing_subscriptions`.** `partners.subscriptionId` queda
  como estaba. El pago no existe en ninguna superficie de billing.
- **No setea `endsAt`, y por lo tanto no vence nunca** (§2.4).

Todo lo que hace es un `UPDATE partners SET subscription_status='active',
lifecycle_state='ACTIVE'` y, si estaba en null, `starts_at = now()`.

### 2.4 El aliado que nunca vence — un bug vivo, hoy, independiente de todo esto

`partner-expiry.job.ts` archiva por `PartnerModel.findExpired()`, cuyo predicado
es `lifecycle_state='ACTIVE' AND subscription_status='active' AND deleted_at IS
NULL AND ends_at <= now()`.

**Nada en el código escribe `partners.endsAt`.** Ni `registerManualPayment`, ni
`reconcilePartnerForSubscription` (que sí sella `startsAt` y fue endurecido por
HOS-409), ni ningún cron. La única forma de que esa columna tenga valor es que un
admin la tipee a mano en el formulario de edición.

Consecuencia doble:

1. `partner-expiry` es hoy una red que sólo atrapa las fechas que alguien tipeó.
   Su propio JSDoc dice que archiva «partners who DID pay and whose term ran
   out» — una población que el código no produce.
2. **Un partner activado por pago manual queda activo para siempre.** No vence,
   no avisa, y no hay forma de saber cuándo volver a cobrarle. El reaper de
   impagos (`partner-unpaid-reaper.job.ts`, 30 días aviso / 90 días archivo)
   tampoco lo ve, porque filtra por `starts_at IS NULL` y `registerManualPayment`
   acaba de sellar esa columna.

Para el camino de MercadoPago la ausencia de `endsAt` es inocua: el preapproval
es el reloj y el webhook archiva al cancelar. Para el camino externo **no hay
ningún reloj**.

## 3. Goals

- **G-1** — Que el monto que se le cobra a un aliado pueda ser distinto del
  precio de lista de su plan, y que esa diferencia sobreviva a cualquier edición
  posterior del catálogo.
- **G-2** — Que un pago recibido fuera de MercadoPago se registre con monto,
  fecha, medio, comprobante y autor, y active al aliado.
- **G-3** — Que un aliado pagado por fuera **venza**, y que se sepa cuándo.
- **G-4** — Que el historial de pagos de un aliado se vea en el admin, en un solo
  lugar, sin importar por dónde entró la plata.
- **G-5** — Que ningún cron trate una fila del camino externo como rota.
- **G-6** — Que el monto negociado no sea visible para nadie fuera del admin.

## 4. Non-goals

- **NG-1** — **No se toca el precio de los planes de alojamiento ni su
  propagación.** HOS-176 es de otro dueño y sigue vigente tal cual está. Esta
  spec sólo exige ser inmune a ella.
- **NG-2** — **No se resuelve `PRICE_INCREASE_NOTICE_GRACE_DAYS`.** Esa constante
  (`plan-price-change.service.ts:44`) sigue siendo un placeholder pendiente de
  decisión del dueño para el caso general. Esta spec no la decide de refilón; ver
  OQ-4.
- **NG-3** — **No se generaliza el precio negociado a otros verticales.**
  Gastronomía, experiencias y anfitriones quedan afuera. Si mañana se quiere,
  será una extensión deliberada, no un derrame de ésta.
- **NG-4** — **No se construye autoservicio.** El aliado sigue sin poder elegir
  su plan ni su precio: los dos salen de una conversación con un admin.
- **NG-5** — **No se toca el checkout de MercadoPago de partner** salvo que la
  decisión OQ-2 diga explícitamente que sí (fase F3).
- **NG-6** — **No se construye facturación.** Registrar un pago no es emitir un
  comprobante fiscal. HOS-20 (IVA) es otro tema.

## 5. Current baseline

### 5.1 ⚠️ La trampa central — el cron de propagación pisa cualquier monto en MP

Esto es lo más importante del documento. Cualquier diseño que se elija tiene que
ser explícitamente inmune a esto, o los acuerdos se pierden solos y en silencio.

`apps/api/src/cron/jobs/propagate-plan-price-changes.job.ts` es la maquinaria de
HOS-176: cuando un admin edita el precio de un plan, este cron le reescribe el
`transaction_amount` del preapproval a cada suscriptor vivo de ese plan
(`paymentAdapter.subscriptions.update`, línea 792).

Las dos consultas que arman esa lista —`findAffectedSubscribers` (línea 442, rama
de BAJADA) y `findUnnoticedAffectedSubscribers` (línea 493, rama de SUBIDA)—
filtran **exactamente por lo mismo**:

```
planId = X
billingInterval = Y
status IN ('active','trialing','past_due')
mp_subscription_id IS NOT NULL
NOT EXISTS (ya procesado)
```

**No hay filtro por `product_domain` ni por ninguna marca de precio negociado.**
La consulta no distingue un anfitrión de un aliado: le importa el plan y el
preapproval. Como en la práctica los aliados están en planes propios, el
disparador real es preciso y verosímil: **el día que se suba el precio de lista
de `partner-gold` para los aliados nuevos, ese mismo cron le sube el monto a
todos los aliados viejos que estén en ese plan — incluido el que negoció otra
cifra.**

Tres matices que sí encontré leyendo el cron y que cambian el análisis:

- **El cron SÍ respeta los descuentos.** `resolveDiscountAwareTargetCentavos`
  re-calcula el monto objetivo aplicando el promo activo de la suscripción sobre
  el precio NUEVO, y si no puede determinarlo **difiere en vez de pisar** (un
  throw no es prueba de «no hay descuento»). O sea: un descuento representado
  localmente como promo sobrevive a la propagación. Un monto que sólo vive en el
  `transaction_amount` de MercadoPago, no. Esto es un argumento fuerte y
  concreto a favor del patrón «precio de lista + descuento acordado» (OQ-1/OQ-2).
- **`mp_subscription_id IS NOT NULL` es la inmunidad que ya existe.** Una
  suscripción sin preapproval es invisible para las dos consultas, por
  construcción. Un camino de cobro externo que nunca cree un `mp_subscription_id`
  está fuera del alcance del cron sin tocar una línea del cron.
- **La subida ya tiene grandfathering.** `ensureTargetsFromNotices` no re-precia
  a quien está en trial ni a quien no figure en el ledger de avisos. Existe, pues,
  el precedente de «esta suscripción queda al monto viejo» — pero es una decisión
  del cron por estado, no una marca sobre la suscripción.

### 5.2 `billing_subscriptions` no tiene columna de monto

Verificado enumerando el uso real de la tabla en `packages/db`, `apps/api` y
`packages/service-core`. Las columnas que el código toca son:

```
billingInterval, cancelAtPeriodEnd, canceledAt, courtesyCyclesGranted,
courtesyEndsAt, courtesyStartsAt, createdAt, currentPeriodEnd,
currentPeriodStart, customerId, deletedAt, id, livemode, metadata,
mpSubscriptionId, planId, productDomain, promoCodeId,
promoEffectRemainingCycles, scheduledPlanChange, status, trialEnd, updatedAt
```

**Ninguna es un importe.** El monto de una suscripción vive en dos lugares y en
ninguno más: el precio del plan (catálogo) y el `transaction_amount` del
preapproval (MercadoPago). Guardar un monto por suscripción exige una columna
nueva.

Eso es factible y precedido: `courtesy_cycles_granted` / `courtesy_ends_at`
entraron a esa tabla por el carril estructural normal
(`packages/db/src/migrations/0101_stiff_moonstone.sql`) más una data-migration del
carril extras (`extras/038-courtesy-window-to-typed-columns.data-migration.sql`)
que mudó los valores desde `metadata`. No es territorio prohibido; es territorio
de la librería, con un molde ya usado.

### 5.3 El precedente arquitectónico (`status = 'comp'`) y su letra chica

`apps/api/src/services/subscription-comp-create.service.ts:133` inserta directo en
`billing_subscriptions` con `status='comp'` y sin preapproval. Es el único estado
**permanentemente** sin MP; `trialing` y `pending_provider` también nacen sin él,
pero de forma transitoria.

El trabajo de exclusión ya está hecho y replicado: `dunning.job.ts` chequea
`row.status === 'comp'` y saltea, `preapproval-less-expiry.job.ts` lo excluye con
un comentario que dice que `comp` «legitimately has no preapproval and must not
be flagged», y `subscription-poll.job.ts` y la propagación exigen `isNotNull`.
`apply-scheduled-plan-changes.ts` y `abandoned-pending-subs.job.ts` tienen
condicionales explícitos.

**Conclusión que hay que retener: agregar una categoría «pagada externamente, sin
MP» es viable sin romper nada, siempre que se la excluya explícitamente donde
haga falta. Es un patrón probado, no un invento.**

Pero hay una letra chica que encarece esa opción y que no estaba en el
diagnóstico previo: `createCompSubscription` **rechaza de plano cualquier plan
que no sea de alojamiento** (líneas 106-112: *«only accommodation plans can be
comped at checkout»*), y sus dos únicos llamadores son los checkouts de
alojamiento. Replicar `comp` para aliados no es reusar `comp`: es construir un
segundo `comp` para un dominio que el primero rechaza. De paso, eso significa que
el *«se soporta canje vía COMP»* que HOS-278 §6.3 da por hecho para partners **no
está implementado**.

### 5.4 Lo que la landing ya prometió por escrito

`apps/web/src/pages/[lang]/presentacion/aliados/index.astro` es el documento que
se manda por WhatsApp antes de firmar. Dice, hoy, en producción:

- *«Hay dos niveles, plata y oro, y cada uno se puede tomar **por mes o por
  año**. Los valores vigentes te los pasamos en la charla»* (líneas 222-225).
- *«Efectivo o cheque — Lo arreglamos directo, sin plataforma de por medio. Útil
  si tenés que rendir el gasto de otra forma o preferís no dejar una tarjeta
  cargada»* (líneas 240-241).
- *«El nivel lo acordamos juntos, no lo elegís en un formulario... En esa charla
  salen también los valores y la forma de pago que te sirva»* (paso 02).
- *«...te llega el enlace de suscripción, o coordinamos el efectivo o el
  cheque»* (paso 04, línea 306).

O sea: el precio negociado y el cobro externo **ya están prometidos**. Y hay una
tercera promesa que tampoco se sostiene y que no estaba en el diagnóstico: el
checkout de partner es **sólo mensual** (`findMonthlyPrice`, `billingInterval:
'monthly'` en `subscription-checkout.service.ts:1126,1156`). El «por año» de la
landing no existe en el código. Ver R-5.

Contexto de producto: HOS-941 ya decidió que **las tarjetas de aliados no
muestran precio, dicen «Consultar»**. Esta spec es lo que le pone un sistema
detrás a ese «Consultar».

### 5.5 Los mecanismos existentes que NO alcanzan

| mecanismo | qué permite | por qué no resuelve esto |
|---|---|---|
| Cupón permanente (`effect_kind:'discount'`, `duration_cycles:null`) | descuento fijo o porcentual, para siempre, y **sobrevive a la propagación** (§5.1) | sólo **baja** desde un precio de lista, nunca sube. No está atado a un cliente: `maxUses:1` lo hace de un solo uso, pero quien tenga el string lo redime. Y `initiatePartnerMonthlySubscription` **no acepta `promoCode`** — los dos checkouts que sí lo aceptan son los de alojamiento |
| `status='comp'` | gratis permanente, sin preapproval | sólo cubre el caso gratis total, y hoy rechaza planes de partner (§5.3) |
| Un plan por segmento | precios reales distintos | N planes, y la segmentación se vuelve **pública**: una municipalidad viendo que paga 5× lo del almacén es un problema político, no técnico |
| Mutar `transaction_amount` del preapproval | el monto sí vive por suscripción del lado de MP | la maquinaria está construida para cambios de precio **de plan** (HOS-176), no por cliente — y es la misma que después lo pisa |

### 5.6 La restricción legal

Subir un precio requiere **aviso previo con ventana de gracia** (Disposición
954/2025). Bajarlo es libre. El repo ya modela esa asimetría: `effectiveAt = now`
para bajadas, `now + PRICE_INCREASE_NOTICE_GRACE_DAYS` para subidas, con la
constante marcada como placeholder.

Eso hace que el patrón «precio de lista alto + descuento acordado hacia abajo»
sea el **legalmente más cómodo**: nunca hay una subida que avisar. Es un
argumento de peso y hay que ponerlo en la balanza antes de elegir (OQ-1/OQ-2).

Detalle nuevo y feo: si un aliado alguna vez está sobre MercadoPago y sube el
precio de su plan, **el aviso legal se manda a un correo inválido**. La rama de
aviso resuelve el destinatario con `customer.email`
(`propagate-plan-price-changes.job.ts:1299,1327`), y el customer de un partner
lleva la dirección sintética `partner-<id>@partners.hospeda.invalid`
(`send-link.ts:48`). El ledger lo registra como enviado. Ver R-2.

## 6. Proposed design

El diseño concreto **depende de las decisiones de §11** y por eso acá se fija
sólo lo que no depende de ellas: las tres piezas que hacen falta en cualquier
variante, y las invariantes que ninguna variante puede violar.

### 6.1 Las tres piezas

1. **Un registro de pagos por aliado.** Entidad propia, no un campo: monto,
   moneda, fecha de pago, medio, referencia/comprobante, período cubierto, nota,
   y quién lo registró. Es lo que hace posible el vencimiento (pieza 2), el
   historial que pide el issue (G-4), y lo que retira el `// TODO` de la línea
   439.
2. **Un reloj para el camino externo.** El período cubierto por el pago es lo que
   sella `partners.endsAt`, y `partner-expiry` —que ya existe y hoy no atrapa a
   nadie— pasa a tener población real.
3. **El monto acordado.** Dónde vive y si pasa o no por MercadoPago es OQ-1 y
   OQ-2. Lo que no está en discusión es que tiene que existir en algún lado
   escrito, porque hoy vive sólo en la cabeza de quien negoció.

### 6.2 Las invariantes, valgan las decisiones que valgan

- **I-1 — Inmunidad a la propagación.** Ningún monto acordado puede depender de
  que nadie edite el precio de un plan. Si el diseño elegido deja el monto en el
  `transaction_amount` de un preapproval, la propagación tiene que aprender a
  excluirlo con una marca explícita, y esa exclusión tiene que estar cubierta por
  un test que muera si alguien la borra.
- **I-2 — Fallar cerrado.** Una fila sin monto acordado se cobra al precio de
  lista. Nunca al revés: la ausencia de dato no puede significar «gratis».
- **I-3 — El monto acordado es privado.** No sale por ningún endpoint público, ni
  por el panel del propio aliado. `packages/schemas/src/entities/partner/partner.owner.schema.ts`
  ya mantiene una lista de campos que un owner no ve ni escribe (`startsAt`,
  `endsAt`, `lifecycleState`); el campo nuevo entra ahí.
- **I-4 — Activar sigue exigiendo contenido aprobado.** El gate AC-11 de HOS-278
  (`isPartnerContentApprovedForPayment`) vale igual para un pago en efectivo. Un
  cheque no es razón para publicar contenido que nadie revisó.
- **I-5 — Un pago no es una activación silenciosa.** Registrar un pago escribe
  quién lo registró y cuándo. Es plata que entró por fuera de toda plataforma:
  el único control que queda es la trazabilidad.

### 6.3 La hipótesis fuerte que vale la pena mirar de frente

Si el aliado que negocia precio es, en la práctica, el mismo que paga en efectivo
o por cheque —que es lo que la landing ya ofrece y lo que un municipio
razonablemente va a preferir—, entonces:

**negociado ⟹ fuera de MercadoPago**

y los dos huecos colapsan en un mecanismo solo. Además **la trampa de §5.1
desaparece por construcción**, sin tocar el cron: esas filas nunca tendrían
`mp_subscription_id`, y las dos consultas exigen `isNotNull`.

Es una decisión de producto, no técnica, y por eso va como OQ-2 y no como diseño
cerrado. El costo de aceptarla está dicho ahí.

## 7. Data model / contracts

Forma tentativa, sujeta a §11. Se escribe para que se vea el tamaño de cada
opción, no para fijarla.

### Si se acepta la recomendación (OQ-1a + OQ-2a + OQ-3a + OQ-5 sí)

| tabla | cambio | notas |
|---|---|---|
| `partners` | `+ negotiated_amount_centavos` (integer, null) | El acuerdo. `null` = precio de lista (I-2). Entero en centavos, como todo el dinero del repo |
| `partners` | `+ negotiated_currency` (varchar(3), null) | Sólo si el acuerdo puede no ser ARS. Si no, se omite |
| `partner_payments` | **tabla nueva** | Ver abajo |

`partner_payments` (propiedad de Hospeda, no de qzpay):

```
id                uuid pk
partner_id        uuid not null → partners.id  (cascade)
amount_centavos   integer not null   (> 0)
currency          varchar(3) not null
paid_at           timestamptz not null
method            enum: cash | check | bank_transfer | mercadopago | other
reference         text null          (nro de cheque, comprobante, id de MP)
period_start      timestamptz not null
period_end        timestamptz not null  (> period_start)
note              text null
subscription_id   uuid null → billing_subscriptions.id   (los de MP, si se importan)
recorded_by_id    uuid not null → users.id
created_at / updated_at / deleted_at + autoría
índices: (partner_id, paid_at desc), (period_end)
```

`method = 'mercadopago'` existe para que el historial del admin sea uno solo
(G-4) sin obligar a inventar una vista que una dos fuentes. Si conviene poblarlo
desde el webhook o dejarlo para después es detalle de implementación.

### Endpoints

| método | ruta | notas |
|---|---|---|
| `POST` | `/api/v1/admin/partners/{id}/manual-payment` | **existe**; se le agrega body con monto, fecha, medio, referencia y período |
| `GET` | `/api/v1/admin/partners/{id}/payments` | historial, paginado con `page`+`pageSize` (convención admin) |
| `PATCH` | `/api/v1/admin/partners/{id}` | ya existe; suma `negotiatedAmountCentavos` al schema de update |

Todos bajo `PermissionEnum.PARTNER_MANAGE`, que ya cubre esto.

### Migraciones

Carril estructural (`pnpm db:generate` + `db:migrate`). No hay cambio de datos
sembrados, así que **la regla de dual-write del seed no aplica** — no hay
baseline que editar ni data-migration que escribir.

### Si en cambio se elige OQ-1b (monto en `billing_subscriptions`)

Cambia el tamaño por completo: columna nueva en tabla de qzpay (molde de
`courtesy_*`, §5.2), **más** una marca de exclusión, **más** modificar las dos
consultas del cron de propagación, **más** el test que mate esa exclusión si
alguien la borra. Es la opción con más superficie y la única que toca HOS-176.

## 8. UX / UI behavior

- **Detalle de partner en el admin** (`apps/admin/src/routes/_authed/partners/$id.tsx`)
  — la tarjeta «Registrar pago manual» pasa de un textarea suelto a un formulario
  con monto, fecha, medio, referencia, período y nota. TanStack Form + Zod desde
  `@repo/schemas`, como el resto del admin.
- **Historial** — lista debajo, ordenada por fecha descendente, con el medio
  visible. Es la respuesta a «cuándo le cobré por última vez y cuánto».
- **El monto acordado** se muestra junto al plan, con el precio de lista al lado
  para que se vea la diferencia. Si no hay acuerdo, se dice «precio de lista», no
  se deja vacío.
- **Vencimiento** — la fecha de fin del último período pagado se muestra en el
  detalle. Un aliado sin vencimiento (los que ya existen hoy) tiene que verse
  como tal, no como un campo en blanco.
- **Nada de esto sale a la web.** El panel del aliado no muestra ni el monto
  acordado ni el historial de pagos (I-3). Toda copy nueva del admin sigue la
  convención del panel; no hace falta i18n público.

## 9. Acceptance criteria

Escritos para poder ejercerlos. Cada uno nombra qué se rompe si falla.

- **AC-1** — Registrar un pago con monto, fecha, medio y período crea una fila en
  `partner_payments` que el endpoint de historial devuelve.
- **AC-2** — Registrar un pago sella `partners.endsAt` con el `period_end` de ese
  pago. Con la fecha inyectada un día después, `partner-expiry` archiva a ese
  partner; un día antes, no lo toca.
- **AC-3** — Un pago con `amount_centavos <= 0`, o con `period_end <=
  period_start`, es rechazado con 400 y no escribe nada.
- **AC-4** — Registrar un pago sobre un partner cuyo contenido **no** está
  aprobado sigue fallando (I-4), con el mismo error que hoy.
- **AC-5** — La fila de pago registra `recorded_by_id` con el actor real, y el
  historial lo devuelve. (Es el reemplazo verificable del `// TODO` de la línea
  439.)
- **AC-6** — Un actor sin `PARTNER_MANAGE` recibe 403 tanto al registrar como al
  leer el historial.
- **AC-7** — `findAffectedSubscribers` y `findUnnoticedAffectedSubscribers` no
  devuelven ninguna fila con `mp_subscription_id IS NULL`. **Guard con mutación**:
  borrar el `isNotNull` de cualquiera de las dos tiene que poner el test en rojo.
- **AC-8** — Con un partner que tiene monto acordado, editar el precio de su plan
  y correr el cron de propagación de punta a punta **no cambia** el monto
  acordado ni lo que se le va a cobrar. (Éste es el AC que vigila la trampa; su
  forma exacta depende de OQ-1/OQ-2, pero la propiedad se afirma igual.)
- **AC-9** — `negotiatedAmountCentavos` no aparece en la respuesta de ningún
  endpoint público ni en la del panel del propio aliado (I-3), verificado contra
  el schema de salida, no contra una llamada de ejemplo.
- **AC-10** — Un partner sin monto acordado se cobra al precio de lista de su
  plan, igual que hoy (I-2).
- **AC-11** — El detalle del partner en el admin muestra el historial con los
  pagos ordenados por fecha descendente y el medio de cada uno.

Criterios que **no** entran porque no se pueden ejercer: nada sobre «el aliado
percibe», nada sobre montos reales de producción, y nada sobre el
comportamiento de MercadoPago que no se pueda probar contra el stub o contra el
sandbox en un smoke declarado.

## 10. Risks

- **R-1 — La trampa del cron de propagación. Riesgo número uno.**
  En castellano: *hoy, si alguien edita el precio de un plan de aliados desde el
  admin, un proceso automático le reescribe el monto a todos los aliados que
  estén en ese plan y tengan una suscripción activa en MercadoPago.* No pregunta
  si ese monto se había acordado distinto, porque no tiene forma de saberlo: el
  monto acordado no existe en ningún lado. Si el precio negociado se guarda mal,
  el acuerdo con la municipalidad se pierde **solo, en silencio y sin dejar
  rastro**, el día que alguien actualice la lista de precios. Cualquier diseño
  tiene que ser inmune a esto por construcción (I-1), y la inmunidad tiene que
  estar cubierta por un test que muera si la borran (AC-7, AC-8).

- **R-2 — El aviso legal de subida se manda a una dirección inválida.**
  Si un aliado está sobre MercadoPago y sube el precio de su plan, la Disposición
  954/2025 exige avisarle. El cron resuelve el destinatario con `customer.email`,
  y el customer de un partner es `partner-<id>@partners.hospeda.invalid`. El
  correo no llega a nadie, el ledger lo anota como enviado, y quince días después
  el monto sube. **Es un incumplimiento legal silencioso**, y existe hoy con
  independencia de esta spec.

- **R-3 — El aliado que nunca vence** (§2.4). Un partner activado por pago manual
  se queda activo para siempre. Ya puede haber filas así en producción; hay que
  contarlas antes de tocar nada (§12).

- **R-4 — Doble cobro.** Un partner con preapproval activo Y pago en efectivo
  registrado paga dos veces, y nada lo impide hoy. Registrar un pago externo
  sobre un partner que tiene `subscriptionId` no nulo tiene que, como mínimo,
  avisar.

- **R-5 — La landing promete anual y el checkout es sólo mensual.**
  `initiatePartnerMonthlySubscription` resuelve con `findMonthlyPrice` y manda
  `billingInterval: 'monthly'`. La presentación dice «por mes o por año». Es una
  tercera promesa incumplida en el mismo documento, ajena a esta spec pero de la
  misma familia: **conviene abrir un issue propio** en vez de arrastrarlo acá.

- **R-6 — «Canje vía COMP» no existe para aliados.** HOS-278 §6.3 lo da por
  soportado; `createCompSubscription` rechaza cualquier plan que no sea de
  alojamiento. Si el dueño esperaba poder regalar una alianza, hoy no puede — y
  la opción OQ-3b («replicar comp») cuesta más de lo que parece justamente por
  esto.

- **R-7 — Privacidad de la segmentación.** El monto acordado es información
  comercialmente sensible entre partes que se conocen entre sí en una ciudad
  chica. Un endpoint que lo filtre no es un bug de datos: es un problema
  político. De ahí I-3 y AC-9.

- **R-8 — Plata que entra sin control automático.** Un pago en efectivo lo
  afirma una persona. No hay conciliación posible contra un tercero. El único
  control es la trazabilidad (I-5) y el hecho de que registrar sea un acto
  permisionado y auditado.

## 11. Open questions

Las cinco decisiones. Cada una con opciones concretas, qué toca cada una, y una
recomendación con su fundamento. **El dueño elige; no hace falta que diseñe.**

---

### OQ-1 — ¿Dónde vive el precio negociado?

| # | Opción | A favor | En contra | Qué toca |
|---|---|---|---|---|
| a | Columna en `partners` (`negotiated_amount_centavos`) | Tabla propia de Hospeda; el acuerdo es un hecho **del aliado**, no de una suscripción, y sobrevive a cambios de plan y a re-suscripciones. **El cron de propagación no la lee jamás**: inmunidad sin tocar HOS-176 | No sirve para otros verticales sin repetir la columna | 1 migración estructural + schema de update + admin |
| b | Columna en `billing_subscriptions` + marca de exclusión | Más general; serviría a comercios y anfitriones | Tabla de qzpay (posible, molde `courtesy_*`, §5.2). Y sobre todo: **pone el monto adentro del radio de explosión del cron por construcción**, así que obliga a modificar las dos consultas de propagación y a defender esa exclusión para siempre | 1 migración + 2 consultas del cron + guard con mutación + tests de HOS-176 |
| c | Columna en `partner_subscriptions` | Tabla propia de Hospeda y ya es el puente partner↔billing | La fila se borra en cascada con la suscripción y es `UNIQUE(partner_id)`: el acuerdo desaparecería al cambiar de suscripción, que es justo cuando más se lo necesita | 1 migración + escrituras del reconcile |

**Recomendación: (a), columna en `partners`.**

Tres razones, en orden de peso:

1. **La inmunidad sale gratis.** La opción (b) requiere construir la defensa
   contra R-1 y mantenerla; la (a) no la necesita porque el cron nunca mira esa
   tabla. Frente a un riesgo cuyo modo de falla es «silencioso y sin rastro», la
   defensa estructural gana a la defensa por código.
2. **El acuerdo es del aliado, no de la suscripción.** Se negocia una vez y vale
   mientras dure la relación. En (c) se pierde al cambiar de suscripción, y en
   (b) hay que re-copiarlo en cada una.
3. **YAGNI sobre la generalidad de (b).** El monto se resuelve al momento de
   cobrar, así que generalizar después es agregar una segunda columna, no
   rediseñar. No es una puerta que se cierre.

Contrapunto honesto: el issue apunta que «en la suscripción es más general». Es
cierto, y si el dueño anticipa precio negociado en gastronomía o experiencias
dentro de los próximos meses, (b) evita hacerlo dos veces. La pregunta que
decide es esa, no la técnica.

---

### OQ-2 — ¿El precio negociado pasa por MercadoPago?

| # | Opción | A favor | En contra |
|---|---|---|---|
| a | **Negociado ⟹ siempre fuera de MP** (efectivo, cheque, transferencia), registrado a mano | Colapsa los dos huecos en un mecanismo. **La trampa R-1 desaparece por construcción**: sin `mp_subscription_id` esas filas son invisibles para las dos consultas. Sin subidas automáticas, no hay Disposición 954 que resolver. Es lo que la landing ya ofrece y lo que un municipio probablemente prefiera | Pierde el cobro recurrente automático justo con quien más paga. Un aliado que quiere autodébito **a precio negociado** no tiene camino |
| b | Negociado también por MP, mutando el `transaction_amount` del preapproval | Cobro automático a precio propio | Reusa la maquinaria de HOS-176, que es la misma que después lo pisa: hay que construir la exclusión (R-1). Recordar que **las fechas del preapproval son inmutables y el monto tiene piso de $15**. Y arrastra R-2: el aviso legal iría a un correo inválido |
| c | Las dos, según el aliado | Cubre todo | Dos caminos vivos desde el día uno, con el doble de superficie a probar |

**Recomendación: (a) para la primera entrega, con (c) como destino explícito.**

El razonamiento es que **el canal de cobro y el monto son ortogonales, pero
empezar por (a) compra la inmunidad a R-1 sin escribir una línea de defensa**, y
cubre la promesa que ya está publicada. La puerta a (b) queda abierta: el día que
un aliado negocie precio y quiera débito automático, se agrega la marca de
exclusión y la mutación, con el modelo de datos ya en su lugar y con el aprendizaje
de haberlo operado.

Lo que hay que decidir de verdad acá no es técnico: es **si el dueño acepta que,
por ahora, negociar precio implique cobrar por fuera**. Si la respuesta es no —si
quiere una municipalidad con débito automático a precio propio— entonces la
respuesta a OQ-1 se inclina hacia (b), la exclusión del cron entra en el alcance,
y R-2 hay que arreglarlo antes.

---

### OQ-3 — ¿`manual-payment` se extiende o se reemplaza?

| # | Opción | A favor | En contra |
|---|---|---|---|
| a | **Extender** el endpoint actual: monto, fecha, medio, comprobante, período; sin fila en `billing_subscriptions` | Superficie chica y contenida. Ruta, servicio, permiso y UI ya existen y ya están gateados por AC-11. Cero crons de billing que enseñar a ignorar nada, porque no hay fila que ignorar | El pago no aparece en las superficies de billing y `partner.subscriptionId` queda null. Se resuelve con el historial propio (OQ-5) |
| b | **Reemplazar** por un estado nuevo en `billing_subscriptions` (tipo `comp`) | Más general; el pago vive en el mismo lugar que todo lo demás | El trabajo de exclusión son 6+ sitios (dunning ×2, `preapproval-less-expiry`, `subscription-poll`, `apply-scheduled-plan-changes`, `abandoned-pending-subs`, propagación) y **cada omisión falla abierto**. Y `createCompSubscription` **rechaza planes que no sean de alojamiento** (§5.3): no es reusar `comp`, es construir un segundo `comp` |

**Recomendación: (a), extender, más el registro de pagos de OQ-5.**

`comp` es un precedente válido como *patrón* —y hay que citarlo así—, pero no es
código reutilizable para este caso. Un aliado, además, no es una cuenta de
usuario: su customer de billing lleva un correo sintético (`send-link.ts:48`), lo
que ya rompe una cosa (R-2) y rompería más si se lo hace ciudadano de primera en
`billing_subscriptions`. La entidad `partner_payments` da el historial que pide el
issue sin volver a un aliado un suscriptor de pleno derecho que hay que excluir en
seis lugares.

La objeción legítima a (a) —«el pago no se ve en billing»— se contesta con el
historial en el detalle del partner, que es donde el admin lo va a buscar de todas
formas.

---

### OQ-4 — ¿La Disposición 954/2025 aplica al precio negociado?

**Es una pregunta legal, no técnica**, y el dueño no la resolvió ni para el caso
general (`PRICE_INCREASE_NOTICE_GRACE_DAYS` sigue siendo un placeholder).

| # | Lectura | Consecuencia técnica |
|---|---|---|
| a | Aplica igual que a un cambio de catálogo | Subir un monto acordado exige aviso + ventana. Hay que construir aviso y ventana también para este camino, y R-2 pasa a ser bloqueante |
| b | Sólo aplica a cambios unilaterales de catálogo; un acuerdo bilateral se modifica de común acuerdo, por escrito, y esa conversación **es** el aviso | Nada que construir: el sistema nunca sube un monto por su cuenta |
| c | Aplica, y se satisface con el acuerdo escrito, pero el sistema igual deja constancia de la fecha desde la que rige el monto nuevo | Una fecha de vigencia en el registro del acuerdo. Barato |

**Recomendación: (b), reforzada con la constancia de (c).**

Fundamento: la Disposición regula el cambio unilateral de condiciones sobre un
consumidor. Un monto acordado con una municipalidad no se cambia por un `UPDATE`:
se re-negocia, y el nuevo valor lo tipea un admin después de esa conversación.
**Mientras el sistema no suba nada solo, no hay subida automática que avisar.**

Lo técnicamente exigible, y esto sí lo puede firmar la ingeniería: **prohibir que
cualquier proceso automático modifique un monto acordado** (I-1 otra vez, desde
otro ángulo). Guardar la fecha desde la que rige cada monto cuesta una columna y
deja el rastro por si la lectura legal termina siendo (a).

**Lo que esta spec NO hace: decidir `PRICE_INCREASE_NOTICE_GRACE_DAYS`** (NG-2).
Sigue abierta para el caso de catálogo. Si el dueño quiere cerrarla, va en su
propio issue: son dos preguntas distintas que comparten una ley.

---

### OQ-5 — ¿Hace falta historial de pagos por aliado en el admin?

| # | Opción | Consecuencia |
|---|---|---|
| a | **Sí, entidad `partner_payments`** | Tabla nueva, endpoint de lectura, sección en el detalle. Habilita el vencimiento (G-3), el historial (G-4) y la trazabilidad (I-5) |
| b | No; alcanza con el audit log | Cero código. Pero el `note` queda enterrado en un log genérico, no hay monto, no hay período, y no hay reloj: el bug de §2.4 se vuelve infixeable |

**Recomendación: (a), sí, y no es opcional.**

No es una preferencia: es la pieza de la que dependen las otras. Sin período
cubierto no hay `endsAt`, sin `endsAt` no hay vencimiento, y sin vencimiento «un
aliado pagado a mano queda activo para siempre» sigue siendo verdad después de
esta spec. El issue además lo pide con todas las letras: *«Ver el historial de
esos pagos en el admin, junto a los de MP y no en otro lado»*.

Es una entidad y no un campo porque un aliado paga N veces: un campo `lastPayment`
respondería «cuánto pagó la última vez» y ninguna otra pregunta.

---

## 12. Implementation notes

### El bug del vencimiento: dentro de esta spec, tarea propia, primera fase

**Recomendación explícita**, porque el tech lead la pidió: va **adentro** de esta
spec, como tarea separada, en la primera fase.

Razones:

1. Es exactamente el código que esta spec extiende. Arreglarlo aparte significa
   tocar `registerManualPayment` dos veces.
2. **No se puede arreglar bien sin decidir el modelo de vencimiento**, que es
   OQ-3 + OQ-5. Un arreglo aislado tendría que inventar un plazo («un mes desde
   la activación»), y ese invento es precisamente lo que el período del pago
   registrado hace innecesario.
3. **Arreglarlo aislado es peligroso.** Si mañana se empieza a escribir `endsAt`
   con un plazo inventado, `partner-expiry` —que hoy no archiva a nadie— empieza
   a archivar aliados **que están al día**, porque su fecha de fin sería ficticia.
   El arreglo tiene que llegar junto con el dato real.

**Antes de tocar nada hay que contar la población.** Cuántos partners hoy tienen
`subscription_status='active'` y `ends_at IS NULL` decide si el arreglo necesita
además un backfill y una conversación con el dueño sobre esas filas. Es una
consulta de lectura contra staging y producción, con `hops psql`, y es trabajo de
la primera tarea — no de esta spec.

### Plan por fases

Ordenado por dependencia con §11, para que se vea qué arranca sin esperar
respuestas.

| Fase | Depende de | Qué |
|---|---|---|
| **F0** | **nada** | (1) Guard con mutación sobre `mp_subscription_id IS NOT NULL` en las dos consultas de propagación (AC-7): fija hoy la propiedad de la que va a depender todo el diseño. (2) Contar la población de `ends_at IS NULL`. (3) Abrir el issue de R-5 (anual prometido, mensual implementado) y el de R-2 (aviso legal a correo inválido) |
| **F1** | OQ-3, OQ-5 | `partner_payments` + `manual-payment` ampliado + `endsAt` derivado del período + historial en el detalle del admin. Cierra G-2, G-3, G-4 y el bug de §2.4 |
| **F2** | OQ-1, OQ-2 | Monto acordado donde se haya decidido + el registro de pago lo propone por defecto + privacidad (I-3). Cierra G-1 y G-6 |
| **F3** | OQ-2b, OQ-4 | **Sólo si el dueño quiere negociado sobre MercadoPago.** Marca de exclusión, cambio de las dos consultas del cron, defensa de R-1 por código, y R-2 arreglado antes. Cierra G-5 en su versión difícil |

F0 vale la pena aunque después se elija cualquier cosa: pone un test que muere si
alguien borra la única inmunidad que hoy existe.

### Notas técnicas sueltas

- **`PartnerService` extiende `BaseCrudService`** pero `registerManualPayment` es
  un método a mano, sin `runWithLoggingAndValidation` — cosa que conviene
  corregir al ampliarlo, siguiendo el patrón que sí usa `getOwn` en el mismo
  archivo.
- **Plata en enteros de centavos.** Nunca `numeric` ni `float` (política del
  repo).
- **Paginación admin**: `page` + `pageSize`, nunca `limit` — `createAdminListRoute`
  rechaza parámetros desconocidos.
- **Contrato de error**: el orden es 401 → 403 → 400 → 404 → reglas de negocio, y
  un 4xx nunca es `INTERNAL_ERROR`. Un partner ajeno **no** aplica acá: son rutas
  de admin, no de dueño.
- **Nada de esto es dual-write de seed**: no se toca ninguna fila sembrada.
- **Ninguna variable de entorno nueva** prevista. Si aparece, va con el flujo
  completo del registro de `packages/config` + Coolify.
- **Smoke**: F1 y F2 son local-first (nada depende de MercadoPago real). F3, si
  llega a existir, es smoke de staging obligatorio contra el sandbox de MP y
  entra en la lista de PRs que tocan el core de billing.

## 13. Linear

Canonical tracking:
HOS-1062

De dónde salió: HOS-941 (rehacer cómo se muestran y venden los planes) — ahí se
decidió que las tarjetas de aliados digan «Consultar», y este issue es lo que le
pone un sistema detrás.

Contexto imprescindible: HOS-176 (propagación de precios de plan a MercadoPago —
la trampa de §5.1), HOS-278 (qué obtiene un aliado al aprobarse — de ahí salen
`ownerUserId`, la revisión de contenido, el reaper de impagos y el gate AC-11),
HOS-171 (todo es preapproval desde entonces), HOS-409 (sellado de `startsAt`),
HOS-702 (`comp` en el reconcile de partner), HOS-180/HOS-993 (precedente de
columnas nuevas en `billing_subscriptions`).

Familia: HOS-973 (planes que no otorgan nada por el motor de entitlements).

Derivados propuestos, a abrir aparte (R-5, R-2): el anual de aliados que la
landing promete y el checkout no soporta; y el aviso legal de subida que se manda
a `partner-<id>@partners.hospeda.invalid`.
