---
specId: SPEC-184
title: API Log Observability
type: feature
status: completed
complexity: medium
owner: qazuor
created: 2026-06-02
base: staging
branch: spec/SPEC-184-api-log-observability
worktree: /home/qazuor/projects/WEBS/hospeda-spec-184-api-log-observability
linearIssues:
  - BETA-82
tags:
  - logging
  - observability
  - api
  - admin
  - db
  - cron
  - beta-82
---

# SPEC-184 — API Log Observability

## 1. Origin & problem statement

**BETA-82** — Requested: API logging "readable in terminal, persisted to file, queryable
from admin."

### Investigation & reframing

This request was investigated against the actual architecture before scoping. Three
facts changed the direction:

**Fact 1 — `@repo/logger` already has rich terminal output.**
The formatter (`packages/logger/src/formatter.ts`) uses chalk for colors, emoji level
icons, category pills, timestamps, and sensitive-data redaction (30+ patterns including
CUIT/CUIL). The `SAVE: boolean` config field and its env-var path (`LOG_SAVE`) exist
but the write path is a `// TODO` stub in `logWithLevel`. Terminal output already
satisfies "readable" — this spec does NOT re-do that work.

**Fact 2 — File persistence is an anti-pattern in this deployment.**
The API runs as `node dist/index.js` inside Docker on Coolify (VPS). Docker/Coolify
captures stdout/stderr automatically with configurable retention. There are NO log
volume mounts or rotation. Writing to the container filesystem would be invisible to
Coolify's log viewer, leak disk space with no purge, and require volume mount ops.
**File persistence is therefore OUT OF SCOPE.** It is replaced by:

- Documented stdout → Coolify retention (free, already works).
- A DB sink for WARN+ERROR only (queryable by admin).
- A Loki+Grafana note as a PHASE-2 future option (free, self-hosted, NOT implemented here).

**Fact 3 — SPEC-162 (draft) owns audit/security log query.**
SPEC-162 is reserved for querying dedicated AUDIT and SECURITY logs (domain-specific,
with user/resource context). This spec covers **general application logs** (WARN/ERROR
surfaced by the API logger). Keep them DISTINCT. Do NOT build an audit-log viewer here.

**Precedents to reuse (do not rebuild):**

- `cron_runs` table + `CronRunModel` + `CronRunService` + `cron-run-purge` job
  (SPEC-161) — append-only observability table + purge pattern. Use the same shape.
- `schedules.manifest.ts` — cron job manifest SSOT. The purge job for `app_log_entries`
  must be registered there.
- `SYSTEM_MAINTENANCE_MODE` permission — gates the cron admin routes (SPEC-161). This
  spec reuses the same permission for the log admin route (co-located in
  Plataforma → Operaciones del sistema).

---

## 2. Architecture overview — what already exists vs. what is new

### What ALREADY EXISTS (preserve, extend, do not rebuild)

| Component | Location | What it does |
|-----------|----------|-------------|
| `logger.ts` / `formatter.ts` | `packages/logger/src/` | Rich pretty terminal output; chalk + emoji + sensitive-data redaction + category system. |
| `SAVE: boolean` config field | `packages/logger/src/config.ts` | Exists, env-var `LOG_SAVE` reads it; `logWithLevel` has a `// TODO` stub for file save. |
| `LOG_EXPAND_OBJECT_LEVELS` env var | `packages/logger/src/environment.ts` | Already reads `EXPAND_OBJECT_LEVELS` from env. Needs documentation only. |
| `cron_runs` table + model + service | `packages/db/src/schemas/cron/` + `packages/db/src/models/cron/` + `@repo/service-core` | Full CRUD + purge precedent. |
| `cron-run-purge` job | `apps/api/src/cron/jobs/cron-run-purge.job.ts` | Purge job pattern: `CronJobDefinition` shape, differentiated retention, dry-run support. |
| `schedules.manifest.ts` | `apps/api/src/cron/schedules.manifest.ts` | SSOT for job names/schedules/categories. Sync test guards it. |
| `SYSTEM_MAINTENANCE_MODE` permission | `packages/schemas/src/enums/permission.enum.ts` | Gates cron admin routes; will also gate app-log admin route (co-located). |
| Cron admin page | `apps/admin/src/routes/platform/` | Lives under Plataforma → Operaciones del sistema; log viewer co-locates here. |

