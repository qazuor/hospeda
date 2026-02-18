# Admin App (TanStack Start) - Route Audit

> **Date:** 2026-02-16
> **App:** `apps/admin` (port 3000)
> **Framework:** TanStack Start (full-stack React 19)
> **Rendering:** SSR with client-side hydration (all routes)
> **Auth:** Better Auth via `fetchAuthSession()` in `beforeLoad` guard on `_authed` layout
> **Code splitting:** Heavy pages use `.lazy.tsx` pattern
> **i18n:** No (Spanish-only UI)
> **Navigation:** Header (5 sections) + contextual Sidebar + Tabs on detail pages
> **Total route files:** 98 (excluding layouts and .lazy.tsx)
> **Layout files:** `__root.tsx`, `auth.tsx`, `_authed.tsx`

---

| # | URL | File | Auth | Data Source | Navigation Source |
|---|-----|------|------|-------------|-------------------|
| 1 | `/` | `routes/index.tsx` | No | No data .. redirects to `/dashboard` (authenticated) or `/auth/signin` (not authenticated) via `fetchAuthSession()` | Entry point |
| 2 | `/auth/signin` | `routes/auth/signin.tsx` | No (redirects to `/` if authenticated) | **Better Auth** .. `signIn.email()` mutation, `useAuthSync()` hook, `getRandomAuthImage()` for background | Header profile menu, redirect from protected pages |
| 3 | `/auth/signup` | `routes/auth/signup.tsx` | No (redirects to `/` if authenticated) | **Better Auth** .. `signUp.email()` mutation, `useAuthSync()` hook | Link from signin page |
| 4 | `/auth/callback` | `routes/auth/callback.tsx` | No | **Better Auth** .. `useSession()` hook checks auth status, redirects to `/dashboard` or `/auth/signin` | OAuth provider redirect |
| 5 | `/auth` | `routes/auth/index.tsx` | No | No data .. redirects to `/auth/signin` | Direct navigation |
| 6 | `/dev/icon-comparison` | `routes/dev/icon-comparison.tsx` | No | Hardcoded .. `ICON_CATEGORIES` array (143 icons in 13 categories), static comparison of current SVGs vs Phosphor replacements | Dev tools (not in production nav) |
| 7 | `/dashboard` | `routes/_authed/dashboard.tsx` + `dashboard.lazy.tsx` | **Yes** | **TanStack Query** .. `useDashboardStats()` fetches accommodation/destination/event/post counts. KPI card config is hardcoded. Traffic chart and recent activity sections are **placeholder** ("Coming soon"). | Header logo, Sidebar "Resumen" |
| 8 | `/notifications` | `routes/_authed/notifications.tsx` | **Yes** | **localStorage** .. reads from key `hospeda-admin-notifications`, manages in-memory state with `useState`. **Placeholder** content ("No new notifications"). | Sidebar link, Header bell icon |
| 9 | `/me/profile` | `routes/_authed/me/profile.tsx` | **Yes** | **Better Auth** .. `useSession()` hook for user data, profile update mutation | Header user icon, Sidebar "Mi Perfil" |
| 10 | `/me/settings` | `routes/_authed/me/settings.tsx` | **Yes** | **TanStack Query** .. user settings query + update mutation | Header settings icon, Sidebar "Configuracion" |
| 11 | `/me/accommodations` | `routes/_authed/me/accommodations/index.tsx` | **Yes** | **TanStack Query** .. current user's accommodations list | Sidebar "Mis Alojamientos" |
| 12 | `/accommodations` | `routes/_authed/accommodations/index.tsx` | **Yes** | **Feature config** .. imports `AccommodationsRoute` + `AccommodationsPageComponent` from `@/features/accommodations/config`, which uses `useAccommodationsQuery()` (TanStack Query + TanStack Table) | Sidebar "Listado" under Alojamientos |
| 13 | `/accommodations/new` | `routes/_authed/accommodations/new.tsx` | **Yes** | **TanStack Query** .. `useCreateAccommodationMutation()`, smart entity form system with sections. Wrapped by `LimitGate` (billing limits check). | Sidebar "Crear Nuevo", list page action button |
| 14 | `/accommodations/:id` | `routes/_authed/accommodations/$id.tsx` | **Yes** | **TanStack Query** .. loader passes `accommodationId`, `useAccommodationPage(id)` fetches entity data + section config | Row click in accommodations list |
| 15 | `/accommodations/:id/edit` | `routes/_authed/accommodations/$id_.edit.tsx` | **Yes** | **TanStack Query** .. edit form with update mutation, loads current entity data | Edit button on detail page |
| 16 | `/accommodations/:id/amenities` | `routes/_authed/accommodations/$id.amenities.tsx` | **Yes** | **TanStack Query** .. accommodation amenities list + management | Tab on accommodation detail page |
| 17 | `/accommodations/:id/gallery` | `routes/_authed/accommodations/$id.gallery.tsx` | **Yes** | **TanStack Query** .. accommodation image gallery management | Tab on accommodation detail page |
| 18 | `/accommodations/:id/pricing` | `routes/_authed/accommodations/$id.pricing.tsx` | **Yes** | **TanStack Query** .. accommodation pricing tiers management | Tab on accommodation detail page |
| 19 | `/accommodations/:id/reviews` | `routes/_authed/accommodations/$id.reviews.tsx` | **Yes** | **TanStack Query** .. accommodation reviews list | Tab on accommodation detail page |
| 20 | `/destinations` | `routes/_authed/destinations/index.tsx` | **Yes** | **Feature config** .. imports `DestinationsRoute` + `DestinationsPageComponent` from feature config (TanStack Query + TanStack Table) | Sidebar "Listado" under Destinos |
| 21 | `/destinations/new` | `routes/_authed/destinations/new.tsx` | **Yes** | **TanStack Query** .. `useCreateDestinationMutation()`, smart entity form with `LimitGate` | Sidebar "Crear Nuevo", list page action button |
| 22 | `/destinations/:id` | `routes/_authed/destinations/$id.tsx` | **Yes** | **TanStack Query** .. loader passes `destinationId`, `useDestinationPage(id)` fetches entity data | Row click in destinations list |
| 23 | `/destinations/:id/edit` | `routes/_authed/destinations/$id_.edit.tsx` | **Yes** | **TanStack Query** .. edit form with update mutation | Edit button on detail page |
| 24 | `/destinations/:id/accommodations` | `routes/_authed/destinations/$id.accommodations.tsx` | **Yes** | **TanStack Query** .. accommodations linked to this destination | Tab on destination detail page |
| 25 | `/destinations/:id/attractions` | `routes/_authed/destinations/$id.attractions.tsx` | **Yes** | **TanStack Query** .. attractions linked to this destination | Tab on destination detail page |
| 26 | `/destinations/:id/events` | `routes/_authed/destinations/$id.events.tsx` | **Yes** | **TanStack Query** .. events linked to this destination | Tab on destination detail page |
| 27 | `/attractions/new` | `routes/_authed/attractions/new.tsx` | **Yes** | **TanStack Query** .. `useCreateAttractionMutation()`, smart entity form with `LimitGate` | Sidebar "Crear Nueva", list page action button |
| 28 | `/attractions/:id` | `routes/_authed/attractions/$id.tsx` | **Yes** | **TanStack Query** .. loader passes `attractionId`, fetches entity data | Row click in attractions list |
| 29 | `/attractions/:id/edit` | `routes/_authed/attractions/$id_.edit.tsx` | **Yes** | **TanStack Query** .. edit form with update mutation | Edit button on detail page |
| 30 | `/events` | `routes/_authed/events/index.tsx` | **Yes** | **Feature config** .. imports `EventsRoute` + `EventsPageComponent` from feature config (TanStack Query + TanStack Table) | Sidebar "Listado" under Eventos |
| 31 | `/events/new` | `routes/_authed/events/new.tsx` | **Yes** | **TanStack Query** .. `useCreateEventMutation()`, smart entity form with `LimitGate` | Sidebar "Crear Evento", list page action button |
| 32 | `/events/:id` | `routes/_authed/events/$id.tsx` | **Yes** | **TanStack Query** .. loader passes `eventId`, `useEventPage(id)` fetches entity data | Row click in events list |
| 33 | `/events/:id/edit` | `routes/_authed/events/$id_.edit.tsx` | **Yes** | **TanStack Query** .. edit form with update mutation | Edit button on detail page |
| 34 | `/events/:id/tickets` | `routes/_authed/events/$id.tickets.tsx` | **Yes** | **TanStack Query** .. event ticket types management | Tab on event detail page |
| 35 | `/events/:id/attendees` | `routes/_authed/events/$id.attendees.tsx` | **Yes** | **TanStack Query** .. event attendees list | Tab on event detail page |
| 36 | `/events/locations` | `routes/_authed/events/locations.tsx` | **Yes** | **Feature config** .. imports `EventLocationsRoute` from feature config (TanStack Query + TanStack Table) | Sidebar "Ubicaciones" under Eventos |
| 37 | `/events/locations/new` | `routes/_authed/events/locations.new.tsx` | **Yes** | **TanStack Query** .. `useCreateEventLocationMutation()` | Action button on locations list |
| 38 | `/events/locations/:id` | `routes/_authed/events/locations.$id.tsx` | **Yes** | **TanStack Query** .. loader passes `eventLocationId`, fetches location data | Row click in locations list |
| 39 | `/events/locations/:id/edit` | `routes/_authed/events/locations.$id_.edit.tsx` | **Yes** | **TanStack Query** .. edit form with update mutation | Edit button on location detail |
| 40 | `/events/organizers` | `routes/_authed/events/organizers.tsx` | **Yes** | **Feature config** .. imports `EventOrganizersRoute` from feature config (TanStack Query + TanStack Table) | Sidebar "Organizadores" under Eventos |
| 41 | `/events/organizers/new` | `routes/_authed/events/organizers.new.tsx` | **Yes** | **TanStack Query** .. `useCreateEventOrganizerMutation()` | Action button on organizers list |
| 42 | `/events/organizers/:id` | `routes/_authed/events/organizers.$id.tsx` | **Yes** | **TanStack Query** .. loader passes `eventOrganizerId`, fetches organizer data | Row click in organizers list |
| 43 | `/events/organizers/:id/edit` | `routes/_authed/events/organizers.$id_.edit.tsx` | **Yes** | **TanStack Query** .. edit form with update mutation | Edit button on organizer detail |
| 44 | `/posts` | `routes/_authed/posts/index.tsx` | **Yes** | **Feature config** .. imports `PostsRoute` + `PostsPageComponent` from feature config (TanStack Query + TanStack Table) | Sidebar "Publicaciones" under Blog |
| 45 | `/posts/new` | `routes/_authed/posts/new.tsx` | **Yes** | **TanStack Query** .. `useCreatePostMutation()`, smart entity form with `LimitGate` | Sidebar "Nueva Publicacion", list page action button |
| 46 | `/posts/:id` | `routes/_authed/posts/$id.tsx` | **Yes** | **TanStack Query** .. loader passes `postId`, `usePostPage(id)` fetches entity data | Row click in posts list |
| 47 | `/posts/:id/edit` | `routes/_authed/posts/$id_.edit.tsx` | **Yes** | **TanStack Query** .. edit form with update mutation | Edit button on detail page |
| 48 | `/posts/:id/seo` | `routes/_authed/posts/$id.seo.tsx` | **Yes** | **TanStack Query** .. post SEO metadata management | Tab on post detail page |
| 49 | `/posts/:id/sponsorship` | `routes/_authed/posts/$id.sponsorship.tsx` | **Yes** | **TanStack Query** .. post sponsorship details management | Tab on post detail page |
| 50 | `/billing/plans` | `routes/_authed/billing/plans.tsx` | **Yes** | **TanStack Query** .. `usePlansQuery()`, `useCreatePlanMutation()`, `useDeletePlanMutation()`, `useTogglePlanActiveMutation()`, `useUpdatePlanMutation()`. Fallback to `ALL_PLANS` from `@repo/billing` as static data. | Sidebar "Planes" under Facturacion |
| 51 | `/billing/subscriptions` | `routes/_authed/billing/subscriptions.tsx` | **Yes** | **TanStack Query** .. subscriptions list query | Sidebar "Suscripciones" under Facturacion |
| 52 | `/billing/addons` | `routes/_authed/billing/addons.tsx` | **Yes** | **TanStack Query** .. addons CRUD queries/mutations, fallback to static config from `@repo/billing` | Sidebar "Add-ons" under Facturacion |
| 53 | `/billing/payments` | `routes/_authed/billing/payments.tsx` | **Yes** | **TanStack Query** .. payment transactions list query | Sidebar "Pagos" under Facturacion |
| 54 | `/billing/invoices` | `routes/_authed/billing/invoices.tsx` | **Yes** | **TanStack Query** .. invoices list query | Sidebar "Facturas" under Facturacion |
| 55 | `/billing/promo-codes` | `routes/_authed/billing/promo-codes.tsx` | **Yes** | **TanStack Query** .. promotional codes CRUD queries/mutations | Sidebar "Codigos Promocionales" under Facturacion |
| 56 | `/billing/sponsorships` | `routes/_authed/billing/sponsorships.tsx` | **Yes** | **TanStack Query** .. sponsorships list query | Sidebar "Patrocinios" under Facturacion |
| 57 | `/billing/owner-promotions` | `routes/_authed/billing/owner-promotions.tsx` | **Yes** | **TanStack Query** .. owner promotions CRUD queries/mutations. Hardcoded Spanish UI strings (~60). | Sidebar "Promociones de Propietarios" under Facturacion |
| 58 | `/billing/exchange-rates` | `routes/_authed/billing/exchange-rates.tsx` | **Yes** | **TanStack Query** .. exchange rates CRUD queries/mutations | Sidebar "Tasas de Cambio" under Facturacion |
| 59 | `/billing/metrics` | `routes/_authed/billing/metrics.tsx` | **Yes** | **TanStack Query** .. billing metrics/KPI queries. Hardcoded Spanish UI strings (~40). | Sidebar "Metricas" under Facturacion |
| 60 | `/billing/settings` | `routes/_authed/billing/settings.tsx` | **Yes** | **TanStack Query** .. billing settings query + update mutation | Sidebar "Configuracion" under Facturacion |
| 61 | `/billing/cron` | `routes/_authed/billing/cron.tsx` | **Yes** | Hardcoded .. developer tool displaying scheduled cron job config | Sidebar "Tareas Programadas" (dev section) |
| 62 | `/billing/webhook-events` | `routes/_authed/billing/webhook-events.tsx` | **Yes** | **TanStack Query** .. webhook events list query | Sidebar (internal admin) |
| 63 | `/billing/notification-logs` | `routes/_authed/billing/notification-logs.tsx` | **Yes** | **TanStack Query** .. notification logs list query | Sidebar (internal admin) |
| 64 | `/access/users` | `routes/_authed/access/users/index.tsx` | **Yes** | **Feature config** .. imports `UsersRoute` + `UsersPageComponent` from feature config (TanStack Query + TanStack Table). Requires `PermissionEnum` check. | Sidebar "Usuarios" under Control de Acceso |
| 65 | `/access/users/new` | `routes/_authed/access/users/new.tsx` | **Yes** | **TanStack Query** .. `useCreateUserMutation()` | Action button on users list |
| 66 | `/access/users/:id` | `routes/_authed/access/users/$id.tsx` | **Yes** | **TanStack Query** .. loader passes `userId`, `useUserPage(id)` fetches entity data | Row click in users list |
| 67 | `/access/users/:id/edit` | `routes/_authed/access/users/$id_.edit.tsx` | **Yes** | **TanStack Query** .. edit form with update mutation | Edit button on user detail |
| 68 | `/access/users/:id/permissions` | `routes/_authed/access/users/$id.permissions.tsx` | **Yes** | **TanStack Query** .. user permissions management | Tab on user detail page |
| 69 | `/access/users/:id/activity` | `routes/_authed/access/users/$id.activity.tsx` | **Yes** | **TanStack Query** .. user activity log | Tab on user detail page |
| 70 | `/access/roles` | `routes/_authed/access/roles.tsx` | **Yes** | **Feature config** .. imports `RolesRoute` from feature config (TanStack Query) | Sidebar "Roles" under Control de Acceso |
| 71 | `/access/permissions` | `routes/_authed/access/permissions.tsx` | **Yes** | **Feature config** .. imports `PermissionsRoute` from feature config (TanStack Query) | Sidebar "Permisos" under Control de Acceso |
| 72 | `/content/accommodation-amenities` | `routes/_authed/content/accommodation-amenities/index.tsx` | **Yes** | **Feature config** .. imports from feature config (TanStack Query + TanStack Table) | Sidebar "Amenidades" under Catalogos |
| 73 | `/content/accommodation-amenities/new` | `routes/_authed/content/accommodation-amenities/new.tsx` | **Yes** | **TanStack Query** .. `useCreateAccommodationAmenityMutation()` | Action button on amenities list |
| 74 | `/content/accommodation-amenities/:id` | `routes/_authed/content/accommodation-amenities/$id.tsx` | **Yes** | **TanStack Query** .. loader passes amenity ID, fetches entity data | Row click in amenities list |
| 75 | `/content/accommodation-amenities/:id/edit` | `routes/_authed/content/accommodation-amenities/$id_.edit.tsx` | **Yes** | **TanStack Query** .. edit form with update mutation | Edit button on amenity detail |
| 76 | `/content/accommodation-features` | `routes/_authed/content/accommodation-features/index.tsx` | **Yes** | **Feature config** .. imports from feature config (TanStack Query + TanStack Table) | Sidebar "Caracteristicas" under Catalogos |
| 77 | `/content/accommodation-features/new` | `routes/_authed/content/accommodation-features/new.tsx` | **Yes** | **TanStack Query** .. `useCreateAccommodationFeatureMutation()` | Action button on features list |
| 78 | `/content/accommodation-features/:id` | `routes/_authed/content/accommodation-features/$id.tsx` | **Yes** | **TanStack Query** .. loader passes feature ID, fetches entity data | Row click in features list |
| 79 | `/content/accommodation-features/:id/edit` | `routes/_authed/content/accommodation-features/$id_.edit.tsx` | **Yes** | **TanStack Query** .. edit form with update mutation | Edit button on feature detail |
| 80 | `/content/destination-attractions` | `routes/_authed/content/destination-attractions/index.tsx` | **Yes** | **Feature config** .. imports from feature config (TanStack Query + TanStack Table) | Sidebar "Atracciones de Destino" under Catalogos |
| 81 | `/settings/tags` | `routes/_authed/settings/tags.tsx` | **Yes** | **Feature config** .. imports `TagsRoute` from feature config (TanStack Query + TanStack Table) | Sidebar "Etiquetas" under Catalogos |
| 82 | `/settings/tags/new` | `routes/_authed/settings/tags.new.tsx` | **Yes** | **TanStack Query** .. `useCreateTagMutation()` | Action button on tags list |
| 83 | `/settings/tags/:id` | `routes/_authed/settings/tags.$id.tsx` | **Yes** | **TanStack Query** .. loader passes tag ID, fetches entity data | Row click in tags list |
| 84 | `/settings/tags/:id/edit` | `routes/_authed/settings/tags.$id_.edit.tsx` | **Yes** | **TanStack Query** .. edit form with update mutation | Edit button on tag detail |
| 85 | `/settings/seo` | `routes/_authed/settings/seo.tsx` | **Yes** | **TanStack Query** .. site SEO configuration query + mutation | Sidebar "SEO" under Configuracion |
| 86 | `/settings/critical` | `routes/_authed/settings/critical.tsx` | **Yes** | **TanStack Query** .. critical system settings query + mutation | Sidebar "Configuracion Critica" under Configuracion |
| 87 | `/sponsors` | `routes/_authed/sponsors.tsx` | **Yes** | **Feature config** .. imports `SponsorsRoute` from feature config (TanStack Query + TanStack Table) | Sidebar "Patrocinadores" |
| 88 | `/sponsors/new` | `routes/_authed/sponsors.new.tsx` | **Yes** | **TanStack Query** .. `useCreateSponsorMutation()` | Action button on sponsors list |
| 89 | `/sponsors/:id` | `routes/_authed/sponsors.$id.tsx` | **Yes** | **TanStack Query** .. loader passes sponsor ID, fetches entity data | Row click in sponsors list |
| 90 | `/sponsors/:id/edit` | `routes/_authed/sponsors.$id_.edit.tsx` | **Yes** | **TanStack Query** .. edit form with update mutation | Edit button on sponsor detail |
| 91 | `/sponsor` | `routes/_authed/sponsor/index.tsx` | **Yes** | **TanStack Query** .. sponsor dashboard landing page data | Sidebar (sponsor role view) |
| 92 | `/sponsor/analytics` | `routes/_authed/sponsor/analytics.tsx` | **Yes** | **TanStack Query** .. sponsor analytics data | Sidebar "Analiticas" (sponsor view) |
| 93 | `/sponsor/invoices` | `routes/_authed/sponsor/invoices.tsx` | **Yes** | **TanStack Query** .. sponsor invoices list | Sidebar "Facturas" (sponsor view) |
| 94 | `/sponsor/sponsorships` | `routes/_authed/sponsor/sponsorships.tsx` | **Yes** | **TanStack Query** .. sponsor sponsorships list | Sidebar "Patrocinios" (sponsor view) |
| 95 | `/analytics/usage` | `routes/_authed/analytics/usage.tsx` | **Yes** | **TanStack Query** .. usage metrics data | Sidebar "Uso" under Analiticas |
| 96 | `/analytics/business` | `routes/_authed/analytics/business.tsx` | **Yes** | **TanStack Query** .. business analytics data | Sidebar "Negocio" under Analiticas |
| 97 | `/analytics/debug` | `routes/_authed/analytics/debug.tsx` | **Yes** | **TanStack Query** .. system debug info (development tool) | Sidebar "Debug" (dev section) |

