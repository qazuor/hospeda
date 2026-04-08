---
spec-id: SPEC-035
title: Environment Variables Cleanup, Validation & Documentation
type: infrastructure
complexity: high
status: in-progress
created: 2026-03-07T00:00:00.000Z
approved: null
---

## SPEC-035: Environment Variables Cleanup, Validation & Documentation

## Part 1 - Functional Specification

### 1. Overview & Goals

#### Goal

Reorganize, validate, document, and secure the environment variable management across the entire Hospeda monorepo. This spec addresses inconsistent naming, missing validation, scattered env files, packages reading `process.env` directly, and lack of centralized documentation.

#### Current Problems

1. **Inconsistent naming**: Some vars use `HOSPEDA_*` prefix, others use `API_*`, `DB_*`, or no prefix at all (`MERCADO_PAGO_ACCESS_TOKEN`, `RESEND_API_KEY`, `WEB_URL`, `CRON_SECRET`)
2. **Root .env files**: The API loads env from the monorepo root (`resolve(__dirname, '../../../..')`) instead of its own directory
3. **No per-app env files**: Only root has `.env`/`.env.local`; apps have partial `.env.example` files
4. **Missing validation**: Web app has no Zod startup validation; Admin validates lazily; packages don't validate at all
5. **Packages read process.env directly**: `@repo/notifications`, `@repo/email`, `@repo/db`, `@repo/seed` read env vars directly instead of receiving config via dependency injection
6. **Env vars not in schema**: `MERCADO_PAGO_ACCESS_TOKEN`, `RESEND_API_KEY`, `WEB_URL`, `CRON_ADAPTER` are used in code but NOT declared in the API's Zod schema
7. **Duplicate/conflicting names**: `RESEND_API_KEY` in `@repo/notifications` vs `HOSPEDA_RESEND_API_KEY` in `@repo/email`
8. **Obsolete files**: `.env.github-workflow.example` references deleted package; root `.env.test` should be per-app
9. **Gitignore gaps**: Some apps don't ignore all env patterns consistently
10. **No Vercel sync tooling**: No scripts to pull/push env vars to/from Vercel
11. **Documentation is scattered**: Env docs exist in `docs/environment-variables.md` and `docs/deployment/environments.md` but are outdated and incomplete

#### Decisions Made

| Topic | Decision | Rationale |
|---|---|---|
| Prefixes | `HOSPEDA_*` for shared + secrets; `API_*` for API-only config; `VITE_*`/`PUBLIC_*` for client | Balance between consistency and practicality |
| Env files per app | `.env.example` (committed), `.env.local` (gitignored), `.env.test` (committed) | Minimal set, no `.env.production`/`.env.preview` (covered by `env:pull`) |
| No `.env` base file | Only `.env.example` + `.env.local` + `.env.test` | `.env` is redundant when `.env.local` exists |
| Root env files | Eliminated. Each app owns its env files | Removes cross-directory loading, clearer ownership |
| Package env vars | Full dependency injection (Option A) | Packages already 80-100% DI; completing it is ~5 file changes |
| Vercel sync | Interactive push/pull script + verification script | Safe, explicit, per-var confirmation |
| Docker env | Kept in `docker/`, documented alongside everything else | Docker compose needs its own env |
| Spec structure | Single spec, 7 phases | All env-related, no need to split |

### 2. User Stories

#### US-01: Consistent Naming Convention

**As a** developer,
**I want** all environment variables to follow a consistent naming convention,
**so that** I can immediately tell which app/scope a variable belongs to.

**Acceptance Criteria:**

- **Given** a server-side env var shared by 2+ apps or containing secrets,
  **When** I look at its name,
  **Then** it starts with `HOSPEDA_` (e.g., `HOSPEDA_DATABASE_URL`, `HOSPEDA_RESEND_API_KEY`, `HOSPEDA_CRON_SECRET`)

- **Given** an env var used only by the API for configuration tuning (not a secret),
  **When** I look at its name,
  **Then** it starts with `API_` (e.g., `API_CORS_ORIGINS`, `API_RATE_LIMIT_MAX_REQUESTS`)

- **Given** a client-side env var for the Astro web app,
  **When** I look at its name,
  **Then** it starts with `PUBLIC_` (e.g., `PUBLIC_API_URL`, `PUBLIC_SENTRY_DSN`)

- **Given** a client-side env var for the TanStack admin app,
  **When** I look at its name,
  **Then** it starts with `VITE_` (e.g., `VITE_API_URL`, `VITE_SENTRY_DSN`)

- **Given** the following currently unprefixed vars,
  **When** the migration is complete,
  **Then** they have been renamed:

  | Old Name | New Name | Reason |
  |---|---|---|
  | `MERCADO_PAGO_ACCESS_TOKEN` | `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` | Secret, shared potential |
  | `RESEND_API_KEY` (in notifications) | `HOSPEDA_RESEND_API_KEY` | Secret, unify with email package |
  | `RESEND_FROM_EMAIL` | `HOSPEDA_RESEND_FROM_EMAIL` | Shared config |
  | `RESEND_FROM_NAME` | `HOSPEDA_RESEND_FROM_NAME` | Shared config |
  | `WEB_URL` | `HOSPEDA_SITE_URL` (already exists) | Duplicate, use existing |
  | `API_URL` (in addon.checkout) | `HOSPEDA_API_URL` (already exists) | Duplicate, use existing |
  | `CRON_SECRET` | `HOSPEDA_CRON_SECRET` | Secret |
  | `CRON_ADAPTER` | `HOSPEDA_CRON_ADAPTER` | Shared config |
  | `DISABLE_AUTH` | `HOSPEDA_DISABLE_AUTH` | Test flag with security implications |
  | `ALLOW_MOCK_ACTOR` | `HOSPEDA_ALLOW_MOCK_ACTOR` | Test flag with security implications |
  | `TESTING_RATE_LIMIT` | `HOSPEDA_TESTING_RATE_LIMIT` | Test flag |
  | `TESTING_ORIGIN_VERIFICATION` | `HOSPEDA_TESTING_ORIGIN_VERIFICATION` | Test flag |
  | `DEBUG_TESTS` | `HOSPEDA_DEBUG_TESTS` | Test flag |
  | `COMMIT_SHA` | `HOSPEDA_COMMIT_SHA` | Build metadata |
  | `API_DEBUG_ERRORS` | `HOSPEDA_API_DEBUG_ERRORS` | Security-relevant flag |
  | `SEED_SUPER_ADMIN_PASSWORD` | `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD` | Secret |
  | `DB_POOL_MAX_CONNECTIONS` | `HOSPEDA_DB_POOL_MAX_CONNECTIONS` | Shared DB config |
  | `DB_POOL_IDLE_TIMEOUT_MS` | `HOSPEDA_DB_POOL_IDLE_TIMEOUT_MS` | Shared DB config |
  | `DB_POOL_CONNECTION_TIMEOUT_MS` | `HOSPEDA_DB_POOL_CONNECTION_TIMEOUT_MS` | Shared DB config |
  | `ADMIN_NOTIFICATION_EMAILS` | `HOSPEDA_ADMIN_NOTIFICATION_EMAILS` | Admin email list for disputes/webhooks |
  | `SENTRY_DSN` (in API) | `HOSPEDA_SENTRY_DSN` | Secret, Sentry error tracking |
  | `SENTRY_RELEASE` (in API) | `HOSPEDA_SENTRY_RELEASE` | Build metadata |
  | `SENTRY_PROJECT` (in API) | `HOSPEDA_SENTRY_PROJECT` | Sentry project identifier |

