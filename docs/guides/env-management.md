# Environment Variable Management

Source of truth for how env vars flow between the registry, local
development, and the Coolify-managed production VPS.

## TL;DR for new env vars

1. **Register** in `packages/config/src/env-registry.*.ts` with full
   metadata (description, type, required, secret, defaultValue,
   exampleValue, apps, category).
2. **Add Zod validation** in the consuming app's `env.ts`
   (`apps/api/src/utils/env.ts`, etc.).
3. **Update `.env.example`** in each consuming app with a safe
   placeholder.
4. **Set the value locally** in `apps/<app>/.env.local` for dev.
5. **Set the value in Coolify** for prod via `hops env-set <kind> KEY
   VALUE` (or the Coolify UI). Redeploy the app to pick up the change.

Skipping step 5 means the next prod deploy fails Zod validation at
startup — Coolify will surface a `503` until you fix it.

## The three layers

| Layer | Where it lives | Purpose |
|---|---|---|
| **Registry** | `packages/config/src/env-registry.*.ts` | Canonical list of every env var with metadata. Drives auto-generated `.env.example` lookups and the `pnpm env:check:registry` cross-validation tests. |
| **Schema** | `apps/<app>/src/utils/env.ts` (Zod) | Per-app runtime validation. Fails fast at startup if a required var is missing or malformed. |
| **Values** | Local `.env.local` (dev) + Coolify env vars (prod) | The actual secrets and config strings. Two stores: one per developer laptop, one for prod managed by Coolify. |

The registry and schema MUST be in sync — `pnpm env:check:registry`
runs three per-app cross-validation tests that fail CI if they drift.
The schema and the values store are NOT auto-synced — that is the
operator's responsibility.

The registry (plus its cross-check rules and Zod-introspected constraint
shapes) is also published as a committed JSON artifact,
`packages/config/generated/env-registry.json`, regenerated via `pnpm
gen:env-registry-json`. The `hops env-*` commands on the VPS read this
file as plain data — no pnpm/node deps needed there. A guard test fails
CI if the JSON drifts from its source.

## Local development

Each app keeps its own `.env.local` in its directory:

```
apps/api/.env.local
apps/web/.env.local
apps/admin/.env.local
```

These files are gitignored. Start from the `.env.example` next to each
one (those are committed) and fill in real values for your local DB,
your local Better Auth secret, etc.

If you need a value from prod (e.g. a MercadoPago test token), pull it
from the VPS rather than copy-pasting from a shared note:

```bash
ssh -p 2222 qazuor@216.238.103.219
hops env-pull api --reveal --output ~/api-prod.env
# Then scp it back to your laptop
```

Or just paste from Coolify UI for one-off values.

### Checking & fixing local env

Three checks validate your local setup, plus an umbrella that runs all
three:

```bash
pnpm env:check:usage   # process.env.X reads vs registry (both directions)
pnpm env:check:local   # local .env values vs registry (scope-aware)
pnpm env:check:rules   # cross-check rules vs local .env values
pnpm env:doctor        # runs all three in sequence
```

- `env:check:usage` scans `apps/**/src` + `packages/**/src` for
  `process.env.X` reads and diffs against the registry both ways: a
  read with no registry entry fails the check (naming the file:line);
  a registry entry that's never read is reported as a non-failing
  phantom. This is the only one of the three wired into CI (the Guards
  job) — it needs no per-app dotenv to run.
- `env:check:local` reads each app's local dotenv and diffs it against
  the registry, filtered by which apps use each var and by
  `requiredScope` — a var scoped to production only is not required
  locally.
- `env:check:rules` evaluates the cross-check rules
  (`packages/config/src/env-cross-checks.ts`) against your local
  dotenv values. Each rule resolves to `pass` (all referenced sides
  present and equal), `fail` (all present, not equal — non-zero exit),
  or `partial` (a side unset — non-failing, expected on a fresh
  checkout). The first seeded rule checks that
  `HOSPEDA_REVALIDATION_SECRET` matches between `api` and `web`.

When a check reports gaps, fix them interactively instead of editing
`.env.local` by hand:

```bash
pnpm env:set                # prompts only for the gaps env:check:local would flag
pnpm env:set --review-all   # walks every applicable registry entry (keep/change)
```

Prompts are shaped from the registry: an enum field becomes a select,
a bounded numeric field gets validated input, and a secret field gets
a masked prompt shown after its how-to-obtain hint (`--review-all`
shows current secret values redacted).

## Production (Coolify on the VPS)

All prod env vars live in the Coolify-managed app's environment
configuration. There are three apps:

- `hospeda-api-prod` — Hono API
- `hospeda-web-prod` — Astro web
- `hospeda-admin-prod` — TanStack Start admin

Two equivalent ways to manage them:

### Via `hops` (CLI, preferred for ops)

