# View Tracking — Privacy Model

> First-party server-side view counting introduced in SPEC-159. Complements Umami
> (product analytics/funnels; replaced PostHog in HOS-2119) with a durable per-entity count stored in our own DB.

## What is tracked

`POST /api/v1/public/views` records a **view event** every time a web detail page
fires `navigator.sendBeacon` for an accommodation, post, or event. The raw rows live
in the `entity_views` table (`entityType`, `entityId`, `visitorHash`, `isAuthenticated`,
`viewedAt`).

## Visitor identity — no raw IPs stored

| Visitor type | Identity stored |
|---|---|
| Authenticated (session cookie present) | `user:<uuid>` — stable, exact dedup |
| Anonymous | cookieless `visitorHash` (see below) |

### Anonymous `visitorHash` computation

Computed **server-side only** — the client never sends or receives the hash.

```
visitorHash = SHA-256( HMAC(dailySalt, date) + truncatedIp + userAgent )
```

- `dailySalt` rotates every UTC day, making the hash non-reversible and
  non-cross-day-linkable. A visitor on Monday and Tuesday produces two different hashes.
- `truncatedIp`: IPv4 `/24` prefix (e.g., `1.2.3.x`); IPv6 `/64` prefix. The full IP
  never reaches the hash and is never logged or stored.
- Raw IPs are **never written to the database** or to any log sink.

### Why no consent banner is required

The hash is pseudonymous (no durable client storage, no cookie, no cross-site linkage).
It expires with the daily salt. This satisfies the "pseudonymous telemetry" exemption
under the consent model already in place (`respect_dnt`, consent-gated analytics
tracking). No `hospeda_vid` cookie is set.

## Unique-visitor counts are approximate

Unique counts = `COUNT(DISTINCT visitorHash)` over the requested window. Known
limitations:

- A visitor on two devices or IPs counts as two unique visitors.
- Multiple clients sharing NAT may appear as fewer uniques than they are.
- Counts are a dashboard KPI, not a billing metric. The approximation is acceptable
  and consistent with the product analytics baseline.

## Bot filtering

The capture endpoint rejects requests whose `User-Agent` matches a bot denylist
(`bot|crawl|spider|preview|curl|wget`). Rejected requests receive a fake **202** so
crawlers get no signal. The `sendBeacon`-only write path (no GET, no form) is itself
a structural filter against naive crawlers.

## Retention

A nightly cron purges `entity_views`, `partner_logo_clicks` and `entity_interactions` rows
older than **120 days** (`WHERE <time column> < now() - interval '120 days'`). This is the
GDPR-lite data-minimization control. The widest panel window is 90 days, which leaves 30 days of
margin for a nightly run that did not happen (owner decision, 2026-11-16, HOS-2256). The horizon was
95 days before that, so hashes now live 25 days longer. A daily rollup job writes the monthly totals
before the rows are purged, so the numbers outlive the fingerprints. No manual action is required;
the cron records each run via `recordCronRun`.

## Listing interactions (HOS-2256)

The venue page also records what a visitor taps (phone, map, website, Instagram, ticket, WhatsApp)
in `entity_interactions`, through `POST /api/v1/public/interactions`. Same rules as views: no
cookie, no consent banner, daily salt, same bot filter, no raw IP. Two differences, on purpose:

- **A logged-in visitor is hashed like an anonymous one** (truncated IP + user agent), never as
  `user:<uuid>`. "Tapped this venue's phone" would otherwise identify a person with a contact
  intention. The table has no `is_authenticated` column.
- **The owner's own taps are dropped.** The endpoint reads the session only for that comparison.

Limit: copying a number without tapping it, or opening a link from the context menu, is not counted.

## What this is NOT

- Not a replacement for Umami. The existing `accommodation_viewed` analytics event
  continues firing unchanged (now to Umami, HOS-2119). Umami is the source of truth
  for product analytics and funnels; `entity_views` stays the source of the owner
  view/click counts and powers the dashboard KPI widgets (SPEC-155). Owner stats
  combine both (hybrid, see [ADR-037](../decisions/ADR-037-umami-over-posthog.md)).
- Not a billing metric. Never use view counts to gate entitlements or charge users.

## Related

- API routes: `apps/api/docs/route-architecture.md` § View Tracking Routes
- Analytics (Umami): [docs/analytics/README.md](../analytics/README.md)
- DB schema deviation: `packages/db/CLAUDE.md` § Lean append-only tables
- Cron system: `apps/api/docs/cron-system.md`
