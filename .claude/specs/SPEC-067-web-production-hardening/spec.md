# SPEC-067: Web App Production Hardening

> **Status**: completed
> **Priority**: P1 (high)
> **Complexity**: XL
> **Origin**: Production readiness audit of `apps/web`
> **Affected packages**: apps/web
> **Created**: 2026-04-08
> **Estimated effort**: 42 tasks across 8 phases

---

## Overview

A production readiness audit of the Hospeda web app (`apps/web`) identified approximately 35 issues across 8 areas: critical functional gaps, image optimization, security, SEO, i18n completeness, performance, code quality, and test coverage. This spec covers all of them in a single coordinated effort. The issues range from missing error pages that would cause 500s in production, to a JSON-LD XSS vector, to memory leaks from unmanaged event listeners, to zero test coverage on the entire `src/lib/` utilities layer.

The changes are grouped into 8 phases reflecting their urgency and dependency order. Phases 1-3 (critical fixes, image optimization, security) should be completed before any public launch. Phases 4-7 can follow in sequence. Phase 8 (testing) is woven into the prior phases but listed separately for tracking purposes.

---

## Goals

- Eliminate all functional gaps that cause errors or broken pages in production.
- Harden the security posture: nonce-based CSP, JSON-LD escaping, restricted `img-src`/`connect-src`.
- Achieve complete SEO readiness: robots.txt, web manifest, dynamic OG images, BreadcrumbList.
- Make all user-facing text fully translated across es/en/pt.
- Eliminate known performance regressions: memory leaks, render-blocking fonts, unnecessary `client:visible` on above-the-fold elements.
- Reduce file sizes to within the 500-line maximum and remove dead code.
- Establish a test suite for all lib utilities, the API layer, middleware, auth components, and pages.

### Success Metrics

- Zero 404/500 errors from missing error page routes.
- Canonical URLs resolve correctly in all environments.
- All local images served through Astro's optimization pipeline.
- CSP header present on all pages (Report-Only initially, enforcement after validation).
- Lighthouse SEO score >= 95 on home and accommodation detail pages.
- All user-facing strings rendered via `t()` with no hardcoded Spanish outside locale files.
- No observable memory leak from scroll/intersection observers across View Transitions.
- Test coverage >= 90% on all files in `src/lib/` and `src/lib/api/`.

---

## Phase 1: Critical Fixes

These issues cause broken pages or incorrect behavior in production and must be resolved first.

### REQ-067-01: Create 404 and 500 error pages

**Problem**: The middleware calls `context.rewrite('/404')` when an entity is not found, but no `/src/pages/404.astro` page exists. Similarly, there is no `/src/pages/500.astro`. Both missing pages cause the server to return an unformatted error response.

**User Stories**

> As a visitor who follows a broken or expired link,
> I want to see a friendly 404 page with a link back to the home page,
> so that I am not stranded on an empty or broken screen.

> As a visitor experiencing a server error,
> I want to see a clear 500 page with a "try again" message,
> so that I understand something went wrong and know what to do.

**Acceptance Criteria**

```
Given I navigate to a URL that does not match any accommodation, destination, or event,
When the middleware calls context.rewrite('/404'),
Then I see a styled 404 page matching the site design, with the site header and footer.

Given I am on the 404 page,
When I look at the page content,
Then I see a search suggestion pointing to the home or search page, and a "Go home" link.

Given the application encounters an unhandled server error,
When the error bubbles to the top level,
Then I see a 500 page with a localized "Something went wrong" message and a "Try again" button.

Given the site is configured with the Spanish locale (es),
When I land on the 404 or 500 page,
Then all text on the page is in Spanish.

Given the site is configured with the English locale (en),
When I land on the 404 or 500 page,
Then all text on the page is in English.
```

**UX Considerations**

- Both pages must include the site header and footer (use BaseLayout).
- 404 page: include the site logo, a heading, a sub-message, a search suggestion, and a "Go home" CTA. Optionally show recently visited destinations.
- 500 page: include a heading, a sub-message, a "Try again" button (reloads the current URL), and a "Go home" link.
- All text strings must go through `t()` with keys in all three locale files (es/en/pt).
- Do not show stack traces or technical error details to users.

---

### REQ-067-02: Fix canonical URL generation

**Problem**: `src/pages/[lang]/index.astro` hardcodes `https://hospeda.com.ar/${locale}/` as the canonical URL. This breaks in staging, development, and any future domain change.

**User Stories**

> As the SEO system,
> I want canonical URLs to be derived from the current site's base URL at runtime,
> so that staging and production environments produce correct canonical tags.

**Acceptance Criteria**

```
Given the site's PUBLIC_SITE_URL is set to https://hospeda.com.ar,
When the home page is rendered,
Then the canonical tag reads https://hospeda.com.ar/es/ (or the active locale).

Given the site's PUBLIC_SITE_URL is set to https://staging.hospeda.com.ar,
When the home page is rendered,
Then the canonical tag reads https://staging.hospeda.com.ar/es/ (not the hardcoded production URL).

Given Astro.site is configured in astro.config.mjs,
When any page uses the canonical utility,
Then the canonical URL is constructed from Astro.site (or getSiteUrl() from env.ts) plus the page path.
```

