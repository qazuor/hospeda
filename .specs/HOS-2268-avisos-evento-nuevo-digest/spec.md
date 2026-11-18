---
title: Avisos al turista - evento nuevo a quienes siguen el local (digest diario)
linear: HOS-2268
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - api
  - db
---

# Avisos al turista: aviso de evento nuevo a quienes siguen el local

> Depende de HOS-2266 (tabla `venue_follow`, gate de "avisos habilitados") y de HOS-2291 (ids estables de evento) y reusa las convenciones de HOS-2267 (tipos de notificación, copy es/en/pt, link de baja).

## 1. Resumen

Cuando un local publica un evento nuevo, sus seguidores reciben un correo. Se agrupa en un **digest diario**: máximo un correo por día y por seguidor, aunque el local cargue varios eventos o el turista siga varios locales. Editar un evento existente no dispara este aviso (eso es HOS-2269). Sale en el idioma del turista, con link para dejar de seguir, y no sale si el plan del local ya no incluye `venue_event_notifications`.

## 2. Problema

Un local que carga tres eventos en una tarde no puede disparar tres mails por seguidor, y un turista que sigue diez locales no puede recibir diez mails por día. Además hay que definir qué es "nuevo": hoy los eventos se reescriben enteros en cada guardado, así que sin ids estables (HOS-2291) todo el contenido parecería nuevo en cada edición.

## 3. Objetivos

- G-1: un job diario que arma, por seguidor, un único correo con los eventos nuevos de los locales que sigue.
- G-2: definición estricta de "evento nuevo" (primera vez que existe, activo y futuro), que no se dispara por editar, reactivar ni por una bajada y subida de plan.
- G-3: topes por correo y por local para que un local no pueda inundar.
- G-5: el resumen es transaccional (decidido el 18/11/2026) y todo correo trae el enlace de baja del local.
- G-4: envío por la cola `email_outbox`, con idempotencia, supresión de rebotes y registro en `notification_log`.

## 4. Fuera de alcance

- Avisos de cambio o suspensión de un evento (HOS-2269) y recordatorios (HOS-2267).
- Avisos de eventos de la plataforma (tabla `events`) o de alojamientos.
- Push, in-app, WhatsApp.
- Agrupar con el digest de alertas de precio (`alerts-digest`): son listas y canales distintos (ver 6.1).

## 5. Estado actual del código (verificado en `origin/staging`)

### 5.1 Digest diario existente: `alerts-digest`

`apps/api/src/cron/jobs/alerts-digest.job.ts` (240 líneas), schedule `0 8 * * *` (`schedules.manifest.ts:109-114`). Diseño relevante:

- Evalúa con `PriceDropEvaluatorService` y `PromoOfferEvaluatorService` (`packages/service-core/src/services/alert/`) sobre una ventana fija de 24 h (`DIGEST_WINDOW_HOURS`, línea 62).
- Arma `AlertDigestPayload[]` y entrega por `AlertDigestDeliveryService` / `EmailAlertChannel` (`packages/notifications/src/services/alert-delivery.service.ts`, `channels/email-alert.channel.tsx`), **no por el outbox**: el comentario de cabecera dice que no hay lock ni clave de idempotencia y que un doble disparo "means at most one duplicate email".
- Plantilla `AlertDigestEmail.tsx`, **solo español**, con URL base fija (`templates/alerts/constants.ts:ALERT_DIGEST_SITE_BASE_URL`, "KNOWN LIMITATION").
- No consulta preferencias de notificación (`PreferenceService`) ni suprime rebotes.
- Los evaluadores tienen la forma `evaluateX({ since }) => Map<userId, items[]>`.

### 5.2 El outbox ya resuelve lo que ese job no

Ver HOS-2267 5.1 y 5.2: `email_outbox` con `dedup_key` único, lease, supresión de rebote duro / cuenta borrada, opt-out y tope diario para correo `commercial`, log en `notification_log`.

**Nota (18/11/2026):** como el digest es ahora `transactional` (6.3), el opt-out y el tope diario comercial de abajo **ya no se le aplican**; se conservan acá como descripción del outbox.

**Tope diario**: `DAILY_COMMERCIAL_CAP_PER_RECIPIENT = 1` por destinatario y día de Argentina (`packages/notifications/src/constants/notification.constants.ts:47`), supresión terminal (`email-outbox-delivery.service.ts:~345-370`). Para el digest esto es una **ventaja**: es exactamente "máximo un correo por día" y lo hace el sistema, no el job. El `alerts-digest` no pasa por el outbox, así que no cuenta para ese tope.

