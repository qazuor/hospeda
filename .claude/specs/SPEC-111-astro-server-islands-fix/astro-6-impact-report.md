# Astro 6 Impact Report — `apps/web`

**Generated:** 2026-05-15
**Scope:** `apps/web` after SPEC-111 bump: `astro` 5.18.0 → 6.3.3, `@astrojs/node` 9.5.5 → 10.1.1, `@astrojs/react` 4.2.1 → 5.0.5, `@astrojs/sitemap` 3.7.0 → 3.7.2

---

## Known-Handled in SPEC-111 (excluded from analysis below)

- Version bump of all four packages committed and building green.
- `@vitejs/plugin-react@4` pnpm override to maintain React 19 compatibility under `@astrojs/react@5`.
- Vitest config bypassed `getViteConfig()` from Astro to avoid React multi-instance issue; uses a standalone `@vitejs/plugin-react` config with `resolve.dedupe`.
- `test/stubs/astro-transitions-client.ts` stub created for `astro:transitions/client` in jsdom.
- `PlanPurchaseButton.test.tsx` `skipIf` wrapper for TS test-environment regression tracked separately as SPEC-131.
- The `fix-astro-image-trailing-slash` Vite server middleware in `astro.config.mjs` (pre-existing workaround for `/_image` path rewriting).

---

## Executive Summary

1. **Zod 4 deprecation warnings are live in production today.** `apps/web/src/env.ts` uses `z.string().url()` in nine places; Zod 4 (bundled with Astro 6) emits console deprecation warnings for each call and these methods are slated for removal in a future Zod major. The fix is mechanical but blocking production log clarity.
2. **`HOSPEDA_NOINDEX_HOSTS` and `PUBLIC_ENABLE_LOGGING` bypass Zod validation.** Both variables are read via raw `import.meta.env` at runtime without being registered in the Zod schema in `src/env.ts`, making them invisible to `validateWebEnv()` and the env-registry CI gate.
3. **Content Security Policy is set as `Report-Only` and delivered via `response.headers.set()`** from middleware; the new `@astrojs/node@10` `staticHeaders` option + Astro 6's native `security.csp` subsystem could replace this entirely and cover prerendered pages (which the middleware approach misses).
4. **`astro:transitions/client` dynamic import in `useFilterDebounce.ts` is correct** but relies on a runtime path that differs from how Astro 6's `ClientRouter` exposes the `navigate()` function — this warrants a smoke test on filter navigation.
5. **No `astro:env` adoption.** Astro's type-safe env system (stable in 5.x, refined in 6) is not used; the codebase rolls its own Zod validation. This is functional but misses build-time safety and IDE autocompletion for `import.meta.env` accesses.

---

## 1. Definitely Broken / Would Break if Not Fixed

### 1.1 Zod 4 `z.string().url()` deprecation in `src/env.ts`

**File:** `apps/web/src/env.ts:19-27, 43`

**Lines affected:**
```
19: HOSPEDA_API_URL: z.string().url().optional(),
20: PUBLIC_API_URL: z.string().url().optional(),
21: HOSPEDA_SITE_URL: z.string().url().optional(),
22: PUBLIC_SITE_URL: z.string().url().optional(),
23: HOSPEDA_BETTER_AUTH_URL: z.string().url().optional(),
24: HOSPEDA_ADMIN_URL: z.string().url().optional(),
25: PUBLIC_ADMIN_URL: z.string().url().optional(),
27: PUBLIC_SENTRY_DSN: z.string().url().optional(),
43: PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL: z.string().url().optional(),
```

