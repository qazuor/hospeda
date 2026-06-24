---
spec-id: SPEC-272
title: Occupancy calendar — Phase 1 manual (basic) + Phase 2/3 external sync (advanced)
type: feature
complexity: high
status: draft
created: 2026-06-23T00:00:00Z
decided: 2026-06-23
model_fit: mixed
effort_estimate_hours: 40-60
tags: [accommodation, calendar, occupancy, availability, sync, google-calendar, airbnb, booking, host, web, admin]
---

# SPEC-272: Occupancy calendar

> ## ✅ RECON DONE + DECISIONS RESOLVED (2026-06-23)
>
> El recon se ejecutó sobre el código real. Hallazgos clave (ver `## 3. Recon
> Findings`) y decisiones del owner:
>
> - **Una sola spec, 3 fases atomizadas** (no se carvea). Cada fase con su verdict.
>   **Phase 1 (manual) = BÁSICO; Phase 2 (Google OAuth) y Phase 3 (iCal) = POTENTE.**
> - **Columna de fecha → tipo `date` nativo de Postgres** (primero en el codebase; setea
>   convención para fechas-sin-hora). El NOT EXISTS de rango queda limpio.
> - **Permisos nuevos `accommodation.occupancy.manage` / `.view`** (no existe
>   `ACCOMMODATION_MANAGE`). Requiere migración de `permission_enum` (precedente: `0029`)
>   + asignación a roles. El entitlement billing `CAN_USE_CALENDAR` gatea la feature aparte.
>
> **Correcciones del recon que el implementador NO puede ignorar:** los params de búsqueda
> `checkIn`/`checkOut`/`isAvailable` **ya existen pero son DEAD CODE** (el modelo Drizzle
> los ignora); el OAuth de Google **no se puede reusar** (es identity-only); iCal es 100%
> greenfield (SPEC-222 scrapea con Apify, no parsea iCal).

---

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Calendario de ocupación para alojamientos: el host marca fechas ocupadas
(manual, Phase 1) y opcionalmente sincroniza con calendarios externos (Google Calendar
Phase 2; Airbnb/Booking iCal Phase 3). La búsqueda pública con fechas excluye los
alojamientos ocupados en el rango.

**Phases:**
- **Phase 1 (MVP, BÁSICO):** calendario manual + filtro en búsqueda.
- **Phase 2 (POTENTE):** sync Google Calendar (OAuth separado + Calendar API + cron).
- **Phase 3 (POTENTE):** sync iCal Airbnb/Booking (parser greenfield + cron).

**Why now:** los hosts publican en múltiples plataformas. Sin ocupación, Hospeda puede
mostrar disponible algo ya reservado en Airbnb/Booking → consultas frustradas.

### 2. Out of Scope

- Sistema de reservas / PMS (esto es solo ocupación, no inventory/pricing).
- Payment processing.
- Channel manager full.
- Sync bidireccional (solo import; nunca escribir a Airbnb/Booking).

### 3. Recon Findings (código real, no supuestos)

