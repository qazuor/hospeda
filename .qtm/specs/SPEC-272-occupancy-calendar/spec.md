---
spec-id: SPEC-272
title: Occupancy calendar — manual management + external sync (Google Calendar, Airbnb, Booking)
type: feature
complexity: high
status: draft
created: 2026-06-23T00:00:00Z
effort_estimate_hours: 40-60
tags: [accommodation, calendar, occupancy, availability, sync, google-calendar, airbnb, booking, host, web, admin]
---

# SPEC-272: Occupancy calendar

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Crear un calendario de ocupación para alojamientos que permita a los hosts marcar fechas como ocupadas manualmente y sincronizar con calendarios externos (Google Calendar, Airbnb, Booking.com) para no ofertar alojamientos que ya figuran como ocupados en determinada fecha.

**Phases:**

- **Phase 1 (MVP):** Calendario manual — host marca fechas ocupadas desde web/admin, el sistema filtra alojamientos disponibles en búsqueda
- **Phase 2:** Sync Google Calendar (import: leer eventos del calendario del host)
- **Phase 3:** Sync Airbnb + Booking.com (import: leer disponibilidad via API o iCal)

**Why now:** Los hosts publican en múltiples plataformas. Sin un calendario de ocupación, Hospeda puede mostrar como disponible un alojamiento que ya está reservado en Airbnb/Booking, generando consultas frustradas y mala experiencia.

### 2. Out of Scope

- Booking/reservation system (no es un PMS — solo calendario de ocupación)
- Payment processing para reservas
- Channel manager full (no gestiona inventario/pricing en otras plataformas)
- Sync bidirectional (export: solo import desde externos, no escribir a Airbnb/Booking)

### 3. User Flows

#### 3.1 Host — Manual calendar management (Phase 1)

1. Host va a su alojamiento en web/admin
2. Abre tab "Calendario"
3. Selecciona fecha(s) → marca como ocupado/libre
4. Opcional: nota interna (ej: "reserva Airbnb", "mantenimiento")
5. Sistema actualiza estado de ocupación
6. Búsqueda pública filtra: si fecha consultada coincide con ocupación, no muestra el alojamiento

#### 3.2 Host — Google Calendar sync (Phase 2)

1. Host conecta su Google Calendar (OAuth)
2. Selecciona cuál calendario usar (puede tener varios)
3. Sistema lee eventos del calendario
4. Eventos que duran >=1 día → marcan como ocupado en Hospeda
5. Sync periódico (cron cada X horas) o on-demand (botón "Sync now")
6. Host puede ver qué ocupaciones vienen de Google vs manuales

#### 3.3 Host — Airbnb/Booking sync (Phase 3)

1. Host pega URL de iCal de Airbnb/Booking (o conecta via API si disponible)
2. Sistema lee el iCal
3. Reservas importadas → marcan como ocupado
4. Sync periódico (cron) o on-demand
5. Host ve origen de cada ocupación (manual/google/airbnb/booking)

#### 3.4 Tourist — Search filtering (Phase 1+)

1. Turista busca alojamientos con fecha check-in/check-out
2. Sistema filtra: excluye alojamientos con ocupación en ese rango
3. Si no especifica fechas → muestra todos (sin filtro de ocupación)

### 4. Data Model

#### 4.1 Nueva tabla: `accommodation_occupancy`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | |
| accommodationId | UUID FK accommodations | |
| date | date | Fecha ocupada (una fila por día) |
| source | enum | MANUAL / GOOGLE_CALENDAR / AIRBNB / BOOKING |
| externalEventId | varchar nullable | ID del evento en la fuente externa |
| note | varchar(500) nullable | Nota interna del host |
| createdById | UUID FK users | Host o sistema |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |

**Unique constraint:** `(accommodation_id, date)` — una fila por día por alojamiento

**Index:** `(accommodation_id, date)` para queries de rango

#### 4.2 Nueva tabla: `accommodation_calendar_sync` (Phase 2+)

| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | |
| accommodationId | UUID FK accommodations | |
| provider | enum | GOOGLE_CALENDAR / AIRBNB / BOOKING |
| externalCalendarId | varchar | ID del calendario (Google) o URL iCal |
| syncToken | varchar nullable | Google sync token para incremental |
| lastSyncAt | timestamptz nullable | Última sync exitosa |
| lastSyncStatus | enum | SUCCESS / ERROR / PENDING |
| lastErrorMessage | text nullable | |
| isActive | boolean | Sync activa o pausada |
| createdById | UUID FK users | |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |

#### 4.3 OAuth tokens (Phase 2 — Google Calendar)

- Reutilizar `oauth_accounts` table si existe, o crear `accommodation_calendar_tokens`
- Google OAuth tokens (access + refresh) encriptados

### 5. API Routes

| Route | Tier | Auth | Phase | Descripción |
|-------|------|------|-------|-------------|
| `GET /api/v1/public/accommodations/:id/occupancy` | Public | None | 1 | Ocupación por rango (para display) |
| `GET /api/v1/protected/owner/accommodations/:id/occupancy` | Protected | Owner | 1 | Ocupación completa (host view) |
| `POST /api/v1/protected/owner/accommodations/:id/occupancy` | Protected | Owner | 1 | Marcar fecha(s) ocupada(s) |
| `DELETE /api/v1/protected/owner/accommodations/:id/occupancy/:date` | Protected | Owner | 1 | Desmarcar fecha |
| `PATCH /api/v1/protected/owner/accommodations/:id/occupancy/batch` | Protected | Owner | 1 | Batch update (rango) |
| `POST /api/v1/protected/owner/accommodations/:id/calendar/sync` | Protected | Owner | 2+ | Trigger sync manual |
| `GET /api/v1/protected/owner/accommodations/:id/calendar/sync-status` | Protected | Owner | 2+ | Estado de sync |
| `POST /api/v1/protected/owner/accommodations/:id/calendar/connect-google` | Protected | Owner | 2 | OAuth flow |
| `POST /api/v1/protected/owner/accommodations/:id/calendar/connect-ical` | Protected | Owner | 3 | Conectar iCal URL |
| `DELETE /api/v1/protected/owner/accommodations/:id/calendar/sync/:provider` | Protected | Owner | 2+ | Desconectar sync |
| `GET /api/v1/admin/accommodations/:id/occupancy` | Admin | ACCOMMODATION_MANAGE | 1 | Admin view |

### 6. Search Integration

- **Parámetros nuevos en búsqueda:** `checkIn` (date), `checkOut` (date)
- **Filtro:** `WHERE NOT EXISTS (SELECT 1 FROM accommodation_occupancy WHERE accommodation_id = a.id AND date BETWEEN checkIn AND checkOut-1)`
- **Retrocompatibilidad:** si no se pasan fechas, no se filtra (comportamiento actual)
- **Index:** el unique index en `(accommodation_id, date)` hace el NOT EXISTS eficiente

### 7. Web (host)

- **Calendar component:** `OccupancyCalendar.client.tsx` — calendar grid con meses, click para toggle
- **Tab:** nuevo tab "Calendario" en accommodation editor (web host)
- **Sync panel:** (Phase 2+) panel de configuración de sync por provider
- **i18n:** textos en es/en/pt

### 8. Admin

- **View:** occupancy calendar en accommodation detail (read-only o editable con permiso)
- **Sync status:** indicador de estado de sync por alojamiento

### 9. Cron Jobs (Phase 2+)

| Cron | Frecuencia | Descripción |
|------|-----------|-------------|
| `calendar-sync-google` | Cada 6h | Sync incremental Google Calendar |
| `calendar-sync-ical` | Cada 6h | Sync iCal (Airbnb/Booking) |
| `calendar-sync-cleanup` | Diario | Limpiar ocupaciones expiradas (opcional) |

### 10. Tasks