- **Given** any code file in the monorepo,
  **When** it reads an env var,
  **Then** the var name matches one of the approved prefixes (`HOSPEDA_`, `API_`, `PUBLIC_`, `VITE_`, `NODE_ENV`, `CI`, `VERCEL`, `SENTRY_ENVIRONMENT`)

#### US-02: Per-App Env Files

**As a** developer,
**I want** each app to have its own env files,
**so that** I don't need to maintain a root `.env` file and each app is self-contained.

**Acceptance Criteria:**

- **Given** the monorepo root,
  **When** I look for `.env*` files,
  **Then** NO env files exist at the root level (`.env`, `.env.local`, `.env.test` are all deleted)

- **Given** each app (`apps/api`, `apps/web`, `apps/admin`),
  **When** I look for env files,
  **Then** each has exactly:
  - `.env.example` - All vars with placeholder values, inline documentation, grouped by category. Committed to git
  - `.env.test` - Values for running tests (no real secrets, uses test/mock values). Committed to git
  - `.env.local` - Real dev values. Gitignored

- **Given** `docker/`,
  **When** I look for env files,
  **Then** it has `.env.example` (committed) and `.env` (gitignored, used by docker-compose)

- **Given** packages (`packages/*`),
  **When** I look for env files,
  **Then** NO package has `.env*` files (packages receive config via DI, not env files). Exception: `packages/email/.env.example` is deleted

- **Given** the API app (`apps/api/src/utils/env.ts`),
  **When** it loads env vars,
  **Then** it loads from its OWN directory (`apps/api/`), NOT from the monorepo root

- **Given** the `.env.example` file for each app,
  **When** a developer copies it to `.env.local` and fills in values,
  **Then** the app starts without env validation errors

- **Given** the `.env.test` file for each app,
  **When** tests run,
  **Then** they use the per-app `.env.test` values (not root)

#### US-03: Startup Validation

**As a** developer,
**I want** every app to validate ALL required env vars at startup,
**so that** missing or invalid vars are caught immediately with clear error messages.

**Acceptance Criteria:**

- **Given** the API app,
  **When** it starts,
  **Then** ALL env vars (including `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`, `HOSPEDA_RESEND_API_KEY`, `HOSPEDA_CRON_SECRET`, `HOSPEDA_CRON_ADAPTER`, `HOSPEDA_SENTRY_DSN`, `HOSPEDA_SENTRY_RELEASE`, `HOSPEDA_SENTRY_PROJECT`, `HOSPEDA_ADMIN_NOTIFICATION_EMAILS`) are validated by the Zod schema in `apps/api/src/utils/env.ts`

- **Given** the Web app,
  **When** it starts (dev or build),
  **Then** the existing Zod schemas in `apps/web/src/env.ts` (`serverEnvSchema`, `clientEnvSchema`) are validated at startup via a call in `astro.config.ts`. The schema already validates `PUBLIC_API_URL`, `PUBLIC_SITE_URL`, `HOSPEDA_API_URL`, `HOSPEDA_SITE_URL` with a `.refine()` that ensures at least one of each pair is set. Add `HOSPEDA_BETTER_AUTH_URL` (used by auth-client.ts for server-side auth) to the schema

- **Given** the Admin app,
  **When** it starts,
  **Then** `validateAdminEnv()` is called at app initialization (not lazy), validating all `VITE_*` vars including currently missing ones: `VITE_SENTRY_RELEASE`, `VITE_SENTRY_PROJECT`, `VITE_DEBUG_LAZY_SECTIONS`, `VITE_SUPPORTED_LOCALES`, `VITE_DEFAULT_LOCALE`, `VITE_DEBUG_ACTOR_ID`, `VITE_ENABLE_LOGGING`

- **Given** any env var declared as optional in a Zod schema,
  **When** it has a value,
  **Then** the value is validated (e.g., URLs must be valid URLs, numbers must be numeric, booleans must be true/false)

- **Given** an env var is missing and has no default,
  **When** the app starts,
  **Then** the error message includes: the var name, what it's for, where to set it, and an example value

- **Given** the `turbo.json` file,
  **When** I check its `globalEnv` array,
  **Then** it lists ALL env vars that affect build output (updated to match renamed vars)

#### US-04: Package Dependency Injection

**As a** developer,
**I want** shared packages to receive configuration via parameters (not process.env),
**so that** packages are testable, reusable, and don't have hidden env var dependencies.

**Acceptance Criteria:**

- **Given** `@repo/db` (`packages/db/src/client.ts`),
  **When** `getDb()` is called,
  **Then** it does NOT read `process.env.VSCODE_PID`, `process.env.VITEST`, or `process.env.NODE_ENV` directly. Dev detection logic is moved to test setup files

- **Given** `@repo/notifications`,
  **When** `NotificationService` is constructed,
  **Then** it receives `siteUrl` as a constructor parameter (not from `process.env.HOSPEDA_SITE_URL`)

- **Given** `@repo/notifications` Resend config,
  **When** `createResendClient()` is called,
  **Then** it receives `apiKey` as a parameter (not from `process.env.RESEND_API_KEY`)

- **Given** `@repo/notifications` Resend transport,
  **When** `ResendEmailTransport` is constructed,
  **Then** `fromEmail` and `fromName` are REQUIRED constructor parameters (not read from `process.env`)

- **Given** `@repo/email` (`packages/email/src/client.ts`),
  **When** `createEmailClient()` is called,
  **Then** it receives `apiKey` as a parameter (not from `process.env.HOSPEDA_RESEND_API_KEY`)

- **Given** `@repo/seed`,
  **When** it runs,
  **Then** it still reads `HOSPEDA_DATABASE_URL` via dotenv (acceptable for CLI tools) BUT `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD` is passed as parameter where possible

- **Given** any package test,
  **When** tests run,
  **Then** they do NOT require real env vars. All config is passed via test fixtures or mocks

- **Given** the API app's startup (`apps/api/src/index.ts`),
  **When** it initializes notifications,
  **Then** it passes `env.HOSPEDA_RESEND_API_KEY`, `env.HOSPEDA_RESEND_FROM_EMAIL`, `env.HOSPEDA_RESEND_FROM_NAME`, and `env.HOSPEDA_SITE_URL` from its validated env object

#### US-05: Gitignore Security

**As a** developer,
**I want** only `.env.example` and `.env.test` to be committable,
**so that** secrets never accidentally end up in git.

**Acceptance Criteria:**

- **Given** the root `.gitignore`,
  **When** I check env patterns,
  **Then** it ignores: `.env`, `.env.local`, `.env.*.local`, `.env.development.local`, `.env.test.local`, `.env.production.local`, `.env.sandbox`

- **Given** each app's `.gitignore`,
  **When** I check env patterns,
  **Then** it ignores: `.env`, `.env.local`, `.env.*.local`

- **Given** `.env.example` and `.env.test` files,
  **When** I run `git status`,
  **Then** they are tracked (not ignored)

- **Given** any `.env.example` file,
  **When** I inspect its contents,
  **Then** it contains ONLY placeholder values (never real secrets, tokens, or passwords)

- **Given** any `.env.test` file,
  **When** I inspect its contents,
  **Then** it contains ONLY test/mock values (e.g., `HOSPEDA_BETTER_AUTH_SECRET=test-secret-minimum-32-characters-long`, `HOSPEDA_DATABASE_URL=postgresql://test:test@localhost:5432/hospeda_test`)