| # | Finding | Archivo:línea | Impacto |
|---|---------|---------------|---------|
| R1 | `checkIn`/`checkOut`/`isAvailable` **ya existen** en HTTP + domain schema **pero son DEAD CODE** — el modelo Drizzle no construye ningún WHERE para ellos | schema: `accommodation.http.schema.ts:62-65,381`; domain: `accommodation.query.schema.ts:146-148`; modelo (ignora): `accommodation.model.ts` `search`/`searchWithRelations`/`countByFilters` | Phase 1 debe **wirear** el filtro en los **3** query builders. No hay que inventar params, solo conectarlos. |
| R2 | Ocupación es **100% greenfield**: no hay tabla, modelo ni servicio de occupancy/availability/blocked_dates | `packages/db/src/schemas/` (0 hits), `service-core/src/services/` (0 hits) | Phase 1 crea tabla + modelo + servicio de cero. |
| R3 | Entitlements **ya definidos**: `CAN_USE_CALENDAR` (plan free) y `CAN_SYNC_EXTERNAL_CALENDAR` (Pro+) | `packages/billing/src/types/entitlement.types.ts:20-21`, asignados en `plans.config.ts:102,149-150,...` | Phase 1 gatea con `CAN_USE_CALENDAR`; Phase 2/3 con `CAN_SYNC_EXTERNAL_CALENDAR`. Sin trabajo billing nuevo. |
| R4 | El editor host es **single-scroll, NO tabs** | `apps/web/src/components/host/AccommodationEditor.client.tsx:412-494` | El "Calendario" se agrega como `CalendarSection.client.tsx` después de `PhotoSection` (~línea 481), envuelto en `PlanEntitlementGate.client.tsx` (ya existe). |
| R5 | El OAuth de Google **es identity-only** (`profile email`); el token en `accounts` no tiene scope de calendar | `apps/api/src/lib/auth.ts:376-404`, `packages/db/src/schemas/user/account.dbschema.ts:11-28` | Phase 2 necesita OAuth **separado** (`calendar.readonly`) + tabla de tokens propia + cliente Calendar API. **No reusar** el OAuth de login. |
| R6 | iCal es **100% greenfield**: SPEC-222 scrapea listing pages con Apify, NO parsea iCal; 0 hits de `ical`/`ics`/`VEVENT` en todo el repo | `accommodation-import/adapters/*` (Apify), grep iCal → 0 | Phase 3 agrega una lib nueva (`node-ical`/`ical.js`) + adapter. La claim "SPEC-222 ya parsea" es scraping, NO iCal. |
| R7 | **No existe** `ACCOMMODATION_MANAGE`. Hay `ACCOMMODATION_UPDATE_OWN`, `ACCOMMODATION_VIEW_ALL`, etc. | `packages/schemas/src/enums/permission.enum.ts` | Decisión owner: agregar `accommodation.occupancy.manage`/`.view` (migración de `permission_enum`, precedente `0029_dear_dormammu.sql`). |
| R8 | **No hay convención de columna date-only** (todo es `timestamptz`) | `packages/db/src/schemas/` (0 columnas `date()`) | Decisión owner: usar tipo `date` nativo de Postgres (primera vez). Drizzle `date()` devuelve string `'YYYY-MM-DD'`. |
| R9 | Cron pattern de 3 pasos (job file + `registry.ts` + `schedules.manifest.ts`), `node-cron` | `apps/api/src/cron/types.ts`, `registry.ts`, `schedules.manifest.ts`, `bootstrap.ts:84-207` | Phase 2/3 agregan `calendar-sync-google`/`calendar-sync-ical` siguiendo el patrón; el test de manifest falla si registry y manifest se desincronizan. |
| R10 | Search es **Drizzle SQL puro** (no índice de búsqueda para la lista de accommodations) | `accommodation.model.ts` | El `NOT EXISTS` va directo en el query builder; el unique index `(accommodation_id, date)` lo hace eficiente. |

### 4. Data Model

#### 4.1 Tabla `accommodation_occupancy` (Phase 1)

| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid PK defaultRandom | |
| accommodationId | uuid FK accommodations (cascade) | |
| date | **`date` (Postgres native)** | una fila por día ocupado |
| isBlocked | boolean default true | reservado para futuras semánticas (free/blocked); Phase 1 siempre `true` |
| source | `occupancy_source_enum` | MANUAL / GOOGLE_CALENDAR / AIRBNB / BOOKING |
| externalEventId | varchar nullable | id del evento en la fuente externa (Phase 2/3) |
| note | varchar(500) nullable | nota interna del host |
| createdById | uuid FK users | host o sistema |
| createdAt / updatedAt | timestamptz | |

- **Unique constraint:** `(accommodation_id, date)` — una fila por día por alojamiento.
- **Index:** el unique cubre los range queries del NOT EXISTS.
- **Enum:** `OccupancySourceEnum` se define primero en `@repo/schemas`, luego
  `OccupancySourcePgEnum = pgEnum('occupancy_source_enum', enumToTuple(...))` en
  `enums.dbschema.ts` (patrón existente).
- **Migración:** editar el dbschema + `pnpm db:generate` (carril estructural). El tipo
  `date` lo maneja Drizzle nativamente; no requiere extras carril.

#### 4.2 Tabla `accommodation_calendar_sync` (Phase 2+)

Igual al spec original (provider enum, externalCalendarId, syncToken, lastSyncAt,
lastSyncStatus, lastErrorMessage, isActive, audit). Drizzle-generada.

#### 4.3 OAuth tokens (Phase 2 — Google Calendar)

- **NO reusar `accounts` (Better Auth, identity-only, R5).** Crear
  `accommodation_calendar_tokens` (o columnas en `accommodation_calendar_sync`) con
  access+refresh **encriptados**, scope `calendar.readonly`, expiry.
- Nuevo OAuth client de Google con consent de calendar (incremental auth), endpoints de
  connect/callback propios.

#### 4.4 Permisos (Phase 1)

- Agregar a `PermissionEnum`: `ACCOMMODATION_OCCUPANCY_MANAGE = 'accommodation.occupancy.manage'`
  y `ACCOMMODATION_OCCUPANCY_VIEW = 'accommodation.occupancy.view'`.
