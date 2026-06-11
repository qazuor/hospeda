---
spec-id: SPEC-213
title: Web + Admin pre-beta polish & bugfix batch
type: bugfix
complexity: medium
status: draft
created: 2026-06-10T21:29:49Z
---

# SPEC-213 — Web + Admin pre-beta polish & bugfix batch

## Overview

**Goal.** Fix a curated batch of 17 pre-beta defects and polish items across the
Web app (Astro) and Admin app (TanStack Start), surfaced during manual QA. Each
item is small and independently shippable. The batch is organized by phase so it
can be reviewed and merged incrementally.

**Motivation.** These are visible, user-facing rough edges (broken pages, raw i18n
keys, untranslated labels, oversized UI, confusing copy) that must be clean before
the beta. None require architectural change.

**Success criteria.** Every item below has a passing acceptance criterion and (where
the layer allows) an automated test. No regressions in existing suites. All file
references in this spec are against `origin/staging` (the implementation baseline).

**Baseline note.** This spec was authored from a worktree cut from `staging`
(`origin/staging` @ 446aa9152). Three originally-listed items were pulled into their
own specs (see Out of Scope): A3 (editable prompt rules), W16 (destination weather),
M1 (owner-superset entitlements).

---

## Phase 1 — Schema & data

### W3 — Add accommodation types: Apart Hotel, Estancia, Bed & Breakfast

**Context.** Current enum has 10 values: `APARTMENT, HOUSE, COUNTRY_HOUSE, CABIN,
HOTEL, HOSTEL, CAMPING, ROOM, MOTEL, RESORT`. Add three new values.

**Fix / touched files:**
- `packages/schemas/src/enums/accommodation-type.enum.ts` — add `APART_HOTEL`, `ESTANCIA`, `BED_AND_BREAKFAST`.
- `packages/db/src/schemas/enums.dbschema.ts` — `AccommodationTypePgEnum` auto-derives via `enumToTuple`; no manual edit, but a migration is required.
- DB migration — `ALTER TYPE accommodation_type_enum ADD VALUE ...` per new value (use `packages/db/scripts/generate-enum-migrations.ts`). Two carriles aware: this is a structural change → `pnpm db:generate` + `pnpm db:migrate`.
- i18n labels — add keys in `packages/i18n/src/locales/{es,en,pt}/common.json` under `enums.accommodationType` (keys: `apart_hotel`, `estancia`, `bed_and_breakfast`).
- i18n type pages — add matching entries in `packages/i18n/src/locales/{es,en,pt}/accommodations.json` `types` block (used by `accommodations.typePage`).
- Filter sidebars — add the three options to the hardcoded `types` arrays in `apps/web/src/pages/[lang]/alojamientos/index.astro` AND `apps/web/src/pages/[lang]/alojamientos/mapa.astro`.
- Seed — extend `PooledAccommodationType` in `packages/seed/src/data/accommodation/_image-pool.ts` if seed examples are added (optional; can be excluded like MOTEL/RESORT).

**Acceptance criteria.**
- GIVEN the accommodation type enum, WHEN inspected, THEN `APART_HOTEL`, `ESTANCIA`, `BED_AND_BREAKFAST` are present.
- GIVEN the listing filter (list and map views) in es/en/pt, WHEN the type filter is opened, THEN the three new types appear with translated labels (no raw keys).
- GIVEN a migration run on a clean DB, WHEN `pnpm db:migrate` runs, THEN the enum accepts the three new values.

**Tests.** Schema/enum unit test asserting the three values exist; i18n key-presence test (es/en/pt) for the new label keys.

---

## Phase 2 — Server & data bugs

### W6 — Destination accommodations page does not load

**Root cause (confirmed).** `apps/web/src/pages/[lang]/destinos/[slug]/alojamientos/index.astro:36`
reads `result.data.total`, but `PaginatedResponse` exposes `result.data.pagination.total`.
The field is `undefined` → total renders 0 / page mis-renders.

**Fix.** Use `result.data.pagination.total` (and `result.data.pagination.totalPages`),
mirroring `apps/web/src/pages/[lang]/alojamientos/index.astro:203`.

