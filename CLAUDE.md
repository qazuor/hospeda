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
pnpm db:migrate       # Apply migrations
pnpm db:generate      # Generate migration from schema changes
pnpm db:studio        # Open Drizzle Studio
pnpm db:seed          # Seed database
pnpm db:fresh         # Reset + migrate + seed
pnpm db:fresh-dev     # Reset + push schema + seed (dev shortcut)

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

### Billing testing — manual smoke checklist required (SPEC-143)

Any PR that touches the billing surface (checkout, webhooks, cron, refund, admin billing ops, entitlements) MUST have the relevant manual staging smoke executed before merging to `staging`, in addition to CI passing. The vitest e2e suite uses an MP stub and cannot catch divergences between the stub and real MercadoPago behavior; the staging smoke against the real MP sandbox is the gate.

Workflow:

1. Before opening the PR, identify which sections of [`.claude/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md`](.claude/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md) the change exercises.
2. Run those sections against `https://staging.hospeda.com.ar` with the MP sandbox credentials configured on `hospeda-api-staging`. Use [`.claude/specs/SPEC-143-billing-testing-coverage/docs/mp-test-cards-reference.md`](.claude/specs/SPEC-143-billing-testing-coverage/docs/mp-test-cards-reference.md) to pick the right card + cardholder combo per sub-flow.
3. File the sign-off entry inside the relevant section of the checklist (date, executor, PR number, result, notes).
4. Reference the sign-off in the PR description so reviewers can verify it.
5. For PRs that change the **billing CORE** (start-paid route, webhook handlers, dunning/exchange-rate crons, refund flow, admin billing ops), the prod smoke ([`.claude/specs/SPEC-143-billing-testing-coverage/docs/prod-smoke-checklist.md`](.claude/specs/SPEC-143-billing-testing-coverage/docs/prod-smoke-checklist.md)) MUST be executed too — that's the production go-live gate. Routine billing-touching PRs (UI tweaks, copy changes, schema additions) only need staging.

Failed smokes block merge. Notes-only passes (smoke surfaces a known documented bug from an engram entry) can merge but the bug entry must be linked from the PR.

This rule was approved as part of SPEC-143 phase 4 polish (engram `#532` decision Q1).

### Git Conventions