- Migración de `permission_enum` (precedente `0029`). Asignar `manage` al rol HOST (sobre
  sus propios alojamientos) y `view` a roles admin.

### 5. Search Integration (Phase 1)

- Params: ya existen (`checkIn`, `checkOut`) — solo **wirearlos** (R1).
- Filtro en los 3 query builders de `accommodation.model.ts` (`search`,
  `searchWithRelations`, `countByFilters`):

```sql
NOT EXISTS (
  SELECT 1 FROM accommodation_occupancy ao
  WHERE ao.accommodation_id = accommodations.id
    AND ao.date >= :checkIn
    AND ao.date <  :checkOut   -- checkout day libre (semántica hotelera)
    AND ao.is_blocked = true
)
```

- **Retrocompat:** si no se pasan fechas → no se agrega el filtro (comportamiento actual).
- **Semántica:** el día de check-out queda **libre** (`< checkOut`, no `<=`): el huésped
  se va a la mañana y otro puede entrar ese día.

### 6. API Routes

| Route | Tier | Auth | Phase |
|-------|------|------|-------|
| `GET /api/v1/public/accommodations/:id/occupancy` | Public | None | 1 |
| `GET /api/v1/protected/accommodations/:id/occupancy` | Protected | owner (ownership inline) | 1 |
| `POST /api/v1/protected/accommodations/:id/occupancy` | Protected | `ACCOMMODATION_OCCUPANCY_MANAGE` + ownership | 1 |
| `DELETE /api/v1/protected/accommodations/:id/occupancy/:date` | Protected | idem | 1 |
| `PATCH /api/v1/protected/accommodations/:id/occupancy/batch` | Protected | idem | 1 |
| `GET /api/v1/admin/accommodations/:id/occupancy` | Admin | `ACCOMMODATION_OCCUPANCY_VIEW` | 1 |
| `POST .../calendar/connect-google` | Protected | owner + `CAN_SYNC_EXTERNAL_CALENDAR` | 2 |
| `POST .../calendar/sync` · `GET .../calendar/sync-status` · `DELETE .../calendar/sync/:provider` | Protected | idem | 2+ |
| `POST .../calendar/connect-ical` | Protected | idem | 3 |

> Nota: el repo NO usa el segmento `owner` en las rutas (R en recon Q8). Las rutas van
> bajo `accommodation/protected/occupancy/` con ownership inline, siguiendo
> `apps/api/src/routes/accommodation/protected/index.ts`.

### 7. User Stories (Phase 1 — con checks testeables)

#### US-1 — Marcar/desmarcar fechas (manual)

- **GIVEN** un host dueño de un alojamiento con `CAN_USE_CALENDAR`
  **WHEN** abre la sección "Calendario" y togglea un rango de fechas a ocupado
  **THEN** `PATCH .../occupancy/batch` crea una fila por día con `source=MANUAL`,
  respetando el unique `(accommodation_id, date)` (idempotente: re-togglear no duplica).
- **GIVEN** una fecha ya ocupada
  **WHEN** la desmarca
  **THEN** `DELETE .../occupancy/:date` borra solo esa fila (y solo si `source=MANUAL`;
  las de sync no se borran a mano).
- **GIVEN** un usuario que NO es dueño
  **WHEN** intenta postear ocupación
  **THEN** 403 (ownership inline + `ACCOMMODATION_OCCUPANCY_MANAGE`).

#### US-2 — Búsqueda filtra ocupados

- **GIVEN** un alojamiento ocupado del 10 al 12
  **WHEN** un turista busca con `checkIn=2026-07-10&checkOut=2026-07-12`
  **THEN** ese alojamiento NO aparece (NOT EXISTS matchea el 10 y 11).
- **GIVEN** el mismo alojamiento
  **WHEN** busca `checkIn=2026-07-12&checkOut=2026-07-13`
  **THEN** SÍ aparece (el 12 es check-out, queda libre; `< checkOut`).
- **GIVEN** una búsqueda **sin** fechas
  **WHEN** lista alojamientos
  **THEN** se comporta igual que hoy (sin filtro de ocupación, retrocompat).

#### US-3 — Origen de la ocupación visible

- **GIVEN** ocupaciones de distinto `source`
  **WHEN** el host ve su calendario
  **THEN** cada día muestra su origen (manual/google/airbnb/booking); las de sync son
  read-only desde la UI manual.

### 8. Web (host) — Phase 1

