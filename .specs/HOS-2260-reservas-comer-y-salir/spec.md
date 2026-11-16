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
2. Lista **todas las decisiones de producto** que faltan, cada una con opciones y
   una recomendación. Mientras el owner no las cierre, los issues hijos quedan
   bloqueados. Las specs hijas ya asumen la opción **recomendada** y dicen
   dónde cambiaría el diseño si el owner elige otra.

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
- NG-2: cuentas con varios usuarios (personal de puerta con login propio). Es la
  "idea 32", sin decidir. Ver OQ-6.
- NG-3: lista de espera automática, canje de beneficios en caja, integración con
  ticketeras (eso es HOS-2255) y plano de mesas.
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

Todo lo que sigue asume las opciones recomendadas de la sección 11.

### 6.1 Tablas (todas nuevas, nombres en singular, regla del repo para tablas nuevas)

| Tabla | Issue | Para qué |
|---|---|---|
| `venue_event_guest_list` | HOS-2274 | Configuración de la lista de un evento (1 a 1): abierta, cupo, cierre. |
| `venue_guest_list_entry` | HOS-2274 | Un anotado a una fecha de un evento. |
| `venue_reservation_type` | HOS-2275 | Qué se reserva: mesa o VIP, personas máx., ventanas, cantidad. |
| `venue_reservation` | HOS-2275 (+2277, +2278) | Una reserva. Grupo y cumpleaños son columnas opcionales. |
| `venue_reservation_member` | HOS-2277 | Quién confirmó que va a un grupo. |
| `venue_birthday_benefit` | HOS-2278 | El beneficio de cumpleaños del local (1 a 1 con el listing). |
| `venue_entry_pass` | HOS-2276 | El QR: un pase por persona, del anotado o de la reserva. |
| `venue_door_link` | HOS-2276 | El link de puerta revocable (si el owner elige la opción recomendada en OQ-6). |

Todas llevan bloque de auditoría y soft delete como el resto del repo, salvo
`venue_entry_scan` si se hace (evento de solo inserción, como `qr_code_scans`).
Las que cuelgan de `venues` (`venue_reservation_type`, `venue_birthday_benefit`,
`venue_door_link`, y por `venue_events` las de lista) **suman fila en
`scripts/guards/purged-closed-list.json`** y en el test congelado del guard
(`packages/db/test/integration/purged-closed-list-from-empty.test.ts`).
Tratamiento propuesto en PURGED: se borran con el contenido, igual que
`venue_events`. Las filas con datos personales (`venue_guest_list_entry`,
`venue_reservation`, `venue_reservation_member`, `venue_entry_pass`) se
**anonimizan** en vez de borrarse si hay una reserva confirmada futura; esto se
cierra en la spec de implementación de PURGED (HOS-1476) y queda como OQ-9.

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
- Las transiciones viven en el servicio (`@repo/service-core`), una función por
  transición, y se prueban con una tabla de transiciones. Un estado terminal no vuelve.

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
- **Nunca** se gatea con plan: que el turista cancele, vea su pase, y que el local
  **valide en la puerta** un pase ya emitido. Si el local baja de plan, lo ya
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
- Sin rutas en `/admin/` en la etapa 1, salvo lectura de soporte (OQ-10).

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
  cancelada por el local, recordatorio (opcional, OQ-11).
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
- Validar pase: 120 por minuto por link de puerta o cuenta.

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
- Validación en puerta: página mobile-first, sin login si se elige el link de puerta.

## 9. Criterios de aceptación de la spec paraguas

- AC-1: el owner respondió todas las preguntas de la sección 11 (o aceptó la recomendada).
- AC-2: los cinco issues hijos tienen su `spec.md` en `.specs/` con las decisiones aplicadas.
- AC-3: ninguna tabla nueva queda sin fila en `purged-closed-list.json`.
- AC-4: ningún gate de plan bloquea validar o cancelar lo ya confirmado.
- AC-5: no hay código de pago ni referencia a `charge` en el módulo.

## 10. Riesgos

