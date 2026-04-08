---
spec-id: SPEC-020
title: Deployment Readiness & Code Quality
type: infrastructure
complexity: high
status: completed
created: 2026-02-27T00:00:00.000Z
completed: 2026-03-01T00:00:00.000Z
---

## SPEC-020: Deployment Readiness & Code Quality

## Part 1 - Functional Specification

### 1. Overview & Goals

#### Goal

Resolve all critical and high-priority blockers that prevent the Hospeda platform from being deployed reliably to production (Fly.io for the API, Vercel for web and admin), and address the code quality issues that increase maintenance risk and reduce developer confidence.

#### Motivation

A comprehensive production readiness audit identified 26 action items across two categories: deployment blockers and code quality issues. The most urgent are a stack overflow in the admin SSR build that prevents any admin deployment, a completely outdated API production manifest, and a broken test suite that makes CI unreliable. Without resolving these, no production deployment is possible and no code change can be validated automatically.

#### Success Metrics

- `pnpm build` succeeds for all three apps (admin SSR build no longer overflows)
- `pnpm test` passes with zero errors in all packages
- `pnpm typecheck` passes with zero errors in all packages
- A single `pnpm deploy:api` command deploys the API to Fly.io using correct port and dependencies
- `.env.example` files exist for all three apps documenting every required variable
- CI workflow references only Better Auth variables (no Clerk remnants)
- `turbo.json` reflects current dependency graph and correct build outputs
- `apps/web` prerender conflict resolved (no static page reads request headers)
- Sentry error reporting active in all three apps including `apps/web`
- `@sentry/react` moved to production dependencies in `apps/admin`
- Database migration workflow documented and separated from development push
- API process exits cleanly after uncaught exception
- `userCache.destroy()` is called during graceful shutdown
- `packages/notifications` test coverage reaches >= 80%
- Zero `as any` occurrences in `apps/api/src/` production code
- Zero `console.log` calls in `apps/` production code (replaced with structured logger)
- Silent `catch(_error)` blocks eliminated from all web components
- Example route files removed from `apps/api/src/routes/`
- Test setup file in `apps/api/test/setup.ts` decomposed to <= 500 lines per module

#### Target Users

- **DevOps / Platform engineers** deploying and operating the three apps
- **Backend developers** maintaining the API and packages
- **Frontend developers** building and debugging web and admin features
- **QA engineers** running the test suite and validating deployments

---

### 2. User Stories & Acceptance Criteria

#### US-01: Admin App Builds Successfully for Production

**As a** platform engineer preparing a production release,
**I want** the admin app SSR build to complete without errors,
**so that** I can deploy a working admin panel to Vercel.

**Acceptance Criteria:**

- **Given** the admin app source code with all current dependencies,
  **When** `pnpm build` is executed inside `apps/admin`,
  **Then** both the client build and the SSR build complete without errors and without a stack overflow

- **Given** a successful build,
  **When** the output is inspected,
  **Then** the SSR bundle resolves all package imports from compiled `dist` artifacts, not from package source directories

- **Given** the fix is applied,
  **When** `pnpm typecheck` runs for `apps/admin`,
  **Then** no new TypeScript errors are introduced

- **Given** the admin app is deployed to Vercel from the built artifacts,
  **When** the admin panel is opened in a browser,
  **Then** the application loads and functions correctly

#### US-02: API Production Manifest is Accurate

**As a** platform engineer deploying the API to Fly.io,
**I want** `apps/api/package.prod.json` to list the current runtime dependencies,
**so that** the production image installs exactly the libraries the API needs.

**Acceptance Criteria:**

- **Given** the current `apps/api/package.json`,
  **When** `package.prod.json` is compared against it,
  **Then** all Clerk-related entries are absent

- **Given** the manifest is regenerated or updated,
  **When** it is inspected,
  **Then** `drizzle-orm` version matches the one in `package.json` (currently `^0.44.7`)
  **And** `zod` version matches the one in `package.json` (currently `^4.0.8`)
  **And** `@hono/zod-openapi` is listed (not `@hono/zod-validator`)

- **Given** the updated manifest,
  **When** `npm install --production` is run using it,
  **Then** no missing dependency errors occur and the API server starts

#### US-03: Fly.io Configuration Deploys the API Correctly