Run from the VPS (`ssh -p 2222 qazuor@216.238.103.219`):

```bash
# Inspect (values redacted by default)
hops env-list api
hops env-list api --reveal           # values visible — be careful

# Update / create a single var (interactive confirm)
hops env-set api FOO bar
hops env-set api MERCADO_PAGO_TOKEN --secret     # masked prompt for the value
hops env-set api LOG_LEVEL info --yes            # skip confirm (automation)

# Delete
hops env-delete api FOO

# Dump everything to a local file (mode 0600, gitignored)
hops env-pull api --output ./api-prod.env

# Reconcile registry vs live Coolify values, and evaluate cross-check
# rules against those live values
hops env-reconcile api --target=prod          # missing required vars vs Coolify
hops env-check-rules --target=prod            # all rules that apply to Coolify
hops env-check-rules --target=prod --app=api  # optional: scope to one app
hops env-doctor api --target=prod             # runs reconcile + check-rules for api

# Interactive wizard (writes to live Coolify, same gaps-only UX as
# `pnpm env:set`, reusing env-reconcile's gap detection)
hops env-set --wizard
hops env-set --wizard --review-all

# After ANY env change, the running container does NOT pick up the value
# until restart:
hops redeploy api          # full rebuild
hops app-restart api       # in-place restart (no image pull)
```

Use this path when you are already SSH-ed in for ops, or in scripts
that compose env changes with other operations.

`env-reconcile` diffs the registry (`requiredScope`-aware for the given
`--target`) against the live Coolify env vars for that app — it reports
every required var missing from Coolify, and informationally lists vars
present in Coolify but absent from the registry.

`env-check-rules` runs the same rule engine as `pnpm env:check:rules`,
but against live Coolify values, for rules whose scope includes
Coolify. It adds a fourth state, `skipped`, for a rule whose referenced
app container is unreachable — that one rule is skipped and the rest
still evaluate, so one broken app never blanks the whole report.

`env-doctor <kind> --target=<prod|staging>` is the umbrella: it runs
`env-reconcile` then `env-check-rules` for that app.

### Via Coolify UI

Open `https://coolify.hospeda.com.ar`, navigate to the app, then
**Environment Variables**. Use this path when you are doing a one-off
change and want the visual diff against existing values.

⚠ Coolify mirrors any new env var into **both** the production and
preview environments on create (regardless of the "is preview" toggle
in the UI). After creating a var, use `hops env-delete api KEY
--preview` if you want the preview copy gone.

## Adding a new env var — full procedure

```
1. Register in @repo/config       → packages/config/src/env-registry.*.ts
2. Add to Zod schema              → apps/<app>/src/utils/env.ts
3. Update .env.example            → apps/<app>/.env.example
4. Run pnpm env:check:registry    → confirms registry matches schemas
5. Add value locally              → apps/<app>/.env.local
6. Add value in Coolify           → hops env-set <kind> KEY VALUE
7. Redeploy                       → hops redeploy <kind>
8. Verify                         → hops health prod (or curl the app)
```

Step 4 (`pnpm env:check:registry`) is the CI gate — it runs three
per-app vitest suites that import the Zod schema and assert every
schema key has a matching registry entry. Drift fails CI.

Step 6 (push to prod) is done via `hops env-set` on the VPS — see the
"Production (Coolify on the VPS)" section above. There is no
laptop-to-prod env push command in the repo by design: all prod env
changes go through Coolify (CLI or UI), never through a generic
"sync" script.

## Sentry environment tagging — required for every deploy

Each app sets the Sentry `environment` tag via its own dedicated env var so
that staging and production are reportable separately. **Without these vars,
all events tag as `production` (api) or `MODE=production` (web/admin) and
staging events silently land in the prod bucket.**

| App | Env var | Where to set |
|---|---|---|
| `hospeda-api-prod` | `HOSPEDA_SENTRY_ENVIRONMENT=production` | Coolify env (runtime) |
| `hospeda-api-staging` | `HOSPEDA_SENTRY_ENVIRONMENT=staging` | Coolify env (runtime) |
| `hospeda-web-prod` | `PUBLIC_SENTRY_ENVIRONMENT=production` | Coolify env (runtime) |
| `hospeda-web-staging` | `PUBLIC_SENTRY_ENVIRONMENT=staging` | Coolify env (runtime) |
| `hospeda-admin-prod` | `VITE_SENTRY_ENVIRONMENT=production` | Coolify **build-time** arg + env (Vite bakes it into the bundle) |
| `hospeda-admin-staging` | `VITE_SENTRY_ENVIRONMENT=staging` | Coolify **build-time** arg + env |

The admin entry is special: `VITE_*` vars are baked into the bundle at `docker
build` time, NOT read at runtime. The admin Dockerfile declares
`ARG VITE_SENTRY_ENVIRONMENT`; Coolify must pass it via build-arg (Project →
Build → Build Arguments) or the bundle will pick up the placeholder. Setting
it only as a runtime env var has no effect on the served JS bundle.