### 5.3 Datos de eventos

`venue_events` (`packages/db/src/schemas/venue/venue_event.dbschema.ts:92-153`): `id`, `venue_id`, `title`, `recurrence` (`once`/`weekly`), `date`, `weekday`, `start_time`, `is_active`, `created_at`. Hoy `created_at` se **reinicia en cada guardado** porque la agenda se borra y reinserta (`venue.events.ts:250-278`); con los ids estables de HOS-2291 (antes T-1 de HOS-2255) `created_at` pasa a significar "cuándo nació el evento". Sin HOS-2291 este spec no se puede implementar.

### 5.4 Gate y seguidores

`venue_follow` y `readVenueNotificationGate` salen de HOS-2266 (6.2 y 6.4). El mismo gate es el que publica el booleano `notificationsEnabled` ("avisos habilitados") en la ficha: un local con avisos deshabilitados no muestra "Seguir" y este job tampoco le envía nada. El gate lee el effective set del dueño y exige local `PUBLISHED` y no borrado.

### 5.5 Cron y zona horaria

`apps/api/src/cron/schedules.manifest.ts` + `registry.ts`; los jobs corren en `America/Argentina/Buenos_Aires` (`bootstrap.ts:14-30`). Categoría `notifications` existente.

## 6. Diseño propuesto

### 6.1 Decisión: job propio sobre el outbox, no extender `alerts-digest` (recomendado)

| Opción | Qué hace | Pros | Contras | Impacto |
|---|---|---|---|---|
| A. Sumar un evaluador de eventos a `alerts-digest` | Un correo por día con precios, promos y eventos | Un solo mail para todo lo "novedoso"; un job menos | Hereda sus límites: sin idempotencia, sin preferencias, sin supresión de rebote, solo español, URL base fija. Mezcla el gate por plan del local con alertas que son del turista | Hay que modernizar `alerts-digest` primero (fuera de alcance) |
| **B. Job nuevo `venue-new-events-digest` sobre el outbox (recomendada)** | Digest propio, encola en `email_outbox` | Idempotente, respeta opt-out y tope diario, es/en/pt, registro en `notification_log`, no toca el job existente | El turista puede recibir hasta dos digests el mismo día (precios y eventos) | Aditivo |
| C. Un digest unificado nuevo que reemplace a `alerts-digest` | Un solo correo moderno | Experiencia ideal | Reescribe una feature estable (SPEC-286) | Alto |

Se recomienda B. Para que los dos digests no lleguen juntos, el nuevo corre a las **10:00** (el de precios sale a las 8:00).

### 6.2 Qué es un "evento nuevo"

Entra al digest un evento que cumple **todo**:

1. `new_notice_at IS NULL` (columna nueva en `venue_events`, `timestamptz null`; ver 6.4). Se estampa la primera vez que el evento se incluye en un digest. Es lo que impide repetir.
2. `is_active = true`.
3. `created_at >= ahora - 72 h`. El "hueco" de 72 h absorbe un día de job caído y a la vez evita un aluvión retroactivo: un local que sube de plan (o vuelve a tenerla tras una baja) con 20 eventos cargados no dispara 20 avisos, porque son más viejos que la ventana.
4. Futuro: `once` con `date >= hoy` (día de mercado) o `weekly` (siempre vigente).
5. Sin suspensión vigente (`suspended_for_date`, HOS-2269; hasta que exista, ignorar la condición).
6. `created_at > venue_follow.created_at` del seguidor: nadie recibe como "nuevo" un evento que ya existía cuando lo empezó a seguir.

No dispara: editar título, fecha u hora (HOS-2269 se ocupa si corresponde), desactivar y reactivar (ya estampado), ni un evento semanal que vuelve de borrador tras una subida de plan (ya estampado o más viejo que 72 h).

### 6.3 Job `venue-new-events-digest`

Archivo `apps/api/src/cron/jobs/venue-new-events-digest.job.ts`; manifest `category: 'notifications'`, schedule **`0 10 * * *`**, `timeoutMs: 300000`. Esquema de `alerts-digest` (`CronJobDefinition`, `dryRun`, sin `HOSPEDA_EMAIL_API_KEY` retorna sin hacer nada).

Una corrida, **dentro de una única transacción** (el volumen es de decenas o cientos de seguidores; si crece mucho, ver R-3):