- R-1: **`replaceVenueEvents` borra y reinserta eventos.** Con listas colgando de
  `venue_events.id`, cada guardado del editor dejaría huérfanos o borraría a todos
  los anotados. Es el riesgo técnico más alto y obliga a un diff estable antes de la
  lista (HOS-2274, tarea 1). Conviene que lo haga **HOS-2254/2255** o un issue
  previo común, porque también lo necesitan imagen, entrada y métricas por evento.
- R-2: sobreventa por concurrencia. Cupo y disponibilidad se validan dentro de una
  transacción con bloqueo de fila.
- R-3: un link de puerta filtrado permite quemar pases. Mitigación: vence, se revoca,
  hay deshacer y registro de escaneos.
- R-4: datos personales de terceros (nombre y teléfono de menores en cumpleaños).
  Se pide el mínimo y se anonimiza.
- R-5: el catálogo no se puede tocar hasta la pasada final de HOS-1352. Las specs hijas
  se pueden implementar solo con el código y el gate detrás de una clave que aún no
  existe si se coordina con HOS-2259; si no, esperan.

## 11. Preguntas abiertas para el owner

Cada una con opciones y mi recomendación. Las hijas asumen la recomendada.

### OQ-1 Confirmación: ¿al pedirla o la acepta el local? ¿Con qué plazo?

1. **Todo instantáneo.** Pros: cero fricción. Contras: el local no controla la sala; un
   grupo de 12 entra sin avisar. Impacto: sin estado `REQUESTED`.
2. **Todo por solicitud.** Pros: control total. Contras: la lista de un boliche se
   vuelve inmanejable (cientos de solicitudes).
3. **Mixto (recomendada).** Lista de invitados: instantánea hasta cupo y cierre. Mesa,
   VIP, grupo y cumpleaños: por solicitud, el local acepta o rechaza, y vence a las
   **24 horas** (o 2 horas antes de la fecha, lo que ocurra primero) sin consecuencia.
   Pros: cada caso usa el modelo que tiene sentido. Contras: dos flujos.
4. **Mixto con aceptación automática opcional por local** (post-etapa 1).

### OQ-2 Cancelación: ¿puede el cliente? ¿Hasta cuándo? ¿Se avisa?

1. Sin cancelación. Contras: castiga al turista y llena el panel de fantasmas.
2. **Hasta 2 horas antes de la hora de la reserva o del cierre de la lista (recomendada).**
   Después, solo contactando al local. Se avisa por correo al local (solo reservas) y el
   panel lo refleja. El local también puede cancelar con motivo y se avisa al turista.
3. Hasta el momento de entrar. Contras: cupos vacíos sin reaprovechar.

### OQ-3 Datos del cliente: qué se pide, qué ve el local, cuánto se guardan

- **Lista:** nombre (tomado del perfil) y cantidad de acompañantes. El local ve eso.
- **Mesa, VIP, grupo, cumpleaños:** nombre, cantidad de personas, **teléfono** (el local
  necesita poder avisar un cambio), nota opcional. El local ve los cuatro. Nunca ve el
  email.
- **Retención, opciones:** 30 días, **90 días (recomendada)** o 12 meses (precedente de
  HOS-2101). Pasado el plazo desde la fecha del evento se anonimiza nombre, teléfono y
  nota; se conserva el conteo para estadísticas. 90 días alcanza para reclamos y
  contrapagos; 12 meses guarda datos de terceros sin necesidad.

### OQ-4 Cuenta: ¿hace falta estar logueado?

1. **Sí, con email verificado (recomendada).** Pros: freno al abuso, el pase vive en
   "Mi cuenta", el idioma del correo sale del perfil. Contras: fricción para quien no
   tiene cuenta (el alta es corta).
2. Invitado con email, sin cuenta. Contras: sin anti-abuso real; el pase queda solo en el
   correo; hay que verificar el email por token en cada reserva.

### OQ-5 Pagos

**Recomendación: confirmar que no hay seña ni pago en la etapa 1.** Contras: no hay
garantía contra el no-show. Alternativa futura: seña por preferencia de pago
(`createPreference`), que requiere una spec propia y un smoke de billing completo,
porque el adaptador no soporta `charge`.