**UX Considerations**

- No visible user impact. This is an SEO correctness fix.
- The fix must be applied to every page that currently hardcodes the domain, not just the index.

---

### REQ-067-03: Fix logo image paths

**Problem**: `Header.astro` and `Footer.astro` reference `/src/assets/images/logo.webp` as a string path. In SSR/production, Vite does not serve files from `src/assets/` as static assets. The logo will be broken in production.

**User Stories**

> As a visitor viewing any page on the site,
> I want the site logo to always be visible in the header and footer,
> so that the site looks professional and the brand is clear.

**Acceptance Criteria**

```
Given I visit any page on the site in production,
When the page loads,
Then the header logo image is visible and not broken.

Given I visit any page on the site in production,
When I scroll to the footer,
Then the footer logo image is visible and not broken.

Given the logo is rendered via Astro's <Image> component with a static import,
When Astro builds the site,
Then the logo is included in the build output with a content-hashed filename.
```

**UX Considerations**

- Use `import logoSrc from '../assets/images/logo.webp'` plus Astro's `<Image>` component with explicit `width`, `height`, and `alt` attributes.
- Provide a meaningful `alt` attribute: "Hospeda logo" (localized via `t()`).

---

## Phase 2: Image Optimization

### REQ-067-04: Use Astro `<Image>` for all local images

**Problem**: No local images in the web app currently pass through Astro's `astro:assets` optimization pipeline. They are either referenced as string paths or imported but used as raw `.src` strings, bypassing format conversion, resizing, and lazy loading.

**User Stories**

> As a visitor on a mobile device with a slow connection,
> I want images to load in optimized formats (WebP/AVIF) at the correct size,
> so that the page loads faster and uses less data.

**Acceptance Criteria**

```
Given I visit the home page or any page with local images,
When the images load,
Then they are served as WebP or AVIF format, not the original format.

Given a local image is used in a component,
When the component is rendered,
Then the <img> tag includes width, height, and loading="lazy" attributes (or "eager" for above-the-fold images).

Given the build completes,
When I inspect the build output,
Then all local images are referenced with content-hashed URLs from Astro's output directory.
```

---

### REQ-067-05: Fix hero image optimization

**Problem**: Hero images are imported via `import` statements but passed as `.src` strings to `HeroImageRotator`, which renders them as plain `<img src={string}>` tags. This skips all Astro optimization.

**User Stories**

> As a first-time visitor on the home page,
> I want the hero images to load quickly and in the best format my browser supports,
> so that my first impression of the site is fast and polished.

**Acceptance Criteria**

```
Given the home page renders the HeroImageRotator,
When the hero images are processed during build,
Then each hero image has been processed through getImage() from astro:assets.

Given the hero images are processed through getImage(),
When the images are rendered,
Then they use the optimized src, width, height, and format from the processed result.

Given the first hero image is above the fold,
When the page loads,
Then the first hero image has loading="eager" to avoid LCP delay; subsequent images use loading="lazy".
```

---

### REQ-067-06: Create generic image fallback system

**Problem**: `AccommodationCard.astro` uses an inline `onerror` handler to swap in a placeholder image when an external image fails to load. Inline `onerror` handlers violate strict CSP (`'unsafe-inline'` is required to allow them), making CSP hardening impossible as long as they exist.

**User Stories**

> As a visitor browsing accommodations,
> I want to see a placeholder image when an accommodation's photo fails to load,
> so that the card layout does not break.

> As a developer adding images anywhere in the web app,
> I want a shared fallback utility I can apply with a data attribute,
> so that I do not need to write per-component inline event handlers.

**Acceptance Criteria**

```
Given an accommodation card image fails to load (404, network error, etc.),
When the error occurs,
Then the image src is replaced with the configured placeholder image, without any inline onerror attribute.

Given the fallback system is implemented as a nonce-bearing script,
When the CSP policy is in strict mode (no unsafe-inline),
Then the fallback script still executes because it uses the request nonce.

Given a developer adds data-fallback="/placeholder.webp" to any <img> tag,
When that image fails to load,
Then the fallback script replaces the src with the data-fallback value.

Given the fallback script is registered,
When it is injected into the page,
Then it attaches a single delegated error listener to document (not one per image).
```

**UX Considerations**

- The fallback placeholder should be a neutral, on-brand image (e.g., a blurred Hospeda logo or a simple accommodation silhouette).
- The fallback must not cause a second network error (the placeholder must always exist).
- The script should be injected once in BaseLayout, not per-component.

---

### REQ-067-07: Change HeroImageRotator to `client:load`

**Problem**: `HeroImageRotator` is above the fold and currently hydrated with `client:visible`. This means the rotator starts only after the user scrolls, which may never happen. The component appears static until the user interacts.

**User Stories**

> As a first-time visitor landing on the home page,
> I want the hero image rotator to start animating immediately,
> so that the page feels dynamic and engaging from the first second.

