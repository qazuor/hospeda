---
proposal: information-architecture
status: DRAFT (in active discussion)
version: 0.4
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

## 11. Foundational decision — Config-driven IA [LOCKED 2026-05-22]

The entire admin information architecture is defined in a **single declarative TypeScript config**, validated at app boot with Zod. Components only **read** from this config — they contain no IA logic of their own.

### What lives in config

- Sections (labels with i18n, icons, routes, sidebar refs)
- Sidebars (groups, items, links, separators, permission gates)
- Roles (default permission bundles, main menu visibility, dashboard ref, topbar config, mobile config, label overrides)
- Dashboards (widgets per dashboard, with permission gates and scope)
- Tabs per detail page (per entity type, with permission gates)
- Topbar elements per role (search, quick create, account location)

### What lives in components

- HOW to render a sidebar (collapse logic, mobile drawer, animations)
- HOW to apply the permission cherry-pick rules (see §8)
- HOW to handle responsive breakpoints
- WHAT happens on click (navigation, modals)

### Format: TypeScript + Zod

- TS file at `apps/admin/src/config/admin-ia.config.ts` (likely split across multiple files in `apps/admin/src/config/ia/` for readability — sections, sidebars, roles, dashboards each in their own file, composed into a final object).
- Validated by a Zod schema at app boot. **Invalid config crashes the app with a clear error** pointing to the offending key.
- Type-safe via `import type` from `@repo/schemas` for `PermissionEnum` and `RoleEnum` — typos caught at compile time.
- No runtime mutation in V1. Future phase may add a DB-backed UI editor (the config shape stays the same, only the source changes).

### Why this matters

- Change "what HOST sees" = **one line in config**, no React touched.
- Change labels per role/locale = config-only, no JSX touched.
- Add a new section = register in config + build its sidebar config + optional widget config — no router restructuring.
- Test "HOST never sees Plataforma" = assert on config object, one-liner.
- Future Phase 2: PM/UX can edit config from within the admin itself.

---

## 12. HOST role — locked config [LOCKED 2026-05-22]

### Role config (TS)

```ts
HOST: {
  label: { es: 'Anfitrión', en: 'Host', pt: 'Anfitrião' },
  defaultPermissions: [
    'ACCESS_PANEL_ADMIN',
    'ACCOMMODATION_VIEW_OWN', 'ACCOMMODATION_EDIT_OWN',
    'ACCOMMODATION_CREATE',                  // limit-gated by their plan
    'ACCOMMODATION_DELETE_OWN',
    'AMENITY_VIEW', 'FEATURE_VIEW',          // catalogs (read-only)
    'REVIEW_VIEW_OWN', 'REVIEW_REPLY_OWN',
    'CONVERSATION_VIEW_OWN', 'CONVERSATION_REPLY_OWN',
    'BILLING_VIEW_OWN', 'INVOICE_VIEW_OWN',
    'SUBSCRIPTION_VIEW_OWN', 'PAYMENT_METHOD_MANAGE_OWN',
    'NOTIFICATION_VIEW_OWN', 'NOTIFICATION_PREFERENCES_MANAGE_OWN',
    'USER_UPDATE_SELF',
  ],
  mainMenu: ['inicio', 'misAlojamientos', 'consultas', 'miFacturacion', 'miCuenta'],
  dashboard: 'hostDashboard',
  topbar: {
    showSearch: false,                       // no Cmd+K — non-tech users
    showQuickCreate: ['newAccommodation'],
    accountInMenu: true,                     // "Mi cuenta" lives as item 5
  },
  mobile: {
    bottomNav: ['inicio', 'misAlojamientos', 'consultas', 'miCuenta'],
    fab: 'newAccommodation',
  },
},
```

### Full menu tree