**As a** platform engineer running `pnpm deploy:api`,
**I want** `apps/api/fly.toml` to contain a complete, correct configuration,
**so that** the API is deployed with health checks, correct port, and defined resources.

**Acceptance Criteria:**

- **Given** the updated `fly.toml`,
  **When** it is reviewed,
  **Then** the port matches the `API_PORT` default of 3001 (or the value used by the app in production)
  **And** an `[http_service]` section with health check path and interval is present
  **And** `[[vm]]` resources (cpu, memory) are defined
  **And** a deploy strategy (rolling or bluegreen) is specified
  **And** all `[[services]]` legacy blocks are replaced with `[http_service]`

- **Given** `fly deploy` is executed,
  **When** the new instance starts,
  **Then** the health check endpoint responds with 200 within the configured interval

- **Given** the updated config,
  **When** it is reviewed,
  **Then** required secrets (database URL, auth secret, etc.) are documented as expected environment variables (not hardcoded values)

#### US-04: Environment Variable Documentation Exists for All Apps

**As a** developer setting up the platform for the first time,
**I want** a `.env.example` file in each app,
**so that** I know exactly which environment variables are required and what format they take.

**Acceptance Criteria:**

- **Given** the `apps/api` directory,
  **When** it is inspected,
  **Then** a `.env.example` file is present listing all required variables with placeholder values and inline comments explaining each

- **Given** the `apps/admin` directory,
  **When** it is inspected,
  **Then** a `.env.example` file is present listing all `VITE_*` variables required for the build and any runtime variables

- **Given** the `apps/web` directory,
  **When** it is inspected,
  **Then** a `.env.example` file is present listing all public and server-side variables the Astro app reads

- **Given** any of the `.env.example` files,
  **When** a developer copies it to `.env` and fills in real values,
  **Then** the respective app starts without environment variable errors

#### US-05: CI Workflow Uses Only Current Authentication Variables

**As a** developer pushing code to GitHub,
**I want** the CI workflow to reference only Better Auth variables,
**so that** CI does not fail due to missing Clerk secrets that no longer exist.

**Acceptance Criteria:**

- **Given** `.github/workflows/ci.yml`,
  **When** it is reviewed,
  **Then** no references to Clerk-specific environment variables or secrets are present

- **Given** `.github/SECRETS.md` (or equivalent documentation),
  **When** it is reviewed,
  **Then** it lists only the Better Auth and current application secrets required

- **Given** the updated CI configuration,
  **When** a pull request is opened,
  **Then** the CI workflow runs to completion without failing on missing secrets

#### US-06: TurboRepo Configuration Reflects Current Dependencies and Build Outputs

**As a** developer running `pnpm build` or `pnpm test` from the monorepo root,
**I want** `turbo.json` to have accurate `globalEnv` and `outputs` entries,
**so that** TurboRepo cache invalidation works correctly and builds are reproducible.

**Acceptance Criteria:**

- **Given** `turbo.json`,
  **When** it is reviewed,
  **Then** no Clerk-related environment variable names appear in `globalEnv`
  **And** `HOSPEDA_BETTER_AUTH_SECRET` and other current Better Auth variables are listed

- **Given** the admin app build task in `turbo.json`,
  **When** it is reviewed,
  **Then** the `outputs` pattern matches the actual build output directory used by TanStack Start (`.tanstack/start/build/**`)

- **Given** the updated `turbo.json`,
  **When** `pnpm build` runs from the monorepo root after a clean cache,
  **Then** all apps build successfully and the cache is correctly populated

#### US-07: Web App Prerender Conflict is Resolved

**As a** Vercel deployment pipeline,
**I want** all statically prerendered pages to not read request-time headers,
**so that** the build does not fail and pages are served correctly.

**Acceptance Criteria:**

- **Given** `apps/web/src/pages/[lang]/alojamientos/tipo/[type]/index.astro`,
  **When** it is reviewed,
  **Then** it does not combine `export const prerender = true` with any access to `Astro.request.headers`

- **Given** the corrected page,
  **When** `pnpm build` is run for `apps/web`,
  **Then** no build warnings or errors are produced for this file

- **Given** the page is visited in production,
  **When** any accommodation type filter is applied,
  **Then** the page loads correctly and displays the expected results

#### US-08: CORS and Proxy Settings are Documented for Production

