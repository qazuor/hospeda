# SPEC-020: Deployment Readiness & Code Quality - Gap Analysis

> Generated: 2026-03-04
> Auditor: Claude Opus 4.6
> Methodology: Exhaustive cross-reference of spec.md, TODOs.md, state.json, and actual codebase

## Executive Summary

SPEC-020 is marked as **completed** (53/53 tasks). After exhaustive verification against the actual codebase, the core objectives were achieved: admin SSR builds work, CI/CD pipelines exist, Sentry is integrated, environment documentation exists, and major code quality issues were addressed.

However, **11 gaps** remain. Some are incomplete deliverables from SPEC-020 itself, others are new issues discovered during this audit. Pre-existing test/typecheck failures were correctly delegated to SPEC-023 (completed). Staging environment setup was delegated to SPEC-025 (draft).

### Severity Legend

- **CRITICAL**: Blocks production deployment or causes production failures
- **HIGH**: Significant risk to production operations or developer experience
- **MEDIUM**: Code quality or documentation gap, non-blocking
- **LOW**: Minor inconsistency, cosmetic

---

## Gap 1: SECRETS.md Missing Critical Production Secrets

SPEC: SPEC-020
Gap: SECRETS.md only documents 4 of ~15 required secrets
Related Task: T-015 (Update .github/SECRETS.md with current secret names) - marked completed but incomplete
Delegated to other spec: NO

### Description

`.github/SECRETS.md` documents only 4 secrets (`HOSPEDA_DATABASE_URL`, `HOSPEDA_BETTER_AUTH_SECRET`, `HOSPEDA_API_URL`, `HOSPEDA_SITE_URL`), but the production deployment requires at minimum 10 additional secrets that are documented in `.env.example` but NOT in SECRETS.md:

| Missing Secret | Impact if Missing |
|---|---|
| `MERCADO_PAGO_ACCESS_TOKEN` | Billing completely broken |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Webhook verification fails, subscription sync broken |
| `CRON_SECRET` | Cron jobs unauthenticated or disabled |
| `HOSPEDA_REDIS_URL` | Rate limiting falls back to in-memory (not production-safe) |
| `RESEND_API_KEY` | All email notifications fail silently |
| `SENTRY_DSN` (API) | No error tracking in API |
| `PUBLIC_SENTRY_DSN` (Web) | No error tracking in Web |
| `VITE_SENTRY_DSN` (Admin) | No error tracking in Admin |
| `HOSPEDA_ADMIN_URL` | Admin CORS may fail |
| `REPLICATE_API_TOKEN` | AI image generation fails |
| `VERCEL_TOKEN` | CD workflows cannot deploy |
| `VERCEL_ORG_ID` | CD workflows cannot deploy |
| `VERCEL_PROJECT_ID_API` / `_WEB` / `_ADMIN` | CD workflows cannot deploy |

### Options

1. **Quick fix**: Add all missing secrets to SECRETS.md with descriptions, required/optional flags, and per-environment values
2. **Better**: Also add a "Vercel Environment Variables" section documenting which vars go in each Vercel project

### Priority: HIGH

### Impact: A new team member or DevOps engineer configuring GitHub Secrets or Vercel will miss critical vars, causing production failures in billing, email, monitoring, and deployments

### What happens if we don't fix it: First deploy will fail or billing/email/monitoring will be silently broken. The .env.example has the info, but SECRETS.md is the canonical CI/CD reference

relatedFiles:

- .github/SECRETS.md
- .env.example
- .github/workflows/cd-production.yml
- .github/workflows/cd-staging.yml

**Decisión**: ✅ Implementado (2026-03-16) - SECRETS.md completado con todas las variables de producción: 5 Vercel CD secrets, HOSPEDA_REDIS_URL, HOSPEDA_CRON_SECRET, HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN + WEBHOOK_SECRET, HOSPEDA_RESEND_API_KEY, HOSPEDA_SENTRY_DSN (3 apps), OAuth providers, Linear, Exchange Rate API, secciones para GitHub Actions Secrets y Vercel Environment Variables por app (API/Web/Admin), local development, Docker Compose, y guías de troubleshooting. Total: ~40 variables documentadas con descripción, requerimiento y cómo obtenerlas.

---

## Gap 2: apps/web/.env.example Does Not Exist

SPEC: SPEC-020
Gap: Web app has no .env.example file (only centralized .env.example at root)
Related Task: T-011 (Create .env.example for apps/web) - marked completed
Delegated to other spec: NO

### Description

US-04 requires `.env.example` files in ALL THREE apps. The root `.env.example` exists and is comprehensive, but `apps/web/.env.example` does NOT exist as a standalone file. The root file covers web vars (`PUBLIC_API_URL`, `PUBLIC_SITE_URL`, `PUBLIC_SENTRY_DSN`), but:

- A developer working only on `apps/web/` won't know to look at the root
- The CLAUDE.md for web references env vars but doesn't point to a .env.example
- `apps/api/.env.example` and `apps/admin/.env.example` both exist as standalone files

### Options

1. **Create `apps/web/.env.example`** with the web-specific vars extracted from the root file
2. **Add a symlink or comment** in `apps/web/` pointing to root `.env.example` (less ideal)

### Priority: MEDIUM

### Impact: Developer experience friction for web-only development setup. Not a production blocker since the root .env.example has the info

### What happens if we don't fix it: Web developers may miss required env vars. Inconsistency with api and admin which both have their own .env.example

relatedFiles:

- .env.example (root)
- apps/api/.env.example
- apps/admin/.env.example

---

## Gap 3: 19 Files Still Exceed the 500-Line Limit

SPEC: SPEC-020
Gap: File decomposition (US-19) left 19 production files over 500 lines
Related Task: T-031 to T-039 (Decompose files exceeding 500 lines) - marked completed
Delegated to other spec: NO

### Description

The spec targeted the "worst offenders" and successfully decomposed `base.crud.service.ts`, `subscriptions.tsx`, `payments.tsx`, `promo-code.service.ts`, and the mercadopago webhooks route. However, 19 files still violate the 500-line standard:

**apps/api/src/ (13 files):**

| Lines | File | Notes |
|---|---|---|
| 832 | services/trial.service.ts | Not in original scope |
| 740 | middlewares/limit-enforcement.ts | Not in original scope |
| 708 | services/addon-entitlement.service.ts | Created BY T-036 decomposition |
| 661 | cron/jobs/notification-schedule.job.ts | Not in original scope |
| 649 | middlewares/tourist-entitlements.ts | Not in original scope |
| 640 | utils/zod-error-transformer.ts | Was in original scope (QUAL-06) but only `as any` was addressed |
| 610 | services/addon-expiration.service.ts | Created BY T-036 decomposition |
| 582 | services/usage-tracking.service.ts | Not in original scope |
| 545 | middlewares/entitlement.ts | Not in original scope |
| 536 | utils/env.ts | Not in original scope |
| 529 | routes/billing/trial.ts | Not in original scope |
| 511 | middlewares/metrics.ts | Not in original scope |
| 508 | utils/route-factory.ts | Was decomposed but still 8 lines over |

**packages/service-core/src/ (6 files):**

| Lines | File | Notes |
|---|---|---|
| 956 | services/accommodation/accommodation.service.ts | Not in original scope |
| 829 | services/post/post.service.ts | Not in original scope |
| 760 | services/destination/destination.service.ts | Not in original scope |
| 526 | services/event/event.service.ts | Not in original scope |
| 522 | services/exchange-rate/exchange-rate-fetcher.ts | Not in original scope |
| 511 | services/attraction/attraction.service.ts | Not in original scope |

### Options

1. **Accept as-is for v1 launch**: Most of these were not in the original SPEC-020 scope. The targeted files were decomposed.
2. **Create a follow-up task**: Track the remaining 19 files for post-launch decomposition.
3. **Prioritize the 2 files created by SPEC-020 work**: `addon-entitlement.service.ts` (708) and `addon-expiration.service.ts` (610) were introduced by T-036 decomposition and should have been under 500.

### Priority: LOW (most were not in scope) / MEDIUM (for the 2 files created by SPEC-020 itself)

### Impact: Code maintainability. No runtime impact

### What happens if we don't fix it: Developer experience degrades when modifying these files. No production impact

relatedFiles:

- apps/api/src/services/addon-entitlement.service.ts
- apps/api/src/services/addon-expiration.service.ts
- apps/api/src/services/trial.service.ts
- packages/service-core/src/services/accommodation/accommodation.service.ts
- (and 15 more listed above)

**Decisión**: 📋 Nueva SPEC formal (2026-03-16) - Descomposición de archivos > 500 líneas en fases por criticidad. Crear SPEC dedicada post-launch.

---

## Gap 4: TODO/FIXME Comments Not Triaged Per Spec Requirements

SPEC: SPEC-020
Gap: 63 TODOs remain without issue references; triage was partial
Related Task: T-N/A (US-23, QUAL-05: Triage 161 TODOs/FIXMEs) - spec section 11.5 says "83 TODOs were audited"
Delegated to other spec: NO

### Description

US-23 required all TODOs/FIXMEs to be either:

- Resolved inline
- Converted to a GitHub issue
- Deferred with a `// TODO(#<issue-number>):` comment

The spec's section 11.5 says "83 TODOs were audited. 7 were prioritized as pre-deploy, the remainder categorized as post-deploy." However, the current codebase has **63 TODO comments** in production code, and **none** reference issue numbers. They are all informal comments like:

```typescript
// TODO: Show error toast
// TODO: Implement predicate evaluation
// TODO: Check section visibility/editability conditions
```

All 63 are in `apps/admin/src/` (entity form system). None are in `apps/api/src/`, `apps/web/src/`, or `packages/`.

### Options

1. **Quick fix**: Create a single GitHub issue tracking all admin entity-form TODOs, then batch-update comments to `// TODO(#NNN):`
2. **Accept for v1**: These are all admin UX enhancements (gallery upload errors, form field types, visibility conditions), none are security or data integrity risks

### Priority: LOW

### Impact: No production impact. The TODOs are all feature enhancement requests for the admin entity form system

### What happens if we don't fix it: TODOs remain informal and could be forgotten. But they represent nice-to-have admin UX features, not critical functionality

relatedFiles:

- apps/admin/src/components/entity-form/fields/GalleryField.tsx
- apps/admin/src/components/entity-form/fields/ImageField.tsx
- apps/admin/src/components/entity-form/hooks/useEntityForm.ts
- apps/admin/src/components/entity-form/EntityViewSection.tsx
- apps/admin/src/components/entity-form/EntityFormSection.tsx
- apps/admin/src/features/accommodations/config/sections/*.ts

**Decisión**: 📋 Nueva SPEC formal (2026-03-16) - Triaging de TODOs en admin entity-form system. Crear GitHub issue agrupado y actualizar referencias. SPEC dedicada post-launch.

---

## Gap 5: Admin .env.example Missing Sentry DSN Variable

SPEC: SPEC-020
Gap: apps/admin/.env.example does not mention VITE_SENTRY_DSN
Related Task: T-010 (Create .env.example for apps/admin) - marked completed
Delegated to other spec: NO

### Description

`apps/admin/.env.example` documents only 4 variables (`VITE_API_URL`, `VITE_SUPPORTED_LOCALES`, `VITE_DEFAULT_LOCALE`, `VITE_DEBUG_ACTOR_ID`). It does NOT mention `VITE_SENTRY_DSN`, which is required for error tracking in the admin panel. The root `.env.example` does document it, but the per-app file should be self-contained.

### Options

1. **Add `VITE_SENTRY_DSN`** to `apps/admin/.env.example` with a comment

### Priority: LOW

### Impact: Minor documentation gap. The variable is documented in the root .env.example

### What happens if we don't fix it: Admin error tracking might not be configured. Sentry integration is conditional (only activates if DSN is set), so no crash, just silent monitoring gap

relatedFiles:

- apps/admin/.env.example
- .env.example (root, has VITE_SENTRY_DSN)

**Decisión**: ✅ Hacer (2026-03-16) - Agregar VITE_SENTRY_DSN al apps/admin/.env.example con comentario explicativo.

---

## Gap 6: Sentry Source Maps Upload Disabled in Web

SPEC: SPEC-020
Gap: @sentry/astro source maps upload is explicitly disabled
Related Task: T-024 (Configure @sentry/astro for web app) - marked completed
Delegated to other spec: NO

### Description

In `apps/web/astro.config.mjs`, the Sentry integration has `sourceMapsUploadOptions: { enabled: false }`. This means production errors in Sentry will show minified stack traces, making debugging significantly harder. The spec (US-10) requires "full stack trace and request context" for errors.

### Options

1. **Enable source maps upload**: Set `enabled: true` and configure `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` env vars
2. **Accept for v1**: Minified traces are still useful. Source maps can be uploaded manually or enabled post-launch
3. **Enable but keep maps private**: Upload to Sentry but don't serve maps publicly (Sentry's default behavior)

### Priority: MEDIUM

### Impact: Production debugging is harder without source maps. Errors are still captured, just with minified filenames and line numbers

### What happens if we don't fix it: When investigating production errors, developers see minified code references instead of original source locations. Debugging takes longer but is still possible

relatedFiles:

- apps/web/astro.config.mjs (lines 71-80)

**Decisión**: ✅ Hacer (2026-03-16) - Habilitar source maps upload en Sentry Web (enabled: true) y agregar SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT a la config y SECRETS.md.

---

## Gap 7: CD Workflows Missing Required Vercel Secrets Documentation

SPEC: SPEC-020
Gap: CD workflows reference 5 Vercel secrets not documented anywhere
Related Task: T-018/T-019 (Create CD workflows) - marked completed
Delegated to other spec: SPEC-025 (Staging Environment Setup) covers activation but not documentation of these secrets

### Description

`cd-production.yml` and `cd-staging.yml` reference these GitHub secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID_API`
- `VERCEL_PROJECT_ID_WEB`
- `VERCEL_PROJECT_ID_ADMIN`

None of these are documented in `SECRETS.md` or any other documentation file. Without them, the CD workflows will fail silently or with opaque "unauthorized" errors.

SPEC-025 covers setting up the staging environment including Vercel projects, but it does NOT cover documenting these secrets in SECRETS.md. This is a documentation gap in SPEC-020 T-015.

### Options

1. **Add to SECRETS.md**: Document all 5 Vercel secrets with instructions for obtaining them (`vercel link`, `vercel project ls`, etc.)
2. **Merge with Gap 1**: This is part of the same SECRETS.md incompleteness issue

### Priority: HIGH

### Impact: CD workflows will fail on first run without these secrets. A developer reading SECRETS.md won't know they need to configure Vercel

### What happens if we don't fix it: First attempt to use the CD pipeline will fail with authentication errors

relatedFiles:

- .github/SECRETS.md
- .github/workflows/cd-production.yml
- .github/workflows/cd-staging.yml

---

## Gap 8: route-factory.ts Still 508 Lines (8 Over Limit)

SPEC: SPEC-020
Gap: route-factory.ts decomposition left it 8 lines over the 500-line limit
Related Task: T-N/A (QUAL-03 / US-19) - spec section 11.4 says "488 lines" but actual is 508
Delegated to other spec: NO

### Description

The spec's deviation notes (section 11.4) state route-factory.ts is "488 lines" after decomposition. The actual file is **508 lines**. This is 8 lines over the 500-line standard. The companion file `route-factory-tiered.ts` is 341 lines (well under).

### Options

1. **Extract a small helper**: Move the type definitions or one factory function to reduce by ~10 lines
2. **Accept**: 508 is marginally over and the decomposition was a significant improvement from the original size

### Priority: LOW

### Impact: Cosmetic. 8 lines over a soft limit

### What happens if we don't fix it: Nothing material. The file is well-organized and the decomposition achieved its goal

relatedFiles:

- apps/api/src/utils/route-factory.ts (508 lines)
- apps/api/src/utils/route-factory-tiered.ts (341 lines)

**Decisión**: ❌ Descartado (2026-03-16) - 19 líneas sobre el límite no justifican el esfuerzo. El archivo ya fue descompuesto en SPEC-020. Aceptar como deuda técnica mínima.

---

## Gap 9: No `pnpm deploy:api` Script (Referenced in Spec but Never Created)

SPEC: SPEC-020
Gap: US-03 referenced `pnpm deploy:api` but no deploy scripts exist
Related Task: T-004/T-005 area (Fly.io tasks, now N/A due to Vercel migration)
Delegated to other spec: NO

### Description

The original spec success metric said "A single `pnpm deploy:api` command deploys the API." After the Fly.io-to-Vercel migration, this was implicitly dropped, but no replacement script exists. Deployments are handled entirely by GitHub Actions CD workflows (`cd-production.yml`).

There are no `deploy:*` scripts in either the root `package.json` or `apps/api/package.json`. This means:

- There is no way to deploy manually from CLI
- If CD pipelines fail, there's no documented manual fallback

### Options

1. **Accept as-is**: Vercel deployments are managed via GitHub Actions. Manual deploy via `vercel deploy --prod` from apps/api/ is always available.
2. **Add convenience scripts**: `pnpm deploy:api`, `pnpm deploy:web`, `pnpm deploy:admin` that wrap `vercel deploy`
3. **Document manual fallback**: Add a "Manual Deployment" section to the deployment docs

### Priority: LOW

### Impact: No automated fallback for manual deploys. Low risk since CD workflows handle normal flow

### What happens if we don't fix it: If CD fails, developers need to know to run `vercel deploy` manually. Not documented but straightforward

relatedFiles:

- package.json (root)
- apps/api/package.json
- .github/workflows/cd-production.yml

**Decisión**: ✅ Hacer (2026-03-16) - Agregar scripts pnpm deploy:api, deploy:web, deploy:admin en package.json raíz que wrappeen vercel deploy --prod desde el directorio correspondiente.

---

## Gap 10: turbo.json globalEnv Missing Some Production-Critical Vars

SPEC: SPEC-020
Gap: turbo.json globalEnv does not include HOSPEDA_REDIS_URL, CRON_SECRET, SENTRY_DSN, or HOSPEDA_ADMIN_URL
Related Task: T-012 (Update turbo.json globalEnv) - marked completed
Delegated to other spec: NO

### Description

`turbo.json` `globalEnv` contains 9 variables. The following production-critical variables that affect build behavior or output are NOT in `globalEnv`:

- `HOSPEDA_ADMIN_URL` - used in API CORS config, affects build output
- `HOSPEDA_REDIS_URL` - used in API middleware config
- `SENTRY_DSN` / `PUBLIC_SENTRY_DSN` - Sentry conditional integration changes build output
- `CRON_SECRET` - used in API cron config

If any of these change between builds, TurboRepo cache will NOT invalidate, potentially serving stale builds.

### Options

1. **Add critical env vars**: At minimum add `PUBLIC_SENTRY_DSN` and `HOSPEDA_ADMIN_URL` since they affect build output
2. **Accept**: Most of these are runtime-only vars that don't affect compilation. `PUBLIC_SENTRY_DSN` is the only one that changes build output (conditional Sentry integration in astro.config.mjs)

### Priority: LOW

### Impact: If `PUBLIC_SENTRY_DSN` is added/removed and turbo cache isn't cleared, the web build may or may not include Sentry. Other vars are runtime-only

### What happens if we don't fix it: Potential stale cache issue if PUBLIC_SENTRY_DSN changes. Workaround: `turbo build --force` after changing these vars

relatedFiles:

- turbo.json
- apps/web/astro.config.mjs (conditional Sentry based on PUBLIC_SENTRY_DSN)

**Decisión**: ✅ Hacer (2026-03-16) - Agregar HOSPEDA_ADMIN_URL, HOSPEDA_REDIS_URL, PUBLIC_SENTRY_DSN, VITE_SENTRY_DSN, HOSPEDA_CRON_SECRET al globalEnv de turbo.json.

---

## Gap 11: Web App Remote Image Patterns Missing CDN/Storage Domains

SPEC: SPEC-020
Gap: astro.config.mjs image remotePatterns only covers API hostname and *.vercel.app
Related Task: T-023 (Add production remote image patterns) - marked completed
Delegated to other spec: NO

### Description

US-11 requires that "remotePatterns includes the production API domain and any CDN or media storage domain used in production." The current config dynamically adds the API hostname and `*.vercel.app`. However, if in the future images are served from:

- A CDN (e.g., Cloudflare, CloudFront)
- An object storage (e.g., S3, R2, Supabase Storage)
- A third-party service (e.g., Unsplash for seed/placeholder images)

These would be blocked by Astro's image service.

### Options

1. **Accept for v1**: Currently all images come from the API. The dynamic hostname extraction covers the production API domain.
2. **Add common CDN patterns**: If seed data uses external image URLs (Unsplash, Picsum, etc.), add those domains
3. **Configure when needed**: Add domains as the platform's media strategy evolves

### Priority: LOW

### Impact: Only relevant if images come from domains not matching the API hostname or *.vercel.app

### What happens if we don't fix it: If seed data or user uploads reference external image URLs, those images will fail to load with "Remote Image Not Allowed" errors. Easily fixed by adding the domain at that time

**Decisión**: ❌ Descartado (2026-03-16) - Se agrega cuando realmente se necesite un CDN. No hay impacto actual, todas las imágenes vienen del API propio.

relatedFiles:

- apps/web/astro.config.mjs (lines 56-60)

---

## Summary Table

| # | Gap | Priority | Delegated? | Blocks Deploy? |
|---|-----|----------|------------|----------------|
| 1 | SECRETS.md missing 15+ secrets | HIGH | No | Yes (CD will fail) |
| 2 | apps/web/.env.example missing | MEDIUM | No | No |
| 3 | 19 files over 500-line limit | LOW-MEDIUM | No | No |
| 4 | 63 TODOs without issue references | LOW | No | No |
| 5 | Admin .env.example missing Sentry DSN | LOW | No | No |
| 6 | Sentry source maps upload disabled | MEDIUM | No | No |
| 7 | Vercel CD secrets undocumented | HIGH | Partially SPEC-025 | Yes (CD will fail) |
| 8 | route-factory.ts 508 lines (8 over) | LOW | No | No |
| 9 | No manual deploy scripts | LOW | No | No |
| 10 | turbo.json globalEnv incomplete | LOW | No | No |
| 11 | Remote image patterns minimal | LOW | No | No |

### Pre-Deploy Blockers (must fix before first production deployment)

- **Gap 1 + Gap 7** (merge into one task): Update SECRETS.md with ALL required GitHub secrets including Vercel project IDs, MercadoPago, Resend, Sentry DSNs, Redis, Cron.

### Recommended Pre-Deploy (should fix)

- **Gap 6**: Enable Sentry source maps upload for meaningful production debugging.
- **Gap 2**: Create apps/web/.env.example for consistency.

### Post-Deploy (can fix after launch)

- **Gaps 3, 4, 5, 8, 9, 10, 11**: Code quality and documentation improvements that don't affect production functionality.

### Items Correctly Delegated to Other Specs

| Item | Delegated To | Status |
|---|---|---|
| Pre-existing test failures (T-051) | SPEC-023 | COMPLETED |
| Pre-existing typecheck errors (T-052) | SPEC-023 | COMPLETED |
| Staging environment activation | SPEC-025 | Draft (not started) |
| Credential rotation (exposed in git) | SPEC-024 | Draft (not started, CRITICAL) |
| Security testing gaps | SPEC-026 | Draft (18 tasks, 0%) |
| Billing production issues | SPEC-021 | Draft (not started) |
| Frontend quality (dark mode, i18n, perf) | SPEC-022 | Draft (not started) |

---

## Gaps Adicionales (Descubiertos en Re-Audit 2026-03-04)

---

## Gap 12: `.then()` in uncaughtException/unhandledRejection Handlers (Anti-Pattern)

SPEC: SPEC-020
Gap: Error handlers use `.then()` chains with dynamic imports that could fail silently
Related Task: US-14 (Graceful Shutdown)
Delegated to other spec: NO

### Description

In `apps/api/src/index.ts` (lines 154 and 176), the `uncaughtException` and `unhandledRejection` handlers use `.then()` for dynamic Sentry imports:

```typescript
import('./lib/sentry').then(({ Sentry }) => {
    if (Sentry.isEnabled()) {
        Sentry.captureException(error);
    }
});
```

This violates two project rules: (1) use `async/await` instead of `.then()`, and (2) a dynamic import failure inside an error handler could throw a second unhandled exception, creating a loop. Additionally, `apps/api/src/lib/auth.ts` lines 205 and 226 have two more `.then()` patterns (fire-and-forget with `void`).

### Priority: LOW

### Impact: The code works but is inconsistent with project standards. Risk of unhandled exception loop is theoretical

### What happens if we don't fix it: No practical impact. The error handlers work correctly. Minor code style inconsistency

relatedFiles:

- apps/api/src/index.ts (lines 154, 176)
- apps/api/src/lib/auth.ts (lines 205, 226)

**Decisión**: ✅ Hacer (2026-03-16) - Convertir .then() a async/await en uncaughtException/unhandledRejection handlers de apps/api/src/index.ts y los 2 casos en apps/api/src/lib/auth.ts.

---

## Gap 13: `packages/notifications/src/services/notification.service.ts` Exceeds 500-Line Limit (554 lines)

SPEC: SPEC-020
Gap: Critical notification service file exceeds the 500-line standard
Related Task: T-031 to T-039 (File decomposition) - not in original scope
Delegated to other spec: NO

### Description

The main notification service (`notification.service.ts`) has 554 lines, exceeding the 500-line standard. This file is the core of the notification pipeline. It was not in the original SPEC-020 scope but should be added to the list of files needing decomposition in Gap #3.

### Priority: LOW

### Impact: Code maintainability. Same category as Gap #3

### What happens if we don't fix it: Same as Gap #3. Developer experience degrades for this specific file

relatedFiles:

- packages/notifications/src/services/notification.service.ts (554 lines)

---

## Gap 14: `packages/notifications` Missing `@vitest/coverage-v8` in devDependencies

SPEC: SPEC-020
Gap: Notification package has `test:coverage` script but no coverage provider
Related Task: T-024 area (test coverage verification)
Delegated to other spec: NO

### Description

The `packages/notifications/package.json` lists `vitest` but NOT `@vitest/coverage-v8` in devDependencies. The `test:coverage` script exists but may fail silently without the coverage provider. Other packages like `apps/admin` have `@vitest/coverage-v8` explicitly. If CI reads coverage from notifications and doesn't find `coverage-summary.json`, it may fail or simply omit the package from coverage reports.

### Priority: MEDIUM

### Impact: Coverage metrics for the notification package may be missing from CI reports, giving a false sense of overall coverage

### What happens if we don't fix it: Coverage reports may silently exclude the notification package. No runtime impact

relatedFiles:

- packages/notifications/package.json

---

## Gap 15: `FavoriteButton.client.tsx` - `.then()` Without `.catch()` in useEffect

SPEC: SPEC-020
Gap: Uncaught promise rejection in FavoriteButton component
Related Task: US-18 (Error handling in web components)
Delegated to other spec: NO

### Description

In `apps/web/src/components/ui/FavoriteButton.client.tsx` (line 177), the `useEffect` calls `checkBookmarkStatus()` with `.then()` but NO `.catch()`:

```typescript
checkBookmarkStatus({ entityId, entityType }).then((result) => {
    if (!cancelled) {
        setIsFavorited(result.isFavorited);
    }
});
```

If the API call fails (network error, 401, 500), the error is completely silenced. The user sees no toast, no error state, and the bookmark status may be stale.

### Priority: LOW

### Impact: The initial favorited state may be desynchronized without notification. The component's click handler has proper error handling, only the initial status check is unprotected

### What happens if we don't fix it: If the bookmark status API fails during initial load, the favorite button shows the `initialFavorited` prop value (which may be stale). No crash, but silent error

relatedFiles:

- apps/web/src/components/ui/FavoriteButton.client.tsx (line 177)

---

## Gap 16: `ci.yml` Does Not Include `PUBLIC_SENTRY_DSN` in Build Environment

SPEC: SPEC-020
Gap: CI build compiles web app without Sentry (differs from production)
Related Task: T-024 (Sentry integration)
Delegated to other spec: NO

### Description

The `.github/workflows/ci.yml` only passes 4 environment variables to the build step. `apps/web/astro.config.mjs` conditionally includes the Sentry integration based on `PUBLIC_SENTRY_DSN`. Since this variable is absent in CI, the web app is always built WITHOUT Sentry in CI, while production includes it. This means CI tests run against a different build than what's deployed.

### Priority: LOW-MEDIUM

### Impact: CI validates a build that differs from production in Sentry integration. Sentry-related bugs won't be caught in CI

### What happens if we don't fix it: Sentry-specific issues (e.g., source map conflicts, Sentry middleware interaction) could appear only in production

relatedFiles:

- .github/workflows/ci.yml
- apps/web/astro.config.mjs (lines 71-80: conditional Sentry)

---

## Updated Summary Table (with new gaps)

| # | Gap | Priority | Delegated? | Blocks Deploy? |
|---|-----|----------|------------|----------------|
| 1 | SECRETS.md missing 15+ secrets | HIGH | No | Yes (CD will fail) |
| 2 | apps/web/.env.example missing | MEDIUM | No | No |
| 3 | 19 files over 500-line limit | LOW-MEDIUM | No | No |
| 4 | 63 TODOs without issue references | LOW | No | No |
| 5 | Admin .env.example missing Sentry DSN | LOW | No | No |
| 6 | Sentry source maps upload disabled | MEDIUM | No | No |
| 7 | Vercel CD secrets undocumented | HIGH | Partially SPEC-025 | Yes (CD will fail) |
| 8 | route-factory.ts 508 lines (8 over) | LOW | No | No |
| 9 | No manual deploy scripts | LOW | No | No |
| 10 | turbo.json globalEnv incomplete | LOW | No | No |
| 11 | Remote image patterns minimal | LOW | No | No |
| **12** | **`.then()` in error handlers** | **LOW** | **No** | **No** |
| **13** | **notification.service.ts 554 lines** | **LOW** | **No** | **No** |
| **14** | **notifications missing coverage provider** | **MEDIUM** | **No** | **No** |
| **15** | **FavoriteButton .then() without .catch()** | **LOW** | **No** | **No** |
| **16** | **CI build without Sentry DSN** | **LOW-MEDIUM** | **No** | **No** |
| **17** | **notifications missing vitest.config.ts entirely** | **MEDIUM** | **No** | **No** |
| **18** | **billing missing @vitest/coverage-v8** | **LOW** | **No** | **No** |
| **19** | **admin/server.ts uses export default** | **LOW** | **No** | **No** |
| **20** | **logger/index.ts uses export default** | **LOW** | **No** | **No** |
| **21** | **Test mock files over 500 lines** | **INFO** | **No** | **No** |
| **22** | **DestinationFilters .catch() silent error** | **LOW** | **No** | **No** |
| **23** | **HOSPEDA_BETTER_AUTH_URL absent from docs/CI** | **LOW** | **No** | **No** |

---

## Gaps Adicionales (Re-Audit 2026-03-04 - Ronda 2)

---

## Gap 17: `packages/notifications` Missing `vitest.config.ts` Entirely

SPEC: SPEC-020
Gap: Notification package has no vitest config at all (escalation of Gap 14)
Related Task: T-024 area (test infrastructure)
Delegated to other spec: NO

### Description

Gap 14 documented that `@vitest/coverage-v8` was missing from devDependencies. The re-audit found the problem is deeper: `packages/notifications` has NO `vitest.config.ts` file at all. While vitest can run with the root config, coverage collection, thresholds, and includes/excludes are undefined for this package specifically. Other packages like `packages/db`, `packages/billing`, `packages/schemas` all have their own `vitest.config.ts`.

### Priority: MEDIUM

### Impact: Coverage reports for notifications may be incorrect or missing. Tests may silently not run if the root vitest config doesn't discover notification test files.

### Related Files: `packages/notifications/` (missing vitest.config.ts)

---

## Gap 18: `packages/billing` Missing `@vitest/coverage-v8` in devDependencies

SPEC: SPEC-020
Gap: Billing package can't generate coverage reports
Related Task: Test infrastructure
Delegated to other spec: NO

### Description

`packages/billing/package.json` has `vitest` but NOT `@vitest/coverage-v8`. The `test:coverage` script exists but the coverage provider is missing. Similar to Gap 14 for notifications.

### Priority: LOW

### Impact: Coverage reports for billing may fail or be empty.

### Related Files: `packages/billing/package.json`

---

## Gap 19: `apps/admin/server.ts` Uses `export default` (Framework Exception)

SPEC: SPEC-020
Gap: Admin app entry point uses default export, violating named-exports-only rule
Related Task: QUAL-02 (Code style compliance)
Delegated to other spec: NO

### Description

`apps/admin/server.ts` uses `export default` which violates the project rule "Named exports only (no default exports)". However, this is a TanStack Start framework requirement.. the server entry point MUST use default export. This should be documented as a framework exception.

### Priority: LOW (framework exception)

### Related Files: `apps/admin/server.ts`

---

## Gap 20: `packages/logger/src/index.ts` Uses `export default`

SPEC: SPEC-020
Gap: Logger package exports default, violating named-exports-only rule
Related Task: QUAL-02 (Code style compliance)
Delegated to other spec: NO

### Description

`packages/logger/src/index.ts` uses `export default createLogger(...)`. All consumers import it as `import logger from '@repo/logger'`. While refactoring to named export would be ideal, it requires updating imports across 20+ files.

### Priority: LOW

### Related Files: `packages/logger/src/index.ts`

---

## Gap 21: Test Mock Files Exceed 500-Line Limit

SPEC: SPEC-020
Gap: Several test mock/handler files exceed 500 lines
Related Task: T-031 to T-039 (File decomposition)
Delegated to other spec: NO

### Description

Test infrastructure files that exceed 500 lines:

- `apps/api/test/helpers/test-db.ts` (likely 500+)
- `apps/admin/test/mocks/handlers.ts` (potentially 500+)

These are test-only files, not production code. The 500-line rule is primarily for production code maintainability.

### Priority: INFO

### Related Files: Test mock files in `apps/api/test/` and `apps/admin/test/`

---

## Gap 22: `DestinationFilters.tsx` Has `.catch()` That Silences Errors

SPEC: SPEC-020
Gap: Silent error handling in destination filter component
Related Task: US-18 (Error handling)
Delegated to other spec: NO

### Description

`apps/web/src/components/destination/DestinationFilters.tsx` (or similar filter component) has a `.catch(() => {})` that silently swallows errors without logging or displaying feedback. Different from Gap 15 (FavoriteButton), this affects search/filter functionality where silent failures mean the user sees no results without knowing why.

### Priority: LOW

### Related Files: `apps/web/src/components/destination/DestinationFilters.tsx`

---

## Gap 23: `HOSPEDA_BETTER_AUTH_URL` Not Documented in .env.example or CI

SPEC: SPEC-020
Gap: Critical auth environment variable undocumented
Related Task: T-011/T-015 (Environment documentation)
Delegated to other spec: NO

### Description

`HOSPEDA_BETTER_AUTH_URL` is used by the auth system to know the API base URL for Better Auth. It's set in `.env` and `.env.test` but may not be comprehensively documented in `.env.example` or the CI workflow environment variables section. If missing, Better Auth may use incorrect callback URLs.

### Priority: LOW

### Related Files: `.env.example`, `.github/workflows/ci.yml`

---

## Auditoría #3 — 2026-03-16 (Multi-Agente: CI/CD + Calidad + Tests + Error Handling + Env Vars)

> Esta pasada utilizó 5 agentes especializados en paralelo para una cobertura exhaustiva.
> Se encontraron 12 gaps nuevos, 2 actualizaciones a gaps existentes, y se confirmaron 4 gaps previos.

---

## Gap 24: Coverage Thresholds No Enforced en API ni en Packages (Contradicción con Spec)

SPEC: SPEC-020
Gap: Spec afirma "90% coverage enforcement" pero solo el web app tiene threshold (80%), no 90%
Related Task: T-025 (vitest config fixed) — marcado completed pero incorrecto
Auditoria: #3 (2026-03-16)
Delegated to other spec: NO

### Description

SPEC-020 T-025 afirma "correct coverage thresholds" y el goal de la spec es "minimum 90% coverage". La realidad al 2026-03-16:

| Package | Threshold configurado | Valor |
|---|---|---|
| apps/web | ✅ Sí | 80% (lines/functions/statements), 75% (branches) |
| apps/api | ❌ NO | Sin threshold — 0% coverage es aceptable para CI |
| apps/admin | ❌ NO | Sin threshold — 0% coverage es aceptable para CI |
| packages/billing | ❌ NO | Sin threshold |
| packages/service-core | ❌ NO | Sin threshold |
| packages/db | ❌ NO | Sin threshold |
| packages/schemas | ❌ NO | Sin threshold |
| packages/notifications | ❌ NO | Sin vitest.config.ts (ya Gap 17) |
| packages/i18n | ❌ NO | Sin threshold |
| packages/auth-ui | ❌ NO | Sin threshold |
| packages/icons | ❌ NO | Sin threshold |

El CI workflow (`.github/workflows/ci.yml`) sí tiene un check de coverage agregado (lines 92-164) que verifica 90% por paquete y 80% para web. **Esto es la ÚNICA enforcement real.** Los vitest.config.ts individuales no tienen thresholds, lo que significa que `pnpm test:coverage` local pasa con 0% sin ningún warning.

### Options

1. **Agregar thresholds a cada vitest.config.ts**: Consistente con el standard, enforcement local además de CI.
2. **Aceptar enforcement solo en CI**: El CI sí falla si coverage < 90%. La inconsistencia es solo local.

### Priority: MEDIUM

### Severity: MEDIUM — El CI tiene enforcement. El gap es consistencia y developer experience local.

### What happens if we don't fix it: Developers pueden hacer commit de código sin tests y solo se enteran cuando el CI falla. No es un blocker de producción pero degrada el proceso de desarrollo.

relatedFiles:
- apps/api/vitest.config.ts (sin thresholds)
- apps/admin/vitest.config.ts (sin thresholds)
- packages/*/vitest.config.ts (todos sin thresholds)
- .github/workflows/ci.yml (lines 92-164, sí tiene enforcement)

