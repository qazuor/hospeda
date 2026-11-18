---
title: Reservas y listas de Comer y salir (spec paraguas y decisiones de producto)
linear: HOS-2260
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - api
  - web
  - db
  - billing
---

# Reservas y listas de Comer y salir (spec paraguas y decisiones de producto)

## 1. Resumen

Esta spec es el paraguas de los cinco issues de reservas de la épica HOS-2252:
lista de invitados (HOS-2274), reservas de mesa o VIP (HOS-2275), QR de ingreso
(HOS-2276), reservas de grupo (HOS-2277) y cumpleaños (HOS-2278).

Hace dos cosas:

1. Fija el **modelo común** que los cinco comparten (tablas, estados, errores,
   permisos, gates, notificaciones, retención), para que no se diseñen cinco
   modelos paralelos.
2. Registra las **decisiones de producto** de las reservas. El owner cerró OQ-1 a OQ-8
   y OQ-C el 16/11/2026 (sección 11). Dos difieren de la recomendación original: OQ-6
   (QR validado solo por la cuenta del dueño) y OQ-C (capacidad = aforo total en
   personas por noche). Las specs hijas ya aplican esas decisiones. OQ-9 a OQ-13
   se cerraron el 18/11/2026 (sección 11).

Nada de esto existe hoy en ninguna vertical. No hay que migrar nada: es código nuevo.

## 2. Problema

Un local de noche que paga pro o premium compra casi solo funciones de la carta.
La épica le suma funciones de noche. Las reservas y las listas son el bloque más
grande y el único sin diseño: no hay flujo, ni datos, ni reglas de retención.

## 3. Goals

- G-1: un solo modelo de "persona que va a un local un día" (anotado en lista, mesa,
  VIP, grupo, cumpleaños) con un solo ciclo de estados y un solo QR de ingreso.
- G-2: sin pagos en la etapa 1.
- G-3: respetar las decisiones del owner del 16/11 (topes, baja de plan, solo noche
  para la lista) y las reglas del catálogo (versiones inmutables, additive grant).
- G-4: que lo ya confirmado siempre se honre, aunque el local baje de plan.
- G-5: datos personales mínimos, con retención definida.

## 4. Non-goals

- NG-1: seña, pago, garantía de tarjeta o devolución. El adaptador de MercadoPago no
  soporta `charge` (ver CLAUDE.md raíz, "Measured MercadoPago behaviour").
- NG-2: cuentas con varios usuarios, link de puerta y cuentas de empleados. Pasan a
  HOS-2295 (etapa 2). Ver OQ-6.
- NG-3: lista de espera automática, canje de beneficios en caja, integración con
  ticketeras (eso es HOS-2255), plano de mesas y tipos de mesa con horario (HOS-2295).
- NG-4: reservas para alojamiento y experiencias. `centralized_booking` es de
  alojamiento y no se toca (ver sección 5).
- NG-5: motor de disponibilidad general (calendarios, turnos, solapes).

## 5. Estado actual del código (verificado en `origin/staging`)

