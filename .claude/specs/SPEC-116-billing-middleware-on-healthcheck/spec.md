---
spec-id: SPEC-116
title: Billing Middleware Runs on Healthcheck Path — Skip Unnecessary Work
type: fix
complexity: low
status: draft
created: 2026-05-14T08:30:00Z
effort_estimate_hours: 1-2
tags: [performance, middleware, billing, api, healthcheck]
extracted_from: SPEC-110 Phase 1 prod log inspection
priority: low
---

# SPEC-116: Billing Middleware Runs on Healthcheck Path

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Stop the billing customer lookup from running on Coolify's healthcheck request to `GET /` every 30 seconds. The work is unnecessary, generates noise in logs, and adds latency to a path that should be near-zero-cost.

**Why now:** Discovered during SPEC-110 Phase 1 prod log inspection (2026-05-14). Every loopback healthcheck log line has a preceding billing debug emission:

```
🐛 [DEBUG] [No billing customer found for authenticated user] => [Object]
💡 [INFO] [SUCCESS] => ✅ HTTP SUCCESS => GET http://localhost:3001/ 200 17ms
```

Every 30 seconds in prod, forever. The healthcheck path takes 11-50 ms when it should take <5 ms, and it leaves a misleading "No billing customer found for authenticated user" debug line in logs that has nothing to do with any real user request.

**Why this is the right scope:** SPEC-110 fixed the rate-limiter so the healthcheck no longer fills a shared bucket. But middleware further down the stack is still doing pointless work. The full fix is a separate concern (touches the global middleware chain in `apps/api/src/utils/create-app.ts` or wherever middlewares are mounted).

**Audience:** Solo developer (qazuor). Low-priority polish; not blocking.

---

### 2. Out of Scope

- Refactoring the entire billing middleware stack.
- Adding new healthcheck endpoints.
- Changing the rate-limit healthcheck bypass (that lives in SPEC-110 / `rate-limit.ts`).
- General middleware ordering audit (could be a separate spec if it surfaces issues).

---

### 3. Investigation Approach

#### Phase 0 — Locate the offending middleware

- Find which middleware emits `No billing customer found for authenticated user`. Likely candidates: `apps/api/src/middlewares/billing-*.ts` (e.g. `billing-customer.ts` or `billing-middleware.ts`).
- Trace how that middleware is registered in `apps/api/src/utils/create-app.ts` (or the global app composition).
- Understand why the middleware tries to look up a billing customer for an unauthenticated probe (`GET /` has no auth context). The debug log mentions "authenticated user" so there may be a default actor injected.

#### Phase 1 — Pick a fix shape

- **(a) Skip middleware by path.** Add a guard `if (path === '/' || HEALTHCHECK_PATHS.has(path)) return next()` at the top of the billing middleware. Mirrors what SPEC-110 did for rate-limiting.
- **(b) Skip middleware by method/auth state.** If there's no real session/actor, skip. More general but might mask bugs in other paths.
- **(c) Reorder app composition.** Mount billing middleware ONLY on the route trees that need it (`/api/v1/protected/billing/*`, `/api/v1/admin/billing/*`), not globally. Larger refactor but the cleanest answer.
- **(d) Silence the debug log only.** Cheapest but doesn't reduce the actual work being done.

Mirroring SPEC-110, my expected recommendation is **(a) for the immediate fix + (c) tracked separately for the proper refactor**, but the decision belongs to whoever picks this up.

#### Phase 2 — Implement + test

- Unit test: middleware short-circuits on healthcheck paths without calling the billing service.
- Integration: `GET /` log line no longer preceded by billing debug.

#### Phase 3 — Deploy + validate

- Deploy, observe `hops logs api` for ~5 min: confirm the `[No billing customer found]` debug lines disappear from the healthcheck cadence.

---

### 4. Tasks

| Task | Title | Status |
|---|---|---|
| T-116-01 | Phase 0: locate billing middleware emitting the debug log | pending |
| T-116-02 | Phase 1: decide fix shape (a)/(b)/(c)/(d) | pending, blocked by T-116-01 |
| T-116-03 | Phase 2: implement + unit test | pending, blocked by T-116-02 |
| T-116-04 | Phase 3: deploy + verify log noise gone | pending, blocked by T-116-03 |

---

### 5. Risks

| Risk | Mitigation |
|---|---|
| Skipping the middleware on `/` masks a legitimate billing-side error path | The healthcheck root path has zero billing semantics; skipping is safe. Validate via prod log diff after deploy. |
| Choosing (c) opens a larger refactor that drags on | Time-box (c) separately. (a) is the safe minimal fix; (c) can wait. |
| Skip-by-path drifts if new healthcheck paths are added | Centralise the path list (the same constant SPEC-110 introduced in `rate-limit.ts` could be moved to a shared util). |

---

### 6. Acceptance Criteria

This spec is "done" when:

- [ ] The `No billing customer found for authenticated user` debug line no longer appears on every healthcheck request in prod logs.
- [ ] `GET /` healthcheck latency drops noticeably (target: <5 ms median; was 11-50 ms with billing lookup).
- [ ] Unit test exists covering the bypass behaviour.
- [ ] No regression in real billing-gated routes (all relevant existing tests still pass).

---

## Part 2 — Implementation Notes

### Source

Discovered during SPEC-110 Phase 1 prod log inspection (2026-05-14, ~08:30 UTC). Every healthcheck request triggered a billing customer lookup despite the request having no relation to billing.

### Sequencing

Independent of SPEC-110. Can ship anytime. Low priority — pure noise reduction + minor latency win.

### Related

- SPEC-110: healthcheck-aware rate-limit bypass. The path allowlist there (`HEALTHCHECK_PATHS`) could be reused or extracted if (a) or (c) is chosen.
- `apps/api/src/utils/create-app.ts` (global middleware composition entry point)
- `apps/api/src/middlewares/billing-*.ts` (specific billing middlewares — exact file to be confirmed in Phase 0)
