---
spec-id: SPEC-257
title: Accommodation import short-link resolution + adapter enrichment
type: improvement
complexity: medium
status: completed
created: 2026-06-22T02:36:01Z
---

# SPEC-257 — Accommodation import short-link resolution + adapter enrichment

> Follow-up of **SPEC-222** (accommodation import from URL). The real Chrome smoke of
> SPEC-222 left three loose ends that this spec closes. Reference merged PRs:
> **#1747** (safe-fetch undici-7 fix), **#1748** (SPEC-222 nested-form + notice + resolver base).

## 1. Overview

### Goal

Make accommodation import work end-to-end for the link forms hosts actually paste:

- **(A) Google Maps mobile share links** (`https://maps.app.goo.gl/XXX`) — resolve them to
  their canonical `https://www.google.com/maps/place/Name/@lat,lng/...` URL so the existing
  Google Places Text Search path can enrich the draft.
- **(B) Booking share links** (`https://www.booking.com/Share-XXX`) — NOT resolvable
  server-side (AWS-WAF JS challenge). Resolve by UX: instruct the host to paste the canonical
  `booking.com/hotel/...` URL via the import help panel.
- **(C) Airbnb adapter** — enrich the output mapping with `summary`, `amenities[]` and `beds`
  (fields currently absent from the mapping), validated against the real Apify actor output.
- **(D) Import in the user's locale** — imports currently return source-language (English)
  data, which makes the feature low-value for the es/pt market. `ImportContext.locale` already
  flows from the request; pass it to the sources that support native localization (Google Places
  `languageCode`, Airbnb `?locale=`). No machine translation — native source data falls back to
  the source language when unavailable. (Added 2026-06-22 on owner request.)

### Motivation

SPEC-222 shipped the import pipeline, but short-link resolution never closed e2e:

1. `resolveCanonicalUrl()` calls `safeExternalFetch({ maxBytes: 512 })`. `safeExternalFetch`
   follows the redirect chain but only returns `finalUrl` when the **terminal page body fits
   within `maxBytes`**. The canonical Google Maps page is a large HTML document, so the 512-byte
   cap fires on the terminal response → result is `SafeFetchBlocked` → `finalUrl` is lost →
   the resolver falls back to the original short link → the Google adapter sees a short link it
   cannot parse → import degrades to an empty `{ sourcePlatform: 'google' }`.
2. The Airbnb adapter maps most fields but omits `summary`/`amenities`/`beds`, so imported
   Airbnb drafts under-populate the listing.

### Success criteria

- Pasting `https://maps.app.goo.gl/dCaudGsZ8r9fKvWk9` (owner test case: "Cheroga") into
  `/es/publicar/nueva/` prefills name + coordinates from Google Places, with the
  "Importado · NN% · ..." badge, verified in a real Chrome smoke.
- `safeExternalFetch` exposes a resolve-only mode that returns the resolved URL of a redirect
  chain **without reading the terminal page body**, covered by a NON-mocked integration test.
- The import help panel tells Booking users to paste the canonical `booking.com/hotel/...` URL
  (not the `Share-XXX` link), in es/en/pt.
- An Airbnb import maps `summary`, `amenities[]` and `beds` when the Apify actor returns them,
  verified against the owner test URL `https://www.airbnb.com.ar/rooms/817515602448448452`.

## 2. User Stories & Acceptance Criteria

### US-1 — Host imports from a Google Maps mobile share link

**As a** host, **I want** to paste the `maps.app.goo.gl/...` link I copied from the Google Maps
mobile app, **so that** my listing is prefilled from the place data.

- **AC-1.1** — GIVEN a `maps.app.goo.gl/XXX` URL that 3xx-redirects to a canonical
  `www.google.com/maps/place/Name/@lat,lng/...` URL, WHEN the host submits the import,
  THEN the service resolves it to the canonical URL **without fetching/reading the terminal
  Google Maps page body**, routes it to `GooglePlacesAdapter`, and the draft is prefilled with
  the place name and coordinates.
- **AC-1.2** — GIVEN the resolved canonical URL contains a place name and `@lat,lng`, WHEN the
  Google Places Text Search succeeds, THEN `name` and `location.coordinates` are populated and
  the source label is `google`.
- **AC-1.3** — GIVEN the short link cannot be resolved (network error, SSRF block, no redirect),
  WHEN import runs, THEN it degrades gracefully to the previous behavior (no crash; draft may be
  empty) — never a 5xx.

