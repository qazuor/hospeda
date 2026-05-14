---
spec-id: SPEC-114
title: Forget-password endpoint returns 404 on staging
type: fix
complexity: small-medium
status: draft
created: 2026-05-14T04:15:00Z
effort_estimate_hours: 2-6
tags: [auth, better-auth, build, bug, pre-public-launch]
discovered_during: SPEC-103 T-017 forgot-password smoke (2026-05-14)
priority: high (forgot-password completely non-functional on staging, pre-public-launch blocker)
---

# SPEC-114: Forget-password endpoint missing

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Restore `POST /api/auth/forget-password` end-to-end so a user who forgot their password can receive a reset email and complete the reset flow. Currently the endpoint returns HTTP 404 on staging, blocking the entire forgot-password feature.

### 2. Symptom (observed 2026-05-14)

`curl -i -X POST https://staging-api.hospeda.com.ar/api/auth/forget-password -H "Content-Type: application/json" -d '{...}'`:

```
HTTP/2 404
content-type: text/plain; charset=UTF-8
content-length: 0
x-ratelimit-type: auth
ratelimit-limit: 50
ratelimit-remaining: 49
```

Notable: rate-limit middleware ran (header `x-ratelimit-type: auth` present), so the request reached the auth router. But the route did not match — Hono returned its default 404 (text/plain, length 0).

Frontend UI shows "Error de red. Por favor, intenta de nuevo." because the auth-client's `forgetPassword()` wraps the 404 in a generic error message.

### 3. Source-side evidence

- `apps/api/src/routes/auth/handler.ts:189` defines `app.post('/forget-password', ...)` as a lockout-protected handler that forwards to Better Auth.
- The catch-all `app.on(['GET','POST'], '/*', ...)` at line 471 should catch anything else.
- `apps/api/src/lib/auth.ts:202` has `emailAndPassword.enabled = true` and `sendResetPassword` defined at line 216, which should make Better Auth automatically register the `/forget-password` endpoint.
- `apps/api/src/lib/auth.ts:153` sets `basePath: '/api/auth'`.

So the source code is RIGHT. The fact that the deployed code returns 404 suggests EITHER:
1. The deployed staging-api build is stale (does not include the handler.ts route).
2. Better Auth's `auth.handler()` returns 404 because its internal routing doesn't recognize `/forget-password` (the spelling without 'o' might be wrong for the installed Better Auth version).
3. Some middleware between Hono and the route is intercepting.

### 4. Investigation Plan

#### Phase 0 — Confirm whether the deployed build has the handler

```bash
hops exec api --target=staging -- sh -c 'grep -c "forget-password" /repo/apps/api/dist/routes/auth/handler.js'
```

- If `>= 1`: the route IS in the build. Then it's Better Auth's internal handler returning 404. Move to Phase 1.
- If `0`: the build is stale. Move to Phase 2.

#### Phase 1 — Better Auth path inspection

Check what URL Better Auth actually exposes. Options:
- Read `node_modules/better-auth/...` for the `/forget-password` route or its actual name.
- Try alternate URLs via curl: `/forgot-password` (with 'o'), `/request-password-reset`, `/reset-password-request`.
- Check Better Auth release notes / changelog for endpoint renames.

If the URL is different in this version of Better Auth: update the frontend `auth-client.ts:89` to use the correct URL OR add a route alias in `handler.ts`.

#### Phase 2 — Stale build

If the staging-api container does NOT have the handler in its compiled dist:
- Verify the Coolify build pulled the latest staging branch (compare staging HEAD vs container build).
- Trigger a fresh build with `--no-cache` if Coolify offers it.
- Or `hops redeploy api --target=staging` after confirming the source code is on staging.

#### Phase 3 — Apply fix

Depending on root cause from Phase 1 or 2:
- (1a) Add a Hono route alias if Better Auth uses a different path.
- (1b) Update the frontend URL.
- (2) Force a clean rebuild.

#### Phase 4 — Smoke

- `curl -X POST .../api/auth/forget-password -d '{"email":"X"}'` should return 200 (Better Auth's standard "we sent an email if the address exists" response).
- Email is actually delivered (check Gmail).
- Reset link in email is the staging URL (test by clicking).
- Reset password form accepts the new password.
- Sign in with new password works.

---

### 5. Tasks

| Task | Title | Phase | Status |
|---|---|---|---|
| T-114-01 | Confirm dist build has the /forget-password handler | 0 | pending |
| T-114-02 | Phase 1: inspect Better Auth path (if Phase 0 confirms build is OK) | 1 | pending, blocked by 01 |
| T-114-03 | Phase 2: fresh rebuild (if Phase 0 reveals stale dist) | 2 | pending, blocked by 01 |
| T-114-04 | Apply fix based on findings | 3 | pending, blocked by 02 or 03 |
| T-114-05 | Smoke end-to-end forgot-password → reset → signin | 4 | pending, blocked by 04 |

---

### 6. Risks

| Risk | Mitigation |
|---|---|
| Reset-password endpoint may also be broken (not tested yet) | Phase 4 smoke covers reset endpoint too |
| Fix on staging exposes the same bug on prod | Hospeda prod web is still serving the landing (apps/landing/), not apps/web. Prod web is not yet user-facing. Acceptable to fix only after staging |
| Email delivery might be misconfigured separately | Phase 4 verifies delivery to Gmail inbox; if email fails, separate spec |

---

### 7. Acceptance Criteria

- [ ] POST `/api/auth/forget-password` returns 200 with valid body on staging
- [ ] Reset email arrives at Gmail inbox within 1-2 minutes
- [ ] Clicking the link lands on `/es/auth/reset-password/?token=XXX` on the staging hostname (not localhost)
- [ ] Reset password form accepts new password and redirects to signin
- [ ] Signin with the new password succeeds
- [ ] Forgot-password UI no longer shows "Error de red" for valid emails

---

## Part 2 — Implementation Notes

### Source

Discovered during SPEC-103 T-017 smoke (2026-05-14). The UI showed "Error de red" but curl confirmed the underlying response was HTTP 404. Source code in apps/api/src/routes/auth/handler.ts and apps/api/src/lib/auth.ts appears correct, so the root cause is either a build-deployment mismatch or a Better Auth version-specific path naming.

### Cross-spec dependencies

- SPEC-103 T-017 / T-018 (forgot + reset password smokes) — blocked by SPEC-114.
- SPEC-111 (Astro server islands) — unrelated, but both should be resolved before T-087 (web cutover at public launch).