**Acceptance Criteria**

```
Given the home page loads,
When the page is fully rendered,
Then the HeroImageRotator is hydrated and begins cycling images without requiring any scroll or interaction.

Given HeroImageRotator uses client:load,
When Lighthouse measures the page,
Then there is no measurable regression in TTI compared to the client:visible version.
```

---

## Phase 3: Security

### REQ-067-08: Implement nonce-based CSP

**Problem**: The current CSP uses `'unsafe-inline'` for scripts and styles, which negates most of the XSS protection CSP provides. A nonce-based approach eliminates `'unsafe-inline'` and uses `'nonce-{value}'` + `'strict-dynamic'` instead.

**User Stories**

> As a security-conscious platform operator,
> I want inline scripts and styles to require a cryptographic nonce generated per request,
> so that injected scripts from XSS attacks cannot execute.

**Acceptance Criteria**

```
Given a page is served,
When I inspect the Content-Security-Policy response header,
Then it includes nonce-{random} and strict-dynamic in the script-src directive.

Given a page is served,
When I inspect the Content-Security-Policy response header,
Then it does NOT include 'unsafe-inline' in script-src.

Given an inline <script> or <style> tag is rendered by Astro,
When the page HTML is inspected,
Then the tag has a nonce attribute matching the value in the CSP header.

Given the nonce system is first deployed,
When the CSP header mode is Content-Security-Policy-Report-Only,
Then violations are reported to the configured report endpoint without blocking page rendering.

Given the CSP enforcement path is activated (Report-Only removed),
When an injected script without a nonce attempts to execute,
Then the browser blocks the script and reports the violation.
```

**UX Considerations**

- Deploy as `Content-Security-Policy-Report-Only` first. Switch to enforcement only after verifying no legitimate scripts are blocked.
- The nonce must be a cryptographically random value (16+ bytes, base64-encoded) generated per request in middleware.
- The nonce must be threaded through to all inline scripts: Astro's ViewTransitions script, analytics, the image fallback script, any other inline scripts.
- This is a prerequisite for REQ-067-06 (image fallback system).

---

### REQ-067-09: Fix JSON-LD script injection vulnerability

**Problem**: `JsonLd.astro` uses `set:html` to inject a `<script type="application/ld+json">` tag. If any user-controlled string (e.g., accommodation name, description) contains `</script>`, this closes the script tag prematurely and allows HTML injection.

**User Stories**

> As a platform operator,
> I want JSON-LD structured data to be safe even when entity names or descriptions contain special HTML characters,
> so that malicious content cannot break out of the script tag and inject HTML.

**Acceptance Criteria**

```
Given an accommodation name contains the string </script>,
When the accommodation detail page renders the JSON-LD block,
Then the </script> sequence is escaped (e.g., to <\/script>) and does not close the script tag.

Given an accommodation description contains <script>alert(1)</script>,
When the JSON-LD block is rendered,
Then no JavaScript executes from the injection.

Given the JSON-LD content is escaped correctly,
When a search engine crawler parses the JSON-LD,
Then the structured data is valid JSON and parseable without error.
```

**UX Considerations**

- The escaping must only replace `</script>` (case-insensitive) with `<\/script>` inside the JSON string. Full HTML-encoding of the JSON would break JSON parsers.
- Apply the same escaping to any future component that injects raw JSON into a script tag.

---

### REQ-067-10: Restrict CSP `img-src`

**Problem**: The current CSP uses `img-src: https:` which allows images from any HTTPS domain. This is overly permissive and reduces the XSS mitigation value of the CSP.

**User Stories**

> As a platform operator,
> I want the CSP image source list to only allow trusted domains,
> so that injected `<img>` tags pointing to attacker-controlled domains cannot be used for tracking or data exfiltration.

**Acceptance Criteria**

```
Given the CSP header is generated,
When I inspect the img-src directive,
Then it lists only specific trusted domains (Vercel blob storage, the placeholder service, the API media domain) rather than https:.

Given an image tag points to an unlisted domain,
When the browser attempts to load the image,
Then the browser blocks the request and reports a CSP violation.
```

---

### REQ-067-11: Restrict CSP `connect-src` with env validation

**Problem**: `PUBLIC_API_URL` is included in `connect-src` without validating that the env var is present. An empty or undefined value produces a malformed CSP directive.

**User Stories**

> As a platform operator,
> I want the CSP `connect-src` directive to only be populated when PUBLIC_API_URL is a valid URL,
> so that an unconfigured environment does not produce a broken or overly permissive CSP.

**Acceptance Criteria**

```
Given PUBLIC_API_URL is set to https://api.hospeda.com.ar,
When the CSP header is generated,
Then connect-src includes https://api.hospeda.com.ar.

Given PUBLIC_API_URL is empty or not set,
When the CSP header is generated,
Then connect-src does not include an empty or invalid entry, and the build or middleware logs a warning.
```

---

## Phase 4: SEO

### REQ-067-12: Create robots.txt

**Problem**: There is no `robots.txt` file. Search engines receive no crawl directives and cannot find the sitemap.