---

## Summary

| Metric | Count | % |
|--------|-------|---|
| **Total URL patterns** | 97 | 100% |
| Public | 6 | 6% |
| **Auth required** | 91 | 94% |
| **TanStack Query (API real)** | 83 | 86% |
| **Feature config (delegates to TanStack Query)** | 10 | 10% |
| **Better Auth** | 3 | 3% |
| **Hardcoded / placeholder** | 3 | 3% |
| **localStorage** | 1 | 1% |

## Header Sections (Level 1 Navigation)

| Section | Icon | Default Route | Sidebar Content |
|---------|------|---------------|-----------------|
| Dashboard | DashboardIcon | `/dashboard` | Resumen, Notificaciones, Mi Perfil, Configuracion, Mis Alojamientos |
| Contenido | ContentIcon | `/accommodations` | Alojamientos (CRUD), Destinos (CRUD), Atracciones (CRUD), Eventos (CRUD + locations + organizers), Blog (CRUD + SEO + sponsorship) |
| Facturacion | CreditCardIcon | `/billing/plans` | Planes, Suscripciones, Add-ons, Pagos, Facturas, Codigos Promo, Patrocinios, Promociones, Tasas de Cambio, Metricas, Config, Cron, Webhooks, Notification Logs |
| Administracion | AdminIcon | `/access/users` | Control de Acceso (Users, Roles, Permissions), Catalogos (Amenities, Features, Attractions, Tags), Config (SEO, Critical), Patrocinadores |
| Analiticas | AnalyticsIcon | `/analytics/usage` | Uso, Negocio, Debug |

