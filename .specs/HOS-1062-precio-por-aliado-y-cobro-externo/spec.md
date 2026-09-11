---
title: Precio por aliado y cobro fuera de MercadoPago
linear: HOS-1062
statusSource: linear
created: 2026-09-04
decided: 2026-09-04
status: decidida — lista para implementar
type: feature
areas:
  - db
  - api
  - admin
  - billing
---

# Precio por aliado y cobro fuera de MercadoPago

> **Las cinco preguntas de §11 están RESUELTAS (2026-09-04).** Quedan escritas
> con su decisión y su fundamento, no borradas: el registro de por qué se eligió
> cada cosa es lo que evita re-litigarlo en tres meses. Cuatro se resolvieron por
> la opción que la spec recomendaba; **OQ-2 se resolvió por una tercera vía que
> la spec no había contemplado** —un plan exclusivo por aliado— y por eso §5.5,
> §6, §7, §9 y §12 se reescribieron alrededor de esa decisión.
>
> **Esta spec sigue sin implementar nada**, pero ya no espera decisiones: se
> pueden abrir tareas contra el plan de fases de §12.

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
- **G-6** — Que el monto negociado no sea visible para nadie fuera del admin —
  **ni el monto ni el plan que lo lleva** (I-6, tras la decisión de OQ-2).

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
- **NG-5** — **No se toca el checkout de MercadoPago de partner.** Con la
  decisión de OQ-2 (plan exclusivo por aliado) esto pasó de condicional a firme:
  el checkout ya resuelve el plan por ID arbitrario y soporta un plan exclusivo
  sin una línea de cambio (§6.4.3). Verificado.
- **NG-6** — **No se construye facturación.** Registrar un pago no es emitir un
  comprobante fiscal. HOS-20 (IVA) es otro tema.
- **NG-7** — **No se toca el cron de propagación de precios.** Ídem NG-5: la
  decisión de OQ-2 lo vuelve innecesario (§6.4.1). Si alguna vez hace falta, es
  otra spec.

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
| Un plan por segmento | precios reales distintos | N planes, y la segmentación se vuelve **pública**: una municipalidad viendo que paga 5× lo del almacén es un problema político, no técnico. **⚠️ Esta objeción cayó**: la decisión de OQ-2 mantiene la idea (un plan por aliado, no por segmento) y le agrega la pieza que la hacía inviable —que esos planes no se vean en ninguna superficie salvo el admin—. Ver §6.4 |
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

**Las decisiones de §11 están tomadas (2026-09-04).** El diseño que sigue ya no
es condicional: §6.1 lista las piezas, §6.2 las invariantes, §6.3 explica por qué
la hipótesis que la spec traía se descartó, y §6.4 desarrolla la decisión de OQ-2
—el plan exclusivo por aliado— con lo que se verificó contra el código.

### 6.1 Las cuatro piezas

1. **Un registro de pagos por aliado.** Entidad propia, no un campo: monto,
   moneda, fecha de pago, medio, referencia/comprobante, período cubierto, nota,
   y quién lo registró. Es lo que hace posible el vencimiento (pieza 2), el
   historial que pide el issue (G-4), y lo que retira el `// TODO` de la línea
   439. **Decidido en OQ-5 (a).**
2. **Un reloj para el camino externo.** El período cubierto por el pago es lo que
   sella `partners.endsAt`, y `partner-expiry` —que ya existe y hoy no atrapa a
   nadie— pasa a tener población real. **El bug de §2.4 sigue en pie y esta
   pieza es lo único que lo cierra**: el plan exclusivo de la pieza 4 no lo toca,
   porque un aliado sobre MercadoPago nunca dependió de `endsAt` (§2.4, último
   párrafo).
3. **El monto acordado escrito en algún lado.** Columna en `partners`
   (`negotiated_amount_centavos`), **decidido en OQ-1 (a)**. Es el registro del
   acuerdo: vale igual si el aliado paga en efectivo o por MercadoPago, y
   sobrevive a cambios de plan y a re-suscripciones. Hoy ese número vive sólo en
   la cabeza de quien negoció.
4. **Un plan exclusivo por aliado, invisible fuera del admin.** Es el camino para
   que un aliado con precio negociado **conserve el débito automático**.
   **Decidido en OQ-2, por una vía que esta spec no había contemplado**; se
   desarrolla entero en §6.4.

Las piezas 1-2 y la 4 son **dos caminos de cobro, no uno**: ver §6.5.

### 6.2 Las invariantes, valgan las decisiones que valgan

