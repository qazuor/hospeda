# Umami spike (HOS-2119 T-006)

Decisions and measured facts from the T-0 spike that the Umami migration depends on.
Input for T-016, T-018, T-020, T-028 and T-045/T-046. Measured against Umami 3.5.0
(local Docker first, then the staging instance in Coolify). Full measurements and
request shapes: `.specs/HOS-2119-posthog-to-umami/docs/umami-spike-findings.md`.

## 1. Delivery path

Decision (T-004, 2026-11-16): **no worker and no path relay on the web origin.**
Umami is served from its own first-party, neutral subdomain through the normal
Cloudflare proxy. `infra/cloudflare/posthog-proxy/` is not used and is not a dependency.

| Item | Staging | Production (applied in T-009) |
| --- | --- | --- |
| Umami host | `pulso-staging.hospeda.com.ar` | `pulso.hospeda.com.ar` |
| Tracker script | `/app.js` (`TRACKER_SCRIPT_NAME=app.js`) | same |
| Collect endpoint | `/api/v` (`COLLECT_API_ENDPOINT=/api/v`) | same |
| Hosting | Coolify service `umami-staging`, image `ghcr.io/umami-software/umami:3.5.0`, own `postgres:16-alpine` container | to be set up in T-009 |

- Names are deliberately neutral (not `umami`, not `analytics`) to reduce ad-blocker loss.
- The Umami container has a 512 MB limit and the Postgres container 256 MB. Idle use
  measured 170 MB (app) and 58 MB (DB).
- `DISABLE_TELEMETRY=1` is set. The staging domain is proxied and `noindex`.

Measured through Cloudflare (staging): an event sent to `/api/v` was accepted, the
country was resolved (AR) from the Cloudflare headers, and referrer and device were
resolved.

Pending:

- **Ad-block check** with a real browser and a common filter list. Not done yet; it is
  part of the AC-12 smoke.
- **CSP**: the web and admin apps must allow the subdomain in `script-src` and
  `connect-src` (T-028/T-029). Without it the tracker does not load.

## 2. Server-event attribution (R-1)

**Question (R-1):** every server event comes from the api's IP, so server events could
collapse into one visitor and skew the counts.

**Answer.** Umami derives the session from IP + User-Agent (plus the website id, salted
per month). A server event sent without the visitor's real IP and UA lands in a synthetic
session and cannot be joined with the browser pageview. Therefore:

- Server events that belong to a visitor carry that visitor's context: `payload.ip` and
  the visitor's User-Agent. This joins them with the browser session.
- When `payload.ip` is present, Umami **ignores the provider country headers**
  (`cf-ipcountry` and similar) and resolves the location from its own MaxMind database.
  Without `payload.ip` it reads the headers first.
- When no visitor context exists (for example a job), send a **plain browser UA**. Umami
  drops any UA containing `api` or `HospedaServer/1.0` as a bot, and it does so silently
  with `200`.
- **Distinct id:** never send `payload.id` (it overrides the session identity). A real
  user id goes to `data.user_id`. API-originated events carry no distinct id (OQ-5).

### Distinct id and session join (measured 2026-11-16)

Question: if a server event for a consented, logged-in user carries `payload.id = <user id>`
(the same id the web sends with `umami.identify`), does it land in the browser session?

**Source (v3.5.0).** `resolveCollectionSession` (`src/lib/collection-session.ts`) computes
`sessionId = uuid(websiteId, ip, userAgent, salt, distinctId ?? '')`. When a request carries
a distinct id AND the tracker's `x-umami-cache` token, `resolveIdentifiedSession` reuses the
cached anonymous session if the IP + UA fingerprint is unchanged (claiming it through
`session_link`). The cache token lives in the tracker's memory only; a server request never
has it. So a server event with `payload.id` always gets `uuid(…, id)`.

**Probe** (local spike, website `spike-web`, `/api/send` for the browser side with the cache
token as the tracker sends it, `/api/batch` for the server side; sessions read from
`website_event` joined to `session`):