**User Stories**

> As a search engine crawler,
> I want to find a robots.txt file at the root of the domain,
> so that I know which pages to crawl and where to find the sitemap.

**Acceptance Criteria**

```
Given a crawler requests https://hospeda.com.ar/robots.txt,
When the file is served,
Then it returns a valid robots.txt with Allow and Disallow rules and a Sitemap: directive.

Given the robots.txt is configured,
When I review its rules,
Then admin, API, and account pages are disallowed from indexing.

Given the robots.txt includes a Sitemap: line,
When I follow the sitemap URL,
Then the sitemap is accessible.
```

---

### REQ-067-13: Fix site.webmanifest

**Problem**: The web app manifest (`public/site.webmanifest`) contains placeholder or empty values for `name`, `short_name`, `description`, `icons`, `theme_color`, and `background_color`.

**User Stories**

> As a user who adds Hospeda to their home screen on a mobile device,
> I want the installed app to show the correct name, icon, and brand color,
> so that it looks like a proper app and not a generic browser shortcut.

**Acceptance Criteria**

```
Given a user adds the site to their home screen,
When the OS reads the web manifest,
Then it shows "Hospeda" as the app name, the correct icon, and the brand primary color as theme_color.

Given the manifest is served,
When I validate it with a manifest validator,
Then it passes without errors for name, short_name, icons, theme_color, and background_color.
```

---

### REQ-067-14: Dynamic OG image generation

**Problem**: Open Graph images are static or missing for dynamic pages (accommodations, destinations, events). Each page should have a unique OG image for rich social sharing previews.

**User Stories**

> As a user sharing an accommodation link on a social platform,
> I want the link preview to show the accommodation's name and a relevant image,
> so that my friends can see what I'm recommending before clicking.

> As the marketing team,
> I want all shareable pages (accommodations, destinations, events, blog posts) to generate unique OG images automatically,
> so that we don't have to manually create social preview images for every piece of content.

**Acceptance Criteria**

```
Given an accommodation detail page is shared on a social platform,
When the platform's crawler fetches the og:image URL,
Then it receives a generated image including the accommodation name and a visual indicator of the Hospeda brand.

Given the OG image endpoint receives a title, description, and optional image URL,
When it renders the image,
Then it returns a PNG or JPEG at the standard OG image dimensions (1200x630).

Given the OG image generation endpoint is called with an invalid or missing title,
When it processes the request,
Then it returns a valid fallback image rather than an error response.

Given a page with a unique OG image is loaded,
When I inspect the HTML head,
Then the og:image meta tag points to the dynamic OG image endpoint with the correct parameters for that page.
```

**UX Considerations**

- The endpoint should support: `title` (required), `description` (optional), `image` (optional background/overlay URL).
- Use `@vercel/og` or satori+sharp. Both produce equivalent output; `@vercel/og` is simpler for the Vercel deployment target.
- Cache the generated images with appropriate Cache-Control headers to avoid regenerating on every crawl.
- The design should match the Hospeda brand: colors, font, logo mark.

---

### REQ-067-15: Fix duplicate title appending

**Problem**: Both `BaseLayout.astro` and `SEOHead.astro` append `| Hospeda` to the page title. Pages end up with titles like "Accommodation Name | Hospeda | Hospeda".

**User Stories**

> As a visitor reading my browser tabs,
> I want each tab to show a clear, unique page title without duplication,
> so that I can navigate between tabs easily.

**Acceptance Criteria**

```
Given a page with title "Casa del Río" is rendered,
When the HTML <title> tag is inspected,
Then it reads "Casa del Río | Hospeda" — not "Casa del Río | Hospeda | Hospeda".

Given the home page is rendered with no specific title,
When the HTML <title> tag is inspected,
Then it reads "Hospeda" without duplication.
```

**UX Considerations**

- `SEOHead.astro` is the canonical location for title construction. `BaseLayout.astro` must pass the raw title without appending the brand name.
- The separator and brand name ("| Hospeda") must be configurable via a single constant, not duplicated across files.

---

### REQ-067-16: Add BreadcrumbList JSON-LD

**Problem**: Accommodation detail, destination detail, blog post, and event detail pages have no `BreadcrumbList` structured data. Search engines cannot infer the site hierarchy, which reduces rich snippet eligibility.

**User Stories**

> As a search engine,
> I want BreadcrumbList structured data on detail pages,
> so that I can display breadcrumb trails in search results for better click-through.

**Acceptance Criteria**

```
Given an accommodation detail page is rendered,
When I inspect the page's JSON-LD blocks,
Then there is a BreadcrumbList with items: Home > Accommodations > {Accommodation Name}.

Given a destination detail page is rendered,
When I inspect the JSON-LD blocks,
Then there is a BreadcrumbList with items: Home > Destinations > {Destination Name}.

Given the BreadcrumbJsonLd component receives a breadcrumbs array,
When rendered,
Then the output is valid JSON-LD matching the BreadcrumbList schema spec.
```

---

### REQ-067-17: Fix footer newsletter input type