1. Seleccionar los eventos candidatos (6.2) con `FOR UPDATE SKIP LOCKED` sobre `venue_events`.
2. Gate en lote con `readVenueNotificationGate` para los locales de esos eventos. Los locales sin gate **no** se estampan (si recuperan la clave dentro de la ventana de 72 h, sus eventos salen).
3. Cargar los seguidores activos (`venue_follow`, `deleted_at IS NULL`) de esos locales y agrupar **por usuario**: un digest = lista de locales, cada uno con hasta 5 eventos y un "y N más" (tope por local), y hasta 10 locales por correo (tope por correo; el resto queda para el día siguiente si sigue dentro de la ventana, por eso no se estampan los eventos de locales no incluidos).
4. Por usuario: leer email, `settings.languageWeb`, cuenta viva. Encolar en `email_outbox` con `template = NotificationType.VENUE_NEW_EVENTS_DIGEST`, `sendAfter = ahora`, y `dedupKey = buildEmailDedupKey({ recipient: userId, template, occurrence: buildScheduleOccurrence({ subjectKind: 'venue_events_digest', subjectId: userId, milestone: 'daily', targetDate: <día de mercado> }) })`. Una segunda corrida el mismo día genera la misma clave: no duplica.
5. Estampar `new_notice_at = now()` en los eventos efectivamente incluidos en algún digest, en la misma transacción. Un evento cuyos seguidores son cero también se estampa (nadie a quien avisar y no vuelve a evaluarse).
6. Resultado: `{ events, recipients, enqueued, skippedNoGate, errors }`.

Clase de correo: **`transactional`** en `OUTBOX_TEMPLATE_CLASS` (`email-outbox-suppression.ts:34-41`). **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #16 ✱):** el resumen es **transaccional**: no lo frena el «no quiero promociones» ni el opt-out global, y no se descarta por el tope diario comercial. El turista lo corta **dejando de seguir al local**, y por eso el correo **siempre** tiene que traer el enlace de baja de un clic (ver 6.5, AC-10 y AC-14). Consecuencias a resolver en la implementación: (a) la categoría en `NOTIFICATION_CATEGORY_MAP` no puede ser una que el outbox trate como opt-out (OQ-5); (b) el «máximo un correo por día y por seguidor» deja de apoyarse en el tope comercial y descansa en la clave de dedup.

Doble fuente de verdad del opt-out: el lector del outbox `createOutboxOptOutReader` solo reconoce plantillas cuyo nombre es un valor de `NotificationType`; por eso la plantilla se llama `venue_new_events_digest`.

### 6.4 Cambios de datos (carril estructural)

- `venue_events.new_notice_at timestamptz NULL` + índice parcial `WHERE new_notice_at IS NULL AND is_active`.
- **Eventos preexistentes**: al desplegar, todos los eventos viejos tendrían `new_notice_at IS NULL` y `created_at` reciente por los reinserts. Para que el primer día no salga un aviso masivo: no hay seguidores todavía (HOS-2266 recién nace), y además la regla 6 (`created_at > follow.created_at`) los excluye. Aun así, la migración estampa `new_notice_at = now()` en todas las filas existentes (UPDATE de una sola vez dentro de la migración generada o de un SQL extra), por defensa en profundidad. Es un cambio estructural más un `UPDATE` trivial, no seed data: no corresponde data-migration de seed (la tabla es dato del usuario, no baseline).
- Migración compartida con HOS-2269 (`suspended_for_date`, `notified_snapshot`, `change_touched_at`) si salen en el mismo release.

### 6.5 Plantilla, copy y bajas

- Template `VenueNewEventsDigest.tsx` en `packages/notifications/src/templates/venue-events/`; renderer en `venue-event-renderers.tsx` (el mismo archivo de HOS-2267) con `resolveCopy` es/en/pt (`apps/api/src/utils/venue-event-mail-copy.ts`). Claves en `packages/i18n/src/locales/{es,en,pt}/notifications.json`: `venueEvents.digest.{subject,preview,heading,intro,venueHeading,whenLine,more,cta,ticketCta,unfollow,manage,footer}`. Asunto: "Novedades de los locales que seguís" (con el nombre del local si es uno solo).
- Payload (capturado al encolar): `{ locale, venues: [{ venueName, venueSlug, followToken, events: [{ title, whenText inputs: recurrence/date/weekday/startTime/endTime, ticketUrl|null }], moreCount }], manageUrl }`. Sin releer dominio al enviar.
- **El correo siempre trae el enlace de baja de un clic por local** (obligatorio: es la única forma que tiene el turista de cortar el resumen, ver 6.3). Baja de un clic **por local**: `followToken` es el token HMAC de HOS-2267 6.5 con `k = 'venue_follow'`; la ruta pública `GET /api/v1/public/venue-notifications/unsubscribe` marca `deleted_at` del seguimiento. Link adicional a "Mi cuenta > Avisos de locales" para gestionarlo todo.
- No se envía el correo si ningún evento resultó mostrable luego de los topes.

