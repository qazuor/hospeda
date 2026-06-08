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
| [ADR-013](ADR-013-deferred-limit-enforcement.md) | Deferred Limit Enforcement | Accepted |
| [ADR-014](ADR-014-manual-dispute-handling-v1.md) | Manual Dispute Handling for v1 | Accepted |
| [ADR-015](ADR-015-redis-rate-limiting.md) | Redis Rate Limiting | Accepted |
| [ADR-016](ADR-016-billing-fail-open.md) | Billing Fail-Open Policy | Accepted |
| [ADR-017](ADR-017-postgres-specific-features.md) | PostgreSQL-Specific Features via Manual Migrations | Accepted |
| [ADR-018](ADR-018-transaction-propagation-pattern.md) | Transaction Propagation Pattern | Accepted |
| [ADR-019](ADR-019-billing-transaction-isolation.md) | Billing Transaction Isolation | Accepted |
| [ADR-020](ADR-020-billing-plans-source-of-truth.md) | Billing Plans Source of Truth | Superseded by SPEC-168 |
| [ADR-021](ADR-021-type-cast-policy.md) | `as unknown as X` Double-Cast Policy | Accepted |
| [ADR-022](ADR-022-service-return-type-safety-with-relations.md) | Service Return Type Safety with Relations | Accepted |
| [ADR-023](ADR-023-soft-deleted-related-entities.md) | Soft-Deleted Related Entities Behavior Policy | Accepted |
| [ADR-024](ADR-024-env-schema-ssot.md) | Env-Var Schema as Single Source of Truth | Accepted |
| [ADR-025](ADR-025-factory-level-strict-response-strip.md) | Factory-Level Strict Response Strip | Accepted |
| [ADR-026](ADR-026-collections-limit-strategy.md) | Collections Limit Strategy | Accepted |
| [ADR-027](ADR-027-newsletter-dispatch-architecture.md) | Newsletter Dispatch Architecture | Accepted |
| [ADR-028](ADR-028-role-permission-own-scoping.md) | Role Permission Audit + Owner-Scoped Data Access | Accepted |
| [ADR-029](ADR-029-versioned-migration-strategy.md) | Versioned Migration Strategy (generate + migrate + two carriles) | Accepted |
| [ADR-030](ADR-030-billing-catalog-vs-structural-definitions.md) | Billing Catalog vs. Structural Definitions | Accepted |
| [ADR-031](ADR-031-ai-core-foundation-architecture.md) | AI Foundation Architecture (`@repo/ai-core`) | Accepted |
| [ADR-032](ADR-032-markdown-canonical-rich-text.md) | Markdown as Canonical Storage Format for Entity Rich Text | Accepted |

## Format

Each ADR follows a consistent structure:

- **Status** .. Current state of the decision (Proposed, Accepted, Deprecated, Superseded)
- **Context** .. The problem or need that motivated the decision
- **Decision** .. What was decided and why
- **Consequences** .. Positive, negative, and neutral outcomes
- **Alternatives Considered** .. Other options evaluated and reasons for rejection
