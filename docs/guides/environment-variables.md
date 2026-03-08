# Environment Variables

This guide covers every environment variable used across the Hospeda monorepo:
their purpose, which apps consume them, and how to manage them across environments.

## Overview

Environment variables in this monorepo follow three naming conventions based on
where the variable is consumed:

| Prefix | Scope | Consumer |
|--------|-------|----------|
| `HOSPEDA_` | Server-side only | `apps/api`, `packages/seed` |
| `API_` | Server-side only | `apps/api` middleware config |
| `PUBLIC_` | Browser-exposed | `apps/web` (Astro) |
| `VITE_` | Browser-exposed | `apps/admin` (TanStack/Vite) |
| `POSTGRES_` / `REDIS_` | Docker Compose only | Local database services |

The **env registry** at `packages/config/src/env-registry.ts` is the single
source of truth. It documents every variable with its type, required status,
secret flag, apps that consume it, and an example value. Tooling scripts
(`env:pull`, `env:push`, `env:check`) read from this registry.

Variables marked `secret: true` must never appear in logs or be committed to
version control. Use `.env.local` (gitignored) to store secrets locally.

## Quick Start

```bash
# 1. Copy the example file for each app you want to run
cp apps/api/.env.example    apps/api/.env.local
cp apps/web/.env.example    apps/web/.env.local
cp apps/admin/.env.example  apps/admin/.env.local
cp docker/.env.example      docker/.env

# 2. Start the database services
pnpm db:start

# 3. Fill in required values in each .env.local
#    At minimum: HOSPEDA_DATABASE_URL, HOSPEDA_BETTER_AUTH_SECRET,
#    HOSPEDA_API_URL, HOSPEDA_SITE_URL, HOSPEDA_BETTER_AUTH_URL

# 4. Validate (if apps are linked to Vercel)
pnpm env:check
```

## Variable Reference

### Core (HOSPEDA_)

| Variable | Type | Required | Secret | Default | Description |
|----------|------|----------|--------|---------|-------------|
| `HOSPEDA_API_URL` | url | yes | no | - | API base URL. Used by api, web, admin |
| `HOSPEDA_SITE_URL` | url | yes | no | - | Web app base URL. Used by api, web |
| `HOSPEDA_ADMIN_URL` | url | no | no | - | Admin app URL for CORS config |

### Database (HOSPEDA_)

| Variable | Type | Required | Secret | Default | Description |
|----------|------|----------|--------|---------|-------------|
| `HOSPEDA_DATABASE_URL` | url | yes | yes | - | PostgreSQL connection string |
| `HOSPEDA_DB_POOL_MAX_CONNECTIONS` | number | no | no | - | DB pool max connections |
| `HOSPEDA_DB_POOL_IDLE_TIMEOUT_MS` | number | no | no | - | DB pool idle timeout ms |
| `HOSPEDA_DB_POOL_CONNECTION_TIMEOUT_MS` | number | no | no | - | DB pool connection timeout ms |
| `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD` | string | no | yes | - | Super admin password for seeding |

### Auth (HOSPEDA_)

| Variable | Type | Required | Secret | Default | Description |
|----------|------|----------|--------|---------|-------------|
| `HOSPEDA_BETTER_AUTH_SECRET` | string | yes | yes | - | Session signing secret (min 32 chars) |
| `HOSPEDA_BETTER_AUTH_URL` | url | yes | no | - | Better Auth endpoint URL |
| `HOSPEDA_GOOGLE_CLIENT_ID` | string | no | yes | - | Google OAuth client ID |
| `HOSPEDA_GOOGLE_CLIENT_SECRET` | string | no | yes | - | Google OAuth secret |
| `HOSPEDA_FACEBOOK_CLIENT_ID` | string | no | yes | - | Facebook OAuth client ID |
| `HOSPEDA_FACEBOOK_CLIENT_SECRET` | string | no | yes | - | Facebook OAuth secret |

### Cache, Billing, Email (HOSPEDA_)

| Variable | Type | Required | Secret | Default | Description |
|----------|------|----------|--------|---------|-------------|
| `HOSPEDA_REDIS_URL` | url | no | yes | - | Redis URL for rate limiting |
| `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` | string | no | yes | - | MercadoPago API token |
| `HOSPEDA_RESEND_API_KEY` | string | no | yes | - | Resend email API key |
| `HOSPEDA_RESEND_FROM_EMAIL` | string | no | no | - | Sender email address |
| `HOSPEDA_RESEND_FROM_NAME` | string | no | no | - | Sender display name |
| `HOSPEDA_ADMIN_NOTIFICATION_EMAILS` | string | no | no | - | Comma-separated admin emails |

