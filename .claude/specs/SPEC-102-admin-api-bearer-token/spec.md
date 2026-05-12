---
spec-id: SPEC-102
title: Admin API Bearer Token Authentication
type: feature
complexity: medium
status: draft
created: 2026-05-11T00:30:00Z
effort_estimate_hours: 12-20
tags: [api, security, auth, admin, ops, hops, vps]
---

# SPEC-102: Admin API Bearer Token Authentication

## Part 1 -- Functional Specification

---

### 1. Overview & Goals

**Goal:** Add a bearer-token authentication path to the Hospeda admin API
(`/api/v1/admin/*`) as an alternative to the current Better Auth session
cookie. The token is scoped to a synthetic operator identity with
`SUPER_ADMIN` permissions, rotated on a fixed cadence, and consumed
exclusively by operational tooling (today `hops cron-list` and
`hops cron-trigger`; tomorrow CI healthchecks, manual smoke jobs, etc.).

**Motivation:**

- The current hops Phase 17.2 tanda 4 implementation (`cron-list` /
  `cron-trigger`) requires the operator to paste a Better Auth session
  cookie value into `HOPS_ADMIN_COOKIE`. The cookie expires every
  7-30 days, at which point hops returns 401 and the operator has to
  open a browser, log into admin, copy the cookie value, and refresh
  the env var. Acceptable for one-off ops, friction-heavy for anything
  that runs unattended.
- The pattern doesn't compose: any future automation (CI smoke, daily
  cron-triggered health checks, GitHub Action that posts to a Slack
  with cron status) would inherit the same expiry problem.
- The bearer-token alternative was identified during the tanda 4 design
  discussion as Option C; deferred there to keep tanda 4 scope tight
  and avoid touching security-sensitive auth code under time pressure.

**Success Metrics:**

- `hops cron-list` and `hops cron-trigger` work with a long-lived token
  set once in `.env.local` and never refreshed until rotation day.
- The token cannot be used to access user-data endpoints
  (`/api/v1/protected/*`, `/api/v1/public/*` etc.) -- by design, scope
  is **admin-only**.
- Token revocation works: deleting the env var on the API side causes
  every consumer to fail with 401 within one request cycle.
- Existing session-cookie auth continues to work unchanged for the
  admin UI users.

**Target Users:**

- The Hospeda ops operator (currently a single person) running hops on
  the VPS and from CI.
- Future automation (CI workflows, monitoring scripts) that needs to
  read or trigger admin endpoints without going through the admin UI.

---

### 2. Out of Scope

| Excluded Item | Rationale |
|---|---|
| Multiple tokens per identity / multi-tenant scope | One operator today; revisit when adding a second ops role. |
| Per-permission token scoping (e.g. "read-only" token) | All admin tools currently need SUPER_ADMIN equivalent. Per-permission scopes can be added later without breaking the simple case. |
| OAuth2 client_credentials flow | Heavyweight for a single internal client; revisit if Hospeda exposes a public API. |
| Token storage in DB (one-row-per-token) | Single token in env is sufficient; DB-backed tokens add audit benefits but also a revocation path that env-var already provides. |
| Automatic rotation cron | Manual rotation is fine until we have more than one operator. Document the procedure and run it quarterly. |
| Token usage analytics (per-call attribution) | Existing structured logs already include actor metadata; nothing else needed. |
| Replacing the session-cookie path in the admin UI | Out of scope -- the admin UI keeps using Better Auth as-is. |
| Replacing `HOPS_ADMIN_COOKIE` retroactively in old smoke logs | Forward-only; the cookie pattern stays usable for one-off / pre-token operators. |

---

### 3. User Stories & Acceptance Criteria

#### US-01 -- Operator authenticates hops with a long-lived token

**As** the Hospeda VPS operator,
**I want** to set a bearer token once in `scripts/server-tools/.env.local`,
**So that** hops cron commands keep working for months without me having
to refresh a cookie value from browser DevTools.

**AC-01.1 -- hops sends Bearer header when HOPS_ADMIN_API_TOKEN is set**
- Given `HOPS_ADMIN_API_TOKEN=<token>` is set in `.env.local`,
- When `hops cron-list` or `hops cron-trigger` runs,
- Then the request includes `Authorization: Bearer <token>`,
- And no `Cookie:` header is sent (token takes precedence).