**As a** platform engineer configuring the API behind a reverse proxy (Fly.io),
**I want** the CORS origins and trust-proxy settings to be clearly documented and configurable,
**so that** the API accepts requests from the web and admin apps and handles IP forwarding correctly.

**Acceptance Criteria:**

- **Given** the API `.env.example`,
  **When** it is reviewed,
  **Then** `API_CORS_ORIGINS` is documented with an explanation that it must be set to production domain(s)
  **And** `API_RATE_LIMIT_TRUST_PROXY` is documented with an explanation that it should be `true` when deployed behind a proxy

- **Given** a production deployment where `API_CORS_ORIGINS` is set to the web app domain,
  **When** the web app makes a cross-origin request to the API,
  **Then** the request succeeds and no CORS errors are reported

#### US-09: Automated Deployment Workflows Exist for Staging and Production

**As a** platform engineer merging code to main,
**I want** automated CD workflows to deploy each app,
**so that** deployments are repeatable, auditable, and do not require manual intervention.

**Acceptance Criteria:**

- **Given** a merge to the `main` branch,
  **When** the CD pipeline is triggered,
  **Then** the API is deployed to Fly.io automatically using a defined workflow file (`cd-production.yml` or equivalent)

- **Given** a merge to a staging branch,
  **When** the CD pipeline is triggered,
  **Then** the API and web/admin apps are deployed to their staging environments

- **Given** a deployment workflow file,
  **When** it is reviewed,
  **Then** it includes steps for: install dependencies, build, test (or reference CI success), deploy with confirmation of success

- **Given** a deployment failure,
  **When** the workflow run is inspected,
  **Then** the failure step and error message are clearly visible in the GitHub Actions log

#### US-10: Sentry Error Reporting is Active in All Three Apps

**As a** platform engineer operating the platform in production,
**I want** Sentry to capture errors in all three apps (API, web, admin),
**so that** no unhandled errors go silently undetected.

**Acceptance Criteria:**

- **Given** `apps/admin/package.json`,
  **When** it is reviewed,
  **Then** `@sentry/react` is listed under `dependencies`, not `devDependencies`

- **Given** `apps/web`,
  **When** the source is reviewed,
  **Then** `@sentry/astro` is installed and configured in `astro.config.mjs`

- **Given** a runtime error occurring in the web app (SSR),
  **When** it is not caught by application code,
  **Then** the error is reported to Sentry with full stack trace and request context

- **Given** a runtime error occurring in the admin panel,
  **When** it is not caught,
  **Then** the error is reported to Sentry

- **Given** all three apps,
  **When** they are deployed to production,
  **Then** each reports errors to the configured Sentry DSN and the Sentry dashboard shows events from all three sources

#### US-11: Remote Image Domains Cover Production Assets

**As a** visitor loading the web app in production,
**I want** accommodation and destination images to load without error,
**so that** the pages render correctly with all media.

**Acceptance Criteria:**

- **Given** `apps/web/astro.config.mjs`,
  **When** it is reviewed,
  **Then** the `remotePatterns` for the image service includes the production API domain (Fly.io) and any CDN or media storage domain used in production (not just localhost and `*.fly.dev`)

- **Given** an image URL from a production accommodation record,
  **When** it is rendered through Astro's image component,
  **Then** the image loads without a "Remote Image Not Allowed" error

#### US-12: Production Database Migration Workflow is Defined

**As a** platform engineer performing a production release that includes schema changes,
**I want** a documented and scripted database migration process,
**so that** migrations are applied safely without data loss.

**Acceptance Criteria:**

- **Given** the project documentation or a migration runbook,
  **When** a developer needs to apply migrations in production,
  **Then** there is a step-by-step guide clearly distinguishing between `drizzle-kit push` (development only) and `drizzle-kit migrate` (production)

- **Given** a new migration file is generated,
  **When** it is named,
  **Then** it follows the format defined in the migration naming conventions (no mixed formats)

- **Given** a production deploy that includes a migration,
  **When** the migration step is run,
  **Then** it uses `drizzle-kit migrate` against the production database (not `push`)

#### US-13: Test Suite Passes Without Errors

**As a** developer running `pnpm test`,
**I want** all tests to complete without configuration errors,
**so that** CI is reliable and I can trust test results.

**Acceptance Criteria:**

- **Given** `@repo/config` vitest configuration,
  **When** `pnpm test` is executed,
  **Then** the `minThreads`/`maxThreads` conflict error does not occur