### Cron, Integrations, Monitoring (HOSPEDA_)

| Variable | Type | Required | Secret | Default | Description |
|----------|------|----------|--------|---------|-------------|
| `HOSPEDA_CRON_SECRET` | string | no | yes | - | Cron endpoint auth secret |
| `HOSPEDA_CRON_ADAPTER` | enum | no | no | `manual` | Scheduler type: `manual`, `vercel`, `node-cron` |
| `HOSPEDA_LINEAR_API_KEY` | string | no | yes | - | Linear bug report API key |
| `HOSPEDA_LINEAR_TEAM_ID` | string | no | no | - | Linear team ID |
| `HOSPEDA_EXCHANGE_RATE_API_KEY` | string | no | yes | - | ExchangeRate-API key |
| `HOSPEDA_DOLAR_API_BASE_URL` | url | no | no | - | DolarAPI base URL |
| `HOSPEDA_EXCHANGE_RATE_API_BASE_URL` | url | no | no | - | ExchangeRate-API base URL |
| `HOSPEDA_SENTRY_DSN` | url | no | yes | - | Sentry DSN for API error tracking |
| `HOSPEDA_SENTRY_RELEASE` | string | no | no | - | Sentry release identifier |
| `HOSPEDA_SENTRY_PROJECT` | string | no | no | - | Sentry project name |

### Testing / Debugging (HOSPEDA_)

| Variable | Type | Required | Secret | Default | Description |
|----------|------|----------|--------|---------|-------------|
| `HOSPEDA_DISABLE_AUTH` | boolean | no | no | `false` | Bypass auth in tests |
| `HOSPEDA_ALLOW_MOCK_ACTOR` | boolean | no | no | `false` | Allow mock actors in tests |
| `HOSPEDA_TESTING_RATE_LIMIT` | boolean | no | no | `false` | Enable rate limit in tests |
| `HOSPEDA_TESTING_ORIGIN_VERIFICATION` | boolean | no | no | `false` | Enable origin check in tests |
| `HOSPEDA_DEBUG_TESTS` | boolean | no | no | `false` | Verbose test logging |
| `HOSPEDA_API_DEBUG_ERRORS` | boolean | no | no | `false` | Show error details in responses |
| `HOSPEDA_COMMIT_SHA` | string | no | no | - | Build commit SHA |

### API Server Config (API_)