### US-2 — `safeExternalFetch` resolve-only mode

**As a** developer, **I want** a resolve-only mode on `safeExternalFetch`, **so that** I can
discover where a redirect chain lands without downloading a large/hostile terminal page.

- **AC-2.1** — GIVEN `safeExternalFetch({ url, resolveOnly: true })`, WHEN the URL is a 3xx
  redirect, THEN the function follows the redirect chain (running all SSRF checks per hop, same
  as today) and returns `{ ok: true, status, finalUrl }` for the **terminal (non-redirect)
  response without reading its body**. `body` is the empty string.
- **AC-2.2** — GIVEN `resolveOnly: true` and the URL is already a non-redirect (2xx) response,
  THEN it returns `{ ok: true, status, finalUrl: <input url>, body: '' }` without downloading
  the body.
- **AC-2.3** — GIVEN `resolveOnly: true`, THEN `maxBytes` is NOT applied to the terminal
  response (no body is read), so a large terminal page does NOT produce `SafeFetchBlocked`.
- **AC-2.4** — GIVEN `resolveOnly: true` and the redirect chain exceeds `maxRedirects`, THEN it
  returns `SafeFetchBlocked` (same hard cap as default mode).
- **AC-2.5** — The default behavior (`resolveOnly` absent/false) is byte-for-byte unchanged:
  body is streamed and capped, `finalUrl` and `body` returned as before.

### US-3 — Booking share-link guidance

**As a** host with a Booking `Share-XXX` link, **I want** clear guidance, **so that** I know to
paste the canonical hotel URL instead.

- **AC-3.1** — The import help panel's Booking entry instructs the host to open the property
  page and copy the browser URL (`booking.com/hotel/...`), explicitly noting that a shared
  `Share-...` link will not work.
- **AC-3.2** — The copy exists in es, en and pt and renders without missing-key warnings.

### US-4 — Airbnb enrichment

**As a** host importing from Airbnb, **I want** the description summary, amenities and bed count
imported, **so that** my draft is more complete.

- **AC-4.1** — GIVEN the Apify Airbnb actor returns a `summary`/`publicDescription` field, WHEN
  the adapter maps the result, THEN `RawExtraction.summary` is populated.
- **AC-4.2** — GIVEN the actor returns an amenities array, THEN `RawExtraction.amenityNames` is
  populated (and flows through the existing amenity resolver).
- **AC-4.3** — GIVEN the actor returns a `beds` count, THEN `RawExtraction.extraInfo.beds` is
  populated.
- **AC-4.4** — GIVEN any of those fields is absent from the actor payload, THEN the mapping
  omits it cleanly (no `undefined`/empty injection); existing mapped fields are unaffected.

## 3. Technical Approach

### A — `safeExternalFetch` resolve-only mode

**File:** `packages/utils/src/safe-fetch.ts`

1. Add `readonly resolveOnly?: boolean;` to `SafeFetchInput` (default `false`), with JSDoc:
   "Follow redirects and return the terminal URL without reading its body. `maxBytes` is not
   applied to the terminal response."
2. In `_doFetch`, the existing `while (true)` redirect loop already classifies 3xx vs terminal.
   On the **terminal (non-redirect)** branch: when `resolveOnly` is true, skip `readBodyCapped`,
   dump/cancel the body stream, and return `{ ok: true, status, body: '', finalUrl: currentUrl }`.
   The agent-destroy lifecycle fix from #1747 must be preserved (destroy AFTER returning the
   terminal result, inside the same try whose finally destroys the agent — do not regress the
   undici-7 "client is destroyed" bug).
3. The redirect-following branch is unchanged (dump redirect body, read `Location`, re-run SSRF
   checks, decrement hop counter).

**File:** `packages/service-core/src/services/accommodation-import/accommodation-import.service.ts`

4. Rewire `resolveCanonicalUrl()` to call
   `safeExternalFetch({ url: inputUrl, timeoutMs, maxRedirects: 5, resolveOnly: true })`.
   Drop `maxBytes: 512`. On `ok && finalUrl !== inputUrl` return `finalUrl`; otherwise return
   `inputUrl` (unchanged fallback semantics). The rest of the orchestration (Step 1b →
   `detectSource` → `_pickAdapter` → `extract` on the effective URL) is untouched.