### What is NEW (this spec authors)

1. **`LOG_FORMAT=pretty|json` toggle** in `@repo/logger` — `pretty` (default) preserves
   current chalk-colored output; `json` emits newline-delimited JSON (NDJSON), no chalk,
   pipeable to jq/aggregators.
2. **`registerSinkHook(fn)` in `@repo/logger`** — dependency-injected callback that
   receives every structured log entry AFTER console dispatch. Keeps `@repo/logger`
   dependency-free (no Sentry, no DB). MUST coordinate with SPEC-180's
   `registerCaptureHook` — see §2.1.
3. **`app_log_entries` table** — append-only, WARN+ERROR only, async write via a sink
   registered at API startup. Style: `cron_runs`.
4. **`app-log-purge` cron job** — hard-deletes entries older than 30 days (or owner
   confirms retention). Style: `cron-run-purge`.
5. **Admin list endpoint** — paginated, filterable by level/category/time range.
   Permission: `SYSTEM_MAINTENANCE_MODE`. Pattern: `createAdminListRoute` (page+pageSize).
6. **Admin UI page** — TanStack Table, under Plataforma → Operaciones del sistema.
   Permission-gated. Follows existing cron observability page conventions.
7. **`docs/guides/log-management.md`** — stdout/Coolify retention guide + `LOG_FORMAT`
   usage + `LOG_EXPAND_OBJECT_LEVELS` doc + Loki phase-2 note.

### 2.1 Cross-spec coordination: SPEC-180 hook infrastructure

SPEC-180 (Sentry, in-progress) is adding a `registerCaptureHook(fn)` to `@repo/logger`
using a dependency-injected hook pattern (no direct Sentry import in the logger package).

**Rule:** SPEC-184's `registerSinkHook` MUST use the same hook-registry mechanism.
The preferred design is a SINGLE generic `registerHook(name, fn)` API in `@repo/logger`
that both SPEC-180 (capture) and SPEC-184 (sink) call — so they coexist cleanly and
don't each build their own registry.

**Coordination protocol:**

- Whichever spec lands first (SPEC-180 or SPEC-184) builds the generic hook infrastructure.
- The second spec extends it rather than adding a parallel mechanism.
- The implementer MUST read the SPEC-180 branch before starting Phase 2, or coordinate
  with the SPEC-180 implementer to agree on the hook API surface.

This is a BLOCKING dependency: Phase 2 (`registerSinkHook`) cannot be finalized without
aligning with SPEC-180's hook shape.

---

## 3. Scope

### In scope

1. **Phase 1** — `LOG_FORMAT=pretty|json` toggle in `@repo/logger` formatter; env-registry
   entry + docs for `LOG_FORMAT` + `LOG_EXPAND_OBJECT_LEVELS`.
2. **Phase 2** — `registerSinkHook(fn)` in `@repo/logger` (coordinate with SPEC-180);
   unit tests; keep package dependency-free.
3. **Phase 3** — `app_log_entries` Drizzle schema + model + service + API-side WARN+ERROR
   async sink + `app-log-purge` cron job registered in the manifest.
4. **Phase 4** — Admin list endpoint + admin UI page under Operaciones del sistema.
5. **Phase 5** — Docs guide + spec/task index closeout.

### Out of scope (state explicitly)

- **File writes** — Docker/Coolify stdout retention is the persistence layer. The
  `SAVE: boolean` config field and its `// TODO` stub remain as-is (dead config, not
  removed to avoid breaking the API surface, but explicitly not wired up here).
- **Full INFO/DEBUG persistence** — Only WARN + ERROR are written to `app_log_entries`
  to guard against volume/bloat.
