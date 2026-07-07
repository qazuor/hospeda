# Sentry operational scripts

`setup-alerts.mjs` provisions Sentry alert rules (first-seen issue, error-rate
spikes, etc.) via the Sentry REST API, since the Sentry MCP server cannot
create alert rules directly. It does NOT create duplicates — existing rules
are matched by exact name and skipped — so it is safe to re-run. It does NOT
update an existing rule if you change its parameters in this script: to
change an existing rule, delete it in the Sentry UI and re-run the script.
Run it with an Organization Auth Token that has the `alerts:write`,
`project:read`, and `org:read` scopes (generate one at
`https://qazuor.sentry.io/settings/auth-tokens/`):

```bash
SENTRY_AUTH_TOKEN=<token> node scripts/sentry/setup-alerts.mjs
SENTRY_AUTH_TOKEN=<token> node scripts/sentry/setup-alerts.mjs --dry-run
```

The token is read from the environment and never persisted or logged.

Optionally set `SENTRY_NOTIFY_USER_ID` to override the Sentry member who
receives alert emails (default: `3609705`, leandro asrilevich / <qazuor@gmail.com>).

## New env vars from the production-hardening pass (Coolify)

The Sentry prod-hardening work added a dedicated `hospeda-csp` Sentry project
that receives ONLY browser-emitted CSP violation reports, kept separate from
each app's own error-tracking project so violation noise never pollutes the
app's issue stream. Two new env vars route CSP `report-uri` there instead of
deriving it from the app's own DSN; both are optional — when unset, the CSP
falls back to the previous DSN-derived report endpoint, so nothing breaks if
they are not set yet:

- `PUBLIC_SENTRY_CSP_REPORT_URI` (web, `hospeda-web-prod`/`hospeda-web-staging`)
- `VITE_SENTRY_CSP_REPORT_URI` (admin, `hospeda-admin-prod`/`hospeda-admin-staging`
  — also required as a Docker build-arg, same as `VITE_SENTRY_DSN`)

Both take the same value: the `hospeda-csp` project's Security Header
endpoint URL from Sentry → Settings → Security Headers (NOT a DSN — it
already includes `/api/<project_id>/security/?sentry_key=<key>`). Set them via
`hops env-set <kind> KEY VALUE` on the VPS or the Coolify UI, then redeploy.
The canonical source of truth for both vars (description, required/optional,
which apps consume them) is the registry entries in
`packages/config/src/env-registry.client.ts` — look up
`PUBLIC_SENTRY_CSP_REPORT_URI` and `VITE_SENTRY_CSP_REPORT_URI` there.
