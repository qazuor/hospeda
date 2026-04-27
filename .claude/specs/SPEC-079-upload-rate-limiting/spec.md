---
id: SPEC-079
slug: upload-rate-limiting
title: Media Upload Rate Limiting
status: completed
priority: medium
created: 2026-04-14
completed: 2026-04-27
depends_on: [SPEC-078]
closing_commits:
  - 108f330a # feat(api): per-user sliding-window rate limit on media uploads
  - 20ae6581 # feat(api): redis backend for sliding-window rate limit (SPEC-079)
---

# SPEC-079: Media Upload Rate Limiting

## Revision History

| Revision | Date | Summary |
|----------|------|---------|
| v1.0 | 2026-04-14 | Initial draft |

---

## Overview

The media upload and delete endpoints introduced in SPEC-078 need per-user rate limiting to prevent abuse, resource exhaustion, and runaway costs against the Cloudinary API. This spec defines a Hono middleware that enforces sliding-window rate limits on authenticated media endpoints, returning HTTP 429 with a `Retry-After` header when thresholds are exceeded.

---

## Requirements

### REQ-01: Sliding Window Rate Limiter

A reusable rate-limiting middleware MUST enforce per-user limits using a sliding window algorithm. The middleware receives the user ID from the authenticated session and tracks request counts within a configurable time window.

**Limits:**

| Endpoint | Role | Window | Max Requests |
|----------|------|--------|--------------|
| `POST /api/v1/admin/media/upload` | Admin | 1 min | 30 |
| `POST /api/v1/protected/media/upload` | User | 1 min | 10 |
| `DELETE /api/v1/admin/media` | Admin | 1 min | 60 |

### REQ-02: HTTP 429 Response

When a user exceeds the rate limit, the middleware MUST:

- Return HTTP `429 Too Many Requests`
- Include a `Retry-After` header with the number of seconds until the window resets
- Return a JSON body matching the existing `ResponseFactory` error format with code `RATE_LIMIT_EXCEEDED`

### REQ-03: Storage Backend

The rate limiter MUST support two storage backends via a provider interface:

- **In-memory (Map-based)**: Default for single-instance deployments and local dev. Uses a `Map<string, SlidingWindowEntry>` with periodic cleanup of expired entries.
- **Redis-based**: For distributed/production deployments. Uses the existing Redis instance from `docker-compose.yml`. Leverages `ZADD`/`ZRANGEBYSCORE`/`ZREMRANGEBYSCORE` for atomic sliding window operations with key TTL.

Backend selection is driven by an env var (e.g., `HOSPEDA_RATE_LIMIT_BACKEND=memory|redis`).

### REQ-04: Hono Middleware Integration

The rate limiter MUST be implemented as a Hono middleware factory function that accepts configuration (window size, max requests, backend) and returns a `MiddlewareHandler`. It attaches to the media routes in the existing route files without modifying business logic.

---

## Acceptance Criteria

- [ ] Admin upload endpoint returns 429 after 30 requests in a 1-minute window from the same user
- [ ] User avatar upload endpoint returns 429 after 10 requests in a 1-minute window
- [ ] Admin delete endpoint returns 429 after 60 requests in a 1-minute window
- [ ] 429 response includes `Retry-After` header with correct remaining seconds
- [ ] 429 response body uses `ResponseFactory` format with `RATE_LIMIT_EXCEEDED` code
- [ ] In-memory backend works correctly in dev without Redis
- [ ] Redis backend works when `HOSPEDA_RATE_LIMIT_BACKEND=redis` is set
- [ ] Rate limit state is scoped per user (different users have independent counters)

---

## Out of Scope

- Global (non-per-user) rate limiting or IP-based limiting
- Rate limiting for non-media endpoints
- Admin UI for viewing or adjusting rate limits at runtime
- Rate limit headers on successful requests (e.g., `X-RateLimit-Remaining`).. can be added later
- Distributed rate limiting across multiple Redis nodes (single Redis instance is sufficient)

---

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| SPEC-078 | Spec | Defines the media upload/delete endpoints this spec protects |
| `@repo/config` | Package | Env var for backend selection (`HOSPEDA_RATE_LIMIT_BACKEND`) |
| Redis | Infrastructure | Already in `docker-compose.yml` for dev; production uses managed Redis |
| Hono middleware API | Framework | `MiddlewareHandler` type from `hono` |

---

## Implementation Notes

- The middleware factory lives in `apps/api/src/middleware/rate-limit.ts` (or a shared location if other endpoints need it later).
- The sliding window algorithm uses sorted sets in Redis: each request adds a timestamped entry, expired entries are pruned on each check, and the remaining count determines allow/deny.
- The in-memory backend mirrors this logic with a `Map` and a cleanup interval (e.g., every 60s) to prevent memory leaks.
- Named export only: `export function createRateLimitMiddleware(opts: RateLimitOptions): MiddlewareHandler`.
- All configuration values (window, max requests) are defined as constants, not magic numbers.
