---
title: Free and VIP promotions model (for everyone or VIP only, random quota, blurred cards, weekly VIP digest)
linear: HOS-2589
statusSource: linear
created: 2026-11-24
updated: 2026-11-24
type: feature
areas:
  - api
  - web
  - billing
  - db
  - content
related:
  - HOS-2564  # «Exclusiva para plan VIP» hint names plans by hand. Superseded by this spec
  - HOS-2273  # venue VIP-only promotions (Backlog). ABSORBED by this spec (D-4)
  - HOS-2590  # live leak of VIP-only accommodation promotions on the public endpoint. Separate bug, can ship first
  - HOS-21    # exclusive deals, `tourist_audience` column, `/mi-cuenta/ofertas-exclusivas`
  - HOS-2271  # public, session-blind venue promotions read
  - HOS-2101  # AI questions weekly digest (the pattern the VIP digest copies)
  - HOS-2579  # standardized listing detail pages (touches the promotions slot)
  - HOS-19    # per-viewer WhatsApp gate on a session-blind page (the island pattern reused here)
smokeGates:
  # Real email delivery of the weekly digest, the random quota against the real
  # catalog row, and the edge cache of the detail pages (the per-viewer read must
  # never be cached) are not observable in unit or e2e tests.
  - status-needs-smoke-staging
---

# Free and VIP promotions model

## 1. Summary

Owner promotions (accommodation and venue) get a new visibility model, decided by
the owner on 2026-11-24 (Linear comments on HOS-2564 of that date and the HOS-2589
description):

- The host chooses, per promotion, **«Para todos»** or **«Solo VIP»**.
- A **free tourist**, and an **anonymous visitor** (treated identically), sees up to
  **X** «para todos» promotions per page, picked at random and stable for the browser
  session. Every other promotion on that page is shown **blurred and not clickable**
  (discount value and type readable, place name unreadable). VIP-only ones carry a
  highlighted badge. Trying to open a blurred card explains why and invites the
  tourist to become VIP. No email.
- Choosing «Solo VIP» is gated by a new owner-side catalog entitlement, granted on
  every owner plan at launch. This spec absorbs HOS-2273 (venues get the option too).
- A new public page `/{lang}/promociones/` applies the same rules. Search result
  cards carry «Promo» / «VIP» badges, outside the quota.
- A **VIP tourist** sees every promotion and receives a **weekly digest** of the
  week's new promotions, only when there were some, and can turn it off.
- **X = 3**, one value for listings and detail pages, stored as a **catalog limit
  on the free tourist plan**. No code constant.
- The host sees a short explanation next to each option plus a new help article
  linked from the page's «?».

## 2. Problem

The toggle «Exclusiva para plan VIP» in the host promotion form does nothing
useful. The audience it was designed for, `tourist-plus`, was retired (HOS-1224),
so both positions reach the same paying audience in the gated list. Hosts get no
reach from promotions, and promotions do nothing to sell VIP. HOS-2564 asked only
to stop naming plans by hand in that hint. The owner replaced it with this model.

## 3. Goals

- G-1 One audience choice per promotion, explained in the form and in a help article.
- G-2 One visibility rule, applied identically on every surface that lists promotions.
- G-3 X lives in the catalog, so it changes without a deploy.
- G-4 A free tourist never receives the content of a promotion they cannot see.
- G-5 VIP tourists get a weekly digest of new promotions, with an opt-out.
- G-6 Every public page stays session-blind.

## 4. Non-goals

- NG-1 Changing who is VIP. VIP is whatever the effective set says today
  (`tourist-vip` plus `inherits_tourist_vip` inheritance).
- NG-2 Redemption or checkout flows for promotions. Promotions stay informational.
- NG-3 A different X per surface. The owner chose a single value.
- NG-4 Renaming the enum value `plus`. It stays as the DB value for «para todos».
- NG-5 Emails to free tourists.
- NG-6 Merging the VIP digest with the daily `alerts-digest` (see R-5).

## 5. Current baseline

Measured on `origin/staging` on 2026-11-24.

### 5.1 The audience column already exists

`owner_promotions.tourist_audience` (`packages/db/src/schemas/owner-promotion/owner_promotion.dbschema.ts`),
enum `TouristAudienceEnum` (`packages/schemas/src/enums/tourist-audience.enum.ts`),
`NOT NULL DEFAULT 'plus'`, indexed. Values: `plus` (every entitled tier) and `vip`.
The enum's own docblock already says that `plus` is a property of the deal and
that no buyable tier lands on `plus` without also having VIP access.

The host form maps the checkbox to it:
`apps/web/src/components/host/promotion-form-state.ts:73` (`vipOnly: touristAudience === 'vip'`)
and `:119` (`touristAudience: vipOnly ? 'vip' : undefined`), rendered in
`apps/web/src/components/host/PromotionFormFields.tsx:264-276`, with texts
`host.promotions.fields.vipOnly` and `vipOnlyHint_one|_other|NoPlans` in
`packages/i18n/src/locales/{es,en,pt}/host.json` (es: lines 907-910).

Venue promotions accept only `plus`:
`packages/schemas/src/entities/ownerPromotion/owner-promotion.venue.schema.ts:127-132`
(`z.literal(PLUS)`, comment «`vip` enters with the VIP-promotions leaf (HOS-2273)»).
The venue form has no audience control.

### 5.2 Who sees promotions today (corrects the assumed background)

The assumption «owner promotions are only visible to tourists with
`exclusive_deals`» holds **only for the gated account list**. Promotions are also
public on the detail pages:

| Surface | Source | Audience filter | Session |
|---|---|---|---|
| `/mi-cuenta/ofertas-exclusivas` (`ExclusiveDealsList.client.tsx`) | `GET /protected/owner-promotions/exclusive-deals` (`apps/api/src/routes/owner-promotion/protected/exclusive-deals.ts`) | Gate `exclusive_deals` (TOURIST vertical), then `vip_promotions_access` → `[plus, vip]`, otherwise `[plus]` | Protected |
| Accommodation detail `alojamientos/[slug].astro:254,325,675,724` → `PromotionBanner.astro` | `GET /public/owner-promotions?accommodationId=` → `OwnerPromotionModel.findActiveForAccommodation` (`packages/db/src/models/owner-promotion/ownerPromotion.model.ts:234-262`) | **None**. `vip` rows are returned and rendered with full discount | SSR, public |
| Venue detail `comer-y-salir/[slug].astro:146-159,407` → `VenuePromotions.astro` | `GET /public/venues/{id}/promotions` (`apps/api/src/routes/venue/public/getPromotions.ts`) → `findActiveForVenue` | `plus` only (`ownerPromotion.venue.model.ts:112`) | SSR, public |
| Venue cards in listings and search (`VenueCard.astro:164`, `VenuePromoBadge.client.tsx`) | `promoBadge` from `findVenueIdsWithActivePromo` (`ownerPromotion.venue.model.ts:20-87`) | Presence only: «Promo» / «Promo VIP» / «Ahora» | SSR, public |
| Accommodation cards and search | none | (no promotion data at all) | |

Two consequences:

- **Leak today.** Any `vip` accommodation promotion is served in full to anonymous
  visitors by `/public/owner-promotions` and SSR-rendered on the detail page
  (`OwnerPromotionPublicSchema` does not even carry `touristAudience`, so the
  banner cannot tell them apart). It is tracked as the separate bug **HOS-2590**,
  which can ship first. This spec's end state also closes it (AC-10), but it is live
  now.
- **There is no public promotions page.** The only promotions list is the gated
  account page. The digest's «link to the site's promotions page» and the
  «promotion listings» the free tourist browses need one (D-2).

### 5.3 Catalog

- Keys: `exclusive_deals` and `vip_promotions_access` are entitlement rows in
  `packages/schemas/src/catalog/entitlement-keys.ts:52,55` and
  `key-enums.ts:41,44`. Limit keys live in `limit-keys.ts`.
- Current plan values (`scripts/production-catalog/catalog.ts`): `tourist-vip`
  (line 1341) has both keys. The tourist `floor` plan «Turista Free» (line 1753) has
  neither, and its limits are `max_favorites`, `max_ai_search_per_month` and
  `max_ai_chat_consumer_per_month`. Every paid owner plan has
  `inheritsTouristVip: true` (for example line 43), which is how owners reach the
  TOURIST keys (`packages/verticals/src/effective-set/tourist-vip-inheritance.ts`).
  Owner plans also list the two keys in their own vertical, but the gate reads the
  TOURIST vertical only, and `packages/seed/src/catalog/next-version-entitlements.ts:85-88`
  already drops them from the next owner version.
- Catalog values are DB rows and change by publishing a plan version
  (`POST /admin/plans/{planId}/versions`, `apps/api/src/routes/plan-catalog/admin/index.ts:133`).
  Keys are code, and the key table travels as generated SQL in a migration (G18
  `scripts/check-catalog-sql.ts`). G3 fails on a key used but not in the catalog. G7
  (`check:commercial-values`) fails on a commercial value in code.
- Reading a limit for a user: `readEffectiveLimit` (`apps/api/src/utils/listing-access/user-gate.ts:106`)
  returns **0 on a failed lookup** (fail-closed).

### 5.4 Session-blind pages and the per-viewer pattern

`apps/web/test/pages/cacheable-pages-are-session-blind.guard.test.ts` makes every
page under `src/pages` session-blind by default (fail-closed, exemptions by path).
The precedent for a per-viewer fragment on a public page is the WhatsApp contact:
`GET /protected/accommodations/:id/whatsapp` (`apps/api/src/routes/accommodation/protected/getWhatsApp.ts`,
uncached, fail-closed) consumed by the island `WhatsAppContact.client.tsx`.

### 5.5 Email, preferences, cron, help

- Weekly digest pattern: `ai-questions-weekly-digest` (`apps/api/src/cron/schedules.manifest.ts:357`,
  `0 9 * * 1`; job `apps/api/src/cron/jobs/ai-questions-weekly-digest.job.ts`): skips
  empty weeks, opt-out by `settings.aiQuestionsDigest === false` or
  `settings.notifications.allowEmails === false`, locale from `languageWeb`,
  idempotency through a `notification_log` key per user and week. Template in
  `packages/notifications/src/templates/ai/ai-questions-weekly-digest.tsx`. Opt-out
  flag in `packages/schemas/src/entities/user/user.settings.schema.ts:158` (JSONB,
  no migration). Toggles UI: `apps/web/src/components/account/PreferenceToggles.client.tsx`.
- `alerts-digest` (`schedules.manifest.ts:114`, daily) already emails «promo
  offers» to tourists with price alerts (`PromoOfferEvaluatorService`,
  `packages/service-core/src/services/alert/promo-offer-evaluator.service.ts`). Price
  alerts are VIP-only in the catalog. That evaluator has no audience filter. There
  is **no** `activated_at` column; it approximates «new» with `createdAt OR updatedAt`.
- Help: `packages/help`. `page:mi-cuenta/promociones` is a `pending-content`
  exemption with `plannedArticle: "owner-promotions"` (`packages/help/coverage-exemptions.json:106`),
  and `entitlement:exclusive_deals` / `entitlement:vip_promotions_access` are
  `out-of-scope` exemptions (lines 27, 49). The body grammar has a
  `{{limit:<key>:<vertical>}}` token (`packages/help/src/tokens.ts`, example in
  `content/es/common/photos.md:71`). The promotion pages render `PageHelpLink`
  (`mi-cuenta/promociones/{index,nueva,[id]/editar}.astro`).

