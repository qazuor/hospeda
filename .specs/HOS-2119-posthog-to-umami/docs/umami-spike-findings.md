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

## T-038: report parameter shapes and the PostHog -> Umami mapping (measured 2026-11-16, Umami 3.5.0)

Code: `scripts/umami/definitions.ts`. Every shape below was created with
`POST /api/reports`, read back, run where a run endpoint exists, then deleted.

### Parameter shapes

`POST /api/reports` accepts ANY `parameters` object for every type (it is free-form:
`{}` is stored for `retention`, `utm`, `revenue`), so acceptance proves nothing. Shapes
were therefore validated against the RUN endpoints, which do validate:

| Type | Stored `parameters` | Run endpoint (GET, `startAt`/`endAt` in epoch ms) |
|---|---|---|
| funnel | `{window:<MINUTES>, steps:[{type:'event'\|'path', value}]}` (>= 2 steps) | `/api/websites/:id/funnels/:reportId/stats` -> `[{type,value,visitors,previous,dropped,dropoff,remaining}]` |
| goal | `{type:'event'\|'path', value}` | `/api/websites/:id/goals/:reportId/stats` -> `{num,total}` |
| journey | `{steps:<int>, startStep?, endStep?}` | `/api/websites/:id/journeys?steps=&startStep=` (no `:reportId` form) |
| retention | `{}` | `/api/websites/:id/retention` |
| attribution | `{model:'first-click'\|'last-click', type:'path'\|'event', step}` | `/api/websites/:id/attribution` (camelCase `firstClick` is rejected) |
| breakdown | `{fields:[<column>]}`, columns limited to a fixed enum (`path`, `referrer`, `title`, ...); `destination_slug` is rejected | `/api/websites/:id/breakdown?fields=<JSON array>` |
| utm, revenue | `{}` | no run endpoint found (`/utm`, `/revenue` answer 404) |

- There is NO `POST /api/reports/<type>` run endpoint: `POST /api/reports/funnel` is parsed
  as `POST /api/reports/:id` (update) and `/api/reports/run` hits `findUnique` with
  id `run` (500, invalid uuid).
- Funnel `window` is in MINUTES: two events 2 h apart, `window:10` -> second step 0
  visitors, `window:200` and `200000` -> 1 visitor.
- `GET /api/websites/:id/funnels` and `/goals` list the saved reports of that type;
  ad-hoc `funnels/stats` needs `window` and `steps` as a JSON array of >= 2 steps.
- Board components (from the 3.5.0 editor bundle): column `component` =
  `{type, title, description, props?}`; `entityType`/`entityId` only on mixed boards.
  Types: `WebsiteMetricsBar`, `EventsMetricsBar`, `WebsiteChart`, `EventsChart`, `Goal`
  and `Funnel` (both with `props.reportId` = saved report id, so board upserts must run
  AFTER report upserts), `UTM` (`props.param`, `props.limit`), `MetricsTable`
  (`props.type` in path|fullPath|entry|exit|title|query|referrer|channel|country|region|
  city|browser|os|device|language|screen|utmSource|utmMedium|utmCampaign|utmContent|
  utmTerm|event|hostname, `props.limit` 5|10|20), `WorldMap`, `WeeklyTraffic`,
  `TextBlock` (`props.text`), realtime and revenue components. Row/column ids are
  client-generated; the builder uses positional ids. A built board is stored and returned
  with the same content but a different key order (compare key-order-insensitively).
  Not verified: rendering in the UI (no browser).
- A report does not store a date range; every run passes `startAt`/`endAt`.

### PostHog insight -> Umami

PostHog shipped 8 funnel insights (3 pairs duplicated across dashboards, so 5 distinct)
and ~45 trend insights.

| PostHog insight | Umami |
|---|---|
| Funnels (sign_up -> published; viewed -> contact; owner 4 steps; contact 3 steps; subscription) | `funnel` reports, 5 distinct (`HOSPEDA_FUNNELS`) |
| Funnel `$pageview` -> `sign_up_completed` | Dropped as a funnel (no "any pageview" step; a path step needs one path). Replaced by `goal` on `sign_up_completed` (share of all visitors) |
| Single-event trends for conversion KPIs (sign up, published, contact, subscription, payment, trial) | `goal` reports (`HOSPEDA_GOALS`, 6). A goal is the share of visitors, not an event count |
| Other single-event trends (search, destination/accommodation/event/post viewed, contact started/failed, drafts, imports, onboarding, failed payments) | No saved report. `EventsChart` / `EventsMetricsBar` board components show custom events over time |
| `$pageview` trend, MAU, DAU | Board components `WebsiteChart` / `WebsiteMetricsBar` (no report) |
| Breakdown by `$referring_domain`, `$utm_source`, `$utm_campaign`, `$pathname` | `MetricsTable` board component with `referrer` / `utmSource` / `utmCampaign` / `path` or `entry` |
| Breakdown by an EVENT property (`destination_slug`, `accommodation_id`, `destination_id`, `plan_slug`, `billing_period`, `failure_category`) | Dropped. The `breakdown` report accepts only fixed columns; per-property reads go through `event-data` (spec 6.4: event-data breakdown or an admin page) |
| Breakdown by a PERSON property (`plan`) | Dropped: Umami has no person properties |
| HogQL SQL insights | None existed in the ported set |

Event names drifted from PostHog: billing events were renamed by HOS-1352, so
`subscription_checkout_started` -> `billing_checkout_started`,
`subscription_created` -> `billing_subscription_activated`,
`subscription_payment_succeeded` -> `billing_charge_succeeded`,
`subscription_payment_failed` -> `billing_charge_declined`,
`trial_converted_to_paid` -> `trial_converted`. The builders validate every event
against `AnalyticsEventSchemas` and throw on the old names. The old "nine funnels"
figure in the spec does not match the 8 insights in `scripts/posthog/data.ts`.

## T-039 / T-040: the six boards (2026-11-16, Umami 3.5.0)

Code: `scripts/umami/boards.ts` (`BOARD_SPECS`, `buildBoardDefinitions`, `DROPPED_TILES`).
Board names are the natural keys: `00 Resumen`, `01 Adquisición`, `02 Descubrimiento`,
`03 Owners`, `04 Suscripciones`, `05 Calidad`. Reports first, boards second:
`buildBoardDefinitions({ websiteId, reportIds })` takes the `name -> id` map of the
upserted reports and throws `UNRESOLVED_REPORT` on a missing name.

Measured: all six boards were created on the local Umami (`POST /api/boards`, 200) and
read back with every component stored (8, 8, 6, 5, 7, 4); then deleted. From the 3.5.0
editor registry: `EventsChart` and `EventsMetricsBar` have NO configurable props (they cover
ALL custom events, no per-event filter); `MetricsTable` takes `type` and `limit`;
`Funnel`/`Goal` take only `reportId`. Rendering was not verified (no browser).

Funnels: the spec says "nine funnels" without listing them. `scripts/posthog/data.ts` has
8 funnel insights, 5 distinct; the 5 are kept, none invented. All 5 are on a board.

Tiles not ported one-to-one are listed in `DROPPED_TILES` (17 entries): MAU/DAU math, the
pageview -> sign-up funnel (now a goal), per-event trends (the board's events
`MetricsTable` lists each event with its count), every breakdown by an event property
(`destination_slug`, `accommodation_id`, `destination_id`, `plan_slug`, `billing_period`,
`failure_category`) and the person-property breakdown (`plan`).
