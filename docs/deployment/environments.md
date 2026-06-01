# Deployment Environments

Thin orientation document for Hospeda's deployment environments (development, staging, production). This file is intentionally short and points at the canonical sources of truth instead of duplicating them.

**Last Updated**: 2026-04-30

---

## Canonical Sources

Do not duplicate env var definitions in this file. The authoritative sources are:

| Source | Purpose |
|--------|---------|
| [`./secrets.md`](./secrets.md) | Per-secret reference: GitHub Actions, Vercel (API/Web/Admin), `.env.local`, Docker. Includes generation steps and troubleshooting. |
| `packages/config/src/env-registry.hospeda.ts` | Server-side `HOSPEDA_*` registry (type, required, secret, apps that consume it). |
| `packages/config/src/env-registry.api-config.ts` | API middleware `API_*` registry (CORS, rate limiting, security, cache, etc.). |
| `packages/config/src/env-registry.client.ts` | Client-side `PUBLIC_*` (web) and `VITE_*` (admin) registries. |
| `packages/config/src/env-registry.docker-system.ts` | Docker Compose `POSTGRES_*` / `REDIS_*` registry. |
| `apps/{api,web,admin}/.env.example` | Per-app templates. |
| [`docs/guides/environment-variables.md`](../guides/environment-variables.md) | User-facing developer guide for adding and managing env vars. |

If you need to know the exact name, type, or required status of a variable, read the registry. If you need to set it on Vercel or in GitHub, read [`secrets.md`](./secrets.md).

---

## Environments at a Glance

Three deployment tiers, all deployed to Vercel via GitHub Actions.

| Tier | Branch | Deployment | API URL | Web URL | Admin URL |
|------|--------|------------|---------|---------|-----------|
| **Development** | local | `pnpm dev` | `http://localhost:3001` | `http://localhost:4321` | `http://localhost:3000` |
| **Staging** | `staging` | `cd-staging.yml` (preview deploy with alias) | `https://api.staging.hospeda.com.ar` | `https://staging.hospeda.com.ar` | `https://admin.staging.hospeda.com.ar` |
| **Production** | `main` | `cd-production.yml` (`--prod`) | `https://api.hospeda.com.ar` | `https://hospeda.com.ar` | `https://admin.hospeda.com.ar` |

Domain is `.ar` (Argentina market). Staging uses the **nested subdomain pattern** under `staging.hospeda.com.ar` so a single wildcard certificate (`*.staging.hospeda.com.ar`) covers all three apps. The exact hostnames live in the `staging` GitHub Environment as `HOSPEDA_API_URL` and `HOSPEDA_SITE_URL` variables and the production ones live in the `production` GitHub Environment.

### What changes between environments

Conceptual differences only — exact values come from the registry plus per-environment GitHub Secrets/Vercel env vars.

| Concern | Development | Staging | Production |
|---------|-------------|---------|------------|
| `NODE_ENV` | `development` | `production` | `production` |
| Database | Local Docker Postgres (`hospeda` DB) | Staging Postgres (separate DB) | Production Postgres (separate DB) |
| Redis | Optional (in-memory fallback) | Required | **Required** — API refuses to start without it |
| `HOSPEDA_CRON_SECRET` | Optional | Optional | **Required** — without it all 6 cron jobs silently fail |
| MercadoPago tokens | `TEST-*` sandbox | `TEST-*` sandbox | `APP_USR-*` live |
| OAuth redirect URIs | localhost | `*.staging.hospeda.com.ar` | `hospeda.com.ar` |
| `API_LOG_LEVEL` | `debug` | `info` | `warn` |
| `API_LOG_USE_COLORS` | `true` | `false` | `false` |
| `API_SECURITY_CSRF_ENABLED` | `false` | `true` | `true` |
| `API_RATE_LIMIT_TRUST_PROXY` | `false` | `true` | `true` (required on Vercel) |
| `HOSPEDA_CRON_ADAPTER` | `manual` | `vercel` | `vercel` |
| Sentry DSNs | Unset | Set | Set |
| Source maps upload | No | Optional | **Required** for readable stack traces |