#### US-06: Vercel Sync Scripts

**As a** developer,
**I want** scripts to sync env vars between my local setup and Vercel,
**so that** I can easily pull production/preview values for debugging or push new vars to Vercel.

**Acceptance Criteria:**

- **Given** the command `pnpm env:pull`,
  **When** I run it,
  **Then** it:
  1. Asks which app (api, web, admin) or "all"
  2. Asks which Vercel environment (development, preview, production)
  3. Uses the Vercel API to fetch env vars for that project+environment
  4. For EACH var, shows: name, current local value (if any), Vercel value, and a description of what the var does
  5. Asks for confirmation before writing each var to the app's `.env.local`
  6. Never overwrites without confirmation
  7. Shows a summary of changes at the end

- **Given** the command `pnpm env:push`,
  **When** I run it,
  **Then** it:
  1. Asks which app (api, web, admin) or "all"
  2. Asks which Vercel environment (development, preview, production)
  3. Reads the app's `.env.local` file
  4. Compares with vars currently in Vercel for that project+environment
  5. For EACH new or changed var, shows: name, local value, current Vercel value (if any), and a description
  6. Asks for confirmation before pushing each var
  7. Never pushes without confirmation
  8. Shows a summary of changes at the end

- **Given** the command `pnpm env:check`,
  **When** I run it,
  **Then** it:
  1. For each app, compares `.env.example` vars vs Vercel vars (all environments)
  2. Reports: vars in `.env.example` but missing in Vercel (by environment)
  3. Reports: vars in Vercel but not in `.env.example` (potentially obsolete)
  4. Reports: vars with different values between environments (for awareness)
  5. Exits with code 0 if all required vars are present, 1 otherwise
  6. Can be run in CI (non-interactive mode with `--ci` flag)

- **Given** the push/pull scripts,
  **When** they need Vercel access,
  **Then** they use a `VERCEL_TOKEN` env var (or `vercel login` session) and the project IDs from `.vercel/project.json`

- **Given** the scripts,
  **When** they display var descriptions,
  **Then** descriptions come from a shared registry (the same source used for `.env.example` comments and documentation)

#### US-07: Centralized Documentation

**As a** developer,
**I want** a single, complete reference document for ALL env vars in the project,
**so that** I can find any var's purpose, valid values, and which apps use it.

**Acceptance Criteria:**

- **Given** the file `docs/guides/environment-variables.md`,
  **When** I open it,
  **Then** it contains:
  1. **Overview section**: Naming convention rules, prefix meanings, file structure
  2. **Shared vars table**: All `HOSPEDA_*` vars with: name, type, required/optional, default, description, which apps use it, where to get the value, example value
  3. **API-only vars table**: All `API_*` vars with same columns
  4. **Web client vars table**: All `PUBLIC_*` vars
  5. **Admin client vars table**: All `VITE_*` vars
  6. **Docker vars table**: Docker-compose specific vars
  7. **Test-only vars table**: Vars only used in `.env.test`
  8. **Environment differences**: Table showing which vars differ between development, preview, and production
  9. **Vercel sync guide**: How to use `env:pull`, `env:push`, `env:check`
  10. **Adding new vars checklist**: Step-by-step for adding a new env var (schema, .env.example, docs, Vercel)

- **Given** the existing `docs/environment-variables.md` and `docs/deployment/environments.md`,
  **When** the migration is complete,
  **Then** they are consolidated into the single `docs/guides/environment-variables.md` file (old files deleted or replaced with redirect)

- **Given** the documentation,
  **When** compared against the actual Zod schemas and `.env.example` files,
  **Then** there are ZERO discrepancies (same var names, same types, same defaults, same required/optional status)

### 3. Out of Scope

- Credential rotation (covered by SPEC-024)
- Staging environment setup (covered by SPEC-025)
- Adding new env vars for new features
- CI/CD workflow changes (only the `env:check` script integration)
- Vercel project configuration (vars are managed via scripts, not restructured)
- Changes to the `@repo/config` package's core architecture (exposeSharedEnv, commonEnvMappings, etc.)

### 4. Dependencies & Constraints

- **SPEC-020** (completed): Created initial `.env.example` files. This spec supersedes and completes that work
- **SPEC-025** (draft): Adds `SENTRY_ENVIRONMENT` var. This spec should include it in the schema and docs
- **SPEC-024** (draft): Credential rotation. Run SPEC-024 AFTER this spec to rotate with correct var names
- **Constraint**: All 3 apps must continue working throughout migration (no breaking changes to running environments)
- **Constraint**: Vercel env vars must be updated to match any renamed vars BEFORE deploying code that uses new names

### 5. UX / DX Considerations

- Error messages on missing env vars must be actionable: include var name, purpose, example value, and which file to edit
- The `env:pull`/`env:push` scripts must be user-friendly with colored output, clear prompts, and summaries
- `.env.example` files serve as both template AND documentation. Every var must have an inline comment
- The "adding new vars" checklist must be simple enough that a junior dev can follow it without mistakes

---

## Part 2 - Technical Specification

### 6. Architecture & Approach

#### 6.1 Env Var Registry (Single Source of Truth)

Create a shared registry at `packages/config/src/env-registry.ts` that defines ALL env vars for the entire project. This registry is consumed by:
- `.env.example` generation (or manual sync)
- Zod schema definitions in each app
- Documentation generation
- Vercel sync scripts (for descriptions)

```typescript
// packages/config/src/env-registry.ts

export interface EnvVarDefinition {
  readonly name: string;
  readonly description: string;
  readonly type: 'string' | 'url' | 'number' | 'boolean' | 'enum';
  readonly required: boolean;
  readonly secret: boolean;
  readonly defaultValue?: string;
  readonly exampleValue: string;
  readonly enumValues?: readonly string[];
  readonly apps: readonly ('api' | 'web' | 'admin' | 'docker' | 'seed')[];
  readonly category: string;
}

export const ENV_REGISTRY: readonly EnvVarDefinition[] = [
  // Shared / Secrets
  {
    name: 'HOSPEDA_DATABASE_URL',
    description: 'PostgreSQL connection string (Neon pooler URL in production)',
    type: 'url',
    required: true,
    secret: true,
    exampleValue: 'postgresql://user:password@host:5432/dbname',
    apps: ['api', 'seed'],
    category: 'database',
  },
  // ... all vars defined here
] as const;
```

#### 6.2 Per-App Env Loading

Each app loads env vars from its own directory:

**API** (`apps/api/src/utils/env.ts`):
```typescript
// BEFORE: loads from monorepo root
const rootDir = resolve(__dirname, '../../../..');

// AFTER: loads from app directory
const appDir = resolve(__dirname, '../..');
const envFiles = [resolve(appDir, '.env.local')];
if (process.env.NODE_ENV === 'test') {
  envFiles.unshift(resolve(appDir, '.env.test'));
}
```

**Web** (Astro): Astro automatically loads `.env.local` from the app directory. No changes needed for loading, but add a Zod startup validator.

**Admin** (Vite/TanStack Start): Vite automatically loads `.env.local` from the app directory. Ensure `validateAdminEnv()` is called eagerly at startup.

#### 6.3 Package DI Refactoring