### 6.6 Anti-spam (resumen)

- 1 digest por usuario y día (clave de dedup; el tope comercial no aplica porque el digest es transaccional).
- 5 eventos por local y 10 locales por correo.
- Un evento se anuncia **una sola vez** (`new_notice_at`).
- Ventana de 72 h: sin avisos retroactivos tras cambios de plan.
- Un local no puede "reciclar" avisos borrando y recreando un evento: el evento recreado es un evento nuevo, pero el tope de 5 por local y 1 por día lo acota. Si se observa abuso: tope de eventos nuevos por local por día (ver OQ-3).

### 6.7 Baja de plan del local

El gate se evalúa en cada corrida. Sin la clave, el local queda fuera y sus eventos no se estampan hasta que pase la ventana de 72 h. Las filas de `venue_follow` no se tocan. Lo ya encolado sale (es cuestión de minutos). Al volver a tener la clave, solo se anuncian los eventos creados en las últimas 72 h.

## 7. Criterios de aceptación

- AC-1: Dado un local con la clave y 2 seguidores, cuando el dueño crea un evento futuro y activo, entonces a las 10:00 siguientes se encolan 2 filas en `email_outbox` (una por seguidor) y el evento queda con `new_notice_at` seteado.
- AC-2: Dado un local que cargó 3 eventos el mismo día, el seguidor recibe **un** correo con los 3 eventos.
- AC-3: Dado un turista que sigue 3 locales con eventos nuevos, recibe **un** correo con los 3 locales.
- AC-4: Editar el título, la hora o la descripción de un evento ya estampado no genera ningún aviso de este tipo. Desactivarlo y reactivarlo tampoco.
- AC-5: Si el job corre dos veces el mismo día, no se encola un segundo correo por usuario (clave de dedup) ni se re-estampan eventos.
- AC-6: Un evento más viejo que 72 h, pasado (`once` con fecha anterior a hoy) o inactivo no entra.
- AC-7: Un evento creado antes de que el usuario siguiera al local no entra para ese usuario.
- AC-8: Si el plan del local no incluye `venue_event_notifications`, no se encola nada para sus seguidores y sus eventos no se estampan; las filas de `venue_follow` siguen activas.
- AC-9: Un local con 8 eventos nuevos muestra 5 en el correo y "y 3 más".
- AC-10: El correo sale en el idioma del turista (es/en/pt) y cada local trae un link de baja de un clic que deja de seguirlo sin sesión.
- AC-11: Un turista que desactivó los avisos promocionales o por correo **sí** recibe el digest (es transaccional, no se suprime como `opt_out`), y un día con otro correo comercial tampoco lo descarta.
- AC-14: Todo correo del digest trae, por cada local, el enlace de baja de un clic que deja de seguirlo (y, una vez dado de baja, el turista no vuelve a recibirlo de ese local). Un test falla si la plantilla se renderiza sin ese enlace.
- AC-12: Con `dryRun` no se encola ni se estampa nada.
- AC-13: Existe la entrada del job en `schedules.manifest.ts` y en `registry.ts`; el test de sincronización pasa.

## 8. Plan de pruebas

- Unit `apps/api/test/cron/venue-new-events-digest.job.test.ts`: agrupación por usuario, topes (5 por local, 10 por correo), ventana de 72 h, regla de `follow.created_at`, gate, estampado, `dryRun`, sin API key, doble corrida.
- Unit de la selección de candidatos (función pura que recibe filas y devuelve digests), con casos de `once`/`weekly`, pasado, inactivo, suspendido.
- Integración con Postgres real: una corrida genera N filas de outbox y estampa; la segunda corrida no genera nada nuevo; una caída simulada antes de commit no estampa ni encola (atomicidad).
- Renderer/plantilla: es/en/pt, "y N más", links de baja, payload inválido (`packages/notifications/test/services/outbox/venue-event-renderers.test.tsx`).
- Guards de registro de plantillas del outbox (`email-outbox-template-registry.guard.test.ts`) y del manifest (`schedules-manifest.test.ts`).
- Suppression: extender `packages/notifications/test/services/outbox/email-outbox-suppression.test.ts` con la plantilla nueva como `transactional` (no suprimida por opt-out ni por el tope comercial).
- Migración: drift guard; verificar que el `UPDATE` de estampado no rompe `db:fresh-dev`.
- Staging: digest real a una casilla de prueba con un local con la clave.

