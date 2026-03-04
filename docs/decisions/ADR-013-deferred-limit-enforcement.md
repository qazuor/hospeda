# ADR-013: Deferred Enforcement of MAX_PROPERTIES and MAX_STAFF Limits

## Status

Accepted

## Context

The Hospeda billing system defines plan-based limits for Hosts, including maximum number of properties (`MAX_PROPERTIES`) and maximum staff members per property (`MAX_STAFF`). These limits are stored in the plan configuration and visible in the admin panel.

Enforcing these limits requires middleware that intercepts property creation and staff invitation requests, queries the current count, compares against the plan limit, and blocks the action with an appropriate error. This middleware must handle edge cases such as:

- Concurrent requests that could bypass count checks.
- Plan changes mid-session (upgrade/downgrade).
- Grandfathered users who exceed new limits.
- Soft-deleted resources that may or may not count toward limits.
- Grace periods during plan transitions.

Building robust enforcement before launch risks delaying the release for edge cases that may not occur at initial volumes. The platform's first Hosts are likely to have far fewer properties than any plan limit.

## Decision

Define limits in plan configuration but defer hard enforcement to v2. In v1:

- Plan limits are stored and displayed in the admin panel and Host dashboard.
- Creating properties or adding staff beyond limits triggers a **warning log** but does **not block** the action.
- Stub middleware is prepared with the enforcement logic structure, ready to activate in v2.
- Usage metrics are collected to understand actual patterns before setting final limits.

## Consequences

### Positive

- Faster launch without the risk of false blocks that frustrate early adopters.
- Collects real usage data to inform appropriate limit values before enforcement.
- Avoids building complex concurrency handling for a scenario with low initial volume.
- Stub middleware reduces v2 implementation effort since the structure is already in place.
- Early Hosts get a generous experience that encourages platform adoption.

### Negative

- Potential for abuse during v1 if a Host creates significantly more resources than their plan allows.
- Must still build enforcement eventually .. the work is deferred, not eliminated.
- The warning-only approach may create expectations that limits are not real, making enforcement in v2 feel like a downgrade.

### Neutral

- The admin panel already shows limit values, so the UI does not need changes when enforcement activates.
- Plan configuration remains the same regardless of enforcement state.

## Alternatives Considered

1. **Full enforcement from day one** .. Guarantees billing integrity from launch but risks delaying release. Edge cases like concurrent requests and plan transitions require significant testing. False blocks on early adopters could damage trust during the critical adoption phase. The engineering effort is disproportionate to the risk at initial volumes.

2. **No limits defined at all** .. Simplest approach but makes it very difficult to introduce limits later. Users who build workflows assuming unlimited resources will resist any future constraints. Defining limits in the plan (even without enforcement) sets expectations and makes future enforcement feel like a natural progression.