**@repo/db** (`packages/db/src/client.ts`):
- Remove `process.env.VSCODE_PID`, `process.env.VITEST`, `process.env.NODE_ENV` checks from `getDb()`
- Add a `setDb(client)` function for test setup
- Tests call `setDb()` directly instead of relying on env detection

**@repo/notifications** (`packages/notifications/src/`):
- `config/resend.config.ts`: `createResendClient({ apiKey })` receives apiKey as parameter
- `transports/email/resend-transport.ts`: Make `fromEmail` and `fromName` REQUIRED in constructor options
- `services/notification.service.ts`: Add `siteUrl` to `NotificationServiceDeps` interface

**@repo/email** (`packages/email/src/client.ts`):
- Change `createEmailClient()` to `createEmailClient({ apiKey })` - receive apiKey as parameter

**@repo/seed** (`packages/seed/src/`):
- Keep dotenv loading in CLI entry (acceptable for CLI tools)
- Rename `SEED_SUPER_ADMIN_PASSWORD` to `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD` in the dotenv and code

#### 6.4 Vercel Sync Scripts

Location: `scripts/env/`

```
scripts/env/
  pull.ts          # Interactive pull from Vercel
  push.ts          # Interactive push to Vercel
  check.ts         # Verification/audit script
  utils/
    vercel-api.ts  # Vercel API client wrapper
    registry.ts    # Re-exports from @repo/config env-registry
    prompts.ts     # Interactive prompts (using @inquirer/prompts)
    formatters.ts  # Colored terminal output
```

**Dependencies**: `@inquirer/prompts` (for interactive selection), native `fetch` for Vercel API.

**Vercel API endpoints used**:
- `GET /v1/projects/{projectId}/env` - List env vars
- `POST /v1/projects/{projectId}/env` - Create env var
- `PATCH /v1/projects/{projectId}/env/{envId}` - Update env var

**Project ID resolution**: Read from `apps/{app}/.vercel/project.json` (already exists).

### 7. Files to Create

| File | Purpose |
|---|---|
| `packages/config/src/env-registry.ts` | Single source of truth for all env var definitions |
| `apps/api/.env.example` | API env template (rewrite with full documentation) |
| `apps/api/.env.test` | API test env values |
| `apps/web/.env.example` | Web env template (rewrite with full documentation) |
| `apps/web/.env.test` | Web test env values |
| `apps/admin/.env.example` | Admin env template (rewrite with full documentation) |
| `apps/admin/.env.test` | Admin test env values |
| `docker/.env.example` | Docker env template (rewrite with documentation) |
| `scripts/env/pull.ts` | Interactive Vercel env pull script |
| `scripts/env/push.ts` | Interactive Vercel env push script |
| `scripts/env/check.ts` | Env var verification/audit script |
| `scripts/env/utils/vercel-api.ts` | Vercel API client |
| `scripts/env/utils/registry.ts` | Registry re-export for scripts |
| `scripts/env/utils/prompts.ts` | Interactive prompts |
| `scripts/env/utils/formatters.ts` | Terminal formatting |
| `docs/guides/environment-variables.md` | Centralized env var documentation |

### 8. Files to Modify

| File | Change |
|---|---|
| `apps/api/src/utils/env.ts` | Change dotenv path to app dir; add missing vars to schema (`HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`, `HOSPEDA_RESEND_API_KEY`, `HOSPEDA_RESEND_FROM_EMAIL`, `HOSPEDA_RESEND_FROM_NAME`, `HOSPEDA_CRON_ADAPTER`, `HOSPEDA_SENTRY_DSN`, `HOSPEDA_SENTRY_RELEASE`, `HOSPEDA_SENTRY_PROJECT`, `HOSPEDA_ADMIN_NOTIFICATION_EMAILS`, `HOSPEDA_TESTING_ORIGIN_VERIFICATION`); rename all vars per US-01 |
| `apps/api/src/services/addon.checkout.ts` | Replace `process.env.MERCADO_PAGO_ACCESS_TOKEN` with `env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`; replace `process.env.WEB_URL` with `env.HOSPEDA_SITE_URL`; replace `process.env.API_URL` with `env.HOSPEDA_API_URL` |
| `apps/api/src/services/trial.service.ts` | Replace `process.env.WEB_URL` with `env.HOSPEDA_SITE_URL` |
| `apps/api/src/services/promo-code.crud.ts` | Replace `process.env.NODE_ENV` with `env.NODE_ENV` for `livemode` |
| `apps/api/src/services/promo-code.redemption.ts` | Replace `process.env.NODE_ENV` with `env.NODE_ENV` for `livemode` |
| `apps/api/src/cron/bootstrap.ts` | Replace `process.env.CRON_ADAPTER` with `env.HOSPEDA_CRON_ADAPTER`; replace `process.env.CRON_SECRET` with `env.HOSPEDA_CRON_SECRET` |
| `apps/api/src/cron/middleware.ts` | Replace `process.env.CRON_SECRET` with `env.HOSPEDA_CRON_SECRET` |
| `apps/api/src/cron/jobs/notification-schedule.job.ts` | Replace `process.env.WEB_URL` with injected site URL (2 occurrences: lines 212 and 291) |
| `apps/api/src/utils/notification-helper.ts` | Pass config from `env` to notification service instead of env reading |
| `apps/api/src/lib/sentry.ts` | Replace `process.env.SENTRY_DSN` with `env.HOSPEDA_SENTRY_DSN`; replace `process.env.SENTRY_RELEASE` with `env.HOSPEDA_SENTRY_RELEASE`; replace `process.env.SENTRY_PROJECT` with `env.HOSPEDA_SENTRY_PROJECT` |
| `apps/api/src/lib/auth.ts` | Replace all direct `process.env.HOSPEDA_*` reads with `env.*` from validated env object |
| `apps/api/src/app.ts` | Replace `process.env.NODE_ENV` with `env.NODE_ENV` |
| `apps/api/src/index.ts` | Replace `process.env.NODE_ENV` with `env.NODE_ENV` |
| `apps/api/src/middlewares/auth.ts` | Replace `process.env.DISABLE_AUTH` with `env.HOSPEDA_DISABLE_AUTH`; replace `process.env.CI` with `env` check |
| `apps/api/src/middlewares/actor.ts` | Replace `process.env.ALLOW_MOCK_ACTOR` with `env.HOSPEDA_ALLOW_MOCK_ACTOR`; replace `process.env.CI` with `env` check |
| `apps/api/src/middlewares/security.ts` | Replace `process.env.NODE_ENV` with `env.NODE_ENV`; replace `process.env.TESTING_ORIGIN_VERIFICATION` with `env.HOSPEDA_TESTING_ORIGIN_VERIFICATION` |
| `apps/api/src/middlewares/rate-limit.ts` | Replace `process.env.TESTING_RATE_LIMIT` with `env.HOSPEDA_TESTING_RATE_LIMIT`; replace `process.env.HOSPEDA_REDIS_URL` with `env.HOSPEDA_REDIS_URL`; replace `process.env.NODE_ENV` with `env.NODE_ENV` |
| `apps/api/src/middlewares/metrics.ts` | Replace `process.env.API_METRICS_*` with `env.API_METRICS_*` |
| `apps/api/src/middlewares/logger.ts` | Replace `process.env.API_LOG_LEVEL` with `env.API_LOG_LEVEL` |
| `apps/api/src/middlewares/billing.ts` | Replace `process.env.NODE_ENV` with `env.NODE_ENV` for `livemode`/`sandbox` |
| `apps/api/src/middlewares/response.ts` | Replace `process.env.NODE_ENV` with `env.NODE_ENV`; replace `process.env.API_DEBUG_ERRORS` with `env.HOSPEDA_API_DEBUG_ERRORS` |
| `apps/api/src/middlewares/response-validator.ts` | Replace `process.env.NODE_ENV` with `env.NODE_ENV` |
| `apps/api/src/utils/response-helpers.ts` | Replace all `process.env.NODE_ENV` occurrences with `env.NODE_ENV` (7+ occurrences) |
| `apps/api/src/utils/redis.ts` | Replace `process.env.HOSPEDA_REDIS_URL` with `env.HOSPEDA_REDIS_URL` |
| `apps/api/src/utils/create-app.ts` | Replace `process.env.NODE_ENV` and `process.env.VERCEL` with env object |
| `apps/api/src/utils/user-cache.ts` | Replace `process.env.VERCEL` with env check |
| `apps/api/src/types/validation-config.ts` | Replace all `process.env.API_VALIDATION_*` with `env.API_VALIDATION_*` |
| `apps/api/src/routes/webhooks/mercadopago/notifications.ts` | Replace `process.env.ADMIN_NOTIFICATION_EMAILS` with `env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS` |
| `apps/api/src/routes/webhooks/mercadopago/dispute-logic.ts` | Replace `process.env.ADMIN_NOTIFICATION_EMAILS` with `env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS` |
| `apps/admin/src/env.ts` | Add missing vars to schema: `VITE_SENTRY_RELEASE`, `VITE_SENTRY_PROJECT`, `VITE_DEBUG_LAZY_SECTIONS`, `VITE_SUPPORTED_LOCALES`, `VITE_DEFAULT_LOCALE`, `VITE_DEBUG_ACTOR_ID`, `VITE_ENABLE_LOGGING` |
| `apps/admin/src/routes/__root.tsx` | Call `validateAdminEnv()` eagerly in root route |
| `apps/admin/src/utils/logger.ts` | Ensure `VITE_ENABLE_LOGGING` comes from validated env |
| `apps/web/astro.config.ts` | Add startup validation call using `serverEnvSchema` from `src/env.ts` |
| `apps/web/src/env.ts` | Add `HOSPEDA_BETTER_AUTH_URL` to `serverEnvSchema`; add `PUBLIC_SENTRY_DSN` to `clientEnvSchema`; add startup validation function |
| `apps/web/src/lib/env.ts` | Refactor to use validated env from `src/env.ts` instead of fallback chains |
| `apps/web/src/lib/middleware-helpers.ts` | Use validated env instead of fallback chain |
| `apps/web/src/lib/logger.ts` | Ensure `VITE_ENABLE_LOGGING` usage is consistent |
| `packages/db/src/client.ts` | Remove env var checks from `getDb()`, add `setDb()` |
| `packages/notifications/src/config/resend.config.ts` | `createResendClient({ apiKey })` parameter |
| `packages/notifications/src/transports/email/resend-transport.ts` | Make `fromEmail`/`fromName` required constructor params |
| `packages/notifications/src/services/notification.service.ts` | Add `siteUrl` to deps interface |
| `packages/email/src/client.ts` | `createEmailClient({ apiKey })` parameter |
| `packages/seed/src/utils/superAdminLoader.ts` | Rename to `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD` |
| `packages/config/src/index.ts` | Export env-registry |
| `turbo.json` | Update `globalEnv` with renamed vars |
| `.gitignore` | Ensure all env patterns are covered |
| `apps/api/.gitignore` | Add complete env patterns |
| `apps/web/.gitignore` | Add complete env patterns |
| `apps/admin/.gitignore` | Clean up, ensure env patterns |
| `package.json` (root) | Add `env:pull`, `env:push`, `env:check` scripts |
| `scripts/setup-test-db.ts` | Update to use per-app `.env.test` path |

