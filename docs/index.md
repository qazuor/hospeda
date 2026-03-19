# Hospeda Documentation

Documentation hub for the Hospeda tourism accommodation platform.

The documentation is organized into project-wide docs (this directory), app-local docs (`apps/*/docs/`), and package-local docs (`packages/*/docs/`). Cross-cutting concerns live here; app-specific and package-specific guides live alongside the code they document.

---

## Getting Started

- [Prerequisites](getting-started/prerequisites.md)
- [Installation](getting-started/installation.md)
- [Development Environment](getting-started/development-environment.md)
- [Common Tasks](getting-started/common-tasks.md)
- [First Contribution](getting-started/first-contribution.md)

## Architecture

- [Overview](architecture/overview.md)
- [Monorepo Structure](architecture/monorepo-structure.md)
- [Data Flow](architecture/data-flow.md)
- [Patterns](architecture/patterns.md)
- [Tech Stack](architecture/tech-stack.md)

## Guides

Cross-cutting development guides. App-specific guides (adding pages, deployment, etc.) live in each app's `docs/` directory.

- [Guides Index](guides/README.md)
- [Adding New Entity](guides/adding-new-entity.md)
- [CLI Utilities](guides/cli-utilities.md)
- [Debugging](guides/debugging.md)
- [Dependency Policy](guides/dependency-policy.md)
- [Error Handling](guides/error-handling.md)
- [Local Development Setup](guides/local-development-setup.md)
- [Markdown Formatting](guides/markdown-formatting.md)

## Contributing

- [Contributing Index](contributing/README.md)
- [Code Standards](contributing/code-standards.md)
- [Code Review Guidelines](contributing/code-review-guidelines.md)
- [Git Workflow](contributing/git-workflow.md)
- [Pull Request Process](contributing/pull-request-process.md)

## Testing

- [Testing Index](testing/README.md)
- [Strategy](testing/strategy.md)
- [TDD Workflow](testing/tdd-workflow.md)
- [Unit Testing](testing/unit-testing.md)
- [Integration Testing](testing/integration-testing.md)
- [E2E Testing](testing/e2e-testing.md)
- [Mocking](testing/mocking.md)
- [Test Factories](testing/test-factories.md)
- [Coverage](testing/coverage.md)
- [Billing QA Checklist](testing/billing-qa-checklist.md)
- [Billing E2E Checklist](testing/billing-e2e-checklist.md)
- [Billing Manual Testing](testing/billing-manual-testing.md)

## Deployment

Per-app deployment guides live in each app's `docs/` directory (see [App Documentation](#app-documentation) below).

- [Deployment Index](deployment/README.md)
- [Environments](deployment/environments.md)
- [CI/CD](deployment/ci-cd.md)
- [Billing Checklist](deployment/billing-checklist.md)
- [Deployment Checklist](deployment-checklist.md)

## Security

- [Security Index](security/README.md)
- [OWASP Top 10](security/owasp-top-10.md)
- [API Protection](security/api-protection.md)
- [Authentication](security/authentication.md)
- [Input Sanitization](security/input-sanitization.md)
- [Billing Audit 2026-02](security/billing-audit-2026-02.md)

## Performance

- [Performance Index](performance/README.md)
- [Caching](performance/caching.md)
- [Frontend Optimization](performance/frontend-optimization.md)
- [Monitoring](performance/monitoring.md)

## Billing

- [Billing Index](billing/README.md)
- [AFIP Research](billing/afip-research.md)
- [Dispute Handling v1](billing/dispute-handling-v1.md)
- [Grace Period Source of Truth](billing/grace-period-source-of-truth.md)

## Runbooks

- [Runbooks Index](runbooks/README.md)
- [Monitoring](runbooks/monitoring.md)
- [Production Bugs](runbooks/production-bugs.md)
- [Rollback](runbooks/rollback.md)
- [Scaling](runbooks/scaling.md)
- [Backup Recovery](runbooks/backup-recovery.md)
- [Billing Incidents](runbooks/billing-incidents.md)
- [Sentry Setup](runbooks/sentry-setup.md)

## Resources

- [Resources Index](resources/README.md)
- [Glossary](resources/glossary.md)
- [FAQ](resources/faq.md)
- [External Links](resources/external-links.md)
- [Troubleshooting](resources/troubleshooting.md)

## Architecture Decisions (ADRs)

- [ADR Index](decisions/README.md)
- [ADR-001: Astro over Next.js](decisions/ADR-001-astro-over-nextjs.md)
- [ADR-002: Better Auth over Clerk](decisions/ADR-002-better-auth-over-clerk.md)
- [ADR-003: Hono over Express](decisions/ADR-003-hono-over-express.md)
- [ADR-004: Drizzle over Prisma](decisions/ADR-004-drizzle-over-prisma.md)
- [ADR-005: MercadoPago Payments](decisions/ADR-005-mercadopago-payments.md)
- [ADR-006: Integer Monetary Values](decisions/ADR-006-integer-monetary-values.md)
- [ADR-007: Vercel Deployment](decisions/ADR-007-vercel-deployment.md)
- [ADR-008: AFIP Deferred to v2](decisions/ADR-008-afip-deferred-v2.md)
- [ADR-009: Trial Host-Only](decisions/ADR-009-trial-host-only.md)
- [ADR-010: Explicit CORS Origins](decisions/ADR-010-explicit-cors-origins.md)
- [ADR-011: Triple Font System](decisions/ADR-011-triple-font-system.md)
- [ADR-012: Warm/Cold Section Strategy](decisions/ADR-012-warm-cold-section-strategy.md)
- [ADR-013: Deferred Limit Enforcement](decisions/ADR-013-deferred-limit-enforcement.md)
- [ADR-014: Manual Dispute Handling v1](decisions/ADR-014-manual-dispute-handling-v1.md)
- [ADR-015: Redis Rate Limiting](decisions/ADR-015-redis-rate-limiting.md)

