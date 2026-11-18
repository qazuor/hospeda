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

El turista (cuenta con email verificado) pide una reserva de **mesa** (rubro comida) o de
**mesa o box VIP** (rubro noche) para N personas. El local decide si la acepta, ve un
panel de reservas por día con estados, y al turista le llegan correos de cada cambio, en
su idioma. Sin pagos ni seña. Gate `venue_reservations`, plan premium.

Aplica las decisiones del owner del 16/11/2026 (HOS-2260): reserva **por solicitud** que
el local acepta o rechaza, y que vence a las 24 horas o 1 hora antes de la fecha, lo que
ocurra primero, sin consecuencia (OQ-1). La **capacidad es el aforo total en personas por
noche, un solo número por local** (OQ-C): no hay tipos de mesa ni horarios con cantidad.

Este issue define el **modelo de reserva**. Grupos (HOS-2277) y cumpleaños (HOS-2278)
lo extienden con columnas opcionales, sin modelo paralelo.

## 2. Problema

Los locales reservan por WhatsApp. No hay registro, ni disponibilidad, ni aviso al
turista. Para un local premium, "reserva online" es una de las razones para pagar.

## 3. Goals

- G-1: el local define su **aforo total en personas por noche** (un entero).
- G-2: el turista ve si hay lugar para su fecha y cantidad de personas, y pide la reserva
  en un flujo corto (nombre, teléfono y una nota).
- G-3: el local acepta, rechaza o cancela, y marca asistencia o ausencia (el no-show a mano,
  con un contador interno de ese local y sin consecuencia automática, OQ-8).
- G-4: correos de solicitud, aceptación, rechazo, vencimiento y cancelación.
- G-5: nunca se retienen más personas que el aforo (control de concurrencia); una solicitud pendiente retiene las personas que pidió.

## 4. Non-goals

- NG-1: pagos, seña o garantía (OQ-5).
- NG-2: tipos de mesa con horario, plano de mesas, asignación de mesa concreta ("mesa 7"), turnos con solapes. Los dos primeros se eligen más adelante en HOS-2295 (OQ-C).
- NG-2b: personal de puerta con cuenta propia (HOS-2295).
- NG-3: sincronizar con un sistema externo de reservas.
- NG-4: lista de espera.
- NG-5: reservas de alojamiento o experiencias; `centralized_booking` no se reusa.
- NG-6: el QR (HOS-2276, validado solo por la cuenta del dueño). Acá la reserva trae un código corto de texto.

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

### 6.1 Capacidad (decisión OQ-C)

Modelo elegido por el owner: **aforo total en personas por noche, un único entero por
local**.

- Un local tiene `total_capacity` (ej: 60 personas). No hay "tipos" ni "horarios" que
  configurar.
- La **noche** es la fecha de servicio (`reservation_date`, ver R-6).
- Disponible = `total_capacity - SUM(party_size)` de las reservas `REQUESTED`,
  `CONFIRMED` y `CHECKED_IN` de ese local y esa fecha.
- Una solicitud **pendiente retiene** las personas que pidió (decisión OQ-C), hasta que se
  acepta, se rechaza o vence.
- Mesa y VIP son un dato de la reserva (`kind`), no un recurso con stock propio. Tampoco se
  asigna mesa concreta (NG-2).
- Los tipos de mesa con horario (opción A) y el plano de mesas (opción C) se deciden en
  HOS-2295. Cuando existan, el entero único se reemplaza o se complementa.

### 6.2 Tablas

`venue_reservation_setting` (1 a 1 con el local):

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `venue_id` | uuid fk `venues` ON DELETE CASCADE, único | cuelga del listing (PURGED) |
| `total_capacity` | integer not null | aforo total en personas por noche; CHECK `1..5000` |
| `is_enabled` | boolean default true | el local puede pausar las reservas |
| auditoría + soft delete | | |

