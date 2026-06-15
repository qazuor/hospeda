---
specId: SPEC-180
title: Sentry Observability Hardening — source maps, environments, and logger-driven capture
type: fix
status: approved
complexity: medium-high
owner: qazuor
created: 2026-06-01
base: staging
branch: spec/SPEC-180-sentry-observability
worktree: /home/qazuor/projects/WEBS/hospeda-spec-180-sentry-observability
linearIssues:
  - BETA-66
  - BETA-50
  - BETA-64
tags:
  - sentry
  - observability
  - source-maps
  - docker
  - logger
  - api
  - web
  - admin
  - ops
---

# SPEC-180 — Sentry Observability Hardening

## 1. Origin & problem statement

Three Linear issues converge on a single root: **Sentry is configured but not actually working well in production**.

### BETA-66 — Source maps never upload (minified stack traces)

Stack traces in Sentry are minified and unreadable.

**Root cause**: `SENTRY_AUTH_TOKEN` is never declared as an `ARG` in the build stage of ANY of the three Dockerfiles (`apps/web/Dockerfile`, `apps/admin/Dockerfile`, `apps/api/Dockerfile`). Without it, the token is invisible inside `docker build` — the Sentry plugin gates on it:

- `apps/web/astro.config.mjs`: the entire `sentry()` integration is **gated on `process.env.PUBLIC_SENTRY_DSN`** (not the token). Even if the token were available, the gate condition is wrong — it requires the DSN, not the auth token. The correct gate should be `process.env.SENTRY_AUTH_TOKEN`.
- `apps/admin/vite.config.ts`: gated correctly on `process.env.SENTRY_AUTH_TOKEN` — will work once the `ARG` is added to the Dockerfile.
- `apps/api/tsup.config.ts`: gated correctly on `process.env.SENTRY_AUTH_TOKEN` — same.

**What SPEC-146 did (and what it missed)**: SPEC-146 wired the release identifier (`SOURCE_COMMIT` → `HOSPEDA_SENTRY_RELEASE` / `PUBLIC_SENTRY_RELEASE` / `VITE_SENTRY_RELEASE`) correctly in all three Dockerfiles. It did NOT add `SENTRY_AUTH_TOKEN` as a build `ARG` because it presumed the token was already flowing. It was not.

**Additional note on web**: `SENTRY_AUTH_TOKEN` is already registered in `packages/config/src/env-registry.hospeda.ts` with full metadata (build-time, secret, applies to all three apps). The `.env.example` files already reference it. The registry step is DONE. The only remaining work is the Dockerfile `ARG` + the web gate fix.

### BETA-50 — Wrong Sentry environment in staging (noisy prod bucket)

Environment derivation is CODE-correct in all three apps — each falls back through an explicit env var to `NODE_ENV` to `'development'`:

- **Web**: `PUBLIC_SENTRY_ENVIRONMENT || import.meta.env.MODE || 'development'`
- **Admin**: `VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE || 'development'`
- **API**: `HOSPEDA_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'`

The operational risk: if Coolify staging resources do NOT set `PUBLIC_SENTRY_ENVIRONMENT` (web), `VITE_SENTRY_ENVIRONMENT` (admin), or `HOSPEDA_SENTRY_ENVIRONMENT` (api), staging events fall through to `NODE_ENV=production` and **collapse into the production Sentry bucket** — making production alerts fire on staging noise.

Additionally, `docs/runbooks/sentry-setup.md` (last updated 2026-03-04) uses stale unprefixed var names that were renamed by SPEC-035.

A secondary note: the web Sentry client is gated behind the `crashReporting` consent cookie (intentional privacy decision, not a bug — but it should be clearly documented rather than left as implicit behavior).

### BETA-64 — No automatic error forwarding from @repo/logger to Sentry (but flooding if naive)

`@repo/logger` is console-only with no transport hook. Sentry is already substantially wired in `apps/api`:

- `expected_error: true` tag convention (drops 422/404 events in `beforeSend`)
- `sentryMiddleware` for HTTP request context
- Per-domain capture helpers: `captureBillingError`, `captureWebhookError`

The naive approach — auto-forward ALL `logger.error` calls to Sentry — would produce 200-2000 events/day of noise:

- The per-request HTTP 5xx logger middleware fires on every unhandled exception (already captured by `sentryMiddleware`)
- `service-core`'s `logError()` fires on every 422 (validation error) and 404 (not found) — these are already tagged `expected_error: true` and dropped in `beforeSend`
- The subscription-poll cron runs every minute and logs every failure (can produce 1440 entries/day on a connectivity blip)

**Decided approach** (opt-in, not opt-out):