- **Audit-log query** — Domain-specific audit logs with user/resource context belong to
  SPEC-162. Do not conflate.
- **Loki+Grafana integration** — Noted as a PHASE-2 future option in the guide. NOT
  implemented in this spec.
- **Changing existing log formatting** — `pretty` output is the default and identical
  to today's behavior. Only `json` is new.

---

## 4. Functional specification

### 4.1 Phase 1 — LOG_FORMAT pretty|json toggle

Add a `FORMAT` field to `BaseLoggerConfig`:

```typescript
/** Output format: 'pretty' = chalk-colored (default), 'json' = NDJSON for aggregators */
FORMAT: 'pretty' | 'json';
```

Default: `'pretty'`. Reads from `LOG_FORMAT` env var (added to `getConfigFromEnv`).

When `FORMAT='json'`, `formatLogArgs` emits a single NDJSON object string:

```json
{"ts":"2026-06-02T14:23:01.123Z","level":"WARN","category":"API","label":"optional","message":"...","data":{...}}
```

- No chalk, no emoji, no color escape codes.
- Sensitive keys are still redacted (formatter's redaction logic applies before
  serialization).
- `data` field contains the logged value if it is an object; string values go into
  `message` directly.

When `FORMAT='pretty'` (default), behavior is IDENTICAL to today.

**Env registry entry** (in `packages/config/src/env-registry.*.ts`):

```
name: LOG_FORMAT
type: string
required: false
secret: false
defaultValue: 'pretty'
exampleValue: 'json'
apps: ['api']
category: 'logging'
description: 'Logger output format. pretty = chalk-colored terminal output (default). json = NDJSON for aggregators/Coolify log search.'
```

### 4.2 Phase 2 — registerSinkHook

**CRITICAL: Coordinate with SPEC-180 before finalizing the API surface.** See §2.1.

Proposed shared hook API in `packages/logger/src/hooks.ts`:

```typescript
export type LogEntry = {
  readonly ts: string;         // ISO-8601
  readonly level: LogLevelType;
  readonly category?: string;
  readonly label?: string;
  readonly message: string;
  readonly data?: unknown;     // already redacted
};

export type LogHookFn = (entry: LogEntry) => void | Promise<void>;

/** Registry keyed by hook name. Both capture (SPEC-180) and sink (SPEC-184) register here. */
const hookRegistry = new Map<string, LogHookFn>();

export function registerHook(name: string, fn: LogHookFn): void { ... }
export function unregisterHook(name: string): void { ... }  // for testing
export function dispatchHooks(entry: LogEntry): void { ... } // fire-and-forget, swallows errors
```

`logWithLevel` calls `dispatchHooks(entry)` AFTER console output. Hook errors are caught
and logged to stderr (never bubble).

The SPEC-180 `registerCaptureHook` becomes `registerHook('sentry-capture', fn)`.
This spec's `registerSinkHook` becomes `registerHook('db-sink', fn)` registered at
API startup in `apps/api/src/index.ts`.

### 4.3 Phase 3 — DB persistence

**Table: `app_log_entries`** (style: `cron_runs` from SPEC-161)

```typescript
export const appLogEntries = pgTable(
  'app_log_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Log level: only 'warn' | 'error' are persisted */
    level: varchar('level', { length: 10 }).notNull(),
    /** Category key (e.g. 'API', 'BILLING', 'AUTH') — nullable */
    category: varchar('category', { length: 50 }),
    /** Optional label from the log call */
    label: text('label'),
    /** Log message (string value or object stringified) — max 2000 chars */
    message: text('message').notNull(),
    /** Redacted structured data (already sanitized by logger formatter) */
    data: jsonb('data').$type<Record<string, unknown>>(),
    /** When the log entry was emitted */
    loggedAt: timestamp('logged_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    /** "Browse by level + time" + purge by age */
    appLogEntries_level_logged_idx: index('appLogEntries_level_logged_idx').on(
      table.level, table.loggedAt.desc()
    ),
    /** "Browse by category + time" */
    appLogEntries_category_logged_idx: index('appLogEntries_category_logged_idx').on(
      table.category, table.loggedAt.desc()
    )
  })
);
```