### B — Booking help-panel copy

**Files:** `packages/i18n/src/locales/{es,en,pt}/host.json`

5. Update `host.importFromUrl.help.platforms.booking.steps` to instruct copying the canonical
   `booking.com/hotel/...` browser URL and to warn that a `Share-...` link won't work. Keep the
   `.example` value canonical. Optionally clarify the Google entry that the mobile share link
   (`maps.app.goo.gl/...`) now works too. No component change — `ImportFromUrl.client.tsx`
   already renders these keys.

### C — Airbnb adapter enrichment

**File:** `packages/service-core/src/services/accommodation-import/adapters/airbnb.adapter.ts`

6. Extend the `AirbnbItem` interface with the optional fields the actor actually returns
   (candidates: `summary` / `publicDescription`, `amenities` / `amenityIds`, `beds`). The exact
   field names MUST be confirmed against the real Apify actor output during the smoke (T — smoke
   task) before finalizing — do NOT add speculative fields.
7. In `mapItemToRawExtraction`, map the confirmed fields to `RawExtraction.summary`,
   `RawExtraction.amenityNames` (array of strings, fed to the existing amenities resolver) and
   `RawExtraction.extraInfo.beds`, each guarded so an absent field is omitted.

### Key files (summary)

| File | Change |
| --- | --- |
| `packages/utils/src/safe-fetch.ts` | add `resolveOnly` flag + terminal no-body branch |
| `packages/utils/test/safe-fetch.integration.test.ts` | add resolve-only test cases (real server) |
| `packages/service-core/.../accommodation-import.service.ts` | rewire `resolveCanonicalUrl` to `resolveOnly` |
| `packages/service-core/.../adapters/airbnb.adapter.ts` | enrich `AirbnbItem` + mapping |
| `packages/i18n/src/locales/{es,en,pt}/host.json` | Booking (+Google) help copy |
| service/adapter unit tests | resolver rewire + Airbnb mapping coverage |

### Patterns / constraints

- `safeExternalFetch` is the only sanctioned external fetch; no new HTTP libs.
- RO-RO, named exports, `import type`, no `any`, JSDoc on new exported surface.
- Google Places Text Search uses native `fetch` (trusted endpoint) — unchanged.
- i18n strings live only in `@repo/i18n`; never inline copy in the component.

### D — Import in the user's locale

**Files:** `packages/service-core/.../adapters/google-places.adapter.ts`,
`packages/service-core/.../adapters/airbnb.adapter.ts`

8. **Google Places**: `fetchTextSearch` adds `languageCode: ctx.locale` to the
   `places:searchText` body; the Place Details path appends `?languageCode=<locale>` to the
   `GET /v1/places/{id}` URL. Both omit the param when `ctx.locale` is absent.
9. **Airbnb**: a `withAirbnbLocale(url, ctx.locale)` helper appends `?locale=<code>` to the
   listing URL passed to the Apify actor, so Airbnb serves (and the actor scrapes) the localized
   page. Robust across actors.
10. **Booking**: stays covered by the canonical URL the host pastes (piece B copy) — its
    lang-code mapping (`en-us`/`pt-br`) is too brittle to force programmatically.

**AC-D.1** — a Google import with `ctx.locale='es'` requests `languageCode=es` on both API paths.
**AC-D.2** — an Airbnb import with a locale appends `?locale=<code>` to the actor's listing URL.
**AC-D.3** — when `ctx.locale` is absent, neither adapter adds a locale param (unchanged behavior).

## 4. Testing Strategy

- **Unit — safe-fetch (mocked allowed):** `resolveOnly` returns terminal URL without body;
  default mode unchanged; redirect-cap still blocks under `resolveOnly`.
- **Integration — safe-fetch (NON-mocked, mandatory):** extend
  `safe-fetch.integration.test.ts` with a route chain `GET /short → 302 → /canonical(200, large
  body)` and assert `resolveOnly: true` yields `ok: true`, `finalUrl` ends with `/canonical`,
  `body === ''`, even when the terminal body exceeds `maxBytes`. This is the regression guard for
  the undici-7 class of bugs that mocks hid (see [[safefetch-undici7-prod-bug]]).
- **Unit — import service:** `resolveCanonicalUrl` returns the resolved URL for a redirecting
  short link and falls back to the input on failure; orchestration routes the resolved URL to
  the correct adapter.
