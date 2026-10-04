---
title: "FASE 8 completa · C2 — Liberación, coexistencia y migración"
linear: HOS-1352
statusSource: linear
created: 2026-09-24
updated: 2026-09-24
status: CURRENT
fase: 8
---

# FASE 8 completa · C2 — Liberación, coexistencia y migración

Ataqué el programa entero por el lado del corte: qué pasa el día que las dos épicas salen juntas
(`DEC-ARCH-007`), con el sistema viejo todavía vivo en el proveedor, en la base y en un contenedor
que sigue sirviendo tráfico durante el rollout. Partí de `B/21`, `V/21`, `11-particion…`,
`12-contrato…` y las `DEC-ARCH-004..007` y `DEC-MIG-001..004` del log, y contrasté cada premisa
contra el código que corre hoy en `$R/apps` y `$R/packages`, que es lo que el corte tiene que
apagar.

Salen **9 hallazgos**: **2 `CRITICA`**, **2 `ALTA`**, **4 `MEDIA`** y **1 `BAJA`**. Respeté los
cinco defectos que `DEC-MIG-004` declaró con causa (#1, #7, #15, #16, #17) y no los re-levanto;
donde un hallazgo roza a uno de ellos, digo por qué su causa no lo cubre.

**Lo más grave, en una línea: el corte cancela los preapprovals que NUESTRA base conoce, pero el
sistema viejo crea cobros que nuestra base no conoce —los `preapproval_plan` con enlace público
siguen vivos y las autorizaciones de Path C que nunca se vincularon no tienen id—, y los dos
terminan en el único camino automático que el diseño nuevo tiene para un desconocido: re-vincularlo
a la suscripción nueva de esa persona, que es el doble cobro que la lápida venía a evitar.**

Regla de lectura: cada hallazgo se apoya en una cita textual. Donde una medición de la matriz
sostiene el ataque, va su id de fila. Aclaración de alcance: `16-fase-7-del-paraguas.md` está
fuera de lo que puedo leer; cuando cito el procedimiento del corte, cito el resumen que el log hace
de su §4 (`DEC-MIG-003`), no el documento.

---

## CRITICA

### F-8CC2-001 — Los `preapproval_plan` del sistema viejo siguen vendiendo después del corte, y cada alta que entra por ellos cobra y se re-vincula sola a la suscripción nueva

**Qué se rompe.** Plata real cobrada dos veces, o cobrada sin servicio. El checkout que corre hoy
en producción no crea el preapproval: manda al cliente a un **enlace público y estable** de un
`preapproval_plan` de Mercado Pago. Ese enlace no pasa por nuestra API, así que sigue funcionando
después del corte mientras el plan esté activo en el proveedor. El diseño nuevo **no usa** planes
del proveedor (`DEC-MP-007`) y, por eso mismo, **ningún capítulo los nombra como algo que hay que
retirar**: el corte cancela preapprovals, no planes.

**El camino.**

1. Antes del corte, Juan abrió el checkout de Alojamiento y no terminó. En su historial, en un
   correo o en una pestaña queda la URL
   `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=…`.
2. Corte: se cancelan en el proveedor las suscripciones que tienen id, se verifica, se despliega y
   se escriben las lápidas (`DEC-MIG-003`). El `preapproval_plan` no es una suscripción, así que
   ningún paso lo toca.
3. Días después Juan vuelve a esa URL y autoriza. Mercado Pago crea un preapproval nuevo con los
   términos del plan viejo (monto y ciclo del catálogo viejo, y `free_trial` si ese plan se
   provisionó con trial) y cobra según ellos.
4. Llega el webhook de un preapproval que el sistema nuevo no conoce. Para un desconocido el
   diseño tiene **un solo camino automático, re-vincular**, y el candidato más plausible es la
   suscripción nueva de Juan si ya contrató por el camino nuevo (`B/21` §2.5). **Pagó dos veces
   y el sistema registra una.** Si todavía no contrató, queda un cobro sin servicio que sólo una
   persona descubre.
5. No hay lápida que lo reconozca: el preapproval nació después del corte, así que no está en
   ningún censo.

**Dónde lo permite el diseño.**

`apps/api/src/services/subscription-checkout.service.ts:17-21` (el código que el corte apaga):

```text
 *  - **Path C (flag off, live in production).** No preapproval is created
 *    server-side. The checkout resolves/provisions a MercadoPago
 *    `preapproval_plan`, materializes a `pending_provider` local subscription
 *    plus a `billing_pending_checkouts` correlation row, and redirects to that
 *    plan's HOSTED share link, where MercadoPago collects the card.
```

`apps/api/src/services/billing/mp-plan-provisioning.service.ts:558-565`:

> const params = new URLSearchParams({ preapproval_plan_id: input.mpPreapprovalPlanId });
> …
> return `https://www.mercadopago.com.ar/subscriptions/checkout?${params.toString()}`;

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:4963-4967` (`DEC-MP-007`):

> `preapproval_plan` tiene **cero apariciones** en los capítulos de `HOS-1353`,
> `HOS-1354` y el núcleo (recontado el 2026-09-24). […]
>
> - **Decisión**: **cada preapproval se crea sin plan del proveedor**

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:2539-2541` (`DEC-MIG-003`, el
orden del corte):

> cancelar en el proveedor, **verificar releyendo por id**, desplegar, y recién entonces escribir las
> lápidas. El segundo paso es el gate: si alguno no se pudo cancelar, el corte no avanza.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:161-165`:

> **ese webhook llega como un
> preapproval desconocido**, y el sistema nuevo tiene **un solo camino automático** para un
> desconocido: re-vincularlo. El candidato más plausible del emparejamiento es **la suscripción nueva
> de esa misma persona**, que acaba de contratar. **El cobro viejo se imputa como pago del ciclo
> nuevo: pagó dos veces y el sistema registra una.**

Y el agravante sobre trials: `apps/api/src/services/subscription-checkout.service.ts:678-680`
documenta que el código viejo *«bakes `free_trial` into the MercadoPago `preapproval_plan` whenever
`trialDays > 0`»*. Un plan provisionado así antes de HOS-1012 que siga activo le hace pedir al
proveedor un trial que `B/06` §4.3 (*«Nunca se le pide un trial»*) prohíbe, sin que ningún guard del
diseño nuevo lo vea, porque el payload no sale de nuestro código.

**Severidad**: `CRITICA`. Es plata real, el camino no tiene fecha de vencimiento (un plan activo
vende hasta que alguien lo archive) y termina exactamente en el doble cobro que la lápida existe
para impedir. No lo cubre `DEC-MIG-004` #16: aquél habla de las altas que entran al sistema viejo
**durante** el rediseño y quedan en nuestra base; éstas entran **después** del corte y no quedan en
ninguna base.

**Necesita decisión del owner**: **no**. Es una corrección del procedimiento del corte: inventariar
en el proveedor los `preapproval_plan` que creó el sistema viejo y archivarlos antes de desplegar,
con relectura, con el mismo gate que el paso 2. Queda una pregunta de medición que la matriz no
tiene: si un plan archivado deja de aceptar autorizaciones por su enlace.

---

### F-8CC2-002 — El censo del corte sale de nuestra base, y la base vieja no tiene el id de las autorizaciones que nunca se vincularon

**Qué se rompe.** Un preapproval autorizado y vivo en el proveedor atraviesa el corte sin que nadie
lo cancele ni le escriba lápida. Cobra, y termina en la re-vinculación automática del `B/21` §2.5:
doble cobro o cobro sin servicio.

**El camino.**

1. Bajo Path C, el preapproval lo crea Mercado Pago cuando el cliente autoriza en la página
   hospedada. Nuestra fila recibe el id **después**, por `back_url` o por webhook.
2. Ana autoriza, pero el navegador no vuelve y el webhook no resuelve la fila. Es el bug vivo que
   `B/09` §5 registra en producción.
3. A los 30 minutos, el reaper viejo marca `abandoned` la fila que **no tiene
   `mp_subscription_id`**, sin llamar al proveedor, porque no tiene a quién llamar.
4. El censo del programa cuenta *«con compromiso de cobro vivo»* como `mp_subscription_id IS NOT
   NULL`, y de ahí sale *«las 3 `abandoned` no tienen nada vivo»*.
5. Corte: se cancelan y se releen **por id** sólo las tres que tienen id. El preapproval de Ana no
   tiene id en ningún lado, así que el gate del paso 2 da verde sobre un conjunto incompleto.
6. El preapproval de Ana cobra, llega como desconocido al sistema nuevo y se re-vincula a la
   suscripción que Ana acaba de contratar después de que el owner la llamó. Paga dos veces.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:45`:

> | **3 `abandoned`** | no tienen **nada vivo** que migrar: abandonaron el checkout |

`.specs/HOS-1352-billing-verticals-redesign/docs/07-facts-inventory.md:136` (la consulta de la que
sale el conteo):

> count(*) FILTER (WHERE mp_subscription_id IS NOT NULL) AS con_compromiso,

`apps/api/src/cron/jobs/abandoned-pending-subs.job.ts:25-26`:

```text
Rows with no `mp_subscription_id` (nothing to
 *   cancel) are abandoned directly.
```

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:597-598`:

> Hay un error real en producción —webhooks de suscripción que fallan porque el preapproval no
> resuelve a ninguna suscripción nuestra

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:51-52`:

> Una suscripción cuyo id se pierde es
> invisible para el barrido, y sólo reaparece si cobra y emite un webhook.

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:2539-2541`: el gate es
*«verificar releyendo por id»*, y releer por id no puede encontrar lo que no tiene id.

**Severidad**: `CRITICA`. Es plata real, y la población no es hipotética: el propio diseño registra
que existen webhooks de preapprovals sin fila (`B/09` §5). La premisa *«nada vivo»* es una lectura
de nuestra columna presentada como un hecho del proveedor, y ninguna fila de la matriz la
sostiene. No lo cubre `DEC-MIG-004` #15 (su sujeto es un cobro de *«uno de los tres
conocidos»*, que sí tienen id) ni el remedio telefónico: nadie llama por un preapproval que el
censo declara inexistente.

**Necesita decisión del owner**: **no**. El censo tiene que salir del proveedor además de la base.
El diseño ya tiene la consulta que funciona: `B/05` §1.2 pregunta *«¿este pagador tiene alguna
suscripción autorizada que yo no tenga registrada?»* por correo del pagador y estado. Hay que
correrla sobre cada pagador que alguna vez abrió un checkout, antes del paso 1.

---

## ALTA

### F-8CC2-003 — `inactiva_desde` no tiene valor legítimo para las fichas existentes, y el que la lista cerrada admite las manda al hard delete del día 180 en la primera corrida

**Qué se rompe.** Borrado irreversible del contenido publicable de fichas reales (textos, fotos,
FAQ), sin ninguno de los tres avisos previos, el mismo día del corte o al siguiente. Es la
operación que el propio diseño llama *«la única operación irreversible sobre datos del cliente de
todo el programa»*.

**El camino.**

1. `V/21` §2.4 cuenta con que las fichas existentes de Alojamiento **existen** en el modelo
   nuevo: se despublican y *«la ficha vuelve sola por `PB3`»*. Así que las filas de `listing`
   tienen que estar, con su contenido.
2. `listing.inactiva_desde` es **no anulable**, así que la migración estructural tiene que
   poblarla para las 12 fichas.
3. La columna *«se escribe en los cuatro hechos y en ninguna otra parte»*, y un guard (`G-R6-B`)
   pone en rojo cualquier escritura que no sea uno de los cuatro. El único hecho que aplica a una
   fila preexistente es el 1, *«crearla»*, y su instante es la fecha de creación.
4. Rosa, una de las anfitrionas, creó su ficha 200 días antes del corte y todavía no la llamaron.
   Su `inactiva_desde` queda en `created_at`, o sea hace 200 días.
5. Primera corrida: `PB4` relee `cubierto` (falso, está en `PRE_TRIAL`) y archiva. El reloj del
   día 180 relee (falso) y **borra el contenido**. Los avisos *«antes del día 90»* y *«antes del
   día 180»* caen en fechas pasadas.
6. `V/21` §2.4 acepta explícitamente que alguien tarde *«una semana»* en contratar. El borrado no
   espera esa semana.

La otra rama del implementador, poblar con `now()`, deja a Rosa a salvo pero **no es ninguno de
los cuatro hechos**: `G-R6-B` se pone en rojo y el guard obliga a elegir la rama destructiva.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:284`:

> **`inactiva_desde` no es anulable**: una ficha nace con el instante de su creación, que es el hecho 1

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:296`:

> **Se escribe en los cuatro hechos y en ninguna otra parte.**

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:54` (el hecho 1 se lee de un
registro que no tiene ningún evento de las fichas viejas):

> | 1 | un **acto del dueño** sobre la ficha: crearla, […] | el registro append-only de eventos de dominio (cap. 08 §1.3)

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:137-138`:

> **Qué se pierde, dicho sin adornos**: la ficha de cada uno está abajo **desde el corte hasta que esa
> persona contrata**. Si alguno tarda una semana, estuvo una semana afuera.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:293`:

> Lo que decide **la única operación irreversible sobre datos del cliente de todo el

Ninguna de las dos mitades del cap. 21 nombra `inactiva_desde` (buscado con `rg` sobre los dos
archivos: cero apariciones).

**Severidad**: `ALTA`, en el borde de `CRITICA`. No es plata ni acceso, pero es pérdida
irreversible de datos del cliente, y la única recuperación es restaurar a mano un dump. La condición
es concreta: basta una ficha creada más de 180 días antes del corte (más de 90 días la archiva en
la primera corrida). No lo cubre `DEC-MIG-004` #7 (*«la entidad `listing` no tiene camino
declarado»*, con la causa *«no se transcribe ninguna»*): `V/21` §2.4 necesita que las filas
existan para que `PB3` las devuelva, así que la causa no se sostiene para el caso en que sí
existen.