```
1- Inicio
   (dashboard "Mi negocio": KPIs scoped, consultas sin responder,
    próximos check-ins, estado de suscripción)

2- Mis alojamientos
   2.1- Ver mis alojamientos
   2.2- Agregar alojamiento nuevo
   (detail tabs Level 3):
        2.x.1- Información general
        2.x.2- Fotos
        2.x.3- Amenidades y servicios
        2.x.4- Precios y temporadas
        2.x.5- Reseñas de huéspedes
        2.x.6- Estadísticas
        2.x.7- Estado y visibilidad

3- Consultas
   3.1- Sin responder            [badge contador]
   3.2- Activas
   3.3- Archivadas

4- Mi facturación
   4.1- Mi plan actual
   4.2- Próximo cobro
   4.3- Historial de facturas
   4.4- Métodos de pago
   4.5- Uso de mi plan

5- Mi cuenta
   5.1- Mi perfil público
   5.2- Mis datos personales
   5.3- Preferencias (idioma, tema, zona horaria)
   5.4- Notificaciones
   5.5- Seguridad (contraseña, 2FA, sesiones)
   5.6- Mis datos (descargar, eliminar cuenta)
```

### Topbar (HOST)

- Logo (→ Inicio)
- 🔔 Notificaciones (con badge)
- ➕ "Nuevo alojamiento" (single contextual FAB)
- 👤 Avatar — solo nombre + "Cerrar sesión". El resto vive en "Mi cuenta" (main menu).

### Mobile bottom nav (HOST)

```
[🏠 Inicio]  [🏘️ Alojamientos]  [💬 Consultas]  [👤 Cuenta]
```

"Mi facturación" se llega vía Cuenta o tap en card del dashboard.

### Language principles

- 100% en términos de "lo suyo": "Mis alojamientos", "Mi facturación", "Mi cuenta".
- Cero jerga: nada de "admin", "panel", "config", "settings", "billing".

---

## 13. SUPER_ADMIN role — locked config [LOCKED 2026-05-22]

### Role config (TS)

```ts
SUPER_ADMIN: {
  label: { es: 'Super admin', en: 'Super admin', pt: 'Super admin' },
  defaultPermissions: ['*'],                 // wildcard expansion at boot to all
  mainMenu: ['inicio', 'catalogo', 'editorial', 'comunidad',
             'comercial', 'plataforma', 'analisis'],
  dashboard: 'superAdminDashboard',
  topbar: {
    showSearch: true,                        // Cmd+K active
    showQuickCreate: 'all',                  // menu with all create actions
    accountInMenu: false,                    // Mi cuenta in topbar avatar
  },
  mobile: {
    bottomNav: null,                         // hamburger only
  },
},
```

### Full menu tree (7 sections)