## 6. Decided model (owner, 2026-11-24)

Encoded as stated. Nothing here is up for redesign. The answers to the former open
questions are in §12 (D-1 to D-7) and are already folded into M-1 to M-6.

- **M-1 Host choice.** Per promotion: «Para todos» or «Solo VIP». Explanations:
  - Para todos: «Todos los turistas VIP la ven. Los turistas gratis ven hasta {X}
    promociones por página, elegidas al azar, así que a veces la ven y a veces no.»
  - Solo VIP: «Solo la ven los turistas VIP, y les avisamos por correo. Los turistas
    gratis la ven borrosa, con una invitación a hacerse VIP.»
  - {X} and the VIP plan name are read from the catalog, never written in the text.
  - A new help article covers the model with examples and answers «¿por qué un
    turista no vio mi promoción?».
  - Choosing «Solo VIP» requires the owner-side entitlement `vip_only_promotions`
    (D-4). Without it the option is shown locked.
- **M-2 Free tourist and anonymous visitor (same rule, D-1).** On each full-card
  surface (the `/promociones/` page, accommodation detail, venue detail) sees up to X
  «para todos» promotions picked at random. The pick is stable for the browser
  session and renewed in a new session (D-7). All other promotions on that page render
  blurred and not clickable; VIP-only ones have a highlighted badge. A blurred card
  shows the discount value and the promotion type, and a placeholder where the place
  name would be (D-5). Trying to open one shows: those are for VIP, free users see
  only X non-VIP promotions, with an invitation to become VIP. If a page has X or
  fewer «para todos» promotions, all of them are visible and only the VIP-only ones
  are blurred. No email.
- **M-3 VIP tourist.** Sees every promotion. Weekly digest of that week's new
  promotions with a link to `/promociones/`; sent only when there were new
  promotions; opt-out from notification preferences.
- **M-4 X = 3**, one value for the promotions page and the detail pages, a limit on
  the free tourist plan in the catalog.
- **M-5 Search results (D-6).** Each place's card shows a «Promo» badge when the place
  has at least one active «Para todos» promotion, and a «VIP» badge when it has at
  least one active «Solo VIP» promotion. The X quota does not apply to badges.
- **M-6 Existing promotions (D-3).** `tourist_audience = vip` rows are «Solo VIP»;
  every other row is «Para todos». No data change.

## 7. Proposed design

Items marked *(proposal)* are technical choices of this spec, open to review. Product
decisions are in §12; product gaps, if any, in §13.

### 7.1 Audience: reuse `tourist_audience` *(proposal)*

`plus` = «para todos», `vip` = «solo VIP». No structural change to the column and
no backfill (D-3): the host's choice already lives there, and the form default
(`plus`) is the «para todos» default. The venue schema literal
(`owner-promotion.venue.schema.ts:127-132`) is widened to the full enum (D-4).

### 7.2 Catalog keys *(proposal)*

| Key | Kind | Change | Use |
|---|---|---|---|
| `vip_promotions_access` | entitlement (TOURIST) | keep | **The VIP decision.** Present → sees everything, gets the digest. |
| `max_free_visible_promotions` | limit (new) | add `['max_free_visible_promotions', 'vertical', 'MAX', 'NONE', 'COMMERCIAL']` to `limit-keys.ts` + `LimitKeyEnum`; generated catalog SQL in a migration (G18) | **X.** Read only when `vip_promotions_access` is absent. |
| `vip_only_promotions` | entitlement (owner-side, new) | add `['vip_only_promotions', 'vertical', 'MAX', 'NONE', 'COMMERCIAL']` to `entitlement-keys.ts` + `key-enums.ts`; generated catalog SQL (G18); every use passes G3 | **May the owner choose «Solo VIP».** See below. |
| `exclusive_deals` | entitlement | stop gating on it | It meant «may see promotions at all», which is now everybody. The key and its plan rows are retired in a follow-up (expand/contract: plan rows reference it). |

**One key, not one per vertical.** Entitlement keys are scoped (`scope: 'vertical'`),
and the same key already serves several verticals through each vertical's own plan
rows: `create_promotions` is a single key used by accommodation and venue owners
alike, whereas per-vertical names exist only where the feature is genuinely
different (`edit_accommodation_info` vs `edit_venue_info`, `publish_*`). The
capability here is identical in both verticals, so one key `vip_only_promotions`
follows the catalog convention, avoids two rows to keep in sync, and lets the owner
restrict it later per plan (and per vertical, since plan versions are per vertical)
without a code change. It is named for the capability, not for a vertical (HOS-2273
planned the venue-only name `venue_vip_promotions`, which this replaces).

**Initial grant: every owner plan.** Each owner plan of the accommodation and venue
verticals gets a new published version with `vip_only_promotions` set, so on day one
the option behaves as «anyone can». Restricting it later is a catalog edit (publish a
version without the key), never a deploy. Mirrored in
`scripts/production-catalog/catalog.ts`; seed dual-write applies (§10). The owner-side
check reads the owner's own vertical effective set (not the TOURIST set).

The value 3 for X is written as a `plan_version_limit` row on a **new version of the
TOURIST `floor` plan**, published through the plan-catalog publish flow (or a
migration that inserts that version, whichever the catalog procedure of the day
prescribes), and mirrored in `scripts/production-catalog/catalog.ts`. The literal
never appears in `src`. Tests read it from fixtures built from the catalog.

**A role never decides.** The decision is `vip_promotions_access` on the TOURIST
effective set plus the limit (viewers) and `vip_only_promotions` on the owner's
effective set (authors), never a role or a plan slug.

**Fail-closed.** If the effective set cannot be read, `readEffectiveLimit` gives
0 and the entitlement reads false: everything blurred, nothing leaked. A missing
limit row also reads 0. That is visible in staging (smoke) and logged. For the owner
side, a failed read means «Solo VIP» is refused, never granted.

