# 🏨 Hospeda API

Modern REST API built with Hono, TypeScript, and PostgreSQL for the Hospeda tourism platform.

## Overview

Production-ready backend service providing comprehensive endpoints for accommodations, destinations, events, posts, and user management. Features include Clerk authentication, rate limiting, metrics collection, OpenAPI documentation, and standardized error handling.

**Tech Stack:**

- **Framework**: Hono (fast, lightweight, edge-ready)
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Clerk
- **Validation**: Zod schemas
- **Testing**: Vitest (>90% coverage)
- **Deployment**: Fly.io

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

- 🔐 **Authentication**: Clerk-based JWT authentication
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

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# CORS (comma-separated origins)
CORS_ORIGIN=http://localhost:4321,http://localhost:3000
```

## Documentation

📚 **Complete documentation available in [apps/api/docs/README.md](./docs/README.md)** *(to be created in Phase 2)*

Topics covered in detailed docs:

- **Architecture**: Request flow, middleware stack, patterns
- **Development**: Creating endpoints, route factories, validation
- **Authentication**: Actor system, permissions, protected routes
- **Testing**: Unit tests, integration tests, security tests
- **Deployment**: Production setup, Docker, monitoring
- **API Reference**: All endpoints, request/response formats

For package-level documentation, see:

- **Service Layer**: [packages/service-core/docs/](../../packages/service-core/docs/)
- **Database**: [packages/db/docs/](../../packages/db/docs/)
- **Schemas**: [packages/schemas/docs/](../../packages/schemas/docs/)

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

**Need help?** Check the [complete documentation](./docs/README.md) or contact the development team.
