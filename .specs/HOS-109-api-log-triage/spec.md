---
title: Investigate & fix production API log errors and noise (post-relaunch triage)
linear: HOS-109
statusSource: linear
created: 2026-07-09
type: fix
areas:
  - api
  - web
  - devops
---

# Investigate & fix production API log errors and noise (post-relaunch triage)

## 1. Summary

Triage of the production API logs captured on 2026-07-09 (00:20–03:00,
`api.hospeda.com.ar`), shortly after the prod relaunch. The logs mix one real
user-facing 500 bug, a rate-limit self-DoS, a large volume of expected-status
lines logged as ERROR + stack (noise), several cron/config warnings, and a
flood of 404s on stale slugs. This spec separates real problems from noise and
fixes (or investigates then fixes) each one, tracked in Task Master so the work
survives a machine crash.

## 2. Problem

The prod logs are currently unusable as a signal: real errors are buried under
expected 401/403/404 noise and repeating cron warnings. One public feature
(blog tag filter) is fully broken with a 500, and a client loop is tripping the
rate limiter into a sustained 429 storm. We need the log stream to reflect only
actionable problems, and to fix the genuine bugs surfaced.

## 3. Goals

- **G-1 (P1)** — Blog tag filter (`/public/posts?tags=`) returns results, not 500.
- **G-2 (P7/P8/P9)** — Expected auth/permission/not-found statuses (401/403/404)
  stop being logged as ERROR + stack; reserve ERROR+stack for genuine 5xx.
- **G-3 (P5/P6)** — Clients stop hammering `entitlements` (guest) and
  `admin/conversations/unread-count` (no-permission) into rate-limit / repeated 403.
- **G-4 (P10/P11/P12)** — Investigate and report the root cause of the stale-slug
  404 flood, the conversation-notification cron lock overlap, and the
  social-publish-dispatch make_api_key warning; fix or downgrade as decided.
- **G-5 (P14/P15)** — Brevo webhook signature verification accepts legitimate
  callbacks; RSS feed + robots.txt are served instead of 400/404.

## 4. Non-goals

- **NG-1** — P2 (`gastronomy_reviews` 500), P3 (subscription `incomplete` status),
  and P4 (`owner-test-daily` MP minimum) are OUT of scope — already fixed by
  another agent, only appearing in these logs because the fixes were not yet
  redeployed to prod.
- **NG-2** — No redesign of the entitlements or conversations features; only stop
  the pathological client behavior.
- **NG-3** — No new logging framework; work within the existing `@repo/logger` +
  HTTP middleware conventions established by HOS-104/105.

## 5. Current baseline

Source: production API logs, 2026-07-09 00:20–03:00. Confirmed in code:

- **P1**: `packages/service-core/src/services/post/post.service.ts:_executeSearch`
  (~line 797) passes `mapPostFilterKeysToColumns(filterParams)` (including a raw
  `tags` key) straight into `model.findAllWithRelations`. `buildWhereClause`
  (`packages/db/src/base/base.model.ts`) rejects `tags` as an unknown column →
  `DbError` → HTTP 500. `tags` are stored in the `postTags` / `r_entity_tag`
  join, not as a column on `posts`.
- **P7/P8/P9**: 401/403/404 responses are logged via the API error/HTTP
  middleware as `ERROR` + full stack (`🚨 Caught error … Authentication required`,
  `Route error`, `SERVICE ERROR … not found`). HOS-104/105 already reduced DB
  dump noise; this extends that hygiene to HTTP status → log-level mapping.
- **P5**: `GET /protected/users/me/entitlements` — a guest (no session) request
  count climbs 82→100 then sustains `429` for minutes. Client calls entitlements
  without a session and retries on 401.
- **P6**: `GET /admin/conversations/unread-count` returns `403` every ~30s from a
  client polling on an interval without the required permission.
- **P10**: hundreds of sequential `404`s on seed-like slugs (`apartment-mirador-calmado`,
  `cabin-…`, plus posts/events) between 01:39–01:46, spaced ~2s — smells like a
  crawler or a stale sitemap / ISR warm-up enumerating OLD seed slugs.
- **P11**: `[CRON:conversation-notification] … skipping — previous run holds
  advisory lock` recurring every 5–10 min.
- **P12**: `[CRON:social-publish-dispatch] … no active make_api_key credential in
  the vault — skipping dispatch` every 5 min.
- **P14**: `[Brevo webhook: signature mismatch]` → `401` on
  `POST /public/webhooks/brevo/<token>`.
- **P15**: `GET /public/posts/slug/rss.xml 400` and `GET /robots.txt 404`.

## 6. Proposed design

Grouped into 5 phases (each item = one Task Master task with its own DoD).