All `API_*` variables are optional with safe defaults. The full list is in
`packages/config/src/env-registry.api-config.ts`. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `3001` | API server port |
| `API_HOST` | `localhost` | API server bind address |
| `API_LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `API_CORS_ORIGINS` | `http://localhost:3000,http://localhost:4321` | Allowed CORS origins |
| `API_RATE_LIMIT_ENABLED` | `true` | Enable global rate limiting |
| `API_RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per 15-minute window |
| `API_SECURITY_ENABLED` | `true` | Enable security headers middleware |
| `API_SECURITY_CSRF_ENABLED` | `true` | Enable CSRF origin verification |
| `API_COMPRESSION_ENABLED` | `true` | Enable response compression |
| `API_CACHE_ENABLED` | `true` | Enable cache-control headers |
| `API_METRICS_ENABLED` | `true` | Enable metrics collection |

Rate limiter sub-groups: global, auth (`API_RATE_LIMIT_AUTH_*`), public
(`API_RATE_LIMIT_PUBLIC_*`), admin (`API_RATE_LIMIT_ADMIN_*`).

### Web App Client (PUBLIC_)

| Variable | Type | Required | Secret | Default | Description |
|----------|------|----------|--------|---------|-------------|
| `PUBLIC_API_URL` | url | yes | no | - | API base URL for browser requests |
| `PUBLIC_SITE_URL` | url | yes | no | - | Web app base URL for browser |
| `PUBLIC_SENTRY_DSN` | url | no | yes | - | Sentry DSN for client-side tracking |
| `PUBLIC_SENTRY_RELEASE` | string | no | no | - | Sentry release for web app |
| `PUBLIC_VERSION` | string | no | no | - | App version for feedback collection |

### Admin App Client (VITE_)

| Variable | Type | Required | Secret | Default | Description |
|----------|------|----------|--------|---------|-------------|
| `VITE_API_URL` | url | yes | no | - | API endpoint for admin dashboard |
| `VITE_BETTER_AUTH_URL` | url | yes | no | - | Better Auth URL for admin |
| `VITE_APP_NAME` | string | no | no | `Hospeda Admin` | Admin app display name |
| `VITE_APP_VERSION` | string | no | no | - | Version shown in admin UI |
| `VITE_DEFAULT_PAGE_SIZE` | number | no | no | `10` | Default rows per page in tables |
| `VITE_MAX_PAGE_SIZE` | number | no | no | `100` | Maximum rows per page |
| `VITE_ENABLE_DEVTOOLS` | boolean | no | no | `false` | Enable React DevTools |
| `VITE_ENABLE_QUERY_DEVTOOLS` | boolean | no | no | `false` | Enable TanStack Query DevTools |
| `VITE_ENABLE_ROUTER_DEVTOOLS` | boolean | no | no | `false` | Enable TanStack Router DevTools |
| `VITE_SENTRY_DSN` | url | no | yes | - | Sentry DSN for admin tracking |
| `VITE_SUPPORTED_LOCALES` | string | no | no | `es,en` | Comma-separated locale codes |
| `VITE_DEFAULT_LOCALE` | string | no | no | `es` | Default locale code |

### System Variables

Set automatically by Node.js, CI, or Vercel. Do not set these manually.

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Execution environment: `development`, `production`, `test` |
| `CI` | Set to `true` by most CI systems |
| `VERCEL` | Set to `1` on Vercel serverless infrastructure |
| `VERCEL_GIT_COMMIT_SHA` | Full Git commit SHA injected at Vercel build time |

### Platform Naming Exceptions

The variables `VERCEL_GIT_COMMIT_SHA`, `VERCEL`, and `CI` do not follow the
`HOSPEDA_*` naming convention. This is intentional: these variables are injected
by the deployment platform (Vercel) or CI system (GitHub Actions) and their names
are fixed by the platform. The project has no control over them.

> **Note**: `SENTRY_ENVIRONMENT` is not used. Sentry environment is derived from `NODE_ENV` at runtime.

These are accepted exceptions to the naming policy. Code that reads them (e.g.
`apps/api/src/utils/env.ts` reading `VERCEL_GIT_COMMIT_SHA` to populate
`HOSPEDA_SENTRY_RELEASE`) should document the reason at the call site. Do not
attempt to rename or alias them with `HOSPEDA_` prefixes in deployment config,
as that would add a redundant mapping with no benefit.

### Test Database (System)

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_DB_URL` | - | PostgreSQL connection string for E2E test setup |
| `TEST_DB_NAME` | `hospeda_test` | Database name for E2E test setup scripts |

## Per-App Configuration

Each app has its own `.env.example` with only the variables it needs.

### apps/api

The API is the most variable-heavy app. It reads all `HOSPEDA_*` server-side
variables plus every `API_*` middleware config variable. Minimum required set:

```
HOSPEDA_DATABASE_URL
HOSPEDA_BETTER_AUTH_SECRET
HOSPEDA_BETTER_AUTH_URL
HOSPEDA_API_URL
HOSPEDA_SITE_URL
```

The API also has `.env.test` with safe test values: `HOSPEDA_DISABLE_AUTH=true`,
`HOSPEDA_ALLOW_MOCK_ACTOR=true`, `HOSPEDA_TESTING_RATE_LIMIT=false`, and a local
`TEST_DB_URL` pointing at `hospeda_test`.

### apps/web

Reads only `PUBLIC_*` and `HOSPEDA_BETTER_AUTH_URL` (server-side SSR). Minimum:

```
PUBLIC_API_URL
PUBLIC_SITE_URL
HOSPEDA_BETTER_AUTH_URL
```

### apps/admin

Reads only `VITE_*` variables. All values are baked into the Vite build bundle.
Do not put secrets here. Minimum:

```
VITE_API_URL
VITE_BETTER_AUTH_URL
```

## Docker Configuration

The file `docker/.env.example` configures the Docker Compose services (PostgreSQL
and Redis). Copy it to `docker/.env` before running `pnpm db:start`.

