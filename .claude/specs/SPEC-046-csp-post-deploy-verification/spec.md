# SPEC-046: CSP Post-Deployment Verification

> **Status**: draft
> **Created**: 2026-03-16
> **Updated**: 2026-03-17
> **Priority**: HIGH
> **Origin**: SPEC-042 (post-deploy verification items that cannot be tested locally)
> **Depends on**: SPEC-042 deployed to staging, SPEC-045 (Vite 7 migration) for admin nonce injection
> **Gap Analysis**: [`.claude/specs/specs-gaps-042.md`](../specs-gaps-042.md) (38 gaps, 3 audits)

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

### Decision

Once all prerequisites (1-13) are met, create a follow-up task to:
1. Change CSP header from Report-Only to enforcing
2. Deploy to staging first, observe 48 hours
3. Deploy to production

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

---

<!-- Added: Audit #3, 2026-03-17 -->
## 11. References

- **Gap Analysis**: [`.claude/specs/specs-gaps-042.md`](../specs-gaps-042.md) .. Full report of 38 gaps across 3 audits. This spec incorporates findings from all 3 audits.
- **SPEC-042**: CSP Nonce Integration (Phase 1 implementation, completed).
- **SPEC-045**: Vite 7 Migration .. prerequisite for admin nonce injection (GAP-042-01, GAP-042-13, GAP-042-18, GAP-042-19).
- **Astro Issue #14798**: Style hash opt-out for `experimental.csp` (upstream, open).
