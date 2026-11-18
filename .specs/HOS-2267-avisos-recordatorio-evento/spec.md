---
title: Avisos al turista - recordatorio antes del evento
linear: HOS-2267
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - api
  - db
---

# Avisos al turista: recordatorio antes del evento

> Depende de HOS-2266 (tablas `venue_event_subscription`, gate `venue_event_notifications`) y de HOS-2291 (ids estables de eventos). Las convenciones de este spec (categorías de notificación, clase de correo, copy es/en/pt) las reusan HOS-2268 y HOS-2269.

## 1. Resumen

A quien tocó "Avisame" en un evento le llega **un correo** antes de la fecha. Un solo correo por persona y por evento (para un evento semanal, solo para la próxima fecha; después el botón vuelve a "Avisame" y quien quiera otro recordatorio lo pide de nuevo). Sale en el idioma del turista, trae fecha, hora, local, link a la ficha y "Comprar entrada" si el evento tiene link. Trae link para darse de baja. No sale si el plan del local ya no incluye `venue_event_notifications`, si el local ya no está publicado o si el evento fue suspendido.

## 2. Problema

"Avisame" no sirve de nada sin el aviso. Además hay que evitar tres errores típicos: mandar el mail a una hora absurda (el cron corre en hora de Argentina, pero hay que decidir la regla), mandarlo dos veces si el job corre dos veces, y mandarlo cuando el local ya no paga.

## 3. Objetivos

- G-1: job nuevo `venue-event-reminders` que evalúa y encola recordatorios.
- G-2: envío idempotente por la cola `email_outbox`.
- G-3: plantilla React Email con copy es/en/pt.
- G-4: baja de un clic desde el correo.
- G-5: reglas de horario en zona `America/Argentina/Buenos_Aires` para eventos de fecha única y semanales.

## 4. Fuera de alcance

- Avisos de evento nuevo y de cambios (HOS-2268, HOS-2269).
- Recordatorios repetidos cada semana: descartado por el owner (16/11/2026), el recordatorio semanal es de un solo uso (ver 6.6 y 6.7). El modelo lo soportaría sin migración si algún día cambia.
- Push, in-app o WhatsApp.
- El campo "Comprar entrada": lo agrega HOS-2255; acá se lee si existe.

## 5. Estado actual del código (verificado en `origin/staging`)

### 5.1 Cola de correo con envío programado e idempotente

- `email_outbox` (`packages/db/src/schemas/email-outbox/email_outbox.dbschema.ts:13-90`): `send_after` (primer instante en que se puede tomar), `dedup_key` ÚNICO, `status`, lease de 5 minutos, `recipient_email` capturado al encolar, `payload` jsonb.
- `buildEmailDedupKey` y `buildScheduleOccurrence` (`packages/db/src/models/email-outbox/email-outbox-dedup-key.ts:40-111`): clave `(destinatario, plantilla, ocurrencia)`. La ocurrencia usa "la fecha objetivo", **nunca el reloj del job**, para que correr dos veces no duplique.
- `emailOutboxModel.enqueue`, `enqueueOrMergeScheduledEmail`, `withdrawScheduledEmails` (`packages/db/src/models/email-outbox/`). Precedente completo: `apps/api/src/utils/trial/trial-campaign-outbox.ts`.
- Sender: `apps/api/src/cron/jobs/email-outbox-sender.job.ts`, cada minuto, lote de 50, registra cada intento en `notification_log`.
- Renderers registrados por plantilla (`createOutboxMailRenderer`, `OUTBOX_MAIL_RENDERERS`); el guard `apps/api/test/cron/email-outbox-template-registry.guard.test.ts` falla si una plantilla encolada no tiene renderer.

### 5.2 Jerarquía de supresión del outbox: ojo con el tope diario

