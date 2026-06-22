---
spec-id: SPEC-264
title: Frictionless dev/test user setup
type: improvement
complexity: medium
status: draft
created: 2026-06-22
---

# SPEC-264 — Frictionless dev/test user setup

## 1. Overview

### Goal

Make local-dev and testing users **immediately usable after seeding** — no need to
complete profile, dismiss the welcome tour or what's-new modal, or change a password
before they can be authenticated and exercised in the app.

### Motivation

Today the 13 dev test users created by `pnpm db:seed:test-users` (and any user created
by hand) hit onboarding friction on first login:

- The **"complete your profile"** gate redirects them on every protected web route.
- The **"welcome" tour** auto-fires in the admin panel for HOST users.
- The **what's-new** modal may surface unseen highlights.

This forces a manual click-through ritual before every testing session. The friction
is pure noise for QA/dev work that is not about onboarding itself.

### Key constraint (drives the whole design)

An investigation confirmed that **every friction gate is data-driven** — each one is
decided by reading a column (or JSONB sub-key) on the `users` row. None are hardcoded
or behind a non-DB switch. Therefore the seed can make a user "ready" purely by
**writing the correct domain state**, with **zero conditional code in `apps/*`**.

| Friction | Gate mechanism | Field | "Done" value | Source |
|---|---|---|---|---|
| Welcome tour (admin) | DB JSONB | `settings.onboarding.adminTours["host.welcome"]` | `>= tour.version` | `apps/admin/src/hooks/use-admin-tour-state.ts`; catalog `apps/admin/src/config/ia/tours.ts` (currently `1`) |
| What's New (admin) | DB JSONB | `settings.onboarding.whatsNew.baselineAt` | set to "now" (all current entries pre-baseline = seen) | `apps/admin/src/hooks/use-whats-new.ts` |
| Complete profile (web) | DB bool | `profile_completed` | `true` | `apps/web/src/middleware.ts:244`; `packages/db/src/schemas/user/user.dbschema.ts:120` |
| Forced pw change (commerce) | DB bool | `must_change_password` | `false` (already default) | `apps/api/src/middlewares/must-change-password.ts` |
| Forced pw change (admin legacy) | DB JSONB | `admin_info.passwordChangeRequired` | absent/`false` (already default) | `apps/admin/src/lib/auth-session.ts:123` |
| Set-password prompt (OAuth) | DB bool | `set_password_prompted` | n/a — test users have a credential account, gate skipped | `apps/web/src/middleware.ts:257` |

### Success criteria

- SC-1: After `pnpm db:fresh-dev`, logging in as any of the 13 `*.local.test` users on
  the **web app** does NOT redirect to `completar-perfil`.
- SC-2: Logging into the **admin panel** as a HOST test user does NOT auto-fire the
  `host.welcome` tour.
- SC-3: The admin **what's-new** modal does not auto-surface as unseen for those users
  (all entries published before seed time are treated as seen).
- SC-4: Running `pnpm db:seed:ready-user <email>` against a manually created user makes
  that user pass SC-1..SC-3 too.
- SC-5: No file under `apps/*` is modified. The change is contained to `packages/seed`
  and the two `package.json` wiring entries.
- SC-6: Running the helper on a user that already has `settings` does NOT discard any
  existing settings keys (read-modify-write, not replace).

## 2. User Stories & Acceptance Criteria

### US-1 — Seeded test users are ready out of the box

> As a developer running `pnpm db:fresh-dev`, I want the 13 test users to be ready to
> use immediately, so I don't have to click through onboarding before testing.

- **AC-1.1** — Given the seed has run, When I query a test user, Then
  `profile_completed = true`.
- **AC-1.2** — Given the seed has run, When I query a test user, Then
  `settings.onboarding.adminTours["host.welcome"]` is set to the ready sentinel
  (a large integer that satisfies the `>= version` gate regardless of future bumps).
- **AC-1.3** — Given the seed has run, When I query a test user, Then
  `settings.onboarding.whatsNew.baselineAt` is a valid ISO datetime at/after seed time.
- **AC-1.4** — Given the seed has run, When I query a test user, Then
  `must_change_password = false` and `admin_info.passwordChangeRequired` is not truthy.

### US-2 — Ready-up any user on demand

> As a developer who created a user by hand, I want a one-shot command to make that
> user ready, so I don't have to re-run the full seed.

- **AC-2.1** — Given a user exists with email `X`, When I run
  `pnpm db:seed:ready-user X`, Then that user's row satisfies AC-1.1..AC-1.4.
