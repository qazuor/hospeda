---
spec-id: SPEC-275
title: Web — What's New dialog + Welcome Tour for hosts and commerce owners in /mi-cuenta
type: feature
complexity: medium
status: draft
created: 2026-06-23T00:00:00Z
effort_estimate_hours: 16-24
tags: [web, host, commerce, whats-new, welcome-tour, onboarding, ux, mi-cuenta]
---

# SPEC-275: Web — What's New + Welcome Tour for hosts/commerce

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Portear el What's New dialog y el Welcome Tour del admin panel a la app web (`/mi-cuenta`) para hosts y commerce owners. Los hosts/commerce owners que gestionan sus entities desde la web (no usan el admin) necesitan onboarding y comunicación de novedades también.

**Why now:** SPEC-205 (host web foundation) migro el dashboard del host a la web. SPEC-239 (commerce) trajo commerce owners a la web. Pero el onboarding (welcome tour) y la comunicación de features nuevas (what's new) siguen solo en admin. Los hosts/commerce que usan web están ciegos a novedades.

**Contexto:** SPEC-174 (admin welcome tour) y SPEC-175 (admin what's new) ya están implementados en admin. Esta spec reusa la data/backend y trae la UI a web.

### 2. Out of Scope

- Admin panel (ya tiene ambas features — SPEC-174/175)
- Tour contextual por ruta (admin lo tiene, web puede ser Phase 2)
- Mobile app (SPEC-243)
- Tour para tourist users (solo hosts y commerce owners)
- Crear nuevos tours o what's-new entries (mismo contenido que admin, filtrado por rol)

### 3. Current State

| Feature | Admin | Web |
|---------|-------|-----|
| Welcome Tour | SPEC-174: role-based, config-driven, `useWelcomeTourForRole`, `useAdminTourState` | NO existe |
| What's New | SPEC-175: `WhatsNewAutoTrigger`, `WhatsNewModal`, `WhatsNewPanel`, dashboard widget | NO existe |
| Backend API | `GET /api/v1/protected/whats-new`, `PATCH /api/v1/protected/whats-new/seen` | Existe, web puede consumir |
| Tour config | `apps/admin/src/config/ia/tours.ts` — role-based tour definitions | No aplicable a web (diferente UI) |
| Tour state | `useAdminTourState` — persiste seen state via settings API | No existe en web |

### 4. User Flows

#### 4.1 Host/Commerce — First login (Welcome Tour)

1. Host/commerce owner se loguea en web
2. Es redirigido a `/mi-cuenta/` (dashboard)
3. Si es primer login (no ha visto tour) → Welcome Tour se inicia automáticamente
4. Tour guiado paso a paso:
   - Step 1: "Bienvenido a tu panel de hospedaje"
   - Step 2: "Acá puedes gestionar tus propiedades" (señala link "Propiedades")
   - Step 3: "Revisa tus consultas" (señala "Consultas")
   - Step 4: "Promociones para tus huéspedes" (señala "Promociones")
   - Step 5: "Configura tu perfil" (señala "Perfil")
5. Tour se puede skipar ("Saltar tour")
6. Tour se puede re-ver desde un link "Repetir tour" en settings

#### 4.2 Host/Commerce — What's New dialog

1. Nuevas features se publican (ej: "Calendario de ocupación disponible")
2. Host/commerce entra a `/mi-cuenta/`
3. Si hay items no vistos → What's New modal aparece automáticamente (una vez por sesión)
4. Modal muestra: título, descripción, imagen/video opcional, link "Leer más"
5. Host marca como visto → no aparece de nuevo
6. "Ver todas las novedades" link → panel completo con historial
7. Badge en sidebar/nav indicando novedades no vistas

#### 4.3 Host/Commerce — What's New panel

1. Click en "Novedades" en sidebar/nav → panel/section con todas las entries
2. Filtrado por rol (solo relevantes a host/commerce)
3. Items vistos vs no vistos (indicador visual)
4. i18n (es/en/pt)

### 5. Technical Approach

#### 5.1 Reuse admin backend

- `GET /api/v1/protected/whats-new` ya existe y filtra por rol
- `PATCH /api/v1/protected/whats-new/seen` ya existe
- Tour state: `GET/PATCH /api/v1/protected/settings` ya existe (admin lo usa)
- No nuevos endpoints de backend

#### 5.2 Web-specific implementation

| Component | Tipo | Notas |
|-----------|------|-------|
| `WelcomeTour.client.tsx` | React island | Tour overlay con steps, highlight elements |
| `WhatsNewModal.client.tsx` | React island | Modal auto-trigger con items no vistos |
| `WhatsNewPanel.astro` | Astro page | `/mi-cuenta/novedades/` — lista completa |
| `WhatsNewBadge.client.tsx` | React island | Badge en nav con count de no vistos |

#### 5.3 Tour library

- Admin usa `driver.js` o similar — verificar qué lib usa
- Web puede usar la misma lib o una más ligera (shepherd.js, intro.js, o custom)
- Consideración: web usa React islands, admin usa TanStack Start — diferente rendering

#### 5.4 Tour config

- Admin tours en `apps/admin/src/config/ia/tours.ts` son específicos a admin UI
- Web necesita tours propios en `apps/web/src/config/tours.ts`:
  - Diferentes elementos del DOM (web tiene diferente layout)
  - Diferentes rutas (`/mi-cuenta/propiedades/` vs admin `/accommodations/`)
  - Mismo formato de config (steps, roles, trigger)

#### 5.5 What's New data

- Mismo backend que admin (ya filtra por rol)
- Mismo render de markdown (admin usa `render-markdown.ts`)
- Web necesita su propio render o reusar el de admin

### 6. Data Model

No nuevas tablas. Reusa:

- `whats_new_entries` (existente)
- `user_settings` para tour state (existente — admin lo usa)

### 7. Pages & Routes

| Route | Tipo | Descripción |
|-------|------|-------------|
| `/[lang]/mi-cuenta/` | SSR | Dashboard — tour y whats-new auto-trigger aquí |
| `/[lang]/mi-cuenta/novedades/` | SSR | What's New panel completo |
| `/[lang]/mi-cuenta/ajustes/` | SSR | Settings — "Repetir tour" option |

### 8. Tasks

| Task | Title | Status |
|---|---|---|
| T-275-01 | Web: WelcomeTour component (React island con tour library) | pending |
| T-275-02 | Web: Tour config para host (steps, elements, triggers) | pending |
| T-275-03 | Web: Tour config para commerce owner | pending |
| T-275-04 | Web: Tour state integration (user settings API) | pending |
| T-275-05 | Web: WhatsNewModal component (auto-trigger) | pending |
| T-275-06 | Web: WhatsNewBadge component (nav badge) | pending |
| T-275-07 | Web: WhatsNewPanel page (`/mi-cuenta/novedades/`) | pending |
| T-275-08 | Web: Markdown render para what's new entries | pending |
| T-275-09 | Web: "Repetir tour" en settings | pending |
| T-275-10 | Web: D12 gate (welcome tour vs whats-new no stack) | pending |
| T-275-11 | Web: i18n strings (es/en/pt) | pending |
| T-275-12 | Web: Integrar en AccountLayout / dashboard | pending |
| T-275-13 | Tests: components + integration | pending |

### 9. Acceptance Criteria

- [ ] Host ve welcome tour en primer login a `/mi-cuenta/`
- [ ] Commerce owner ve welcome tour en primer login
- [ ] Tour se puede skipar
- [ ] Tour se puede repetir desde settings
- [ ] What's New modal aparece si hay items no vistos
- [ ] What's New modal no aparece si no hay items o ya vistos
- [ ] What's New modal no se stackea con welcome tour (D12 gate)
- [ ] Badge en nav muestra count de novedades no vistas
- [ ] Panel completo en `/mi-cuenta/novedades/`
- [ ] Items filtrados por rol (host no ve novedades de admin)
- [ ] i18n completo (es/en/pt)
- [ ] Mobile responsive

### 10. Risks

| Risk | Mitigation |
|---|---|
| Tour library pesada para web (island size) | Evaluar lib size, lazy load con client:idle |
| DOM elements del tour pueden no existir en SSR | Tour inicia después de hydration, verificar elementos existen |
| What's New entries de admin no relevantes para host | Backend ya filtra por rol, verificar que el filtro funciona |
| Conflicto con otros modals en dashboard | D12 gate (mismo patrón que admin) |
| Performance: badge polling | Usar TanStack Query con cache, no polling |

---

## Part 2 — Implementation Notes

### Source

Owner request (2026-06-23): "soportar whats new y welcome en /mi-cuenta de app web para users hosts y commerce"

### Reference

- Admin Welcome Tour: SPEC-174 — `apps/admin/src/hooks/use-tours.ts`, `apps/admin/src/config/ia/tours.ts`
- Admin What's New: SPEC-175 — `apps/admin/src/components/whats-new/`, `apps/admin/src/lib/whats-new/`
- Admin D12 gate: `useWelcomeTourPending` — welcome tour vs whats-new no stackean
- Backend: `GET /api/v1/protected/whats-new`, `PATCH /api/v1/protected/whats-new/seen`
- Web host dashboard: SPEC-205 — `apps/web/src/pages/[lang]/mi-cuenta/`
- Web AccountLayout: `apps/web/src/layouts/AccountLayout.astro`

### Cross-spec dependencies

- SPEC-174 (admin welcome tour) — precedent, mismo patrón
- SPEC-175 (admin what's new) — precedent, mismo backend
- SPEC-205 (host web foundation) — donde se integra
- SPEC-239 (commerce listings) — commerce owners también necesitan tour