- **I-1 — Inmunidad a la propagación.** Ningún monto acordado puede depender de
  que nadie edite el precio de un plan **ajeno**. La decisión de OQ-2 satisface
  esto por construcción y no por código: el plan exclusivo tiene **un solo
  suscriptor**, así que el radio de explosión del cron es exactamente ese aliado
  —que es el comportamiento deseado—. Editar el precio del plan exclusivo **ES**
  renegociar el acuerdo, no un accidente. La formulación general sigue valiendo:
  ningún proceso automático puede modificar un monto acordado por su cuenta
  (OQ-4).
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
- **I-6 — Un plan negociado no se ve fuera del admin.** Es I-3 aplicado a la
  pieza 4: si el monto acordado es privado, el plan que lo lleva también lo es.
  No puede aparecer en la respuesta de ningún endpoint público, ni en la página
  de precios de anfitriones, ni en la de aliados. Esto **no es cierto hoy** y es
  lo primero que hay que construir (§6.4.2, F1 en §12).

### 6.3 La hipótesis que la spec traía, y por qué se descartó

La spec proponía mirar de frente esta hipótesis:

> **negociado ⟹ fuera de MercadoPago**

Si el aliado que negocia precio fuera, en la práctica, el mismo que paga en
efectivo o por cheque, los dos huecos colapsaban en un mecanismo solo y la trampa
de §5.1 desaparecía sin tocar el cron.

**El dueño la descartó (OQ-2, 2026-09-04)**, y el motivo es el costo que la
propia spec le había puesto: *«pierde el cobro recurrente automático justo con
quien más paga»*. Un municipio que negocia un monto alto es exactamente el aliado
al que menos conviene obligar a un trámite manual todos los meses.

La tercera vía elegida —§6.4— **consigue las dos cosas**: neutraliza la trampa
de §5.1 igual de bien, pero sin quitarle el débito automático al aliado.

### 6.4 La decisión de OQ-2 — un plan exclusivo por aliado

La propuesta, textual del dueño (2026-09-04):

> «por cada partner yo negocio el precio y quiere pagar con MP, le creo un plan
> exclusivo para ese partner y se usa ese, y todos los planes de ese tipo se
> filtran en todos lados, solo lo ve un admin para asignárselo a un partner»

Es la opción que §5.5 había descartado («un plan por segmento»), con la pieza que
la hacía inviable puesta encima: los planes negociados **no se ven en ningún lado
salvo el admin**, así que la objeción política —una municipalidad viendo que paga
5× lo del almacén— desaparece.

#### 6.4.1 Por qué es mejor que lo que la spec recomendaba

**Neutraliza la trampa de §5.1 sin tocar el cron.**
`propagate-plan-price-changes.job.ts:442-467` enumera suscriptores **por
`planId`**. Con un único suscriptor, el radio de explosión del cron es
exactamente ese aliado — que es el comportamiento deseado, no un daño colateral.
Editar el precio del plan exclusivo **es** renegociar el acuerdo, y que el cron
lo empuje a MercadoPago es justamente lo que se quiere que pase.

De ahí se siguen tres ventajas sobre la recomendación anterior:

1. **No hay flag que mantener ni filtro que alguien pueda olvidar** en las dos
   consultas del cron. La defensa es estructural, no por código.
2. **El aliado conserva el débito automático**, que era el costo que la
   recomendación anterior le trasladaba al dueño (§6.3).
3. **El checkout no se toca** (§6.4.3).

#### 6.4.2 Lo que hay que construir — «se filtran en todos lados» es FALSO hoy

Se auditó el diseño contra el código y esta parte de la propuesta **no se cumple
hoy**. Son tres cosas, y las tres tienen evidencia:

**(1) `createPlan` NO expone `productDomain`. Bug vivo, independiente de este
issue.**
`CreatePlanInput`
(`packages/service-core/src/services/billing/plan/plan.types.ts:21-50`) no tiene
el campo, y el insert de `createPlan` (`plan.crud.ts:458-476`) no lo setea.
Verificado por grep: `productDomain` sólo se escribe desde el seed y desde
data-migrations, **nunca desde la ruta admin**.

> **Consecuencia**: un plan creado hoy vía
> `POST /api/v1/admin/billing/plans` cae con `product_domain = 'accommodation'`
> (el default de la columna) y **aparece en la página de precios de
> ANFITRIONES** — la superficie pública más visitada del sitio.

Esto pasa hoy, sin esta spec, con cualquier plan que un admin cree a mano. Ver
R-9 y la recomendación de §12 sobre si sale como issue propio.

**(2) `product_domain` no alcanza para ocultar.**
`GET /api/v1/public/plans?domain=partner`
(`apps/api/src/routes/billing/public/listPlans.ts:37-52,142-186`) es **público**
(`skipAuth: true`) y devuelve **todos** los planes activos de ese dominio,
completos y con precio. El filtro `SELLABLE_PARTNER_PLAN_SLUGS` de `apps/web`
(`audience-plans.ts:226,334-337`) es **cosmético**: corre del lado del cliente y
no protege la API cruda.

