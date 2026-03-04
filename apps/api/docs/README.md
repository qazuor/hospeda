# API Documentation

Hono Backend API for Hospeda

Production-ready REST API providing comprehensive endpoints for accommodations, destinations, events, posts, and user management.

---

## 🚀 Quick Start

```bash
# Start API locally
cd apps/api && pnpm dev

# Or from project root
pnpm dev --filter=api
```

**Access:**

- API: <http://localhost:3001>
- OpenAPI Docs: <http://localhost:3001/docs>
- API Reference: <http://localhost:3001/reference>
- Swagger UI: <http://localhost:3001/ui>

---

## 📖 Documentation Structure

### For API Consumers

**Using the API from external applications:**

- [Authentication](usage/authentication.md) - How to authenticate with Better Auth
- [Endpoints Reference](usage/endpoints-reference.md) - All available endpoints
- [Request/Response Format](usage/request-response.md) - Standard formats and pagination
- [Error Handling](usage/errors.md) - Error codes and handling
- [Rate Limiting](usage/rate-limiting.md) - Rate limit policies
- [OpenAPI Documentation](usage/openapi.md) - Interactive API documentation

### For API Developers

**Building and extending the API:**

#### Getting Started

- [Setup Guide](setup.md) - Local development setup
- [Architecture](architecture.md) - Internal architecture & patterns
- [Environment Variables](development/environment.md) - Configuration

#### Development Guides

- [Creating Endpoints](development/creating-endpoints.md) - Step-by-step guide
- [Route Factories](development/route-factories.md) - Using factory patterns
- [Middleware System](development/middleware.md) - Middleware stack
- [Validation](development/validation.md) - Request validation with Zod
- [Service Integration](development/service-integration.md) - Using service layer
- [Testing](development/testing.md) - Testing strategies
- [Debugging](development/debugging.md) - Troubleshooting guide

#### Advanced Topics

- [Authentication & Authorization](development/auth-authorization.md) - Actor system, permissions
- [Response Standardization](development/responses.md) - Response factories
- [OpenAPI Documentation](development/openapi.md) - Documenting endpoints
- [Performance](development/performance.md) - Optimization techniques
- [Deployment](development/deployment.md) - Deploy to Vercel

#### Examples

- [Basic CRUD Endpoint](examples/crud-endpoint.md)
- [Protected Route](examples/protected-route.md)
- [Paginated List](examples/paginated-list.md)
- [File Upload](examples/file-upload.md)

---

## 💡 Popular Topics

Quick answers to common questions:

- [How to create a CRUD endpoint?](development/creating-endpoints.md#crud-endpoint)
- [How to add authentication to an endpoint?](development/middleware.md#authentication)
- [How to handle validation errors?](development/validation.md#error-handling)
- [How to test endpoints?](development/testing.md#testing-endpoints)
- [How to add rate limiting to a specific route?](development/middleware.md#rate-limiting)

---

## 🏗️ API Architecture

```text
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│   Middleware Stack          │
│  • Security Headers         │
│  • CORS                     │
│  • Rate Limiting            │
│  • Authentication (Better Auth)   │
│  • Actor Resolution         │
│  • Validation               │
└──────────┬──────────────────┘
           │
           ▼
    ┌──────────────┐
    │    Routes    │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │   Services   │ (@repo/service-core)
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │    Models    │ (@repo/db)
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │  PostgreSQL  │
    └──────────────┘
```

**Key Principles:**

- **Factory Pattern** - Consistent route creation
- **Type Safety** - Full TypeScript with Zod validation
- **Separation of Concerns** - Thin routes, business logic in services
- **RO-RO Pattern** - Receive Object, Return Object
- **OpenAPI First** - Auto-generated documentation

See [Architecture Documentation](architecture.md) for detailed explanation.

---

## 🔗 Related Documentation

### Core Packages

- [Service Core Package](../../../packages/service-core/docs/README.md) - Business logic layer
- [DB Package](../../../packages/db/docs/README.md) - Database models & ORM
- [Schemas Package](../../../packages/schemas/docs/README.md) - Validation schemas

### Other Apps

- [Web App Documentation](../../web/docs/README.md) - Public-facing website
- [Admin App Documentation](../../admin/docs/README.md) - Admin dashboard

### Shared Resources

- [CLAUDE.md](../CLAUDE.md) - Quick reference for Claude Code
- [Main Documentation](../../../docs/index.md) - Project documentation portal

---

## 🧪 Testing

The API maintains **>90% test coverage** with comprehensive test suites:

- **Unit Tests** - Individual function testing
- **Integration Tests** - Route + service + database testing
- **Security Tests** - Authentication & authorization testing

```bash
# Run all tests
cd apps/api && pnpm test

# Watch mode
cd apps/api && pnpm test:watch

# Coverage report
cd apps/api && pnpm test:coverage
```

See [Testing Guide](development/testing.md) for detailed testing strategies.

---

## 🚀 Deployment

The API is deployed to **Vercel** (serverless functions) with:

- **Atomic deployments** (immutable, instant cutover)
- **Health check monitoring** (via external uptime monitor at `GET /health`)
- **Instant rollbacks** via Vercel dashboard or CLI
- **Metrics collection** via `/metrics` endpoint

See [Deployment Guide](development/deployment.md) for deployment procedures.

---

## 📦 Tech Stack

- **Framework**: [Hono](https://hono.dev) - Fast, lightweight, edge-ready
- **Database**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team)
- **Authentication**: [Better Auth](https://better-auth.com)
- **Validation**: [Zod](https://zod.dev)
- **Testing**: [Vitest](https://vitest.dev)
- **Documentation**: OpenAPI 3.1 with Scalar & Swagger UI

---

## 📞 Need Help?

- 💬 [Usage Guide](usage/README.md) - API consumer documentation
- 🐛 [Report a Bug](https://github.com/hospeda/issues)
- 📖 [Troubleshooting Guide](development/debugging.md)

---

⬅️ Back to [Main Documentation](../../../docs/index.md)