---

## Analysis: Missing Routes

| # | Missing Route | Severity | Reason |
|---|--------------|----------|--------|
| 1 | `/attractions` (index) | **High** | Sidebar under "Contenido" links to `/attractions` for the attractions list, but **no `attractions/index.tsx` exists**. The actual attraction list is at `/content/destination-attractions`. This is a navigation mismatch .. the sidebar link would 404 or show a blank page. Either add the index route or fix the sidebar link. |
| 2 | `/content/destination-attractions/new` | **High** | Destination attractions has only a list page (`index.tsx`). There is no `new.tsx`, `$id.tsx`, or `$id_.edit.tsx`. This means attractions can be listed but **not created, viewed, or edited** from the admin UI. Incomplete CRUD. |
| 3 | `/content/destination-attractions/:id` | **High** | Same as above .. no detail view for destination attractions. |
| 4 | `/content/destination-attractions/:id/edit` | **High** | Same as above .. no edit form for destination attractions. |
| 5 | `/billing/dashboard` | **Medium** | Billing has 14 sub-routes but no overview/dashboard page. A billing summary with KPIs (MRR, active subscriptions, churn rate) would reduce context switching between metrics, payments, and subscriptions pages. |
| 6 | `/access/audit-log` | **Medium** | User activity page (`/access/users/:id/activity`) references an "audit log system" as "coming soon". A centralized audit log page under Access would be the natural home for cross-user activity tracking. |
| 7 | `/settings/general` | **Low** | Settings section has tags, SEO, and critical .. but no general/site settings page for things like site name, logo, timezone, default language. These may live elsewhere but are expected under settings. |
| 8 | `/me/notifications-settings` | **Low** | Notifications are localStorage-only. When notifications get API backing, a notification preferences page (email frequency, push categories, etc.) would be expected. |

