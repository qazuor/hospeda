---
specId: SPEC-303
title: Inactive User Cleanup
type: feat
complexity: medium
status: draft
created: 2026-06-27
tags: [users, data-retention, cron, notifications, gdpr, auth]
---

# SPEC-303 — Inactive User Cleanup

> Identify users with no activity for a configurable period, warn them by email
> before acting, then clean them up. **Discovery must happen first:** the platform
> currently lacks a reliable last-activity timestamp on the `users` table, making
> the inactivity window impossible to compute without a schema addition or a
> session-proxy query strategy. Goals remain provisional until that gap is resolved
> and the owner agrees on the retention policy and final action.

## 1. Summary

Owner request (verbatim): *"Limpieza de usuarios sin actividad durante XX tiempo,
con mail de confirmación previo."*

Translated intent: a scheduled process that (1) identifies users with no meaningful
activity for a configurable window, (2) emails them a warning / reactivation link
in advance, and (3) performs a cleanup action (TBD: soft-disable, anonymize, or
hard-delete) on users who do not respond within the grace period.

This spec is **discovery-first**. The implementation cannot proceed until the
activity-signal gap is resolved (OQ-1), the retention window and cleanup action
are agreed (OQ-2, OQ-3), and the legal / GDPR angle for the AR market is reviewed
(OQ-6). All technical design in sections 5–6 is provisional scaffolding to frame
those decisions.

## 2. Current state / Key files

### 2.1 Activity signals that exist today

Investigation found **no `lastLoginAt` column on the `users` table**
(`packages/db/src/schemas/user/user.dbschema.ts`). The columns available as
potential activity proxies are:

| Signal | Location | Reliability |
|--------|----------|-------------|
| `users.updatedAt` | `user.dbschema.ts` | **Weak** — bumped on any profile change, not login. |
| `users.createdAt` | `user.dbschema.ts` | Baseline only; useless for returning users. |
| `session.createdAt` | `session.dbschema.ts` (Better Auth) | **Better proxy** — a new row means a new login. |
| `session.updatedAt` | `session.dbschema.ts` | Updated by Better Auth on session refresh. |
| `user_auth_identities.lastLoginAt` | `user_identity.dbschema.ts` | **Deprecated** (Clerk legacy table). |

**The session proxy approach** (query `MAX(session.createdAt) WHERE userId = X`) can
approximate last login today without a schema change, but carries risk: Better Auth
may purge or expire sessions (no explicit cleanup cron found in
`apps/api/src/cron/jobs/`), so absence of a session row does not definitively mean
"never logged in since N days" for old accounts. This risk must be assessed in
tech-analysis (OQ-1).

### 2.2 Soft-delete / lifecycle infrastructure

`users.deletedAt` (soft delete) and `users.lifecycleState` (`LifecycleStatusEnum`:
`DRAFT | ACTIVE | INACTIVE | ARCHIVED`, defined in
`packages/schemas/src/enums/lifecycle-state.enum.ts`) already exist. Setting
`lifecycleState = INACTIVE` and `deletedAt` are the two available soft-action
primitives — no new column needed for the cleanup action itself, depending on
the chosen strategy (OQ-3).

### 2.3 Cron pattern to follow

All scheduled jobs live in `apps/api/src/cron/jobs/` and implement
`CronJobDefinition` (see `trial-expiry.ts` and `addon-expiry.job.ts` as direct
references). The contract: `handler: async (ctx) => ...` where `ctx` carries
`{ logger, startedAt, dryRun }`, returning `{ success, message, processed, errors,
durationMs }`. Dry-run mode is a first-class concern in every existing job.

### 2.4 Email / notification infrastructure

Warning emails go through `packages/notifications` (`NotificationService` in
`src/services/notification.service.ts`). Templates live under
`src/templates/<domain>/` (e.g., `subscription/`, `trial/`). A new `user/`
subdirectory with a `user-inactivity-warning.tsx` template would follow the
established pattern. The API helper is `sendNotification` (imported from
`apps/api/src/utils/notification-helper.ts`).

### 2.5 Referential integrity surface

Users have many inbound FK dependencies: `accommodations`, `billing_subscriptions`,
`billing_customers`, `user_bookmarks`, `user_bookmark_collections`, `sessions`
(CASCADE), `conversation` participants, `posts`, `events`, `tags`, etc. Hard-delete
cascades are destructive at scale. The project's default is **soft-delete**
(`deletedAt`), which `BaseCrudService.list()` already filters out.

