---
specId: SPEC-157
title: Web SEO Polish — Audit Backlog Remediation
status: in-progress
complexity: high
owner: qazuor
created: 2026-05-24
parent: (none)
related:
  - SPEC-096 (web-beta-readiness — original web SEO foundation)
  - SPEC-142 (csp-phase-2 — related web hardening work)
  - SPEC-099 (home-audit-remediation — prior home page audit)
---

# SPEC-157 — Web SEO Polish

> **Status**: IN-PROGRESS — findings captured from an exhaustive SEO audit of `apps/web`
> conducted 2026-05-24. The web app's SEO foundation is mature; this spec addresses the
> remaining polish and fix backlog discovered in that audit.

## 1. Origin

A full SEO audit of `apps/web` (Astro 6, `output:'server'` SSR, i18n es/en/pt subpath routing,
vanilla CSS + CSS Modules, Cloudinary image CDN, `@repo/i18n`) was conducted on 2026-05-24.
The audit surfaced 19 findings across three risk tiers. Several findings have direct SEO impact
(crawler traps, unsharable OG images, duplicate meta tags); others are correctness/accessibility
issues with secondary SEO consequences. All are addressed in this spec.

**URL-strategy decision (locked before spec):** For the sitemap Spanish-prefix issue (Finding 2),
the fix is to emit `/es/...` URLs in the sitemap to match the existing canonical — keeping `/es/`
as the canonical for Spanish. The larger "unprefixed `es` canonical + remove subpath prefix"
rewrite is explicitly out of scope.

## 2. Goals

- Eliminate all critical SEO defects that cause measurable ranking or indexing harm.
- Fix correctness issues in meta tags, sitemap, and structured data that mislead crawlers.
- Improve Core Web Vitals signals where quick wins are available (LCP image path).
- Establish testing coverage for sitemap output, HTTP status codes, and OG endpoint.

## 3. Non-Goals

- URL-strategy rewrite: removing `/es/` subpath prefix from Spanish canonicals, restructuring
  the sitemap around unprefixed Spanish URLs, or changing language negotiation behavior at the
  Astro config level. This is a major architectural change with migration complexity and is
  deferred indefinitely.
- Full Core Web Vitals overhaul (image lazy-load strategy beyond the LCP fix, JS bundle
  splitting, font subset optimisation for third-party typefaces).
- Analytics or conversion tracking changes.
- Admin panel SEO (not public-facing).
- Internationalisation content expansion (adding translation keys beyond the skip-link fix).

## 4. Scope

### In scope

- OG image endpoint rendering PNG output (Phase 1).
- Dynamic sitemap Spanish-prefix fix (Phase 1).
- LCP image server-side rendering with dimensions and priority hint (Phase 1).
- Resource hints: preconnect to Cloudinary and API origins; LCP preload (Phase 2).
- Homepage structured data: WebSite + Organization JSON-LD (Phase 2).
- RSS/Atom feed for blog (`/publicaciones/`) and events (Phase 2).
- JSON-LD component adoption or deletion — single canonical path (Phase 2).
- `og:image` absolute URL coercion + missing OG/Twitter dimension and alt meta (Phase 2).
- Above-the-fold card images: remove unconditional `loading="lazy"` for first row (Phase 2).
- Body-hide font gate in `BaseLayout.astro`: reconsider/remove (Phase 2).
- Duplicate `<meta name="description">` in `BaseLayout.astro` (Phase 2).
- Dynamic sitemap hreflang `xhtml:link` alternates (Phase 2).
- Heading hierarchy: related-content carousel `<h3>` → `<h2>` (Phase 3).
- Event card image alt text (Phase 3).
- Skip-link i18n (Phase 3).
- `robots.txt` Sitemap URL: env-derived instead of hardcoded prod domain (Phase 3).
- `robots.txt` `Disallow` alignment with sitemap filter exclusions (Phase 3).
- `<meta name="theme-color">` + manifest `theme_color` reconciliation (Phase 3).
- Locale redirect status: 302 → 301 (Phase 3).

### Out of scope

- `/es/` → unprefixed canonical rewrite (URL-strategy deferred — see Non-Goals).
- Implementing or evaluating a new image CDN solution.
- Changing authentication flows or the `/mi-cuenta/` UX.
- Server-side rendering strategy changes beyond the specific LCP fix.
- SEO for the admin app.

## 5. Decisions needed (open before implementation)

Two findings require a small architectural decision before work begins:

### D-1: JSON-LD component strategy (Finding 7)

`LodgingBusinessJsonLd`, `ArticleJsonLd`, `EventJsonLd`, and `PlaceJsonLd` exist in
`apps/web/src/components/seo/` and are documented in `apps/web/CLAUDE.md` as canonical,
but none are actually imported anywhere. Detail pages hand-roll JSON-LD inline, and the
two codebases have already diverged (`ArticleJsonLd.astro:53` uses wrong TLD `hospeda.com`
vs the real `hospeda.com.ar`).