The full per-environment differences table lives in [`docs/guides/environment-variables.md`](../guides/environment-variables.md#environment-differences).

---

## Domain Pattern

Production and staging follow a parallel naming pattern so that DNS records, OAuth clients, and CORS configuration mirror each other 1:1.

| Tier | Web (apex) | API | Admin |
|------|------------|-----|-------|
| **Production** | `hospeda.com.ar` | `api.hospeda.com.ar` | `admin.hospeda.com.ar` |
| **Staging** | `staging.hospeda.com.ar` | `api.staging.hospeda.com.ar` | `admin.staging.hospeda.com.ar` |

### Why nested subdomains for staging

- A single wildcard certificate `*.staging.hospeda.com.ar` covers all three staging hosts. Vercel's automatic Let's Encrypt provisioning handles renewal.
- The pattern mirrors production exactly (`api.<root>`, `admin.<root>`), so OAuth callback URLs, CORS allowlists, and Better Auth `trustedOrigins` only differ by the inserted `staging.` segment.
- DNS-clean: a single `staging` zone holds three records instead of three sibling subdomains under the apex.

### DNS records required

All records point at Vercel. Use one of:

- **Vercel-managed nameservers** (recommended for the apex): set the registrar's nameservers to the four addresses Vercel provides under Project → Settings → Domains. Vercel then resolves all subdomains automatically once each domain is added to its corresponding project.
- **Registrar-managed records**: add the following at the registrar:

    | Record | Type | Value |
    |--------|------|-------|
    | `hospeda.com.ar` (apex) | `A` | `76.76.21.21` (Vercel) |
    | `www.hospeda.com.ar` | `CNAME` | `cname.vercel-dns.com` |
    | `api.hospeda.com.ar` | `CNAME` | `cname.vercel-dns.com` |
    | `admin.hospeda.com.ar` | `CNAME` | `cname.vercel-dns.com` |
    | `staging.hospeda.com.ar` | `CNAME` | `cname.vercel-dns.com` |
    | `api.staging.hospeda.com.ar` | `CNAME` | `cname.vercel-dns.com` |
    | `admin.staging.hospeda.com.ar` | `CNAME` | `cname.vercel-dns.com` |

After adding each domain to its Vercel project, Vercel auto-provisions the SSL certificate (apex + wildcards) within ~5 minutes.

---

## Prefix Conventions

Every environment variable in the monorepo uses one of these prefixes. The prefix dictates **where** the value can be read.

| Prefix | Visibility | Consumed by | Notes |
|--------|------------|-------------|-------|
| `HOSPEDA_*` | Server-side only | `apps/api`, `packages/seed`, `packages/db` (via dotenv) | Default prefix for every project-owned variable. |
| `API_*` | Server-side only | `apps/api` middleware config | Reserved for HTTP/middleware concerns (CORS, cache, rate limit, security, validation, metrics). |
| `PUBLIC_*` | **Client-side** (Astro SSR + browser) | `apps/web` | Bundled into client JS. **Never** put secrets here. |
| `VITE_*` | **Client-side** (bundled by Vite) | `apps/admin` | Bundled into client JS. **Never** put secrets here. |
| `POSTGRES_*` | Docker Compose only | `docker/.env` | Local PostgreSQL container config. |
| `REDIS_*` | Docker Compose only | `docker/.env` | Local Redis container config. |

### Platform exceptions

`NODE_ENV`, `CI`, `VERCEL`, `VERCEL_GIT_COMMIT_SHA`, `TEST_DB_URL`, and `TEST_DB_NAME` are platform/system variables and do not follow the project's prefix rules. They are set by Node, the CI runner, or Vercel and are documented in the registry under their literal names. See [`environment-variables.md`](../guides/environment-variables.md#platform-naming-exceptions) for rationale.

### Server vs. client mapping

The CD pipeline (and Vercel project settings) map a single `HOSPEDA_*` value to its client-side equivalents at deploy time:

- `HOSPEDA_API_URL` → `PUBLIC_API_URL` (web), `VITE_API_URL` (admin)
- `HOSPEDA_SITE_URL` → `PUBLIC_SITE_URL` (web)
- `HOSPEDA_BETTER_AUTH_URL` → `VITE_BETTER_AUTH_URL` (admin), used directly by web for SSR auth

Set the `HOSPEDA_*` form in GitHub/Vercel; the client-side mirror is configured per-app on Vercel.

---

## Workflow: env:check, env:pull, env:push

Three pnpm scripts manage synchronisation between local `.env.local` files and Vercel project settings. All require a valid Vercel token (`vercel login`) and each app must be linked via `vercel link`.

### `pnpm env:check`

Audits all three apps against Vercel for every environment target (`development`, `preview`, `production`) and reports:

- Variables in `.env.example` but missing from Vercel (gaps)
- Variables in Vercel but undocumented in `.env.example`

The script needs a `VERCEL_TOKEN` in the environment. To run it locally:

```fish
# fish — persistent across sessions, stored in fish universal vars (not git):
set -Ux VERCEL_TOKEN <token-from-vercel.com/account/tokens>

# bash/zsh — current shell only:
export VERCEL_TOKEN=<token-from-vercel.com/account/tokens>
```

Then:

```bash
pnpm env:check            # Interactive
pnpm env:check --ci       # Non-interactive, exits 1 on missing required vars
pnpm env:check --verbose  # Show all variables, including OK ones
```

This script runs in `cd-staging.yml` and `cd-production.yml` **before every deploy** (see GAP-078-230). Both workflows treat the check as a **hard gate** — a missing or misnamed variable fails the build before it reaches preview/production traffic. There is no `|| true` fallback in production: if `VERCEL_TOKEN` is unset on the runner, the workflow stops on purpose so the secret can be repaired before deploying.

### `pnpm env:pull`

Fetches variables from a Vercel project and writes them into the local `.env.local`. Shows a per-variable diff and asks for confirmation. Use this after teammates push new vars to Vercel.

> **Gotcha — `vercel env pull` overwrites the entire file.** The underlying Vercel CLI does not merge: it replaces `.env.local` with whatever the linked Vercel project has for the chosen environment. If you have local-only variables that are not set in Vercel, **they are lost** on the next pull. Two implications:
>
> 1. Anything required by the app's Zod schema (`apps/{app}/src/utils/env.ts`) **must** also live in Vercel for that environment, otherwise `pnpm dev` will start failing after a pull. The hard gate in `cd-production.yml` catches this for prod, but a developer running `pnpm env:pull` locally has no such gate — keep `.env.example` and Vercel in sync.
> 2. Never store one-off local-only values in `.env.local` and expect them to survive a pull. Either add them to Vercel as well, or keep them outside the file (a separate `.env.local.dev-only` sourced by hand, for example).

### `pnpm env:push`

Reads the local `.env.local` and pushes new or changed variables to the linked Vercel project. Shows a per-variable diff and asks for confirmation. Use this after adding a new var locally.

Source code: `scripts/env/{check,pull,push}.ts`. Full reference: [`environment-variables.md`](../guides/environment-variables.md#vercel-sync-tools).

---

## Adding a New Environment Variable

The full checklist is in [`docs/guides/environment-variables.md`](../guides/environment-variables.md#adding-a-new-environment-variable). Summary:

1. Add to the appropriate registry file in `packages/config/src/env-registry.*.ts`.
2. Add to the consuming app's Zod schema (`apps/{app}/src/utils/env.ts`).
3. Add to `apps/{app}/.env.example` with a comment.
4. Add a safe value to `apps/{app}/.env.test` if relevant for tests.
5. If it must invalidate the Turbo cache, add it to `globalEnv` in `turbo.json`.
6. Set the value in Vercel for each environment target (or run `pnpm env:push`).
7. Run `pnpm env:check` to confirm sync.

---

## Legacy Env Var Mappings

Older code referenced unprefixed variable names (e.g. `CRON_SECRET`, `DATABASE_URL`). The current policy:

- **All new code must use `HOSPEDA_*` names exclusively.** No exceptions for env reads in source.
- **No runtime aliasing.** The repo does not maintain a code-level fallback table that maps old names to new ones at runtime. If you find legacy references, treat them as bugs and migrate them.
- **SPEC-035 cleanup.** The renaming was driven by the SPEC-035 effort. If you encounter a variable name not present in any registry, consult `.qtm/specs/SPEC-035-env-vars-cleanup/spec.md` for the historical mapping from old names to new ones.
- **Platform exceptions only.** `NODE_ENV`, `CI`, `VERCEL`, `VERCEL_GIT_COMMIT_SHA` keep their platform-defined names — the project does not control them. Document the reason at any call site that reads them.

If you migrate an old call site, update the registry and the relevant app's `.env.example` and `.env.test` in the same change.

---

## Per-App Deployment Guides

Each app owns its detailed deployment runbook:

- **API** — [`./apps/api.md`](./apps/api.md). Vercel serverless config, cold start considerations, cron setup, Redis requirement, Sentry source maps for the API.
- **Admin** — [`./apps/admin.md`](./apps/admin.md). TanStack Start build, Vite client bundle, `VITE_*` mirror of `HOSPEDA_*` vars, Sentry source maps for the admin SPA.
- **Web** — [`./apps/web.md`](./apps/web.md). Astro build, ISR/SSR routing, `PUBLIC_*` mirror of `HOSPEDA_*` vars, image optimization, Sentry source maps for the web app.

For the secret reference itself (every variable, where to set it, how to obtain credentials), use [`./secrets.md`](./secrets.md).

---

## Security Notes

The full security policy is in [`environment-variables.md`](../guides/environment-variables.md#security) and [`secrets.md`](./secrets.md#9-security-notes). Critical points:

- `.env`, `.env.local`, `.env.*.local` are gitignored. Only `.env.example` and `.env.test` are committed.
- Anything with `PUBLIC_*` or `VITE_*` is bundled into the client and visible to every browser. **Never put secrets there.**
- Production secrets live exclusively in Vercel project settings and the `production` GitHub Environment. They are never stored in the repository.
- `HOSPEDA_BETTER_AUTH_SECRET` and `HOSPEDA_CRON_SECRET` require at least 32 characters. Generate with `openssl rand -base64 32`.
- MercadoPago: production tokens start with `APP_USR-`, sandbox with `TEST-`. Never use a production token in staging.
- Rotate secrets immediately if compromised: change at the source, update Vercel, run `pnpm env:pull`, and purge from git history.

---

## Related Documentation

- [`environment-variables.md`](../guides/environment-variables.md) — Developer guide for managing env vars (per-app strategy, test env files, troubleshooting).
- [`./secrets.md`](./secrets.md) — Authoritative per-secret reference and how-to-obtain instructions.
- [`docs/decisions/`](../decisions/README.md) — Architecture decision records, including any deployment-related ADRs.
- [Hospeda root CLAUDE.md](../../CLAUDE.md) — Project-wide guidelines, including the env prefix policy.
