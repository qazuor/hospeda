# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the Hospeda platform. ADRs document significant architectural and technical decisions, their context, and their consequences.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](ADR-001-astro-over-nextjs.md) | Astro over Next.js for Public Web App | Accepted |
| [ADR-002](ADR-002-better-auth-over-clerk.md) | Better Auth over Clerk for Authentication | Accepted |
| [ADR-003](ADR-003-hono-over-express.md) | Hono over Express for REST API | Accepted |
| [ADR-004](ADR-004-drizzle-over-prisma.md) | Drizzle ORM over Prisma | Accepted |
| [ADR-005](ADR-005-mercadopago-payments.md) | MercadoPago as Payment Processor | Accepted |
| [ADR-006](ADR-006-integer-monetary-values.md) | Integer Storage for Monetary Values | Accepted |
| [ADR-007](ADR-007-vercel-deployment.md) | Vercel Deployment (migrated from Fly.io) | Accepted |
| [ADR-008](ADR-008-afip-deferred-v2.md) | Defer AFIP Integration to v2 | Accepted |
| [ADR-017](ADR-017-postgres-specific-features.md) | PostgreSQL-Specific Features via Manual Migrations | Accepted |

## Format

Each ADR follows a consistent structure:

- **Status** .. Current state of the decision (Proposed, Accepted, Deprecated, Superseded)
- **Context** .. The problem or need that motivated the decision
- **Decision** .. What was decided and why
- **Consequences** .. Positive, negative, and neutral outcomes
- **Alternatives Considered** .. Other options evaluated and reasons for rejection
