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

## Verified read requests used by `UmamiStatsClient` (T-046, 2026-11-15, Umami 3.5.0)

All are `GET {base}/api/websites/{websiteId}/...` with `Authorization: Bearer <key>`
(an invalid token answers `401`). `startAt`/`endAt` are epoch ms; `timezone` is IANA.
Checked with two entities (A: 2 pageviews, 2 `contact_owner_started`, 1
`contact_owner_completed`; B: 1, 1, 0): each query returned only its entity's numbers.

- **Breakdown**: `metrics?type=referrer|country|device&startAt&endAt&timezone&tag=<entityId>`
  returns `[{"x": string, "y": number}]`. `y` counts distinct visitors (2 pageviews
  by one visitor give `y: 1`). An unknown tag returns `[]`. Direct traffic (no
  referrer) and unresolved geo are simply absent (`[]`), not `x: null`; the adapter
  still drops null/empty `x` defensively.
- **Views**: `stats?startAt&endAt&tag=<entityId>` returns
  `{"pageviews","visitors","visits","bounces","totaltime","comparison":{...}}`;
  `pageviews` is the view total for the entity.
- **Contact events**: `event-data-pivot?startAt&endAt&eventName=<name>&pf_entity_id=eq.<entityId>&pageSize=1`
  returns `{"data":[...rows],"count":N,"page":1,"pageSize":1,"isCapped":false}`.
  `eventName` is REQUIRED (`400` without it). `count` is the total across pages, so
  `pageSize=1` keeps the payload small. `pageSize=0` is a `400`. Without the
  `pf_entity_id` filter it answers the site-wide rows (leak). The filter value MUST be
  `eq.<id>`: a bare `pf_entity_id=<id>` is ignored (measured: 9 site-wide vs 3).
  **Measured meaning of `count`** (Umami 3.5.0, 2026-11-15): 3 `contact_owner_started`
  events for one fresh entity id from the same visitor/session gave `count: 3`, so
  `count` is the EVENT count (not grouped rows or sessions). `isCapped` was `false`;
  it is not reproducible with small data and is assumed to flag a truncated (lower
  bound) count. The adapter parses it and logs a warning when `true`.
- `tag` is set by sending `payload.tag` on a pageview (`/api/send`, type `event`, no `name`).
- **Same-site referrers are hidden from the referrer breakdown** (measured 2026-11-16,
  Umami 3.5.0, fresh tag, website domain `spike.local`, 4 distinct visitors via
  `/api/send`): referrer `https://spike.local/busqueda` (visitor 1), `https://www.google.com/`
  (visitor 2), none (visitor 3) and the bare path `/busqueda` (visitor 4).
  `metrics?type=referrer&tag=<id>` returned only `[{"x":"google.com","y":1}]`, while
  `stats?tag=<id>` answered `visitors: 4`. So neither a same-site full URL nor a path
  referrer is a row, and `visitors - sum(referrers)` = 3 counts internal navigation
  as "direct". The browser tracker also rewrites a same-origin `document.referrer` to a
  bare path (`referrer.startsWith(origin + '/') ? referrer.slice(origin.length)`), which the
  server then drops. Consequence: the derived `(direct)` row is an approximation that
  includes internal-only navigation (and, conversely, a visitor with several referrers is
  counted in each row, understating direct).
- **Internal-entry visitors (T-075, measured 2026-11-16, Umami 3.5.0)**: custom event
  `listing_internal_entry` sent via `/api/send` with `payload.tag=<id>`: visitor 1 twice,
  visitor 2 once, visitor 3 once under a second tag.
  - `metrics?type=event&tag=<id>` honours the tag (no leak: the second tag only saw its own
    event) BUT `y` is the EVENT count (`[{"x":"listing_internal_entry","y":3}]`), not distinct
    visitors. Unusable for the stats units. `stats?tag=&event=` returns zeros (stats only
    counts pageviews).
  - **`metrics/expanded?type=event&tag=<id>&startAt&endAt` is the right call**: it answered
    `[{"name":"listing_internal_entry","pageviews":"3","visitors":2,"visits":2,"bounces":1,"totaltime":"0"}]`
    (`visitors` = distinct visitors: 2, not 3; `pageviews` is the event count and comes as a
    STRING), the second tag answered `visitors: 1`, an unknown tag answered `[]`. One row per
    event name, so the adapter reads the row whose `name` is the event (0 when absent).
    Cross-check: `sessions?tag=&event=<name>&pageSize=1` gives `count: 2` (same figure).

## T-037: reports and boards API shapes (measured 2026-11-16, Umami 3.5.0)

Used by `scripts/umami/client.ts`. All calls sent the login token (or an `umami_...` API
key) as a bearer credential; the same header worked for both.

- **Auth**: `POST /api/auth/login {username,password}` returns `{token, user}`.
  `POST /api/auth/verify` with the token returns the user. Missing or bad token on a
  protected call answers `401 {"error":{"message":"Unauthorized","code":"unauthorized","status":401}}`.
  Validation runs BEFORE auth: `GET /api/reports` with no token and no `websiteId`
  answers `400`, not `401`.
- **Error body**: `{"error":{"message","code","status","errors":[],"properties":{<field>:{"errors":[...]}}}}`.
  Unknown id answers `404 {"error":{"code":"not-found"}}`.
- **List envelope**: `{"data":[...],"count":N,"page":1,"pageSize":20}`. `pageSize=1000`
  is accepted (no cap observed). `search=` is a loose substring match across fields
  (`search=goal` also returned reports not named "goal"), so exact name matching must be
  done client side.
- **Reports**: `GET /api/reports?websiteId=<id>` (`websiteId` REQUIRED; optional `type`
  filter works). `POST /api/reports` creates, `GET /api/reports/:id` reads,
  `POST /api/reports/:id` updates, `DELETE /api/reports/:id` answers `{"ok":true}`.
  Create AND update need the FULL body `{websiteId,type,name,description?,parameters}`
  (a partial update answers `400` listing websiteId/type/name/parameters). Response:
  `{id,userId,websiteId,type,name,description,parameters,createdAt,updatedAt}`.
  `type` is one of `attribution|breakdown|funnel|goal|heatmap|journey|performance|retention|revenue|utm`.
  Funnel parameters: `{window, steps:[{type:'path'|'event', value}]}`. Umami may
  reorder keys inside `parameters` on storage, so comparisons must be key-order-insensitive.
  There is no unique constraint: creating twice makes two rows (hence the upsert).
- **Boards**: `GET /api/boards` (no filter; user-scoped, paginated), `POST /api/boards`,
  `GET|POST|DELETE /api/boards/:id` with the same semantics. Body
  `{type,name,description,parameters}`; `type` is `mixed|website|pixel|link`
  (the error also mentions an `"open"` alternative). Website boards carry
  `parameters.websiteId`; layout lives in `parameters.rows[].columns[].component`
  (accepted as free-form; stored and returned). Response adds `teamId`.
- Teams exist (`GET /api/teams`); API keys: `GET /api/me/api-keys`. Segments/cohorts
  were not probed (not used by the setup script).
- **Natural keys chosen**: report = `websiteId` + `name`; board = `name`. More than one
  match raises an `ambiguous` error instead of guessing.
