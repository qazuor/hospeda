# External Reputation — Credentials & Setup Runbook (SPEC-237)

This guide explains how to obtain and configure every external credential the
**accommodation external reputation** feature needs (Google review snippets +
Booking/Airbnb aggregate ratings on accommodation detail pages).

There are two audiences:

- **Operators / developers** (this document): obtain the API keys and Apify
  actors, and set them in each environment.
- **Accommodation owners** (end users): obtain the per-listing identifiers
  (Google place, Booking URL, Airbnb URL) for *their own* property. That guidance
  is surfaced in-product in the owner reputation panel — see
  [Owner-facing identifiers](#owner-facing-identifiers) below.

> Related: [ADR-036](../decisions/ADR-036-external-reputation-separate-entity.md)
> (why a separate entity), and the SPEC-237 spec under
> `.qtm/specs/SPEC-237-accommodation-external-reviews/`.

## Environment variables

| Variable | Required for | Secret | Shared with |
|----------|--------------|--------|-------------|
| `HOSPEDA_GOOGLE_PLACES_API_KEY` | Google rating + review **snippets** | yes | SPEC-222 (import) |
| `HOSPEDA_APIFY_TOKEN` | Booking/Airbnb aggregate (Apify fallback) | yes | SPEC-222 (import) |
| `HOSPEDA_APIFY_BOOKING_ACTOR` | Booking aggregate via Apify | no | SPEC-222 |
| `HOSPEDA_APIFY_AIRBNB_ACTOR` | Airbnb aggregate via Apify | no | SPEC-222 |

All four are **optional** at the Zod-env layer: the feature degrades gracefully
when any is missing (the adapter returns an empty result, never throws). But for
real data you need at minimum the Google key (for Google) and, for the Apify
fallback, the token + the relevant actor slug.

Notes on coverage per platform:

- **Google** — needs `HOSPEDA_GOOGLE_PLACES_API_KEY` **and** a listing whose URL
  carries a resolvable Place ID (`place_id=ChIJ…` or a `ChIJ…` token). A bare
  `?cid=…` Maps URL is **not** resolvable by the adapter and yields no data.
- **Booking** — the *primary* path is a direct SSRF-safe fetch of the listing
  page + JSON-LD `aggregateRating`, which needs **no key**. The Apify token +
  `HOSPEDA_APIFY_BOOKING_ACTOR` are only the fallback when the direct fetch is
  blocked.
- **Airbnb** — aggregate-only via Apify; needs token + `HOSPEDA_APIFY_AIRBNB_ACTOR`.

---

## 1. Google Places API key

The Google reputation adapter calls the **Places API (New)** Place Details
endpoint with a field mask that includes `rating`, `userRatingsTotal`, and
`reviews`. This is the only adapter allowed to surface review text (per Google's
attribution rules — see ADR-036).

### Steps

1. Open the **Google Cloud Console**: <https://console.cloud.google.com>.
2. **Create or select a project** (top project picker → *New project*). A single
   project can host both the import (SPEC-222) and reputation keys.
3. **Enable billing** on the project: *Billing → Link a billing account*. The
   Places API requires an active billing account even though usage stays within
   the monthly free credit for our low volume.
4. **Enable the API**: *APIs & Services → Library →* search **"Places API (New)"**
   → **Enable**.
   - ⚠️ Enable **Places API (New)**, not the legacy "Places API". The adapter
     uses the `places.googleapis.com/v1/places/{id}` (New) endpoint.
5. **Create the key**: *APIs & Services → Credentials → Create credentials →
   API key*. Copy the value (starts with `AIza…`).
6. **Restrict the key** (recommended):
   - **API restrictions** → *Restrict key* → tick **only "Places API (New)"** and
     untick everything else. That single API covers both this feature and the
     SPEC-222 import (both hit Places API New, including Text Search). Add more
     APIs here only if you later reuse the same key for them.
   - **Application restrictions** → the key is used server-to-server (it travels
     in the `X-Goog-Api-Key` header), so:
     - **Local / dev → "None".** The key lives in `.env.local` (gitignored, never
       exposed to the browser) and your home IP is dynamic.
     - **Staging / prod → "IP addresses",** limited to the API server's egress IP
       (the VPS), or use a separate prod-only key.
     - Do **not** pick **"Websites"** (HTTP-referrer — browser keys only) or the
       Android / iOS options; they don't apply to a backend key.

### Field-name gotcha (Places API New)

The review-count field is **`userRatingCount`** in the Places API (New). The
legacy name `userRatingsTotal` does **not** exist in the New API — requesting it
in the field mask makes the endpoint return **HTTP 400 `INVALID_ARGUMENT`**, and
the adapter then degrades to an empty result (no rating, no count, no snippets).
If Google reputation comes back empty for a place you know has reviews, verify
the field mask first. (Fixed in the adapter; a regression test pins the field
mask.)

### Cost gotcha

Requesting the `reviews` field puts the call in Google's most expensive Place
Details SKU (Enterprise + Atmosphere). Our volume is low by design (a weekly
cron, manual owner refresh, and TTL caching), so it stays inside the monthly
free credit, but be aware the `reviews` field is the costly one. Verify current
pricing at <https://developers.google.com/maps/billing-and-pricing/pricing>.

### Resolving a real Place ID (for testing / seeding)

The adapter resolves the Place ID from the listing URL: it looks for
`place_id=ChIJ…` or any `ChIJ…` token. To find the Place ID of a real business
with the same key, call the **Text Search (New)** endpoint:

```bash
curl -s -X POST 'https://places.googleapis.com/v1/places:searchText' \
  -H 'Content-Type: application/json' \
  -H "X-Goog-Api-Key: $HOSPEDA_GOOGLE_PLACES_API_KEY" \
  -H 'X-Goog-FieldMask: places.id,places.displayName,places.googleMapsUri' \
  -d '{"textQuery": "Hotel <name> Colón Entre Ríos Argentina"}'
```

The returned `places[].id` is the Place ID (`ChIJ…`); store it as the listing's
`externalId`, or use a Maps URL containing `place_id=<id>` as the listing URL.

---

## 2. Apify token

[Apify](https://apify.com) runs the Booking/Airbnb scrapers in its cloud; we call
it with a personal API token. The token is the Apify-side credential; the actor
slugs (below) pick *which* scraper runs.

### Steps

1. Create an account at <https://apify.com> (the free plan includes a small
   monthly usage credit — enough for our low refresh volume).
2. Open the **Apify Console** → **Settings → API & Integrations** (or the account
   menu → *Integrations*) → **Personal API tokens**.
3. Copy the token (starts with `apify_api_…`). Set it as `HOSPEDA_APIFY_TOKEN`.

> The token alone does nothing until you also set at least one actor slug
> (`HOSPEDA_APIFY_BOOKING_ACTOR` / `HOSPEDA_APIFY_AIRBNB_ACTOR`).

## 3. Apify Booking actor

Set `HOSPEDA_APIFY_BOOKING_ACTOR` to a Booking.com scraper actor slug
(`<org>/<actor>`). Recommended: **`voyager/booking-scraper`** — the most-used
Booking actor on the Apify Store (millions of runs), `PAY_PER_EVENT` pricing.

The Booking adapter only uses this as a **fallback**: it first tries a direct
SSRF-safe fetch + JSON-LD `aggregateRating` (no Apify cost). The actor runs only
when the direct fetch is blocked. The adapter sends
`{ startUrls: [{ url: <listing.url> }] }` and reads aggregate fields
(`rating` / `reviewScore` / `guestRating`, `reviewsCount` / `numberOfReviews`)
from the first dataset item. Review text is never read (AC-7.1).

To discover/compare actors with your token:

```bash
curl -s "https://api.apify.com/v2/store?search=booking&limit=8" \
  | python3 -c "import json,sys;[print(a['username']+'/'+a['name']) for a in json.load(sys.stdin)['data']['items']]"
```

## 4. Apify Airbnb actor

Set `HOSPEDA_APIFY_AIRBNB_ACTOR` to an Airbnb scraper actor slug. Recommended:
**`tri_angle/airbnb-scraper`** — the most-used Airbnb actor on the Store,
`PAY_PER_EVENT`. The adapter sends `{ startUrls: [{ url: <listing.url> }] }` and
reads `rating` / `starRating` / `guestSatisfactionOverall` and
`reviewsCount` / `numberOfReviews` / `reviewCount` from the first dataset item.
Review text is never read (AC-7.1).

### Cost / plan note

Both recommended actors are `PAY_PER_EVENT` (billed per result, no fixed monthly
rental), so they work on the Apify **Free** plan within its monthly platform
credit. Our refresh volume is low (manual owner refresh + weekly cron, one run
per listing), so cost stays minimal. Some actors require accepting their terms
once in the Apify Console before the first run.

---

## Where to set the values

### Local (worktree / dev)

Add to the API app's `apps/api/.env.local` (gitignored), then restart the API:

```bash
HOSPEDA_GOOGLE_PLACES_API_KEY=AIza...
HOSPEDA_APIFY_TOKEN=apify_api_...
HOSPEDA_APIFY_BOOKING_ACTOR=<org>/<actor>
HOSPEDA_APIFY_AIRBNB_ACTOR=<org>/<actor>
```

### Staging / Production (Coolify)

Set on the API app (`hospeda-api-staging` / `hospeda-api-prod`) via the Coolify
UI (*Environment Variables*) or `hops env-set api KEY VALUE --secret` from the
VPS, then redeploy. Keys are secret; the actor slugs are not.

---

## Owner-facing identifiers

To use the feature, an accommodation owner registers, per platform, a link to
their own listing. They need:

- **Google** — their place on Google Maps (the panel accepts the Maps share URL
  or a `place_id`).
- **Booking** — the public URL of their Booking.com property page.
- **Airbnb** — the public URL of their Airbnb listing.

This is documented in-product in the owner reputation panel (help text / links).
See the [in-product help section](#owner-facing-identifiers) implementation in
`apps/web/src/components/host/ExternalReputationSection.client.tsx`.

<!-- TODO: link the exact help copy once the in-product guidance ships -->
