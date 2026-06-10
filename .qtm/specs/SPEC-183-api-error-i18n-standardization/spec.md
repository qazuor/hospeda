---
specId: SPEC-183
title: API Error i18n Standardization
type: refactor
status: in-progress
complexity: medium
owner: qazuor
created: 2026-06-02
base: staging
branch: spec/SPEC-183-api-error-i18n-standardization
worktree: /home/qazuor/projects/WEBS/hospeda-spec-183-api-error-i18n-standardization
linearIssues:
  - BETA-63
tags:
  - i18n
  - error-handling
  - web
  - admin
  - api-errors
  - translateApiError
  - ux
  - beta-63
---

# SPEC-183 — API Error i18n Standardization

## 1. Origin & problem statement

**BETA-63** — Users see raw English API error messages (e.g. `"Entity not found"`,
`"Something went wrong"`) instead of localized copy when an operation fails in either
the web app or the admin panel.

Two separate code paths are in play:

- **`apps/web`** already has a correct helper (`translateApiError` in
  `apps/web/src/lib/api-errors.ts`) but approximately 5 component sites still use
  `error.message` directly instead of calling it. Auth components (`SignIn`, `SignUp`,
  `ForgotPassword`, `ResetPassword`, `VerifyEmail`) are already wired up.
- **`apps/admin`** has **zero** usage of any equivalent helper. The genuine
  user-facing API-error sites — dialogs, forms, mutation error handlers — render
  `error.message` directly (raw English). The admin has an `ApiError` class
  (`apps/admin/src/lib/errors/api-error.ts`) and a toast utility
  (`apps/admin/src/lib/errors/toast-error.ts`) that use some i18n for HTTP-status
  buckets but do not perform `code`/`reason` → i18n key lookup.

### Current error display priority (web, working correctly)

```
error.reason → common.apiError.<REASON>
  → error.code → common.apiError.<CODE>
    → error.message (raw English API text)
      → fallback (caller-supplied localized string)
        → common.apiError.GENERIC
```

### Root cause

`translateApiError` is a web-only helper, defined in `apps/web/src/lib/api-errors.ts`
and imported from `apps/web/src/lib/i18n` (for `createT`). It cannot be imported by
admin or any other app. There is no shared package version.

---

## 2. Architecture overview — what already exists vs. what is new

### What ALREADY EXISTS (preserve, extend, do not rebuild)