**Acceptance criteria.** GIVEN a destination with N published accommodations, WHEN the
page loads, THEN it renders the N accommodations and the correct total/pagination.

**Tests.** Component/integration test for the page asserting it reads `pagination.total`; regression test reproducing the `undefined` read.

### W4 — Map view returns 500 on pan/zoom

**Root cause (to confirm during impl).** The 500 is NOT on initial load. It fires when
the user pans/zooms: `apps/web/src/hooks/useViewportSearch.ts` (~L68) calls
`accommodationsApi.list({ bboxNorth, bboxSouth, bboxEast, bboxWest, ... })` against the
public API. Hypothesis: the accommodation list endpoint mishandles/validates the bbox
params (note `INVALID_PAGINATION_PARAMS` referenced in `mapa.astro`). Diagnose the real
API error first, then fix.

**Fix.** Diagnose the API-side failure (validation or unhandled exception on bbox geo
filter) in the accommodation list route; correct the param handling so viewport search
returns 200 with the filtered set.

**Acceptance criteria.** GIVEN the listing in map view, WHEN the user pans/zooms, THEN
the viewport search returns 200 and updates markers; no 500.

**Tests.** API integration test for the list endpoint with bbox params (valid + invalid bounds → typed 4xx, never 500). Regression test for the exact failing case.

### W11 — Post category chips 404 (casing mismatch)

**Root cause (confirmed).** Events: no bug. Posts: category chips in
`apps/web/src/pages/[lang]/publicaciones/index.astro` (L285–293) link with UPPERCASE
slugs (`/publicaciones/categoria/CULTURE/`), but the route lookup map in
`apps/web/src/pages/[lang]/publicaciones/categoria/[category]/index.astro` (L27–32) uses
lowercase keys → `VALID['CULTURE']` is `undefined` → 404 on every chip.

**Fix.** Normalize casing (emit lowercase slugs in chip hrefs OR lowercase before the
lookup). Additionally, add the 7 enum categories missing from the sidebar filter
(`NIGHTLIFE, TRADITIONS, ART, BEACH, RURAL, FESTIVALS, GENERAL`).

**Acceptance criteria.**
- GIVEN any post category chip, WHEN clicked, THEN the category page loads (no 404).
- GIVEN the posts filter sidebar, WHEN opened, THEN all enum categories are offered.

**Tests.** Unit test for the slug↔enum normalization covering all 18 values; integration test that each chip href resolves.

### W8 — Services filter shows raw i18n object on map view

**Root cause (confirmed).** `apps/web/src/pages/[lang]/alojamientos/mapa.astro` (~L204/L211)
passes raw `I18nText` objects (`a.name`, `f.name`) as chip `label`, rendering
`[object Object]`. The list view (`index.astro` L401/L418) already wraps with
`resolveI18nText(..., locale)`.

**Fix.** Wrap amenity/feature names with `resolveI18nText(name, locale)` in `mapa.astro`,
matching `index.astro`.

**Acceptance criteria.** GIVEN the map view filter in es/en/pt, WHEN the services/amenities
filter is opened, THEN every chip shows translated text (no `[object Object]`, no raw key).

**Tests.** Snapshot/unit test for the filter-options builder asserting string labels.

---

## Phase 3 — i18n & copy

### W2 — Signin error messages leak English

**Root cause (confirmed).** `apps/web/src/components/auth/SignIn.client.tsx` already routes
errors through `translateApiError` (priority: reason → code → raw message → fallback).
Better Auth credential errors (e.g. "Invalid email or password") may carry a code not
present in `common.apiError.*`, so the raw English message leaks. NOT a duplicate of
SPEC-183 (which confirms SignIn is wired but does not cover this key gap).

**Fix.** Map the relevant Better Auth error codes/messages to `common.apiError.*` keys in
`packages/i18n/src/locales/{es,en,pt}`, so credential errors render translated.

**Acceptance criteria.** GIVEN an invalid-credentials signin in es/en/pt, WHEN it fails,
THEN the error shows the localized message (no English leak).

