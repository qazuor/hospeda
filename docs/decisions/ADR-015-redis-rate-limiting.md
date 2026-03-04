# ADR-015: Redis-Based Rate Limiting with In-Memory Fallback

## Status

Accepted

## Context

The Hospeda API needs rate limiting to protect against DDoS attacks, prevent abuse, and ensure fair usage across all consumers. The API is deployed on Vercel as a serverless function, which means each request may be handled by a different instance. Rate limiting state must be shared across instances to be effective.

Without distributed rate limiting, each serverless instance maintains its own counter, allowing an attacker to bypass limits by distributing requests across instances. A user limited to 100 requests per minute could effectively make 100 x N requests (where N is the number of active instances).

The platform also needs different rate limits for different contexts:

- Public endpoints (higher limits for browsing).
- Authentication endpoints (strict limits to prevent brute force).
- Admin endpoints (moderate limits for authorized users).
- Webhook endpoints (configured for expected provider volumes).

## Decision

Implement a Redis-based sliding window rate limiter as the primary rate limiting mechanism, with an in-memory fallback when Redis is unavailable.

### Primary: Redis Rate Limiter

- Uses Redis sorted sets for sliding window counters.
- Shared state across all serverless instances.
- Configurable limits per route group.
- Keys expire automatically to prevent memory leaks.

### Fallback: In-Memory Rate Limiter

- Activates automatically when Redis connection fails.
- Uses a Map-based counter with periodic cleanup.
- Per-instance only (not distributed), but provides basic protection.
- Logs a warning when falling back so the team is alerted.

### Rate Limit Configuration

| Route Group | Window | Max Requests |
|-------------|--------|-------------|
| Public API | 1 minute | 60 |
| Auth endpoints | 15 minutes | 10 |
| Protected API | 1 minute | 120 |
| Admin API | 1 minute | 120 |
| Webhooks | 1 minute | 30 |

Limits are configurable via environment variables and can be adjusted without redeployment.

## Consequences

### Positive

- Distributed rate limiting works correctly across serverless instances through shared Redis state.
- Graceful degradation ensures the API remains available even if Redis goes down.
- Per-route configuration allows appropriate limits for different security contexts.
- Sliding window algorithm provides smoother rate limiting compared to fixed windows.
- Standard `RateLimit-*` response headers inform clients of their remaining quota.

### Negative

- Adds Redis as an infrastructure dependency (already used for session storage, so not a new dependency).
- The in-memory fallback is per-instance only, meaning rate limits are less effective during Redis outages.
- Redis latency adds a small overhead to every request (typically under 1ms for rate limit checks).

### Neutral

- Rate limit responses use standard HTTP 429 status with `Retry-After` header.
- Rate limiting middleware integrates with the existing Hono middleware chain.
- Monitoring and alerting for rate limit events use the existing logging infrastructure.

## Alternatives Considered

1. **In-memory rate limiting only** .. No external dependency and zero latency overhead. However, fundamentally broken in a serverless environment where each instance maintains its own counter. An attacker can bypass limits by distributing requests. Only viable for single-instance deployments.

2. **Vercel Edge rate limiting** .. Native integration with the deployment platform, no infrastructure to manage. However, creates vendor lock-in with Vercel-specific configuration. Limited customization for per-route limits. Pricing may scale unfavorably at higher volumes. Moving to a different hosting provider would require rebuilding the rate limiting layer.

3. **API gateway rate limiting (e.g., Kong, AWS API Gateway)** .. Feature-rich and battle-tested at scale. However, adds a significant infrastructure component that must be provisioned, configured, and maintained. Introduces additional latency through the gateway hop. Overkill for the current platform scale and adds operational complexity that the team does not need at this stage.