- **Given** all packages use vitest,
  **When** `pnpm test` is run from the monorepo root,
  **Then** all packages use the same vitest major version (3.x)

- **Given** `packages/schemas` test files,
  **When** `pnpm typecheck` runs,
  **Then** the `'result.logo' is possibly 'null'` error in `postSponsor.schema.test.ts:266` does not occur

- **Given** the test suite,
  **When** it completes,
  **Then** all tests pass with a minimum of 90% coverage across the codebase

#### US-14: API Process Handles Fatal Errors Correctly

**As a** platform engineer running the API in production,
**I want** the process to exit cleanly after an uncaught exception,
**so that** the container orchestrator (Fly.io) can restart it in a known good state.

**Acceptance Criteria:**

- **Given** the API process encounters an uncaught exception,
  **When** the `uncaughtException` handler is triggered,
  **Then** the error is logged with full context via the structured logger
  **And** the process exits with a non-zero exit code within a short timeout (e.g., 5 seconds)
  **And** `userCache.destroy()` is called before the process exits

- **Given** the API receives a `SIGTERM` or `SIGINT` signal (graceful shutdown),
  **When** the shutdown handler runs,
  **Then** `userCache.destroy()` is invoked
  **And** the database connection pool is closed
  **And** Sentry flushes any pending events
  **And** the process exits with code 0

- **Given** the process exits after an uncaught exception,
  **When** Fly.io detects the exit,
  **Then** it restarts the process according to the configured restart policy

#### US-15: Notifications Package Has Adequate Test Coverage

**As a** developer maintaining the notification system,
**I want** the critical notification services to have >= 80% test coverage,
**so that** regressions in email sending, subject building, and template rendering are caught automatically.

**Acceptance Criteria:**

- **Given** `packages/notifications`,
  **When** `pnpm test:coverage` is run,
  **Then** the overall coverage for the package reaches >= 80%

- **Given** `resend-transport.ts`,
  **When** its tests are run,
  **Then** sending success, sending failure, and retry scenarios are all covered

- **Given** `subject-builder.ts`,
  **When** its tests are run,
  **Then** all subject templates for all notification types produce the correct subject string

- **Given** email template files,
  **When** their tests are run,
  **Then** each template renders without error and contains expected content for both Spanish and English locales

#### US-16: Production API Code Contains No Untyped Casts

**As a** developer reviewing API code,
**I want** zero `as any` casts in `apps/api/src/` production code,
**so that** type safety is enforced and runtime type errors are caught at compile time.

**Acceptance Criteria:**

- **Given** `apps/api/src/` (excluding test files and auto-generated files),
  **When** a grep for `as any` is performed,
  **Then** zero results are returned

- **Given** `zod-error-transformer.ts` (previously had 11 occurrences),
  **When** it is reviewed,
  **Then** all `as any` casts are replaced with proper types or type guards

- **Given** `route-factory.ts` (previously had 7 occurrences),
  **When** it is reviewed,
  **Then** all `as any` casts are replaced with properly typed generics

#### US-17: Structured Logging Replaces console.log in Apps

**As a** platform engineer reviewing production logs,
**I want** all log output to go through `@repo/logger`,
**so that** logs are structured, searchable, and consistently formatted.

**Acceptance Criteria:**

- **Given** `apps/api/src/`, `apps/admin/src/`, and `apps/web/src/`,
  **When** a grep for `console.log` is performed,
  **Then** zero results are returned (excluding test files)

- **Given** any location where a `console.log` was previously used,
  **When** it is replaced,
  **Then** the replacement uses the appropriate `logger.info`, `logger.warn`, or `logger.error` call with structured context

#### US-18: Error Catch Blocks Log Silenced Errors

**As a** platform engineer diagnosing a production issue,
**I want** no error catch blocks to silently discard errors,
**so that** unexpected failures in UI components appear in Sentry and the structured log.

**Acceptance Criteria:**

- **Given** the components `PreferenceToggles`, `ProfileEditForm`, `NewsletterCTA`, `FavoriteButton`, `ContactForm`, and `destination-functions`,
  **When** their catch blocks are reviewed,
  **Then** each one logs the error (at minimum via the structured logger) before discarding it

