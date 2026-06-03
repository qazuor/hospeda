# Log Management

How API logs are emitted, captured, persisted, and queried across local
development and the Coolify-managed production VPS (SPEC-184 / BETA-82).

## TL;DR

- The API logs to **stdout only**. There is NO file logging; Docker/Coolify
  capture stdout with configurable retention. Don't write log files inside
  containers.
- `API_LOG_FORMAT=json` switches the logger to NDJSON (one JSON object per
  line) for aggregators and Coolify log search. Default is `pretty`
  (chalk-colored, human-readable).
- WARN and ERROR entries are additionally persisted to the `app_log_entries`
  table and queryable in the admin under **Plataforma → Operaciones del
  sistema → Logs** (permission: `SYSTEM_MAINTENANCE_MODE`).
- Persisted entries are purged after **30 days** by the `app-log-purge` cron
  job (daily, 5:00 UTC).

## Where logs go

| Surface | What | Retention |
|---|---|---|
| stdout (container) | Every log line (all levels) | Coolify log retention (configurable per app in the Coolify UI) |
| `app_log_entries` (Postgres) | WARN + ERROR only | 30 days (`app-log-purge` cron) |
| Admin log viewer | Reads `app_log_entries` | Same as the table |

File persistence is deliberately NOT supported: the API runs as
`node dist/index.js` inside Docker on Coolify. Files written to the container
filesystem are invisible to the Coolify log viewer, leak disk space with no
rotation, and disappear when the container is recreated. The legacy
`API_LOG_SAVE` config field exists but its write path was never implemented;
leave it `false`.

## Output format: `API_LOG_FORMAT`

Registered in `@repo/config` and validated in `apps/api/src/utils/env.ts`.
Applied at server bootstrap (`apps/api/src/index.ts`).

- `pretty` (default) — chalk-colored terminal output with emoji level icons,
  category pills, and timestamps. Best for local dev.
- `json` — newline-delimited JSON (NDJSON): one structured object per line,
  no ANSI color codes. Pipeable to `jq` and parseable by log aggregators and
  Coolify's log search.

```bash
# .env.local (apps/api) or Coolify env
API_LOG_FORMAT=json
```

Each NDJSON line has the shape:

```json
{"ts":"2026-06-03T14:23:01.123Z","level":"WARN","category":"API","label":"request","message":"...","data":{}}
```

- String payloads land in `message`; object payloads land in `data` (already
  redacted — see below).
- The bare `LOG_FORMAT` env var is also read directly by `@repo/logger` for
  consumers outside the API (scripts, seeds); inside the API always use the
  `API_LOG_FORMAT` form, consistent with the other `API_LOG_*` vars.

### Sensitive-data redaction

Redaction applies in BOTH formats before any output or persistence:
sensitive keys (passwords, tokens, PII — including DNI/CUIT/CUIL) and
sensitive value patterns (JWTs, emails, credit cards, phone numbers) are
replaced with `[REDACTED]`. The logic lives in `packages/logger/src/redact.ts`.

## Verbosity tuning

- `API_LOG_LEVEL` — minimum level emitted (`debug` | `info` | `warn` |
  `error`). Default `info`.
- `LOG_EXPAND_OBJECT_LEVELS` — how many levels deep objects are expanded in
  pretty output: `-1` expands everything, `0` shows `[Object]`, `n` expands
  `n` levels. Read by `@repo/logger` from the environment; the API's
  `API_LOG_EXPAND_OBJECTS` boolean maps to all-or-nothing expansion.
- The full set of `API_LOG_*` knobs (colors, timestamps, truncation,
  stringification) is documented in
  [environment-variables.md](environment-variables.md) and registered in
  `packages/config`.

## DB persistence (admin log viewer)

At startup (after DB init) the API registers a `db-sink` hook on the shared
logger hook registry (`packages/logger/src/hooks.ts`). The sink:

- Persists **WARN and ERROR only** (volume guard) into `app_log_entries`.
- Is **fire-and-forget**: the insert is never awaited and its failure never
  breaks the logging call site.
- Has a **30-second failure cooldown**: a failed insert triggers the DB
  layer's own ERROR log, which would re-enter the sink forever while the DB
  is down; the cooldown cuts that feedback loop and self-heals on recovery.
- Truncates messages longer than 2000 chars (full text kept under
  `data.messageFull`).

Query the entries via `GET /api/v1/admin/logs` (filters: `level`,
`category`, `fromDate`, `toDate`; paginated with `page` + `pageSize`) or in
the admin UI under **Plataforma → Operaciones del sistema → Logs**. Both are
gated by `SYSTEM_MAINTENANCE_MODE`.

Retention: the `app-log-purge` cron job (registered in
`apps/api/src/cron/schedules.manifest.ts`, daily at 5:00 UTC) hard-deletes
entries older than 30 days. Note for ops: when this ships, provision the new
schedule on the external scheduler like any other manifest entry.

NOTE: this table holds **general application logs**. Audit/security log
querying (user/resource context) is a separate domain (SPEC-162).

## Coolify: reading and retaining logs

- Logs for each app (`hospeda-api-prod`, etc.) are visible in the Coolify
  dashboard under the app's **Logs** tab; retention is configured per app.
- With `API_LOG_FORMAT=json`, Coolify's log search matches against the
  structured fields, which makes filtering by level or category strings
  reliable.
- For ad-hoc inspection on the VPS: `hops logs <kind>` (see
  [env-management.md](env-management.md) for the `hops` tooling).

## Phase 2 (future): Loki + Grafana

If log volume or query needs outgrow the DB sink + Coolify retention, the
planned next step is a self-hosted Loki + Grafana stack on the VPS ingesting
the NDJSON stdout (free, no code changes needed thanks to
`API_LOG_FORMAT=json`). Deliberately NOT implemented in SPEC-184 — revisit
when there is a concrete need.