---

## Analysis: Placeholder & Stub Pages

These routes exist but have incomplete or placeholder functionality:

| # | Route | Status | What Works | What's Placeholder |
|---|-------|--------|------------|-------------------|
| 1 | `/dashboard` | **Partial** | KPI cards use `useDashboardStats()` with real API data (accommodation/destination/event/post counts). KPI card config is hardcoded in component. | Traffic chart section shows "Connect analytics provider" placeholder. Recent activity feed shows "available once audit log system is implemented". |
| 2 | `/notifications` | **Placeholder** | Renders notification list UI with mark-read/delete actions. | Uses `localStorage` key `hospeda-admin-notifications` only. No API integration. Content is always empty ("No new notifications") unless manually seeded in localStorage. |
| 3 | `/events/:id/attendees` | **Stub** | Shows event capacity from `useEventQuery(id)`. | Full "Coming Soon" page with feature wishlist (attendee registration, check-in, export). No attendee data or CRUD. |
| 4 | `/events/:id/tickets` | **Partial** | Shows event pricing info (free/paid, price, currency) and capacity from real event data via `useEventQuery(id)`. | Ticket type management CRUD is "Coming Soon". Cannot create/edit/delete ticket types. |
| 5 | `/access/users/:id/activity` | **Partial** | Shows `createdAt` and `updatedAt` from real user data via `useUserQuery(id)`. | Activity history section is "Coming Soon" placeholder. Depends on audit log system that doesn't exist yet. |
| 6 | `/dev/icon-comparison` | **Dev tool** | Fully functional icon comparison grid (143 icons, 13 categories). | Not a placeholder, but a **dev-only tool** that is accessible without authentication in production. |
| 7 | `/analytics/debug` | **Dev tool** | Real API calls to `/api/v1/health` and `/api/v1/health/db` via TanStack Query. Reset metrics mutation works. | Functional but is a **dev/debug tool** that should be restricted in production. |
| 8 | `/billing/cron` | **Dev tool** | Uses `CronJobsPanel` feature component with `useTranslations()` for i18n. Shows cron job configuration. | Informational panel about scheduled tasks. Developer-oriented tool .. should be restricted in production. |