| Case | Browser session | Server event | Server session | Joined |
| --- | --- | --- | --- | --- |
| Pageview first, then `identify(X)` with cache (the web's flow) | `92cd…`, anonymous, `distinct_id` set to X by the claim | `payload.id = X`, same IP + UA | `2893…` (new) | **no** |
| same | `92cd…` | no `payload.id`, same IP + UA, `data.user_id = X` | `92cd…` | **yes** |
| same | `92cd…` | `payload.id = X`, other IP + UA | `b2a8…` (new) | no |
| Hard reload after identify (web does not re-identify: sessionStorage marker) | `92cd…` again | n/a | n/a | n/a |
| `identify(Y)` is the document's FIRST request (no cache) | `f116…` = `uuid(…, Y)` | `payload.id = Y`, same IP + UA | `f116…` | yes |
| same | `f116…` | no `payload.id`, same IP + UA | `5004…` (new) | no |

Conclusions:

- **Revised 2026-11-17 (owner, after staging smoke: claimed fingerprint session leaked across
  accounts).** Claiming the anonymous fingerprint session (identify WITH the cache token, the
  2026-11-16 design) leaks it: every later visitor on the same device/IP keeps landing in the
  first user's session until Umami rotates its salt. The design is now: the browser identify
  must be the document's FIRST request (no cache token), which opens `uuid(…, id)`, and server
  events with a real user id send `payload.id = id`, landing in the same session (probe rows
  "identify(Y) is the document's FIRST request" above). Anonymous and system server events send
  no `payload.id`. The web and admin therefore send the identify as soon as the tracker is
  present and SKIP it (never delay it) when `getSession().cache` already holds a token, read
  with `hasUmamiCacheToken` in `@repo/analytics`. A lost race leaves that document anonymous.
- **Re-check on every Umami upgrade.** The identify ordering, web and admin, depends on a detail
  of the 3.5.0 tracker that is not a documented API: `umami.getSession()` exists and exposes the
  cache token as `cache`. If it changes, no identify is sent at all (fail-closed, never a
  claimed session), and logged-in visits silently stop being identified.
- The server-created session row does carry `distinct_id`, but no `session_link` row is
  written for it (only identify writes one).

### Payload contract used by T-018

| Field | Rule |
| --- | --- |
| `website` | Website id of the surface (web or admin) |
| `url`, `hostname`, `referrer` | Set from the originating request. The exact values were not recorded in the spike notes; T-018 confirms them |
| `name` | Event name, at most 50 characters |
| `data` | Flat object. String values at most 500 characters. Numbers must satisfy `abs(n) < 1e15`. No nested objects |
| `ip`, `userAgent` | Visitor context when available (see above) |
| `payload.tag` | Set on pageviews that need a per-entity breakdown |

- The earlier assumption of a 50-property limit is **not** in Umami 3.5.0. Do not encode it.
- Batch (`POST /api/batch`): up to 500 items and about 10 MB per request. A `200` can be a
  partial failure. Treat `processed < size`, `errors > 0` or a non-empty `details[]` as a
  failure.

## 3. Umami version and the reports and boards API

- Pinned version: **Umami 3.5.0** (T-001 validated, T-003 deployed the same tag).
- The **reports** API (`/api/reports`) and the **boards** API (`/api/boards`) exist and
  were measured on 3.5.0: create, read, update and delete work. Reports and boards are
  matched by natural keys (report: `websiteId` + `name`; board: `name`).
- Shapes, funnel windows (minutes) and the PostHog to Umami mapping are in
  [umami-dashboards.md](./umami-dashboards.md).

## 4. Read API for owner statistics

- Access uses a **view-only** user, `hospeda-api-reader`, in the Hospeda team. Its API key
  is sent as `Authorization: Bearer <key>`. The key is stored in the secret store and is
  never written in the repo or in docs.
- Measured: reads answer `200`; writes answer `401`.
- Base path: `GET /api/websites/:id/...`. Times are epoch ms in `startAt`/`endAt`;
  `timezone` is IANA.

### Per-entity filter contract

Every query carries its entity filter. A query without it returns site-wide data, which
leaks between owners. Contract tests use two entities.

| Data | Request | Filter |
| --- | --- | --- |
| Referrers, countries, devices | `metrics?type=referrer\|country\|device&tag=<entityId>` | `tag` (pageviews only) |
| Views | `stats?tag=<entityId>` | `tag` |
| Contact events and counts | `event-data-pivot?eventName=<name>&pf_entity_id=eq.<entityId>&pageSize=1` | `pf_entity_id=eq.<id>` (event data) |
| Internal entry ("Desde Hospeda") | `metrics/expanded?type=event&tag=<entityId>` | `tag` |

Rules measured on 3.5.0:

- The browser pageview sets `data-tag="<entityId>"` on listing pages. A pageview sent
  through `/api/send` sets the same tag with `payload.tag`.
- `pf_entity_id` must use the `eq.` form. A bare `pf_entity_id=<id>` is ignored and
  returns the site-wide rows.
- `eventName` is required on `event-data-pivot` (`400` without it). `pageSize=0` is `400`.
- In `event-data-pivot`, `count` is the **event** count, not the number of visitors.
- `event-data/values` is not used: it does not honour the entity filter the stats need.
- Property series have **no gap-fill**. Days without data are absent, so the caller
  zero-fills them.
- Referrer breakdown hides same-site referrers, so the derived `(direct)` row is an
  approximation (it includes internal navigation). Details in the findings file.
- Unknown tags return `[]`, never the site total.

## 5. entity_id gaps (decided in T-005)

The spec assumed `entity_id` was already sent. Planning found it was not. Verified facts:

- `accommodation_viewed` and `contact_owner_started/completed/failed` carry
  `accommodation_id`, not `entity_id`.
- `EntityViewTracker` emits **no analytics event** for VENUE or EXPERIENCE (only the
  `entity_views` beacon, owner decision HOS-734). Partner pages emit none either.
- Venue, experience and partner contact blocks have **no contact events**.

Decisions (owner, 2026-11-14):

1. **ACCOMMODATION:** `accommodation_viewed` and the `contact_owner_*` events gain an
   optional, additive `entity_id` + `entity_type` pair (both or neither). `accommodation_id`
   stays.
2. **VENUE, EXPERIENCE, PARTNER:** a generic `entity_viewed` event with required
   `entity_type` and `entity_id` (T-016, T-030).
3. **No contact events** are added for venue, experience or partner. Their contact card
   is hidden in v1 (`contactFunnel: null`, T-044/T-045/T-051).

Contact funnel availability: measurable for ACCOMMODATION only, in v1.

Owner permission and entitlement for views (feeds T-048/T-049) are not recorded in the
T-005 notes. Locate them there, not here.

## Open items

- ~~Owner re-decision on the server distinct id~~. Decided 2026-11-16: server events never send
  `payload.id` (it splits the session in the web's flow, and the api cannot see the host-only
  `cookie-consent` cookie); the web identifies strictly after the pageview ack (spec OQ-5).

- Ad-block check with a real browser (AC-12 smoke).
- CSP entries for the subdomain (T-028/T-029).
- Production Umami host and relay (T-009).