`evaluateOutboxSuppression` (`packages/notifications/src/services/outbox/email-outbox-suppression.ts:81-125`): rebote duro, cuenta borrada, opt-out (**solo correo `commercial`**) y **tope diario de 1 correo comercial por destinatario y día de Argentina** (`DAILY_COMMERCIAL_CAP_PER_RECIPIENT: 1`, `notification.constants.ts:47`). Una plantilla que no figura en `OUTBOX_TEMPLATE_CLASS` es `transactional`. La supresión por tope es **terminal** (`markFailed` con marcador `suppressed:daily_cap`, `email-outbox-delivery.service.ts:~345-370`): el correo no se reintenta al día siguiente.

Consecuencia: si el recordatorio fuera `commercial`, un turista que a la mañana recibió el digest de eventos nuevos (HOS-2268) perdería el recordatorio de la tarde. Por eso el recordatorio y los avisos de cambio van como `transactional` en el outbox y el opt-out se respeta al encolar (ver 6.3).

### 5.3 Tipos y categorías de notificación

`NotificationType` (`packages/notifications/src/types/notification.types.ts`) y `NOTIFICATION_CATEGORY_MAP: Record<NotificationType, NotificationCategory>` (`config/notification-categories.ts`, tipado exhaustivo: agregar un tipo sin categoría no compila). `PreferenceService.shouldSendNotification` (`services/preference.service.ts`) respeta `emailEnabled`, `disabledCategories` y `disabledTypes` solo para categoría `REMINDER`.

### 5.4 Cron

`apps/api/src/cron/schedules.manifest.ts` es la lista autoritativa (se registra además en `registry.ts`; el test `test/cron/schedules-manifest.test.ts` falla si falta un lado). Los jobs corren en `America/Argentina/Buenos_Aires` (`apps/api/src/cron/bootstrap.ts:14-30`, `CRON_SCHEDULE_OPTIONS`). Categoría `notifications` ya existe (`email-outbox-sender`, `alerts-digest`, `notification-schedule`). Precedente de recordatorio por outbox: `subscription-grace-reminder`, `host-trade-usage-reminder.job.ts`.

### 5.5 Idioma del turista y copy multi-idioma

- El idioma está en `users.settings.languageWeb` (`alerts-digest.job.ts` lo lee así).
- **Los correos de la plataforma son solo en español** (el comentario de `AlertDigestEmail.tsx:14-22` lo declara). Las excepciones con es/en/pt son `billing-manual-installment-opened-renderers.tsx` y `partner-application-renderers.tsx`, que reciben el `locale` en el payload y un `resolveCopy` inyectado desde la API que lee `trans[locale][key]` de `@repo/i18n` (`apps/api/src/utils/billing-manual-installment-mail-copy.ts:1-30`). Ese es el molde.

### 5.6 Baja de un clic

Existe para newsletter con token HMAC estable (`newsletter-token.helpers.ts`, `generateUnsubscribeToken`, `GET /api/v1/public/newsletter/unsubscribe` con redirect a `/{locale}/newsletter/desuscripto/`). Para avisos de local no hay. Variables de entorno de newsletter: `HOSPEDA_NEWSLETTER_HMAC_SECRET` y `_PREV`.

### 5.7 Cálculo de "próxima fecha"

No existe un helper de "próxima ocurrencia" de un evento de local. La web calcula el texto a mano (`VenueEvents.astro`). Hay utilidades de día de mercado: `getLocalDateString`, `startOfMarketDay`, `getLocalDayWindow` (`packages/utils/src/local-day.ts`, `MARKET_TIMEZONE` línea 28) y `marketCalendarDay`/`marketMidnight` (`packages/verticals/src/quota/market-time.ts`).

## 6. Diseño propuesto

### 6.1 Cuándo sale el correo (decidido por el owner, 16/11/2026)

Un único instante de envío por ocurrencia, en hora de Argentina (`sendAt`):

- Si el evento empieza **antes de las 15:00**: el **día anterior a las 18:00**.
- Si empieza **a las 15:00 o después**: el **mismo día a las 12:00**.