### 9. Files to Delete

| File | Reason |
|---|---|
| `.env` (root) | Migrated to per-app |
| `.env.local` (root) | Migrated to per-app |
| `.env.test` (root) | Migrated to per-app |
| `.env.example` (root) | Migrated to per-app |
| `.env.github-workflow.example` (root) | Obsolete (package deleted) - already removed |
| `apps/admin/.env` | Should only be `.env.local` |
| `packages/email/.env.example` | Packages don't have env files |
| `docs/environment-variables.md` | Consolidated into `docs/guides/environment-variables.md` |

### 10. Testing Strategy

#### 10.1 Per-App `.env.test` Files

Each app gets a `.env.test` with safe test values:

**apps/api/.env.test**:
```env
NODE_ENV=test
API_PORT=3001
API_HOST=localhost
HOSPEDA_API_URL=http://localhost:3001
HOSPEDA_DATABASE_URL=postgresql://hospeda:hospeda@localhost:5432/hospeda_test
HOSPEDA_BETTER_AUTH_SECRET=test-secret-key-minimum-32-characters-long-for-testing
HOSPEDA_SITE_URL=http://localhost:4321
HOSPEDA_ADMIN_URL=http://localhost:3000
HOSPEDA_DISABLE_AUTH=true
HOSPEDA_ALLOW_MOCK_ACTOR=true
HOSPEDA_CRON_SECRET=test-cron-secret
HOSPEDA_CRON_ADAPTER=manual
# Optional vars - not needed for basic tests
# HOSPEDA_RESEND_API_KEY=re_test_key
# HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN=TEST-token
```

**apps/web/.env.test**:
```env
PUBLIC_API_URL=http://localhost:3001
PUBLIC_SITE_URL=http://localhost:4321
HOSPEDA_API_URL=http://localhost:3001
HOSPEDA_SITE_URL=http://localhost:4321
HOSPEDA_BETTER_AUTH_URL=http://localhost:3001/api/auth
```

**apps/admin/.env.test**:
```env
VITE_API_URL=http://localhost:3001
VITE_BETTER_AUTH_URL=http://localhost:3001/api/auth
VITE_APP_NAME=Hospeda Admin Test
```

#### 10.2 Test Cases to Add/Update

- **Env validation tests**: Each app should test that its Zod schema rejects missing required vars and accepts valid configs
- **Package DI tests**: Verify packages work when config is passed as parameters
- **Script tests**: Unit tests for `env:check` script logic (not for push/pull since they need Vercel API)

#### 10.3 Existing Test Updates

All existing tests that set `process.env` vars directly (e.g., in `packages/db/test/`, `packages/email/test/`) must be updated to use the new var names and DI patterns.

### 11. Migration Safety

#### 11.1 Vercel Environment Update Order

**CRITICAL**: When renaming env vars, the Vercel environment must be updated BEFORE deploying code that uses the new names. The safe order is:

1. Add new-named vars to Vercel (keeping old vars too)
2. Deploy code that reads new names
3. Remove old-named vars from Vercel

#### 11.2 Backward Compatibility Period

During migration, the API Zod schema should temporarily accept BOTH old and new names:

```typescript
// Temporary: accept both during migration
HOSPEDA_CRON_SECRET: z.string().optional(),
CRON_SECRET: z.string().optional(),
// .superRefine to check at least one is provided
```

This temporary dual-acceptance is removed in the final phase.

