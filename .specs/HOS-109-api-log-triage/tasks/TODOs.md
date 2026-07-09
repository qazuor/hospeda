# HOS-109: Investigate & fix production API log errors and noise (post-relaunch triage)

## Progress: 0/11 tasks (0%)

**Average Complexity:** 2.3/3 (max)
**All tasks independent** — no blocking dependencies; ordered by priority within phases.

---

### F1 — Functional 500 bug

- [ ] **T-001** (complexity: 3) — Fix blog tag filter 500 (posts ?tags= as join, not column)
  - PostService._executeSearch passes `tags` as a where column → DbError 500. Translate to postTags join + regression test.
  - Blocked by: none

### F2 — Logging hygiene

- [ ] **T-002** (complexity: 2) — Downgrade expected 401 on protected routes from ERROR+stack
- [ ] **T-003** (complexity: 2) — Downgrade expected 404 not-found from ERROR *(gated on OQ-1)*
- [ ] **T-004** (complexity: 2) — Downgrade expected 403 permission-denied from ERROR *(gated on OQ-1/OQ-3)*

### F3 — Over-fetch / rate-limit

- [ ] **T-005** (complexity: 3) — Stop web fetching entitlements without a session / retry-loop on 401
- [ ] **T-006** (complexity: 2) — Stop unread-count poller re-polling on 403

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