**Tests.** Unit test for `translateApiError` with Better Auth credential-error inputs across es/en/pt.

### W9 — Plan entitlement labels (AI features) untranslated

**Root cause (confirmed on staging).** `ai_text_improve`, `ai_chat`, `ai_search` are ALL
absent from `billing.json` (es/en/pt) → they fall back to English config names.
`can_embed_video` exists but with the typo "Embedeer".

**Fix.** Add the three keys to `packages/i18n/src/locales/{es,en,pt}/billing.json` under
`entitlement`, and fix the `can_embed_video` typo. Proposed ES (confirmed with user):
- `ai_text_improve` → "Mejora de textos con IA"
- `ai_chat` → "Consultas sobre el alojamiento con IA"
- `ai_search` → "Búsqueda inteligente"
- `can_embed_video` → "Videos en tu publicación" (fix typo)

EN/PT equivalents added in the same change.

**Acceptance criteria.** GIVEN the plans page in es/en/pt, WHEN AI features are shown, THEN
all four render localized text (no English fallback, no typo).

**Tests.** i18n key-presence test for the four keys in all three locales.

### W10 — Price breakdown shows raw fee/discount keys

**Root cause (confirmed).** `apps/web/src/components/accommodation/PricingSidebar.astro`
(~L160) renders the raw schema key (`cleaning`, `tax`, `weekly`, `lastMinute`) instead of a
translated label. Admin-side translations exist (`admin-pages.json`) but the public
component does not use them.

**Fix.** Add public fee/discount label keys in
`packages/i18n/src/locales/{es,en,pt}/accommodations.json` (covering all fee keys:
`cleaning, tax, lateCheckout, pets, bedlinen, towels, babyCrib, babyHighChair, extraBed,
securityDeposit, extraGuest, parking, earlyCheckin, lateCheckin, luggageStorage, others`
and discount keys: `weekly, monthly, lastMinute, others`) and translate each fee/discount
row in `PricingSidebar.astro` via `t()`.

**Acceptance criteria.** GIVEN an accommodation with fees/discounts, WHEN the breakdown is
expanded in es/en/pt, THEN each row shows a translated label (no raw English key).

**Tests.** Unit test for the fee/discount label resolver; i18n key-presence test for all fee/discount keys.

---

## Phase 4 — UX behavior

### W1 — AI search: prompt login proactively for guests

**Root cause (confirmed on staging).** `apps/web/src/components/ai-search/AiSearchPanel.client.tsx`
shows a passive idle hint to guests, but only acts on SEND: `handleAnonymousSubmit` (~L150)
redirects straight to login. User wants the login message + CTA shown **proactively when the
guest opens the panel**, before they type/send, to avoid wasted effort.

**Fix.** For unauthenticated users, on panel open show the login message + sign-in/register
CTA up front (reuse `apps/web/src/components/auth/AuthRequiredPopover.client.tsx`, already
used by `FavoriteButton`) and block the input/send. Keep the existing PostHog
`AiSearchLoginPrompted` tracking.

**Acceptance criteria.** GIVEN a guest, WHEN they open the AI search panel, THEN they
immediately see a "log in to use this" message with sign-in/register CTAs and cannot submit
a query; the CTA returns them to the current URL after auth.

**Tests.** Component test: guest open → CTA visible, input disabled/blocked, no API call.

### W13 — AI search: remove keyword fallback

**Root cause (confirmed).** No keyword/AI mode toggle exists. "Buscar por palabras clave"
appears only as a degradation fallback (network error / low-confidence) in
`AiSearchPanel.client.tsx` (~L351, L399, L407), navigating to `?q=`.

**Fix (user decision: remove completely).** Remove the "Buscar por palabras clave" fallback
button AND the low-confidence "mostrando resultados por palabras clave" notice. On AI
failure, show only the error state without the keyword fallback path.

**Acceptance criteria.** GIVEN an AI search error or low-confidence response, WHEN it
renders, THEN no "buscar por palabras clave" button/notice appears.

**Tests.** Component test for error + low-confidence states asserting the fallback is gone.