- **Given** a runtime error is thrown inside any of those components,
  **When** it is caught,
  **Then** the error appears in the Sentry event stream with the component name as context

#### US-19: Files Comply with the 500-Line Limit

**As a** developer reading or modifying service or component files,
**I want** each file to stay within 500 lines,
**so that** individual modules are focused, readable, and easier to test in isolation.

**Acceptance Criteria:**

- **Given** the worst offenders identified in the audit (`base.crud.service.ts`, `subscriptions.tsx`, `addon.service.ts`, `mercadopago.ts` webhooks, `promo-code.service.ts`, `route-factory.ts`),
  **When** they are decomposed,
  **Then** each resulting file is <= 500 lines
  **And** the public interface of each service or module is unchanged (no breaking changes to callers)

- **Given** the decomposed modules,
  **When** existing tests are run,
  **Then** all tests pass without modification

#### US-20: Example Routes Removed from Production Source

**As a** developer reviewing the API source tree,
**I want** example route files to be absent from `apps/api/src/routes/`,
**so that** the production source contains only routes that are actually served.

**Acceptance Criteria:**

- **Given** `apps/api/src/routes/examples/`,
  **When** it is reviewed after cleanup,
  **Then** the directory does not exist in `apps/api/src/`

- **Given** the example content is still useful as reference material,
  **When** it is preserved,
  **Then** it lives under `apps/api/docs/examples/` or an equivalent documentation location outside `src/`

- **Given** the API router registration,
  **When** it is reviewed,
  **Then** no example routes are registered

#### US-21: API Test Setup File is Decomposed

**As a** developer adding a new test for the API,
**I want** the test setup to be organized into focused modules,
**so that** I can find and modify the relevant setup without reading 3,954 lines.

**Acceptance Criteria:**

- **Given** `apps/api/test/setup.ts`,
  **When** the decomposition is complete,
  **Then** no single setup file exceeds 500 lines

- **Given** the decomposed setup,
  **When** the full API test suite is run,
  **Then** all tests continue to pass without any test configuration changes

#### US-22: Named Exports Policy Enforced in Components and Routes

**As a** developer reviewing the codebase,
**I want** all non-configuration files to use named exports,
**so that** the codebase follows the established coding standard consistently.

**Acceptance Criteria:**

- **Given** the ~15 component and route files identified as having `export default` (excluding config files required by tools),
  **When** they are updated,
  **Then** each uses a named export instead

- **Given** the updated files,
  **When** `pnpm typecheck` and `pnpm lint` are run,
  **Then** no new errors are introduced

#### US-23: TODOs and FIXMEs are Triaged

**As a** development team,
**I want** all 161 in-code TODOs and FIXMEs to be reviewed and resolved or tracked,
**so that** known issues are not lost in source code comments.

**Acceptance Criteria:**

- **Given** the triage process completes,
  **When** the 161 items are reviewed,
  **Then** each one is either: resolved inline, converted to a GitHub issue, or explicitly deferred with a comment referencing the tracking issue

- **Given** `eventOrganizer.service.ts` (9 TODOs), hooks in promo-codes (8 TODOs), and `user.service.ts` (4 TODOs),
  **When** they are triaged,
  **Then** any item that represents a security concern or data integrity risk is converted to a GitHub issue with a high-priority label

---

### 3. UX Considerations

#### Developer Experience

- `.env.example` files must use placeholder values that make the type obvious (e.g., `postgresql://user:password@host:5432/dbname` not just `YOUR_DB_URL`)
- All inline comments in `.env.example` should be in English, explaining the variable's purpose and valid values
- The migration runbook must include a rollback procedure

#### Operator Experience (Deployment)

- Fly.io health check path must respond before traffic is sent to a new instance. The health check endpoint must not require authentication.
- CD workflows must fail loudly with descriptive messages if a required secret is not set
- Deployment logs must be retained in GitHub Actions for at least 90 days (default behavior, but workflow must not suppress output)

#### Error States

- When `pnpm build` fails, the error message must identify the affected app and module, not just print a generic stack trace
- When a migration fails in production, the runbook must specify the manual recovery procedure

#### Accessibility

This spec does not introduce new user-facing UI. All changes are infrastructure, build tooling, and developer tooling. No accessibility considerations apply.

---

### 4. Out of Scope

