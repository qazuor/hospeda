# ADR-016: Fail-Open Strategy for Billing Entitlement Middleware

## Status

Accepted

## Context

The Hospeda API uses an entitlement middleware that checks the user's billing subscription to determine which features they can access. This middleware relies on an in-memory LRU cache (5-minute TTL, max 1000 entries) backed by QZPay API calls to load plan entitlements and limits.

Several failure scenarios can occur during entitlement resolution:

- The QZPay billing service is temporarily unavailable.
- The in-memory cache is cold after a serverless cold start.
- A database or network error prevents fetching subscription data.
- The plan associated with a subscription has been deleted or is unreachable.

The middleware must decide what to do when it cannot determine the user's entitlements: either block the request (fail-closed) or allow it with default/empty entitlements (fail-open).

## Decision

Accept fail-open as the v1 strategy for billing entitlement middleware. When the middleware encounters an error loading entitlements, it sets empty entitlements on the context and allows the request to proceed. Individual route handlers that require specific entitlements will still enforce their own checks via `requireEntitlement()` and `requireLimit()`.

To ensure visibility into fail-open events, `Sentry.captureException` is added to all catch blocks in the entitlement middleware (both `loadEntitlements` and the middleware handler itself). This ensures every silent failure is tracked and alertable.

## Rationale

For a tourism accommodation platform, **blocking legitimate users due to billing infrastructure failures is worse than temporarily granting access**. The consequences of each approach are asymmetric:

- **Fail-closed risk**: A paying user cannot manage their accommodation listings during a billing outage. This directly impacts their business and erodes trust in the platform. Support tickets spike, and the platform appears unreliable.

- **Fail-open risk**: During a brief outage, a user on a lower-tier plan might temporarily access a feature they have not paid for. Revenue loss from these brief windows is minimal, and the user experience remains uninterrupted.

Additionally:

- The 5-minute cache TTL means most requests are served from cache and never hit the failure path.
- Serverless cold starts are the most common cause of cache misses, and these are transient.
- Route-level entitlement guards (`requireEntitlement`) still enforce access control even with empty entitlements from a fail-open event, meaning users do not get unrestricted access.. they get the most restrictive default.
- Sentry alerts provide the team with immediate visibility into failure frequency and patterns.

## Consequences

### Positive

- Users are never blocked from the platform due to billing infrastructure issues.
- Sentry integration provides real-time alerting on entitlement loading failures.
- The 5-minute cache reduces the blast radius of backend failures to a small window.
- Route-level guards provide a second layer of enforcement even during fail-open.

### Negative

- During extended outages, users may temporarily access features outside their plan tier.
- Empty entitlements on fail-open means `requireEntitlement` checks will reject rather than allow, so some users may lose access to features they have paid for until cache recovers.
- No automatic retry mechanism for failed entitlement loads within the same request.

### Neutral

- Monitoring dashboards should include a metric for entitlement cache miss rate and fail-open event count.
- The fail-open behavior is consistent with the past-due grace middleware, which also fails open on unexpected errors.

## Future

Migrate to a circuit breaker pattern (e.g., the `opossum` library) that:

1. Opens the circuit after N consecutive failures to the QZPay API.
2. Returns cached or default entitlements while the circuit is open.
3. Periodically probes the QZPay API and auto-closes the circuit after recovery.
4. Provides metrics on circuit state transitions for observability.

This would provide more predictable behavior during sustained outages and reduce the number of failed API calls during known-bad periods.

## Alternatives Considered

1. **Fail-closed (block on error)** .. Maximum billing enforcement accuracy. However, a billing infrastructure outage would effectively take the entire platform offline for authenticated users. Unacceptable for a v1 product where reliability and trust are paramount.

2. **Cached fallback with stale data** .. Serve the last known entitlements even after TTL expiry when the backend is unavailable. Better user experience than fail-closed, but adds complexity to the cache layer (stale-while-revalidate semantics) and may serve outdated entitlements for extended periods. Considered for a future iteration.

3. **External cache (Redis)** .. Store entitlements in Redis for cross-instance sharing and persistence across cold starts. Adds another infrastructure dependency and a new failure mode. The in-memory cache is sufficient for v1 given the 5-minute TTL and serverless instance lifecycle.
