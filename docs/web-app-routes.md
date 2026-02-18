# Web App (Astro) - Route Audit

> **Date:** 2026-02-16
> **App:** `apps/web` (port 4321)
> **Framework:** Astro 5 + React islands
> **Default output:** `server` (SSR), pages opt-in to SSG via `export const prerender = true`
> **Adapter:** `@astrojs/vercel` with `isr: true`
> **Trailing slash:** Always required
> **Locales:** `es` (default), `en`, `pt` .. all routes under `/[lang]/`
> **Auth method:** Per-page check of `Astro.locals.user`, redirect to `/${locale}/auth/signin`
> **Total page files:** 38
> **Total unique URL patterns:** 38 (x3 locales = ~114 URLs)

---

## Route Inventory

| # | URL | File | Render | Auth | Data Source | Navigation Source |
|---|-----|------|--------|------|-------------|-------------------|
| 1 | `/` | `pages/index.astro` | SSG (`prerender = true`) | No | No data .. redirects to `/${locale}/` based on `Accept-Language` header via `parseAcceptLanguage()` | Entry point |
| 2 | `/404` | `pages/404.astro` | SSG (static) | No | Hardcoded .. static error content, inline SVG illustration | Automatic (Astro error handling) |
| 3 | `/500` | `pages/500.astro` | SSG (static) | No | Hardcoded .. static error content, inline SVG illustration | Automatic (Astro error handling) |
| 4 | `/[lang]/` | `pages/[lang]/index.astro` | SSG (`prerender = true`, `getStaticPaths`) + **Server Islands** | No | **Server Islands** via `server:defer` .. `FeaturedAccommodations`, `FeaturedDestinations`, `FeaturedEvents`, `FeaturedPosts` fetch from API at request time. Hero and search bar are static shell. | Header logo, Footer home link |
| 5 | `/[lang]/alojamientos/` | `pages/[lang]/alojamientos/index.astro` | **SSG + ISR** (`prerender = true`, `getStaticPaths`) | No | **API call** .. `accommodationsApi.list({ page, pageSize: 12, sortBy, type })` via `lib/api/endpoints`. Supports `?sortBy=`, `?type=`, `?page=` query params. Uses `Astro.url.searchParams`. | Header nav "Alojamientos", Footer "Explorar" |
| 6 | `/[lang]/alojamientos/[slug]/` | `pages/[lang]/alojamientos/[slug].astro` | SSG (`prerender = true`, `getStaticPaths`) + ISR 24h | No | **API call** .. `accommodationsApi.list({ pageSize: 500 })` in `getStaticPaths`, `accommodationsApi.getBySlug(slug)` for detail. Includes reviews, amenities, gallery, FAQ, similar accommodations, JSON-LD. | AccommodationCard click (`transition:name`), breadcrumb |
| 7 | `/[lang]/alojamientos/tipo/[type]/` | `pages/[lang]/alojamientos/tipo/[type]/index.astro` | **SSG + ISR** (`prerender = true`, `getStaticPaths` 7 types x 3 locales) | No | **API call** .. `accommodationsApi.list({ type })` filtered by accommodation type (7 types: hotel, hostel, cabin, apartment, camping, estancia, posada). Uses `Astro.url.searchParams`. | Internal links, type filter badges |
| 7b | `/[lang]/alojamientos/tipo/[type]/page/[page]/` | `pages/[lang]/alojamientos/tipo/[type]/page/[page].astro` | SSR | No | **Rewrite** .. validates locale, type, and page params. Page 1 redirects to base URL, then `Astro.rewrite()` to `/[lang]/alojamientos/tipo/[type]/?page=${pageNum}` | Pagination component on type listing page |
| 8 | `/[lang]/alojamientos/page/[page]/` | `pages/[lang]/alojamientos/page/[page].astro` | SSR | No | **Rewrite** .. validates page param, page 1 redirects to base URL, then `Astro.rewrite()` to `/[lang]/alojamientos/?page=${pageNum}` | Pagination component on listing page |
| 9 | `/[lang]/destinos/` | `pages/[lang]/destinos/index.astro` | SSG (`prerender = true`, `getStaticPaths`) | No | **API call** .. `destinationsApi.list()` via `lib/api/endpoints` | Header nav "Destinos", Footer "Explorar" |
| 10 | `/[lang]/destinos/[...path]/` | `pages/[lang]/destinos/[...path].astro` | SSG (`prerender = true`, `getStaticPaths`) + ISR | No | **API call** .. `destinationsApi.list()` in `getStaticPaths`, detail by slug. Hierarchical routing (country/province/city). JSON-LD. | DestinationCard click (`transition:name`), breadcrumb |
| 11 | `/[lang]/destinos/page/[page]/` | `pages/[lang]/destinos/page/[page].astro` | SSR | No | **Rewrite** .. validates page param, page 1 redirects to base URL, then `Astro.rewrite()` to `/[lang]/destinos/?page=${pageNum}` | Pagination component on listing page |
| 12 | `/[lang]/eventos/` | `pages/[lang]/eventos/index.astro` | SSR | No | **API call** .. `eventsApi.list({ page, category, timeframe })` via `lib/api/endpoints`. Supports category and timeframe filters. | Header nav "Eventos", Footer "Explorar" |
| 13 | `/[lang]/eventos/[slug]/` | `pages/[lang]/eventos/[slug].astro` | SSG (`prerender = true`, `getStaticPaths`) + ISR | No | **API call** .. `eventsApi.list()` in `getStaticPaths`, `eventsApi.getBySlug(slug)` for detail. Includes agenda, pricing, organizer, related events. JSON-LD. | EventCard click (`transition:name`), breadcrumb |
| 14 | `/[lang]/eventos/page/[page]/` | `pages/[lang]/eventos/page/[page].astro` | SSR | No | **Rewrite** .. validates page param, page 1 redirects to base URL, then `Astro.rewrite()` to `/[lang]/eventos/?page=${pageNum}` | Pagination component on listing page |
| 15 | `/[lang]/publicaciones/` | `pages/[lang]/publicaciones/index.astro` | SSG (`prerender = true`, `getStaticPaths`) | No | **API call** .. `postsApi.list()` via `lib/api/endpoints` | Header nav "Publicaciones", Footer "Blog" |
| 16 | `/[lang]/publicaciones/[slug]/` | `pages/[lang]/publicaciones/[slug].astro` | SSG (`prerender = true`, `getStaticPaths`) + ISR | No | **API call** .. `postsApi.list()` in `getStaticPaths`, `postsApi.getBySlug(slug)` for detail. TipTap content rendered to HTML via `renderTiptapContent()`. JSON-LD. | BlogPostCard click (`transition:name`), breadcrumb |
| 17 | `/[lang]/publicaciones/page/[page]/` | `pages/[lang]/publicaciones/page/[page].astro` | SSR | No | **Rewrite** .. validates page param, page 1 redirects to base URL, then `Astro.rewrite()` to `/[lang]/publicaciones/?page=${pageNum}` | Pagination component on listing page |
| 18 | `/[lang]/busqueda/` | `pages/[lang]/busqueda.astro` | SSR | No | **API call** (conditional) .. if `?q=` present, calls `accommodationsApi.search(q)`, `destinationsApi.search(q)`, `eventsApi.search(q)`, `postsApi.search(q)` in parallel. Empty state if no query. `noindex=true`. | SearchBar component (Header), direct URL |
| 19 | `/[lang]/beneficios/` | `pages/[lang]/beneficios.astro` | SSG (`prerender = true`, `getStaticPaths`) | No | Hardcoded .. static benefit cards for tourists and property owners, feature lists, pricing CTAs. All content in i18n Record objects. | Footer "Beneficios", internal CTAs |
| 20 | `/[lang]/contacto/` | `pages/[lang]/contacto.astro` | SSG (`prerender = true`, `getStaticPaths`) | No | **ContactForm.client.tsx** React island (`client:visible`) for form submission to `/api/v1/contact`. Contact info (email, address), office hours, social links remain static Astro. | Footer "Contacto", Header nav |
| 21 | `/[lang]/quienes-somos/` | `pages/[lang]/quienes-somos.astro` | SSG (`prerender = true`, `getStaticPaths`) | No | Hardcoded .. mission statement, 4 values, region info, contact CTA. All content in i18n Record objects. | Footer "Quienes somos" |
| 22 | `/[lang]/terminos-condiciones/` | `pages/[lang]/terminos-condiciones.astro` | SSG (`prerender = true`, `getStaticPaths`) | No | Hardcoded .. 7 legal sections, dynamic timestamp for "last updated". All content in i18n Record objects. | Footer "Terminos y condiciones" |
| 23 | `/[lang]/privacidad/` | `pages/[lang]/privacidad.astro` | SSG (`prerender = true`, `getStaticPaths`) | No | Hardcoded .. 7 privacy sections, dynamic timestamp. All content in i18n Record objects. | Footer "Privacidad" |
| 24 | `/[lang]/mapa-del-sitio/` | `pages/[lang]/mapa-del-sitio.astro` | SSG (`prerender = true`, `getStaticPaths`) | No | Hardcoded .. static links to all main routes organized by section. | Footer "Mapa del sitio" |
| 25 | `/[lang]/precios/turistas/` | `pages/[lang]/precios/turistas.astro` | SSG (`prerender = true`, `getStaticPaths`) | No | Hardcoded .. 3 pricing plans (Free/Plus/VIP), feature comparison, 3 FAQ Q&A. All content in i18n Record objects. No API integration with billing system. | CTA buttons on benefits page, internal links |
| 26 | `/[lang]/precios/propietarios/` | `pages/[lang]/precios/propietarios.astro` | SSG (`prerender = true`, `getStaticPaths`) | No | Hardcoded .. pricing plans for property owners, feature comparison, FAQ. All content in i18n Record objects. No API integration with billing system. | CTA buttons, Footer links |
| 27 | `/[lang]/auth/signin/` | `pages/[lang]/auth/signin.astro` | SSR | No (redirects home if already authenticated) | Hardcoded .. Better Auth login form, social login buttons. `noindex=true`. Redirects to `returnUrl` query param or home after login. | Header auth button, redirect from protected pages |
| 28 | `/[lang]/auth/signup/` | `pages/[lang]/auth/signup.astro` | **SSR** | No (server-side auth guard: `Astro.locals.user` check, redirects home if authenticated) | Hardcoded .. Better Auth registration form, social signup buttons. | Link from signin page, Header auth button |
| 29 | `/[lang]/auth/forgot-password/` | `pages/[lang]/auth/forgot-password.astro` | SSG (`prerender = true`, `getStaticPaths`) | No (redirects home if already authenticated) | Hardcoded .. email input form for password reset request. | Link from signin page |
| 30 | `/[lang]/auth/reset-password/` | `pages/[lang]/auth/reset-password.astro` | SSR | No (requires token in URL) | Hardcoded .. new password form. Requires `?token=` query parameter from email link. | Email link (password reset flow) |
| 31 | `/[lang]/auth/verify-email/` | `pages/[lang]/auth/verify-email.astro` | SSR | No (requires token in URL) | Hardcoded .. email verification status page. Requires `?token=` query parameter from email link. | Email link (signup verification flow) |
| 32 | `/[lang]/mi-cuenta/` | `pages/[lang]/mi-cuenta/index.astro` | SSR | **Yes** | **Astro.locals.user** .. displays user name, email, initials avatar from auth session. Quick stats and nav to sub-sections. No API call beyond auth session. | Header AuthSection (profile icon) |
| 33 | `/[lang]/mi-cuenta/editar/` | `pages/[lang]/mi-cuenta/editar.astro` | SSR | **Yes** | Hardcoded .. profile edit form with static fields (name, email, bio). Submit button is `disabled={true}`. Form action points to `/api/user/profile` which does not exist. Message: "Save functionality will be available soon". | Account sidebar "Editar perfil" |
| 34 | `/[lang]/mi-cuenta/favoritos/` | `pages/[lang]/mi-cuenta/favoritos.astro` | SSR | **Yes** | Hardcoded .. empty state placeholder with tabs (accommodations/destinations/events/blog). No API call to favorites endpoint. `noindex=true`. | Account sidebar "Favoritos" |
| 35 | `/[lang]/mi-cuenta/preferencias/` | `pages/[lang]/mi-cuenta/preferencias.astro` | SSR | **Yes** | Hardcoded .. static preferences form (language, notifications, privacy toggles). No API call. `noindex=true`. | Account sidebar "Preferencias" |
| 36 | `/[lang]/mi-cuenta/resenas/` | `pages/[lang]/mi-cuenta/resenas.astro` | SSR | **Yes** | Hardcoded .. empty state placeholder ("No reviews yet"). No API call to reviews endpoint. `noindex=true`. | Account sidebar "Resenas" |
| 37 | `/[lang]/mi-cuenta/suscripcion/` | `pages/[lang]/mi-cuenta/suscripcion.astro` | SSR | **Yes** | Hardcoded .. static subscription info with placeholder plan data and upgrade CTA. No API call to billing system. `noindex=true`. | Account sidebar "Suscripcion" |

