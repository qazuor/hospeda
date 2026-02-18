# Route Audit Report - Hospeda Platform

> **Date:** 2026-02-16
> **Scope:** Web App (Astro) + Admin App (TanStack Start)
> **Status:** Exhaustive analysis of all routes, auth, rendering, data sources, and navigation

---

## Table of Contents

- [1. Web App (Astro) - Port 4321](#1-web-app-astro---port-4321)
  - [1.1 General Configuration](#11-general-configuration)
  - [1.2 Public Routes (No Auth)](#12-public-routes-no-auth)
  - [1.3 Auth Routes (Public with Redirect)](#13-auth-routes-public-with-redirect-if-authenticated)
  - [1.4 Protected Routes (Auth Required)](#14-protected-routes-auth-required)
  - [1.5 Web App Stats](#15-web-app-stats)
- [2. Admin App (TanStack Start) - Port 3000](#2-admin-app-tanstack-start---port-3000)
  - [2.1 General Configuration](#21-general-configuration)
  - [2.2 Public Routes](#22-public-routes)
  - [2.3 Dashboard Section](#23-dashboard-section)
  - [2.4 Content - Accommodations](#24-content---accommodations)
  - [2.5 Content - Destinations](#25-content---destinations)
  - [2.6 Content - Attractions](#26-content---attractions)
  - [2.7 Content - Events](#27-content---events)
  - [2.8 Content - Blog (Posts)](#28-content---blog-posts)
  - [2.9 Billing Section](#29-billing-section)
  - [2.10 Administration - Access Control](#210-administration---access-control)
  - [2.11 Administration - Catalogs](#211-administration---catalogs)
  - [2.12 Administration - Settings](#212-administration---settings)
  - [2.13 Sponsors](#213-sponsors)
  - [2.14 Analytics](#214-analytics)
  - [2.15 Admin App Stats](#215-admin-app-stats)
- [3. Comparative Summary](#3-comparative-summary)
- [4. Critical Findings](#4-critical-findings)

---

## 1. Web App (Astro) - Port 4321

### 1.1 General Configuration

| Property | Value |
|----------|-------|
| **Framework** | Astro with React islands |
| **Output mode** | Hybrid (SSG default, SSR per-route) |
| **Locales** | 3 (`es`, `en`, `pt`) .. all routes under `[lang]/` |
| **Default locale** | `es` |
| **Trailing slash** | Always required |
| **Middleware** | None (no global middleware) |
| **Auth guard** | Per-page server-side check (`Astro.locals.user`) |
| **SEO** | Canonical URLs, JSON-LD, sitemap (excludes `/auth/` and `/mi-cuenta/`) |
| **Total routes** | 35 unique (~105 URLs across 3 locales) |

### 1.2 Public Routes (No Auth)

#### Core / Navigation

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 1 | `/` | `pages/index.astro` | SSG | Redirect (Accept-Language detection) | Entry point |
| 2 | `/404` | `pages/404.astro` | SSG | **Hardcoded** | Automatic |
| 3 | `/500` | `pages/500.astro` | SSG | **Hardcoded** | Automatic |
| 4 | `/[lang]/` | `pages/[lang]/index.astro` | SSG | **Server Islands** (featured sections) | Header logo |

#### Accommodations

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 5 | `/[lang]/alojamientos/` | `pages/[lang]/alojamientos/index.astro` | **SSR** | **API real** (paginated list + filters + sort) | Header nav |
| 6 | `/[lang]/alojamientos/[slug]` | `pages/[lang]/alojamientos/[slug].astro` | SSG | **API real** (detail) | Links in listing, Footer |
| 7 | `/[lang]/alojamientos/tipo/[type]` | `pages/[lang]/alojamientos/tipo/[type].astro` | **SSR** | **API real** (filtered by type) | Internal links |

#### Destinations

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 8 | `/[lang]/destinos/` | `pages/[lang]/destinos/index.astro` | SSG | **API real** (list) | Header nav |
| 9 | `/[lang]/destinos/[...path]` | `pages/[lang]/destinos/[...path].astro` | SSG | **API real** (hierarchical detail) | Links in listing, Footer |

#### Events

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 10 | `/[lang]/eventos/` | `pages/[lang]/eventos/index.astro` | **SSR** | **API real** (list + category/timeframe filters) | Header nav |
| 11 | `/[lang]/eventos/[slug]` | `pages/[lang]/eventos/[slug].astro` | SSG | **API real** (detail with agenda, pricing) | Links in listing, Footer |

#### Blog / Publications

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 12 | `/[lang]/publicaciones/` | `pages/[lang]/publicaciones/index.astro` | SSG | **API real** (blog list) | Header nav, Footer |
| 13 | `/[lang]/publicaciones/[slug]` | `pages/[lang]/publicaciones/[slug].astro` | SSG | **API real** (article detail) | Internal links |
| 14 | `/[lang]/blog/` | `pages/[lang]/blog/index.astro` | SSG | **API real** (alias of publicaciones) | Internal links |
| 15 | `/[lang]/blog/[slug]` | `pages/[lang]/blog/[slug].astro` | SSG | **API real** (alias of publicaciones) | Internal links |

#### Search

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 16 | `/[lang]/busqueda/` | `pages/[lang]/busqueda/index.astro` | **SSR** | **API real** (if query param) / empty | SearchBar component |

#### Static / Informational Pages

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 17 | `/[lang]/beneficios/` | `pages/[lang]/beneficios/index.astro` | SSG | **Hardcoded** | Footer "Beneficios" |
| 18 | `/[lang]/contacto/` | `pages/[lang]/contacto/index.astro` | SSG | **Hardcoded** | Footer "Contacto" |
| 19 | `/[lang]/quienes-somos/` | `pages/[lang]/quienes-somos/index.astro` | SSG | **Hardcoded** | Footer "Quienes somos" |
| 20 | `/[lang]/terminos-condiciones/` | `pages/[lang]/terminos-condiciones/index.astro` | SSG | **Hardcoded** | Footer "Terminos y condiciones" |
| 21 | `/[lang]/privacidad/` | `pages/[lang]/privacidad/index.astro` | SSG | **Hardcoded** | Footer "Privacidad" |
| 22 | `/[lang]/mapa-del-sitio/` | `pages/[lang]/mapa-del-sitio/index.astro` | SSG | **Hardcoded** (links) | Footer "Sitemap" |

#### Pricing

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 23 | `/[lang]/precios/turistas/` | `pages/[lang]/precios/turistas/index.astro` | SSG | **Hardcoded** | CTA buttons |
| 24 | `/[lang]/precios/propietarios/` | `pages/[lang]/precios/propietarios/index.astro` | SSG | **Hardcoded** | CTA buttons |

### 1.3 Auth Routes (Public with Redirect if Authenticated)

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 25 | `/[lang]/auth/signin/` | `pages/[lang]/auth/signin.astro` | **SSR** | **Hardcoded** (form + Better Auth) | Header, internal links |
| 26 | `/[lang]/auth/signup/` | `pages/[lang]/auth/signup.astro` | SSG | **Hardcoded** | Link in signin |
| 27 | `/[lang]/auth/forgot-password/` | `pages/[lang]/auth/forgot-password.astro` | SSG | **Hardcoded** | Link in signin |
| 28 | `/[lang]/auth/reset-password/` | `pages/[lang]/auth/reset-password.astro` | **SSR** | **Hardcoded** (requires token) | Email link |
| 29 | `/[lang]/auth/verify-email/` | `pages/[lang]/auth/verify-email/index.astro` | **SSR** | **Hardcoded** (requires token) | Email link |

### 1.4 Protected Routes (Auth Required)

All routes redirect to `/auth/signin` if `!Astro.locals.user`.

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 30 | `/[lang]/mi-cuenta/` | `pages/[lang]/mi-cuenta/index.astro` | **SSR** | **Hardcoded** | Header AuthSection |
| 31 | `/[lang]/mi-cuenta/editar/` | `pages/[lang]/mi-cuenta/editar/index.astro` | **SSR** | **Hardcoded** | Account sidebar |
| 32 | `/[lang]/mi-cuenta/favoritos/` | `pages/[lang]/mi-cuenta/favoritos/index.astro` | **SSR** | **Hardcoded** (empty) | Account sidebar |
| 33 | `/[lang]/mi-cuenta/preferencias/` | `pages/[lang]/mi-cuenta/preferencias.astro` | **SSR** | **Hardcoded** | Account sidebar |
| 34 | `/[lang]/mi-cuenta/resenas/` | `pages/[lang]/mi-cuenta/resenas.astro` | **SSR** | **Hardcoded** (empty) | Account sidebar |
| 35 | `/[lang]/mi-cuenta/suscripcion/` | `pages/[lang]/mi-cuenta/suscripcion.astro` | **SSR** | **Hardcoded** | Account sidebar |

### 1.5 Web App Stats

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total routes** | 35 | 100% |
| **SSG routes** | 26 | 74% |
| **SSR routes** | 9 | 26% |
| **API real data** | 10 | 29% |
| **Hardcoded data** | 24 | 69% |
| **Server Islands** | 1 | 3% |
| **Public routes** | 29 | 83% |
| **Protected routes** | 6 | 17% |

---

## 2. Admin App (TanStack Start) - Port 3000

### 2.1 General Configuration

| Property | Value |
|----------|-------|
| **Framework** | TanStack Start (full-stack React) |
| **Rendering** | Hybrid SSR with client-side hydration |
| **Auth** | Better Auth with `beforeLoad` guard in `_authed` layout |
| **Code splitting** | Heavy components use `.lazy.tsx` files |
| **Navigation** | Header (5 sections) + contextual Sidebar + Tabs on detail pages |
| **i18n** | No |
| **Total routes** | ~101 |

**Header sections (Level 1 navigation):**

1. Dashboard (icon: DashboardIcon)
2. Contenido (icon: ContentIcon)
3. Facturacion (icon: CreditCardIcon)
4. Administracion (icon: AdminIcon)
5. Analiticas (icon: AnalyticsIcon)

**Auth protection:** All routes under `_authed/` require authentication via `fetchAuthSession()` in `beforeLoad`. Unauthenticated users redirect to `/auth/signin`.

### 2.2 Public Routes

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 1 | `/` | `routes/index.tsx` | Redirect | N/A | Redirects to `/dashboard` or `/auth/signin` |
| 2 | `/auth/signin` | `routes/auth/signin.tsx` | SSR/CSR | Better Auth form | Header profile menu |
| 3 | `/auth/signup` | `routes/auth/signup.tsx` | SSR/CSR | Better Auth form | Link in signin |
| 4 | `/auth/callback` | `routes/auth/callback.tsx` | SSR/CSR | OAuth handler | OAuth provider redirect |
| 5 | `/dev/icon-comparison` | `routes/dev/icon-comparison.tsx` | CSR | **Hardcoded** | Development only |

### 2.3 Dashboard Section

**Header:** "Dashboard" | **Default:** `/dashboard`

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 6 | `/dashboard` | `_authed/dashboard.tsx` + `.lazy.tsx` | SSR + Lazy CSR | **API real** (`useDashboardStats()`) | Header logo, Sidebar "Resumen" |
| 7 | `/notifications` | `_authed/notifications.tsx` | SSR/CSR | **Placeholder** ("No new notifications") | Sidebar, Header bell icon |
| 8 | `/me/profile` | `_authed/me/profile.tsx` | SSR/CSR | **API real** (Better Auth session) | Header user icon, Sidebar "Mi Perfil" |
| 9 | `/me/settings` | `_authed/me/settings.tsx` | SSR/CSR | **API real** | Header settings icon, Sidebar "Configuracion" |
| 10 | `/me/accommodations` | `_authed/me/accommodations/index.tsx` | SSR/CSR | **API real** | Sidebar "Mis Alojamientos" |

### 2.4 Content - Accommodations

**Header:** "Contenido" | **Sidebar group:** "Alojamientos" (expanded by default)

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 11 | `/accommodations` | `_authed/accommodations/index.tsx` | SSR/CSR | **API real** (`useAccommodationsQuery()`, TanStack Table) | Sidebar "Listado" |
| 12 | `/accommodations/new` | `_authed/accommodations/new.tsx` | SSR/CSR | **API real** (create mutation) | Sidebar "Crear Nuevo", action button |
| 13 | `/accommodations/:id` | `_authed/accommodations/$id.tsx` | SSR/CSR + Lazy | **API real** (`useAccommodationQuery(id)`) | Row click in list |
| 14 | `/accommodations/:id/edit` | `_authed/accommodations/$id_.edit.tsx` | SSR/CSR | **API real** | Edit button on detail |
| 15 | `/accommodations/:id/amenities` | `_authed/accommodations/$id.amenities.tsx` | SSR/CSR | **API real** | Tab on detail page |
| 16 | `/accommodations/:id/gallery` | `_authed/accommodations/$id.gallery.tsx` | SSR/CSR | **API real** | Tab on detail page |
| 17 | `/accommodations/:id/pricing` | `_authed/accommodations/$id.pricing.tsx` | SSR/CSR | **API real** | Tab on detail page |
| 18 | `/accommodations/:id/reviews` | `_authed/accommodations/$id.reviews.tsx` | SSR/CSR | **API real** | Tab on detail page |

### 2.5 Content - Destinations

**Sidebar group:** "Destinos"

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 19 | `/destinations` | `_authed/destinations/index.tsx` | SSR/CSR | **API real** | Sidebar "Listado" |
| 20 | `/destinations/new` | `_authed/destinations/new.tsx` | SSR/CSR | **API real** (create) | Sidebar "Crear Nuevo" |
| 21 | `/destinations/:id` | `_authed/destinations/$id.tsx` | SSR/CSR + Lazy | **API real** | Row click in list |
| 22 | `/destinations/:id/edit` | `_authed/destinations/$id_.edit.tsx` | SSR/CSR | **API real** | Edit button |
| 23 | `/destinations/:id/accommodations` | `_authed/destinations/$id.accommodations.tsx` | SSR/CSR | **API real** | Tab on detail page |
| 24 | `/destinations/:id/attractions` | `_authed/destinations/$id.attractions.tsx` | SSR/CSR | **API real** | Tab on detail page |
| 25 | `/destinations/:id/events` | `_authed/destinations/$id.events.tsx` | SSR/CSR | **API real** | Tab on detail page |

### 2.6 Content - Attractions

**Sidebar group:** "Atracciones"

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 26 | `/attractions` | Referenced in config (no explicit index) | SSR/CSR | **API real** | Sidebar "Listado" |
| 27 | `/attractions/new` | `_authed/attractions/new.tsx` | SSR/CSR | **API real** (create) | Sidebar "Crear Nueva" |
| 28 | `/attractions/:id` | `_authed/attractions/$id.tsx` | SSR/CSR + Lazy | **API real** | Row click in list |
| 29 | `/attractions/:id/edit` | `_authed/attractions/$id_.edit.tsx` | SSR/CSR | **API real** | Edit button |

### 2.7 Content - Events

**Sidebar group:** "Eventos"

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 30 | `/events` | `_authed/events/index.tsx` | SSR/CSR | **API real** | Sidebar "Listado" |
| 31 | `/events/new` | `_authed/events/new.tsx` | SSR/CSR | **API real** (create) | Sidebar "Crear Evento" |
| 32 | `/events/:id` | `_authed/events/$id.tsx` | SSR/CSR + Lazy | **API real** | Row click in list |
| 33 | `/events/:id/edit` | `_authed/events/$id_.edit.tsx` | SSR/CSR | **API real** | Edit button |
| 34 | `/events/:id/tickets` | `_authed/events/$id.tickets.tsx` | SSR/CSR | **API real** | Tab on detail page |
| 35 | `/events/:id/attendees` | `_authed/events/$id.attendees.tsx` | SSR/CSR | **API real** | Tab on detail page |

#### Sub-entity: Event Locations

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 36 | `/events/locations` | `_authed/events/locations.tsx` | SSR/CSR | **API real** | Sidebar "Ubicaciones" |
| 37 | `/events/locations/new` | `_authed/events/locations.new.tsx` | SSR/CSR | **API real** (create) | Action button |
| 38 | `/events/locations/:id` | `_authed/events/locations.$id.tsx` | SSR/CSR | **API real** | Row click in list |
| 39 | `/events/locations/:id/edit` | `_authed/events/locations.$id_.edit.tsx` | SSR/CSR | **API real** | Edit button |

#### Sub-entity: Event Organizers

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 40 | `/events/organizers` | `_authed/events/organizers.tsx` | SSR/CSR | **API real** | Sidebar "Organizadores" |
| 41 | `/events/organizers/new` | `_authed/events/organizers.new.tsx` | SSR/CSR | **API real** (create) | Action button |
| 42 | `/events/organizers/:id` | `_authed/events/organizers.$id.tsx` | SSR/CSR | **API real** | Row click in list |
| 43 | `/events/organizers/:id/edit` | `_authed/events/organizers.$id_.edit.tsx` | SSR/CSR | **API real** | Edit button |

### 2.8 Content - Blog (Posts)

**Sidebar group:** "Blog" (separator above)

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 44 | `/posts` | `_authed/posts/index.tsx` | SSR/CSR | **API real** | Sidebar "Publicaciones" |
| 45 | `/posts/new` | `_authed/posts/new.tsx` | SSR/CSR | **API real** (create) | Sidebar "Nueva Publicacion" |
| 46 | `/posts/:id` | `_authed/posts/$id.tsx` | SSR/CSR + Lazy | **API real** | Row click in list |
| 47 | `/posts/:id/edit` | `_authed/posts/$id_.edit.tsx` | SSR/CSR | **API real** | Edit button |
| 48 | `/posts/:id/seo` | `_authed/posts/$id.seo.tsx` | SSR/CSR | **API real** | Tab on detail page |
| 49 | `/posts/:id/sponsorship` | `_authed/posts/$id.sponsorship.tsx` | SSR/CSR | **API real** | Tab on detail page |

### 2.9 Billing Section

**Header:** "Facturacion" | **Default:** `/billing/plans`

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 50 | `/billing/plans` | `_authed/billing/plans.tsx` | SSR/CSR | **API real** (QZPay) | Sidebar "Planes" |
| 51 | `/billing/subscriptions` | `_authed/billing/subscriptions.tsx` | SSR/CSR | **API real** | Sidebar "Suscripciones" |
| 52 | `/billing/addons` | `_authed/billing/addons.tsx` | SSR/CSR | **API real** (QZPay) | Sidebar "Add-ons" |
| 53 | `/billing/payments` | `_authed/billing/payments.tsx` | SSR/CSR | **API real** | Sidebar "Pagos" |
| 54 | `/billing/invoices` | `_authed/billing/invoices.tsx` | SSR/CSR | **API real** | Sidebar "Facturas" |
| 55 | `/billing/promo-codes` | `_authed/billing/promo-codes.tsx` | SSR/CSR | **API real** | Sidebar "Codigos Promocionales" |
| 56 | `/billing/sponsorships` | `_authed/billing/sponsorships.tsx` | SSR/CSR | **API real** | Sidebar "Patrocinios" |
| 57 | `/billing/owner-promotions` | `_authed/billing/owner-promotions.tsx` | SSR/CSR | **API real** | Sidebar "Promociones de Propietarios" |
| 58 | `/billing/exchange-rates` | `_authed/billing/exchange-rates.tsx` | SSR/CSR | **API real** | Sidebar "Tasas de Cambio" |
| 59 | `/billing/metrics` | `_authed/billing/metrics.tsx` | SSR/CSR | **API real** | Sidebar "Metricas" |
| 60 | `/billing/settings` | `_authed/billing/settings.tsx` | SSR/CSR | **API real** | Sidebar "Configuracion" |
| 61 | `/billing/cron` | `_authed/billing/cron.tsx` | SSR/CSR | **API real** | Sidebar "Tareas Programadas" |
| 62 | `/billing/notification-logs` | `_authed/billing/notification-logs.tsx` | SSR/CSR | **API real** | Internal admin |
| 63 | `/billing/webhook-events` | `_authed/billing/webhook-events.tsx` | SSR/CSR | **API real** | Internal admin |

### 2.10 Administration - Access Control

**Header:** "Administracion" | **Default:** `/access/users` | **Sidebar group:** "Control de Acceso" (expanded by default)

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 64 | `/access/users` | `_authed/access/users/index.tsx` | SSR/CSR | **API real** (requires PermissionEnum) | Sidebar "Usuarios" |
| 65 | `/access/users/new` | `_authed/access/users/new.tsx` | SSR/CSR | **API real** (create) | Action button |
| 66 | `/access/users/:id` | `_authed/access/users/$id.tsx` | SSR/CSR | **API real** | Row click in list |
| 67 | `/access/users/:id/edit` | `_authed/access/users/$id_.edit.tsx` | SSR/CSR | **API real** | Edit button |
| 68 | `/access/users/:id/permissions` | `_authed/access/users/$id.permissions.tsx` | SSR/CSR | **API real** | Tab on detail page |
| 69 | `/access/users/:id/activity` | `_authed/access/users/$id.activity.tsx` | SSR/CSR | **API real** | Tab on detail page |
| 70 | `/access/roles` | `_authed/access/roles.tsx` | SSR/CSR | **API real** | Sidebar "Roles" |
| 71 | `/access/permissions` | `_authed/access/permissions.tsx` | SSR/CSR | **API real** | Sidebar "Permisos" |

### 2.11 Administration - Catalogs

**Sidebar group:** "Catalogos"

#### Accommodation Amenities

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 72 | `/content/accommodation-amenities` | `_authed/content/accommodation-amenities/index.tsx` | SSR/CSR | **API real** | Sidebar "Amenidades" |
| 73 | `/content/accommodation-amenities/new` | `_authed/content/accommodation-amenities/new.tsx` | SSR/CSR | **API real** (create) | Action button |
| 74 | `/content/accommodation-amenities/:id` | `_authed/content/accommodation-amenities/$id.tsx` | SSR/CSR | **API real** | Row click in list |
| 75 | `/content/accommodation-amenities/:id/edit` | `_authed/content/accommodation-amenities/$id_.edit.tsx` | SSR/CSR | **API real** | Edit button |

#### Accommodation Features

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 76 | `/content/accommodation-features` | `_authed/content/accommodation-features/index.tsx` | SSR/CSR | **API real** | Sidebar "Caracteristicas" |
| 77 | `/content/accommodation-features/new` | `_authed/content/accommodation-features/new.tsx` | SSR/CSR | **API real** (create) | Action button |
| 78 | `/content/accommodation-features/:id` | `_authed/content/accommodation-features/$id.tsx` | SSR/CSR | **API real** | Row click in list |
| 79 | `/content/accommodation-features/:id/edit` | `_authed/content/accommodation-features/$id_.edit.tsx` | SSR/CSR | **API real** | Edit button |

#### Destination Attractions

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 80 | `/content/destination-attractions` | `_authed/content/destination-attractions/index.tsx` | SSR/CSR | **API real** | Sidebar "Atracciones de Destino" |

#### Tags

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 81 | `/settings/tags` | `_authed/settings/tags.tsx` | SSR/CSR | **API real** | Sidebar "Etiquetas" |
| 82 | `/settings/tags/new` | `_authed/settings/tags.new.tsx` | SSR/CSR | **API real** (create) | Action button |
| 83 | `/settings/tags/:id` | `_authed/settings/tags.$id.tsx` | SSR/CSR | **API real** | Row click in list |
| 84 | `/settings/tags/:id/edit` | `_authed/settings/tags.$id_.edit.tsx` | SSR/CSR | **API real** | Edit button |

### 2.12 Administration - Settings

**Sidebar group:** "Configuracion"

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 85 | `/settings/seo` | `_authed/settings/seo.tsx` | SSR/CSR | **API real** | Sidebar "SEO" |
| 86 | `/settings/critical` | `_authed/settings/critical.tsx` | SSR/CSR | **API real** | Sidebar "Configuracion Critica" |

### 2.13 Sponsors

#### Admin-managed sponsors

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 87 | `/sponsors` | `_authed/sponsors.tsx` | SSR/CSR | **API real** | Sidebar "Patrocinadores" |
| 88 | `/sponsors/new` | `_authed/sponsors.new.tsx` | SSR/CSR | **API real** (create) | Action button |
| 89 | `/sponsors/:id` | `_authed/sponsors.$id.tsx` | SSR/CSR | **API real** | Row click in list |
| 90 | `/sponsors/:id/edit` | `_authed/sponsors.$id_.edit.tsx` | SSR/CSR | **API real** | Edit button |

#### Sponsor self-service dashboard

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 91 | `/sponsor` | `_authed/sponsor/index.tsx` | SSR/CSR | **API real** | Sidebar (sponsor view) |
| 92 | `/sponsor/analytics` | `_authed/sponsor/analytics.tsx` | SSR/CSR | **API real** | Sidebar "Analiticas" |
| 93 | `/sponsor/invoices` | `_authed/sponsor/invoices.tsx` | SSR/CSR | **API real** | Sidebar "Facturas" |
| 94 | `/sponsor/sponsorships` | `_authed/sponsor/sponsorships.tsx` | SSR/CSR | **API real** | Sidebar "Patrocinios" |

### 2.14 Analytics

**Header:** "Analiticas" | **Default:** `/analytics/usage`

| # | Route | File | Render | Data | Navigation Source |
|---|-------|------|--------|------|-------------------|
| 95 | `/analytics/usage` | `_authed/analytics/usage.tsx` | SSR/CSR | **API real** | Sidebar "Uso" |
| 96 | `/analytics/business` | `_authed/analytics/business.tsx` | SSR/CSR | **API real** | Sidebar "Negocio" |
| 97 | `/analytics/debug` | `_authed/analytics/debug.tsx` | SSR/CSR | **API real** | Sidebar "Debug" (dev only) |

### 2.15 Admin App Stats

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total routes** | ~101 | 100% |
| **Public routes** | 5 | 5% |
| **Protected routes** | ~96 | 95% |
| **API real data** | ~93 | 92% |
| **Placeholder data** | ~3 | 3% |
| **Hardcoded data** | ~5 | 5% |
| **SSR + CSR (all)** | ~101 | 100% |
| **With lazy loading** | ~6 | 6% |

---

## 3. Comparative Summary

| Metric | Web App | Admin App |
|--------|---------|-----------|
| **Total routes** | 35 | ~101 |
| **Total unique URLs** | ~105 (x3 locales) | ~101 |
| **Public** | 29 (83%) | 5 (5%) |
| **Protected** | 6 (17%) | ~96 (95%) |
| **SSG** | 26 (74%) | 0 (0%) |
| **SSR** | 9 (26%) | ~101 (100%) |
| **API real data** | 10 (29%) | ~93 (92%) |
| **Hardcoded data** | 24 (69%) | ~5 (5%) |
| **i18n support** | Yes (3 locales) | No |
| **Auth method** | Per-page `Astro.locals.user` check | Layout-level `beforeLoad` guard |
| **Framework** | Astro + React islands | TanStack Start (full React) |
| **Code splitting** | Astro automatic | Manual `.lazy.tsx` files |

---

## 4. Critical Findings

### 4.1 Web App Issues

1. **69% of routes have hardcoded data** .. the entire `/mi-cuenta/` section (6 routes) is placeholder with no API integration
2. **Duplicate blog routes:** both `/publicaciones/` and `/blog/` exist (possible unnecessary alias)
3. **No global middleware** .. auth protection is done per-page with individual `Astro.locals.user` checks (risk of inconsistency)
4. **Server Islands** used only on homepage for featured sections
5. **Static pages** (benefits, contact, about, terms, privacy, pricing) have no CMS integration .. content changes require code deploys
6. **Favorites and reviews** pages are completely empty placeholders

### 4.2 Admin App Issues

1. **Notifications page** is placeholder ("No new notifications")
2. **Dashboard** has placeholder sections for traffic chart and recent activity
3. **Attractions index** route referenced in config but no explicit index file found
4. **No i18n** .. admin is Spanish-only (acceptable for Argentina market)

### 4.3 Data Integration Gap

The admin app is **significantly more mature** in API integration (~92% real data) compared to the web app (~29% real data). This is the **primary gap** to address:

**Web routes needing API integration:**

- `/mi-cuenta/` (dashboard) .. needs user data from API
- `/mi-cuenta/editar/` .. needs user profile update API
- `/mi-cuenta/favoritos/` .. needs favorites API
- `/mi-cuenta/preferencias/` .. needs preferences API
- `/mi-cuenta/resenas/` .. needs reviews API
- `/mi-cuenta/suscripcion/` .. needs billing/subscription API
- `/beneficios/` .. could be CMS-driven
- `/contacto/` .. form submission needs API endpoint
- `/quienes-somos/` .. could be CMS-driven
- `/precios/turistas/` .. should fetch from billing plans API
- `/precios/propietarios/` .. should fetch from billing plans API

### 4.4 Navigation Map

**Web App navigation sources:**

- **Header:** Home, Alojamientos, Destinos, Eventos, Publicaciones, AuthSection
- **Footer:** Explorar (4 links), Informacion (3 links), Legal (3 links), Social media
- **SearchBar:** Links to `/busqueda/`
- **CTA buttons:** Link to `/precios/`
- **Account sidebar:** 5 mi-cuenta sub-pages (only visible when authenticated)

**Admin App navigation sources:**

- **Header:** 5 main sections (Dashboard, Contenido, Facturacion, Administracion, Analiticas)
- **Sidebar:** Context-aware, changes based on active header section
- **Detail page tabs:** Entity-specific tabs (amenities, gallery, pricing, etc.)
- **Action buttons:** "Crear Nuevo" on list pages
- **Row clicks:** Navigate to entity detail from lists