**Problem**: The newsletter subscription input in the footer uses `type="text"` instead of `type="email"`. Mobile browsers show the wrong keyboard layout and browsers cannot perform built-in email format validation.

**User Stories**

> As a visitor on a mobile device who wants to subscribe to the newsletter,
> I want the email field to trigger the email keyboard and validate my input format,
> so that I don't accidentally submit an invalid email address.

**Acceptance Criteria**

```
Given I tap the newsletter email field on a mobile device,
When the keyboard appears,
Then it shows the email keyboard layout (with @ key prominent).

Given I type an invalid email address and submit,
When the browser validates the field,
Then it shows the native "please enter a valid email address" error.
```

---

## Phase 5: i18n Completeness

### REQ-067-18: Translate Header navigation labels

**Problem**: The navigation labels in `Header.astro` ("ALOJAMIENTOS", "DESTINOS", etc.) are hardcoded Spanish strings instead of `t()` calls.

**User Stories**

> As an English-speaking visitor,
> I want the navigation menu to show English labels ("Accommodations", "Destinations"),
> so that I can navigate the site in my preferred language.

**Acceptance Criteria**

```
Given the site is in English (en),
When I look at the navigation bar,
Then all nav labels are in English.

Given the site is in Portuguese (pt),
When I look at the navigation bar,
Then all nav labels are in Portuguese.

Given a nav label key is added to all locale files (es/en/pt),
When the t() function is called for that key,
Then it returns the correct translation for the active locale.
```

---

### REQ-067-19: Fix sign-in page labels

**Problem**: `signin.astro` defines a local `labels` object with hardcoded Spanish strings instead of using `t()` calls from locale files.

**Acceptance Criteria**

```
Given the site is in English,
When I visit the sign-in page,
Then all labels (email, password, submit button, forgot password link) are in English.

Given a translation key is missing from a locale file,
When the t() function is called,
Then it falls back to the default locale (es) string without throwing.
```

---

### REQ-067-20: Translate post category labels

**Problem**: `getPostCategoryLabel()` contains a Spanish-only label map for post categories. Users in English or Portuguese see Spanish category names.

**Acceptance Criteria**

```
Given the site is in English,
When a blog post category label is rendered,
Then it shows the English label, not the Spanish hardcoded string.

Given a new post category is added,
When the developer adds its label,
Then they add translation keys to all three locale files, not a new hardcoded entry.
```

---

### REQ-067-21: Translate all hardcoded aria-labels

**Problem**: Several components contain hardcoded Spanish `aria-label` attributes: the testimonials carousel (`TestimonialsCarousel.client.tsx`), account navigation (`mi-cuenta/index.astro`), save button in `AccommodationCard.astro`, and others discovered during audit.

**User Stories**

> As a screen reader user who prefers English,
> I want all accessible labels to be announced in my language,
> so that I can navigate the site effectively without hearing Spanish labels.

**Acceptance Criteria**

```
Given a screen reader user is on the home page with the English locale,
When they navigate to the testimonials carousel,
Then the carousel's aria-label is announced in English.

Given a screen reader user is on an accommodation card,
When they focus the save/bookmark button,
Then the aria-label is announced in the active locale.

Given a developer adds a new aria-label to any component,
When they write the label,
Then they must use t() with a key in all three locale files, not a hardcoded string.
```

**UX Considerations**

- Perform a full audit of all `aria-label`, `aria-labelledby`, and `title` attributes across all `.astro` and `.tsx` files in `apps/web/src/`.
- Do not modify the functionality of any component while translating aria-labels.

---

### REQ-067-22: Add language switcher to navbar

**Problem**: There is no UI for users to switch between the supported languages (es/en/pt). The only way to change language is by manually editing the URL.

**User Stories**

> As a visitor who prefers English,
> I want a language switcher in the navigation bar,
> so that I can switch from Spanish to English without editing the URL.

> As a visitor reading an accommodation detail page in Spanish,
> I want the language switcher to take me to the same page in English,
> so that I don't lose my place in the browsing flow.

**Acceptance Criteria**

```
Given I am on the home page in Spanish,
When I click the language switcher and select English,
Then I am redirected to the English version of the home page (/en/).

Given I am on an accommodation detail page (/es/alojamientos/casa-del-rio),
When I click the language switcher and select English,
Then I am redirected to /en/alojamientos/casa-del-rio (same path, different locale prefix).

Given I am viewing the language switcher,
When it renders,
Then the current active language is visually indicated (e.g., highlighted or checked).

Given there are three supported locales (es, en, pt),
When the switcher renders,
Then it shows all three options regardless of the current locale.
```

**UX Considerations**

- The switcher should appear in the navbar, likely near the auth/account menu.
- On mobile, it should be accessible from the hamburger menu.
- The switcher must be keyboard-navigable and screen-reader accessible.
- The current locale's label should be the button/trigger text (e.g., "ES", "EN", "PT" or the full language name).
- Switching language should not require a page reload if View Transitions are active; a soft navigation to the translated URL is preferred.

---

## Phase 6: Performance

