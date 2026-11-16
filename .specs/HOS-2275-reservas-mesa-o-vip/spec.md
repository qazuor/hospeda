---
title: Reservas de mesa o VIP
linear: HOS-2275
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - db
  - api
  - web
---

# Reservas de mesa o VIP (premium)

## 1. Resumen

El turista (con cuenta) pide una reserva de **mesa** (rubro comida) o de **mesa o box
VIP** (rubro noche). El local decide si la acepta, ve un panel de reservas por día con
estados, y al turista le llegan correos de cada cambio, en su idioma. Sin pagos ni
seña. Gate `venue_reservations`, plan premium.

Asume las opciones recomendadas de HOS-2260: reserva **por solicitud** que el local
acepta o rechaza, y que vence a las 24 horas sin consecuencia (OQ-1).

Este issue define el **modelo de reserva**. Grupos (HOS-2277) y cumpleaños (HOS-2278)
lo extienden con columnas opcionales, sin modelo paralelo.

## 2. Problema

Los locales reservan por WhatsApp. No hay registro, ni disponibilidad, ni aviso al
turista. Para un local premium, "reserva online" es una de las razones para pagar.

## 3. Goals

- G-1: el local define qué se reserva, en qué días y horas, para cuántas personas y cuántas
  unidades hay por horario.
- G-2: el turista ve la disponibilidad y pide la reserva en un flujo corto.
- G-3: el local acepta, rechaza o cancela, y marca asistencia o ausencia.
- G-4: correos de solicitud, aceptación, rechazo, vencimiento y cancelación.
- G-5: nunca se vende más de lo que hay (control de concurrencia).

## 4. Non-goals

- NG-1: pagos, seña o garantía (OQ-5).
- NG-2: plano de mesas, asignación de mesa concreta ("mesa 7"), turnos con solapes.
- NG-3: sincronizar con un sistema externo de reservas.
- NG-4: lista de espera.
- NG-5: reservas de alojamiento o experiencias; `centralized_booking` no se reusa.
- NG-6: el QR (HOS-2276). Acá la reserva trae un código corto de texto.

## 5. Estado actual del código

- No existe nada de reservas. Auditado: ninguna tabla, ruta ni servicio.
- `centralized_booking` (`packages/schemas/src/catalog/entitlement-keys.ts:45`): clave
  vertical sin código; texto "Reservas centralizadas" (`billing.json:612`) junto a
  `multi_property_management`. Es de gestión multi-propiedad. **No se reusa.** Si el
  owner igual quiere reciclarla, hay que revisarlo con la épica de billing (nota del
  issue); la recomendación es una clave nueva `venue_reservations`.
- `listing-access` admite `capabilities` y `limit` por ruta
  (`apps/api/src/middlewares/listing-access.ts:208-276`).
- Secciones y rubros: `listing-sections.ts` y `business-lines.ts:26-39`.
- Patrón "A declara, B confirma": `host_trade_benefit_usage.dbschema.ts` y
  `routes/host-trade/protected/usage-transitions.ts` (rutas de transición sin permiso,
  autorizadas por fila, 404 para lo ajeno, sin auto-confirmación por silencio).
- Crons: `apps/api/src/cron/schedules.manifest.ts` y `cron/jobs/host-trade-usage-expiry.job.ts`
  (vencimiento de `PENDING`) son el precedente directo del vencimiento de solicitudes.
- Notificaciones: `NotificationType`, `NOTIFICATION_CATEGORY_MAP`, outbox
  (`packages/notifications/src/...`).
- Mi cuenta: `apps/web/src/pages/[lang]/mi-cuenta/`.

## 6. Diseño propuesto

### 6.1 Capacidad (ver OQ-C)

Modelo elegido: **tipos de reserva con horarios y cantidad por horario**.

- Un **tipo** es lo que el local ofrece: "Mesa para 4", "Box VIP 1".
- Un **horario** (slot) es un día de la semana y una hora, con una **cantidad** de
  unidades. Ej: "Box VIP, viernes 23:00, 3 boxes".