### 12. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Renaming vars breaks production deploy | Medium | High | Add new vars to Vercel first, keep old ones during transition |
| Tests fail due to env changes | High | Medium | Update `.env.test` files before changing code |
| Developer confusion during migration | Medium | Low | Clear commit messages, update CLAUDE.md, team communication |
| Vercel sync script accidentally overwrites | Low | High | Interactive confirmation per var, never auto-overwrites |
| Package DI refactor breaks consumers | Low | Medium | Changes are minimal (~5 files), test thoroughly |

---

## Part 3 - Implementation Phases

### Phase 1: Env Var Registry & Audit (Foundation)

**Goal**: Create the single source of truth and identify all discrepancies.

**Tasks**:
1. Create `packages/config/src/env-registry.ts` with ALL env var definitions
2. Export from `packages/config/src/index.ts`
3. Write unit tests for the registry (validate no duplicates, all have descriptions, etc.)
4. Audit: Compare registry against actual `process.env` / `import.meta.env` usage in codebase
5. Document any vars found in code but not in registry (and add them)

**Definition of Done**: Registry exists, is tested, and matches 100% of env vars used in the codebase.

### Phase 2: Rename Inconsistent Vars

**Goal**: Unify all env var names to follow the prefix convention.

**Tasks**:
1. Update API Zod schema (`apps/api/src/utils/env.ts`) with ALL renamed vars (keep old names temporarily with `.transform()`)
2. Update all `process.env.*` references in `apps/api/src/` to use `env.*` with new names:
   - `addon.checkout.ts`: `MERCADO_PAGO_ACCESS_TOKEN` -> `env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`, `WEB_URL` -> `env.HOSPEDA_SITE_URL`, `API_URL` -> `env.HOSPEDA_API_URL`
   - `trial.service.ts`: `WEB_URL` -> `env.HOSPEDA_SITE_URL`
   - `cron/bootstrap.ts`: `CRON_ADAPTER` -> `env.HOSPEDA_CRON_ADAPTER`, `CRON_SECRET` -> `env.HOSPEDA_CRON_SECRET`
   - `cron/middleware.ts`: `CRON_SECRET` -> `env.HOSPEDA_CRON_SECRET`
   - `middlewares/auth.ts`: `DISABLE_AUTH` -> `env.HOSPEDA_DISABLE_AUTH`
   - `middlewares/actor.ts`: `ALLOW_MOCK_ACTOR` -> `env.HOSPEDA_ALLOW_MOCK_ACTOR`
   - `middlewares/security.ts`: `TESTING_ORIGIN_VERIFICATION` -> `env.HOSPEDA_TESTING_ORIGIN_VERIFICATION`
   - `middlewares/rate-limit.ts`: `TESTING_RATE_LIMIT` -> `env.HOSPEDA_TESTING_RATE_LIMIT`
   - `middlewares/response.ts`: `API_DEBUG_ERRORS` -> `env.HOSPEDA_API_DEBUG_ERRORS`
   - `middlewares/logger.ts`: `API_LOG_LEVEL` -> `env.API_LOG_LEVEL`
   - `middlewares/metrics.ts`: `API_METRICS_*` -> `env.API_METRICS_*`
   - `middlewares/billing.ts`: `process.env.NODE_ENV` -> `env.NODE_ENV` for livemode/sandbox
   - `middlewares/response-validator.ts`: `process.env.NODE_ENV` -> `env.NODE_ENV`
   - `utils/redis.ts`: already correct (`env.HOSPEDA_REDIS_URL`)
   - `utils/notification-helper.ts`: `RESEND_API_KEY` -> pass from env
   - `utils/response-helpers.ts`: all `process.env.NODE_ENV` occurrences -> `env.NODE_ENV` (7+ lines)
   - `utils/create-app.ts`: `process.env.NODE_ENV` -> `env.NODE_ENV`, `process.env.VERCEL` check
   - `utils/user-cache.ts`: `process.env.VERCEL` check
   - `cron/jobs/notification-schedule.job.ts`: `WEB_URL` -> injected (2 occurrences: lines 212 and 291)
   - `types/validation-config.ts`: All `process.env.API_VALIDATION_*` -> `env.API_VALIDATION_*`
   - `lib/sentry.ts`: `SENTRY_DSN` -> `env.HOSPEDA_SENTRY_DSN`, `SENTRY_RELEASE` -> `env.HOSPEDA_SENTRY_RELEASE`, `SENTRY_PROJECT` -> `env.HOSPEDA_SENTRY_PROJECT`
   - `lib/auth.ts`: All direct `process.env.HOSPEDA_*` reads -> `env.*`
   - `app.ts`: `process.env.NODE_ENV` -> `env.NODE_ENV`
   - `index.ts`: `process.env.NODE_ENV` -> `env.NODE_ENV`
   - `services/promo-code.crud.ts`: `process.env.NODE_ENV` -> `env.NODE_ENV` for livemode
   - `services/promo-code.redemption.ts`: `process.env.NODE_ENV` -> `env.NODE_ENV` for livemode
   - `routes/webhooks/mercadopago/notifications.ts`: `ADMIN_NOTIFICATION_EMAILS` -> `env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS`
   - `routes/webhooks/mercadopago/dispute-logic.ts`: `ADMIN_NOTIFICATION_EMAILS` -> `env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS`
3. Update `packages/seed/src/utils/superAdminLoader.ts`: `SEED_SUPER_ADMIN_PASSWORD` -> `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD`
4. Update `turbo.json` `globalEnv` with renamed vars
5. Update existing tests that use `vi.stubEnv()` or `process.env` with old var names (search for all old names in test files)
6. Run `pnpm typecheck && pnpm lint && pnpm test` to verify

**Definition of Done**: All env var names follow the prefix convention. All tests pass. No `process.env` reads for renamed vars remain in the codebase.

### Phase 3: Package DI Refactoring

**Goal**: Remove direct `process.env` reads from shared packages.

**Tasks**:
1. `@repo/db` (`packages/db/src/client.ts`):
   - Remove `process.env.VSCODE_PID`, `process.env.VITEST`, `process.env.NODE_ENV` checks from `getDb()`
   - Add `setDb(client: DrizzleClient)` function for test setup
   - Update `packages/db/test/utils/test-db.ts` to use `setDb()`
   - Update all db tests that relied on env detection

2. `@repo/notifications`:
   - `config/resend.config.ts`: Change `createResendClient()` signature to `createResendClient({ apiKey }: { apiKey: string })`
   - `transports/email/resend-transport.ts`: Make `fromEmail` and `fromName` required in constructor options interface (remove `process.env` fallback)
   - `services/notification.service.ts`: Add `siteUrl: string` to `NotificationServiceDeps` interface, remove `process.env` getter

3. `@repo/email` (`packages/email/src/client.ts`):
   - Change to `createEmailClient({ apiKey }: { apiKey: string })`

4. Update consumers:
   - `apps/api/src/utils/notification-helper.ts`: Pass `env.HOSPEDA_RESEND_API_KEY`, `env.HOSPEDA_RESEND_FROM_EMAIL`, `env.HOSPEDA_RESEND_FROM_NAME`, `env.HOSPEDA_SITE_URL` when creating notification service
   - Any other consumer of `@repo/email`

5. Update all package tests to use DI (pass config as params, no env mocking)
6. Run `pnpm typecheck && pnpm lint && pnpm test`

**Definition of Done**: No package in `packages/` reads `process.env` directly (except `@repo/config` utilities and `@repo/seed` CLI entry). All package tests pass without setting env vars.

### Phase 4: Per-App Env Files & Loading

**Goal**: Each app owns its env files; root env files are deleted.