```
1- Inicio
   (dashboard de plataforma: KPIs globales, system health,
    audit log preview, alertas Sentry/crons fallidos)

2- Catálogo
   2.1- Dashboard de Catálogo
   2.2- Alojamientos
        2.2.1- Listado
        2.2.2- Crear alojamiento
        2.2.3- Amenidades (catálogo)
        2.2.4- Características (catálogo)
        2.2.5- Galería compartida (media library)
   2.3- Destinos
        2.3.1- Listado
        2.3.2- Crear destino
        2.3.3- Atracciones
   2.4- Reseñas
        2.4.1- Todas las reseñas
        2.4.2- Pendientes de moderar

3- Editorial
   3.1- Dashboard Editorial
   3.2- Calendario editorial
   3.3- Blog
        3.3.1- Posts (todos)
        3.3.2- Borradores
        3.3.3- Programados
        3.3.4- Publicados
        3.3.5- Crear post
        3.3.6- Tags de blog
   3.4- Eventos
        3.4.1- Próximos
        3.4.2- En curso
        3.4.3- Pasados
        3.4.4- Crear evento
        3.4.5- Locaciones
        3.4.6- Organizadores
   3.5- Newsletter (operaciones)
        3.5.1- Campañas
        3.5.2- Crear campaña
        3.5.3- Suscriptores
        3.5.4- Segmentos
        3.5.5- Plantillas de campaña     [contenido editorial reusable]
        (config de email/sender/DKIM/throttling → Plataforma → Email)

4- Comunidad
   4.1- Dashboard Comunidad
   4.2- Usuarios
        4.2.1- Todos los usuarios
        4.2.2- Hosts
        4.2.3- Editores / staff interno
        4.2.4- Clientes finales
        4.2.5- Sponsors (cuenta-usuario)
        4.2.6- Invitar usuario
   4.3- Conversaciones
        4.3.1- Inbox
        4.3.2- Sin asignar
        4.3.3- Asignadas a mí
        4.3.4- Archivadas
   4.4- Moderación
        4.4.1- Cola de moderación de contenido
        4.4.2- Reportes
        4.4.3- Tags propuestos por usuarios
   4.5- Roles y permisos
        4.5.1- Roles
        4.5.2- Permisos (catálogo)
        4.5.3- Cambios recientes (audit filtrado)

5- Comercial
   5.1- Dashboard Comercial (MRR, churn, revenue)
   5.2- Suscripciones
        5.2.1- Planes
        5.2.2- Suscripciones activas
        5.2.3- Add-ons
        5.2.4- Métricas de uso (per-customer)
   5.3- Pagos
        5.3.1- Transacciones
        5.3.2- Facturas
        5.3.3- Métodos de pago
   5.4- Promociones
        5.4.1- Códigos promocionales
        5.4.2- Promos para hosts
   5.5- Sponsorships
        5.5.1- Sponsorships activos
        5.5.2- Sponsors (entidad comercial)
   5.6- Operaciones billing
        5.6.1- Tipos de cambio
        5.6.2- Webhook events            [vista filtrada — config + management en Plataforma]
        5.6.3- Cron de billing           [vista filtrada — config + management en Plataforma]
        (logs de notificaciones de email → Plataforma → Email → Logs de entregas)
   5.7- Configuración billing            [trial, grace, retry, reminders, default currency]

6- Plataforma
   6.1- Dashboard de Plataforma (system health)
   6.2- Configuración general
        6.2.1- General
        6.2.2- SEO defaults
        6.2.3- Localización (idiomas, monedas, timezones)
        6.2.4- Feature flags
   6.3- Email (infraestructura de envíos)
        6.3.1- Proveedor (Brevo, Resend, etc.)
        6.3.2- Identidad del remitente (from, reply-to)
        6.3.3- Dominios y DKIM/SPF/DMARC
        6.3.4- Throttling y rate limits
        6.3.5- Plantillas de sistema (transactional + base marketing)
        6.3.6- Unsubscribe y compliance (GDPR)
        6.3.7- Logs de entregas (todo email: newsletter + transactional + sistema)
   6.4- Cache y deploy
        6.4.1- ISR / revalidación (config)
        6.4.2- Revalidación manual
        6.4.3- Historial de revalidaciones
   6.5- Operaciones del sistema
        6.5.1- Cron jobs (todos)
        6.5.2- Webhook events (todos + config)
        6.5.3- Logs del sistema
        6.5.4- Métricas internas
   6.6- Tags del sistema
        6.6.1- Tags internas
        6.6.2- Tags de sistema
   6.7- Configuración crítica          [SUPER_ADMIN ONLY]
        6.7.1- Modo mantenimiento
        6.7.2- Anuncios globales
        6.7.3- Danger zone
   6.8- Auditoría                      [SUPER_ADMIN ONLY]
        6.8.1- Log de acciones admin
        6.8.2- Log de impersonations
        6.8.3- Cambios de permisos

7- Análisis
   7.1- Overview
   7.2- Negocio
        7.2.1- KPIs principales
        7.2.2- Bookings y conversiones
        7.2.3- Revenue
        7.2.4- Funnel de signup
   7.3- Uso del sistema
        7.3.1- Por plan
        7.3.2- Límites cerca de alcanzar
        7.3.3- Tendencias de uso
   7.4- Contenido
        7.4.1- Posts (views, engagement)
        7.4.2- Eventos (asistencia, tickets)
        7.4.3- Newsletter (open rate, CTR)
   7.5- SEO
        7.5.1- Indexación
        7.5.2- Performance Lighthouse
        7.5.3- Búsquedas internas
   7.6- Debug                          [SUPER_ADMIN ONLY]
```