**AC-01.2 -- hops falls back to cookie when token is missing**
- Given `HOPS_ADMIN_API_TOKEN` is empty / unset,
- And `HOPS_ADMIN_COOKIE` is set,
- When a cron command runs,
- Then the request includes the cookie header (existing behavior).
- This keeps the operator unblocked during migration.

**AC-01.3 -- hops fails clearly when neither is set**
- Given both env vars are unset,
- When a cron command runs,
- Then hops dies with a message naming both vars and pointing at
  `.env.local.example`.

#### US-02 -- API accepts bearer token on admin routes

**As** the Hospeda API,
**I want** to accept a bearer token as an alternative to the session
cookie on `/api/v1/admin/*` routes,
**So that** operational tooling can authenticate without a browser
session.

**AC-02.1 -- Valid token grants SUPER_ADMIN actor**
- Given `HOSPEDA_ADMIN_API_TOKEN` is configured on the API,
- When a request to any `/api/v1/admin/*` endpoint includes
  `Authorization: Bearer <token>` with the matching value,
- Then `actorMiddleware` synthesizes an actor with:
  - `id`: the well-known operator-token UUID
    `00000000-0000-4000-8000-000000000002`
  - `role`: `RoleEnum.SUPER_ADMIN`
  - `permissions`: all values of `PermissionEnum`
- And downstream `adminAuthMiddleware` and per-route permission checks
  pass.

**AC-02.2 -- Invalid token returns 401**
- Given a request with `Authorization: Bearer wrong-value`,
- When it hits any admin route,
- Then the API returns 401 with an `ApiError` envelope (code:
  `UNAUTHORIZED`, message: human-readable but non-revealing -- do NOT
  disclose whether the token format was valid).

**AC-02.3 -- Missing token falls through to cookie auth**
- Given a request with no `Authorization` header,
- And a valid `Cookie:` with a Better Auth session,
- Then auth resolves via the existing cookie path.

**AC-02.4 -- Token cannot be used on non-admin routes**
- Given a valid bearer token in the header,
- When the request targets a route OUTSIDE `/api/v1/admin/*`
  (e.g. `/api/v1/protected/users/me`),
- Then the token is ignored. The middleware does NOT synthesize the
  operator actor for non-admin paths.
- Rationale: the operator token has SUPER_ADMIN perms and we want zero
  risk of leaking it into user-facing flows even if a route is
  misclassified.

**AC-02.5 -- Token is not logged**
- Given any request with `Authorization: Bearer <token>`,
- Then the structured logger never includes the token value in any log
  record (audit, debug, error, or otherwise).
- The actor metadata on log records uses the operator UUID and role,
  not the token.

**AC-02.6 -- Token disabled when env var is empty**
- Given `HOSPEDA_ADMIN_API_TOKEN` is unset or empty on the API,
- Then ANY request with `Authorization: Bearer ...` is treated as if
  the header wasn't there (falls through to cookie auth).
- This makes "rotate by deleting the env var" the supported revocation
  path.

#### US-03 -- Operator rotates the token without downtime

**As** the operator,
**I want** to rotate the bearer token quarterly without breaking running
hops invocations,
**So that** rotation is a routine ops task with no scheduled downtime.

**AC-03.1 -- Rotation procedure**
- Documented in `docs/migration/vps-deployment-spec.md` as a numbered
  procedure:
  1. Generate a new token (`openssl rand -hex 32` or equivalent).
  2. Add the new value to Coolify env vars on the API app
     (`HOSPEDA_ADMIN_API_TOKEN`).
  3. `hops redeploy api` to pick it up.
  4. Update `.env.local` on the VPS with the new token.
  5. Smoke `hops cron-list`.
- Procedure does NOT require taking the API offline.

---

### 4. UX & DevX Considerations

- `.env.local.example` documents BOTH env vars side by side
  (`HOPS_ADMIN_API_TOKEN` and `HOPS_ADMIN_COOKIE`), explains that
  token takes precedence, and recommends token as the default once
  this spec ships.