1. Add a `capture?: boolean` flag to `LoggerOptions` in `packages/logger` and export a `registerCaptureHook(fn)` function. The package stays completely Sentry-free — no `@sentry` import in `packages/logger`.
2. In `apps/api`, after Sentry is initialized, register a forwarder: if `level === 'error'` AND `capture === true` → call `Sentry.captureException`.
3. Tag approximately 15 genuinely actionable call sites with `{ capture: true }`.
4. Extend the existing `beforeSend` denylist in `apps/api/src/lib/sentry.ts` to explicitly drop the HTTP middleware message and response-body dumps.
5. Rate-limit the subscription-poll cron error path: use a consecutive-failure counter — report the 1st failure and every 10th thereafter.
6. `warn` level → add as Sentry breadcrumb only (not a captured event).

**Target volume**: ~5–50 events/day of genuinely actionable errors.

## 2. Scope

### In scope

1. **BETA-66** — Add `ARG SENTRY_AUTH_TOKEN` + `ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN` to the build stage of all three Dockerfiles.
2. **BETA-66** — Fix the web Sentry plugin gate in `apps/web/astro.config.mjs` to activate on `SENTRY_AUTH_TOKEN` instead of `PUBLIC_SENTRY_DSN`.
3. **BETA-64** — Add `capture?: boolean` to `LoggerOptions` + `registerCaptureHook(fn)` export in `packages/logger` (keep package Sentry-free).
4. **BETA-64** — Register Sentry forwarder in `apps/api/src/utils/logger.ts` (or equivalent initialization site after Sentry init).
5. **BETA-64** — Tag ~15 actionable call sites with `{ capture: true }`.
6. **BETA-64** — Extend `beforeSend` denylist in `apps/api/src/lib/sentry.ts`.
7. **BETA-64** — Rate-limit subscription-poll cron error reporting (consecutive-failure counter).
8. **BETA-64** — Tests for the hook mechanism + `beforeSend` filter logic.
9. **BETA-50** — (Optional hardening) Log a warning at API startup if `HOSPEDA_SENTRY_ENVIRONMENT` is unset in a non-dev deploy.
10. **BETA-50** — Fix `docs/runbooks/sentry-setup.md` to use correct prefixed var names.
11. **BETA-50** — Document the `crashReporting` consent cookie gate in the web Sentry setup.
12. **BETA-50** — Ops checklist: owner must set `SENTRY_AUTH_TOKEN` (secret) + `*_SENTRY_ENVIRONMENT=staging|production` per app in Coolify, then redeploy.
13. **Closeout** — flip spec + task index to completed when shipped.

### Out of scope

- Adding Sentry capture to `apps/web` or `apps/admin` logger paths (web has no `@repo/logger` usage; admin uses a different error boundary pattern).
- Changing the `crashReporting` consent gate on the web client (intentional privacy decision).
- Creating new Sentry alert rules (covered by the existing `docs/billing/sentry-alerts-runbook.md`).
- `SENTRY_AUTH_TOKEN` env-registry registration (already done in `packages/config/src/env-registry.hospeda.ts`).

## 3. Acceptance criteria

```
Given source maps are uploaded to Sentry
  When an API/web/admin error occurs in production
  Then the Sentry stack trace shows symbolicated lines (not minified identifiers)

Given SENTRY_AUTH_TOKEN is set in Coolify as a build-arg
  When Coolify builds apps/api, apps/web, or apps/admin
  Then the build-stage container sees the token and the Sentry plugin uploads source maps

Given the web Sentry plugin gate is fixed
  When SENTRY_AUTH_TOKEN is set
  Then the plugin activates regardless of whether PUBLIC_SENTRY_DSN is set

Given HOSPEDA_SENTRY_ENVIRONMENT=staging is set in Coolify for the staging apps
  When a staging error is captured
  Then it appears under environment=staging in Sentry (not production)

Given the API logger forwarder is registered
  When logger.error() is called with { capture: true }
  Then Sentry.captureException is called with the error and extra context
  And the event appears in Sentry under the correct release + environment

Given logger.error() is called WITHOUT { capture: true }
  When the logger writes to console
  Then Sentry.captureException is NOT called (no double-capture, no noise)

Given the subscription-poll cron fails consecutively
  When failure count is 1 or a multiple of 10
  Then a Sentry event is captured
  When failure count is 2–9 (or non-multiple of 10)
  Then no Sentry event is captured (rate-limited)

Given the beforeSend denylist is extended
  When an event matching the HTTP middleware message pattern arrives
  Then Sentry.beforeSend drops it (returns null)

Given the test suite runs
  When testing the capture hook mechanism
  Then registerCaptureHook registers a forwarder, which fires on error+capture, not on warn
  When testing beforeSend
  Then denylist patterns correctly drop noise events and pass through actionable events
```

### Owner action required (Coolify)

The following must be set manually in Coolify after this PR merges — the code cannot do this automatically:

1. **`SENTRY_AUTH_TOKEN`** — set as a **build-time secret** in each of `hospeda-api-staging`, `hospeda-web-staging`, `hospeda-admin-staging` (and their prod counterparts). Use `hops env-set <kind> SENTRY_AUTH_TOKEN <value> --secret` from the VPS or the Coolify UI.
2. **`HOSPEDA_SENTRY_ENVIRONMENT=staging`** for the API staging app.
3. **`PUBLIC_SENTRY_ENVIRONMENT=staging`** for the web staging app.
4. **`VITE_SENTRY_ENVIRONMENT=staging`** for the admin staging app.
5. Corresponding `=production` values for the production apps (if not already set).
6. Trigger a **full rebuild** (not just restart) for each app so the Dockerfile `ARG` picks up the new token.

> These env var names are already registered in `packages/config/src/env-registry.hospeda.ts`. After setting them in Coolify, run `pnpm env:check:registry` locally to verify the app schemas remain in sync.

## 4. Key file pointers

| File | Relevance |
|------|-----------|
| `apps/api/Dockerfile` | Add `ARG SENTRY_AUTH_TOKEN` to build stage |
| `apps/web/Dockerfile` | Add `ARG SENTRY_AUTH_TOKEN` + `ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN` to build stage |
| `apps/admin/Dockerfile` | Add `ARG SENTRY_AUTH_TOKEN` + `ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN` to build stage |
| `apps/web/astro.config.mjs` | Fix Sentry plugin gate (line ~104): `PUBLIC_SENTRY_DSN` → `SENTRY_AUTH_TOKEN` |
| `packages/logger/src/types.ts` | Add `capture?: boolean` to `LoggerOptions` interface |
| `packages/logger/src/index.ts` | Export `registerCaptureHook` |
| `packages/logger/src/logger.ts` | Wire hook invocation on error-level log with capture flag |
| `apps/api/src/lib/sentry.ts` | Extend `beforeSend` denylist; existing `captureBillingError`/`captureWebhookError` stay |
| `apps/api/src/utils/logger.ts` (or init site) | Register Sentry forwarder after Sentry.init() |
| `apps/api/src/cron/bootstrap.ts` | Tag cron bootstrap failures + subscription-poll rate limiter |
| `docs/runbooks/sentry-setup.md` | Update stale var names (SPEC-035 renamed) |
| `packages/config/src/env-registry.hospeda.ts` | Already has `SENTRY_AUTH_TOKEN` — no change needed |

## 5. Design decisions (locked)

1. **`packages/logger` stays Sentry-free.** The hook is a `(error: unknown, extra: Record<string, unknown>) => void` callback registered at app startup. No `@sentry/*` import in the logger package.
2. **Opt-in capture only.** The `capture: true` flag must be set explicitly. Default is `false` (no change to existing behavior).
3. **`warn` → breadcrumb only.** Warn-level logs are forwarded as Sentry breadcrumbs by the forwarder, not as captured exceptions. This gives trace context without inflating the event quota.
4. **Subscription-poll rate limit = 1 + every 10th.** The consecutive-failure counter resets to 0 on the first success. State is module-level (in-memory; acceptable for a cron that runs in a single-process Node server).
5. **Web Sentry plugin gate fix**: change the outer guard from `process.env.PUBLIC_SENTRY_DSN` to `process.env.SENTRY_AUTH_TOKEN`. The DSN is configured in `sentry.client.config.ts` / `sentry.server.config.ts` (auto-discovered by `@sentry/astro`); the build-time plugin only needs the auth token.
6. **Dockerfile pattern for build-time secrets**: use `ARG SENTRY_AUTH_TOKEN` in the build stage (no default value — absent in local builds, present in Coolify builds). Do NOT propagate to the runner stage (it's a build-time secret only).
7. **`crashReporting` consent gate (web)**: intentional privacy decision — NOT changed. Add a doc comment in `sentry.client.config.ts` and a note in `docs/runbooks/sentry-setup.md`.

## 6. Risk and rollback

- **Dockerfile ARG changes are additive and safe**: if `SENTRY_AUTH_TOKEN` is not set in Coolify, the `ARG` resolves to empty, the Sentry plugin gate evaluates to false, and the build proceeds identically to today (no source maps uploaded, but no breakage).
- **Logger hook is opt-in**: zero existing call sites are affected until explicitly tagged with `{ capture: true }`. Existing console output is unchanged.
- **`beforeSend` denylist extension**: drops events that currently reach Sentry as noise. If the denylist is too aggressive, removing an entry and redeploying is a <5 min fix.
- **Rate limiter state is ephemeral**: a pod restart resets the counter. The worst case is one extra Sentry event per restart on a flapping subscription-poll. Acceptable.

## 7. Open questions (resolved)

| Question | Decision |
|----------|----------|
| Should warn → capture or breadcrumb? | Breadcrumb only (D3) |
| Rate-limit threshold for subscription-poll? | 1st + every 10th consecutive failure (D4) |
| Should web Sentry plugin gate on DSN or token? | Token only — DSN lives in runtime config files (D5) |
| Should SENTRY_AUTH_TOKEN be in runner stage? | No — build-time secret only (D6) |
| Should `packages/logger` import @sentry? | No — hook pattern keeps logger Sentry-free (D1) |