---

## Analysis: Code Splitting Recommendations

Currently, only `/dashboard` uses the `.lazy.tsx` pattern for code splitting. Other heavy pages would benefit:

| # | Route | Reason | Priority |
|---|-------|--------|----------|
| 1 | `/billing/*` (14 routes) | Billing section has heavy UI (charts, tables, forms, CRUD panels) and is only accessed by admins/finance. Lazy loading the entire billing section would reduce initial bundle. | **High** |
| 2 | `/access/users/:id/permissions` | Permissions management UI is complex (permission tree, role assignment). Not loaded frequently. | **Medium** |
| 3 | `/settings/critical` | Critical settings page likely has dangerous operations (reset, purge). Rarely accessed. | **Medium** |
| 4 | `/analytics/*` (3 routes) | Analytics pages likely have chart libraries. Lazy loading avoids bundling chart deps for non-analytics users. | **Medium** |
| 5 | `/sponsor/*` (4 routes) | Sponsor section is only for sponsor-role users. No need to include in main bundle. | **Low** |

---

## Analysis: Permission & Auth Gaps

| # | Issue | Routes Affected | Severity |
|---|-------|----------------|----------|
| 1 | **Hardcoded permission arrays** | All `/*/new` routes (accommodations, destinations, attractions, events, posts, sponsors, tags, amenities, features, event-locations, event-organizers, users) | **High** .. Every create route has `PermissionEnum` arrays hardcoded directly in the component with comments like "hardcoded for now". These should come from the auth session or a permissions service. If permissions change, every create route must be manually updated. |
| 2 | **No route-level permission checks** | Most detail/edit routes | **Medium** .. The `_authed` layout only checks if the user IS authenticated, but does not check if the user HAS permissions for the specific section. A user with only "view accommodations" permission can navigate to `/billing/settings` or `/settings/critical`. Permission checks happen at the API level, but the UI still renders the page and shows an error. |
| 3 | **Dev tools accessible without production gating** | `/dev/icon-comparison`, `/analytics/debug`, `/billing/cron` | **Medium** .. These routes are dev/debug tools. `/dev/icon-comparison` has no auth at all (not under `_authed`). The other two require auth but no specific permission. In production, these should be hidden or restricted to super-admin. |
| 4 | **LimitGate wraps create forms but not edit forms** | All `/*/edit` routes | **Low** .. `LimitGate` (billing plan limits) is used on create routes but not on edit routes. If a user exceeds their plan limit, they can still edit existing entities. This may be intentional (allow editing but not creating) but should be explicit. |

