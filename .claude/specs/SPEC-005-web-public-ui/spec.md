---
spec-id: SPEC-005
title: Hospeda Public Web Application (web2) - Built from Scratch
type: feature
complexity: high
status: draft
created: 2026-02-12T16:00:00.000Z
updated: 2026-02-13T12:00:00.000Z
---

## SPEC-005 v3: Hospeda Public Web Application (web2) - Built from Scratch

## Table of Contents

1. [Overview & Philosophy](#1-overview--philosophy)
2. [Technology Stack](#2-technology-stack)
3. [Design System & Theming](#3-design-system--theming)
4. [URL Structure & Routing](#4-url-structure--routing)
5. [Authentication & User Types](#5-authentication--user-types)
6. [Language & Theme Detection](#6-language--theme-detection)
7. [Data Model & Entity Structure](#7-data-model--entity-structure)
8. [Page Inventory with Rendering Strategy](#8-page-inventory-with-rendering-strategy)
9. [Component Inventory](#9-component-inventory)
10. [Icon & Illustration Strategy](#10-icon--illustration-strategy)
11. [Animation, View Transitions & UX Feedback](#11-animation-view-transitions--ux-feedback)
12. [Accessibility Requirements](#12-accessibility-requirements)
13. [SEO Strategy](#13-seo-strategy)
14. [Performance Requirements](#14-performance-requirements)
15. [Internationalization & Currency](#15-internationalization--currency)
16. [Interactive Features & Libraries](#16-interactive-features--libraries)
17. [User Stories & Acceptance Criteria](#17-user-stories--acceptance-criteria)
18. [Scope Definition](#18-scope-definition)
19. [Related Specifications](#19-related-specifications)

---

## 1. Overview & Philosophy

### 1.1 Core Philosophy

This is a **COMPLETE REWRITE** creating a NEW app `apps/web2/` from scratch, NOT a refactoring of `apps/web/`.

**Central Principles:**

- **Accommodations are CENTRAL** like booking.com/airbnb, but enriched with destination guides, events, and editorial content
- **Best practices from day one**: WCAG 2.1 AA accessibility, Lighthouse 90+ scores, comprehensive SEO, LLM-friendly markup
- **Modern CSS**: Latest features supported by last 2-3 versions of Chrome, Firefox, Safari, Edge
- **Conscious rendering strategy**: Each page uses the BEST rendering approach (SSG, SSR, server islands, static) with clear justification
- **Data-source agnostic components**: UI components don't know where data comes from (services, API, static)
- **No component library initially**: Everything well-componentized for easy future library adoption
- **Consistent design language**: One animation system, one visual language throughout
- **Personality with purpose**: Regional identity reflecting the Litoral argentino, NOT generic AI-generated aesthetics
- **Theme-driven CSS**: Everything controlled via CSS variables for easy global changes
- **TDD from start**: Tests written first, minimum 90% coverage

### 1.2 Success Metrics

- **Performance**: Lighthouse >= 90 (all metrics)
- **Core Web Vitals**: LCP < 2.5s, FID < 100ms, CLS < 0.1
- **Accessibility**: WCAG 2.1 AA compliance (100% automated pass rate)
- **SEO**: Complete metadata, structured data, breadcrumbs on all pages
- **Test Coverage**: >= 90%
- **Mobile Performance**: TTI < 3.5s on 3G

### 1.3 Target Users

- **Tourists**: First-time visitors seeking accommodations and attractions
- **Frequent travelers**: Return visitors comparing options, reading reviews
- **Locals**: Residents discovering regional events and content
- **Potential owners**: Browsing before signing up to list their property
- **Content consumers**: Users interested in travel editorial content

---

## 2. Technology Stack

### 2.1 Core Technologies

```typescript
{
  "framework": "Astro (latest)",
  "islands": "React 18+",
  "styling": "Tailwind CSS v4",
  "icons": "@repo/icons (individual SVG components, Phosphor migration planned in SPEC-008)",
  "testing": "Vitest",
  "language": "TypeScript (strict mode)",
  "runtime": "Node.js >= 18"
}
```

### 2.2 Existing Packages (Reuse)

```typescript
{
  "validation": "@repo/schemas",
  "i18n": "@repo/i18n",
  "database": "@repo/db",
  "services": "@repo/service-core",
  "billing": "@repo/billing",
  "auth": "@repo/auth-ui"
}
```

### 2.3 New Dependencies

```typescript
{
  "maps": "Leaflet OR Mapbox GL JS (decide during implementation)",
  "images": "astro:assets (<Image /> with inferSize + image.remotePatterns for DB images)",
  "sitemap": "@astrojs/sitemap",
  "forms": "React Hook Form + Zod resolver",
  "state": "Zustand (minimal client state only)",
  "dates": "date-fns",
  "richText": "TipTap/ProseMirror JSON (stored as JSONB in DB, rendered server-side)"
}
```

**Library vs Vanilla Decision Framework:**

For each interactive feature, choose based on:

1. **Complexity**: Simple interactions use vanilla JS, complex use libraries
2. **Accessibility**: If library provides better a11y out of box, prefer it
3. **Bundle size**: Weigh benefit vs cost (target: JS bundle < 200KB)
4. **Maintenance**: Prefer well-maintained libraries for complex features

**Examples:**

- **Tabs/Accordion**: Vanilla JS (simple, small)
- **Forms**: React Hook Form (validation, accessibility, complex state)
- **Maps**: Leaflet/Mapbox (complex, tested, accessible)
- **Datepicker**: Library TBD during implementation (complex a11y)
- **Modals**: Vanilla JS using `<dialog>` element (native, accessible)
- **Carousels**: Consider vanilla JS with Intersection Observer vs library

---

## 3. Design System & Theming

### 3.1 CSS Variables Architecture

**ALL design tokens as CSS variables for global control:**

```css
:root {
  /* Colors - Regional Palette */
  --color-primary: #2196F3; /* River blue */
  --color-primary-dark: #1565C0;
  --color-primary-light: #64B5F6;
  --color-secondary: #4CAF50; /* Vegetation green */
  --color-secondary-dark: #2E7D32;
  --color-accent: #D7CCC8; /* Sand beige */
  --color-accent-dark: #8D6E63; /* Earth brown */

  /* Neutrals */
  --color-text: #212121;
  --color-text-secondary: #424242;
  --color-text-tertiary: #757575;
  --color-border: #EEEEEE;
  --color-bg: #FAFAFA;
  --color-surface: #FFFFFF;

  /* Semantic */
  --color-success: #4CAF50;
  --color-warning: #FFC107;
  --color-error: #F44336;
  --color-info: #2196F3;

  /* Spacing (8px grid) */
  --space-xs: 0.25rem;  /* 4px */
  --space-sm: 0.5rem;   /* 8px */
  --space-md: 1rem;     /* 16px */
  --space-lg: 1.5rem;   /* 24px */
  --space-xl: 2rem;     /* 32px */
  --space-2xl: 3rem;    /* 48px */
  --space-3xl: 4rem;    /* 64px */
  --space-4xl: 6rem;    /* 96px */

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.15);
  --shadow-xl: 0 8px 32px rgba(0, 0, 0, 0.2);

  /* Typography */
  --font-serif: 'Playfair Display', Georgia, serif;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

  --font-size-xs: 0.75rem;    /* 12px */
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg: 1.125rem;   /* 18px */
  --font-size-xl: 1.25rem;    /* 20px */
  --font-size-2xl: 1.5rem;    /* 24px */
  --font-size-3xl: 2rem;      /* 32px */
  --font-size-4xl: 2.5rem;    /* 40px */
  --font-size-5xl: 3rem;      /* 48px */

  --line-height-tight: 1.2;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.6;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 350ms ease;

  /* Z-index scale */
  --z-base: 0;
  --z-dropdown: 1000;
  --z-sticky: 1020;
  --z-modal-backdrop: 1040;
  --z-modal: 1050;
  --z-toast: 1060;
}

/* Dark mode prepared (not implemented) */
[data-theme="dark"] {
  --color-text: #E0E0E0;
  --color-bg: #121212;
  --color-surface: #1E1E1E;
  /* ... dark variants */
}
```

### 3.2 Typography System

**Font Loading:**

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
```

**Usage:**

- **Headings**: Playfair Display (serif) - editorial, premium feel
- **Body**: Inter (sans-serif) - readable, modern
- **Letter spacing**: Headings -0.02em, body normal
- **Font display**: swap (prevent FOIT)

### 3.3 Component Tokens

**Buttons:**

```css
.btn {
  padding: var(--space-md) var(--space-xl);
  border-radius: var(--radius-md);
  font-weight: 600;
  transition: all var(--transition-base);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
  box-shadow: var(--shadow-md);
}
```

**Cards:**

```css
.card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--space-xl);
  transition: box-shadow var(--transition-base);
}

.card:hover {
  box-shadow: var(--shadow-lg);
}
```

**Inputs:**

```css
.input {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md) var(--space-lg);
  font-size: var(--font-size-base);
  transition: border-color var(--transition-fast);
}

.input:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}
```

---

## 4. URL Structure & Routing

### 4.1 URL Conventions

**Rules:**

- **ALL URLs include locale prefix**, including the default locale (ES)
- Root `/` ONLY redirects to `/{detected-locale}/` based on browser/user preference
- Trailing slashes: ALWAYS `/{lang}/alojamientos/`
- Hierarchical for destinations: `/{lang}/destinos/argentina/entre-rios/concepcion-del-uruguay/`
- Slugs: lowercase, kebab-case, URL-safe
- Route paths remain in Spanish regardless of locale (only content translates)

**Examples:**

```
Root:   /                              → Redirect to /es/ (or /en/, /pt/ based on detection)
ES:     /es/alojamientos/hotel-ejemplo/
EN:     /en/alojamientos/hotel-ejemplo/
PT:     /pt/alojamientos/hotel-exemplo/
```

**Language Detection Flow (for root `/` redirect):**

1. Check authenticated user's saved language preference
2. Check `navigator.language` (client) or `Accept-Language` header (server)
3. Match against supported locales (es, en, pt)
4. Default to ES if no match

### 4.2 Route Structure

```
/                                            → Redirect to /{detected-locale}/

/[lang]/                                     → Homepage
/[lang]/busqueda/                            → Search results (?q=query)

/[lang]/alojamientos/                        → Accommodation list
/[lang]/alojamientos/[slug]/                 → Accommodation detail
/[lang]/alojamientos/tipo/[type]/            → Filtered by type

/[lang]/destinos/                            → Destination list
/[lang]/destinos/[...path]/                  → Destination detail (hierarchical)
/[lang]/destinos/[...path]/alojamientos/     → Accommodations in destination
/[lang]/destinos/[...path]/eventos/          → Events in destination
/[lang]/destinos/[...path]/publicaciones/    → Posts about destination

/[lang]/eventos/                             → Event list
/[lang]/eventos/[slug]/                      → Event detail

/[lang]/publicaciones/                       → Blog list
/[lang]/publicaciones/[slug]/                → Blog post detail

/[lang]/auth/signin/                         → Sign in
/[lang]/auth/signup/                         → Sign up
/[lang]/auth/forgot-password/                → Forgot password
/[lang]/auth/reset-password/                 → Reset password
/[lang]/auth/verify-email/                   → Email verification

/[lang]/mi-cuenta/                           → Account dashboard
/[lang]/mi-cuenta/editar/                    → Edit profile
/[lang]/mi-cuenta/favoritos/                 → Favorites
/[lang]/mi-cuenta/resenas/                   → My reviews
/[lang]/mi-cuenta/preferencias/              → Preferences (language/theme/currency)
/[lang]/mi-cuenta/suscripcion/               → Subscription management

/[lang]/quienes-somos/                       → About us
/[lang]/beneficios/                          → Benefits
/[lang]/precios/turistas/                    → Tourist pricing
/[lang]/precios/propietarios/                → Owner pricing
/[lang]/contacto/                            → Contact
/[lang]/terminos-condiciones/                → Terms
/[lang]/privacidad/                          → Privacy
/[lang]/sitemap/                             → HTML sitemap

/404                                         → Not found
/500                                         → Server error
```

**Astro File Structure:**

```
pages/
├── index.astro              → Redirect to /{detected-locale}/
├── [lang]/
│   ├── index.astro          → Homepage
│   ├── alojamientos/
│   │   ├── index.astro
│   │   ├── [slug].astro
│   │   └── tipo/[type].astro
│   ├── destinos/
│   │   └── [...path].astro
│   ├── eventos/
│   │   ├── index.astro
│   │   └── [slug].astro
│   ├── publicaciones/
│   │   ├── index.astro
│   │   └── [slug].astro
│   ├── auth/
│   │   ├── signin.astro
│   │   ├── signup.astro
│   │   ├── forgot-password.astro
│   │   ├── reset-password.astro
│   │   └── verify-email.astro
│   ├── mi-cuenta/
│   │   ├── index.astro
│   │   ├── editar.astro
│   │   ├── favoritos.astro
│   │   ├── resenas.astro
│   │   ├── preferencias.astro
│   │   └── suscripcion.astro
│   ├── precios/
│   │   ├── turistas.astro
│   │   └── propietarios.astro
│   ├── busqueda.astro
│   ├── quienes-somos.astro
│   ├── beneficios.astro
│   ├── contacto.astro
│   ├── terminos-condiciones.astro
│   ├── privacidad.astro
│   └── sitemap.astro
├── 404.astro
└── 500.astro
```

---

## 5. Authentication & User Types

### 5.1 Access Levels

All pages accessible without authentication:

- Unauthenticated users can browse everything
- Authentication unlocks enhanced features

### 5.2 User Roles

#### Tourist (Public Web)

- Free tier: 3 favorites max, write reviews, read all content
- Plus tier ($5k ARS/month): 20 favorites, ad-free, price alerts, exclusive deals
- VIP tier ($15k ARS/month): Unlimited favorites, VIP support, concierge

#### Owner (Admin Panel)

- Basic ($15k/month): 1 accommodation, 5 photos
- Professional ($35k/month): 3 accommodations, 15 photos, featured listing
- Premium ($75k/month): 10 accommodations, 30 photos, custom branding

**Authentication Flow:**

- Same credentials as admin panel
- Web2 = "tourist mode" (cannot manage accommodations)
- Better Auth for authentication
- OAuth: Google, Facebook

### 5.3 Unauthenticated vs Authenticated UX

**Unauthenticated:**

- Can browse all content
- All authenticated features are **visible but not usable** until sign-in
- Clicking any auth-required action (favorite, write review, contact owner, newsletter toggle, etc.) → **shows a contextual popover** explaining the feature requires authentication, with a CTA button to sign in/sign up
- The popover does NOT redirect the user away from the current page
- Popover includes: brief explanation, "Iniciar sesion" button, "Registrarse" link
- Popover closes on click outside or Escape key
- See subtle CTAs encouraging signup throughout

**Authenticated (Free):**

- Can favorite up to 3 items
- Can write reviews
- Can contact owners
- See prompts for paid features (subtle, not invasive)

**Authenticated (Paid):**

- Enhanced favorite limits
- Ad-free experience
- Price alerts
- Exclusive content/deals

---

## 6. Language & Theme Detection

### 6.1 Auto-Detection Strategy

**Language:**

1. Check if user has saved preference in profile (authenticated)
2. If not, detect from `navigator.language` (client) or `Accept-Language` header (server)
3. Default to ES if no match

**Theme:**

1. Check if user has saved preference in profile (authenticated)
2. If not, detect from `prefers-color-scheme` media query
3. Default to light theme
4. **Note**: Only light theme implemented initially, dark mode prepared via CSS vars

### 6.2 Preference UI

No language/theme selectors on public pages.

Selectors ONLY in `/mi-cuenta/preferencias/` for authenticated users:

- Language dropdown: Español, English, Português
- Theme toggle: Light, Dark (dark disabled with "Coming soon" badge)
- Save button persists to user profile

**Rationale:** Cleaner public UI, preferences are a user account feature

---

## 7. Data Model & Entity Structure

### 7.1 Core Entities (from DB schemas)

**Accommodation:**

```typescript
{
  slug: string,
  name: string,
  summary: string,
  description: string,
  type: "HOTEL" | "CABIN" | "APARTMENT" | "CAMPING" | "HOSTEL" | "BNB" | "RURAL" | "BOUTIQUE",
  location: {
    street: string,
    number: string,
    city: string,
    state: string,
    country: string,
    coordinates: { lat: number, lng: number }
  },
  media: {
    featuredImage: string,
    gallery: string[]
  },
  amenities: Amenity[],
  features: Feature[],
  isFeatured: boolean,
  pricing: JSONB, // flexible structure
  reviewsCount: number,
  averageRating: number,
  seo: {
    title: string,
    description: string,
    keywords: string[]
  },
  tags: Tag[],
  contactInfo: JSONB,
  socialNetworks: JSONB,
  schedule: JSONB,
  rating: JSONB, // detailed breakdown
  extraInfo: JSONB,
  policies: JSONB,
  faqs: FAQ[],
  iaData: JSONB,
  ownerId: string,
  destinationId: string
}
```

**Destination:**

```typescript
{
  slug: string,
  name: string,
  summary: string,
  description: string,
  location: {
    state: string,
    country: string,
    coordinates: { lat: number, lng: number }
  },
  media: { featuredImage: string, gallery: string[] },
  isFeatured: boolean,
  reviewsCount: number,
  averageRating: number,
  seo: { title: string, description: string },
  tags: Tag[],
  attractions: Attraction[],
  accommodationsCount: number,
  // FUTURE (SPEC-006):
  parentDestinationId?: string,
  destinationType?: string,
  level?: number,
  path?: string
}
```

**Event:**

```typescript
{
  slug: string,
  name: string,
  summary: string,
  description: string,
  media: { featuredImage: string, gallery: string[] },
  category: EventCategoryEnum,
  date: JSONB, // { start: ISO8601, end?: ISO8601 }
  pricing: JSONB, // EventPrice structure
  contact: JSONB,
  isFeatured: boolean,
  seo: { title: string, description: string },
  tags: Tag[],
  authorId: string,
  locations: EventLocation[], // venue info
  organizers: EventOrganizer[]
}
```

**Post (Blog):**

```typescript
{
  slug: string,
  title: string,
  summary: string,
  content: JSONB, // TipTap/ProseMirror structured JSON (rendered to HTML server-side)
  media: { featuredImage: string },
  category: PostCategoryEnum,
  authorId: string,
  isFeatured: boolean,
  isFeaturedInWebsite: boolean,
  isNews: boolean,
  publishedAt: DateTime,
  readingTimeMinutes: number,
  likes: number,
  comments: number,
  shares: number,
  seo: { title: string, description: string },
  tags: Tag[],
  expiresAt?: DateTime,
  relatedAccommodationId?: string,
  relatedDestinationId?: string,
  relatedEventId?: string,
  sponsorshipId?: string
}
```

**Review:**

```typescript
{
  id: string,
  title: string,
  content: string,
  rating: JSONB, // multiple dimensions
  userId: string,
  accommodationId?: string,
  destinationId?: string,
  createdAt: DateTime
}
```

**Bookmark:**

```typescript
{
  userId: string,
  entityId: string,
  entityType: "ACCOMMODATION" | "DESTINATION" | "EVENT" | "POST",
  name: string, // cached
  description: string, // cached
  createdAt: DateTime
}
```

**Tag:**

```typescript
{
  name: string,
  slug: string,
  color: TagColorEnum,
  icon: string,
  notes: string
}
```

**Amenity:**

```typescript
{
  slug: string,
  name: string,
  description: string,
  icon: string,
  isBuiltin: boolean,
  isFeatured: boolean,
  type: AmenitiesTypeEnum
}
```

**Feature:**

```typescript
{
  slug: string,
  name: string,
  description: string,
  icon: string,
  isBuiltin: boolean,
  isFeatured: boolean
}
```

**Attraction:**

```typescript
{
  name: string,
  slug: string,
  description: string,
  icon: string,
  isBuiltin: boolean,
  isFeatured: boolean
}
```

### 7.2 Features NOT in DB Yet (Implement UI Only)

These features will have UI components built, but backend/API will be added later:

- Newsletter subscription table/API
- Blog comments/discussion system
- FAQ per accommodation (has schema, may not have UI yet)
- Owner testimonials
- Destination "How to get there" structured data
- Destination "What to do" structured data
- Destination climate information

**Implementation:** Build UI components as if the API exists, use TypeScript interfaces for props, mock data for testing.

---

## 8. Page Inventory with Rendering Strategy

### 8.1 Rendering Strategy Decision Matrix

For each page type, consider:

- **Content freshness**: How often does content change?
- **SEO importance**: How critical is SEO for this page?
- **Personalization**: Does content vary per user?
- **Performance**: What's the performance requirement?
- **Build time**: How long would SSG build take?

**Strategies:**

- **SSG (Static Site Generation)**: Best for SEO, performance, static content
- **SSR (Server-Side Rendering)**: Best for personalized, dynamic content
- **Server Islands**: Best for hybrid (static shell + dynamic sections)
- **Client-side fetch**: Best for user-specific data that doesn't need SEO

### 8.2 Page Rendering Decisions

#### Public Pages

| Page | Route | Rendering | Justification |
|------|-------|-----------|---------------|
| **Homepage** | `/` | **Server Islands** | Static hero/featured sections + dynamic "recommended for you" if authenticated. SEO critical. |
| **Accommodation List** | `/alojamientos/` | **SSR** | Filters/sorting need real-time data, but SEO critical. Paginated for performance. |
| **Accommodation Detail** | `/alojamientos/[slug]/` | **SSG with ISR** | High SEO value, content rarely changes. Revalidate on edit. Build top 100, on-demand for rest. |
| **Accommodation by Type** | `/alojamientos/tipo/[type]/` | **SSR** | Filtered view, needs fresh data. |
| **Destination List** | `/destinos/` | **SSG** | Limited destinations (~50), rarely change. Perfect for SSG. |
| **Destination Detail** | `/destinos/[...path]/` | **SSG with ISR** | High SEO value, content rarely changes. Revalidate on edit. |
| **Destination Accommodations** | `/destinos/[...path]/alojamientos/` | **SSR** | Dynamic filtered list. |
| **Destination Events** | `/destinos/[...path]/eventos/` | **SSR** | Event dates change frequently. |
| **Destination Posts** | `/destinos/[...path]/publicaciones/` | **SSR** | Dynamic filtered list. |
| **Event List** | `/eventos/` | **SSR** | Events have dates, need fresh upcoming/past split. |
| **Event Detail** | `/eventos/[slug]/` | **SSG with ISR** | SEO important, but events expire. Short revalidation. |
| **Blog List** | `/publicaciones/` | **SSR** | New posts added regularly, category filters. |
| **Blog Post Detail** | `/publicaciones/[slug]/` | **SSG with ISR** | High SEO value, editorial content. Build featured, on-demand for rest. |
| **Search Results** | `/busqueda/` | **SSR** | Dynamic query, real-time results. |
| **About Us** | `/quienes-somos/` | **SSG** | Static marketing content. |
| **Benefits** | `/beneficios/` | **SSG** | Static marketing content. |
| **Pricing (Tourists)** | `/precios/turistas/` | **SSG** | Static pricing plans (from @repo/billing constants). |
| **Pricing (Owners)** | `/precios/propietarios/` | **SSG** | Static pricing plans, conversion-optimized. |
| **Contact** | `/contacto/` | **SSG** | Static page with client-side form. |
| **Terms** | `/terminos-condiciones/` | **SSG** | Static legal content. |
| **Privacy** | `/privacidad/` | **SSG** | Static legal content. |
| **Sitemap** | `/sitemap/` | **SSG** | Generated HTML sitemap. |
| **404** | `/404` | **SSG** | Static error page. |
| **500** | `/500` | **SSG** | Static error page. |

#### Auth Pages

| Page | Route | Rendering | Justification |
|------|-------|-----------|---------------|
| **Sign In** | `/auth/signin/` | **SSG** | Static form, client-side auth. No SEO needed (noindex). |
| **Sign Up** | `/auth/signup/` | **SSG** | Static form, client-side auth. |
| **Forgot Password** | `/auth/forgot-password/` | **SSG** | Static form. |
| **Reset Password** | `/auth/reset-password/` | **SSR** | Needs to validate token server-side. |
| **Verify Email** | `/auth/verify-email/` | **SSR** | Needs to validate token server-side. |

#### Authenticated Pages

| Page | Route | Rendering | Justification |
|------|-------|-----------|---------------|
| **My Account** | `/mi-cuenta/` | **SSR** | Personalized dashboard, user data. |
| **Edit Profile** | `/mi-cuenta/editar/` | **SSR** | Personalized form with user data. |
| **Favorites** | `/mi-cuenta/favoritos/` | **SSR** | User-specific bookmarks. |
| **My Reviews** | `/mi-cuenta/resenas/` | **SSR** | User-specific reviews. |
| **Preferences** | `/mi-cuenta/preferencias/` | **SSR** | User settings. |
| **Subscription** | `/mi-cuenta/suscripcion/` | **SSR** | User billing info. |

### 8.3 ISR & Cache Invalidation Strategy

**Approach: Hybrid ISR + On-Demand Revalidation + Cron** (details in SPEC-009)

For SSG with ISR pages, a three-layer invalidation strategy:

**Layer 1: On-Demand Revalidation (immediate)**
Triggered from admin panel via webhook when content is edited/published.

**Layer 2: ISR Time-Based Revalidation (fallback)**
Default revalidation intervals per content type as safety net.

**Layer 3: Scheduled Cron (safety net)**
Daily batch regeneration of all stale pages.

**Revalidation Categories:**

| Change Type | Strategy | Trigger |
|---|---|---|
| Accommodation price/availability | Immediate (on-demand) | Admin edit webhook |
| Accommodation description/photos | Immediate (on-demand) | Admin edit webhook |
| New accommodation published | Immediate + regenerate listing pages | Admin publish webhook |
| Accommodation deactivated/deleted | Immediate + regenerate listing pages | Admin action webhook |
| Destination content edit | Immediate (on-demand) | Admin edit webhook |
| New event published | Immediate + regenerate event listings | Admin publish webhook |
| Event date/details changed | Immediate (on-demand) | Admin edit webhook |
| Event expired (past date) | Cron (daily check) | Scheduled job |
| Blog post published/edited | Immediate (on-demand) | Admin publish webhook |
| New review posted | ISR (next interval, 1h) | Automatic |
| Rating recalculated | ISR (next interval, 1h) | Automatic |
| Tag/amenity changes | Cron (daily) | Scheduled job |
| Pricing plan changes | Immediate (on-demand) | Admin config change |
| SEO metadata changes | Immediate (on-demand) | Admin edit webhook |

**Default ISR intervals:**

- Accommodations/Destinations: 24h
- Events: 6h (date-sensitive)
- Blog posts: 24h
- Listing/index pages: 1h

**Note:** The admin panel regeneration management UI is specified in SPEC-009.

> **IMPLEMENTATION NOTE (hardcoded/mocked for SPEC-005):**
>
> - DO NOT implement the `/api/revalidate` webhook endpoint. SPEC-009 owns that infrastructure.
> - DO NOT create the `pageRegenerationRegistry`, `pageRegenerationConfig`, or `pageRegenerationLog` DB tables.
> - Use Astro/Vercel's built-in ISR defaults (`revalidate` in `getStaticPaths`) with the intervals listed above.
> - On-demand revalidation and the admin regeneration dashboard will be added by SPEC-009.
> - For now, content freshness relies solely on ISR time-based intervals.

---

## 9. Component Inventory

### 9.1 Layout Components

| Component | Type | Description | Props |
|-----------|------|-------------|-------|
| `BaseLayout.astro` | Layout | Base HTML shell with meta tags | `{ title, description, image?, noindex? }` |
| `Header.astro` | Layout | Global header with nav | `{ user?, locale }` |
| `Footer.astro` | Layout | Global footer | `{ locale }` |
| `Container.astro` | Layout | Max-width container | `{ size?: 'sm'│'md'│'lg'│'xl', class? }` |
| `Breadcrumb.astro` | Nav | Breadcrumb trail | `{ items: { label, href }[] }` |
| `Section.astro` | Layout | Page section wrapper | `{ title?, subtitle?, class? }` |

**Accessibility Requirements:**

- Header: `<header role="banner">`, skip link to main content
- Footer: `<footer role="contentinfo">`
- Nav: `<nav role="navigation" aria-label="Main">`
- Breadcrumb: `<nav aria-label="Breadcrumb">` with `aria-current="page"` on last item

### 9.2 Entity Card Components

| Component | Type | Description | Props |
|-----------|------|-------------|-------|
| `AccommodationCard.astro` | Card | Accommodation preview card | `{ accommodation, showFavorite?, locale }` |
| `DestinationCard.astro` | Card | Destination preview card | `{ destination, showFavorite?, locale }` |
| `EventCard.astro` | Card | Event preview card | `{ event, showFavorite?, locale }` |
| `BlogPostCard.astro` | Card | Blog post preview card | `{ post, variant?: 'default'│'featured', locale }` |
| `ReviewCard.astro` | Card | Review display card | `{ review, showEntity? }` |

**Accessibility Requirements:**

- Semantic heading hierarchy (h2/h3 for card titles)
- Image alt text from entity description
- Links with descriptive text (not "Read more")
- Focus visible on all interactive elements

### 9.3 Interactive Components (React)

| Component | Type | Library Decision | Justification | Props |
|-----------|------|-----------------|---------------|-------|
| `SearchBar.client.tsx` | Input | **React Hook Form** | Form state, validation, a11y | `{ onSearch, placeholder, locale }` |
| `FilterSidebar.client.tsx` | Filter | **Headless UI (optional)** | Complex state, a11y | `{ filters, onApply, locale }` |
| `ViewToggle.client.tsx` | Toggle | **Vanilla JS** | Simple state toggle | `{ defaultView: 'grid'│'map', onChange }` |
| `MapView.client.tsx` | Map | **Leaflet** | Industry standard, open source, accessible | `{ markers, center, zoom }` |
| `ImageGallery.client.tsx` | Media | **Library TBD** | Lightbox complexity, touch gestures | `{ images, alt }` |
| `ContactForm.client.tsx` | Form | **React Hook Form + Zod** | Validation, error handling | `{ entityId, entityType, locale }` |
| `ReviewForm.client.tsx` | Form | **React Hook Form + Zod** | Complex validation, photo upload | `{ entityId, entityType, locale }` |
| `ReviewList.client.tsx` | List | **Vanilla JS** | Simple rendering | `{ reviews, pagination }` |
| `FavoriteButton.client.tsx` | Button | **Vanilla JS** | Simple toggle, optimistic UI | `{ entityId, entityType, isFavorited, requireAuth }` |
| `ShareButtons.client.tsx` | Button | **Vanilla JS + Web Share API** | Native sharing, fallback for social | `{ url, title, text }` |
| `CalendarView.client.tsx` | Calendar | **Library TBD** | Complex date logic, a11y | `{ events, onDateSelect, locale }` |
| `NewsletterForm.client.tsx` | Form | **React Hook Form** | Validation | `{ locale }` |
| `LanguageSelector.client.tsx` | Dropdown | **Headless UI** | Accessible dropdown | `{ currentLocale, onChange }` |
| `UserNav.client.tsx` | Dropdown | **Headless UI** | Accessible dropdown | `{ user, locale }` |
| `MobileMenu.client.tsx` | Nav | **Vanilla JS + `<dialog>`** | Native dialog, simple | `{ navItems, locale }` |
| `AccordionFAQ.client.tsx` | Accordion | **Vanilla JS + `<details>`** | Native accordion | `{ items: { question, answer }[] }` |
| `Toast.client.tsx` | Notification | **Zustand + Portal** | Global state, positioning | `{ message, type, duration }` |
| `Modal.client.tsx` | Modal | **Vanilla JS + `<dialog>`** | Native modal, a11y built-in | `{ title, children, onClose }` |
| `Tabs.client.tsx` | Tabs | **Vanilla JS** | Simple ARIA implementation | `{ tabs: { label, content }[] }` |

**Loading Strategy:**

- `client:load`: Critical interactivity (search, auth)
- `client:idle`: Nice-to-have (share buttons, newsletter)
- `client:visible`: Below fold (galleries, maps)

### 9.4 Content Components

| Component | Type | Description | Props |
|-----------|------|-------------|-------|
| `HeroSection.astro` | Hero | Hero with image, title, CTA | `{ image, title, subtitle, cta? }` |
| `FeaturedSection.astro` | Section | Grid/carousel of featured items | `{ title, items, type: 'grid'│'carousel' }` |
| `AmenitiesList.astro` | List | Grid of amenity icons | `{ amenities }` |
| `PricingCard.astro` | Card | Pricing plan card | `{ plan, highlighted?, cta }` |
| `TestimonialCard.astro` | Card | Testimonial with quote | `{ quote, author, image, role }` |
| `Skeleton.astro` | Loading | Skeleton loader | `{ type: 'card'│'text'│'image', count? }` |
| `EmptyState.astro` | Placeholder | Empty state with illustration | `{ title, message, cta?, illustration }` |
| `Badge.astro` | Label | Category/tag badge | `{ label, variant: 'primary'│'secondary'│'outline' }` |

### 9.5 Form Components

| Component | Type | Description | Props |
|-----------|------|-------------|-------|
| `Button.astro` | Input | Button with variants | `{ variant, size, disabled?, loading?, type? }` |
| `Input.astro` | Input | Text input | `{ label, type, required?, error?, ...inputProps }` |
| `Select.astro` | Input | Dropdown select | `{ label, options, required?, error?, ...selectProps }` |
| `Textarea.astro` | Input | Multi-line text | `{ label, required?, error?, rows?, ...textareaProps }` |
| `Checkbox.astro` | Input | Checkbox input | `{ label, required?, error?, ...inputProps }` |
| `Radio.astro` | Input | Radio button | `{ label, name, value, ...inputProps }` |
| `Label.astro` | Input | Form label | `{ for, required?, children }` |
| `FormError.astro` | Input | Error message | `{ message, id }` |

**Accessibility Requirements:**

- All inputs have associated labels (explicit `for` attribute)
- Required fields: `required` attribute + visual indicator
- Error messages: `aria-describedby` linking input to error
- Focus visible on all inputs
- Fieldsets for grouped inputs (radio, checkbox groups)

---

## 10. Icon & Illustration Strategy

### 10.1 Individual Icon Components (@repo/icons)

**Use the existing `@repo/icons` package** with 386+ individual SVG components organized by domain categories.

**Import and usage pattern:**

```tsx
import { MapPinIcon, HeartIcon, SearchIcon } from '@repo/icons';

// Default size (24px), inherits text color
<MapPinIcon />

// Custom size with numeric value
<MapPinIcon size={20} />

// Named sizes: xs(16), sm(20), md(24), lg(28), xl(32)
<MapPinIcon size="sm" />

// With color and accessibility
<HeartIcon size={20} color="red" aria-label="Add to favorites" />

// With Tailwind classes
<SearchIcon className="w-6 h-6 text-blue-500" />
```

**Icon Props Interface:**

```typescript
interface IconProps {
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl'; // default: 'md' (24px)
  color?: string; // default: 'currentColor'
  className?: string;
  'aria-label'?: string;
  [key: string]: unknown; // additional SVG props
}
```

**Icon Categories:**

- `system/` - UI controls (Menu, Close, Search, Home, Calendar, etc.)
- `amenities/` - Accommodation features (Pool, WiFi, Parking, etc.)
- `entities/` - Domain objects (Accommodation, Destination, Event, etc.)
- `navigation/` - Navigation elements
- `actions/` - Action buttons (Edit, Delete, Save, etc.)
- `communication/` - Contact methods (Email, Phone, Chat, etc.)
- `social/` - Social media (Facebook, Instagram, WhatsApp, etc.)
- `attractions/` - Tourism features (Beach, Restaurant, etc.)

**Benefits:**

- Excellent tree-shaking (only imported icons included in bundle)
- Full TypeScript type safety (non-existent icons cause import errors)
- IDE autocomplete on import
- Domain-organized categories specific to Hospeda
- Built-in accessibility (aria-label + aria-hidden)

**Note:** Migration from current custom SVGs to Phosphor Icons is planned in SPEC-008. The API interface will remain the same (individual component imports with same props).

> **IMPLEMENTATION NOTE (hardcoded/mocked for SPEC-005):**
>
> - Use the current `@repo/icons` package AS-IS. Do not add Phosphor Icons or modify the icons package.
> - Import icons with the existing API: `import { MapPinIcon } from '@repo/icons'`.
> - When SPEC-008 runs, it will replace the SVG implementations behind the same import paths.
> - Any icon that does not exist in `@repo/icons` should NOT be created. Use a similar existing icon or a text placeholder.

### 10.2 Illustration Strategy

**Sources (free repositories):**

- unDraw (undraw.co): Customizable, modern illustrations
- Illustrations.co: Hand-drawn style
- DrawKit: Free packs
- Humaaans: Customizable characters

**Usage:**

- **Empty states**: Custom regional illustrations (e.g., river + island for "no results")
- **Error pages**: Friendly, regional character (404: lost gaucho, 500: broken bridge)
- **Decorative sections**: Homepage features, benefits page
- **Hero sections**: Large backdrop illustrations

**Customization:**

- Use brand colors (river blue, vegetation green)
- Regional elements where possible (river, islands, nature)
- Consistent style across all illustrations

**Implementation:**

- SVG format for scalability
- Lazy load below-fold illustrations
- Alt text describing illustration content

---

## 11. Animation, View Transitions & UX Feedback

### 11.1 Animation System

**One consistent animation language throughout the app.**

**Principles:**

- **Purposeful**: Animations guide attention, provide feedback, enhance UX
- **Subtle**: Not distracting, professional
- **Fast**: 150-350ms, never sluggish
- **Consistent**: Same easing, duration for similar actions
- **Always visible**: Every user interaction MUST have visual feedback (see 11.4)

**Animation Types:**

```css
/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide up */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Scale in */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Shimmer (skeleton) */
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}
```

**Usage Examples:**

- **Page load**: Fade in main content
- **Cards appearing**: Slide up with stagger
- **Modals**: Scale in + backdrop fade in
- **Buttons**: Scale down on click, color transition on hover
- **Toasts**: Slide in from top
- **Loading**: Shimmer for skeletons, spin for spinners

### 11.2 View Transitions API

**Enable smooth transitions between pages** (supported in Chrome, coming to other browsers).

```astro
---
// BaseLayout.astro
---
<html>
  <head>
    <meta name="view-transition" content="same-origin" />
    <style>
      /* Customize transitions */
      ::view-transition-old(root),
      ::view-transition-new(root) {
        animation-duration: 0.3s;
      }

      /* Specific elements */
      .hero-image {
        view-transition-name: hero;
      }

      ::view-transition-old(hero),
      ::view-transition-new(hero) {
        animation-duration: 0.5s;
      }
    </style>
  </head>
  <body>
    <slot />
  </body>
</html>
```

**Use Cases:**

- **Card to detail page**: Hero image morphs from card to detail page
- **List to detail**: Smooth zoom transition
- **Tab switching**: Crossfade content areas

**Fallback:**
Progressive enhancement. If browser doesn't support View Transitions, normal page navigation occurs.

### 11.3 Reduced Motion

**Respect user preferences:**

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 11.4 Visual Feedback Directive

**MANDATORY: Every user interaction MUST have immediate visual feedback.**

Users must never be left wondering if their action was registered. If an operation takes time, the UI must show that something is happening.

**Feedback patterns by interaction type:**

| Interaction | Immediate Feedback | During Processing | On Complete |
|---|---|---|---|
| **Button click** | Button enters `loading` state (spinner + disabled) | Text changes ("Enviando..") | Toast notification + state reset |
| **Form submit** | Submit button disabled + spinner | Form fields disabled, shimmer overlay | Success/error message |
| **Favorite toggle** | Heart fills/unfills immediately (optimistic) | N/A (optimistic) | Toast if error (revert) |
| **Navigation** | Progress bar at top of page (NProgress style) | View transition animation | Page renders |
| **Filter apply** | Active filter badges appear | Skeleton loaders replace content | New results render |
| **Search typing** | Input shows typing indicator | Debounced autocomplete dropdown | Results populate |
| **Image loading** | Blur placeholder (LQIP) or skeleton | Progressive load | Sharp image |
| **Infinite scroll** | Skeleton cards at bottom | Loading spinner | New cards render |
| **Delete action** | Confirmation dialog | Item fades out (optimistic) | Toast confirmation |
| **Review submit** | Submit button loading | Form disabled | Review appears in list + toast |
| **Tab switch** | Active tab highlights | Content crossfade | New content |

**Implementation requirements:**

- All `<button>` components MUST support a `loading` prop
- All forms MUST disable during submission
- All async operations MUST show progress indicators
- Toast notifications for all completed async actions (success and error)
- Skeleton loaders for all content that loads asynchronously
- Progress bar for page navigations (via View Transitions or NProgress)

### 11.5 Optimistic Updates Directive

**MANDATORY: Use optimistic updates wherever possible to improve perceived performance.**

Optimistic updates show the expected result immediately, then sync with the server in the background. If the server request fails, the UI reverts to the previous state.

**Where to apply optimistic updates:**

| Action | Optimistic Behavior | On Error |
|---|---|---|
| **Favorite/Bookmark toggle** | Heart fills/unfills immediately | Revert + error toast |
| **Review submission** | Review appears in list immediately | Remove from list + error toast |
| **User preference changes** | Setting updates immediately | Revert + error toast |
| **Newsletter toggle** | Toggle switches immediately | Revert + error toast |
| **Profile edit save** | Updated info shows immediately | Revert to previous + error toast |
| **Contact form submit** | Success message shown immediately | Show error state, re-enable form |

**Implementation pattern (React):**

```tsx
// Use TanStack Query useMutation with onMutate for optimistic updates
const mutation = useMutation({
  mutationFn: toggleFavorite,
  onMutate: async (newState) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['favorites'] });
    // Snapshot previous value
    const previous = queryClient.getQueryData(['favorites']);
    // Optimistically update
    queryClient.setQueryData(['favorites'], (old) => /* update */);
    return { previous };
  },
  onError: (_err, _variables, context) => {
    // Revert on error
    queryClient.setQueryData(['favorites'], context?.previous);
    toast.error('Error al actualizar favoritos');
  },
  onSettled: () => {
    // Always refetch to ensure consistency
    queryClient.invalidateQueries({ queryKey: ['favorites'] });
  },
});
```

---

## 12. Accessibility Requirements

**WCAG 2.1 Level AA compliance is MANDATORY.**

### 12.1 Color Contrast

- **Normal text** (< 18pt): 4.5:1 minimum
- **Large text** (≥ 18pt or 14pt bold): 3:1 minimum
- **UI components**: 3:1 against adjacent colors
- **Tool**: Use axe DevTools or Lighthouse to verify

### 12.2 Keyboard Navigation

- **All interactive elements** tabbable: links, buttons, inputs, dropdowns, modals
- **Logical tab order**: Follows visual flow
- **Visible focus indicators**: 2px outline, contrasting color
- **Skip links**: "Skip to main content" at top of page
- **Modal focus trap**: Can't tab outside modal
- **Escape key**: Closes modals, dropdowns, menus

### 12.3 Screen Reader Support

- **Images**: Descriptive alt text (decorative images: `alt=""`)
- **Form labels**: Explicit association with `for` attribute
- **Icon buttons**: `aria-label` for context
- **ARIA landmarks**:

  ```html
  <header role="banner">
  <nav role="navigation" aria-label="Main">
  <main role="main">
  <footer role="contentinfo">
  ```

- **ARIA live regions**: Toast notifications `aria-live="polite"`
- **Heading hierarchy**: Logical h1→h2→h3, no skipping

### 12.4 Interactive Component Patterns

- **Buttons**: `<button>` element, not `<div onclick>`
- **Links**: `<a href>` with descriptive text
- **Dropdowns**: `<select>` or ARIA `role="listbox"`
- **Tabs**: `role="tablist"`, `role="tab"`, `aria-selected`
- **Accordions**: `aria-expanded`, `aria-controls`
- **Modals**: `<dialog>` element or `role="dialog"`, `aria-modal="true"`

### 12.5 Testing Requirements

- **Automated**: axe DevTools (0 violations)
- **Keyboard**: Tab through all pages
- **Screen reader**: Test with NVDA (Windows) or VoiceOver (macOS/iOS)
- **CI/CD**: Include accessibility tests in pipeline

---

## 13. SEO Strategy

### 13.1 Meta Tags Per Page Type

**All Pages:**

```html
<title>{Specific Title} | Hospeda</title>
<meta name="description" content="{150-160 char description}" />
<link rel="canonical" href="{canonical URL}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="{canonical URL}" />
<meta property="og:title" content="{Title}" />
<meta property="og:description" content="{Description}" />
<meta property="og:image" content="{1200x630 image}" />
<meta property="og:locale" content="es_AR" />
<meta property="og:site_name" content="Hospeda" />
<meta name="twitter:card" content="summary_large_image" />
```

**Accommodation Detail:**

```html
<title>{Name} - {Type} en {Destination} | Hospeda</title>
<meta name="description" content="{Summary highlighting amenities, location}" />
```

**Event Detail:**

```html
<title>{Event Name} - {Date} en {Location} | Hospeda</title>
<meta property="article:published_time" content="{ISO 8601}" />
```

**Blog Post:**

```html
<title>{Post Title} | Blog Hospeda</title>
<meta property="article:author" content="{Author}" />
<meta property="article:section" content="{Category}" />
<meta property="article:tag" content="{Tag}" />
```

### 13.2 Structured Data (JSON-LD)

**Accommodation (schema.org/LodgingBusiness):**

```json
{
  "@context": "https://schema.org",
  "@type": "LodgingBusiness",
  "name": "{name}",
  "image": ["{images}"],
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "{street}",
    "addressLocality": "{city}",
    "addressRegion": "{state}",
    "addressCountry": "AR"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": {lat},
    "longitude": {lng}
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": {rating},
    "reviewCount": {count}
  }
}
```

**Event (schema.org/Event):**

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "{name}",
  "startDate": "{ISO 8601}",
  "endDate": "{ISO 8601}",
  "location": {
    "@type": "Place",
    "name": "{venue}",
    "address": "{address}"
  },
  "organizer": {
    "@type": "Organization",
    "name": "{organizer}"
  }
}
```

**Blog Post (schema.org/Article):**

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{title}",
  "image": "{featuredImage}",
  "datePublished": "{ISO 8601}",
  "author": {
    "@type": "Person",
    "name": "{author}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Hospeda",
    "logo": "{logo URL}"
  }
}
```

**Breadcrumbs (schema.org/BreadcrumbList):**

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Inicio",
      "item": "https://hospeda.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "{Section}",
      "item": "{URL}"
    }
  ]
}
```

### 13.3 Sitemap & Robots

**XML Sitemap** (`/sitemap.xml`):

- All static pages (priority 0.8-1.0)
- All dynamic pages (priority 0.6)
- Update frequency: daily for dynamic, weekly for static
- Use `@astrojs/sitemap` integration

**Robots.txt** (`/robots.txt`):

```
User-agent: *
Allow: /
Disallow: /mi-cuenta/
Disallow: /auth/

Sitemap: https://hospeda.com/sitemap.xml
```

### 13.4 hreflang Tags

```html
<link rel="alternate" hreflang="es" href="https://hospeda.com/es/alojamientos/hotel/" />
<link rel="alternate" hreflang="en" href="https://hospeda.com/en/alojamientos/hotel/" />
<link rel="alternate" hreflang="pt" href="https://hospeda.com/pt/alojamientos/hotel/" />
<link rel="alternate" hreflang="x-default" href="https://hospeda.com/es/alojamientos/hotel/" />
```

**Note:** All URLs include the locale prefix, including the default locale (ES). The `x-default` points to the ES version.

---

## 14. Performance Requirements

### 14.1 Core Web Vitals Targets

- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1

### 14.2 Lighthouse Score Targets

- **Performance**: ≥ 90
- **Accessibility**: ≥ 95 (target 100)
- **Best Practices**: ≥ 95
- **SEO**: ≥ 95 (target 100)

### 14.3 Resource Budgets

- **Total page weight**: < 1.5 MB (compressed)
- **JavaScript bundle**: < 200 KB (compressed)
- **CSS bundle**: < 50 KB (compressed)
- **Above-fold images**: < 500 KB total (compressed)

### 14.4 Optimization Techniques

**Images:**

- **Formats**: WebP (primary), AVIF (progressive), JPG/PNG (fallback)
- **Responsive**: `srcset` with 320w, 640w, 1024w, 1920w
- **Lazy loading**: `loading="lazy"` below fold
- **LQIP**: Blur placeholders while loading
- **Dimensions**: Width/height in HTML to prevent CLS
- **CDN**: Serve from CDN

**Code Splitting:**

- Route-based splitting (Astro default)
- Component-based splitting: `client:idle`, `client:visible`
- Dynamic imports for heavy libraries

**CSS:**

- Inline critical CSS
- Defer non-critical CSS
- Use Tailwind CSS v4 JIT for minimal bundle

**Fonts:**

- `font-display: swap` to prevent FOIT
- Preload critical fonts
- Subset fonts (Latin + Spanish chars)

**Third-party Scripts:**

- Load analytics async
- Defer non-critical scripts
- Use facades for embeds (YouTube: thumbnail → player on click)

**Caching:**

- Static assets: `Cache-Control: public, max-age=31536000, immutable`
- HTML: `Cache-Control: public, max-age=300` (5 min)

---

## 15. Internationalization & Currency

### 15.1 Supported Languages

- **Spanish (ES)**: Default, Argentinian variant
- **English (EN)**: International English
- **Portuguese (PT)**: Brazilian variant

### 15.2 Translation Structure

**Namespaces:**

```
packages/i18n/src/locales/
  ├── es/
  │   ├── common.json       (Buttons, labels, errors)
  │   ├── nav.json          (Navigation, header, footer)
  │   ├── auth.json         (Sign in, sign up, etc.)
  │   ├── accommodations.json
  │   ├── destinations.json
  │   ├── events.json
  │   ├── blog.json
  │   └── account.json
  ├── en/
  │   └── ... (same structure)
  └── pt/
      └── ... (same structure)
```

**Example (`es/accommodations.json`):**

```json
{
  "title": "Alojamientos",
  "filters": {
    "type": "Tipo",
    "price": "Precio",
    "amenities": "Amenidades"
  },
  "types": {
    "hotel": "Hotel",
    "cabin": "Cabaña",
    "apartment": "Apartamento"
  },
  "sort": {
    "featured": "Destacados",
    "price_asc": "Precio: menor a mayor",
    "rating": "Mejor calificados"
  },
  "noResults": "No se encontraron alojamientos",
  "contactOwner": "Contactar propietario"
}
```

### 15.3 Content Translation

**Static UI**: Pre-translated in JSON files

**Dynamic content** (DB entities):

- Each entity has fields: `{field}_es`, `{field}_en`, `{field}_pt`
- API returns content in requested language
- Fallback: If translation missing, show ES + badge "Translation unavailable"

### 15.4 Date/Number Formatting

**Use Intl API:**

```typescript
// Dates
const formatter = new Intl.DateTimeFormat(locale, {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

// Numbers
const numberFormatter = new Intl.NumberFormat(locale);

// Currency (see 15.5 for currency resolution)
const currencyFormatter = new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: resolvedCurrency // ARS, BRL, or USD
});
```

### 15.5 Currency Conversion

**Prices in the platform (plans, subscriptions) must display in the user's preferred currency.**

**Currency Resolution Logic:**

1. Check authenticated user's `preferredCurrency` in profile settings
2. If not set (or unauthenticated), derive from locale:
   - `ES` → `ARS` (Pesos Argentinos)
   - `PT` → `BRL` (Reales Brasileros)
   - `EN` → `USD` (Dolares Estadounidenses)

**Default currency mapping:**

| Locale | Currency | Symbol | Format Example |
|---|---|---|---|
| ES | ARS | $ | $5.000,00 |
| PT | BRL | R$ | R$5.000,00 |
| EN | USD | US$ | US$5.00 |

**User Preferences:**

- Authenticated users can override currency in `/mi-cuenta/preferencias/`
- Options: ARS, BRL, USD (extensible)
- Stored as `preferredCurrency` field in user profile

**Conversion Rates:**

- Exchange rate data is stored in the DB (see `exchangeRate` table)
- Base prices are stored in ARS in the platform
- Conversion is applied at render time using the stored rates
- When displaying converted prices, show a disclaimer: "Precio orientativo, sujeto a variacion del tipo de cambio"
- The actual exchange rate integration (API fetching, auto-update, admin management) is defined in SPEC-007

> **IMPLEMENTATION NOTE (hardcoded/mocked for SPEC-005):**
>
> - DO NOT create the `exchangeRates` DB table. SPEC-007 owns that table with a more complete schema.
> - The `PriceDisplay` component MUST use hardcoded fallback rates (e.g. `{ ARS_USD: 0.00089, ARS_BRL: 0.0049 }`).
> - Display all prices in ARS only as the primary currency. Show conversion as "approximate" with disclaimer.
> - The `preferredCurrency` field on the user model CAN be added by SPEC-005 (it's a simple field addition).
> - When SPEC-007 is implemented, it will provide a real `getExchangeRate()` service that replaces the hardcoded fallback.

**DB Schema Addition (for this spec):**

```typescript
// User model addition
{
  preferredCurrency: "ARS" | "BRL" | "USD" | null // null = derive from locale
}

// Exchange rate table - DO NOT CREATE. Owned by SPEC-007.
// Use hardcoded fallback rates in PriceDisplay until SPEC-007 is implemented.
// {
//   fromCurrency: string,  // e.g. "ARS"
//   toCurrency: string,    // e.g. "USD"
//   rate: number,          // e.g. 0.00089
//   source: string,        // e.g. "dolarapi", "manual"
//   updatedAt: DateTime
// }
```

**Pricing Display Component:**

```tsx
interface PriceDisplayProps {
  amountARS: number;       // Base price in ARS
  locale: string;          // Current locale
  userCurrency?: string;   // User's preferred currency override
  showDisclaimer?: boolean; // Show conversion disclaimer
}
```

---

## 16. Interactive Features & Libraries

### 16.1 Maps Integration

**Library**: Leaflet (open source) OR Mapbox GL JS (if budget allows)

**Decision criteria:**

- Leaflet: Free, OSM tiles, good for basic needs
- Mapbox: Better styling, performance, costs after free tier

**Implementation:**

```tsx
// MapView.client.tsx
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

interface MapViewProps {
  markers: Array<{
    id: string;
    lat: number;
    lng: number;
    popup: React.ReactNode;
  }>;
  center: [number, number];
  zoom: number;
}

export function MapView({ markers, center, zoom }: MapViewProps) {
  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '500px' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {markers.map(m => (
        <Marker key={m.id} position={[m.lat, m.lng]}>
          <Popup>{m.popup}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

**Usage:**

- Accommodation list: Map view with all markers
- Accommodation detail: Single marker
- Destination detail: Destination marker + nearby POIs
- Event detail: Venue marker

### 16.2 Forms

**Library**: React Hook Form + Zod resolver

**Example:**

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(2, 'Name required'),
  email: z.string().email('Invalid email'),
  message: z.string().min(20, 'Message too short')
});

export function ContactForm({ accommodationId }: { accommodationId: string }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(contactSchema)
  });

  const onSubmit = async (data) => {
    // API call
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}
      {/* ... */}
    </form>
  );
}
```

### 16.3 Favorites/Bookmarks

**Implementation:**

```tsx
// FavoriteButton.client.tsx
import { HeartIcon } from '@repo/icons';

export function FavoriteButton({ entityId, entityType, initialFavorited }: Props) {
  const { user } = useSession();
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [showAuthPopover, setShowAuthPopover] = useState(false);

  const mutation = useMutation({
    mutationFn: () => isFavorited
      ? api.delete(`/bookmarks/${entityId}`)
      : api.post('/bookmarks', { entityId, entityType }),
    onMutate: () => {
      // Optimistic update
      setIsFavorited(!isFavorited);
    },
    onError: () => {
      // Revert on error
      setIsFavorited(isFavorited);
      toast.error('Error al actualizar favoritos');
    },
  });

  const handleClick = () => {
    if (!user) {
      // Show auth popover instead of redirecting
      setShowAuthPopover(true);
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={mutation.isPending}
        aria-label={isFavorited ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      >
        <HeartIcon
          size={20}
          color={isFavorited ? 'red' : 'currentColor'}
          className={isFavorited ? 'fill-red-500' : ''}
        />
      </button>

      {/* Auth Required Popover (shown for all auth-required features) */}
      {showAuthPopover && (
        <AuthRequiredPopover
          message="Para guardar favoritos necesitas una cuenta"
          onClose={() => setShowAuthPopover(false)}
          locale={locale}
        />
      )}
    </div>
  );
}
```

**AuthRequiredPopover (shared component for all auth-gated features):**

```tsx
// components/shared/AuthRequiredPopover.client.tsx
interface AuthRequiredPopoverProps {
  message: string;
  onClose: () => void;
  locale: string;
}

export function AuthRequiredPopover({ message, onClose, locale }: AuthRequiredPopoverProps) {
  // Close on Escape key
  // Close on click outside
  // Positioned relative to trigger element

  return (
    <div role="dialog" aria-label="Autenticacion requerida">
      <p>{message}</p>
      <a href={`/${locale}/auth/signin/?returnUrl=${window.location.pathname}`}>
        Iniciar sesion
      </a>
      <a href={`/${locale}/auth/signup/`}>
        Registrarse
      </a>
    </div>
  );
}
```

### 16.4 Reviews

**Features:**

- Star rating (1-5)
- Text review (min 20 chars)
- Optional photo uploads (max 5)
- Display with user info, date, photos
- Owner responses (future)

**API:**

- `POST /api/v1/reviews` - Create review
- `GET /api/v1/reviews?entityType={type}&entityId={id}` - List reviews

### 16.5 Newsletter

**Newsletter requires user authentication.** There is NO email-only subscription form.

**How it works:**

1. User must be authenticated to subscribe to the newsletter
2. Newsletter subscription is managed as a toggle in `/mi-cuenta/preferencias/`
3. Stored as `newsletterOptIn: boolean` field in the user profile
4. Opt-in is explicit (GDPR/marketing compliance)
5. User can unsubscribe at any time from preferences

**Unauthenticated users:**

- Footer/CTAs show a newsletter promotion section with a message like "Suscribite a nuestro newsletter para recibir novedades"
- Clicking the CTA shows the `AuthRequiredPopover` (shared component)
- No email input field for anonymous users

**Authenticated users:**

- Footer shows newsletter status (subscribed/not subscribed) with toggle
- Full management in preferences page

**Implementation:**

```tsx
// NewsletterCTA.client.tsx (for footer/promotional sections)
export function NewsletterCTA({ locale }: { locale: string }) {
  const { user } = useSession();
  const [showAuthPopover, setShowAuthPopover] = useState(false);

  if (user) {
    // Show toggle for authenticated users
    return <NewsletterToggle locale={locale} currentStatus={user.newsletterOptIn} />;
  }

  return (
    <div className="relative">
      <div className="newsletter-promo">
        <p>{t('newsletter.promoText')}</p>
        <button onClick={() => setShowAuthPopover(true)}>
          {t('newsletter.subscribe')}
        </button>
      </div>

      {showAuthPopover && (
        <AuthRequiredPopover
          message="Para suscribirte al newsletter necesitas una cuenta"
          onClose={() => setShowAuthPopover(false)}
          locale={locale}
        />
      )}
    </div>
  );
}

// NewsletterToggle.client.tsx (for preferences page and footer)
export function NewsletterToggle({ locale, currentStatus }: Props) {
  const mutation = useMutation({
    mutationFn: (optIn: boolean) => api.patch('/users/me/preferences', { newsletterOptIn: optIn }),
    onMutate: () => { /* optimistic toggle */ },
    onError: () => { /* revert + error toast */ },
  });

  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={currentStatus}
        onChange={(e) => mutation.mutate(e.target.checked)}
        disabled={mutation.isPending}
      />
      {t('newsletter.subscribed')}
    </label>
  );
}
```

**DB Schema Addition:**

```typescript
// User model addition
{
  newsletterOptIn: boolean // default: false
}
```

---

## 17. User Stories & Acceptance Criteria

### 17.1 Homepage & Discovery

#### US-001: View Homepage

**As a** first-time visitor
**I want** to see an engaging homepage with featured content
**So that** I understand what Hospeda offers

**Given** a visitor lands on `/`
**When** the page loads
**Then** a hero section appears with:

- Regional imagery (river, islands, nature)
- Tagline highlighting the platform value
- Global search input
**And** featured sections appear for:
- Accommodations (6 items)
- Destinations (4 items)
- Events (4 items)
- Blog posts (3 items)
**And** each section has a "Ver más" link
**And** the page is responsive (mobile/tablet/desktop)

**Given** a mobile visitor
**When** the homepage loads
**Then** featured sections stack vertically
**And** images are optimized (WebP, responsive srcset)

#### US-002: Global Search

**As a** visitor
**I want** to search across all content types
**So that** I can quickly find what I'm looking for

**Given** a visitor on any page
**When** they type in the search input
**Then** autocomplete suggestions appear grouped by type
**And** each suggestion shows icon, title, brief description

**Given** a visitor submits the search
**When** they press Enter or click search button
**Then** they're redirected to `/busqueda?q={query}`
**And** results show items from all entity types

**Given** no results found
**When** the search returns empty
**Then** an empty state appears with:

- Custom illustration
- Message "No encontramos resultados para '{query}'"
- Suggestions for popular searches

### 17.2 Accommodations

#### US-003: Browse Accommodations

**As a** tourist
**I want** to browse and filter accommodations
**So that** I can find one that fits my needs

**Given** a visitor navigates to `/alojamientos/`
**When** the page loads
**Then** a grid of accommodation cards appears (3 columns desktop, 2 tablet, 1 mobile)
**And** a filter sidebar shows: Type, Price Range, Destination, Amenities, Rating
**And** a view toggle allows Grid/Map switching
**And** a sort dropdown allows: Featured, Price (asc/desc), Rating, Recent

**Given** a visitor applies filters
**When** they select filter options
**Then** URL updates with query params
**And** the list updates without full page reload
**And** active filters show with clear buttons

**Given** a visitor switches to map view
**When** they click the map toggle
**Then** a map appears with markers for each accommodation
**And** clicking a marker opens a popup with accommodation card
**And** markers cluster when zoomed out

#### US-004: View Accommodation Detail

**As a** tourist
**I want** to view complete accommodation information
**So that** I can decide whether to contact the owner

**Given** a visitor clicks an accommodation card
**When** `/alojamientos/[slug]/` loads
**Then** the page shows:

- Photo gallery (main image + thumbnails, lightbox on click)
- Breadcrumbs: "Inicio > Alojamientos > {name}"
- Name, type badge, location, rating, price
- Description (rich text rendered from TipTap JSON)
- Amenities grid with icons
- Location map with marker
- Contact form
- Reviews section
- FAQ accordion
- Similar accommodations
- Share buttons
- Favorite heart icon

**Given** an authenticated user
**When** they click the favorite heart
**Then** the accommodation is added to favorites
**And** a toast appears "Agregado a favoritos"
**And** the heart fills with color

**Given** an unauthenticated user
**When** they click the favorite heart
**Then** a contextual popover appears explaining authentication is required
**And** the popover shows "Iniciar sesion" and "Registrarse" buttons
**And** the user is NOT redirected away from the current page
**And** the popover closes on click outside or Escape key

#### US-005: Write Review

**As an** authenticated user
**I want** to write a review
**So that** I can share my experience

**Given** an authenticated user on an accommodation detail page
**When** they click "Escribir reseña"
**Then** a review form modal opens with:

- Star rating selector (1-5)
- Textarea for comment (min 20 chars)
- Photo upload (optional, max 5)
- Submit button

**Given** the user submits the form
**When** validation passes
**Then** the review is created via API
**And** a success toast appears "¡Gracias por tu reseña!"
**And** the review appears in the list

**Given** the user already reviewed this accommodation
**When** they try to write another review
**Then** an error appears "Ya has escrito una reseña para este alojamiento"

### 17.3 Destinations

#### US-006: Browse Destinations

**As a** tourist
**I want** to browse destinations
**So that** I can plan where to visit

**Given** a visitor navigates to `/destinos/`
**When** the page loads
**Then** a grid of destination cards appears
**And** each card shows: image, name, summary, "Explorar" button
**And** a search/filter bar allows filtering by name or tag

#### US-007: View Destination Guide

**As a** tourist
**I want** to view a complete destination guide
**So that** I can learn about the place

**Given** a visitor clicks a destination card
**When** `/destinos/[slug]/` loads
**Then** the page shows:

- Hero section with name and large image
- Breadcrumbs: "Inicio > Destinos > {name}"
- Tabbed/sectioned content:
  - Description (travel guide)
  - Gallery (photos with lightbox)
  - Climate info
  - How to get there
  - What to do (attractions)
  - Accommodations in this destination
  - Events in this destination
  - Related blog posts
- Map showing destination location
- Share buttons and favorite icon

**Given** no accommodations exist for this destination
**When** the accommodations section renders
**Then** an empty state appears "Aún no hay alojamientos registrados en este destino"

### 17.4 Events

#### US-008: Browse Events

**As a** local or tourist
**I want** to browse events in a calendar
**So that** I can discover what's happening

**Given** a visitor navigates to `/eventos/`
**When** the page loads
**Then** a calendar view shows the current month
**And** event dates are highlighted
**And** below the calendar is a filterable event list
**And** filters include: Date Range, Category, Location, Free/Paid
**And** a toggle switches between Upcoming and Past events

**Given** a visitor clicks a calendar date
**When** the date is selected
**Then** the event list filters to show only events on that date

#### US-009: View Event Detail

**As a** visitor
**I want** to view event details
**So that** I can decide whether to attend

**Given** a visitor clicks an event
**When** `/eventos/[slug]/` loads
**Then** the page shows:

- Breadcrumbs: "Inicio > Eventos > {name}"
- Event name, category badge, date/time, location
- Featured image or gallery
- Description
- Schedule/agenda (if multi-session)
- Ticket/pricing info with external link
- Organizer info and contact
- Related events
- Share buttons and favorite icon

**Given** an event has passed
**When** the detail page loads
**Then** a badge appears "Evento finalizado"
**And** ticket section shows "Este evento ya finalizó"

### 17.5 Blog

#### US-010: Browse Blog

**As a** content consumer
**I want** to browse blog posts
**So that** I can read travel content

**Given** a visitor navigates to `/publicaciones/`
**When** the page loads
**Then** a magazine-style layout appears:

- One large featured post card (image, title, excerpt, author, date, reading time)
- Grid of recent posts (2-3 columns)
**And** a sidebar shows post categories
**And** clicking a category filters posts

#### US-011: Read Blog Post

**As a** visitor
**I want** to read a full blog post
**So that** I can consume the content

**Given** a visitor clicks a post card
**When** `/publicaciones/[slug]/` loads
**Then** the page shows:

- Breadcrumbs: "Inicio > Blog > {category} > {title}"
- Featured image, title, author, date, reading time
- Full content with readable typography (rendered from TipTap JSON)
- Tags section
- Share buttons
- Related posts (3-6 items)

### 17.6 Authentication

#### US-012: Sign Up

**As a** visitor
**I want** to create an account
**So that** I can access authenticated features

**Given** a visitor navigates to `/auth/signup/`
**When** the page loads
**Then** a signup form appears with:

- First name, last name, email, password fields
- Social signup buttons (Google, Facebook)
- Password requirements shown (min 8 chars)
- Terms checkbox "Acepto los términos y condiciones"
- Link to signin "¿Ya tienes cuenta? Inicia sesión"

**Given** a visitor submits valid data
**When** the form is submitted
**Then** a user account is created
**And** they're redirected to the return URL or homepage
**And** the header shows user avatar and "Mi Cuenta"

#### US-013: Sign In

**As a** registered user
**I want** to sign in
**So that** I can access my account

**Given** a user navigates to `/auth/signin/`
**When** the page loads
**Then** a signin form appears with:

- Email and password fields
- Social signin buttons (Google, Facebook)
- "Forgot password?" link
- Link to signup "¿No tienes cuenta? Regístrate"

**Given** a user submits valid credentials
**When** authentication succeeds
**Then** they're redirected to the return URL or homepage
**And** the header shows their avatar and "Mi Cuenta" dropdown

### 17.7 User Account

#### US-014: View Account Dashboard

**As an** authenticated user
**I want** to view my account dashboard
**So that** I can see my activity and manage my profile

**Given** an authenticated user navigates to `/mi-cuenta/`
**When** the dashboard loads
**Then** the page shows:

- Profile summary (avatar, name, email, edit button)
- Stats (favorites count, reviews count)
- Recent activity (recent favorites, reviews)
- Notifications
- Favorites tabs (Accommodations, Destinations, Events, Blog)
- Reviews list

#### US-015: Manage Favorites

**As an** authenticated user
**I want** to manage my favorites
**So that** I can keep track of items I'm interested in

**Given** an authenticated user on any entity detail page
**When** they click the favorite heart
**Then** the item is added to favorites via API
**And** the heart fills with color
**And** a toast appears "Agregado a favoritos"

**Given** the heart is clicked again
**When** the item is already favorited
**Then** the item is removed
**And** the heart becomes outlined
**And** a toast appears "Eliminado de favoritos"

**Given** a user navigates to `/mi-cuenta/favoritos/`
**When** the page loads
**Then** tabs appear for each entity type
**And** each tab shows a grid of favorited items
**And** each card has a remove button

### 17.8 Information Pages

#### US-016: View Pricing

**As a** potential owner or tourist
**I want** to see pricing plans
**So that** I can understand the cost

**Given** a visitor navigates to `/{lang}/precios/turistas/`
**When** the page loads
**Then** the page shows:

- Benefits section highlighting value
- Pricing cards for Free, Plus, VIP plans
- Features list per plan
- CTA "Empezar ahora" or "Mas informacion"
- **Prices displayed in currency derived from locale** (ARS for ES, BRL for PT, USD for EN)
- If user is authenticated and has a preferred currency set, use that instead
- When showing converted prices, a disclaimer appears: "Precio orientativo, sujeto a variacion del tipo de cambio"

**Given** a visitor navigates to `/{lang}/precios/propietarios/`
**When** the page loads
**Then** the page shows:

- Benefits for owners
- Pricing cards for Basic, Professional, Premium plans
- Testimonials from owners (if available)
- Strong CTA to contact or sign up
- **Prices in locale-derived or user-preferred currency** (same rules as tourist pricing)

#### US-017: Contact Hospeda

**As a** visitor
**I want** to contact the Hospeda team
**So that** I can ask questions

**Given** a visitor navigates to `/contacto/`
**When** the page loads
**Then** a contact form appears with:

- Name, email, subject, message fields
- Submit button
**And** contact information is displayed (email, social media)

**Given** a visitor submits the form
**When** the API succeeds
**Then** a success message appears "Mensaje enviado. Te responderemos pronto."

---

## 18. Scope Definition

### 18.1 In Scope

**Pages:**

- All 40+ pages listed in Section 8 (Page Inventory)
- Homepage, accommodations, destinations, events, blog, auth, account, information pages

**Features:**

- Full responsive design (mobile-first)
- Trilingual support (ES/EN/PT)
- Authentication (Better Auth, OAuth)
- Search (global + entity-specific filters)
- Maps (Leaflet/Mapbox)
- Reviews system
- Favorites/bookmarks
- Contact forms
- Newsletter subscription
- Share functionality

**Design:**

- Complete design system with CSS variables
- Regional color palette (river blues, greens, earth tones)
- Typography system (Playfair Display + Inter)
- Custom illustrations for empty states, errors
- Animation system with View Transitions
- Light theme (dark mode prepared)

**Technical:**

- WCAG 2.1 AA accessibility
- SEO optimization (metadata, structured data, sitemap)
- Performance optimization (Lighthouse 90+, Core Web Vitals)
- Testing (TDD, 90% coverage)

### 18.2 Out of Scope

**Admin Features:**

- Accommodation/destination/event/post management (Admin app)
- User role/permission management (Admin app)
- Billing/subscription management UI (Admin app)
- Analytics dashboard (Admin app)

**Advanced Features (Future):**

- Dark mode implementation
- Offline support / PWA
- Blog comments/discussion
- Social features (user profiles, follow)
- Real-time notifications
- Booking/reservation system
- Payment processing on public web
- AI recommendations
- User-generated content beyond reviews

**Third-party Integrations (Future):**

- WhatsApp Business API
- Instagram feed
- YouTube channel
- Third-party booking engines

**Content:**

- Actual content creation (editorial work)
- SEO content strategy (marketing work)

### 18.3 Assumptions

- API endpoints exist or will be created
- Database schema supports all required fields
- Better Auth is configured
- Email service (Resend) is configured
- Image CDN/storage exists
- Domain and hosting are configured (Vercel)

### 18.4 Dependencies

**Backend:**

- All entity CRUD endpoints
- Authentication endpoints (Better Auth)
- Review endpoints
- Bookmark endpoints
- Contact form endpoints
- Newsletter endpoints

**Services:**

- Better Auth
- Resend (email)
- Leaflet/Mapbox (maps)
- Image CDN
- Google Fonts

**Packages:**

- `@repo/schemas`
- `@repo/i18n`
- `@repo/service-core`
- `@repo/billing`
- `@repo/auth-ui`
- Astro, React, Tailwind CSS v4

---

## Approval & Next Steps

**Status**: Draft v3 - under review

**Next Steps:**

1. User reviews and approves this functional specification
2. `tech-analyzer` agent creates technical analysis document
3. `task-planner` agent creates task breakdown with TODOs
4. Development begins with TDD approach

---

## 19. Related Specifications

This spec references and depends on features defined in separate specifications:

| Spec ID | Title | Relationship |
|---|---|---|
| SPEC-006 | Destination Hierarchy System | Defines hierarchical destination structure used in routing |
| SPEC-007 | Exchange Rate Integration | Defines API integration for currency conversion rates (this spec only adds DB fields) |
| SPEC-008 | Phosphor Icons Migration | Migrates @repo/icons from custom SVGs to Phosphor Icons library |
| SPEC-009 | Admin ISR/Regeneration Management | Defines admin panel UI for managing page regeneration, cron config, and revalidation |

**Dependency notes:**

- SPEC-005 can proceed without SPEC-007.. exchange rates can be manually set initially
- SPEC-005 can proceed without SPEC-008.. current @repo/icons work as-is
- SPEC-005 can proceed without SPEC-009.. ISR defaults work without admin UI
- SPEC-006 affects destination routing structure but has its own implementation timeline

**Hardcoded/Mocked areas (DO NOT implement fully in SPEC-005):**

| Area | What SPEC-005 does | What is deferred | Owner Spec |
|---|---|---|---|
| Exchange Rates | Hardcoded fallback rates in `PriceDisplay`, `preferredCurrency` user field | `exchangeRates` table, API fetching, cron jobs, admin rate management | SPEC-007 |
| Icons | Uses current `@repo/icons` SVG components as-is | Phosphor Icons migration, weight system, visual verification | SPEC-008 |
| ISR Management | Astro/Vercel built-in ISR with time-based intervals | `/api/revalidate` endpoint, page registry tables, admin regeneration UI, webhook triggers | SPEC-009 |

---

## Changelog

### v3 (2026-02-13) - User feedback integration

- **Images**: Changed from `@astrojs/image` to `astro:assets` with `<Image />` + `inferSize` + `image.remotePatterns` for DB images
- **Rich text**: Changed from Markdown to TipTap/ProseMirror JSON stored as JSONB, rendered server-side
- **i18n URLs**: ALL URLs now include locale prefix (including default ES `/es/`), root `/` only redirects
- **Currency**: Added currency conversion system (locale-derived + user preference override). DB fields added, API integration deferred to SPEC-007
- **Auth popover**: All auth-required features show contextual popover instead of redirecting to signin page
- **ISR strategy**: Changed to hybrid (ISR + on-demand revalidation + cron) with detailed change categorization table
- **Icons**: Changed from Phosphor wrapper to existing `@repo/icons` individual components. Phosphor migration deferred to SPEC-008
- **Visual feedback**: Added mandatory directive (Section 11.4) requiring visible feedback for ALL user interactions
- **Optimistic updates**: Added mandatory directive (Section 11.5) requiring optimistic updates wherever applicable
- **Newsletter**: Changed from email-only form to requiring user authentication, managed as toggle in user preferences
- **Admin regeneration**: Deferred to SPEC-009 as separate feature
- **Route structure**: Added Astro file structure showing `[lang]/` directory layout

### v2 (2026-02-12) - Initial draft

- Complete specification created

---

End of Specification