- **AC-2.2** — Given no user exists with email `X`, When I run the command, Then it
  exits non-zero with a clear "user not found: X" message and changes nothing.
- **AC-2.3** — Given the email arg is missing, When I run the command, Then it exits
  non-zero with a usage message.

### US-3 — Non-destructive merge

> As a maintainer, I want the helper to preserve any pre-existing user settings, so it
> never silently wipes onboarding state or other settings keys.

- **AC-3.1** — Given a user whose `settings` already contains
  `onboarding.adminTours["other.tour"] = 1` and a top-level `settings.theme`, When the
  helper runs, Then both `other.tour` and `theme` are still present afterward, alongside
  the newly written `host.welcome` and `whatsNew.baselineAt`.
- **AC-3.2** — Given a user whose `settings` is `null`, When the helper runs, Then a
  valid settings object is created from scratch with only the onboarding namespace.

## 3. Technical Approach

All work lives in `packages/seed`. **No `apps/*` changes.**

### 3.1 The `markUserReady` helper (canonical source of truth)

New file: `packages/seed/src/test-users/markUserReady.ts` (colocated with the existing
`testUsers.seed.ts`).

```ts
import type { User } from '@repo/schemas';

/**
 * Ready sentinel for admin tours. The welcome-tour gate compares
 * `stored >= tours['host.welcome'].version` (see apps/admin/src/config/ia/tours.ts).
 * Writing a large sentinel marks the tour permanently seen regardless of future
 * version bumps, so this dev/test helper never goes stale. This is intentionally NOT
 * the "real" prod version — it is a fixture convenience.
 */
export const TOUR_READY_SENTINEL = 9999;

/** Minimal port so the helper is unit-testable without a live DB. */
export type UserReadyModelPort = {
    findOne(filter: Record<string, unknown>): Promise<User | null>;
    update(where: Record<string, unknown>, data: Partial<User>): Promise<User | null>;
};

export type MarkUserReadyParams = {
    /** Lookup key — email is the stable handle for the ad-hoc CLI. */
    email: string;
    model: UserReadyModelPort;
};

export type MarkUserReadyResult =
    | { ok: true; userId: string }
    | { ok: false; reason: 'not_found' };

/**
 * Make a user "ready" for local dev / testing by writing the real domain state the
 * onboarding gates read: profile completed, welcome tour seen, what's-new baselined,
 * and forced-password-change cleared. Read-modify-write: preserves any existing
 * settings keys. `settings` is NOT a mergeable JSONB column on UserModel, so the merge
 * MUST be done here (mirrors UserService.markAdminTourSeen).
 */
export async function markUserReady(
    params: MarkUserReadyParams
): Promise<MarkUserReadyResult> { /* ... */ }
```

Merge logic (calqued from `UserService.markAdminTourSeen`,
`packages/service-core/src/services/user/user.service.ts:1304-1358`):

```ts
const existing = await model.findOne({ email });
if (!existing) return { ok: false, reason: 'not_found' };

const currentSettings = (existing.settings as Record<string, unknown>) ?? {};
const currentOnboarding = (currentSettings.onboarding as Record<string, unknown>) ?? {};
const currentAdminTours = (currentOnboarding.adminTours as Record<string, number>) ?? {};
const currentWhatsNew = (currentOnboarding.whatsNew as Record<string, unknown>) ?? {};

const mergedSettings = {
    ...currentSettings,
    onboarding: {
        ...currentOnboarding,
        adminTours: { ...currentAdminTours, 'host.welcome': TOUR_READY_SENTINEL },
        whatsNew: {
            ...currentWhatsNew,
            baselineAt: currentWhatsNew.baselineAt ?? new Date().toISOString()
        }
    }
};

await model.update(
    { id: existing.id },
    {
        profileCompleted: true,
        mustChangePassword: false,
        settings: mergedSettings
    } as Partial<User>
);
return { ok: true, userId: existing.id };
```

Notes for the implementer:

- `whatsNew.baselineAt` uses `?? new Date().toISOString()` so an existing baseline is
  preserved (idempotent re-runs don't move the baseline forward).
- Do NOT touch `admin_info.passwordChangeRequired` — it is absent by default for these
  users and only relevant to the superadmin path; writing it would be out of scope.
- Validate the resulting `settings` against `UserSettingsSchema`
  (`packages/schemas/src/entities/user/user.settings.schema.ts`) in the test, to catch
  shape drift.

### 3.2 Wire into the test-user seed

In `packages/seed/src/test-users/testUsers.seed.ts`, after each user is created (the
`userModel.create(...)` at ~line 542, and the `userModel.update({ id }, ...)` role path
at ~line 531), call `markUserReady({ email: spec.email, model: userModel })`. Prefer a
single call per user at the end of the create/update branch so both the
freshly-created and the already-existing paths converge on "ready".

### 3.3 Ad-hoc CLI script

New standalone file: `packages/seed/scripts/mark-user-ready.ts` (mirrors
`packages/seed/scripts/reset-superadmin-password.ts`): load `.env.local`, init the DB,
read `process.argv[2]` as the email, instantiate `UserModel`, call `markUserReady`,
print a clear result, and `process.exit(code)` accordingly.

Wiring:

- `packages/seed/package.json`:
  `"seed:ready-user": "tsx --tsconfig ./tsconfig.json ./scripts/mark-user-ready.ts"`
- root `package.json`:
  `"db:seed:ready-user": "pnpm --filter @repo/seed seed:ready-user"`

Usage: `pnpm db:seed:ready-user host-basico@local.test`

### 3.4 Tests

New file: `packages/seed/test/test-users/markUserReady.test.ts`, following the
port-injection + in-memory stub pattern of
`packages/seed/test/required/systemUser.seed.test.ts`:

- writes the three ready fields (AC-1.1..AC-1.3) + clears pw change (AC-1.4)
- preserves pre-existing settings keys (AC-3.1) and handles `settings = null` (AC-3.2)
- returns `not_found` for a missing email (AC-2.2)
- idempotent: a second run keeps the same `baselineAt`
- the produced `settings` object parses cleanly against `UserSettingsSchema`

### Key files

| File | Change |
|---|---|
| `packages/seed/src/test-users/markUserReady.ts` | NEW — helper + sentinel + port |
| `packages/seed/src/test-users/testUsers.seed.ts` | wire helper into the 13 users |
| `packages/seed/scripts/mark-user-ready.ts` | NEW — ad-hoc CLI |
| `packages/seed/package.json` | add `seed:ready-user` script |
| `package.json` (root) | add `db:seed:ready-user` script |
| `packages/seed/test/test-users/markUserReady.test.ts` | NEW — unit tests |

### Dependencies

None new. Uses `@repo/db` (`UserModel`), `@repo/schemas` (`User`, `UserSettingsSchema`),
`tsx` (already used by all seed scripts).

## 4. Risks

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| Sentinel `9999` is not the "real" prod tour version | Low — fixture only, never runs in prod | n/a | Documented in JSDoc; helper is dev/test-only, never imported by app code |
| `settings` plain-replace clobbers existing keys | High if mishandled | Low | Read-modify-write merge + AC-3.1 test asserting preservation |
| Tour catalog adds new `auto-first-visit` tours beyond `host.welcome` | Low — only welcome blocks first login; others are contextual | Low | Out of scope by decision; revisit if a new blocking tour appears |
| Seed can't import the tour catalog (app→package forbidden) | Low | n/a (known) | Sentinel approach sidesteps it entirely |
| `markUserReady` accidentally shipped/called in a prod seed path | Medium | Very low | Only wired into `testUsers.seed` (dev-only) + the explicit ad-hoc script |

## 5. Tasks (Suggested)

### Setup

- T-001: Add `markUserReady` helper skeleton (port type, sentinel constant, signature, JSDoc).

### Core

- T-002: Implement the read-modify-write merge in `markUserReady` (settings + profile + pw).

### Testing

- T-003: Unit tests for `markUserReady` (AC-1.x, AC-2.2, AC-3.x, idempotency, schema parse).

### Integration

- T-004: Wire `markUserReady` into `testUsers.seed.ts` for the 13 users.
- T-005: Add `scripts/mark-user-ready.ts` ad-hoc CLI + `seed:ready-user` / `db:seed:ready-user` wiring.

### Docs

- T-006: Document the ready-user flow in `packages/seed/CLAUDE.md` (test-users section) and root command list.

### Cleanup / Verify

- T-007: Run `pnpm db:fresh-dev` and verify SC-1..SC-4 by login (web no profile redirect; admin no welcome tour).

## Internal Review Notes

- **Strengthened during review**: corrected the original assumption that the helper
  could read the tour version from the catalog — it cannot (`packages/seed` may not
  import `apps/admin`); resolved via the `TOUR_READY_SENTINEL` approach (owner-approved).
- **Strengthened**: made the merge non-destructive explicit (AC-3.x) after confirming
  `settings` is plain-replace on `UserModel.update` (no `mergeableJsonbColumns`).
- **Open questions**: none blocking. Scope of "which tours" resolved to `host.welcome`
  only (the sole auto-first-visit blocker).
- **External docs verified**: none — no external service involved.
