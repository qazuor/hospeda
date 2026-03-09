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
- **Deployment**: Vercel (API, Web, Admin)

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

# Environment
pnpm env:pull         # Pull env vars from remote (Vercel / secret store)
pnpm env:push         # Push local env vars to remote
pnpm env:check        # Validate env vars against the registry in packages/config
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

### Git Conventions

- **Conventional Commits**: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Atomic, focused commits
- Stage files individually (never `git add .` or `git add -A`)
- **Commit immediately after staging**.. never accumulate multiple `git add` groups without committing between them
- Exclude documentation/CLAUDE.md files from code commits (commit them separately if needed)
- Pre-commit hooks (husky + lint-staged + biome) run on ALL staged files.. if the hook fails, fix the issue and create a NEW commit (never amend)

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

### Admin (TanStack Start)

- File-based routing in `src/routes/`
- TanStack Query for server state
- Shadcn UI components for consistent UI
- Better Auth authentication with `beforeLoad` guards

## Environment Configuration

See [docs/guides/environment-variables.md](docs/guides/environment-variables.md) for the full reference. Each app has its own `.env.example` in its directory (e.g., `apps/api/.env.example`).

The canonical registry of all env vars lives in `packages/config`. Use `pnpm env:check` to validate your local env against it.

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
| Forms | React Hook Form + Zod (admin), native HTML (web) | Formik |
| Tables | TanStack Table | ag-grid |
| Data fetching | TanStack Query (admin) | SWR, axios |
| Styling | Tailwind CSS v4 | CSS modules, styled-components |
| Testing | Vitest + testing-library | Jest, Mocha |
| Lint/Format | Biome | ESLint, Prettier |
| Logging | `@repo/logger` | console.log in apps |
| i18n | `@repo/i18n` | i18next direct |
| Database | Drizzle via `@repo/db` | raw SQL, Prisma |
| Auth | Better Auth via `@repo/auth-ui` | Clerk, custom auth |
| Money | integer (centavos) | numeric(), float |
| HTTP | native fetch | axios |

Full details: [docs/guides/dependency-policy.md](docs/guides/dependency-policy.md)

## Common Gotchas

- **Biome `useDefaultParameterLast`**: Params with defaults MUST come after required params
- **Biome `noExplicitAny`**: `biome-ignore` on interface/type properties does NOT work.. use proper types
- **Biome `useExhaustiveDependencies`**: Pass whole objects (e.g. `[config]`) not individual properties
- **Billing DB schema**: `billing_plans.id` is UUID but `billing_subscriptions.plan_id` is varchar
- **Billing DB schema**: `billing_customers` uses `segment` column, not `category`
- **Pagination**: Admin routes use `page`+`pageSize` (NOT `limit`). `createAdminListRoute` rejects unknown params
- **Env vars**: Server-side use `HOSPEDA_` prefix, client-side use `PUBLIC_` prefix (web) or `VITE_` prefix (admin)
- **Legacy env var names**: `LEGACY_ENV_MAPPINGS` in `apps/api/src/utils/env.ts` maps old unprefixed names (e.g., `CRON_SECRET`) to their `HOSPEDA_*` equivalents for backward compat. New code must use only `HOSPEDA_*` names.
- **Auth**: NEVER check roles directly.. always use `PermissionEnum`

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