### F1 — Functional 500 bug
- **P1**: Intercept `tags` in `PostService._executeSearch` (and `_executeCount`)
  before the `where` is built. Resolve it against the `postTags` join (translate
  to `additionalConditions` / a join filter), never pass it as a column key.
  Add a regression test that `?tags=<id>` returns 200 with filtered results.

### F2 — Logging hygiene (HTTP status → log level)
- **P7**: A 401 on a protected route is an expected outcome → log at `info`/`debug`
  without a stack; the HTTP access-log line is enough.
- **P8**: A public `getByField` miss (404 not-found) is expected → `info`/`debug`,
  no `SERVICE ERROR` + `Route error` + stack.
- **P9**: A 403 permission denial is expected → `info`/`debug`, no ERROR+stack.
  (Exact target level per status is **OQ-1** below.)

### F3 — Client over-fetch / rate-limit
- **P5**: Web must not request `entitlements` without a session, and must not
  retry-loop on 401. Fix the client call site + backoff. (Investigate exact call
  origin first.)
- **P6**: The unread-count poller must not fire for actors lacking the permission
  (or must stop on 403 instead of re-polling every 30s).

### F4 — Investigations (verify + report, then fix/downgrade)
- **P10**: Determine the request source (sitemap? ISR warm-up? external crawler?)
  and whether it's enumerating stale seed slugs. Report findings → decide fix
  (regenerate/limit sitemap, cache-bust, or accept + downgrade log level).
- **P11**: Determine whether conversation-notification ever completes or leaks its
  advisory lock (job duration vs cron cadence). Report → fix if a real overlap/leak.
- **P12**: Confirm the warning is purely "vault not configured yet" and gate it so
  it doesn't warn every 5 min when the social feature is intentionally unused.

### F5 — Config / SEO
- **P14**: Fix Brevo webhook signature verification (secret/token config) so
  legitimate callbacks pass; verify against a real Brevo test event.
- **P15**: Serve an RSS feed (or route `rss.xml` correctly) and a `robots.txt`.

## 7. Data model / contracts

No schema changes anticipated. P1 is a query-construction fix (join, not column).
Potential new env/config only if P14 needs a corrected Brevo webhook secret
(record under the Linear issue's env-var section if so).

## 8. UX / UI behavior

- P1: blog tag chips return filtered posts instead of an error page.
- P5: no functional UI change; removes background 429 churn.
- P15: `/robots.txt` and an RSS feed become reachable.

## 9. Acceptance criteria

- **AC-1** — `GET /public/posts?tags=<valid-id>` returns 200 with only posts
  carrying that tag; regression test added and green.
- **AC-2** — A guest 401, a 403 permission denial, and a public 404 not-found each
  produce at most an access-log line at the agreed level, with NO ERROR + stack.
- **AC-3** — The web app issues zero `entitlements` requests without a session and
  does not retry-loop on 401; unread-count polling does not repeat on 403.
- **AC-4** — P10/P11/P12 each have a written findings note on the Linear issue and
  a decided outcome (fix applied or explicit downgrade/accept).
- **AC-5** — A legitimate Brevo webhook is accepted (no signature-mismatch 401);
  `/robots.txt` returns 200 and the RSS feed resolves (no 400).

## 10. Risks

- **R-1** — Changing log levels could hide a genuine auth/permission regression.
  Mitigate: only downgrade the *expected* status path; keep 5xx at ERROR+stack.
- **R-2** — P1's tag filter fix touches a hot public search path; needs the
  regression test + a check that existing filters (category, isNews, etc.) still work.
- **R-3** — P5 client fix is in `apps/web`; must not break authenticated
  entitlement gating.

## 11. Open questions

- **OQ-1 (P8/P9)** — Target log level per expected status: `debug` (silent in prod)
  vs `info` (visible but not error)? And should 403 stay slightly louder than 404
  since it can indicate a probing attempt? **Needs owner discussion.**
- **OQ-2 (P10)** — Is the 404 flood an external crawler (accept + robots/limit) or
  our own stale sitemap/ISR (regenerate)? Determined in the P10 investigation.
- **OQ-3 (P9)** — Should public profile-by-slug (`/users/by-slug/:slug`) have a
  limited public view instead of 403 for guests, or is 403 correct and only the
  log level is wrong? **Product decision.**

## 12. Implementation notes

- F2/F3 continue the HOS-104/105 logging-hygiene line; reuse those conventions.
- P1 fix belongs in the service layer (translate `tags` → join), not the route.
- Investigations (P10/P11/P12) should produce a findings note BEFORE any fix, so
  the owner can weigh in on OQ-1/OQ-2/OQ-3.
- Out-of-scope P2/P3/P4 are tracked elsewhere; do not touch them here.

## 13. Linear

Canonical tracking:
HOS-109