### REQ-067-23: Lazy-load GLightbox CSS

**Problem**: GLightbox CSS is imported globally in `BaseLayout.astro`. This adds ~15KB of CSS to the critical path of every page, including pages that never open a lightbox.

**Acceptance Criteria**

```
Given I visit the home page,
When I inspect the page's stylesheets,
Then GLightbox CSS is not included in the initial page load.

Given I visit an accommodation detail page that uses the lightbox,
When the lightbox component hydrates,
Then the GLightbox CSS is loaded at that point (dynamically or via the component's own import).

Given GLightbox CSS is loaded lazily,
When I open the lightbox,
Then it renders correctly without any missing styles.
```

---

### REQ-067-24: Optimize Google Fonts loading

**Problem**: Google Fonts is loaded with a render-blocking `rel="stylesheet"` link tag. This delays the First Contentful Paint while waiting for the font file to download.

**Acceptance Criteria**

```
Given Google Fonts is loaded with the preload+async swap pattern,
When Lighthouse measures the page,
Then there is no render-blocking resource warning for Google Fonts.

Given the async font swap pattern is used,
When the font loads,
Then the font replaces the fallback without a jarring layout shift (use font-display: swap).
```

---

### REQ-067-25: Configure Astro prefetch

**Problem**: Astro's prefetch feature is not configured in `astro.config.mjs`. This means page transitions do not benefit from link prefetching, causing unnecessary navigation delays.

**Acceptance Criteria**

```
Given prefetch is configured with defaultStrategy: 'hover',
When a user hovers over an internal link,
Then Astro begins prefetching the linked page in the background.

Given the prefetch configuration is active,
When the user clicks the hovered link,
Then the navigation feels near-instant because the page is already prefetched.
```

---

### REQ-067-26: Fix IntersectionObserver memory leak

**Problem**: `initScrollReveal()` creates new `IntersectionObserver` instances on every `astro:page-load` event without disconnecting the previous observers. Over time this accumulates observers watching stale DOM elements.

**User Stories**

> As a visitor navigating between multiple pages in a single session,
> I want the page to remain responsive without memory pressure,
> so that browsing many pages does not cause the tab to slow down.

**Acceptance Criteria**

```
Given I navigate between 10 pages using View Transitions,
When I inspect the browser's memory snapshot,
Then the number of active IntersectionObservers does not grow unboundedly.

Given a new astro:page-load event fires,
When initScrollReveal() runs,
Then any observers created in the previous page load are disconnected before new ones are created.
```

---

### REQ-067-27: Fix Header scroll listener accumulation

**Problem**: The scroll event listener in `Header.astro` is registered on every `astro:page-load` event but never removed on navigation. After visiting N pages, there are N scroll listeners attached to the window.

**Acceptance Criteria**

```
Given I navigate between pages using View Transitions,
When I inspect the scroll event listeners on window,
Then there is at most one scroll listener at any given time.

Given an astro:page-load event fires,
When the Header script initializes its scroll listener,
Then it first removes any previously registered listener before attaching a new one.
```

---

### REQ-067-28: Add View Transition morph animations

**Problem**: No components define `transition:name` attributes. Card-to-detail page transitions are abrupt cuts with no element morphing.

**User Stories**

> As a visitor clicking on an accommodation card to open the detail page,
> I want the card image to smoothly expand into the detail page hero image,
> so that the navigation feels fluid and purposeful.

**Acceptance Criteria**

```
Given I click on an accommodation card,
When the detail page loads with View Transitions active,
Then the card image morphs into the hero image on the detail page rather than cutting abruptly.

Given transition:name attributes are defined on matched elements,
When View Transitions are disabled (e.g., user prefers-reduced-motion),
Then the page still loads correctly without the morph animation.
```

**UX Considerations**

- Add `transition:name` to at least: accommodation card image, destination card image, and the corresponding hero images on detail pages.
- Ensure morph animations respect `prefers-reduced-motion: reduce` by using Astro's built-in support.
- Unique `transition:name` values per item (e.g., `transition:name={\`accommodation-image-${id}\`}`).

---

## Phase 7: Code Quality

### REQ-067-29: Deduplicate type definitions

**Problem**: Type definitions are duplicated between `src/lib/api/transforms.ts` and `src/data/types.ts`. There are conflicting or redundant definitions that make it unclear which is authoritative.

**Acceptance Criteria**

```
Given a type is used across multiple files in apps/web,
When I search the codebase for its definition,
Then it appears exactly once in one canonical location.

Given the deduplication is complete,
When TypeScript compiles the project,
Then there are no type errors from the consolidation.
```

**UX Considerations**

- The canonical location for web-specific types should be `src/data/types.ts` or a new `src/types/` directory (decision to be made during implementation based on existing import patterns).
- `src/lib/api/transforms.ts` should import from the canonical location, not define its own types.

---

### REQ-067-30: Split oversized files

**Problem**: Three files exceed the 500-line maximum: `mi-cuenta/index.astro` (672 lines), `AccommodationCard.astro` (653 lines), and `data/types.ts` (588 lines).