## Specs (Historical)

- [SPEC-012: Design Tokens Layout Hero](specs/SPEC-012-design-tokens-layout-hero.md)
- [SPEC-013: Cards Sections Redesign](specs/SPEC-013-cards-sections-redesign.md)
- [SPEC-014: Responsive Dark Polish](specs/SPEC-014-responsive-dark-polish.md)
- [SPEC-015: Admin Polish Fixes](specs/SPEC-015-admin-polish-fixes.md)
- [SPEC-016: Admin API Route Separation](specs/SPEC-016-admin-api-route-separation.md)

## Diagrams

Mermaid diagrams for architecture and flow visualization.

- [Authentication Flow](diagrams/authentication-flow.mmd)
- [Booking Flow](diagrams/booking-flow.mmd)
- [CI/CD Pipeline](diagrams/ci-cd-pipeline.mmd)
- [Database Migration Flow](diagrams/database-migration-flow.mmd)
- [Deployment Architecture](diagrams/deployment-architecture.mmd)
- [Documentation Map](diagrams/documentation-map.mmd)
- [Entity Relationships](diagrams/entity-relationships.mmd)
- [Error Handling Flow](diagrams/error-handling-flow.mmd)
- [Frontend Hierarchy](diagrams/frontend-hierarchy.mmd)
- [Monorepo Structure](diagrams/monorepo-structure.mmd)
- [Navigation Flow](diagrams/navigation-flow.mmd)
- [Package Dependencies](diagrams/package-dependencies.mmd)
- [Request Flow](diagrams/request-flow.mmd)
- [Service Layer](diagrams/service-layer.mmd)
- [TDD Workflow](diagrams/tdd-workflow.mmd)

## Examples

Code examples for common patterns. See also `api-examples/` for API route samples.

- [Examples Index](examples/README.md)
- [Advanced Service](examples/advanced-service/) -- service implementation with tests
- [Custom Validation](examples/custom-validation/) -- Zod schema and validator patterns
- [Testing Patterns](examples/testing-patterns/) -- unit, integration, and mocking examples
- [Simple Route Example](api-examples/simple-route-example.ts)
- [Improved CRUD Example](api-examples/improved-crud-example.ts)

## Other

- [Environment Variables](guides/environment-variables.md)
- [Claude Code Configuration](claude-code.md)

---

## App Documentation

Each app has its own `CLAUDE.md` with development instructions and a `docs/` directory with detailed guides.

| App | CLAUDE.md | Docs |
|-----|-----------|------|
| Admin (TanStack Start dashboard) | [apps/admin/CLAUDE.md](../apps/admin/CLAUDE.md) | [apps/admin/docs/](../apps/admin/docs/README.md) |
| API (Hono REST server) | [apps/api/CLAUDE.md](../apps/api/CLAUDE.md) | [apps/api/docs/](../apps/api/docs/README.md) |
| Web (Astro frontend) | [apps/web/CLAUDE.md](../apps/web/CLAUDE.md) | [apps/web/docs/](../apps/web/docs/README.md) |

## Package Documentation

Each package has a `CLAUDE.md` with development instructions. Packages with a `docs/` directory are noted below.

| Package | CLAUDE.md | Docs |
|---------|-----------|------|
| auth-ui | [packages/auth-ui/CLAUDE.md](../packages/auth-ui/CLAUDE.md) | [docs/](../packages/auth-ui/docs/README.md) |
| billing | [packages/billing/CLAUDE.md](../packages/billing/CLAUDE.md) | [docs/](../packages/billing/docs/README.md) |
| biome-config | [packages/biome-config/CLAUDE.md](../packages/biome-config/CLAUDE.md) | -- |
| config | [packages/config/CLAUDE.md](../packages/config/CLAUDE.md) | [docs/](../packages/config/docs/README.md) |
| db | [packages/db/CLAUDE.md](../packages/db/CLAUDE.md) | [docs/](../packages/db/docs/README.md) |
| i18n | [packages/i18n/CLAUDE.md](../packages/i18n/CLAUDE.md) | [docs/](../packages/i18n/docs/README.md) |
| icons | [packages/icons/CLAUDE.md](../packages/icons/CLAUDE.md) | [docs/](../packages/icons/docs/README.md) |
| logger | [packages/logger/CLAUDE.md](../packages/logger/CLAUDE.md) | [docs/](../packages/logger/docs/README.md) |
| notifications | [packages/notifications/CLAUDE.md](../packages/notifications/CLAUDE.md) | [docs/](../packages/notifications/docs/README.md) |
| schemas | [packages/schemas/CLAUDE.md](../packages/schemas/CLAUDE.md) | [docs/](../packages/schemas/docs/README.md) |
| seed | [packages/seed/CLAUDE.md](../packages/seed/CLAUDE.md) | [docs/](../packages/seed/docs/README.md) |
| service-core | [packages/service-core/CLAUDE.md](../packages/service-core/CLAUDE.md) | [docs/](../packages/service-core/docs/README.md) |
| tailwind-config | [packages/tailwind-config/CLAUDE.md](../packages/tailwind-config/CLAUDE.md) | -- |
| typescript-config | [packages/typescript-config/CLAUDE.md](../packages/typescript-config/CLAUDE.md) | -- |
| utils | [packages/utils/CLAUDE.md](../packages/utils/CLAUDE.md) | -- |
