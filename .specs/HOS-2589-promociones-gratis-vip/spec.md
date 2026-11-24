---
title: Free and VIP promotions model (for everyone or VIP only, random quota, blurred cards, weekly VIP digest)
linear: HOS-2589
statusSource: linear
created: 2026-11-24
type: feature
areas:
  - api
  - web
  - billing
  - db
  - content
related:
  - HOS-2564  # «Exclusiva para plan VIP» hint names plans by hand. Superseded by this spec
  - HOS-2273  # venue VIP-only promotions (Backlog). Overlaps, see OQ-4
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
- A **free tourist** sees up to **X** «para todos» promotions per page, picked at
  random on every view. Every other promotion on that page is shown **blurred and
  not clickable**. VIP-only ones carry a highlighted badge. Trying to open a
  blurred card explains why and invites the tourist to become VIP. No email.
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
  banner cannot tell them apart). This spec fixes it as a side effect (AC-10), but
  it is live now.
- **There is no public promotions page.** The only promotions list is the gated
  account page. The digest's «link to the site's promotions page» and the
  «promotion listings» the free tourist browses need one (OQ-2).

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

Encoded as stated. Nothing here is up for redesign.

- **M-1 Host choice.** Per promotion: «Para todos» or «Solo VIP». Explanations:
  - Para todos: «Todos los turistas VIP la ven. Los turistas gratis ven hasta {X}
    promociones por página, elegidas al azar, así que a veces la ven y a veces no.»
  - Solo VIP: «Solo la ven los turistas VIP, y les avisamos por correo. Los turistas
    gratis la ven borrosa, con una invitación a hacerse VIP.»
  - {X} and the VIP plan name are read from the catalog, never written in the text.
  - A new help article covers the model with examples and answers «¿por qué un
    turista no vio mi promoción?».
- **M-2 Free tourist.** On each page (promotion listing, search results, accommodation
  detail, venue detail) sees up to X «para todos» promotions picked at random on
  every view. All other promotions on that page render blurred and not clickable;
  VIP-only ones have a highlighted badge. Trying to open one shows: those are for VIP,
  free users see only X non-VIP promotions, with an invitation to become VIP. If a
  page has X or fewer «para todos» promotions, all of them are visible and only the
  VIP-only ones are blurred. No email.
- **M-3 VIP tourist.** Sees every promotion. Weekly digest of that week's new
  promotions with a link to the site's promotions page; sent only when there were
  new promotions; opt-out from notification preferences.
- **M-4 X = 3**, one value for listings and detail pages, a limit on the free tourist
  plan in the catalog.

## 7. Proposed design

Items marked *(proposal)* are technical choices of this spec, open to review. Product
gaps are in §12, not here.

### 7.1 Audience: reuse `tourist_audience` *(proposal)*

`plus` = «para todos», `vip` = «solo VIP». No structural change to the column and
no backfill: the host's choice already lives there, and the form default (`plus`)
is the «para todos» default. Existing rows keep their value (confirmation in OQ-3).
The venue schema literal is widened to the full enum (subject to OQ-4).

### 7.2 Catalog keys *(proposal)*

| Key | Kind | Change | Use |
|---|---|---|---|
| `vip_promotions_access` | entitlement | keep | **The VIP decision.** Present → sees everything, gets the digest. |
| `max_free_visible_promotions` | limit (new) | add `['max_free_visible_promotions', 'vertical', 'MAX', 'NONE', 'COMMERCIAL']` to `limit-keys.ts` + `LimitKeyEnum`; generated catalog SQL in a migration (G18) | **X.** Read only when `vip_promotions_access` is absent. |
| `exclusive_deals` | entitlement | stop gating on it | It meant «may see promotions at all», which is now everybody. The key and its plan rows are retired in a follow-up (expand/contract: plan rows reference it). |

