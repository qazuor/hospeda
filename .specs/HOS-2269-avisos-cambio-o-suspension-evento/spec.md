---
title: Avisos al turista - cambio de fecha u hora y suspensión del evento
linear: HOS-2269
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - api
  - db
  - web
---

# Avisos al turista: aviso de cambio de fecha, hora o suspensión del evento

> Depende de HOS-2266 (suscripciones por evento, gate) y de HOS-2291 (**ids estables** de eventos) y reusa de HOS-2267 los tipos de notificación, el copy es/en/pt y el link de baja.

## 1. Resumen

El editor del local gana una acción **"Suspender evento"**, distinta de borrarlo. Un evento suspendido se muestra en la ficha como "Suspendido" hasta su fecha. Un cambio de fecha u hora, una suspensión o una reanudación dispara **un solo correo** a quienes tocaron "Avisame" en ese evento. Cambiar el título o la descripción no avisa. Si el local hace varios cambios seguidos, se agrupan en un único aviso (ventana de 15 min) y entre avisos de un mismo evento hay 2 h de espera, salvo que el aviso sea una suspensión o una reanudación, que siempre avisan. Suspender un evento semanal afecta solo a la próxima fecha y vuelve sola.

## 2. Problema

Hoy el local puede mover o cancelar un evento y el turista que dijo "Avisame" se entera en la puerta. Además el modelo actual no puede detectar el cambio: la agenda se borra y reinserta entera en cada guardado, sin ids, y no existe el concepto de "suspendido" (solo `is_active`, que significa "estacionado, oculto", otra cosa).

## 3. Objetivos

- G-1: estado "suspendido" por evento, visible en la ficha y en el editor.
- G-2: detección de cambios **materiales** comparando contra lo último que se les comunicó a los suscriptos.
- G-3: agrupar ediciones seguidas (ventana de silencio de 15 min) y limitar la frecuencia por evento (2 h de espera), con excepción de suspender y reanudar, que siempre avisan.
- G-4: correo en el idioma del turista, por la cola `email_outbox`.
- G-5: mantener coherente el recordatorio (HOS-2267) cuando cambia la fecha.

## 4. Fuera de alcance