**Tasks**:
1. Create per-app `.env.example` files with full inline documentation (grouped by category, all vars listed, required marked, optional commented out)
2. Create per-app `.env.test` files with safe test values
3. Create `.env.local` files for each app (copy from root, adjust paths) - these are gitignored, instructions in `.env.example`
4. Update `apps/api/src/utils/env.ts` dotenv loading to use app directory instead of root
5. Enhance `apps/web/src/env.ts` (already exists with `serverEnvSchema` and `clientEnvSchema`):
   - Add `HOSPEDA_BETTER_AUTH_URL` to `serverEnvSchema`
   - Add a `validateWebEnv()` function that calls `serverEnvSchema.parse(import.meta.env)`
   - Call it in `astro.config.ts` via an integration hook or Vite plugin
6. Refactor `apps/web/src/lib/env.ts` to use validated env from `src/env.ts` instead of fallback chains
7. Ensure `apps/admin` calls `validateAdminEnv()` eagerly in `__root.tsx`
8. Add missing vars to `AdminEnvSchema` in `apps/admin/src/env.ts`: `VITE_SENTRY_RELEASE`, `VITE_SENTRY_PROJECT`, `VITE_DEBUG_LAZY_SECTIONS`, `VITE_SUPPORTED_LOCALES`, `VITE_DEFAULT_LOCALE`, `VITE_DEBUG_ACTOR_ID`, `VITE_ENABLE_LOGGING` (all optional with defaults)
7. Update `scripts/setup-test-db.ts` to use per-app `.env.test` path
8. Delete root env files: `.env`, `.env.local`, `.env.test`, `.env.example`
9. Delete `apps/admin/.env` (should be `.env.local` only)
10. Delete `packages/email/.env.example`
11. Update `.gitignore` patterns (root and per-app)
12. Run `pnpm typecheck && pnpm lint && pnpm test`
13. Verify each app starts correctly with `pnpm dev`

**Definition of Done**: No env files at root. Each app has `.env.example` + `.env.test`. Apps load env from their own directory. All apps start and tests pass.

### Phase 5: Gitignore Hardening

**Goal**: Ensure only `.env.example` and `.env.test` can be committed.

**Tasks**:
1. Update root `.gitignore`:
   ```
   # Environment variables
   .env
   .env.local
   .env.*.local
   .env.development.local
   .env.test.local
   .env.production.local
   .env.sandbox
   # Note: .env.example and .env.test are NOT ignored (committed)
   ```

2. Update each app's `.gitignore` to have consistent patterns:
   ```
   .env
   .env.local
   .env.*.local
   ```

3. Update `docker/.gitignore` (create if needed):
   ```
   .env
   ```

4. Verify with `git status` that only `.env.example` and `.env.test` files are tracked
5. Remove any `.env` files that are currently tracked by git (e.g., `apps/admin/.env`)

**Definition of Done**: `git ls-files | grep '\.env'` shows ONLY `.env.example` and `.env.test` files. No secrets are trackable.

### Phase 6: Vercel Sync Scripts

**Goal**: Create interactive scripts for managing env vars in Vercel.

**Tasks**:
1. Add `@inquirer/prompts` as a dev dependency in root `package.json`
2. Create `scripts/env/utils/vercel-api.ts`:
   - Vercel API client using native `fetch`
   - Methods: `listEnvVars()`, `createEnvVar()`, `updateEnvVar()`
   - Read project IDs from `apps/{app}/.vercel/project.json`
   - Auth via `VERCEL_TOKEN` env var

3. Create `scripts/env/utils/registry.ts`:
   - Import and re-export env registry from `@repo/config`
   - Helper to look up var descriptions by name

4. Create `scripts/env/utils/prompts.ts`:
   - Interactive prompts for app selection, environment selection, per-var confirmation
   - Uses `@inquirer/prompts`

5. Create `scripts/env/utils/formatters.ts`:
   - Colored terminal output for diffs, summaries, warnings
   - Table formatting for var comparison

6. Create `scripts/env/pull.ts`:
   - Interactive pull flow as described in US-06
   - Reads from Vercel API, writes to `.env.local`

7. Create `scripts/env/push.ts`:
   - Interactive push flow as described in US-06
   - Reads from `.env.local`, pushes to Vercel API

8. Create `scripts/env/check.ts`:
   - Verification/audit flow as described in US-06
   - Supports `--ci` flag for non-interactive mode
   - Exits with code 1 if required vars are missing

9. Add npm scripts to root `package.json`:
   ```json
   "env:pull": "tsx scripts/env/pull.ts",
   "env:push": "tsx scripts/env/push.ts",
   "env:check": "tsx scripts/env/check.ts"
   ```

10. Write unit tests for `check.ts` logic (mock Vercel API responses)
11. Test manually: pull from Vercel, push a test var, run check

**Definition of Done**: All 3 scripts work interactively. `env:check --ci` can run in CI. Unit tests pass for check logic.

### Phase 7: Documentation & Cleanup

**Goal**: Centralized, complete, accurate documentation.

**Tasks**:
1. Create `docs/guides/environment-variables.md` with all sections from US-07
2. Generate/sync content from `packages/config/src/env-registry.ts` to ensure accuracy
3. Delete or redirect old docs:
   - `docs/environment-variables.md` -> redirect to new location
   - `docs/deployment/environments.md` -> keep deployment-specific parts, link to new env doc for var reference
4. Update CLAUDE.md references to env documentation
5. Update each app's CLAUDE.md "Environment Variables" section to reference the centralized doc
6. Add "Adding a New Env Var" checklist to the doc:
   1. Add to `packages/config/src/env-registry.ts`
   2. Add to the app's Zod schema
   3. Add to the app's `.env.example` with documentation comment
   4. Add to the app's `.env.test` if needed for tests
   5. Add to Vercel via `pnpm env:push` or dashboard
   6. Update `turbo.json` `globalEnv` if it affects build output
   7. Update `docs/guides/environment-variables.md`
7. Remove backward-compatibility transforms from Phase 2 (if migration is complete)
8. Final verification: `pnpm typecheck && pnpm lint && pnpm test` on clean checkout
9. Run `pnpm env:check` to verify Vercel alignment

**Definition of Done**: Single doc covers all env vars. All CLAUDE.md files reference it. No outdated env documentation remains. All quality checks pass.

---

## Appendix A: Complete Env Var Inventory (Current -> New)

### Shared / Secrets (`HOSPEDA_*`)

