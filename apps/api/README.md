# 🏨 Hospeda API

Modern REST API built with Hono, TypeScript, and PostgreSQL for the Hospeda tourism platform.

## Overview

Production-ready backend service providing comprehensive endpoints for accommodations, destinations, events, posts, and user management. Features include Better Auth authentication, rate limiting, metrics collection, OpenAPI documentation, and standardized error handling.

**Tech Stack:**

- **Framework**: Hono (fast, lightweight, edge-ready)
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth
- **Validation**: Zod schemas
- **Testing**: Vitest (>90% coverage)
- **Deployment**: Coolify on a self-hosted VPS (long-running Node container behind Cloudflare)

## Quick Start

```bash
# Install dependencies (from project root)
pnpm install

# Setup database
pnpm db:fresh

# Start development server
cd apps/api && pnpm dev

# Run tests
cd apps/api && pnpm test

# Type check
cd apps/api && pnpm typecheck
```

The API will be available at `http://localhost:3001`

## Key Features

- 🔐 **Authentication**: Better Auth session-based authentication
- 🛡️ **Security**: Rate limiting, CORS, security headers
- 📊 **Monitoring**: Built-in metrics and logging
- 📚 **Documentation**: OpenAPI/Swagger at `/docs`
- ✅ **Validation**: Zod schema validation
- 🧪 **Testing**: Comprehensive test coverage
- 🏭 **Route Factories**: Type-safe route creation

## Available Endpoints

```text
GET    /health              # Health check (public)
GET    /metrics             # Performance metrics (public)
GET    /docs                # API documentation (public)

# Accommodations
GET    /api/v1/accommodations
POST   /api/v1/accommodations
GET    /api/v1/accommodations/:id
PATCH  /api/v1/accommodations/:id
DELETE /api/v1/accommodations/:id

# Similar endpoints for: destinations, events, posts, users
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm test` | Run all tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm lint` | Lint code with Biome |
| `pnpm format` | Format code with Biome |

## Configuration

Copy `.env.example` to `.env` and configure:

```env
# Server
API_PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://...

# Better Auth
HOSPEDA_BETTER_AUTH_SECRET=<min-32-char-secret>
HOSPEDA_BETTER_AUTH_URL=http://localhost:3001

# CORS (comma-separated origins)
CORS_ORIGIN=http://localhost:4321,http://localhost:3000
```

## Documentation

📚 **Complete documentation available in [apps/api/docs/](./docs/README.md)**

Topics covered in detailed docs:

- **[Overview](./docs/README.md)**: Architecture, features, and getting started
- **[Setup Guide](./docs/setup.md)**: Environment configuration and installation
- **[Route Architecture](./docs/route-architecture.md)**: Three-tier endpoint structure (public, protected, admin)
- **[Route Factories](./docs/development/route-factories.md)**: Creating type-safe routes
- **[Authentication](./docs/usage/authentication.md)**: Actor system and permissions
- **[Testing](./docs/TESTING_GUIDE.md)**: Testing strategies and patterns
- **[Deployment](../../docs/deployment/apps/api.md)**: Production setup and monitoring

For cross-app documentation:

- **[Getting Started](../../docs/getting-started/README.md)**: Project setup and onboarding
- **[Architecture](../../docs/architecture/README.md)**: System design and patterns
- **[Deployment](../../docs/deployment/README.md)**: Deployment guides

For package-level documentation:

- **[Service Layer](../../packages/service-core/docs/README.md)**: Business logic services
- **[Database](../../packages/db/docs/README.md)**: Models and database operations
- **[Schemas](../../packages/schemas/docs/README.md)**: Validation schemas

## Project Structure

```text
src/
├── index.ts           # Server entry point
├── app.ts             # App initialization
├── middlewares/       # Auth, CORS, metrics, rate limiting
├── routes/            # Endpoint handlers by entity
├── utils/             # Route factories, response helpers
└── schemas/           # API-specific schemas
```

---

## Related Documentation

- [Creating Endpoints Guide](./docs/development/creating-endpoints.md)
- [Authentication Guide](../../docs/security/authentication.md)

---

**Need help?** Check the [complete documentation](./docs/README.md) or contact the development team.