Options:
1. **Adopt** — Wire the existing components everywhere detail pages emit JSON-LD.
   Establishes a single source of truth. Requires an audit pass per entity type.
   *Recommended* — consistent with the project's Single Source of Truth principle.
2. **Delete** — Remove the unused components and accept hand-rolled inline JSON-LD
   as the pattern. Simpler short-term, but no enforcement against drift.

**Default recommendation:** Option 1 (adopt). The TLD fix in `ArticleJsonLd.astro:53`
is required regardless.

### D-2: `theme_color` brand value (Finding 18)

The web manifest declares `theme_color: "#10B981"` (green). Project brand-primary is
documented as blue (river palette). Before emitting `<meta name="theme-color">` in HTML,
confirm the intended value — options are: keep green (current manifest), align to river
blue from `@repo/design-tokens`, or use neutral white/transparent.

These decisions should be resolved before Phase 3 implementation starts. Phase 1 and
Phase 2 work is unblocked.

## 6. Requirements by phase

### Phase 1 — Critical (must ship before Phase 2)

---

#### REQ-1: OG image endpoint must return PNG

**Finding:** `apps/web/src/pages/api/og.ts:45` returns `Content-Type: image/svg+xml`. The
JSDoc at line 15 incorrectly claims the output is PNG. All social platforms (Facebook,
X/Twitter, LinkedIn, WhatsApp) reject SVG for Open Graph image previews. Every page that
does not supply an explicit `og:image` path suffers invisible preview failures.

**Requirement:** The `/api/og` endpoint must render and return a valid PNG image at 1200×630
pixels with `Content-Type: image/png`. The implementation approach (satori + `@vercel/og`,
or `resvg-js` to rasterise the existing SVG template) is an implementation decision.

**Acceptance criteria:**

```
Given a GET request to /api/og (with any valid query parameters),
When the server processes the request,
Then the response has Content-Type: image/png,
And the response body is a valid PNG binary,
And the image dimensions are 1200x630 pixels.
```

```
Given a social platform crawler fetching the og:image URL,
When it requests /api/og,
Then it receives a renderable PNG image (not SVG),
And the image is not rejected or replaced with a fallback by the platform.
```

**Affected files:**
- `apps/web/src/pages/api/og.ts` (lines 15, 45 — JSDoc + Content-Type)

**Testing:** Vitest test asserting `Content-Type: image/png` and non-empty binary response.

---

#### REQ-2: Dynamic sitemap Spanish URLs must match page canonicals

**Finding:** `apps/web/src/pages/sitemap-dynamic.xml.ts:22-26` defines the `es` locale
entry with `prefix: ''` (empty string). This causes the dynamic sitemap to emit unprefixed
Spanish URLs such as `/alojamientos/{slug}/`. These URLs return HTTP 302 (redirect to
`/es/alojamientos/{slug}/`) and do not match the `<link rel="canonical">` on the page.
Crawlers see a sitemap full of redirecting URLs that disagree with the declared canonical —
a crawl budget and indexing trust problem.

**Requirement:** The `es` locale entry in the dynamic sitemap generator must use
`prefix: '/es'` so every Spanish URL emitted by the sitemap returns HTTP 200 and matches
the page's declared canonical exactly.

Additionally, the static sitemap configuration in `astro.config.mjs` (lines ~113–157) must
be verified for consistency (same prefix strategy). No Spanish URL in any sitemap file may
differ from the canonical emitted on the corresponding page.

**Acceptance criteria:**

```
Given the dynamic sitemap is fetched (/sitemap-dynamic.xml or equivalent),
When the sitemap is parsed,
Then every URL for the 'es' locale begins with /es/,
And each of those URLs returns HTTP 200 when fetched directly,
And each returned page has a canonical tag matching the sitemap URL exactly.
```

```
Given the static sitemap produced by @astrojs/sitemap,
When it is parsed,
Then no Spanish-locale URL has a prefix mismatch relative to the canonical on that page.
```

**Affected files:**
- `apps/web/src/pages/sitemap-dynamic.xml.ts` (lines 22-26, `prefix: ''` for `es`)
- `apps/web/astro.config.mjs` (lines ~113-157, static sitemap i18n config)

**Testing:** Vitest test that renders the sitemap XML and asserts all `es` URLs start with
`/es/`; integration or e2e snapshot test asserting zero sitemap-URL → 302 responses.

---

#### REQ-3: LCP image must be server-rendered with dimensions and priority hint

**Finding:** On the accommodation detail page (`/[lang]/alojamientos/[slug]`), the top
SEO page, the hero/LCP image is a raw `<img>` with no `width`/`height` attributes and no
`fetchpriority` hint, rendered inside a `client:visible` React island:

- `apps/web/src/components/.../ImageGallery.client.tsx:217-222`
- Used by `apps/web/src/pages/[lang]/alojamientos/[slug].astro:411`

The `client:visible` directive means the image is not in the initial SSR HTML. The browser
cannot start fetching it until the component hydrates, which typically happens after the
viewport intersection observer fires — introducing a significant LCP delay.

A similar issue exists on the home hero: `HeroSection.astro:119` renders `HeroImageRotator`
with `client:load`, and the initial hero image lacks dimensions.

**Requirement:** For the accommodation detail page, the first/LCP hero image must be present
in the SSR HTML as a static Astro `<Image>` (or `<img>`) element with explicit `width` and
`height` attributes and `fetchpriority="high"`. The React island can progressively enhance
the gallery interaction on top of this server-rendered image, but the first image must not
be gated behind any hydration step.

For the home hero, the initial displayed image must similarly be server-rendered with
dimensions.

**Acceptance criteria:**

```
Given a request to an accommodation detail page (/[lang]/alojamientos/[slug]),
When the server returns the initial HTML (before any JS executes),
Then the HTML contains an <img> (or Astro <Image>) element for the hero image,
And that element has explicit width and height attributes set to non-zero values,
And that element has fetchpriority="high".
```

```
Given a request to the home page,
When the initial HTML is returned,
Then the HTML contains the initial hero image element,
And that element has explicit width and height attributes.
```

```
Given a Lighthouse or WebPageTest LCP audit on the accommodation detail page,
When measured on a cold load with no cache,
Then the LCP element is the hero image,
And the LCP candidate is present in the initial server HTML (not injected by JS).
```

**Affected files:**
- `apps/web/src/components/.../ImageGallery.client.tsx` (lines 217-222)
- `apps/web/src/pages/[lang]/alojamientos/[slug].astro` (line 411)
- `apps/web/src/components/.../HeroSection.astro` (line 119, HeroImageRotator)

**Testing:** Snapshot or DOM test asserting the SSR output of the detail page contains the
hero `<img>` with `fetchpriority="high"` before any client JS runs.

---

### Phase 2 — Important (ship after Phase 1 verified)

---

#### REQ-4: Add resource hints for Cloudinary and API origins

**Finding:** `apps/web/src/layouts/BaseLayout.astro` emits no `<link rel="preconnect">`
for `res.cloudinary.com` (the CDN serving all content images) nor for the API origin. No
`<link rel="preload">` for the LCP image exists at layout level.

**Requirement:** Add to `BaseLayout.astro` `<head>`:
- `<link rel="preconnect" href="https://res.cloudinary.com">`
- `<link rel="preconnect" href="{API_URL}">` (env-derived, not hardcoded)
- Optionally pass the LCP image URL as a prop so pages that know their LCP image can
  emit a `<link rel="preload" as="image">`.

**Acceptance criteria:**

```
Given any page rendered by BaseLayout,
When the HTML <head> is inspected,
Then a <link rel="preconnect" href="https://res.cloudinary.com"> is present.
```

```
Given any page rendered by BaseLayout,
When the HTML <head> is inspected,
Then a <link rel="preconnect"> for the API origin is present.
```

**Affected files:**
- `apps/web/src/layouts/BaseLayout.astro`

---

#### REQ-5: Add WebSite + Organization JSON-LD to homepage

**Finding:** `apps/web/src/pages/[lang]/index.astro` emits no site-level structured data.
Google's Sitelinks Searchbox feature requires `WebSite` with `potentialAction SearchAction`.
Organization structured data with `logo` and `sameAs` social links establishes brand
entity knowledge in Google's Knowledge Graph.

**Requirement:** The homepage (`/[lang]/index.astro`) must emit:
- `WebSite` JSON-LD with `name`, `url`, and `potentialAction` (type `SearchAction`,
  `target` pointing to `/[lang]/busqueda/?q={search_term_string}`, `query-input`
  `required name=search_term_string`).
- `Organization` JSON-LD with `name`, `url`, `logo`, and `sameAs` (social profile URLs).

Values must be i18n-aware for `name` and env-derived for `url`/`logo`. Social URLs can
be defined in a shared config constant.

**Acceptance criteria:**

```
Given a request to the home page (any supported locale),
When the returned HTML is parsed for JSON-LD script tags,
Then a WebSite structured data block is present,
And it contains a potentialAction of type SearchAction,
And the SearchAction target URL resolves to the site's search page.
```

```
Given a request to the home page,
When the returned HTML is parsed for JSON-LD script tags,
Then an Organization structured data block is present,
And it includes a logo URL pointing to a valid image,
And it includes at least one sameAs social URL.
```