**Necesita decisión del owner**: **no**. Es corrección: declarar el valor de arranque de
`inactiva_desde` para las filas preexistentes como un quinto hecho acotado al corte (el instante del
corte), y agregarlo a la lista que vigila `G-R6-B`.

---

### F-8CC2-004 — El paso irreversible del corte va antes que los pasos que pueden fallar, y el gate sólo mira el primero

**Qué se rompe.** Si la migración o el despliegue fallan después del paso 1, los clientes con
preapproval vivo quedan cancelados en el proveedor, sin vuelta atrás, mientras el sistema viejo
sigue siendo el que corre.

**El camino.**

1. Paso 1: se cancelan en el proveedor los preapprovals vivos. La cancelación es irreversible
   (`PA-5`).
2. Paso 2: se releen y dan `cancelled`. El gate pasa.
3. Paso 3, *«desplegar»*: `hops db-migrate` aborta en la primera falla, y la migración y el
   redeploy de cada app son actos separados y no atómicos. Supongamos que la migración estructural
   falla.
4. Queda corriendo el sistema viejo, con Juan en `trialing` en su base y cancelado en el
   proveedor. Al vencer su trial, el reconciliador viejo lee `cancelled`, lo refleja y le baja la
   ficha.
5. Para no perder servicio, Juan tiene que suscribirse de nuevo en el sistema viejo, sobre el
   mismo `preapproval_plan`. El proveedor da el trial una vez por `(payer, preapproval_plan)`, así
   que le cobra en el acto (el caso HOS-522 del `CLAUDE.md` del repo). Y cuando se reintente el
   corte, habrá que cancelarlo otra vez.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:2539-2541`:

> cancelar en el proveedor, **verificar releyendo por id**, desplegar, y recién entonces escribir las
> lápidas. El segundo paso es el gate: si alguno no se pudo cancelar, el corte no avanza.

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:172` (`PA-5`,
`VERIFIED`):

