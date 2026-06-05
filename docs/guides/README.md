# Guides

> Step-by-step guides for common development tasks in the Hospeda platform.

## Development Guides

| Guide | Description |
|-------|-------------|
| [Adding a New Entity](adding-new-entity.md) | End-to-end tutorial: Schema, Model, Service, API, Frontend |
| [Local Development Setup](local-development-setup.md) | PostgreSQL, Redis, Docker, environment configuration |
| [Error Handling](error-handling.md) | Error patterns and Result type |
| [Debugging](debugging.md) | Debugging techniques and tools |
| [CLI Utilities](cli-utilities.md) | Available CLI scripts and commands |
| [Managing Billing Plans](managing-billing-plans.md) | Operator guide: create, edit, deactivate, and delete plans from the admin |
| [PostHog Reverse Proxy](posthog-proxy.md) | First-party analytics ingestion via Cloudflare Worker to defeat ad-blockers (SPEC-181); deploy order + CSP coupling |
| [Self-Hosted Runner](self-hosted-runner.md) | Register and operate the PR CI runner on the owner's laptop (SPEC-179) |
| [Log Management](log-management.md) | API log output (pretty/NDJSON), Coolify stdout retention, WARN/ERROR DB sink + admin viewer, purge policy (SPEC-184) |
| [Markdown Formatting](markdown-formatting.md) | Documentation formatting standards |
| [Review Moderation](review-moderation.md) | Review moderation model (PENDING/APPROVED/REJECTED), hybrid default policy, content-moderation gate, admin API surface (SPEC-166) |

## Policy Documents

| Document | Description |
|----------|-------------|
| [Dependency Policy](dependency-policy.md) | Which libraries to use (and never use) for each concern |

## App-Specific Guides

Guides that are specific to a single app have been moved to each app's own docs:

- **Web**: [Web App Guidelines](../../apps/web/CLAUDE.md), [Style Guide](../../apps/web/STYLE_GUIDE.md)
- **Admin**: [Adding Admin Pages](../../apps/admin/docs/development/README.md)
- **API**: [Adding API Routes](../../apps/api/docs/development/README.md)

## Related

- [Architecture](../architecture/README.md)
- [Getting Started](../getting-started/README.md)
- [Testing](../testing/README.md)
- [Contributing](../contributing/README.md)