Razón (decidido por el owner): un boliche que abre a las 23:00 recibe el aviso al mediodía del mismo día (cerca, útil); un brunch de las 11:00 lo recibe la tarde anterior (el mismo día a las 12:00 sería tarde). Constantes en un archivo (`venue-reminder-schedule.ts`), no env vars: umbral 15:00, día anterior 18:00, mismo día 12:00, anticipación mínima 2 h, zona `America/Argentina/Buenos_Aires`.

Regla de anticipación mínima (decidida: **nunca con menos de 2 h**): si al evaluar `sendAt` ya pasó pero el evento todavía no empezó, se envía igual **solo si faltan al menos 2 horas**; si no, se descarta y se marca `reminded_at` (no se manda "recordatorio" a último momento). Esto cubre al turista que toca "Avisame" a las 22:00 de un evento a las 23:00: no se le manda nada raro, la confirmación visual del botón alcanza. Misma lógica si la suscripción se creó **después** de `sendAt` (suscribirse a las 13:00 a un evento de las 23:00, con `sendAt` a las 12:00): no se envía recordatorio y se marca `reminded_at`; el turista acaba de pedirlo y lo está viendo.

### 6.2 Job `venue-event-reminders`

Archivo `apps/api/src/cron/jobs/venue-event-reminders.job.ts`, entrada en `schedules.manifest.ts` (`category: 'notifications'`, schedule **`5 * * * *`**, cada hora al minuto 5) y registro en `registry.ts`. El horario horario cubre las dos reglas (12:00 y 18:00) y es robusto ante una corrida perdida (la siguiente lo recoge).

Algoritmo por corrida (sin bloqueo propio; la idempotencia la da el `dedup_key`, igual que `alerts-digest` y `trial-machine-expiry`):

1. Leer `venue_event_subscription` con `reminded_at IS NULL AND deleted_at IS NULL AND remind_for_date BETWEEN hoy AND hoy+1` (día de mercado), unido a `venue_events` (`is_active = true`) y `venues` (`publication_status = 'PUBLISHED'`, `deleted_at IS NULL`). Índice parcial ya creado en HOS-2266.
2. Calcular `sendAt` de cada fila con la regla 6.1 y quedarse con las que cumplen `sendAt <= ahora` y `ahora <= inicio del evento - 2 horas`. Las que ya no llegan a 2 horas se marcan `reminded_at` (descartadas) sin encolar.
3. Descartar (y **no** marcar `reminded_at`, así una subida de plan o un "reanudar" lo recupera mientras haya tiempo) las que tengan evento suspendido para esa fecha (`suspended_for_date = remind_for_date`, columna de HOS-2269; hasta que exista, ignorar la condición).
4. Gate en lote: `readVenueNotificationGate` (HOS-2266, 6.4). Las de locales sin la clave se saltean sin marcar.
5. Para cada candidata: leer usuario (email, `displayName`, `settings.languageWeb`, `deletedAt`), saltear si no tiene email o la cuenta está borrada; consultar `PreferenceService.shouldSendNotification(userId, VENUE_EVENT_REMINDER)` y saltear (marcando `reminded_at`) si optó por no recibir.
6. En una transacción: `emailOutboxModel.enqueue({ template: NotificationType.VENUE_EVENT_REMINDER, recipientEmail, recipientUserId, payload, dedupKey, sendAfter: ahora })` y `UPDATE ... SET reminded_at = now()`. `dedupKey = buildEmailDedupKey({ recipient: userId, template, occurrence: buildScheduleOccurrence({ subjectKind: 'venue_event', subjectId: eventId, milestone: 'reminder', targetDate: remind_for_date }) })`.
7. `dryRun` y falta de `HOSPEDA_EMAIL_API_KEY`: mismo comportamiento que `alerts-digest.job.ts` (retorna sin enviar).

Resultado del job: `processed`, `skippedNoGate`, `skippedOptOut`, `errors`.

### 6.3 Clase de correo y opt-out (decisión)

