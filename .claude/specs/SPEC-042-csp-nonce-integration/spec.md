# SPEC-042: CSP Nonce/Hash Integration

> **Status**: draft
> **Created**: 2026-03-09
> **Revised**: 2026-03-16 (sixth audit .. testability fixes, evidence precision, inline warnings, checklist deduplication)
> **Priority**: MEDIUM
> **Origin**: GAP-037-27 (deferred from SPEC-037 security gaps remediation)

---

## 0. Revision History

This document supersedes the original 2026-03-09 draft. The following corrections were applied based on a thorough codebase and upstream documentation audit performed on 2026-03-16.

| # | Original Claim | Correction |
|---|----------------|------------|
| 1 | Sentry injects `_sentryFetchProxy` inline script requiring hash `sha256-y2WkUILyE4eycy7x+pC0z99aZjTZlWfVwgUAfNc1sY8=` | That inline script is exclusive to `@sentry/sveltekit`. The packages used in this project (`@sentry/astro` and `@sentry/react`) use normal ES module imports. No Sentry hash is needed. |
| 2 | `Sentry.init({ nonce })` option exists | This option does not exist in any version of `@sentry/astro` or `@sentry/react`. Removed entirely. |
| 3 | Astro CSP config path is `experimental.security.csp` | The correct path is `experimental.csp` (Astro 5.9+). The `experimental.security.csp` path never existed. |
| 4 | TanStack Start v1.131.26 already has the nonce fix from PR #5522 | PR #5522 was merged 2025-10-17. v1.131.26 was published 2025-08-18. The fix landed in ~v1.133.12+. An upgrade is required. |
| 5 | TanStack Start middleware uses `createMiddleware().headers()` API | Correct API: `createMiddleware().server()`, register via `createStart()` in `start.ts`, nonce flows via `getGlobalStartContext()`. (Further corrected in #17: global request middleware must use `getResponseHeaders()`/`setResponseHeaders()` from `@tanstack/react-start/server`, not `result.response.headers`.) |
| 6 | MercadoPago requires `'unsafe-eval'` | **Re-corrected (2026-03-16)**: The original spec was CORRECT about `'unsafe-eval'` being needed. The previous revision incorrectly removed it based on incomplete static analysis. At least one user report in GitHub Discussion #16 indicates the SDK requires `'unsafe-eval'` de facto. The maintainer acknowledged CSP issues but did not explicitly confirm `'unsafe-eval'` as a requirement. This applies ONLY to the admin app (which loads the SDK for QZPay billing). The web app does NOT load the MercadoPago SDK directly and does NOT need `'unsafe-eval'`. |
| 7 | MercadoPago SDK URL is `sdk.mercadopago.com/v2/mercadopago.js` | Returns 404. Real URL: `sdk.mercadopago.com/js/v2`. Also: domains were incomplete (missing `api.mercadolibre.com`, `api-static.mercadopago.com`; incorrect `frame-src`; no evidence of WebSocket). |
| 8 | Server Islands are experimental in Astro 5.7 | Server Islands have been stable since Astro 5.0. No experimental flag needed. |
| 9 | Spec included `scripts/verify-csp-hashes.ts` and `apps/*/src/lib/csp-hashes.ts` files | Removed. No Sentry hash to verify. Astro auto-computes hashes for `is:inline` scripts. |
| 10 | `worker-src 'self' blob:` was missing for Sentry Replay | Added to both apps' CSP directives. |
| 11 | ~~Previous revision claimed Astro 5.9 uses `scriptDynamic`, renamed to `strictDynamic` in 6.0~~ | **Re-corrected (2026-03-16)**: The previous revision was WRONG. The property has ALWAYS been `strictDynamic` in both Astro 5.9 (experimental) and Astro 6.0 (stable). Verified from Astro 5.18.0 type definitions (`config.d.ts` line 2333: `strictDynamic?: boolean`). No rename ever occurred. |
| 12 | MercadoPago domains incomplete | Added `https://*.mlstatic.com` to `script-src` and `img-src`. Changed specific domain entries to wildcards: `https://*.mercadopago.com` for `connect-src` and `frame-src`. |
| 13 | `child-src blob:` missing for Safari | Added `child-src blob:` to all CSP directives for Session Replay web workers in Safari <= 15.4 (fallback for `worker-src`). |
| 14 | Astro style hashes interaction with `'unsafe-inline'` | Added warning about CSP Level 2+ browsers ignoring `'unsafe-inline'` when hashes are present in `style-src`. May affect Sentry Replay's rrweb inline styles. |
| 15 | Admin unit tests were superficial | Replaced with meaningful tests for `buildSentryReportUri`, `buildCspDirectives`, and nonce generation. |
| 16 | Astro CSP emits via `<meta>` tag for all pages | For prerendered (static) pages, Astro emits CSP via `<meta http-equiv="content-security-policy">`. For SSR (on-demand) pages, since Astro 5.9.3+ (PR #13923), CSP is emitted via the HTTP `content-security-policy` response header, NOT via `<meta>` tag. |
| 17 | TanStack Start nonce fix landed in ~v1.133.6+ | The fix (PR #5522) actually landed in **v1.133.12** (released 2025-10-17). v1.133.6 is the version where the bug was *reported* (Issue #5511). |
| 18 | Admin CSP middleware uses `result.response.headers.set()` | For global request middleware registered via `createStart()`, the correct pattern uses `getResponseHeaders()` / `setResponseHeaders()` from `@tanstack/react-start/server`. The `result.response.headers.set()` pattern is for server route middleware only (see TanStack Discussion #3028). |
| 19 | `'unsafe-eval'` confirmed by MercadoPago maintainer | More accurately: required de facto per user reports in GitHub Discussion #16. No maintainer explicitly confirmed it as a requirement. The maintainer acknowledged CSP issues saying "we just couldn't find how to solve it yet". |
| 20 | `api-static.mercadopago.com` added as missing domain | No evidence found for this domain in official docs, GitHub discussions, or user-shared configs. Marked as pending manual network audit verification. |
| 21 | `connect-src` uses `*.ingest.sentry.io` | Functional but more restrictive than Sentry's official recommendation of `*.sentry.io`. Kept for principle of least privilege; noted official recommendation. |
| 22 | No mention of Astro 6.0 migration path | Added note: in Astro 6.0, `experimental.csp` moves to `security.csp`. The property name `strictDynamic` remains unchanged. A CSP runtime API becomes available. |
| 23 | Style hashes + `'unsafe-inline'` interaction left unresolved | Resolved: do NOT configure `styleDirective` in Astro CSP config. Rely exclusively on the HTTP header's `'unsafe-inline'` in `style-src` to avoid hash/unsafe-inline conflict that would break Sentry Replay. |
| 24 | `vercel.json` removal instructions assume root-level file | No root `vercel.json` exists. Instructions updated to reference per-app `vercel.json` files or Vercel project dashboard configuration. |
| 25 | No criteria defined for Phase 2 transition | Added suggested criteria: minimum 14 days with zero unexpected CSP violations in Sentry before switching from Report-Only to enforcing mode. |
| 26 | Property name `strictDynamic` used throughout spec | **CRITICAL (2026-03-16)**: The property has ALWAYS been `strictDynamic` in Astro 5.9+. There was no rename in Astro 6.0. Corrected all occurrences. Verified from Astro 5.18.0 installed type definitions. |
| 27 | `setResponseHeaders` (plural) assumed to work in global middleware | TanStack Start had a known bug (Issue #5407) where `setResponseHeaders` (plural) did not work in global middleware. The fix landed in a later version (PR #6276 was opened but closed without merge; the actual fix came via a separate PR). Verified working in >= 1.166.0. Added fallback note and version verification step. |
| 28 | Astro upgrade prerequisite may be unnecessary | Project already resolves to Astro 5.18.0 via `^5.7.13` caret semver. Clarified that the `package.json` change documents minimum requirement. |
| 29 | TanStack upgrade target version `1.166.14` may not exist yet | Latest published version is ~1.166.11 as of 2026-03-16. Changed to `>=1.166.0` (any recent version includes all required fixes). |
| 30 | MercadoPago may use WebSockets | User CSP config in Discussion #16 includes `ws:` in `connect-src`. Added to manual network audit checklist. |
| 31 | `start.ts` / `server.ts` coexistence not explained | Added note clarifying that `start.ts` (middleware config) and `server.ts` (server entry point) are complementary files. |
| 32 | Sentry CSP reporting docs URL returns 404 | Updated reference URL to platform-specific path that works. |
| 33 | `style-src 'unsafe-inline'` for Sentry Replay not officially documented | Clarified as de facto requirement (rrweb Issue #816) rather than official Sentry requirement. |
| 34 | `child-src blob:` for Safari <= 15.4 has no direct evidence | Marked as precautionary measure rather than confirmed requirement. |
| 35 | `api.mercadolibre.com` marked as "unverified.. no evidence found" | SDK source analysis confirmed client-side endpoints: `https://api.mercadolibre.com/tracks` (tracking/analytics) and `https://api.mercadolibre.com/melidata/catalog/validate`. Removed "unverified" label.. domain IS required in `connect-src`. |
| 36 | `api-static.mercadopago.com` marked as "no evidence found" | SDK source contains `https://api-static.mercadopago.com/secure-fields/` for Secure Fields assets. Added to `connect-src` in admin CSP. |
| 37 | PR #6276 described as merged fix for Issue #5407 | PR #6276 was actually **closed without merge**. The `setResponseHeaders` fix landed via a different PR. Updated reference. Practical impact: none (spec already recommends >= 1.166.0 which includes the fix). |
| 38 | WebSocket (`ws:`) left as pending verification for MercadoPago | SDK source analysis found **no WebSocket connections**. The `ws:` in Discussion #16 was from the user's own application stack (e.g., Hotjar, dev server), not MercadoPago SDK. Removed from audit checklist. |
| 39 | Phase 1 described as "Report-Only" without caveat about Astro `<meta>` tag enforcement | **CRITICAL**: Astro's `experimental.csp` emits a `<meta http-equiv="Content-Security-Policy">` tag (NOT Report-Only). This tag **enforces** the policy. Only the HTTP header is Report-Only. Added explicit warnings and risk mitigation steps. |
| 40 | Admin test file imports private functions from middleware.ts | Tests reference `buildCspDirectives` and `buildSentryReportUri` which are private. Specified extraction to `apps/admin/src/lib/csp-helpers.ts` for testability. |
| 41 | `setResponseHeaders({ ...headers, [key]: value })` pattern in admin middleware | The spread `...headers` on a `Headers` object produces an empty object. `setResponseHeaders()` uses `Object.entries()` internally (Issue #5407, still open). Correct pattern: `getResponseHeaders().set(key, value)` then `setResponseHeaders(headers)` (confirmed from Discussion #3028). |
| 42 | `getGlobalStartContext()` flagged as non-existent | Function DOES exist. Exported from `@tanstack/react-start` via `@tanstack/start-client-core`. Uses `AsyncLocalStorage` internally (`@tanstack/start-storage-context`). Verified from source code. |
| 43 | No mention of Astro auto-computing style hashes without `styleDirective` config | Astro ALWAYS emits style hashes when CSP is enabled, regardless of `styleDirective` configuration. No way to disable (Issue #14798, open). This may break Sentry Session Replay. Added Section 3.7 with risk documentation and mitigation steps. |
| 44 | Pre-implementation checklist references `app.config.ts` for TanStack Start plugin config | Project uses `vite.config.ts` with `tanstackStart()` plugin, NOT `app.config.ts`. Updated checklist reference. |
| 45 | `transition:name` directive usage not documented | Project uses `transition:name` in 9 files (cards + detail pages) for native browser View Transition API morphing (NOT `<ClientRouter />`). Astro CSP auto-hashes the generated `<style>` tags. Added Section 3.8 documenting this. |
| 46 | `'unsafe-eval'` attributed to MercadoPago core SDK | SDK source analysis shows core SDK does NOT use `eval()`. Only the OPTIONAL antifraud script (`security.js`) requires `unsafe-eval`. Updated Sections 3.3 and 6.2.6. |
| 47 | `scriptDirective.resources` default listed as `['self']` | Actual default is `[]` (empty array). Corrected in Section 6.1.1 API reference table. Same for `styleDirective.resources`. |
| 48 | Sentry CSP reporting docs URL returns 404 | Updated from `/platforms/javascript/guides/express/security-policy-reporting/` to `/platforms/javascript/security-policy-reporting/` in JSDoc comments and References. |
| 49 | `staticHeaders` adapter config not mentioned | Added note about `@astrojs/vercel@10.0.0` adapter-level `staticHeaders` config (also available as core feature in Astro 6.0.0) that enables CSP via HTTP header for prerendered pages, which could resolve Phase 1 meta-tag enforcement caveat. |
| 50 | `_sentryFetchProxy` hash incorrect in revision #1 | Original hash was from outdated docs. Current Sentry docs show `sha256-y2WkUILyE4eycy7x+pC0z99aZjTZlWfVwgUAfNc1sY8=`. Corrected for reference accuracy. |
| 51 | Sentry `connect-src` deviation from official docs not prominent enough | Official Sentry recommendation is `*.sentry.io`, spec uses `*.ingest.sentry.io`. Added explicit warning. |
| 52 | `hashes` type listed as `Array<string>` | Actual type is `Array<CspHash>` (strings must start with `sha256-`, `sha384-`, or `sha512-`). Corrected in API reference table. |
| 53 | Issue #5407 still open, not emphasized | Added explicit warning that the bug is still open and workaround should be verified with exact installed version. |
| 54 | No verification step for `@qazuor/qzpay-core` antifraud script loading | Added pre-implementation checklist item to verify whether `@qazuor/qzpay-core` loads `security.js` automatically. |
| 55 | "Multiple users report" `'unsafe-eval'` requirement in Discussion #16 | Only one user config in Discussion #16 includes `'unsafe-eval'`. Corrected wording. Also: made `sentryDsn` required in `buildCspDirectives` for pure testability, removed Node.js crypto nonce test (tests native API, not our code), added inline WARNING about Astro style hashes in Section 6.1.1, cited `__root.tsx` as QZPayProvider location, consolidated duplicate antifraud checklist items, clarified `customViteReactPlugin` in vite config, renamed ambiguous checklist items. |
| 56 | `experimentalStaticHeaders` name and version, `@sentry/astro` inline scripts, Issue #5407 status, API CSP claim, MercadoPago domains verifiability | Six corrections applied after exhaustive codebase and documentation audit: (1) `experimentalStaticHeaders` renamed to `staticHeaders` with correct version (`@astrojs/vercel@10.0.0` / Astro 6.0.0 core); (2) Added note about `@sentry/astro` using `injectScript()` API; (3) Clarified Issue #5407 remains OPEN with no confirmed fix; (4) Nuanced API CSP claim to reflect documentation route bypass; (5) Added verification note for MercadoPago domains from SDK source analysis; (6) Added Sentry injected scripts verification to pre-implementation checklist. |

---

## 1. Problem Statement

Both the web app (`apps/web`) and admin app (`apps/admin`) currently ship a weak `Content-Security-Policy-Report-Only` header via `vercel.json` that includes `'unsafe-inline' 'unsafe-eval'` in `script-src`. This provides **zero protection** because:

1. **`'unsafe-inline'`** allows any injected `<script>` tag to execute, defeating the purpose of CSP against XSS.
2. **`'unsafe-eval'`** allows `eval()` and `new Function()`, enabling code injection attacks.
3. **Report-Only mode** means even these weak rules are not enforced.. violations are only logged (and currently not even collected anywhere).
4. **Static header via `vercel.json`** cannot include per-request nonces or be dynamically constructed.

### Goal

Replace the static, permissive CSP with a strict, per-request CSP that uses:
- **Hash-based integrity** (web app) .. Astro's built-in `experimental.csp` auto-computes SHA-256 hashes for all `is:inline` scripts and injects them into a `<meta>` tag.
- **Nonce-based integrity** (admin app) .. TanStack Start's `ssr.nonce` propagates a cryptographically random nonce to all SSR-injected `<script>` and `<style>` tags.
- **`'strict-dynamic'`** (both apps) .. allows scripts loaded by trusted (hashed/nonced) scripts to execute, without needing to allowlist every CDN domain.

### Phased Rollout

1. **Phase 1**: Deploy in `Content-Security-Policy-Report-Only` mode. Collect violations via Sentry's CSP reporting endpoint. Fix any violations.
2. **Phase 2**: Switch to enforcing `Content-Security-Policy` mode after a violation-free observation period.

> **Suggested Phase 2 transition criteria:** Minimum 14 consecutive days with zero unexpected CSP violations reported in Sentry. Expected violations from browser extensions or third-party injected scripts should be identified and excluded from the count during the observation period.

---

## 2. Current State

### 2.1 Web App (`apps/web`)

| Attribute | Value |
|-----------|-------|
| Framework | Astro |
| Current version | `5.7.13` (from `/home/qazuor/projects/WEBS/hospeda/apps/web/package.json`) |
| Required version | `>= 5.9.0` (for `experimental.csp`) |
| Sentry package | `@sentry/astro ^10.40.0` |
| CSP strategy | Hash-based (Astro auto-computes) |
| Current CSP header | Static in `vercel.json`, includes `'unsafe-inline' 'unsafe-eval'` |

**Inline scripts inventory** (from `/home/qazuor/projects/WEBS/hospeda/apps/web/src/layouts/BaseLayout.astro`):

1. **FOUC prevention** (line 84-91): Reads `localStorage` for dark mode theme, sets `data-theme` attribute before first paint.
2. **Scroll reveal observer** (line 119-178): Sets up `IntersectionObserver` for scroll-reveal animations and a `MutationObserver` for Server Island content.

Both use `is:inline` (Astro directive). There are **no Sentry inline scripts** .. `@sentry/astro` loads via normal ES module imports.

**Inline styles inventory**:

1. **Skip-to-content** (line 58-73 of BaseLayout.astro): A `<style>` block for the accessibility skip link. This is a standard Astro `<style>` tag (scoped by default), NOT an inline style attribute. Astro handles these natively.

### 2.2 Admin App (`apps/admin`)

| Attribute | Value |
|-----------|-------|
| Framework | TanStack Start |
| Current version | `1.131.26` (from `/home/qazuor/projects/WEBS/hospeda/apps/admin/package.json`) |
| Required version | `>= 1.133.12` (for `ssr.nonce` propagation fix, PR #5522) |
| Sentry package | `@sentry/react ^10.36.0` |
| CSP strategy | Nonce-based (TanStack Start middleware) |
| Current CSP header | Static in `vercel.json`, includes `'unsafe-inline' 'unsafe-eval'` |

**Inline scripts/styles inventory** (from `/home/qazuor/projects/WEBS/hospeda/apps/admin/src/router.tsx`):

1. **Keyframe animation** (line 30-37): An inline `<style>` tag inside `RouterPendingComponent` that defines `@keyframes router-pending-bar`. This **must be moved to CSS** to avoid CSP violations (inline `<style>` tags without a nonce are blocked).

There are **no Sentry inline scripts** .. `@sentry/react` loads via normal ES module imports.

### 2.3 API App (`apps/api`)

The API has CSP configured in its Hono middleware (`apps/api/src/middlewares/security.ts`) with restrictive defaults for non-documentation routes. Documentation routes (`/docs`) bypass CSP to allow Swagger/Scalar inline scripts. CSP improvements for the API are **out of scope** for this spec.

### 2.4 vercel.json CSP Headers

Both apps have identical weak CSP headers in their `vercel.json`:

```
default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.mercadopago.com https://*.vercel.app; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

These will be **removed** and replaced with dynamic, per-request headers set by each app's middleware.

---

## 3. Key Technical Constraints

### 3.1 No Sentry Inline Script Hashes Required

The `_sentryFetchProxy` inline script hash (`sha256-y2WkUILyE4eycy7x+pC0z99aZjTZlWfVwgUAfNc1sY8=`) that appeared in the original spec is **exclusive to `@sentry/sveltekit`**. This project uses:
- `@sentry/astro` (web app) .. loads via Astro integration, uses ES module imports
- `@sentry/react` (admin app) .. loaded as a regular React dependency

Neither package injects inline scripts. Sentry only requires:
- `connect-src https://*.ingest.sentry.io` .. for sending error/performance events
- `style-src 'unsafe-inline'` .. de facto requirement for Session Replay (rrweb uses inline `style` attributes on DOM snapshots via `setAttribute('style', ...)`; see [rrweb Issue #816](https://github.com/rrweb-io/rrweb/issues/816)). This is NOT officially documented by Sentry but is confirmed by real-world behavior.
- `worker-src 'self' blob:` .. for Session Replay web workers
- `child-src blob:` .. precautionary fallback for Safari <= 15.4 which may use `child-src` instead of `worker-src` for web workers. No direct evidence confirming this is required, but included as a defensive measure.

> **Note on `@sentry/astro` script injection:** While `@sentry/astro` does not inject the `_sentryFetchProxy` inline script (exclusive to `@sentry/sveltekit`), it does use Astro's `injectScript('page', ...)` API to inject client-side initialization code. Astro's build pipeline processes these injected scripts and includes them in the final HTML output. When `experimental.csp` is enabled, Astro automatically computes SHA-256 hashes for ALL scripts in the rendered output, including those injected via `injectScript()`. No manual hash management is needed, but this should be verified post-build (see Pre-Implementation Checklist).

### 3.2 No `Sentry.init({ nonce })` Option

This option does not exist in any version of `@sentry/astro` or `@sentry/react`. The original spec's Section 12 was based on a misunderstanding. Sentry does not need nonce propagation because it does not inject inline scripts.

### 3.3 MercadoPago and `'unsafe-eval'` (Admin App Only)

**Clarification (2026-03-16 fifth audit):** The **core MercadoPago SDK** (`sdk.mercadopago.com/js/v2`) does NOT use `eval()`, `new Function()`, or other dynamic code execution patterns. The `'unsafe-eval'` requirement comes from the **optional antifraud script** (`https://www.mercadopago.com/v2/security.js`), which uses `new Function("return this")` and injects widget code from API responses as executable script.

At least one user reports in [GitHub Discussion #16](https://github.com/mercadopago/sdk-js/discussions/16) that their CSP-strict environment fails without `'unsafe-eval'` when the antifraud script is loaded. The SDK maintainer acknowledged the issue but has not provided an official solution ("we just couldn't find how to solve it yet").

**Decision:** `'unsafe-eval'` is included in the admin app CSP **as a precaution** because:
1. `@qazuor/qzpay-core` may load `security.js` automatically (needs verification.. see pre-implementation checklist)
2. The SDK may load additional sub-scripts at runtime that were not fully analyzed
3. Removing it later (if confirmed unnecessary) is a safe, non-breaking change

This applies to the **admin app only**. The admin app loads the MercadoPago SDK client-side via `QZPayProvider` and `createQZPayBilling` from `@qazuor/qzpay-react` in `apps/admin/src/routes/__root.tsx`. The web app does not load the MercadoPago SDK.

**Correct SDK URL**: `https://sdk.mercadopago.com/js/v2` (the original spec had `sdk.mercadopago.com/v2/mercadopago.js` which returns 404).

**Required domains confirmed from SDK source analysis (2026-03-16):**
- `https://api-static.mercadopago.com/secure-fields/` .. hosts Secure Fields assets (confirmed in SDK source)
- `https://api.mercadolibre.com/tracks` and `.../melidata/catalog/validate` .. client-side tracking/analytics (confirmed in SDK source)
- WebSocket (`ws:`) is **NOT required** .. the `ws:` reference in Discussion #16 was from the user's own application stack, not the MercadoPago SDK

### 3.4 Astro CSP Configuration Path

| Astro Version | Config Path | Status |
|---------------|-------------|--------|
| < 5.9 | N/A | No CSP support |
| 5.9 .. 5.x | `experimental.csp` | Experimental flag |
| 6.0+ | `security.csp` | Stable |

Since this project uses `^5.7.13` which resolves to Astro 5.18.0 (already >= 5.9.0), the correct config path is **`experimental.csp`**. The `package.json` change to `^5.9.0` documents the minimum required version.

The `experimental.security.csp` path referenced in the original spec **never existed**.

**Property names**: The `scriptDirective.strictDynamic` property has the same name in both Astro 5.9 (experimental) and Astro 6.0 (stable). No rename needed when upgrading.

**`staticHeaders` (adapter-level config):** Since `@astrojs/vercel@10.0.0`, the Vercel adapter supports `staticHeaders` as an adapter-level configuration option, which allows CSP to be delivered via HTTP response header even for prerendered (static) pages. In Astro 6.0.0, this became a core feature via `adapterFeatures.staticHeaders`. This could mitigate the Phase 1 enforcement caveat (Section 6.1.1) where the `<meta>` tag enforces CSP even in Report-Only mode. Evaluating this feature is deferred to Phase 2 or a follow-up spec, as it requires adapter configuration changes and is not strictly necessary for Phase 1.

**Astro CSP limitations** (confirmed from docs):
- CSP only works in `build` + `preview` mode. In `dev` mode, no CSP `<meta>` tag is emitted.
- View Transitions via `<ClientRouter />` are NOT supported with CSP. (Verified: this project does NOT use View Transitions.)
- Shiki syntax highlighting is NOT supported with CSP. (Verified: this project does NOT use Shiki.)

### 3.5 TanStack Start Version Requirement

PR #5522 (nonce propagation to `HeadContent` and `Scripts` components) was merged on 2025-10-17. The current installed version `1.131.26` was published on 2025-08-18.. **before** the fix. The nonce fix first appeared in approximately `v1.133.12`.

After the upgrade, TanStack Start automatically:
- Reads `router.options.ssr.nonce` and applies it to ALL generated `<script>` and `<link>` tags
- Emits `<meta property="csp-nonce" content="{nonce}">` during SSR via `HeadContent`
- Reads the meta tag during client-side hydration via `ssr-client.ts` and syncs the nonce

### 3.6 `'strict-dynamic'` Behavior

When `'strict-dynamic'` is present in `script-src`:
- **CSP3 browsers** (all modern browsers): Trust is extended to scripts loaded by already-trusted scripts. Host-based allowlists (`https:`) and `'unsafe-inline'` are **ignored**.
- **CSP2 browsers**: `'strict-dynamic'` is ignored. `'unsafe-inline'` is also ignored when hashes/nonces are present. `https:` serves as fallback.
- **CSP1 browsers**: Both `'strict-dynamic'` and hashes/nonces are ignored. `'unsafe-inline'` and `https:` serve as fallback.

This layered approach (`'nonce-xxx'` or hash + `'strict-dynamic'` + `'unsafe-inline'` + `https:`) provides backward compatibility across all CSP levels.

### 3.7 Astro Style Hashes and Session Replay Compatibility

When `experimental.csp` is enabled, Astro ALWAYS auto-computes SHA-256 hashes for ALL `<style>` blocks and includes them in the CSP meta tag/header's `style-src` directive. There is NO way to disable style hash auto-computation while keeping script hash computation (Astro Issue #14798, open, no ETA).

When style hashes are present in `style-src`, CSP2+ browsers IGNORE `'unsafe-inline'` in that same directive. Since browsers enforce BOTH policies (meta tag + HTTP header) independently, even if the HTTP header has `'unsafe-inline'` without hashes, the meta tag's policy with hashes will block inline styles that don't match a hash.

Sentry Session Replay (rrweb) uses `element.setAttribute('style', ...)` which generates inline style attributes that won't match any pre-computed hash.

**Impact**: Session Replay MAY be degraded or non-functional when Astro CSP is active.

**Mitigation**:
1. Verify empirically after implementation (build + preview) whether Session Replay works or only generates console warnings.
2. If Session Replay is completely broken, it can be disabled until Astro Issue #14798 is resolved.
3. Error reporting and performance monitoring are NOT affected (they use `connect-src`, not `style-src`).
4. As a last resort, `experimental.csp` can be removed to restore full Session Replay, falling back to HTTP-header-only CSP (weaker for scripts but functional for styles).

### 3.8 View Transition Name Directives (`transition:name`)

The web app uses Astro's `transition:name` directive in **9 files** for native browser View Transition API morphing animations (card-to-detail page transitions):

**Cards:** `AccommodationCard.astro`, `EventCard.astro`, `DestinationCard.astro`, `FeaturedArticleCard.astro`, `SecondaryArticleCard.astro`

**Detail pages:** `[lang]/alojamientos/[slug].astro`, `[lang]/eventos/[slug].astro`, `[lang]/destinos/[...path].astro`, `[lang]/publicaciones/[slug].astro`

**Important distinction:** This is the **native browser View Transition API** (MPA cross-document transitions), NOT Astro's `<ClientRouter />` (SPA client-side routing). The CSP incompatibility documented by Astro applies exclusively to `<ClientRouter />`, which this project does NOT use.

**What `transition:name` generates:**
- An inline `<style>` tag with a `view-transition-name` CSS property
- A `data-astro-transition-scope` attribute on the element
- **No inline `<script>` tags** (pure CSS)

**CSP impact:** The inline `<style>` tags generated by `transition:name` are automatically hashed by Astro's `experimental.csp` feature and included in the CSP meta tag/header. No manual hashes needed. No CSP violations expected.

**Verification:** After enabling CSP (build + preview), confirm that card-to-detail page transitions still show morphing animations without CSP violations in the console.

---

## 4. Architecture Decision

| App | Strategy | Mechanism | Why |
|-----|----------|-----------|-----|
| **Web** (`apps/web`) | Hash-based | Astro `experimental.csp` auto-computes SHA-256 hashes for `is:inline` scripts and emits them in a `<meta http-equiv="Content-Security-Policy">` tag | Astro controls the HTML output; hashes are deterministic for `is:inline` scripts. No middleware nonce generation needed. |
| **Admin** (`apps/admin`) | Nonce-based | TanStack Start middleware generates a random nonce per request; `ssr.nonce` propagates it to all SSR tags | TanStack Start's SPA-style rendering uses dynamic script injection that changes per build. Nonces are the correct approach for frameworks where script content is not deterministic at config time. |
| **API** (`apps/api`) | No change | Existing Hono CSP middleware | Already strict. |

### Why Not Nonce for Both?

Astro's `experimental.csp` feature is specifically designed for hash-based CSP. It auto-computes hashes at build/render time and injects them into the HTML. Using nonces would require writing custom middleware to modify Astro's rendered HTML (replacing script tags with nonced versions), which is fragile and unnecessary when the built-in feature handles it correctly.

### Why Not Hash for Both?

TanStack Start's SSR output includes dynamically generated scripts (hydration data, route manifests) whose content changes per request. Hashes cannot be pre-computed for dynamic content. Nonces are the correct approach.

---

## 5. Prerequisites

Before implementation begins, these prerequisites MUST be completed:

### 5.1 Verify/Update Astro Version >= 5.9.0

**File**: `/home/qazuor/projects/WEBS/hospeda/apps/web/package.json`

> **Note**: The current `^5.7.13` caret range already resolves to Astro 5.18.0 (latest 5.x), which is >= 5.9.0. The change below documents the minimum required version for CSP support.

Change:
```json
"astro": "^5.7.13"
```
To:
```json
"astro": "^5.9.0"
```

Then run `pnpm install` from the monorepo root.

**Verification**: After install, confirm the `experimental.csp` config option is recognized by Astro (no startup warnings about unknown config keys). Run `pnpm list astro` in `apps/web` to verify the resolved version is >= 5.9.0.

### 5.2 Upgrade TanStack Start to >= 1.133.12

**File**: `/home/qazuor/projects/WEBS/hospeda/apps/admin/package.json`

Update ALL TanStack packages to the same version (they must be kept in sync). Use the latest available version at the time of implementation (must be >= 1.133.12 for nonce fix, >= 1.166.0 recommended for `setResponseHeaders` fix):
```json
"@tanstack/react-router": "^1.166.0",
"@tanstack/react-router-devtools": "^1.166.0",
"@tanstack/react-router-ssr-query": "^1.166.0",
"@tanstack/react-start": "^1.166.0",
"@tanstack/router-plugin": "^1.166.0"
```

Then run `pnpm install` from the monorepo root.

> **CRITICAL**: TanStack Start has a known issue (Issue #5407, **still OPEN as of 2026-03-16**, labeled `needed-for-start-stable`). `setResponseHeaders()` with a `new Headers()` object does not work in global middleware. The correct workaround: call `getResponseHeaders()` first, mutate via `.set()`, then pass back to `setResponseHeaders()` (confirmed from Discussion #3028). See Section 6.2.2 for the correct code. Workaround verified in >= 1.166.0, but Issue #5407 remains OPEN as of 2026-03-16. The workaround pattern is the only reliable approach. **After upgrading, verify this workaround works with the exact installed version** by adding a temporary `console.log` in the middleware and checking response headers.

> **Upgrade review:** This upgrade spans ~35 minor versions (1.131 → 1.166+). Before proceeding with CSP implementation, review the [TanStack Router CHANGELOG](https://github.com/TanStack/router/blob/main/packages/react-router/CHANGELOG.md) for breaking changes. Run `pnpm typecheck && pnpm test` in `apps/admin` after the upgrade to catch any regressions.

**Verification**: After upgrade, confirm that `ssr.nonce` in `createRouter()` options is recognized (TypeScript should not error on the property). Confirm that `HeadContent` emits a `<meta property="csp-nonce">` tag when a nonce is provided.

### 5.3 MercadoPago Domain Audit

SDK source analysis (2026-03-16) confirmed the following client-side domains:

> **Verification note:** The domains `api-static.mercadopago.com` and `api.mercadolibre.com` were identified via SDK source code analysis and could not be independently verified from official documentation, GitHub discussions, or user-shared configurations. However, `api.mercadolibre.com` is plausible given the ML/MP ecosystem integration, and `api-static.mercadopago.com` is covered by the `*.mercadopago.com` wildcard in `connect-src`. The manual network audit in the pre-implementation checklist is the definitive way to confirm all required domains.

- `https://sdk.mercadopago.com/js/v2` .. main SDK entry point
- `https://api.mercadopago.com` .. payment API
- `https://api.mercadolibre.com` .. tracking/analytics (`/tracks`, `/melidata/catalog/validate`)
- `https://api-static.mercadopago.com` .. Secure Fields assets
- `https://*.mlstatic.com` .. static assets (images, scripts)
- `https://secure-fields.mercadopago.com` .. PCI-compliant card field iframes

**No WebSocket connections** were found in the SDK source. The `ws:` in a user config from Discussion #16 was from their own application stack.

Before going to enforcement mode (Phase 2), perform a manual network audit to verify:
1. Load a page with the MercadoPago SDK in a browser with DevTools Network tab open
2. Record ALL domain requests made by the SDK and compare with the list above
3. Confirm no additional domains are needed
4. Check if `https://www.mercadopago.com/v2/security.js` (optional antifraud script) is loaded

This is a manual verification step, not a code change.

---

## 6. Detailed Implementation

### 6.1 Web App (`apps/web`)

#### 6.1.1 Astro Config Changes

**File**: `/home/qazuor/projects/WEBS/hospeda/apps/web/astro.config.mjs`

Add the `experimental.csp` block to the config. Insert it after the `server` block and before the `image` block:

```javascript
// In defineConfig({...}):

    server: {
        port: 4321
    },

    // CSP: hash-based integrity for inline scripts
    experimental: {
        csp: {
            // Hash algorithm for script/style integrity
            algorithm: 'SHA-256',

            // script-src configuration:
            // - Astro auto-computes SHA-256 hashes for all bundled/is:inline scripts
            //   and includes them in the <meta> tag. No manual hash array needed.
            // - strictDynamic adds 'strict-dynamic' so scripts loaded by trusted
            //   (hashed) scripts can also execute.
            // The property name is `strictDynamic` in both Astro 5.9 (experimental)
            // and Astro 6.0 (stable). No rename needed when upgrading.
            scriptDirective: {
                strictDynamic: true,
            },

            // NOTE: Do NOT configure styleDirective here. Astro would emit style
            // hashes in the <meta>/<header>, causing CSP2+ browsers to ignore
            // 'unsafe-inline' in style-src, which breaks Sentry Session Replay
            // (rrweb inline styles). Style CSP is handled via the HTTP header
            // set in middleware.

            // Additional CSP directives added to the <meta> tag.
            // NOTE: frame-ancestors and report-uri are IGNORED in <meta> tags
            // (per CSP spec). Those are set via HTTP header in the middleware.
            directives: [
                "default-src 'self'",
                "font-src 'self' https://fonts.gstatic.com",
                "img-src 'self' data: https:",
                "connect-src 'self' https://*.ingest.sentry.io https://*.vercel.app",
                "worker-src 'self' blob:",
                "child-src blob:",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self'",
            ],
        },
    },

    image: {
        // ... existing config
    },
```

> **WARNING -- Astro style hashes and Sentry Session Replay:**
> Astro ALWAYS auto-computes and emits SHA-256 hashes for ALL `<style>` blocks when `experimental.csp` is enabled, even without configuring `styleDirective` (Astro Issue #14798, open, no ETA). When style hashes are present in the CSP `<meta>` tag's `style-src`, CSP2+ browsers IGNORE `'unsafe-inline'` in that directive. This means Sentry Session Replay's rrweb inline styles (`element.setAttribute('style', ...)`) may be blocked by the `<meta>` tag's policy, even though the HTTP header includes `'unsafe-inline'`. See Section 3.7 for full risk analysis and mitigation steps. Test Session Replay functionality via `pnpm build && pnpm preview` after enabling CSP.

> **Important — CSP delivery mechanism differs by rendering mode:**
> - **Prerendered (static) pages:** Astro emits CSP via `<meta http-equiv="content-security-policy">` tag embedded in the HTML output.
> - **SSR (on-demand) pages:** Since Astro 5.9.3+ (PR [#13923](https://github.com/withastro/astro/pull/13923)), CSP is emitted via the HTTP `content-security-policy` response header.
>
> Both mechanisms are handled automatically by Astro's `experimental.csp` feature. The middleware HTTP header (`Content-Security-Policy-Report-Only`) is additive and provides the `report-uri` directive that `<meta>` tags cannot carry (per CSP spec, `report-uri` is ignored in `<meta>` delivery).

> **CRITICAL — Phase 1 enforcement caveat:**
> Astro's `experimental.csp` emits a `<meta http-equiv="Content-Security-Policy">` tag (NOT `Content-Security-Policy-Report-Only`). This means the `<meta>` tag **enforces** the policy even during Phase 1. Only the HTTP header set by the middleware uses `Content-Security-Policy-Report-Only`.
>
> **Practical impact:** Scripts that violate the `<meta>` tag's `script-src` (e.g., a script without a matching hash) will be **blocked**, not just reported. Since Astro auto-computes hashes for all `is:inline` scripts and bundled scripts, this should not cause issues for first-party code. However:
> 1. Browser extensions that inject scripts will be blocked (expected and acceptable).
> 2. Any third-party script loaded via a non-hashed mechanism will be blocked (mitigated by `'strict-dynamic'`).
> 3. Test thoroughly via `pnpm build && pnpm preview` before deploying.
>
> **Risk mitigation:** If unexpected blockage occurs in staging, the `experimental.csp` block can be temporarily removed from `astro.config.mjs` while keeping the Report-Only HTTP header for monitoring. This gives a pure report-only mode as fallback.

> **Alternative: `staticHeaders` (`@astrojs/vercel@10.0.0` / Astro 6.0.0 core).** Since `@astrojs/vercel@10.0.0`, the Vercel adapter supports `staticHeaders` as an adapter-level configuration option, which enables CSP delivery via HTTP headers (instead of `<meta>` tags) even for prerendered (static) pages. In Astro 6.0.0, this became a core feature via `adapterFeatures.staticHeaders`. This could resolve the Phase 1 enforcement caveat above by allowing ALL pages to use `Content-Security-Policy-Report-Only` via HTTP header. However, this feature requires further investigation. Consider evaluating it if the `<meta>` tag enforcement causes issues during Phase 1 testing.

**API reference** (confirmed from Astro docs at https://docs.astro.build/en/reference/experimental-flags/csp/):

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| `algorithm` | `'SHA-256' \| 'SHA-384' \| 'SHA-512'` | `'SHA-256'` | Hash function for script/style integrity |
| `scriptDirective.strictDynamic` | `boolean` | `false` | Adds `'strict-dynamic'` to `script-src` (same property name in both Astro 5.9 experimental and Astro 6.0 stable) |
| `scriptDirective.hashes` | `Array<CspHash>` | `[]` | Additional hashes for external scripts not processed by Astro. Values must start with `sha256-`, `sha384-`, or `sha512-` |
| `scriptDirective.resources` | `Array<string>` | `[]` | **Overrides** default `script-src` sources. When set, `'self'` is NOT included by default and must be added explicitly if needed |
| `styleDirective.hashes` | `Array<CspHash>` | `[]` | Additional hashes for external styles not processed by Astro. Values must start with `sha256-`, `sha384-`, or `sha512-` |
| `styleDirective.resources` | `Array<string>` | `[]` | **Overrides** default `style-src` sources. When set, `'self'` is NOT included by default and must be added explicitly if needed |
| `directives` | `Array<string>` | `[]` | Additional CSP directives (e.g., `connect-src`, `img-src`) |

> **Note:** `styleDirective` is intentionally NOT configured in this spec (see Revision #22). Configuring it causes Astro to emit style hashes, which makes CSP2+ browsers ignore `'unsafe-inline'` in `style-src`, breaking Sentry Session Replay (rrweb inline styles). Style CSP is handled exclusively via the HTTP header set in middleware.

**What this does**:
- Astro auto-computes SHA-256 hashes for every bundled script and `<script is:inline>` in the rendered HTML.
- For prerendered pages, Astro emits a `<meta http-equiv="content-security-policy">` tag in the `<head>` with the computed hashes. For SSR pages (Astro 5.9.3+), CSP is delivered via the HTTP `content-security-policy` response header.
- `strictDynamic: true` adds `'strict-dynamic'` to `script-src`, allowing scripts loaded by hashed scripts to also execute.
- The `directives` array adds non-script/style directives (`connect-src`, `img-src`, etc.) to the meta tag.
- `styleDirective` is intentionally NOT configured (see Revision #23). Style CSP is handled via the HTTP header in middleware.

**Limitations of `<meta>` CSP** (per W3C CSP Level 3 spec):
- `frame-ancestors` is **ignored** in `<meta>` tags .. covered by `X-Frame-Options: DENY` in `vercel.json`.
- `report-uri` is **ignored** in `<meta>` tags .. set via HTTP header in the middleware (see 6.1.2).

**The middleware** (see 6.1.2) sets an additional `Content-Security-Policy-Report-Only` HTTP header that includes `frame-ancestors`, `report-uri`, and duplicates the other directives. When both a `<meta>` tag and an HTTP header are present, browsers enforce BOTH policies (a resource must satisfy both to load). In Report-Only mode, the HTTP header only reports violations without blocking.

**Important notes**:
- CSP only works in `build` + `preview` mode, NOT in `dev` mode. During development, no CSP headers are emitted.
- `scriptDirective.hashes` and `styleDirective.hashes` are arrays of hash strings (e.g., `"sha256-abc..."`) for scripts/styles NOT processed by Astro. Since all our inline scripts are `is:inline` (processed by Astro), we do not need to add manual hashes.
- `resources` arrays **override** Astro's defaults. If you set `styleDirective.resources`, you MUST include `'self'` explicitly.

#### 6.1.2 Middleware CSP Header

**File**: `/home/qazuor/projects/WEBS/hospeda/apps/web/src/middleware.ts`

Add the CSP header setting step after the 404 rewrite (Step 6). This sets the full CSP HTTP header on all HTML responses.

First, add the import for `buildSentryReportUri` at the top of the file:

```typescript
import { defineMiddleware } from 'astro:middleware';
import {
    buildLocaleRedirect,
    buildLoginRedirect,
    buildSentryReportUri,
    extractLocaleFromPath,
    isAuthRoute,
    isProtectedRoute,
    isServerIslandRoute,
    isStaticAssetRoute,
    parseSessionUser
} from './lib/middleware-helpers';
```

Then, replace the return statement at the end of `onRequest` with the CSP header logic. The current code (lines 82-90):

```typescript
    const response = await next();

    // Step 6: If the downstream route returned a 404, rewrite to our custom 404 page.
    if (response.status === 404) {
        return context.rewrite('/404');
    }

    return response;
```

Becomes:

```typescript
    const response = await next();

    // Step 6: If the downstream route returned a 404, rewrite to our custom 404 page.
    if (response.status === 404) {
        return context.rewrite('/404');
    }

    // Step 7: Set Content-Security-Policy-Report-Only header on HTML responses.
    //
    // WHY both <meta> and HTTP header?
    // - Astro's experimental.csp emits a <meta> tag with script/style hashes.
    //   This enforces script-src and style-src with hash integrity.
    // - The <meta> tag CANNOT express frame-ancestors or report-uri (per CSP spec).
    // - The HTTP header adds frame-ancestors, report-uri, and report-only mode.
    //
    // DUAL POLICY behavior: When both a <meta> and HTTP header CSP exist,
    // browsers enforce BOTH independently. A resource must satisfy both.
    // The <meta> tag's script-src includes specific hashes. The HTTP header's
    // script-src uses 'strict-dynamic' + 'unsafe-inline' + https: as fallback
    // chain. These are compatible because:
    // - CSP3 browsers: 'strict-dynamic' in the header allows scripts loaded by
    //   hashed scripts (from <meta>) to execute.
    // - The header does NOT add additional hash requirements (no conflict).
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/html')) {
        const sentryDsn = import.meta.env.PUBLIC_SENTRY_DSN;
        const sentryReportUri = sentryDsn
            ? buildSentryReportUri({ dsn: sentryDsn })
            : null;

        // Phase 1: Report-Only mode. Change to 'Content-Security-Policy' for Phase 2.
        // IMPORTANT: The Astro <meta> tag emits enforcing CSP (not Report-Only).
        // This HTTP header is additive. Scripts blocked by the <meta> tag will
        // be blocked regardless of this header's Report-Only mode. See Section 6.1.1.
        const CSP_HEADER_NAME = 'Content-Security-Policy-Report-Only';

        const directives = [
            "default-src 'self'",
            // 'strict-dynamic' + 'unsafe-inline' + https: = layered fallback:
            //   CSP3: uses strict-dynamic (ignores unsafe-inline and https:)
            //   CSP2: uses hashes from <meta> (ignores unsafe-inline when hashes present)
            //   CSP1: uses unsafe-inline + https: as fallback
            "script-src 'self' 'strict-dynamic' 'unsafe-inline' https:",
            // 'unsafe-inline' required for Sentry Replay (rrweb inline style attributes).
            "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https:",
            "connect-src 'self' https://*.ingest.sentry.io https://*.vercel.app",
            "worker-src 'self' blob:",
            "child-src blob:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            // frame-ancestors MUST be in HTTP header (ignored in <meta> tags)
            "frame-ancestors 'none'",
            // report-uri MUST be in HTTP header (ignored in <meta> tags)
            sentryReportUri ? `report-uri ${sentryReportUri}` : null,
        ].filter(Boolean).join('; ');

        response.headers.set(CSP_HEADER_NAME, directives);
    }

    return response;
```

**Updated JSDoc** at the top of the file (replace the existing JSDoc block):

```typescript
/**
 * Astro middleware for locale validation, authentication protection, and CSP.
 * Handles:
 * 1. Skipping static assets and API routes
 * 2. Enforcing trailing slash (redirect before Astro route resolution)
 * 3. Validating locale from URL path and redirecting invalid locales
 * 4. Setting validated locale in context.locals
 * 5. Protecting /mi-cuenta/* routes with authentication checks
 * 6. Rewriting 404 responses to the custom 404 page
 * 7. Setting Content-Security-Policy header on HTML responses
 */
```

#### 6.1.3 Add buildSentryReportUri Helper

**File**: `/home/qazuor/projects/WEBS/hospeda/apps/web/src/lib/middleware-helpers.ts`

Add this function at the end of the file (after `parseSessionUser`):

```typescript
/**
 * Builds a Sentry CSP report URI from a Sentry DSN.
 * Sentry accepts CSP violation reports at its security endpoint.
 *
 * @see https://docs.sentry.io/platforms/javascript/security-policy-reporting/
 *
 * DSN format: https://{key}@{host}/{project_id}
 * Report URI: https://{host}/api/{project_id}/security/?sentry_key={key}
 */
// NOTE: This function is intentionally duplicated in apps/admin/src/lib/csp-helpers.ts.
// Extracting to a shared package is deferred to avoid cross-app dependency for a single utility.
export function buildSentryReportUri({ dsn }: { dsn: string }): string | null {
    try {
        const url = new URL(dsn);
        const key = url.username;
        const projectId = url.pathname.replace(/\//g, '');
        const host = url.hostname;

        if (!key || !projectId || !host) {
            return null;
        }

        return `https://${host}/api/${projectId}/security/?sentry_key=${key}`;
    } catch {
        return null;
    }
}
```

#### 6.1.4 vercel.json Changes

**File**: `/home/qazuor/projects/WEBS/hospeda/apps/web/vercel.json`

Remove the `Content-Security-Policy-Report-Only` header from the static headers. The CSP is now set dynamically by middleware. Keep all other security headers.

Replace the first `headers` entry (lines 8-40) with:

```json
{
    "source": "/(.*)",
    "headers": [
        {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
        },
        {
            "key": "X-Frame-Options",
            "value": "DENY"
        },
        {
            "key": "X-XSS-Protection",
            "value": "0"
        },
        {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
        },
        {
            "key": "Permissions-Policy",
            "value": "camera=(), microphone=(), geolocation=()"
        },
        {
            "key": "Strict-Transport-Security",
            "value": "max-age=31536000; includeSubDomains; preload"
        }
    ]
}
```

The `Content-Security-Policy-Report-Only` header is removed. Static assets (CSS, JS, images) served directly by Vercel's CDN will not have a CSP header, which is correct.. CSP only matters for HTML documents.

### 6.2 Admin App (`apps/admin`)

#### 6.2.1 Move Inline Keyframe to CSS

**File**: `/home/qazuor/projects/WEBS/hospeda/apps/admin/src/styles.css`

Add the keyframe animation at the end of the file (before the closing, after the `.text-xss` rule):

```css
.text-xss {
    font-size: 0.5rem;
}

@keyframes router-pending-bar {
    0% {
        width: 0%;
        margin-left: 0%;
    }
    50% {
        width: 60%;
        margin-left: 20%;
    }
    100% {
        width: 0%;
        margin-left: 100%;
    }
}
```

**File**: `/home/qazuor/projects/WEBS/hospeda/apps/admin/src/router.tsx`

Remove the inline `<style>` tag from `RouterPendingComponent`. Replace the current component (lines 21-39):

```typescript
function RouterPendingComponent() {
    return (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5">
            <div
                className="h-full bg-primary"
                style={{
                    animation: 'router-pending-bar 1.5s ease-in-out infinite'
                }}
            />
            <style>{`
                @keyframes router-pending-bar {
                    0% { width: 0%; margin-left: 0%; }
                    50% { width: 60%; margin-left: 20%; }
                    100% { width: 0%; margin-left: 100%; }
                }
            `}</style>
        </div>
    );
}
```

With:

```typescript
/**
 * Loading bar shown during route transitions.
 * Only appears after defaultPendingMs delay to avoid flash on fast navigations.
 * The @keyframes animation is defined in styles.css to avoid inline <style> CSP violations.
 */
function RouterPendingComponent() {
    return (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5">
            <div
                className="h-full bg-primary"
                style={{
                    animation: 'router-pending-bar 1.5s ease-in-out infinite'
                }}
            />
        </div>
    );
}
```

Note: The `style={{ animation: '...' }}` prop is an inline style **attribute** (set via `HTMLElement.style`), NOT an inline `<style>` tag. Inline style attributes are controlled by `style-src`, not `script-src`. Since our CSP includes `style-src ... 'unsafe-inline'` (required for Sentry Replay anyway), inline style attributes are allowed.

#### 6.2.2 Create CSP Middleware

**File**: `/home/qazuor/projects/WEBS/hospeda/apps/admin/src/middleware.ts` (NEW FILE)

> **Architecture note:** The helper functions `buildSentryReportUri` and `buildCspDirectives` are extracted to `apps/admin/src/lib/csp-helpers.ts` (see Section 6.2.6) for testability. The middleware file imports them.

```typescript
/**
 * TanStack Start middleware for Content-Security-Policy header injection.
 * Generates a cryptographically random nonce per request and sets it in context.
 * The nonce flows to the router via getGlobalStartContext() and is propagated
 * to all SSR-injected <script> and <link> tags by TanStack Start's HeadContent
 * and Scripts components.
 *
 * @see https://tanstack.com/start/latest/docs/framework/react/middleware
 */

import { randomBytes } from 'node:crypto';
import { createMiddleware } from '@tanstack/react-start';
import { getResponseHeaders, setResponseHeaders } from '@tanstack/react-start/server';
import { buildCspDirectives } from './lib/csp-helpers';

/**
 * CSP middleware that generates a per-request nonce and sets the CSP header.
 * The nonce is placed in context so that the router can access it via
 * getGlobalStartContext() and pass it to ssr.nonce for tag injection.
 */
export const cspMiddleware = createMiddleware().server(async ({ next }) => {
    const nonce = randomBytes(16).toString('base64url');
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN || process.env.VITE_SENTRY_DSN || '';
    const cspValue = buildCspDirectives({ nonce, sentryDsn });

    const result = await next({ context: { cspNonce: nonce } });

    // For global request middleware registered via createStart(),
    // use getResponseHeaders/setResponseHeaders (not result.response.headers).
    // See: https://github.com/TanStack/router/discussions/3028
    //
    // CAUTION: Issue #5407 (setResponseHeaders bug in global middleware) is
    // still OPEN as of 2026-03-16 with label `needed-for-start-stable`. There
    // is NO confirmed fix in any released version. PR #6276 was closed without
    // merge. The workaround below (get → mutate → set) is the only reliable
    // approach (confirmed from Discussion #3028). Post-upgrade verification
    // is MANDATORY.
    //
    // IMPORTANT: This HTTP header is additive for the admin app (TanStack Start, no <meta> tag).
    //
    // WHY .set() instead of spread: Spreading a Web API Headers object via
    // `{ ...headers }` produces an EMPTY object because Headers properties are
    // not enumerable. `setResponseHeaders()` uses `Object.entries()` internally,
    // which also returns empty for Headers objects (Issue #5407, still open).
    // The correct pattern is to mutate the Headers object by reference via .set(),
    // then pass it to setResponseHeaders() as a safety net.
    // Confirmed from TanStack Discussion #3028.
    const CSP_HEADER_NAME = 'Content-Security-Policy-Report-Only';
    const headers = getResponseHeaders();
    headers.set(CSP_HEADER_NAME, cspValue);
    setResponseHeaders(headers);

    return result;
});
```

#### 6.2.3 Create start.ts for Middleware Registration

**File**: `/home/qazuor/projects/WEBS/hospeda/apps/admin/src/start.ts` (NEW FILE)

```typescript
/**
 * TanStack Start configuration.
 * Registers request middleware that runs for every incoming request.
 *
 * @see https://tanstack.com/start/latest/docs/framework/react/start-config
 */

import { createStart } from '@tanstack/react-start';
import { cspMiddleware } from './middleware';

export const start = createStart(() => ({
    requestMiddleware: [cspMiddleware],
}));
```

> **Note on `start.ts` vs `server.ts`**: The admin app already has `src/server.ts` which uses `createStartHandler()` as the server entry point. The new `start.ts` file is complementary.. it configures middleware via `createStart()`, while `server.ts` handles the HTTP server handler. These are different concerns and coexist without conflict. `start.ts` is automatically picked up by TanStack Start's build system. **Do NOT merge these files or modify `server.ts`.**

> **Auto-discovery fallback:** TanStack Start discovers `start.ts` by convention (same directory as `router.tsx`). The project's `vite.config.ts` uses `tanstackStart({ customViteReactPlugin: true })`. If the middleware does not execute after creating this file (verify with a temporary `console.log`), check the `@tanstack/router-plugin` configuration in `vite.config.ts`. The plugin accepts a `startDir` option to specify where to look for `start.ts`. If needed, add:
> ```typescript
> tanstackStart({ customViteReactPlugin: true, startDir: './src' })
> ```

#### 6.2.4 Update Router to Consume Nonce

**File**: `/home/qazuor/projects/WEBS/hospeda/apps/admin/src/router.tsx`

Add the nonce consumption logic. The nonce flows from the middleware context through `getGlobalStartContext()` on the server, and through the `<meta property="csp-nonce">` tag on the client (auto-emitted by `HeadContent` after the TanStack Start upgrade).

Add these imports at the top of the file (after the existing imports):

```typescript
import { createRouter as createTanstackRouter } from '@tanstack/react-router';
import { createIsomorphicFn, getGlobalStartContext } from '@tanstack/react-start';

// Import the generated route tree
import { routeTree } from './routeTree.gen';
```

Add the `getCspNonce` function before `createRouter`:

```typescript
/**
 * Retrieves the CSP nonce from the middleware context (server-side)
 * or from the <meta property="csp-nonce"> tag (client-side).
 *
 * Server: getGlobalStartContext() provides the context set by cspMiddleware.
 * Client: HeadContent auto-emits <meta property="csp-nonce" content="{nonce}">
 *         during SSR, and ssr-client.ts reads it during hydration.
 */
const getCspNonce = createIsomorphicFn()
    .server(() => {
        const ctx = getGlobalStartContext();
        return (ctx as { cspNonce?: string })?.cspNonce;
    })
    .client(() => {
        return document.querySelector('meta[property="csp-nonce"]')?.getAttribute('content') ?? undefined;
    });
```

Update `createRouter` to pass the nonce via `ssr.nonce`:

```typescript
// Create a new router instance
export const createRouter = () => {
    const context: RouterContext = {};

    return createTanstackRouter({
        routeTree,
        context,
        scrollRestoration: true,
        defaultPreloadStaleTime: 0,
        defaultPreload: 'intent',
        defaultPreloadDelay: 100,
        defaultPendingComponent: RouterPendingComponent,
        defaultPendingMs: 200,
        // CSP nonce propagation: TanStack Start applies this nonce to all
        // SSR-injected <script> and <link> tags via HeadContent and Scripts.
        ssr: {
            nonce: getCspNonce(),
        },
    });
};
```

**Full updated file** (`/home/qazuor/projects/WEBS/hospeda/apps/admin/src/router.tsx`):

```typescript
import { createRouter as createTanstackRouter } from '@tanstack/react-router';
import { createIsomorphicFn, getGlobalStartContext } from '@tanstack/react-start';

// Import the generated route tree
import { routeTree } from './routeTree.gen';

/**
 * Router context interface
 * Provides shared services and state to all routes
 */
export interface RouterContext {
    readonly auth?: {
        readonly userId: string;
        readonly permissions: readonly string[];
    };
}

/**
 * Loading bar shown during route transitions.
 * Only appears after defaultPendingMs delay to avoid flash on fast navigations.
 * The @keyframes animation is defined in styles.css to avoid inline <style> CSP violations.
 */
function RouterPendingComponent() {
    return (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5">
            <div
                className="h-full bg-primary"
                style={{
                    animation: 'router-pending-bar 1.5s ease-in-out infinite'
                }}
            />
        </div>
    );
}

/**
 * Retrieves the CSP nonce from the middleware context (server-side)
 * or from the <meta property="csp-nonce"> tag (client-side).
 *
 * Server: getGlobalStartContext() provides the context set by cspMiddleware.
 * Client: HeadContent auto-emits <meta property="csp-nonce" content="{nonce}">
 *         during SSR, and ssr-client.ts reads it during hydration.
 */
const getCspNonce = createIsomorphicFn()
    .server(() => {
        const ctx = getGlobalStartContext();
        return (ctx as { cspNonce?: string })?.cspNonce;
    })
    .client(() => {
        return document.querySelector('meta[property="csp-nonce"]')?.getAttribute('content') ?? undefined;
    });

// Create a new router instance
export const createRouter = () => {
    const context: RouterContext = {};

    return createTanstackRouter({
        routeTree,
        context,
        scrollRestoration: true,
        defaultPreloadStaleTime: 0,
        defaultPreload: 'intent',
        defaultPreloadDelay: 100,
        defaultPendingComponent: RouterPendingComponent,
        defaultPendingMs: 200,
        ssr: {
            nonce: getCspNonce(),
        },
    });
};

// Register the router instance for type safety
declare module '@tanstack/react-router' {
    interface Register {
        router: ReturnType<typeof createRouter>;
    }
}
```

#### 6.2.5 vercel.json Changes

**File**: `/home/qazuor/projects/WEBS/hospeda/apps/admin/vercel.json`

Remove the `Content-Security-Policy-Report-Only` header from the static headers. Replace the first `headers` entry (lines 6-38) with:

```json
{
    "source": "/(.*)",
    "headers": [
        {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
        },
        {
            "key": "X-Frame-Options",
            "value": "DENY"
        },
        {
            "key": "X-XSS-Protection",
            "value": "0"
        },
        {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
        },
        {
            "key": "Permissions-Policy",
            "value": "camera=(), microphone=(), geolocation=()"
        },
        {
            "key": "Strict-Transport-Security",
            "value": "max-age=31536000; includeSubDomains; preload"
        }
    ]
}
```

#### 6.2.6 CSP Helpers (Extracted for Testability)

**File**: `/home/qazuor/projects/WEBS/hospeda/apps/admin/src/lib/csp-helpers.ts` (NEW FILE)

```typescript
/**
 * CSP (Content Security Policy) helper functions.
 * Extracted from middleware for testability.
 */

/**
 * Builds a Sentry CSP report URI from a Sentry DSN.
 * Sentry accepts CSP violation reports at its security endpoint.
 *
 * @see https://docs.sentry.io/platforms/javascript/security-policy-reporting/
 *
 * DSN format: https://{key}@{host}/{project_id}
 * Report URI: https://{host}/api/{project_id}/security/?sentry_key={key}
 */
// NOTE: This function is intentionally duplicated from apps/web/src/lib/middleware-helpers.ts.
// Extracting to a shared package (@repo/utils) is deferred to avoid adding a cross-app
// dependency for a single utility function. If more CSP utilities are needed, consolidate then.
export function buildSentryReportUri({ dsn }: { dsn: string }): string | null {
    try {
        const url = new URL(dsn);
        const key = url.username;
        const projectId = url.pathname.replace(/\//g, '');
        const host = url.hostname;

        if (!key || !projectId || !host) {
            return null;
        }

        return `https://${host}/api/${projectId}/security/?sentry_key=${key}`;
    } catch {
        return null;
    }
}

/**
 * Builds the complete CSP directive string for the admin app.
 * Uses nonce-based script integrity with strict-dynamic fallback chain.
 *
 * @param nonce - Cryptographically random nonce for this request
 * @param sentryDsn - Sentry DSN for CSP violation reporting. Pass empty string to disable reporting.
 */
export function buildCspDirectives({ nonce, sentryDsn }: { nonce: string; sentryDsn: string }): string {
    const sentryReportUri = sentryDsn
        ? buildSentryReportUri({ dsn: sentryDsn })
        : null;

    const directives = [
        "default-src 'self'",
        // 'nonce-{RANDOM}' for this request's scripts. 'strict-dynamic' extends trust
        // to scripts loaded by nonced scripts. 'unsafe-eval' included as precaution for
        // MercadoPago's optional antifraud script (security.js) which uses new Function().
        // Can be removed if @qazuor/qzpay-core does not load security.js (see pre-impl checklist).
        // 'unsafe-inline' ignored by CSP2+ when nonce is present (serves as CSP1 fallback).
        // https: ignored by strict-dynamic (serves as CSP2 fallback).
        `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' 'unsafe-inline' https:`,
        // NOTE: The MercadoPago SDK is loaded programmatically by @mercadopago/sdk-js
        // (via @qazuor/qzpay-react -> @qazuor/qzpay-core). The loadMercadoPago() function
        // creates a <script> tag dynamically. Since this happens within a nonced script,
        // 'strict-dynamic' allows the dynamically-created script to execute.
        // The https: fallback covers CSP2 browsers where 'strict-dynamic' is not supported.
        // 'unsafe-inline' required for Sentry Replay (rrweb uses inline style attributes).
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        // MercadoPago domains for QZPay billing integration
        "img-src 'self' data: https: https://*.mlstatic.com",
        "connect-src 'self' https://*.ingest.sentry.io https://*.vercel.app https://*.mercadopago.com https://api.mercadolibre.com https://api-static.mercadopago.com",
        "frame-src https://*.mercadopago.com",
        "worker-src 'self' blob:",
        "child-src blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        sentryReportUri ? `report-uri ${sentryReportUri}` : null,
    ].filter(Boolean).join('; ');

    return directives;
}
```

### 6.3 API App (`apps/api`)

**No changes required.** The API has CSP configured in its Hono middleware with restrictive defaults. Further API CSP hardening (env var override restrictions, documentation route CSP) is out of scope.

### 6.4 Third-Party Domain Allowlist

Complete and verified list of third-party domains required in CSP directives:

#### Sentry (both apps)

| Directive | Domain | Purpose |
|-----------|--------|---------|
| `connect-src` | `https://*.ingest.sentry.io` | Error/performance event ingestion |
| `style-src` | `'unsafe-inline'` | Session Replay (rrweb) inline style attributes |
| `worker-src` | `'self' blob:` | Session Replay web workers |
| `child-src` | `blob:` | Session Replay web workers (Safari <= 15.4 fallback) |
| `report-uri` | `https://{host}/api/{project_id}/security/?sentry_key={key}` | CSP violation reporting |

> **WARNING: Deviation from official Sentry docs.** This spec uses `https://*.ingest.sentry.io` (principle of least privilege) instead of Sentry's official recommendation of `*.sentry.io` ([CDN install docs](https://docs.sentry.io/platforms/javascript/install/cdn/)). The narrower wildcard works for event ingestion but may miss other Sentry domains (source maps, release health, etc.). If ANY Sentry functionality stops working after CSP enforcement, widen `connect-src` to `https://*.sentry.io` as the first troubleshooting step. This is a deliberate security trade-off: tighter CSP at the cost of potential Sentry functionality gaps.

#### Google Fonts (web app only)

| Directive | Domain | Purpose |
|-----------|--------|---------|
| `style-src` | `https://fonts.googleapis.com` | Font CSS stylesheets |
| `font-src` | `https://fonts.gstatic.com` | Font files (woff2) |

#### MercadoPago (admin app only.. QZPay billing integration)

| Directive | Domain | Purpose |
|-----------|--------|---------|
| `script-src` | `https://sdk.mercadopago.com` | JavaScript SDK |
| `script-src` | `https://*.mlstatic.com` | Static assets used by SDK |
| `connect-src` | `https://*.mercadopago.com` | Payment API and subdomains |
| `connect-src` | `https://api.mercadolibre.com` | Tracking/analytics (`/tracks`, `/melidata/catalog/validate`) .. confirmed in SDK source |
| `connect-src` | `https://api-static.mercadopago.com` | Secure Fields assets .. confirmed in SDK source |
| `frame-src` | `https://*.mercadopago.com` | Payment form iframes and PCI-compliant card fields |
| `img-src` | `https://*.mlstatic.com` | Payment method images |

> **Note on `script-src` domains:** The MercadoPago SDK (`sdk.mercadopago.com`) and static assets (`*.mlstatic.com`) are loaded dynamically by the `@qazuor/qzpay-react` package. Since the admin app's CSP uses `'strict-dynamic'`, these dynamically loaded scripts are trusted automatically (trust propagation from the nonced parent script). The `https:` fallback in `script-src` covers CSP2 browsers that don't support `'strict-dynamic'`. No explicit domain allowlisting is needed in `script-src`.

> **Note on `'unsafe-eval'`:** The `'unsafe-eval'` directive is included as a precaution for the optional MercadoPago antifraud script (`security.js`), NOT for the core SDK. The core SDK (`sdk.mercadopago.com/js/v2`) does not use `eval()` or `new Function()`. If `@qazuor/qzpay-core` does not load `security.js` (verify in pre-implementation checklist), `'unsafe-eval'` can be safely removed from the admin CSP.

**Resolved from SDK source analysis (2026-03-16):**
- **WebSockets**: NOT required. No WebSocket connections found in SDK source. The `ws:` in Discussion #16 was from the user's own stack.
- **`api.mercadolibre.com`**: CONFIRMED as client-side domain for tracking/analytics.
- **`api-static.mercadopago.com`**: CONFIRMED as client-side domain for Secure Fields assets.

**Optional**: MercadoPago's antifraud script at `https://www.mercadopago.com/v2/security.js`
generates a `deviceId` for fraud prevention. A maintainer confirmed it is "not required, although it is nice to have it" (Discussion #145). If used, add `https://www.mercadopago.com` to
`script-src` in the admin app.

#### Vercel (both apps)

| Directive | Domain | Purpose |
|-----------|--------|---------|
| `connect-src` | `https://*.vercel.app` | Preview deployment URLs, analytics |

### 6.5 Inline Script Hash Handling (Web App)

When `experimental.csp` is enabled, Astro automatically:

1. Computes SHA-256 hashes for every bundled script and `<script is:inline>` block in the rendered HTML.
2. Computes SHA-256 hashes for every bundled `<style>` block.
3. Injects those hashes into a `<meta http-equiv="Content-Security-Policy" content="script-src 'sha256-xxx' ...">` tag in the `<head>`.
4. When `strictDynamic: true` is set (Astro 5.9), adds `'strict-dynamic'` to `script-src`.

**No manual hash computation is needed.** Hashes are computed at build/render time and automatically update if script content changes. The `scriptDirective.hashes` array is only for scripts NOT processed by Astro (e.g., external CDN scripts).. we do not need it.

**Verification after implementation** (MUST use build + preview, NOT dev mode):

```bash
cd apps/web
pnpm build && pnpm preview
```

1. Open the preview URL in the browser (default: `http://localhost:4321`)
2. View the page source (`Ctrl+U` or `Cmd+U`)
3. Look for `<meta http-equiv="content-security-policy">` in the `<head>`
4. Confirm it contains `script-src 'sha256-...'` entries (one per inline script)
5. Confirm it contains `'strict-dynamic'`
6. Open DevTools Console.. there should be no CSP violation warnings
7. Navigate to several pages to confirm no violations

**IMPORTANT**: The `<meta>` tag is NOT emitted in `dev` mode. CSP verification requires `build` + `preview`.

### 6.6 vercel.json Changes Summary

| File | Change |
|------|--------|
| `/home/qazuor/projects/WEBS/hospeda/apps/web/vercel.json` | Remove `Content-Security-Policy-Report-Only` header from static headers |
| `/home/qazuor/projects/WEBS/hospeda/apps/admin/vercel.json` | Remove `Content-Security-Policy-Report-Only` header from static headers |

Both apps keep all other security headers (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`).

---

## 7. Acceptance Criteria

### 7.1 Web App

- [ ] Astro upgraded to >= 5.9.0
- [ ] `experimental.csp` configured in `astro.config.mjs`
- [ ] Prerendered pages include `<meta http-equiv="content-security-policy">` with SHA-256 hashes; SSR pages receive CSP via HTTP response header. Both are handled automatically by Astro's `experimental.csp`.
- [ ] All HTML responses include `Content-Security-Policy-Report-Only` HTTP header
- [ ] HTTP header includes `script-src 'self' 'strict-dynamic' 'unsafe-inline' https:`
- [ ] HTTP header includes `connect-src` with Sentry and Vercel domains
- [ ] HTTP header includes `worker-src 'self' blob:` for Sentry Replay
- [ ] HTTP header includes `child-src blob:` for Sentry Replay (Safari fallback)
- [ ] HTTP header includes `report-uri` pointing to Sentry (when DSN is configured)
- [ ] No `'unsafe-eval'` in any directive
- [ ] `vercel.json` no longer contains `Content-Security-Policy-Report-Only`
- [ ] `buildSentryReportUri` function added to middleware-helpers.ts with JSDoc
- [ ] FOUC prevention inline script and scroll-reveal inline script work without CSP violations
- [ ] Google Fonts load without CSP violations
- [ ] Server Islands load without CSP violations
- [ ] CSP `<meta>` tag is NOT emitted in dev mode (only in build + preview)
- [ ] Verification done via `pnpm build && pnpm preview`, NOT `pnpm dev`
- [ ] Verify whether Sentry Session Replay functions correctly with CSP enabled (build + preview). Document findings.
- [ ] Native View Transitions (`transition:name` morphing) work without CSP violations (build + preview)
- [ ] Verify `transition:name` morphing animations work without CSP violations (card-to-detail page transitions)
- [ ] `PUBLIC_SENTRY_DSN` added to `apps/web/.env.example` with placeholder value

### 7.2 Admin App

- [ ] TanStack Start upgraded to >= 1.166.0 (all TanStack packages in sync; includes nonce fix PR #5522 and setResponseHeaders fix)
- [ ] `middleware.ts` created with `cspMiddleware` using `createMiddleware().server()`
- [ ] `start.ts` created with `createStart()` registering `cspMiddleware`
- [ ] `router.tsx` updated with `getCspNonce` via `createIsomorphicFn`/`getGlobalStartContext`
- [ ] `createRouter()` passes `ssr.nonce` with the CSP nonce
- [ ] `HeadContent` emits `<meta property="csp-nonce" content="{nonce}">` during SSR
- [ ] All SSR-injected `<script>` tags include `nonce="{nonce}"` attribute
- [ ] Keyframe animation moved from inline `<style>` in router.tsx to styles.css
- [ ] All HTML responses include `Content-Security-Policy-Report-Only` HTTP header
- [ ] HTTP header includes `script-src 'nonce-{RANDOM}' 'strict-dynamic' 'unsafe-eval' 'unsafe-inline' https:`
- [ ] HTTP header includes `worker-src 'self' blob:` for Sentry Replay
- [ ] HTTP header includes `child-src blob:` for Sentry Replay (Safari fallback)
- [ ] No `'unsafe-eval'` in web app directives. Admin app includes `'unsafe-eval'` only for MercadoPago SDK compatibility
- [ ] `vercel.json` no longer contains `Content-Security-Policy-Report-Only`
- [ ] Nonce is different for every request (verify with two consecutive page loads)
- [ ] Nonce uses `randomBytes(16).toString('base64url')` (cryptographically secure)
- [ ] TanStack Router pending animation still works after keyframe move
- [ ] HTTP header includes `connect-src` with Sentry, Vercel, and MercadoPago domains
- [ ] HTTP header includes `frame-src` with MercadoPago domains
- [ ] MercadoPago/QZPay billing features work without CSP violations
- [ ] `VITE_SENTRY_DSN` added to `apps/admin/.env.example` with placeholder value
- [ ] `csp-helpers.ts` created in `apps/admin/src/lib/` with `buildSentryReportUri` and `buildCspDirectives` functions

### 7.3 Both Apps

- [ ] No CSP violation warnings in browser DevTools Console on any page
- [ ] Sentry error reporting still works (test by triggering a deliberate error)
- [ ] Sentry Session Replay still works (if enabled)
- [ ] No regressions in page load performance
- [ ] No regressions in hydration or interactivity
- [ ] If Session Replay is broken by style hashes, document the behavior and add a note for Phase 2 review (Astro Issue #14798)

---

## Phase 1.1: Quick-Win CSP Hardening (absorbed from SPEC-046)

> These fixes were originally planned for SPEC-046 (CSP Post-Deploy Verification) but are low-risk, zero-dependency changes that should be applied immediately to strengthen the CSP posture before any observation period.

### T-021: Add `upgrade-insecure-requests` directive to all apps

| Field | Value |
|-------|-------|
| **Complexity** | 1/10 |
| **Files** | `apps/web/src/middleware.ts`, `apps/admin/src/lib/csp-helpers.ts`, `apps/api/src/middlewares/security.ts` |
| **Gap** | GAP-042-26 |

Add `upgrade-insecure-requests` to CSP directives in all three apps. One line per app.

### T-022: Add `frame-src 'none'` to web CSP

| Field | Value |
|-------|-------|
| **Complexity** | 1/10 |
| **Files** | `apps/web/src/middleware.ts` |
| **Gap** | GAP-042-33 |

Web app has no legitimate iframe needs. Add `frame-src 'none'` to prevent iframe injection.

### T-023: Add explicit `media-src 'self'` to web and admin CSP

| Field | Value |
|-------|-------|
| **Complexity** | 1/10 |
| **Files** | `apps/web/src/middleware.ts`, `apps/admin/src/lib/csp-helpers.ts` |
| **Gap** | GAP-042-35 |

Prevent media loading from external sources. Currently falls back to `default-src 'self'` but should be explicit.

### T-024: Fix API `font-src` to `'none'`

| Field | Value |
|-------|-------|
| **Complexity** | 1/10 |
| **Files** | `apps/api/src/middlewares/security.ts` |
| **Gap** | GAP-042-36 |

API serves JSON, not HTML pages. Font loading is unnecessary. Change from `['self', 'https:', 'data:']` to `['none']`.

### T-025: Fix `X-XSS-Protection` to `'0'` in API middleware

| Field | Value |
|-------|-------|
| **Complexity** | 1/10 |
| **Files** | `apps/api/src/middlewares/security.ts` |
| **Gap** | GAP-042-37 |

Align API middleware with vercel.json and modern best practices. The XSS auditor in old browsers has known bypass vulnerabilities.

### T-026: Unify `Permissions-Policy` across web and admin

| Field | Value |
|-------|-------|
| **Complexity** | 1/10 |
| **Files** | `apps/web/vercel.json`, `apps/admin/vercel.json` |
| **Gap** | GAP-042-32 |

Add `payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()` to match the API's more complete policy.

### T-027: Fix API docs routes to only bypass CSP, not all security headers

| Field | Value |
|-------|-------|
| **Complexity** | 2/10 |
| **Files** | `apps/api/src/middlewares/security.ts` |
| **Gap** | GAP-042-30 |

Currently `/docs*` routes bypass ALL security headers (HSTS, X-Frame-Options, etc.). Change to only bypass CSP while keeping other headers active.

### T-028: Replace `*.vercel.app` wildcard with specific deployment domains

| Field | Value |
|-------|-------|
| **Complexity** | 2/10 |
| **Files** | `apps/web/src/middleware.ts`, `apps/admin/src/lib/csp-helpers.ts` |
| **Gap** | GAP-042-38 |

`*.vercel.app` allows connections to ANY Vercel-hosted app. Replace with specific deployment patterns (e.g., `hospeda-*.vercel.app`) or production domains when defined. If production domains are not yet defined, use `HOSPEDA_API_URL` env var dynamically.

### T-029: Add nonce security property tests (admin)

| Field | Value |
|-------|-------|
| **Complexity** | 2/10 |
| **Files** | `apps/admin/test/lib/csp-helpers.test.ts` |
| **Gap** | GAP-042-41 |

Add tests for: nonce uniqueness (two calls produce different nonces), minimum entropy (>= 22 chars base64url), valid format (`/^[A-Za-z0-9_-]+$/`), cryptographic source verification.

### T-030: Add CI grep check for CSP-incompatible patterns

| Field | Value |
|-------|-------|
| **Complexity** | 2/10 |
| **Files** | `.github/workflows/ci.yml` or new script in `scripts/` |
| **Gap** | GAP-042-46 |

Add a CI step that greps for `onclick=`, `onload=`, `onerror=`, `onsubmit=`, `eval(`, `new Function(`, `document.write(` in `.astro` and `.tsx` files under `apps/web/src/`. Fails CI if found.

---

## Phase 1.2: Remove `'unsafe-inline'` from Web `script-src` (absorbed from SPEC-047)

> These tasks were originally planned for SPEC-047 (CSP Unsafe-Inline Removal). Analysis confirmed the scope is 4 files, ~70 lines, 2-3 hours of work with LOW risk.. well within SPEC-042 scope.

### T-031: Migrate scroll-reveal script from `is:inline` to regular script

| Field | Value |
|-------|-------|
| **Complexity** | 2/10 |
| **Files** | `apps/web/src/layouts/BaseLayout.astro` |
| **Gap** | GAP-042-14 |

Remove `is:inline` from the scroll-reveal observer script (lines 119-178). The script runs post-DOM and has no synchronous constraint. Astro will automatically bundle it as an ES module and generate a SHA-256 hash for the CSP meta tag. Verify scroll-reveal animations still work after migration.

### T-032: Compute SHA-256 hash for FOUC prevention script

| Field | Value |
|-------|-------|
| **Complexity** | 3/10 |
| **Files** | `apps/web/src/layouts/BaseLayout.astro`, `apps/web/src/middleware.ts` |
| **Gap** | GAP-042-14 |

The FOUC prevention script (lines 84-91) MUST remain `is:inline` because it must execute synchronously in `<head>` before CSS renders. Compute its SHA-256 hash manually and add it to the HTTP header CSP `script-src` directive in middleware.ts. Document the hash in a code comment with instructions to recompute if the script changes. Consider adding a build-time verification script.

### T-033: Fix inline `onclick` handler in 500.astro

| Field | Value |
|-------|-------|
| **Complexity** | 1/10 |
| **Files** | `apps/web/src/pages/500.astro` |
| **Gap** | GAP-042-42 |

Replace `onclick="window.location.reload()"` with a proper `<script>` + `addEventListener('click', ...)` pattern. Astro will auto-hash the new script tag. This is ALREADY BROKEN in production when `experimental.csp` is active.

### T-034: Remove `https:` wildcard from web `script-src`

| Field | Value |
|-------|-------|
| **Complexity** | 1/10 |
| **Files** | `apps/web/src/middleware.ts` |
| **Gap** | GAP-042-48 |

Remove the `https:` token from `script-src` in the HTTP header CSP. In CSP3 browsers, `'strict-dynamic'` already ignores it. In CSP1 browsers, `'unsafe-inline'` already covers the fallback. The `https:` wildcard adds no value but allows scripts from any HTTPS domain.

### T-035: Update `script-src` to use hash + remove `'unsafe-inline'`

| Field | Value |
|-------|-------|
| **Complexity** | 2/10 |
| **Files** | `apps/web/src/middleware.ts` |
| **Gaps** | GAP-042-05, GAP-042-48 |
| **Depends on** | T-032 (FOUC hash computed) |

Final step: update the HTTP header `script-src` from:
```
script-src 'self' 'strict-dynamic' 'unsafe-inline' https:
```
to:
```
script-src 'self' 'strict-dynamic' 'sha256-<FOUC-HASH>'
```

Note: `'unsafe-inline'` is intentionally kept as a CSP1 browser fallback per Google's CSP Strict recommendation. CSP2+ browsers ignore it when hashes are present. The change here is replacing the explicit `https:` wildcard with the specific hash.

**UPDATE (post-analysis)**: Actually, per Google's recommended CSP Strict pattern, the final directive should be:
```
script-src 'self' 'strict-dynamic' 'sha256-<FOUC-HASH>' 'unsafe-inline' https:
```
Where `'unsafe-inline'` and `https:` are CSP1 fallbacks ignored by CSP2+. The real security improvement is the **hash** replacing the reliance on `'unsafe-inline'` for the FOUC script. Decide whether to keep or remove the fallbacks based on browser support requirements.

---

## Phase 1.3: Structural Improvements

### T-036: Add coherence validation test for dual-policy CSP (meta vs header)

| Field | Value |
|-------|-------|
| **Complexity** | 3/10 |
| **Files** | `apps/web/test/` (new test file) |
| **Gap** | GAP-042-49 |

Add an integration test that builds the web app and compares the CSP directives in the Astro-generated `<meta>` tag against the HTTP header CSP from middleware.ts. The test should flag any directive present in one source but missing or conflicting in the other. This prevents silent divergence between the two CSP policies.

### T-037: Fix API route factory CSP override

| Field | Value |
|-------|-------|
| **Complexity** | 3/10 |
| **Files** | `apps/api/src/utils/route-factory.ts` |
| **Gap** | GAP-042-39 |

The route factory hardcodes a permissive CSP (`'unsafe-inline'` + CDN domains) that overrides the strict policy from `security.ts` on ALL routes. Move the permissive CSP to ONLY apply to `/docs/*` routes. All other routes should use the strict CSP from `security.ts`.

### T-038: Verify Sentry CSP violation pipeline end-to-end

| Field | Value |
|-------|-------|
| **Complexity** | 2/10 |
| **Files** | Documentation/findings only |
| **Gap** | GAP-042-43 |

Manually verify that CSP violations reach Sentry by: (1) opening the web app in a browser, (2) injecting a test CSP violation via DevTools, (3) checking that it appears in the Sentry dashboard under Security/CSP issues. Document the verification result in findings.md.

---

## 8. Out of Scope

1. **CSP enforcement mode** (Phase 2) .. this spec covers Phase 1 (Report-Only) only. Phase 2 is a separate follow-up after monitoring violations.
2. **API app changes** .. the API already has a strict CSP. No changes needed.
3. **`report-to` directive** .. the newer Reporting API (`report-to` + `Report-To` header + `Reporting-Endpoints` header) is more complex and not yet universally supported. `report-uri` is sufficient for Phase 1. Note: `report-uri` is deprecated in favor of `report-to` in the CSP Level 3 spec. Phase 2 should consider migrating to `report-to` + `Reporting-Endpoints` header for forward compatibility.
4. **Nonce propagation to third-party scripts** .. `'strict-dynamic'` handles trust propagation automatically. No need to manually nonce third-party script tags.
5. **`style-src` nonce/hash for inline style attributes** .. `'unsafe-inline'` is required in `style-src` for Sentry Replay (rrweb). This is an acceptable trade-off since style injection is a much lower XSS risk than script injection.
6. **CSP for non-HTML responses** .. CSP only applies to HTML documents. API responses, static assets, etc. do not need CSP headers.
7. **Astro 6.0 Migration (future):** When upgrading to Astro 6.0 (released 2026-03-10), the CSP config path changes from `experimental.csp` to `security.csp`. The property name `strictDynamic` remains unchanged. A CSP runtime API becomes available for dynamic hash/resource management. Plan this migration when Astro 6.0 is adopted by the project.
8. **Astro style hash suppression** .. Astro Issue #14798 tracks the ability to suppress auto-computed style hashes in CSP. When resolved, the `experimental.csp` (or `security.csp`) configuration should be updated to avoid emitting style hashes, allowing `'unsafe-inline'` in `style-src` to work for Sentry Session Replay.
9. **Astro `staticHeaders`** .. Since `@astrojs/vercel@10.0.0` (adapter-level) and Astro 6.0.0 (core `adapterFeatures.staticHeaders`), support for delivering CSP via HTTP header (instead of `<meta>` tag) for prerendered pages is available. This could enable true Report-Only mode for ALL pages in Phase 1 (mitigating the `<meta>` tag enforcement caveat). Evaluate for Phase 2 or a follow-up spec.

---

## 9. Pre-Implementation Checklist

Before writing any code, verify these conditions:

- [ ] **Astro version**: Run `pnpm list astro` in `apps/web`. Must be >= 5.9.0 (project already resolves to 5.18.0 via caret semver).
- [ ] **Astro CSP docs**: Check https://docs.astro.build/en/reference/experimental-flags/csp/ for `experimental.csp` docs. Confirm `algorithm`, `scriptDirective.hashes`, `scriptDirective.strictDynamic`, `styleDirective.hashes` are valid options.
- [ ] **TanStack Start version**: Run `pnpm list @tanstack/react-start` in `apps/admin`. Must be >= 1.133.12 (recommended >= 1.166.0 for `setResponseHeaders` fix).
- [ ] **TanStack Start nonce**: Confirm `ssr.nonce` is a valid option in `createTanstackRouter()`. Check TypeScript types after upgrade.
- [ ] **TanStack Start middleware**: Confirm `createMiddleware().server()` API exists. Confirm `createStart()` with `requestMiddleware` option exists. Confirm `getGlobalStartContext()` and `createIsomorphicFn()` are exported from `@tanstack/react-start`.
- [ ] **TanStack Start setResponseHeaders**: After upgrade, verify that `getResponseHeaders().set(key, value)` followed by `setResponseHeaders(headers)` works in global middleware. Do NOT use the spread pattern `{ ...headers, [key]: value }` (see Section 6.2.2 and Issue #5407).
- [ ] **No Sentry inline scripts**: Inspect the rendered HTML of both apps in a browser. Search for any `<script>` tags that contain Sentry code inline (not via `src`). There should be none.
- [ ] **MercadoPago domains**: Load a checkout page with DevTools Network tab open. Record all domains (including WebSocket connections). Compare with Section 6.4.
- [ ] **Astro CSP property name**: Verify that `scriptDirective.strictDynamic` is recognized by TypeScript after enabling `experimental.csp`. No error should appear on the property name.
- [ ] **MercadoPago SDK loading**: Verify that `@qazuor/qzpay-react` loads the MercadoPago SDK programmatically (via `loadMercadoPago()`) rather than a static `<script>` tag, to confirm `'strict-dynamic'` trust propagation works.
- [ ] **Env vars**: Verify `PUBLIC_SENTRY_DSN` is defined in `apps/web/.env.example`. Verify `VITE_SENTRY_DSN` is defined in `apps/admin/.env.example`. If not, add them with a placeholder value and document in the env registry (`packages/config`).
- [ ] **TanStack upgrade review**: Review TanStack Router CHANGELOG between v1.131.26 and the target version for breaking changes. Run `pnpm typecheck` and `pnpm test` after upgrade, before proceeding with CSP implementation.
- [ ] **Client-Side Router absence**: Grep for `<ClientRouter` or `ViewTransitions` in `apps/web/src/` to confirm no client-side router usage. If found, it must be removed before enabling CSP (Astro CSP does not support `<ClientRouter />`).
- [ ] **Astro style hashes**: After enabling `experimental.csp`, inspect the rendered `<meta>` tag via `pnpm build && pnpm preview`. If Astro includes `sha256-` entries in `style-src` of the `<meta>` tag, the `'unsafe-inline'` in the HTTP header's `style-src` will be ignored by CSP2+ browsers. If this breaks Sentry Session Replay, consider NOT configuring `styleDirective` (already the recommendation) and verify Astro does not auto-emit style hashes without explicit `styleDirective` config.
- [ ] **start.ts auto-discovery**: After creating `apps/admin/src/start.ts`, verify TanStack Start discovers it automatically (add a temporary `console.log` in the middleware and check server output). If not discovered, check `@tanstack/router-plugin` configuration in `vite.config.ts` for `startDir` or similar options.
- [ ] **View Transition directives**: Grep for `transition:name` in `apps/web/src/`. These 9 files use the native browser View Transition API (NOT `<ClientRouter />`). Confirm that Astro CSP auto-hashes the generated `<style>` tags after build. No removal needed.
- [ ] **MercadoPago antifraud script (`security.js`)**: Check whether `@qazuor/qzpay-core`'s `loadMercadoPago()` or `@qazuor/qzpay-react`'s `QZPayProvider` automatically loads `https://www.mercadopago.com/v2/security.js`. Verify via: (1) `grep -r "security.js" node_modules/@qazuor/qzpay-core/ node_modules/@qazuor/qzpay-react/`, and (2) load a billing page with DevTools Network tab open and search for `security.js` requests. If NOT loaded, `'unsafe-eval'` can be safely removed from the admin CSP.
- [ ] **TanStack setResponseHeaders workaround**: After upgrading TanStack, verify the workaround for Issue #5407 (still OPEN) works with the installed version. Add a temporary `console.log` in the middleware to confirm the CSP header appears in responses.
- [ ] **Existing tests pass**: Run `pnpm test` from monorepo root. All tests must pass before starting.
- [ ] **View Transitions (native)**: Confirm `transition:name` directives in 9 files (cards + detail pages) generate only `<style>` tags (no inline scripts) after CSP is enabled. Verify morphing animations work in `pnpm build && pnpm preview`.
- [ ] **Sentry injected scripts (web)**: After enabling `experimental.csp`, run `pnpm build && pnpm preview` in `apps/web`. Inspect the rendered HTML and the `<meta http-equiv="content-security-policy">` tag. Verify that ALL `<script>` tags in the output (including those injected by `@sentry/astro` via Astro's `injectScript()` API) have matching SHA-256 hashes in the meta tag's `script-src`. If any Sentry script is missing a hash, it will be blocked by the enforcing `<meta>` tag. Check the browser console for CSP violations related to Sentry.
- [ ] **Astro `staticHeaders`**: Evaluate whether `@astrojs/vercel@10.0.0`'s `staticHeaders` adapter-level config (or Astro 6.0.0 core `adapterFeatures.staticHeaders`) can be used to deliver CSP via HTTP header for prerendered pages, avoiding the Phase 1 meta-tag enforcement caveat. This is optional but recommended.

---

## 10. Testing Strategy

### 10.1 Unit Tests

**File**: `/home/qazuor/projects/WEBS/hospeda/apps/web/test/lib/middleware-helpers.test.ts` (extend existing)

Add tests for `buildSentryReportUri`:

```typescript
describe('buildSentryReportUri', () => {
    it('should parse a valid DSN and return the security endpoint', () => {
        const result = buildSentryReportUri({
            dsn: 'https://abc123@o456789.ingest.sentry.io/789'
        });
        expect(result).toBe(
            'https://o456789.ingest.sentry.io/api/789/security/?sentry_key=abc123'
        );
    });

    it('should return null for an invalid DSN', () => {
        const result = buildSentryReportUri({ dsn: 'not-a-url' });
        expect(result).toBeNull();
    });

    it('should return null for a DSN missing the project ID', () => {
        const result = buildSentryReportUri({ dsn: 'https://key@host/' });
        expect(result).toBeNull();
    });

    it('should return null for a DSN missing the key', () => {
        const result = buildSentryReportUri({ dsn: 'https://host/123' });
        expect(result).toBeNull();
    });
});
```

**File**: `/home/qazuor/projects/WEBS/hospeda/apps/admin/test/middleware.test.ts` (NEW)

Add tests for the admin CSP middleware:

```typescript
import { describe, expect, it } from 'vitest';

// CSP helper functions are extracted to a separate file for testability.
// See apps/admin/src/lib/csp-helpers.ts
import { buildCspDirectives, buildSentryReportUri } from '../src/lib/csp-helpers';

describe('buildSentryReportUri', () => {
    it('should parse a valid DSN and return the security endpoint', () => {
        const result = buildSentryReportUri({
            dsn: 'https://abc123@o456789.ingest.sentry.io/789'
        });
        expect(result).toBe(
            'https://o456789.ingest.sentry.io/api/789/security/?sentry_key=abc123'
        );
    });

    it('should return null for an invalid DSN', () => {
        expect(buildSentryReportUri({ dsn: 'not-a-url' })).toBeNull();
    });

    it('should return null for a DSN missing the project ID', () => {
        expect(buildSentryReportUri({ dsn: 'https://key@host/' })).toBeNull();
    });
});

describe('buildCspDirectives', () => {
    it('should include the nonce in script-src', () => {
        const result = buildCspDirectives({ nonce: 'test-nonce-123', sentryDsn: '' });
        expect(result).toContain("'nonce-test-nonce-123'");
    });

    it('should include strict-dynamic in script-src', () => {
        const result = buildCspDirectives({ nonce: 'test', sentryDsn: '' });
        expect(result).toContain("'strict-dynamic'");
    });

    it('should include unsafe-eval for MercadoPago SDK', () => {
        const result = buildCspDirectives({ nonce: 'test', sentryDsn: '' });
        expect(result).toContain("'unsafe-eval'");
    });

    it('should include MercadoPago domains in connect-src', () => {
        const result = buildCspDirectives({ nonce: 'test', sentryDsn: '' });
        expect(result).toContain('https://*.mercadopago.com');
    });

    it('should include worker-src and child-src for Sentry Replay', () => {
        const result = buildCspDirectives({ nonce: 'test', sentryDsn: '' });
        expect(result).toContain("worker-src 'self' blob:");
        expect(result).toContain("child-src blob:");
    });

    it('should include report-uri when DSN is provided', () => {
        const result = buildCspDirectives({
            nonce: 'test',
            sentryDsn: 'https://abc123@o456789.ingest.sentry.io/789'
        });
        expect(result).toContain('report-uri');
    });

    it('should not include report-uri when no DSN is provided', () => {
        const result = buildCspDirectives({ nonce: 'test', sentryDsn: '' });
        expect(result).not.toContain('report-uri');
    });
});
```

### 10.2 Integration Tests

After deploying to staging:

1. **Hash verification (web)**:
   - Load any page
   - View source, find `<meta http-equiv="Content-Security-Policy">`
   - Confirm SHA-256 hashes are present
   - Confirm no CSP violations in Console

2. **Nonce verification (admin)**:
   - Load any page
   - View source, find `nonce="..."` attributes on `<script>` tags
   - Find `<meta property="csp-nonce" content="...">`
   - Load the page again, confirm the nonce value is different
   - Confirm no CSP violations in Console

3. **Report-URI verification**:
   - Temporarily inject a violating inline script
   - Check Sentry for incoming CSP violation reports

### 10.3 Manual Browser Tests

For each app, manually verify these flows have no CSP violations:

**Web app** (MUST use `pnpm build && pnpm preview`, NOT `pnpm dev`):
- [ ] Homepage load (dark mode FOUC prevention, scroll reveal)
- [ ] Page navigation (standard links, NOT view transitions)
- [ ] Search page (React islands hydration)
- [ ] Authentication flow (sign in, sign up)
- [ ] Protected page (/mi-cuenta/)
- [ ] Server Island rendering (deferred components)
- [ ] Card-to-detail morphing transitions (verify `transition:name` animations work)
- [ ] Google Fonts rendering (verify fonts.googleapis.com CSS loads)
- [ ] Card-to-detail page transition (`transition:name` morphing animation, e.g., accommodation card → detail page)

**Admin app**:
- [ ] Login page
- [ ] Dashboard load
- [ ] Table page with sorting/filtering
- [ ] Form submission (create/edit entity)
- [ ] Route transition (pending bar animation)
- [ ] Dialog/modal opening
- [ ] Error boundary trigger (verify Sentry reports)
- [ ] Billing/MercadoPago features (if browser SDK is loaded)

### 10.4 Regression Tests

- [ ] Run full test suite: `pnpm test` from monorepo root
- [ ] Run web tests: `pnpm test` from `apps/web`
- [ ] Run admin tests: `pnpm test` from `apps/admin`
- [ ] Run typecheck: `pnpm typecheck` from monorepo root
- [ ] Run lint: `pnpm lint` from monorepo root

---

## 11. Rollback Plan

If CSP violations cause issues in production:

### Immediate (< 5 minutes)

Since Phase 1 uses `Content-Security-Policy-Report-Only`, violations are only reported, not enforced. No user-facing breakage is possible in Phase 1. If reporting itself causes issues (e.g., excessive Sentry volume):

1. Remove `report-uri` directive from the CSP header in both middlewares.
2. Deploy.

### Full Rollback

If the middleware itself causes issues (e.g., performance, errors):

1. **Web app**: Revert `astro.config.mjs` (remove `experimental.csp`), revert `middleware.ts` (remove Step 7), re-add the static CSP header to `vercel.json`.
2. **Admin app**: Remove `start.ts`, remove `middleware.ts`, revert `router.tsx` (remove `ssr.nonce` and `getCspNonce`), re-add the static CSP header to `vercel.json`.
3. Deploy.

The keyframe move (admin) and `buildSentryReportUri` helper (web) are safe to keep even during rollback.. they have no dependency on CSP.

### TanStack Upgrade Rollback Consideration

The TanStack Start upgrade (1.131.26 → >=1.166.0) spans ~35 minor versions. Rolling back TanStack is a separate, higher-risk operation:

1. Revert `apps/admin/package.json` TanStack version pins to their original values.
2. Run `pnpm install` from the monorepo root.
3. Run `pnpm typecheck && pnpm test` in `apps/admin` to verify no regressions.
4. Deploy.

**Important:** The TanStack upgrade is a prerequisite for CSP, not part of CSP itself. If CSP needs to be rolled back, the TanStack upgrade can be kept (it provides bug fixes and improvements independent of CSP). Only roll back TanStack if the upgrade itself causes issues unrelated to CSP.

**Recommendation:** Separate the TanStack upgrade into its own commit/PR. Deploy and validate it independently before implementing CSP. This way, each change can be rolled back independently.

---

## 12. File Modification Summary

| File | Action | Description |
|------|--------|-------------|
| `/home/qazuor/projects/WEBS/hospeda/apps/web/package.json` | MODIFY | Upgrade `astro` to `^5.9.0` |
| `/home/qazuor/projects/WEBS/hospeda/apps/web/astro.config.mjs` | MODIFY | Add `experimental.csp` block |
| `/home/qazuor/projects/WEBS/hospeda/apps/web/src/middleware.ts` | MODIFY | Add Step 7: CSP header on HTML responses |
| `/home/qazuor/projects/WEBS/hospeda/apps/web/src/lib/middleware-helpers.ts` | MODIFY | Add `buildSentryReportUri` function |
| `/home/qazuor/projects/WEBS/hospeda/apps/web/vercel.json` | MODIFY | Remove `Content-Security-Policy-Report-Only` header |
| `/home/qazuor/projects/WEBS/hospeda/apps/web/test/lib/middleware-helpers.test.ts` | MODIFY | Add `buildSentryReportUri` tests |
| `/home/qazuor/projects/WEBS/hospeda/apps/admin/package.json` | MODIFY | Upgrade TanStack packages to `>=1.166.0` (latest available) |
| `/home/qazuor/projects/WEBS/hospeda/apps/admin/src/middleware.ts` | CREATE | CSP middleware with nonce generation |
| `/home/qazuor/projects/WEBS/hospeda/apps/admin/src/lib/csp-helpers.ts` | CREATE | CSP helper functions (buildSentryReportUri, buildCspDirectives) extracted for testability |
| `/home/qazuor/projects/WEBS/hospeda/apps/admin/src/start.ts` | CREATE | TanStack Start config with middleware registration |
| `/home/qazuor/projects/WEBS/hospeda/apps/admin/src/router.tsx` | MODIFY | Add `getCspNonce`, `ssr.nonce`, remove inline `<style>` |
| `/home/qazuor/projects/WEBS/hospeda/apps/admin/src/styles.css` | MODIFY | Add `@keyframes router-pending-bar` |
| `/home/qazuor/projects/WEBS/hospeda/apps/admin/vercel.json` | MODIFY | Remove `Content-Security-Policy-Report-Only` header |
| `/home/qazuor/projects/WEBS/hospeda/apps/admin/test/middleware.test.ts` | CREATE | CSP middleware unit tests |
| `/home/qazuor/projects/WEBS/hospeda/apps/web/.env.example` | MODIFY | Add `PUBLIC_SENTRY_DSN` placeholder (required for CSP report-uri) |
| `/home/qazuor/projects/WEBS/hospeda/apps/admin/.env.example` | MODIFY | Add `VITE_SENTRY_DSN` placeholder (required for CSP report-uri) |

> **Note on `vercel.json` entries:** Only applicable if per-app `vercel.json` exists; otherwise remove static CSP headers from Vercel project dashboard settings.

**Files NOT created** (removed from original spec):
- ~~`scripts/verify-csp-hashes.ts`~~ .. no Sentry hash to verify
- ~~`apps/web/src/lib/csp-hashes.ts`~~ .. Astro auto-computes hashes
- ~~`apps/admin/src/lib/csp-hashes.ts`~~ .. nonce-based, no hashes

---

## 13. References

- [Astro Content Security Policy](https://docs.astro.build/en/guides/security/#content-security-policy-csp) .. Astro CSP documentation
- [Astro experimental.csp reference](https://docs.astro.build/en/reference/experimental-flags/csp/) .. Configuration options
- [TanStack Start Middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware) .. createMiddleware API
- [TanStack Start Config](https://tanstack.com/start/latest/docs/framework/react/start-config) .. createStart API
- [TanStack Router PR #5522](https://github.com/TanStack/router/pull/5522) .. Nonce propagation fix
- [TanStack Router Issue #5407](https://github.com/TanStack/router/issues/5407) .. setResponseHeaders bug in global middleware
- [TanStack Router PR #6276](https://github.com/TanStack/router/pull/6276) .. setResponseHeaders fix
- [CSP Level 3 spec: strict-dynamic](https://www.w3.org/TR/CSP3/#strict-dynamic-usage) .. How strict-dynamic interacts with other source expressions
- [Sentry Security Policy Reporting](https://docs.sentry.io/platforms/javascript/security-policy-reporting/) .. report-uri endpoint format
- [rrweb Issue #816](https://github.com/rrweb-io/rrweb/issues/816) .. CSP style-src violations from rrweb inline styles
- [MercadoPago SDK v2](https://www.mercadopago.com.ar/developers/en/docs/sdks-library/client-side/mp-js-v2) .. Official SDK documentation
- [MercadoPago CSP Discussion #16](https://github.com/mercadopago/sdk-js/discussions/16) .. unsafe-eval requirement reports
- [MercadoPago security.js Discussion #145](https://github.com/mercadopago/sdk-js/discussions/145) .. Antifraud script (optional)
- [MDN Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy) .. Directive reference

<!-- Added: Cross-reference execution order, 2026-03-17 -->
## CSP Phase 2 Execution Chain

SPEC-042 is the first spec in a chain of 4 that culminates in CSP enforcement (Phase 2). All specs must be executed in this order:

### Execution Order

| Phase | Spec | Scope | Depends On | Status |
|-------|------|-------|------------|--------|
| **A** | **SPEC-042** (this spec) | CSP Phase 1 Report-Only for web + admin | None | Completed |
| **B1** | **SPEC-047** | Remove `'unsafe-inline'` from web `script-src` | SPEC-042 | Draft |
| **B2** | **SPEC-045** | Vite 7 migration + admin nonce wiring | SPEC-042 | Draft |
| **C** | **SPEC-046 §1B** | Apply 8 quick-win CSP directive fixes | SPEC-045 | Draft |
| **D** | **SPEC-046** | 14-day observation period on staging | SPEC-045 + SPEC-047 + quick wins | Draft |
| **E** | Phase 2 switch | Change Report-Only to enforcement | SPEC-046 passing | — |

> **B1 and B2 are parallel.** SPEC-047 (web only) and SPEC-045 (admin only) have no dependencies on each other and can execute simultaneously.

### Dependency Diagram

```
SPEC-042 (Phase 1, DONE)
    ├──> SPEC-047 (web: remove unsafe-inline) ────────┐
    │         Does NOT depend on SPEC-045              │
    │                                                  ├──> SPEC-046 §1B (quick wins)
    └──> SPEC-045 (admin: Vite 7 + nonce wiring) ─────┘        │
              Includes: getCspNonce, ssr.nonce,                 v
              createStart({ requestMiddleware })          SPEC-046 (14-day observation)
                                                                │
                                                                v
                                                         Phase 2 (enforcement)
```

### Key Decisions Required Before Phase 2

1. **GAP-042-03**: Disable `experimental.csp` or intercept header (decision for SPEC-046)
2. **GAP-042-04**: Verify if MercadoPago `security.js` loads (determines `'unsafe-eval'` necessity)
3. **GAP-042-27**: Define production CDN domains for `img-src` restriction

### References

- Gap analysis: `.claude/specs/specs-gaps-042.md` (38 gaps, 3 audits)
- SPEC-045: `.claude/specs/SPEC-045-vite7-migration/spec.md`
- SPEC-046: `.claude/specs/SPEC-046-csp-post-deploy-verification/spec.md`
- SPEC-047: `.claude/specs/SPEC-047-csp-unsafe-inline-removal/spec.md`