- Redesigning or replacing the current monitoring stack (Sentry remains the chosen tool)
- Migrating from Fly.io or Vercel to other hosting providers
- Adding new features to any of the three apps
- Changing the database engine or ORM
- Implementing a feature flag system for deployment control
- Blue-green or canary deployments beyond selecting a strategy in `fly.toml`
- End-to-end performance benchmarking or load testing
- Resolving billing-specific production issues (covered by SPEC-003)
- Adding new i18n translations (covered by SPEC-014)
- UI component changes unrelated to deployment or error handling

---

## Part 2 - Technical Analysis

### 5. Architecture

#### Affected Components

```
apps/admin/
  vite.config.ts                    # Fix alias resolution for SSR build (DEPLOY-01)
  package.json                      # Move @sentry/react to dependencies (DEPLOY-10)
  .env.example                      # Create (DEPLOY-04)

apps/api/
  package.prod.json                 # Regenerate with current deps (DEPLOY-02)
  fly.toml                          # Rewrite with production config (DEPLOY-03)
  .env.example                      # Create (DEPLOY-04)
  src/index.ts                      # Fix uncaughtException + graceful shutdown (QUAL-12, QUAL-13)
  src/routes/examples/              # Remove from src/, move to docs/ (QUAL-11)
  src/lib/zod-error-transformer.ts  # Remove as any (QUAL-06)
  src/lib/route-factory.ts          # Remove as any + decompose (QUAL-06, QUAL-03)
  test/setup.ts                     # Decompose into focused modules (QUAL-10)

apps/web/
  astro.config.mjs                  # Add Sentry + production image domains (DEPLOY-11, DEPLOY-12)
  .env.example                      # Create (DEPLOY-04)
  src/pages/[lang]/alojamientos/tipo/[type]/index.astro  # Fix prerender conflict (DEPLOY-07)
  src/components/                   # Fix silent catch blocks (QUAL-08)

.github/
  workflows/ci.yml                  # Replace Clerk vars with Better Auth (DEPLOY-05)
  workflows/cd-production.yml       # Create (DEPLOY-09)
  workflows/cd-staging.yml          # Create (DEPLOY-09)
  SECRETS.md                        # Update (DEPLOY-05)

turbo.json                          # Update globalEnv + outputs (DEPLOY-06)

packages/config/
  vitest.config.ts                  # Fix minThreads/maxThreads conflict (QUAL-01)
  package.json                      # Align vitest version to 3.2.4 (QUAL-01)

packages/schemas/
  test/entities/postSponsor/postSponsor.schema.test.ts  # Fix null check (QUAL-02)

packages/notifications/
  test/                             # Add missing tests (QUAL-04)

packages/service-core/
  src/base.crud.service.ts          # Decompose 1283 lines (QUAL-03)

packages/billing/
  src/services/addon.service.ts     # Decompose 1179 lines (QUAL-03)
  src/services/promo-code.service.ts # Decompose 1104 lines (QUAL-03)

docs/
  migration-runbook.md              # Create production migration guide (DEPLOY-13)
  api-examples/                     # Receive moved example routes (QUAL-11)
```

---

### 6. Implementation Phases

#### Phase 1: Critical Blockers (unblocks all deployments)

Items that must be resolved before any production deployment is possible.

| ID | Item | User Story |
|----|------|-----------|
| DEPLOY-01 | Admin SSR build stack overflow | US-01 |
| DEPLOY-02 | `package.prod.json` outdated | US-02 |
| DEPLOY-03 | `fly.toml` incomplete | US-03 |
| QUAL-01 | `pnpm test` fails (vitest config) | US-13 |
| QUAL-02 | `pnpm typecheck` fails in @repo/schemas | US-13 |

#### Phase 2: Deployment Infrastructure

Items that complete the deployment pipeline and operational baseline.

| ID | Item | User Story |
|----|------|-----------|
| DEPLOY-04 | Create `.env.example` for all apps | US-04 |
| DEPLOY-05 | Remove Clerk from CI workflow | US-05 |
| DEPLOY-06 | Update `turbo.json` globalEnv and outputs | US-06 |
| DEPLOY-07 | Fix prerender + request.headers conflict | US-07 |
| DEPLOY-08 | Document CORS and proxy config | US-08 |
| DEPLOY-09 | Create CD workflows | US-09 |
| DEPLOY-10 | Move `@sentry/react` to dependencies | US-10 |
| DEPLOY-11 | Configure Sentry in `apps/web` | US-10 |
| DEPLOY-12 | Add production domains to image remotePatterns | US-11 |
| DEPLOY-13 | Document production migration workflow | US-12 |