| Opción | Qué hace | Pros | Contras | Impacto |
|---|---|---|---|---|
| A. `commercial` | Opt-out y tope diario del outbox | Cero código nuevo | El tope de 1 por día **descarta** el recordatorio si ese día ya salió otro comercial (el digest de HOS-2268). Pérdida silenciosa de algo que el turista pidió | Ninguno |
| **B. `transactional` + opt-out al encolar (recomendada)** | El outbox no lo suprime; el job consulta `PreferenceService` antes de encolar | El turista pidió ese aviso: no se pierde por el tope; el opt-out global se respeta | Opt-out evaluado al encolar (el envío es inmediato, la diferencia es de minutos) | Solo código nuevo en el job |
| C. Tercera clase `requested` en el outbox | Respeta opt-out al enviar, sin tope | Semántica más limpia | Toca `evaluateOutboxSuppression` y su suite (núcleo compartido) | Medio |

Los tres tipos nuevos (`VENUE_EVENT_REMINDER`, `VENUE_NEW_EVENTS_DIGEST`, `VENUE_EVENT_CHANGED`) se agregan a `NotificationType` y a `NOTIFICATION_CATEGORY_MAP` con categoría `REMINDER`. No se agregan a `OUTBOX_TEMPLATE_CLASS` (quedan `transactional` en el outbox) salvo el digest de HOS-2268.

### 6.4 Plantilla y copy es/en/pt

- Template: `packages/notifications/src/templates/venue-events/VenueEventReminder.tsx` (usa `EmailLayout`, `Heading`, `Button`, `Text`).
- Renderer: `packages/notifications/src/services/outbox/venue-event-renderers.tsx`, `createVenueEventRenderers({ siteUrl, resolveCopy })`, registrado en `buildOutboxSenderRender` (`email-outbox-sender.job.ts:~70-110`). Clave de plantilla: el valor de `NotificationType.VENUE_EVENT_REMINDER` (`venue_event_reminder`), igual que las plantillas del trial, para que el lector de opt-out (`createOutboxOptOutReader`, que solo conoce valores de `NotificationType`) la reconozca.
- Copy: `apps/api/src/utils/venue-event-mail-copy.ts` con `resolveCopy` sobre `trans[locale]` (molde `billing-manual-installment-mail-copy.ts`). Claves en `packages/i18n/src/locales/{es,en,pt}/notifications.json`: `venueEvents.reminder.{subject,preview,heading,body,whenLine,cta,ticketCta,unsubscribe,footer}`. Fecha y hora con `formatDate` de `@repo/i18n` y `timeZone: 'America/Argentina/Buenos_Aires'`.
- Payload (capturado al encolar, sin releer dominio al enviar): `{ locale, venueName, venueSlug, eventTitle, occurrenceDate, startTime, endTime, ticketUrl|null, unsubscribeToken, siteBaseUrl? }`. El renderer valida con Zod (molde `billing-manual-installment-opened-renderers.tsx:34`).
- Contenido: asunto con nombre del evento y local; fecha larga + hora; botón "Ver el evento" a `/{locale}/comer-y-salir/{slug}#venue-venue-events` (el evento no tiene página propia, ancla de `VenueEvents.astro` línea `id="venue-venue-events"`); "Comprar entrada" si `ticketUrl`; pie con "Dejar de recibir avisos de este evento".

### 6.5 Baja de un clic

- Token HMAC estable por suscripción: `payload = { s: subscriptionId, k: 'venue_event' }`, firmado con el mismo mecanismo de `newsletter-token.helpers.ts` (reusar la función con un secreto propio **o** el existente; ver OQ-3). Estable, sin vencimiento, para poder ponerlo en todos los correos.
- Ruta pública `GET /api/v1/public/venue-notifications/unsubscribe?token=&locale=` (molde `newsletter/public/index.ts`): valida el token, marca `deleted_at` de la suscripción (idempotente) y redirige a `/{locale}/avisos/baja-confirmada/` (página estática nueva, texto es/en/pt). Token inválido: redirect con `reason`. Rate limit por IP.
- También "darse de baja" de todos los avisos: el correo del digest (HOS-2268) usa el mismo mecanismo para el seguimiento. El link nunca requiere sesión.