`venue_reservation`:

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `venue_id` | uuid fk `venues` | para el panel y el conteo de aforo |
| `user_id` | uuid fk `users` | |
| `kind` | enum `venue_reservation_kind` | `TABLE`, `VIP` (según rubro, ver 6.4) |
| `reservation_date` | date | fecha de **servicio** de la noche |
| `reservation_time` | time | hora de llegada pedida (informativa; no es un slot) |
| `party_size` | smallint | personas; `1 <= party_size <= 50` y `<= total_capacity` |
| `status` | enum `venue_reservation_status` | los 8 estados de HOS-2260 (6.2) |
| `contact_name` | varchar(120) | PII |
| `contact_phone` | varchar(30) | PII, E.164 normalizado |
| `note` | varchar(300) null | PII |
| `short_code` | varchar(8) | código legible |
| `requested_at` | timestamptz | |
| `expires_at` | timestamptz | `min(requested_at + 24h, fecha_hora - 1h)` (OQ-1) |
| `decided_at`, `decided_by_id` | null | quién aceptó o rechazó |
| `decision_note` | varchar(300) null | motivo, opcional |
| `checked_in_at`, `cancelled_at` | timestamptz null | |
| `anonymized_at` | timestamptz null | cron de retención (90 días, OQ-3) |
| auditoría + soft delete | | |

Índices: `(venue_id, reservation_date, status)` para el panel y la disponibilidad;
`(user_id, status)` para Mi cuenta; único parcial `(user_id, venue_id, reservation_date,
reservation_time) WHERE status IN ('REQUESTED','CONFIRMED','CHECKED_IN') AND deleted_at IS
NULL` (frena el doble clic); `(status, expires_at) WHERE status = 'REQUESTED'` para el cron.

CHECK en extras: `party_size > 0`, `expires_at > requested_at`, `total_capacity > 0`.

**No-show y contador interno (OQ-8).** `NO_SHOW` lo marca a mano el local. El contador
interno de ese local no es una tabla: se calcula contando las reservas `NO_SHOW` de ese
usuario en ese local. Solo lo ve ese local, en el panel, y no tiene consecuencia
automática (no bloquea ni penaliza). Se pierde cuando la fila se anonimiza.

Filas nuevas en `scripts/guards/purged-closed-list.json` para `venue_reservation_setting`
(`venue_id` FK) y para `venue_reservation` (`venue_id` FK). Tratamiento PURGED: ver OQ-9
de HOS-2260.

### 6.3 Concurrencia

`requestReservation` corre en transacción: bloquea la fila de `venue_reservation_setting`
del local (`SELECT ... FOR UPDATE`), suma el `party_size` de las reservas activas de esa
fecha (`REQUESTED`, `CONFIRMED`, `CHECKED_IN`), y si `suma + party_size > total_capacity`
responde 409 `NO_AVAILABILITY`. Una solicitud pendiente **retiene** las personas que
pidió hasta que se acepta, se rechaza o vence.

Validaciones del pedido, en orden: fecha dentro de [ahora + 2 h, ahora + 60 días]
(OQ-12); las reservas están habilitadas (`is_enabled`) y el local publicado; `party_size`
entre 1 y 50 y no mayor que `total_capacity`; `kind` permitido para el rubro (6.4); máximo
3 pendientes del mismo usuario en el mismo local. La hora de llegada se valida contra el
horario del local si lo tiene cargado.

### 6.4 Gates y rubro

- Sección nueva `reservations` (venue, `common: false`, `entitlementKey:
  K.VENUE_RESERVATIONS`), incluida en `sections` de **ambos** rubros (`food` y
  `nightlife`).
- Es un dato de la reserva, no un tipo configurable: `kind = TABLE` exige rubro `food`; `kind = VIP` exige rubro `nightlife`. Un bar con
  los dos ofrece los dos. Incumplirlo: 400 `VALIDATION_ERROR`,
  `details.reason = KIND_NOT_ALLOWED_FOR_BUSINESS_LINE`.
- Configurar el aforo: `listingAccess` `{ vertical: VENUE, operation: 'EDIT',
  listingSection: reservations, capabilities: [venue_reservations] }`.