#### Phase 3: Runtime Reliability

Items that improve the stability and observability of the running system.

| ID | Item | User Story |
|----|------|-----------|
| QUAL-12 | API uncaughtException exits process | US-14 |
| QUAL-13 | Add `userCache.destroy()` to shutdown | US-14 |
| QUAL-07 | Replace `console.log` with logger | US-17 |
| QUAL-08 | Fix silent catch blocks | US-18 |

#### Phase 4: Code Quality (high priority)

| ID | Item | User Story |
|----|------|-----------|
| QUAL-04 | Notifications test coverage >= 80% | US-15 |
| QUAL-06 | Remove `as any` from API production code | US-16 |
| QUAL-09 | Fix export default violations | US-22 |
| QUAL-11 | Remove example routes from `src/` | US-20 |

#### Phase 5: Code Quality (medium priority)

| ID | Item | User Story |
|----|------|-----------|
| QUAL-03 | Decompose files exceeding 500 lines | US-19 |
| QUAL-10 | Decompose API test setup | US-21 |
| QUAL-05 | Triage 161 TODOs/FIXMEs | US-23 |

---

### 7. Dependencies

#### External Dependencies

- No new external runtime dependencies are introduced
- `@sentry/astro` may need to be added to `apps/web` if not already present as a direct dependency

#### Internal Package Dependencies

- `@repo/logger` must be importable from `apps/web` and `apps/admin` for console.log replacement
- `@repo/config` vitest fix must be completed before any package test suite can be trusted
- `@repo/schemas` typecheck fix must be completed before CI can be considered green

#### Sequencing Constraints

1. Phase 1 must be completed before any deployment attempt
2. DEPLOY-04 (`.env.example`) should be completed before DEPLOY-09 (CD workflows), as the workflows reference the variables
3. DEPLOY-10 and DEPLOY-11 (Sentry) should be completed before DEPLOY-09 (CD workflows), so that the first production deployment has monitoring active
4. QUAL-03 (file decomposition) must not break existing tests. Run full test suite after each file is split.

---

### 8. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Admin SSR fix requires upgrading `@tanstack/react-start` and the upgrade introduces breaking changes | Medium | High | Test upgrade in isolation on a branch. If upgrade breaks the app, fall back to pointing aliases to `dist` in vite.config.ts for production builds only. |
| Updating `package.prod.json` misses a transitive dependency that is needed at runtime | Medium | High | After regenerating, run the production install and start the API in a Docker container before deploying. |
| `fly.toml` port change (3001) conflicts with existing Fly.io infrastructure configuration | Low | High | Verify current Fly.io machine config. If the machine already exposes 3000, set `API_PORT=3000` in the Fly.io secret instead of changing the `fly.toml` port. |
| Sentry `@sentry/astro` integration causes Astro build performance regression | Low | Medium | Measure build time before and after. If regression exceeds 20%, configure Sentry to use lazy loading. |
| Decomposing large service files breaks dependent callers due to re-exports | Medium | Medium | Use barrel re-export files so that existing import paths remain valid after decomposition. Run full typecheck after each decomposition. |
| Removing example routes breaks a test that was importing them | Low | Low | Grep for imports of `examples/` before deleting. Update any test references before removing files. |
| Vitest version unification (packages/config upgrade to 3.2.4) changes test runner behavior | Low | Medium | Run full test suite after the version change. Address any test failures caused by stricter behavior in 3.x. |
| CD workflow accidentally deploys to production on a bad commit | Medium | High | Add a manual approval step (GitHub environment protection rule) for the production deployment job. |

---

### 9. Testing Strategy

#### Phase 1 Validation

- Run `pnpm build` for `apps/admin` and confirm zero errors in SSR build
- Run `pnpm test` from monorepo root and confirm zero configuration errors
- Run `pnpm typecheck` from monorepo root and confirm zero errors

#### Phase 2 Validation

- Execute `fly deploy --dry-run` (or equivalent) with updated `fly.toml` to validate syntax
- Trigger CI workflow on a test branch and confirm it completes without Clerk-related failures
- Run `pnpm build` after `turbo.json` update and confirm cache invalidation works correctly