Hace falta, entonces, una **marca de visibilidad individual** por plan. La vía
más barata **no necesita migración**: `billing_plans.metadata` ya es `jsonb`.

> Detalle del mismo handler a tener en cuenta al diseñar el filtro: si la query
> de dominio falla, `accommodation` sirve la lista **SIN filtrar** (fail-open,
> deliberado desde HOS-685 para no romper la página de precios) mientras todos
> los demás dominios devuelven vacío (fail-closed). El filtro de ocultamiento
> **no puede heredar esa asimetría**: un plan negociado tiene que desaparecer en
> los dos modos.

**(3) Ningún test valida un plan creado a mano.**
Toda la batería de `packages/billing/test/*` protege el catálogo **escrito en
código** (`ALL_PLANS` congelado en 6, los guards de tier que iteran
`PartnerTierEnum`). Un plan que nace en la base no lo mira nadie.

Hace falta un **guard que falle en CI** si un plan marcado como oculto aparece en
una respuesta pública. El daño acá es político y silencioso: nadie va a abrir un
ticket para avisar que vio el precio de la municipalidad.

#### 6.4.3 Lo que ya funciona sin cambios (verificado)

- **El checkout resuelve el plan por ID arbitrario.** `billing.plans.get(planId)`
  en `subscription-checkout.service.ts:1116-1163`: un plan exclusivo se soporta
  **sin tocar código**.
- **El `preapproval_plan` de MercadoPago se materializa en el primer checkout**,
  no al crear el plan (`resolveCheckoutMpPlanId`, líneas 1151-1163). Un plan
  exclusivo que nadie paga no crea nada del lado de MP.
- **Los guards de conteo congelado no se rompen**: los planes de partner nunca
  entran a `ALL_PLANS`
  (`packages/billing/test/config/partner-tier-plans.test.ts:64-77`).
- **El selector de plan de la ficha de partner ya filtra bien** y es reutilizable:
  `apps/api/src/routes/partners/admin/list-plans.ts:23-99` hace
  `eq(productDomain, PARTNER)` bajo `PARTNER_MANAGE`.

#### 6.4.4 Lo que NO se sabe y lo que se acepta

- **No se encontró límite documentado de `preapproval_plan` por cuenta en
  MercadoPago.** Se escribe como **no se sabe**: ni se inventa un número ni se da
  por ilimitado. Si el volumen de aliados crece, hay que medirlo antes de asumir.
- **Degradación conocida y aceptada**: `BillingPlanSearchSchema`
  (`packages/schemas/src/api/billing/billing-plan.schema.ts:189-204`) **no filtra
  por dominio**, así que N planes exclusivos ensucian el listado de planes del
  admin. Es ruido interno, no una fuga: se acepta.

### 6.5 El plan exclusivo NO reemplaza el efectivo ni el cheque

Que OQ-2 se haya resuelto **no cierra el hueco 2** (§2.3), y conviene decirlo con
todas las letras porque es el malentendido más fácil de esta spec:

- Quien paga **con MercadoPago** a precio negociado va por el **plan exclusivo**.
- Quien paga **en efectivo o por cheque** sigue necesitando `manual-payment`
  completo, con monto, fecha, medio, comprobante y período — más el registro de
  pagos y el `endsAt` derivado.

Son **dos caminos vivos**, y la landing promete los dos (§5.4). El bug del
`endsAt` (§2.4) pertenece al segundo camino y el plan exclusivo no lo roza.

## 7. Data model / contracts

La forma que sigue **ya no es tentativa**: es la que corresponde a las decisiones
de §11 (OQ-1a + OQ-2 «plan exclusivo» + OQ-3a + OQ-4b/c + OQ-5a).

### Cambios estructurales

| tabla | cambio | notas |
|---|---|---|
| `partners` | `+ negotiated_amount_centavos` (integer, null) | El acuerdo. `null` = precio de lista (I-2). Entero en centavos, como todo el dinero del repo |
| `partners` | `+ negotiated_amount_effective_from` (timestamptz, null) | La constancia que pide OQ-4c: desde cuándo rige el monto vigente. Barato, y deja el rastro por si la lectura legal termina siendo (a) |
| `partners` | `+ negotiated_currency` (varchar(3), null) | Sólo si el acuerdo puede no ser ARS. Si no, se omite |
| `partner_payments` | **tabla nueva** | Ver abajo |
| `billing_plans` | **sin migración** | La marca de ocultamiento va en `metadata` (`jsonb`, ya existe). Ver abajo |

### La marca de plan oculto (pieza 4)

No hace falta columna: `billing_plans.metadata` ya es `jsonb`. Una clave del
estilo `metadata.adminOnly: true` (nombre exacto a fijar en implementación)
alcanza, y **el filtro tiene que aplicarse del lado del servidor**, en la
respuesta del endpoint público, nunca en `apps/web` — el filtro cosmético que ya
existe ahí no protege la API cruda (§6.4.2).