- The hops error message when 401 is returned mentions BOTH paths
  ("refresh the cookie OR check that the token is still active on the
  API side") so the operator knows where to look.
- The new env var on the API side (`HOSPEDA_ADMIN_API_TOKEN`) is
  registered in `packages/config/src/env-registry.*.ts` with
  `secret: true` and `apps: ['api']`. `pnpm env:check` validates it
  exists in prod.

---

### 5. Risks & Open Questions

**Risk 1 -- Token leaks via accidental log of header**
- Mitigation: AC-02.5 explicitly forbids logging. Add a unit test that
  asserts the auth middleware never calls `apiLogger.*` with a string
  containing the configured token.

**Risk 2 -- Operator commits .env.local with token**
- Mitigation: `.env.local` is already gitignored. The installer (`hops
  update`) does not touch this file. Document the risk in
  `.env.local.example`.

**Risk 3 -- Token used on non-admin routes via path confusion**
- Mitigation: AC-02.4 requires path-prefix check in middleware. Test
  with crafted requests to `/api/v1/protected/...`, `/api/v1/public/...`,
  and other tiers.

**Risk 4 -- Operator UUID collides with a real user**
- Mitigation: The well-known UUID `00000000-0000-4000-8000-000000000002`
  is reserved (sibling of the existing guest and system UUIDs). Verify
  no row exists with that ID before merging.

**Open Q -- Hashing**
- Should `HOSPEDA_ADMIN_API_TOKEN` be compared in constant time (e.g.
  `crypto.timingSafeEqual`) to defeat timing attacks?
- Recommendation: YES. Cost is trivial and matches the auth-code
  convention.

**Open Q -- Multiple tokens during rotation**
- The simplest rotation procedure (single env var) means there is a
  brief window where the old token still exists in `.env.local` and
  the new one is already on the API. The old token fails fast (401)
  on the next request and the operator updates.
- Alternative: support `HOSPEDA_ADMIN_API_TOKEN_PREVIOUS` for a
  graceful overlap. This adds complexity for a workflow that the
  single operator can handle by sequencing the rotation steps.
- Recommendation: single token now, revisit if a second operator joins.

---

## Part 2 -- Technical Design

---

### 6. Architecture

**API side** (`apps/api/src/`):

- New env var `HOSPEDA_ADMIN_API_TOKEN` (string, optional, secret).
  Registered in `packages/config/src/env-registry.*.ts` with
  `apps: ['api']`.
- `actorMiddleware` (in `src/middlewares/actor.ts`) gets a new path
  BEFORE the existing user-from-context logic:
  1. If the request path matches `/api/v1/admin/...`,
  2. And `Authorization: Bearer <value>` is present,
  3. And `HOSPEDA_ADMIN_API_TOKEN` is set and non-empty on the server,
  4. And the value matches in constant time,
  5. Then synthesize the operator actor and `c.set('actor', actor)`,
     skip the user lookup, and `await next()`.
- The existing `adminAuthMiddleware` does NOT change. It sees an actor
  with the right permissions and lets the request through.

**hops side** (`scripts/server-tools/`):

- `src/lib/api-client.ts` `createHospedaApiClient` prefers
  `HOPS_ADMIN_API_TOKEN` and emits `Authorization: Bearer`. If empty,
  falls back to `HOPS_ADMIN_COOKIE` and emits `Cookie:`.
- 401 error messages mention both paths.

**Permissions inheritance:**

The synthetic operator actor has `permissions = Object.values(PermissionEnum)`,
matching how the existing SUPER_ADMIN role is granted in
`actorMiddleware` lines 132-138. This means new permissions added later
are automatically picked up.

### 7. Code Changes

| File | Change |
|---|---|
| `apps/api/src/middlewares/actor.ts` | Add bearer-token path (see above). Insert BEFORE the existing user-or-guest branch at line 124. |
| `apps/api/src/utils/env.ts` | Add `HOSPEDA_ADMIN_API_TOKEN: z.string().optional()` to `ApiEnvBaseSchema`. |
| `packages/config/src/env-registry.api.ts` | Register the new env var with full metadata. |
| `apps/api/.env.example` | Document the var with a safe placeholder. |
| `apps/api/test/middlewares/actor.test.ts` | New test cases for AC-02.1 .. AC-02.6. |
| `scripts/server-tools/src/lib/api-client.ts` | Prefer token over cookie; document both. |
| `scripts/server-tools/.env.local.example` | Add `HOPS_ADMIN_API_TOKEN` above `HOPS_ADMIN_COOKIE`, note precedence. |
| `docs/migration/vps-deployment-spec.md` | Add rotation procedure. |
| `apps/api/docs/route-architecture.md` | Note the bearer-token alternative on admin routes. |

### 8. Testing Strategy

Unit tests in `apps/api/test/middlewares/actor.test.ts`:

1. Valid token on `/api/v1/admin/foo` → synthesized actor with SUPER_ADMIN role.
2. Valid token on `/api/v1/protected/foo` → token ignored, cookie path taken.
3. Invalid token on admin route → 401 (via downstream `adminAuthMiddleware`).
4. Missing token + valid cookie on admin route → cookie path, existing behavior.
5. Empty env var + valid token in header → 401 (env-var-empty disables the path).
6. Token in log records → assert never present.
7. Timing-safe comparison → assert `crypto.timingSafeEqual` is used (not `===`).

Integration smoke (manual, post-deploy):

These smokes are **the deferred validation for Phase 17.2 tanda 4** (commits `1aefb6b7f` + `33174ad78`, `chore/vps-migration` branch). When tanda 4 shipped, the cookie-based path was the only auth mechanism available and required browser-derived `HOPS_ADMIN_COOKIE`. Rather than smoke testing with a workflow that this spec is about to retire, validation was deferred until the bearer-token path lands. **Marking SPEC-102 as done requires running these four smokes successfully against prod.**

1. With token set, `hops cron-list` returns the job table (revalidation, addon-lifecycle, etc.).
2. With token set, `hops cron-trigger revalidation --dry-run` and `hops cron-trigger 1 --dry-run --yes` both run and return success without executing the job.
3. Unset token on API side via Coolify env-delete, redeploy, `hops cron-list` returns 401 with the actionable message (mentions both `HOPS_ADMIN_API_TOKEN` and `HOPS_ADMIN_COOKIE` paths).
4. Restore token, smoke again, table returns.

After all four pass: update `docs/migration/vps-deployment-spec.md` Phase 17.2 tanda 4 entry to mark smoke DONE and reference SPEC-102 as the closure.

### 9. Performance

- One additional string comparison per request when the header is
  present. Negligible (< 1 µs).
- No DB call for the synthetic actor path (skips the role-permissions
  lookup that the user-from-cookie path does).

### 10. Security Review Checklist

Before merging:

- [ ] `crypto.timingSafeEqual` (not `===`) used for token comparison.
- [ ] Token never appears in logs (grep test in CI).
- [ ] Path-prefix check is on the actual request path, not a header
      that the client could spoof.
- [ ] Empty env var disables the token path entirely (no
      "empty-string token" exploit).
- [ ] Token length >= 32 bytes (256 bits of entropy). Document
      generation as `openssl rand -hex 32` in the rotation procedure.
- [ ] Coolify env var is marked `secret: true` so it does not appear
      in `hops env-list` without `--reveal`.
- [ ] Audit log records still get the operator UUID + role so the
      audit trail attributes admin actions to "operator token" rather
      than "anonymous".

### 11. Migration & Rollout

1. Land the API change behind a default-disabled state (env var unset
   → token path inert).
2. Generate the token, populate Coolify env var on prod API.
3. Redeploy API.
4. Smoke from VPS with hops + token set in `.env.local`.
5. Document in `docs/migration/vps-deployment-spec.md` rotation
   procedure.
6. Mark the existing `HOPS_ADMIN_COOKIE` path as "legacy / fallback"
   in the docs but keep it working indefinitely.

---

## Part 3 -- Cross-References

- Original design discussion: 2026-05-11 conversation thread, hops
  Phase 17.2 tanda 4 design (Option A vs C decision).
- Engram topic for the deferred hardening: `vps-migration/backup-hardening-deferred`
  (sibling deferred-decision pattern).
- Engram topic for the toolkit state: `vps-migration/phase-17.2-hops-checkpoint`.
- Adjacent specs touching admin auth: SPEC-035 (env-var validation policy),
  SPEC-026-GAPS (security testing), SPEC-042-GAPS (CSP).
