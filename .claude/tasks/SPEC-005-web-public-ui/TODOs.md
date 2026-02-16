# SPEC-005. Hospeda Public Web Application (web2). Built from Scratch

## Progress. 95/95 tasks (100%)

**Average Complexity.** 2.6/4 (max)
**Critical Path.** 11 steps (T-001 → T-002 → T-005 → T-006 → T-018 → T-019 → T-020 → T-033 → T-039 → T-040 → T-044)
**Parallel Tracks.** 1 (all tasks depend on T-001)

---

### Setup Phase

- [x] **T-001** (complexity. 2). Initialize Astro project scaffolding for apps/web2
  - Create apps/web2 with package.json (name. hospeda-web2), astro.config.mjs (Astro 5, React integration, Vercel...
  - Blocked by. none
  - Blocks. T-002, T-003, T-004, T-005, T-095

- [x] **T-002** (complexity. 3). Configure Tailwind CSS v4 and design system CSS variables
  - Set up Tailwind CSS v4 with @tailwindcss/vite plugin. Create src/styles/global.css with ALL CSS variables fro...
  - Blocked by. T-001
  - Blocks. T-005, T-006, T-007, T-008, T-012, T-013, T-014, T-015, T-016, T-017, T-030, T-032, T-034, T-035, T-036, T-037, T-038, T-040, T-041, T-062

- [x] **T-003** (complexity. 2). Set up Vitest testing infrastructure
  - Configure vitest.config.ts using Astro's getViteConfig. Set up jsdom environment. Create test/setup.tsx with ...
  - Blocked by. T-001
  - Blocks. none

- [x] **T-004** (complexity. 2). Configure environment variables and validation
  - Create src/env.ts with Zod schema validation for HOSPEDA_API_URL, HOSPEDA_SITE_URL (with PUBLIC_ fallbacks). ...
  - Blocked by. T-001
  - Blocks. none

- [x] **T-005** (complexity. 2). Create animation system CSS
  - Implement all keyframes from SPEC-005 Section 11.1. fadeIn, slideUp, scaleIn, shimmer. Add prefers-reduced-m...
  - Blocked by. T-001, T-002
  - Blocks. T-006

---

### Core Phase

#### Layout Components

- [x] **T-006** (complexity. 3). Create BaseLayout.astro
  - Create layouts/BaseLayout.astro as the HTML shell. Props. { title, description, image?, noindex?, locale }. I...
  - Blocked by. T-002, T-005
  - Blocks. T-009, T-010, T-011, T-018, T-021, T-090

- [x] **T-007** (complexity. 1). Create Container.astro component
  - Create components/ui/Container.astro. Props. { size?: 'sm'|'md'|'lg'|'xl', class? }. Renders a div with max-w...
  - Blocked by. T-002
  - Blocks. none

- [x] **T-008** (complexity. 1). Create Section.astro component
  - Create components/ui/Section.astro. Props. { title?, subtitle?, class?, id? }. Renders semantic section eleme...
  - Blocked by. T-002
  - Blocks. none

- [x] **T-009** (complexity. 3). Create Header.astro with navigation
  - Create layouts/Header.astro. Props. { user?, locale }. Includes. logo (link to /[locale]/), main nav links (A...
  - Blocked by. T-006
  - Blocks. T-037, T-043, T-045

- [x] **T-010** (complexity. 3). Create Footer.astro
  - Create layouts/Footer.astro. Props. { locale }. Includes. site links organized by category (Explorar, Informa...
  - Blocked by. T-006
  - Blocks. T-045

- [x] **T-011** (complexity. 2). Create Breadcrumb.astro component
  - Create components/ui/Breadcrumb.astro. Props. { items. { label. string, href. string }[] }. Renders nav with ...
  - Blocked by. T-006
  - Blocks. T-022

#### UI Primitives

- [x] **T-012** (complexity. 2). Create Button.astro component
  - Create components/ui/Button.astro. Props. { variant. 'primary'|'secondary'|'outline'|'ghost', size. 'sm'|'md'...
  - Blocked by. T-002
  - Blocks. T-023, T-024, T-025, T-026, T-027, T-028, T-029, T-031

- [x] **T-013** (complexity. 3). Create form input components
  - Create components/ui/Input.astro (text input), components/ui/Textarea.astro (multi-line), components/ui/Selec...
  - Blocked by. T-002
  - Blocks. none

- [x] **T-014** (complexity. 1). Create Checkbox, Radio, Label, and FormError components
  - Create components/ui/Checkbox.astro, Radio.astro, Label.astro (with required indicator), FormError.astro (wit...
  - Blocked by. T-002
  - Blocks. none

- [x] **T-015** (complexity. 1). Create Badge.astro component
  - Create components/ui/Badge.astro. Props. { label. string, variant. 'primary'|'secondary'|'outline', class? }....
  - Blocked by. T-002
  - Blocks. T-023, T-024, T-025, T-026

- [x] **T-016** (complexity. 2). Create Skeleton.astro loading component
  - Create components/ui/Skeleton.astro. Props. { type. 'card'|'text'|'image', count?. number, class? }. Uses shi...
  - Blocked by. T-002
  - Blocks. none

- [x] **T-017** (complexity. 1). Create EmptyState.astro component
  - Create components/ui/EmptyState.astro. Props. { title. string, message. string, cta?. { label. string, href. ...
  - Blocked by. T-002
  - Blocks. none

#### Routing & i18n

- [x] **T-018** (complexity. 3). Set up [lang] routing with language detection
  - Create pages/index.astro that redirects to /{detected-locale}/ based on Accept-Language header or default ES....
  - Blocked by. T-006
  - Blocks. T-019, T-045, T-046, T-047, T-048, T-049, T-050, T-052, T-053, T-054, T-055, T-056, T-072, T-073, T-074, T-075, T-076

- [x] **T-019** (complexity. 3). Create Astro middleware for locale and auth
  - Create src/middleware.ts. Validate [lang] param against supported locales (es, en, pt), redirect invalid to /...
  - Blocked by. T-018
  - Blocks. T-020, T-077, T-078, T-079, T-080, T-081, T-082, T-092

- [x] **T-020** (complexity. 3). Integrate @repo/i18n package with Astro
  - Create src/lib/i18n.ts with helper functions. getTranslations(locale, namespace), t(key) helper. Create React...
  - Blocked by. T-019
  - Blocks. T-033, T-039, T-042, T-043, T-044, T-085

#### SEO

- [x] **T-021** (complexity. 3). Create SEO meta tags component
  - Create components/seo/SEOHead.astro. Props. { title, description, canonical, image?, noindex?, locale, type?....
  - Blocked by. T-006
  - Blocks. none

- [x] **T-022** (complexity. 3). Create JSON-LD structured data components
  - Create components/seo/JsonLd.astro generic wrapper. Create specific helpers. LodgingBusinessJsonLd(accommodat...
  - Blocked by. T-011
  - Blocks. none

#### Entity Cards

- [x] **T-023** (complexity. 3). Create AccommodationCard.astro
  - Create components/accommodation/AccommodationCard.astro. Props. { accommodation, showFavorite?, locale }. Rend...
  - Blocked by. T-012, T-015
  - Blocks. T-057, T-059, T-060, T-071

- [x] **T-024** (complexity. 2). Create DestinationCard.astro
  - Create components/destination/DestinationCard.astro. Props. { destination, locale }. Renders. featured image,...
  - Blocked by. T-012, T-015
  - Blocks. T-063, T-064, T-071

- [x] **T-025** (complexity. 2). Create EventCard.astro
  - Create components/event/EventCard.astro. Props. { event, locale }. Renders. featured image, name (h3), catego...
  - Blocked by. T-012, T-015
  - Blocks. T-065, T-067, T-071

- [x] **T-026** (complexity. 2). Create BlogPostCard.astro
  - Create components/blog/BlogPostCard.astro. Props. { post, variant?. 'default'|'featured', locale }. Renders. ...
  - Blocked by. T-012, T-015
  - Blocks. T-068, T-069, T-071

- [x] **T-027** (complexity. 2). Create ReviewCard.astro
  - Create components/review/ReviewCard.astro. Props. { review, showEntity?. boolean }. Renders. user avatar + na...
  - Blocked by. T-012
  - Blocks. T-084

#### Content Components

- [x] **T-028** (complexity. 2). Create HeroSection.astro
  - Create components/content/HeroSection.astro. Props. { image. string, title. string, subtitle?. string, cta?. ...
  - Blocked by. T-012
  - Blocks. T-045

- [x] **T-029** (complexity. 2). Create FeaturedSection.astro
  - Create components/content/FeaturedSection.astro. Props. { title. string, viewAllHref?. string, viewAllLabel?....
  - Blocked by. T-012
  - Blocks. T-045

- [x] **T-030** (complexity. 2). Create AmenitiesList.astro
  - Create components/accommodation/AmenitiesList.astro. Props. { amenities. Array<{ name, icon, slug }> }. Grid ...
  - Blocked by. T-002
  - Blocks. T-059

- [x] **T-031** (complexity. 2). Create PricingCard.astro
  - Create components/content/PricingCard.astro. Props. { plan. { name, price, currency, features, cta }, highlig...
  - Blocked by. T-012
  - Blocks. T-052, T-053

- [x] **T-032** (complexity. 1). Create TestimonialCard.astro
  - Create components/content/TestimonialCard.astro. Props. { quote. string, author. string, image?. string, role...
  - Blocked by. T-002
  - Blocks. none

- [x] **T-070** (complexity. 3). Create TipTap JSON to HTML renderer
  - Create src/lib/tiptap-renderer.ts. Server-side function that converts TipTap/ProseMirror JSON to HTML. Suppor...
  - Blocked by. T-068
  - Blocks. T-069

#### Interactive Components

- [x] **T-033** (complexity. 3). Create Toast notification system
  - Create store/toast-store.ts using Zustand with add/remove/clear actions. Toast types. success, error, warning...
  - Blocked by. T-020
  - Blocks. T-039, T-051

- [x] **T-034** (complexity. 3). Create Modal.client.tsx using native dialog
  - Create components/ui/Modal.client.tsx. Props. { title, children, onClose, open }. Uses native <dialog> elemen...
  - Blocked by. T-002
  - Blocks. T-061, T-083

- [x] **T-035** (complexity. 3). Create Tabs.client.tsx
  - Create components/ui/Tabs.client.tsx. Props. { tabs. Array<{ id, label, content }>, defaultTab? }. ARIA patte...
  - Blocked by. T-002
  - Blocks. T-064

- [x] **T-036** (complexity. 2). Create AccordionFAQ.client.tsx using native details
  - Create components/ui/AccordionFAQ.client.tsx. Props. { items. Array<{ question, answer }> }. Uses native <det...
  - Blocked by. T-002
  - Blocks. T-059

- [x] **T-037** (complexity. 3). Create MobileMenu.client.tsx using native dialog
  - Create components/ui/MobileMenu.client.tsx. Props. { navItems. Array<{ label, href }>, locale, user? }. Slide...
  - Blocked by. T-002, T-009
  - Blocks. none

- [x] **T-038** (complexity. 2). Create ShareButtons.client.tsx
  - Create components/ui/ShareButtons.client.tsx. Props. { url, title, text }. Uses Web Share API when available,...
  - Blocked by. T-002
  - Blocks. none

- [x] **T-039** (complexity. 3). Create FavoriteButton.client.tsx with optimistic updates
  - Create components/ui/FavoriteButton.client.tsx. Props. { entityId, entityType, initialFavorited?, locale }. O...
  - Blocked by. T-020, T-033, T-040
  - Blocks. none

- [x] **T-040** (complexity. 2). Create AuthRequiredPopover.client.tsx
  - Create components/auth/AuthRequiredPopover.client.tsx. Props. { message, onClose, locale }. Contextual popove...
  - Blocked by. T-002
  - Blocks. T-039, T-044

- [x] **T-041** (complexity. 1). Create ViewToggle.client.tsx
  - Create components/ui/ViewToggle.client.tsx. Props. { defaultView. 'grid'|'map', onChange. (view) => void }. T...
  - Blocked by. T-002
  - Blocks. T-057

- [x] **T-042** (complexity. 3). Create SearchBar.client.tsx
  - Create components/search/SearchBar.client.tsx. Props. { onSearch, placeholder, locale }. Text input with sear...
  - Blocked by. T-020
  - Blocks. T-045

- [x] **T-043** (complexity. 3). Create UserNav.client.tsx
  - Create components/auth/UserNav.client.tsx. Props. { user, locale }. Dropdown with user avatar, name, menu ite...
  - Blocked by. T-009, T-020
  - Blocks. none

- [x] **T-044** (complexity. 3). Create NewsletterCTA.client.tsx
  - Create components/newsletter/NewsletterCTA.client.tsx. Props. { locale }. For unauthenticated. promo text + s...
  - Blocked by. T-020, T-040
  - Blocks. none

- [x] **T-051** (complexity. 3). Create ContactForm.client.tsx
  - Create components/forms/ContactForm.client.tsx. React Hook Form + Zod validation. Fields. name (min 2), email...
  - Blocked by. T-033, T-050
  - Blocks. none

- [x] **T-058** (complexity. 4). Create FilterSidebar.client.tsx
  - Create components/accommodation/FilterSidebar.client.tsx. Props. { filters, onApply, locale }. Filter section...
  - Blocked by. T-057
  - Blocks. none

- [x] **T-061** (complexity. 4). Create ImageGallery.client.tsx
  - Create components/ui/ImageGallery.client.tsx. Props. { images. Array<{ src, alt }> }. Main image display + th...
  - Blocked by. T-034
  - Blocks. T-059

- [x] **T-062** (complexity. 4). Create MapView.client.tsx with Leaflet
  - Create components/map/MapView.client.tsx. Props. { markers. Array<{ id, lat, lng, popup }>, center, zoom }. I...
  - Blocked by. T-002
  - Blocks. T-057

- [x] **T-066** (complexity. 4). Create CalendarView.client.tsx
  - Create components/event/CalendarView.client.tsx. Props. { events. Array<{ date, id, name }>, onDateSelect, lo...
  - Blocked by. T-065
  - Blocks. none

- [x] **T-083** (complexity. 4). Create ReviewForm.client.tsx
  - Create components/review/ReviewForm.client.tsx. Props. { entityId, entityType, locale }. React Hook Form + Zo...
  - Blocked by. T-034
  - Blocks. none

- [x] **T-084** (complexity. 3). Create ReviewList.client.tsx
  - Create components/review/ReviewList.client.tsx. Props. { entityId, entityType, locale }. Fetches reviews from...
  - Blocked by. T-027
  - Blocks. none

#### Pages - Static

- [x] **T-045** (complexity. 4). Create Homepage
  - Create pages/[lang]/index.astro. Uses BaseLayout. Hero section with regional imagery, tagline, SearchBar (cli...
  - Blocked by. T-009, T-010, T-018, T-028, T-029, T-042
  - Blocks. T-086, T-087, T-088, T-089, T-093, T-094

- [x] **T-046** (complexity. 2). Create About Us page
  - Create pages/[lang]/quienes-somos.astro. SSG. Uses BaseLayout. Breadcrumbs. About content. mission, values, t...
  - Blocked by. T-018
  - Blocks. none

- [x] **T-047** (complexity. 2). Create Benefits page
  - Create pages/[lang]/beneficios.astro. SSG. Uses BaseLayout. Breadcrumbs. Benefits for tourists and owners wit...
  - Blocked by. T-018
  - Blocks. none

- [x] **T-048** (complexity. 1). Create Terms & Conditions page
  - Create pages/[lang]/terminos-condiciones.astro. SSG. Uses BaseLayout. Breadcrumbs. Legal content layout with ...
  - Blocked by. T-018
  - Blocks. none

- [x] **T-049** (complexity. 1). Create Privacy Policy page
  - Create pages/[lang]/privacidad.astro. SSG. Uses BaseLayout. Breadcrumbs. Legal content layout. SEOHead. Tests...
  - Blocked by. T-018
  - Blocks. none

- [x] **T-050** (complexity. 2). Create Contact page
  - Create pages/[lang]/contacto.astro. SSG. Uses BaseLayout. Breadcrumbs. ContactForm (React island, client.idle...
  - Blocked by. T-018
  - Blocks. T-051

- [x] **T-054** (complexity. 2). Create HTML Sitemap page
  - Create pages/[lang]/sitemap.astro. SSG. Uses BaseLayout. Breadcrumbs. Organized links to all main pages by se...
  - Blocked by. T-018
  - Blocks. none

- [x] **T-055** (complexity. 2). Create 404 error page
  - Create pages/404.astro. SSG. Uses BaseLayout (simplified). Custom illustration (regional theme). Friendly mes...
  - Blocked by. T-018
  - Blocks. none

- [x] **T-056** (complexity. 2). Create 500 error page
  - Create pages/500.astro. SSG. Uses BaseLayout (simplified). Custom illustration. Error message. Retry/home lin...
  - Blocked by. T-018
  - Blocks. none

#### Pages - Accommodations

- [x] **T-057** (complexity. 4). Create Accommodation List page
  - Create pages/[lang]/alojamientos/index.astro. SSR. Uses BaseLayout. Breadcrumbs. Grid of AccommodationCards (...
  - Blocked by. T-023, T-041, T-062
  - Blocks. T-058

- [x] **T-059** (complexity. 4). Create Accommodation Detail page
  - Create pages/[lang]/alojamientos/[slug].astro. SSG with ISR. Breadcrumbs (Inicio > Alojamientos > {name}). Ph...
  - Blocked by. T-023, T-030, T-036, T-061
  - Blocks. T-088, T-091, T-093, T-094

- [x] **T-060** (complexity. 3). Create Accommodation by Type page
  - Create pages/[lang]/alojamientos/tipo/[type].astro. SSR. Validates type against AccommodationType enum. Bread...
  - Blocked by. T-023
  - Blocks. none

#### Pages - Destinations

- [x] **T-063** (complexity. 3). Create Destination List page
  - Create pages/[lang]/destinos/index.astro. SSG. Uses BaseLayout. Breadcrumbs. Grid of DestinationCards. Search...
  - Blocked by. T-024
  - Blocks. none

- [x] **T-064** (complexity. 4). Create Destination Detail page
  - Create pages/[lang]/destinos/[...path].astro. SSG with ISR. Breadcrumbs (Inicio > Destinos > {name}). Hero wi...
  - Blocked by. T-024, T-035
  - Blocks. T-093

#### Pages - Events

- [x] **T-065** (complexity. 4). Create Event List page
  - Create pages/[lang]/eventos/index.astro. SSR. Uses BaseLayout. Breadcrumbs. CalendarView React island (client...
  - Blocked by. T-025
  - Blocks. T-066

- [x] **T-067** (complexity. 3). Create Event Detail page
  - Create pages/[lang]/eventos/[slug].astro. SSG with ISR. Breadcrumbs (Inicio > Eventos > {name}). Event info. ...
  - Blocked by. T-025
  - Blocks. T-093

#### Pages - Blog

- [x] **T-068** (complexity. 3). Create Blog List page
  - Create pages/[lang]/publicaciones/index.astro. SSR. Uses BaseLayout. Breadcrumbs. Featured post (large BlogPo...
  - Blocked by. T-026
  - Blocks. T-070

- [x] **T-069** (complexity. 3). Create Blog Post Detail page
  - Create pages/[lang]/publicaciones/[slug].astro. SSG with ISR. Breadcrumbs (Inicio > Blog > {category} > {titl...
  - Blocked by. T-026, T-070
  - Blocks. T-093

#### Pages - Search

- [x] **T-071** (complexity. 3). Create Search Results page
  - Create pages/[lang]/busqueda.astro. SSR. Uses BaseLayout. Breadcrumbs. Reads ?q= query param. Results grouped...
  - Blocked by. T-023, T-024, T-025, T-026
  - Blocks. none

#### Pages - Auth

- [x] **T-072** (complexity. 3). Create Sign In page
  - Create pages/[lang]/auth/signin.astro. SSG, noindex. Uses BaseLayout. Email + password form. Social signin bu...
  - Blocked by. T-018
  - Blocks. none

- [x] **T-073** (complexity. 3). Create Sign Up page
  - Create pages/[lang]/auth/signup.astro. SSG, noindex. Uses BaseLayout. Registration form. first name, last nam...
  - Blocked by. T-018
  - Blocks. none

- [x] **T-074** (complexity. 2). Create Forgot Password page
  - Create pages/[lang]/auth/forgot-password.astro. SSG, noindex. Email input form. Submit sends reset email. Suc...
  - Blocked by. T-018
  - Blocks. none

- [x] **T-075** (complexity. 2). Create Reset Password page
  - Create pages/[lang]/auth/reset-password.astro. SSR (token validation). New password + confirm password form. ...
  - Blocked by. T-018
  - Blocks. none

- [x] **T-076** (complexity. 2). Create Verify Email page
  - Create pages/[lang]/auth/verify-email.astro. SSR (token validation). Shows verification status (success/error...
  - Blocked by. T-018
  - Blocks. none

#### Pages - Account

- [x] **T-077** (complexity. 3). Create Account Dashboard page
  - Create pages/[lang]/mi-cuenta/index.astro. SSR, auth required. Uses BaseLayout. Profile summary (avatar, name...
  - Blocked by. T-019
  - Blocks. none

- [x] **T-078** (complexity. 3). Create Edit Profile page
  - Create pages/[lang]/mi-cuenta/editar.astro. SSR, auth required. Profile edit form (React island). name, email...
  - Blocked by. T-019
  - Blocks. none

- [x] **T-079** (complexity. 3). Create Favorites page
  - Create pages/[lang]/mi-cuenta/favoritos.astro. SSR, auth required. Tabs by entity type (Alojamientos, Destino...
  - Blocked by. T-019
  - Blocks. none

- [x] **T-080** (complexity. 2). Create My Reviews page
  - Create pages/[lang]/mi-cuenta/resenas.astro. SSR, auth required. List of user's ReviewCards. Empty state. Tes...
  - Blocked by. T-019
  - Blocks. none

- [x] **T-081** (complexity. 3). Create Preferences page
  - Create pages/[lang]/mi-cuenta/preferencias.astro. SSR, auth required. Language selector dropdown (ES, EN, PT)...
  - Blocked by. T-019
  - Blocks. none

- [x] **T-082** (complexity. 3). Create Subscription page
  - Create pages/[lang]/mi-cuenta/suscripcion.astro. SSR, auth required. Shows current plan (Free/Plus/VIP). Plan...
  - Blocked by. T-019
  - Blocks. none

#### Pages - Pricing

- [x] **T-052** (complexity. 3). Create Tourist Pricing page
  - Create pages/[lang]/precios/turistas.astro. SSG. Uses BaseLayout. Breadcrumbs. Benefits section. PricingCards...
  - Blocked by. T-018, T-031
  - Blocks. none

- [x] **T-053** (complexity. 3). Create Owner Pricing page
  - Create pages/[lang]/precios/propietarios.astro. SSG. Uses BaseLayout. Breadcrumbs. Owner benefits. PricingCar...
  - Blocked by. T-018, T-031
  - Blocks. none

#### Currency

- [x] **T-085** (complexity. 3). Create PriceDisplay component
  - Create components/ui/PriceDisplay.astro (and .client.tsx for interactive). Props. { amountARS. number, locale...
  - Blocked by. T-020
  - Blocks. none

---

### Integration Phase

- [x] **T-086** (complexity. 2). Configure @astrojs/sitemap for XML sitemap
  - Configure @astrojs/sitemap in astro.config.mjs. Include all public routes. Exclude /auth/ and /mi-cuenta/ pat...
  - Blocked by. T-045
  - Blocks. none

- [x] **T-087** (complexity. 1). Create robots.txt
  - Create public/robots.txt. Allow all crawlers. Disallow /mi-cuenta/ and /auth/. Reference sitemap.xml. Tests. ...
  - Blocked by. T-045
  - Blocks. none

- [x] **T-088** (complexity. 3). Set up View Transitions for page navigation
  - Configure Astro View Transitions in BaseLayout. Add view-transition-name to hero images for card-to-detail mo...
  - Blocked by. T-045, T-059
  - Blocks. none

- [x] **T-089** (complexity. 2). Implement navigation progress indicator
  - Add top-of-page progress bar during page navigation. Thin colored bar at top. Shows during View Transition na...
  - Blocked by. T-045
  - Blocks. none

- [x] **T-090** (complexity. 2). Optimize font loading
  - Add preconnect links for Google Fonts in BaseLayout. Set font-display.swap on all font faces. Preload critica...
  - Blocked by. T-006
  - Blocks. none

- [x] **T-091** (complexity. 3). Configure image optimization with astro:assets
  - Configure astro.assets Image component. Set up image.remotePatterns for DB images in astro.config. Create reu...
  - Blocked by. T-059
  - Blocks. none

- [x] **T-092** (complexity. 3). Implement auth middleware for protected routes
  - Enhance src/middleware.ts to check Better Auth session for /mi-cuenta/ routes. If not authenticated, redirect...
  - Blocked by. T-019
  - Blocks. none

---

### Testing Phase

- [x] **T-093** (complexity. 4). Create accessibility automated tests
  - Set up axe-core integration for automated accessibility testing. Create test suite that renders key pages and...
  - Blocked by. T-045, T-059, T-064, T-067, T-069
  - Blocks. none

- [x] **T-094** (complexity. 3). Create SEO validation tests
  - Create test suite validating SEO across pages. Check. title format ('{Page} | Hospeda'), meta description len...
  - Blocked by. T-045, T-059
  - Blocks. none

---

### Docs Phase

- [x] **T-095** (complexity. 2). Create CLAUDE.md for apps/web2
  - Create apps/web2/CLAUDE.md documenting. architecture overview, directory structure, key commands (dev, build,...
  - Blocked by. T-001
  - Blocks. none

---

## Dependency Graph

**Level 0 (no dependencies).**

- T-001

**Level 1 (depends on Level 0).**

- T-002, T-003, T-004, T-005, T-095

**Level 2 (depends on Levels 0-1).**

- T-006, T-007, T-008, T-012, T-013, T-014, T-015, T-016, T-017, T-030, T-032, T-034, T-035, T-036, T-037, T-038, T-040, T-041, T-062

**Level 3 (depends on Levels 0-2).**

- T-009, T-010, T-011, T-018, T-021, T-023, T-024, T-025, T-026, T-027, T-028, T-029, T-031, T-061, T-090

**Level 4 (depends on Levels 0-3).**

- T-019, T-022, T-037, T-043, T-045, T-046, T-047, T-048, T-049, T-050, T-052, T-053, T-054, T-055, T-056, T-057, T-059, T-060, T-063, T-064, T-065, T-067, T-068, T-071, T-072, T-073, T-074, T-075, T-076, T-083, T-084

**Level 5 (depends on Levels 0-4).**

- T-020, T-051, T-058, T-066, T-070, T-077, T-078, T-079, T-080, T-081, T-082, T-086, T-087, T-088, T-089, T-091, T-092, T-093, T-094

**Level 6 (depends on Levels 0-5).**

- T-033, T-042, T-044, T-069, T-085

**Level 7 (depends on Levels 0-6).**

- T-039

---

## Suggested Start

Begin with **T-001** (complexity. 2). Initialize Astro project scaffolding for apps/web2. It has no dependencies and unblocks 5 other tasks (T-002, T-003, T-004, T-005, T-095).

After T-001, prioritize **T-002** (complexity. 3). Configure Tailwind CSS v4 and design system CSS variables. It unblocks 20 tasks and is on the critical path.
