# ADR-037: Umami over PostHog for Product Analytics (HOS-2119)

## Status

Accepted (2026-11-12, owner decision; design settled 2026-11-14, hosting 2026-11-15)

## Context

Product analytics ran on PostHog, wired into four surfaces: the web snippet, the admin
client, `posthog-node` in the API, and a Cloudflare proxy worker. It also touched CSP,
the env registry, CI, docs and `scripts/posthog`. The owner wants to leave PostHog and
move to a self-hosted Umami with Hospeda's own events.

A second need drives the same change: listing owners only see raw view counts
(`entity_views`). Where visitors come from, which country, which device, and how many of
them start a contact cannot be answered for them today. Hospeda should read Umami's API
server-side and show those statistics to owners.

Hospeda also has almost no traffic yet, which shapes the cut strategy.

## Decision

Product analytics moves to **Umami**, self-hosted. Every event in `@repo/analytics`
(web, admin, api) is emitted to Umami from the same call sites, with the existing Zod
validation and anti-PII guards unchanged. PostHog is removed.

### 1. Direct cut, no dual-write (OQ-2)

One release turns Umami on and removes PostHog. There is no fan-out client and no
coexistence window. With almost no traffic, a multi-week count comparison would measure
noise. Correctness is proven on staging first and watched for 48 hours in production.
Dual-write for 2 to 4 weeks was the first decision on 2026-11-14 and was reversed by the
owner before implementation started.

### 2. PostHog history is discarded (OQ-3)

Nothing is exported or archived and the PostHog project is abandoned. Trends before the
Umami start date are not available anywhere. Billing questions about that period are
answered from Hospeda's database.

### 3. Self-hosted on the existing VPS through Coolify, with its own Postgres (OQ-6)

Umami runs as a Coolify service, one instance per environment (staging, production),
backed by **its own Postgres container**, isolated from the Hospeda database server. The
Umami Postgres container joins the VPS backup routine.

Hosting decision (2026-11-15): Umami runs on the existing VPS, **not on Vercel**. The VPS
has the spare memory (Umami plus its Postgres use roughly 300 to 400 MB), Vercel Hobby
forbids commercial use, and Vercel would need an extra database provider. The API sends
events over the internal Docker network.

### 4. Hybrid source of truth for owner numbers (OQ-1)

`entity_views` stays the source of the view and click counts already promised to owners
(HOS-734, HOS-1063). Umami adds referrers, countries, devices and the contact funnel.
This follows the existing HOS-734 precedent and needs no separate ADR.

### 5. First-party serving (OQ-4)

The tracker and ingestion are served first-party behind Cloudflare, reusing the
same-origin relay approach of the former PostHog proxy to recover ad-blocked traffic.

## Consequences

### Positive

- No third-party processor for product analytics. Data stays on Hospeda's VPS.
- Owners get enriched statistics (sources, countries, devices, contact funnel) served by
  the API, with the `entity_views` counts kept next to them.
- One fewer SDK, worker and CSP entry once PostHog is removed.

### Negative

- Two more containers (Umami and its Postgres) to back up, upgrade and monitor.
- No PostHog history. The direct cut accepts a residual risk on production traffic, which
  is low today.
- Umami does not cover every PostHog feature. The gaps are listed in
  [PostHog to Umami gap list](../analytics/umami-dashboards.md#posthog--umami-gap-list).

### Mitigations

- Ad-blocker loss is reduced by serving the tracker and collect endpoint first-party.
- The owner stats panel never fails because Umami is down: the Umami cards hide and the
  `entity_views` cards stay.
- Server events never carry a Distinct ID (they would open a separate Umami session per
  user). The user id goes in event data, and request-scoped events forward IP and
  User-Agent so they join the browser session.

## Alternatives Considered

### Dual-write PostHog and Umami for 2 to 4 weeks

Rejected. With almost no traffic the comparison measures noise, PostHog history is
discarded anyway, and it adds a fan-out client that must then be removed.

### Umami as the only source for owner numbers

Rejected. It would retire `entity_views`, require an ADR superseding the HOS-734
decision, and lose ad-blocked views from owner numbers.

### Umami on Vercel

Rejected. Hobby forbids commercial use and an extra database provider would be needed.

### A separate database on the existing Postgres server

Rejected. The owner chose full isolation, accepting one more container to operate.

## Related Decisions

- Spec: `.specs/HOS-2119-posthog-to-umami/spec.md`
- [Analytics docs](../analytics/README.md)
- [View Tracking Privacy](../guides/view-tracking-privacy.md) (`entity_views`)