**Append-only design:** No soft-delete. Rows hard-deleted by `app-log-purge` only.

**Sink registration** in `apps/api/src/index.ts` (at startup, after DB init):

```typescript
registerHook('db-sink', async (entry) => {
  if (entry.level !== 'WARN' && entry.level !== 'ERROR') return;
  // fire-and-forget: never await, never throw to caller
  appLogEntryModel.insert({ ... entry }).catch(() => {/* swallow */});
});
```

**Volume guard:** Only WARN + ERROR are written. INFO/DEBUG/LOG are never persisted.
This is a hard rule enforced at the sink level (not at the hook dispatch level).

**`app-log-purge` job** (style: `cron-run-purge`):

```
name: 'app-log-purge'
displayName: 'Purgar entradas de log'
category: 'system'
schedule: '0 5 * * *'  // Daily at 5:00 UTC (after cron-run-purge at 4:00)
description: 'Purge app_log_entries older than 30 days (WARN/ERROR only).'
```

Retention: 30 days (both WARN and ERROR — uniform, simple). Owner may revise.

**Note on `drizzle-kit push` gotcha:** Per project convention (ADR-017), `drizzle-kit push`
does NOT cover updated_at triggers or JSONB CHECK constraints. If the `data` field needs
a CHECK constraint, document the `apply-postgres-extras.sh` step. The `app_log_entries`
table as designed above does NOT require extras (no updated_at trigger, no CHECK on jsonb
needed). No extras step needed.

### 4.4 Phase 4 — Admin query

**Endpoint:** `GET /api/v1/admin/logs`

Pattern: `createAdminListRoute` (never `limit`; always `page`+`pageSize`).
Permission: `PermissionEnum.SYSTEM_MAINTENANCE_MODE` (same as cron admin routes).

Query params: `level`, `category`, `fromDate`, `toDate`, `page`, `pageSize`.

Response envelope: `{ success: true, data: { items: AppLogEntry[], total, page, pageSize } }`.

**Admin UI page:** TanStack Table, co-located under Plataforma → Operaciones del sistema
(same tab group as the cron observability page from SPEC-161). Permission gate:
`SYSTEM_MAINTENANCE_MODE`. Columns: timestamp, level badge, category, label, message
(truncated + expand). Filter controls: level select, category text, date range.

---

## 5. Acceptance criteria (BDD)

### Phase 1

```gherkin
Scenario: LOG_FORMAT=json emits NDJSON to stdout
  Given the API starts with LOG_FORMAT=json
  When the API logs a WARN with an object payload
  Then stdout contains a valid JSON line with fields ts/level/category/message/data
  And the output contains no chalk escape codes

Scenario: LOG_FORMAT defaults to pretty (backward compatible)
  Given the API starts without LOG_FORMAT set
  When a log is emitted
  Then the output is identical to current chalk-colored format
  And no behavioral change occurs for existing deployments

Scenario: sensitive data is redacted in json format too
  Given LOG_FORMAT=json
  When a WARN is logged with { password: 'secret', userId: '123' }
  Then the json output shows password as '[REDACTED]'
  And userId is preserved as '123'
```

### Phase 2

```gherkin
Scenario: registerHook dispatches to registered hooks
  Given a hook named 'test-sink' is registered with registerHook
  When logWithLevel emits a WARN entry
  Then the hook receives a LogEntry with the correct ts/level/message

Scenario: hook errors do not crash the logger
  Given a hook that throws an error is registered
  When logWithLevel emits any entry
  Then the logger output is unaffected
  And the hook error is swallowed (logged to stderr only)

Scenario: SPEC-180 capture hook coexists with SPEC-184 sink hook
  Given both 'sentry-capture' and 'db-sink' hooks are registered
  When logWithLevel emits an ERROR entry
  Then both hooks receive the LogEntry
  And neither hook sees the other's registration
```

### Phase 3