Reglas del filtro, las tres necesarias:

1. Se aplica en `apps/api/src/routes/billing/public/listPlans.ts`, **antes** de
   devolver, para **todos** los dominios.
2. **Falla cerrado en los dos modos.** No hereda la asimetría del filtro de
   dominio: si la marca no se pudo resolver, el plan no se sirve. Un catálogo
   público al que le falta un plan es recuperable; un precio negociado publicado,
   no.
3. Está cubierto por un **guard que corre en CI** (§6.4.2 punto 3) y por AC-13.

### `productDomain` en el CRUD de planes del admin

`CreatePlanInput` suma `productDomain` (requerido, sin default silencioso) y
`createPlan` lo escribe en el insert. Es el arreglo del bug de §6.4.2 punto 1 y
es **prerrequisito** de crear cualquier plan exclusivo: sin él, el primer plan
negociado nace en `accommodation` y sale publicado en la página de anfitriones.

### `partner_payments` (camino externo, hueco 2)

Propiedad de Hospeda, no de qzpay:

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
| `POST` | `/api/v1/admin/billing/plans` | ya existe; suma `productDomain` al input y a la validación |
| `GET` | `/api/v1/public/plans` | ya existe; **se le agrega el filtro de planes ocultos**, del lado del servidor |

Los de partner y los de plan van bajo `PermissionEnum.PARTNER_MANAGE` y el
permiso de billing que ya gatea el CRUD de planes respectivamente. El selector de
plan de la ficha del partner ya existe y filtra bien
(`routes/partners/admin/list-plans.ts:23-99`): es el lugar natural desde donde un
admin asigna el plan exclusivo, y **no hay endpoint nuevo para eso**.

### Migraciones

Carril estructural (`pnpm db:generate` + `db:migrate`) para las columnas de
`partners` y para `partner_payments`. **La marca de plan oculto no lleva
migración**: vive en `metadata`.

No hay cambio de datos sembrados, así que **la regla de dual-write del seed no
aplica** — no hay baseline que editar ni data-migration que escribir. Los planes
exclusivos **no se siembran**: nacen desde el admin, uno por acuerdo.

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
- **Alta de plan en el admin** — el formulario de creación de plan suma
  **dominio de producto** (obligatorio, sin default silencioso: hoy la ausencia
  del campo es lo que hace que un plan nuevo nazca en `accommodation`) y la
  **marca de plan oculto**. Un plan marcado como oculto tiene que verse como tal
  en el listado de planes del admin, para que nadie lo confunda con catálogo.
- **Asignación al aliado** — se hace desde el selector de plan que ya existe en
  la ficha del partner. No hay pantalla nueva.
- **Nada de esto sale a la web.** El panel del aliado no muestra ni el monto
  acordado ni el historial de pagos (I-3), y **ninguna superficie pública muestra
  un plan oculto** (I-6). Toda copy nueva del admin sigue la convención del
  panel; no hace falta i18n público.

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
  (Es la inmunidad del camino externo, que no crea filas de suscripción; sigue
  valiendo aunque el camino de MercadoPago ya no dependa de ella.)
- **AC-8** — Editar el precio de un plan **de catálogo** (`partner-gold`,
  `partner-silver`) y correr el cron de propagación de punta a punta **no cambia**
  el monto de ningún aliado que esté en un **plan exclusivo**. Se ejerce con dos
  aliados sembrados: uno en catálogo, uno en plan exclusivo; después del cron sólo
  el primero cambió.
- **AC-8b** — Editar el precio del **plan exclusivo** y correr el cron cambia el
  monto de **exactamente un** suscriptor: el aliado dueño de ese plan. Es la otra
  mitad de AC-8 y afirma la propiedad que hace viable el diseño (§6.4.1): el radio
  de explosión del cron es el acuerdo mismo.
- **AC-9** — `negotiatedAmountCentavos` no aparece en la respuesta de ningún
  endpoint público ni en la del panel del propio aliado (I-3), verificado contra
  el schema de salida, no contra una llamada de ejemplo.
- **AC-10** — Un partner sin monto acordado se cobra al precio de lista de su
  plan, igual que hoy (I-2).
- **AC-11** — El detalle del partner en el admin muestra el historial con los
  pagos ordenados por fecha descendente y el medio de cada uno.

Los que siguen son los que trajo la decisión de OQ-2 (el plan exclusivo, §6.4):

- **AC-12** — `createPlan` con `productDomain: 'partner'` persiste
  `billing_plans.product_domain = 'partner'`. Y una creación **sin** dominio
  explícito es rechazada con 400: hoy cae silenciosamente en `accommodation`
  (§6.4.2 punto 1), y esa es exactamente la falla que este criterio prohíbe.
