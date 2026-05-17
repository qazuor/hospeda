# SPEC-046: CSP Post-Deployment Verification

> **Status**: in-progress
> **Created**: 2026-03-16
> **Updated**: 2026-05-16
> **Priority**: HIGH
> **Origin**: SPEC-042 (post-deploy verification items that cannot be tested locally)
> **Depends on**: SPEC-042 deployed to staging, SPEC-045 (Vite 7 migration) for admin nonce injection
> **Gap Analysis**: [`.claude/specs/specs-gaps-042.md`](../specs-gaps-042.md) (38 gaps, 3 audits)
> **Extended**: 2026-05-16 — added GAP-046-09a / 09b / 10 / 11 / 12 / 13 derived from real staging violations observed on `staging.hospeda.com.ar/es/alojamientos/` with CSP in Report-Only mode. See §1C.

---

<!-- Added: Cross-reference execution order, 2026-03-17 -->
## CSP Phase 2 Execution Chain

SPEC-046 is Phase D in the CSP enforcement chain. It is the FINAL GATE before Phase 2 enforcement. It CANNOT start until Phases B1, B2, and C are complete.

### Execution Order

| Phase | Spec | Scope | Depends On | Status |
|-------|------|-------|------------|--------|
| **A** | **SPEC-042** | CSP Phase 1 Report-Only for web + admin | None | Completed |
| **B1** | **SPEC-047** | Remove `'unsafe-inline'` from web `script-src` | SPEC-042 | Draft |
| **B2** | **SPEC-045** | Vite 7 migration + admin nonce wiring | SPEC-042 | Draft |
| **C** | **SPEC-046 §1B** (this spec) | Apply 8 quick-win CSP directive fixes | SPEC-045 | Draft |
| **D** | **SPEC-046** (this spec) | 14-day observation period on staging | SPEC-045 + SPEC-047 + quick wins | Draft |
| **E** | Phase 2 switch | Change Report-Only to enforcement | SPEC-046 passing | — |

### Prerequisites (must ALL be complete before starting observation)

| Prerequisite | Source | Status |
|---|---|---|
| SPEC-042 Phase 1 implemented | SPEC-042 | Done |
| SPEC-047: `'unsafe-inline'` removed from web script-src | SPEC-047 | Pending |
| SPEC-045: Vite 7 + TanStack >= 1.133.12 + nonce wiring | SPEC-045 | Pending |
| SPEC-045: Admin SSR page loads have CSP headers | SPEC-045 (GAP-042-13) | Pending |
| Quick wins: 8 one-line CSP fixes applied | This spec §1B | Pending |
| GAP-042-03 decision: Astro `experimental.csp` disable or intercept | Decision required | Pending |
| Staging environment functional | SPEC-025 | Completed |

> **Do NOT start the 14-day observation period** until ALL prerequisites above show "Done". Starting early invalidates the observation and the 14-day counter must restart.

### References

- Origin spec: `.claude/specs/SPEC-042-csp-nonce-integration/spec.md`
- Gap analysis: `.claude/specs/specs-gaps-042.md` (38 gaps, 3 audits)
- Prerequisite: `.claude/specs/SPEC-045-vite7-migration/spec.md`
- Prerequisite: `.claude/specs/SPEC-047-csp-unsafe-inline-removal/spec.md`

---

## 1. Problem Statement

SPEC-042 implemented CSP Phase 1 (Report-Only) for both web and admin apps. Several verification items require a deployed environment (staging or production) because they depend on third-party services (Sentry, MercadoPago), real browser behavior with CSP headers, and network-level interactions that local dev cannot replicate.

Key risks that MUST be verified before Phase 2 (enforcement):