**Acceptance Criteria**

```
Given the split is complete,
When any file in apps/web/src/ is counted,
Then no file exceeds 500 lines.

Given AccommodationCard.astro is split into sub-components,
When the accommodation listing renders,
Then the visual output is identical to before the split.

Given mi-cuenta/index.astro is split into sub-components,
When the account page renders,
Then all sections (profile, bookings, reviews) render and function correctly.
```

---

### REQ-067-31: Remove dead mock data files

**Problem**: Files in `src/data/homepage-*.ts` may be unused imports left from early development. Unused files add noise to the codebase and increase the risk of developers relying on stale data.

**Acceptance Criteria**

```
Given a data file has no importers in the entire apps/web source tree,
When it is identified by static analysis,
Then it is deleted.

Given the deletion is complete,
When the project builds,
Then there are no import errors.
```

---

### REQ-067-32: Add React Error Boundary

**Problem**: React islands have no error boundary. An unhandled error in any React island crashes the entire island's DOM subtree with no user feedback.

**User Stories**

> As a visitor whose browser or network causes a React island to error,
> I want to see a friendly fallback message rather than an empty or broken section,
> so that I can continue using the rest of the page.

**Acceptance Criteria**

```
Given a React island throws an unhandled error during render,
When the error boundary catches it,
Then the user sees a localized "Something went wrong" message with a retry option, not a blank section.

Given the ErrorBoundary component wraps a React island,
When an error is caught,
Then the error details are logged via @repo/logger (not console.log).

Given the retry button is clicked,
When the component re-renders,
Then the island attempts to recover by re-mounting.
```

**UX Considerations**

- The fallback UI must be visually consistent with the rest of the page (Tailwind classes, not styled-components or inline styles).
- The ErrorBoundary component should be reusable across all React islands.
- The "retry" action should reset the error state, causing the child component to re-render from scratch.

---

### REQ-067-33: Fix `isLoggingEnabled()`

**Problem**: `isLoggingEnabled()` always returns `false` in production regardless of the `PUBLIC_ENABLE_LOGGING` env var. Logging is effectively disabled with no way to enable it without code changes.

**Acceptance Criteria**

```
Given PUBLIC_ENABLE_LOGGING=true is set in the environment,
When isLoggingEnabled() is called,
Then it returns true.

Given PUBLIC_ENABLE_LOGGING is not set or is false,
When isLoggingEnabled() is called,
Then it returns false.

Given isLoggingEnabled() returns true,
When a logging call is made via @repo/logger,
Then the log is emitted.
```

---

### REQ-067-34: Fix `loadStats()` silent failure

**Problem**: `loadStats()` has an empty `catch {}` block. If the stats endpoint fails, the UI receives no error feedback and the developer has no diagnostics.

**Acceptance Criteria**

```
Given the stats API endpoint returns an error,
When loadStats() catches the error,
Then it logs the error via @repo/logger with the relevant context (URL, status code if available).

Given the stats endpoint fails,
When the page renders,
Then the user sees an appropriate empty state or error state rather than stale or missing data.
```

---

### REQ-067-35: Remove deprecated `t()` function

**Problem**: `src/lib/i18n.ts` exports a deprecated object-style `t()` overload alongside the current function-style. The deprecated overload is a source of confusion and may be silently masking translation gaps.

**Acceptance Criteria**

```
Given the deprecated t() overload is removed,
When TypeScript compiles the project,
Then there are no type errors from the removal.

Given a caller used the deprecated object-style t(),
When it is migrated to the function-style t(),
Then the translation output is identical.
```

---

### REQ-067-36: Fix coverage exclusion patterns

**Problem**: Vitest coverage exclusion patterns in `apps/web` are too broad. Files that should be tested (utilities, services) may be silently excluded from coverage reports.

**Acceptance Criteria**

```
Given the coverage config is tightened,
When vitest --coverage runs,
Then only intentionally excluded files (config files, type-only files, generated files) are excluded.

Given a utility file in src/lib/ is not explicitly excluded,
When coverage runs,
Then the file appears in the coverage report.
```

---

### REQ-067-37: Add root redirect to vercel.json

**Problem**: The `/` to `/es/` redirect is currently handled by an Astro page (a redirect response). Vercel's edge network can serve this redirect faster as a Vercel-level route configuration.

**Acceptance Criteria**

```
Given vercel.json includes a redirect from / to /es/,
When a visitor requests https://hospeda.com.ar/,
Then they receive a 308 redirect to /es/ from Vercel's edge, without the request reaching the Astro server.

Given the Vercel-level redirect is configured,
When the Astro page that previously handled the redirect is removed or no-ops,
Then no double-redirect occurs.
```

---

## Phase 8: Testing

### REQ-067-38: Test lib/ utilities

**Problem**: The `src/lib/` directory contains critical utilities (`urls.ts`, `format-utils.ts`, `sanitize-html.ts`, `colors.ts`, `i18n.ts`, `middleware-helpers.ts`, `scroll-reveal.ts`, `tiptap-renderer.ts`, `media.ts`) with zero test coverage.