- Disponible = `cantidad - reservas activas` de ese tipo, fecha y hora.
- No se asigna mesa concreta (NG-2).

### 6.2 Tablas

`venue_reservation_type`:

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `venue_id` | uuid fk `venues` ON DELETE CASCADE | cuelga del listing (PURGED) |
| `kind` | enum `venue_reservation_kind` | `TABLE`, `VIP` |
| `name` | varchar(80) | |
| `description` | text null | |
| `min_party_size` / `max_party_size` | smallint | `1 <= min <= max <= 50` |
| `is_active` | boolean default true | desactivar en vez de borrar si tiene reservas |
| `display_order` | integer | |
| auditoría + soft delete | | |

`venue_reservation_slot`:

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `type_id` | uuid fk | |
| `weekday` | smallint | 0 domingo a 6 sábado (igual que `venue_events`) |
| `start_time` | time | local, `HH:MM` (cuidado con los segundos: ver `toClockTime`) |
| `quantity` | smallint | unidades disponibles en ese horario |

Único `(type_id, weekday, start_time)`.

`venue_reservation`:

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `venue_id` | uuid fk | desnormalizado para el panel |
| `type_id` | uuid fk RESTRICT | |
| `user_id` | uuid fk `users` | |
| `reservation_date` | date | |
| `reservation_time` | time | |
| `party_size` | smallint | validado contra el tipo |
| `status` | enum `venue_reservation_status` | los 8 estados de HOS-2260 (6.2) |
| `contact_name` | varchar(120) | PII |
| `contact_phone` | varchar(30) | PII, E.164 normalizado |
| `note` | varchar(300) null | PII |
| `short_code` | varchar(8) | código legible |
| `requested_at` | timestamptz | |
| `expires_at` | timestamptz | `min(requested_at + 24h, fecha_hora - 1h)` |
| `decided_at`, `decided_by_id` | null | quién aceptó o rechazó |
| `decision_note` | varchar(300) null | motivo, opcional |
| `checked_in_at`, `cancelled_at` | timestamptz null | |
| `anonymized_at` | timestamptz null | cron de retención |
| auditoría + soft delete | | |

Índices: `(venue_id, reservation_date, status)` para el panel; `(type_id,
reservation_date, reservation_time, status)` para disponibilidad; `(user_id, status)`
para Mi cuenta; único parcial `(user_id, type_id, reservation_date, reservation_time)
WHERE status IN ('REQUESTED','CONFIRMED','CHECKED_IN') AND deleted_at IS NULL`
(frena el doble clic); `(status, expires_at) WHERE status = 'REQUESTED'` para el cron.

CHECK en extras: `party_size > 0`, `expires_at > requested_at`.

Filas nuevas en `scripts/guards/purged-closed-list.json` para `venue_reservation_type`
y `venue_reservation_slot` (si cuelga por FK de `venue_reservation_type`, queda cubierta
por su padre; confirmar con el guard) y para `venue_reservation` (`venue_id` FK).
Tratamiento PURGED: ver OQ-9 de HOS-2260.

### 6.3 Concurrencia

`requestReservation` corre en transacción: bloquea la fila del slot
(`SELECT ... FOR UPDATE` sobre `venue_reservation_slot`), cuenta las reservas activas de
ese tipo, fecha y hora (`REQUESTED`, `CONFIRMED`, `CHECKED_IN`), y si `count >= quantity`
responde 409 `NO_AVAILABILITY`. Una solicitud pendiente **retiene** el lugar hasta que
vence o se rechaza.

Validaciones del pedido, en orden: fecha dentro de [ahora + 2 h, ahora + 60 días]
(OQ-12); el día de la semana tiene slot a esa hora; `party_size` dentro de
`[min, max]` del tipo; el tipo está activo y el local publicado; máximo 3 pendientes
del mismo usuario en el mismo local.

### 6.4 Gates y rubro

- Sección nueva `reservations` (venue, `common: false`, `entitlementKey:
  K.VENUE_RESERVATIONS`), incluida en `sections` de **ambos** rubros (`food` y
  `nightlife`).
