# Research: Astro 6 `security.csp` vs middleware-injected nonces

> **Date**: 2026-05-16
> **Author**: SPEC-046 paso 4 (research previo a generación de tasks)
> **Source**: Astro official docs (configuration-reference, api-reference, astro@6 changelog) via context7
> **Astro version in use** (`apps/web/package.json`): `^6.3.3`
> **Current CSP strategy** (`apps/web/src/middleware.ts`): manual header `Content-Security-Policy-Report-Only` built per request from `buildCspHeader({ nonce, apiUrl, sentryReportUri })`. Nonce generated in middleware and stored in `context.locals.cspNonce`. NO `security.csp` block in `astro.config.mjs` today.

## 1. What changed vs the original SPEC-046 hypothesis

The original §1C.3 (GAP-046-09b) and §1C.7 (GAP-046-13) decisions assumed Astro could be configured to propagate the request nonce into the inline `<style>` and `<script>` tags it emits. **It cannot.**

Astro 6 `security.csp` (the official, supported CSP feature) is **hash-based only**. The configuration surface is:

- `security.csp.algorithm`: `'SHA-256' | 'SHA-384' | 'SHA-512'`
- `security.csp.scriptDirective.{ hashes, resources, strictDynamic }`
- `security.csp.styleDirective.{ hashes, resources }`
- Runtime API (per page): `Astro.csp.insertScriptHash(...)`, `insertStyleHash(...)`, `insertScriptResource(...)`, `insertStyleResource(...)`, `insertDirective(...)`

There is **no** `nonce` mode and **no** `Astro.csp.setNonce(...)` API. Astro emits per-page hashes for every bundled script and scoped style it generates, and writes them into a `<meta http-equiv="content-security-policy">` element injected into the page's `<head>`.

## 2. Documented limitations of Astro 6 `security.csp`

From the Astro 6 docs (Configuration Reference → `security.csp`):

1. **External scripts and external styles are not supported out of the box** — they need manual hash entries.
2. **`<ClientRouter />` is NOT supported.** Astro's docs say verbatim: "consider migrating to the browser native View Transition API instead". The web app uses `<ClientRouter />` today (confirmed by the staging crawl: `ClientRouter.astro_astro_type_script_index_0_lang.hXZbGkYM.js`).
3. **Shiki is not supported** (uses inline styles incompatible with Astro CSP). `<Prism />` is the supported alternative if syntax highlighting is needed.
4. **`'unsafe-inline'` is incompatible** with Astro's CSP implementation — Astro emits hashes for bundled scripts, and CSP3 browsers reject `'unsafe-inline'` whenever hash/nonce sources are present in the same directive.
5. **Dev mode (`astro dev`) is unsupported** for `security.csp`. Only `build` + `preview` test it.
6. **`<meta http-equiv>` carries the policy, not the HTTP header**. Coexisting with a header-based policy from middleware would AND both policies — the more restrictive wins per directive.

These are not opinions, these are documented constraints.

## 3. The two viable paths

There are exactly two coherent designs. The "have nonces AND have `security.csp`" hybrid is not coherent because Astro will not stop emitting hashes once `security.csp` is enabled, and our middleware will not stop emitting nonces unless we delete that code path.

### Path A — Keep nonce-based CSP via middleware (current architecture), patch inline emission

**What it means**: Do **not** enable `security.csp`. Keep `apps/web/src/middleware.ts` as the CSP source. Add a post-render step that walks the HTML body and stamps `nonce="${context.locals.cspNonce}"` onto every `<style>` and `<script>` tag Astro emitted without one.

**Mechanism options** for the stamping step (sub-options inside Path A):

- **A1. String-rewrite in middleware after `next()`**. After `await next()` returns the `Response`, read the HTML body, regex-replace `<style>` and `<script>` openings to add the nonce, send the rewritten body. Cheap, fragile to edge cases (script with attributes, inline event handlers, scripts in comments, `<noscript>` content, etc.).
- **A2. Astro integration with `astro:html-rendered` / `astro:server:setup` hook**. Use the Astro Integration API to register a hook that transforms the rendered HTML before flush. Cleaner separation than middleware string-rewrite. Requires writing a tiny integration package (can live in `apps/web/integrations/csp-nonce-injector/`).
- **A3. Patch upstream**. Submit a PR to Astro to add `security.csp.mode: 'nonce'` or similar. Long-tail, not actionable now.

**Pros (Path A)**:

