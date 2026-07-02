# CLAUDE.md - Hospeda Platform

## Project Overview

**Hospeda** is a modern web platform for discovering and managing tourist accommodations in Concepcion del Uruguay and the Litoral region of Argentina. Built as a TurboRepo monorepo with TypeScript, Astro, React, Hono, Drizzle ORM, and PostgreSQL.

### Technology Stack

- **Runtime**: Node.js >= 18
- **Language**: TypeScript (strict mode)
- **Package Manager**: pnpm 9.x (workspaces)
- **Build System**: TurboRepo
- **Linter/Formatter**: Biome
- **Testing**: Vitest
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth
- **Monitoring**: Sentry
- **Deployment**: Coolify on a self-hosted VPS (API, Web, Admin) behind Cloudflare

### Architecture

```
hospeda/
├── apps/
│   ├── admin/        # TanStack Start admin dashboard (port 3000)
│   ├── api/          # Hono REST API server (port 3001)
│   └── web/          # Astro frontend with React islands (port 4321)
├── packages/
│   ├── auth-ui/      # Shared authentication UI components
│   ├── billing/      # Billing/monetization logic (QZPay/MercadoPago)
│   ├── biome-config/ # Shared Biome configuration
│   ├── config/       # Shared configuration
│   ├── db/           # Drizzle ORM models and schemas
│   ├── i18n/         # Internationalization (es/en/pt)
│   ├── icons/        # Shared icon components
│   ├── logger/       # Structured logging
│   ├── notifications/# Notification system
│   ├── schemas/      # Zod validation schemas (source of truth for types)
│   ├── seed/         # Database seeding
│   ├── service-core/ # Business logic services (BaseCrudService)
│   ├── tailwind-config/ # Shared Tailwind configuration
│   ├── typescript-config/ # Shared TypeScript configuration
│   └── utils/        # Shared utilities
└── scripts/          # Build and deployment scripts
```

## API Route Architecture

The API uses a three-tier route architecture:

| Tier | URL Pattern | Auth | Consumer |
|------|-------------|------|----------|
| **Public** | `/api/v1/public/*` | None | Web app (public pages) |
| **Protected** | `/api/v1/protected/*` | User session | Web app (user features) |
| **Admin** | `/api/v1/admin/*` | Admin + permissions | Admin panel |

- **Web app** (`apps/web`): Uses only `/public/` and `/protected/` endpoints. Never `/admin/`.
- **Admin panel** (`apps/admin`): Uses only `/admin/` endpoints. Exception: `/api/v1/public/auth/me`.
- See `apps/api/docs/route-architecture.md` for full reference.

## Development Guidelines

### Key Commands

```bash
# Interactive CLI (discover and run all commands)
pnpm cli              # Interactive menu with fuzzy search
pnpm cli <command>    # Run a command directly (e.g., pnpm cli db:start)
pnpm test:cli         # Run CLI tool tests

# Development
pnpm dev              # Start all apps
pnpm dev:admin        # Start admin only
pnpm dev:all          # Start all apps with script

# Testing
pnpm test             # Run all tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report

# Code Quality
pnpm lint             # Biome linting
pnpm format           # Biome formatting
pnpm check            # Biome check + fix
pnpm typecheck        # TypeScript validation

# Database
pnpm db:start         # Start PostgreSQL + Redis (Docker)
pnpm db:stop          # Stop database containers
pnpm db:migrate       # Apply pending versioned migrations (real drizzle-kit migrate)
pnpm db:generate      # Generate migration from schema changes
pnpm db:studio        # Open Drizzle Studio
pnpm db:seed          # Seed database
pnpm db:fresh         # Reset + migrate + seed
pnpm db:fresh-dev     # Reset + push schema + seed (dev shortcut)
pnpm db:seed:ready-user <email>  # Mark one user ready (skip onboarding friction) - SPEC-264

# Build
pnpm build            # Build all packages
pnpm build:api        # Build API for production

# Deploy
# Production deploys are triggered manually from the Coolify dashboard
# (https://coolify.hospeda.com.ar) per app — auto-deploy on push is disabled
# by policy. CI runs lint/typecheck/test only; the deploy itself is a
# button click in Coolify after CI is green.

# Environment
pnpm env:check:registry  # Local: confirm app schemas match @repo/config registry (CI gate)
# Remote env management lives in hops env-* on the VPS (see docs/guides/env-management.md).
```

### Coding Standards

- **TypeScript strict mode** with no `any` types
- **Named exports only** (no default exports)
- **RO-RO pattern** (Receive Object, Return Object) for all functions
- **Maximum 500 lines** per file
- **Comprehensive JSDoc** on all exported functions, classes, and types
- **Zod validation** for all runtime inputs
- **async/await** instead of .then() chains
- **Immutability** preferred (readonly, as const)
- **Typed error responses** with explicit error handling
- **`import type`** for type-only imports

### File Naming

- Components: `PascalCase.tsx` (React), `PascalCase.astro` (Astro)
- Utilities: `kebab-case.ts`
- Tests: `*.test.ts` or `*.test.tsx`
- Schemas: `entity-name.schema.ts`
- Models: `entity-name.model.ts`
- Services: `entity-name.service.ts`

### Testing Standards

- **Test-Informed Development**: Tests are mandatory, timing depends on context:
  - **Pure logic** (services, utils, schemas, validators): Write tests first when practical
  - **Integration code** (routes, components, wiring): Write tests alongside implementation
  - **Bug fixes**: ALWAYS write a regression test reproducing the bug before fixing
- **No tests = not done**: A task is NEVER complete without tests passing
- **AAA pattern**: Arrange, Act, Assert
- **Minimum 90% coverage** target
- **Run tests before committing**
- Test files live in `test/` directories alongside or within `src/`
- `.only()` and hard-coded `.skip()` are **forbidden** in committed code — CI will fail
- Use `it.skipIf(condition)` for legitimate conditional test skipping

### Billing architecture quick reference (SPEC-193 era)

Hospeda billing is built on **QZPay** (`@qazuor/qzpay-core`) with a MercadoPago payment adapter. Key files:

- **Routes**: `apps/api/src/routes/billing/` (start-paid, plan-change, subscription-cancel, addons, webhooks, etc.)
- **Services**: `packages/service-core/src/services/billing/` (subscription, addon, promo-code, settings — deliberately outside `BaseCrudService`)
- **Cron jobs**: `apps/api/src/cron/jobs/` (dunning, webhook-retry, finalize-cancelled-subs, trial-expiry, addon-expiry, apply-scheduled-plan-changes, subscription-poll, abandoned-pending-subs, exchange-rate-fetch)
- **Config**: `packages/billing/` (plan definitions, entitlement keys, limits, MP adapter factory)
- **DB adapter**: `packages/db/src/billing/drizzle-adapter.ts` (QZPay Drizzle storage adapter)

Key DB columns: `billing_subscriptions.mp_subscription_id` stores the MercadoPago preapproval ID for monthly recurring subscriptions (NULL for annual one-time charges). `billing_customers.segment` (not `category`). `billing_plans.id` is UUID; `billing_subscriptions.plan_id` is varchar but stores the plan UUID.

Three distinct grace mechanisms exist (see [`docs/billing/grace-period-source-of-truth.md`](docs/billing/grace-period-source-of-truth.md)):
past-due dunning grace (7 days, `past_due` status), cron-lag grace (6h, `active` status), and soft-cancel grace (until `currentPeriodEnd`).

For MP sandbox setup, webhook configuration, sandbox test-user creation, and rollback: see [`docs/migration/mercadopago-sandbox-runbook.md`](docs/migration/mercadopago-sandbox-runbook.md). For incident response: [`docs/billing/billing-runbooks.md`](docs/billing/billing-runbooks.md). For entitlement gate decisions: [`docs/billing/endpoint-gate-matrix.md`](docs/billing/endpoint-gate-matrix.md).

#### Commerce subscription isolation (SPEC-239)

Commerce listings use a **separate billing domain** that must never pollute the
accommodation entitlement engine:

- `billing_subscriptions.product_domain` — `'accommodation'` for host subscriptions,
  `'commerce'` for commerce-listing subscriptions. `loadEntitlements()` filters to
  `product_domain = 'accommodation'` only, so a user who is both a host and a
  commerce owner retains correct accommodation entitlements regardless of their
  commerce subscription state.
- The commerce plan in `billing_plans` has `product_domain = 'commerce'` and is
  intentionally kept OUT of `ALL_PLANS` so that `GET /api/v1/public/plans` does
  not expose it to accommodation hosts.
- `commerce_listing_subscriptions` — a link table (one row per listing, UNIQUE on
  `(entity_type, entity_id)`) that ties an active commerce subscription to its
  concrete listing. The commerce-visibility reconciler reads this table to decide
  whether a listing is publicly visible.
- The `product_domain` columns on `billing_plans` and `billing_subscriptions` ship
  via the extras carril (`packages/db/src/migrations/extras/017-billing-plans-product-domain.column.sql`),
  not via a Drizzle-generated migration. Re-applied by `pnpm db:apply-extras`.
  See [`docs/decisions/ADR-035-commerce-core-gastronomy-separation.md`](docs/decisions/ADR-035-commerce-core-gastronomy-separation.md).

#### Promo code effect engine (SPEC-262)

- `billing_promo_codes.effect_kind` (varchar, extras 018) — `'discount' | 'trial_extension' | 'comp'`. All existing rows default to `'discount'` (backward-compat). `value_kind` (`'percentage'|'fixed'`), `duration_cycles` (int, null=forever), and `extra_days` (int) are the companion extras columns on the same table.
- `billing_subscriptions.promo_effect_remaining_cycles` (integer, extras 019) — multi-cycle discount countdown. `NULL` = forever or no active discount; `N > 0` = N discounted cycles remain; `0` = exhausted (full price already restored). Decremented once per confirmed charge on the `subscription_authorized_payment.created` webhook by `resolveRenewalPromoEffect` in `packages/service-core/src/services/billing/promo-code/promo-code.renewal.ts`.
- `billing_subscriptions.status = 'comp'` (`SubscriptionStatusEnum.COMP`) — a permanently-complimentary subscription. Created by `apps/api/src/services/subscription-comp-create.service.ts` as a direct DB insert with NO MercadoPago preapproval (`mp_subscription_id = NULL`). The dunning cron excludes it; `loadEntitlements` treats it as active. Not a 100% discount computation — an explicit status that cannot revert to full price.
- These extras columns are applied by `pnpm db:apply-extras` (files 018/019/020 under `packages/db/src/migrations/extras/`). The MP preapproval mutation mechanism (lowering then restoring `transaction_amount`) was verified viable in the spike doc at `packages/service-core/src/services/billing/promo-code/docs/mp-preapproval-mutation-spike.md` (Outcome A — GO).

### Local testing for billing entitlements (SPEC-143)

For entitlement gates, limit enforcement, route permission models, UI gates, and form persistence — work that has zero dependency on real MercadoPago — prefer **local-first** over staging redeploys.