- `kind = TABLE` exige rubro `food`; `kind = VIP` exige rubro `nightlife`. Un bar con
  los dos ofrece los dos. Incumplirlo: 400 `VALIDATION_ERROR`,
  `details.reason = KIND_NOT_ALLOWED_FOR_BUSINESS_LINE`.
- Configurar tipos y horarios: `listingAccess` `{ vertical: VENUE, operation: 'EDIT',
  listingSection: reservations, capabilities: [venue_reservations] }`.
- Panel (lectura): operación `READ_OWN_COMMERCIAL` con la misma `capabilities`.
- **No se gatea por plan** (decisión 6): pedir una reserva (si el local ya tiene tipos
  activos), cancelarla, y las transiciones del local sobre filas que ya existen. Tras una
  baja de plan: no se editan ni crean tipos, los tipos se ocultan al público (no se
  aceptan pedidos nuevos), y el panel queda de solo lectura con las transiciones sobre
  reservas ya existentes hasta pasada la última.

**Cómo se oculta al público tras una baja.** Las lecturas públicas del local ya retienen
lo que el plan del **dueño** no incluye (precedente y regresión: HOS-1792,
`apps/api/test/routes/venue/public/menu-file-gate.test.ts`, que lee el conjunto efectivo
del dueño con `rehydrateEffectiveSet`). La disponibilidad y el estado de lista usan el
mismo mecanismo con la clave de la feature; hay que cubrir `by-id`, `list`,
`by-destination` y `by-slug`, que fue exactamente lo que HOS-1792 encontró desparejo.

### 6.5 Rutas

| Método y ruta | Tier | Quién | Nota |
|---|---|---|---|
| `GET/POST /protected/venues/:id/reservation-types` | protected | dueño (gate) | alta de tipo con sus slots |
| `PATCH/DELETE /protected/venues/:id/reservation-types/:typeId` | protected | dueño (gate) | `DELETE` desactiva si hay reservas |
| `GET /public/venues/:id/reservation-availability?date=&partySize=` | public | todos | `[{ typeId, name, kind, times:[{time, available}] }]`, **sin cantidades** |
| `POST /protected/venue-reservations` | protected | turista | `{ typeId, date, time, partySize, phone, note }` → 201 `REQUESTED` |
| `GET /protected/me/venue-reservations` | protected | turista | las propias |
| `POST /protected/me/venue-reservations/:id/cancel` | protected | turista | hasta 2 h antes (OQ-2); 404 si es ajena |
| `GET /protected/venues/:id/reservations?date=&status=` | protected | dueño (gate lectura) | panel |
| `POST /protected/venues/:id/reservations/:rid/accept` | protected | dueño | `REQUESTED → CONFIRMED` |
| `POST .../reject`, `.../cancel`, `.../check-in`, `.../no-show` | protected | dueño | `reject` y `cancel` aceptan `{ note }` |

- Cada transición responde 409 `ALREADY_EXISTS` con `details.reason: INVALID_TRANSITION`
  si el estado no la admite (por ejemplo aceptar algo vencido). Una carrera entre el
  vencimiento y un "aceptar" se resuelve con un `UPDATE ... WHERE status = 'REQUESTED'`
  condicional y chequeo de filas afectadas.
- Rate limit del `POST`: 5 por hora por usuario.

### 6.6 Servicio y cron

- `VenueReservationService` (`packages/service-core/src/services/venue/`): `defineTypes`,
  `availability`, `request`, `accept`, `reject`, `cancelByGuest`, `cancelByVenue`,
  `checkIn`, `markNoShow`, `listForDay`. Devuelve `Result<T>`.
- Cron `venue-reservation-expiry` (cada 15 minutos, `schedules.manifest.ts`, patrón de
  `host-trade-usage-expiry`): `REQUESTED` con `expires_at <= now` pasa a `EXPIRED` y
  manda correo. Idempotente.
- Cron `venue-reservation-retention` (diaria): anonimiza PII pasado el plazo (90 días
  tras la fecha de la reserva, OQ-3). Compartida con la lista (HOS-2274).

