# E2E Nightly Failure Audit — 2026-05-13

_Generated as part of SPEC-105 T-105-01 (Phase 0: audit past nightly failures)._

---

## Summary

All 11 nightly E2E runs (2026-05-02 → 2026-05-12) failed with the **same two root causes**. The test suite itself **never executed** — everything was blocked at the build step. This is the best-case scenario from the spec's probability table (~20% — trivial infra drift, not schema drift).

| Run date | Run ID | Failure | Tests ran? |
|---|---|---|---|
| 2026-05-12 | 25712940274 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-11 | 25650170598 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-10 | 25619635234 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-09 | 25591267360 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-08 | 25536002466 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-07 | 25475714739 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-06 | 25416079555 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-05 | 25357150977 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-04 | 25300727419 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-03 | 25269629218 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-02 | 25243325955 | Build (hospeda-admin) + CI scripts | No |

---

## Root Cause 1 — Wrong Turbo filter: `hospeda-admin` (INFRA DRIFT)

**Error message:**

```
x No package found with name 'hospeda-admin' in workspace
```

**Step:** `Build apps`

**Cause:** The admin app package was renamed from `hospeda-admin` to `admin` (see `apps/admin/package.json`). The workflow still referenced the old name via `--filter=hospeda-admin`.

**Status at staging HEAD (b90adbf5a):** Already fixed — the current `e2e-nightly.yml` now uses `--filter=admin`. The fix landed in staging _after_ the cron was disabled on 2026-05-12, so it never ran.

**Fix applied in:** Already in `main`/`staging` as of branch cut. No action needed for this root cause.

---

## Root Cause 2 — Wrong CI script paths: `scripts/ci/` prefix (INFRA DRIFT)

**Error messages:**

```
bash: scripts/ci/check-raw-ilike.sh: No such file or directory
Process completed with exit code 127.
```

**Step:** `Run CI scripts (raw-ilike + SEO + sitemap)`

**Cause:** The scripts were reorganized. The `scripts/ci/` subdirectory no longer exists; scripts were moved/renamed to the root `scripts/` dir:

| Workflow (stale) | Actual path | Status |
|---|---|---|
| `scripts/ci/check-raw-ilike.sh` | `scripts/check-unsafe-ilike.sh` | Renamed |
| `scripts/ci/seo-validator.ts` | `scripts/seo-validator.ts` | Moved |
| `scripts/ci/sitemap-validator.ts` | `scripts/sitemap-validator.ts` | Moved |

Reference: `ci.yml` line 188 uses `bash scripts/check-unsafe-ilike.sh` — that confirms the correct path.

**Status:** NOT yet fixed in `e2e-nightly.yml`. This is the remaining blocker.

**Fix needed:** Update the `Run CI scripts` step in `.github/workflows/e2e-nightly.yml`.

---

## Findings: no credential drift, no schema/API drift detected

- All secrets (`HOSPEDA_BETTER_AUTH_SECRET`, `HOSPEDA_MERCADO_PAGO_*`, `HOSPEDA_CLOUDINARY_*`) were present in the job env (masked by Actions — not empty). No credential expiry evidence.
- `apps/e2e/.env.e2e` — port assignments and URLs look correct; no drift detected.
- Package names `hospeda-api`, `hospeda-web`, `hospeda-e2e` unchanged — only `admin` was renamed.
- The test suite was never reached, so schema/API drift in test assertions is **unknown** and must be verified in Phase 1 (T-105-02 — local repro).

---

## Fixes applied — T-105-05 (infra drift)

1. Fix `.github/workflows/e2e-nightly.yml` — CI scripts step paths (Root Cause 2). ✅ Commit 5b0515350.

---

## Phase 1 drift analysis — T-105-02 (2026-06-25)

Static drift analysis via Explore subagent revealed 4 schema/API drifts in test assertions.
All 4 fixed in this branch (see T-105-04 section below).

Commerce @p0 selectors (`.mc-list__name`, `.mc-list__edit`, `#ce-menuUrl`, `#ce-richDescription`,
`.gastro-contact__menu-btn`, `.exp-info__body`) validated against current web components — all present.

`host-07e` cron endpoint drift (removed VPS migration endpoint `/api/v1/cron/...`) is guarded by
`test.fixme` — will not block the nightly run but remains deferred technical debt.

---

## Schema/API drift fixes — T-105-04 (2026-06-25)

### DRIFT-2 — `apps/e2e/fixtures/api-helpers.ts` `createConversation()`

**Issue:** INSERT used non-existent columns `guest_user_id` and `host_user_id`. The `conversations`
table has `user_id` (nullable FK for authenticated guest) and derives the host from
`accommodations.owner_id`. Status `'ACTIVE'` is not a valid enum value; correct value is `'OPEN'`.

**Fix:** Removed `hostUserId` option, changed SQL to `user_id`, status to `'OPEN'`.

### DRIFT-3 — `apps/e2e/tests/messaging/msg-01-conversation.spec.ts:96`

**Issue:** Host inbox checked via `GET /api/v1/protected/conversations` (guest inbox, filtered by
`user_id` = actor.id). A host querying this returns an empty list. Host inbox is at
`/api/v1/protected/conversations/owner`. Also: response type was `{ data?: Array<...> }` but
paginated response is `{ data: { items: [...], pagination: {...} } }`.

**Fix:** Changed endpoint to `/conversations/owner`; updated response type and `.map()` to `.items?.map()`.

### DRIFT-4 — `apps/e2e/tests/spec-096/e2e-10-filter-cache-hit.spec.ts`

**Issue:** `GET /api/v1/public/accommodations` returns `{ data: { items: [...], pagination: {...} } }`
(paginated). Test typed response as `{ data?: ReadonlyArray<...> }` and called `data?.map()`,
which silently returned `[]` (undefined method on object), making all assertions vacuously pass.

**Fix:** Added `PaginatedBody` type; changed all `.data?.map()` to `.data?.items?.map()`.

### DRIFT-5 — `apps/e2e/tests/spec-098/e2e-08-entity-smoke.spec.ts`

**Issue:** `GET /api/v1/protected/user-bookmarks` returns `{ data: { bookmarks: [...], total: N } }`.
`BookmarkListResponse` typed `data` as `ReadonlyArray<...>` and called `data?.some(...)`, which
throws `TypeError: data.some is not a function` at runtime (plain object, not array).

**Fix:** Updated `BookmarkListResponse` to `{ data?: { bookmarks: ReadonlyArray<...>; total: number } }`;
changed `data?.some(...)` to `data?.bookmarks?.some(...)`.

---

## Status after Phase 2 fixes

| Root cause | Type | Status |
|---|---|---|
| RC-1: Wrong Turbo filter `hospeda-admin` | Infra | ✅ Already in staging before branch cut |
| RC-2: Stale `scripts/ci/` paths | Infra | ✅ Fixed (commit 5b0515350) |
| DRIFT-2: `createConversation` wrong SQL columns | Schema | ✅ Fixed |
| DRIFT-3: MSG-01 host inbox wrong endpoint + type | API | ✅ Fixed |
| DRIFT-4: E2E-10 accommodation list response type | Schema | ✅ Fixed |
| DRIFT-5: E2E-08 bookmark list response type | Schema | ✅ Fixed |
| DRIFT-1: host-07e cron endpoint removed (VPS migration) | API | ⏳ Deferred — guarded by `test.fixme` |

---

## Cron re-enable — T-105-06

Cron re-enabled at `0 5 * * *` (02:00 ART = 05:00 UTC). Spec complete when 3 consecutive
nightly runs succeed.