- Borrar un evento no avisa a quienes tocaron "Avisame" (es la distinción que pide el issue). El editor lo advierte con texto. Excepción de otra spec: un evento con anotados o reservas confirmadas no se puede borrar hasta cancelarlos, y a ellos sí se les avisa (HOS-2260 OQ-9, HOS-2252 ronda 2, #33).
- `is_active = false` ("estacionar") no avisa; mismo criterio.
- Cambios de título, descripción, imagen, precio, link de entradas o `display_order`.
- Cancelar la serie completa de un evento semanal con un solo gesto (ver 6.2).
- Avisos de recordatorio y de evento nuevo (HOS-2267, 2268).

## 5. Estado actual del código (verificado en `origin/staging`)

### 5.1 La agenda se reemplaza entera y sin ids

- `replaceVenueEvents` (`packages/service-core/src/services/venue/venue.events.ts:~210-285`): `eventModel.hardDelete({ venueId })` y reinserta cada entrada con `displayOrder` por posición. El comentario de cabecera (líneas 18-24) lo dice: "Entry ids are not stable across a save".
- `PUT /api/v1/protected/venues/:id/events` (`apps/api/src/routes/venue/protected/putEvents.ts:78-110`): `listingAccess` con `vertical: VENUE`, `operation: 'EDIT'`, `listingSection` `venueEvents` con `intent: 'write'` (o `'delete'` si el array viene vacío). Gate real: `manage_venue_events` vía el catálogo de secciones (`packages/schemas/src/catalog/listing-sections.ts:~111`).
- Payload sin ids (`VenueEventInputSchema`, `packages/schemas/src/entities/venue/subtypes/venue.event.schema.ts:260-285`); el editor tampoco los lleva (`apps/web/src/lib/venue/venue-event-draft.ts:11-24`).
- HOS-2291 (antes T-1 de HOS-2255, extraído a su propio issue) introduce ids estables y un diff transaccional. **Sin eso, este spec no es implementable**: no hay "versión anterior de cada evento" contra la cual comparar.

### 5.2 No hay estado "suspendido"

`venue_events.is_active` (`venue_event.dbschema.ts:~134-140`) significa "estacionado para volver el año próximo, no es un flag de moderación". La ficha pública filtra `isActive` (`apps/api/src/routes/venue/public/getBySlug.ts:~108-111`: `activeVenueEvents = ... filter((event) => event.isActive)`) y `VenueEvents.astro` renderiza solo lo que llega, sin ningún estado de evento.

### 5.3 Riesgo de fuga de columnas internas

`projectEvent` (`venue.events.ts:~110-114`) hace `{ ...row, startTime, endTime }`: copia **todas** las columnas de la fila. `VenueEventPublicSchema` solo quita los dos campos de autoría (`venue.event.schema.ts:161-164`). Hoy no importa porque no hay columnas internas; las columnas nuevas de este spec (`notified_snapshot`, `change_touched_at`, `last_change_notice_at`) y de HOS-2268 (`new_notice_at`) **no deben salir en ninguna respuesta pública ni de dueño**. Hay que pasar `projectEvent` a una selección explícita de campos.

### 5.4 Infra reusable

Outbox idempotente, supresión y registro (HOS-2267 5.1-5.2); tope diario solo para correo `commercial` (HOS-2267 5.2); `PreferenceService` (5.3); jobs con `schedules.manifest.ts` (5.4); copy es/en/pt con `resolveCopy` (5.5). Token de baja por suscripción y ruta pública (HOS-2267 6.5). Gate (`readVenueNotificationGate`, HOS-2266 6.4). Helper de próxima ocurrencia `computeNextOccurrence` (HOS-2267 6.6).

## 6. Diseño propuesto

### 6.1 Qué cuenta como cambio material

Se compara el **estado material**: `{ recurrence, date, weekday, startTime, endTime, suspendedForDate }`, donde `suspendedForDate` cuenta **solo si es hoy o futuro** (una suspensión ya vencida se normaliza a `null` en ambos lados de la comparación; así la vuelta automática del evento semanal no se detecta como "reanudación" ni genera aviso). Cualquier diferencia contra `notified_snapshot` es un cambio a comunicar. Todo lo demás (título, descripción, orden, `is_active`, link de entradas) no.

Tipos de aviso que se derivan de la diferencia (para el texto):

- `suspended`: `suspendedForDate` pasa de nulo a una fecha.
- `resumed`: `suspendedForDate` pasa de una fecha a nulo (si no hubo otro cambio).
- `rescheduled`: cambia `date`, `weekday`, `startTime`, `endTime` o `recurrence`.
- Combinaciones (suspendido y además cambió la hora): un solo correo con el texto de mayor gravedad (`suspended` > `rescheduled` > `resumed`) y el "antes/después" completo.

### 6.2 Suspensión (modelo; decidido por el owner, 16/11/2026)

Decidido: "Suspender" un evento semanal afecta **solo la próxima fecha** y el evento vuelve solo; para cortar la serie entera ya existe estacionar (`is_active = false`).

Columna nueva `venue_events.suspended_for_date date NULL`: "este evento está suspendido para esta fecha". La fecha es la de la **próxima ocurrencia** al momento de suspender (`computeNextOccurrence`): para `once`, su fecha; para `weekly`, la próxima semana en que ocurre. Reanudar antes de esa fecha es posible (endpoint `resume`) y también avisa. Ventajas: no hay job que "desuspenda" (se vuelve inerte solo cuando pasa la fecha, comparando con el día de mercado) y un evento semanal suspendido una semana vuelve solo la siguiente. Suspender la **serie** entera es lo que ya cubre `is_active = false` (estacionar); no se duplica ese concepto.

Rutas (protegidas, mismo `listingAccess` que `putEvents.ts`: `vertical: VENUE`, `operation: 'EDIT'`, sección `venueEvents`, `intent: 'write'`, gate `manage_venue_events`):

| Método y ruta | Qué hace | Errores |
|---|---|---|
| `POST /api/v1/protected/venues/:id/events/:eventId/suspend` | Suspende la próxima ocurrencia. 200 con el evento | 404 si el evento no es de ese local (nunca 403); 409 `ALREADY_EXISTS` si ya está suspendido para esa fecha; 422 si no tiene próxima ocurrencia (evento `once` ya pasado) |
| `POST /api/v1/protected/venues/:id/events/:eventId/resume` | Quita la suspensión. 200 | 404; 409 si no estaba suspendido |

Dos endpoints separados y no un campo del PUT de la agenda: el PUT envía el documento completo y un cliente que no conozca el campo lo pisaría; el diff de HOS-2291 **no toca** `suspended_for_date` si el payload no lo trae. Los dos endpoints reusan el servicio de eventos (`packages/service-core/src/services/venue/venue.events.ts` o `venue.event-suspension.ts`) y registran `recordListingSubEntityEdit` como el resto de escrituras (AC:V9a:7).

### 6.3 Detección y agrupación: snapshot + ventana de silencio

Columnas nuevas en `venue_events` (carril estructural, junto con las de HOS-2268 si salen en el mismo release):

- `notified_snapshot jsonb NULL`: el estado material que ya se les comunicó a los suscriptos (o el inicial).
- `change_touched_at timestamptz NULL`: instante de la última edición material pendiente de avisar.
- `last_change_notice_at timestamptz NULL`: último aviso enviado de este evento.
- Índice parcial `WHERE change_touched_at IS NOT NULL`.

Reglas en el punto donde se escribe (el diff de `replaceVenueEvents` y los dos endpoints de 6.2), dentro de la misma transacción:

1. En un `INSERT`, `notified_snapshot` = estado actual y `change_touched_at = NULL` (el evento nace "ya comunicado": las altas las cubre HOS-2268).
2. En un `UPDATE`, se calcula el estado material nuevo. Si es distinto de `notified_snapshot` se pone `change_touched_at = now()` (cada edición reinicia la ventana). Si **volvió** al snapshot (el dueño se arrepintió), `change_touched_at = NULL` y no sale nada.
3. Si `notified_snapshot` es `NULL` (eventos anteriores a esta feature), se fija al estado **previo a la edición** la primera vez que se toca o cuando alguien se suscribe (HOS-2266 lo hace al crear la suscripción).
4. Si cambió la próxima fecha, en la misma transacción se recalcula `venue_event_subscription.remind_for_date` y, si la nueva fecha es futura, `reminded_at = NULL`, para que el recordatorio (HOS-2267) apunte a la fecha correcta y el turista reciba uno nuevo para la nueva fecha. Es una decisión explícita: "un correo por evento" se entiende **por ocurrencia**.

### 6.4 Job `venue-event-change-notices`

Archivo `apps/api/src/cron/jobs/venue-event-change-notices.job.ts`, manifest `category: 'notifications'`, schedule **`*/5 * * * *`**.

Por corrida, en una transacción por evento (`FOR UPDATE SKIP LOCKED`):

1. Candidatos: `change_touched_at <= ahora - 15 min` (**ventana de silencio**, decidida por el owner).
2. Recalcular el estado material actual. Si es igual a `notified_snapshot`: limpiar `change_touched_at` y seguir (no hay nada que avisar). Si no, derivar el tipo de aviso (6.1). **Enfriamiento de 2 h** (decidido): si el tipo es `rescheduled` puro y `last_change_notice_at > ahora - 2 h`, se saltea sin tocar nada (lo editado se acumula y sale en el aviso siguiente). Si el aviso es `suspended`, `resumed` o una combinación que los incluye, **el enfriamiento no aplica**: una suspensión siempre avisa y reanudar también avisa.
3. Si el evento ya terminó (`once` con fecha pasada, o la fecha anterior y la nueva pasadas): avanzar el snapshot sin enviar.
4. Gate (`readVenueNotificationGate`). **Si el local no tiene la clave: avanzar el snapshot en silencio** y limpiar `change_touched_at`. No quedan avisos "viejos" esperando a que el local vuelva a pagar y se manden semanas después.
5. Suscriptores: `venue_event_subscription` activas del evento. Por cada uno: usuario vivo con email, `PreferenceService.shouldSendNotification(userId, VENUE_EVENT_CHANGED)` y encolar en `email_outbox`: `template = NotificationType.VENUE_EVENT_CHANGED`, `sendAfter = ahora`, `dedupKey = buildEmailDedupKey({ recipient: userId, template, occurrence: buildScheduleOccurrence({ subjectKind: 'venue_event', subjectId: eventId, milestone: 'change:' + <epoch segundos de change_touched_at>, targetDate: <día de mercado de change_touched_at> }) })`. El instante de la última edición es estable entre reintentos y cambia con cada edición nueva, así que un doble disparo no duplica y dos cambios distintos con el mismo estado final (A a B, B a A, A a B) **no** chocan.
6. En la misma transacción: `notified_snapshot = estado actual`, `change_touched_at = NULL`, `last_change_notice_at = now()`.
7. `dryRun` y sin `HOSPEDA_EMAIL_API_KEY`: como `alerts-digest`.

Clase de correo: **`transactional`** en el outbox (no se agrega a `OUTBOX_TEMPLATE_CLASS`): es información urgente sobre algo que el turista pidió, y el tope de 1 comercial por día (terminal) no debe descartarlo. El opt-out global se respeta al encolar (paso 5), igual que el recordatorio.

### 6.5 Plantilla y copy

- Template `VenueEventChanged.tsx` y renderer (en `venue-event-renderers.tsx`), copy con `resolveCopy` es/en/pt (`apps/api/src/utils/venue-event-mail-copy.ts`), claves `venueEvents.changed.{subject.suspended,subject.rescheduled,subject.resumed,heading,before,after,suspendedBody,resumedBody,cta,unsubscribe,footer}` en `packages/i18n/src/locales/{es,en,pt}/notifications.json`.
- Payload capturado al encolar: `{ locale, venueName, venueSlug, eventTitle, kind, before: { recurrence, date, weekday, startTime, endTime }, after: {...}, suspendedForDate|null, unsubscribeToken }`. Fechas y horas en `America/Argentina/Buenos_Aires`.
- Cuando se suspende la próxima fecha de un **semanal** y el turista tenía "Avisame", el aviso de suspensión incluye además la pregunta de si quiere que le avisemos de nuevo para la fecha siguiente (decidido el 18/11/2026, HOS-2252 ronda 2, #15; mecanismo en la OQ-6 de HOS-2267).
- Asunto: "Cambio en <evento>: <nuevo cuándo>" o "Se suspendió <evento>". CTA a la ficha con ancla `#venue-venue-events`. Link de baja de un clic del evento (token de HOS-2267 6.5).

### 6.6 Web

- Editor (`VenueEventEntryCard.client.tsx` y su equivalente del editor de ficha): botón **"Suspender evento"** (con confirmación: "Se les avisa por correo a quienes tocaron Avisame. Afecta solo a la próxima fecha; el evento vuelve solo") y, si ya está suspendido, **"Reanudar"** y una etiqueta "Suspendido el <fecha>". El texto de ayuda explica la ventana: "Si cambiás la fecha o la hora, avisamos por correo a quienes tocaron Avisame. Los cambios de los próximos 15 minutos se juntan en un solo aviso." Al **borrar**: texto "Borrar no avisa a nadie. Para avisar, usá Suspender."
- Ficha pública: `VenueEventPublicSchema` suma `suspendedForDate: string | null`. `VenueEvents.astro` muestra el chip "Suspendido" cuando `suspendedForDate` es la próxima ocurrencia (hasta su fecha, sin job) y oculta el botón "Avisame" de ese evento. Sigue sin leer sesión.
- Texto en `venue.detail.venueEvents.suspended`, `venue.editor.events.{suspend,resume,suspendedOn,suspendConfirm,deleteWarning,changeNoticeHelp}` es/en/pt en `packages/i18n/src/locales/{es,en,pt}/venue.json`.
- Importante: la edición del cuerpo del evento sigue yendo por el PUT de la agenda con ids (HOS-2291).

### 6.7 Contrato de datos públicos

`projectEvent` pasa a una selección explícita de campos (5.3). Test que afirma que ninguna respuesta pública ni de dueño contiene `notifiedSnapshot`, `changeTouchedAt`, `lastChangeNoticeAt` ni `newNoticeAt`.

### 6.8 Anti-spam y topes

- Ventana de silencio 15 min y enfriamiento 2 h por evento (decididos por el owner). Las suspensiones y reanudaciones saltean el enfriamiento (siempre avisan) pero no la ventana de 15 min. Peor caso para cambios de fecha u hora: ~12 avisos por evento y día, en la práctica 1 por tanda de ediciones.
- Un correo por suscriptor y por aviso (clave de dedup).
- Edición sin cambio material no genera nada; volver al estado original cancela el aviso.
- Constantes (`VENUE_EVENT_CHANGE_DEBOUNCE_MS` = 15 min, `VENUE_EVENT_CHANGE_COOLDOWN_MS` = 2 h, esta última solo para cambios de fecha u hora) en un archivo, no env vars.

### 6.9 Baja de plan del local

Sin la clave, el job avanza el snapshot sin enviar (6.4 paso 4); las suscripciones se conservan. Suspender y reanudar siguen funcionando (son edición de la agenda: dependen de `manage_venue_events`, que es otra clave); simplemente no salen correos. Al volver a tener la clave, solo se avisan cambios posteriores.

## 7. Criterios de aceptación

- AC-1: Dado un evento con 3 suscriptos, cuando el dueño cambia la hora de inicio y pasan 15 minutos, entonces el job encola exactamente 3 correos (uno por suscripto) con la hora anterior y la nueva, y limpia `change_touched_at`.
- AC-2: Cambiar solo el título o la descripción no encola nada ni modifica `change_touched_at`.
- AC-3: Dado el dueño que cambia la hora tres veces en 10 minutos, los suscriptos reciben **un** correo con el estado inicial y el final.
- AC-4: Dado el dueño que cambia la hora y la restituye antes de 15 minutos, no sale ningún correo.
- AC-5: "Suspender evento" fija `suspended_for_date` a la próxima ocurrencia; la ficha muestra "Suspendido" y oculta "Avisame" hasta esa fecha; los suscriptos reciben un correo de suspensión.
- AC-6: Un evento semanal suspendido para el jueves 20 vuelve a verse normal el 21 sin ningún job y sin enviar ningún correo; la semana siguiente no está suspendido y sigue vigente la serie.
- AC-7: "Reanudar" quita la suspensión y avisa a los suscriptos.
- AC-8: Borrar un evento no genera correo (sus suscripciones se eliminan por CASCADE).
- AC-9: El correo sale en el idioma del turista (es/en/pt) con fechas y horas en hora de Argentina y link de baja de un clic.
- AC-10: Dos corridas del job sobre el mismo cambio no duplican correos (clave de dedup, y el snapshot ya avanzó).
- AC-11: Dentro del enfriamiento (2 h) un segundo cambio de fecha u hora no genera un segundo correo hasta que pase; luego sale un aviso con el estado acumulado.
- AC-16: Si un evento tuvo un aviso hace menos de 2 h y el dueño lo suspende, el aviso de suspensión sale igual (pasados los 15 min de agrupación), sin esperar el enfriamiento; lo mismo con "Reanudar".
- AC-17: Suspender y reanudar dentro de los 15 min vuelve al snapshot y no envía nada.
- AC-12: Si el local no tiene `venue_event_notifications` al procesar, no se encola nada y el snapshot avanza; al recuperar la clave no se manda ningún aviso retroactivo.
- AC-13: Si el cambio mueve la fecha de un evento al que alguien tiene recordatorio pendiente, `remind_for_date` se recalcula y `reminded_at` se limpia; el recordatorio sale para la fecha nueva.
- AC-14: Las respuestas públicas y de dueño no exponen columnas internas (`notifiedSnapshot`, `changeTouchedAt`, `lastChangeNoticeAt`, `newNoticeAt`).
- AC-15: `POST .../suspend` sobre un evento de otro local responde 404; sobre uno `once` ya pasado, 422; sin la clave `manage_venue_events`, 403 `ENTITLEMENT_REQUIRED`.

## 8. Plan de pruebas

- Unit del cálculo del estado material y la comparación (tabla de casos: título, hora, fecha, weekday, endTime, recurrence, suspensión, vuelta al snapshot) y del tipo de aviso derivado.
- Unit servicio: diff de `replaceVenueEvents` marca `change_touched_at` solo ante cambio material; insert fija snapshot; suspend/resume; recalcula `remind_for_date`. Archivos: `packages/service-core/test/services/venue/venue.events.test.ts` y `venue.event-suspension.test.ts`.
- Unit job `apps/api/test/cron/venue-event-change-notices.job.test.ts`: ventana de silencio, enfriamiento, gate (avanza en silencio), opt-out, evento terminado, dedup, `dryRun`.
- Integración Postgres real (`apps/api/test/integration/`): editar tres veces seguidas produce una fila de outbox por suscripto; correr el job dos veces no duplica; suspender y reanudar.
- Rutas: suspender/reanudar (404 ajeno, 409, 422, gate), contrato público sin columnas internas.
- Renderer/plantilla es/en/pt.
- Web: `VenueEventEntryCard` (botón Suspender/Reanudar, textos de ayuda y de borrado), `VenueEvents.astro` con chip "Suspendido", guard de páginas sin sesión.
- Registro: `schedules-manifest.test.ts`, `email-outbox-template-registry.guard.test.ts`.
- Migración y drift guard.
- Staging: cambio de hora real y suspensión con correo real a una casilla de prueba.

## 9. Riesgos

- R-1: depende de ids estables (HOS-2291). Un cliente que no mande ids borraría y recrearía eventos (sin avisos y perdiendo suscripciones).
- R-2: conflicto con los specs de eventos (HOS-2254, 2263, 2264) que también tocan `venue_events` y `replaceVenueEvents`. Hay que acordar el orden de merge y una sola migración.
- R-3: fuga de columnas internas por el `...row` de `projectEvent` (5.3). Mitigado con selección explícita y test.
- R-4: "suspender" un evento semanal afecta solo la próxima fecha (decidido por el owner); un dueño que quiera cortar la serie debe estacionar el evento. El texto del editor lo aclara.
- R-5: dueño que se equivoca de hora y corrige dentro del enfriamiento: los suscriptos pueden tener el dato erróneo hasta 2 horas. Ver OQ-3. No aplica a suspender/reanudar, que saltean el enfriamiento.
- R-6: no hay aviso al borrar: un dueño que borra en vez de suspender deja a la gente sin aviso. Mitigado con el texto del editor.

## 10. Preguntas abiertas y decisiones

- OQ-1 (resuelta): Decidido (owner, 16/11/2026): "Suspender" un evento semanal afecta solo la próxima fecha y vuelve solo.
- OQ-2 (resuelta): Decidido (owner, 16/11/2026): las ediciones se agrupan 15 min y hay 2 h de espera entre avisos del mismo evento.
- OQ-3 (resuelta): **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #19): opción 1.** Una corrección dentro de las 2 h espera el enfriamiento. Opciones: (1) esperar al enfriamiento (recomendada, evita ráfagas); (2) saltear el enfriamiento si el cambio revierte al estado que se había avisado antes.
- OQ-4 (resuelta): Decidido (owner, 16/11/2026): una suspensión siempre avisa y "reanudar" también avisa (ninguna de las dos espera el enfriamiento de 2 h).
- OQ-5 (resuelta): **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #20):** suspender y reanudar también esperan los 15 minutos (se mantiene la ventana). Texto original: ¿La ventana de 15 min también aplica a suspender/reanudar? Hoy sí (permite deshacer un error sin mandar nada, AC-17). Alternativa: enviar en el acto. Recomiendo mantener la ventana.

## 11. Dependencias

- Límite mensual de avisos a seguidores (decisión #48 ✱ de HOS-2252 ronda 2, 18/11/2026; clave nueva por HOS-2259, valores por HOS-2281): Pro 4 por mes, Premium sin tope. El corte en el envío queda abierto (HOS-2281, pregunta 3) y este job lo tiene que respetar.
- HOS-2291 (ids estables de eventos), HOS-2266 (suscripciones, gate), HOS-2267 (tipos, copy, token de baja, `computeNextOccurrence`), HOS-2259/2281 (clave y grant), coordinar con HOS-2254/2263/2264/2255 (eventos).
- `manage_venue_events` se reusa para suspender y reanudar.

## 12. Smoke y Novedades

- `status-needs-smoke-staging`: correo real de cambio y suspensión, ventana de silencio con el cron real, convivencia con el recordatorio.
- `status-needs-smoke-local`: editor, chip "Suspendido" y flujo de ayuda.
- What's New: una única entrada para la serie de avisos; probablemente este spec es el que cierra el bloque, así que acá se escribe (texto: "Si el local mueve o suspende un evento, te avisamos").
- Sin variables de entorno nuevas.

## 13. Desglose de tareas

1. T-1 (requiere HOS-2291) Migración: `suspended_for_date`, `notified_snapshot`, `change_touched_at`, `last_change_notice_at` + índice (junto con HOS-2268 si corresponde).
2. T-2 `projectEvent` con selección explícita + test de no fuga.
3. T-3 Función pura de estado material y comparación + tests.
4. T-4 `replaceVenueEvents` (diff) marca `change_touched_at`/snapshot y recalcula `remind_for_date` + tests.
5. T-5 Servicio y rutas `suspend`/`resume` + tests de integración.
6. T-6 Tipo `VENUE_EVENT_CHANGED`, plantilla, renderer y copy es/en/pt + tests.
7. T-7 Job `venue-event-change-notices` + manifest + registry + tests unitarios (enfriamiento solo para cambios de fecha u hora; suspender/reanudar lo saltean).
8. T-8 Integración Postgres real (agrupación, dedup, enfriamiento).
9. T-9 Web: editor (Suspender, Reanudar, textos), chip en la ficha, ocultar "Avisame" en suspendidos + i18n.
10. T-10 Smoke en staging y entrada de What's New.

## 14. Linear

Canonical tracking: HOS-2269 (hijo de la épica HOS-2252).