## 3. Goals (provisional)

- **G-1** Establish a reliable last-activity signal per user (either a
  schema-addition `lastLoginAt` column updated by a Better Auth hook/event, or a
  validated session-proxy query strategy). **Prerequisite for everything else.**
- **G-2** A configurable inactivity window (`HOSPEDA_USER_INACTIVE_DAYS`, default
  TBD — owner decision OQ-2).
- **G-3** A warning email sent to inactive users ahead of cleanup, using
  `packages/notifications` and a new `user-inactivity-warning` template.
- **G-4** A grace period after the warning during which a login reactivates the
  user automatically (no cleanup performed).
- **G-5** A scheduled cron job (`inactive-user-cleanup.job.ts`) that runs the full
  identify → warn → act pipeline, with dry-run mode.
- **G-6** A configurable final action (OQ-3): soft-disable (`lifecycleState =
  INACTIVE` + optional `deletedAt`) or anonymize PII fields.
- **G-7** Exclusion rules: skip users with an active billing subscription, any
  owned accommodation, or staff roles (ADMIN / SUPER_ADMIN / EDITOR).
- **G-8** Audit log entry per user acted upon (consistent with the audit pattern
  from `app_log_entries`).

## 4. Non-Goals

- **Not** hard-deleting users in v1 — referential integrity and data-recovery risk
  make this a separate, explicitly-scoped decision (OQ-3).
- **Not** a self-serve "delete my account" flow (that is GDPR art. 17, a different
  spec).
- **Not** cleaning up other inactive entities (accommodations, posts) in this spec.
- **Not** real-time inactivity detection — cron-based batch processing only.
- **Not** UI for configuring the inactivity window in the admin panel (env var is
  sufficient for v1).

## 5. Provisional technical design

### 5.1 Phase 0 — Activity signal (prerequisite)

Two options (owner + tech-analysis decides, OQ-1):

**Option A — Add `lastLoginAt` column to `users`.**
Structural migration (`db:generate` + `db:migrate`). Better Auth emits a
`session.create` event or a plugin hook that updates `users.lastLoginAt`. Clean,
queryable, indexed. Cost: requires Better Auth hook integration and a one-time
backfill from `MAX(session.createdAt)` per user.

**Option B — Session-proxy query.**
No schema change. Inactivity query: `WHERE NOT EXISTS (SELECT 1 FROM session s
WHERE s.user_id = u.id AND s.created_at > now() - interval '${days} days')`.
Risk: sessions that expired and were cleaned up would make users look inactive even
if they recently logged in. Viability depends on whether Better Auth's session TTL
exceeds the inactivity window. Must be validated in tech-analysis.

### 5.2 Pipeline (two-pass cron design)

**Pass 1 — Warn** (runs daily, e.g., `0 3 * * *`):
Identify users inactive for `(INACTIVE_DAYS - WARNING_LEAD_DAYS)` who have not yet
received a warning. Send the warning email. Record `inactivity_warned_at` on the
user row (new column, or via `adminInfo` JSONB — OQ-5).

**Pass 2 — Act** (runs daily after pass 1):
Identify users who received a warning > `WARNING_LEAD_DAYS` ago AND whose
last-activity signal is still beyond `INACTIVE_DAYS` (i.e., they did not log in).
Apply the configured cleanup action (OQ-3). Log to `app_log_entries`.

Both passes can live in a single `CronJobDefinition` handler with two sequential
stages, or as two separate job definitions sharing a helper service.

### 5.3 Reactivation guard

Any login (Better Auth `session.create`) for a warned user clears the warning
state. Implementation: check `inactivity_warned_at` in a session-created hook and
reset it to `NULL`. Or: Pass 2 simply rechecks the activity signal — if the user
logged in, the signal is recent, and they are not in the "act" candidate set.

### 5.4 Cron registration

New entry in `apps/api/src/cron/jobs/inactive-user-cleanup.job.ts`, registered in
`apps/api/src/cron/jobs/index.ts`, following the `CronJobDefinition` contract.
Controlled by `HOSPEDA_USER_INACTIVE_CLEANUP_ENABLED` env var (default `false` —
opt-in for safety).

## 6. Risks

