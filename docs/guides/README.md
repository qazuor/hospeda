# Guides

> Step-by-step guides for common development tasks in the Hospeda platform.

## Development Guides

| Guide | Description |
|-------|-------------|
| [Accommodation Gallery Architecture](accommodation-gallery-architecture.md) | Photo gallery subsystem: relational table, granular endpoints, permissions, plan cap, UI surfaces, migration carriles, and SPEC-280 compat debt |
| [Adding a New Entity](adding-new-entity.md) | End-to-end tutorial: Schema, Model, Service, API, Frontend |
| [Web Accessibility Manual Testing](web-accessibility-manual-testing.md) | Manual keyboard + screen-reader verification procedure for the public web after SPEC-270 |
| [Local Development Setup](local-development-setup.md) | PostgreSQL, Redis, Docker, environment configuration |
| [Worktree Dev Environments](worktree-dev-environments.md) | One-command up/down for parallel worktrees: isolated ports + DB, auto-heal, test users (`wt:up` / `wt:down`) |
| [Error Handling](error-handling.md) | Error patterns and Result type |
| [Debugging](debugging.md) | Debugging techniques and tools |
| [CLI Utilities](cli-utilities.md) | Available CLI scripts and commands |
| [Managing Billing Plans](managing-billing-plans.md) | Operator guide: create, edit, deactivate, and delete plans from the admin |
| [PostHog Reverse Proxy](posthog-proxy.md) | First-party analytics ingestion via Cloudflare Worker to defeat ad-blockers (SPEC-181); deploy order + CSP coupling |
| [Self-Hosted Runner](self-hosted-runner.md) | Register and operate the PR CI runner on the owner's laptop (SPEC-179) |
| [Log Management](log-management.md) | API log output (pretty/NDJSON), Coolify stdout retention, WARN/ERROR DB sink + admin viewer, purge policy (SPEC-184) |
| [Markdown Formatting](markdown-formatting.md) | Documentation formatting standards |
| [Review Moderation](review-moderation.md) | Review moderation model (PENDING/APPROVED/REJECTED), hybrid default policy, content-moderation gate, admin API surface (SPEC-166) |
| [Sentry Alerts](sentry-alerts.md) | Alert rule tracking: moderation degraded, error rate spikes, billing webhooks, cron failures, auth spikes, DB pool exhaustion |

## Policy Documents

| Document | Description |
|----------|-------------|
| [Dependency Policy](dependency-policy.md) | Which libraries to use (and never use) for each concern |
| [Dependabot Policy](dependabot-policy.md) | Triage & merge strategy for dependency-update PRs: the secrets/build caveat, the placeholder guard, and migration-gated packages (SPEC-219) |

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