- **Conventional Commits**: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`, `workflow`, `types`, `del`, `misc`
- Atomic, focused commits
- Stage files individually (never `git add .` or `git add -A`)
- **Commit immediately after staging**.. never accumulate multiple `git add` groups without committing between them
- Exclude documentation/CLAUDE.md files from code commits (commit them separately if needed)
- Pre-commit hooks (husky + lint-staged + biome) run on ALL staged files.. if the hook fails, fix the issue and create a NEW commit (never amend)
- **Merge commit messages**: commitlint rejects `merge:` as a type. Use `chore: merge <source> into <target> (...)` instead.

### Protected Branches — `main` and `staging`

`main` and `staging` are protected by convention. GitHub-side branch protection is currently NOT available (private repo on the Free plan; tracked as SPEC-103 T-002 / T-003 blocked on a plan upgrade). Until then, protection is enforced AGENT-SIDE by these rules — read them as non-negotiable:

1. **NEVER** `git push` directly to `main` or `staging` (including `*:main` / `*:staging` ref forms, force pushes, and `-u` initial setups). `.claude/settings.json` enforces this with `deny` patterns; if you find yourself reasoning about how to bypass them, STOP and re-read this section.
2. **NEVER** merge a PR to `main` or `staging` unless the PR's last CI run is fully green. "CI Pass" being SUCCESS is the gate. Skipped jobs are OK; failed or cancelled jobs are NOT. Verify via `gh pr view <N> --json statusCheckRollup` before any `gh pr merge`.
3. **NEVER** use `gh pr merge --admin` to bypass failing CI on `main` or `staging`. Admin override on these branches is a last-resort human decision, not an agent decision.
4. **NEVER** `git commit --amend` on `main` or `staging`. Always create new commits.
5. The only path to change `main` / `staging`: branch → PR (targeting that protected branch) → wait for CI green → `gh pr merge --merge` (preserves history via `--no-ff`).
6. Hotfix exception: if `main` needs an emergency fix and `staging` has soak-time work that cannot be promoted, branch from `main`, fix, PR to `main`, then back-merge `main` → `staging` via PR.

### Branch Workflow (since 2026-05-12)

ALL new work follows this 6-step flow (full reference: [`.claude/docs/git-branch-workflow.md`](.claude/docs/git-branch-workflow.md)):

1. Cut worktree/branch from **`staging`** (NOT `main`).
2. Make changes in that branch.
3. Leave everything green (typecheck + lint + test) on that branch.
4. Open PR targeting `staging`.
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
   git checkout -b fix/SPEC-NNN-<followup-slug> origin/staging
   # cherry-pick or re-author the fix here
   git push -u origin fix/SPEC-NNN-<followup-slug>
   GITHUB_TOKEN= gh pr create --base staging --head fix/SPEC-NNN-<followup-slug> ...
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

- **Biome `useDefaultParameterLast`**: Params with defaults MUST come after required params
- **Biome `noExplicitAny`**: `biome-ignore` on interface/type properties does NOT work.. use proper types
- **Biome `useExhaustiveDependencies`**: Pass whole objects (e.g. `[config]`) not individual properties
- **Billing DB schema**: `billing_plans.id` is UUID but `billing_subscriptions.plan_id` is varchar
- **Billing DB schema**: `billing_customers` uses `segment` column, not `category`
- **Pagination**: Admin routes use `page`+`pageSize` (NOT `limit`). `createAdminListRoute` rejects unknown params
- **Env vars**: Server-side use `HOSPEDA_` prefix, client-side use `PUBLIC_` prefix (web) or `VITE_` prefix (admin)
- **No legacy env aliasing**: Per SPEC-035, env vars are validated by Zod against `HOSPEDA_*` names exclusively in `apps/api/src/utils/env.ts` (`ApiEnvBaseSchema`). There is NO runtime mapping from unprefixed names. The only accepted exceptions are platform-injected vars (`NODE_ENV`, `CI`, `API_PORT`, `API_HOST`) which are read as-is. See [docs/guides/environment-variables.md](docs/guides/environment-variables.md) for the full policy.
- **Auth**: NEVER check roles directly.. always use `PermissionEnum`
- **`drizzle-kit push` is not enough**: triggers, materialized views (`search_index`), and JSONB CHECK constraints on `billing_addon_purchases` are invisible to Drizzle. After any `drizzle-kit push` or `pnpm db:fresh-dev`, run `packages/db/scripts/apply-postgres-extras.sh`. See [ADR-017](docs/decisions/ADR-017-postgres-specific-features.md) and [triggers manifest](packages/db/docs/triggers-manifest.md).
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

All non-trivial work MUST go through the formal spec and task system. This ensures continuity across sessions, prevents duplicate work, and keeps progress trackable.

### Workflow

1. **New feature/change** → Use `/spec` to generate a formal specification in `.claude/specs/`
2. **Spec approved** → Use `/task-master:task-from-spec` to generate tasks
3. **Working on tasks** → Use `/task-master:next-task` to pick the next available task
4. **Task completed** → Quality gate (`/task-master:quality-gate`) before marking done
5. **Check progress** → Use `/task-master:task-status` or `/task-master:tasks`

### State Management Rules

- **ALWAYS** update task status when starting work (`pending` → `in_progress`)
- **ALWAYS** run quality gate before marking a task `completed`
- **ALWAYS** update spec status when all its tasks are done (`in-progress` → `completed`)
- **NEVER** leave a task as `in_progress` at the end of a session without documenting progress via `mem_session_summary`
- **NEVER** start working on code without first checking if there's a relevant spec/task
- When a spec is first worked on, update its status from `draft` → `in-progress`
- If requirements change mid-work, use `/task-master:replan` instead of ad-hoc modifications

### Index Sync Rules (CRITICAL — read every session that touches specs/tasks)

There are TWO index files that must stay in sync:

- `.claude/specs/index.json` — **source of truth** for spec status (driven by the formal spec workflow / `/spec`, `/task-master:*`, `/sdd-*`)
- `.claude/tasks/index.json` — **mirror** of spec status with task progress info (driven by task tracking)

The `task-master:session-resume` reminder at session start reads from `tasks/index.json`, NOT `specs/index.json`. If the two drift, every new session starts with **lies about what's active**. This already happened twice (2026-05-14 and 2026-05-15) — entries stayed `pending`/`in-progress` in `tasks/index.json` after the underlying spec was archived in `specs/index.json`.

**Rules:**

1. **When you archive a spec** (flip `status` to `completed` + `archived: true` in `specs/index.json`), you MUST in the same change flip the matching entry in `tasks/index.json`:
   - `status` → `completed`
   - `progress` → full (e.g. `99/99` not `94/99`)
   - `archived: true`
   - `archivedAt: <ISO date>`
   - Optionally `archiveNote` if there's anything notable (drift fix, supersession, etc.)
2. **Trust `specs/index.json` over `tasks/index.json`** on any disagreement — the formal spec workflow writes to specs first.
3. **At session start**, if the `session-resume` reminder shows "active epics" that look suspicious (too many, names you don't recognize as currently-worked, very low progress like 0/N), **cross-check against `specs/index.json` before reporting anything to the user**. Treat session-resume as a hint, not a fact.
4. **NEVER create new entries in `tasks/index.json` for specs that don't have a corresponding directory in `.claude/specs/SPEC-NNN-slug/`**. Orphan entries (specs that were never formalized) are the second source of drift — mark them `obsolete` with an archiveNote explaining why, never leave them `pending`.
5. Audit: a quick sanity check is `jq -r '.epics[] | select(.status != "completed" and .status != "merged" and .status != "obsolete") | .specId' .claude/tasks/index.json` — that list should match the `draft` / `in-progress` rows in `specs/index.json`. If it doesn't, fix `tasks/index.json` immediately.

### Spec Files Location

- Specifications: `.claude/specs/SPEC-NNN-slug/spec.md`
- Task state: `.claude/tasks/SPEC-NNN-slug/state.json`
- Progress: `.claude/tasks/SPEC-NNN-slug/progress.md`

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

Cuando se inicie una **nueva spec formal** en este repo (vía `/task-master:spec`, `/sdd-new`, o creando un dir nuevo en `.claude/specs/SPEC-NNN-slug/`):

1. **Por default crear worktree, sin preguntar** (la política global de `~/.claude/CLAUDE.md` "preguntar primero" NO aplica para specs formales — el usuario eligió default-on para este caso).
2. **Nombre**: `spec-<NNN>-<slug>` (ej: `spec-098-vps-migration`).
3. **Path**: `../hospeda-spec-<NNN>-<slug>` (al lado del repo, no dentro).
4. **Branch**: `spec/SPEC-<NNN>-<slug>` (sigue convención de specs del proyecto).
5. **Antes de crear**: correr `git worktree list` y revisar. Si ya existe una worktree para esa spec (matching nombre o branch), USAR esa en lugar de crear nueva. Avisar al usuario "ya existe la worktree X en path Y, sigo ahí".
6. **Después de crear**: copiar manualmente los archivos de `.worktreeinclude` (`git worktree add` no lo hace solo), avisar al usuario el path absoluto, y sugerir abrir nueva terminal o `cd` ahí.
7. **Guardar nota** en engram con `topic_key: spec/SPEC-<NNN>-<slug>/worktree` con path + branch + estado, para que futuras sesiones la encuentren.

### Excepciones (NO crear worktree, trabajar en directorio actual)

- Specs **deltas** o continuaciones de spec existente — ya tienen su worktree.
- Specs marcadas como `status: draft-exploration` en frontmatter (todavía exploratorias, no formales).
- Trabajo de SOLO documentación / lectura sobre la spec (sin edits a código).

Para cualquier OTRO trabajo que NO sea spec formal, aplica la política global "Worktree Policy" en `~/.claude/CLAUDE.md` (preguntar primero al usuario si quiere worktree).
