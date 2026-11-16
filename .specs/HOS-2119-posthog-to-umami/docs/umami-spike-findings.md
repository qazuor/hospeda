# Umami spike findings (T-001 / T-002)

Measured against a local Umami 3.5.0 (Docker, own Postgres) during the T-0 spike,
2026-11-14/15. The original scratch notes were lost when the session scratchpad
was cleared; this file reconstructs the facts that the spec and the tasks depend on.
Every item below was measured, not assumed. Re-measure with a local Umami 3.5.x if
in doubt (`docker compose` with `ghcr.io/umami-software/umami` + Postgres).

## Ingestion (`POST /api/send`, `POST /api/batch`)

- Limits: event name ≤ 50 chars, data keys ≤ 500 chars, string values ≤ 500,
  numbers must satisfy |n| < 1e15. There is **no** 50-property limit.
- Batch: up to 500 items and roughly 10 MB per request. A `200` response can still
  be a partial failure: treat `processed < size`, `errors > 0` or a non-empty
  `details[]` as failure.
- **Bots are dropped silently with `200`.** Umami runs `isbot` (`^5.2.2`) on the
  User-Agent. Any UA containing `api` (and the old `HospedaServer/1.0` suffix) is
  classified as a bot. Server events must send a plain browser UA when no visitor
  context is available.
- `payload.id` must never be sent (it overrides the session identity). A real user
  id goes to `data.user_id`.
- An invalid `payload.ip` (e.g. `"not-an-ip"`) is accepted (`processed: 1`); it does
  not lose the event.
- Geo: when `payload.ip` is present, Umami ignores the provider country headers
  (`cf-ipcountry`, `x-vercel-ip-country`, …) and resolves location with its bundled
  MaxMind DB from that IP. Without `payload.ip` it reads those headers first.
  Localhost IPs resolve to no location.

## Session attribution (R-1, AC-12)

- Umami derives the session from IP + User-Agent (+ website, salted per month).
  A server event without the visitor's real IP/UA lands in a synthetic session and
  cannot be joined with the browser pageview. Hence visitor context (T-071/T-072).

## Read API (owner stats, T-045/T-046)

- Auth: `Authorization: Bearer umami_...` API key.
- Referrers / countries / devices: `GET /api/websites/:id/metrics?type=<referrer|country|device>&tag=<entityId>`
  — pageviews only, so listing pages must set the tracker `data-tag="<entityId>"`.
- Counts and the contact funnel: event-data pivot filtered by the event property
  `pf_entity_id` (the flattened `entity_id`).
- Property series have **no gap-fill**: days without data are absent and must be
  zero-filled by the caller.
- `event-data/values` must not be used (it does not honour the entity filter the way
  the stats need).
- Every query must carry its entity filter; a query without it returns site-wide
  data (data leak between owners). Contract tests use two entities.

## Hosting decision (2026-11-15)

Umami runs on the existing VPS (Coolify), not on Vercel: 3.8 GB RAM available,
Umami + Postgres use ~300–400 MB, Vercel Hobby forbids commercial use and would
need an extra DB provider. Limits for the Umami containers: 512 MB app, 256 MB DB.
The api sends events over the internal Docker network. Tracker script and collect
endpoint are renamed (`TRACKER_SCRIPT_NAME`, `COLLECT_API_ENDPOINT`) and served
from a first-party subdomain to reduce ad-blocker loss.