- `<ClientRouter />` keeps working (no migration).
- Single CSP source: the HTTP header from middleware. No dual-policy AND.
- `report-uri` keeps working (only HTTP headers carry `report-uri` reliably; `<meta>` doesn't).
- Per-request nonce: stronger than per-build hashes (a hash is permanent for the life of the bundle; a nonce rotates per request).
- Compatible with `'strict-dynamic'`, which we already use.

**Cons (Path A)**:

- HTML rewriting is moderately fragile. Needs careful regex or a streaming HTML parser (`htmlparser2`, `parse5`). Risk of accidentally adding nonce to user-controlled `<script>` content (unlikely, but worth defending against).
- Performance: one extra body parse per response. With Astro `output: 'server'` on Node, this is per-request. Likely <1 ms per page, but should be benchmarked.
- We own the implementation forever. Not in mainline Astro.

**Recommended A sub-option**: **A2 (integration with rendered-HTML hook)** for cleanliness. Fall back to **A1 (middleware string-rewrite)** only if the Astro integration API does not expose a usable hook.

### Path B — Migrate to `security.csp` (hash-based), drop ClientRouter

**What it means**: Enable `security.csp` in `astro.config.mjs`. Let Astro emit hashes for its scripts and scoped styles into a `<meta>` element. Stop emitting CSP from middleware (or degrade middleware to set only `Report-To` / `Reporting-Endpoints` / report-uri headers, since `<meta>` cannot carry those). Migrate the web app from `<ClientRouter />` to the browser-native View Transition API.

**Pros (Path B)**:

- Official, supported path. Astro maintains the hashes through bundle changes.
- Cleaner separation of concerns (framework owns the policy for its own emitted content).
- `scriptDirective.strictDynamic: true` is a one-line config.

**Cons (Path B)**:

- **`<ClientRouter />` removal is a big-ticket migration.** Every page using it must be repointed to the native View Transitions API. We lose Astro's enhancements (prefetch on hover, fallback animations, persistence). The site's perceived performance and UX depend on this layer today.
- Two-channel CSP: meta tag for the policy, HTTP header for `report-uri`. Browsers' implementations of split policies are well-defined but split logs (some browsers may only report meta-tag violations under `document.cspReports`, not via `report-uri`).
- Hash-based means external scripts need manual `hashes:` entries — every Sentry/MercadoPago SDK url change forces a config update.
- Dev mode loses CSP coverage entirely.
- `<style is:global>` and Shiki must be re-audited.

## 4. Comparison table

| Dimension | Path A (middleware nonce) | Path B (security.csp hashes) |
|---|---|---|
| ClientRouter compatibility | YES (unchanged) | NO (must migrate) |
| Per-request rotation | YES (nonce per request) | NO (hashes per build) |
| `'strict-dynamic'` | YES (already in policy) | YES (one config flag) |
| Report-uri / Report-to | YES (header) | Partial (header for reporting, meta for policy) |
| Dev-mode coverage | YES (middleware runs in dev) | NO (security.csp build-only) |
| Maintenance burden | We own HTML rewriting | Astro maintains hash list |
| External SDKs (MP, Sentry) | Allowlist in middleware config | Manual hashes per build or allowlist in `resources` |
| Implementation cost | Moderate (1 integration + tests) | High (ClientRouter migration + CSP redesign) |

## 5. Recommendation

**Path A2** — write a small Astro integration that injects the request nonce into `<style>` and `<script>` tags during the rendered-HTML phase. Keep middleware as the single CSP source.

Reasons:

- We already use ClientRouter heavily; migrating away is out of scope for SPEC-046 and would push Phase 2 enforcement back by weeks.
- Per-request nonce rotation is a stronger security posture than per-build hashes (rebuild interval ≈ days vs. nonce per response).
- Middleware-based CSP keeps a single source of truth and full reporting (report-uri in header).
- Hybrid (Path A1) is acceptable as a faster but uglier interim if the integration API has limitations we discover during implementation.

**Path B is NOT rejected outright** — it is a longer-horizon option that would naturally compose with a future "drop ClientRouter for native View Transitions" decision. Treat it as a Post-Phase-2 roadmap item, not a Phase 2 blocker.

## 6. Concrete deliverables this unlocks for tasks

If the user approves **Path A2**, the SPEC-046 task breakdown should include:

1. **T-046-NONCE-INTEGRATION**: implement `apps/web/integrations/csp-nonce-injector/` as an Astro integration using the rendered-HTML hook. Walk the body, stamp nonce on `<style>` and `<script>` lacking one. Skip tags that already have a nonce attribute.
2. **T-046-NONCE-TESTS**: vitest unit tests covering (a) plain `<script>` gets the nonce, (b) `<script src="...">` external gets nonce, (c) script with existing `nonce="..."` is untouched, (d) `<style>` blocks get the nonce, (e) malformed HTML does not crash, (f) script content with `<style>` text inside string literals is not corrupted, (g) `<noscript>` content is not modified.
3. **T-046-09a-REFACTOR**: refactor React islands to remove inline `style=""` props (per GAP-046-09a decision A). Independent of nonce work — nonce does not help `style-src-attr`.
4. **T-046-11-DISABLE-CF-ANALYTICS**: coordinate with SPEC-140 (Umami) rollout, disable CF Web Analytics in dashboard.
5. **T-046-12-FRAME-SRC-NONE**: add `frame-src 'none'` to `buildCspHeader()` output.
6. **T-046-VERIFY-STAGING**: re-crawl staging after deploy, confirm zero new violations under the GAP-046-09/13 set, confirm `/_astro/*.js` cascading blocks disappear (validates `'strict-dynamic'` transitivity after nonce-stamping is in place).

GAP-046-10 is dropped (verified absent — see spec §1C.4).

## 7. Open questions for the user

1. Confirm Path A2 (or pick A1 / B / hybrid).
2. Is the Astro integration code allowed to live under `apps/web/integrations/` or should it be a `@repo/csp-nonce-injector` package for reuse (admin app could use it too eventually)?
3. Coordination window for the Cloudflare Analytics disable: should it happen BEFORE or AFTER SPEC-140 ships? Disabling before SPEC-140 leaves a temporary analytics gap; disabling after gives overlap but requires SPEC-140 to be in-place first.

## 8. References

- Astro 6 Configuration Reference, `security.csp`: https://docs.astro.build/en/reference/configuration-reference/#securitycsp
- Astro 6 API Reference, CSP Runtime API: https://docs.astro.build/en/reference/api-reference/#astroresponse
- Astro 6 beta announcement (CSP intro): https://astro.build/blog/astro-6-beta
- Current middleware: `apps/web/src/middleware.ts` (function `onRequest`, step 9 — sets `Content-Security-Policy-Report-Only`).
- Current astro config: `apps/web/astro.config.mjs` (adapter comment mentions "follow-up SPEC" for native `security.csp` migration — this research clarifies why that follow-up requires more than a one-line config change).
