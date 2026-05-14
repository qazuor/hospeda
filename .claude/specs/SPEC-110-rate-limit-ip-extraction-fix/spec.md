---
spec-id: SPEC-110
title: Rate-Limiter IP Extraction Fix — prevent shared 'unknown' bucket
type: fix
complexity: medium
status: draft
created: 2026-05-13T04:50:00Z
effort_estimate_hours: 4-12
tags: [security, rate-limiting, redis, cloudflare, api, investigation]
extracted_from: SPEC-103 T-086 redis verify finding
priority: high (potential security issue, not yet exploited)
---

# SPEC-110: Rate-Limiter IP Extraction Fix (renumbered from SPEC-106 to avoid collision)

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Eliminate the shared `rl:general:unknown` rate-limit bucket that potentially groups all unidentified anonymous traffic under a single per-IP-rate-limit key in Redis, opening a denial-of-service / rate-limit-bypass vector.

**Why now:** Discovered during SPEC-103 T-086 (Redis usage verification, 2026-05-13). After ~103K connections and ~68K commands processed on hospeda-redis (prod), the **single active rate-limit key was `rl:general:unknown`** with TTL 14.7 min. If this key represents the fallback path for requests where IP extraction fails, then:

- All anonymous traffic where IP cannot be extracted shares ONE bucket.
- A single bad actor can exhaust the rate limit, denying anonymous service to everyone.
- The "unknown" identifier hides legitimate per-IP differentiation that the rate limiter was designed to provide.
- The bug is silent — failed rate limits would look like legitimate throttling, not a security issue.

**Why a new spec (not part of SPEC-103):** Investigation requires reading the rate-limiter source, understanding the IP extraction logic across Cloudflare proxy chain, reproducing the fallback condition, and likely a code fix with tests. SPEC-103 is operational hardening; this is a security/correctness bug that deserves dedicated tracking.

**Audience:** Solo developer (qazuor). Investigation can be paused; fix may need coordination with deployment timing (avoid rate-limit changes mid-traffic-spike).

---

### 2. Out of Scope

- Wholesale rate-limiter redesign (e.g., adopting a different algorithm like sliding window or token bucket if the current impl is fixed-window).
- New rate-limit features (per-route limits, per-user-tier limits) beyond fixing this bug.
- Migrating from Redis to a different backend.
- General security audit of all rate-limited routes (could be its own spec).
- Adding observability dashboards (could be a follow-up).

---

### 3. Investigation Approach

#### Phase 0 — Locate and read the rate-limiter implementation

- Find rate-limiter source in `apps/api/src/middlewares/` (or wherever it lives).
- Document the current implementation:
  - How IP is extracted from the request (which header? what order?)
  - How the rate-limit key is constructed (`rl:<namespace>:<identifier>` pattern)
  - What the fallback identifier is when IP can't be extracted ("unknown" confirmed via Redis observation)
  - How the namespace ("general" observed) is selected vs other namespaces
- Look at any related schemas/config: `packages/schemas/`, `packages/config/`.

**Output:** Short doc / engram entry summarizing current behavior, file:line references.

#### Phase 1 — Reproduce locally

- Spin up the API locally with redis backend.
- Craft requests with various header combinations:
  - No CF headers (direct hit, dev mode)
  - Spoofed `CF-Connecting-IP`
  - Spoofed `X-Forwarded-For` chain
  - Both present
  - Neither present
- Observe which combinations produce `unknown` vs which produce a per-IP key.
- Confirm whether **prod traffic shape** (Cloudflare → Traefik → API) triggers the `unknown` path consistently.

**Output:** Test cases enumerated with expected vs actual rate-limit key for each.

#### Phase 2 — Fix

Depending on Phase 1 findings, one or more of:

- **(a) IP extraction misconfiguration**: API may not be reading `CF-Connecting-IP` (Cloudflare's authoritative client IP header). Add or fix the header read. Verify trust chain (only accept these headers when the request actually came from Cloudflare).
- **(b) Trusted proxy config missing**: Hono / Better Auth / rate-limiter may need explicit trust list of upstream proxy IPs to accept forwarded headers.
- **(c) Fallback policy too permissive**: When IP genuinely can't be extracted (e.g., direct hit bypassing CF), the request should be **rejected** (HTTP 400 / 403) rather than rate-limited under a shared bucket. Alternatively, use a high-cardinality identifier like request-id + user-agent hash + path, accepting some collision in exchange for breaking the global-bucket pattern.
- **(d) Logging gap**: Emit a warning log when a request falls back to `unknown` so operations can see this happening in real time.

Each fix:
- Has unit tests for the IP extraction function (pure function, RO-RO pattern).
- Has integration tests against a mock Redis backend.
- Has a load test confirming distinct simulated clients land in distinct buckets.

#### Phase 3 — Deploy + monitor

- Deploy fix to staging first.
- Generate synthetic traffic, watch Redis: confirm distinct IPs produce distinct keys.
- Promote to prod.
- Monitor `rl:general:unknown` key presence in prod over 7 days — should approach zero (only outlier cases).
- Optional: add metric / alert for `unknown` key occurrence rate.

---

### 4. Tasks (expand during investigation)

| Task | Title | Status |
|---|---|---|
| T-110-01 | Phase 0: locate + document current rate-limiter impl | pending |
| T-110-02 | Phase 1: reproduce `unknown` fallback locally with request matrix | pending, blocked by T-110-01 |
| T-110-03 | Phase 2: implement fix (specific subtasks emerge after Phase 1) | pending, blocked by T-110-02 |
| T-110-04 | Tests: unit + integration + load for new behavior | pending, blocked by T-110-03 |
| T-110-05 | Deploy to staging + observability check (no `unknown` keys) | pending, blocked by T-110-04 |
| T-110-06 | Promote to prod + 7-day monitoring | pending, blocked by T-110-05 |
| T-110-07 | Document findings + final policy in `docs/security/rate-limiting.md` | pending, blocked by T-110-06 |

---

### 5. Risks

| Risk | Mitigation |
|---|---|
| Fix accidentally rate-limits internal services (cron, webhooks) that don't carry CF headers | Phase 1 enumerates all known caller shapes; Phase 2c policy distinguishes "external proxied" vs "internal" via header presence + source check |
| Reading `CF-Connecting-IP` when request didn't come from Cloudflare opens spoofing risk (attacker sets the header) | Trust headers only when source IP matches Cloudflare IP ranges (publicly documented) OR set Cloudflare to forward only over a specific cert/secret |
| Existing prod traffic depends on the `unknown` bucket somehow (e.g., uptime probes get rate-limited correctly today) | Phase 3 staging soak before prod; revert plan: feature-flag the new IP extraction so it can be disabled remotely |
| Investigation surfaces broader rate-limiter issues (e.g., wrong limits per route) | Out-of-scope per §2; capture as new tasks/specs |

---

### 6. Acceptance Criteria

This spec is "done" when:

- [ ] Rate-limiter code path no longer produces `rl:*:unknown` keys for normal traffic (only edge-case rejections, if any).
- [ ] Distinct simulated clients in load test land in distinct Redis keys.
- [ ] Tests cover the IP extraction function and the integration with Redis backend.
- [ ] Production monitoring shows `unknown` key rate at near-zero over 7 days.
- [ ] `docs/security/rate-limiting.md` documents the current behavior, trust chain, and what to do if `unknown` appears in monitoring.

---

## Part 2 — Implementation Notes

### Source

Discovered during SPEC-103 T-086 redis verify (2026-05-13, ~04:40 UTC). Engram topic: `spec/SPEC-103/t-086-redis-verify`. Single active redis key in prod was `rl:general:unknown` despite 103K+ lifetime connections — strong evidence that the rate-limiter's IP identifier collapses to a shared default for the dominant prod traffic path.

### Sequencing relative to SPEC-079

SPEC-079 (Redis rate-limit backend) is the meta-spec covering rate-limit-via-redis. SPEC-110 fixes a specific bug surfaced by 079's deployment. If 079 ships any additional changes, they happen on top of 110's fix.

### When to start

Recommended: **before public launch**. The current behavior is a potential DoS vector. Pre-launch traffic is low → low risk of exploitation now. Post-launch with marketing visibility → risk window grows. Ideal sequence: fix → soak in staging 1 week → promote → public launch.
