# Provider-mitigation runbook (SPEC-277 R4)

How to recover from a blocked or degraded scraping provider **without a code
deploy**, by swapping the Apify actor or routing through a residential proxy via
configuration only.

## 1. Why this is config-only

The accommodation importer never hardcodes which Apify actor to run. Each
actor-backed adapter reads its actor slug from the per-request
`ImportContext.credentials` object, which the API route
(`apps/api/src/routes/accommodation/protected/import-from-url.ts`) builds from
environment variables. Changing the actor (or its proxy settings) is therefore a
change to an environment variable plus a redeploy — no source change, no PR.

This is the cheapest mitigation lever in SPEC-277: when an actor starts returning
empty datasets under anti-bot pressure (`source_blocked`), ops can point the
importer at an alternative actor or enable a residential proxy in minutes.

> R1 (automatic retry) and R2 (per-source Generic fallback) already absorb
> *transient* blocks. Use this runbook when a block is *persistent* — the actor
> is consistently empty/blocked across retries over a sustained window.

## 2. Configurable provider fields

| `ImportContext.credentials` field | Env var | Default | Read by |
|---|---|---|---|
| `apifyToken` | `HOSPEDA_APIFY_TOKEN` | *(unset)* | Airbnb + Booking adapters (Apify auth) |
| `apifyAirbnbActor` | `HOSPEDA_APIFY_AIRBNB_ACTOR` | `tri_angle/airbnb-rooms-urls-scraper` | `AirbnbAdapter` |
| `apifyBookingActor` | `HOSPEDA_APIFY_BOOKING_ACTOR` | *(unset)* | `BookingAdapter` (block/empty escalation) |
| *(actor run budget)* | `HOSPEDA_IMPORT_APIFY_TIMEOUT_MS` | `120000` | both actor calls (`timeoutMs`) |

Notes:

- **Only Airbnb and Booking use Apify actors.** Google Places uses an API key
  (`googlePlacesApiKey` / `HOSPEDA_GOOGLE_PLACES_API_KEY`) and MercadoLibre uses
  an OAuth token (`mercadoLibreToken`) — neither is actor-swappable, so neither
  appears here. There is intentionally **no** `apifyGooglePlacesActor`.
- An unset actor var degrades that source gracefully: a missing
  `HOSPEDA_APIFY_AIRBNB_ACTOR` (it has a default, so this only happens if
  explicitly blanked) makes Airbnb return an empty extraction; a missing
  `HOSPEDA_APIFY_BOOKING_ACTOR` makes Booking skip its actor escalation and rely
  on JSON-LD only.

## 3. Runbook — swap a blocked actor

1. **Confirm the block is persistent.** Reproduce an import for the affected
   source from the admin panel; a `source_blocked` failure that recurs across
   retries (R1) and still has no Generic fallback (R2) is the trigger.
2. **Pick an alternative actor.** Example for Airbnb:
   `tri_angle/airbnb-rooms-urls-scraper` → `dtrungtin/airbnb-scraper`. The slug
   must be a valid `owner/actor-name` pair available on the configured Apify plan.
3. **Set the env var on the API service** (two equivalent paths):
   - CLI on the VPS: `hops env-set api HOSPEDA_APIFY_AIRBNB_ACTOR <new-owner/actor>`
     (use `HOSPEDA_APIFY_BOOKING_ACTOR` for Booking).
   - Coolify UI: `https://coolify.hospeda.com.ar` → `hospeda-api-prod` (or
     `-staging`) → Environment Variables → set the key → Save.
4. **Redeploy** the API: `hops redeploy api` (or the Coolify "Redeploy" button).
5. **Verify** with a fresh import from the admin panel against a known-good
   listing URL for that source. Confirm fields populate and no `source_blocked`
   is returned.
6. **Roll back** by restoring the previous value (the default for Airbnb is
   `tri_angle/airbnb-rooms-urls-scraper`) and redeploying.

## 4. Runbook — route through a residential proxy

Apify actors accept a `proxyConfiguration` key in their run input. The importer
passes a fixed `actorInput` per source; enabling a proxy is done **at the actor
level** rather than per-request:

- For an actor that supports Apify Proxy, configure its `proxyConfiguration`
  (e.g. `{ "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] }`) in the
  actor's own default input on the Apify console, then point
  `HOSPEDA_APIFY_*_ACTOR` at that actor (Section 3). Residential groups require a
  plan that includes residential proxy.
- Consult the specific actor's Apify documentation for the exact
  `proxyConfiguration` shape it honours — actors differ.

> If a future requirement needs per-request proxy selection (rather than baking
> it into the actor), that is a code change to the `actorInput` builder in each
> adapter and is **out of scope** for SPEC-277 R4 (config-only). File a spec for
> it rather than hand-patching.

## 5. Config-seam audit result

Audited 2026-06-24 as part of SPEC-277 R4:

- `AirbnbAdapter` reads `ctx.credentials.apifyToken` + `ctx.credentials.apifyAirbnbActor`.
- `BookingAdapter` reads `ctx.credentials.apifyToken` + `ctx.credentials.apifyBookingActor`.
- Both values originate from `HOSPEDA_APIFY_*` env vars, parsed in
  `apps/api/src/utils/env.ts` and assembled into `ImportContext.credentials` by
  the import route.

**Result: no missing seam.** Every actor slug an adapter uses is sourced from
`ImportContext.credentials` (no hardcoded actor IDs), so an actor swap is fully
achievable via env var + redeploy. No code change is required for R4.
