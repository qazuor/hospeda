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
pnpm deploy:api       # Build + deploy API to Fly.io
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

- **TDD approach**: Write tests first, then implement
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

Key environment variables (see `.env.example`):

```bash
# Database
HOSPEDA_DATABASE_URL=postgresql://...

# Authentication (Better Auth)
HOSPEDA_BETTER_AUTH_SECRET=your-secret-key
HOSPEDA_BETTER_AUTH_URL=http://localhost:3001/api/auth

# API
HOSPEDA_API_URL=http://localhost:3001

# Site
HOSPEDA_SITE_URL=http://localhost:4321
```

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
- [Database](packages/db/CLAUDE.md) - Drizzle ORM
- [Schemas](packages/schemas/CLAUDE.md) - Zod validation
- [Service Core](packages/service-core/CLAUDE.md) - Business logic
- [i18n](packages/i18n/CLAUDE.md) - Internationalization
- [Icons](packages/icons/CLAUDE.md) - Icon components
- [Logger](packages/logger/CLAUDE.md) - Logging
- [Seed](packages/seed/CLAUDE.md) - Database seeding