```gherkin
Scenario: WARN and ERROR entries are persisted to app_log_entries
  Given the db-sink hook is registered at startup
  When the API logs a WARN or ERROR during request handling
  Then a row appears in app_log_entries within 1 second
  And the row carries the correct level/category/message/data/loggedAt

Scenario: INFO and DEBUG entries are NOT persisted
  Given the db-sink hook is registered
  When the API logs an INFO or DEBUG entry
  Then no row is written to app_log_entries

Scenario: sink write failure does not affect request handling
  Given the database is temporarily unavailable
  When the API logs a WARN during a request
  Then the request completes successfully
  And no 500 error is returned due to the failed sink write

Scenario: app-log-purge deletes entries older than 30 days
  Given app_log_entries contains rows older than 30 days
  When app-log-purge runs (scheduled or manual trigger)
  Then all rows older than 30 days are hard-deleted
  And rows within the 30-day window are untouched
```

### Phase 4

```gherkin
Scenario: admin can query log entries with level filter
  Given the admin user has SYSTEM_MAINTENANCE_MODE permission
  And app_log_entries contains WARN and ERROR rows
  When GET /api/v1/admin/logs?level=error&page=1&pageSize=20 is called
  Then the response contains only ERROR-level entries
  And total reflects only ERROR rows

Scenario: admin log page renders in Plataforma → Operaciones
  Given the admin user is authenticated with SYSTEM_MAINTENANCE_MODE
  When they navigate to the Plataforma → Operaciones del sistema page
  Then the Log Viewer tab is visible alongside Cron Jobs
  And the TanStack Table renders log rows with level/category/message columns

Scenario: non-admin cannot access log endpoint
  Given a user without SYSTEM_MAINTENANCE_MODE permission
  When GET /api/v1/admin/logs is called
  Then the response is 403 Forbidden
```

---

## 6. Out-of-scope reminders (explicit)

| Item | Decision | Rationale |
|------|----------|-----------|
| File writes | OUT OF SCOPE | Anti-pattern in Docker/Coolify; stdout → Coolify is the persistence layer |
| INFO/DEBUG persistence | OUT OF SCOPE | Volume guard — only WARN+ERROR in DB |
| Audit-log query | OUT OF SCOPE | Belongs to SPEC-162 |
| Loki+Grafana | OUT OF SCOPE (phase-2 note only) | Self-hosted, future option, free; not implemented here |
| Changing `SAVE: boolean` config | OUT OF SCOPE | Keep dead config as-is; do not remove (API surface stability) |

---

## 7. Cross-spec dependencies

| Spec | Relationship |
|------|-------------|
| **SPEC-180** (Sentry, in-progress) | COORDINATION REQUIRED: share the hook-registry mechanism in `@repo/logger`. Whichever lands first builds the generic `registerHook` API; the other extends it. |
| **SPEC-162** (audit-log query, draft) | BOUNDARY: SPEC-184 is for general app logs (WARN/ERROR). SPEC-162 is for domain audit logs. Do NOT conflate. |
| **SPEC-161** (cron_runs, shipped) | PRECEDENT: use the same append-only table + purge + service-core + manifest patterns. |

---

## 8. Open questions — ALL RESOLVED

| # | Question | Resolution |
|---|----------|-----------|
| Q1 | File persistence or stdout? | Stdout → Coolify. File writes are OUT OF SCOPE. Owner approved. |
| Q2 | Which levels to persist? | WARN + ERROR only. Volume guard. Owner approved. |
| Q3 | Log retention in DB? | 30 days (uniform). Owner may revise before T-010 starts. |
| Q4 | Loki integration? | Phase-2 note only. NOT in this spec. Owner approved. |
| Q5 | Hook coordination with SPEC-180? | Same hook registry. Whichever lands first builds it. Owner aware. |
| Q6 | Admin page location? | Co-locate with cron observability (Plataforma → Operaciones del sistema). Owner approved. |
| Q7 | Permission for admin log endpoint? | `SYSTEM_MAINTENANCE_MODE` (same as cron admin). Owner approved. |