To verify after deploy:

```bash
# API + web: check via container env
hops env-list api --target=staging | rg SENTRY
hops env-list web --target=staging | rg SENTRY

# Admin: check via running container (build-time bake)
hops exec admin --target=staging -- printenv | rg SENTRY
# OR check the JS bundle directly:
curl -s https://staging-admin.hospeda.com.ar/assets/index-*.js | rg -o 'environment["\']?:\s*["\'][a-z]+'
```

Turning this manual check into a formal `env-check-rules` rule is a
tracked follow-up (HOS-79 OQ-1), not yet implemented.

## Sentry release tagging — connect to the deploy SHA

By default every Sentry event is tagged `release: development` because no
deploy provides a unique release identifier. That is fine for local dev
but breaks Sentry's ability to (a) group regressions by deploy, (b) link
events to source maps uploaded per release, and (c) compute release health.

Resolution happens automatically inside `apps/web/Dockerfile` and
`apps/admin/Dockerfile`. The Dockerfiles declare:

```dockerfile
ARG SOURCE_COMMIT
ARG HOSPEDA_GIT_SHA=${SOURCE_COMMIT}
ARG PUBLIC_SENTRY_RELEASE=${HOSPEDA_GIT_SHA}   # web
ARG VITE_SENTRY_RELEASE=${HOSPEDA_GIT_SHA}     # admin
```

Coolify auto-injects `--build-arg SOURCE_COMMIT=<sha>` when the
"Include Source Commit in Build" toggle is enabled in the application's
General settings. With that toggle on, the chain resolves all the way to
the deploy SHA and Astro / Vite bake it into the client bundle via
`import.meta.env.*`. With the toggle off, `SOURCE_COMMIT` is empty, the
chain resolves to empty, and the downstream `|| 'development'` fallback
in each Sentry init takes over.

### One-time Coolify configuration (per resource)

For each of the 6 resources (api / web / admin × staging / prod):

1. Open `https://coolify.hospeda.com.ar` → resource → **General settings**.
2. Enable the toggle **"Include Source Commit in Build"**.
3. Trigger a rebuild.

Coolify docs: <https://coolify.io/docs/applications/build-packs/dockerfile>
(SOURCE_COMMIT section). The toggle is off by default because injecting
the SHA invalidates the Docker layer cache on every commit. For us that
trade-off is acceptable — release tracking and source map symbolication
are worth more than partial cache hits.

### Manual override

The `${VAR:-default}` form in the ARG chain means a manually-set
`HOSPEDA_GIT_SHA` (as a Coolify Build Variable with a literal value)
still wins. Useful when you want to pin a deploy to a specific release
identifier separate from the commit SHA.

### Verifying after a deploy

```js
// From the browser console on the deployed app:
window.__SENTRY__[Object.keys(window.__SENTRY__).find(k => /^\d+\.\d+/.test(k))]
  .defaultCurrentScope.getClient().getOptions().release
// → "abc123def456..." (the git SHA)
```

The build log also prints the resolved value just before `astro build` /
`vite build` runs (look for `[build] Sentry release: ...`).

### Why this matters for source maps

`@sentry/astro` (web) and `@sentry/vite-plugin` (admin) only associate
their uploaded source maps with the release string they see at build
time. If the release is `development` for every prod deploy, Sentry can
never symbolicate stack traces from minified bundles — even with the
maps uploaded — because nothing matches the event's release tag against
the upload's release tag.

## Audit checklist — once per quarter

15 minutes, run alongside the cron audit (`docs/guides/cron-management.md`):

1. From a laptop, run `pnpm env:check:registry` — confirms zero drift
   between registry and schemas.
2. From a laptop, run `pnpm env:doctor` — confirms zero drift between
   `process.env` usage, local dotenv values, and cross-check rules.
3. SSH to the VPS, run `hops env-doctor <api|web|admin>
   --target=prod` (and `--target=staging`) for each app — confirms
   zero drift between the registry and the live Coolify values, and
   that all applicable cross-check rules pass.
4. Confirm no preview-mirrored vars are leaking secrets that should
   only exist in production (`hops env-list api --reveal | grep
   '[preview]'`).

## Reference

- `pnpm env:check:registry` source: [`scripts/check-env-registry.sh`](../../scripts/check-env-registry.sh)
- Registry: `packages/config/src/env-registry.*.ts` (one file per app/package)
- hops env commands: [`scripts/server-tools/README.md`](../../scripts/server-tools/README.md)
- VPS deployment spec, Paso 17.3: [`docs/migration/vps-deployment-spec.md`](../migration/vps-deployment-spec.md)
- CLAUDE.md root section on env vars: [`CLAUDE.md`](../../CLAUDE.md#environment-configuration)