**Affected files:**
- `apps/web/src/pages/[lang]/index.astro`
- Possibly a new `apps/web/src/components/seo/WebSiteJsonLd.astro` component (if adopting
  D-1 component pattern)

---

#### REQ-6: Add RSS/Atom feed for blog and events

**Finding:** `@astrojs/rss` is not installed. The `/publicaciones/` (blog) and events
sections have no syndication feed. Feed endpoints are standard discoverability signals
and enable content aggregators and podcast-style tools to surface the content.

**Requirement:** Add `@astrojs/rss` as a dependency to `apps/web` and implement:
- `apps/web/src/pages/[lang]/publicaciones/rss.xml.ts` — blog post feed.
- `apps/web/src/pages/[lang]/eventos/rss.xml.ts` — events feed.

Each feed must include: `title`, `description`, `link`, `pubDate`, and `content` (excerpt
or full body) per item. Feeds must respect the `[lang]` prefix so each locale gets its own
feed URL. `<link rel="alternate" type="application/rss+xml">` discovery hints must be added
in `BaseLayout.astro` when on the blog or events section.

**Acceptance criteria:**

```
Given a GET request to /es/publicaciones/rss.xml (or equivalent locale path),
When the server processes the request,
Then the response has Content-Type: application/xml or application/rss+xml,
And the response body is valid RSS 2.0 or Atom XML,
And the feed contains at least the most recent posts with title, link, and pubDate.
```

```
Given a request to the blog index page,
When the HTML <head> is inspected,
Then a <link rel="alternate" type="application/rss+xml"> pointing to the feed is present.
```

**Affected files:**
- `apps/web/package.json` (new `@astrojs/rss` dependency)
- `apps/web/src/pages/[lang]/publicaciones/rss.xml.ts` (new file)
- `apps/web/src/pages/[lang]/eventos/rss.xml.ts` (new file)
- `apps/web/src/layouts/BaseLayout.astro` (feed discovery `<link>`)

---

#### REQ-7: Resolve JSON-LD component strategy (adopt or delete)

**Finding:** Four typed JSON-LD Astro components (`LodgingBusinessJsonLd`, `ArticleJsonLd`,
`EventJsonLd`, `PlaceJsonLd`) in `apps/web/src/components/seo/` are documented in
`apps/web/CLAUDE.md` as canonical but none are imported by any page. Detail pages hand-roll
JSON-LD inline. The two codebases have already diverged: `ArticleJsonLd.astro:53` hardcodes
the wrong TLD `hospeda.com` instead of `hospeda.com.ar`.

**Requirement:**
1. The TLD bug (`hospeda.com` → `hospeda.com.ar`) in `ArticleJsonLd.astro:53` must be fixed
   regardless of the strategy decision.
2. Per decision D-1 (adopt, per recommendation): wire the existing typed components on every
   detail page that currently emits inline JSON-LD. Remove duplicate inline JSON-LD. If
   decision is delete: remove all four component files and update `apps/web/CLAUDE.md`.

**Acceptance criteria:**

```
Given ArticleJsonLd.astro renders a blog post structured data block,
When the output is inspected,
Then the publisher URL contains hospeda.com.ar (not hospeda.com).
```

```
Given a blog post detail page,
When its HTML is parsed for JSON-LD,
Then exactly one Article structured data block is present,
And it was emitted by the canonical ArticleJsonLd component (adopt path)
OR inline JSON-LD is the only occurrence and no ArticleJsonLd component file exists (delete path).
```

**Affected files:**
- `apps/web/src/components/seo/ArticleJsonLd.astro` (line 53 — TLD bug, required fix)
- `apps/web/src/components/seo/LodgingBusinessJsonLd.astro`
- `apps/web/src/components/seo/EventJsonLd.astro`
- `apps/web/src/components/seo/PlaceJsonLd.astro`
- `apps/web/CLAUDE.md` (documentation sync)
- All detail pages that emit inline JSON-LD (audit required at implementation time)

---

#### REQ-8: Coerce og:image to absolute URL; add dimension and alt meta

**Finding:** `apps/web/src/components/seo/SEOHead.astro:63` uses the `image` prop verbatim
without converting it to an absolute URL. If any page passes a relative path (e.g. `/og-image.png`),
the `og:image` tag will be invalid (relative URLs are not honoured by social scrapers). Additionally,
`og:image:width`, `og:image:height`, and `og:image:alt` meta tags are missing site-wide, as is
`twitter:image:alt`.

**Requirement:** In `SEOHead.astro`, the `image` prop must be coerced to an absolute URL using
`new URL(image, siteBase).href` before being emitted in `og:image`. The following additional
meta tags must be added when an image is present: `og:image:width` (1200), `og:image:height`
(630), `og:image:alt`, `twitter:image:alt`.

**Acceptance criteria:**

```
Given SEOHead receives a relative image path (e.g. /some-image.png),
When the HTML is rendered,
Then og:image contains an absolute URL beginning with https://.
```