- **Sentry Session Replay may break** due to Astro emitting style hashes that cause browsers to ignore `'unsafe-inline'` in `style-src` (Issue #14798)
- **MercadoPago SDK domains** were partially derived from source analysis and need real network traffic confirmation
- **CSP violation reporting** must be confirmed end-to-end (browser -> Sentry)
- **No functional regressions** across both apps

---

<!-- Added: Audit #3, 2026-03-17 -->
## 1A. Pre-Phase-2 Prerequisites Checklist

These blocking issues from the GAP-042 audit MUST be resolved before the 14-day observation period can begin. Without these fixes, the observation period data would be unreliable.

| # | Gap ID | Issue | Blocker For | Resolution Path |
|---|--------|-------|-------------|-----------------|
| 1 | GAP-042-03 | Dual CSP policy conflict: Astro meta tag ENFORCES while HTTP header only REPORTS. Phase 1 "Report-Only" is partially false. | Observation period validity | Disable `experimental.csp` in Astro config OR intercept Astro's header and downgrade to Report-Only. Decision required before deploy. |
| 2 | GAP-042-01 | Admin nonce generated but NOT injected into `<script>` tags. Phase 2 enforcement would block ALL admin scripts. | Admin app functionality in Phase 2 | Requires SPEC-045 completion (Vite 7 + TanStack Start >= 1.133.12 with `ssr.nonce` support). |
| 3 | GAP-042-13 | Admin SSR initial page load has NO CSP headers (middleware only runs on server functions, not SSR). | Admin CSP coverage | Requires SPEC-045: migrate to `createStart({ requestMiddleware })` API. |
| 4 | GAP-042-18 | `getCspNonce()` in `router.tsx` is a stub returning empty string. | Admin nonce propagation | Requires SPEC-045: implement via TanStack Start's SSR context API. |
| 5 | GAP-042-19 | TanStack Start must be >= 1.133.12 for `ssr.nonce` support. | Admin nonce injection | Requires SPEC-045: Vite 7 migration unlocks this upgrade. |
| 6 | GAP-042-26 | `upgrade-insecure-requests` directive missing from all 3 apps. | Mixed content prevention | Quick win (see Section 1B). Apply before observation. |
| 7 | GAP-042-38 | `*.vercel.app` wildcard in `connect-src` allows ANY Vercel app to be contacted. | CSP allowlist integrity | Replace with specific deployment URLs (e.g., `hospeda-api.vercel.app`). |

**Decision required**: Items 2-5 depend on SPEC-045. The observation period for admin CSP CANNOT start until SPEC-045 is complete. Web app observation CAN start independently if item 1 (GAP-042-03) is resolved.

---

<!-- Added: Audit #3, 2026-03-17 -->
## 1B. Quick Wins to Apply Before Observation Period

These 8 trivial fixes (1-line each) should be applied BEFORE starting the observation period to reduce noise and improve baseline security posture.

| # | Fix | App(s) | Gap ID | File(s) |
|---|-----|--------|--------|---------|
| 1 | Add `upgrade-insecure-requests` directive | Web, Admin, API | GAP-042-26 | `apps/web/src/middleware.ts`, `apps/admin/src/lib/csp-helpers.ts`, `apps/api/src/middlewares/security.ts` |
| 2 | Add `frame-src 'none'` directive | Web | GAP-042-27 | `apps/web/src/middleware.ts` |
| 3 | Add `media-src 'self'` directive | Web, Admin | GAP-042-27 | `apps/web/src/middleware.ts`, `apps/admin/src/lib/csp-helpers.ts` |
| 4 | Change API `font-src` to `'none'` (API serves JSON, not fonts) | API | GAP-042-27 | `apps/api/src/middlewares/security.ts` |
| 5 | Fix `X-XSS-Protection` to `'0'` in API `secureHeaders()` config | API | GAP-042-34 | `apps/api/src/middlewares/security.ts` |
| 6 | Unify `Permissions-Policy` header across web and admin `vercel.json` | Web, Admin | GAP-042-35 | `apps/web/vercel.json`, `apps/admin/vercel.json` |
| 7 | Fix API docs routes to only bypass CSP, not ALL security headers | API | GAP-042-36 | `apps/api/src/routes/docs.ts` |
| 8 | Replace `*.vercel.app` with specific deployment URLs in `connect-src` | Admin | GAP-042-38 | `apps/admin/src/lib/csp-helpers.ts` |

These should be bundled into a single PR and deployed before any observation period begins.

---

<!-- Added: Real staging violations audit, 2026-05-16 -->
## 1C. Real Violations Observed on Staging (2026-05-16)

> **Audit date**: 2026-05-16
> **Audit method**: Firefox DevTools Console with "Persist Logs" enabled, navigating `staging.hospeda.com.ar/es/alojamientos/` (listing page with grid of cards, header, filters).
> **CSP mode at audit time**: Report-Only.
> **Effective directives observed**:
> - `script-src 'self' 'nonce-<request-nonce>' 'strict-dynamic'`
> - `style-src 'self' https://fonts.googleapis.com 'nonce-<request-nonce>'`

This section catalogs **concrete violations observed on deployed staging**, distinct from the theoretical gaps in §1A/§1B. Each gap must be resolved (or its decision implemented) before Phase 2 enforcement. Decisions captured below were approved by the project owner on 2026-05-16.

### 1C.1 Summary Table

| Gap ID | Directive | Source / Symptom | Recommended Action | Decision |
|---|---|---|---|---|
| GAP-046-09a | `style-src-attr` | Inline `style=""` attrs on React islands (transition-delay, CSS vars, animation start state) | Refactor to CSS classes + `data-*` attrs | **A** — approved |
| GAP-046-09b | `style-src-elem` | Inline `<style>` blocks (~24 per page) emitted by Astro without the request nonce (middleware sets nonce in header only) | Inject nonce into Astro-emitted `<style>` tags via middleware/integration (see [`research/astro-csp-options.md`](research/astro-csp-options.md) Path A) | **A** — approved |
| GAP-046-10 | `script-src` (`'unsafe-eval'`) | `schemas.<hash>.js` chunk runs a `Function('')` feature-detection probe (intent: pick JIT validator if `unsafe-eval` allowed, else CSP-safe fallback). T-014 staging crawl 2026-05-17 confirmed: one report per pageload, library `try/catch` swallows the exception, functionality unaffected. See §1C.4 for full detail. | Accept as known benign report; optionally filter from Sentry ingestion. | **Accepted (benign)** — no policy change |
| GAP-046-11 | (external) | `static.cloudflareinsights.com/beacon.min.js` blocked by CORS + sha512 integrity mismatch | Disable Cloudflare Web Analytics in CF dashboard (Umami SPEC-140 replaces it) | **A** — approved |
| GAP-046-12 | `frame-src` (missing) | Web `middleware.ts` does not declare `frame-src`. No iframes today. | Add `frame-src 'none'` | **B** — approved |
| GAP-046-13 | `script-src-elem` | Inline `<script>` blocks in HTML tail (lines 835-840) without nonce — Astro hydration scripts | Inject nonce into Astro-emitted inline `<script>` tags via the same middleware/integration as 09b | **A** — approved |

### 1C.2 GAP-046-09a — Inline `style=""` attributes on React islands

**Observed (`style-src-attr` violations)**:

- `transition-delay: Nms` (stagger animations on grid cards, N ∈ {0, 100, 200, 300, 400, 500, 600})
- `--corner-bg: var(--hospeda-forest); --co…` (CSS custom properties for per-card theming)
- `background-color: var(--brand-accent); c…` (themed accent backgrounds)
- `--wave-header-padding-top: 3rem` (header layout override)
- `width: 0%; opacity: 0` (initial reveal-animation state)

**Sample browser-suggested sha256 hashes** (15+ unique values, sample):

- `sha256-rFWP16idZo6wfp6aLzNwxiiRkPSJ8+IfG8CfwQYNa18=` → `width: 0%; opacity: 0`
- `sha256-Krs5CnlIM0HAO7Pr72mKdKjgqSWIMruG/cU+5PBNTxQ=` → `--wave-header-padding-top: 3rem`
- `sha256-G7eSdSHR/cqDigDgiQT64ysC9B0AEUsHSJMSXyeBMNo=` → `transition-delay: 0ms`
- `sha256-XzoIcPOmzmdUciRlcYQh6CKX3eafgEkB33XBJz/SpBI=` → `transition-delay: 100ms`
- `sha256-SeBrjZeL1MSSLN5kIuDUqlu4PqOrOAWCYwkwhMdd+MM=` → `transition-delay: 200ms`
- `sha256-UCY5NB+/HS6OSZXbHQJEDT4f9tUmQPV8oMKcoWFJo/g=` → `transition-delay: 300ms`
- `sha256-jt7FcppX6SKcHyqjITIKf2GdqQprcLCPl0AeL/aRRIw=` → `transition-delay: 400ms`
- `sha256-JzGVqdWzlt8XRxcnPjZWj2J4I1Qtro6jov1ou5SAUuo=` → `transition-delay: 500ms`
- `sha256-9I5S4GboEMLQYxOJGsnNRBrmlI1BZj7FXz/q76P7j1E=` → `transition-delay: 600ms`
- `sha256-SDqSUq9qGSheVE727qpPOzDiW9QkobaGcspXIa7YsmU=` → CSS-vars block (repeats per card)
- `sha256-/FqXQXJYUgL9O0s+rwkMtdUKfKrQ1cQnDyJBZxR5VH8=` → `background-color: var(--brand-accent); c…`

**Root cause hypothesis**: React islands (likely card grid + header + reveal-animation components) pass `style={{ transitionDelay, '--corner-bg': ... }}` props that React serializes as `style=""` attributes. Inline style attributes are governed by `style-src-attr`, which requires either a nonce (not supported for attributes) or `'unsafe-hashes'` + per-hash entry.

**Options considered**:

| # | Option | Pros | Cons |
|---|--------|------|------|
| **A** | Refactor inline `style` props to CSS classes + `data-*` attrs. For stagger: `data-stagger-index={i}` + CSS `[data-stagger-index="3"] { transition-delay: 300ms; }`. For CSS variables: emit a `<style nonce="...">` block server-side with theme tokens and select via `data-theme="forest"` / per-card class. | CSP-clean (no `'unsafe-hashes'` needed). Maintainable. Policy header does not grow. Future style changes do not invalidate hashes. | Touches 5-6 islands (cards, header, badges, reveal). Loses flexibility of per-instance custom-property-driven theming — must be replaced by a finite token set. |
| B | `'unsafe-hashes'` + sha256 explicit allowlist | No code changes. Technically CSP3-conformant. | `'unsafe-hashes'` weakens `style-src` for ALL inline style attrs (not only the hashed ones). Hash list is fragile — any value change (e.g. 400 → 450 ms) breaks it. Policy header grows. CSP Evaluator flags this pattern. |

**Decision**: **A (refactor)**. Approved 2026-05-16.

**Affected files (preliminary, to be confirmed during implementation)**: React islands under `apps/web/src/components/**` that render the listings grid card, the page header with wave decoration, and reveal-animation wrappers. The exact list is a deliverable of the implementation task.

### 1C.3 GAP-046-09b — Inline `<style>` blocks (style-src-elem)

**Observed (`style-src-elem` violations)**: 24 distinct violations on a single page load, located at `alojamientos:99:1`, `108:1`, `113:1`, `115:1`, `151:1`, `187:1`, `223:1`, `259:1`, `295:1`, `331:1`, `367:1`, `403:1`, `439:1`, `475:1`, `511:1`, `547:1`, `583:1`, `619:1`, `655:1`, `691:1`, `727:1`, `763:1`, `799:1`, `835:1`.

**Pattern**: the spacing of 36 lines between violations suggests **one `<style>` block per card** in the grid (matching the rendered card count). The browser suggests a different sha256 for each block — i.e. the block contents are per-instance.

**Root cause hypothesis**: this is the dual-policy artifact tracked as GAP-042-03. Astro `experimental.csp` emits per-block style hashes in its CSP meta tag; per CSP Level 2+, when **any** hash or nonce is present in `style-src`, browsers ignore `'unsafe-inline'` and require a matching hash/nonce. The HTTP header carries a nonce that does not match these blocks because Astro generates them at build time with no awareness of the per-request nonce.

**Options considered (refined after Astro 6 research, see [`research/astro-csp-options.md`](research/astro-csp-options.md))**:

The original "Astro experimental.csp nonce" option (previously listed as A) does NOT exist. Astro 6 `security.csp` is **hash-based only** and is **incompatible with `<ClientRouter />`** which the web app uses today. The viable options are:

| # | Option | Pros | Cons |
|---|--------|------|------|
| **A** | **Inject nonce into Astro-emitted `<style>` tags from middleware / Astro integration** (post-render HTML rewrite). Keep middleware as single CSP source. See research doc Path A. | ClientRouter keeps working. Single CSP source (header). Per-request nonce rotation. `report-uri` keeps working. Compatible with `'strict-dynamic'`. | We own a small HTML-rewriting integration. <1 ms perf hit per response (to be benchmarked). |
| B | Move scoped `<style>` blocks to external CSS modules / `.css` files imported by the component. Astro bundles them as external stylesheets covered by `'self'`. | External stylesheets need no nonce/hash. | Loses Astro's automatic scoping on inline `<style>`. More files. Mass refactor across components. |
| C | Migrate to Astro 6 `security.csp` (hash-based) and drop `<ClientRouter />` for the native View Transitions API. See research doc Path B. | Official supported path. Astro maintains hashes. | **Big-ticket**: ClientRouter migration is a substantial rework. Hashes do not rotate per request. Dev-mode loses CSP coverage. Out of scope for SPEC-046; consider as Post-Phase-2 roadmap. |
| D | Add `'unsafe-inline'` to `style-src` | Trivial. CSP3 ignores `'unsafe-inline'` when a nonce/hash is present on conformant browsers. | If nonce propagation ever breaks, fallback opens the entire `style-src` directive. Counter to the goal of SPEC-046 (hardening). |

**Decision**: **A — middleware/integration nonce injection**. Approved 2026-05-16 after research. **B retained as fallback for components that prove difficult to nonce-stamp** (e.g. content emitted before middleware runs, if any). **C tracked as Post-Phase-2 roadmap entry**, not a Phase 2 prerequisite. **D rejected**.

### 1C.4 GAP-046-10 — Runtime dynamic-code evaluation in client-side Zod (REOPENED 2026-05-17 — intentional, fallback-safe probe)

**Updated status (2026-05-17)**: **The probe IS present**. The original "verified absent" conclusion from the 2026-05-16 crawl was wrong — that crawl did not exercise the signup page or capture the report-uri POSTs sent to Sentry. The T-014 verification crawl on staging (2026-05-17, post PR #1134/#1135 deploys) caught two reports per page that does load `schemas.sjtBSBUc.js`:

```text
[INFO] Evaluating a string as JavaScript violates the following Content Security
Policy directive because 'unsafe-eval' is not an allowed source of script:
"script-src 'self' 'nonce-...' 'strict-dynamic'".
The policy is report-only, so the violation has been logged but no further
action has been taken. @ https://staging.hospeda.com.ar/_astro/schemas.sjtBSBUc.js:0
```

**Root cause**: the violation comes from a feature-detection probe in the schemas chunk:

```js
re = s(() => {
    if (typeof navigator < `u` && navigator?.userAgent?.includes(`Cloudflare`)) return false;
    try { return Function(``), true } catch { return false }
});
```

The library (Zod, Valibot, or similar — pinned in `@repo/schemas` transitive deps) probes `Function('')` to detect whether `'unsafe-eval'` is allowed. If it is, the library uses a JIT-compiled validator (faster). If it is NOT, the `try/catch` swallows the exception and the library falls back to a CSP-safe runtime validator. **Functionality is unaffected**; only the speed of validation changes (negligible in practice for typical form schemas).

**Conclusion**: this is an **intentional, fallback-safe probe**, not a real security gap. The CSP report fires once per page load that imports the schemas chunk, the library handles the exception cleanly, and the user-visible behavior is identical.

**Action**: GAP-046-10 is **accepted as a known benign report**. We do NOT add `'unsafe-eval'` to `script-src` (that would weaken the policy in exchange for a marginal validation speed gain that the library already handles via fallback). For Phase 2 enforcement, the violation will be **blocked** by the browser; the library's `try/catch` already covers that case, so no behavior change is expected.

**Future cleanup option** (optional, not blocking): add a Sentry `beforeSend` filter on the security ingestion endpoint that drops violation reports whose `blocked-uri` is `eval` and whose `source-file` matches `_astro/schemas*.js` — purely to reduce report noise. Tracked as a follow-up nice-to-have, not a SPEC-046 acceptance criterion.

**Options preserved for historical reference** (in case this gap is re-opened):

| # | Option | Pros | Cons |
|---|--------|------|------|
| A | Lazy-load schemas server-side via Astro Actions or API endpoints. Web client validates against types only; runtime validation runs on server. | No `'unsafe-eval'` in client. Smaller client bundles. Single source of truth in `@repo/schemas` reused as-is server-side. | Refactor: client forms must call server to validate. Loses instant client-side validation UX unless we ship pre-derived synchronous validators. |
| B | Server-only validation (no client-side validation at all) | Simpler. | Worst UX — every keystroke or submit needs a round-trip. |
| C | Add `'unsafe-eval'` to `script-src` | Trivial. | Weakens the entire `script-src` directive — counter to the SPEC objective. |

### 1C.5 GAP-046-11 — Cloudflare Web Analytics beacon

**Observed**:

- `Cross-Origin Request Blocked` reading `https://static.cloudflareinsights.com/beacon.min.js/v833ccba57c9e4d2798f2e76cebdd09a11778172276447` (CORS request did not succeed, status `(null)`).
- `None of the "sha512" hashes in the integrity attribute match the content of the subresource` — the computed hash collapses to the empty-string SHA-512 (`z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg==`), confirming the response body was empty.

**Root cause**: Cloudflare injects the analytics beacon at the edge when Web Analytics is enabled. The integrity failure is an internal Cloudflare bug, **not** caused by our CSP — but the script is still useless and remains a third-party origin in our policy surface area.

**Options considered**:

| # | Option | Pros | Cons |
|---|--------|------|------|
| **A** | Disable Cloudflare Web Analytics in the CF dashboard for `hospeda.com.ar` and `staging.hospeda.com.ar`. | One fewer external dependency. Removes the integrity error entirely (CF bug becomes irrelevant). Privacy improvement. SPEC-140 (self-hosted Umami) already replaces this analytics surface. | We lose CF's free analytics. **Mitigated** by SPEC-140. |
| B | Allowlist `https://static.cloudflareinsights.com` in `script-src` (and `connect-src` for the report endpoint). | Keeps CF analytics. | Does not fix the integrity error (that is internal to CF). Adds an external origin to the policy. Redundant once SPEC-140 ships. |

**Decision**: **A — disable Cloudflare Web Analytics**. Approved 2026-05-16. Coordinate with SPEC-140 rollout to avoid an analytics blackout window.

### 1C.6 GAP-046-12 — `frame-src` directive missing on web

**Observed**: no `frame-src` violations (web does not embed iframes today). However, `apps/web/src/middleware.ts` does not declare a `frame-src` directive at all, so framing behavior falls back to `default-src 'self'` (or browser default), which is implicit rather than intentional.

**Options considered**:

| # | Option | Pros | Cons |
|---|--------|------|------|
| A | `frame-src 'self' https://*.mercadopago.com` | Enables future MercadoPago Brick embedding in web. | Opens the directive today for a use case that does not exist yet. |
| **B** | `frame-src 'none'` | Secure default. Web has no iframes today. Easy to widen later if a real need appears. | Future MP Brick embedding in web would require a one-line policy change. |

**Decision**: **B — `frame-src 'none'`**. Approved 2026-05-16. Admin's `frame-src` continues to allow MercadoPago domains as already configured.

### 1C.7 GAP-046-13 — Inline `<script>` blocks without nonce (NEW)

**Observed (`script-src-elem` violations on inline scripts)**: 9 distinct inline-script violations in the HTML tail, with browser-suggested sha256 hashes:

- `alojamientos:835:202` → `sha256-fi2wuuVHce7fvPu94PjPYE5y473+apRiq4+Ud+pAw8k=`
- `alojamientos:835:4550` → `sha256-BF0290pkb3jxQsE7z00xR8Imp8X34FLC88L0lkMnrGw=`
- `alojamientos:835:4883` → `sha256-SaCkFfPruIdTXT8/97JArQmGxiJAL2o4bBDvSgJ5y3Q=`
- `alojamientos:835:17980` → `sha256-QzWFZi+FLIx23tnm9SBU4aEgx4x8DsuASP07mfqol/c=`
- `alojamientos:835:20317` → `sha256-0oe0j1+KVmVYcHm1N1/3tGTf3Yhpnd6heIyJsO4LZS0=`
- `alojamientos:835:20978` → `sha256-QIis4c+zUxw71z17/jlW57kpaye3i+SP+dPqUP+r9eI=`
- `alojamientos:836:886` → `sha256-/0ObX9L306kArWIqQWQdp/a4E4U6aYvDcRKl6cPwNhM=`
- `alojamientos:840:40` → `sha256-se1/o549MPT5a6cfW9xSLtZvAoRW0dK8v4hGN16kDKk=`
- `alojamientos:840:3429` → `sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=`

**Root cause hypothesis**: lines 835-840 are where Astro injects hydration / `client:*` directives as inline `<script>` blocks. Either (a) Astro `experimental.csp` is not propagating the request nonce to these blocks, or (b) these blocks are emitted before the nonce-injection middleware runs. Without a matching nonce, `'strict-dynamic'` does not trust them, so any external chunk they import (the `/_astro/*.js` chunks) is also blocked — which is exactly the secondary symptom documented in §11A.

**Options considered (refined after Astro 6 research, see [`research/astro-csp-options.md`](research/astro-csp-options.md))**:

The original "verify Astro nonce propagation" option assumed Astro had a built-in mechanism to attach the request nonce to its inline `<script>` tags. **It does not.** Astro 6 `security.csp` is hash-based and is incompatible with `<ClientRouter />` (in use today). The viable options are:

| # | Option | Pros | Cons |
|---|--------|------|------|
| **A** | **Inject nonce into Astro-emitted inline `<script>` tags from middleware / Astro integration** (post-render HTML rewrite). Same mechanism as GAP-046-09b option A — one integration covers both directives. | Compatible with `'strict-dynamic'`. **Fixes the cascading `/_astro/*.js` blocks too** (once inline scripts carry the nonce, the chunks they import are transitively trusted). Single CSP source (header). | We own the HTML-rewriting integration. |
| B | Migrate `<script is:inline>` blocks to external `<script src="...">` so Astro bundles them as chunks loaded under `'self'` + `'strict-dynamic'`. | Structural fix. | Critical scripts (FOUC prevention, dark-mode pre-paint, etc.) MUST run inline before CSS paints — they cannot be migrated. Hydration scripts are likely also non-migrable. |
| C | Migrate to Astro 6 `security.csp` (hash-based) and drop `<ClientRouter />` for the native View Transitions API. | Official supported path. | Same big-ticket migration cost described for GAP-046-09b option C. Out of scope for SPEC-046. |
| D | Hash allowlist (add each sha256 to `script-src`) | No code changes. | Fragile: every rebuild changes the hashes. Header grows. Does not scale across pages. |

**Decision**: **A — middleware/integration nonce injection** (same integration as GAP-046-09b). Approved 2026-05-16 after research. **B retained for non-critical scripts** that prove unstampable, if any. **C tracked as Post-Phase-2 roadmap**. **D rejected**.

### 1C.8 Coverage Status

**Closed 2026-05-16**. Full-site crawl performed with Astro `ClientRouter` active and "Persist Logs" enabled. The SPA navigation aggregates all violations under the initial document (`/es/alojamientos/`), but the underlying page visits exercised:

- `/es/` (home)
- `/es/alojamientos/` (listing index, with grid + filters)
- `/es/alojamientos/[slug]` (detail page — server island)
- `/es/iniciar-sesion` (auth form)
- `/es/crear-cuenta` (signup form)

No new violation types emerged beyond those catalogued in §1C.2–§1C.7. GAP-046-10 was specifically verified absent (§1C.4). Authenticated protected pages (`/es/mi-cuenta/*`) and billing entry points were not exercised due to the absence of a staging test account — these will be re-crawled before Phase 2 if a test account is provisioned, but their CSP surface is expected to be a subset of the forms already covered.

---

## 2. Sentry Session Replay Risk Assessment (CRITICAL)

### Background

Astro's `experimental.csp` emits style hashes in the CSP meta tag even without `styleDirective` config (Issue #14798, open). Per CSP Level 2+, browsers ignore `'unsafe-inline'` when hashes are present in `style-src`. Sentry Session Replay uses rrweb, which applies styles via `element.setAttribute('style', ...)`. These inline styles will NOT match any hash.

### Verification Procedure

1. Open the web app in Chrome with DevTools Console open
2. Navigate several pages to trigger Session Replay recording
3. Check Console for CSP violation reports mentioning `style-src`
4. Open Sentry dashboard -> Session Replays -> verify new replays appear
5. Play back a replay and check for visual fidelity (missing styles = broken)
6. Repeat in Firefox and Safari

### Outcome Matrix

| Session Replay Works? | Style Violations? | Action |
|---|---|---|
| Yes, full fidelity | None | Proceed to Phase 2 |
| Yes, full fidelity | Some violations logged | Acceptable.. document expected violations |
| Degraded (missing styles in replay) | Yes | Add `'unsafe-hashes'` to `style-src` or disable `experimental.csp` |
| Completely broken | Yes | Disable `experimental.csp`, fall back to HTTP-header-only CSP |

<!-- Added: Audit #3, 2026-03-17 -->
### Additional rrweb Verification (GAP-042-02)

Astro auto-emitted style hashes may silently break rrweb (Sentry Session Replay's DOM snapshot engine). Beyond the general verification above, explicitly test:

1. **DOM snapshot fidelity**: Open a Session Replay in Sentry and compare against the live page. Look for missing inline styles (e.g., `display: none` toggles, dynamic positioning).
2. **Console CSP violations**: Filter DevTools Console for `style-src` violations specifically. If rrweb-injected styles are being blocked, they will appear as `Refused to apply inline style` messages.
3. **Quantify impact**: If violations exist but Replay looks correct, the violations are likely from non-visual style operations. Document which styles trigger violations.
4. **If Replay is broken**: Two remediation paths:
   - **Option A**: Disable `experimental.csp` entirely and manage CSP via HTTP header only (recommended if Astro Issue #14798 is still open).
   - **Option B**: Add `'unsafe-hashes'` to `style-src` (weaker security but preserves Astro's script hash feature).

---

## 3. Verification Checklist: Web App

Environment: staging or production (NOT localhost).

### 3.1 Core Functionality

- [ ] Homepage loads without console errors (dark mode FOUC prevention script runs)
- [ ] Scroll reveal animations work (IntersectionObserver-based)
- [ ] Page navigation works (multi-page, no client router)
- [ ] Search page works (React island hydration)
- [ ] Auth flow: sign in, sign up, sign out
- [ ] Protected pages (`/mi-cuenta/`) load after auth
- [ ] Server Islands render correctly
- [ ] Card-to-detail morphing transitions (`transition:name`) animate
- [ ] Google Fonts load (check `font-src` allows `fonts.gstatic.com`)

### 3.2 Sentry Integration

- [ ] Trigger a deliberate JS error (e.g., `throw new Error('CSP test')` in console)
- [ ] Verify error appears in Sentry within 60 seconds
- [ ] Verify Session Replay captures the session (see Section 2)
- [ ] Check `connect-src` allows `*.ingest.sentry.io`

### 3.3 CSP Violation Reporting

- [ ] Open DevTools Console, look for `[Report Only]` CSP violation messages
- [ ] In Sentry, navigate to Security -> CSP Reports, verify violations arrive
- [ ] Inject a test violation: `<script>alert('test')</script>` via DevTools -> verify report in Sentry
- [ ] Document all observed violations and classify as expected (browser extensions) or unexpected

---

## 4. Verification Checklist: Admin App

### 4.1 Core Functionality

- [ ] Login page renders and auth works
- [ ] Dashboard loads with data
- [ ] Tables with sorting/filtering operate correctly
- [ ] Forms: create and edit entities
- [ ] Route transitions show pending bar animation
- [ ] Dialogs/modals open and close without CSP errors
- [ ] Nonce uniqueness: load page, note nonce from CSP header, reload, confirm different nonce

### 4.2 Sentry Integration

- [ ] Same checks as web app (Section 3.2)

### 4.3 CSP Violation Reporting

- [ ] Same checks as web app (Section 3.3)

### 4.4 MercadoPago Domain Audit (see Section 5)

- [ ] Complete the domain audit procedure below

---

## 5. MercadoPago Domain Audit Procedure

The CSP domains for MercadoPago were derived from SDK source analysis (SPEC-042, corrections #35-36). Real network traffic must confirm them.

### Procedure

1. Open admin app billing page with DevTools Network tab recording
2. Interact with all MercadoPago-related features (payment forms, checkout, etc.)
3. Filter Network tab to third-party domains
4. Record every unique domain contacted by the MercadoPago SDK
5. Compare against the CSP allowlist from SPEC-042:
   - `script-src`: `https://sdk.mercadopago.com`, `https://*.mlstatic.com`
   - `connect-src`: `https://*.mercadopago.com`, `https://api.mercadolibre.com`, `https://api-static.mercadopago.com`
   - `frame-src`: `https://*.mercadopago.com`
   - `img-src`: `https://*.mlstatic.com`
6. Check if `security.js` (antifraud) is loaded. If yes, confirm `'unsafe-eval'` is in `script-src`
7. Document any missing or extra domains

### Expected Output

A table of observed domains mapped to CSP directives, with a pass/fail for each.

---

## 6. Performance Check

- [ ] Run Lighthouse on both apps before and after CSP deployment
- [ ] Compare Time to Interactive and Largest Contentful Paint
- [ ] Acceptable regression: < 50ms increase in any metric
- [ ] Monitor Sentry for excessive CSP violation report volume (> 1000/hour = problem)

---

<!-- Added: Audit #3, 2026-03-17 -->
## 6A. Violation Monitoring Setup (GAP-042-07)

GAP-042-07 revealed that no monitoring infrastructure exists for CSP violations. Without active monitoring, the 14-day observation period has no objective metrics. This setup MUST be completed before the observation period starts.

### Sentry Configuration

1. **Issue grouping**: Configure Sentry to group CSP violation reports by directive + blocked-uri combination. This prevents thousands of individual violations from flooding the issue stream.
2. **Dedicated project or tag**: Either create a dedicated Sentry project for CSP violations, or add a tag `type:csp-violation` to all CSP security reports for easy filtering.
3. **Alert rules**:
   - Alert if unexpected violations exceed 50/hour (threshold to be adjusted after baseline).
   - Alert if any `script-src` violation is from a non-extension origin (potential XSS attempt).
   - Alert if violation count drops to zero for > 24 hours (indicates reporting is broken).

### Dashboard Metrics

Create a Sentry dashboard with:
- **Violations per day** (total and by directive)
- **Top blocked URIs** (identify recurring third-party scripts or resources)
- **Top affected directives** (which CSP rules fire most)
- **Violation origins** (browser extensions vs legitimate vs suspicious)
- **Trend line** (violations should decrease as issues are fixed)

### Baseline Measurement Procedure

1. Deploy CSP Report-Only to staging.
2. Run automated smoke tests to generate known-good traffic.
3. Record violation count for the first 48 hours as the **baseline**.
4. Classify each unique violation as:
   - **Expected**: Browser extensions, known third-party scripts, test injections.
   - **Unexpected**: Missing CSP domains, broken functionality, potential attacks.
5. The baseline document becomes the reference for the 14-day observation period.

### Expected vs Unexpected Violations

| Category | Examples | Action |
|----------|----------|--------|
| Browser extensions | `chrome-extension://`, `moz-extension://` | Ignore (document) |
| Known third-party | Google Fonts, Sentry SDK, MercadoPago SDK | Verify in allowlist |
| Missing allowlist entry | Legitimate resource blocked by CSP | Add to CSP and redeploy |
| Suspicious origin | Unknown scripts, data: URIs, inline eval | Investigate immediately |

---

## 7. Phase 2 Transition Criteria

Phase 2 = switching from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` (enforcing).

### Prerequisites

1. **Observation period**: Minimum 14 calendar days after staging deployment
2. **Zero unexpected violations**: All CSP violations in Sentry during the observation period are classified as:
   - Browser extensions (ignore)
   - Known third-party scripts (documented and allowlisted)
   - Test injections (ignore)
3. **Session Replay confirmed working** per Section 2 outcome matrix
4. **MercadoPago domain audit complete** with no missing domains
5. **No functional regressions** reported by QA or users
6. **Rollback plan tested** (see Section 9)

<!-- Added: Audit #3, 2026-03-17 -->
### Additional Audit-Based Prerequisites

These criteria were identified by the GAP-042 security audit and MUST be satisfied before Phase 2:

7. **GAP-042-03 resolved**: Dual CSP policy conflict (Astro meta enforcing + HTTP header reporting) must be resolved. Either `experimental.csp` is disabled or the Astro header is intercepted and downgraded. Evidence: single CSP policy source confirmed in deployed headers.
8. **Zero unexpected violations for 14 consecutive days**: Not just "classified" but truly zero. If a new unexpected violation appears on day 12, the counter resets.
9. **Session Replay confirmed with evidence**: Screenshots or Sentry links showing replays with full visual fidelity. Not just "it loads" but "inline styles render correctly in playback."
10. **MercadoPago checkout tested end-to-end**: Complete a test payment flow (sandbox mode), not just load the billing page. Verify no CSP violations during payment form rendering, 3DS redirects, and callback processing.
11. **`'unsafe-eval'` in admin verified** (GAP-042-04): Network DevTools confirms whether `security.js` (MercadoPago antifraud) actually uses `eval()`. If not, remove `'unsafe-eval'` before Phase 2. Document the finding either way.
12. **`'unsafe-inline'` in web `script-src` plan documented** (GAP-042-05): A written plan exists to eliminate `'unsafe-inline'` from web `script-src` (migrate `is:inline` scripts to hashed or module scripts). This does NOT need to be implemented before Phase 2, but the plan must exist.
13. **All quick-win fixes applied** (Section 1B): All 8 items from Section 1B are deployed and verified in staging.

<!-- Added: §1C real-violations prerequisites, 2026-05-16 -->
14. **GAP-046-09a resolved**: inline `style=""` attributes on React islands refactored to CSS classes + `data-*` attrs. Evidence: zero `style-src-attr` violations on `/es/alojamientos/` and equivalent pages after deploy.
15. **GAP-046-09b resolved**: Astro `<style>` blocks carry the request nonce (or moved to external CSS modules as fallback). Evidence: zero `style-src-elem` violations from Astro-emitted style blocks.
16. **GAP-046-10 accepted as benign** (2026-05-17, T-014): the `schemas.<hash>.js` chunk emits a `Function('')` feature-detection probe wrapped in `try/catch`. The library falls back to a CSP-safe validator when the probe fails. One `unsafe-eval` report per pageload, zero functional impact. See §1C.4 (rewritten 2026-05-17). No policy change.
17. **GAP-046-11 resolved**: Cloudflare Web Analytics migrated from broken Auto Setup to working Manual Setup (PR #1135 + operator switch in CF dashboard 2026-05-17). The manual snippet `<script>` is inline in `BaseLayout.astro` and the walker stamps it with the per-request nonce; `'strict-dynamic'` propagates trust to `beacon.min.js`. `connect-src` extended to allow RUM POSTs to `cloudflareinsights.com`. Evidence: beacon loads 200, RUM POST returns 204, zero CSP violations from the CF flow (Firefox / Chromium via playwright on 2026-05-17). The pivot from "disable" to "manual snippet" preserved Core Web Vitals RUM data that Umami (SPEC-140) does not natively cover.
18. **GAP-046-12 resolved**: `frame-src 'none'` declared in `apps/web/src/middleware.ts`. Evidence: CSP header on web responses includes `frame-src 'none'`.
19. **GAP-046-13 resolved**: parse5-based walker in `apps/web/integrations/csp-nonce-injector/` stamps the request nonce on every inline `<script>` and `<style>` tag Astro emits without one. Wired from middleware after `next()`. Evidence: zero `script-src-elem` violations on inline scripts AND zero cascading `/_astro/*.js` blocks.
20. **§1C.8 coverage**: public-pages full-site crawl completed 2026-05-17 (home, listing, detail, signin, signup — see [`verification-2026-05-17.md`](verification-2026-05-17.md)). Authenticated `/mi-cuenta/*` and billing entry points DEFERRED to **SPEC-142 workstream 2.A** under explicit risk acceptance — must be completed before the Phase-2 enforce flip (gated by SPEC-142 acceptance criteria).
21. **`GAP-046-FOLLOWUP-HOME-CSP-HEADER` filed (2026-05-17, T-014)**: the `/es/` home route does NOT emit the CSP header in its HTTP response, although the body carries nonce-stamped tags (so middleware ran). Pre-existing, not introduced by SPEC-046. Tracked as **SPEC-142 workstream 2.C** — Phase-2-enforce blocker, must be resolved before flipping.

### Decision

SPEC-046 ships at **14/15 tasks completed + 1 deferred to SPEC-142**. The Phase 2 enforce flip is OUT OF SCOPE of SPEC-046 and gated by SPEC-142:

1. SPEC-142 workstream 2.A (auth crawl) must close zero unresolved violations
2. SPEC-142 workstream 2.B (MercadoPago Brick CSP) must complete a successful test payment with hardened CSP
3. SPEC-142 workstream 2.C (home header gap) must be resolved
4. THEN SPEC-142 workstream 2.D flips the header name from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` (one-line change), deploys to staging for 48h soak, then production.

---

## 8. Acceptance Criteria

- [ ] All items in Sections 3 and 4 checklists are completed and passing
- [ ] Sentry Session Replay outcome documented with evidence (screenshots or Sentry links)
- [ ] MercadoPago domain audit table produced and any CSP gaps patched
- [ ] Performance comparison shows no significant regression
- [ ] Phase 2 observation period has started with violation monitoring active
- [ ] All findings documented in a verification report (can be a task progress file)

---

## 9. Rollback Plan

If critical issues are found after deployment:

| Severity | Symptom | Action |
|---|---|---|
| **P0** | App broken for users (scripts blocked, auth fails) | Remove CSP header entirely via Vercel dashboard or redeploy without CSP middleware |
| **P1** | Session Replay broken | Disable `experimental.csp` in Astro config, keep HTTP-header-only CSP |
| **P2** | MercadoPago partially broken | Add missing domains to CSP allowlist and redeploy |
| **P3** | Excessive violation noise | Adjust `report-uri` rate limiting or temporarily disable reporting |

Rollback should be possible within 15 minutes via Vercel dashboard config change or instant redeploy of the previous working commit.

---

<!-- Added: Audit #3, 2026-03-17 -->
## 10. Post-Phase-2 Roadmap

Once Phase 2 (enforcement) is stable in production, these improvements should be pursued as separate specs or tasks:

| Priority | Item | Gap ID | Description |
|----------|------|--------|-------------|
| HIGH | Trusted Types implementation | GAP-042-28 | Enables DOM injection sinks protection. Prevents XSS even when `'unsafe-inline'` is present. Requires careful rollout as it breaks many libraries. |
| HIGH | `report-to` + Reporting Endpoints migration | GAP-042-10 | Replace deprecated `report-uri` with the modern `report-to` directive and `Reporting-Endpoints` header. Sentry supports both, but `report-to` enables batching and is the future standard. |
| MEDIUM | Self-hosted fonts | GAP-042-15 | Eliminate Google Fonts CDN dependency (`fonts.googleapis.com`, `fonts.gstatic.com`) by self-hosting font files. Removes two external domains from CSP and improves privacy. |
| MEDIUM | Restrict `img-src` to specific CDN domains | GAP-042-27 | Current `img-src` uses broad wildcards. Replace with specific CDN domains (e.g., `res.cloudinary.com`, `images.unsplash.com`) once all image sources are cataloged. |
| LOW | Eliminate `'unsafe-inline'` from web `script-src` | GAP-042-05 | Migrate `is:inline` scripts in `BaseLayout.astro` to hashed or ES module scripts. Enables full hash-based integrity for all scripts. |
| LOW | Remove `'unsafe-eval'` from admin `script-src` | GAP-042-04 | Contingent on MercadoPago antifraud verification (Section 5). If `security.js` does not use `eval()`, remove immediately. |
| LOW | Migrate to Astro 6 native `security.csp` + drop `<ClientRouter />` | n/a | Long-horizon. Trades per-request nonce rotation for per-build hashes maintained by Astro. Requires migrating from Astro `<ClientRouter />` to the browser-native View Transition API (Astro's CSP feature is incompatible with ClientRouter). See [`research/astro-csp-options.md`](research/astro-csp-options.md) Path B. Surfaced 2026-05-16 during SPEC-046 paso 4 research. |

---

<!-- Added: Expected Report-Only warnings clarifier, 2026-05-16 -->
## 11. Expected Report-Only Warnings (Not Violations)

The following console messages appear on staging and are **expected by the CSP specification when running Report-Only with `'strict-dynamic'`**. They are NOT bugs and require NO fix on their own.

### 11.1 `Ignoring 'self' within script-src: 'strict-dynamic' specified`

**Behavior**: Firefox (and other CSP3-conformant browsers) emit this warning whenever a `script-src` directive contains `'strict-dynamic'` alongside `'self'` or any host-source expression. Per [CSP Level 3, §6.6.2.1.2](https://www.w3.org/TR/CSP3/#strict-dynamic-usage), once `'strict-dynamic'` is present, browsers ignore `'self'`, scheme-source, and host-source entries — trust flows exclusively from the nonce/hash to scripts loaded by already-trusted scripts.

**Why we keep `'self'` anyway**: backwards compatibility for older browsers that do not understand `'strict-dynamic'`. The warning is the documented cost of that compatibility hedge.

**Action**: document only. Do not remove `'self'`.

### 11.2 `/_astro/*.js` blocked under `'strict-dynamic'`

**Behavior**: violation reports such as `script-src-elem at https://staging.hospeda.com.ar/_astro/<chunk>.js ... violates directive: "script-src 'self' 'nonce-...' 'strict-dynamic'"`. Examples observed on 2026-05-16: `ClientRouter.astro_astro_type_script_index_0_lang.hXZbGkYM.js`, `page.BmOXou5L.js`, `prefetch.WQJ5QfWF.js`, `client.BA1CSYjd.js`, `client.y8GvzbjY.js`, `UserMenu.client.W1Xl-QFq.js`, `FilterSidebar.client.CQDXu414.js`.

**Why this happens today (Report-Only)**: with `'strict-dynamic'`, an external chunk is only trusted if it was injected by another script that itself carries the nonce. When the inline scripts at the HTML tail (GAP-046-13) do not carry the nonce, the chunks they import are not transitively trusted, so the browser reports them. This is the expected secondary symptom of GAP-046-13.

**Why this is NOT a permanent bug**: once GAP-046-13 is resolved and inline scripts carry the nonce, `'strict-dynamic'` should transitively trust the chunks they import and these reports should disappear.

**Action**: document only. Track resolution under GAP-046-13. Re-verify after the GAP-046-13 fix; if these reports persist, escalate as a separate gap.

---

<!-- Added: Audit #3, 2026-03-17 -->
## 12. References

- **Gap Analysis**: [`.claude/specs/specs-gaps-042.md`](../specs-gaps-042.md) .. Full report of 38 gaps across 3 audits. This spec incorporates findings from all 3 audits.
- **SPEC-042**: CSP Nonce Integration (Phase 1 implementation, completed).
- **SPEC-045**: Vite 7 Migration .. prerequisite for admin nonce injection (GAP-042-01, GAP-042-13, GAP-042-18, GAP-042-19).
- **Astro Issue #14798**: Style hash opt-out for `experimental.csp` (upstream, open).
- **§1C real-violations audit**: 2026-05-16, source `staging.hospeda.com.ar/es/alojamientos/` with Firefox DevTools Persist Logs enabled.