Recommendation: Nueva SPEC o task dentro de SPEC-023. No bloquea deploy.

---

## Gap 25: 33 Tests Deshabilitados con `.skip()` y `.only()`

SPEC: SPEC-020
Gap: Test suite tiene 33 instancias de .skip()/.only() indicando tests rotos o aislados
Related Task: T-025/T-051
Auditoria: #3 (2026-03-16)
Delegated to other spec: SPEC-023 (preexisting errors)

### Description

Se encontraron 33 instancias de `.skip()` o `.only()` en tests:

**`.skip()` (tests deshabilitados):**
- `apps/web/test/accessibility/accessibility.test.ts` — accessibility tests deshabilitados
- `apps/api/test/routes/billing/plan-change.test.ts`
- `apps/api/test/e2e/flows/owner/registration-trial.test.ts`
- `apps/api/test/utils/env.test.ts`
- `apps/api/test/utils/create-app.defaulthook.test.ts`
- `apps/api/test/helpers/test-db.test.ts`
- `apps/api/test/integration/billing-routes-smoke.test.ts`
- `apps/api/test/integration/subscription-lifecycle-smoke.test.ts`
- `packages/service-core/test/services/event/getByOrganizer.test.ts`
- `packages/service-core/test/services/event/getByAuthor.test.ts`
- `packages/service-core/test/services/event/getByLocation.test.ts`

**`.only()` (test isolation — 11 instancias):** Indica que algún desarrollador dejó tests con `.only()` que solo corren un subset. Si se mergea a main, solo esos tests corren en CI.

### Options

1. **Fix o eliminar**: Cada test `.skip()` debe ser arreglado o eliminado con justificación documentada.
2. **Biome rule**: Agregar regla de linting para detectar `.skip()` y `.only()` en CI.

### Priority: HIGH

### Severity: HIGH — Los `.only()` son bugs de CI (hacen que solo corra un subset de tests).

### Complexity: MEDIUM

relatedFiles:
- apps/api/test/integration/billing-routes-smoke.test.ts
- apps/api/test/integration/subscription-lifecycle-smoke.test.ts
- apps/web/test/accessibility/accessibility.test.ts

Recommendation: Urgente para los `.only()`. Puede ser SPEC o task standalone.

**Decisión**: ✅ Hacer (2026-03-16) - Eliminar todos los .only(), investigar y resolver o documentar cada .skip(). Agregar regla lint para prevenir .only() en CI. Verificar que SPEC-023 no los resolvió ya.

---

## Gap 26: `real-user-scenarios.test.ts` Completamente Roto

SPEC: SPEC-020
Gap: E2E test suite tiene 6 TODO items indicando rutas incorrectas y assertions inválidas
Related Task: T-051 (test failures) — delegado a SPEC-023
Auditoria: #3 (2026-03-16)
Delegated to other spec: SPEC-023

### Description

`apps/api/test/integration/real-user-scenarios.test.ts` tiene estos comentarios en TODO:

```
TODO: Fix test - assumes /metrics route exists at root level
TODO: Fix test - asserts x-request-id header present on all responses
TODO: Fix test - uses incorrect paths
TODO: Fix test - asserts x-request-id present on /health responses
```

Este archivo simula flujos end-to-end críticos (owner registration → trial → subscription) pero tiene assumptions incorrectas sobre la estructura de rutas y headers. Si estos tests están `.skip()`-eados para que no fallen CI, están dando una falsa sensación de cobertura E2E.

### Priority: HIGH

### Severity: HIGH — Tests E2E que no funcionan = sin validación de flujos críticos de negocio.

### Complexity: MEDIUM

relatedFiles:
- apps/api/test/integration/real-user-scenarios.test.ts

Recommendation: Debe arreglarse antes de launch. Candidato para SPEC-023 o task dedicado.

**Decisión**: ✅ Hacer (2026-03-16) - Corregir real-user-scenarios.test.ts: actualizar rutas a la estructura actual de la API, corregir assertions inválidos (headers, response shapes). Restaurar cobertura de flujos críticos de negocio.

---

## Gap 27: Admin Page Routes Sin Ningún Test de Integración

SPEC: SPEC-020
Gap: El admin tiene 40 tests pero CERO cubren las páginas de rutas reales (CRUD workflows)
Related Task: T-046 (test coverage) — scope limitado a notifications
Auditoria: #3 (2026-03-16)
Delegated to other spec: NO (no hay spec que cubra esto)

### Description

El admin tiene 40 test files que cubren: sidebar, header, layout, auth guards, pagination, hooks, contexts. Pero tiene **cero tests** para:

- Páginas de file-based routing (`src/routes/_authed/accommodations/index.tsx`, `events/$id.tsx`, etc.)
- Flujos de CRUD: crear entidad → validar → guardar → ver error
- Integración con `/api/v1/admin/*` endpoints
- TanStack Table: sort, filter, pagination con datos reales
- Dialog de creación/edición de entidades

Esto significa que cualquier developer puede romper el flujo de gestión de hospedajes, eventos, o usuarios sin que ningún test lo detecte.

### Options

1. **SPEC nueva para admin test coverage**: Scope completo de tests para admin pages.
2. **Smoke tests mínimos**: Al menos 1 test por sección crítica (accommodations, users, billing).
3. **Aceptar para v1**: El admin es una herramienta interna, menor riesgo que el web público.

### Priority: HIGH (admin es herramienta de gestión crítica)

### Severity: HIGH

### Complexity: HIGH (requiere setup de mocks para TanStack Router + TanStack Query)

relatedFiles:
- apps/admin/src/routes/_authed/ (todas las páginas, sin tests)
- apps/admin/test/ (40 tests, ninguno de páginas)

Recommendation: Nueva SPEC formal. Candidato para post-launch pero pre-producción-real.

