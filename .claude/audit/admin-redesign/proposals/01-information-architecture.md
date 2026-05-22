---
proposal: information-architecture
status: DRAFT (in active discussion)
version: 0.1
date-started: 2026-05-22
last-updated: 2026-05-22
---

# Admin Panel — Information Architecture Proposal

> **Living document.** This is the working proposal for redesigning the admin panel as if from scratch. Sections evolve as decisions are made. See [Decisions log](#decisions-log) at the bottom for what's been locked in, and [Open questions](#open-questions) for what's still under discussion.

## How to read this doc

- **Status: DRAFT** means nothing is final yet. Anything here can change.
- **Each section** is independently discussable. We refine, lock, and move on.
- **`[LOCKED]`** tag in a section = decided, do not change without revisiting.
- **`[OPEN]`** tag = still under discussion.
- **`[PROPOSED]`** = this is a proposal, awaiting feedback.

---

## 1. User mental models [PROPOSED]

The redesign is anchored to what each user **comes to do**, not to what permissions they happen to carry.

| Role | Mental model | One-line job |
|------|--------------|--------------|
| `HOST` | "My business" | Manage my listings, my guests, my money |
| `SPONSOR` | "My campaign" | Track my sponsorships and their performance |
| `EDITOR` | "The newsroom" | Posts, events, newsletter, editorial calendar |
| `CLIENT_MANAGER` | "Support / ops" | Handle user issues and conversations |
| `ADMIN` | "Run the platform" | Everything except the most critical/dangerous |
| `SUPER_ADMIN` | "The owner" | Everything, including the dangerous stuff |
| `USER` / `GUEST` | No admin access | — |
| `SYSTEM` | Bot account, non-interactive | — |

These mental models are the **anchor for every other decision** in this doc. If a UI choice violates a role's mental model, the role uses the UI wrong (or stops using it).

---

## 2. Main menu (Level 1) — universe of sections [PROPOSED]

**7 top-level sections** in the global universe. Not every user sees all of them.

```
🏠  Inicio              dashboard per user (scoped to their permissions)
🏘️  Catálogo            accommodations, destinations, attractions, amenities, features
✍️  Editorial          posts, events, newsletter, tags
👥  Comunidad          users, conversations, roles, moderation
💳  Comercial          billing, plans, subscriptions, invoices, promos, sponsorships, sponsors
⚙️  Plataforma         settings, SEO, cache/ISR, cron, webhooks, logs, audit
📊  Análisis           business, usage, SEO, debug
```

### What is NOT in the main menu

- **My account / profile** → lives in **user menu (topbar avatar)**, not main nav. Personal config, not work.
- **Notifications** → **topbar dropdown**, not a main section. `/notifications` page reachable from the dropdown.
- **Tags** → distributed within each section that uses them (post tags in Editorial, system/internal tags in Plataforma). Not a section of their own.

### Changes vs current

- Kill the duplication amenities/features/attractions (today in Content AND Administration). They live in **Catálogo** next to the entity they describe.
- Kill the "Administration" section — that name doesn't say anything. Contents redistributed: users/roles → **Comunidad**, settings → **Plataforma**, tags → see above.

---

## 3. Per-role main menu visibility [PROPOSED]

Default visibility for each role's permission bundle. **NOT enforcement** — enforcement is per-permission. This is what comes "out of the box" with each role.

| Section | HOST | SPONSOR | EDITOR | CLIENT_MGR | ADMIN | SUPER_ADMIN |
|---------|:----:|:-------:|:------:|:----------:|:-----:|:-----------:|
| 🏠 Inicio | ✅ scoped | ✅ scoped | ✅ scoped | ✅ scoped | ✅ | ✅ |
| 🏘️ Catálogo | ✅ **own** accommodations | ❌ | 👁️ read-only | 👁️ read-only | ✅ | ✅ |
| ✍️ Editorial | ❌ | ❌ | ✅ | 👁️ read-only | ✅ | ✅ |
| 👥 Comunidad | ❌ (except own conversations) | ❌ | ❌ | ✅ | ✅ | ✅ |
| 💳 Comercial | ✅ **own** subscription/invoices | ✅ **own** sponsorships | ❌ | ❌ | ✅ | ✅ |
| ⚙️ Plataforma | ❌ | ❌ | ❌ | ❌ | ✅ (no "Critical config" / Audit) | ✅ full |
| 📊 Análisis | ✅ **own** stats | ✅ **own** stats | ✅ (content) | 👁️ | ✅ | ✅ |

**Legend**: ✅ full access | 👁️ read-only | ❌ section hidden.

---

## 4. Section sidebars (Level 2) [PROPOSED]

Shown assuming SUPER_ADMIN (full universe). Other roles see subsets per their permissions.

### 🏠 Inicio

No sidebar (single page). Contextual quick-action cards in the dashboard based on permissions.

### 🏘️ Catálogo

```
Dashboard de Catálogo
─── Alojamientos ───
  Listado
  Crear
  ─── Catálogos de apoyo ───
  Amenidades
  Características
  Galería compartida          (if media library is built)
─── Destinos ───
  Listado
  Crear
  Atracciones
─── Reseñas ───
  Todas las reseñas           (cross-entity)
  Pendientes de moderar
```

**Logic**: taxonomies supporting an entity live inside its group, not as sibling sections.

### ✍️ Editorial

```
Dashboard Editorial
Calendario editorial          (cross-entity: posts + events + newsletter)
─── Blog ───
  Posts
    ├─ Todos
    ├─ Borradores
    ├─ Programados
    └─ Publicados
  Crear post
  Tags de blog
─── Eventos ───
  Listado
    ├─ Próximos
    ├─ En curso
    └─ Pasados
  Crear evento
  Locaciones
  Organizadores
─── Newsletter ───
  Campañas
  Suscriptores
  Plantillas                  (if reusable templates are built)
  Segmentos                   (already started in a prior spec)
```

### 👥 Comunidad

```
Dashboard Comunidad
─── Usuarios ───
  Todos los usuarios
  Hosts
  Editores / staff interno
  Clientes finales
  Invitar usuario
─── Conversaciones ───
  Inbox
    ├─ Sin asignar
    ├─ Asignadas a mí
    └─ Archivadas
  Plantillas de respuesta     (if built)
─── Moderación ───
  Cola de moderación
  Reportes
  Tags propuestos por usuarios
─── Roles y permisos ───
  Roles
  Permisos (catálogo read-only)
  Cambios recientes           (filtered audit log)
```

### 💳 Comercial

```
Dashboard Comercial           (MRR, churn, revenue)
─── Suscripciones ───
  Planes (catálogo)
  Suscripciones activas
  Add-ons
  Métricas de uso (per-customer)
─── Pagos ───
  Transacciones
  Facturas
  Métodos de pago
─── Promociones ───
  Códigos promocionales
  Promos para hosts
  Sponsorships
  Sponsors
─── Operaciones billing ───
  Tipos de cambio
  Webhook events
  Cron de billing
  Logs de notificaciones
─── Configuración ───
  Settings de billing
```

### ⚙️ Plataforma

```
Dashboard de Plataforma       (system health)
─── Configuración ───
  General
  SEO defaults
  Email defaults
  Localización (idiomas, monedas, timezones)
  Feature flags
─── Cache & deploy ───
  ISR / revalidación (config)
  Revalidación manual
  Historial de revalidaciones
─── Operaciones del sistema ───
  Cron jobs
  Webhook events
  Logs del sistema
  Métricas internas
─── Tags de sistema ───
  Tags internas
  Tags de sistema
─── Configuración crítica ───  [SUPER_ADMIN ONLY]
  Modo mantenimiento
  Anuncios globales
  Danger zone
─── Auditoría ───              [SUPER_ADMIN ONLY]
  Log de acciones admin
  Log de impersonations
  Cambios de permisos
```

### 📊 Análisis

```
Overview
─── Negocio ───
  KPIs principales
  Bookings & conversiones
  Revenue
  Funnel de signup
─── Uso del sistema ───
  Por plan
  Límites cerca de alcanzar
  Tendencias de uso
─── Contenido ───
  Posts (views, engagement)
  Eventos (asistencia, tickets)
  Newsletter (open rate, CTR)
─── SEO ───
  Indexación
  Performance Lighthouse
  Búsquedas internas
─── Debug ───                  [SUPER_ADMIN ONLY]
```

---

## 5. Detail page tabs (Level 3) [PROPOSED]

Consistent tab sets per entity type. Tabs are permission-aware (hidden if user lacks permission for that tab's data).

**Rule**: max **9 tabs** per detail page. More → smell that the entity does too much, split it.

### Accommodation detail
```
Overview │ Galería │ Amenidades │ Pricing │ Reseñas │ SEO │ Sponsorship │ Stats │ Config
```

### Post detail
```
Contenido │ Media │ SEO │ Programación │ Tags │ Sponsorship │ Stats
```

### Event detail
```
Overview │ Tickets │ Asistentes │ Agenda │ Locación │ Organizador │ SEO │ Stats
```

### Destination detail
```
Overview │ Atracciones │ Alojamientos vinculados │ Eventos vinculados │ SEO │ Stats
```

### User detail (in Comunidad)
```
Perfil │ Permisos │ Actividad │ Sesiones │ Suscripción │ Conversaciones │ Reportes
```

### Subscription detail
```
Overview │ Plan & Add-ons │ Pagos │ Uso │ Facturas │ Notas internas
```

### Newsletter campaign detail
```
Editor │ Audiencia │ Programación │ Métricas │ Entregas fallidas │ Preview
```

---

## 6. Per-role dashboards [PROPOSED]

Each role gets its own dashboard, **scoped to its permissions**. This explicitly fixes today's "global counts shown to everyone" bug.

### HOST dashboard — "Mi negocio"

```
┌─────────────────────────────────────────────┐
│ Welcome + Quick action: "+ Nuevo huésped"   │
├─────────────────────────────────────────────┤
│ KPIs SCOPED to their accommodations:        │
│ • Mis alojamientos activos                  │
│ • Reservas del mes                          │
│ • Ocupación promedio                        │
│ • Ingresos del mes                          │
├─────────────────────────────────────────────┤
│ Próximas check-ins (próximos 7 días)        │
│ Conversaciones sin responder (badge)        │
│ Reseñas nuevas sin responder                │
├─────────────────────────────────────────────┤
│ Estado de su suscripción + próximo cobro    │
│ Límites de uso (X de Y alojamientos)        │
└─────────────────────────────────────────────┘
```

### SPONSOR dashboard — "Mi campaña"

```
KPIs of THEIR sponsorships:
  • Sponsorships activos
  • Impresiones del mes
  • Clicks / CTR
  • Costo del mes
Próximas facturas
Performance por sponsorship (tabla compacta)
```

### EDITOR dashboard — "La redacción"

```
Editorial KPIs:
  • Posts publicados este mes
  • Eventos próximos
  • Newsletter open rate / CTR
  • Suscriptores newsletter
Calendario editorial (next 14 days)
Top posts by engagement (week)
Pending drafts
```

### CLIENT_MANAGER dashboard — "Soporte"

```
Conversaciones sin asignar (urgent)
Conversaciones asignadas a mí
Tickets escalados
Cola de moderación (count)
Reportes pendientes
Usuarios nuevos esta semana (load context)
```

### ADMIN dashboard — "Vista plataforma"

```
Global KPIs (contextualized)
+ MRR / ARR / Churn
+ Top hosts by revenue
+ Top upcoming events
+ System OK / alerts
+ Conversiones del mes
```

### SUPER_ADMIN dashboard

Same as ADMIN + "System ops" block:

```
+ Service status (api / web / admin / db / redis)
+ Sentry errors (last 24h)
+ Failed crons
+ Recent admin actions (audit log preview)
```

---

## 7. Settings split in three places [PROPOSED]

Today: fragmented across 3 routes with inconsistent storage. Proposal:

### 👤 Mi cuenta (in topbar user menu — all roles)

```
Perfil              Name, last name, avatar, bio, contact
Preferencias        Theme (web + admin), language (web + admin), timezone
Seguridad           Password, 2FA, active sessions, devices
Notificaciones      Per channel (email/sms/push) and per type
Suscripción         (HOST/SPONSOR) — their plan, their billing
Mis datos           Export (GDPR), delete account
Conexiones          OAuth providers linked
```

### ⚙️ Plataforma (section — ADMIN/SUPER_ADMIN only)

Anything that affects how the product works for everyone. Already in the Plataforma sidebar above.

### 💳 Configuración de billing (inside Comercial — ADMIN+)

Trial rules, payment retry, default currency, webhooks. Already in Comercial → Configuración.

**Rule**: if the setting **affects only you**, → My account. If it **affects others or the system**, → Plataforma / Comercial.

---

## 8. Permission cherry-pick UX [PROPOSED]

Roles are **default permission bundles**. Users can have permissions added or removed individually on top. The UI must handle the resulting overlay gracefully.

**Three visibility rules in cascade**:

### Rule 1 — Sidebar items (Level 2)
Groups with ≥1 visible item show their **full structure**, but inaccessible items appear **disabled (greyed out) with tooltip "Requiere permiso X"**. Gives the user context of what exists.

### Rule 2 — Main menu sections (Level 1)
Sections with ≥1 accessible item appear in the main menu. **Sections with 0 accessible items disappear entirely.**

### Rule 3 — Dashboards scoped by permission, not role
A user with `accommodation.view.own` only → sees KPIs of THEIR accommodations. A user with `accommodation.view.all` → sees global KPIs. A user with both → sees a "Mine / All" toggle.

### Alternative being considered

Hide all inaccessible items instead of greying them. Cleaner visually, but the user has no idea what exists.

**Recommendation**: "show disabled" only in sidebar (Level 2); "hide completely" in main menu (Level 1) and tabs (Level 3). Power users get context; new users don't see a greyed menu.

---

## 9. Global topbar [PROPOSED]

```
┌─────────────────────────────────────────────────────────────────────┐
│ [LOGO]   [Main nav L1]   [🔍 Cmd+K] [🔔] [+ create] [👤 avatar]      │
└─────────────────────────────────────────────────────────────────────┘
```

- **Logo** → click goes to `/inicio` of the user (not global `/dashboard`).
- **Main menu** → max 7 items, hidden on mobile (hamburger).
- **🔍 Search / CommandPalette (Cmd+K)** → universal, permission-aware. Replaces traditional navigation for power users.
- **🔔 Notifications** → dropdown with real counter (today a placeholder, needs wiring).
- **➕ Quick create** → contextual to role. HOST = "+ Accommodation". EDITOR = menu "+ Post / + Event". ADMIN = all.
- **👤 User menu (avatar)** → Mi cuenta, Preferencias, Seguridad, Notificaciones, Logout.

**Impersonation banner**: when active, full-width yellow banner above everything, with "Estás impersonando a Juan Pérez" + "Salir de impersonation" button + reason.

---

## 10. Mobile / responsive [PROPOSED]

- **Bottom nav** with the 3-4 most-used items for each role (HOST: Inicio / Alojamientos / Conversaciones / Mi cuenta). Hamburger reserved for "everything else".
- **FAB** in mobile for the role's quick action.
- **Breadcrumbs** below topbar only on Level 3+ pages (detail tabs). Not in lists.
- **Sidebar collapsible to icons** (NOT to `w-0` like today). Power users get more real estate without losing nav.

---

## Open questions

These are the points pending discussion before locking the IA in. Numbered for easy reference.

1. **Are the 7 main menu sections the right set?** Add / remove any?
2. **Is the per-role visibility matrix correct?**
   - Does `CLIENT_MANAGER` actually exist as a working role, or kill it?
   - Does `SPONSOR` see only "My campaign", or also Editorial read-only for context?
3. **Cherry-pick rule** — go with "show disabled in sidebar, hide in main menu" (the recommendation), or **hide everything inaccessible** always?
4. **Per-role fixed dashboards** (as proposed), or **user-configurable dashboards** with widgets they assemble themselves?
5. **My account** lives in topbar user menu (recommendation), or as a main menu section?

---

## Decisions log

> As we lock things, they move here with date + rationale.

_(Nothing locked yet. The whole doc is in DRAFT.)_

---

## Change log

| Date | Version | Change |
|------|---------|--------|
| 2026-05-22 | 0.1 | Initial draft, full proposal across all 10 sections + 5 open questions |