`pnpm db:fresh-dev` creates 13 dev-only test users covering every role × plan combination (2 staff + 3 tourist tiers + 3 host tiers + 1 trial host + 1 host with addon + 3 complex tiers). Login with `<slug>@local.test` / `Password123!`. Full matrix in [`packages/seed/CLAUDE.md`](packages/seed/CLAUDE.md#test-users-for-billing-spec-143-block-1). To re-seed only the test users (after a db wipe): `pnpm db:seed:test-users`. These users are seeded **ready to use** (no profile/welcome-tour/what's-new/password-change friction — SPEC-264); to ready a manually-created user, run `pnpm db:seed:ready-user <email>`.

Staging is still required for: MercadoPago checkout (`/start-paid`, polling fallback, webhook signature verification), Cloudflare cache revalidation, and cron behavior in production-like timing. Everything else goes local.

### Billing testing — manual smoke checklist required (SPEC-143)

Any PR that touches the billing surface (checkout, webhooks, cron, refund, admin billing ops, entitlements) MUST have the relevant manual staging smoke executed before merging to `staging`, in addition to CI passing. The vitest e2e suite uses an MP stub and cannot catch divergences between the stub and real MercadoPago behavior; the staging smoke against the real MP sandbox is the gate.

Workflow:

1. Before opening the PR, identify which sections of [`.qtm/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md`](.qtm/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md) the change exercises.
2. Run those sections against `https://staging.hospeda.com.ar` with the MP sandbox credentials configured on `hospeda-api-staging`. Use [`.qtm/specs/SPEC-143-billing-testing-coverage/docs/mp-test-cards-reference.md`](.qtm/specs/SPEC-143-billing-testing-coverage/docs/mp-test-cards-reference.md) to pick the right card + cardholder combo per sub-flow.
3. File the sign-off entry inside the relevant section of the checklist (date, executor, PR number, result, notes).
4. Reference the sign-off in the PR description so reviewers can verify it.
5. For PRs that change the **billing CORE** (start-paid route, webhook handlers, dunning/exchange-rate crons, refund flow, admin billing ops), the prod smoke ([`.qtm/specs/SPEC-143-billing-testing-coverage/docs/prod-smoke-checklist.md`](.qtm/specs/SPEC-143-billing-testing-coverage/docs/prod-smoke-checklist.md)) MUST be executed too — that's the production go-live gate. Routine billing-touching PRs (UI tweaks, copy changes, schema additions) only need staging.

Failed smokes block merge. Notes-only passes (smoke surfaces a known documented bug from an engram entry) can merge but the bug entry must be linked from the PR.

This rule was approved as part of SPEC-143 phase 4 polish (engram `#532` decision Q1).

**Linear labels for smoke-gated specs**: when a spec's Linear issue requires the
staging smoke above, apply the `status-needs-smoke-staging` label to it — remove
it once the sign-off is filed and the PR merges. If the spec also requires the
prod smoke (billing CORE, step 5 above), apply `status-needs-smoke-prod` after
merge to staging — remove it once that sign-off is filed. **Never mark an issue
`Done` (via `/closeSpec` or otherwise) while either label is still present** —
their whole purpose is to make "waiting on smoke" visible on the board instead of
an issue silently sitting in `In Progress`/`In Review` with no signal of what it's
actually blocked on. These are deliberately labels, not workflow states: most
specs never touch billing and never need them, so they stay opt-in rather than
forcing every issue through an extra pipeline stage.

### Git Conventions

- **Conventional Commits**: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`, `workflow`, `types`, `del`, `misc`
- Atomic, focused commits
- Stage files individually (never `git add .` or `git add -A`)
- **Commit immediately after staging**.. never accumulate multiple `git add` groups without committing between them
- Exclude documentation/CLAUDE.md files from code commits (commit them separately if needed)
- Pre-commit hooks (husky + lint-staged + biome) run on ALL staged files.. if the hook fails, fix the issue and create a NEW commit (never amend)
- **Merge commit messages**: commitlint rejects `merge:` as a type. Use `chore: merge <source> into <target> (...)` instead.
- **PR titles MUST carry a work tag** (enforced by the `Validate PR Title` CI check — see [`.github/workflows/validate-pr-title.yml`](.github/workflows/validate-pr-title.yml)). Every PR title MUST start with one of three tags, before the conventional-commit type:
  - `[HOS-NNN]` — work that belongs to a spec tracked in Linear (team `Hospeda`, key `HOS`). This is the current convention (since the 2026-07-01 Linear tracking migration — see [Spec & Task Management](#spec--task-management)). Format: `[HOS-NNN] type(scope): description` (e.g. `[HOS-12] feat(web): unify loading states`).
  - `[SPEC-NNN]` — legacy tag for specs still in flight from before the Linear migration (`.qtm/specs/SPEC-NNN-slug/`, not yet migrated to a `HOS-xxx` issue). Do not use for new specs.
  - `[NOSPEC:<slug>]` — small changes that do NOT go through the formal spec process (typos, infra one-offs, dependency patches). The `<slug>` is a short kebab-case identifier so multiple no-spec PRs are distinguishable at a glance. Format: `[NOSPEC:<slug>] type(scope): description` (e.g. `[NOSPEC:footer-copy] fix(web): typo in footer`).
  - The tag is non-negotiable: a reviewer must know which spec (or that none) a PR belongs to from the PR list alone. Bot-authored PRs (`dependabot[bot]`, `github-actions[bot]`) are exempt — the CI check skips them.

### Protected Branches — `main` and `staging`

`main` and `staging` are protected by convention. GitHub-side branch protection is currently NOT available (private repo on the Free plan; tracked as SPEC-103 T-002 / T-003 blocked on a plan upgrade). Until then, protection is enforced AGENT-SIDE by these rules — read them as non-negotiable:

1. **NEVER** `git push` directly to `main` or `staging` (including `*:main` / `*:staging` ref forms, force pushes, and `-u` initial setups). `.claude/settings.json` enforces this with `deny` patterns; if you find yourself reasoning about how to bypass them, STOP and re-read this section.
2. **NEVER** merge a PR to `main` or `staging` unless the PR's last CI run is fully green. "CI Pass" being SUCCESS is the gate. Skipped jobs are OK; failed or cancelled jobs are NOT. Verify via `gh pr view <N> --json statusCheckRollup` before any `gh pr merge`.
3. **NEVER** use `gh pr merge --admin` to bypass failing CI on `main` or `staging`. Admin override on these branches is a last-resort human decision, not an agent decision.
4. **NEVER** `git commit --amend` on `main` or `staging`. Always create new commits.
5. The only path to change `main` / `staging`: branch → PR (targeting that protected branch) → wait for CI green → `gh pr merge --merge` (preserves history via `--no-ff`).
6. Hotfix exception: if `main` needs an emergency fix and `staging` has soak-time work that cannot be promoted, branch from `main`, fix, PR to `main`, then back-merge `main` → `staging` via PR.

#### Dependabot security exception

Dependabot opens two distinct kinds of PR, and they target different branches by design:

- **Version updates** (the grouped weekly bumps in `.github/dependabot.yml`) honor `target-branch: 'staging'` and land on `staging`. They follow the normal 6-step flow.
- **Security updates** (driven by Dependabot security alerts) ignore `target-branch` entirely — GitHub ALWAYS opens them against the default branch `main`. This is expected platform behavior, not a misconfiguration.

Operative rule (verifiable without judgment):

1. A `dependabot` PR whose base is `main` IS, by construction, a security update (because every version update goes to `staging`). It may be merged to `main` via PR — provided **CI is fully green** (build + typecheck + tests + e2e + audit) — as an extension of the hotfix exception above. Never automerge; the merge stays a human decision.
2. After EVERY merge to `main`, back-merging `main` → `staging` is MANDATORY. The `sync-main-to-staging.yml` workflow opens that PR automatically; if it does not run, do it by hand. Skipping this does not avoid the problem — it MOVES the baseline-mismatch red from `main` to `staging` (a feature PR on `staging` then fails `pnpm audit` for a fix that only exists on `main`).
3. A security PR can be born red purely because `main` lags `staging` on an unrelated fix (e.g. a transitive `undici` override). That red is a baseline artifact, not the bumped dependency. Promote the missing fix into `main` first (or rebase the PR after the back-merge lands), then re-check.

### Branch Workflow (since 2026-05-12)

ALL new work follows this 6-step flow (full reference: [`.claude/docs/git-branch-workflow.md`](.claude/docs/git-branch-workflow.md)):

1. Cut worktree/branch from **`staging`** (NOT `main`).
2. Make changes in that branch.
3. Leave everything green (typecheck + lint + test) on that branch.
4. Open PR targeting `staging`. The PR title MUST start with a work tag — `[SPEC-NNN]` or `[NOSPEC:<slug>]` (see Git Conventions → PR titles). CI (`Validate PR Title`) rejects PRs without it.
5. Merge PR into `staging`.
6. ONLY when the user explicitly says so (after soak time in staging), merge `staging` → `main`.

`main` is the validated baseline; `staging` is the integration line. Never branch features from `main`, never PR features into `main`. The only exception is a production hotfix (branch from `main`, fix, PR to `main`, then back-merge `main` → `staging`).

#### Post-merge: a merged PR is DONE — new work needs a new branch + new PR

When a PR is merged, GitHub closes it. Pushing additional commits to the same branch DOES NOT reopen the PR — those commits become orphans living on a branch with no review surface. This is silent — git accepts the push, you only notice later when the work isn't anywhere.

**Rules to prevent orphan commits:**

1. Before pushing to any branch that has had a PR opened against it, ALWAYS check whether the PR is still open:

   ```bash
   GITHUB_TOKEN= gh pr list --head <branch-name> --state all --json number,state,title
   ```

   If the PR is `MERGED` or `CLOSED`, the branch is done. Pushing more commits to it goes nowhere.

2. If you discover a bug or follow-up after the original PR merged, treat it as new work:

   ```bash
   git fetch origin staging
   git checkout -b fix/HOS-<n>-<followup-slug> origin/staging
   # cherry-pick or re-author the fix here
   git push -u origin fix/HOS-<n>-<followup-slug>
   GITHUB_TOKEN= gh pr create --base staging --head fix/HOS-<n>-<followup-slug> ...
   ```

3. Claude operating rule: BEFORE running `git push` on a branch you previously opened a PR from, run `gh pr list --head <branch>` and verify state. If `MERGED`/`CLOSED`, STOP and tell the user "the PR is closed — I need to cut a new branch for this follow-up". Never silently push to a closed-PR branch and assume the user will notice.

### Biome Lint Gotchas

Common biome errors that block commits:

- **`useDefaultParameterLast`**: Parameters with default values MUST come after required parameters. `fn(a, b = 'x', c)` fails.. use `fn(a, c, b = 'x')`
- **`noExplicitAny`**: `biome-ignore` comments on interface/type properties do NOT work.. use proper types like `SectionConfig[]` instead of `any[]`
- **`useExhaustiveDependencies`**: `useMemo`/`useEffect` must list ALL dependencies. When using properties from an object, pass the whole object (e.g., `[config]` instead of individual `config.title`, `config.basePath`, etc.)
- **`noUnusedVariables`**: Prefix unused parameters with `_` (e.g., `_c` instead of `c`)

## Patterns and Conventions

### API Routes (Hono)

- Use route factory functions (`createSimpleRoute`, `createOpenApiRoute`, `createListRoute`)
- Import schemas from `@repo/schemas`
- Use `ResponseFactory` for consistent responses
- Extract business logic to services.. keep routes thin

### Services (service-core)

- All services extend `BaseCrudService`
- Return `Result<T>` type for consistent error handling
- Permission checks use `PermissionEnum` only (never check roles directly)
- Use `runWithLoggingAndValidation()` for automatic logging

### Database (Drizzle)

- All access through models extending `BaseModel`
- Soft delete by default
- Use transactions for multi-step operations
- Initialize database once at app startup with `initializeDb()`

### Web (Astro)

- Astro components by default, React only when interactivity needed
- Minimize client-side JavaScript
- Use `client:*` directives wisely (prefer `client:idle` or `client:visible`)
- i18n for all user-facing text
- **Styling**: vanilla CSS / CSS Modules (`*.module.css` colocated with the component). Do NOT use Tailwind utility classes here — Tailwind is admin-only.
- Forms: native HTML + small custom hooks (NOT TanStack Form — that's admin-only)

### Admin (TanStack Start)

- File-based routing in `src/routes/`
- TanStack Query for server state
- Shadcn UI components for consistent UI
- Better Auth authentication with `beforeLoad` guards
- **Styling**: Tailwind CSS v4 utility classes. Do NOT use CSS Modules here.
- Forms: TanStack Form (`@tanstack/react-form`) + Zod schemas from `@repo/schemas` (validation via `schema.safeParse()` inside form handlers — NOT `zodResolver`)

## Environment Configuration

See [docs/guides/environment-variables.md](docs/guides/environment-variables.md) for the full reference and [docs/guides/env-management.md](docs/guides/env-management.md) for the operational workflow (local dev + Coolify prod). Each app has its own `.env.example` in its directory (e.g., `apps/api/.env.example`).

The canonical registry of all env vars lives in `packages/config`. Use `pnpm env:check:registry` to validate that app schemas are in sync with the registry (this is the CI gate; runs three per-app vitest suites). Remote env management is done via `hops env-*` on the VPS (see `docs/guides/env-management.md`).

### Adding a new environment variable (workflow)

When introducing a new env var, ALL of the following must happen in the same change:

1. **Register it** in `packages/config/src/env-registry.*.ts` with full metadata (`description`, `type`, `required`, `secret`, `defaultValue`, `exampleValue`, `apps`, `category`).
2. **Add Zod validation** in the consuming app's `env.ts` (e.g., `apps/api/src/utils/env.ts`).
3. **Update `.env.example`** in each consuming app with a safe placeholder value.
4. **Document it** if its purpose is non-obvious (in the relevant `docs/` guide or app `CLAUDE.md`).
5. **Set the value in Coolify** for every environment that needs it. Two equivalent paths:
   - **CLI (preferred for ops):** SSH to the VPS and run `hops env-set <kind> KEY VALUE` (or `--secret` for a masked prompt). Then `hops redeploy <kind>` to pick up the change.
   - **UI:** Open `https://coolify.hospeda.com.ar` → app (`hospeda-api-prod`, `hospeda-web-prod`, `hospeda-admin-prod`) → Environment Variables → add the new key → Save → Redeploy.

> Claude operating rule: when adding/modifying env vars, after step 4 STOP and tell the user "I added env var X to the registry — please set it in Coolify for `<app>` and trigger a redeploy (use `hops env-set <kind> KEY VALUE` from the VPS or the Coolify UI)". Never leave a registered var unset on the deployment platform.

Key environment variables:

```bash
# Database
HOSPEDA_DATABASE_URL=postgresql://user:pass@localhost:5432/hospeda

# Authentication (Better Auth)
HOSPEDA_BETTER_AUTH_SECRET=your-secret-key-min-32-chars
HOSPEDA_BETTER_AUTH_URL=http://localhost:3001/api/auth

# Trusted origins
HOSPEDA_API_URL=http://localhost:3001
HOSPEDA_SITE_URL=http://localhost:4321
HOSPEDA_ADMIN_URL=http://localhost:3000

# Server (no HOSPEDA_ prefix - framework-level)
NODE_ENV=development
API_PORT=3001
```

## Dependency Policy (Quick Reference)

| Need | Use | NEVER |
|------|-----|-------|
| Icons | `@repo/icons` | phosphor-react direct, inline SVG |
| Validation | Zod via `@repo/schemas` | yup, joi, class-validator |
| UI (Admin) | Shadcn UI | MUI, Ant Design, Chakra |
| UI (Web) | Astro components, React islands | Full React pages |
| Forms | TanStack Form + Zod (admin), native HTML (web) | Formik, React Hook Form |
| Tables | TanStack Table | ag-grid |
| Data fetching | TanStack Query (admin) | SWR, axios |
| Styling (Admin) | Tailwind CSS v4 | CSS modules, styled-components, vanilla CSS |
| Styling (Web) | Vanilla CSS / CSS Modules (`*.module.css`) | Tailwind utility classes, styled-components |
| Testing | Vitest + testing-library | Jest, Mocha |
| Lint/Format | Biome | ESLint, Prettier |
| Logging | `@repo/logger` | console.log in apps |
| i18n | `@repo/i18n` | i18next direct |
| Database | Drizzle via `@repo/db` | raw SQL, Prisma |
| Auth | Better Auth via `@repo/auth-ui` | Clerk, custom auth |
| Money | integer (centavos) | numeric(), float |
| HTTP | native fetch | axios |
| LIKE search | `safeIlike()` from `@repo/db` | raw `ilike()` from `drizzle-orm` |

Full details: [docs/guides/dependency-policy.md](docs/guides/dependency-policy.md)

## Common Gotchas

- **Amenity/feature catalog (SPEC-266)**: the `name` column was DROPPED. Display labels come from `@repo/i18n` (`accommodations.amenityNames.<slug>` / `accommodations.featureNames.<slug>`), keyed by `slug`. The amenity/feature slug regex now allows underscores (`^[a-z0-9]+(?:[-_][a-z0-9]+)*$`) — the slug IS the i18n key. Both tables carry `applicable_verticals text[]`; public catalog endpoints (`/api/v1/public/amenities|features`) accept `?applicableVertical=accommodation|gastronomy|experience` to scope results. **BETA-90** (remove `name` → i18n by slug) is ABSORBED by SPEC-266 — do not plan it separately.
- **Biome `useDefaultParameterLast`**: Params with defaults MUST come after required params
- **Biome `noExplicitAny`**: `biome-ignore` on interface/type properties does NOT work.. use proper types
- **Biome `useExhaustiveDependencies`**: Pass whole objects (e.g. `[config]`) not individual properties
- **Billing DB schema**: `billing_plans.id` is UUID but `billing_subscriptions.plan_id` is varchar
- **Billing DB schema**: `billing_customers` uses `segment` column, not `category`
- **Pagination**: Admin routes use `page`+`pageSize` (NOT `limit`). `createAdminListRoute` rejects unknown params
- **Env vars**: Server-side use `HOSPEDA_` prefix, client-side use `PUBLIC_` prefix (web) or `VITE_` prefix (admin)
- **No legacy env aliasing**: Per SPEC-035, env vars are validated by Zod against `HOSPEDA_*` names exclusively in `apps/api/src/utils/env.ts` (`ApiEnvBaseSchema`). There is NO runtime mapping from unprefixed names. The only accepted exceptions are platform-injected vars (`NODE_ENV`, `CI`, `API_PORT`, `API_HOST`) which are read as-is. See [docs/guides/environment-variables.md](docs/guides/environment-variables.md) for the full policy.
- **Auth**: NEVER check roles directly.. always use `PermissionEnum`
- **Two migration carriles** — structural changes (tables/columns/indexes/FKs/enums) go to `packages/db/src/migrations/` via `pnpm db:generate` + `pnpm db:migrate`; Drizzle-invisible objects (triggers, materialized views, CHECK constraints, special indexes) go to `packages/db/src/migrations/extras/` (hand-written, idempotent, re-applied by `pnpm db:apply-extras`). Always run `db:apply-extras` after `db:migrate`. See [packages/db/CLAUDE.md](packages/db/CLAUDE.md) and [docs/guides/migrations.md](docs/guides/migrations.md).
- **`db:push` is dev-only** — NEVER run `drizzle-kit push` against the VPS. Use `pnpm db:migrate` for staging and production. On VPS use `hops db-migrate --target=staging|prod`.
- **`db:generate` before a schema PR** — the drift guard blocks CI if the TS schema changed without a committed migration file.
- **LIKE wildcard injection**: NEVER use raw `ilike()` from `drizzle-orm`. Always use `safeIlike()` from `@repo/db`, which auto-escapes `%`, `_`, and `\` metacharacters. CI will reject PRs with raw `ilike()` in production source. See `packages/db/src/utils/drizzle-helpers.ts`.

## Single Source of Truth

Every piece of data, logic, or configuration MUST have exactly ONE canonical location. Never duplicate definitions.

| Aspect | Canonical Source | Never Duplicate In |
|--------|-----------------|-------------------|
| Types & validation | `@repo/schemas` (Zod schemas) | API routes, frontend, services |
| Business logic | `@repo/service-core` | API routes, frontend |
| Auth logic | `@repo/auth-ui` + Better Auth | Custom auth code in apps |
| Styling tokens | `@repo/tailwind-config` | Hardcoded values in components |
| i18n strings | `@repo/i18n` locale files | Hardcoded strings in components |
| Icons | `@repo/icons` | Inline SVGs, direct phosphor imports |
| DB access | `@repo/db` models | Raw SQL in services or routes |
| Env config | `@repo/config` | Per-app env parsing |
| Logging | `@repo/logger` | `console.log` in apps |

When introducing a new pattern, utility, or constant.. first check if it already exists in a shared package. If it does, use it. If it should be shared, add it to the right package instead of duplicating locally.

## Spec & Task Management

**Since 2026-07-01, Linear is the single source of truth for spec/roadmap tracking.**
All non-trivial work MUST go through Linear + `.specs/`. This replaced the old
`.qtm/`-based system (index.json + CSV) to eliminate desync across worktrees/agents —
see "Legacy system" below for why.

### Model

- **Linear** (workspace `hospeda-beta`, team **`Hospeda`**, key **`HOS`**) owns: which
  specs exist, their macro status (Backlog/In Progress/Done/Canceled), priority,
  dependencies/relations between specs, bugs, small tasks, "needs spec" ideas, owner
  decisions, env vars added/changed, migrations added, and global architecture/product
  decisions. Team **`Beta Feedback`** (key `BETA`) is the separate, pre-existing team
  for user/QA-reported bugs and small items (via the `/linear-backlog` skill) — it is
  NOT used for formal specs.
- **`.specs/HOS-<n>-<slug>/`** (repo root) owns: the technical spec (`spec.md`),
  Task Master's internal implementation tracking (`tasks/`), auxiliary docs (`docs/`),
  and an optional `closeout.md`. Read [`.specs/README.md`](.specs/README.md) before
  creating or resolving a spec — it has the full layout, frontmatter, and resolution
  rules ("spec 123" → `HOS-123` → `.specs/HOS-123-*/spec.md`).
- **Task Master** (the `task-master` plugin) is used ONLY for internal implementation
  tracking inside one spec's `tasks/` folder (task-from-spec, next-task, quality-gate,
  task-atomizer). It does NOT track specs globally anymore — do not treat any Task
  Master dashboard/index as authoritative for roadmap, priority, or macro status.
  `task-master:spec-allocation` (SPEC-NNN numbering) is retired for new specs: Linear's
  issue counter is the collision-free ID source now.
  - Hospeda's `.claude/project.config.json` already declares `taskMaster.backend: "linear"`
    (team `Hospeda`, key `HOS`), so `/spec`, `/tasks`, `/next-task`, etc. resolve
    against Linear once the plugin ships that support. As of 2026-07-01 this requires
    `qazuor/claude-code-plugins` task-master ≥ 2.4.0, shipped in
    [PR #2](https://github.com/qazuor/claude-code-plugins/pull/2) — **not yet merged**.
    Until it merges, `/task-master:*` commands still run the local-index code path
    and will NOT talk to Linear correctly; create/update Linear issues and
    `.specs/HOS-xxx-slug/` folders by hand following this section's conventions in
    the meantime.

### Workflow

1. **Before creating anything new** — search Linear first (`mcp__linear__list_issues`
   or the Hospeda team views) for an existing issue: a `kind:needs-spec`, an existing
   `kind:spec`, a related bug, or a pending owner decision. Don't create a duplicate.
2. **New feature/change** → create (or use an existing) Linear issue in team `Hospeda`
   using the "Spec Implementation" template (`kind-spec` label), then create
   `.specs/HOS-<n>-<slug>/spec.md` (the "Spec Implementation" template) with
   `linear: HOS-<n>` + `statusSource: linear` in its frontmatter.
3. **Implementing** → use `/task-master:task-from-spec` and `/task-master:next-task` as
   before, but tracking lives inside `.specs/HOS-<n>-<slug>/tasks/`, not a global index.
4. **Task completed** → quality gate (`/task-master:quality-gate`) before marking done.
5. **Macro status changes** (started / blocked / done / needs owner decision) → update
   the Linear issue's state + labels directly. Do not write status anywhere in the repo.
6. **Env vars / migrations / global decisions** discovered mid-implementation → record
   them on the Linear issue's "Env vars added/changed" / "Migrations added" / "Global
   decision log" sections, not in `.specs/`.
7. **Promoting an internal task to a Linear issue**: do this when a task blocks another
   spec, needs a second agent in parallel, survives as an out-of-scope follow-up,
   represents an owner decision, or must be visible on the roadmap independent of this
   spec's closure. Don't create a Linear issue per microtask — see [`.specs/README.md`](.specs/README.md).
8. **Closing a spec** → fill `.specs/HOS-<n>-<slug>/closeout.md` if warranted, update
   the Linear issue with what shipped/PRs/tests/smoke/follow-ups, and mark it Done.

### Resolving "spec N"

If the user says "work on spec 123", resolve it as Linear issue `HOS-123`, then open
`.specs/HOS-123-*/spec.md`. Never invent a new `SPEC-NNN` identifier for new work —
that numbering belongs to the retired `.qtm/` system (see below). If ambiguous
(could be a legacy `SPEC-123` still in flight), say so and ask.

### State Management Rules

- **ALWAYS** update task status when starting work (`pending` → `in_progress`) inside the spec's own `tasks/` folder
- **ALWAYS** run quality gate before marking a task `completed`
- **ALWAYS** update the Linear issue's state when starting/finishing a spec — this is now the ONLY place macro status lives
- **NEVER** leave a task as `in_progress` at the end of a session without documenting progress via `mem_session_summary`
- **NEVER** start working on code without first checking Linear + `.specs/` for a relevant spec/task
- If requirements change mid-work, use `/task-master:replan` instead of ad-hoc modifications, then reflect the change on the Linear issue

### Closing a spec — Linear state, not local files

Running `/closeSpec HOS-N` at the end of a spec's implementation is a standing
personal-workflow rule from the user's global `~/.claude/CLAUDE.md` (not repeated
here — that file is the source of truth for when it applies). What follows is
Hospeda-specific: how `/closeSpec` actually writes the state, and a live incident
worth knowing about before touching PR titles.

`/closeSpec` marks the Linear issue `Done` deterministically via the `index-sync`
skill's Linear backend (`mcp__linear__save_issue({id, state: "Done"})`) — see
`~/.claude/commands/closeSpec.md`. Do not hand-roll this with a raw
`mcp__linear__save_issue` call outside the command; keep the write path centralized.

**PR magic-word convention (belt-and-suspenders, not a replacement for
`/closeSpec`)**: the ONE pull request that truly completes a spec's implementation
(whichever PR that is — the only PR for a single-PR spec, or the final one for a
multi-PR spec) should include the literal phrase **`Closes HOS-N`** somewhere in
its PR **description** (GitHub/Linear only recognize magic words in the PR body,
never in a comment or the title alone). Merging that PR then auto-transitions the
Linear issue to Done via the GitHub integration, independent of whether
`/closeSpec` gets run afterward. **Never** put `Closes`/`Fixes`/`Resolves`/
`Implements` (or any other Linear magic word) in a partial/incremental PR that
does NOT complete the spec — doing so prematurely closes the issue on an unrelated
merge.

**Known-live footgun (hit twice already, 2026-07-02)**: Hospeda's Linear team has
`Settings → Workflows & automations → Pull request and commit automations →
"On PR merge, move to..."` set to `Done`, and this fires on ANY PR whose **title**
links an issue — no magic word required, no completeness check. PR #1982 (a batch
doc-migration PR) had `HOS-36` in its title and closed that issue with zero real
work done; PR #1983 did the identical thing to `HOS-54` (an Urgent-priority issue)
the very next attempt. Both were manually reverted to Backlog. **Until the owner
disables this automation** (set `On PR merge, move to...` to `No action`, leaving
only `/closeSpec` and deliberate `Closes HOS-N` magic words as valid close paths),
treat any bare `HOS-N` mention in a PR **title** as a live risk: after merging such
a PR, spot-check `mcp__linear__get_issue` on every issue named in that title before
trusting its state, and prefer NOT putting an HOS-N in a PR title unless that PR is
genuinely the completing work for that issue.

### Legacy system (`.qtm/`) — do not use for new work

`.qtm/specs/index.json`, `.qtm/tasks/index.json`, and `specs-prioritization.csv` are
**retired as sources of truth** (2026-07-01 Linear migration). They are NOT deleted —
existing `.qtm/specs/SPEC-NNN-slug/` folders for specs still in flight from before the
migration stay there as historical/working record until closed or migrated to a
`.specs/HOS-xxx-slug/` folder — but:

- **NEVER** create a new `SPEC-NNN` entry, folder, or CSV row for new work.
- **NEVER** treat `.qtm/specs/index.json` / `.qtm/tasks/index.json` status as accurate
  without verifying against `gh pr list` / actual code — the migration audit found
  several specs silently shipped-but-never-closed in these files (real precedent, not
  hypothetical: SPEC-239/285/289/291 were fully merged while the index still said
  `in-progress`). Don't repeat that pattern by trusting these files going forward.
- `scripts/render-specs-prioritization.py` (the CSV viewer/editor) was removed
  entirely along with the `pnpm specs:board` script — it has no replacement, since
  live tracking now lives in Linear directly.
- If you finish a legacy `SPEC-NNN` spec that never got a Linear issue, migrate it on
  close: create the `HOS-xxx` issue (kind-spec, state Done) summarizing what shipped,
  optionally move `spec.md` into `.specs/HOS-xxx-slug/`, and leave a note in the old
  `.qtm/specs/SPEC-NNN-slug/` folder pointing at the new `HOS-xxx` issue.

## Important Notes

- Default locale is Spanish (`es`) for the Argentina market. Supported locales: es, en, pt
- Billing integration uses MercadoPago (Argentina payment processor)
- All packages are tree-shakeable with ESM
- Schemas package (`@repo/schemas`) is the single source of truth for types
- Service-core package contains all business logic.. API routes are thin wrappers

## App-Specific Documentation

Each app/package has its own `CLAUDE.md` with detailed instructions:

- [Admin App](apps/admin/CLAUDE.md) - TanStack Start dashboard
- [API App](apps/api/CLAUDE.md) - Hono REST API
- [Web App](apps/web/CLAUDE.md) - Astro frontend
- [Web App Docs](apps/web/docs/README.md) - Web app guides and deployment
- [Database](packages/db/CLAUDE.md) - Drizzle ORM
- [Schemas](packages/schemas/CLAUDE.md) - Zod validation
- [Service Core](packages/service-core/CLAUDE.md) - Business logic
- [i18n](packages/i18n/CLAUDE.md) - Internationalization
- [i18n Docs](packages/i18n/docs/README.md) - i18n guides and API reference
- [Icons](packages/icons/CLAUDE.md) - Icon components
- [Logger](packages/logger/CLAUDE.md) - Logging
- [Billing](packages/billing/CLAUDE.md) - Billing/monetization
- [Billing Docs](packages/billing/docs/README.md) - Billing API and integration guides
- [Auth UI](packages/auth-ui/CLAUDE.md) - Auth components
- [Auth UI Docs](packages/auth-ui/docs/README.md) - Auth UI guides and quick start
- [Notifications Docs](packages/notifications/docs/README.md) - Notification system guides
- [Tailwind Config](packages/tailwind-config/CLAUDE.md) - Design tokens
- [Seed](packages/seed/CLAUDE.md) - Database seeding

## Project Documentation

- [Architecture Decisions (ADRs)](docs/decisions/README.md) - Why we chose each technology
- [Guides](docs/guides/README.md) - Step-by-step development guides
- [Dependency Policy](docs/guides/dependency-policy.md) - What to use for what
- [Full Documentation Index](docs/index.md)

## Spec Workflow + Worktrees

Hay **DOS fases separadas**, y el worktree se crea SOLO en la segunda. Crear un
worktree clona node_modules (cientos de MB) + una DB por worktree; hacerlo solo
para escribir los docs de una spec desperdicia disco al pedo. Por eso el worktree
se difiere hasta que realmente se arranca la implementación.

> **Desde 2026-07-01**: el número de spec sale de Linear (`HOS-<n>`), no de una skill
> de allocation local. Ver [Spec & Task Management](#spec--task-management) para el
> modelo completo. Lo que sigue solo cambió en la numeración/paths; la lógica de
> "worktree recién en Fase 2" sigue igual.

#### Fase 1 — Crear la spec (NUNCA se crea worktree)

Cuando el usuario pide una **spec nueva** (vía `/task-master:spec`, `/spec`, o creando
un dir nuevo en `.specs/HOS-<n>-slug/`):

1. **NO crear worktree ni el branch de implementación.** Trabajar en una **branch
   ligera de docs**, sin worktree. Una branch de git es gratis (unos KB); lo caro
   es el worktree (node_modules + DB), y eso NO se crea en esta fase.
2. **Crear (o reusar) el issue en Linear primero** (team `Hospeda`, template "Spec
   Implementation" o "Needs Spec") — el número `HOS-<n>` sale de ahí, nunca se inventa.
3. **Generar los docs** en `.specs/HOS-<n>-slug/spec.md` (frontmatter con
   `linear: HOS-<n>` + `statusSource: linear`). Sin índices que actualizar — el
   macro-estado vive en el issue de Linear, no en el repo.
4. **Versionar y mergear sin worktree**: desde el working tree actual,
   `git fetch origin staging` + `git checkout -b spec/HOS-<n>-docs origin/staging`,
   commitear SOLO los archivos de la spec, y abrir PR a `staging` con título
   `[HOS-<n>] docs(spec): ...`. La spec queda en staging sin haber materializado
   un worktree.
5. La spec existe y está versionada, pero **sin entorno de desarrollo todavía**.
   Eso es deliberado: el entorno se arma recién al implementar.

#### Fase 2 — Implementar la spec (RECIÉN acá se crea el worktree)

Cuando se arranca la **implementación** de una spec ya creada (el usuario lo pide
explícitamente, o se empieza a tocar código):

1. **Crear worktree + branch de implementación por default, sin preguntar** (la
   política global de `~/.claude/CLAUDE.md` "preguntar primero" NO aplica para
   implementación de specs formales — el usuario eligió default-on para este caso).
2. **Nombre**: `spec-hos-<n>-<slug>` (ej: `spec-hos-12-booking-calendar-ui`).
3. **Path**: `../hospeda-spec-hos-<n>-<slug>` (al lado del repo, no dentro).
4. **Branch**: `spec/HOS-<n>-<slug>` (Linear matchea el ID en cualquier parte del
   nombre de branch, así que este prefijo sigue auto-linkeando en GitHub).

Specs legacy todavía en curso desde antes de la migración (`.qtm/specs/SPEC-NNN-slug/`,
sin issue `HOS-xxx` propio) siguen usando la convención vieja (`spec-<NNN>-<slug>`,
branch `spec/SPEC-<NNN>-<slug>`) hasta que cierren o se migren.
5. **Antes de crear**: correr `git worktree list` y revisar. Si ya existe una worktree para esa spec (matching nombre o branch), USAR esa en lugar de crear nueva. Avisar al usuario "ya existe la worktree X en path Y, sigo ahí".
6. **Después de crear (OBLIGATORIO copiar env)**: ejecutar SIEMPRE, desde la raíz del repo, `./scripts/copy-env-to-worktree.sh <ruta-ABSOLUTA-del-worktree>`. El script lee `.worktreeinclude` y copia los `.env.local` / `docker/.env` gitignored que `git worktree add` NO copia solo. Sin esto la worktree no arranca. **Usar ruta ABSOLUTA siempre** (tanto en `git worktree add` como acá): `git worktree add ../foo` resuelve el `..` contra el cwd del shell, NO contra la raíz del repo, y si el cwd es un subdir crea el worktree anidado en el lugar equivocado. Después avisar al usuario el path absoluto y sugerir abrir nueva terminal o `cd` ahí. **Atajo**: `bash ~/.claude/skills/worktree/scripts/wt-create.sh <type> <slug>` hace `git worktree add` + esta copia de env + `pnpm install` + build de packages en un solo paso (respeta los patrones de `.claude/project.config.json`).
7. **Guardar nota** en engram con `topic_key: spec/HOS-<n>-<slug>/worktree` con path + branch + estado, para que futuras sesiones la encuentren.

### Operar el worktree (levantar / bajar la app)

Para correr la app en un worktree (los 3 servers con puertos + DB aislados), **NO levantes los servers ni armes la DB a mano** — usá los comandos del skill `worktree` (vive en `~/.claude/skills/worktree/`, manejado por `.claude/project.config.json`). Guía completa: [`docs/guides/worktree-dev-environments.md`](docs/guides/worktree-dev-environments.md).

Dos pares simétricos:

- `pnpm cli wt:up` — levanta todo: puertos libres, DB por worktree clonada del template (o auto-heal), env, build de packages, 3 servers, health wait. Idempotente.
- `pnpm cli wt:down` — para los servers **solamente** (DB + worktree quedan; `wt:up` reinicia al instante).
- `pnpm cli wt:remove` — teardown total (servers + DB + worktree + branch); funciona desde adentro del worktree.
- `pnpm cli wt:create` — imprime el uso de `wt-create.sh <type> <slug>` (el CLI no pasa args interactivos).

Bootstrap (una vez por máquina): `bash ~/.claude/skills/worktree/scripts/wt-db.sh build-template` crea `hospeda_template` desde `hospeda_dev` para que los worktrees clonen la DB al instante.

> Sub-agentes: NO heredan el catálogo de skills. Si delegás trabajo de worktree, pasales en el prompt el path `~/.claude/skills/worktree/SKILL.md` y esta sección.

### Excepciones (NO crear worktree ni siquiera al implementar)

Incluso en la Fase 2, NO crear worktree cuando:

- Es una spec **delta** o continuación de una spec existente — ya tiene su worktree.
- Specs marcadas como `status: draft-exploration` en frontmatter (todavía exploratorias, no formales).
- Trabajo de SOLO documentación / lectura (sin edits a código) — incluida la Fase 1 (crear la spec), que por definición NUNCA crea worktree.

Para cualquier OTRO trabajo que NO sea spec formal, aplica la política global "Worktree Policy" en `~/.claude/CLAUDE.md` (preguntar primero al usuario si quiere worktree).