- **AC-13** — Un plan marcado como oculto **no aparece** en la respuesta de
  `GET /api/v1/public/plans` para **ningún** valor de `?domain=`, incluido el
  default `accommodation`. Se ejerce además con la query de dominio forzada a
  fallar: el plan oculto sigue sin aparecer en los dos modos (fail-closed, §7).
- **AC-14** — **Guard con mutación, corre en CI**: borrar el filtro de planes
  ocultos del handler público tiene que poner el guard en rojo. Sin esto la
  protección es una línea que cualquier refactor puede llevarse puesta sin que
  nadie se entere — el daño es político y silencioso, nadie abre un ticket para
  avisar que vio el precio de la municipalidad.
- **AC-15** — Un aliado asignado a un plan exclusivo completa el checkout de
  partner contra el stub de MercadoPago y el preapproval se crea con el monto del
  plan exclusivo, **sin ningún cambio en `subscription-checkout.service.ts`**.
  (Afirma §6.4.3: el checkout resuelve el plan por ID arbitrario.)
- **AC-16** — **Guard estático**: ninguna escritura a
  `partners.negotiated_amount_centavos` existe fuera de la ruta admin de
  actualización de partner. Es OQ-4 hecho ejercible: ningún proceso automático
  modifica un monto acordado.

Criterios que **no** entran porque no se pueden ejercer: nada sobre «el aliado
percibe», nada sobre montos reales de producción, y nada sobre el
comportamiento de MercadoPago que no se pueda probar contra el stub o contra el
sandbox en un smoke declarado. En particular **no hay criterio sobre la cantidad
máxima de `preapproval_plan` por cuenta**: no se encontró límite documentado, y
afirmar «soporta N planes exclusivos» sería inventarlo (§6.4.4).

## 10. Risks

- **R-1 — La trampa del cron de propagación. Era el riesgo número uno; la
  decisión de OQ-2 lo desarma.**
  En castellano: *hoy, si alguien edita el precio de un plan de aliados desde el
  admin, un proceso automático le reescribe el monto a todos los aliados que
  estén en ese plan y tengan una suscripción activa en MercadoPago.* No pregunta
  si ese monto se había acordado distinto, porque no tiene forma de saberlo.

  **Con un plan exclusivo por aliado el riesgo se convierte en el comportamiento
  deseado**: el cron enumera por `planId`, y si el plan tiene un solo suscriptor,
  editar su precio es renegociar ese acuerdo y nada más (§6.4.1). No queda flag
  que mantener ni filtro que olvidar.

  **Lo que sobrevive del riesgo**, y por eso AC-8 y AC-8b siguen escritos: que
  alguien deje a un aliado con precio negociado sobre un plan **de catálogo**
  compartido. Ahí la trampa vuelve entera. La defensa es de proceso —negociar
  precio implica plan exclusivo— y los dos criterios la vigilan desde los dos
  lados.

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

- **R-9 — Un plan creado desde el admin nace en `accommodation` y se publica en
  la página de anfitriones. Bug vivo, hoy, independiente de esta spec.**
  `CreatePlanInput` no expone `productDomain` y `createPlan` no lo escribe
  (§6.4.2 punto 1, verificado): el default de la columna hace el resto. Cualquier
  plan que un admin cree hoy a mano —negociado o no— aparece en la superficie
  pública más visitada del sitio, con su precio. **Es prerrequisito duro de esta
  spec**: sin arreglarlo, el primer plan exclusivo que se cree publica el acuerdo
  que venía a ocultar. Recomendación sobre dónde vive el arreglo: §12.

- **R-10 — «Se filtran en todos lados» todavía no es cierto, y el filtro que hay
  es cosmético.** `GET /api/v1/public/plans` es público y devuelve todos los
  planes activos del dominio pedido, con precio; el `SELLABLE_PARTNER_PLAN_SLUGS`
  de `apps/web` corre del lado del cliente y no protege la API cruda (§6.4.2
  punto 2). Y ningún test mira un plan creado a mano (punto 3). El modo de falla
  es el peor de los que tiene esta spec: **silencioso y político**. Nadie abre un
  ticket para avisar que vio el precio de la municipalidad. De ahí I-6, AC-13 y
  el guard de AC-14.

- **R-11 — Riesgo que NO existe, y conviene decirlo para que nadie lo persiga:
  un plan de partner con `entitlements: []` no está roto.**
  Podría parecer que crear planes de partner a mano expone al problema de HOS-973
  (planes que no otorgan nada por el motor de entitlements). **Para el dominio
  `partner` ese riesgo no existe.** `PARTNER_SILVER_PLAN` y `PARTNER_GOLD_PLAN`
  tienen `entitlements: []` **a propósito**, con comentario explícito en
  `packages/billing/src/config/plans.config.ts:1287-1289`: *«partner visibility is
  driven by the subscription status and the partner row's own
  lifecycle/subscription columns, NOT by the entitlement engine»*. La visibilidad
  del aliado la deciden `subscriptionStatus` y `lifecycleState` de la fila de
  `partners`, no el motor.
  **Dónde SÍ aplicaría**: en `gastronomy` y `experience`, que desde HOS-1074 sí
  leen entitlements. Queda anotado para el día que alguien quiera generalizar el
  precio negociado a esos verticales (NG-3) — ahí un plan exclusivo con
  `entitlements: []` sí dejaría el listado a oscuras.