### 6.7 Notificaciones

Todas `TRANSACTIONAL`, plantillas React Email, es/en/pt:

| Tipo | Destinatario | Cuándo |
|---|---|---|
| `VENUE_RESERVATION_REQUESTED` | turista | al pedirla ("el local tiene 24 h para responder") |
| `VENUE_RESERVATION_NEW` | dueño del local | al llegar una solicitud |
| `VENUE_RESERVATION_ACCEPTED` | turista | al aceptar (con código) |
| `VENUE_RESERVATION_REJECTED` | turista | al rechazar (con motivo si lo hay) |
| `VENUE_RESERVATION_EXPIRED` | turista | al vencer sin respuesta |
| `VENUE_RESERVATION_CANCELLED_BY_VENUE` | turista | cancelación del local |
| `VENUE_RESERVATION_CANCELLED_BY_GUEST` | dueño | cancelación del turista |

El correo del dueño usa el de su cuenta. Sin recordatorio previo en esta etapa (OQ-11).

## 7. UX / UI

- **Ficha pública:** botón "Reservar" (island). Elige fecha, personas y horario; muestra
  solo los horarios con disponibilidad; pide teléfono y nota; confirma con texto claro:
  "Es una solicitud. El local te responde en hasta 24 horas".
- **Mi cuenta → Reservas:** estados con color y texto (no solo color), cancelar,
  código, datos del local.
- **Panel del local:** vista por día (lista agrupada por horario), contador de
  pendientes, botones aceptar y rechazar con motivo, marcar asistencia o ausencia.
  Configuración de tipos y horarios en la edición del comercio.
- Accesibilidad: foco, `aria-live` para el estado de la solicitud.

## 8. i18n

`venue.reservations.*` (público y panel), `account.reservations.*`,
`notifications.venueReservation.*`. es, en, pt. Los motivos de rechazo son texto libre
del local (no se traducen).

## 9. Criterios de aceptación

- AC-1: dado un local premium de rubro comida, crea un tipo `TABLE` con un horario y
  cantidad 2; un tipo `VIP` responde 400 `KIND_NOT_ALLOWED_FOR_BUSINESS_LINE`.
- AC-2: dado un plan sin `venue_reservations`, crear un tipo responde 403
  `ENTITLEMENT_REQUIRED`.
- AC-3: dado un horario con cantidad 1 y una reserva activa, otra solicitud responde 409
  `NO_AVAILABILITY`.
- AC-4: dado cantidad 3 y 10 solicitudes simultáneas, quedan exactamente 3 activas.
- AC-5: una solicitud nace `REQUESTED`, aparece en el panel y manda dos correos
  (turista y dueño).
- AC-6: al aceptar pasa a `CONFIRMED` y se avisa al turista; aceptar de nuevo responde
  409 `INVALID_TRANSITION`.
- AC-7: sin respuesta, a las 24 h (o 1 h antes de la fecha, lo que ocurra primero) pasa
  a `EXPIRED` con correo y libera el lugar; el cron es idempotente.
- AC-8: el turista cancela hasta 2 h antes; después responde 409 `INVALID_TRANSITION`
  con `details.reason = TOO_LATE_TO_CANCEL`.
- AC-9: la reserva de otro usuario responde 404 en todas las rutas del turista.
- AC-10: sin sesión, 401; con email sin verificar, 403 `EMAIL_NOT_VERIFIED`.
- AC-11: `party_size` fuera de `[min, max]` responde 400 `VALIDATION_ERROR`.
- AC-12: dos pedidos iguales del mismo usuario (doble clic) crean una sola reserva.
- AC-13: más de 3 pendientes del mismo usuario en el mismo local responde 409.
- AC-14: tras bajar de plan, las reservas ya existentes se siguen pudiendo aceptar,
  cancelar y marcar; no se pueden crear ni editar tipos y el público no ve horarios.
- AC-15: la disponibilidad pública no expone cantidades.
- AC-16: pasados 90 días de la fecha, nombre, teléfono y nota quedan anonimizados.

