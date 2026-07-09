# HOS-109: Investigate & fix production API log errors and noise (post-relaunch triage)

## Progress: 10/11 tasks (91%) — T-010 blocked on owner (Brevo dashboard + prod env)

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

- [x] **T-007** (complexity: 2) — Investigate stale-slug 404 flood source (sitemap / ISR / crawler) *(OQ-2)* ✅
  - FINDINGS (investigation, no code change): NOT our bug. Confirmed via the T-011 investigation —
    `sitemap-dynamic.xml.ts` is regenerated from the CURRENT DB (lists current slugs, never stale
    ones), the RSS feed fetches the correct `/posts?` list endpoint, and no code builds the bad
    paths. The 404 flood = external crawlers requesting OLD seed slugs after reseed: the web SSR
    `[slug].astro` forwards each to the API `getBySlug` → NOT_FOUND → logged. No ISR enumerates
    slugs (web uses Cloudflare cache + on-demand revalidation).
  - **OQ-2 RESOLVED: external crawler traffic → accept + downgrade.** Already mitigated by T-003
    (404 → `info`, no ERROR/stack) + T-011 (Disallow-all robots.txt on the API domain). No further
    code fix. Optional future SEO nicety: 410 Gone for known-deleted slugs — deferred, out of scope.
    NEEDS-YOUR-DATA (optional): exact crawler UA/volume would confirm from prod logs, but the source
    - mitigation are settled from code.
- [x] **T-008** (complexity: 2) — Verify conversation-notification cron lock overlap ✅
  - FINDINGS (investigation, no code change): **benign skip, NO leak.** The lock is
    `pg_try_advisory_xact_lock(43020)` — TRANSACTION-level, auto-released by Postgres on
    commit/rollback; it cannot leak across runs. The recurring "skipping — previous run holds
    advisory lock" WARN is the lock working as intended (a prior run still executing at the next
    5-min tick). Job `timeoutMs` 120s < 300s cadence, so overlap is bounded.
  - ROOT-CAUSE FLAG (follow-up, outside T-008's "fix only if real leak" scope): the whole batch —
    including `sendEmail` (external HTTP) for up to 100 schedules sequentially — runs INSIDE the
    lock-holding transaction (`conversation-notification.job.ts`). A large/slow batch keeps the
    transaction (+ lock + a pooled DB connection) open long enough to trip the next run's skip,
    violating the "external calls OUTSIDE the transaction" rule (service-core CLAUDE.md). Recommend a
    follow-up spec: move email dispatch out of the transaction (the Redis idempotency guard
    `conv:notif:{id}` already dedups), and/or lower MAX_BATCH_SIZE / add a per-email timeout.
    → Follow-up filed as **HOS-112** (Backlog, kind-needs-spec, related to HOS-109).
- [x] **T-009** (complexity: 2) — Gate social-publish-dispatch make_api_key warning ✅
  - DONE (commit 51a8a9f25): dispatch cron (every ~5min) warned on every run when the optional
    make_api_key/make_webhook_url vault creds are absent (expected pre-launch). Now logged at `info`
    ONCE per process per credential (module-level Set dedupe, cleared when the cred reappears).
    Test-only `__resetUnconfiguredCredentialLogState`. 21 tests (incl. "only once across 3 runs"),
    API typecheck + biome green.

### F5 — Config / SEO

- [ ] **T-010** (complexity: 3) — Fix Brevo webhook signature verification — **BLOCKED ON OWNER (Brevo dashboard + prod env)**
  - DIAGNOSIS (code read, `apps/api/src/routes/webhooks/brevo.ts`): the CODE IS CORRECT and NOT a
    signature bug. Brevo does NOT sign payloads — this endpoint gates on a **static shared token in
    the URL path** (`POST /api/v1/public/webhooks/brevo/:token`), compared to
    `HOSPEDA_BREVO_WEBHOOK_SECRET` via `timingSafeEqual`. The `signature mismatch` → 401 means the
    `:token` in the incoming URL ≠ the configured secret. This is **config drift**, not code.
  - ROOT CAUSE (one of): (a) the token embedded in the webhook URL registered in the Brevo dashboard
    ≠ `HOSPEDA_BREVO_WEBHOOK_SECRET` on `hospeda-api-prod` (value mismatch / rotated one side only);
    or (b) the secret contains URL-unsafe characters (`/`, `+`, `=`) that get mangled in the URL path
    so the decoded path token never equals the raw env value. (Secret is SET, not unset — an unset
    secret logs a different line, `HOSPEDA_BREVO_WEBHOOK_SECRET unset, rejecting`.)
  - REMEDIATION (**needs your Brevo dashboard + prod access — the blocking step**):
    1. In the Brevo dashboard, read the exact webhook URL and extract its `:token` segment.
    2. Set `HOSPEDA_BREVO_WEBHOOK_SECRET` on `hospeda-api-prod` to EXACTLY that token, OR regenerate a
       URL-safe token (alphanumeric / hex / base64url — no `/`, `+`, `=`) and update BOTH the Brevo
       dashboard URL and the Coolify env var to match. `hops env-set prod HOSPEDA_BREVO_WEBHOOK_SECRET <v>`
       then `hops redeploy prod`.
    3. Fire a real Brevo test event (bounce/open) and confirm 200.
  - OPTIONAL CODE HARDENING (I can do without creds if you want): warn/reject at boot if
    `HOSPEDA_BREVO_WEBHOOK_SECRET` contains URL-unsafe characters, to prevent this class of mismatch.
- [x] **T-011** (complexity: 2) — Serve robots.txt and fix RSS feed route ✅
  - DONE (commit 44e68e107): INVESTIGATION FIRST (owner asked) confirmed it's NOT our bug — the web
    feed fetches the correct /posts? list endpoint, RSS `<link>`/sitemap point to the web, nobody
    builds `/posts/slug/rss.xml`. Source = external crawlers hitting the API domain. Owner chose
    Option A. Fix (API-side, since errors are in API logs): serve `/robots.txt` Disallow-all +
    301-redirect `/api/v1/public/posts/slug/rss.xml` → web feed (registered before `/slug/:slug`,
    exact-match only). Bypass Accept-header validation via validationMiddleware publicPaths (exact),
    because `options.skipValidation` runs too late for app-mounted routes. 5 tests via initApp +
    35 validation regression + typecheck + biome green. Fresh review: approve. **Partially answers
    OQ-2**: the 404/feed flood is external crawler traffic, not our sitemap/ISR.

---

## Open questions (need owner input)

- **OQ-1** — Target log level for expected 401/403/404: `debug` (silent in prod) vs `info`? Should 403 stay louder than 404? → gates T-003/T-004.
- **OQ-2** — Is the 404 flood an external crawler (accept + robots) or our stale sitemap/ISR (regenerate)? → resolved by T-007.
- **OQ-3** — Should public profile-by-slug have a limited public view, or is 403 correct (only log level wrong)? → gates T-004.

## Suggested start

**T-001** — the only real user-facing 500, self-contained, no dependencies. Then the F2 logging cluster (cheap, reuses HOS-104/105 patterns), then T-005 (the 429 loop).