- **R-12 — Proliferación de planes en el listado del admin.**
  `BillingPlanSearchSchema` no filtra por dominio
  (`packages/schemas/src/api/billing/billing-plan.schema.ts:189-204`), así que N
  planes exclusivos ensucian la pantalla de planes del admin. **Degradación
  conocida y aceptada** (§6.4.4): es ruido interno, no una fuga. Si el volumen
  molesta, agregar el filtro por dominio a ese schema es una mejora chica y
  aparte.

## 11. Decisiones (ex Open questions)

**Las cinco están resueltas. Decididas por el dueño el 2026-09-04.** Se dejan
enteras —opciones, contras y recomendación original— y no borradas: el registro
de por qué se eligió cada cosa es lo que evita re-litigarlo en tres meses.

| # | Pregunta | Decisión | ¿Como recomendaba la spec? |
|---|---|---|---|
| OQ-1 | ¿Dónde vive el precio negociado? | (a) Columna en `partners` | Sí |
| OQ-2 | ¿El precio negociado pasa por MercadoPago? | **Sí, vía un plan exclusivo por aliado** | **No — tercera vía no contemplada** |
| OQ-3 | ¿`manual-payment` se extiende o se reemplaza? | (a) Extender, + registro de pagos | Sí |
| OQ-4 | ¿La Disposición 954/2025 aplica al precio negociado? | (b) + constancia de (c); lectura acotada | Sí |
| OQ-5 | ¿Hace falta historial de pagos por aliado? | (a) Sí, entidad propia | Sí |

---

### OQ-1 — ¿Dónde vive el precio negociado? · ✅ RESUELTA (2026-09-04)

> **Decisión: (a), columna en `partners`.** Aprobada tal como la spec la
> recomendaba. El acuerdo es un hecho del aliado, no de una suscripción.

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

**Cómo se resolvió**: el dueño no anticipa precio negociado en otros verticales
por ahora (NG-3 sigue en pie), así que la generalidad de (b) no compraba nada
contra el costo de meter el monto adentro del radio del cron. Además la decisión
de OQ-2 vuelve el punto discutible: el monto que MercadoPago cobra sale del plan
exclusivo, y la columna en `partners` es el **registro del acuerdo** —el número
que un admin mira para saber qué se negoció y cuánto poner en el plan—, no la
fuente que alimenta al cobro.

---

### OQ-2 — ¿El precio negociado pasa por MercadoPago? · ✅ RESUELTA (2026-09-04)

> **Decisión: sí — vía un PLAN EXCLUSIVO por aliado.**
> **Esta es la única de las cinco que NO se resolvió como la spec recomendaba.**
> El dueño propuso una tercera vía que ninguna de las tres opciones de abajo
> contemplaba, y es mejor que la recomendación. El diseño completo está en §6.4;
> acá queda el registro de la deliberación.

Textual del dueño:

> «por cada partner yo negocio el precio y quiere pagar con MP, le creo un plan
> exclusivo para ese partner y se usa ese, y todos los planes de ese tipo se
> filtran en todos lados, solo lo ve un admin para asignárselo a un partner»

#### Las tres opciones que la spec había planteado

| # | Opción | A favor | En contra |
|---|---|---|---|
| a | **Negociado ⟹ siempre fuera de MP** (efectivo, cheque, transferencia), registrado a mano | Colapsa los dos huecos en un mecanismo. **La trampa R-1 desaparece por construcción**: sin `mp_subscription_id` esas filas son invisibles para las dos consultas. Sin subidas automáticas, no hay Disposición 954 que resolver. Es lo que la landing ya ofrece y lo que un municipio probablemente prefiera | Pierde el cobro recurrente automático justo con quien más paga. Un aliado que quiere autodébito **a precio negociado** no tiene camino |
| b | Negociado también por MP, mutando el `transaction_amount` del preapproval | Cobro automático a precio propio | Reusa la maquinaria de HOS-176, que es la misma que después lo pisa: hay que construir la exclusión (R-1). Recordar que **las fechas del preapproval son inmutables y el monto tiene piso de $15**. Y arrastra R-2: el aviso legal iría a un correo inválido |
| c | Las dos, según el aliado | Cubre todo | Dos caminos vivos desde el día uno, con el doble de superficie a probar |

