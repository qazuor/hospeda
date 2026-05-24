# SPEC-143 Staging Smoke — Execution Plan

Authored 2026-05-23. Tracks the orchestration of the full staging smoke for SPEC-143 across multiple sessions.

This doc is **operational** (how to drive the smoke through to completion). The companion `staging-smoke-checklist.md` is **prescriptive** (each section's pre-conditions and steps). Sign-offs go in the checklist; progress and findings go here.

## Workflow rule (the one rule)

Execute one block at a time. After each section inside a block:

- **Blocking finding** (user cannot complete the flow, data corruption, security gap with prod impact): STOP, file a fix task, fix it, then resume.
- **Non-blocking finding** (UX gap, missing feature, cosmetic bug): document in this file's "Findings" table + create follow-up task, KEEP GOING.

Goal at the end: zero blockers open, full table of non-blocker tickets to triage later.

## Current state — handoff snapshot (2026-05-23 22:00)

### Code/infra state

- SPEC-143 Finding #21 (annual polling) RESOLVED + validated end-to-end. PR #1234 merged to staging, deployed, smoke 1.3 confirmed.
- qzpay 1.10.0 / 1.9.0 / 2.1.0 published to npm and consumed.
- Staging API: `https://staging-api.hospeda.com.ar`, web: `https://staging.hospeda.com.ar`.
- DB schema includes `billing_subscription_polling_jobs.resource_type` (manually applied via ALTER after the deploy; task #17 follow-up tracks the `hops billing-test-reset` bug that surfaced during cleanup).

### Active test user

| Field | Value |
|-------|-------|
| Email (signup) | `qazuor+billtest-annual2@gmail.com` |
| User UUID | `9e3e8165-03d0-4162-94b5-e56c8c9d4014` |
| Customer UUID | `b8fe5a00-99f9-409e-aebe-354370f35b8a` |
| Sub UUID | `6579b293-9df4-4a11-ad90-9dffa78484e9` |
| Plan | `owner-basico` annual (1500 ARS) — status `active` |
| Linked MP buyer | `test_user_5529635850066455346@testuser.com` |
| Entitlements | 6 (PUBLISH_ACCOMMODATIONS, EDIT_ACCOMMODATION_INFO, VIEW_BASIC_STATS, RESPOND_REVIEWS, CAN_USE_CALENDAR, CAN_CONTACT_WHATSAPP_DISPLAY) |
| Limits | MAX_ACCOMMODATIONS=1, MAX_PHOTOS_PER_ACCOMMODATION=5, MAX_ACTIVE_PROMOTIONS=0 |
| Accommodations count | 1 (DRAFT `a404c854-15e7-4dcd-a477-c084646befa6` "house-test-alojamiento", created via host-onboarding/start during 1.15-A.1 attempt) |

### Sections already validated (implicit)

- **1.1 Annual checkout** — validated via smoke 1.3 (2026-05-23 21:29-21:30); sign-off in `staging-smoke-2026-05-21-findings.md` Finding #21.
- **1.2 Monthly checkout** — validated via smoke 1.2 (2026-05-23 14:33) from previous session.
- **1.3 Free plan signup** — implicit in every signup; no separate test required.
- **1.13 Annual activation** — covered by 1.1.
- **1.14 Entitlement load post-activation** — confirmed in 1.3 logs (`Loaded and cached entitlements: 6, Limits: 3`).

## Block plan

| Block | Sections | User state required | Est. time | Status |
|-------|----------|---------------------|-----------|--------|
| **1** | 1.15 (NEW) + 1.7 + 2.3 + 2.2 + 2.7 + 2.8 | Current user (annual active) | 2-3h | **In progress** — start at 1.15-A |
| **2** | 1.4 + 1.5 + 1.6 + 1.10 + 2.4 + 2.6 + 2.9 + 2.10 + replay 1.15 | New user, monthly cheap plan | 3-4h | Pending |
| **3** | 2.1 + replay 1.15 | New HOST user, trial | 1-2h | Pending |
| **4** | 1.8 + 1.9 + 1.11 + 1.12 | Webhook plumbing (less UI) | 1-2h | Pending |
| **5** | 2.5 + 3.1..3.9 | Mix; some need admin user | 3-4h | Pending |

## Findings tracker

### 🔴 Blockers (must fix before continuing the smoke)

| # | Section | Finding | Status | Owner | Notes |
|---|---------|---------|--------|-------|-------|
|   |         | (none yet) |        |       |       |

### 🟡 Non-blockers (document, ticket, continue)

| # | Section | Finding | Task # | Notes |
|---|---------|---------|--------|-------|
| 1 | (general) | UX post-pago: sub queda "gratuito" hasta refresh manual (window 30-90s) | #19 | Approach approved (Option B polling banner); next session work |
| 2 | (general) | `/mi-cuenta` shows plan_id UUID instead of plan name | #25 (older) | Pre-existing |
| 3 | (general) | MP preapproval shows plan slug lowercase, not localized | #26 (older) | Pre-existing |
| 4 | (general) | "Ver factura" button errors (AFIP deferred v2) | #27 (older) | Pre-existing |
| 5 | (general) | `hops db-seed` doesn't run `pnpm install` (stale schema) | #23 (older) | Pre-existing |
| 6 | (tooling) | `hops billing-test-reset` deletes from `billing_usage_records.customer_id` (column doesn't exist) | #17 | Workaround: manual SQL transaction; documented |
| 7 | (1.15 hypothesis) | Entitlement gate middlewares (`gateRichDescription`, `gateVideoEmbed`, `gateCalendarAccess`, `gateExternalCalendarSync`, `gateWhatsAppDisplay`, `gateWhatsAppDirect`, `gateReviewResponse`, `gateFavorites`) exist but NO route uses them → likely API-level enforcement gap; only UI gates protect premium features. **Section 1.15-C will confirm or refute.** | TBD | Engram `billing/entitlement-enforcement-gap-hypothesis` |
| 8 | 1.15-A.1 | `POST /api/v1/protected/host-onboarding/start` does NOT wire `enforceAccommodationLimit` middleware (only `POST /api/v1/protected/accommodations` and `/draft` do). Self-mitigated: onboarding's own handler returns `resumed` if user already has an active DRAFT, and `already_host` if user is already HOST/ADMIN/etc — so the bypass is bounded to +1 DRAFT over plan limit in narrow edge cases. Found while exercising 1.15-A.1: the UI uses the publicar→onboarding path, not the limit-enforced /accommodations create. Recommendation: either wire `enforceAccommodationLimit` on /host-onboarding/start too, OR explicitly document it as by-design and add a service-layer check. | TBD | Route: `apps/api/src/routes/host-onboarding/protected/start.ts` |
| 9 | 1.15-A.1 (collateral) | `GET /api/v1/admin/accommodations/:id` returns **500** when the accommodation's `description` is shorter than 30 chars. Root cause: response strip-with-schema validates against `AccommodationAdminSchema` which has `description.min(30)`, but `createForOnboarding` produces DRAFTs with shorter description (the onboarding form only collects name/city/type — the user reported typing a description in the form, so the gap is in client AND server validation, not data loss). Repro: GET the draft `a404c854-15e7-4dcd-a477-c084646befa6` → 500 with `zodError.accommodation.description.min` in logs. **Real impact for users**: a HOST cannot edit/complete their just-created draft from the admin panel — full onboarding flow blocked at the UI level. **Schema-mismatch is bilateral**: write side (createForOnboarding + UI form) accepts < 30 chars; read side (admin GET response) rejects them. **Fix**: align both — either relax the GET response schema to allow drafts with short description, OR enforce min(30) at both the UI form level and the create schema. | TBD | Logs show `[Response schema stripping failed] description: zodError.accommodation.description.min (too_small)` |
| 10 | 1.15-A.1 | LIMIT_REACHED response envelope shape inconsistent. The middleware threw `new HTTPException(403, { message: JSON.stringify({...LIMIT_REACHED payload...}) })` (was `apps/api/src/middlewares/limit-enforcement.ts:112-127`). The global route-factory error handler then wrapped this as `{ success: false, error: { code: 'FORBIDDEN', message: '<stringified JSON>' }, metadata: {...} }`. Clients had to JSON.parse `error.message` to access `limitKey`/`maxAllowed`/`upgradeUrl` — fragile and undiscoverable. **Fix landed in this PR**: added `LIMIT_REACHED` and `ENTITLEMENT_REQUIRED` to `ServiceErrorCode` enum + ERROR_CODE_TO_HTTP mapping (both → 403); refactored all 6 `enforce*Limit` middlewares in `limit-enforcement.ts` to throw `new ServiceError(LIMIT_REACHED, message, details)` instead — the global handler now surfaces `code`/`message`/`details` at the top level. **Same antipattern remains in** `apps/api/src/middlewares/tourist-entitlements.ts` (12 throw sites — ENTITLEMENT_REQUIRED + LIMIT_REACHED) and `apps/api/src/middlewares/accommodation-entitlements.ts` (9 sites — ENTITLEMENT_REQUIRED). Those middlewares are wired (tourist) or unwired (accommodation — see Finding #7); scope-controlled out of this PR for review surface but tracked as follow-up. | DONE for limit-enforcement; follow-up TBD for tourist/accommodation entitlements | Observed value before fix: `{ code: "FORBIDDEN", message: "{\\"success\\":false,\\"error\\":{\\"code\\":\\"LIMIT_REACHED\\",...}}" }`. Expected after fix: `{ code: "LIMIT_REACHED", message: <localized>, details: { limitKey, currentCount, maxAllowed, usagePercent, upgradeUrl } }` |
| 11 | 1.15-A.1 | `X-Usage-Warning` header NEVER fires for plans where `limit=1`. Logic in `limit-check.ts:85-104` returns threshold `exceeded` at 100%+, and the middleware only sets the header for `warning|critical` (80-99%). For integer counts with `limit=1`, no value lands in 80-99% (0% or 100%). The header is therefore unreachable on owner-basico (MAX_ACCOMMODATIONS=1, MAX_ACTIVE_PROMOTIONS=0). Validation deferred to Block 2 on a plan with `limit ≥ 5` (e.g., owner-pro MAX_PHOTOS=10 → 8th upload should set `threshold=warning`). The checklist's expectation that 1.15-A.1 surface this header on the LIMIT_REACHED 403 is incorrect — the header is by design only a pre-block warning. **Action**: correct the checklist 1.15-A.1 expected behavior to drop the `X-Usage-Warning` requirement on the 403; keep the header validation in 1.15-A.2 / Block 2 against a plan where 80-99% is integer-reachable. | TBD | No fix needed; design choice. Doc fix only. |

## Per-block procedures

### Block 1 — User actual (annual active)

Sections to execute, in order:

#### 1.15-A — Limits enforcement (start here)

**Pre-check (confirm clean slate)**:
```bash
ssh -p 2222 qazuor@216.238.103.219 "hops psql --target=staging -c \"SELECT count(*) AS accommodations FROM accommodations WHERE owner_id = '9e3e8165-03d0-4162-94b5-e56c8c9d4014' AND deleted_at IS NULL;\""
```

If count > 0: either (a) reset accommodations to 0 manually, or (b) adjust the limit test to start from the current count and expect block at (limit+1)-th.

**Step A.1 — MAX_ACCOMMODATIONS (limit=1)**:
1. User action: in browser at `https://staging.hospeda.com.ar` as signed-in test user, navigate to `/mi-cuenta/alojamientos/nuevo` (or wherever the create accommodation flow lives). Create 1st accommodation with minimal valid data. Capture the response status + body in dev tools.
2. **Expected**: 201 with the new accommodation id.
3. User action: navigate back to "new accommodation" page and try to create a 2nd.
4. **Expected**: 403 response. Body contains `code: 'LIMIT_REACHED'`, `details.limitKey === 'MAX_ACCOMMODATIONS'`, `details.maxAllowed === 1`, `details.upgradeUrl === '/billing/plans'`. Response header includes `X-Usage-Warning`.
5. UI should show an "upgrade your plan" prompt — capture screenshot.

**Step A.2 — MAX_PHOTOS_PER_ACCOMMODATION (limit=5)**:
1. On the accommodation created in A.1, upload 5 photos via the photos upload flow.
2. **Expected**: each upload returns 201.
3. Try to upload a 6th photo.
4. **Expected**: 403 with `details.limitKey === 'MAX_PHOTOS_PER_ACCOMMODATION'`, `details.maxAllowed === 5`.

**Step A.3 — MAX_ACTIVE_PROMOTIONS (limit=0)**:
1. Try to create any promotion via `POST /api/v1/protected/owner-promotions` (UI under "Promociones" or via curl using the cookie).
2. **Expected**: 403 with `details.limitKey === 'MAX_ACTIVE_PROMOTIONS'`, `details.maxAllowed === 0`.

#### 1.15-B — Entitlements POSITIVE

**Step B.1** — `VIEW_BASIC_STATS`: in dev tools, observe a GET to `/api/v1/protected/accommodations/:id/stats` (likely fired when visiting accommodation detail in the owner's dashboard). Expected: 200 with stats payload.

**Step B.2** — `RESPOND_REVIEWS`: this requires a review to exist. If none, skip and note "no review fixtures to test against"; otherwise hit the response endpoint and confirm 201.

**Step B.3** — `CAN_USE_CALENDAR`: navigate to the accommodation's calendar tab. Expected: calendar loads (200 from `/calendar` endpoint). If 403 with `requiredEntitlement: CAN_USE_CALENDAR` → entitlement enforcement IS wired (and over-blocking — owner-basico DOES include this). If 200 → gate not wired but plan correctly grants entitlement (expected for owner-basico).

#### 1.15-C — Entitlements NEGATIVE (the hypothesis test)

For each of these, the user crafts a request via UI or curl that the OWNER-BASICO plan does NOT include. Each should return 403 ENTITLEMENT_REQUIRED. If 2xx → **gap confirmed**, add to Findings table as non-blocker (unless security-critical, then blocker).

**Step C.1** — `CAN_USE_RICH_DESCRIPTION`:
```bash
curl -X PATCH 'https://staging-api.hospeda.com.ar/api/v1/protected/accommodations/<ACCOMMODATION_ID>' \
  -H 'Cookie: <session-cookie>' \
  -H 'Content-Type: application/json' \
  -d '{"description": "# Heading\n**bold text**\n- list item"}'
```
Expected: 403 ENTITLEMENT_REQUIRED. Document actual.

**Step C.2** — `CAN_EMBED_VIDEO`:
```bash
curl -X PATCH 'https://staging-api.hospeda.com.ar/api/v1/protected/accommodations/<ACCOMMODATION_ID>' \
  -H 'Cookie: <session-cookie>' \
  -H 'Content-Type: application/json' \
  -d '{"videoEmbedUrl": "https://youtube.com/watch?v=test"}'
```

**Step C.3** — `CAN_SYNC_EXTERNAL_CALENDAR`: try to POST a sync request to `/calendar/sync` endpoint. Document the actual response.

**Step C.4** — `CAN_CONTACT_WHATSAPP_DIRECT`: try the direct-chat action (inspect UI to find endpoint).

**Step C.5** — `FEATURED_LISTING`: try the "feature this accommodation" action if exposed.

**Step C.6** — `VIEW_ADVANCED_STATS`: try the advanced stats endpoint if exposed.

**Findings to expect**: probably most of C.1-C.6 return 2xx (gap), confirming engram `billing/entitlement-enforcement-gap-hypothesis`. Document each one.

#### 1.15-D — Plan change reflection

DEFER to Block 2 or to a separate session — requires upgrading owner-basico → owner-pro which is a real charge.

#### 1.15-E — Cache behavior

**Step E.1** — Hit `/api/v1/public/auth/me` twice in a row from the browser (or curl with cookie). Tail API logs:
```bash
ssh -p 2222 qazuor@216.238.103.219 "hops logs api --target=staging --follow"
```
First call: `Loaded and cached entitlements for customer ...`. Second call within 5min: no Load log, cache hit.

**Step E.2** — Force invalidation via admin endpoint:
```bash
curl -X POST 'https://staging-api.hospeda.com.ar/api/v1/admin/billing/cache/clear' \
  -H 'Cookie: <admin-session>' \
  -H 'Content-Type: application/json' \
  -d '{"customerId": "b8fe5a00-99f9-409e-aebe-354370f35b8a"}'
```
(Requires admin user; may skip if not available now and revisit in Block 5.)

#### 1.7 — Addon purchase

(Procedure to expand when starting; see checklist 1.7 for base steps.)

#### 2.3 — Subscription pause/resume

(Procedure to expand when starting.)

#### 2.2 — Subscription cancel

(Procedure to expand when starting.)

#### 2.7 — Refund flow

(Procedure to expand when starting; may need a paid invoice first.)

#### 2.8 — Dispute / chargeback flow

(Procedure to expand when starting; MP sandbox may not support real disputes.)

### Block 2-5: detailed procedures

Will be expanded when each block starts. The checklist sections are the source of truth for steps; this doc tracks order, user-state setup, and per-step deviations.

## How to record findings during execution

1. After every section, fill the **Run log** at the bottom of the checklist section (date, executor, PR, result, notes).
2. If finding found:
   - **Blocking**: add row to "🔴 Blockers" table above. STOP. File fix task. Resume only after fix is merged + verified.
   - **Non-blocking**: add row to "🟡 Non-blockers" table. Create a task. Reference task number. KEEP GOING.
3. At end of block: update Block plan table status from "In progress" → "Done" with date.
4. Commit the doc changes + the checklist run-log changes together with a `docs(billing): SPEC-143 smoke Block N progress` commit.

## End-of-smoke definition of done

- All 5 blocks status `Done` in the Block plan table.
- 🔴 Blockers table empty.
- 🟡 Non-blockers table has tickets for every finding (none lost).
- Every section in `staging-smoke-checklist.md` has a Run log entry.
- Final commit: `docs(billing): SPEC-143 staging smoke complete`.
- Engram pin: `spec-143/staging-smoke-complete-2026-XX-XX`.