The value 3 is written as a `plan_version_limit` row on a **new version of the
TOURIST `floor` plan**, published through the plan-catalog publish flow (or a
migration that inserts that version, whichever the catalog procedure of the day
prescribes), and mirrored in `scripts/production-catalog/catalog.ts`. The literal
never appears in `src`. Tests read it from fixtures built from the catalog.

**A role never decides.** The decision is `vip_promotions_access` on the TOURIST
effective set plus the limit, never a role or a plan slug.

**Fail-closed.** If the effective set cannot be read, `readEffectiveLimit` gives
0 and the entitlement reads false: everything blurred, nothing leaked. A missing
limit row also reads 0. That is visible in staging (smoke) and logged.

### 7.3 One pure resolver *(proposal)*

`resolvePromotionVisibility({ promotions, isVip, freeQuota, pick })` in
`@repo/service-core` (pure; `pick` is an injected random source so tests are
deterministic):

1. VIP → every promotion `visible`.
2. Free → shuffle the `plus` promotions with `pick`, the first `freeQuota` are
   `visible`; every other promotion (remaining `plus` and all `vip`) is `locked`.
3. Output order: visible first, then locked `plus`, then locked `vip`.

«Per page» means per response the resolver is applied to: one detail page's
promotions, or one page of a listing. The quota is not global and does not carry
across pages.

### 7.4 What a locked card may carry (G-4)

A locked item is `{ kind: 'locked', audience: 'plus' | 'vip', entityType }` plus an
opaque, per-response index for React keys. It carries **no** id, slug, title,
description, discount type or value, nights, dates, window, redemptions or owner.
The blur is CSS over a **synthetic placeholder** rendered by the client, never over
real text. Whether a locked card on a listing page may name the place it belongs to
is OQ-5. Until decided, it does not.

### 7.5 API

- **Per-viewer reads (new or reshaped), uncached (`Cache-Control: private, no-store`):**
  - `GET /api/v1/protected/owner-promotions/visible?entityType=&entityId=` for one
    listing's promotions (detail pages, both verticals).
  - `GET /api/v1/protected/owner-promotions/exclusive-deals` reshaped into the
    paginated listing used by the promotions page: drop the `exclusive_deals` gate,
    always read `[plus, vip]`, apply the resolver per page, return
    `visible | locked` items.
  - Both resolve the actor's TOURIST effective set once (`readEffectiveKeys` +
    `readEffectiveLimit`) and call the resolver.
- **Guest path.** The anonymous behaviour depends on OQ-1. Whatever is decided, the
  existing public reads (`/public/owner-promotions` and `/public/venues/{id}/promotions`)
  must apply the same resolver with the guest policy, or stop being used by the web.
  Leaving them returning every promotion in full would make the quota a URL away
  and keep the §5.2 leak (AC-10).
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
- **Promotions page.** Depends on OQ-2. The design assumes a session-blind public page
  (`/[lang]/promociones/`) whose list is the same island over the reshaped listing
  endpoint, with `/mi-cuenta/ofertas-exclusivas` redirecting to it.
- **Search results.** Venue cards keep the presence badge («Promo» / «Promo VIP» /
  «Ahora»), which reveals no content. What else «search results» means is OQ-6.
- **Upsell dialog.** It opens on click, Enter or Space on a locked card (cards are
  `aria-disabled`, focusable, with an accessible name such as «Promoción solo para
  VIP» or «Promoción oculta»). The text reads X and the VIP plan name from the
  catalog, and the CTA points to the existing VIP plans page.
- **Host form (accommodation).** Replace the checkbox with a two-option radio group
  («Para todos» default, «Solo VIP»), each with the M-1 description. Delete
  `vipOnlyHint_*` and `resolvePromotionAudienceHint` (supersedes HOS-2564).
- **Host form (venue).** Same control, subject to OQ-4.
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
  CTA to the promotions page (OQ-2). Locale from `languageWeb` (es/en/pt).
  The template goes in `packages/notifications/src/templates/` following
  `ai-questions-weekly-digest.tsx`.