```
Given SEOHead receives any image value (relative or absolute),
When the HTML is rendered,
Then og:image:width and og:image:height meta tags are present,
And og:image:alt is present with a non-empty value,
And twitter:image:alt is present with a non-empty value.
```

**Affected files:**
- `apps/web/src/components/seo/SEOHead.astro` (line 63)

---

#### REQ-9: Remove unconditional loading="lazy" from above-the-fold cards

**Finding:** `apps/web/src/components/.../AccommodationCard.astro:79` always sets
`loading="lazy"` on card images. When these cards appear in the first row of a listing
or featured grid (i.e. above the fold on page load), the browser defers fetching them,
which delays the LCP candidate on listing pages.

**Requirement:** `AccommodationCard.astro` must accept an optional boolean prop (e.g.
`eager: boolean = false`). When `eager` is true, the image must be rendered with
`loading="eager"` and `fetchpriority="high"`. Pages rendering above-the-fold card grids
must pass `eager={true}` to the first row of cards (implementation decision: first N cards
or a prop threaded from the parent).

**Acceptance criteria:**

```
Given a listing page rendering an AccommodationCard with eager=true,
When the rendered HTML is inspected,
Then the card image has loading="eager" (not loading="lazy"),
And fetchpriority="high" is present on the image element.
```

```
Given a listing page rendering an AccommodationCard without the eager prop (default),
When the rendered HTML is inspected,
Then the card image retains loading="lazy".
```

**Affected files:**
- `apps/web/src/components/.../AccommodationCard.astro` (line 79)
- Listing/featured grid pages that render the first row of cards

---

#### REQ-10: Remove or reconsider the full-page opacity:0 font gate

**Finding:** `apps/web/src/layouts/BaseLayout.astro:103-118` applies `opacity: 0` to the
`<body>` and transitions it to `opacity: 1` after fonts are considered loaded. Web fonts
already declare `font-display: swap` which prevents FOIT (flash of invisible text) without
hiding layout. The opacity gate reintroduces a full-page content delay on cold loads
(network cache miss for font files) and penalises FCP.

**Requirement:** The body opacity gate must be removed. If any visual flash is observed
without it in development, document the specific case and propose a targeted fix (e.g.
scoped opacity on a specific element) rather than a full-page gate. `font-display: swap`
is the correct and sufficient font rendering strategy for SEO.

**Acceptance criteria:**

```
Given a cold page load (no font cache),
When the page renders,
Then the page body is visible immediately (opacity: 1 or not set),
And no JavaScript-managed opacity transition delays first paint.
```

```
Given the BaseLayout.astro source,
When it is inspected,
Then there is no CSS rule setting body opacity to 0 on initial load,
And there is no script tag managing a body opacity transition for font loading.
```

**Affected files:**
- `apps/web/src/layouts/BaseLayout.astro` (lines 103-118)

---

#### REQ-11: Remove duplicate meta description from BaseLayout

**Finding:** `apps/web/src/layouts/BaseLayout.astro:86` emits its own
`<meta name="description">` tag. `SEOHead.astro:68` also emits `<meta name="description">`.
Since every page using `BaseLayout` also includes `SEOHead`, every page has two description
meta tags. Duplicate meta description tags are flagged as warnings by crawlers and can
cause unpredictable snippet selection.

**Requirement:** Remove the `<meta name="description">` line from `BaseLayout.astro`. The
canonical source must remain `SEOHead.astro:68`.

**Acceptance criteria:**

```
Given any page rendered through BaseLayout (which includes SEOHead),
When the rendered HTML head is parsed,
Then exactly one <meta name="description"> tag is present.
```

**Affected files:**
- `apps/web/src/layouts/BaseLayout.astro` (line 86)

**Testing:** DOM/snapshot test asserting a single description meta per rendered page.

---

#### REQ-12: Add hreflang xhtml:link alternates to dynamic sitemap

**Finding:** `apps/web/src/pages/sitemap-dynamic.xml.ts:247-250` builds the sitemap XML
for entity content (accommodations, posts, events, places) but does not emit
`<xhtml:link rel="alternate" hreflang="...">` alternates per URL, nor declares the
`xmlns:xhtml` namespace on the `<urlset>` element. The static sitemap (managed by
`@astrojs/sitemap`) already emits hreflang via its `serialize()` hook. Without hreflang
alternates on dynamic URLs, Googlebot cannot associate the Spanish, English, and Portuguese
versions of a given entity page — harming international SEO.

**Requirement:** The dynamic sitemap (`sitemap-dynamic.xml.ts`) must emit `xhtml:link`
hreflang alternates for each URL, mirroring the pattern used in the static sitemap's
`serialize()` function. The `<urlset>` element must declare
`xmlns:xhtml="http://www.w3.org/1999/xhtml"`. Each `<url>` block must include
`<xhtml:link rel="alternate" hreflang="{lang}" href="{canonical-url}"/>` for each
supported locale, plus `hreflang="x-default"` pointing to the Spanish (default) URL.

