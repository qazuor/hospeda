# HOS-109: Investigate & fix production API log errors and noise (post-relaunch triage)

## Progress: 6/11 tasks (55%)

**Average Complexity:** 2.3/3 (max)
**All tasks independent** — no blocking dependencies; ordered by priority within phases.

---

### F1 — Functional 500 bug

- [x] **T-001** (complexity: 3) — Fix blog tag filter 500 (posts ?tags= via r_entity_tag) ✅
  - DONE (commit d4b4b0422): REntityTagModel.findEntityIdsByTags + inArray(posts.id, ids) via additionalConditions; empty-match → empty result. 9 tests, typecheck + biome green.

### F2 — Logging hygiene

- [x] **T-002** (complexity: 2) — Downgrade expected 401 on protected routes from ERROR+stack ✅
- [x] **T-003** (complexity: 2) — Downgrade expected 404 not-found from ERROR ✅
- [x] **T-004** (complexity: 2) — Downgrade expected 403 permission-denied from ERROR ✅
  - DONE (commit 2e9ebbd05): single `resolveErrorLogLevel(code)` helper in service-core
    (NOT_FOUND/UNAUTHORIZED → info, FORBIDDEN → warn, else error+stack), reused by both
    emission points — service-layer `logError` and route-layer `createErrorHandler`
    (stack line suppressed for non-error levels). 22 tests (16 service-core + 6 API new/updated),
    typecheck + biome green. Fresh review: approve, no blockers.
  - FOLLOW-UP (owner, not blocking): `ENTITLEMENT_REQUIRED` / `LIMIT_REACHED` also map to
    HTTP 403 but stay at `error` — OQ-1 scoped the downgrade to 401/403/404 only, so this is
    a deliberate gap. Revisit if paywall/limit-gate noise shows up in a future triage.

### F3 — Over-fetch / rate-limit

- [x] **T-005** (complexity: 3) — Stop web fetching entitlements without a session / retry-loop on 401 ✅
  - DONE (commit ce7a7429a): root cause = `useMyEntitlements` fetched `/protected/users/me/entitlements`
    on every island mount + soft-nav for guests; the 401 was never cached, so each remount re-fired
    → sustained 429. Fix = gate the fetch on a resolved Better Auth `useSession()` (guests never call it,
    fail-closed; stays loading while session resolves; authed users fetch+cache once). One file, 3
    consumers untouched. 10 hook tests + 157 consumer tests + web typecheck + biome green. Fresh review: approve.
- [x] **T-006** (complexity: 2) — Stop unread-count poller re-polling on 403 ✅
  - DONE (commit e56ae5843): admin `useUnreadCount` (sidebar badge) polled every 30s uncond.;
    an actor without the conversations permission got a 403 per tick forever. Fix = `refetchInterval`
    stops (false) once a 403 is seen; local `retry` never retries any 4xx (403/429/404) matching the
    root QueryClient policy (SPEC-117 M-2), transient 5xx/network still retry 3x. Policies extracted as
    pure fns (unreadCountRefetchInterval / unreadCountShouldRetry), unit-tested. 9 tests, admin
    typecheck (route tree generated) + biome green. Fresh review caught + fixed a regression: initial
    local retry excluded only 403 → would have re-amplified 429; widened to all 4xx.

### F4 — Investigations (report first, then fix/downgrade)

- [ ] **T-007** (complexity: 2) — Investigate stale-slug 404 flood source (sitemap / ISR / crawler) *(OQ-2)*
- [ ] **T-008** (complexity: 2) — Verify conversation-notification cron lock overlap
- [ ] **T-009** (complexity: 2) — Gate social-publish-dispatch make_api_key warning

### F5 — Config / SEO

- [ ] **T-010** (complexity: 3) — Fix Brevo webhook signature verification
- [ ] **T-011** (complexity: 2) — Serve robots.txt and fix RSS feed route

---

## Open questions (need owner input)

- **OQ-1** — Target log level for expected 401/403/404: `debug` (silent in prod) vs `info`? Should 403 stay louder than 404? → gates T-003/T-004.
- **OQ-2** — Is the 404 flood an external crawler (accept + robots) or our stale sitemap/ISR (regenerate)? → resolved by T-007.
- **OQ-3** — Should public profile-by-slug have a limited public view, or is 403 correct (only log level wrong)? → gates T-004.

## Suggested start

**T-001** — the only real user-facing 500, self-contained, no dependencies. Then the F2 logging cluster (cheap, reuses HOS-104/105 patterns), then T-005 (the 429 loop).