---

## Analysis: i18n Gaps

The admin app is documented as "Spanish-only UI" but uses `useTranslations()` from `@repo/i18n` in some areas. The i18n coverage is inconsistent:

| # | Area | Status | Estimated Hardcoded Strings |
|---|------|--------|-----------------------------|
| 1 | `/billing/promo-codes` | **No i18n** | ~90+ hardcoded Spanish strings (table headers, form labels, validation messages, status badges, action buttons) |
| 2 | `/billing/settings` | **No i18n** | ~70+ hardcoded Spanish strings |
| 3 | `/billing/owner-promotions` | **No i18n** | ~60 hardcoded Spanish strings |
| 4 | `/billing/addons` | **No i18n** | ~50+ hardcoded Spanish strings |
| 5 | `/billing/metrics` | **No i18n** | ~40+ hardcoded Spanish strings |
| 6 | `/billing/plans` | **No i18n** | ~30+ hardcoded Spanish strings |
| 7 | `/billing/cron` | **Has i18n** | Uses `useTranslations()` .. properly internationalized |
| 8 | Entity pages (accommodations, destinations, events, posts) | **Has i18n** | Use feature config system which includes i18n via `useTranslations()` |
| 9 | Layout, sidebar, header | **Has i18n** | Uses `useTranslations()` for navigation labels |

