# SPEC-162 — Tech Analysis (storage model + implementation plan)

> Status: implementation. This document fixes the storage decision the draft
> spec left open, mirroring the SPEC-184 (`app_log_entries`) pattern as
> pre-authorized.

## 1. Problem

`apps/api/src/utils/audit-logger.ts` + the `AuditEventType` enum already emit a
discriminated union of audit/security events, but **logger-only**: they go to the
AUDIT logger category and to Sentry breadcrumbs. Nothing is persisted, so there
is no way to query "recent admin actions" or "recent security events" from the
admin panel. SPEC-155 wants two SUPER-only widgets (Card H) that read these back.

## 2. Decision — single table with a `logType` discriminator

We mirror SPEC-184, which persists `app_log_entries` via a fire-and-forget logger
sink and exposes one admin list endpoint. The natural shape here is **one
queryable table `audit_log_entries`** with a `logType` discriminator
(`'audit' | 'security'`), surfaced by **two** admin endpoints gated by **two**
distinct permissions:

| Endpoint | Permission | Filter |
| --- | --- | --- |
| `GET /api/v1/admin/audit-logs` | `AUDIT_LOG_VIEW` | `logType = 'audit'` |
| `GET /api/v1/admin/security-logs` | `SECURITY_LOG_VIEW` | `logType = 'security'` |

Why one table, not two:

- The two event families share an identical column shape (who/what/when/target).
  Two tables would duplicate the entire model/schema/service/route/UI stack for
  no schema benefit.
- SPEC-184 already validated the single-table + discriminator approach
  (`app_log_entries.level` is the analogous discriminator).
- The `logType` is **injected by the route**, never read from the client query.
  A SUPER_ADMIN holding only `AUDIT_LOG_VIEW` therefore cannot reach security
  rows by tampering with a query param — each route hardcodes its `logType` and
  the service enforces the matching permission.

### Event → logType classification

Derived in `audit-logger.ts` from `AuditEventType`:

- **security**: `AUTH_LOGIN_FAILED`, `AUTH_LOGIN_SUCCESS`, `AUTH_LOCKOUT`,
  `AUTH_PASSWORD_CHANGED`, `ACCESS_DENIED`, `SESSION_SIGNOUT`.
- **audit**: `BILLING_MUTATION`, `PERMISSION_CHANGE`, `USER_ADMIN_MUTATION`,
  `ROUTE_MUTATION`.

`severity` (`'info' | 'critical'`) is derived from the existing
`CRITICAL_AUDIT_EVENTS` set — it is the analog of `app_log_entries.level` and
powers the "nivel" filter the spec asks for.

## 3. Persistence path (decoupled, fire-and-forget)

`audit-logger.ts` must NOT import `@repo/db` / `@repo/service-core` (it is a leaf
util and that would invert the dependency graph + complicate unit testing).
Instead it exposes a **dependency-injected persister**:

```
registerAuditLogPersister(fn)   // set once at API startup
auditLog(entry) -> persister?.(record)   // fire-and-forget, never throws
```

`apps/api/src/lib/audit-log-sink.ts` wires the persister to
`AuditLogEntryService.recordEntry()` (mirrors `app-log-sink.ts`: lazy service,
`.catch()` with a throttled stderr report, model `createQuiet` so a failed insert
never re-enters logging). `registerAuditLogPersistence()` is called once in
`apps/api/src/index.ts` after DB init, next to `registerAppLogDbSink()`.

The scrubbing already done by `auditLog()` (sensitive-field redaction) is reused —
the full scrubbed entry is stored in the `data` jsonb column; flat columns
(`actorId`, `ip`, `eventType`, ...) are extracted for indexing/filtering.

## 4. Permissions

- `AUDIT_LOG_VIEW` (`'auditLog.view'`) already exists in `PermissionEnum`
  (pre-added in anticipation of this spec). It was assigned to both SUPER_ADMIN
  and ADMIN in `rolePermissions.seed.ts`, but **no endpoint ever consumed it**,
  so it granted nothing. Per the spec ("SUPER_ADMIN-only"), this implementation
  removes it from the ADMIN block — no live behavior changes because the surface
  did not exist.
- `SECURITY_LOG_VIEW` (`'securityLog.view'`) is **new**, added to `PermissionEnum`
  and granted to SUPER_ADMIN only.

## 5. Table shape (`audit_log_entries`)

Append-only (no `deletedAt`, no `updatedAt`), no FK on `actorId` (logs survive
user deletion, purge cron stays decoupled). Hard-delete only via a future purge.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `defaultRandom()` |
| `log_type` | varchar(10) NOT NULL | `'audit'` or `'security'` |
| `event_type` | varchar(50) NOT NULL | the `AuditEventType` value |
| `severity` | varchar(10) NOT NULL | `'info'` or `'critical'` |
| `actor_id` | uuid | nullable, no FK |
| `actor_role` | varchar(50) | nullable |
| `target_id` | varchar(255) | nullable (target user / resource id) |
| `ip` | varchar(64) | nullable |
| `method` | varchar(10) | nullable |
| `path` | text | nullable |
| `status_code` | integer | nullable |
| `message` | text NOT NULL | human summary |
| `data` | jsonb | full scrubbed entry |
| `logged_at` | timestamptz NOT NULL | event time |
| `created_at` | timestamptz NOT NULL | `defaultNow()` |

Indexes: `(log_type, logged_at desc)`, `(event_type, logged_at desc)`,
`(actor_id, logged_at desc)`.

Carril: **structural** (`pnpm db:generate` + `pnpm db:migrate`). No triggers /
materialized views / CHECK constraints → no extras-carril file needed.

## 6. Layer-by-layer file map

- **DB**: `packages/db/src/schemas/audit-log/audit_log_entry.dbschema.ts` (+ barrel),
  `packages/db/src/models/audit-log/auditLogEntry.model.ts` (+ barrel),
  migration `packages/db/src/migrations/00NN_*.sql`.
- **Schemas**: `packages/schemas/src/entities/auditLogEntry/{schema,crud.schema,query.schema,index}.ts`,
  `PermissionEnum.SECURITY_LOG_VIEW`.
- **Service**: `packages/service-core/src/services/auditLog/{auditLogEntry.service,auditLog.permissions,index}.ts`.
- **API**: `audit-logger.ts` persister injection, `lib/audit-log-sink.ts`,
  `routes/audit-logs/{list-audit,list-security,index}.ts`, registration in
  `routes/index.ts`, startup wire in `index.ts`.
- **Seed**: `packages/seed/src/required/rolePermissions.seed.ts`.
- **Admin UI**: `apps/admin/src/features/audit-logs/*` (shared config factory →
  audit + security configs), routes `_authed/platform/ops/{audit-logs,security-logs}.tsx`,
  sidebar entries, i18n keys.
- **Docs**: `docs/billing/endpoint-gate-matrix.md` rows (SPEC-145 guard).

## 7. Out of scope (per spec)

Tamper-proof/append-only guarantees beyond soft-delete absence, SIEM export, and
a retention purge cron (the table is append-only; a purge job can be a later
hardening — `app_log_entries` shipped its purge separately too).