| Qué | Dónde | Hallazgo |
|---|---|---|
| Eventos del local | `packages/db/src/schemas/venue/venue_event.dbschema.ts:97` | Tabla `venue_events`: `once` o `weekly` (`recurrence`, línea 114), `date`, `weekday` (135), `isActive` (153). Sin capacidad, sin imagen, sin entrada. |
| Escritura de eventos | `packages/service-core/src/services/venue/venue.events.ts:218` (`replaceVenueEvents`) | **Borra y reinserta todo el documento.** Los ids NO son estables (línea 22) y el payload no trae ids. El propio comentario dice que el día que algo referencie un evento "esta función crece un diff". Ese día es éste. |
| Tope de eventos | `packages/schemas/src/entities/venue/subtypes/venue.event.schema.ts:54` | `VENUE_EVENTS_MAX_ENTRIES = 30`, fijo en código. |
| Ruta de eventos | `apps/api/src/routes/venue/protected/putEvents.ts` | `PUT /protected/venues/:id/events`, `listingAccess` con `listingSection: venueEvents`. |
| Sección | `packages/schemas/src/catalog/listing-sections.ts:108` | `venueEvents`, `common: true`, gate `manage_venue_events`. |
| Rubros | `packages/schemas/src/catalog/business-lines.ts:26-39` | Rubro `food` trae `sections: ['menu','dailySpecials']`; rubro `nightlife` (slug `noche`) trae `sections: ['nightInfo']`. **Ese es el mecanismo del "solo para locales con carta/noche"**: una sección por rubro. |
| Reglas por tipo | `business-lines.ts:62-90` | Boliche = solo noche. Bar, cervecería, pub = comida y noche. Restaurante = comida y puede sumar noche. |
| Clave huérfana | `packages/schemas/src/catalog/entitlement-keys.ts:45` | `centralized_booking` (vertical, MAX). Sin código. Su texto en `billing.json:612` es "Reservas centralizadas" y vive junto a `multi_property_management` (gestión de varias propiedades). **No reusarla**: se leería como lo que no es. |
| QR existente | `packages/schemas/src/enums/qr-code-purpose.enum.ts:42-52` | Propósitos: `HOST_TRADE_USAGE`, `LISTING`, `MENU`, `CERTIFICATE`, `BROCHURE`. Son **stickers**: un slug impreso, un destino editable, un contador de escaneos (`qr_codes`, `qr_code_scans`). No sirven para un pase por persona (ver OQ-6 y HOS-2276). |
| "A declara, B confirma" | `packages/db/src/schemas/host-trade/host_trade_benefit_usage.dbschema.ts` | Patrón: estados `PENDING → CONFIRMED / REJECTED / EXPIRED`, sin auto-confirmación ("el silencio no es consentimiento"), índice único parcial `WHERE status = 'PENDING'` (línea 111), rutas sin permiso que autorizan por fila, todo lo ajeno responde 404. Se reusa el patrón, no la tabla. |
| Notificaciones | `packages/notifications/src/types/notification.types.ts:212` y `config/notification-categories.ts` | Hay un tipo por mensaje y una categoría (`TRANSACTIONAL` no se puede silenciar). El precedente de pedido de confirmación es `HOST_TRADE_USAGE_CONFIRMATION_REQUEST`. |
| Retención | `apps/api/src/cron/jobs/ai-listing-questions-retention.job.ts`, `schedules.manifest.ts:312` | Precedente de purga diaria con plazo fijado por el owner (12 meses). |
| Rate limit | `apps/api/src/middlewares/rate-limit.ts:1574` | `createSlidingWindowPerUserRateLimit`. Precedente de uso en `routes/venue/protected/menuQrScans.ts`. |
| Autorización | `packages/verticals/src/authorization/listing-operation.ts`, `apps/api/src/middlewares/listing-access.ts:208-276` | `capabilities` por ruta (puede ser función del body) y `limit` por ruta. Un rol nunca decide (G6). |
| Cuenta del turista | `apps/web/src/pages/[lang]/mi-cuenta/` | Ya hay secciones (`favoritos`, `consultas`, `usos-de-beneficio`). Habría que sumar `reservas`. |
| Tabla cerrada de PURGED | `scripts/guards/purged-closed-list.json` (guard `check-purged-closed-list`) | Toda tabla que cuelga de un listing (FK a `venues` o `entity_type`) necesita una fila. `venue_events` está en la línea 91. |

## 6. Diseño propuesto (modelo común)

Todo lo que sigue aplica las decisiones del owner de la sección 11.

### 6.1 Tablas (todas nuevas, nombres en singular, regla del repo para tablas nuevas)