- **Opt-out**: new `vipPromotionsDigest: z.boolean().optional()` in
  `user.settings.schema.ts` (JSONB, no migration), a toggle in
  `PreferenceToggles.client.tsx` (shown only to VIP tourists), and an unsubscribe
  link in the email.

### 7.8 Help article

New article `owner-promotions` (`packages/help/content/es/host/`, audiences host and
provider/venue owner): the two options, the random quota (`{{limit:max_free_visible_promotions:tourist}}`),
the blurred cards, the weekly email, worked examples, and the «¿por qué un turista no
vio mi promoción?» section. Anchors: `page:mi-cuenta/promociones`, the venue
promotions page, and `limit:max_free_visible_promotions`. Remove the matching
exemptions from `coverage-exemptions.json` and regenerate `help.lock.json`. If the
`limit` token resolver cannot resolve a TOURIST floor value today, extending it is
part of this spec.

### 7.9 What's New, smoke

- What's New: tourist-facing and host-facing novelty. The entry is written at the
  staging smoke sign-off (`smoke-tanda` phase 2b), not by this spec.
- Smoke: `status-needs-smoke-staging` (frontmatter). Covered: free / VIP / anonymous on
  both detail pages and the promotions page, the upsell dialog, the host form texts
  reading the real catalog values, the digest delivered to a VIP mailbox, the opt-out,
  and response headers proving the per-viewer reads are not edge-cached.

## 8. User stories and acceptance criteria

Fixtures: tourist F (floor plan, limit row = the catalog value), tourist V
(`tourist-vip`), owner O (paid owner plan, `inheritsTouristVip`), anonymous A.
«Page P» has 5 `plus` and 2 `vip` active promotions unless stated.

### US-1 Host chooses the audience

**As a** host, **I want** to choose who sees each promotion and understand what it
means, **so that** I know the reach I am buying.

- **AC-1** Given the accommodation promotion form, then it shows a radio group with
  «Para todos» (selected by default) and «Solo VIP», each with its M-1 description,
  and the description of «Para todos» contains the floor plan's
  `max_free_visible_promotions` value read from the catalog (changing the fixture
  value changes the text; no literal in `src`, G7 green).
- **AC-2** Given an existing promotion with `touristAudience = 'vip'`, when the edit
  form opens, then «Solo VIP» is selected; saving «Para todos» stores `plus`.
- **AC-3** Given the promotion pages, then the «?» opens the `owner-promotions`
  article, and `page:mi-cuenta/promociones` is no longer an exemption in
  `coverage-exemptions.json`.
- **AC-4** Given the i18n locales, then `vipOnlyHint_one`, `vipOnlyHint_other` and
  `vipOnlyHintNoPlans` no longer exist, and no host promotion text names a plan
  literally (the plan name comes from the catalog).

### US-2 Free tourist sees a random quota

**As a** free tourist, **I want** to see some promotions, **so that** I find value
and learn what VIP adds.

- **AC-5** Given F on page P, when the per-viewer read is called, then exactly
  `freeQuota` items are `visible`, all of them `plus`, and the remaining 4 are
  `locked` (2 of them with `audience: 'vip'`).
- **AC-6** Given the resolver with a seeded `pick`, when called twice with different
  seeds over the same 5 `plus`, then the visible sets differ, and each is a subset
  of the `plus` promotions (unit, deterministic).
- **AC-7** Given a page with 2 `plus` and 1 `vip`, then for F both `plus` are visible
  and only the `vip` is locked.