**Acceptance criteria:**

```
Given the dynamic sitemap XML is fetched,
When it is parsed,
Then the <urlset> element declares xmlns:xhtml="http://www.w3.org/1999/xhtml",
And each <url> block contains xhtml:link alternate entries for all supported locales (es, en, pt),
And each <url> block contains an xhtml:link entry with hreflang="x-default".
```

```
Given a specific accommodation entity in the sitemap,
When its alternate links are inspected,
Then the es alternate URL begins with /es/,
And the en alternate URL begins with /en/,
And the pt alternate URL begins with /pt/.
```

**Affected files:**
- `apps/web/src/pages/sitemap-dynamic.xml.ts` (lines 247-250)

**Testing:** Vitest test asserting hreflang alternates are present in the rendered sitemap
XML output.

---

### Phase 3 — Minor (ship after Phase 2 verified; decisions D-1 and D-2 resolved)

---

#### REQ-13: Fix heading hierarchy in related-content carousels

**Finding:** `apps/web/src/components/accommodation/RelatedCarousel.astro:32` uses `<h3>`
for the carousel section heading. If the carousel appears at the same structural level as
`<h2>` content blocks on the page (e.g. the main content sections), this creates an
incorrect heading hierarchy. Crawlers and screen readers use heading hierarchy to understand
page structure; an `<h3>` where `<h2>` is appropriate mislabels the section.

**Requirement:** The carousel section heading in `RelatedCarousel.astro` must use `<h2>`.
Any other related-content component with the same issue must be corrected in the same pass.

**Acceptance criteria:**

```
Given an accommodation detail page rendered with related content carousels,
When the heading hierarchy of the page is inspected,
Then the related-content carousel heading is an <h2> element,
And no heading level is skipped between the main content and carousel sections.
```

**Affected files:**
- `apps/web/src/components/accommodation/RelatedCarousel.astro` (line 32)

---

#### REQ-14: Fix empty alt text on event card featured images

**Finding:** `apps/web/src/components/event/EventCardFeatured.astro:141` and
`apps/web/src/components/event/EventCardHorizontal.astro:150` render featured images with
`alt=""`. This is inconsistent with other content card components and fails WCAG 1.1.1
(meaningful images require descriptive alt text). Crawlers also use alt text as an image
relevance signal.

**Requirement:** The featured image in both `EventCardFeatured.astro` and
`EventCardHorizontal.astro` must use `alt={title}` (or an i18n-translated equivalent
if a more descriptive string is available).

**Acceptance criteria:**

```
Given an event card (featured or horizontal variant) rendered with a title,
When the HTML image element is inspected,
Then the alt attribute contains a non-empty, meaningful string (at minimum: the event title).
```

**Affected files:**
- `apps/web/src/components/event/EventCardFeatured.astro` (line 141)
- `apps/web/src/components/event/EventCardHorizontal.astro` (line 150)

---

#### REQ-15: i18n the skip-link text

**Finding:** `apps/web/src/components/shared/navigation/SkipToContent.astro:17` hardcodes
the skip-link text in Spanish (`"Ir al contenido principal"` or similar). On English and
Portuguese locale pages, this presents a Spanish accessibility control — inconsistent with
the rest of the i18n strategy and confusing for screen reader users navigating in those
locales.

**Requirement:** The skip-link text must be sourced from `@repo/i18n` using an appropriate
key (e.g. `a11y.skipToContent`). Translation values for all three supported locales (es, en,
pt) must be added.

**Acceptance criteria:**

```
Given a page in the 'en' locale,
When the skip-link element is inspected,
Then its visible text is the English equivalent (e.g. "Skip to main content").
```

```
Given a page in the 'es' locale,
When the skip-link element is inspected,
Then its visible text is the Spanish equivalent.
```

**Affected files:**
- `apps/web/src/components/shared/navigation/SkipToContent.astro` (line 17)
- `packages/i18n/src/locales/{es,en,pt}.json` (new `a11y.skipToContent` key)

---

#### REQ-16: Derive robots.txt Sitemap URL from environment

**Finding:** `apps/web/src/pages/robots.txt.ts:33` hardcodes the Sitemap URL to the
production domain. On staging and local development environments, the `robots.txt` Sitemap
entry still points at `hospeda.com.ar`, so staging robots.txt is technically incorrect
(though `User-agent: * Disallow: /` on staging likely prevents indexing anyway).

**Requirement:** The Sitemap URL in `robots.txt.ts` must be derived from the `SITE_URL`
(or equivalent env var) at request time, not hardcoded. The value must resolve correctly
in all environments (local, staging, production).