- **Unit — Airbnb adapter:** `mapItemToRawExtraction` maps `summary`/`amenityNames`/`beds` when
  present and omits them when absent; existing mapped fields unchanged.
- **i18n:** the i18n suite passes (no missing keys across es/en/pt) after the host.json edits.
- **Manual Chrome smoke (the real gate):** web :4422, API :3102, DB worktree @ :5436. Google
  short link resolves + prefills (Cheroga); Airbnb URL prefills enriched fields; Booking help
  copy renders. Tests run one file at a time (`pnpm exec vitest run <path>`), never the full
  suite (OOM).

## 5. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| `resolveOnly` regresses the #1747 undici-7 agent-destroy fix | High (all safe-fetch breaks in prod) | Preserve agent-destroy ordering; mandatory non-mocked integration test |
| Apify Airbnb actor field names differ from assumptions | Medium (dead mapping) | Confirm against real actor output in smoke BEFORE finalizing the interface |
| Google still hangs if a short link expands via multiple hops to a body fetch | Medium | resolve-only never reads the terminal body; SSRF checks still run per hop; `maxRedirects: 5` |
| Booking copy change misleads if the canonical URL format shifts | Low | Keep example generic (`booking.com/hotel/...`); validate render in smoke |

## 6. Tasks (suggested)

- **Setup:** confirm worktree env + import rate limit (100/h) in `apps/api/.env.local`.
- **Core:** add `resolveOnly` to safe-fetch; rewire `resolveCanonicalUrl`; enrich Airbnb mapping;
  update Booking/Google i18n copy.
- **Integration:** non-mocked safe-fetch resolve-only test; service + adapter unit tests; i18n
  check.
- **Testing:** real Chrome smoke (Google/Airbnb/Booking) on local worktree env; confirm Airbnb
  actor fields.
- **Docs/cleanup:** update SPEC-222 cross-reference; PR to staging.

## Smoke Findings (2026-06-22) — scope expansion (piece E)

The real Chrome smoke validated piece A (Google short link resolves + prefills,
city auto-detected) and piece B (help copy), and surfaced deeper issues that were
fixed under this spec (owner-approved during the smoke):

- **Airbnb adapter was written for a different actor.** The configured `tri_angle`
  actor has no `summary`/`beds`/`bedrooms` top-level fields and returned English
  content. Re-mapped: locale via **actor input** (`{locale: 'es-AR'}`, NOT a `?locale=`
  URL param — that breaks the actor), `summary←metaDescription`, `locality←location`,
  capacity figures parsed from `subDescription.items` (es/en/pt), grouped amenities,
  `type` prefers `propertyType`.
- **Destination never auto-detected**: the hint passed `country` to the destination
  search, but `destinations` has no `country` column → DbError → zero candidates.
  Fixed: search by locality name only.
- **Type never prefilled**: free-text platform types didn't match the enum. Added
  `mapAccommodationType` (keyword heuristic, es/en/pt) in `mapRawToDraft`.
- **Google description empty**: added `editorialSummary` to the field mask (still
  empty for places Google has no blurb for — a source limitation, not a bug).
- **Auto-select destination (UI)**: the mini-form now pre-selects the best candidate
  (editable). Relaxes SPEC-222 AC-8.2 at the UI layer per owner request; the backend
  still never sets the destination FK.

Live status: Google e2e ✓ (name + city in es). Airbnb e2e ✓ in Spanish (name +
summary; the actor is anti-bot flaky on repeated runs — type/beds covered by unit
tests + a direct actor probe). Booking help copy ✓.

## Internal Review Notes

- **Strengthened during review:** the original handoff premise "Airbnb maps only the name" was
  wrong (adapter already maps name/description/type/coords/location/images/capacity/bed-bath/
  price); scope C narrowed to the genuinely-missing `summary`/`amenities`/`beds`, confirmed by
  codebase exploration. The Google "hang" was re-diagnosed as a body-cap `blocked` result losing
  `finalUrl`, not literally a page hang — the resolve-only design addresses both.
- **Open questions:** exact Apify Airbnb actor field names for summary/amenities/beds — resolved
  empirically in the smoke task before finalizing the `AirbnbItem` interface.
- **External docs:** Google Places Text Search v1 (`places:searchText`) path is unchanged and was
  validated in SPEC-222; no new external API surface introduced here.