- **AC-8** Given F and any locked item in any response, then its JSON has no `id`,
  `slug`, `title`, `description`, `discountType`, `discountValue`, `minNights`,
  `validFrom`, `validUntil`, window or owner field (schema test on the union plus a
  route test that serializes the response and searches it for the hidden rows' titles).
- **AC-9** Given F clicks, or presses Enter or Space on, a locked card, then the
  upsell dialog opens with the X value and the VIP plan name from the catalog and a
  link to the VIP plans page; no navigation happens; the card is `aria-disabled`
  with an accessible name.
- **AC-10** Given anonymous A, when it calls every public promotion read the web
  used before this spec, then no `vip` promotion is returned with content, and no
  more than the guest policy (OQ-1) allows is returned in full.
- **AC-11** Given the effective set lookup fails for F, then every item is `locked`
  and a warning is logged (fail-closed).

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
  exactly those 3, in V's `languageWeb`, with a link to the promotions page.
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

- **AC-21** Given the accommodation and venue detail pages and the promotions page,
  then `cacheable-pages-are-session-blind.guard.test.ts` stays green with no new
  exemption, and their SSR HTML contains no promotion title, discount or condition.
- **AC-22** Given a per-viewer read response, then it carries
  `Cache-Control: private, no-store` (route test; staging smoke checks the edge).

### US-6 Catalog

- **AC-23** Given `max_free_visible_promotions` in `limit-keys.ts`, then G3, G18 and
  G7 are green, and the TOURIST floor plan's current version holds the limit row.
- **AC-24** Given the reshaped exclusive-deals route, then it no longer calls
  `enforceUserGate` with `exclusive_deals`, and F gets a `visible | locked` list
  instead of a 403.

## 9. UX notes

- Locked card: same size as a visible card, placeholder content under a blur, a lock
  icon (`@repo/icons`), and for `vip` a highlighted «VIP» badge. No hover lift.
- Visible VIP-only card (for V): the «VIP» badge as an exclusivity mark.
- Dialog copy (es, to be translated en/pt): «Estas promociones son para turistas VIP.
  Con el plan gratis ves hasta {X} promociones que no son VIP por página.» CTA «Hacete
  VIP». Plan name and X from the catalog.
- Web styling is CSS Modules (no Tailwind).
- Empty state on the promotions page when nothing is active.

## 10. Data, API and catalog changes

| Layer | Change |
|---|---|
| `packages/schemas/src/catalog/limit-keys.ts`, `key-enums.ts` | new limit `max_free_visible_promotions` |
| `packages/db/src/migrations/` | generated catalog SQL for the new key (G18); new column `owner_promotions.first_activated_at` + backfill |
| Plan catalog data | new TOURIST `floor` version with the limit row; `scripts/production-catalog/catalog.ts` mirrored |
| Seed | `scripts/production-catalog`-derived seed and any baseline fixture carrying floor limits get the row; per the dual-write rule, a data-migration if seed data in live envs changes (`pnpm db:seed:make`) |
| `packages/schemas/src/entities/ownerPromotion/` | visible/locked union; venue `touristAudience` widened (OQ-4); response schemas of the reshaped routes |
| `packages/schemas/src/entities/user/user.settings.schema.ts` | `vipPromotionsDigest` |
| `packages/service-core/src/services/owner-promotion/` | resolver, per-viewer reads, `first_activated_at` write on first activation |
| `apps/api/src/routes/owner-promotion/` | `protected/visible`, reshaped `exclusive-deals`, guest policy on the public reads |
| `apps/api/src/routes/plan-catalog/public/` | public read of X and the VIP plan name |
| `apps/api/src/cron/` | `vip-promotions-weekly-digest` job + manifest entry |
| `packages/notifications` | digest template + payload type |
| `apps/web` | detail-page islands, promotions page (OQ-2), host form radio group (both verticals), upsell dialog, preference toggle |
| `packages/i18n` | new keys es/en/pt; removal of `vipOnlyHint_*` |
| `packages/help` | article `owner-promotions`, exemptions removed, lock regenerated |

## 11. Risks

- **R-1 SEO.** Promotions leave the SSR HTML of the detail pages. Crawlers stop
  seeing them. Accepted by the session-blind rule; worth stating to the owner.
- **R-2 Quota bypass.** Reloading or paging shows other promotions. The owner
  accepted this («es tedioso»). The API must not make it easier (AC-10).
- **R-3 Per-viewer read cost.** Every detail view by a logged-in user resolves an
  effective set. The WhatsApp island already does this. The two reads should share
  one resolution if both islands are on the page.
- **R-4 Catalog row missing in an env.** Free tourists would see everything blurred
  (fail-closed). Visible, not a leak. Covered by the staging smoke.
- **R-5 Two promotion emails for VIP.** `alerts-digest` already sends daily promo
  offers to price-alert holders (VIP). Some promotions may appear in both. Kept apart
  on purpose (NG-6). Revisit if users complain.
- **R-6 Overlap with HOS-2579**, which reorders the detail-page slots including
  promotions. Coordinate the merge order.
- **R-7 The leak in §5.2 is live now.** Waiting for this spec keeps VIP-only
  accommodation promotions public until it ships.

## 12. Open questions for the owner

- **OQ-1 Anonymous visitors.** A visitor without an account: treat as a free tourist
  (X random visible, the rest blurred), or show every promotion blurred with an
  invitation to sign up? *Recommended: treat as free, so the pages still sell
  promotions to first-time visitors.*
- **OQ-2 The site's promotions page does not exist.** The only list today is
  `/mi-cuenta/ofertas-exclusivas`, behind login. The digest link and the «promotion
  listings» need a public page. Create `/promociones/` (public, same rules) and
  redirect the account page to it? *Recommended: yes.*
- **OQ-3 Existing promotions.** Rows already marked `vip` stay «Solo VIP» and every
  other row becomes «Para todos» (the toggle's off position)? *Recommended: yes, no
  data change.*
- **OQ-4 Venue promotions and HOS-2273.** Can every host and venue choose «Solo VIP»
  on any plan, or only some plans (HOS-2273 planned a premium-only key
  `venue_vip_promotions`)? Does this spec absorb HOS-2273? *Recommended: any plan,
  and absorb it.*
- **OQ-5 What a blurred card shows.** On a listing page, may a blurred card show the
  name of the place it belongs to (no discount, no conditions), or nothing at all?
- **OQ-6 «Search results».** Accommodation search cards show no promotions today, and
  venue cards show only a «Promo» badge. Does «search results» mean promotion cards
  inside the search page, or the badge on each place's card?
- **OQ-7 Stability within a session.** A new random pick on every view (as worded),
  or the same pick for a short time so a free tourist who comes back to a page
  finds the promotion they saw? *Recommended: every view, as decided.*

## 13. Suggested task breakdown

1. **Catalog** — limit key, generated SQL migration, TOURIST floor version with the
   row, production-catalog mirror, seed dual-write, guards G3/G7/G18.
2. **Resolver and service** — pure resolver with tests (AC-5..8, 11..13), per-viewer
   reads, schemas of the union.
3. **API** — `protected/visible`, reshaped `exclusive-deals` (AC-24), guest policy on
   the public reads (AC-10, closes the §5.2 leak), public read of X and plan name,
   no-store headers (AC-22).
4. **Web: tourist surfaces** — detail islands for both verticals (AC-21), locked card,
   upsell dialog (AC-9), promotions page (after OQ-2), search surface (after OQ-6).
5. **Web: host** — radio group in both forms (AC-1, 2, 4), venue schema widening
   (after OQ-4).
6. **Help** — `owner-promotions` article, exemptions, lock, limit token for TOURIST (AC-3).
7. **Digest** — `first_activated_at` column + backfill + service write, job, manifest,
   template es/en/pt, preference flag and toggle (AC-14..20).
8. **Cleanup** — follow-up issue to retire `exclusive_deals` (plan rows + key),
   close HOS-2564 as superseded.

Phase 3's leak fix can ship first and alone if the owner wants R-7 closed before the
rest.

## 14. Linear

Canonical tracking: HOS-2589. Decisions: comments of 2026-11-24 on HOS-2564.