---

## Summary Stats

| Metric | Count | % |
|--------|-------|---|
| **Total URL patterns** | 38 | 100% |
| SSG (prerender) | 17 | 45% |
| SSG + ISR (prerender + revalidation) | 6 | 16% |
| SSR | 15 | 39% |
| **API real data** | 13 | 35% |
| **Hardcoded / placeholder** | 20 | 54% |
| **Astro.locals.user only** | 1 | 3% |
| **Rewrite (pagination proxy)** | 4 | 11% |
| Auth required | 6 | 16% |
| Public | 31 | 84% |
| noindex | 7 | 19% |

---

## Missing Routes

### Necessary (blocks functionality or creates inconsistency)

*All necessary missing routes have been addressed in SPEC-012.*

### Desirable (SEO/UX improvements, not blocking)

| Missing Route | Reason |
|---|---|
| `/[lang]/eventos/categoria/[category]/` | Events have category filter via query param (`?category=`), but no SEO-friendly URL per category. Each category could be indexable (e.g., `/eventos/categoria/musica/`). |
| `/[lang]/publicaciones/etiqueta/[tag]/` | Posts likely have tags, but there is no route to filter by tag. Same SEO concern as event categories. |
| `/[lang]/destinos/[...path]/alojamientos/` | Destination detail shows general info but has no dedicated sub-page for listing the destination's accommodations. If a destination has 200 accommodations, it needs its own paginated list. |
| `/[lang]/propietarios/` | Landing page for property owners who want to register their accommodation. Owner pricing page exists but there is no onboarding/landing page dedicated to the owner acquisition funnel. |