## 9. Riesgos

- R-1: depende de ids estables (HOS-2291); sin eso `created_at` no significa "nuevo".
- R-2: (resuelto el 18/11/2026) el digest es `transactional`, así que el tope diario comercial no lo descarta. El riesgo pasa a ser el inverso: sin opt-out, el enlace de baja es la única salida (AC-14).
- R-3: la transacción única escala mal con miles de seguidores. Hoy el mercado es una ciudad; el job loguea una advertencia por encima de 2000 destinatarios y habría que pasar a lotes por usuario con un estampado por (usuario, evento).
- R-4: "dos digests el mismo día" (precios 8:00 y eventos 10:00). Por eso se separa por horario; unificar queda como mejora futura.
- R-5: depende de la clave y el grant (HOS-2259, HOS-2281), no mergeables antes de la pasada final de HOS-1352.

## 10. Preguntas abiertas y decisiones

Decidido (owner, 16/11/2026), en la parte que toca a este spec: la visibilidad del botón "Seguir" sigue al dato público "avisos habilitados" de HOS-2266 (mismo mecanismo que la carta), y el digest se corta con el mismo gate al enviar. No cambia el resto del diseño.

- OQ-1: ¿Job propio o sumar a `alerts-digest`? Ver 6.1. Recomiendo job propio (B).
- OQ-2 (resuelta): **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #16 ✱): `transactional`** (se aparta de la recomendación). Texto original: ¿El digest es `commercial` (respeta el opt-out del outbox y el tope de 1 por día, pero se puede perder si ese día ya salió otro comercial) o `transactional` (nunca se pierde, pero el turista que quiera frenar los avisos solo puede dejar de seguir)? Recomiendo `commercial`: es contenido promocional del local y el opt-out global tiene que funcionar.
- OQ-3 (resuelta): **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #17):** no hay tope de eventos por local y día; ya se muestran 5 como máximo. Texto original: Tope de eventos nuevos anunciados por local y por día (hoy: 5 mostrados, sin tope de creación). ¿Lo dejamos así hasta ver abuso? Recomiendo sí.
- OQ-4 (resuelta): **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #18):** sale a las 10:00. Texto original: Horario 10:00. ¿Prefiere otro? Recomiendo 10:00 para separarlo del digest de precios.
- OQ-5 (abierta, la abre la decisión #16): ¿qué categoría de `NOTIFICATION_CATEGORY_MAP` lleva el digest para que `PreferenceService` y el outbox no lo traten como opt-out, y se mantiene `REMINDER`? ¿Cómo se garantiza el tope de un correo por día sin el tope comercial (solo la clave de dedup)? Hay que resolverlo en T-3.

## 11. Dependencias

- Límite mensual de avisos a seguidores (decisión #48 ✱ de HOS-2252 ronda 2, 18/11/2026; clave nueva por HOS-2259, valores por HOS-2281): Pro 4 por mes, Premium sin tope. El corte en el envío queda abierto (HOS-2281, pregunta 3) y este job lo tiene que respetar.
- HOS-2266 (tablas, gate), HOS-2291 (ids estables de eventos), HOS-2267 (tipos de notificación, copy, token de baja y ruta pública, que se crean ahí), HOS-2259/2281, HOS-2269 (`suspended_for_date`, opcional).

## 12. Smoke y Novedades

- `status-needs-smoke-staging`: digest real por Brevo, horario real del cron, tope diario y baja de un clic.
- What's New: una única entrada para la serie de avisos (la escribe el spec que cierra el bloque); este spec aporta el texto de "eventos nuevos".
- Sin variables de entorno nuevas (reusa HOS-2267).

## 13. Desglose de tareas

1. T-1 Migración: `venue_events.new_notice_at` + índice + estampado de filas existentes.
2. T-2 Función pura de selección y agrupación de digests + tests.
3. T-3 Tipo `VENUE_NEW_EVENTS_DIGEST`, clase `transactional` en el outbox y tests de supresión (resolver OQ-5).
4. T-4 Plantilla + renderer + copy es/en/pt + tests.
5. T-5 Job `venue-new-events-digest` + manifest + registry + tests unitarios.
6. T-6 Integración Postgres real (atomicidad, idempotencia) y guards.
7. T-7 Smoke en staging.

## 14. Linear

Canonical tracking: HOS-2268 (hijo de la épica HOS-2252).