### Topbar (SUPER_ADMIN)

- Logo (→ Inicio)
- Menú principal (7 secciones)
- 🔍 Search Cmd+K (CommandPalette permission-aware)
- 🔔 Notificaciones (badge)
- ➕ Quick create — menú con "+ Post / + Evento / + Alojamiento / + Usuario / etc."
- 👤 Avatar dropdown:
  - Mi perfil
  - Preferencias personales
  - Mis notificaciones
  - Seguridad (password, 2FA, sesiones)
  - Cambiar de usuario (impersonation start)
  - Cerrar sesión

### Impersonation banner

Cuando activa: banner amarillo full-width arriba de todo, con "Estás impersonando a Juan Pérez (HOST)" + botón **Salir** + razón.

### Mobile (SUPER_ADMIN)

Solo hamburger. Bottom nav no aplica — demasiados items para que sea útil.

---

## 14. "Crear X" — both places [LOCKED 2026-05-22]

Las acciones "Crear X" aparecen en **DOS lugares**:

1. **Dentro del grupo correspondiente del sidebar** (ej. grupo "Alojamientos" → item "Crear alojamiento"). Para users que vienen desde el contexto de esa sección.
2. **En el botón ➕ del topbar** (contextual a los permisos del rol). Para users que quieren crear desde cualquier lugar.

Redundancia intencional — un click extra de overhead vale la pena para que power users no tengan que volver al sidebar.

---

## 15. Operations vs. Configuration split [LOCKED 2026-05-22]

**Principle**: every feature has two facets — **operational work** and **platform configuration** — that live in different sections of the IA.

- **Operations** (daily use of the feature) live in the **feature's own section**.
  - Editorial → writing newsletter campaigns, scheduling, managing segments.
  - Comercial → tuning trial duration, grace period, payment retries.
  - Comunidad → moderating user-proposed tags, replying to conversations.
- **Configuration** that is **infrastructure-level** (provider keys, sender identity, DKIM, throttling, webhook secrets, system templates, delivery logs) lives in **Plataforma**.

### Why split

- **Different audiences**: the editor writes the newsletter; the admin configures the email provider. Mixing them puts editor in front of DKIM keys (intimidating) and admin in front of campaign editor (irrelevant).
- **Different change cadence**: campaigns ship weekly; email provider config changes once a year. Don't crowd high-cadence work with low-cadence settings.
- **Single source of truth for infra**: ALL email delivery (newsletter + transactional + system) goes through one config. Same for crons, webhooks, logs.

### Concrete application

| Feature | Operations (own section) | Configuration (Plataforma) |
|---------|--------------------------|---------------------------|
| Newsletter | Editorial → Newsletter (campañas, suscriptores, segmentos, plantillas de contenido) | Plataforma → Email (provider, sender identity, DKIM, throttling, plantillas de sistema, unsubscribe, delivery logs) |
| Billing | Comercial → Configuración billing (trial, grace, retry, reminders, currency) | Plataforma → Webhooks (config), Plataforma → Crons (billing cron) |
| Tags | Editorial → Tags de blog (use), Comunidad → User-proposed tags moderation | Plataforma → Tags del sistema (catálogo) |
| Crons | Per-section filtered view (e.g., Comercial → cron de billing) | Plataforma → Cron jobs (all + config) |
| Webhooks | Per-section filtered view (e.g., Comercial → webhook events del billing) | Plataforma → Webhook events (all + config) |

### Exceptions

Operational rules tightly coupled to a feature (e.g., "default currency for invoices" is billing-specific and rarely touched by anyone outside Comercial) stay in the feature's own "Configuración" sub-item to avoid forcing users to navigate to Plataforma for every micro-tweak. Heuristic: if the setting is meaningless outside one feature, it can stay; if it affects infrastructure shared by multiple features, it goes to Plataforma.