- **R-1 (primary) — No reliable last-activity signal today.** The session-proxy
  approach may silently misclassify active users if sessions are shorter-lived than
  the inactivity window. Option A (schema column) is safer but requires a Better
  Auth integration point that is not yet mapped. OQ-1 must be resolved first.
- **R-2 — False positives on cleanup.** A user who logged in but triggered no
  session record (e.g., a cached token) would be incorrectly flagged. The warning
  email + grace period is the safety net; hard-delete is explicitly out of scope
  for v1 precisely because of this risk.
- **R-3 — Referential integrity on soft-disable.** Setting `lifecycleState =
  INACTIVE` hides the user from public reads (BaseCrudService filters) but
  `billing_subscriptions`, `accommodations`, and other owned entities remain.
  Concurrent billing events on a "disabled" user need a defined behavior.
- **R-4 — Legal / GDPR risk.** Argentina's LPDP (Law 25.326) and GDPR-aligned
  practices require a clear retention policy, data-subject notification, and the
  right to object. Cleanup without a privacy-reviewed policy is a legal liability.
  OQ-6 must be answered before any prod rollout.
- **R-5 — Staff and paid users caught by the cron.** The exclusion rules (G-7)
  must be watertight. A Super Admin or an active subscriber must never be
  soft-disabled by this job.

## 7. First Steps / Discovery Plan

Phase 0 (before any code):

1. **Audit Better Auth session lifecycle** — does Better Auth have an event/plugin
   hook that fires on session creation? Is there an existing session-cleanup cron
   or TTL that would invalidate the session-proxy approach? Find the answer in
   Better Auth docs and the auth config in `packages/auth-ui/`.
2. **Owner decision on OQ-1** — session-proxy vs. adding `lastLoginAt`.
3. **Owner decision on OQ-2** — inactivity window (default days).
4. **Owner decision on OQ-3** — cleanup action (soft-disable vs. anonymize).
5. **Legal review gate (OQ-6)** — confirm with the operator that the retention
   window and cleanup action comply with LPDP / their privacy policy before
   implementing Pass 2.

Only after these five checkpoints is tech-analysis and task decomposition warranted.

## 8. Open Questions

- **OQ-1** — Activity signal: add `lastLoginAt` to `users` (schema migration +
  Better Auth hook) or use a session-proxy query? Is the session-proxy reliable
  given Better Auth's session TTL? **Blocks all implementation.**
- **OQ-2** — Inactivity window: what is `XX`? Suggested default: 365 days (1 year)
  for tourist users, 180 days for unverified / never-logged-in registrations.
  **Owner decision.**
- **OQ-3** — Final cleanup action: (a) set `lifecycleState = INACTIVE` (reversible,
  no data loss); (b) anonymize PII fields (email → hash, name → null) while keeping
  the row for FK integrity; (c) hard-delete (destructive, cascades). Option (a) is
  the lowest-risk starting point. **Owner decision + legal review.**
- **OQ-4** — Warning email cadence: a single warning at T-30 days before deadline?
  Or a sequence (T-30, T-7, T-1)? A single warning is simpler for v1.
- **OQ-5** — Storage for the `inactivity_warned_at` state: new column (cleanest,
  requires migration) vs. `users.adminInfo` JSONB field (no migration, but less
  queryable). Preference for new column, but owner may prefer JSONB to avoid
  another migration.
- **OQ-6** — Legal / AR LPDP compliance: does the operator's privacy policy permit
  automated deletion / anonymization? Is the warning email sufficient notice under
  LPDP art. 14? This is a hard gate before Pass 2 is deployed to production.
- **OQ-7** — Exclusion scope: beyond active subscribers + staff (G-7), should users
  with any accommodation (even DRAFT/INACTIVE) be excluded? What about users who
  registered via OAuth but never completed their profile (SPEC-113
  `profileCompleted = false`)?
- **OQ-8** — Reactivation after cleanup: if a user was soft-disabled, can they
  log in and trigger auto-reactivation? Or does re-activation require an admin
  action?

## 9. Revision History

- 2026-06-27 — Initial draft (allocated SPEC-303). Discovery-first framing.
  Core blocker identified: no `lastLoginAt` on the `users` table. Eight open
  questions (OQ-1..8) require owner + legal decisions before implementation.
  Goals and technical design are provisional scaffolding pending OQ-1 resolution.