**Decisión**: ✅ Hacer (2026-03-16) - Implementar tests de integración para admin pages: workflows CRUD, integración con endpoints /api/v1/admin/*, TanStack Table y dialogs.

---

## Gap 28: 5 Packages Sin Ningún Test

SPEC: SPEC-020
Gap: Packages críticos con cero tests: config, seed, tailwind-config, typescript-config, ai-image-generation
Related Task: T-046 — scope solo fue notifications
Auditoria: #3 (2026-03-16)
Delegated to other spec: NO

### Description

| Package | Tests | Criticidad | Riesgo |
|---|---|---|---|
| `packages/config` | 0 | ALTA | Env validation sin tests = errores silenciosos en startup |
| `packages/seed` | 0 | MEDIA | DB seeding sin tests = datos incorrectos en staging/prod |
| `packages/tailwind-config` | 0 | BAJA | Design tokens — estable |
| `packages/typescript-config` | 0 | BAJA | Compiler config — estable |
| `packages/ai-image-generation` | 0 | MEDIA | Generación de imágenes sin validación |

`packages/config` es especialmente crítico: es la fuente de verdad para todas las env vars. Si hay un bug en la validación, toda la app falla al startup sin un mensaje claro.

### Priority: MEDIUM

### Severity: MEDIUM para config; LOW para el resto

### Complexity: LOW-MEDIUM

relatedFiles:
- packages/config/ (sin tests)
- packages/seed/ (sin tests)

Recommendation: Al menos tests para `packages/config`. Puede ser task standalone.

**Decisión**: ✅ Hacer (2026-03-16) - Agregar tests a los 5 packages. Prioridad: packages/config primero (env validation crítica), luego packages/ai-image-generation. packages/seed, tailwind-config y typescript-config de menor prioridad.

---

## Gap 29: Packages Críticos con Cobertura Peligrosamente Baja

SPEC: SPEC-020
Gap: auth-ui (1 test), icons (2 tests), billing (9 tests smoke-only)
Related Task: T-046 — scope fue notifications
Auditoria: #3 (2026-03-16)
Delegated to other spec: NO

### Description

| Package | Tests | Archivos de prod | Problema |
|---|---|---|---|
| `packages/auth-ui` | 1 | ~20 componentes | Auth UI usada en 2 apps con 1 solo test |
| `packages/icons` | 2 | 396+ iconos exportados | 2 tests para toda la librería de iconos |
| `packages/billing` | 9 | Lógica de pagos compleja | Los smoke tests de billing están `.skip()`-eados |
| `packages/logger` | 1 | Sistema de logging crítico | 1 test para toda la infraestructura de logging |
| `packages/email` | 1 | Transport de email | 1 test para sistema de emails |

`packages/auth-ui` es el caso más crítico: es la UI de autenticación compartida entre admin y web, con flujos de login, registro, y recuperación de contraseña. Tiene 1 test.

### Priority: HIGH para auth-ui; MEDIUM para el resto

### Severity: HIGH (auth-ui), MEDIUM (billing, logger), LOW (icons, email)

### Complexity: MEDIUM-HIGH

relatedFiles:
- packages/auth-ui/test/ (1 test file)
- packages/billing/test/ (9 tests, smoke skipped)

Recommendation: SPEC dedicada para package test coverage. Post-launch pero importante.

**Decisión**: ✅ Hacer (2026-03-16) - Incrementar cobertura de tests en auth-ui, billing, logger y email. Prioridad: auth-ui y billing primero por ser críticos para producción.

---

## Gap 30: Anti-patrón `as unknown as X` Sistémico en 70+ Ubicaciones

SPEC: SPEC-020
Gap: 70+ instancias de `as unknown as SomeType` usado como workaround de tipo — no documentadas ni auditadas
Related Task: T-043 (as any elimination) — solo auditó `as any`, no el doble cast
Auditoria: #3 (2026-03-16)
Delegated to other spec: NO

### Description

El patrón `as unknown as SomeType` (doble cast) es funcionalmente equivalente a `as any` en términos de type safety: bypasea el sistema de tipos completamente. SPEC-020 T-043 auditó y documentó las excepciones de `as any` pero no cubrió este patrón alternativo.

**Distribución:**

| Área | Instancias | Ejemplo |
|---|---|---|
| Admin feature configs | ~15 | `listItemSchema as unknown as z.ZodSchema<T>` |
| DB models (Drizzle) | ~20 | Casteos de respuestas de queries |
| Service-core base | ~8 | `Partial<TEntity>` workarounds |
| Web components | 3 | `items as unknown as DestinationItem[]` |
| API middlewares | 4 | `c as unknown as Record<string, unknown>` |
| API routes | 6 | `routes as unknown as AppOpenAPI` |
| API services | 4 | `updatedSettings as unknown as Record<string, unknown>` |

**Casos más preocupantes:**
- `apps/web/src/components/destination/DestinationFilters.client.tsx:108` — `items as unknown as DestinationItem[]` oculta potencial incompatibilidad de tipos en componente público
- `apps/web/src/components/account/UserFavoritesList.client.tsx:96` — `bookmarks as unknown as Bookmark[]`
- `apps/api/src/services/billing-settings.service.ts` (4 instancias) — casting de datos de billing

### Options

1. **Auditoría y fix caso por caso**: Entender por qué se necesita el cast en cada caso y arreglar el tipo real.
2. **Documentar como excepciones permitidas**: Similar a lo hecho con `as any`.
3. **Agregar regla de Biome**: Detectar el patrón `as unknown as` en CI (no hay regla nativa, requiere plugin o custom rule).

### Priority: HIGH

### Severity: HIGH — Oculta bugs de tipo reales. Cada instancia es potencialmente un runtime error esperando pasar.

### Complexity: HIGH (70+ instancias requieren análisis individual)

relatedFiles:
- apps/web/src/components/destination/DestinationFilters.client.tsx:108
- apps/web/src/components/account/UserFavoritesList.client.tsx:96
- apps/web/src/components/account/UserReviewsList.client.tsx:174-175
- apps/api/src/services/billing-settings.service.ts (4 instancias)
- apps/api/src/utils/role-permissions-cache.ts:84
- packages/service-core/src/base/base.crud.write.ts (4 instancias)
- packages/db/src/models/*.ts (~20 instancias)

Recommendation: Nueva SPEC de type safety. HIGH priority pero no bloquea deploy.

**Decisión**: ✅ Hacer (2026-03-16) - Auditar y resolver las 70+ instancias de "as unknown as X". Priorizar middlewares y service-core por ser código crítico de runtime.

---

## Gap 31: `as any` Fuera de los 5 Archivos Permitidos por SPEC-020

SPEC: SPEC-020
Gap: 18+ instancias de `as any` en archivos NO listados como excepciones documentadas
Related Task: T-043 — solo documentó excepciones en route-factory, openapi-schema, env, swagger, scalar
Auditoria: #3 (2026-03-16)
Delegated to other spec: NO

### Description

SPEC-020 documentó 12 excepciones justificadas de `as any` en 5 archivos. Se encontraron 18+ adicionales **fuera** de esos archivos:

**Apps/Admin (violaciones no documentadas):**

| Archivo | Línea | Patrón |
|---|---|---|
| `apps/admin/src/lib/api/client.ts` | 23, 26 | `globalThis as any` (2 instancias con biome-ignore) |
| `apps/admin/src/components/entity-list/EntityListPage.tsx` | 416 | `basePath as any` |
| `apps/admin/src/components/entity-list/examples/VirtualizedEntityListExample.tsx` | 116,118,133,135 | `path as any`, `params as any` (4 instancias) |

**Apps/Web (violaciones altas):**
Múltiples en componentes de cuenta y destinos (combinadas con `as unknown as` — ver Gap 30).

**Apps/API:**
| Archivo | Línea | Patrón |
|---|---|---|
| `apps/api/src/routes/billing/index.ts` | 123 | `routes as unknown as AppOpenAPI` |
| `apps/api/src/middlewares/validation.ts` | 35 | `c as unknown as Record<string, unknown>` |
| `apps/api/src/utils/logger.ts` | 81 | `apiLogger as unknown as ApiLogger` |

### Priority: MEDIUM

### Severity: MEDIUM — Algunos son en ejemplos/dev routes (lower risk), otros en middleware crítico (higher risk).

### Complexity: MEDIUM

relatedFiles:
- apps/admin/src/lib/api/client.ts
- apps/api/src/middlewares/validation.ts
- apps/api/src/utils/logger.ts

Recommendation: Puede resolverse inline sin SPEC nueva. Task de limpieza.

**Decisión**: ✅ Hacer (2026-03-16) - Auditar las 18+ instancias de "as any" fuera de archivos permitidos. Reemplazar con tipos correctos o mover a archivos de excepción con justificación documentada. Priorizar middlewares de API.

---

## Gap 32: `AdminEnvSchema` No Valida `HOSPEDA_API_URL` Usada en Runtime

SPEC: SPEC-020
Gap: Variable de entorno crítica usada en server functions de admin sin declarar en schema de validación
Related Task: T-010 (admin .env.example) / T-013 (env validation)
Auditoria: #3 (2026-03-16)
Delegated to other spec: NO

### Description

`apps/admin/src/lib/auth-session.ts:59` usa `process.env.HOSPEDA_API_URL` en server functions (TanStack Start). Sin embargo, `apps/admin/src/env.ts` (el `AdminEnvSchema`) NO declara `HOSPEDA_API_URL`. Esto significa:

1. Si la variable no está configurada, no hay error de startup — el problema aparece en runtime cuando una server function trata de hacer un request.
2. El env checker (`pnpm env:check`) no validará esta variable para el admin app.
3. La variable NO está en `apps/admin/.env.example`.

**Impacto**: Las server functions del admin (como autenticación via Better Auth) fallan silenciosamente si `HOSPEDA_API_URL` no está configurada.

### Options

1. **Agregar a AdminEnvSchema y .env.example**: Declarar la variable con validación de URL.
2. **Verificar si es realmente necesaria**: Puede que admin deba usar `VITE_API_URL` (ya documentada) en lugar de `HOSPEDA_API_URL`.

### Priority: HIGH

### Severity: HIGH — Sin esta variable, las server functions de auth del admin fallan en producción.

### Complexity: LOW

relatedFiles:
- apps/admin/src/env.ts (falta HOSPEDA_API_URL)
- apps/admin/src/lib/auth-session.ts:59 (usa process.env.HOSPEDA_API_URL)
- apps/admin/.env.example (falta entrada)

Recommendation: Fix directo, no requiere SPEC. Alta prioridad antes de deploy.

**Decisión**: ✅ Implementado (2026-03-16) - HOSPEDA_API_URL agregado a AdminEnvSchema y .env.example.

---

## Gap 33: Bugs de Prefijo de Env Vars (Variables Siempre `undefined` en Producción)

SPEC: SPEC-020
Gap: 2 archivos usan prefijos incorrectos para env vars — siempre undefined en runtime
Related Task: T-009 a T-013 (env documentation)
Auditoria: #3 (2026-03-16)
Delegated to other spec: NO

### Description

Se encontraron 3 bugs concretos donde env vars usan el prefijo equivocado:

| Archivo | Línea | Variable usada | Problema | Correcto |
|---|---|---|---|---|
| `apps/admin/src/routes/auth/forbidden.tsx:55` | 55 | `import.meta.env.PUBLIC_SITE_URL` | Admin usa prefijo `VITE_*`, no `PUBLIC_*` | `import.meta.env.VITE_SITE_URL` o no existe |
| `apps/web/src/lib/logger.ts:52` | 52 | `import.meta.env.VITE_ENABLE_LOGGING` | Web (Astro) usa prefijo `PUBLIC_*`, no `VITE_*` | `import.meta.env.PUBLIC_ENABLE_LOGGING` |
| `apps/web/astro.config.mjs:158` | 158 | `process.env.VITE_API_URL` como fallback | Vite vars nunca se inyectan en `process.env` | Dead code — siempre undefined |

**Impacto de cada uno:**
- `forbidden.tsx`: La página de "forbidden" en admin no puede construir correctamente el link al sitio público.
- `web/logger.ts`: El flag de logging en web nunca puede habilitarse via env var.
- `astro.config.mjs`: El fallback es dead code, nunca se usa.

### Options

1. **Fix inmediato**: Corregir los 3 prefijos incorrectos. Son cambios de 1 línea cada uno.

### Priority: HIGH (para forbidden.tsx y logger.ts), LOW (para astro dead code)

### Severity: HIGH — Variables silenciosamente undefined causan comportamiento incorrecto sin error visible.

### Complexity: LOW (cambios triviales)

relatedFiles:
- apps/admin/src/routes/auth/forbidden.tsx:55
- apps/web/src/lib/logger.ts:52
- apps/web/astro.config.mjs:158

Recommendation: Fix directo inmediato. No requiere SPEC.

**Decisión**: ✅ Hacer (2026-03-16) - Corregir 3 prefijos de env vars: PUBLIC_SITE_URL→VITE_SITE_URL en admin/forbidden.tsx, VITE_ENABLE_LOGGING→PUBLIC_ENABLE_LOGGING en web/logger.ts, remover dead code process.env.VITE_API_URL en astro.config.mjs.

---

## Gap 34: TurboRepo Remote Cache No Configurado en CI

SPEC: SPEC-020
Gap: CI no usa TURBO_TOKEN — cada run reconstruye desde cero
Related Task: T-024 (TurboRepo cache configuration)
Auditoria: #3 (2026-03-16)
Delegated to other spec: NO

### Description

`turbo.json` tiene pipeline bien configurado con caching local. Sin embargo, `.github/workflows/ci.yml` no exporta `TURBO_TOKEN` ni `TURBO_TEAM`. Esto significa que cada CI run reconstruye todos los packages desde cero, ignorando el remote cache de Vercel/TurboRepo Cloud.

Para habilitar remote caching solo se necesita:
```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: your-vercel-team-slug
```

### Priority: LOW

### Severity: LOW — Funcionalidad correcta, solo performance de CI subóptima.

### Complexity: LOW

relatedFiles:
- .github/workflows/ci.yml
- turbo.json

Recommendation: Fix simple. No requiere SPEC. Puede agregarse cuando se configure la cuenta de Vercel.

---

## Gap 35: 12 Archivos Nuevos Superan 500 Líneas (Actualización de Gap #3)

SPEC: SPEC-020
Gap: Gap #3 listaba 19 archivos. Esta auditoría encontró 12 adicionales no documentados.
Related Task: T-031 a T-039 (decomposición)
Auditoria: #3 (2026-03-16)
Delegated to other spec: NO

### Description

Gap #3 había listado 19 archivos. Esta auditoría encontró los siguientes **12 archivos adicionales** que exceden 500 líneas y NO estaban en Gap #3:

**apps/api/src/ (7 nuevos):**

| Líneas | Archivo |
|---|---|
| 585 | middlewares/auth-lockout.ts |
| 596 | middlewares/rate-limit.ts |
| 528 | services/addon.checkout.ts |
| 505 | utils/response-helpers.ts |
| 525 | cron/jobs/webhook-retry.job.ts |
| 509 | lib/auth.ts |
| 510 | routes/feedback/public/submit.ts |

**apps/admin/src/ (3 nuevos):**

| Líneas | Archivo |
|---|---|
| 1095 | routes/dev/icon-comparison.tsx (dev route) |
| 621 | features/billing-plans/components/PlanDialog.tsx |
| 598 | features/billing-addons/components/AddonDialog.tsx |
| 588 | components/entity-form/fields/EntitySelectField.tsx |
| 566 | routes/_authed/billing/settings.tsx |
| 531 | components/entity-list/columns.factory.ts |
| 527 | routes/_authed/billing/webhook-events.tsx |
| 511 | components/entity-form/EntityViewSection.tsx |
| 503 | components/entity-form/EntityFormSection.tsx |

**packages/ (2 nuevos):**

| Líneas | Archivo |
|---|---|
| 839 | packages/db/src/billing/migrate-addon-purchases.ts |
| 652 | packages/db/src/models/destination/destination.model.ts |
| 589 | packages/db/src/base/base.model.ts |
| 527 | packages/logger/src/formatter.ts |

> Nota: El total actualizado es ~31 archivos (19 de Gap #3 + 12 nuevos). El archivo `icon-comparison.tsx` (1095 líneas) es una dev/demo route, posible candidato a eliminar en producción.

### Priority: LOW-MEDIUM (mismo que Gap #3)

### Severity: LOW-MEDIUM — Impacto en mantenibilidad, no en runtime.

### Complexity: HIGH (decomposición de 31 archivos)

relatedFiles: Ver Gap #3 + lista adicional arriba.

Recommendation: Crear SPEC de decomposición en etapas. Los 7 archivos de API son más urgentes por ser business logic crítico (addon.checkout.ts, auth-lockout.ts).

---

## Updated Summary Table (Auditoría #3 — 2026-03-16)

| # | Gap | Auditoria | Priority | Severity | Complexity | Bloquea Deploy? |
|---|-----|-----------|----------|----------|------------|-----------------|
| 1 | SECRETS.md missing 15+ secrets | #1 | HIGH | HIGH | LOW | Sí |
| 2 | apps/web/.env.example missing | #1 | MEDIUM | MEDIUM | LOW | No |
| 3 | 19→31 files over 500-line limit | #1+#3 | LOW-MEDIUM | LOW | HIGH | No |
| 4 | 63 TODOs without issue references | #1 | LOW | LOW | LOW | No |
| 5 | Admin .env.example missing Sentry DSN | #1 | LOW | LOW | LOW | No |
| 6 | Sentry source maps upload disabled | #1 | MEDIUM | MEDIUM | LOW | No |
| 7 | Vercel CD secrets undocumented | #1 | HIGH | HIGH | LOW | Sí |
| 8 | route-factory.ts 508 lines (8 over) | #1 | LOW | LOW | LOW | No |
| 9 | No manual deploy scripts | #1 | LOW | LOW | LOW | No |
| 10 | turbo.json globalEnv incomplete | #1 | LOW | LOW | LOW | No |
| 11 | Remote image patterns minimal | #1 | LOW | LOW | LOW | No |
| 12 | `.then()` in error handlers | #2 | LOW | LOW | LOW | No |
| 13 | notification.service.ts 554 lines | #2 | LOW | LOW | MEDIUM | No |
| 14 | notifications missing coverage provider | #2 | MEDIUM | MEDIUM | LOW | No |
| 15 | FavoriteButton .then() without .catch() | #2 | LOW | LOW | LOW | No |
| 16 | CI build without Sentry DSN | #2 | LOW-MEDIUM | LOW | LOW | No |
| 17 | notifications missing vitest.config.ts | #2 | MEDIUM | MEDIUM | LOW | No |
| 18 | billing missing @vitest/coverage-v8 | #2 | LOW | LOW | LOW | No |
| 19 | admin/server.ts uses export default | #2 | LOW | LOW | — | No |
| 20 | logger/index.ts uses export default | #2 | LOW | LOW | MEDIUM | No |
| 21 | Test mock files over 500 lines | #2 | INFO | INFO | — | No |
| 22 | DestinationFilters silent .catch() | #2 | LOW | LOW | LOW | No |
| 23 | HOSPEDA_BETTER_AUTH_URL undocumented | #2 | LOW | LOW | LOW | No |
| **24** | **Coverage thresholds missing from API/packages** | **#3** | **MEDIUM** | **MEDIUM** | **LOW** | **No** |
| **25** | **33 disabled tests (.skip/.only)** | **#3** | **HIGH** | **HIGH** | **MEDIUM** | **No** |
| **26** | **real-user-scenarios.test.ts broken** | **#3** | **HIGH** | **HIGH** | **MEDIUM** | **No** |
| **27** | **Admin page routes: zero integration tests** | **#3** | **HIGH** | **HIGH** | **HIGH** | **No** |
| **28** | **5 packages with zero tests** | **#3** | **MEDIUM** | **MEDIUM** | **MEDIUM** | **No** |
| **29** | **auth-ui (1 test), billing smoke skipped** | **#3** | **HIGH** | **HIGH** | **HIGH** | **No** |
| **30** | **`as unknown as X` systemic (70+ instances)** | **#3** | **HIGH** | **HIGH** | **HIGH** | **No** |
| **31** | **`as any` outside permitted files (18+)** | **#3** | **MEDIUM** | **MEDIUM** | **MEDIUM** | **No** |
| **32** | **AdminEnvSchema missing HOSPEDA_API_URL** | **#3** | **HIGH** | **HIGH** | **LOW** | **Sí (auth falla)** |
| **33** | **Env prefix bugs (3 vars siempre undefined)** | **#3** | **HIGH** | **HIGH** | **LOW** | **Sí (comportamiento incorrecto)** |
| **34** | **TurboRepo remote cache no configurado** | **#3** | **LOW** | **LOW** | **LOW** | **No** |
| **35** | **12 archivos adicionales >500 líneas** | **#3** | **LOW-MEDIUM** | **LOW** | **HIGH** | **No** |

---

### Pre-Deploy Blockers (ACTUALIZADO — Gaps que deben resolverse antes del primer deploy)

| Gap | Acción requerida |
|---|---|
| **Gap 1 + Gap 7** | Completar SECRETS.md con todos los GitHub secrets requeridos |
| **Gap 32** | Agregar `HOSPEDA_API_URL` a AdminEnvSchema y .env.example del admin |
| **Gap 33** | Corregir los 3 prefijos incorrectos de env vars (cambios triviales) |
| **Gap 25** (`.only()`) | Eliminar cualquier `.only()` que filtre el test suite en CI |

### Recomendado Pre-Deploy (should fix)

| Gap | Acción requerida |
|---|---|
| Gap 26 | Arreglar real-user-scenarios.test.ts para que los E2E tests sean válidos |
| Gap 6 | Habilitar Sentry source maps upload |
| Gap 2 | Crear apps/web/.env.example |

### Post-Deploy / SPEC formal sugerida

| Gaps | SPEC sugerida |
|---|---|
| 27, 29 | SPEC nueva: Admin integration tests + package critical coverage |
| 30, 31 | SPEC nueva: Type safety audit (as unknown as / as any) |
| 3, 35, 13 | SPEC nueva: File decomposition phase 2 |
| 24, 28 | Puede agregarse a SPEC-023 o task standalone |

---

## Gap 4 Correction (Re-Audit 2026-03-04)

Gap 4 states "All 63 [TODOs] are in `apps/admin/src/`". The re-audit found TODOs also exist in `packages/` directories (service-core, billing, notifications). The total count should be re-verified across the entire monorepo, not just admin.

### Re-Audit Note (2026-03-04) - Third Pass

Third exhaustive re-audit confirmed all 23 gaps. **No new gaps found.** Deployment configs (Vercel, Docker, CI/CD), environment variables, secrets documentation, health checks, and monitoring setup were all re-verified against spec requirements.

---

## FOURTH AUDIT PASS (2026-03-13)

**Methodology**: 4 specialized agents ran in parallel covering: CI/CD & deployment, testing infrastructure, code quality, and Sentry/env configuration. Each agent performed exhaustive file reads with exact line-number verification.

**Scope expanded** vs. prior passes: full vitest config per-package, per-file line counts verified, `.then()` occurrences exact location, per-package coverage provider presence, CD workflow steps in depth.

### Gap 2 — RESOLVED

`apps/web/.env.example` **EXISTS** (2.6 KB, dated 2025-03-07). This gap was incorrectly left open in prior audit passes. The file was created between the 3rd audit (2026-03-04) and this pass. **Gap 2 is now CLOSED.**

### Gap 3 — Updated Line Counts (2026-03-13)

Verified exact line counts for all files referenced in Gap 3:

| File | Lines (4th pass) | Change vs. 3rd pass |
|---|---|---|
| `apps/api/src/services/trial.service.ts` | **957** | +125 (grew!) |
| `apps/api/src/middlewares/limit-enforcement.ts` | **740** | similar |
| `apps/api/src/services/addon-entitlement.service.ts` | **653** | verified |
| `apps/api/src/middlewares/entitlement.ts` | **619** | verified |
| `apps/api/src/utils/route-factory.ts` | **519** | verified (8 lines over) |
| `packages/service-core/.../accommodation.service.ts` | **956** | verified |
| `packages/notifications/.../notification.service.ts` | **626** | +72 (grew!) |

**`trial.service.ts` creció de 832 a 957 líneas** (+125 líneas) desde la 3ra auditoría. Alta prioridad de descomposición.

### Gap 12 — Exact Locations Verified (2026-03-13)

`.then()` chains confirmed at exact locations:
- `apps/api/src/index.ts:154` — Dynamic Sentry import in `uncaughtException` handler
- `apps/api/src/index.ts:176` — Dynamic Sentry import in `unhandledRejection` handler
- `apps/api/src/lib/auth.ts:220` — Result validation chain
- `apps/api/src/lib/auth.ts:241` — Result validation chain

All 4 violate the `async/await` preference rule. None are critical-risk but are inconsistent.

---

## Gap 24: Staging Branch Does Not Exist

**Audit**: 4th pass (2026-03-13)
SPEC: SPEC-020
Gap: `cd-staging.yml` triggers on push to branch `staging` but that branch does not exist in the repo
Related Task: T-018/T-019 (Create CD workflows)
Delegated to other spec: SPEC-025 (Staging Environment Setup) — but SPEC-025 is still `draft`

### Description

`.github/workflows/cd-staging.yml` is configured with:
```yaml
on:
  push:
    branches: [staging]
```

The `staging` branch does not exist in the repository (confirmed via git status). This means:
- The CD staging workflow has **never been triggered and never will** until the branch is created
- SPEC-025 (Staging Environment Setup) is supposed to create this branch and the corresponding Vercel projects, but it is `draft` status with 0 tasks started

### Options

1. **Create the `staging` branch** as part of SPEC-025 activation
2. **Add to SPEC-025 scope**: Explicitly make branch creation a task in SPEC-025
3. **Accept temporarily**: Leave as-is until SPEC-025 is prioritized

### Priority: MEDIUM

### Severity: MEDIUM — Staging deploy pipeline is completely inactive

### Complexity: LOW — Creating branch is trivial; the real work is SPEC-025 Vercel project setup

### Recommendation: Add explicit "create staging branch" task to SPEC-025. Do not fix directly here — belongs to that spec

### Related Files

- `.github/workflows/cd-staging.yml`
- `.claude/specs/SPEC-025-staging-environment-setup/`

**Decisión**: ➡️ Delegado a SPEC-025 (2026-03-16) - La creación de la rama staging y la infraestructura completa del ambiente corresponden a SPEC-025 (Staging Environment Setup). Verificar que SPEC-025 incluya este gap.

---

## Gap 25: CD Workflows Have No Post-Deploy Verification Step

**Audit**: 4th pass (2026-03-13)
SPEC: SPEC-020
Gap: `cd-production.yml` deploys to Vercel but has no post-deploy health check step
Related Task: T-018/T-019 (Create CD workflows) — SPEC-020 Section 3 (Operator Experience): "CD workflows must fail loudly"
Delegated to other spec: NO

### Description

`cd-production.yml` (73 lines) deploys API, web, and admin to Vercel but has **no post-deploy verification**. After the `vercel-action` step completes, the workflow considers the deploy successful without confirming:
- The deployed API responds to `GET /health` with HTTP 200
- The deployed web app loads without errors
- The deployed admin app returns a valid response

If Vercel deploys successfully (build succeeds, upload completes) but the app crashes on startup (e.g., missing env var at runtime, DB connection failure), the CD workflow shows green while production is actually broken.

### Options

1. **Add health-check steps after deploy**: After each `deploy-*` job, add a `verify-*` job that `curl`s the health endpoint and fails if not 200
2. **Use Vercel deployment URL**: The `vercel-action` outputs the deployment URL; use it for smoke tests
3. **Accept as-is**: Vercel shows deployment status in its own dashboard; CD failure would be caught in monitoring

### Priority: MEDIUM

### Severity: MEDIUM — Silent production failures possible if app starts but crashes immediately

### Complexity: LOW — Adding `curl` health check step is ~5 lines of YAML

### Recommendation: Implement Option 1. Add a `verify-production` job to `cd-production.yml` that calls `GET /health/live` after deploy. Fix directly without a new spec — small change.

### Related Files

- `.github/workflows/cd-production.yml`
- `apps/api/src/routes/health/live.ts`

**Decisión**: ✅ Hacer (2026-03-16) - Agregar step de health check (curl con retry) en cd-production.yml después del deploy a Vercel.

---

## Gap 26: Coverage Thresholds Not Enforced at Package Level (Only Global CI Check)

**Audit**: 4th pass (2026-03-13)
SPEC: SPEC-020 (US-15: notifications >= 80%, US-13: 90% overall)
Gap: Only `apps/web/vitest.config.ts` defines explicit per-package thresholds; 12 other configs have none
Related Task: QUAL-04 (Notifications test coverage >= 80%)
Delegated to other spec: NO

### Description

The CI workflow (`ci.yml` lines 92-164) performs a **global coverage check** by parsing `coverage-summary.json` files and computing per-package percentages. However, **only `apps/web/vitest.config.ts`** defines Vitest-native coverage thresholds (80% lines/functions/statements, 75% branches).

The other 12 packages/apps with vitest configs (`apps/api`, `apps/admin`, `packages/billing`, `packages/db`, `packages/schemas`, `packages/service-core`, `packages/auth-ui`, `packages/i18n`, `packages/icons`, `packages/config`, `packages/feedback`, `packages/notifications`) have NO `coverage.thresholds` defined.

This means:
- Vitest itself never fails a test run for low coverage — only the CI shell script does
- Developers running `pnpm test:coverage` locally get no threshold enforcement
- The CI threshold enforcement is fragile (depends on the shell script finding coverage-summary.json)

### Options

1. **Add `coverage.thresholds` to all vitest.config.ts files**: Fail at Vitest level, not CI script level
2. **Accept global CI enforcement**: The CI script works, this is just defense-in-depth
3. **Add thresholds to critical packages only**: notifications, billing, service-core

### Priority: LOW-MEDIUM

### Severity: LOW — Coverage enforcement exists at CI level; this is an improvement for local dev feedback

### Complexity: LOW — Adding 4 lines to each vitest.config.ts

### Recommendation: Option 3 for now. Add thresholds to packages/notifications (≥80%), packages/billing (≥80%), packages/service-core (≥90%). Defer rest to a post-launch task.

### Related Files

- All `*/vitest.config.ts` files
- `.github/workflows/ci.yml` (lines 92-164)

**Decisión**: ✅ Hacer (2026-03-16) - Agregar coverage thresholds (lines/functions/branches/statements >= 90%) a todos los vitest.config.ts del monorepo para enforcement local, no solo en CI.

---

## Gap 27: 4 Packages Missing `vitest.config.ts` (Have Tests But No Config)

**Audit**: 4th pass (2026-03-13)
SPEC: SPEC-020 (US-13: test suite configuration)
Gap: `packages/email`, `packages/logger`, `packages/utils` have test files but no vitest.config.ts; `packages/notifications` already noted as Gap 17
Related Task: Gap 17 covers notifications; this is for the other 3
Delegated to other spec: NO

### Description

Three packages have test files that run via the root vitest config but have no per-package `vitest.config.ts`:

| Package | Test Files | @vitest/coverage-v8 |
|---|---|---|
| `packages/email` | 1 test file | ❌ Missing |
| `packages/logger` | 1 test file | ❌ Missing |
| `packages/utils` | 6 test files | ❌ Missing |

Without a `vitest.config.ts`, these packages run with root defaults. Issues:
- Coverage collection may be undefined (no `include` patterns)
- `@vitest/coverage-v8` missing means `pnpm test:coverage` in these packages fails
- No explicit `environment` setting (may default to wrong env — logger/utils should be `node`)

### Options

1. **Create vitest.config.ts for each**: Copy pattern from nearby packages like `packages/i18n`
2. **Accept root coverage**: If root config discovers these files, they're covered globally
3. **Low priority**: These packages have minimal tests (1-6 files); coverage gap is small

### Priority: LOW

### Severity: LOW — Tests run but may not generate correct coverage

### Complexity: LOW — Each config is ~20 lines

### Recommendation: Create configs for all 3. Copy from `packages/i18n/vitest.config.ts` as template. Also add `@vitest/coverage-v8` to their devDependencies.

### Related Files

- `packages/email/` (missing vitest.config.ts)
- `packages/logger/` (missing vitest.config.ts)
- `packages/utils/` (missing vitest.config.ts)

---

## Gap 28: Vitest Version Inconsistency Across Monorepo

**Audit**: 4th pass (2026-03-13)
SPEC: SPEC-020 (US-13: all packages use same vitest major version)
Gap: `packages/db` and `packages/schemas` are on `^3.1.3`; all other packages/apps are on `^3.2.4`
Related Task: QUAL-01 (Align vitest versions) — marked completed but minor version inconsistency remains
Delegated to other spec: NO

### Description

SPEC-020 QUAL-01 aligned all packages to vitest 3.x (from mixed 2.x/3.x). However, a minor version inconsistency remains:

| Package | Vitest Version |
|---|---|
| `packages/db` | `^3.1.3` |
| `packages/schemas` | `^3.1.3` |
| All other packages/apps | `^3.2.4` |

This is a minor inconsistency but can cause subtle differences in test behavior if `3.2.x` introduced behavior changes. The SPEC-020 requirement was "same vitest major version" — technically both are `3.x` so the spec requirement is met. However, the spirit is alignment.

### Options

1. **Bump db and schemas to ^3.2.4**: Align all packages
2. **Accept**: All are 3.x, the spec is technically met

### Priority: LOW (INFO level)

### Severity: INFO — No practical impact

### Complexity: TRIVIAL — bump version strings

### Recommendation: Option 1 — trivial fix. Include in next dependency update cycle.

### Related Files

- `packages/db/package.json`
- `packages/schemas/package.json`

---

## Gap 29: `packages/config` vitest.config.ts Has No Coverage Provider

**Audit**: 4th pass (2026-03-13)
SPEC: SPEC-020 (test infrastructure)
Gap: The shared vitest config package itself has a minimal vitest.config.ts without coverage provider
Delegated to other spec: NO

### Description

`packages/config/vitest.config.ts` (14 lines) is the MINIMAL config in the monorepo. It has no coverage provider, no include patterns, no thresholds. This package exports shared vitest configuration used by other packages — but its own tests run without proper coverage setup.

More importantly: `packages/config/package.json` does NOT have `@vitest/coverage-v8` in devDependencies, so `pnpm test:coverage` in this package will fail.

### Priority: LOW

### Severity: LOW — packages/config has ~10 test files, tests run OK, only coverage generation is affected

### Related Files

- `packages/config/vitest.config.ts`
- `packages/config/package.json`

---

## Gap 30: `packages/service-core` Uses `globals: false` — Inconsistent with Rest of Project

**Audit**: 4th pass (2026-03-13)
SPEC: SPEC-020 (code consistency)
Gap: packages/service-core/vitest.config.ts has `globals: false` while all other packages use `globals: true` (default)
Delegated to other spec: NO

### Description

`packages/service-core/vitest.config.ts` explicitly sets `globals: false`. All other packages/apps use vitest's default (`globals: true`) or rely on the shared config. This means:

- Tests in `packages/service-core` must import `describe`, `it`, `expect` etc. explicitly from `vitest`
- Tests in other packages can use them as globals

This is a deliberate choice (avoids polluting the global namespace) but creates an inconsistency — developers moving between packages will have different experiences.

### Priority: INFO

### Severity: INFO — No runtime impact, just a style inconsistency

### Recommendation: Document the intentional difference in the vitest.config.ts with a comment

### Related Files

- `packages/service-core/vitest.config.ts`

---

## Updated Summary Table (All Passes)

| # | Gap | Priority | Pass Found | Blocks Deploy? | Status |
|---|-----|----------|------------|----------------|--------|
| 1 | SECRETS.md missing 15+ secrets | HIGH | 1st | Yes | OPEN |
| 2 | apps/web/.env.example missing | MEDIUM | 1st | No | **RESOLVED** (file created 2025-03-07) |
| 3 | 19+ files over 500-line limit (trial.service.ts grew to 957L) | LOW-MEDIUM | 1st | No | OPEN |
| 4 | 63 TODOs without issue references | LOW | 1st | No | OPEN |
| 5 | Admin .env.example missing Sentry DSN | LOW | 1st | No | OPEN |
| 6 | Sentry source maps upload disabled | MEDIUM | 1st | No | OPEN |
| 7 | Vercel CD secrets undocumented | HIGH | 1st | Yes | OPEN |
| 8 | route-factory.ts 519 lines (19 over) | LOW | 1st | No | OPEN |
| 9 | No manual deploy scripts | LOW | 1st | No | OPEN |
| 10 | turbo.json globalEnv incomplete | LOW | 1st | No | OPEN |
| 11 | Remote image patterns minimal | LOW | 1st | No | OPEN |
| 12 | `.then()` in error handlers (4 exact: index.ts:154,176; auth.ts:220,241) | LOW | 2nd | No | OPEN |
| 13 | notification.service.ts 626 lines (grew +72L) | LOW | 2nd | No | OPEN |
| 14 | notifications missing @vitest/coverage-v8 | MEDIUM | 2nd | No | OPEN |
| 15 | FavoriteButton .then() without .catch() | LOW | 2nd | No | OPEN |
| 16 | CI build without Sentry DSN | LOW-MEDIUM | 2nd | No | OPEN |
| 17 | notifications missing vitest.config.ts | MEDIUM | 2nd | No | OPEN |
| 18 | billing missing @vitest/coverage-v8 | LOW | 2nd | No | OPEN |
| 19 | admin/server.ts uses export default (framework exception) | LOW | 2nd | No | OPEN (doc as exception) |
| 20 | logger/index.ts uses export default | LOW | 2nd | No | OPEN |
| 21 | Test mock files over 500 lines | INFO | 2nd | No | OPEN |
| 22 | DestinationFilters .catch() silent error | LOW | 2nd | No | OPEN |
| 23 | HOSPEDA_BETTER_AUTH_URL undocumented | LOW | 2nd | No | OPEN |
| **24** | **Staging branch does not exist (cd-staging.yml dead)** | **MEDIUM** | **4th** | **No (staging)** | **OPEN** |
| **25** | **No post-deploy health check in CD workflows** | **MEDIUM** | **4th** | **No** | **OPEN** |
| **26** | **Coverage thresholds not enforced at package level** | **LOW-MEDIUM** | **4th** | **No** | **OPEN** |
| **27** | **email/logger/utils missing vitest.config.ts** | **LOW** | **4th** | **No** | **OPEN** |
| **28** | **Vitest version inconsistency (db/schemas on 3.1.3)** | **INFO** | **4th** | **No** | **OPEN** |
| **29** | **packages/config vitest.config.ts has no coverage provider** | **LOW** | **4th** | **No** | **OPEN** |
| **30** | **packages/service-core globals: false inconsistency** | **INFO** | **4th** | **No** | **OPEN** |

### Pre-Deploy Blockers (must fix before first production deployment)

- **Gap 1 + Gap 7** (CRITICAL): Update SECRETS.md with ALL required GitHub secrets
- **Gap 24** (MEDIUM): Create staging branch (or remove cd-staging.yml until SPEC-025 is done)

### Recommended Pre-Deploy (high value, low effort)

- **Gap 25**: Add post-deploy health check to `cd-production.yml` (~5 lines YAML)
- **Gap 6**: Enable Sentry source maps upload

### Post-Deploy (can fix after launch)

- **Gaps 3, 4, 5, 8, 9, 10, 11, 12, 13, 15, 16, 18-23, 26-30**: Code quality, consistency, and monitoring improvements

### Items Correctly Delegated

| Item | Delegated To | Status |
|---|---|---|
| Staging branch + Vercel projects | SPEC-025 | Draft |
| Credential rotation | SPEC-024 | Draft |
| Security testing gaps | SPEC-026 | Draft |
| Billing production issues | SPEC-021 | Draft |
| Frontend quality | SPEC-022 | Draft |

---

## FIFTH AUDIT PASS (2026-03-16)

**Methodology**: 5 specialized agents ran in parallel covering: (1) CI/CD deployment infrastructure, (2) code quality static analysis, (3) Sentry/monitoring/runtime reliability, (4) testing infrastructure and coverage, (5) API routes/services/configuration deep audit. Each agent performed exhaustive file reads with exact line-number verification.

**New gaps discovered in this pass**: 11 (Gaps 31–41)

**Gaps confirmed RESOLVED since 4th pass**:
- **Gap 2** (apps/web/.env.example missing): **CLOSED** — File confirmed present by Agent 1. Contains PUBLIC_*, HOSPEDA_* and Better Auth URL variables.
- **Gap 15** (FavoriteButton .then() without .catch()): **CLOSED** — Agent 3 confirmed FavoriteButton.client.tsx now has proper catch block with `webLogger.error()` + `Sentry.captureException()` + toast notification.
- **Gap 28** (vitest version inconsistency): **LIKELY CLOSED** — Agent 4 found ALL packages on `^3.1.3`. The 4th pass inconsistency (db/schemas on 3.1.3 while rest on 3.2.4) appears resolved; all packages aligned to ^3.1.3.
- **Gap 22** (DestinationFilters silent .catch()): **LIKELY CLOSED** — Agent 2 found zero silent catch blocks across the entire web app.

**Gaps with updated status/details**:
- **Gap 3** (files >500 lines): Count updated. **NEW violations discovered** beyond the 4th pass list: `auth-lockout.ts` (585L), `rate-limit.ts` (596L), `webhook-retry.job.ts` (525L), `feedback/public/submit.ts` (510L). `trial.service.ts` confirmed at 957L. Total violations: ~19 files.
- **Gap 4** (TODOs without issue refs): Updated. Apps are clean (0 TODOs in apps/). Packages still have ~101 dispersed TODOs, none with issue references. Severity remains LOW.
- **Gap 16** (CI build without Sentry DSN): **UPGRADED** — 5th pass found the scope is wider. Not only `PUBLIC_SENTRY_DSN` is missing from CI env but also `VITE_SENTRY_DSN`, `VITE_SENTRY_RELEASE`, `PUBLIC_SENTRY_RELEASE`, and `HOSPEDA_ADMIN_URL`. See Gap 31 below.
- **Gap 25** (no post-deploy verification): **CONFIRMED STILL OPEN** — Agents 1 and 3 both verified no healthcheck steps in cd-production.yml or cd-staging.yml.

---

## Gap 31: CI Workflow Missing Multiple globalEnv Variables in Build Environment

**Audit**: 5th pass (2026-03-16)
SPEC: SPEC-020 (US-05, US-06, turbo.json cache invalidation)
Gap: ci.yml only sets 5 env vars; turbo.json globalEnv requires 14+; production-differentiating vars absent
Related Task: T-012 (Update turbo.json globalEnv) — marked completed but CI workflow not aligned
Delegated to other spec: NO (extends Gap 16 which only covered PUBLIC_SENTRY_DSN)

### Description

`ci.yml` sets only these env vars for the build step:
```yaml
env:
  HOSPEDA_API_URL: ${{ secrets.HOSPEDA_API_URL }}
  HOSPEDA_SITE_URL: ${{ secrets.HOSPEDA_SITE_URL }}
  VITE_API_URL: ${{ secrets.HOSPEDA_API_URL }}
  PUBLIC_API_URL: ${{ secrets.HOSPEDA_API_URL }}
  PUBLIC_SITE_URL: ${{ secrets.HOSPEDA_SITE_URL }}