**Upstream change:** Astro 6 ships with **Zod 4** (see [Astro v6 upgrade guide — Zod 4 section](https://docs.astro.build/en/guides/upgrade-to/v6/#update-zod-string-formats)). Zod 4 moves string-format validators out of `z.string()` and into top-level namespace. `z.string().url()` still works but emits a deprecation warning on every parse — which runs at startup via `validateWebEnv()` inside `astro.config.mjs`. In Zod's roadmap these are removed in Zod 5.

**Concrete fix:**

```typescript
// Before (Zod 3 / deprecated in Zod 4)
HOSPEDA_API_URL: z.string().url().optional(),

// After (Zod 4)
HOSPEDA_API_URL: z.url().optional(),
```

Apply to all nine occurrences in `src/env.ts`. No API change — the validated type is still `string`.

**Scope note:** `@repo/schemas` and `@repo/service-core` also use `z.string().email()` and `z.string().uuid()` extensively, but those packages are consumed by the API/admin apps which do NOT run under Astro 6. The Zod 4 deprecation is only triggered in the web app context because `astro` is what bundles Zod 4. The packages themselves will produce warnings if tested from a Vitest run that loads Astro 6's Zod. Cross-package migration can be a follow-up.

---

### 1.2 `HOSPEDA_NOINDEX_HOSTS` read via `import.meta.env` but never validated

**Files:**
- `apps/web/src/middleware.ts:48`
- `apps/web/src/pages/robots.txt.ts:22`

Both read `import.meta.env.HOSPEDA_NOINDEX_HOSTS as string | undefined` directly, bypassing `validateWebEnv()`. This variable is not declared in `src/env.ts`'s `serverEnvBaseSchema`.

**Risk:** In Astro 6 builds with the `vite.define` overrides already in `astro.config.mjs`, undeclared `import.meta.env.*` keys that are not in the Vite env allowlist can be stripped or return `undefined` in SSR bundles depending on build mode. More importantly, it's invisible to the env-registry CI gate (`pnpm env:check:registry`), so it can silently be missing in a Coolify deployment.

**Concrete fix:** Add `HOSPEDA_NOINDEX_HOSTS: z.string().optional()` to `serverEnvBaseSchema` in `src/env.ts:18-44` and expose it via a `getNoindexHosts()` helper in `src/lib/env.ts` following the same pattern as the other helpers. Then replace the two `import.meta.env.HOSPEDA_NOINDEX_HOSTS` usages with the helper call.

**Same issue applies to `PUBLIC_ENABLE_LOGGING`** at `src/lib/env.ts:147` — it is read as `import.meta.env.PUBLIC_ENABLE_LOGGING` but is not in the Zod schema. Fix: add `PUBLIC_ENABLE_LOGGING: z.string().optional()` to `serverEnvBaseSchema`.

---

## 2. Possibly Broken (Needs Verification)

### 2.1 `astro:transitions/client` `navigate()` dynamic import in `useFilterDebounce.ts`

**File:** `apps/web/src/components/shared/filters/hooks/useFilterDebounce.ts:62-74`

The hook dynamically imports `astro:transitions/client` at runtime to call `navigate()`. The Vitest stub at `test/stubs/astro-transitions-client.ts` satisfies the test environment, but the real runtime path changed between Astro 5 and 6 in subtle ways. Specifically, Astro 6 renamed internal View Transitions lifecycle events and may have changed how `navigate()` resolves in a React island context where the island is hydrated with `client:idle`.

**Risk:** Filter navigation (accommodation, events, destinations listing pages) could silently fall back to `window.location.href = ...` hard navigation instead of smooth view-transition navigation without throwing any error, since the fallback `catch` block swallows the error.

**Verification step:**
1. `pnpm dev` in `apps/web`.
2. Navigate to `/es/alojamientos/` and apply any filter (e.g., type=hotel).
3. In DevTools Network, check whether the navigation is a fetch request (View Transitions SPA navigation) or a full document reload.
4. Confirm the `isPending` spinner appears and disappears correctly.

If it falls back to hard nav, the fix is to check if `navigate` is exported as a named export from `astro:transitions/client` in Astro 6 (it should be, but verify at runtime).

---

### 2.2 Server Island `server:defer` + prerendered `beta/[...slug].astro` interaction

**File:** `apps/web/src/pages/beta/[...slug].astro:20` (`export const prerender = true`) + `apps/web/src/layouts/Header.astro:204-211` (`<MobileMenuIsland server:defer .../>`)

The `beta/` pages are fully prerendered (SSG). The Header is always rendered via `BaseLayout → Header.astro` which includes `MobileMenuIsland server:defer`. In Astro 6, server islands on fully prerendered pages require the node adapter to handle the `/_server-islands/*` route. The fix in SPEC-111 (version bump) resolved the `manifest.serverIslandMap.get is not a function` crash. However, the beta pages use `BetaDocLayout` rather than `BaseLayout` — verify `BetaDocLayout` also includes `MobileMenuIsland` (or at least a Header that does) and that server island requests from beta pages route correctly in production standalone mode.

**File:** `apps/web/src/layouts/BetaDocLayout.astro`

**Verification step:** Load `/beta/index` in a production build (`pnpm build && node dist/server/entry.mjs`) and confirm the mobile menu renders (not a 500) and DevTools shows a successful `/_server-islands/*` XHR.

---

### 2.3 `@astrojs/sitemap@3.7.2` `customPages` field behavior

**File:** `apps/web/astro.config.mjs:106-108`

```js
customPages: [`${HOSPEDA_SITE_URL.replace(/\/$/, '')}/sitemap-dynamic.xml`]
```

The sitemap integration was bumped from 3.7.0 → 3.7.2. The `customPages` option is used to inject the dynamic sitemap URL into `sitemap-index.xml`. Check the 3.7.1 and 3.7.2 changelogs to confirm no behavioral changes to `customPages` — the patch range usually only has bug fixes, but if the format changed (e.g., expecting a trailing slash vs. not) the dynamic sitemap could be omitted from the index silently.

**Verification step:** After a `pnpm build`, load `/sitemap-index.xml` and confirm it lists `sitemap-dynamic.xml` as a child sitemap entry.

---

### 2.4 `transition:persist` on `FeedbackFABClient` and `ScrollToTop` across Astro 6

**Files:**
- `apps/web/src/layouts/BaseLayout.astro:209` — `transition:persist="feedback-fab"`
- `apps/web/src/components/shared/navigation/ScrollToTop.astro:25` — `transition:persist="scroll-to-top"`

Astro 6 refined how `transition:persist` works with `client:idle` components. In Astro 5, a persisted island could keep its DOM across navigations; in Astro 6 there are stricter constraints about re-mounting when the fallback animation runs. The `FeedbackFABClient` is also `client:idle`, meaning it may hydrate after the first swap and interact with `transition:persist` in a new way.

**Verification step:** Navigate between two pages with ClientRouter enabled, confirm the FAB does not flicker or duplicate. Check the browser console for "Failed to persist element" or similar warnings emitted by Astro's View Transitions runtime.

---

### 2.5 `@sentry/astro@10.40.0` compatibility with Astro 6

**File:** `apps/web/astro.config.mjs:5, 93-100`

Sentry's Astro integration injects its own Vite plugin and wraps the Astro build. `@sentry/astro@10.40.0` was tested against Astro 5.x. The Sentry integration hooks into Astro's source map upload and instrumentation pipeline. Astro 6 changed internal build artifact paths.

**Risk:** Source map uploads may fail silently in CI (no error, but errors are not symbolicated in Sentry). Alternatively, the integration's instrumentation may inject duplicate middleware or miss server-island routes.

**Verification step:** Check `SENTRY_AUTH_TOKEN` is set and run a production build. Inspect the upload logs for any "No matching source map" errors. Also load a page in staging and verify the Sentry SDK initializes (check `__sentry_instrumentation_hooks__` in the browser console or the Sentry dashboard for the next session).

---

## 3. Should Be Done Differently Now

### 3.1 `z.string().url()` pattern — migrate to Zod 4 top-level validators

Already detailed in §1.1. Beyond being deprecated, it also applies to `@repo/schemas` and `@repo/service-core` when those packages' tests run under a Zod 4 environment. Tracking migration in those packages in a follow-up is recommended.

---

### 3.2 Content Security Policy via middleware `response.headers.set()` — migrate to `security.csp`

**File:** `apps/web/src/middleware.ts:208-226` (and the beta path at `src/middleware.ts:93-104`)

Currently CSP is set in `Report-Only` mode via middleware by calling `response.headers.set('Content-Security-Policy-Report-Only', ...)`. This approach has two gaps:

1. Prerendered pages (beta docs, legal pages, pricing) are served directly by the Node adapter without going through Astro middleware on every request — the `response` object from `next()` on a prerendered page is served from static cache, so the header may not be attached on cached responses when `staticHeaders` is off.
2. The nonce-based approach (computed per-request as `generateCspNonce()`) is correct for SSR pages but is incompatible with static prerendering anyway.

**Astro 6 + `@astrojs/node@10` alternative:** Astro 6 introduced the `security.csp` config option (stable), and `@astrojs/node@10` added the `staticHeaders` option that serves headers for prerendered pages. See [node adapter staticHeaders docs](https://docs.astro.build/en/guides/integrations-guide/node/#staticheaders).

**Suggested migration path:**
- Phase 1: Add `staticHeaders: true` to the node adapter config in `astro.config.mjs`. This is a non-breaking additive change.
- Phase 2 (separate spec): Evaluate moving from Report-Only to enforced CSP using Astro's native `security.csp` subsystem, which handles nonce injection automatically.

---

### 3.3 Direct `import.meta.env` reads in layouts and pages — route through `src/lib/env.ts`

**Files:**
- `apps/web/src/layouts/MarketingLayout.astro:29` — `import.meta.env.SITE`
- `apps/web/src/layouts/Footer.astro:48` — `import.meta.env.PUBLIC_API_URL`
- `apps/web/src/layouts/AccountLayout.astro:31` — `import.meta.env.SITE`
- `apps/web/src/layouts/LegalLayout.astro:35` — `import.meta.env.SITE`
- `apps/web/src/layouts/DefaultLayout.astro:31` — `import.meta.env.SITE`
- `apps/web/src/layouts/DetailLayout.astro:36` — `import.meta.env.SITE`
- `apps/web/src/pages/[lang]/mi-cuenta/newsletter.astro:40` — `import.meta.env.PUBLIC_API_URL`
- `apps/web/src/pages/[lang]/mi-cuenta/agregar-contrasena/index.astro:34` — `import.meta.env.PUBLIC_API_URL`
- `apps/web/src/pages/[lang]/mi-cuenta/resenas/index.astro:24` — `import.meta.env.PUBLIC_API_URL`
- `apps/web/src/pages/[lang]/mi-cuenta/favoritos/colecciones/[id].astro:183` — `import.meta.env.PUBLIC_API_URL`
- `apps/web/src/lib/auth-client.ts:28` — `import.meta.env.PUBLIC_API_URL`

The CLAUDE.md for `apps/web` explicitly states "NEVER use `import.meta.env` directly in application code." These usages pre-date or deviate from that rule. With Astro 6 and its `astro:env` system (see §4.1 below), these raw accesses become even more of a smell.

**Suggested migration:** Replace each with a call to the appropriate helper in `src/lib/env.ts` (`getApiUrl()`, `getSiteUrl()`). The `import.meta.env.SITE` usages should use `getSiteUrl()`. The auth-client case is slightly different — it needs to work in the browser bundle too, so `PUBLIC_API_URL` is appropriate there, but it should still go through a validated path.

---

### 3.4 `astro.config.test.ts` tests reference ISR logic that no longer matches the config

**File:** `apps/web/test/astro.config.test.ts:1-160`

These tests validate an `ISR_EXCLUDE_REGEX` constant. The file comment references Vercel ISR (`bypassToken` flow) which was explicitly removed per the `revalidate.ts` file comments (replaced with Cloudflare cache purge). The regex in the test is also not imported from `astro.config.mjs` — it is copy-pasted (`The consolidated ISR exclude regex — kept in sync with astro.config.mjs`). If the config changes, tests will drift silently.

**Suggested fix:** Either remove the test file if ISR logic is no longer relevant, or export the regex from `astro.config.mjs` and import it directly in the test (removing the maintenance burden of keeping two copies in sync).

---

## 4. New Capabilities to Consider Adding

### 4.1 `astro:env` — Type-safe, build-time validated environment variables

**What:** Astro 6 ships `astro:env` as a stable API (it was experimental in 5.x). It provides IDE autocompletion, build-time type inference, and schema validation for `import.meta.env` access without rolling a custom Zod layer.

**Value proposition:** Replaces the custom `src/env.ts` + `src/lib/env.ts` dual-layer with a single `astro.config.mjs` schema that Astro validates before the build completes. The `astro:env/server` virtual module provides typed server-only vars; `astro:env/client` provides typed public vars. Errors are surfaced at build time rather than at process startup.

**Cost estimate: L** (large). The existing Zod-based env system is deeply integrated. Migration would require rewriting `src/env.ts`, `src/lib/env.ts`, and every file that imports from them, plus updating the env-registry CI gate. Recommended to do as a standalone spec after validating the current Zod 4 migration first.

---

### 4.2 `security.csp` native subsystem + `staticHeaders: true`

**What:** Astro 6 adds a `security.csp` config block that handles nonce generation and injection into `<script>` and `<style>` tags automatically, including for prerendered pages. `@astrojs/node@10` adds `staticHeaders: true` that serves the CSP header (and other security headers) even for cached static files.

**Value proposition:** Eliminates the per-request nonce generation in middleware (`generateCspNonce()` at `src/lib/middleware-helpers.ts`), the manual `<script nonce={cspNonce}>` and `<style nonce={cspNonce}>` annotations throughout `BaseLayout.astro`, `FontsLoader`, and `ThemeFoucScript`, and the two separate CSP header attachment blocks in middleware. Reduces ~80 lines of middleware and layout code. Also covers prerendered beta/legal pages which currently miss the CSP header.

**Cost estimate: M** (medium). The `staticHeaders` option is additive and can be done in an hour. Full `security.csp` migration (replacing middleware CSP) requires understanding Astro's nonce injection pipeline and testing inline scripts carefully.

---

### 4.3 Astro Sessions (`Astro.session`) for auth state — evaluate vs. Better Auth cookie flow

**What:** Astro 6 ships a stable `Astro.session` API (sessions backed by filesystem, Redis, or Netlify Blobs). It replaces manual cookie-parsing for server-side auth state.

**Value proposition:** The current flow (`parseSessionUser()` in `src/lib/middleware-helpers.ts:307-360`) makes an HTTP round-trip to `HOSPEDA_BETTER_AUTH_URL/api/auth/get-session` on every protected request. Astro sessions could cache the validated session server-side and avoid the round-trip. Redis driver is available.

**Caveat:** Better Auth already manages sessions. Introducing a second session store would create synchronization risk. This is better evaluated after Better Auth's own session adapter story is clearer.

**Cost estimate: L** (large). Architectural change requiring coordination with the API auth layer. Do not pursue without a dedicated spec.

---

### 4.4 Content Layer's `glob()` loader with `transform` for richer type inference

**What:** The `beta` collection in `src/content.config.ts` already uses the new Content Layer `glob()` loader (correct for Astro 6). However, it does not use the `transform` option available in the Content Layer API, which allows enriching each entry at load time (e.g., computing a `url` field from the `id`).

**Value proposition:** Would eliminate the `buildBetaNav` helper's manual URL construction from `entry.id` inside `beta-nav.ts`, making the collection entries self-describing.

**Cost estimate: S** (small). One-file change to `src/content.config.ts` and `src/lib/beta-nav.ts`. Low priority — current approach works fine.

---

### 4.5 `@astrojs/sitemap` `serialize` option for dynamic sitemap inclusion

**What:** `@astrojs/sitemap@3.7.x` supports a `serialize` function that transforms sitemap entries before output. This could be used to add `hreflang` alternate links for the three supported locales (`es`, `en`, `pt`) to the statically generated sitemap entries.

**Value proposition:** The current static sitemap (`sitemap-0.xml`) lists URLs without `hreflang` alternates. The dynamic sitemap (`sitemap-dynamic.xml`, generated by `src/pages/sitemap-dynamic.xml.ts`) also lacks `hreflang`. Adding them would improve international SEO — especially relevant for the Argentinian market where search results in `es`, `en`, and `pt` all apply.

**Cost estimate: S-M** (small to medium). The sitemap integration side is small; the main effort is understanding the locale URL structure and testing that all three locales are correctly cross-referenced.

---

## Recommended Next Steps (Prioritized)

1. **Fix Zod 4 deprecations in `src/env.ts`** (§1.1) — nine mechanical `z.string().url()` → `z.url()` replacements. Do before the next deployment to stop deprecation warnings from polluting production logs. Effort: ~30 min.

2. **Add `HOSPEDA_NOINDEX_HOSTS` and `PUBLIC_ENABLE_LOGGING` to the Zod schema** (§1.2) — adds two missing env vars to `serverEnvBaseSchema` and replaces direct `import.meta.env` reads with validated helpers. Effort: ~1h.

3. **Enable `staticHeaders: true` in `@astrojs/node` adapter** (§3.2 phase 1) — one-line addition to `astro.config.mjs`. Lets prerendered pages receive security headers. Non-breaking. Effort: 15 min + smoke test.

4. **Smoke-test filter navigation after Astro 6 bump** (§2.1) — manual verification that `astro:transitions/client` `navigate()` still works in React island context. Effort: 30 min exploratory testing.

5. **Route remaining `import.meta.env` reads through `src/lib/env.ts`** (§3.3) — replace ~10 usages in layouts and pages with typed helpers. Aligns with the documented code rule. Effort: ~2h.

6. **Verify `transition:persist` on FAB and ScrollToTop after Astro 6** (§2.4) — manual smoke test across two page navigations in a production build. Effort: 20 min.

7. **Evaluate CSP migration to `security.csp` native subsystem** (§3.2 phase 2, §4.2) — open as a separate spec. Would eliminate significant middleware complexity and extend CSP coverage to prerendered pages. Effort: M (estimated half-day).