La recomendación era **(a) para la primera entrega, con (c) como destino**, y su
razonamiento era que (a) *«compra la inmunidad a R-1 sin escribir una línea de
defensa»*. La spec cerraba diciendo que lo que había que decidir de verdad no era
técnico: **si el dueño aceptaba que negociar precio implicara cobrar por fuera**.

#### La cuarta opción, que es la elegida

| # | Opción | A favor | En contra |
|---|---|---|---|
| **d** | **Un plan exclusivo por aliado, invisible fuera del admin** | Consigue las dos cosas que (a) y (b) se repartían: **neutraliza la trampa del cron sin tocar el cron** —enumera por `planId`, y con un único suscriptor el radio de explosión es exactamente ese aliado, que es el comportamiento deseado— **y el aliado conserva el débito automático**. No hay flag que mantener ni filtro que alguien pueda olvidar: la defensa es estructural. Editar el precio del plan exclusivo **ES** renegociar el acuerdo. El checkout y el cron no se tocan (§6.4.3) | Revive «un plan por segmento», que §5.5 había descartado — pero le agrega lo que la hacía inviable: que esos planes no se vean en ningún lado salvo el admin, con lo que la objeción política desaparece. **Y exige construir el ocultamiento, que hoy no existe** (§6.4.2): tres cosas, con un bug vivo de por medio (R-9) |

**Por qué gana a la recomendación (a)**: (a) compraba la inmunidad al precio de
quitarle el débito automático a quien más paga. (d) compra la misma inmunidad y
no cobra ese precio. El costo que sí tiene —construir la marca de ocultamiento y
su guard— es trabajo acotado, verificable y con AC propios (AC-13, AC-14).

**Lo que esta decisión NO cierra**: el hueco 2. El plan exclusivo es el camino de
**MercadoPago**; quien paga en efectivo o por cheque sigue necesitando
`manual-payment` completo, y el bug del `endsAt` (§2.4) sigue en pie. Ver §6.5.

---

### OQ-3 — ¿`manual-payment` se extiende o se reemplaza? · ✅ RESUELTA (2026-09-04)

> **Decisión: (a), extender, más el registro de pagos de OQ-5.** Aprobada tal
> como la spec la recomendaba. Sigue vigente entera después de OQ-2: es el camino
> de cobro externo, que el plan exclusivo no reemplaza (§6.5).

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

### OQ-4 — ¿La Disposición 954/2025 aplica al precio negociado? · ✅ RESUELTA (2026-09-04)

> **Decisión: la lectura acotada — (b) reforzada con la constancia de (c).**
> Aprobada tal como la spec la recomendaba. Lo que la ingeniería firma es una
> sola cosa, y es ejercible: **prohibir que cualquier proceso automático
> modifique un monto acordado** (AC-16). La fecha de vigencia se guarda
> (`negotiated_amount_effective_from`, §7).
>
> **Nota tras OQ-2**: el plan exclusivo no contradice esto. El cron sí puede
> empujar a MercadoPago un cambio de precio del plan exclusivo — pero ese cambio
> **lo tipeó un admin después de renegociar**, no lo originó un proceso
> automático. La prohibición es sobre el origen del cambio, no sobre el
> mecanismo que lo transporta.

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

### OQ-5 — ¿Hace falta historial de pagos por aliado en el admin? · ✅ RESUELTA (2026-09-04)

> **Decisión: (a), sí, entidad propia de pagos.** Aprobada tal como la spec la
> recomendaba. Es la pieza de la que dependen el vencimiento (G-3) y el historial
> (G-4).

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

### El bug del vencimiento: dentro de esta spec, tarea propia, junto al dato real

**Recomendación explícita**, porque el tech lead la pidió: va **adentro** de esta
spec, como tarea separada, **en F4** — la fase que trae el período de pago del
que la fecha de vencimiento se deriva. (La spec decía «primera fase» cuando el
camino externo era F1; el reordenamiento de fases lo movió a F4, pero la razón no
cambió: el arreglo llega con el dato real, no antes.)

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

### El bug de `productDomain` (R-9): ¿issue propio o dentro de esta spec?

**Recomendación: issue propio, abierto ya, y bloqueante de F2 de esta spec.**

Las dos cosas a la vez, y no es contradictorio:

- **Issue propio** porque el bug es **anterior e independiente**: existe hoy,
  afecta a cualquier plan que un admin cree a mano —negociado o no—, y su daño
  (un plan cualquiera publicado en la página de precios de anfitriones) no tiene
  nada que ver con precio por aliado. Enterrarlo adentro de esta spec lo vuelve
  invisible para quien busque «por qué apareció este plan en la home» dentro de
  seis meses, y lo ata a una spec que puede demorarse.
- **Bloqueante de F2** porque sin él el primer plan exclusivo que se cree publica
  el acuerdo que venía a ocultar. La relación en Linear es `blocks`, no
  «subtarea».