- Panel (lectura): operación `READ_OWN_COMMERCIAL` con la misma `capabilities`.
- **No se gatea por plan** (decisión 6): pedir una reserva (si el local tiene las reservas
  habilitadas), cancelarla, y las transiciones del local sobre filas que ya existen. Tras
  una baja de plan: no se edita el aforo, la disponibilidad se oculta al público (no se
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
| `GET/PUT /protected/venues/:id/reservation-settings` | protected | dueño (gate) | lee o fija `{ totalCapacity, isEnabled }` |
| `GET /public/venues/:id/reservation-availability?date=&partySize=` | public | todos | `{ date, available }`: si cabe esa cantidad esa noche. **Sin cantidades ni aforo** |
| `POST /protected/venue-reservations` | protected | turista | `{ kind, date, time, partySize, phone, note }` → 201 `REQUESTED` |
| `GET /protected/me/venue-reservations` | protected | turista | las propias |
| `POST /protected/me/venue-reservations/:id/cancel` | protected | turista | hasta 2 h antes (OQ-2); 404 si es ajena |
| `GET /protected/venues/:id/reservations?date=&status=` | protected | dueño (gate lectura) | panel |
| `POST /protected/venues/:id/reservations/:rid/accept` | protected | dueño | `REQUESTED → CONFIRMED` |
| `POST .../reject`, `.../cancel`, `.../check-in`, `.../no-show` | protected | dueño | `reject` y `cancel` aceptan `{ note }`; `no-show` es manual (OQ-8) |

- Cada transición responde 409 `ALREADY_EXISTS` con `details.reason: INVALID_TRANSITION`
  si el estado no la admite (por ejemplo aceptar algo vencido). Una carrera entre el
  vencimiento y un "aceptar" se resuelve con un `UPDATE ... WHERE status = 'REQUESTED'`
  condicional y chequeo de filas afectadas.
- Rate limit del `POST`: 5 por hora por usuario.

### 6.6 Servicio y cron

- `VenueReservationService` (`packages/service-core/src/services/venue/`): `configureCapacity`,
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
| `VENUE_RESERVATION_CANCELLED_BY_VENUE` | turista | cancelación del local (la otra parte siempre recibe correo, OQ-2) |
| `VENUE_RESERVATION_CANCELLED_BY_GUEST` | dueño | cancelación del turista |

El correo del dueño usa el de su cuenta. Sin recordatorio previo en esta etapa (OQ-11).

## 7. UX / UI

- **Ficha pública:** botón "Reservar" (island). Elige fecha, personas, tipo (mesa o VIP
  según el rubro) y hora de llegada; muestra si hay lugar esa noche para esa cantidad; pide
  teléfono y nota; confirma con texto claro:
  "Es una solicitud. El local te responde en hasta 24 horas".
- **Mi cuenta → Reservas:** estados con color y texto (no solo color), cancelar,
  código, datos del local.
- **Panel del local:** vista por día (lista agrupada por horario), contador de
  pendientes, botones aceptar y rechazar con motivo, marcar asistencia o ausencia.
  Contador interno de no-shows por cliente. Configuración del aforo en la edición del
  comercio.
- Accesibilidad: foco, `aria-live` para el estado de la solicitud.

## 8. i18n

`venue.reservations.*` (público y panel), `account.reservations.*`,
`notifications.venueReservation.*`. es, en, pt. Los motivos de rechazo son texto libre
del local (no se traducen).

## 9. Criterios de aceptación

- AC-1: dado un local premium de rubro comida, fija el aforo en 40 y recibe pedidos
  `TABLE`; un pedido `VIP` responde 400 `KIND_NOT_ALLOWED_FOR_BUSINESS_LINE`.
- AC-2: dado un plan sin `venue_reservations`, fijar el aforo responde 403
  `ENTITLEMENT_REQUIRED`.
- AC-3: dado aforo 10 con 8 personas retenidas esa noche, una solicitud de 4 responde 409
  `NO_AVAILABILITY`; una de 2 se acepta.
- AC-4: dado aforo 10 y 20 solicitudes simultáneas de 1 persona, quedan exactamente 10
  activas.
- AC-4b: una solicitud `REQUESTED` retiene sus personas; al rechazarse o vencer, se liberan.
- AC-5: una solicitud nace `REQUESTED`, aparece en el panel y manda dos correos
  (turista y dueño).
- AC-6: al aceptar pasa a `CONFIRMED` y se avisa al turista; aceptar de nuevo responde
  409 `INVALID_TRANSITION`.
- AC-7: sin respuesta, a las 24 h (o 1 h antes de la fecha, lo que ocurra primero) pasa
  a `EXPIRED` con correo y libera las personas retenidas; el cron es idempotente.
- AC-8: el turista cancela hasta 2 h antes; después responde 409 `INVALID_TRANSITION`
  con `details.reason = TOO_LATE_TO_CANCEL`.
- AC-9: la reserva de otro usuario responde 404 en todas las rutas del turista.
- AC-10: sin sesión, 401; con email sin verificar, 403 `EMAIL_NOT_VERIFIED`.
- AC-11: `party_size` fuera de `[1, 50]` o mayor que el aforo responde 400 `VALIDATION_ERROR`.
- AC-12: dos pedidos iguales del mismo usuario (doble clic) crean una sola reserva.
- AC-13: más de 3 pendientes del mismo usuario en el mismo local responde 409.
- AC-14: tras bajar de plan, las reservas ya existentes se siguen pudiendo aceptar,
  cancelar y marcar; no se puede editar el aforo y el público no ve disponibilidad.
- AC-15: la disponibilidad pública no expone cantidades ni el aforo.
- AC-16: pasados 90 días de la fecha, nombre, teléfono y nota quedan anonimizados.
- AC-17: `no-show` solo se marca a mano; el local ve el contador de ese cliente y no hay
  consecuencia automática. El local nunca ve el email del turista.

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

- R-1: sobreventa del aforo; mitigado con bloqueo de la fila de configuración y prueba de concurrencia.
- R-2: solicitudes que nadie responde retienen aforo hasta 24 h. El vencimiento libera las personas y avisa.
- R-3: PII de terceros; mínimo de datos y anonimización.
- R-4: el local no mira el panel: se manda correo por cada solicitud nueva.
- R-5: dependencia del catálogo (HOS-2259) y de la pasada final de HOS-1352.
- R-6: husos horarios y cierre de noche pasada la medianoche. `reservation_date` es la
  fecha del **servicio** (la noche empieza el viernes y termina el sábado), no del
  instante. Precedente: `venue-hours.ts` cruza la medianoche.

## 12. Preguntas abiertas para el owner

Decididas en HOS-2260 (16/11/2026): OQ-1, 2, 3, 4, 5, 8 y OQ-C. OQ-9, 10, 11, 12 y 13
se decidieron el 18/11/2026 (HOS-2252 ronda 2, #33 a #37), abajo. Específicas:

- OQ-C: **Decidido (owner, 16/11/2026): aforo total en personas por noche, un solo
  número** (opción 1 de las originales; no la 2 recomendada). Tipos con horario o plano de
  mesas: HOS-2295.
- OQ-D: **Decidido (owner, 16/11/2026): una solicitud pendiente retiene las personas que
  pidió.** Contra asumido: un local que no contesta bloquea aforo hasta el vencimiento.
- OQ-9 de HOS-2260 (#33): **decidido**: no se puede borrar un local o evento con anotados o reservas confirmadas; primero hay que cancelarlos, y se les avisa (el correo de cancelación del local, 6.7).
- OQ-10 de HOS-2260 (#34): **decidido**: el admin ve las reservas solo en lectura (`venueReservation.viewAll`), desde la etapa 2. No hay rutas de admin en esta spec.
- OQ-11 de HOS-2260 (#35): **decidido**: no hay recordatorio de reserva en la etapa 1.
- OQ-12 de HOS-2260 (#36): **decidido**: la ventana de reserva es fija, de 2 horas a 60 días (6.3).
- OQ-13 de HOS-2260 (#37): **decidido**: la lista de invitados no descuenta del aforo de reservas.
- OQ-E: **¿el local puede cargar una reserva a mano** (alguien que llamó)? **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #39): no en la etapa 1.** Contra: el panel no refleja la ocupación real y
  la disponibilidad pública queda optimista.

## 13. Dependencias

- Bloqueado por: HOS-2260, HOS-2259 (clave `venue_reservations`), HOS-2262.
- Habilita: HOS-2276, HOS-2277, HOS-2278, HOS-2283. Etapa 2 (capacidad por mesas, personal de puerta): HOS-2295.
- Comparte con HOS-2274: cron de retención, plantillas de correo y sección Mi cuenta.

## 14. Smoke y What's New

`status-needs-smoke-staging`: correo real, vencimiento por cron, concurrencia, zona
horaria. What's New: sí.

## 15. Desglose de tareas

1. T-1: enums, tablas `venue_reservation_setting` y `venue_reservation`, migración y extras (CHECK, índices parciales) + filas PURGED (1 día).
2. T-2: esquemas Zod y servicio de aforo y disponibilidad (1 día).
3. T-3: pedido con transacción, bloqueo y retención de personas + tabla de transiciones (1 día).
4. T-4: rutas del local (aforo, panel, transiciones, no-show manual) con gate (1 día).
5. T-5: rutas del turista y disponibilidad pública, rate limit (1 día).
6. T-6: cron de vencimiento y de retención (1 día).
7. T-7: notificaciones: 7 tipos, plantillas es/en/pt (1 día).
8. T-8: isla de reserva en la ficha (1 día).
9. T-9: Mi cuenta → Reservas (0,5 día).
10. T-10: panel del local (1 día).
11. T-11: configuración del aforo en el editor (0,5 día).
12. T-12: integración, E2E y guards (1 día).

## 16. Linear

Canonical tracking:
HOS-2275