---

## Rendering Strategy Recommendations

### Routes that should change

*All rendering strategy changes have been implemented in SPEC-012:*

| # | Route | Previous Render | New Render | Status |
|---|---|---|---|---|
| 5 | `/[lang]/alojamientos/` | SSR | **SSG + ISR** | Done |
| 7 | `/[lang]/alojamientos/tipo/[type]/` | SSR | **SSG + ISR** | Done |
| 28 | `/[lang]/auth/signup/` | SSG | **SSR** | Done |

### Routes that are correct as-is

| # | Route | Render | Why it's correct |
|---|---|---|---|
| 4 | `/[lang]/` (homepage) | SSG + Server Islands | Best of both worlds: static shell loads instantly, dynamic featured content defers to request time. |
| 12 | `/[lang]/eventos/` | SSR | Events have `?timeframe=upcoming\|past\|all` which is temporal and changes constantly. SSR makes sense. |
| 27 | `/[lang]/auth/signin/` | SSR | Needs to read `?returnUrl=` and verify auth status server-side. |
| 8,11,14,17 | Pagination `/page/[page]/` | SSR (rewrite) | The `Astro.rewrite()` pattern is elegant and correct. Pagination pages proxy to the index with query params. No changes needed. |
| - | All detail pages | SSG + ISR | Pre-rendered at build for fast first load, revalidated periodically for fresh content. |