> `PUT {status:"cancelled"}`. **Irreversible**: reintentar da `400`

`docs/guides/migrations.md:128` y `:193-195`:

> The command aborts on any failure.
>
> are **two separate
> actions, run in sequence, with no atomicity between them**. […] there
> is a window — seconds to several minutes — where the OLD container is still serving traffic

`CLAUDE.md:254` (repo): *«MercadoPago grants a preapproval's free trial once per `(payer,
preapproval_plan)`»*.

**Severidad**: `ALTA`. Hay plata cobrada antes de lo prometido y recuperación manual; lo acota que
la población es chica. El remedio telefónico de `DEC-MIG-004` cubre la conversación, pero no la
falta de una rama de aborto: el procedimiento, tal como lo resume el log, no dice qué se hace si
el paso 3 falla después de un paso 1 irreversible.

**Necesita decisión del owner**: **no**. Es orden: desplegar primero con la migración ya ensayada
(`hops db-migrate-test`) y el código nuevo en frío, y cancelar recién cuando lo nuevo ya puede
atender. Si no, escribir la rama de aborto.

---

## MEDIA

### F-8CC2-005 — Durante el rollout, el contenedor viejo confirma como procesados los eventos de los preapprovals nuevos y sigue corriendo sus crons

**Qué se rompe.** Quien contrata en las primeras horas tarda hasta un día en tener cobertura,
aunque autorizó, y es justo la población a la que el corte le pide que contrate en ese momento. El
diseño contempla dos contenedores en un despliegue, pero sólo **de la misma versión**.

**El camino.**

1. Se despliega el código nuevo. Coolify mantiene el contenedor viejo sirviendo tráfico durante la
   ventana, y cada contenedor arranca su propio `node-cron`.
2. El owner llama a Juan (`V/21` §2.4: *«se los llama, contratan, y la ficha vuelve sola»*). Juan
   contrata por el camino nuevo y autoriza.
3. El `subscription_preapproval.updated` cae en el contenedor viejo. No encuentra la fila en
   `billing_subscriptions`, el fallback de vinculación da `not_found` y el handler responde
   `success: true`. El evento se marca procesado, sale un `200` y Mercado Pago no reintenta.
4. En el sistema nuevo la fila sigue en `PENDING_AUTHORIZATION`, que no emite fuente. La ficha de
   Juan sigue abajo hasta que el barrido diario o la relectura de `S3` lo levanten.
5. Mientras tanto, los crons viejos (`dunning`, `trial-expiry`, `abandoned-pending-subs`,
   `entity-subscription-cache-reconcile`, `featured-by-entitlement-reconcile`) siguen escribiendo
   sobre la base ya migrada.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:47-48`:

> vive en la base, no en memoria del
> proceso: en un despliegue conviven dos contenedores sirviendo tráfico (`DEC-CONC-001`).

`apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts:706`:

> return { success: true, statusChanged: false, outcome: 'local_row_not_found' };

`apps/api/src/routes/webhooks/mercadopago/subscription-handler.ts:62-63`:

```text
if (result.success) {
    await markEventProcessedByProviderId({ providerEventId: String(event.id) });
```

`apps/api/src/cron/bootstrap.ts:4`:

```text
* Schedules every enabled cron job in-process via `node-cron`
```

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:2209`:

> 3. **La FASE 10 se desarrolla en paralelo y despliega una sola vez.**

**Severidad**: `MEDIA`. No se pierde plata: el barrido diario (`B/09` §2.3) y la relectura de `S3`
recuperan el estado. Lo que se rompe es la promesa de *«vuelve sola»* en el único día en que se la
ejercita, sobre clientes al teléfono. *«Despliega una sola vez»* son, en la práctica, una migración
y tres redeploys con ventanas mixtas, y el diseño no nombra esa ventana.

**Necesita decisión del owner**: **no**. Hay que declarar que en el corte el contenedor viejo no
atiende webhooks ni corre crons (o que el webhook nuevo vive en otra ruta), y verificarlo como paso
del corte.

---

### F-8CC2-006 — `V/21` dice que `PB2` despublica la mañana del corte, y el log y `V/03` dicen que no dispara

**Qué se rompe.** Dos implementadores hacen cosas distintas. Uno confía en `V/21`, no escribe nada,
y las fichas de quien no contrata quedan publicadas y sin título hasta que las archiva `PB4`. El
otro lee el log y escribe un job de corte que fuerza la despublicación. El aviso *«se les avisa
antes del corte»* promete una baja que, según quién implemente, no ocurre.

**El camino.**

1. Mañana del corte: Rosa está en `PRE_TRIAL`, con `cubierto` falso.
2. `PB2` se dispara **por un cambio** de `cubierto`. Pero en el sistema nuevo no hay ningún valor
   anterior de `cubierto` y nadie emite el aviso *«la cobertura cambió»*: ningún evento dispara.
3. La ficha de Rosa sigue publicada sin cobertura, que es lo que `V/03` llama *«la red»*.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:115-118`:

> `PB2` se dispara **por el cambio de `cubierto`** (`V/03` §9), así
> que **las fichas publicadas de Alojamiento se despublican la mañana del corte**. No es una
> ambigüedad entre dos ramas: es una consecuencia.

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:2788`:

> | **1** | `PB2` no dispara la mañana del corte y la cartera queda publicada sin cobertura | la cartera es la población conocida; se la llama y se resuscribe |

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:505-508`:

> el caso que `DEC-MIG-004` mide como defecto 1, *«`PB2` no
> dispara la mañana del corte y la cartera queda publicada sin cobertura»*. Es la red, y por eso se
> queda.

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:620-621`: el hecho
que reinicia el reloj es *«un estado leído, no un cambio detectado, a diferencia del **evento** de
`PB2`, `PB3` y `PB7`, que sí es un cambio»*.

**Severidad**: `MEDIA`. El defecto de fondo está declarado con causa (#1) y no lo reabro. Lo que se
rompe es que el capítulo de migración de verticales afirma lo contrario como *«consecuencia»* y es
el texto que un implementador del corte va a leer.

**Necesita decisión del owner**: **no**. Hay que corregir `V/21` §2.4 para que diga lo mismo que el
log.

---

### F-8CC2-007 — Nadie declara qué pasa con las tablas viejas y con las columnas denormalizadas, y las dos lecturas posibles rompen algo distinto

**Qué se rompe.** Quedan dos implementaciones legítimas con fallas opuestas.

- **Se borran en la misma liberación.** El contenedor viejo del F-8CC2-005 consulta tablas que ya
  no existen, y un rollback de imagen no arranca. Además viola la regla de expand/contract del
  repo.
- **Se conservan.** `accommodations.featured_by_entitlement` (y su gemela en `gastronomies`) queda
  en `true` para siempre en las fichas de los anfitriones `owner-pro` y `owner-premium`, entre
  ellas las dos cuentas `comp` del owner. El cron que la corregía se borra con el sistema viejo, y
  la home la sigue leyendo mientras nadie reescriba esa sección.

**El camino (rama conservar).**

1. Las dos cuentas `comp` son `owner-premium`, que otorga `FEATURED_LISTING`, así que hoy tienen
   `featured_by_entitlement = true`.
2. Corte: se escriben dos `permanent_grant` anclados al plan nuevo. Nada en el diseño nuevo sabe
   que la columna existe.
3. El `featured-by-entitlement-reconcile` es código viejo y cae en FASE 5.
4. La sección de destacados de la web sigue filtrando `isFeatured OR featuredByEntitlement`, y esas
   fichas quedan destacadas por un derecho que el catálogo nuevo puede no otorgar.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:209-216`. *«Lo que NO se migra»*