### W14 — Autofocus the chat/search input on open

**Root cause (confirmed).** AI search panel: textarea (`NlSearchInput.tsx`) has no autofocus.
Accommodation chat (`apps/web/src/components/accommodation/AiChatWidget.tsx`, focus effect
~L44–56) focuses the first focusable element, which is the expand button, not the textarea.

**Fix.** AI search: focus the textarea when the panel opens (focus effect on `isOpen`, or a
ref). Accommodation chat: focus the composer textarea instead of the expand button.

**Acceptance criteria.** GIVEN either chat/search panel, WHEN it opens, THEN the text input
is focused and ready to type.

**Tests.** Component test asserting `document.activeElement` is the textarea after open.

### W15b — Publish form redirect for `already_host`

**Root cause (confirmed).** `apps/web/src/components/host/CreatePropertyMiniForm.client.tsx`:
`created`/`resumed` already redirect correctly to `${adminBase}/accommodations/${id}/edit`
(L379). Only the `already_host` branch (L354–358) sends admin-capable users to the
`/accommodations` list. W15(c) "sees all accommodations" is NOT a data leak — the admin route
redirects hosts to `/me/accommodations` and the API forces `ownerId = actor.id` for
`VIEW_OWN`-only actors.

**Fix.** Redirect the `already_host` case to `/me/accommodations` (the host's own list)
instead of the global admin list.

**Acceptance criteria.** GIVEN an `already_host` submission, WHEN it completes, THEN the user
lands on their own accommodations list (`/me/accommodations`), never the global list.

**Tests.** Component test for the `already_host` branch asserting the redirect target.

---

## Phase 5 — Visual polish

### W5 — Footer subscribe button oversized when authenticated

**Root cause (confirmed).** `apps/web/src/components/newsletter/NewsletterForm.client.tsx` +
`NewsletterForm.module.css`: authenticated state renders a two-line `.authedEmail`, and
`.inputRow { align-items: stretch }` stretches `.submitButton` to match.

**Fix.** Constrain `.submitButton` height (e.g. `align-self: flex-start` or fixed height) so
it doesn't stretch with the taller authed sibling.

**Acceptance criteria.** GIVEN an authenticated user, WHEN the footer renders, THEN the
subscribe button is the same compact size as in the guest state.

**Tests.** Visual/regression note (CSS-only); covered by design review.

### W7 — Hero wave flicker on resize

**Root cause (confirmed).** `apps/web/src/components/sections/HeroSection.astro` `.hero__bg-wave`
uses a fixed `height: 160px` inside an `overflow: clip` hero; repaint race on resize causes a
one-frame gap. No JS animation involved.

**Fix.** Use a fluid height (clamp/percentage tracking hero rhythm) and add `will-change:
transform` on the wave wrapper to promote it to its own layer.

**Acceptance criteria.** GIVEN the homepage hero, WHEN the window is resized, THEN the wave
does not visibly flicker/gap.

**Tests.** Manual/design review (CSS-only).

### W12 — Sticky sidebar unreachable when taller than viewport

**Root cause (confirmed).** `apps/web/src/layouts/DetailLayout.astro` (`.detail-page__sidebar`,
L143–147) uses `position: sticky` with `align-self: start`; the sticky container equals the
sidebar's own height, so content below the fold is unreachable when the sidebar exceeds the
viewport. Shared across all entity detail pages (single layout). Below 1024px it already
falls back to static — desktop-only bug.

**Fix.** Add `max-height: calc(100vh - <top-offset>)` and `overflow-y: auto` to the sticky
sidebar so it scrolls independently.

**Acceptance criteria.** GIVEN a detail page whose sidebar is taller than the viewport, WHEN
the user scrolls, THEN the full sidebar content is reachable.

**Tests.** Manual/design review (CSS-only) across the entity detail pages.

### W15a — Publish form too close to footer

**Root cause (confirmed).** `apps/web/src/pages/[lang]/publicar/nueva.astro` `.nueva-form--compact`
(L485–487) overrides `padding-block` to `clamp(space-6, 5vw, space-10)` (~2.5rem) vs the
standard `--space-section` (~7.5rem), leaving the form near the footer.

**Fix.** Restore adequate bottom spacing on the form section (dedicated `padding-bottom` or
section-scale token).

**Acceptance criteria.** GIVEN the publish form page, WHEN rendered, THEN there is adequate
spacing between the form and the footer.

**Tests.** Manual/design review (CSS-only).

### A1 — Admin dialog close button oversized

**Root cause (confirmed).** `apps/admin/src/components/ui/dialog.tsx` (L84–91): `CloseIcon`
(from `@repo/icons`) defaults to 24px and the Tailwind `[&_svg:not([class*='size-'])]:size-4`
selector does not match it (the icon carries inline width/height), so the close X renders at
24px.

**Fix.** Pass `size="xs"` (16px) or `className="size-4"` to `<CloseIcon />` at L89.

**Acceptance criteria.** GIVEN any admin dialog using the default close button, WHEN rendered,
THEN the close X is 16px.

**Tests.** Component test asserting the close icon size class/prop.

### A2 — "Playground IA" sidebar item missing icon

**Root cause (confirmed).** `apps/admin/src/config/ia/sidebars.ts` (L915–926) declares
`icon: 'PlayIcon'`, but `PlayIcon` is not registered in `apps/admin/src/lib/nav-icon-map.ts`,
so `resolveNavIcon` returns `undefined` → no icon.

**Fix.** Register an appropriate icon in `NAV_ICON_MAP` (import + map entry). Recommended:
`SparkleIcon` or `AskToAiIcon` (clearer AI signal than Play). Update the sidebar entry to use it.

**Acceptance criteria.** GIVEN the admin Platform sidebar, WHEN rendered, THEN "Playground IA"
shows an icon consistent with its siblings.

**Tests.** Unit test asserting the nav icon resolves for the Playground entry.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| W3 enum migration on prod (ALTER TYPE ADD VALUE) | Medium | Structural migration via the two-carriles flow; test on clean DB; never `db:push` to VPS |
| W4 root cause is deeper than bbox validation | Medium | Diagnose the real API error first; add typed 4xx + regression test before fixing |
| W11 casing fix breaks existing inbound links | Low | Normalize at lookup (accept both cases) rather than only changing emitted slugs |
| W1 CTA blocking input regresses the (already shipping) AI search UX | Low | Reuse the proven `AuthRequiredPopover`; keep tracking event; component test |
| W9/W10 i18n keys missing in one locale | Low | Key-presence tests across es/en/pt in CI |
| CSS-only items (W5, W7, W12, W15a, A1) have no automated test | Low | Cover via design review across viewports |

## Out of Scope (pulled into their own specs)

- **A3** — Make AI prompt "rules" editable: migrate hardcoded rules out of
  `packages/ai-core/src/engine/default-prompts.ts` into a first-class DB field with
  admin editing. Architectural (DB migration + schema + ai-core storage/resolution +
  runtime composition for 3 features + admin UI). Own spec.
- **W16** — Destination weather data: feature does not exist; own spec.
- **M1** — Owner plans inherit tourist entitlements/limits (owner = superset of tourist).
  Billing/entitlements architecture; own spec.
- **A4/A5/A6** — PostHog/Sentry/Brevo dashboards in admin: deferred (not scheduled).
- **W15(c)** — "host sees all accommodations": confirmed NOT a bug (client guard +
  server `ownerId` enforcement). No change; documented here for traceability.

## Internal Review Notes

- **Strengthened:** W1 refined to proactive (on-open) login CTA per user; W13 confirmed as
  fallback removal (not a mode toggle); W9 corrected — all three AI keys missing (not only
  AI_CHAT); W10 confirmed as labels/i18n (not pricing logic); W15(c) confirmed not a leak.
- **Open questions for implementation:** W4 needs live diagnosis of the API 500 before the
  fix is finalized (root cause hypothesized, not proven). W3 third-type set assumed as
  Apart Hotel + Estancia + Bed & Breakfast.
- **Baseline:** all file refs verified against `origin/staging` @ 446aa9152 on 2026-06-10.