```

But `turbo.json` `globalEnv` (which controls cache invalidation) includes these variables that are **NOT** present in CI:

| Missing from CI | Impact |
|---|---|
| `HOSPEDA_ADMIN_URL` | CORS origin config; API auth.ts silently skips admin origin in CI |
| `VITE_SENTRY_DSN` | Admin app builds without Sentry in CI (differs from production) |
| `VITE_SENTRY_RELEASE` | Sentry release tags absent in CI build |
| `PUBLIC_SENTRY_DSN` | Web app builds without Sentry in CI (Astro conditional integration) |
| `PUBLIC_SENTRY_RELEASE` | Sentry release tags absent in CI build |
| `SENTRY_ENVIRONMENT` | Environment tag for Sentry events missing |

This causes two classes of problem:
1. **Cache invalidation failure**: If any of these vars change, Turbo cache won't invalidate because CI doesn't know about them. Stale builds may be served.
2. **Build divergence**: Production has Sentry; CI doesn't. Sentry-related bugs (CSP violations, source map errors, Sentry middleware interference) will only appear in production.

### Options

1. **Add all globalEnv vars to ci.yml**: Define HOSPEDA_ADMIN_URL, VITE_SENTRY_DSN, PUBLIC_SENTRY_DSN, etc. as GitHub secrets and reference them in ci.yml env section
2. **Use placeholder/empty values in CI**: Set `PUBLIC_SENTRY_DSN: ""` so the conditional Sentry integration is disabled intentionally (not accidentally absent)
3. **Document the divergence**: Accept it but document that CI builds differ from production in Sentry integration

### Priority: MEDIUM

### Severity: MEDIUM — Not a deploy blocker, but causes Turbo cache issues and CI/prod divergence. Sentry-specific bugs undetectable in CI.

### Complexity: LOW — Adding env var mappings to ci.yml is trivial once secrets are configured

### Recommendation: Option 1 for HOSPEDA_ADMIN_URL (affects CORS, functionally important). Option 2 for Sentry vars (set to empty string to keep CI deterministic). Creates clean separation: CI knows it has no Sentry, production does.

### Related Files
- `.github/workflows/ci.yml` (env section, lines 16–22)
- `turbo.json` (globalEnv, lines 5–26)
- `apps/web/astro.config.mjs` (conditional Sentry on PUBLIC_SENTRY_DSN, lines 78–86)
- `apps/api/src/lib/auth.ts` (CORS origin building using HOSPEDA_ADMIN_URL)

---

## Gap 32: `apps/admin/vercel.json` Missing `outputDirectory` — Deployment May 404

**Audit**: 5th pass (2026-03-16)
SPEC: SPEC-020 (US-01: admin build successful; US-09: CD workflows deploy correctly)
Gap: Admin Vercel config has no outputDirectory; TanStack Start output location is ambiguous
Related Task: T-003 (Verify admin build) — marked completed but Vercel config not verified
Delegated to other spec: NO

### Description

`apps/admin/vercel.json` specifies a `buildCommand` but **NO `outputDirectory`**:

```json
{
  "buildCommand": "cd ../.. && pnpm turbo run build --filter=admin",
  "installCommand": "pnpm install --frozen-lockfile"
}
```

TanStack Start's build output for Vercel deployments goes to **multiple possible locations** depending on version and adapter:
- `.output/` — Nitro/Vinxi output (older TanStack Start)
- `.vercel/output/` — Vercel-native output (newer versions with `@vercel/build-output-api`)
- `.tanstack/start/build/` — Internal build artifacts (not deployable directly)

`turbo.json` lists ALL THREE in `admin#build.outputs`:
```json
"outputs": [".output/**", ".tanstack/**", ".vercel/output/**"]
```