| Tabla | Issue | Para qué |
|---|---|---|
| `venue_event_guest_list` | HOS-2274 | Configuración de la lista de un evento (1 a 1): abierta, cupo, cierre. |
| `venue_guest_list_entry` | HOS-2274 | Un anotado a una fecha de un evento. |
| `venue_reservation_setting` | HOS-2275 | Configuración de reservas del local (1 a 1): **aforo total en personas por noche**, un solo entero (OQ-C). |
| `venue_reservation` | HOS-2275 (+2277, +2278) | Una reserva: mesa o VIP, personas, fecha. Grupo y cumpleaños son columnas opcionales. |
| `venue_reservation_member` | HOS-2277 | Quién confirmó que va a un grupo. |
| `venue_birthday_benefit` | HOS-2278 | El beneficio de cumpleaños del local (1 a 1 con el listing). |
| `venue_entry_pass` | HOS-2276 | El QR: un pase por persona, del anotado o de la reserva individual. Las reservas de grupo llevan **un QR por grupo** (HOS-2252 ronda 2, #41). |

Todas llevan bloque de auditoría y soft delete como el resto del repo, salvo
`venue_entry_scan` si se hace (evento de solo inserción, como `qr_code_scans`).
Las que cuelgan de `venues` (`venue_reservation_setting`, `venue_birthday_benefit`,
y por `venue_events` las de lista) **suman fila en
`scripts/guards/purged-closed-list.json`** y en el test congelado del guard
(`packages/db/test/integration/purged-closed-list-from-empty.test.ts`).
Tratamiento propuesto en PURGED: se borran con el contenido, igual que
`venue_events`. Las filas con datos personales (`venue_guest_list_entry`,
`venue_reservation`, `venue_reservation_member`, `venue_entry_pass`) se
**anonimizan** en vez de borrarse si hay una reserva confirmada futura; esto se
cierra en la spec de implementación de PURGED (HOS-1476). OQ-9 está decidida: no se
puede borrar un local o evento con anotados o reservas confirmadas hasta cancelarlos.

### 6.2 Ciclo de estados común

```
solicitud (reserva)             anotación (lista)
   REQUESTED ──accept──▶ CONFIRMED ◀── anotarse ── (nace CONFIRMED)
      │  │                   │  │
 reject  vence             cancel  puerta
      ▼   ▼                   ▼      ▼
 REJECTED EXPIRED     CANCELLED_*   CHECKED_IN
                               └─(manual)─▶ NO_SHOW
```

- Estados: `REQUESTED`, `CONFIRMED`, `REJECTED`, `EXPIRED`, `CANCELLED_BY_GUEST`,
  `CANCELLED_BY_VENUE`, `CHECKED_IN`, `NO_SHOW`.
- La lista nace en `CONFIRMED` (o se rechaza con 409 si cierra/llena). La reserva nace
  en `REQUESTED` y espera al local. `EXPIRED` no tiene consecuencia, como en HOST_TRADE.
- `NO_SHOW` lo marca **a mano el local** (OQ-8). Nunca se deduce de un QR sin validar.
- Las transiciones viven en el servicio (`@repo/service-core`), una función por
  transición, y se prueban con una tabla de transiciones. Un estado terminal no vuelve.

### 6.2 bis Capacidad (decisión OQ-C)

La capacidad es **un único entero por noche y por local**: el aforo total en personas
(`venue_reservation_setting.total_capacity`). No hay tipos de mesa, ni cantidad de
unidades por horario, ni plano de mesas (eso es HOS-2295).

- Disponible = `total_capacity - SUM(party_size)` de las reservas `REQUESTED`,
  `CONFIRMED` y `CHECKED_IN` de ese local y esa **fecha de servicio**.
- Una solicitud pendiente **retiene** las personas que pidió hasta que se acepta,
  vence o se rechaza.
- Mesa, VIP, grupo y cumpleaños consumen el mismo aforo. La lista de invitados tiene su
  propio cupo por evento (HOS-2274) y no descuenta de este aforo (ver OQ-13).

### 6.3 Gates (claves nuevas, patrón `venue_*`)

| Clave | Tipo | Usada por |
|---|---|---|
| `venue_guest_list` | entitlement | HOS-2274 (configurar y ver la lista) |
| `max_venue_guest_list_size` | límite SUM | HOS-2274 (cupo por evento; pro 100, premium sin tope) |
| `venue_reservations` | entitlement | HOS-2275 y HOS-2276 (panel, aceptar, validar) |
| `venue_group_reservations` | entitlement | HOS-2277 y HOS-2278 |

Las claves se declaran en HOS-2259 (fase 2, bloqueada hasta la pasada final de
HOS-1352) y se asignan a los planes en HOS-2283 con additive grant. Esta spec no
toca el catálogo.

Regla de **qué se gatea y qué no** (cumple la decisión 6 del owner):

- Se gatea con plan: **configurar** y **operar el panel** del local.
- **Nunca** se gatea con plan: que el turista cancele, vea su pase, y que el dueño
  **valide en la puerta** (con su propia sesión) un pase ya emitido. Si el local baja de plan, lo ya
  confirmado funciona hasta que pase su fecha.

### 6.4 Permisos y autorización (G6: un rol nunca decide)

- Rutas del turista (`/protected/...`): solo sesión. Autorizan por **fila**
  (`user_id = actor.id`). Lo ajeno responde 404. No declaran permiso (mismo criterio
  que `host-trade/protected/usage-transitions.ts`).
- Rutas del local: `createProtectedRoute` con `listingAccess` (`vertical: VENUE`,
  operación `EDIT`), `capabilities: [<clave>]` y, donde corresponda, `limit`.
  La propiedad del listing la resuelve el pipeline (paso 4), no un rol.
- Bypass de staff: dos permisos nuevos en `PermissionEnum`,
  `venueReservation.viewAll` y `venueReservation.manageAll` (familia en camelCase;
  ojo con la mezcla de convenciones del enum, ver CLAUDE.md raíz). Sirven al panel admin.
- Sin rutas en `/admin/` en la etapa 1. La lectura de soporte (solo lectura) llega en la
  etapa 2 (OQ-10, decidida).

### 6.5 Contrato de errores (`apps/api/docs/error-contract.md`)

| Caso | HTTP | `error.code` | `details.reason` |
|---|---|---|---|
| Sin sesión | 401 | `UNAUTHORIZED` | |
| Email sin verificar | 403 | `EMAIL_NOT_VERIFIED` | (se exige verificado, ver OQ-4) |
| Plan sin la clave | 403 | `ENTITLEMENT_REQUIRED` | |
| Cupo de plan superado al configurar | 403 | `LIMIT_REACHED` | |
| Lista cerrada / cupo lleno / ya anotado / reserva sin lugar | 409 | `ALREADY_EXISTS` | `LIST_CLOSED`, `LIST_FULL`, `ALREADY_REGISTERED`, `NO_AVAILABILITY` |
| Transición inválida (aceptar algo ya cancelado) | 409 | `ALREADY_EXISTS` | `INVALID_TRANSITION` |
| Pase ya usado / de otro evento / cancelado | 200 con `result` | n/a | `USED`, `WRONG_EVENT`, `CANCELLED` (ver HOS-2276) |
| Fila ajena | 404 | `NOT_FOUND` | |

Nunca un 4xx como `INTERNAL_ERROR`. El invitado (guest) trae un UUID real:
cualquier guard pregunta `isGuestActor(actor)`.

### 6.6 Notificaciones

Tipos nuevos en `NotificationType` (cada uno con plantilla React Email, es/en/pt, y
categoría `TRANSACTIONAL`, porque informan algo sobre la reserva propia). Idioma del
destinatario por el servicio de locale existente.

- Al turista: anotación confirmada, reserva solicitada, aceptada, rechazada, vencida,
  cancelada por el local, recordatorio (no en la etapa 1, OQ-11).
- Al local: reserva nueva por aceptar. La lista **no** manda correo por anotado.
- El pase (QR) viaja en el correo de confirmación (HOS-2276).

### 6.7 Retención de datos personales

Datos personales: nombre mostrado, teléfono, nota, nombre de grupo. Ver OQ-3 y OQ-9.
Una cron diaria nueva, `venue-reservation-retention`, en `schedules.manifest.ts`
(patrón de `ai-listing-questions-retention`), anonimiza (no borra) las filas
pasadas el plazo y conserva los conteos para estadísticas.

### 6.8 Límites de abuso

- Anotarse: 10 por hora por usuario. Pedir reserva: 5 por hora por usuario.
- Reservas pendientes por usuario y local: máximo 3.
- Un usuario, una anotación activa por evento y fecha (índice único parcial).
- Validar pase: 120 por minuto por cuenta del dueño.

Constantes en código, sin precios (G7 no aplica, no son valores comerciales).

## 7. Datos y contratos

Cada spec hija trae sus tablas, rutas y esquemas Zod. Lo común:

- Esquemas Zod en `@repo/schemas` (fuente de verdad), servicios en
  `@repo/service-core` (`VenueReservationService`, `VenueGuestListService`), rutas
  finas en `apps/api/src/routes/venue/{public,protected}/`.
- Migraciones: carril estructural (tablas, enums, índices) con `pnpm db:generate`;
  carril extras para los CHECK entre columnas (hora de cierre, `party_size > 0`) y
  los índices parciales; **sin** data-migration de seed (no hay datos que sembrar).
- Hora y fecha: `date` + `time` locales (precedente `venue_events`), instantes en
  `timestamptz`. Zona horaria del local: `America/Argentina/Buenos_Aires`.

## 8. UX / UI

- Ficha pública del local: botón "Anotate en la lista" / "Reservá" como **island**
  (las páginas son sin sesión: `cacheable-pages-are-session-blind.guard.test.ts`).
- "Mi cuenta": sección nueva `mi-cuenta/reservas` con listas y reservas del turista,
  estado, cancelar y pase.
- Panel del local (web, dentro de la edición del comercio, junto a
  `VenueEventsManager`): lista por evento, reservas por día, configuración.
- Validación en puerta: página mobile-first que usa la **sesión del dueño** (no hay link
  de puerta). El panel muestra un texto que desalienta compartir la contraseña.

## 9. Criterios de aceptación de la spec paraguas

- AC-1: OQ-1 a OQ-8 y OQ-C están decididas (16/11/2026); OQ-9 a OQ-13 también
  (18/11/2026).
- AC-2: los cinco issues hijos tienen su `spec.md` en `.specs/` con las decisiones aplicadas.
- AC-3: ninguna tabla nueva queda sin fila en `purged-closed-list.json`.
- AC-4: ningún gate de plan bloquea validar o cancelar lo ya confirmado.
- AC-5: no hay código de pago ni referencia a `charge` en el módulo.
- AC-6: la capacidad es un solo entero por local y noche; ninguna tabla de tipos de
  mesa ni de links de puerta existe en esta etapa.

## 10. Riesgos

- R-1: **`replaceVenueEvents` borra y reinserta eventos.** Con listas colgando de
  `venue_events.id`, cada guardado del editor dejaría huérfanos o borraría a todos
  los anotados. Es el riesgo técnico más alto y obliga a un diff estable antes de la
  lista. Lo resuelve **HOS-2291** (ids estables de eventos, extraído de HOS-2255 T-1),
  porque también lo necesitan imagen, entrada y métricas por evento.
- R-2: sobreventa por concurrencia. Cupo y disponibilidad se validan dentro de una
  transacción con bloqueo de fila.
- R-3: **el dueño puede compartir su contraseña** con el personal de puerta, ya que solo
  su cuenta valida el QR (OQ-6). Mitigación: texto en el panel que lo desalienta, deshacer
  de 2 minutos y registro de escaneos por cuenta. La solución real (cuentas de personal) es
  HOS-2295.
- R-4: datos personales de terceros (nombre y teléfono de menores en cumpleaños).
  Se pide el mínimo y se anonimiza.
- R-5: el catálogo no se puede tocar hasta la pasada final de HOS-1352. Las specs hijas
  se pueden implementar solo con el código y el gate detrás de una clave que aún no
  existe si se coordina con HOS-2259; si no, esperan.

## 11. Decisiones del owner y preguntas abiertas

OQ-1 a OQ-8 y OQ-C quedaron **decididas el 16/11/2026**. OQ-9 a OQ-13 quedaron
**decididas el 18/11/2026** (HOS-2252 ronda 2, #33 a #37).

### OQ-1 Confirmación: ¿al pedirla o la acepta el local? ¿Con qué plazo?

**Decidido (owner, 16/11/2026): confirmación mixta.** La lista de invitados se confirma
en el acto hasta llenar el cupo o llegar la hora de cierre. Mesa, VIP, grupo y
cumpleaños son por solicitud: el local acepta o rechaza, y vence a las **24 horas o 1
hora antes de la fecha** (lo que ocurra primero), sin consecuencia.

### OQ-2 Cancelación: ¿puede el cliente? ¿Hasta cuándo? ¿Se avisa?

**Decidido (owner, 16/11/2026):** el turista cancela hasta **2 horas antes**. El local
también puede cancelar. En ambos casos la otra parte recibe un correo.

### OQ-3 Datos del cliente: qué se pide, qué ve el local, cuánto se guardan

**Decidido (owner, 16/11/2026):** lista = nombre y acompañantes; reserva = nombre,
teléfono y una nota. El local **nunca ve el email**. Se anonimiza a los **90 días** de la
fecha del evento (nombre, teléfono y nota); se conserva el conteo para estadísticas.

### OQ-4 Cuenta: ¿hace falta estar logueado?

**Decidido (owner, 16/11/2026):** cuenta con email verificado, obligatoria. No hay
invitado sin cuenta.

### OQ-5 Pagos

**Decidido (owner, 16/11/2026):** sin seña ni pago en la etapa 1. Una seña futura
(`createPreference`) requiere spec propia y un smoke de billing completo, porque el
adaptador no soporta `charge`.

### OQ-6 QR de ingreso: ¿quién valida?

**Decidido (owner, 16/11/2026): solo la cuenta del dueño** (distinto de la recomendación
original, que era un link de puerta). No hay link de puerta ni cuentas de empleados: eso
pasa a **HOS-2295**. Consecuencias de diseño: sin tabla `venue_door_link`, sin
`capabilitiesAnyOf` en `listing-access`, sin ruta pública de puerta. **Riesgo anotado
(R-3):** el dueño puede compartir su contraseña; el panel lo desalienta con un texto.
El QR sigue sin reusar `qr_codes` (ver HOS-2276).

### OQ-7 Lista de invitados: ¿cierra por hora, por cupo o las dos?

**Decidido (owner, 16/11/2026):** cierra por **cupo en personas** (anotado más
acompañantes, no filas) o por **hora de cierre**, lo que pase primero. En un evento
semanal el cupo es **por fecha**. Pro tiene tope 100 por evento; premium sin tope.

### OQ-8 No-show: ¿se marca? ¿Tiene consecuencia?

**Decidido (owner, 16/11/2026):** lo marca **a mano el local**, con un contador interno
de ese local y **sin consecuencia automática**. No se deduce del QR sin validar.

### OQ-C Modelo de capacidad de las reservas

**Decidido (owner, 16/11/2026): aforo total en personas por noche, un solo número**
(distinto de la recomendación original, que eran tipos con cantidad por horario). Una
solicitud pendiente retiene las personas que pidió. Tipos de mesa con horario (opción
A) o plano de mesas (opción C) se eligen más adelante, en **HOS-2295**. Ver 6.2 bis.

### OQ-9 Qué pasa al purgar un listing o dar de baja un evento con anotados

**Decidido (owner, 18/11/2026):** no se puede borrar un local o evento con anotados o
reservas confirmadas: primero hay que cancelarlos, y se les avisa (HOS-2252 ronda 2,
#33). Se conecta con el aviso de cambios, HOS-2269. En PURGED las filas pasan a
anonimizadas.

### OQ-10 Soporte

**Decidido (owner, 18/11/2026):** el admin ve las reservas **solo en lectura**, detrás
de `venueReservation.viewAll`, **desde la etapa 2** (HOS-2252 ronda 2, #34).

### OQ-11 Recordatorio al turista

**Decidido (owner, 18/11/2026):** **no hay recordatorio de reserva en la etapa 1**; lo
cubre HOS-2267 (recordatorio de evento, plan pro) y no se duplica (HOS-2252 ronda 2,
#35).

### OQ-13 ¿La lista de invitados descuenta del aforo de reservas?

**Decidido (owner, 18/11/2026): no** (HOS-2252 ronda 2, #37). La lista tiene su cupo por
evento (HOS-2274) y el aforo de reservas (HOS-2275) es para mesa, VIP, grupo y
cumpleaños. Contra: un local lleno por lista puede seguir aceptando reservas. Se revisa
cuando exista HOS-2295.

### OQ-12 Ventana de reserva

**Decidido (owner, 18/11/2026):** ventana **fija**, de 2 horas a 60 días, no
configurable por el local (HOS-2252 ronda 2, #36).

## 12. Notas de implementación

- Orden: HOS-2291 (ids estables de eventos) → HOS-2274 → HOS-2275 → HOS-2276 → HOS-2277 → HOS-2278.
  El pase (HOS-2276) se emite **bajo demanda** (al pedirlo), así que 2274 y 2275 no
  dependen de él y no hace falta backfill.
- Fase 2 del catálogo: HOS-2259 declara las cuatro claves; HOS-2283 las asigna con
  additive grant (`0202_hos_2105_faq_draft_catalog.sql` y
  `0168-hos-2105-faq-draft-plan-version-grant.ts` son el precedente).
- Guardas a revisar al implementar: G1, G2, G3, G6, G7, G18, `check-step5-declared`,
  `check-purged-closed-list`, el de dual-write del seed (no aplica, no hay seed) y el de
  páginas sin sesión.
- Las claves de i18n van en es, en y pt desde el primer PR (`@repo/i18n`).
- Add-ons ya previstos: HOS-2286 (+100 lugares de lista). El cupo es SUM.

## 13. Smoke y What's New

- Smoke: `status-needs-smoke-staging` en los cinco hijos (correo real, QR escaneado con
  celular, concurrencia). El flujo no toca MercadoPago, pero toca el catálogo de planes,
  así que aplica el checklist de billing de staging.
- What's New: sí, una entrada por bloque ("Listas y reservas"), escrita en el sign-off.

## 14. Desglose de tareas de esta spec

1. T-1: hecho. El owner respondió OQ-1 a OQ-8 y OQ-C (16/11/2026) y OQ-9 a OQ-13 (18/11/2026).
2. T-2: hecho. Respuestas aplicadas a las cinco specs hijas.
3. T-3: dependencia **HOS-2291** (ids estables de eventos, antes HOS-2255 T-1).
4. T-4: fila en `purged-closed-list.json` y su test, en cada PR de tabla.
5. T-5: etapa 2 en **HOS-2295**: personal de puerta (link de puerta, cuentas de empleados)
   y capacidad por mesas.

## 15. Linear

Canonical tracking:
HOS-2260 (hijos: HOS-2274, HOS-2275, HOS-2276, HOS-2277, HOS-2278; épica HOS-2252;
dependencia HOS-2291; etapa 2 HOS-2295)
