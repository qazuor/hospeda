# Hospeda - Modern Tourist Accommodation Platform

Hospeda is a web platform for discovering and managing tourist accommodations in Concepcion del Uruguay and the Litoral region of Argentina. Built as a TypeScript monorepo with Astro, React, Hono, Drizzle ORM, and PostgreSQL.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Web App | [Astro 5](https://astro.build) + React islands | Minimal JS, SSR, SEO ([ADR-001](docs/decisions/ADR-001-astro-over-nextjs.md)) |
| Admin | [TanStack Start](https://tanstack.com/start) | Type-safe routing, file-based, full React |
| API | [Hono](https://hono.dev) | TypeScript-first, edge-ready, Zod integration ([ADR-003](docs/decisions/ADR-003-hono-over-express.md)) |
| Database | PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) | SQL-like API, tree-shakeable ([ADR-004](docs/decisions/ADR-004-drizzle-over-prisma.md)) |
| Auth | [Better Auth](https://www.better-auth.com) | Self-hosted, role-based ([ADR-002](docs/decisions/ADR-002-better-auth-over-clerk.md)) |
| Payments | [MercadoPago](https://www.mercadopago.com.ar) | Native ARS, dominant in Argentina ([ADR-005](docs/decisions/ADR-005-mercadopago-payments.md)) |
| Styling | Tailwind CSS v4 | Utility-first, dark mode, design tokens |
| Testing | Vitest | Fast, ESM-native, monorepo-compatible |
| Linting | Biome | Single tool for lint + format |
| Build | TurboRepo + pnpm | Fast builds, workspace isolation |
| Deployment | Vercel | Serverless, preview environments ([ADR-007](docs/decisions/ADR-007-vercel-deployment.md)) |

## Repository Structure

```
hospeda/
├── apps/
│   ├── api/               # Hono REST API (port 3001)
│   ├── web/               # Astro public website (port 4321)
│   └── admin/             # TanStack Start admin dashboard (port 3000)
├── packages/
│   ├── auth-ui/           # Shared auth UI components
│   ├── billing/           # Billing/monetization (MercadoPago)
│   ├── biome-config/      # Shared Biome configuration
│   ├── config/            # Shared configuration
│   ├── db/                # Drizzle ORM models and schemas
│   ├── i18n/              # Internationalization (es/en/pt)
│   ├── icons/             # Icon components (Phosphor wrappers)
│   ├── logger/            # Structured logging
│   ├── notifications/     # Notification system
│   ├── schemas/           # Zod validation schemas (source of truth)
│   ├── seed/              # Database seeding
│   ├── service-core/      # Business logic (BaseCrudService)
│   ├── tailwind-config/   # Shared Tailwind configuration
│   ├── typescript-config/  # Shared TypeScript config
│   └── utils/             # Shared utilities
├── docs/                  # Project documentation
└── scripts/               # Build and deployment scripts
```

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm 9.x
- PostgreSQL 15+
- Docker (for local DB)

### Setup

```bash
git clone https://github.com/qazuor/hospeda.git
cd hospeda
pnpm install
cp .env.example .env    # Edit with your configuration
pnpm db:start           # Start PostgreSQL + Redis (Docker)
pnpm db:migrate         # Apply migrations
pnpm db:seed            # Seed database
pnpm dev                # Start all apps
```

### Key Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm lint` | Biome linting |
| `pnpm format` | Biome formatting |
| `pnpm typecheck` | TypeScript validation |
| `pnpm db:fresh` | Reset + migrate + seed database |
| `pnpm db:studio` | Open Drizzle Studio |

## API Architecture

Three-tier route system:

| Tier | Pattern | Auth | Consumer |
|------|---------|------|----------|
| Public | `/api/v1/public/*` | None | Web app |
| Protected | `/api/v1/protected/*` | Session | Web app (logged in) |
| Admin | `/api/v1/admin/*` | Admin + permissions | Admin panel |

## Documentation

### Getting Started

- [Prerequisites](docs/getting-started/prerequisites.md)
- [Installation](docs/getting-started/installation.md)
- [Development Environment](docs/getting-started/development-environment.md)
- [Common Tasks](docs/getting-started/common-tasks.md)

### Architecture

- [Overview](docs/architecture/overview.md)
- [Monorepo Structure](docs/architecture/monorepo-structure.md)
- [Patterns](docs/architecture/patterns.md)
- [Architecture Decisions (ADRs)](docs/decisions/README.md)

### Guides

- [Adding New Entity](docs/guides/adding-new-entity.md)
- [Adding Web Pages](docs/guides/adding-web-pages.md)
- [Adding Admin Pages](docs/guides/adding-admin-pages.md)
- [Adding API Routes](docs/guides/adding-api-routes.md)
- [Authentication](docs/guides/authentication.md)
- [Dependency Policy](docs/guides/dependency-policy.md)
- [Branding and Theming](docs/guides/branding-and-theming.md)
- [All Guides](docs/guides/README.md)

### Operations

- [Deployment](docs/deployment/README.md)
- [Security](docs/security/README.md)
- [Monitoring](docs/monitoring/README.md)
- [Runbooks](docs/runbooks/README.md)
- [Billing](docs/billing/README.md)

### Testing

- [Testing Strategy](docs/testing/README.md)
- [Full Documentation Index](docs/index.md)

## Contributing

See [Contributing Guide](docs/contributing/README.md) for code standards, git workflow, and PR process.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