This ambiguity means Vercel will use its **auto-detection heuristic**, which may guess the wrong directory. Without a correct `outputDirectory`, Vercel may:
- Deploy an empty directory → all routes return 404
- Deploy the wrong build artifacts → SSR doesn't work, pages fail
- Deploy a partial build → some routes work, others don't

### Options

1. **Verify actual build output**: Run `pnpm --filter admin build` and check which directory contains the deployed files. Add that path as `outputDirectory` in vercel.json.
2. **Add `"framework": "@tanstack/start"`**: If Vercel has native TanStack Start detection, this may auto-configure the correct output directory.
3. **Add both paths and let Vercel decide**: Not reliable; explicit is safer.

### Priority: CRITICAL

### Severity: CRITICAL — If outputDirectory is wrong, ALL admin requests will 404 in production. This blocks admin deployment.

### Complexity: LOW-MEDIUM — Requires testing the actual build output, then adding one line to vercel.json

### Recommendation: Run `pnpm --filter admin build` locally, inspect output directories, determine which contains the Vercel-compatible build, and add explicit `outputDirectory` to apps/admin/vercel.json. Must be verified before production deploy.

### Related Files
- `apps/admin/vercel.json`
- `apps/admin/package.json`
- `turbo.json` (admin#build outputs)

---

## Gap 33: `apps/api/vercel.json` outputDirectory `_static` with Fake `.keep` File

**Audit**: 5th pass (2026-03-16)
SPEC: SPEC-020 (US-03: API deploys correctly to Vercel)
Gap: API vercel.json specifies outputDirectory "_static" populated only with a fake .keep file; actual serverless function behavior unclear
Related Task: T-004/T-005 (Fly.io → Vercel migration, marked completed)
Delegated to other spec: NO

### Description

`apps/api/vercel.json` includes:
```json
"buildCommand": "cd ../.. && pnpm turbo run build --filter=hospeda-api; mkdir -p apps/api/_static && echo '' > apps/api/_static/.keep",
"outputDirectory": "_static"
```

The `_static` directory is artificially created with an empty `.keep` file. This pattern is used when the actual API code is deployed as **Vercel Serverless Functions** via the `functions` config:
```json
"functions": {
  "api/index.js": {
    "maxDuration": 30,
    "memory": 512
  }
}
```

**Concern**: The function source is `api/index.js` but the function entry file must exist at the path specified. If `apps/api/src/vercel.ts` compiles to `apps/api/api/index.js` during the monorepo build, this works. If it compiles elsewhere (e.g., `apps/api/dist/index.js`), all API requests return 404.

This is not necessarily broken — the pattern is correct for Hono/Vercel deployments where `outputDirectory` is a static assets folder and serverless functions handle routes. However, it's not documented and requires verification.

### Options

1. **Verify the pattern works in production**: Test deploy to a preview environment and confirm API routes respond
2. **Add documentation comment**: Add a comment in vercel.json explaining the `_static` pattern and why it exists
3. **Validate in CI**: Add a step that confirms `apps/api/api/index.js` exists after build

### Priority: HIGH

### Severity: HIGH — If the build doesn't produce `api/index.js` in the expected location, all API requests fail in production with no clear error message

### Complexity: LOW (verification) / MEDIUM (fixing if wrong)

### Recommendation: Add a CI step that asserts `apps/api/api/index.js` exists after `pnpm turbo run build --filter=hospeda-api`. This would catch any regression immediately.

### Related Files
- `apps/api/vercel.json`
- `apps/api/src/vercel.ts` (the entry file that should compile to api/index.js)

---

## Gap 34: `apps/api/vercel.json` maxDuration 30s Applies to All Endpoints Equally

**Audit**: 5th pass (2026-03-16)
SPEC: SPEC-020 (production deployment reliability)
Gap: All API requests capped at 30s; no per-endpoint override for long-running operations
Related Task: T-004/T-005 area
Delegated to other spec: NO

### Description

`apps/api/vercel.json` defines:
```json
"functions": {
  "api/index.js": {
    "maxDuration": 30,
    "memory": 512
  }
}
```

A single Hono function handles ALL routes. Vercel's maxDuration applies to the entire function invocation. Operations that legitimately take > 30s will **silently timeout with a 504** from Vercel's edge, not from the application:

Potential timeout scenarios:
- Bulk MercadoPago webhook processing (many subscriptions)
- Database migrations triggered via API (if any)
- Complex billing reports or analytics queries
- Addon expiry batch processing (many addons)
- Large CSV/PDF export generation

On Vercel's free tier, maxDuration is capped at 10s. On Pro, it's 300s. The hardcoded 30s may be insufficient for some operations and overly permissive on free tier.

### Options

1. **Increase to 60s**: Better default for complex operations
2. **Split long-running operations to separate serverless functions**: Move heavy async work out of the main Hono handler
3. **Use Vercel's background functions** for cron jobs (already configured in vercel.json crons section)
4. **Document known timeout risks**: Add comments for specific routes that might timeout

### Priority: MEDIUM

### Severity: MEDIUM — Specific operations may timeout in production; difficult to debug as Vercel returns 504 not a structured error

### Complexity: LOW to change the number; MEDIUM to properly architect long-running operation handling

### Recommendation: Increase to 60s as immediate fix. Document which operations are at risk of timeout. Longer term, move batch operations to background jobs or queues.

### Related Files
- `apps/api/vercel.json` (lines 26–29)
- `apps/api/src/routes/billing/` (webhook processing, subscription management)

---

## Gap 35: `apps/api/vercel.json` Cron Jobs Can Fail Silently Without `HOSPEDA_CRON_SECRET`

**Audit**: 5th pass (2026-03-16)
SPEC: SPEC-020 (production reliability)
Gap: 6 cron jobs defined in vercel.json; runtime-only validation means misconfiguration isn't caught at deploy time
Related Task: T-004/T-005 (Vercel deployment configuration)
Delegated to other spec: NO

### Description

`apps/api/vercel.json` defines 6 Vercel cron jobs:
```json
"crons": [
  { "path": "/api/v1/admin/cron/trial-expiry", "schedule": "0 6 * * *" },
  { "path": "/api/v1/admin/cron/addon-expiry", "schedule": "0 7 * * *" },
  { "path": "/api/v1/admin/cron/send-notifications", "schedule": "*/15 * * * *" },
  { "path": "/api/v1/admin/cron/process-webhooks", "schedule": "*/5 * * * *" },
  { "path": "/api/v1/admin/cron/subscription-sync", "schedule": "0 * * * *" },
  { "path": "/api/v1/admin/cron/usage-tracking", "schedule": "0 2 * * *" }
]
```

`apps/api/src/utils/env.ts` validates that `HOSPEDA_CRON_SECRET` is required in production. However, this validation runs **at request time**, not at build/deploy time.

If `HOSPEDA_CRON_SECRET` is not set as a Vercel environment variable:
- Vercel deploys successfully (no build-time check)
- Each cron invocation hits the API, env validation fails, cron request returns 500
- **All 6 cron jobs silently fail** indefinitely — trial expiry doesn't run, addon expiry doesn't run, notifications don't send, webhooks aren't retried
- The failures appear in Vercel function logs but NO alert is triggered unless Sentry DSN is also configured

This is compounded by Gap 1 (SECRETS.md incomplete) — `HOSPEDA_CRON_SECRET` is not listed there, so an operator may not know to configure it.

### Options

1. **Document in SECRETS.md**: Part of Gap 1 fix — add HOSPEDA_CRON_SECRET to SECRETS.md with explanation
2. **Add build-time check**: In `apps/api/vercel.json` buildCommand, add a step that validates env vars required for cron (though env vars aren't available at build time on Vercel)
3. **Add Sentry alert for cron failures**: If HOSPEDA_CRON_SECRET is missing, Sentry should catch the startup failure and alert

### Priority: HIGH

### Severity: HIGH — Silent failure of ALL critical background jobs (trial expiry, addon expiry, notifications, webhooks). Business logic won't execute.

### Complexity: LOW (documentation fix), MEDIUM (monitoring setup)

### Recommendation: Fix immediately as part of SECRETS.md update (Gap 1). Add HOSPEDA_CRON_SECRET to SECRETS.md with "required in production" flag and instructions. Also add to `.env.example` if not already there.

### Related Files
- `apps/api/vercel.json` (crons section)
- `apps/api/src/utils/env.ts` (HOSPEDA_CRON_SECRET validation)
- `.github/SECRETS.md`

---

## Gap 36: `packages/notifications` Email Templates Have Zero Test Coverage

**Audit**: 5th pass (2026-03-16)
SPEC: SPEC-020 (US-15: notifications test coverage >= 80%)
Gap: 15 email template files completely untested; estimated actual coverage ~40-50% vs. required 80%
Related Task: QUAL-04 (Notifications test coverage >= 80%) — marked completed
Delegated to other spec: NO

### Description

SPEC-020 US-15 required notifications package coverage ≥ 80%. The previous audit (4th pass) noted `@vitest/coverage-v8` was missing (Gap 14) and `vitest.config.ts` was missing (Gap 17). The 5th pass went deeper and found the actual coverage gap is structural, not just tooling:

**Coverage inventory:**

| Directory | Files | Has Tests? |
|---|---|---|
| `src/services/` | 3 files | ✅ All covered |
| `src/transports/resend-transport.ts` | 1 file | ✅ Covered |
| `src/transports/mock-transport.ts` | 1 file | ❌ Not tested |
| `src/utils/subject-builder.ts` | 1 file | ✅ Covered |
| `src/utils/format-helpers.ts` | 1 file | ❌ Not tested |
| `src/templates/` | **15 React email templates** | ❌ **NONE tested** |
| `src/config/` | 2 files | ❌ Not tested |

The 15 untested email templates are customer-facing critical functionality:
- `billing-failure.email.tsx` — Payment failure notification
- `billing-renewal.email.tsx` — Upcoming renewal reminder
- `subscription-activated.email.tsx` — Welcome email
- `trial-ending.email.tsx` — Trial expiry warning
- `addon-expiring.email.tsx` — Addon expiry warning
- `trial-converted.email.tsx` — Trial converted to paid
- `feedback-received.email.tsx` — Admin feedback alert
- Plus ~8 more templates

These templates render HTML emails using React Email. Untested bugs include:
- Missing i18n keys (silent undefined rendering)
- Incorrect template logic (wrong data fields)
- HTML structure issues that break email clients

**Estimated actual coverage**: ~40–50% (services and one transport covered, 15 templates + config + utilities not covered)

**Required coverage**: 80%

### Options

1. **Add template unit tests**: Use `@react-email/render` to render each template with mock data and assert output contains expected strings
2. **Add snapshot tests**: Render templates once, save snapshots; future renders must match
3. **Add i18n key validation tests**: Assert all template uses of `t()` have corresponding keys in locale files

### Priority: HIGH

### Severity: HIGH — Customer-facing email template bugs undetectable in CI. Payment failure notifications, renewal reminders, and trial expiry emails could have broken formatting or missing content silently.

### Complexity: MEDIUM — Writing template tests requires React Email test setup; not blocking but 8–15 test files to write

### Recommendation: Create `packages/notifications/test/templates/` directory with one test per template. Priority order: billing-failure, billing-renewal, trial-ending (these are highest business impact). Also add `@vitest/coverage-v8` (Gap 14) and `vitest.config.ts` (Gap 17) as prerequisites.

### Related Files
- `packages/notifications/src/templates/` (all 15 .tsx files)
- `packages/notifications/test/` (missing template tests)
- `packages/notifications/package.json`

---

## Gap 37: `apps/admin/vercel.json` and `apps/web/vercel.json` CSP Headers Allow `unsafe-inline` + `unsafe-eval`

**Audit**: 5th pass (2026-03-16)
SPEC: SPEC-020 (production security posture)
Gap: Report-only CSP headers in both Vercel configs allow unsafe script execution patterns
Related Task: N/A (not in original SPEC-020 scope; discovered during 5th audit)
Delegated to other spec: Consider SPEC-019 (Security Permissions Hardening) or new spec

### Description

Both `apps/admin/vercel.json` and `apps/web/vercel.json` include `Content-Security-Policy-Report-Only` headers with `unsafe-inline` and `unsafe-eval` in `script-src`:

```json
"Content-Security-Policy-Report-Only": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ..."
```

**Three concerns:**

1. **Report-only mode**: Currently this header only *reports* violations to the browser console, not *enforces* them. Moving to enforced CSP will be a future breaking change requiring nonce-based script loading.

2. **`unsafe-inline` in script-src**: Allows arbitrary inline `<script>` tags. This defeats the main purpose of CSP (preventing XSS injection).

3. **`unsafe-eval` in script-src**: Allows `eval()`, `Function()`, and similar dynamic code execution. Required by some bundlers/frameworks in dev, but should be removed in production.

The headers are in report-only mode, so they don't cause runtime failures. However, they establish a weak security baseline that will be hard to tighten later.

### Options

1. **Remove `unsafe-eval` now**: Should not be needed in production builds
2. **Replace `unsafe-inline` with nonces** (larger effort): Requires nonce generation per request
3. **Move to enforced mode without `unsafe-inline`/`unsafe-eval`**: Implement CSP nonces (see SPEC-040 which covers this)
4. **Document as known technical debt**: Acceptable if SPEC-040 is already planned

### Priority: MEDIUM

### Severity: MEDIUM — Not a deploy blocker; report-only mode means no current runtime impact; security posture gap

### Complexity: LOW to remove `unsafe-eval`; HIGH to properly implement nonce-based CSP

### Recommendation: Check if SPEC-040 (CSP Nonce Integration) is planned. If yes, accept as-is with a note that Gap 37 will be resolved by SPEC-040. If not, remove `unsafe-eval` as a minimal immediate fix.

### Related Files
- `apps/admin/vercel.json` (CSP header)
- `apps/web/vercel.json` (CSP header)

---

## Gap 38: Admin App Sentry User Context Never Set After Login

**Audit**: 5th pass (2026-03-16)
SPEC: SPEC-020 (US-10: Sentry captures errors with full context)
Gap: `setSentryUser()` function exists in sentry.config.ts but is never called; Sentry errors lack user identity
Related Task: T-024 (Configure Sentry) — marked completed
Delegated to other spec: NO

### Description

`apps/admin/src/lib/sentry/sentry.config.ts` exports a `setSentryUser()` function (lines 175–189):
```typescript
export function setSentryUser(user: { id: string; email?: string; username?: string } | null): void {
    if (!isInitialized) return;
    Sentry.setUser(user ? { id: user.id, email: user.email, username: user.username } : null);
}
```

In `apps/admin/src/routes/__root.tsx`, the session is fetched:
```typescript
const { data: session } = useSession();
```

But **`setSentryUser()` is NEVER called** with the session user data. This means:
- When an admin error is captured by Sentry, there is **no user context** associated with it
- The Sentry dashboard shows errors without knowing WHICH admin user triggered them
- Debugging user-specific issues (permissions, workflows, data access) is impossible without logs

### Options

1. **Call `setSentryUser()` in `__root.tsx` after session loads**:
   ```typescript
   useEffect(() => {
     setSentryUser(session?.user ? { id: session.user.id, email: session.user.email, username: session.user.name } : null);
   }, [session]);
   ```
2. **Call in the auth hook** (wherever session is first resolved)

### Priority: LOW

### Severity: LOW — Sentry still captures errors; just without user context. Debugging is harder but not impossible.

### Complexity: TRIVIAL — One `useEffect` call in `__root.tsx`

### Recommendation: Fix immediately during next admin app change. Trivial change, high debugging value.

### Related Files
- `apps/admin/src/routes/__root.tsx`
- `apps/admin/src/lib/sentry/sentry.config.ts` (setSentryUser at lines 175–189)

---

## Gap 39: Production Database Migration Runbook Missing

**Audit**: 5th pass (2026-03-16)
SPEC: SPEC-020 (US-12 - DEPLOY-13)
Gap: No dedicated migration runbook exists distinguishing drizzle-kit push vs migrate
Related Task: T-020 (Document production migration workflow) — should have been created
Delegated to other spec: NO

### Description

SPEC-020 US-12 required:
1. A documented step-by-step migration guide
2. Clear distinction between `drizzle-kit push` (development) and `drizzle-kit migrate` (production)
3. A rollback procedure

Agent 5 found that `docs/deployment/environments.md` (1010 lines) covers environment configuration comprehensively but **does NOT contain a migration runbook**. No dedicated `docs/migration-runbook.md` or equivalent exists.

The missing documentation includes:
- **When to use `drizzle-kit push`**: Development only, instant schema changes, no migration files generated
- **When to use `drizzle-kit migrate`**: Production only, applies versioned migration files from `packages/db/src/migrations/`
- **Pre-deploy migration checklist**: Backup database, verify migration file, test in staging first
- **Rollback procedure**: How to revert a migration if it corrupts data or breaks the app
- **Migration naming conventions**: Files currently have inconsistent naming (some sequential, some with descriptive names)

Without this runbook:
- A developer unfamiliar with Drizzle may run `drizzle-kit push` against production, bypassing migration tracking
- No documented procedure for safely rolling back a bad migration
- New team members have no reference for production database operations

### Options

1. **Create `docs/runbooks/database-migrations.md`**: Dedicated runbook with all required sections
2. **Append migration section to `docs/deployment/environments.md`**: Less ideal but keeps docs together
3. **Add to existing CLAUDE.md**: Quick note, not comprehensive

### Priority: MEDIUM

### Severity: MEDIUM — Not a deploy blocker today, but is a production risk: if someone runs `drizzle-kit push` against the production DB instead of `drizzle-kit migrate`, migration history is lost and the database may be corrupted.

### Complexity: LOW — Documentation only, no code changes required

### Recommendation: Create `docs/runbooks/database-migrations.md` with the full runbook. Include CLAUDE.md pointer from the DB package section. Can be done directly without a new spec.

### Related Files
- `docs/deployment/environments.md` (general env docs, no migration section)
- `packages/db/src/migrations/` (migration files)
- `packages/db/CLAUDE.md` (should reference the runbook when created)

---

## Gap 40: `API_RATE_LIMIT_TRUST_PROXY` Not Documented in Any User-Facing File

**Audit**: 5th pass (2026-03-16)
SPEC: SPEC-020 (US-08 - DEPLOY-08)
Gap: CORS documentation is present; proxy trust configuration is not
Related Task: T-014 (Document CORS and proxy config for production)
Delegated to other spec: NO

### Description

SPEC-020 US-08 required two specific items documented in the API `.env.example`:
1. `API_CORS_ORIGINS` with explanation — **CONFIRMED PRESENT** (Pass)
2. `API_RATE_LIMIT_TRUST_PROXY` with explanation that it should be `true` when behind a proxy — **NOT FOUND**

Agent 5 confirmed `API_CORS_ORIGINS` is well documented in `docs/deployment/environments.md`. However, `API_RATE_LIMIT_TRUST_PROXY` is absent from:
- `apps/api/.env.example`
- `docs/deployment/environments.md`
- `.github/SECRETS.md`

In a Vercel deployment, all requests pass through Vercel's edge network. The `X-Forwarded-For` header contains the real client IP. If `API_RATE_LIMIT_TRUST_PROXY` is not set to `true`, the rate limiter will see Vercel's internal IP as the client IP, and ALL requests will come from the same "client" — effectively disabling per-IP rate limiting entirely.

This is a production security gap: rate limiting may be completely non-functional on Vercel without this setting.

### Options

1. **Add to `apps/api/.env.example`**: Document with note about Vercel proxy trust
2. **Set as default `true` for production**: Since the API is always behind Vercel, make this the default and remove the variable
3. **Add to SECRETS.md**: Not a secret but good reference

### Priority: HIGH

### Severity: HIGH — Rate limiting may be completely bypassed in production because Vercel proxy IPs look like client IPs. This is a security gap affecting brute-force protection, account lockout, and API abuse prevention.

### Complexity: LOW — Configuration documentation + verify default behavior in middleware code

### Recommendation: Verify the actual behavior in `apps/api/src/middlewares/rate-limit.ts` — does it default to trusting proxies when `NODE_ENV=production`? If not, add the env var with `true` as the recommended production value. This could be a CRITICAL security gap if the default is `false`.

### Related Files
- `apps/api/.env.example`
- `apps/api/src/middlewares/rate-limit.ts`
- `docs/deployment/environments.md`

---

## Gap 41: New Files >500 Lines Discovered in 5th Pass (Extending Gap 3)

**Audit**: 5th pass (2026-03-16)
SPEC: SPEC-020 (US-19: files <= 500 lines)
Gap: 4 additional files exceeding 500 lines discovered beyond the 4th pass list
Related Task: T-031 to T-039 (Decompose files)
Delegated to other spec: NO

### Description

The 5th pass identified 4 additional files exceeding 500 lines that were NOT in the Gap 3 list from prior audits:

| File | Lines | Notes |
|---|---|---|
| `apps/api/src/middlewares/auth-lockout.ts` | **585** | Account lockout and brute force protection middleware |
| `apps/api/src/middlewares/rate-limit.ts` | **596** | Rate limiting middleware (also relevant to Gap 40) |
| `apps/api/src/cron/jobs/webhook-retry.job.ts` | **525** | Webhook retry processing job |
| `apps/api/src/routes/feedback/public/submit.ts` | **510** | Public feedback submission route (highly unusual for a route to be this large) |

**Updated full list of violations from 5th pass** (combining Gap 3 + Gap 41):

| Lines | File | Priority |
|---|---|---|
| ~957 | `apps/api/src/services/trial.service.ts` | HIGH |
| ~956 | `packages/service-core/src/services/accommodation/accommodation.service.ts` | HIGH |
| ~829 | `packages/service-core/src/services/post/post.service.ts` | HIGH |
| ~760 | `packages/service-core/src/services/destination/destination.service.ts` | MEDIUM |
| ~740 | `apps/api/src/middlewares/limit-enforcement.ts` | MEDIUM |
| ~702 | `apps/api/src/cron/jobs/notification-schedule.job.ts` | MEDIUM |
| ~649 | `apps/api/src/middlewares/tourist-entitlements.ts` | LOW |
| ~626 | `packages/notifications/src/services/notification.service.ts` | LOW |
| ~619 | `apps/api/src/middlewares/entitlement.ts` | LOW |
| ~596 | `apps/api/src/middlewares/rate-limit.ts` | **NEW** / MEDIUM |
| ~585 | `apps/api/src/middlewares/auth-lockout.ts` | **NEW** / MEDIUM |
| ~582 | `apps/api/src/services/usage-tracking.service.ts` | LOW |
| ~545 | `apps/api/src/middlewares/entitlement.ts` | LOW |
| ~536 | `apps/api/src/utils/env.ts` | LOW |
| ~529 | `apps/api/src/routes/billing/trial.ts` | LOW |
| ~525 | `apps/api/src/cron/jobs/webhook-retry.job.ts` | **NEW** / LOW |
| ~522 | `packages/service-core/src/services/exchange-rate/exchange-rate-fetcher.ts` | LOW |
| ~519 | `apps/api/src/utils/route-factory.ts` | LOW |
| ~511 | `apps/api/src/middlewares/metrics.ts` | LOW |
| ~511 | `packages/service-core/src/services/attraction/attraction.service.ts` | LOW |
| ~525 | `packages/service-core/src/services/event/event.service.ts` | LOW |
| ~510 | `apps/api/src/routes/feedback/public/submit.ts` | **NEW** / MEDIUM |

**Total violations**: ~22 files (up from 19 in the 4th pass, due to code additions and new discoveries)

### Priority: MEDIUM (for new entries) / LOW for the overall backlog

### Severity: MEDIUM for auth-lockout.ts and rate-limit.ts (security-critical code should be well-organized); LOW for others

### Complexity: MEDIUM — Each file decomposition takes 1-3 hours including tests

### Recommendation: Prioritize security middleware (auth-lockout, rate-limit) for decomposition. Create a SPEC or epic to track file size compliance as a code quality initiative. No single SPEC-020 fix needed — add to Gap 3 tracking.

### Related Files: All files listed in table above

---

## Updated Master Summary Table (5th Audit Pass — 2026-03-16)

| # | Gap | Priority | Found | Status |
|---|-----|----------|-------|--------|
| 1 | SECRETS.md missing 15+ critical secrets | HIGH | 1st | **OPEN** |
| 2 | apps/web/.env.example missing | MEDIUM | 1st | **✅ CLOSED** (confirmed 4th+5th pass) |
| 3 | 22 files over 500-line limit (extended 5th pass) | LOW-MEDIUM | 1st | **OPEN** |
| 4 | ~101 TODOs without issue references (packages only) | LOW | 1st | **PARTIALLY RESOLVED** (apps clean; packages remain) |
| 5 | Admin .env.example missing VITE_SENTRY_DSN | LOW | 1st | **OPEN** |
| 6 | Sentry source maps upload disabled in web | MEDIUM | 1st | **OPEN** |
| 7 | Vercel CD secrets undocumented | HIGH | 1st | **OPEN** |
| 8 | route-factory.ts 519 lines (19 over) | LOW | 1st | **OPEN** |
| 9 | No manual deploy scripts | LOW | 1st | **OPEN** |
| 10 | turbo.json globalEnv incomplete | LOW | 1st | **OPEN** |
| 11 | Remote image patterns minimal | LOW | 1st | **OPEN** |
| 12 | `.then()` in 4 locations (index.ts:154,176; auth.ts:220,241) | LOW | 2nd | **OPEN** |
| 13 | notification.service.ts 626 lines | LOW | 2nd | **OPEN** |
| 14 | notifications missing @vitest/coverage-v8 | MEDIUM | 2nd | **OPEN** |
| 15 | FavoriteButton .then() without .catch() | LOW | 2nd | **✅ CLOSED** (proper Sentry capture added) |
| 16 | CI build without Sentry DSN (broader: multiple missing CI env vars) | LOW-MEDIUM | 2nd | **OPEN** (extended by Gap 31) |
| 17 | notifications missing vitest.config.ts | MEDIUM | 2nd | **OPEN** |
| 18 | billing missing @vitest/coverage-v8 | LOW | 2nd | **OPEN** |
| 19 | admin/server.ts uses export default (framework exception) | LOW | 2nd | **OPEN** (doc as exception) |
| 20 | logger/index.ts uses export default | LOW | 2nd | **OPEN** |
| 21 | Test mock files over 500 lines | INFO | 2nd | **OPEN** |
| 22 | DestinationFilters .catch() silent error | LOW | 2nd | **✅ LIKELY CLOSED** (Agent 2: zero silent catches) |
| 23 | HOSPEDA_BETTER_AUTH_URL undocumented | LOW | 2nd | **OPEN** |
| 24 | Staging branch does not exist (cd-staging.yml dead) | MEDIUM | 4th | **OPEN** |
| 25 | No post-deploy health check in CD workflows | MEDIUM | 4th | **OPEN** |
| 26 | Coverage thresholds not enforced at package level | LOW-MEDIUM | 4th | **OPEN** |
| 27 | email/logger/utils missing vitest.config.ts | LOW | 4th | **OPEN** |
| 28 | Vitest minor version inconsistency (db/schemas) | INFO | 4th | **✅ LIKELY CLOSED** (all on ^3.1.3 per 5th pass) |
| 29 | packages/config vitest.config.ts missing coverage provider | LOW | 4th | **OPEN** |
| 30 | packages/service-core globals: false inconsistency | INFO | 4th | **OPEN** |
| **31** | **CI env section missing Sentry + ADMIN_URL vars (cache divergence)** | **MEDIUM** | **5th** | **OPEN** |
| **32** | **apps/admin/vercel.json missing outputDirectory (CRITICAL 404 risk)** | **CRITICAL** | **5th** | **OPEN** |
| **33** | **apps/api/vercel.json _static pattern needs production verification** | **HIGH** | **5th** | **OPEN** |
| **34** | **API maxDuration 30s applies to all endpoints globally** | **MEDIUM** | **5th** | **OPEN** |
| **35** | **Cron jobs fail silently without HOSPEDA_CRON_SECRET (extends Gap 1)** | **HIGH** | **5th** | **OPEN** |
| **36** | **notifications email templates 0% coverage (actual coverage ~40-50%)** | **HIGH** | **5th** | **OPEN** |
| **37** | **CSP headers allow unsafe-inline + unsafe-eval (report-only mode)** | **MEDIUM** | **5th** | **OPEN** |
| **38** | **Admin Sentry setSentryUser() never called — no user context in errors** | **LOW** | **5th** | **OPEN** |
| **39** | **Production DB migration runbook missing (DEPLOY-13 unfulfilled)** | **MEDIUM** | **5th** | **OPEN** |
| **40** | **API_RATE_LIMIT_TRUST_PROXY undocumented (rate limiting may be bypassed)** | **HIGH** | **5th** | **OPEN** |
| **41** | **4 new files >500 lines (auth-lockout, rate-limit, webhook-retry, feedback)** | **MEDIUM** | **5th** | **OPEN** |

### Pre-Deploy Blockers — Updated 5th Pass

| Gap | Issue | Effort |
|---|---|---|
| 32 | admin/vercel.json missing outputDirectory → potential 404 on ALL admin routes | LOW (verify + 1 line) |
| 33 | API vercel.json _static pattern needs production smoke test | LOW (CI assertion) |
| 1+7+35 | SECRETS.md incomplete: missing Vercel IDs, Sentry DSNs, MercadoPago, Cron, Redis, Resend | LOW (docs) |
| 40 | API_RATE_LIMIT_TRUST_PROXY may bypass all rate limiting on Vercel | LOW (verify + docs) |

### High Priority (fix before stable production)

| Gap | Issue | Effort |
|---|---|---|
| 36 | notifications coverage ~40-50% vs required 80% (templates untested) | MEDIUM |
| 6 | Sentry source maps disabled (production debugging severely impaired) | LOW |
| 25 | No post-deploy health check | LOW (5 lines YAML) |
| 35 | Cron jobs fail silently without HOSPEDA_CRON_SECRET | LOW (docs + monitoring) |

### Post-Deploy Code Quality Backlog

- Gaps 3/41: File decomposition (22 files over limit)
- Gaps 14/17/26/27/29: Testing infrastructure improvements
- Gap 39: Migration runbook
- Gaps 31/16: CI env alignment
- Gap 38: Admin Sentry user context
- Gaps 37/10/8/9/12/13/18-23/30: Low-priority quality improvements

---

## SIXTH AUDIT PASS (2026-03-16 — posterior a 5th pass)

**Methodology**: 3 agentes especializados en paralelo: (1) CI/CD & deployment config, (2) code quality (console.log, as any, catch blocks, 500L, exports, shutdown), (3) testing infrastructure & coverage. Auditoría exhaustiva con lectura real de archivos y evidencia de código.

**Contexto**: Esta pasada se hizo en la misma sesión de trabajo del 2026-03-16, posterior a la 5th pass. Usó metodología de agentes paralelos con evidencia de código citada explícitamente.

**Nuevos gaps encontrados**: 1 (Gap 42)
**Gaps confirmados RESUELTOS desde 5th pass**: 0 cambios adicionales confirmados
**Confirmaciones de gaps existentes**: 12 gaps pre-existentes reconfirmados con evidencia directa de código

---

### Confirmaciones de Gaps Pre-existentes (6th pass)

Las siguientes confirmaciones refuerzan la evidencia de auditorías anteriores:

| Gap # | Confirmación 6th pass |
|---|---|
| Gap 8 | `route-factory.ts` confirmado en **519 líneas** — 19 sobre el límite. Las líneas 503-519 son re-exports de `route-factory-tiered.ts`. Impacto funcional cero, pero viola el estándar. |
| Gap 11 | `astro.config.mjs` — `remotePatterns` incluye localhost, `*.vercel.app`, y hostname dinámico desde `HOSPEDA_API_URL`. No incluye dominios CDN explícitos. |
| Gap 16/31 | CI env vars confirmados incompletos. Falta `PUBLIC_SENTRY_DSN`, `VITE_SENTRY_DSN`, `HOSPEDA_ADMIN_URL` y otros. Builds de CI difieren de producción. |
| Gap 17 | `packages/notifications/vitest.config.ts` — **no existe**. Paquete hereda config de root pero sin thresholds, coverage provider ni includes. |
| Gap 26/36 | Notifications: 14 archivos de test existen para services/transport/subject-builder. Los **15 templates de email siguen sin cobertura** (confirmado). |
| Gap 39 | `docs/migration-runbook.md` — **NO EXISTE** (confirmado). `scripts/migrate-production.sh` existe (280 líneas, completo) pero falta el documento de runbook. |
| Gap 40 | Confirmado que `API_RATE_LIMIT_TRUST_PROXY` no está documentado en `.env.example`. Rate limiting en Vercel potencialmente no funcional. |
| Gap 4 | TODOs en codebase: Agent 3 contó **497 instancias** en total. La 5th pass reportó ~101 en packages. La diferencia se debe a scope: el conteo de 497 incluye test files. **En código de producción (no tests): ~101 TODOs sin formato de issue**. |
| Gap 38 | `setSentryUser()` exportada desde `apps/admin/src/lib/sentry/sentry.config.ts` pero **nunca llamada** desde `__root.tsx` ni desde ningún componente. Confirmado. |
| Gap 3 | `route-factory.ts` (519L), otros archivos confirmados dentro del mismo rango. |
| Gap 12 | 4 instancias de `.then()` confirmadas: `index.ts:154`, `index.ts:176`, `auth.ts:220`, `auth.ts:241`. |
| Gap 35 | 6 cron jobs en `apps/api/vercel.json`: trial-expiry, addon-expiry, send-notifications, process-webhooks, subscription-sync, usage-tracking. Todos requieren `HOSPEDA_CRON_SECRET`. |

---

## Gap 42: `packages/i18n` — 3 Tests Fallando por `inventory.keys` undefined

**Audit**: 6th pass (2026-03-16)
SPEC: SPEC-020 (US-13: pnpm test passes with zero errors)
Gap: `validation-key-sync.test.ts` tiene 3 tests activamente fallando — bloqueador de CI
Related Task: T-025/T-026 (fix vitest config) — marcados completed, pero este failure no fue detectado
Delegated to other spec: Candidato a SPEC-023 (preexisting errors cleanup)

### Description

El agente de testing detectó en `packages/i18n/test/validation-key-sync.test.ts` 3 tests que fallan con el error:

```
TypeError: Cannot read properties of undefined (reading 'keys')
  at packages/i18n/test/validation-key-sync.test.ts:91
  at packages/i18n/test/validation-key-sync.test.ts:100
  at packages/i18n/test/validation-key-sync.test.ts:115
```

**Root cause**: El test intenta acceder a `inventory.keys` (línea 91, 100, 115), pero `inventory` es `undefined`. Esto sugiere que:
1. El módulo que exporta `inventory` cambió su estructura o no exporta `keys` en el scope esperado
2. La función de carga de inventario (`loadInventory()` o equivalente) no está siendo inicializada correctamente antes de los tests
3. El archivo de inventario que se intenta leer puede no existir en el path que el test asume

**Impacto en CI**: Si `pnpm test` corre `packages/i18n`, estos 3 tests **fallan activamente**. El CI workflow (`ci.yml`) corre `pnpm test` globalmente. Si estos tests no están siendo silenciados con `.skip()`, el CI falla en la fase de tests.

**Contexto previo**: T-051 en state.json documenta "billing (4 pre-existing sandbox token tests) + db (7 pre-existing base.model tests) fail". El i18n failure **no fue documentado** en T-051 como pre-existing, lo que sugiere es un problema reciente o pasó desapercibido.

### Información de archivos relevantes

- `packages/i18n/test/validation-key-sync.test.ts` — líneas 91, 100, 115
- `packages/i18n/src/` — el módulo que exporta el inventory
- El CI workflow corre tests globales con `pnpm test`

### Options

1. **Fix inmediato**: Entender qué cambió en el módulo de inventario y corregir el test o el módulo. Si `inventory` pasó a ser un objeto con estructura diferente, actualizar el test para acceder a la propiedad correcta.
2. **Agregar `.skip()` temporal**: Suprimir el test mientras se investiga la causa raíz. Documentar como known failure en T-051.
3. **Agregar a SPEC-023**: Este es exactamente el tipo de failure que SPEC-023 (preexisting errors cleanup) debería cubrir.

### Priority: HIGH

### Severity: HIGH — 3 tests activamente fallando en CI (si no están `.skip()`-eados). Bloquea `pnpm test` green en el pipeline. Un CI roto es un blocker de deployment.

### Complexity: LOW-MEDIUM — La causa es un `inventory.keys` undefined. Fix probable en 1-2 horas una vez reproducido localmente.

### What happens if we don't fix it: `pnpm test` falla en packages/i18n. CI no puede estar 100% green. Confianza en el test suite comprometida.

### Recommendation

Verificar si el test está actualmente `.skip()`-eado. Si no lo está, es un **bloqueador activo de CI**. Priorizar fix en SPEC-023 o como tarea standalone inmediata. Si ya está `.skip()`-eado, documentarlo en T-051 como pre-existing failure y encolar para SPEC-023.

### Related Files

- `packages/i18n/test/validation-key-sync.test.ts` (líneas 91, 100, 115)
- `packages/i18n/src/` (módulo de inventory)
- `.claude/tasks/SPEC-020-deployment-readiness/state.json` (T-051)
- `.claude/specs/SPEC-023-preexisting-errors-cleanup/spec.md`

---

### Nota sobre `audit-logger.ts` console.error (No Gap)

El agente de code quality encontró **1 única instancia real de `console.error`** en `apps/api/src/utils/audit-logger.ts:261`. Esta es un fallback de emergencia justificado: cuando el sistema de logging falla completamente, se recurre a `console.error` como mecanismo de último recurso. Esta instancia fue evaluada y **NO constituye un gap** — es el comportamiento correcto para un sistema de logging en cascada.

---

### Nota sobre `uncaughtException` handler (Confirmación de Diseño)

El handler en `apps/api/src/index.ts` **intencionalmente NO llama `process.exit(1)`** en el contexto de Vercel serverless. El agente confirmó que hay un JSDoc comment extenso (líneas 135-145) documentando esta decisión arquitectónica. Esto es coherente con el Deviation Note 11.2 de la spec. El design está **correcto para Vercel** y documentado.

---

## Updated Master Summary Table (6th Audit Pass — 2026-03-16)

| # | Gap | Priority | Found | Status |
|---|-----|----------|-------|--------|
| 1 | SECRETS.md missing 15+ critical secrets | HIGH | 1st | **OPEN** |
| 2 | apps/web/.env.example missing | MEDIUM | 1st | **✅ CLOSED** |
| 3 | 22 files over 500-line limit | LOW-MEDIUM | 1st | **OPEN** |
| 4 | ~101 TODOs sin issue refs (packages only) | LOW | 1st | **OPEN** |
| 5 | Admin .env.example missing VITE_SENTRY_DSN | LOW | 1st | **OPEN** |
| 6 | Sentry source maps upload disabled in web | MEDIUM | 1st | **OPEN** |
| 7 | Vercel CD secrets undocumented | HIGH | 1st | **OPEN** |
| 8 | route-factory.ts 519 lines (19 over) | LOW | 1st | **OPEN** (reconfirmado 6th) |
| 9 | No manual deploy scripts | LOW | 1st | **OPEN** |
| 10 | turbo.json globalEnv incomplete | LOW | 1st | **OPEN** |
| 11 | Remote image patterns minimal | LOW | 1st | **OPEN** (reconfirmado 6th) |
| 12 | `.then()` en 4 ubicaciones exactas | LOW | 2nd | **OPEN** (reconfirmado 6th) |
| 13 | notification.service.ts 626 lines | LOW | 2nd | **OPEN** |
| 14 | notifications missing @vitest/coverage-v8 | MEDIUM | 2nd | **OPEN** |
| 15 | FavoriteButton .then() without .catch() | LOW | 2nd | **✅ CLOSED** |
| 16 | CI build sin Sentry DSN (extends Gap 31) | LOW-MEDIUM | 2nd | **OPEN** |
| 17 | notifications missing vitest.config.ts | MEDIUM | 2nd | **OPEN** (reconfirmado 6th) |
| 18 | billing missing @vitest/coverage-v8 | LOW | 2nd | **OPEN** |
| 19 | admin/server.ts export default (exception) | LOW | 2nd | **OPEN** |
| 20 | logger/index.ts export default | LOW | 2nd | **OPEN** |
| 21 | Test mock files over 500 lines | INFO | 2nd | **OPEN** |
| 22 | DestinationFilters silent .catch() | LOW | 2nd | **✅ LIKELY CLOSED** |
| 23 | HOSPEDA_BETTER_AUTH_URL undocumented | LOW | 2nd | **OPEN** |
| 24 | Staging branch no existe | MEDIUM | 4th | **OPEN** |
| 25 | No post-deploy health check en CD | MEDIUM | 4th | **OPEN** |
| 26 | Coverage thresholds no enforced por package | LOW-MEDIUM | 4th | **OPEN** |
| 27 | email/logger/utils missing vitest.config.ts | LOW | 4th | **OPEN** |
| 28 | Vitest minor version inconsistency | INFO | 4th | **✅ LIKELY CLOSED** |
| 29 | packages/config vitest missing coverage | LOW | 4th | **OPEN** |
| 30 | packages/service-core globals: false | INFO | 4th | **OPEN** |
| 31 | CI env section missing Sentry + ADMIN_URL | MEDIUM | 5th | **OPEN** (reconfirmado 6th) |
| 32 | admin/vercel.json missing outputDirectory | CRITICAL | 5th | **OPEN** |
| 33 | api/vercel.json _static pattern sin verificar | HIGH | 5th | **OPEN** (reconfirmado 6th) |
| 34 | API maxDuration 30s global | MEDIUM | 5th | **OPEN** |
| 35 | Cron jobs fallan sin HOSPEDA_CRON_SECRET | HIGH | 5th | **OPEN** (reconfirmado 6th) |
| 36 | notifications email templates 0% coverage | HIGH | 5th | **OPEN** (reconfirmado 6th) |
| 37 | CSP headers unsafe-inline + unsafe-eval | MEDIUM | 5th | **OPEN** |
| 38 | Admin Sentry setSentryUser() nunca llamado | LOW | 5th | **OPEN** (reconfirmado 6th) |
| 39 | DB migration runbook missing | MEDIUM | 5th | **OPEN** (reconfirmado 6th) |
| 40 | API_RATE_LIMIT_TRUST_PROXY undocumented | HIGH | 5th | **OPEN** (reconfirmado 6th) |
| 41 | 4 new files >500 lines (security middlewares) | MEDIUM | 5th | **OPEN** |
| **42** | **packages/i18n validation-key-sync: 3 tests fallando** | **HIGH** | **6th** | **OPEN** |

---

### Pre-Deploy Blockers — Estado Final (6th pass)

| Gap | Issue | Esfuerzo |
|---|---|---|
| **32** | admin/vercel.json sin outputDirectory → 404 en TODAS las rutas del admin | LOW (verificar + 1 línea) |
| **33** | api/vercel.json patrón `_static` requiere smoke test en producción | LOW (assertion en CI) |
| **1+7+35** | SECRETS.md incompleto: faltan Vercel IDs, Sentry DSNs, MercadoPago, Cron, Redis, Resend | LOW (docs) |
| **40** | API_RATE_LIMIT_TRUST_PROXY no documentado → rate limiting bypasseado en Vercel | LOW (verificar + docs) |
| **42** | 3 tests activamente fallando en packages/i18n → CI roto | LOW-MEDIUM (fix o .skip) |

### Alta Prioridad (pre-estabilización de producción)

| Gap | Issue | Esfuerzo |
|---|---|---|
| 36 | notifications coverage ~40-50% vs 80% requerido | MEDIUM |
| 6 | Sentry source maps deshabilitados | LOW |
| 25 | Sin post-deploy health check | LOW (5 líneas YAML) |
| 24 | Staging branch no existe → cd-staging.yml nunca se activa | LOW (crear branch) |

### Backlog Post-Deploy (Quality)

- Gaps 3/41: Decomposición de 22+ archivos
- Gaps 14/17/26/27/29: Testing infrastructure
- Gap 39: Migration runbook
- Gaps 31/16: CI env alignment
- Gap 38: Admin Sentry user context
- Gap 4: TODOs triage (101 en packages)
- Gaps 37/10/8/9/12/13/18-23/30: Low-priority improvements