### 7.3 One pure resolver *(proposal)*

`resolvePromotionVisibility({ promotions, isVip, freeQuota, seed })` in
`@repo/service-core` (pure; a seeded PRNG derived from `seed` replaces a random source,
so tests are deterministic and a session-stable pick is possible, D-7):

1. VIP → every promotion `visible`.
2. Free or anonymous (same branch, D-1) → shuffle the `plus` promotions with the
   seeded PRNG, the first `freeQuota` are `visible`; every other promotion
   (remaining `plus` and all `vip`) is `locked`.
3. Output order: visible first, then locked `plus`, then locked `vip`.

The shuffle input is `seed` plus the promotion ids (sorted), so the same seed over
the same set gives the same pick, and a changed set gives a fresh pick.

«Per page» means per response the resolver is applied to: one detail page's
promotions, or one page of the `/promociones/` listing. The quota is not global and
does not carry across pages. It does **not** apply to search badges (D-6).

### 7.4 What a locked card may carry (G-4, D-5)

A locked item is `{ kind: 'locked', audience: 'plus' | 'vip', entityType,
discountType, discountValue, placeholderName }` plus an opaque, per-response index for
React keys.

- `discountType` and `discountValue` are sent (the card shows e.g. «30 %» and the
  promotion type).
- `placeholderName` is a **server-generated placeholder of similar length** to the real
  place name (same character count, filler letters derived from `seed` and the opaque
  index). The real name is never sent for a card the actor cannot see. The UI blurs
  the placeholder. It is not derived from the real name's letters.
- It carries **no** id, slug, entity id, title, description, conditions
  (`minNights`, dates, window), code, redemptions, owner or link.

Length similarity is an accepted, minor signal.

### 7.5 API

- **Per-actor reads (new or reshaped), uncached (`Cache-Control: private, no-store`,
  `Vary: Cookie`).** Because anonymous visitors take the same resolver path (D-1), the
  read must serve guests, so it cannot live in the `/protected/` tier (which requires
  a session). *(Proposal)* Put it in the public tier with an **optional actor**, the
  same way `/api/v1/public/auth/me` already answers per actor, and resolve the actor
  inside the handler:
  - `GET /api/v1/public/owner-promotions/visible?entityType=&entityId=&seed=` for one
    listing's promotions (detail pages, both verticals).
  - `GET /api/v1/public/owner-promotions/listing?page=&pageSize=&seed=` for the
    `/promociones/` page, paginated, `visible | locked` items.
  - `GET /api/v1/protected/owner-promotions/exclusive-deals` is retired by D-2 once the
    account page redirects; until the web stops using it, it applies the same resolver
    and drops the `exclusive_deals` gate.
  - All resolve the actor's TOURIST effective set once (`readEffectiveKeys` +
    `readEffectiveLimit`), treat a guest as «no VIP», and call the resolver.
- **`seed`** is an opaque client-generated string (no personal data). Missing or
  malformed → the server picks a fresh one (no stability, still correct).
- **The old public reads** (`/public/owner-promotions` and
  `/public/venues/{id}/promotions`) must stop returning promotion content to anonymous
  callers: either removed from the web's use and made to return only what the guest
  policy allows, or replaced by the reads above. Leaving them returning every
  promotion in full would make the quota a URL away. HOS-2590 is the standalone fix of
  that leak and can ship first; this spec must not regress it (AC-10, AC-27).
- **Search badges (D-6).** The accommodation and venue list/search reads add presence
  flags per place (`hasFreePromotion`, `hasVipPromotion`; venues already expose
  `promoBadge`, which maps onto them). Presence only, no content, so they stay in the
  cacheable public list responses and session-blind.
- **Author side.** The owner-promotion create and update services refuse
  `touristAudience = 'vip'` when the owner's effective set lacks `vip_only_promotions`,
  following the status/`error.code` pairs of `apps/api/docs/error-contract.md`. This
  is enforced server-side, the UI lock is only a hint. A catalog read for the form
  exposes whether the key is held (one flag in the existing owner entitlements read).
- **Admin and owner reads are unchanged**: the host still sees all their own
  promotions in full.
- Schemas: `PromotionVisibleItemSchema`, `PromotionLockedItemSchema`, and their
  discriminated union in `@repo/schemas` (`entities/ownerPromotion/`).

### 7.6 Web

- **Detail pages.** `PromotionBanner.astro` (accommodation) and `VenuePromotions.astro`
  (venue) stop receiving promotion data from SSR. The page renders a session-blind
  slot, and a client island (`client:visible`) fetches §7.5 and renders visible
  cards, locked cards and the upsell dialog. The detail frontmatter no longer calls
  the promotion endpoints. The guard test stays green with no new exemption.
- **Promotions page (D-2).** New public page `/{lang}/promociones/` (es/en/pt routes
  following the existing localized-route convention), **session-blind**: SSR renders
  only the shell (title, SEO copy, empty state container). The list is a client island
  over `GET /public/owner-promotions/listing`, with pagination. `/mi-cuenta/ofertas-exclusivas`
  redirects to it (301, preserving the locale). It is the digest's link target. Add it
  to the sitemap only as a shell (no promotion content in HTML).
- **Session-stable pick (D-7).** The island creates a random `seed` on first use and
  stores it in `sessionStorage` keyed per page/context (e.g. `promos:seed:<entityType>:<entityId>`
  and `promos:seed:listing`), wrapped in try/catch with an in-memory fallback when
  storage is unavailable. A new browser session has an empty storage, so the pick is
  renewed. The same `seed` is sent on every call for that context.
- **Search results (D-6).** Accommodation and venue cards in search and listings show
  a «Promo» badge (any «Para todos» promotion) and a «VIP» badge (any «Solo VIP»
  promotion), both when both exist. `VenueCard.astro` and `VenuePromoBadge.client.tsx`
  keep their «Ahora» badge, only the labels and the accommodation card are extended.
  No quota, no blur.