**Acceptance criteria:**

```
Given robots.txt is requested on the staging environment,
When the Sitemap directive is inspected,
Then it points to the staging domain (not hospeda.com.ar).
```

```
Given robots.txt is requested on the production environment,
When the Sitemap directive is inspected,
Then it points to https://hospeda.com.ar/sitemap-index.xml.
```

**Affected files:**
- `apps/web/src/pages/robots.txt.ts` (line 33)

**Testing:** Unit test asserting the Sitemap URL varies with the injected site URL.

---

#### REQ-17: Align robots.txt Disallow rules with sitemap exclusions

**Finding:** `apps/web/astro.config.mjs:114-123` filters certain paths from the sitemap
(e.g. `/busqueda/`, `/feedback/`), but `apps/web/src/pages/robots.txt.ts:24-34` does not
include matching `Disallow` entries. Googlebot will attempt to crawl these pages (they
return 200), will not find them in the sitemap, and may waste crawl budget on low-value URLs.

**Requirement:** `robots.txt.ts` must include `Disallow` entries for all path patterns
excluded from the sitemap. The two exclusion lists (sitemap filter config + robots Disallow)
must be kept in sync. Consider extracting the exclusion list to a shared constant in
`apps/web/src/lib/seo-config.ts` (or equivalent) that is referenced by both.

**Acceptance criteria:**

```
Given the list of paths excluded from the sitemap,
When robots.txt is inspected,
Then every sitemap-excluded path prefix has a corresponding Disallow rule in robots.txt.
```

**Affected files:**
- `apps/web/src/pages/robots.txt.ts` (lines 24-34)
- `apps/web/astro.config.mjs` (lines ~114-123)
- Possibly a new `apps/web/src/lib/seo-config.ts` shared constants file

---

#### REQ-18: Add meta theme-color; reconcile manifest theme_color with brand

**Finding:** No `<meta name="theme-color">` exists anywhere in the web app HTML. The web
app manifest declares `theme_color: "#10B981"` (green), but the project's documented brand
primary is blue (river palette from `@repo/design-tokens`). Additionally, the Auth layout
and Error layout omit the `<link rel="manifest">` tag, so those pages do not register the
PWA manifest at all.

**Requirement (pending D-2):** Once the correct `theme_color` value is confirmed:
1. Add `<meta name="theme-color" content="{confirmed-value}">` to `BaseLayout.astro`,
   `AuthLayout.astro`, and `ErrorLayout.astro`.
2. Update `manifest.json` `theme_color` to match the confirmed value.
3. Add `<link rel="manifest" href="/manifest.json">` to `AuthLayout.astro` and
   `ErrorLayout.astro`.

**Acceptance criteria:**

```
Given any page rendered through BaseLayout, AuthLayout, or ErrorLayout,
When the HTML <head> is inspected,
Then <meta name="theme-color"> is present with a non-empty content value.
```

```
Given the web app manifest (manifest.json),
When theme_color is inspected,
Then it matches the value in the <meta name="theme-color"> tag across all layouts.
```

```
Given a request to the auth pages (sign-in, sign-up),
When the HTML head is inspected,
Then <link rel="manifest" href="/manifest.json"> is present.
```

**Affected files:**
- `apps/web/src/layouts/BaseLayout.astro`
- `apps/web/src/layouts/AuthLayout.astro`
- `apps/web/src/layouts/ErrorLayout.astro` (if it exists)
- `apps/web/public/manifest.json`

---

#### REQ-19: Change locale redirect from 302 to 301

**Finding:** The middleware that redirects unprefixed paths (e.g. `/alojamientos/`)
to their locale-prefixed counterparts (e.g. `/es/alojamientos/`) returns HTTP 302
(temporary redirect). `apps/web/src/middleware.ts:147` and
`apps/web/src/lib/middleware-helpers.ts:301` are the relevant call sites.

A 301 (permanent redirect) is appropriate if this redirect behaviour is not expected to
change. Google does not pass full link equity through 302 redirects. Any external links
pointing at unprefixed URLs lose PageRank value with each hop.

**Requirement:** The locale redirect status code must be changed from 302 to 301 in both
`middleware.ts` and `middleware-helpers.ts`. The change is acceptable only if the unprefixed
→ locale-prefixed redirect is a stable, permanent routing decision (which it is, given the
locked URL strategy).

**Acceptance criteria:**

```
Given a GET request to an unprefixed path (e.g. /alojamientos/),
When the server responds,
Then the response status code is 301 (not 302).
```

```
Given a GET request to / (root path),
When the locale redirect fires,
Then the response status code is 301.
```

**Affected files:**
- `apps/web/src/middleware.ts` (line 147)
- `apps/web/src/lib/middleware-helpers.ts` (line 301)