#### Phase 3 Validation

- Write a test that verifies the `uncaughtException` handler calls `process.exit` with a non-zero code
- Write a test that verifies `userCache.destroy()` is called in the shutdown handler
- Grep `apps/api/src/`, `apps/admin/src/`, `apps/web/src/` for `console.log` and assert zero matches

#### Phase 4 Validation

- Run `pnpm test:coverage` for `packages/notifications` and assert >= 80%
- Grep `apps/api/src/` for `as any` (excluding test files) and assert zero matches
- Grep `apps/api/src/routes/` for example route registrations and assert zero matches

#### Phase 5 Validation

- Run `wc -l` equivalent on all decomposed files and assert <= 500 lines each
- Run full API test suite after setup decomposition and assert all tests pass
- Verify each triaged TODO has either been resolved, converted to a GitHub issue, or has a `// TODO(#<issue-number>):` comment format

---

### 10. Performance Considerations

- The SSR alias fix (DEPLOY-01) is expected to **reduce** admin build time by eliminating the recursive CSS resolution loop
- Sentry integration in `apps/web` (DEPLOY-11) adds a small overhead to SSR responses. Configure `tracesSampleRate` to 0.1 or lower to minimize performance impact
- Decomposing large service files (QUAL-03) has no runtime performance impact. It is a purely structural change.
- Replacing `console.log` with `@repo/logger` (QUAL-07) should have negligible performance impact. Structured logging has marginally higher overhead than console output but is negligible compared to network and database latency.

---

### 11. Deviations & Post-Completion Notes

This section documents gaps identified during the post-completion audit and how they were resolved.

#### 11.1 Fly.io to Vercel Migration (US-02, US-03)

US-02 (update `package.prod.json`) and US-03 (update `fly.toml`) are now **N/A**. The API was migrated from Fly.io to Vercel serverless (commit `437513a1`). The following files were deleted: `fly.toml`, `Dockerfile.api`, `scripts/generate-api-prod-package.ts`, `apps/api/package.prod.json`. They are replaced by `apps/api/vercel.json`. All documentation references to Fly.io have been updated.

#### 11.2 uncaughtException Handler (US-14)

The handler intentionally does **NOT** call `process.exit()`. In the original Fly.io VM deployment, `process.exit(1)` was required to prevent a corrupted long-running process from silently serving bad responses. After migration to Vercel serverless, each request runs in an isolated function invocation and the runtime manages process lifecycle. Calling `process.exit()` in serverless would kill the function mid-request, causing 502 errors. A JSDoc comment in `apps/api/src/index.ts` documents this decision and warns that `process.exit(1)` must be re-enabled if the API is re-deployed on a long-running VM.

#### 11.3 Remaining "as any" Casts (US-16)

12 `as any` instances remain, all justified with `biome-ignore` annotations and JSDoc explaining why the cast is necessary:

- **route-factory.ts** (6): Zod `_def` introspection for coercion/ZodEffects detection (no public API available), and Hono `ctx.req.valid()` type narrowing (route-specific generics unavailable in factory context).
- **openapi-schema.ts** (3): Zod `_def` introspection for schema shape access and ZodEffects detection (no public API).
- **env.ts** (1): `ZodEffects` from `.superRefine()` not assignable to `ZodSchema<T>` across Zod v4 type boundaries.
- **swagger.ts** (1): `swaggerUI()` return type incompatible with Hono OpenAPI route handler.
- **scalar.ts** (1): `Scalar()` return type incompatible with Hono OpenAPI route handler.

#### 11.4 route-factory.ts Decomposition (US-19)

`route-factory.ts` was decomposed into two files:

- `route-factory.ts` (488 lines): Types, helpers, `createSimpleRoute`, `createCRUDRoute`, `createListRoute`, and barrel re-exports.
- `route-factory-tiered.ts` (341 lines): Three-tier authorization interfaces and 6 factory functions (`createPublicRoute`, `createProtectedRoute`, `createAdminRoute` + list variants).

Both files are under 500 lines. The barrel re-export in `route-factory.ts` preserves the public API, so zero importers required changes.

#### 11.5 TODO Audit (US-23)

83 TODOs were audited across the codebase. 7 were prioritized as pre-deploy (security, data integrity), the remainder categorized as post-deploy. Full categorized report provided separately.