- **Upsell dialog.** It opens on click, Enter or Space on a locked card (cards are
  `aria-disabled`, focusable, with an accessible name such as «Promoción solo para
  VIP» or «Promoción oculta»). The text reads X and the VIP plan name from the
  catalog, and the CTA points to the existing VIP plans page.
- **Host form (accommodation and venue).** Replace the checkbox with a two-option
  radio group («Para todos» default, «Solo VIP»), each with the M-1 description.
  Delete `vipOnlyHint_*` and `resolvePromotionAudienceHint` (supersedes HOS-2564).
  - **Locked state.** If the owner's plan lacks `vip_only_promotions`, «Solo VIP» is
    rendered disabled with a lock icon, a short text («Disponible en planes
    superiores») and a link to the owner plans page, and the radio cannot be
    selected. An existing `vip` promotion on such an owner keeps its value; see OQ-8.
- **Reading X and the plan name in host and upsell texts.** A small public,
  session-blind catalog read that exposes the floor plan's
  `max_free_visible_promotions` value and the `tourist-vip` plan name. It reuses the
  plan-catalog public route family. No user data, so it is cacheable.

### 7.7 Weekly VIP digest

- **Cron** `vip-promotions-weekly-digest` in `schedules.manifest.ts`, category
  `notifications`, schedule `0 10 * * 1` (Monday 10:00 ART, one hour after the AI
  questions digest), job file named after it.
- **«New that week»** *(proposal)*: a promotion is new in week W when it **first
  became ACTIVE** inside W's window `[Monday 00:00, next Monday 00:00)` ART of the
  previous week, and at send time it is still `ACTIVE`, not deleted, and not expired
  (`validUntil` null or in the future). A future `validFrom` is shown as «desde …».
  Since there is no activation timestamp (§5.5) and `updatedAt` would count every
  edit as new, add a nullable `first_activated_at timestamptz` column (structural
  carril, `pnpm db:generate`), set once by the service when a promotion first goes
  ACTIVE, and backfilled to `created_at` for rows that are ACTIVE today. The backfill
  lives in the same migration (same column, so the expand/contract trap does not
  apply).
- **Both audiences** are included, since a VIP sees everything.
- **Recipients**: users whose TOURIST effective set has `vip_promotions_access`
  (own `tourist-vip` title or inheritance), with
  `settings.vipPromotionsDigest !== false` and
  `settings.notifications.allowEmails !== false`. Candidates are selected from live
  titles and then confirmed through the effective set, never by role or plan slug.
- **No empty email**: no new promotions in W means no send for anybody.
- **Idempotency**: `notification_log` key `vip-promotions-digest:<userId>:<weekKey>`.
- **Content**: up to N promotions *(proposal: the 10 most recent, plus «y X más»)*,
  each with title, benefit (`apps/web/src/lib/promotions/format-benefit.ts` logic
  moved or mirrored in the template), place name and link to the place, plus a main
  CTA to `/{lang}/promociones/` (D-2). Locale from `languageWeb` (es/en/pt).
  The template goes in `packages/notifications/src/templates/` following
  `ai-questions-weekly-digest.tsx`.
- **Opt-out**: new `vipPromotionsDigest: z.boolean().optional()` in
  `user.settings.schema.ts` (JSONB, no migration), a toggle in
  `PreferenceToggles.client.tsx` (shown only to VIP tourists), and an unsubscribe
  link in the email.

### 7.8 Help article

New article `owner-promotions` (`packages/help/content/es/host/`, audiences host and
provider/venue owner): the two options, the random quota (`{{limit:max_free_visible_promotions:tourist}}`),
the blurred cards (what a free visitor sees: value and type, not the place name), the
«Promo» / «VIP» badges in search, the plan-dependent «Solo VIP» option, the weekly
email, worked examples, and the «¿por qué un turista no vio mi promoción?» section.
Anchors: `page:mi-cuenta/promociones`, the venue promotions page,
`limit:max_free_visible_promotions` and `entitlement:vip_only_promotions`. Remove the
matching exemptions from `coverage-exemptions.json` and regenerate `help.lock.json`.
If the `limit` token resolver cannot resolve a TOURIST floor value today, extending it
is part of this spec.

### 7.9 What's New, smoke

- What's New: tourist-facing and host-facing novelty. The entry is written at the
  staging smoke sign-off (`smoke-tanda` phase 2b), not by this spec.
- Smoke: `status-needs-smoke-staging` (frontmatter). Covered: free / VIP / anonymous on
  both detail pages and the `/promociones/` page, session-stable pick across reloads
  and renewed in a new session, the upsell dialog, the blurred cards in the browser
  network tab (no real name), search badges, the host form texts reading the real
  catalog values, the locked «Solo VIP» state on a plan without the key, the
  `/mi-cuenta/ofertas-exclusivas` redirect, the digest delivered to a VIP mailbox, the
  opt-out, and response headers proving the per-actor reads are not edge-cached.

## 8. User stories and acceptance criteria

Fixtures: tourist F (floor plan, limit row = the catalog value), tourist V
(`tourist-vip`), owner O (paid owner plan, `inheritsTouristVip`, holds
`vip_only_promotions`), owner O2 (owner plan without `vip_only_promotions`), anonymous
A. «Page P» has 5 `plus` and 2 `vip` active promotions unless stated.

### US-1 Host chooses the audience

**As a** host, **I want** to choose who sees each promotion and understand what it
means, **so that** I know the reach I am buying.

- **AC-1** Given the accommodation and venue promotion forms as O, then each shows a
  radio group with «Para todos» (selected by default) and «Solo VIP», each with its
  M-1 description, and the description of «Para todos» contains the floor plan's
  `max_free_visible_promotions` value read from the catalog (changing the fixture
  value changes the text; no literal in `src`, G7 green).