---

## Islands Architecture Analysis

### Existing islands (21 components)

| Component | Used In | Directive | Assessment |
|---|---|---|---|
| `SearchBar.client.tsx` | Homepage (#4) | `client:load` | Correct .. above the fold, needs immediate JS |
| `ViewToggle.client.tsx` | Accommodation list (#5) | `client:idle` | Correct .. low priority toggle |
| `FilterSidebar.client.tsx` | Accommodation list (#5) | unknown | Correct .. interactive filters |
| `ImageGallery.client.tsx` | Detail pages (#6, #10) | `client:visible` | Correct .. below fold, heavy |
| `MapView.client.tsx` | Detail pages (#6, #10) | `client:visible` | Correct .. heavy, lazy load |
| `FavoriteButton.client.tsx` | Detail pages (#6, #10, #13) | `client:visible` | Correct |
| `ShareButtons.client.tsx` | Post detail (#16) | `client:visible` | Correct |
| `AccordionFAQ.client.tsx` | Accommodation detail (#6) | `client:visible` | Correct |
| `ReviewList.client.tsx` | Accommodation detail (#6) | `client:visible` | Correct |
| `ReviewForm.client.tsx` | Accommodation detail (#6) | unknown | Correct |
| `ThemeToggle.client.tsx` | Header (global) | `client:idle` | Correct |
| `MobileMenuWrapper.client.tsx` | Header (global) | `client:media="(max-width: 768px)"` | Correct .. wraps MobileMenu, only hydrated on mobile (SPEC-012) |
| `UserNav.client.tsx` | Header (global) | unknown | Correct |
| `Toast.client.tsx` | Global | unknown | Correct |
| `Modal.client.tsx` | Various | unknown | Correct |
| `Tabs.client.tsx` | Favorites, etc. | unknown | Correct |
| `PriceDisplay.client.tsx` | Accommodation detail (#6) | unknown | Correct .. currency conversion |
| `CalendarView.client.tsx` | Events | unknown | Correct |
| `NewsletterCTA.client.tsx` | Global | unknown | Correct |
| `AuthRequiredPopover.client.tsx` | Favorites without auth | unknown | Correct |
| `ContactForm.client.tsx` | Contact page (#20) | `client:visible` | Correct .. wired into contacto.astro, submits to API (SPEC-012) |

### Islands that are missing or need changes

| Page | What needs an island | Reason |
|---|---|---|
| ~~#20 `/contacto/`~~ | ~~Must use existing `ContactForm.client.tsx`~~ | **Done (SPEC-012)**: `ContactForm.client.tsx` wired with `client:visible`. |
| **#33 `/mi-cuenta/editar/`** | **Needs a React island for profile edit form** | The form has `action="/api/user/profile"` which does not exist. The submit button is `disabled={true}` with a "coming soon" message. Needs a React island that loads user data and submits via API mutation. |
| **#35 `/mi-cuenta/preferencias/`** | **Needs a React island for preference toggles** | Language, notification, and privacy toggles need interactivity. Changing a toggle must persist immediately via API call. Static form cannot do this. |
| **#34 `/mi-cuenta/favoritos/`** | **Needs a React island for favorites list with tabs** | Requires: interactive tabs (`Tabs.client.tsx` exists), cards with unfavorite button, and real data fetching. Currently empty placeholder. |
| **#36 `/mi-cuenta/resenas/`** | **Needs a React island for reviews list** | Requires fetch of user's reviews with ability to edit/delete. Currently empty placeholder. |
| **#37 `/mi-cuenta/suscripcion/`** | **Needs a React island for plan management** | Upgrade/downgrade button, billing API integration (QZPay), current plan status display. Currently static placeholder. |
| **#25-26 `/precios/*/`** | **Needs a React island for monthly/annual toggle and "Choose plan" CTA** | Pricing pages typically have a billing frequency toggle (monthly vs annual) and buttons that initiate checkout flow. Both require JS. |
| ~~`MobileMenu.client.tsx`~~ | ~~Change directive to `client:media`~~ | **Done (SPEC-012)**: `MobileMenuWrapper.client.tsx` with `client:media="(max-width: 768px)"`. |

---

## Data Source Recommendations

### Must remain hardcoded

| Route | Reason |
|---|---|
| #2-3 `/404`, `/500` | Error pages cannot depend on API. If API is down, the 500 page still needs to render. |
| #22 `/terminos-condiciones/` | Legal content. Changes rarely, requires human legal review. Hardcoded is correct. |
| #23 `/privacidad/` | Same as terms. Legal content that changes rarely. |
| #21 `/quienes-somos/` | Institutional content. Changes once a year at most. Does not justify an API endpoint. |
| #24 `/mapa-del-sitio/` | Static links. Regenerates with build. The XML sitemap (`@astrojs/sitemap`) already exists for SEO. |
| #19 `/beneficios/` | Marketing content. Changes rarely. Does not need API. |

### Must migrate to real API data (HIGH priority)

These routes block core user functionality.

| Route | Current State | Required Change | Recommended Strategy |
|---|---|---|---|
| **#32 `/mi-cuenta/`** | Only reads `Astro.locals.user` (name, email) | Must show real stats: favorite count, review count, plan status | **API call** server-side to `/api/users/{id}/stats` using `Astro.locals.user.id`. |
| **#33 `/mi-cuenta/editar/`** | Form with `disabled` submit, "coming soon" message | Must load full profile (bio, avatar, phone) and allow saving | **API call** GET profile + **React island** for form with POST/PATCH mutation. Remove disabled button and "coming soon" note. |
| **#34 `/mi-cuenta/favoritos/`** | Empty placeholder | Must show user's saved accommodations, destinations, events, posts | **API call** server-side to `/api/favorites/list?userId=X` + **React island** for interactive unfavorite and tab switching. |
| **#35 `/mi-cuenta/preferencias/`** | Static toggles that do nothing | Must load and persist real user preferences | **API call** GET preferences + **React island** with toggles that PATCH on change. |
| **#36 `/mi-cuenta/resenas/`** | Empty placeholder "no reviews yet" | Must show reviews written by user with edit/delete capability | **API call** server-side to `/api/reviews?userId=X` + **React island** for edit/delete actions. |
| **#37 `/mi-cuenta/suscripcion/`** | Static placeholder plan data | Must show real plan, billing status, renewal date | **API call** server-side to billing service (QZPay) via `/api/billing/subscription?userId=X` + **React island** for upgrade/cancel actions. |

### Must migrate to real API data (MEDIUM priority)

These routes show incorrect or outdated information to users.

| Route | Current State | Required Change | Recommended Strategy |
|---|---|---|---|
| **#25 `/precios/turistas/`** | Hardcoded 3 plans (Free/Plus/VIP) | Plans and prices must come from billing system | **API call** server-side to billing plans endpoint (already exists in admin: `usePlansQuery()`). Keep SSG with ISR .. prices don't change every minute. Fallback to hardcoded if API fails. |
| **#26 `/precios/propietarios/`** | Hardcoded owner plans | Same as tourist pricing | Same approach. |
| ~~#20 `/contacto/`~~ | ~~Form submits to nowhere~~ | **Done (SPEC-012)**: Wire `ContactForm.client.tsx` with `client:visible` | `ContactForm.client.tsx` wired with `client:visible`, submits to `/api/v1/contact`. |

### Could migrate eventually (LOW priority)

| Route | Could be | But.. |
|---|---|---|
| #24 `/mapa-del-sitio/` | Dynamically generated from real DB entities | Marginal benefit. XML sitemap already exists for SEO. HTML sitemap is for UX only. |
