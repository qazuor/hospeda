# CSP Phase 2 Transition - QA Observation Checklist

> This checklist was extracted from the originally planned SPEC-046 (CSP Post-Deploy Verification).
> The code changes (quick wins) were absorbed into SPEC-042 Phase 1.1.
> This document covers the MANUAL verification and observation process only.

## Prerequisites

Before starting the 14-day observation period, ALL of the following must be true:

- [ ] SPEC-042 Phase 1.1 (quick wins) completed and deployed
- [ ] SPEC-042 Phase 1.2 (unsafe-inline removal) completed and deployed
- [ ] SPEC-042 Phase 1.3 (structural improvements) completed and deployed
- [ ] SPEC-045 (Vite 7 + TanStack upgrade) completed and deployed
- [ ] Admin app has full HTTP-level CSP via `createStart({ requestMiddleware })`
- [ ] Admin nonce propagated to SSR script tags via `ssr.nonce`
- [ ] GAP-042-03 decision made: disable `experimental.csp` meta tag OR accept dual-policy enforcement
- [ ] Sentry CSP violation pipeline verified end-to-end (T-038)
- [ ] All apps deployed to staging (or Vercel Preview as staging alternative)

## Day 0: Baseline Collection

- [ ] Record current Sentry CSP violation count (should be near zero after fixes)
- [ ] Document known "acceptable" violations (browser extensions, dev tools, etc.)
- [ ] Screenshot DevTools Console on all major pages (home, listing, detail, auth, admin dashboard)
- [ ] Verify no CSP-related errors in browser console
- [ ] Record Lighthouse security audit score for web and admin

## Day 0: Functional Verification

### Web App
- [ ] All pages load without CSP violations (navigate every route)
- [ ] Dark mode toggle works (FOUC prevention script executes)
- [ ] Scroll-reveal animations trigger on scroll
- [ ] View Transitions animate (card-to-detail morphing)
- [ ] Google Fonts load correctly
- [ ] Sentry Session Replay captures a full session (verify in Sentry dashboard)
- [ ] Newsletter form submits correctly
- [ ] Search and sort functionality works
- [ ] Leaflet map loads and is interactive (if applicable)
- [ ] JSON-LD structured data present in page source

### Admin App
- [ ] Login page loads and authenticates
- [ ] Dashboard renders without errors
- [ ] All admin routes accessible (navigate sidebar)
- [ ] MercadoPago SDK loads (QZPayProvider renders)
- [ ] Payment flow completes in MercadoPago sandbox
- [ ] Data tables render and sort/filter correctly
- [ ] Sentry error reporting works (test via `throw new Error()` in console)
- [ ] TanStack DevTools accessible in development

### API
- [ ] All public endpoints respond correctly
- [ ] Documentation UI (/docs) loads (separate CSP policy)
- [ ] CORS headers correct for web and admin origins

## Days 1-14: Monitoring

### Daily Check (5 minutes)
- [ ] Check Sentry for new CSP violation issues
- [ ] Categorize any new violations as: expected (browser extension), unexpected (real issue), or false positive
- [ ] Log daily violation count in table below

### Violation Log

| Day | Date | Violations | Categories | Action Taken |
|-----|------|------------|------------|--------------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |
| 11 | | | | |
| 12 | | | | |
| 13 | | | | |
| 14 | | | | |

## Day 14: Transition Decision

### Go/No-Go Criteria

**GO (transition to enforcement):**
- Zero unexpected violations for 14 consecutive days
- All functional verification items pass
- Sentry Session Replay confirmed working
- MercadoPago checkout confirmed working
- No performance regression (LCP/CLS/INP within budget)

**NO-GO (extend observation or investigate):**
- Any unexpected violation pattern
- Sentry Session Replay broken (rrweb inline style conflict)
- MercadoPago checkout broken
- Performance regression detected

### Transition Steps (if GO)

1. Change `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in:
   - `apps/web/src/middleware.ts` (line ~107)
   - `apps/admin/src/middleware.ts` (CSP_HEADER_NAME constant)
2. Deploy to staging first, verify 24 hours
3. Deploy to production
4. Monitor Sentry for 48 hours post-enforcement
5. Have rollback plan ready (revert header name change)

### Rollback Plan

If enforcement causes issues in production:
1. Revert `Content-Security-Policy` back to `Content-Security-Policy-Report-Only`
2. Deploy immediately
3. Investigate violations in Sentry
4. Fix issues and restart observation period

## Post-Phase 2: Future Hardening (Phase 3)

These are NOT blocking for Phase 2 but should be considered later:

- [ ] Add `report-to` directive alongside `report-uri` (GAP-042-10)
- [ ] Evaluate Trusted Types (`require-trusted-types-for 'script'`) (GAP-042-28)
- [ ] Restrict `img-src` to specific CDN domains instead of `https:` wildcard (GAP-042-27)
- [ ] Restrict `*.mercadopago.com` to specific subdomains (GAP-042-40)
- [ ] Evaluate removing `'unsafe-eval'` from admin CSP after MercadoPago audit (GAP-042-04)
- [ ] Address admin inline styles for potential `style-src` hardening (GAP-042-45)
- [ ] Consolidate `buildSentryReportUri` to shared package (GAP-042-08)