- **AC-2** Given an existing promotion with `touristAudience = 'vip'`, when the edit
  form opens, then «Solo VIP» is selected; saving «Para todos» stores `plus`. Given an
  existing promotion with any other value, then «Para todos» is selected (D-3).
- **AC-3** Given the promotion pages, then the «?» opens the `owner-promotions`
  article, and `page:mi-cuenta/promociones` is no longer an exemption in
  `coverage-exemptions.json`.
- **AC-4** Given the i18n locales, then `vipOnlyHint_one`, `vipOnlyHint_other` and
  `vipOnlyHintNoPlans` no longer exist, and no host promotion text names a plan
  literally (the plan name comes from the catalog).
- **AC-25** Given O2 (plan without `vip_only_promotions`), then «Solo VIP» is rendered
  disabled with the lock icon, the «Disponible en planes superiores» text and a link
  to the plans page, and cannot be selected.
- **AC-26** Given O2 submits `touristAudience = 'vip'` directly to the create or update
  route, then the API refuses it with the error-contract status and code, and nothing
  is stored. Given O, then it is accepted, for accommodation and for venue.
- **AC-28** Given the catalog as shipped, then every owner plan of the accommodation
  and venue verticals holds `vip_only_promotions`, and removing it from one plan
  version (fixture) locks the option for that plan only, with no code change.

### US-2 Free tourist and anonymous visitor see a random quota

**As a** free tourist or anonymous visitor, **I want** to see some promotions, **so
that** I find value and learn what VIP adds.

- **AC-5** Given F on page P, when the per-actor read is called, then exactly
  `freeQuota` items are `visible`, all of them `plus`, and the remaining 4 are
  `locked` (2 of them with `audience: 'vip'`). Given A, the response is the same shape
  and counts as F's (D-1).
- **AC-6** Given the resolver with a seed, when called twice with the same seed over
  the same set, then the visible set is identical; with different seeds over the same
  5 `plus`, then the visible sets differ, and each is a subset of the `plus`
  promotions (unit, deterministic).
- **AC-7** Given a page with 2 `plus` and 1 `vip`, then for F and for A both `plus` are
  visible and only the `vip` is locked.
- **AC-8** Given F or A and any locked item in any response, then its JSON has no `id`,
  `slug`, `title`, `description`, `minNights`, `validFrom`, `validUntil`, window, code,
  redemptions or owner field, and carries `discountType`, `discountValue` and a
  `placeholderName` (schema test on the union).