### OQ-6 QR de ingreso: ¿quién valida?

1. **Solo la cuenta dueña del local.** Pros: simplísimo, sin superficie nueva. Contras:
   el dueño no está en la puerta; obliga a prestar el celular con su sesión.
2. **Link de puerta (recomendada para la etapa 1).** El dueño genera, desde el panel, un
   link con token revocable, atado al local, que vence a las 6 horas de terminado el
   evento. Quien lo abre valida sin login. Pros: sirve para el personal real; no rompe
   G6 (no es un rol: es una capacidad atada al recurso). Contras: si se filtra, cualquiera
   con el link valida. Mitigación: vence, se revoca, límite por minuto, deshacer, registro.
3. **Cuenta con varios usuarios** (idea 32, la que quedó sin decidir). Pros: auditoría por
   persona. Contras: es una épica propia (`staff_management` y `max_staff_accounts`
   son claves sin código). No entra en esta etapa.

El QR **no** reusa `qr_codes` (ver HOS-2276): un pase es de una persona, no un sticker.

### OQ-7 Lista de invitados: ¿cierra por hora, por cupo o las dos?

**Las dos, lo que ocurra primero (recomendada).** El cupo cuenta **personas** (anotado
más acompañantes), no filas. Cierre por defecto: la hora de inicio del evento; el local
puede adelantarlo. Para un evento semanal el cupo es **por fecha**, no total. Pro tiene
tope 100 por evento (decisión del owner); premium sin tope. Alternativa: solo cupo, sin
hora de cierre. Contra: una lista que sigue abierta con el boliche ya lleno.

### OQ-8 No-show: ¿se marca? ¿Tiene consecuencia?

1. No se marca. Contras: el local no distingue a los que faltan.
2. **Se marca a mano, sin consecuencia automática (recomendada).** El local lo marca
   desde el panel. Si nunca usó la puerta, **no** se deduce solo (todos figurarían como
   ausentes y sería falso). Consecuencia: solo un contador interno visible para ese local.
   Un no-show es una acusación; por eso se parece a "rechazar" en HOST_TRADE.
3. Bloqueo automático tras N ausencias. Contras: riesgo de castigar con datos mal
   cargados. Post-etapa 1, si hace falta.

### OQ-9 Qué pasa al purgar un listing o dar de baja un evento con anotados

Por la decisión 6 del owner **no se borra lo ya confirmado**. Opciones: (1) bloquear el
borrado hasta cancelar a los anotados y avisarles (recomendada; se conecta con el aviso
de cambios, HOS-2269); (2) borrar y avisar. En PURGED las filas pasan a anonimizadas.

### OQ-10 Soporte

¿El equipo ve reservas de un local desde el admin para dar soporte? Recomendación: sí,
solo lectura, detrás de `venueReservation.viewAll`, en una segunda etapa.

### OQ-11 Recordatorio al turista

¿Recordatorio por correo antes de la fecha? Recomendación: **no en la etapa 1**; lo
cubre HOS-2267 (recordatorio de evento, plan pro) y no hay que duplicarlo.

### OQ-12 Ventana de reserva

Antelación mínima 2 horas, máxima 60 días, no configurable por el local en la etapa 1
(YAGNI). Alternativa: configurable. Recomendación: constantes.

## 12. Notas de implementación

- Orden: R-1 (diff de eventos) → HOS-2274 → HOS-2275 → HOS-2276 → HOS-2277 → HOS-2278.
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

1. T-1: el owner responde OQ-1 a OQ-12 (una tanda).
2. T-2: aplicar respuestas a las cuatro specs hijas que cambien.
3. T-3: issue previo "diff estable de `replaceVenueEvents`" (si no lo cubre HOS-2254).
4. T-4: fila en `purged-closed-list.json` y su test, en cada PR de tabla.

## 15. Linear

Canonical tracking:
HOS-2260 (hijos: HOS-2274, HOS-2275, HOS-2276, HOS-2277, HOS-2278; épica HOS-2252)