**Summary:** Most billing routes (~6 of 14) have significant i18n gaps with hardcoded Spanish text. The rest of the app (entity CRUD, navigation, layouts) properly uses `useTranslations()`. If the admin will remain Spanish-only, this is cosmetic. If multilingual support is planned, billing is the biggest gap.

---

## Analysis: Data Source Recommendations

| # | Route | Current Source | Recommendation | Priority |
|---|-------|---------------|----------------|----------|
| 1 | `/notifications` | localStorage | Migrate to API-backed notifications (WebSocket or polling). localStorage notifications are not persistent across devices and cannot be triggered by server events (new booking, review, etc.). | **High** |
| 2 | `/dashboard` traffic chart | Placeholder | Integrate with analytics provider (Plausible, PostHog, or custom). This is the main landing page .. empty charts reduce confidence in the tool. | **High** |
| 3 | `/dashboard` activity feed | Placeholder | Depends on audit log system. Implement audit log service first, then feed recent events here. | **Medium** |
| 4 | `/events/:id/attendees` | Stub | Implement attendees API (registration, check-in, export). Currently useless as a tab. Consider hiding the tab until implemented. | **Medium** |
| 5 | `/events/:id/tickets` ticket CRUD | Stub | Implement ticket types API. The page already shows event pricing data .. adding ticket management would complete the events workflow. | **Medium** |
| 6 | `/access/users/:id/activity` history | Stub | Depends on audit log system. Same dependency as dashboard activity feed. | **Low** |
| 7 | `/billing/plans` static fallback | `ALL_PLANS` from `@repo/billing` | The fallback to static plan data is fine for bootstrapping but should log a warning when API fails. Ensure the static data stays in sync with database plans. | **Low** |
| 8 | `/dev/icon-comparison` | Hardcoded `ICON_CATEGORIES` | Appropriate .. this is a dev tool. Should stay hardcoded. | N/A |