- **AC-29** Given F or A and a page whose hidden promotions have known real place names,
  titles, conditions and codes, when the response is serialized, then the JSON string
  contains **none** of those real names, titles, conditions or codes (route test that
  searches the serialized body for every hidden row's values), and each
  `placeholderName` has a length within a small tolerance of the real name's length
  and is not equal to it.
- **AC-9** Given F or A clicks, or presses Enter or Space on, a locked card, then the
  upsell dialog opens with the X value and the VIP plan name from the catalog and a
  link to the VIP plans page; no navigation happens; the card is `aria-disabled`
  with an accessible name.
- **AC-10** Given anonymous A, when it calls every public promotion read the web
  used before this spec, then no `vip` promotion is returned with content, and no
  more than the free policy allows is returned in full (closes HOS-2590's leak; if
  HOS-2590 shipped first, this AC proves no regression).
- **AC-11** Given the effective set lookup fails for F, then every item is `locked`
  and a warning is logged (fail-closed).
- **AC-30** Given the session-stable pick: when F or A reloads page P within the same
  browser session (same `sessionStorage`), then the same visible promotions are shown;
  when the session storage is cleared (new session), then a fresh pick is made; when
  `sessionStorage` throws, then the page still works (in-memory seed). Seeds are stored
  per page/context, so two pages keep independent picks.
- **AC-31** Given the `/{lang}/promociones/` page, then F and A see at most X «para
  todos» cards in full per page and the rest blurred with the same rules; V sees all;
  and pagination does not change a page's already-picked set within the session.

### US-3 VIP tourist sees everything

- **AC-12** Given V on page P, then all 7 items are `visible`. Given O (inherits
  VIP), then the same.
- **AC-13** Given V, then `vip` items carry `audience: 'vip'` so the card can show the
  VIP badge as a mark of exclusivity, not a lock.

### US-4 Weekly digest

**As a** VIP tourist, **I want** a weekly email of the new promotions, **so that** I
do not miss them.

- **AC-14** Given 3 promotions first activated in the previous week (1 `vip`) and one
  activated two weeks ago, when the job runs, then V receives one email listing
  exactly those 3, in V's `languageWeb`, with a link to `/{lang}/promociones/`.
- **AC-15** Given no promotion first activated in the previous week, then the job
  sends nothing and reports `sent: 0`.
- **AC-16** Given V with `settings.vipPromotionsDigest === false`, or
  `settings.notifications.allowEmails === false`, then V is skipped.
- **AC-17** Given F, then F never receives the digest.
- **AC-18** Given the job runs twice in the same week, then each recipient gets one
  email (`notification_log` idempotency).
- **AC-19** Given a promotion edited (not activated) in the previous week, then it is
  not new. Given a promotion first activated in the week and already expired or
  archived at send time, then it is not listed.
- **AC-20** Given the preferences page as V, then the toggle exists and persists;
  as F, then it is not shown.

### US-5 Session-blind pages

- **AC-21** Given the accommodation and venue detail pages and the `/{lang}/promociones/`
  page, then `cacheable-pages-are-session-blind.guard.test.ts` stays green with no new
  exemption, and their SSR HTML contains no promotion title, discount, place name or
  condition.
- **AC-22** Given a per-actor read response, then it carries
  `Cache-Control: private, no-store` (route test; staging smoke checks the edge).
- **AC-32** Given `/mi-cuenta/ofertas-exclusivas`, then it redirects to
  `/{lang}/promociones/` in the same locale.

### US-6 Catalog

- **AC-23** Given `max_free_visible_promotions` in `limit-keys.ts` and
  `vip_only_promotions` in `entitlement-keys.ts`, then G3, G18 and G7 are green, the
  TOURIST floor plan's current version holds the limit row, and every owner plan's
  current version holds the entitlement.
- **AC-24** Given the reshaped listing, then no promotion route calls
  `enforceUserGate` with `exclusive_deals`, and F gets a `visible | locked` list
  instead of a 403.

### US-7 Search badges

**As a** tourist, **I want** to see which places have promotions while searching, **so
that** I can open the ones that interest me.

- **AC-33** Given a place with at least one active «Para todos» promotion, then its
  search card shows the «Promo» badge for F, V and A alike; given a place with at
  least one active «Solo VIP» promotion, then it shows the «VIP» badge; given both,
  then both badges. Applies to accommodation and venue cards.
- **AC-34** Given a place with 10 active «Para todos» promotions, then its badge still
  shows (the X quota does not apply to badges), and the badges appear in the cacheable
  list responses (no session dependency) and carry no promotion content.

## 9. UX notes

- Locked card: same size as a visible card, the discount value and promotion type
  readable, the place name as a blurred placeholder, a lock icon (`@repo/icons`), and
  for `vip` a highlighted «VIP» badge. No hover lift.
- Visible VIP-only card (for V): the «VIP» badge as an exclusivity mark.
- Dialog copy (es, to be translated en/pt): «Estas promociones son para turistas VIP.
  Con el plan gratis ves hasta {X} promociones que no son VIP por página.» CTA «Hacete
  VIP». Plan name and X from the catalog.
- Search card badges: «Promo» (neutral) and «VIP» (highlighted), side by side when
  both apply.
- Host «Solo VIP» locked state: disabled radio, lock icon, «Disponible en planes
  superiores», link to plans.
- Web styling is CSS Modules (no Tailwind).
- Empty state on the promotions page when nothing is active.

## 10. Data, API and catalog changes

| Layer | Change |
|---|---|
| `packages/schemas/src/catalog/limit-keys.ts`, `key-enums.ts` | new limit `max_free_visible_promotions` |
| `packages/schemas/src/catalog/entitlement-keys.ts`, `key-enums.ts` | new owner-side entitlement `vip_only_promotions` (one key, both verticals) |
| `packages/db/src/migrations/` | generated catalog SQL for both new keys (G18); new column `owner_promotions.first_activated_at` + backfill. No change to `tourist_audience` (D-3) |
| Plan catalog data | new TOURIST `floor` version with the limit row; new version of every owner plan (accommodation, venue) holding `vip_only_promotions`; `scripts/production-catalog/catalog.ts` mirrored |
| Seed | `scripts/production-catalog`-derived seed and any baseline fixture carrying floor limits or owner entitlements get the rows; per the dual-write rule, a data-migration if seed data in live envs changes (`pnpm db:seed:make`) |
| `packages/schemas/src/entities/ownerPromotion/` | visible/locked union (locked: value, type, `placeholderName`); venue `touristAudience` widened; response schemas of the new reads; accommodation/venue list items gain `hasFreePromotion` / `hasVipPromotion` |
| `packages/schemas/src/entities/user/user.settings.schema.ts` | `vipPromotionsDigest` |
| `packages/service-core/src/services/owner-promotion/` | seeded resolver, placeholder generator, per-actor reads, author-side `vip_only_promotions` check, `first_activated_at` write on first activation |
| `apps/api/src/routes/owner-promotion/` | public optional-actor `visible` and `listing` reads, retired/reshaped `exclusive-deals`, guest policy on the old public reads |
| `apps/api/src/routes/{accommodation,venue}/public/` | presence flags on list/search items |
| `apps/api/src/routes/plan-catalog/public/` | public read of X and the VIP plan name |
| `apps/api/src/cron/` | `vip-promotions-weekly-digest` job + manifest entry |
| `packages/notifications` | digest template + payload type |
| `apps/web` | `/{lang}/promociones/` page + island, redirect of `/mi-cuenta/ofertas-exclusivas`, detail-page islands, sessionStorage seed helper, search card badges, host form radio group (both verticals) with locked state, upsell dialog, preference toggle |
| `packages/i18n` | new keys es/en/pt; removal of `vipOnlyHint_*` |
| `packages/help` | article `owner-promotions`, exemptions removed, lock regenerated |

## 11. Risks

- **R-1 SEO.** Promotions leave the SSR HTML of the detail pages, and `/promociones/`
  is a shell. Crawlers stop seeing promotion content. Accepted by the session-blind
  rule; worth stating to the owner.
- **R-2 Quota bypass.** A new browser session (or private window) shows another pick,
  and paging shows other promotions. The owner accepted this («es tedioso»). The API
  must not make it easier (AC-10, AC-29). The `seed` is client-chosen, so a scripted
  caller can reroll at will; no more content is exposed than a new session would.
- **R-3 Per-actor read cost and caching.** Every detail view resolves an effective set
  (guests skip it). The WhatsApp island already does this. The two reads should share
  one resolution if both islands are on the page. A per-actor read must never be
  edge-cached (AC-22, smoke).
- **R-4 Catalog row missing in an env.** Free tourists would see everything blurred
  (fail-closed). Visible, not a leak. Covered by the staging smoke.
- **R-5 Two promotion emails for VIP.** `alerts-digest` already sends daily promo
  offers to price-alert holders (VIP). Some promotions may appear in both. Kept apart
  on purpose (NG-6). Revisit if users complain.
- **R-6 Overlap with HOS-2579**, which reorders the detail-page slots including
  promotions. Coordinate the merge order.
- **R-7 The leak in §5.2 is live now** and is tracked as HOS-2590. It can ship first
  and alone; waiting for this spec keeps VIP-only accommodation promotions public
  until it ships.
- **R-8 Visible discount on a blurred card.** The value and type are public by owner
  decision (D-5). The place name is not. Length of the placeholder is a minor signal
  and accepted.
- **R-9 Existence of VIP promotions is public** through the «VIP» search badge (D-6).
  Accepted by owner decision; no content leaks.

## 12. Decisions (owner, 2026-11-24)

The owner answered every question of the previous «Open questions» section. They are
now part of the model (§6) and folded into design, stories and tasks.

- **D-1 (was OQ-1) Anonymous visitors.** Treated exactly like a free tourist: X random
  promotions visible, the rest blurred, the same VIP invitation.
- **D-2 (was OQ-2) Public promotions page.** Create `/{lang}/promociones/` with the same
  rules. It is session-blind; personalization lives in a client island and an API
  keyed by actor. `/mi-cuenta/ofertas-exclusivas` redirects to it. It is the digest's
  link target.
- **D-3 (was OQ-3) Existing promotions.** Rows with `tourist_audience = vip` stay «Solo
  VIP»; every other row becomes «Para todos». No data change.
- **D-4 (was OQ-4) «Solo VIP» gated by an owner-side entitlement, absorbing HOS-2273.**
  A new catalog entitlement (`vip_only_promotions`, one key for accommodation and
  venue owners, §7.2) gates the option. Granted on every owner plan at launch, so day
  one behaves like «anyone can», restrictable later from the catalog. Owners without
  it see a locked state. Venues get the VIP option too; HOS-2273 is absorbed.
- **D-5 (was OQ-5) Blurred card content.** Shows the discount value (e.g. «30 %») and
  the promotion type. The place name must be truly unreadable: the API never sends the
  real name for a card the actor cannot see, it sends a placeholder of similar length
  that the UI blurs. Conditions and code are never sent. AC-29 asserts it.
- **D-6 (was OQ-6) Search results.** Badges on each place's card: «Promo» for places
  with a «Para todos» promotion, «VIP» for places with VIP promotions. The X = 3 quota
  does not apply to badges; it applies only to full promotion cards (`/promociones/`
  and the detail page).
- **D-7 (was OQ-7) Stability.** The random pick is stable for the browser session
  (`sessionStorage` or equivalent, per page/context) and renewed in a new session.

Earlier decisions that stand: X = 3 as a single catalog limit for the promotions page
and detail pages; weekly VIP digest only when there are new promotions that week, link
to `/promociones/`, opt-out in preferences; host explanation texts and help article;
HOS-2590 (the live leak) is a separate bug that can ship first.

## 13. Open questions for the owner

No question from the previous round remains open. Editing surfaced one genuinely new
point, listed here and **not decided**:

- **OQ-8 An owner loses `vip_only_promotions` while having VIP-only promotions.** Once
  the catalog restricts the key (a plan change, or the owner moves to a plan without
  it), what happens to the owner's existing «Solo VIP» promotions? Options: (a) they
  keep working as VIP-only, the owner just cannot create or switch to new ones
  (this spec's working assumption, nothing is destroyed); (b) they are converted to
  «Para todos»; (c) they stop being served until the key returns. Not a launch issue
  (every plan has the key at launch), but it must be settled before anyone restricts
  the key.

## 14. Suggested task breakdown

1. **Catalog** — `max_free_visible_promotions` limit and `vip_only_promotions`
   entitlement, generated SQL migration, TOURIST floor version with the limit row,
   new version of every owner plan with the entitlement, production-catalog mirror,
   seed dual-write, guards G3/G7/G18 (AC-23, AC-28).
2. **Resolver and service** — seeded pure resolver with tests (AC-5..8, 11..13),
   placeholder generator (AC-8, AC-29), per-actor reads, schemas of the union,
   author-side entitlement check (AC-26).
3. **API** — public optional-actor `visible` and `listing` reads (AC-5, AC-31),
   guest policy on the old public reads (AC-10, closes the §5.2 leak unless HOS-2590
   already did), retired `exclusive-deals` gate (AC-24), public read of X and plan
   name, no-store headers (AC-22), presence flags on list/search items (AC-33, AC-34).
4. **Web: tourist surfaces** — detail islands for both verticals (AC-21), locked card
   with placeholder name, upsell dialog (AC-9), session seed helper (AC-30),
   `/{lang}/promociones/` page and redirect of the account page (AC-31, AC-32),
   search card badges for accommodation and venue (AC-33, AC-34).
5. **Web: host** — radio group in both forms (AC-1, 2, 4), locked state for owners
   without the entitlement (AC-25), venue schema widening.
6. **Help** — `owner-promotions` article, exemptions, lock, limit token for TOURIST
   (AC-3).
7. **Digest** — `first_activated_at` column + backfill + service write, job, manifest,
   template es/en/pt, preference flag and toggle (AC-14..20).
8. **Cleanup** — follow-up issue to retire `exclusive_deals` (plan rows + key), close
   HOS-2564 as superseded and HOS-2273 as absorbed.

Phase 3's leak fix can ship first and alone, and HOS-2590 already tracks exactly that
standalone fix.

## 15. Linear

Canonical tracking: HOS-2589. Decisions: comments of 2026-11-24 on HOS-2564, and the
owner's answers of 2026-11-24 recorded in §12. Related bug: HOS-2590.

## 16. Revision history

- 2026-11-24 Initial draft with seven open questions.
- 2026-11-24 Owner answered OQ-1 to OQ-7. Moved to §12 (D-1 to D-7). Model, stories,
  acceptance criteria (new AC-25 to AC-34), API and data changes, UX notes and task
  breakdown rewritten accordingly. New key `vip_only_promotions` (absorbs HOS-2273).
  One new open question (OQ-8).