- `CalendarSection.client.tsx` en `apps/web/src/components/host/editor/`, importado en
  `AccommodationEditor.client.tsx` después de `PhotoSection`, envuelto en
  `PlanEntitlementGate` (key `CAN_USE_CALENDAR`).
- Calendar grid mensual, click/drag para toggle, nota opcional. Responsive mobile.
- i18n es/en/pt.

### 9. Admin — Phase 1

- Vista de ocupación read-only en accommodation detail (gate `ACCOMMODATION_OCCUPANCY_VIEW`).

### 10. Cron Jobs (Phase 2+)

| Cron | Frecuencia | Phase |
|------|-----------|-------|
| `calendar-sync-google` | `0 */6 * * *` | 2 |
| `calendar-sync-ical` | `0 */6 * * *` | 3 |

3 pasos (R9): job file + `registry.ts` + `schedules.manifest.ts`. `source` tracking
evita que el sync pise ocupaciones MANUAL (solo agrega/borra las suyas por `externalEventId`).

### 11. Tasks

| Task | Title | Phase | Fit |
|---|---|---|---|
| T-272-01 | Schemas: `OccupancySourceEnum` + occupancy Zod schemas en @repo/schemas | 1 | BÁSICO |
| T-272-02 | Permisos: agregar `ACCOMMODATION_OCCUPANCY_MANAGE`/`_VIEW` + migración `permission_enum` + asignar a roles | 1 | BÁSICO |
| T-272-03 | DB: dbschema `accommodation_occupancy` (col `date` nativa) + `pnpm db:generate` | 1 | BÁSICO |
| T-272-04 | Model: `AccommodationOccupancyModel` (CRUD por rango) | 1 | BÁSICO |
| T-272-05 | Service: `OccupancyService` (gate `CAN_USE_CALENDAR` + ownership) | 1 | BÁSICO |
| T-272-06 | Search: **wirear `checkIn`/`checkOut`** (NOT EXISTS) en los 3 query builders de `accommodation.model.ts` | 1 | BÁSICO |
| T-272-07 | API: public + protected occupancy endpoints + admin view | 1 | BÁSICO |
| T-272-08 | Web: `CalendarSection.client.tsx` + integrar en editor + `PlanEntitlementGate` | 1 | BÁSICO |
| T-272-09 | i18n es/en/pt + Admin occupancy view | 1 | BÁSICO |
| T-272-10 | Tests: service + API + **search filter (incl. retrocompat sin fechas + checkout-day libre)** + web | 1 | BÁSICO |
| T-272-11 | DB: `accommodation_calendar_sync` + `accommodation_calendar_tokens` (encrypted) | 2 | **POTENTE** |
| T-272-12 | Google OAuth **separado** (calendar.readonly) + connect/callback + token storage | 2 | **POTENTE** |
| T-272-13 | Google Calendar sync service (incremental syncToken) + cron `calendar-sync-google` | 2 | **POTENTE** |
| T-272-14 | Web: Google connect/disconnect UI (gate `CAN_SYNC_EXTERNAL_CALENDAR`) | 2 | BÁSICO |
| T-272-15 | iCal parser (lib nueva `node-ical`/`ical.js`) + adapter Airbnb/Booking | 3 | **POTENTE** |
| T-272-16 | iCal sync service + cron `calendar-sync-ical` + Web connect UI | 3 | **POTENTE** |
| T-272-17 | Tests: sync services + cron + timezone (iCal UTC → date AR) | 2+3 | **POTENTE** |

### 12. Acceptance Criteria

#### Phase 1 (BÁSICO)
- [ ] Host marca/desmarca fechas; idempotente por `(accommodation_id, date)`.
- [ ] Búsqueda con check-in/check-out excluye ocupados; check-out day queda libre.
- [ ] Búsqueda sin fechas = comportamiento actual (retrocompat).
- [ ] Gate `CAN_USE_CALENDAR` + ownership + `ACCOMMODATION_OCCUPANCY_MANAGE`.
- [ ] Calendar UI responsive mobile + i18n es/en/pt.

#### Phase 2 (POTENTE)
- [ ] OAuth **separado** de Google con scope `calendar.readonly` (no reusa el login).
- [ ] Eventos de Google ≥1 día → ocupaciones `source=GOOGLE_CALENDAR`.
- [ ] Sync incremental (syncToken, no re-descarga todo) + cron 6h.
- [ ] Sync no pisa ocupaciones MANUAL.