Si el dueño prefiere una sola unidad de trabajo, la alternativa aceptable es
dejarlo como tarea propia dentro de F2 con su propio PR — lo que **no** es
aceptable es mezclarlo en el mismo PR que el resto de F2, porque es el arreglo
que hay que poder verificar y revertir solo.

### El bug del `endsAt` (§2.4): sigue en pie, y OQ-2 no lo toca

Vale repetirlo acá porque es el malentendido más caro posible de esta spec: **el
plan exclusivo no arregla el aliado que nunca vence**. Un aliado sobre
MercadoPago nunca dependió de `endsAt` —el preapproval es su reloj—; el que
queda activo para siempre es el que pagó en efectivo. Lo cierra F4 y sólo F4.

### Plan por fases

**Arranca por lo que protege**, para que nunca exista un plan negociado sin el
candado puesto. Éste es el orden que aprobó el dueño (2026-09-04).

| Fase | Depende de | Qué |
|---|---|---|
| **F0** | **nada** | (1) Guard con mutación sobre `mp_subscription_id IS NOT NULL` en las dos consultas de propagación (AC-7). (2) Contar la población de `ends_at IS NULL` en staging y producción. (3) Abrir el issue de R-9 (`productDomain`), el de R-5 (anual prometido, mensual implementado) y el de R-2 (aviso legal a correo inválido) |
| **F1 — el candado** | F0 | **Primero lo que protege.** Marca de plan oculto en `billing_plans.metadata` + filtro server-side en `GET /api/v1/public/plans`, fail-closed en los dos modos + **guard que corre en CI** y muere si alguien saca el filtro. Cierra I-6. AC-13, AC-14 |
| **F2 — el dominio** | F1, R-9 | `productDomain` en `CreatePlanInput` y en el insert de `createPlan`, obligatorio y sin default silencioso; el formulario de alta de plan del admin lo pide. AC-12. **Es el arreglo de R-9**, y va en su propio PR (ver arriba) |
| **F3 — el primer plan exclusivo real** | F1, F2 | Recién acá. Columna `negotiated_amount_centavos` + `negotiated_amount_effective_from` en `partners`, privacidad (I-3), asignación desde el selector que ya existe, y el checkout verificado de punta a punta contra el stub. Cierra G-1 y G-6. AC-8, AC-8b, AC-9, AC-15, AC-16 |
| **F4 — el camino externo** | OQ-3, OQ-5 (ya resueltas) | `partner_payments` + `manual-payment` ampliado + `endsAt` derivado del período + historial en el detalle del admin. Cierra G-2, G-3, G-4, G-5 y el bug de §2.4. **Independiente de F1-F3**: no comparte código con el plan exclusivo y puede correr en paralelo si hay dos manos |

La razón del orden: F1 y F2 son los únicos que fallan **en silencio y hacia
afuera**. Un plan exclusivo creado antes de tiempo publica un precio negociado en
la home de anfitriones y nadie se entera hasta que un aliado lo menciona. Todo lo
demás falla hacia adentro.

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
- **Smoke**: F1, F2 y F4 son local-first (nada depende de MercadoPago real; el
  filtro público y el guard de CI se ejercen enteros contra la base local). **F3
  lleva smoke de staging obligatorio** contra el sandbox de MP: es un checkout
  real sobre un plan creado a mano, y el stub no puede decir si MercadoPago
  acepta ese `preapproval_plan`. Entra además en la lista de PRs que tocan el
  core de billing.
- **El plan exclusivo no se siembra ni se versiona en código.** No entra a
  `ALL_PLANS` (los de partner nunca entraron) ni a ninguna data-migration: nace
  desde el admin, uno por acuerdo. Por eso los guards de conteo congelado siguen
  verdes sin tocarlos.

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

Familia: HOS-973 (planes que no otorgan nada por el motor de entitlements) —
**pero ojo con la analogía**: para el dominio `partner` ese problema no aplica,
porque los planes de aliado tienen `entitlements: []` a propósito y la
visibilidad la deciden las columnas de la fila de `partners`. Ver R-11, que
explica dónde sí aplicaría (`gastronomy`/`experience`, desde HOS-1074) por si
alguna vez se generaliza el precio negociado a esos verticales. HOS-1074
(commerce leyendo entitlements) es la referencia de ese caso futuro.

Derivados propuestos, a abrir aparte:

- **R-9 — `createPlan` no escribe `product_domain`**, así que todo plan creado
  desde el admin nace en `accommodation` y se publica en la página de precios de
  anfitriones. **Bug vivo, anterior a esta spec, y bloqueante de F3.** Es el más
  urgente de los tres. Recomendación de dónde vive: §12.
- **R-5** — el anual de aliados que la landing promete y el checkout no soporta.
- **R-2** — el aviso legal de subida que se manda a
  `partner-<id>@partners.hospeda.invalid`.