| Component | Location | What it does |
|-----------|----------|-------------|
| `translateApiError` | `apps/web/src/lib/api-errors.ts` | Pure function. Priority: `reason` → `code` → raw `message` → `fallback` → `GENERIC`. Receives `{ error, t?, locale?, fallback? }`. |
| Web test suite | `apps/web/test/lib/api-errors.test.ts` | 7 Vitest unit tests covering all priority branches. |
| `common.apiError.*` keys | `packages/i18n/src/locales/{es,en,pt}/common.json` | 14 keys: `GENERIC`, `RATE_LIMIT_EXCEEDED`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `ALREADY_EXISTS`, `INTERNAL_ERROR`, `NETWORK_ERROR`, `LIMIT_REACHED`, `BAD_REQUEST`, `CONFLICT`, `SERVICE_UNAVAILABLE`, `NEWSLETTER_NOT_CONFIGURED`. |
| `ServiceErrorCode` enum | `packages/schemas/src/enums/service-error-code.enum.ts` | Canonical set of API error codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`, `ALREADY_EXISTS`, `INVALID_PAGINATION_PARAMS`, `NOT_IMPLEMENTED`, `SERVICE_UNAVAILABLE`, `CONFIGURATION_ERROR`, `QUOTA_EXCEEDED`, `LIMIT_REACHED`, `ENTITLEMENT_REQUIRED`. |
| `ApiError` class | `apps/admin/src/lib/errors/api-error.ts` | Admin-only typed error class with `.code`, `.message`, `.status`. |
| `useTranslations` hook | `packages/i18n/src/hooks/use-translations.ts` | React hook, re-exported from admin via `apps/admin/src/hooks/use-translations.ts`. Returns `{ t, locale }`. |
| `trans` + `defaultLocale` | `packages/i18n/src/config.ts` | Non-React translation access, already imported by admin's `toast-error.ts`. |

### What is NEW (this spec authors)

1. **`translateApiError` moves to `@repo/i18n`** — the function, its types
   (`ApiErrorShape`, `TranslationFn`), and its parameter interface move into
   `packages/i18n/src/`. It is exported from `packages/i18n/src/index.ts`. It no
   longer depends on web-local `createT` (uses `@repo/i18n`'s own `trans`-based
   translation or accepts a caller-supplied `t`).
2. **Web re-export shim** — `apps/web/src/lib/api-errors.ts` becomes a re-export of
   the shared version, preserving the import path for all existing web callers.
3. **Web migration** — the ~5 remaining genuine API-error sites in web that still use
   `error.message` directly are migrated to `translateApiError`.
4. **Admin adoption** — the ~12 genuine user-facing API-error sites in admin dialogs
   and forms adopt `translateApiError` from `@repo/i18n`. Cache internals, logger
   calls, error-boundary stack traces, and native JS errors are explicitly left
   untouched.
5. **Key coverage guard** — a Vitest test asserts that every `ServiceErrorCode` enum
   value has a corresponding `common.apiError.<CODE>` key in es/en/pt. Missing keys
   are added with translations in the same task.
6. **Docs** — a short guide `packages/i18n/docs/api-error-translation.md` explaining
   the translation path for future contributors.

---

## 3. Scope

### In scope

1. **Phase 1** — Centralize `translateApiError` in `@repo/i18n`; web re-export.
2. **Phase 2** — Migrate remaining genuine API-error sites in `apps/web`.
3. **Phase 3** — Admin adoption of `translateApiError` at genuine user-facing sites.
4. **Phase 4** — Key coverage: audit + add missing `common.apiError.*` keys +
   guard test + docs + index closeout.

### Out of scope

- Changing the error priority logic (it works correctly — preserve as-is).
- Migrating logger calls, cache internals (`apps/admin/src/lib/cache/**`), error
  boundaries, or native JavaScript `Error.message` references. Those are not API
  errors and must not be touched.
- Changing the `ApiError` class shape in admin.
- Changing the `toast-error.ts` HTTP-status dispatch logic (it already does partial
  i18n via HTTP-status buckets; this spec only adds `code`/`reason` lookup on top).
- Translations for admin-specific error messages that are not API `code`/`reason`
  values (e.g. validation field messages).
- Server-side i18n (the backend is intentionally locale-free).

---

## 4. Functional specification

### 4.1 Phase 1 — Centralize helper in @repo/i18n

`translateApiError` must work in two scenarios:

1. **React context** (admin hooks, web React components): caller passes a `t` function
   from `useTranslations()`.
2. **Non-React context** (web Astro server code, plain TS utilities): caller passes a
   `locale` string and the function internally uses `@repo/i18n`'s `trans` map to look
   up the key.

The function signature is preserved exactly:

```typescript
export function translateApiError(params: {
    readonly error: ApiErrorShape | null | undefined;
    readonly t?: TranslationFn;
    readonly locale?: SupportedLocale;
    readonly fallback?: string;
}): string
```

Where `SupportedLocale` comes from `@repo/i18n`'s `Locale` type (aliased if needed
for backward compatibility with web's `SupportedLocale`).

The `createT` dependency is resolved by referencing `@repo/i18n`'s own `trans` object
directly (the same mechanism `toast-error.ts` already uses via `trans[defaultLocale]`).

`apps/web/src/lib/api-errors.ts` is reduced to a re-export:

```typescript
export { translateApiError } from '@repo/i18n';
export type { ApiErrorShape, TranslationFn } from '@repo/i18n';
```

All 17 existing web import sites (`translateApiError` already in use) continue to work
with zero behavioral change.

### 4.2 Phase 2 — Web migration

**Candidate files** (implementer classifies at implementation time — API error vs.
native JS error):

| File | Line pattern | Classification |
|------|-------------|---------------|
| `apps/web/src/components/account/AvatarUpload.client.tsx:136,162` | `errBody.error?.message` | API error — migrate |
| `apps/web/src/components/account/PreferenceToggles.client.tsx:233` | `errBody.error?.message` | API error — migrate |
| `apps/web/src/components/account/ProfileCompletionAvatarPicker.tsx:129` | `errBody.error?.message` | API error — migrate |
| `apps/web/src/components/host/CreatePropertyMiniForm.client.tsx:181` | `response.error.message` | API error — migrate |
| `apps/web/src/lib/reset-password-status.ts:72` | `result.error.message` | API error — migrate |

Rule: if the error originates from the Hospeda API client (`apps/web/src/lib/api/client.ts`)
and carries `{ code?, message?, reason? }`, it is an API error. If it is a native JS
`Error` instance caught from DOM/browser APIs, leave it untouched.

### 4.3 Phase 3 — Admin adoption

**Genuine user-facing API-error sites** (based on code audit — implementer verifies
at implementation time):

| File | Site description |
|------|-----------------|
| `apps/admin/src/features/billing-plans/components/PlanDialog.tsx:115` | Mutation error in plan create/edit dialog |
| `apps/admin/src/features/billing-addons/components/AddonDialog.tsx:93` | Mutation error in addon dialog |
| `apps/admin/src/features/billing-payments/RefundDialog.tsx:73` | Refund mutation error concatenated into toast |
| `apps/admin/src/features/exchange-rates/components/RateHistoryView.tsx:296` | Rate fetch error |
| `apps/admin/src/features/exchange-rates/components/FetchConfigForm.tsx:97` | Config fetch error |
| `apps/admin/src/features/exchange-rates/components/ManualOverrideDialog.tsx:102` | Override mutation error |
| `apps/admin/src/features/sponsorships/components/CreateSponsorshipPackageDialog.tsx:131` | Sponsorship package create error |
| `apps/admin/src/features/sponsorships/components/SponsorshipsTab.tsx:204` | Sponsorships list error inline display |
| `apps/admin/src/features/sponsorships/components/SponsorshipLevelsTab.tsx:158` | Levels list error inline display |
| `apps/admin/src/features/sponsorships/components/CreateSponsorshipDialog.tsx:175` | Sponsorship create error |
| `apps/admin/src/features/sponsorships/components/SponsorshipPackagesTab.tsx:128` | Packages list error inline display |
| `apps/admin/src/features/cron-jobs/components/CronJobsPanel.tsx:73` | Cron fetch error inline display |

**Explicitly excluded** (leave untouched):

- `apps/admin/src/lib/cache/**` — cache internal error logging (not user-facing).
- `apps/admin/src/lib/error-boundaries/**` — React error boundary stack traces.
- `apps/admin/src/lib/errors/error-reporter.ts` — error reporting payload (not user-facing).
- `apps/admin/src/lib/validation/hooks/**` — validation hook internals.
- `apps/admin/src/lib/factories/createEntityRoutes.tsx` — generic route error fallback
  (English only, fix noted as a follow-up).
- `apps/admin/src/features/conversations/components/**` — `ReplyForm`/`BlockDialog` use
  Zod `.issues[0]?.message` (field validation), not API errors; `ThreadView` uses
  `mainQuery.error` which is a TanStack Query `Error` — leave all three.

Admin components use `useTranslations()` to get a `t` function. The call pattern is:

```typescript
import { translateApiError } from '@repo/i18n';

// inside component:
const { t } = useTranslations();
// ...
translateApiError({ error: apiError, t })
```

Where `apiError` is the `error` from an `ApiError` instance or a raw API response
body shape `{ code?, message?, reason? }`.

### 4.4 Phase 4 — Key coverage + closeout

**Missing keys** (enum codes with no `common.apiError.*` key as of this writing):

| Code | Status |
|------|--------|
| `INVALID_PAGINATION_PARAMS` | Missing — add |
| `NOT_IMPLEMENTED` | Missing — add |
| `CONFIGURATION_ERROR` | Missing — add |
| `QUOTA_EXCEEDED` | Missing — add |
| `ENTITLEMENT_REQUIRED` | Missing — add |

All 5 missing keys must be added in es/en/pt with appropriate localized copy.

**Guard test** lives in `packages/i18n/test/api-error-key-coverage.test.ts` and
imports `ServiceErrorCode` from `@repo/schemas` + `trans` from `@repo/i18n`. It asserts
that for every enum value `V`, the key `common.apiError.V` exists and is non-empty in
all three locales. The test is a permanent regression guard — it runs in CI.

---

## 5. Acceptance criteria (BDD)

### Phase 1

```gherkin
Scenario: translateApiError is importable from @repo/i18n
  Given the @repo/i18n package is built
  When another package imports { translateApiError } from '@repo/i18n'
  Then the function is available and type-correct

Scenario: web re-export preserves existing call sites
  Given apps/web/src/lib/api-errors.ts is a re-export shim
  When any web component imports translateApiError from '@/lib/api-errors'
  Then the import resolves and the function behaves identically to before

Scenario: helper works without a t function using locale fallback
  Given no React context is available
  When translateApiError is called with { error: { code: 'NOT_FOUND' }, locale: 'es' }
  Then it returns the Spanish translation from common.apiError.NOT_FOUND

Scenario: all existing web tests remain green
  Given the helper is moved to @repo/i18n
  When the web test suite runs
  Then all 7 existing api-errors.test.ts cases pass
```

### Phase 2

```gherkin
Scenario: AvatarUpload shows a localized error on failure
  Given the user's avatar upload fails with code: 'VALIDATION_ERROR'
  When the error is displayed
  Then the UI shows the Spanish text from common.apiError.VALIDATION_ERROR
  And not the raw English API message

Scenario: native JS errors in web are untouched
  Given a native JavaScript Error is thrown (e.g. from a DOM API)
  When it is caught and displayed
  Then the original error.message is used (not translateApiError)
```

### Phase 3

```gherkin
Scenario: PlanDialog shows localized error on save failure
  Given an admin user saves a plan and the API returns code: 'ALREADY_EXISTS'
  When the dialog displays the error
  Then it shows the localized translation, not the raw English message

Scenario: cache internals are not touched
  Given apps/admin/src/lib/cache/** uses error.message for logging
  When Phase 3 is merged
  Then those files are unmodified
```

### Phase 4

```gherkin
Scenario: every ServiceErrorCode has a common.apiError translation
  Given the guard test runs in CI
  When all ServiceErrorCode enum values are iterated
  Then each has a non-empty common.apiError.<CODE> key in es, en, and pt

Scenario: adding a new error code without a translation fails CI
  Given the guard test exists
  When a developer adds a new ServiceErrorCode value without adding the i18n key
  Then the guard test fails with a clear message listing the missing keys
```

---

## 6. Non-functional requirements

- **Zero breaking changes**: existing web callers of `translateApiError` continue to
  work with zero changes to their import path or call signature.
- **No new runtime dependencies**: the move to `@repo/i18n` uses only already-available
  `trans` + `Locale` from the package. No external library additions.
- **Build order preserved**: `@repo/i18n` is already a dependency of both apps. The
  circular-dependency risk (web's api-errors.ts → @repo/i18n) is resolved by removing
  the web-local helper entirely (it becomes a re-export, not a definition).
- **Test coverage ≥ 90%** on `translateApiError` (inherited from existing 7 tests +
  any new cases for the locale-only path and the missing-reason branch).

---

## 7. Migration must-NOT rules

1. **Do NOT migrate native JS `Error.message`** — only migrate sites where the error
   originated from the Hospeda API and carries `{ code?, message?, reason? }`.
2. **Do NOT touch `apps/admin/src/lib/cache/**`** — these are internal cache-warming
   and invalidation logs, not user-facing errors.
3. **Do NOT modify `toast-error.ts`'s HTTP-status dispatch logic** — it already
   handles HTTP-status buckets with i18n; only add `code`/`reason` lookup where a
   `code` is available.
4. **Do NOT change the error priority logic** in `translateApiError` — the
   `reason → code → message → fallback → GENERIC` chain is correct and tested.

---

## 8. Files touched per phase

### Phase 1

- `packages/i18n/src/api-errors.ts` (NEW — the moved helper + types)
- `packages/i18n/src/index.ts` (add exports)
- `packages/i18n/test/translate-api-error.test.ts` (NEW — ported + extended tests)
- `apps/web/src/lib/api-errors.ts` (MODIFIED — becomes re-export shim)

### Phase 2

- `apps/web/src/components/account/AvatarUpload.client.tsx`
- `apps/web/src/components/account/PreferenceToggles.client.tsx`
- `apps/web/src/components/account/ProfileCompletionAvatarPicker.tsx`
- `apps/web/src/components/host/CreatePropertyMiniForm.client.tsx`
- `apps/web/src/lib/reset-password-status.ts`
- Tests for migrated components (co-located or in `apps/web/test/`)

### Phase 3

- Up to 12 admin feature files (PlanDialog, AddonDialog, RefundDialog,
  exchange-rate components, sponsorship components, CronJobsPanel)
- Tests for migrated admin components

### Phase 4

- `packages/i18n/src/locales/{es,en,pt}/common.json` (add 5 missing keys each)
- `packages/i18n/test/api-error-key-coverage.test.ts` (NEW guard test)
- `packages/i18n/docs/api-error-translation.md` (NEW guide)
- `.qtm/specs/index.json` + `.qtm/tasks/index.json` (flip to completed/archived)

---

## 9. Open questions — ALL RESOLVED

| # | Question | Resolution |
|---|----------|-----------|
| Q1 | Where does the helper live? | `@repo/i18n` — owner approved. |
| Q2 | Migration breadth? | Both apps, genuine API errors only. |
| Q3 | Admin call pattern? | Use `useTranslations()` `t` function. |
| Q4 | Key coverage mechanism? | CI guard test in `packages/i18n/test/`. |

Implementation is unblocked on all phases.