| Task | Title | Phase | Status |
|---|---|---|---|
| T-272-01 | DB migration: `accommodation_occupancy` table + indexes | 1 | pending |
| T-272-02 | Schemas: occupancy Zod schemas en @repo/schemas | 1 | pending |
| T-272-03 | Service: OccupancyService en @repo/service-core | 1 | pending |
| T-272-04 | API: public + protected owner endpoints | 1 | pending |
| T-272-05 | Search: integrar filtro de ocupación en búsqueda | 1 | pending |
| T-272-06 | Web: OccupancyCalendar component + tab en host editor | 1 | pending |
| T-272-07 | Web: i18n strings (es/en/pt) | 1 | pending |
| T-272-08 | Admin: occupancy view en accommodation detail | 1 | pending |
| T-272-09 | Tests: service + API + search filter + web | 1 | pending |
| T-272-10 | DB migration: `accommodation_calendar_sync` table | 2 | pending |
| T-272-11 | Google Calendar OAuth integration | 2 | pending |
| T-272-12 | Google Calendar sync service + cron | 2 | pending |
| T-272-13 | Web: Google Calendar connect/disconnect UI | 2 | pending |
| T-272-14 | iCal parser (Airbnb/Booking) | 3 | pending |
| T-272-15 | iCal sync service + cron | 3 | pending |
| T-272-16 | Web: iCal connect UI | 3 | pending |
| T-272-17 | Tests: sync services + cron | 2+3 | pending |

### 11. Acceptance Criteria

#### Phase 1

- [ ] Host puede marcar/desmarcar fechas ocupadas manualmente
- [ ] Búsqueda con check-in/check-out filtra alojamientos ocupados
- [ ] Búsqueda sin fechas funciona igual que antes (sin filtro)
- [ ] Calendar UI responsive y usable en mobile
- [ ] i18n completo

#### Phase 2

- [ ] Host puede conectar Google Calendar via OAuth
- [ ] Eventos de Google se importan como ocupaciones
- [ ] Sync incremental (no re-descarga todo cada vez)
- [ ] Cron sync cada 6h funciona

#### Phase 3

- [ ] Host puede conectar iCal de Airbnb/Booking
- [ ] Reservas de iCal se importan como ocupaciones
- [ ] Cron sync cada 6h funciona
- [ ] Host ve origen de cada ocupación (manual/google/airbnb/booking)

### 12. Risks

| Risk | Mitigation |
|---|---|
| Google Calendar API quota limits | Sync incremental + cache + rate limiting |
| iCal URLs cambian o se rompen | Error handling + notificación al host + retry |
| Ocupaciones manuales overwritten por sync | Source tracking: sync no sobreescribe manual, solo agrega/elimina las suyas |
| Performance: query de ocupación en búsqueda puede ser lenta | Index en (accommodation_id, date), NOT EXISTS es eficiente |
| Timezone issues (iCal usa UTC, host está en -03) | Normalizar a date sin timezone, documentar |
| OAuth token expiry | Refresh token flow + re-auth prompt |

---

## Part 2 — Implementation Notes

### Source

Owner question (2026-06-23): "calendario de ocupacion, inicialmente con manejo manual, para no ofertar alojamientos que en determinada fecha ya figuran como ocupados, con sincronizacion con calendarios externos (google calendar, airbnb y booking)"

### Reference

- Accommodation schema: `packages/db/src/schemas/accommodation/accommodation.dbschema.ts`
- Accommodation search: `packages/schemas/src/entities/accommodation/accommodation.http.schema.ts` — `includeAvailability`
- Host web editor: SPEC-208 (web accommodation editor)
- Accommodation import: SPEC-222 (import from URL — ya parsea Booking/Airbnb)
- Cron pattern: `apps/api/src/cron/jobs/`

### Cross-spec dependencies

- SPEC-208 (web accommodation editor) — el tab calendario se agrega al editor existente
- SPEC-222 (accommodation import from URL) — ya tiene parsing de Booking/Airbnb, posible reuse
- SPEC-239 (commerce listings) — no depende pero misma pattern de "entidad con estado"