| Current Name | New Name | Required | Apps | Description |
|---|---|---|---|---|
| `HOSPEDA_DATABASE_URL` | (no change) | Yes | api, seed | PostgreSQL connection string |
| `HOSPEDA_BETTER_AUTH_SECRET` | (no change) | Yes | api | Better Auth session signing secret |
| `HOSPEDA_BETTER_AUTH_URL` | (no change) | Yes (web, admin) | api, web, admin | Better Auth endpoint URL |
| `HOSPEDA_API_URL` | (no change) | Yes | api, web, admin | API base URL |
| `HOSPEDA_SITE_URL` | (no change) | Yes | api, web | Web app base URL |
| `HOSPEDA_ADMIN_URL` | (no change) | Optional | api | Admin app URL (CORS) |
| `HOSPEDA_REDIS_URL` | (no change) | Prod only | api | Redis URL for rate limiting |
| `HOSPEDA_GOOGLE_CLIENT_ID` | (no change) | Optional | api | Google OAuth client ID |
| `HOSPEDA_GOOGLE_CLIENT_SECRET` | (no change) | Optional | api | Google OAuth secret |
| `HOSPEDA_FACEBOOK_CLIENT_ID` | (no change) | Optional | api | Facebook OAuth client ID |
| `HOSPEDA_FACEBOOK_CLIENT_SECRET` | (no change) | Optional | api | Facebook OAuth secret |
| `HOSPEDA_LINEAR_API_KEY` | (no change) | Optional | api | Linear bug report API key |
| `HOSPEDA_LINEAR_TEAM_ID` | (no change) | Optional | api | Linear team ID |
| `HOSPEDA_EXCHANGE_RATE_API_KEY` | (no change) | Optional | api | ExchangeRate-API key |
| `HOSPEDA_DOLAR_API_BASE_URL` | (no change) | Optional | api | DolarAPI base URL (defined in `@repo/config` exchange-rate schema, not in ApiEnvSchema - add to ApiEnvSchema) |
| `HOSPEDA_EXCHANGE_RATE_API_BASE_URL` | (no change) | Optional | api | ExchangeRate-API base URL (defined in `@repo/config` exchange-rate schema, not in ApiEnvSchema - add to ApiEnvSchema) |
| `MERCADO_PAGO_ACCESS_TOKEN` | `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` | Optional | api | MercadoPago API token |
| `RESEND_API_KEY` | `HOSPEDA_RESEND_API_KEY` | Optional | api | Resend email API key |
| `RESEND_FROM_EMAIL` | `HOSPEDA_RESEND_FROM_EMAIL` | Optional | api | Sender email address |
| `RESEND_FROM_NAME` | `HOSPEDA_RESEND_FROM_NAME` | Optional | api | Sender display name |
| `CRON_SECRET` | `HOSPEDA_CRON_SECRET` | Prod only | api | Cron endpoint auth secret |
| `CRON_ADAPTER` | `HOSPEDA_CRON_ADAPTER` | Optional | api | Cron scheduler type |
| `DISABLE_AUTH` | `HOSPEDA_DISABLE_AUTH` | Test only | api | Bypass auth in tests |
| `ALLOW_MOCK_ACTOR` | `HOSPEDA_ALLOW_MOCK_ACTOR` | Test only | api | Allow mock actors in tests |
| `TESTING_RATE_LIMIT` | `HOSPEDA_TESTING_RATE_LIMIT` | Test only | api | Enable rate limit in tests |
| `TESTING_ORIGIN_VERIFICATION` | `HOSPEDA_TESTING_ORIGIN_VERIFICATION` | Test only | api | Enable origin check in tests |
| `DEBUG_TESTS` | `HOSPEDA_DEBUG_TESTS` | Test only | api | Verbose test logging |
| `API_DEBUG_ERRORS` | `HOSPEDA_API_DEBUG_ERRORS` | Optional | api | Show error details in responses |
| `COMMIT_SHA` | `HOSPEDA_COMMIT_SHA` | Optional | api | Build commit SHA |
| `SEED_SUPER_ADMIN_PASSWORD` | `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD` | Optional | seed | Super admin password for seeding |
| `DB_POOL_MAX_CONNECTIONS` | `HOSPEDA_DB_POOL_MAX_CONNECTIONS` | Optional | api | DB pool max connections |
| `DB_POOL_IDLE_TIMEOUT_MS` | `HOSPEDA_DB_POOL_IDLE_TIMEOUT_MS` | Optional | api | DB pool idle timeout |
| `DB_POOL_CONNECTION_TIMEOUT_MS` | `HOSPEDA_DB_POOL_CONNECTION_TIMEOUT_MS` | Optional | api | DB pool connection timeout |
| `ADMIN_NOTIFICATION_EMAILS` | `HOSPEDA_ADMIN_NOTIFICATION_EMAILS` | Optional | api | Comma-separated admin emails for dispute/webhook notifications |
| `SENTRY_DSN` (API) | `HOSPEDA_SENTRY_DSN` | Optional | api | Sentry DSN for API error tracking |
| `SENTRY_RELEASE` (API) | `HOSPEDA_SENTRY_RELEASE` | Optional | api | Sentry release identifier |
| `SENTRY_PROJECT` (API) | `HOSPEDA_SENTRY_PROJECT` | Optional | api | Sentry project name |

### API-Only Config (`API_*`) - No changes needed

All `API_CORS_*`, `API_CACHE_*`, `API_COMPRESSION_*`, `API_RATE_LIMIT_*`, `API_SECURITY_*`, `API_VALIDATION_*`, `API_RESPONSE_*`, `API_METRICS_*`, `API_LOG_*`, `API_PORT`, `API_HOST` vars keep their names. They are API-only tuning parameters, not secrets.

### Client-Side Web (`PUBLIC_*`) - No changes needed

| Name | Required | Description |
|---|---|---|
| `PUBLIC_API_URL` | Yes | API endpoint for browser |
| `PUBLIC_SITE_URL` | Yes | Site URL for browser |
| `PUBLIC_SENTRY_DSN` | Optional | Sentry DSN for error tracking |
| `PUBLIC_SENTRY_RELEASE` | Optional | Sentry release identifier |

### Client-Side Admin (`VITE_*`) - No changes needed

| Name | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | API endpoint |
| `VITE_BETTER_AUTH_URL` | Yes | Better Auth URL |
| `VITE_APP_NAME` | Optional | App display name |
| `VITE_APP_VERSION` | Optional | App version |
| `VITE_APP_DESCRIPTION` | Optional | App description |
| `VITE_ENABLE_DEVTOOLS` | Optional | Enable React DevTools |
| `VITE_ENABLE_QUERY_DEVTOOLS` | Optional | Enable Query DevTools |
| `VITE_ENABLE_ROUTER_DEVTOOLS` | Optional | Enable Router DevTools |
| `VITE_DEFAULT_PAGE_SIZE` | Optional | Default pagination size |
| `VITE_MAX_PAGE_SIZE` | Optional | Max pagination size |
| `VITE_SENTRY_DSN` | Optional | Sentry DSN |
| `VITE_SENTRY_RELEASE` | Optional | Sentry release |
| `VITE_SENTRY_PROJECT` | Optional | Sentry project name |
| `VITE_DEBUG_LAZY_SECTIONS` | Optional | Debug lazy section loading |
| `VITE_DEBUG_ACTOR_ID` | Optional | Debug actor ID for testing |
| `VITE_ENABLE_LOGGING` | Optional | Enable client-side logging |
| `VITE_SUPPORTED_LOCALES` | Optional | Supported locales list |
| `VITE_DEFAULT_LOCALE` | Optional | Default locale |

### System / Framework Vars (no prefix, no changes)

| Name | Description |
|---|---|
| `NODE_ENV` | Node environment (development, production, test) |
| `CI` | CI environment flag |
| `VERCEL` | Vercel serverless environment detection |
| `VERCEL_GIT_COMMIT_SHA` | Vercel-provided commit SHA |
| `SENTRY_ENVIRONMENT` | Sentry environment tag (from SPEC-025) |

### Docker Vars

| Name | Required | Description |
|---|---|---|
| `POSTGRES_USER` | Yes | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `POSTGRES_DB` | Yes | PostgreSQL database name |
| `POSTGRES_PORT` | Optional | PostgreSQL port (default: 5432) |
| `REDIS_PORT` | Optional | Redis port (default: 6379) |