### 6.6 Eventos recurrentes (próxima fecha)

Helper puro nuevo `computeNextOccurrence({ recurrence, date, weekday, startTime, from })` en `packages/utils/src/venue-event-occurrence.ts` (zona de mercado; Argentina no tiene horario de verano pero se usa el helper de zona de todas formas):

- `once`: `date` si `date + startTime > from`, si no `null`.
- `weekly`: el próximo día con `weekday` (domingo = 0, como la columna) cuya hora de inicio sea posterior a `from`.
- Un evento que cruza la medianoche (22:00 a 02:00) pertenece al día en que **empieza**.

Un evento semanal genera **un solo** recordatorio, para su próxima fecha (decidido por el owner). Al enviarlo se marca `reminded_at`; la suscripción queda consumida y el botón de la ficha vuelve a "Avisame" (HOS-2266, 6.2). Un nuevo "Avisame" rearma la misma fila con la próxima fecha (`reminded_at = NULL`, nuevo `remind_for_date`), lo que permite otro recordatorio, nunca uno automático.

**Fecha suspendida (decidido, owner, 18/11/2026, HOS-2252 ronda 2, #15 ✱):** si la próxima fecha de un semanal se suspende (HOS-2269), se le avisa al turista y **se le pregunta si quiere que le avisemos de nuevo** para la fecha siguiente. La suscripción **no** pasa sola a la fecha siguiente ni queda consumida en silencio: queda a la espera de la respuesta. Cómo se hace la pregunta y qué pasa si no responde queda como OQ-6.

`remind_for_date` se calcula al suscribirse (HOS-2266 llama a este helper) y se recalcula si cambia la fecha/día (HOS-2269). Si dos specs de eventos (HOS-2254) ya crearon un helper equivalente, se reusa ese: el primero que mergee lo crea.

### 6.7 Anti-spam

- Máximo 1 recordatorio por `(usuario, evento, fecha)`: lo garantiza el `dedup_key` único aunque el job corra dos veces o dos instancias a la vez.
- Máximo `N = 5` recordatorios por usuario y día (corte defensivo; el job corta y loguea). Ver OQ-4.
- Nada se manda si faltan menos de 2 horas (6.1).
- Una suscripción a un evento semanal genera **un** recordatorio (próxima fecha); después el botón vuelve a "Avisame" (decidido).

### 6.8 Baja de plan del local

El gate se evalúa en cada corrida, no al suscribirse: en cuanto el local deja de tener la clave, el job lo saltea **sin marcar** `reminded_at`, y no se encola nada. Lo ya encolado en `email_outbox` con `sendAfter = ahora` sale en menos de un minuto; no hay recordatorios "viejos" en cola. Si el local vuelve a tener la clave antes del evento, el recordatorio sale.

## 7. Criterios de aceptación

- AC-1: Dada una suscripción a un evento `once` que empieza mañana a las 22:00 (después de las 15:00), el job de hoy no envía nada; el job de mañana a las 12:05 envía **un** correo y marca `reminded_at`.
- AC-2: Dado un evento `once` pasado mañana a las 10:00, el correo sale mañana a las 18:00.
- AC-3: Dado un evento semanal, la suscripción genera un solo correo, para la próxima fecha; tras enviarlo no se repite la semana siguiente y el botón de la ficha vuelve a "Avisame" (`notification-state` ya no la lista).
- AC-4: Si el job corre dos veces en la misma hora (o dos instancias), el turista recibe un único correo (`dedup_key` único).
- AC-5: El correo trae fecha y hora en hora de Argentina, nombre del local, link a la ficha con ancla y, si hay `ticketUrl`, "Comprar entrada".
- AC-6: El correo sale en el idioma `languageWeb` del usuario (es/en/pt); si falta, `es`.
- AC-7: El link de baja marca la suscripción como borrada sin sesión y es idempotente; con token adulterado no cambia nada.
- AC-8: Si el plan del local no incluye `venue_event_notifications`, o el local no está publicado, o el evento está suspendido para esa fecha, no se encola nada y `reminded_at` queda en `NULL`.
- AC-9: Si el usuario desactivó los avisos por correo (`emailEnabled = false` o categoría `reminder` deshabilitada), no se encola y se marca `reminded_at`.
- AC-10: No sale ningún recordatorio con menos de 2 horas al inicio del evento, ni cuando la suscripción se creó después del `sendAt` de esa fecha.
- AC-11: Un recordatorio no se pierde por haber recibido ya un correo comercial ese día (clase `transactional`).
- AC-13: Tabla de horarios (Argentina): inicio 14:59 -> día anterior 18:00; inicio 15:00 -> mismo día 12:00; inicio 23:00 -> mismo día 12:00; inicio 10:00 -> día anterior 18:00.
- AC-14: Un evento semanal suspendido para la próxima fecha (HOS-2269) no genera recordatorio para esa fecha mientras dure la suspensión; si se reanuda con tiempo suficiente (2 h), el recordatorio sale.
- AC-15: Cuando la próxima fecha de un semanal se suspende, el turista suscripto recibe el aviso de suspensión y se le pregunta si quiere que le avisemos de nuevo para la fecha siguiente. Si responde que sí, la suscripción se rearma para esa fecha (nuevo `remind_for_date`, `reminded_at = NULL`); si responde que no o no responde, no se programa otro recordatorio y el botón vuelve a "Avisame".
- AC-12: `pnpm test` del guard de registro de plantillas del outbox pasa con la plantilla nueva.

## 8. Plan de pruebas

- Unit `packages/utils/test/venue-event-occurrence.test.ts`: `once`/`weekly`, borde de medianoche, domingo = 0, evento que cruza medianoche, `from` justo en el inicio.
- Unit `apps/api/test/cron/venue-event-reminders.job.test.ts` (mockeando `@repo/db` como `conversation-notification.job.test.ts`): tabla de horarios de 6.1, gate, opt-out, suspendido, dedup, `dryRun`, sin API key.
- Unit renderer/plantilla `packages/notifications/test/services/outbox/venue-event-renderers.test.tsx`: es/en/pt, con y sin `ticketUrl`, payload inválido.
- Registro: extender `email-outbox-template-registry.guard.test.ts` y `schedules-manifest.test.ts`.
- Integración con Postgres real: encolar dos veces => una fila en `email_outbox`; baja con token.
- Ruta pública de baja: token válido, vencido/adulterado, idempotencia.
- Staging: envío real por Brevo a una casilla de prueba (el outbox usa la captura de e2e en tests: `resolveOutboxEmailClientConfig`).

## 9. Riesgos

- R-1: copy es/en/pt en un sistema de correos solo en español: es el primer correo de turista multi-idioma por outbox. El molde existe (instalación manual) pero hay que mantener `notifications.json` en tres idiomas.
- R-2: la regla horaria (decidida por el owner) vive en constantes de un archivo, fácil de ajustar si la práctica lo pide.
- R-3: opt-out evaluado al encolar y no al enviar (6.3, opción B). Diferencia de minutos.
- R-4: HOS-2255 aún no define el nombre del campo del link de entradas. Se lee defensivamente (`ticketUrl ?? null`).
- R-5: secreto HMAC: si se reusa el de newsletter y rota, rotan también estos links (hay `_PREV`).

## 10. Preguntas abiertas y decisiones

- OQ-1 (resuelta): Decidido (owner, 16/11/2026): evento semanal con "Avisame" manda un solo recordatorio, para la próxima fecha; después el botón vuelve a "Avisame".
- OQ-2 (resuelta): Decidido (owner, 16/11/2026): si el evento empieza antes de las 15:00, el recordatorio sale el día anterior a las 18:00; si no, el mismo día a las 12:00. Nunca con menos de 2 h de anticipación. Hora de Argentina.
- OQ-3: Secreto de los links de baja. Opciones: (1) reusar `HOSPEDA_NEWSLETTER_HMAC_SECRET` con un `kind` distinto en el payload (cero env nueva, recomendada); (2) env nueva `HOSPEDA_VENUE_NOTIFICATIONS_HMAC_SECRET` (aislamiento, pero hay que registrarla en `@repo/config`, setearla en Coolify y redeployar).
- OQ-4: Tope defensivo de 5 recordatorios por usuario y día: ¿alcanza? Recomiendo sí.
- OQ-5 (resuelta): **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #15 ✱):** se le avisa al turista y se le pregunta si quiere que le avisemos de nuevo para la fecha siguiente (se aparta de la recomendación original). Texto original: si la próxima fecha de un evento semanal está suspendida (HOS-2269) y el recordatorio de esa fecha se omite, ¿la suscripción pasa sola a la fecha siguiente o queda consumida sin aviso? Recomiendo que quede consumida y el botón vuelva a "Avisame" cuando pase la fecha suspendida, para no mandar algo que el turista no pidió para esa semana.
- OQ-6 (abierta, la abre la decisión #15): ¿cómo se hace la pregunta de "avisame de nuevo"? Candidatos: un enlace en el correo de suspensión de HOS-2269 que rearma la suscripción, o una pregunta al volver a la ficha. Y: ¿qué pasa si el turista no responde (se asume que no)? ¿Hasta cuándo vale el enlace? Hay que decidirlo junto con HOS-2269 antes de implementar el T-5.

## 11. Dependencias

- Límite mensual de avisos a seguidores (decisión #48 ✱ de HOS-2252 ronda 2, 18/11/2026; clave nueva por HOS-2259, valores por HOS-2281): Pro 4 por mes, Premium sin tope. El corte en el envío queda abierto (HOS-2281, pregunta 3) y este job lo tiene que respetar.
- HOS-2266 (tablas, gate), HOS-2291 (ids estables de eventos), HOS-2259/2281 (clave y grant), HOS-2255 (link de entradas, opcional), HOS-2269 (`suspended_for_date`, opcional hasta que exista).
- Usa el outbox de HOS-1423/1448 ya mergeado.

## 12. Smoke y Novedades

- `status-needs-smoke-staging`: envío real por Brevo, horario real del cron y dedup con dos corridas.
- What's New: sí, una sola entrada de toda la serie "Avisos al turista" (la escribe el spec que cierra el bloque); este spec aporta el texto del recordatorio.
- Variable de entorno nueva: ninguna si se elige OQ-3 (1). Si se elige (2): registrar en `packages/config/src/env-registry.*.ts`, `apps/api/src/utils/env.ts`, `.env.example`, y avisar para setearla en Coolify.

## 13. Desglose de tareas

1. T-1 `computeNextOccurrence` + tests (o reusar el de HOS-2254) y constantes de horario (`venue-reminder-schedule.ts`) con tabla de casos 14:59/15:00/23:00/10:00 y regla de 2 h.
2. T-2 Tipos y categorías de notificación (`NotificationType`, `NOTIFICATION_CATEGORY_MAP`) + test del mapa.
3. T-3 Plantilla React Email + renderer + `resolveCopy` + i18n es/en/pt + tests.
4. T-4 Token de baja + ruta pública + página `baja-confirmada` + tests.
5. T-5 Job `venue-event-reminders` + manifest + registry + tests unitarios (marca `reminded_at` y consume la suscripción semanal).
6. T-6 Test de integración (dedup, gate, baja de plan) y guards de registro.
7. T-7 Smoke en staging y doc de operación.

## 14. Linear

Canonical tracking: HOS-2267 (hijo de la épica HOS-2252).