| Variable | Required | Secret | Default | Description |
|----------|----------|--------|---------|-------------|
| `POSTGRES_USER` | yes | no | - | PostgreSQL superuser name |
| `POSTGRES_PASSWORD` | yes | yes | - | PostgreSQL superuser password |
| `POSTGRES_DB` | yes | no | - | Database name created on first boot |
| `POSTGRES_PORT` | no | no | `5432` | Host port mapped to Postgres container |
| `REDIS_PORT` | no | no | `6379` | Host port mapped to Redis container |

The `HOSPEDA_DATABASE_URL` in `apps/api/.env.local` must match the values set
here. Example:

```
postgresql://hospeda:hospeda@localhost:5432/hospeda
```

## Test Environment

Each app has a `.env.test` file that is committed to the repository. It contains
non-secret, test-specific overrides that are automatically loaded when
`NODE_ENV=test`.

Key patterns in `.env.test` files:

- `HOSPEDA_DATABASE_URL` points at `hospeda_test` instead of `hospeda`
- `HOSPEDA_DISABLE_AUTH=true` bypasses authentication middleware
- `HOSPEDA_ALLOW_MOCK_ACTOR=true` allows injecting a test actor via headers
- `HOSPEDA_TESTING_RATE_LIMIT=false` disables rate limiting during tests
- `HOSPEDA_TESTING_ORIGIN_VERIFICATION=false` disables CSRF origin checks
- `API_LOG_LEVEL=error` suppresses noise in test output

Never put real credentials in `.env.test`. The test database is set up separately
via `TEST_DB_URL` and `TEST_DB_NAME` before the test suite runs.

## Environment Differences

| Variable | Development | Staging | Production |
|----------|-------------|---------|------------|
| `NODE_ENV` | `development` | `production` | `production` |
| `HOSPEDA_API_URL` | `http://localhost:3001` | `https://api.staging.hospeda.ar` | `https://api.hospeda.ar` |
| `HOSPEDA_SITE_URL` | `http://localhost:4321` | `https://staging.hospeda.ar` | `https://hospeda.ar` |
| `HOSPEDA_DATABASE_URL` | local Docker Postgres | staging Postgres | production Postgres |
| `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` | `TEST-xxxx` token | `TEST-xxxx` token | live token |
| `HOSPEDA_CRON_ADAPTER` | `manual` | `vercel` | `vercel` |
| `API_LOG_LEVEL` | `debug` | `info` | `warn` |
| `API_LOG_USE_COLORS` | `true` | `false` | `false` |
| `API_SECURITY_CSRF_ENABLED` | `false` | `true` | `true` |
| `HOSPEDA_SENTRY_DSN` | unset | set | set |
| `HOSPEDA_REDIS_URL` | unset or local | set | set |

## Vercel Sync Tools

Three scripts manage synchronisation between local `.env.local` files and Vercel
project settings. All require a valid Vercel token (set `VERCEL_TOKEN` or run
`vercel login`). Each app must be linked via `vercel link` which creates
`apps/{app}/.vercel/project.json`.

### env:pull

```bash
pnpm env:pull
```

Fetches variables from a Vercel project and writes them to the local `.env.local`
file for the selected app. For each variable that differs from the local value,
the script shows the new value and asks for confirmation before writing.

Source: `scripts/env/pull.ts`

### env:push

```bash
pnpm env:push
```

Reads the local `.env.local` file and pushes new or changed variables to the
Vercel project. For each variable, the script shows the diff between local and
remote and asks for confirmation before calling the Vercel API.

Source: `scripts/env/push.ts`

### env:check

```bash
pnpm env:check            # Interactive
pnpm env:check --ci       # Non-interactive, exits 1 on missing vars
pnpm env:check --verbose  # Show all variables including ok ones
```

Audits all three apps against Vercel for every environment target
(`development`, `preview`, `production`). Reports:

- Variables in `.env.example` but missing from Vercel (gaps)
- Variables in Vercel but not in `.env.example` (undocumented)

Exit code `0` means all required variables are present. Exit code `1` means at
least one required variable is missing. Use `--ci` in GitHub Actions.

Source: `scripts/env/check.ts`

## Adding a New Environment Variable

Follow this checklist when introducing a new env var:

1. **Add to env-registry** - Open the appropriate category file in
   `packages/config/src/`:
   - Server-side platform var. `env-registry.hospeda.ts`
   - API middleware config. `env-registry.api-config.ts`
   - Web browser var. `env-registry.client.ts` (`CLIENT_WEB_ENV_VARS`)
   - Admin browser var. `env-registry.client.ts` (`CLIENT_ADMIN_ENV_VARS`)
   - Docker var. `env-registry.docker-system.ts`

   Fill in all fields: `name`, `description`, `type`, `required`, `secret`,
   `exampleValue`, `apps`, `category`. Add `defaultValue` only if there is a
   meaningful production-safe default.

2. **Add to the app's Zod schema** - If the app validates env at startup (most
   do via `apps/{app}/src/utils/env.ts`), add the field to the Zod schema there.
   Use the type from `EnvVarType` as a guide (`z.string()`, `z.coerce.number()`,
   `z.enum([...])`, `z.coerce.boolean()`).

3. **Add to `.env.example`** - Add the variable to `apps/{app}/.env.example`
   with the `exampleValue` from the registry and a comment describing what it
   controls.

4. **Add to `.env.test`** - Add a safe test value to `apps/{app}/.env.test`.
   For secrets, use a clearly fake test token (e.g. `test-secret-key`). For
   URLs, use localhost equivalents.

5. **Add to `turbo.json` globalEnv** - If the variable affects build outputs or
   must invalidate the Turbo cache when it changes, add it to the `globalEnv`
   array in `turbo.json` at the repo root.

6. **Update Vercel project settings** - Log into Vercel and add the variable to
   each environment target (`development`, `preview`, `production`) for all
   affected projects. Alternatively run `pnpm env:push` after setting the value
   in `.env.local`.

7. **Run env:check** - Verify that Vercel is in sync:

   ```bash
   pnpm env:check
   ```

## Security

Rules for handling environment variables safely:

- **Never commit secrets to git.** Files that may contain real credentials
  (`.env`, `.env.local`, `.env.*.local`) are listed in `.gitignore`. Only
  `.env.example` and `.env.test` are committed.
- **Never log secret variables.** The `secret: true` flag in the registry marks
  variables that must be excluded from logs, error messages, and debug output.
- **Secrets in Vercel only.** Production credentials live exclusively in Vercel
  project settings. They are never stored in the repository.
- **`PUBLIC_` and `VITE_` vars are public.** Anything with these prefixes is
  bundled into the client-side JavaScript and visible to every browser. Never
  put secrets under these prefixes.
- **Rotate secrets immediately** if they are accidentally committed. Change the
  credential at the source (Google, MercadoPago, Resend, etc.), update Vercel,
  run `pnpm env:pull`, and purge the commit from git history.

Gitignored patterns (from `.gitignore`):

```
.env
.env.local
.env.*.local
```

## Troubleshooting

### App fails to start with validation error

The Zod schema in `apps/{app}/src/utils/env.ts` rejects missing or malformed
variables at startup. Read the error message - it lists the exact variable name
and why it failed. Check that the variable is set in `.env.local` and matches
the expected type.

### Variable is set but app still cannot read it

- For `PUBLIC_*` or `VITE_*` variables: the value is baked in at build time.
  Restart the dev server after changing these variables.
- For `HOSPEDA_*` or `API_*`: restart the API server after changing `.env.local`.
- Ensure the file is named `.env.local` not `.env.local.txt` or `.env`.

### Turbo cache is not invalidating when env vars change

Check that the variable is in `turbo.json` `globalEnv`. Variables not listed
there are invisible to Turbo's cache key. Add the variable name and run
`pnpm build` again.

**env:check reports variables as missing from Vercel**

Run `pnpm env:push` to push the local `.env.local` values to Vercel, or add the
variables manually in the Vercel dashboard under Project Settings > Environment
Variables.

**env:pull or env:push fails with "project not linked"**

Run `vercel link` inside the app directory (`apps/api`, `apps/web`, or
`apps/admin`). This creates `.vercel/project.json` with the project ID that the
scripts need.

### Legacy variable names

Some variables were renamed during the SPEC-035 cleanup. If you encounter a
variable name not in the registry, it is likely a legacy name. Consult the
SPEC-035 spec at `.claude/specs/SPEC-035-env-vars-cleanup/spec.md` for the
mapping of old names to new ones.