---

## Open questions

These are the points pending discussion before the IA is fully locked. Lettered for easy reference.

### A. Other roles' default menus [OPEN]

HOST and SUPER_ADMIN are locked. Still pending: `EDITOR`, `SPONSOR`, `CLIENT_MANAGER`, `ADMIN`. Note: also pending validation that `CLIENT_MANAGER` is an actively-used role and not nominal.

### B. Permission cherry-pick UX rule [OPEN]

Three options on the table (see §8):

- **Recommended**: show disabled (greyed + tooltip) in sidebar Level 2; hide at Level 1 (main menu) and Level 3 (tabs).
- **Alternative 1**: hide all inaccessible items everywhere — cleaner but less discoverable.
- **Alternative 2**: show disabled at all levels — most discoverable but visually noisy.

### C. Config file split [OPEN — implementation detail]

Single `admin-ia.config.ts` vs split into `apps/admin/src/config/ia/{sections,sidebars,roles,dashboards}.ts`? Recommend split for editability. To be confirmed in implementation spec.

---

## Decisions log

| Date | Decision | Section |
|------|----------|---------|
| 2026-05-22 | 7 main menu sections in the universe: Inicio, Catálogo, Editorial, Comunidad, Comercial, Plataforma, Análisis | §2 |
| 2026-05-22 | Foundational: entire IA is config-driven via single TS+Zod config | §11 |
| 2026-05-22 | HOST = 5 main menu items; "Mi cuenta" lives in main menu; no Cmd+K | §12 |
| 2026-05-22 | HOST terminology: "Consultas" (NOT "Mensajes con huéspedes") | §12 |
| 2026-05-22 | HOST: "Mi facturación" as own main menu item (not buried in Mi cuenta) | §12 |
| 2026-05-22 | SUPER_ADMIN = 7 main menu items; "Mi cuenta" in topbar avatar; Cmd+K active | §13 |
| 2026-05-22 | "Crear X" appears in BOTH sidebar groups AND topbar `+` button | §14 |
| 2026-05-22 | Per-role fixed dashboards in V1 (not user-configurable widgets) | §6, §12, §13 |
| 2026-05-22 | Foundational principle: Operations vs. Configuration split — feature operations live in their section, infrastructure config lives in Plataforma | §15 |
| 2026-05-22 | Newsletter split: editorial operations (campañas, suscriptores, segmentos, plantillas de contenido) in Editorial; email infrastructure (provider, sender identity, DKIM, throttling, plantillas de sistema, delivery logs) in Plataforma → Email | §13, §15 |
| 2026-05-22 | Plataforma reorganized: new dedicated "Email" group (§6.3); old "Email defaults" moved out of "Configuración general"; subsequent groups renumbered (6.4 Cache, 6.5 Ops, 6.6 Tags, 6.7 Crítica, 6.8 Auditoría) | §13 |
| 2026-05-22 | Email delivery logs centralized in Plataforma → Email → Logs de entregas (removed from Comercial → Operaciones billing) | §13 |

---

## Change log

| Date | Version | Change |
|------|---------|--------|
| 2026-05-22 | 0.1 | Initial draft, full proposal across all 10 sections + 5 open questions |
| 2026-05-22 | 0.2 | Version bumped (prep for IA lock-in edits) |
| 2026-05-22 | 0.3 | Locked: §11 config-driven IA foundation, §12 HOST role, §13 SUPER_ADMIN role, §14 "Crear X" both places. Reorganized open questions (A-D). Decisions log populated. |
| 2026-05-22 | 0.4 | Added §15 Operations vs. Configuration split principle. Newsletter split applied (Editorial keeps operations; Plataforma gets new Email group for infra). Plataforma sidebar restructured: added 6.3 Email, renumbered 6.4-6.8. Logs de notificaciones moved from Comercial to Plataforma → Email. Open Q-A (Newsletter location) resolved and removed; remaining Qs renumbered (A-C). |