#### Phase 3 (POTENTE)
- [ ] Host conecta iCal de Airbnb/Booking; reservas → ocupaciones.
- [ ] Cron 6h + manejo de iCal roto/expirado.
- [ ] Timezone: iCal UTC normalizado a `date` correcto (host AR UTC-3).
- [ ] Host ve origen de cada ocupación.

### 13. Risks

| Risk | Mitigation |
|---|---|
| Wirear mal el filtro (dead params, R1) → búsqueda rota | Test explícito: con fechas excluye, sin fechas retrocompat, checkout-day libre. |
| Google API quota | Sync incremental (syncToken) + cron + rate limiting. |
| iCal roto/cambia | Error handling + `lastSyncStatus=ERROR` + notificación host + retry. |
| Sync pisa ocupaciones manuales | `source` tracking + match por `externalEventId`; el sync solo toca lo suyo. |
| Timezone (iCal UTC, host -03) | Normalizar a `date` sin hora; documentar; test de borde medianoche. |
| OAuth token expiry (Phase 2) | Refresh token flow + re-auth prompt; tokens encriptados. |
| Tipo `date` nuevo en el codebase | Drizzle lo soporta nativo; documentar la convención para futuras fechas-sin-hora. |

---

## Part 2 — Implementation Notes

### Source

Owner question (2026-06-23): "calendario de ocupacion, inicialmente con manejo manual,
para no ofertar alojamientos que en determinada fecha ya figuran como ocupados, con
sincronizacion con calendarios externos (google calendar, airbnb y booking)". Refinado
2026-06-23 con recon real + 3 decisiones owner (ver banner).

### Reference (verificado en recon)

- Search params (dead): `accommodation.http.schema.ts:62-65,381`, `accommodation.query.schema.ts:146-148`.
- Query builders a wirear: `packages/db/src/models/accommodation/accommodation.model.ts` (`search`, `searchWithRelations`, `countByFilters`).
- Editor host (single-scroll): `apps/web/src/components/host/AccommodationEditor.client.tsx:412-494`; secciones en `host/editor/`; `PlanEntitlementGate.client.tsx`.
- Entitlements: `packages/billing/src/types/entitlement.types.ts:20-21`, `plans.config.ts`.
- Better Auth Google (identity-only): `apps/api/src/lib/auth.ts:376-404`; `accounts`: `packages/db/src/schemas/user/account.dbschema.ts:11-28`.
- Import (Apify, NO iCal): `packages/service-core/src/services/accommodation-import/adapters/`.
- Cron: `apps/api/src/cron/{types.ts,registry.ts,schedules.manifest.ts,bootstrap.ts}`.
- Permisos + migración enum precedente: `packages/schemas/src/enums/permission.enum.ts`, `packages/db/src/migrations/0029_dear_dormammu.sql`.
- dbschema/pgEnum pattern: `packages/db/src/schemas/accommodation/accommodation.dbschema.ts`, `enums.dbschema.ts`.

### Cross-spec dependencies

- SPEC-208 (web accommodation editor) — la sección Calendario se agrega al editor existente.
- SPEC-222 (import) — scraping con Apify; **NO** aporta iCal (Phase 3 greenfield).
- SPEC-239 (commerce) — mismo pattern de "entidad con estado".

---

## Model Fit Verdict

**MIXTO (por fase).**

- **Phase 1 = BÁSICO.** Greenfield acotado pero con patrón claro para cada pieza: tabla
  Drizzle + pgEnum (patrón existente), modelo + servicio (BaseCrudService/model directo),
  endpoints (patrón `accommodation/protected`), sección web append-only en el editor
  single-scroll + `PlanEntitlementGate` ya existente, y entitlements **ya definidos**. La
  única sutileza es **wirear los params `checkIn`/`checkOut` que ya existen pero están
  muertos** (R1) en los 3 query builders — bien acotado y testeable. Un modelo chico la
  toma de corrido.
- **Phase 2 = POTENTE.** OAuth **separado** de Google (no reusa el login, R5) + Calendar
  API + token encryption + sync incremental con syncToken + cron. Greenfield sustancial,
  requiere criterio de seguridad (tokens) y de API externa.
- **Phase 3 = POTENTE.** iCal **100% greenfield** (R6): lib nueva, adapter, parsing,
  timezone (UTC→date AR), cron, error handling de feeds rotos.

**Recomendación de ejecución:** Phase 1 es entregable por modelo chico como milestone
independiente (su propio PR). Phase 2 y 3 conviene asignarlas a un modelo más capaz o
revisarlas con cuidado; ambas son features completas, no fixes. El `source` tracking de
la tabla Phase 1 ya deja el hook para que el sync de Phase 2/3 no pise lo manual.