enumera sólo tres cosas (*«Todo lo vivo»*, *«Los pagos»*, *«`commerce`»*) y ninguna tabla ni columna
viva del sistema viejo.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:224-225`:

> - **La clasificación del código legacy** en reusar o reescribir tiene su propio gate
>   (`DEC-METH-003`) y es FASE 5.

Esto clasifica **código**, no **datos**: una columna con valores en producción no se retira
reescribiendo el código que la lee.

`packages/db/src/schemas/accommodation/accommodation.dbschema.ts:92`:

> featuredByEntitlement: boolean('featured_by_entitlement').notNull().default(false),

`packages/billing/src/config/plans.config.ts:181` y `:232`: `EntitlementKey.FEATURED_LISTING` en
`owner-pro` y `owner-premium`.

`docs/guides/migrations.md:246-250`: *«Release N keeps the source column alive […]; Release N+1
removes it»*. Con `DEC-ARCH-007` hay **una** liberación del programa y el diseño no dice cuál es la
N+1.

`rg` sobre las dos épicas, el núcleo y el contrato: `featured_by|featuredBy`, `entity_subscriptions`,
`billing_subscriptions` y `mp_subscription_id` dan **cero** apariciones.

**Severidad**: `MEDIA`. Es una ambigüedad que dos implementadores resuelven distinto, y las dos
ramas rompen algo real, aunque acotado.

**Necesita decisión del owner**: **no**. Hay que declarar el inventario de tablas y columnas viejas
con datos, y para cada una: se conserva y se congela, o se retira en qué liberación.

---

### F-8CC2-008 — Las épicas crean tres irreversibilidades en el corte y ninguna de las dos es dueña del rollback

**Qué se rompe.** Volver a la imagen vieja después del corte deja cobrando a Mercado Pago a quien
contrató en el sistema nuevo, sin servicio en el viejo. Tampoco se puede volver a las relaciones
viejas.

**El camino.**

1. Corte. Juan contrata en el sistema nuevo y se crea un preapproval suelto.
2. Un defecto obliga a volver a la imagen anterior.
3. El sistema viejo no tiene la fila de Juan. El webhook de su preapproval cae en el handler viejo,
   que responde `local_row_not_found` y lo confirma como procesado (F-8CC2-005). El cobro de Juan
   (`subscription_authorized_payment`) fuerza reintentos y termina en la cola de fallidos.
4. Los tres compromisos viejos no se pueden restaurar, porque la cancelación es irreversible
   (`PA-5`).
5. Las fichas que `V/21` despublicó y los grants escritos en tablas nuevas no existen para el
   código viejo.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:203-205`:

> **Lo único que sobrevive es de otro tamaño**: el **rollback del PROGRAMA** —qué se hace si hay que
> volver atrás el reemplazo entero del sistema de cobro— que no es el rollback de ocho filas y no se
> escribe acá.

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:2523-2524`:

> - **Lo único que sobrevive**: el **rollback del PROGRAMA**, que es otra cosa y vive en la FASE 7 del
>   paraguas (ver `16-fase-7-del-paraguas.md`).

`.specs/HOS-1352-billing-verticals-redesign/docs/11-particion-del-programa.md:276-279`: *«cómo se
integra sin activar es materia de la FASE 7 de cada épica»*. Ninguna de las dos épicas tiene un
capítulo de FASE 7 entre sus `docs/` (medido: los 11 y 13 archivos listados).

**Severidad**: `MEDIA`. No puedo afirmar que falte, porque `16-fase-7…` está fuera de mi lectura.
Lo que sí puedo afirmar con cita es que el diseño de las épicas produce estas tres
irreversibilidades y delega su tratamiento a un documento que ninguna de las dos cita como propio.
Si el 16 no las cubre, sube a `ALTA`.

**Necesita decisión del owner**: **sí**. Si hay rollback del programa después del primer alta nueva
es política (*forward-fix only* frente a rollback con cancelación masiva en el proveedor), no
corrección.

---

## BAJA

### F-8CC2-009 — `B/21` apunta a un § que no tiene la cifra y sigue declarando abierta una decisión que el log cerró

**Qué se rompe.** Son dos copias caducas en el capítulo de migración de billing:

1. `B/21:109` cita el umbral *«unas 20 (§2.4)»*, pero `B/21` §2.4 no contiene esa cifra. La cifra
   vive en `V/21` §2.5 (`V/21:154`). `DEC-MIG-004` (`01-decision-log.md:2798`) repite la misma
   referencia rota: *«**unas 20** (`B/21` §2.4, hoy 8)»*.
2. `B/21:113-115` y `:222-223` dicen *«Qué pasa con las altas nuevas durante el rediseño (§3.3):
   decisión del owner, declarada abierta»*, y el log la cerró: `01-decision-log.md:2254`, *«**El
   capítulo 21 §3.3 queda cerrado.**»* (`DEC-MIG-002`). Además `DEC-MIG-002` sigue en `ACCEPTED`
   diciendo *«se transcriben a mano cuando el rediseño esté listo»* (`:2239-2241`), cuando
   `DEC-MIG-003` decidió no transcribir. Sólo `DEC-MIG-004` #16 aclara que el remedio es el mismo.

**Severidad**: `BAJA`. Es registro, aunque un implementador que lea `DEC-MIG-002` solo podría
construir una transcripción.

**Necesita decisión del owner**: **no**.

---

## Ataques que intenté y el diseño resistió

- **Crons viejos y nuevos compitiendo por las mismas filas.** No comparten filas: el modelo nuevo
  escribe tablas propias y los crons viejos sólo leen `billing_*`. El riesgo real es el de la
  ventana del F-8CC2-005, no una carrera sobre la misma fila.
- **La lápida escrita antes de cancelar.** Lo impide la regla de orden de `B/21:187-189`, *«primero
  se cancela en el proveedor, después se escribe»*.
- **La lápida fuera del barrido por ser terminal.** Lo cubre la salvedad 4 de `B/09` §3
  (`B/09:131` la lista entre las once filas que vuelven al barrido).
- **Una implementación de arranque que llegue a producción con el corte.** La para el guard del
  contrato §6.3, que falla sobre el build de producción y cuyo dueño es `V4`. Con `DEC-ARCH-007`
  no hay un despliegue en el que falte la implementación real.
- **Verticales liberada sola sobre el billing viejo.** Lo cierran `DEC-ARCH-007` y el contrato
  §5.3 (*«No existe una implementación que lea el billing actual»*), y el flujo de ramas
  (`epic/**`, `DEC-CI-001`) lo vuelve imposible en vez de prohibido.
- **Choque de nombres entre tablas nuevas y viejas.** Las viejas llevan el prefijo `billing_*` y las
  nuevas del `B/02` (`subscription`, `payment`, `provider_link`…) no lo llevan. No encontré un
  choque.
- **Trials MP consumidos por las cuentas de cortesía.** Las dos `comp` no tienen vínculo con el
  proveedor (`07-facts-inventory.md:58-59`), así que no hay trial del proveedor que heredar ni que
  cancelar.

## Fuera de mi vector

- **Operativo, con fecha: el 2026-09-26 puede no ser un cobro sino varios.** El inventario toma las
  tres `abandoned` como vacías, pero tienen `trial_end` 2026-09-26, 09-27 y 09-27
  (`07-facts-inventory.md:78`), y por el mecanismo del F-8CC2-002 una de ellas podría tener un
  preapproval autorizado sin vincular. Conviene consultar al proveedor por los pagadores de esas
  tres antes del 26, no sólo mirar al único `trialing` que vence ese día.
- **Mientras el corte no avanza después del paso 1**, la serie de nueve correos de trial del sistema
  viejo (`apps/api/src/cron/jobs/notification-schedule.job.ts:8-12`) sigue avisándoles a los
  cancelados que se les va a cobrar. Es comunicación, y le toca al vector de superficies y correos.

## Key Learnings

1. El corte del programa se diseñó sobre el inventario de **nuestra** base (`mp_subscription_id`),
   pero el sistema viejo tiene dos fábricas de cobros que nuestra base no ve: los `preapproval_plan`
   con enlace público (Path C, vivo en producción) y las autorizaciones que nunca se vincularon
   (el bug que `B/09` §5 documenta). Las dos desembocan en la re-vinculación automática del `B/21`
   §2.5, que es el doble cobro.
2. `DEC-MP-007` («no usamos planes del proveedor») es verdad para el sistema nuevo y por eso mismo
   dejó sin dueño los planes que creó el viejo: una decisión que saca un concepto del diseño
   también lo saca de la lista de cosas a retirar.
3. Una columna no anulable con una lista cerrada de escritores (`listing.inactiva_desde` +
   `G-R6-B`) no tiene escritura legítima para las filas preexistentes. Toda columna así necesita un
   «hecho de migración» declarado, o el guard empuja al valor destructivo.
4. «Despliega una sola vez» (`DEC-ARCH-007`) son, en este repo, una migración y tres redeploys de
   Coolify no atómicos, con un contenedor viejo que confirma como procesados los eventos que no
   reconoce. Lo que valga para «dos contenedores» tiene que valer también para «dos versiones».
5. Los defectos que `DEC-MIG-004` declaró con causa están escritos por **población** («los tres
   conocidos»). Los hallazgos nuevos de esta pasada son los que tienen como sujeto a alguien fuera
   de esa población, o una fila que el censo no ve.