## 10. Plan de pruebas

- Unit: tabla de transiciones, `expires_at`, validaciones del pedido, normalización del
  teléfono (`packages/service-core/test/services/venue/venue-reservation.test.ts`).
- Integración con base: concurrencia (AC-4), índice único parcial, RESTRICT, crons
  (`packages/service-core/test/integration/...`, `apps/api/test/cron/...`).
- Rutas (`apps/api/test/routes/venue/...`): orden del contrato, 404 de ajenos, gates,
  rate limit.
- Guards: `check-purged-closed-list`, `check-step5-declared`, G1/G2 (`VerticalEnum.VENUE`
  en cada ruta, sin `vertical === 'venue'` en código compartido).
- Web: isla de reserva, panel, Mi cuenta.
- E2E (`apps/e2e`): pedir, aceptar, recibir correo, cancelar.

## 11. Riesgos

- R-1: sobreventa; mitigado con bloqueo de slot y prueba de concurrencia.
- R-2: solicitudes que nadie responde. El vencimiento libera el lugar y avisa.
- R-3: PII de terceros; mínimo de datos y anonimización.
- R-4: el local no mira el panel: se manda correo por cada solicitud nueva.
- R-5: dependencia del catálogo (HOS-2259) y de la pasada final de HOS-1352.
- R-6: husos horarios y cierre de noche pasada la medianoche. `reservation_date` es la
  fecha del **servicio** (la noche empieza el viernes y termina el sábado), no del
  instante. Precedente: `venue-hours.ts` cruza la medianoche.

## 12. Preguntas abiertas para el owner

Las generales: HOS-2260 (OQ-1, 2, 3, 4, 5, 8, 9, 11, 12). Específicas:

- OQ-C: **modelo de capacidad.** Opciones: (1) aforo por horario en personas; (2) tipos
  con cantidad por horario (**recomendada**: refleja "3 boxes VIP", se explica solo y
  evita asignar mesas); (3) inventario de mesas con asignación (plano). La 3 es otra
  épica. Impacto de la 1: no distingue entre una mesa de 2 y un box VIP de 10.
- OQ-D: **¿una reserva pendiente retiene el lugar?** Recomendada: sí (evita que dos
  turistas esperen el mismo lugar). Contra: un local que no contesta bloquea cupo hasta
  las 24 h.
- OQ-E: **¿el local puede cargar una reserva a mano** (alguien que llamó)? Recomendada:
  no en la etapa 1. Contra: el panel no refleja la ocupación real y la disponibilidad
  pública queda optimista.

## 13. Dependencias

- Bloqueado por: HOS-2260, HOS-2259 (clave `venue_reservations`), HOS-2262.
- Habilita: HOS-2276, HOS-2277, HOS-2278, HOS-2283.
- Comparte con HOS-2274: cron de retención, plantillas de correo y sección Mi cuenta.

## 14. Smoke y What's New

`status-needs-smoke-staging`: correo real, vencimiento por cron, concurrencia, zona
horaria. What's New: sí.

## 15. Desglose de tareas

1. T-1: enums, tablas, migración y extras (CHECK, índices parciales) + filas PURGED (1 día).
2. T-2: esquemas Zod y servicio de tipos y disponibilidad (1 día).
3. T-3: pedido con transacción y bloqueo + tabla de transiciones (1 día).
4. T-4: rutas del local (tipos, panel, transiciones) con gate (1 día).
5. T-5: rutas del turista y disponibilidad pública, rate limit (1 día).
6. T-6: cron de vencimiento y de retención (1 día).
7. T-7: notificaciones: 7 tipos, plantillas es/en/pt (1 día).
8. T-8: isla de reserva en la ficha (1 día).
9. T-9: Mi cuenta → Reservas (0,5 día).
10. T-10: panel del local (1 día).
11. T-11: configuración de tipos y horarios en el editor (1 día).
12. T-12: integración, E2E y guards (1 día).

## 16. Linear

Canonical tracking:
HOS-2275