**Acceptance Criteria**

```
Given each utility file in src/lib/ has a corresponding *.test.ts file,
When vitest runs,
Then all exported functions are tested with happy path, edge cases, and error cases.

Given the test suite runs,
When coverage is measured,
Then src/lib/ achieves >= 90% line and branch coverage.
```

---

### REQ-067-39: Test API layer

**Problem**: `src/lib/api/client.ts`, `transforms.ts`, and `endpoints.ts` have no tests. These are the files that all page data fetching depends on.

**Acceptance Criteria**

```
Given API layer tests are written,
When a transform function receives malformed data,
Then the test verifies the function handles the error rather than throwing uncaught exceptions.

Given a test mocks the fetch API,
When client.ts makes an API request,
Then the test verifies correct headers, error handling, and response parsing.
```

---

### REQ-067-40: Test middleware

**Problem**: `middleware-helpers.ts` was extracted from `middleware.ts` for testability but has no tests.

**Acceptance Criteria**

```
Given a test for nonce generation,
When generateNonce() is called,
Then the result is a string of >= 16 bytes, base64-encoded, and unique across calls.

Given a test for CSP header generation,
When buildCspHeader(nonce, config) is called,
Then the resulting header string contains the nonce value and all expected directives.

Given a test for locale detection,
When detectLocale() is called with various URL patterns,
Then it returns the correct locale for each case including the default fallback.
```

---

### REQ-067-41: Test auth components

**Problem**: `SignIn`, `SignUp`, `UserNav`, and `ForgotPassword` auth components have no tests.

**Acceptance Criteria**

```
Given the SignIn component renders,
When the user submits with an empty email,
Then the validation error is displayed.

Given the SignIn component receives a server error response,
When the error is shown,
Then it is localized using t() and does not expose raw error messages.

Given the UserNav component renders for an authenticated user,
When the user's name is available,
Then it is displayed in the nav trigger.
```

---

### REQ-067-42: Test pages

**Problem**: The 404/500 error pages, auth redirect logic, and the account page (`mi-cuenta`) have no tests.

**Acceptance Criteria**

```
Given the 404 page renders,
When tested,
Then it renders the "Go home" link and the search suggestion.

Given the 500 page renders,
When tested,
Then it renders the "Try again" button.

Given the account page is accessed by an unauthenticated user,
When the page loads,
Then the user is redirected to the sign-in page.
```

---

## Scope

### In Scope

- All 42 requirements listed above across 8 phases.
- All changes are scoped to `apps/web/` only.
- New shared utility scripts injected via `BaseLayout.astro` (image fallback, nonce injection).
- New locale keys in `packages/i18n/` locale files (es/en/pt) required by i18n fixes.
- New Vercel configuration in `apps/web/vercel.json` or root `vercel.json` for redirect.
- New `@vercel/og` or satori+sharp dependency for OG image generation (if not already present).

### Out of Scope

- Newsletter form backend wiring (the `type="email"` fix is in scope, the form submission is not).
- Favorite/bookmark button backend wiring (the aria-label fix is in scope, the feature is not).
- RTL (right-to-left) language support.
- Astro Content Collections migration.
- CSRF protection (deferred until forms are fully wired to backend).
- Changes to `apps/api/`, `apps/admin/`, or any shared package other than `packages/i18n/`.
- New features not listed in this spec (search, filters, user reviews, etc.).

### Future Considerations

- CSRF tokens on all forms once newsletter, contact, and review forms are wired.
- Content Collections migration to replace `src/data/` static files with typed CMS-backed collections.
- Full `sitemap.xml` generation (dynamic, covering all accommodation/destination/event pages).
- Service Worker and offline support.
- `prefers-reduced-motion` support beyond View Transitions (scrollReveal should also respect it).

---

## Dependencies

| Phase | Depends On | Notes |
|-------|-----------|-------|
| Phase 2 (Image Optimization) | Phase 1 complete | Error pages must exist before image fixes are tested |
| Phase 3 REQ-067-08 (CSP nonce) | Phase 2 REQ-067-06 (image fallback) | Image fallback script must be nonce-ready before CSP is enforced |
| Phase 4 REQ-067-14 (OG images) | Phase 1 REQ-067-02 (canonical URLs) | OG image endpoint URLs must use correct base URL |
| Phase 8 (Testing) | Phases 1-7 | Tests are written for implemented features; some can run in parallel |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| CSP nonce breaks third-party scripts (analytics, chat widgets) | Medium | High | Deploy as Report-Only first; audit reports before switching to enforcement |
| View Transition morph animations cause visual regressions on older browsers | Low | Medium | Morph is a progressive enhancement; test with and without View Transitions support |
| OG image generation adds cold-start latency on Vercel serverless | Low | Low | Cache generated images at CDN level via Cache-Control headers |
| Type deduplication causes import cycle changes | Medium | Medium | Run full TypeScript check and test suite after deduplication |
| File split changes component import paths across the codebase | Medium | Low | Update all import paths as part of the split; CI TypeScript check will catch regressions |