**Testing:** Vitest test (or integration test) asserting the redirect returns 301.

---

## 7. Testing strategy

Per project rules, bug fixes require a regression test before the fix is applied.

| Finding | Test type | What to assert |
|---------|-----------|----------------|
| REQ-1 (OG PNG) | Vitest unit | `Content-Type: image/png`; non-empty binary response |
| REQ-2 (sitemap prefixes) | Vitest unit | All `es` URLs in rendered XML start with `/es/` |
| REQ-3 (LCP SSR) | DOM/snapshot | SSR HTML contains hero `<img>` with `fetchpriority="high"` |
| REQ-8 (og absolute) | Vitest unit | `og:image` value is absolute URL; `og:image:alt` present |
| REQ-11 (duplicate desc) | DOM test | Exactly one `<meta name="description">` per page |
| REQ-12 (hreflang) | Vitest unit | Sitemap XML contains `xhtml:link` alternates per URL |
| REQ-16 (robots sitemap URL) | Vitest unit | Sitemap URL reflects injected `SITE_URL` |
| REQ-19 (redirect 301) | Integration/unit | Locale redirect returns 301, not 302 |

REQ-4 through REQ-7, REQ-9, REQ-10, REQ-13 through REQ-15, REQ-17, REQ-18 are primarily
correctness fixes verifiable by DOM inspection tests or snapshot assertions.

## 8. Implementation phases and ordering

```
Phase 1 (REQ-1, REQ-2, REQ-3)
  → verify via tests + Lighthouse + crawler spot-check
    → Phase 2 (REQ-4 through REQ-12)
      → verify; resolve D-1 and D-2 before starting Phase 3
        → Phase 3 (REQ-13 through REQ-19)
```

Phase 2 and Phase 3 requirements within each phase are independent of each other and can
be parallelised. The phase ordering is risk-based: Phase 1 fixes have the highest potential
for causing regression if landing order matters (e.g. the sitemap fix changes URLs that
crawlers have already indexed — this is intentional and correct, but should be verified
before adding more sitemap changes in Phase 2/REQ-12).

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Sitemap URL change (REQ-2) triggers Googlebot to re-crawl and temporarily drop rankings for es pages | Expected temporary signal drop; the fix is correct. Monitor GSC impressions for 4 weeks post-deploy. |
| LCP SSR change (REQ-3) requires passing image URL server-side to accommodation detail, which may need API data available at render time | Audit data-fetching at implementation time. If slug → first image requires an extra API call, evaluate caching strategy. |
| OG PNG rendering adds server CPU cost per uncached request (REQ-1) | Cache responses at the Cloudflare/CDN layer or in-process LRU. Implementation decision. |
| Removing body opacity gate (REQ-10) may cause a visible font swap flash on slow connections | Monitor in dev with throttled network. If flash is problematic, apply scoped opacity to the element(s) that actually need it. |
| 302 → 301 change (REQ-19) is irreversible in practice (browsers cache 301s) | Verify the redirect target is correct before shipping. Confirm URL strategy is stable. |
| JSON-LD component adoption (REQ-7, adopt path) requires an audit of every detail page | Timebox the audit; any page not migrated by deadline keeps its inline JSON-LD with a TODO comment. |

## 10. Rollback plan

Each requirement maps to at most a handful of files and is independently revertible by git.

- Phase 1 items: revert is a single-file git change per requirement.
- Phase 2 items: same. `SEOHead.astro` changes (REQ-8) are the most widely impactful —
  test in staging before merging to main.
- Phase 3 items: all low-risk; revert on any regression is trivial.

There are no database schema changes in this spec.

## 11. Dependencies

- **External**: `@astrojs/rss` (REQ-6 — new dependency, first in this app).
- **Internal**: `@repo/i18n` (REQ-15 — new translation key), `@repo/design-tokens`
  (REQ-18 — to confirm `theme_color` value).
- **Decisions**: D-1 and D-2 must be resolved before Phase 3 starts. D-1 is recommended
  to be resolved during Phase 2 (REQ-7) so the component pattern is stable.

## 12. References

- SEO audit conducted: 2026-05-24
- `apps/web/src/pages/api/og.ts` — OG image endpoint
- `apps/web/src/pages/sitemap-dynamic.xml.ts` — Dynamic sitemap generator
- `apps/web/src/layouts/BaseLayout.astro` — Base layout (meta, resource hints)
- `apps/web/src/components/seo/SEOHead.astro` — SEO meta tag component
- `apps/web/src/components/seo/*.astro` — Typed JSON-LD components
- `apps/web/src/middleware.ts` — Locale redirect middleware
- `apps/web/src/lib/middleware-helpers.ts` — Middleware helper functions
- `apps/web/astro.config.mjs` — Astro config (sitemap + i18n)
- `apps/web/CLAUDE.md` — Web app developer documentation
