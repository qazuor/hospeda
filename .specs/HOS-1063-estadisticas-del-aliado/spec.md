---
title: Partner statistics — the numbers the commercial page already promised
linear: HOS-1063
statusSource: linear
created: 2026-09-04
type: feature
areas:
  - web
  - api
  - db
  - content
---

# Partner statistics — the numbers the commercial page already promised

## 1. Summary

`/{lang}/presentacion/aliados/` is sent to a prospective partner over WhatsApp
**before they sign**, and it does not hint at statistics — it enumerates them, and
it draws the line between what Hospeda measures and what it does not:

> **Sí te damos números:** de adentro de la plataforma, cuánta gente vio tu página
> y cuántos entraron desde tu logo. De nuestro newsletter: a cuántas personas
> salió el envío donde apareciste, cuántos lo abrieron y cuántos hicieron clic.
>
> **De las redes, sólo constancia:** no te informamos cuánta gente la vio ni
> cuántos hicieron clic. Sí te informamos cuándo se publicó, con el enlace a la
> publicación.
>
> — `apps/web/src/pages/[lang]/presentacion/aliados/index.astro:143-160`

The same page says where those numbers live:

> **Tus números y tu registro de difusión**, en el mismo panel: las visitas a tu
> página, y cada aparición con su fecha y su enlace. — `:324`

So the promise is four metrics in one panel. **One of them already shipped.** This
spec covers the other three, and states plainly which of them can ship now and
which one cannot ship at all until an open question is answered.

Owner request (2026-09-01):

> «prometemos estadísticas para que el partner pueda verlas; si hace falta debemos
> generarle un user de Hospeda así puede entrar a verlas»

The second half of that sentence turns out to be the harder half — see §5.5 and
OQ-4/OQ-5.

## 2. Two corrections to the issue as filed

Both are load-bearing. Implementing HOS-1063 from the issue text alone would
rebuild something already in production and resurrect a column the repo forbids.

### 2.1 The mentions log (metric 4) ALREADY EXISTS — HOS-377

The issue lists "registro de apariciones en redes" as pending. It is not. It
shipped as HOS-377:

| Piece | Where |
|---|---|
| Table | `packages/db/src/schemas/partner/partner_mention.dbschema.ts` |
| Read endpoint | `GET /api/v1/protected/partners/mine/mentions` (`apps/api/src/routes/partners/protected/mine-mentions.ts`) |
| UI | `apps/web/src/components/account/PartnerMentionsSection.astro` |
| Rendered on | `apps/web/src/pages/[lang]/mi-cuenta/aliados/index.astro:125` |
| Channels | `PartnerMentionChannelEnum` — `INSTAGRAM`, `FACEBOOK`, `TWITTER`, `NEWSLETTER`, `WHATSAPP`, `OTHER` |

`apps/web/src/pages/[lang]/planes/aliados/index.astro:39-41` confirms it from the
commercial side: the mentions log is REAL and renders in the partner's own
dashboard.

**What remains is one placement question, not an implementation.** The log renders
on `/mi-cuenta/aliados/` — the *discovery hub* ("Sumate como aliado"), which every
authenticated user can open — while the partner's own ficha lives at
`/mi-cuenta/partner/`. The commercial copy promises both halves "en el mismo
panel". The stats block must therefore land wherever the log already is, or the
log must move to join it. **Recommendation: put the stats block on
`/mi-cuenta/aliados/`, beside the existing log, and move nothing.** The log is
already correctly gated (it renders only when `visible` is true, i.e. the caller
owns a partner) and moving a shipped, tested section to satisfy an aesthetic
preference buys nothing. This is recorded as a decision, not an open question,
because it is reversible and cheap either way.

**Non-negotiable constraint on that placement**, quoted from the component that
will be its sibling:

> **AC-5 — for whoever builds HOS-294 ("Tus métricas", OQ-5):** that block must
> NOT share a heading, a container or a component with this one, and its copy must
> live under a DIFFERENT i18n subtree than `account.partnerMentions`. The two
> answer different questions ("what did you do for me?" vs "how did it
> perform?") and blurring them is exactly how this section starts implying a
> measurement it does not have. Add a sibling section, not a tab on this one.
> — `PartnerMentionsSection.astro:16-21`

That note names HOS-294; the block it anticipated is this spec's. It is honoured
in §7.1.

### 2.2 `partners.analytics` is a DEAD column and must not be used

The issue proposes populating it. The repository forbids it, in writing, in the
file that replaced it:

> The dead `partners.analytics` jsonb column is the earlier, abandoned attempt at
> exactly that shape — **do not resurrect it or build on it.**
> — `partner_mention.dbschema.ts:19-20`

Measured against `origin/staging` @ `36b821e0a`:

- **Definition** — `partner.dbschema.ts:58`:
  `analytics: jsonb('analytics').$type<PartnerAnalytics>().default({})`, where
  `interface PartnerAnalytics { impressions?: number; clicks?: number }`
  (`:17-20`). Zod mirror at
  `packages/schemas/src/entities/partner/partner.schema.ts:56`.
- **Writers: one method, zero callers.** `PartnerModel.incrementAnalytics`
  (`packages/db/src/models/partner/partner.model.ts:404-424`). A repo-wide search
  returns the definition plus two comments that cite it in the past tense.
- **Readers: none.** It is not in `PartnerOwnerViewSchema`
  (`partner.owner.schema.ts:132-158`) and it is listed in
  `PARTNER_OWNER_FORBIDDEN_FIELDS` (`:102`) — the partner may not write it and
  never receives it.
- **It has already caused one production bug.**
  `partner.update.schema.ts:26-33` records it: `analytics` carries `.default({})`
  and is not in `PartnerModel.mergeableJsonbColumns`, so before
  `stripShapeDefaults` an admin editing a partner's *name* wiped the accumulated
  counters. In Zod 4 `.partial()` does not suppress a `.default()`.

A counter shaped as an unbounded JSONB blob on a mutable row cannot answer "how
many views last week" — it has no time dimension — which is the metric the
commercial page actually promises. §5 uses the append-only event table instead.
Disposal is OQ-6.

## 3. Goals

- **G-1** — A partner who owns their listing sees, in their own panel, the two
  in-platform numbers the commercial page promises: page views and logo clicks.
- **G-2** — The panel states, in the same words as the presentation, that social
  numbers are not ours. A metric we cannot sustain is worse absent than wrong.
- **G-3** — A **silver** partner never sees a zero where the honest answer is "this
  does not apply to your tier".
- **G-4** — The newsletter metric is either delivered or explicitly deferred with
  its blocker named. It is never half-delivered as an empty card.
- **G-5** — Nothing in this spec reads or writes `partners.analytics`.

## 4. Non-goals

- **NG-1** — No Instagram/Facebook API integration. The owner rejected it
  (HOS-377) and the presentation is built on that refusal.
- **NG-2** — No per-partner click attribution *inside* the newsletter. The
  promise is campaign-level ("a cuántas personas salió el envío donde
  apareciste"), and per-partner click attribution would need per-partner tracked
  links in the email body. Out of scope by design, not by omission.
- **NG-3** — No admin-facing partner analytics dashboard. This is the partner's
  own panel.
- **NG-4** — No change to how partner visibility, tiers or the gold page gate
  work (HOS-294).
- **NG-5** — Dropping `partners.analytics` is not done here (OQ-6).

## 5. Current baseline — measured

Everything below was read against `origin/staging` @ `36b821e0a`.

### 5.1 The pattern for this problem already exists, and has already been extended once

`entity_views` (SPEC-159) solves the hard part: counting views of an
**edge-cached** public page without breaking the cache.

- `packages/db/src/schemas/entity-view/entity_view.dbschema.ts` — append-only
  event table (`entityType`, `entityId`, `visitorHash`, `isAuthenticated`,
  `viewedAt`), no audit columns, no soft delete, hard-purged by a TTL cron.
- `apps/api/src/routes/views/capture.ts` — `POST /api/v1/public/views`,
  `skipAuth`, bot-filtered, rate-limited 30/60s, **always 202** (a bot-drop, a
  successful insert and a DB outage are indistinguishable to the caller).
- `apps/web/src/lib/analytics/view-capture.ts` — `sendViewBeacon`, preferring
  `navigator.sendBeacon` (survives unload) with a `fetch(keepalive)` fallback.
- `apps/web/src/components/analytics/EntityViewTracker.client.tsx` — headless
  React island, mounted `client:idle`, firing **after** the SSR page renders.
  That is the whole trick: the page stays edge-cacheable because the server never
  participates in the count.
- `apps/api/src/cron/jobs/entity-views-purge.job.ts` — `ENTITY_VIEWS_RETENTION_DAYS
  = 95` (30-day live window + 65 days of slack).

**HOS-734 already executed the "extend this to a new entity" move**, for
GASTRONOMY and EXPERIENCE, to feed the owner-facing basic-stats widget. Its own
note records why it was cheap:

> No DB migration was needed: `entity_views.entity_type` already reuses the full
> `entity_type_enum` Postgres enum […] which has carried GASTRONOMY/EXPERIENCE
> since they were added to `EntityTypeEnum` for the user-bookmark subsystem. Only
> this narrower Zod subset needed widening.
> — `packages/schemas/src/entities/entityView/entityView.schema.ts:12-16`

**PARTNER is not in that position.** It is absent from `EntityTypeEnum`
(`packages/schemas/src/enums/entity-type.enum.ts:29-42`, 12 values), therefore
absent from the `entity_type_enum` Postgres enum
(`EntityTypePgEnum = pgEnum('entity_type_enum', enumToTuple(EntityTypeEnum))`,
`packages/db/src/schemas/enums.dbschema.ts:113`), therefore absent from
`TRACKABLE_ENTITY_TYPES`. This spec pays the migration HOS-734 did not have to.
See §8 R-1 for the blast radius.

Note the second, narrower gate: `EntityViewCaptureInputSchema` validates
`entityType` against `TrackableEntityTypeSchema`, not against `EntityTypeEnum`.
Widening the wide enum alone changes nothing at the endpoint.

### 5.2 The gold page is edge-cached — server-side counting is not an option

`apps/web/src/pages/[lang]/partners/[slug].astro:90-104` calls
`applyCacheHeaders({ cacheClass: 'detail', tags: [...] })`, and
`apps/web/src/lib/cache/cache-classes.ts:101` defines
`detail: { sMaxAge: 3_600, swr: 3_600 }`, purged by entity tag. Counting a view in
the Astro frontmatter would count cache MISSES, not visitors — and would have to
disable the cache to be correct. The client-side beacon is not a preference, it is
the only shape that works.

### 5.3 The logo click fires nothing today, and silver logos DO link out

`resolvePartnerLogoLink` (`apps/web/src/lib/partner-logo-link.ts:72-89`):

| Case | Result |
|---|---|
| gold **and** has `slug` | internal link to `/{lang}/partners/<slug>/`, no `rel`, no `target` |
| anything else with a safe `websiteUrl` | that site, `rel="sponsored nofollow noopener"`, `target="_blank"` |
| neither | **no link at all** (the day-one state — a freshly provisioned partner has `websiteUrl = null`) |

Rendered by `apps/web/src/components/sections/PartnersSection.astro:38`. There is
no click handler and no beacon anywhere in that path.

Three consequences the design must absorb:

1. **A silver partner CAN receive clicks.** The code links a silver logo to the
   partner's own website whenever they filled one in. The commercial comparison
   table says otherwise — `presentacion/aliados/index.astro:176` renders "Se puede
   hacer clic en tu logo: plata —, oro **sí**". Code and copy disagree. This spec
   does not resolve that (it is HOS-294 territory), but it must not *depend* on
   either reading: see §7.2, where silver's *views* card is suppressed by the
   absence of a page, not by the tier label.
2. **The marquee renders its track TWICE** — a visible one and an `aria-hidden`
   duplicate for the seamless loop (`partner-logo-link.ts:6-8`). A naive listener
   double-counts, or counts a click on a decorative clone.
3. **`PartnerData` carries no `id`** (`apps/web/src/data/types-ui.ts:198-231`:
   `name`, `logoPath`, `url?`, `slug?`, `tier?`, `aspectRatio`). `entity_views.entity_id`
   is a `uuid`. The public partners payload and `toPartnerData`
   (`apps/web/src/lib/api/transforms.ts:3244`) must carry the partner's `id`
   before any click can be attributed.

A fourth constraint is contextual: the carousel is on the **home page**, whose
JS budget is the subject of two dedicated specs (HOS-160, HOS-168). Whatever
instruments the click must be near-zero JavaScript. See OQ-2.

### 5.4 The newsletter has the raw data and no attribution

- `packages/db/src/schemas/newsletter/newsletter_campaigns.dbschema.ts` — one row
  per campaign, with `totalRecipients`, `sentAt`, `status`.
- `packages/db/src/schemas/newsletter/newsletter_campaign_deliveries.dbschema.ts`
  — one row per `(campaign, subscriber)` with `status`, `openedAt`,
  `firstClickAt`, `deliveredAt`, `providerMessageId`, populated by the Brevo
  webhook. Indexed by `(campaignId, status)`.

Sent / opened / clicked per campaign is therefore a `GROUP BY campaign_id` away.

**What does not exist is the join.** `partner_mentions.channel` has a `NEWSLETTER`
value, but the row records the mention as free text plus a URL typed by an admin
(`partner_mention.dbschema.ts:96`). There is no FK, and nothing in the schema
says *which* campaign a partner appeared in. This is the only promised metric
that requires new modelling. See OQ-3.

### 5.5 Ownership has three branches, and one of them can never see a panel

This is the most uncomfortable fact in the baseline and it should not be softened.

1. **Applicant who already had an account when the lead was approved** —
   `ownerUserId` is written at provisioning time, no token involved:
   `alliance-lead.partner-provisioning.ts:205` writes
   `ownerUserId: lead.applicantUserId`.
2. **Anonymous applicant** — the partner is created with `ownerUserId: null` and
   a hashed **claim token** backfills it when the applicant redeems it
   (`alliance-lead.service.ts:330-345` for the fail-closed backfill,
   `:370-382` for `digestClaimToken` / `claimTokenMatches`, `:845/:864` for the
   write). The provisioning comment states it outright: *"The applicant may be
   null […] until then the ownership filter matches nobody."*
3. **Curated partners, entered by hand in the admin, with no lead at all — they
   have no owner and are meant to keep it that way**:

   > Curated partners created by hand in the admin have no owner at all and are
   > meant to stay that way. — `partner.dbschema.ts:73-74`

   `ownerUserId` is also deliberately omitted from `updatePartnerSchema`
   (`partner.update.schema.ts:14-19`), so an admin cannot hand a listing to an
   account as an ordinary field edit.

**Consequence: a curated partner will never see a statistics panel, under any
design in this spec.** Every read is scoped by `ownerUserId = actor.id` and fails
closed. That is a product decision to make (OQ-4), not an implementation detail to
route around.

### 5.6 The partner surface is authorised by ownership — no permission, no entitlement

`GET /partners/mine` and `GET /partners/mine/mentions` declare **no**
`requiredPermissions`:

> Auth-only, no `PARTNER_*` permission — the same gate as `GET /mine`, and for the
> same reason (HOS-278 AC-7): an approved partner is an ordinary account, so
> demanding an admin perk would lock them out of their own log. Ownership IS the
> gate […] and fails CLOSED — an actor with no real identity and an actor who owns
> no partner both get an empty log, never a 403 that would confirm a partner
> exists. — `mine-mentions.ts:8-14`

The host-side view routes are the opposite shape — `hostAccommodationDailySeriesRoute`
(`apps/api/src/routes/views/protected/daily-series.ts`) demands
`ACCOMMODATION_VIEW_OWN` **and** `requireEntitlement(VIEW_BASIC_STATS)`. **Do not
copy that half.** `loadEntitlements` resolves against the **accommodation**
subscription (the argument is spelled out in `.specs/HOS-1074-claves-editar-publicar/spec.md` §2),
and a partner subscription lives in a different product domain. An entitlement
gate on a partner route would refuse every partner who is not also a paying host
— and would allow a host who is not a partner, for the wrong reason.

## 6. Proposed design

### 6.1 Phase A — deliverable without any open question resolved

Everything here is mechanical once `PARTNER` exists as an entity type. It delivers
two of the three outstanding metrics and is the answer to "show me the shippable
piece".

**A-1 · `PARTNER` becomes a trackable entity type.**

| File | Change |
|---|---|
| `packages/schemas/src/enums/entity-type.enum.ts` | `PARTNER = 'PARTNER'` (12 → 13 values) |
| `packages/schemas/src/enums/__tests__/entity-type.enum.test.ts` | frozen count `toHaveLength(12)` → `13`, plus a member assertion |
| `packages/db/src/migrations/` | `ALTER TYPE entity_type_enum ADD VALUE 'PARTNER'` via `pnpm db:generate` (structural carril) |
| `packages/service-core/src/services/tag/entity-access-registry.ts` | new arm — `Record<EntityTypeEnum, CanViewChecker>` is exhaustive, so this is a compile error until added |
| `apps/admin/src/lib/utils/entity-search.utils.ts:362,496` | new arms in `entitySearchConfigs` and `entityLoadConfigs`, both exhaustive `Record<EntityTypeEnum, …>` |
| `packages/schemas/src/entities/entityView/entityView.schema.ts` | `TRACKABLE_ENTITY_TYPES` + `TrackableEntityTypeSchema` gain `PARTNER` |

`RevalidationEntityTypeEnum` already carries `partner` (HOS-389 §4b, cited in
`packages/service-core/test/revalidation/every-entity-type-has-config.guard.test.ts:22-26`)
— that guard is not tripped by this change.

**A-2 · Beacon on the gold partner page.** Mount `EntityViewTracker` with
`client:idle` on `apps/web/src/pages/[lang]/partners/[slug].astro`,
`entityType="PARTNER"`. Per HOS-734's precedent, **no PostHog event** is added:
the beacon feeds the owner-facing number, and a marketing funnel for partner
pages is not in scope. `SupportedEntityType` in the tracker gains `'PARTNER'`.

**A-3 · Logo-click capture.** Mechanism decided by OQ-2. Independently of that
choice, three things are fixed here:

- the partner's `id` is added to the public carousel payload and to `PartnerData`,
  because `entity_id` is a UUID and today only `slug` reaches the browser;
- the listener is attached **once, to the visible track only**, and the
  `aria-hidden` duplicate is excluded — a click on a decorative clone is not a
  click;
- the beacon uses `navigator.sendBeacon` and **never delays navigation**. For the
  external destination the visitor leaves the page; `sendBeacon` is precisely the
  API that survives that, and the existing `sendViewBeacon` already prefers it.

**A-4 · Owner read endpoint.** `GET /api/v1/protected/partners/mine/stats`,
modelled byte-for-byte on `mine-mentions.ts`:

- no `requiredPermissions`, no `requireEntitlement` (§5.6);
- no id in the path — *"There is nothing to address but your own log, which is
  what makes 'a partner cannot read another's' structural rather than a check
  that could be forgotten"*;
- resolves the partner from `ownerUserId = actor.id`, fails closed to an
  "unavailable" payload rather than 403/404;
- actor-dependent ⇒ never cacheable, never public tier.

**A-5 · The panel section.** A new `PartnerStatsSection.astro`, a sibling of
`PartnerMentionsSection.astro` on `/mi-cuenta/aliados/`, with its own heading, its
own container and its own i18n subtree (`account.partnerStats.*`, never
`account.partnerMentions.*`). Degrades to nothing on a failed fetch, joining the
same parallel `Promise.all` batch as the other four fetches on that page.

### 6.2 Phase B — blocked on OQ-3

The newsletter metrics. Nothing here can be built until the
`partner_mentions` ↔ `newsletter_campaigns` relation is decided, because without
it the question "which campaign did this partner appear in?" has no answer in the
database. **The cut is explicit: Phase A ships without Phase B, and the panel
omits the newsletter card entirely rather than rendering an empty one.**

### 6.3 What is NOT built

- Nothing reads or writes `partners.analytics` (G-5).
- No admin dashboard.
- No per-partner in-email click attribution (NG-2).

## 7. UX / UI behaviour

### 7.1 Placement and separation

The stats block is a **sibling section** on `/mi-cuenta/aliados/`, below or above
the mentions log, never inside it — honouring `PartnerMentionsSection.astro:16-21`
verbatim: different heading, different container, different i18n subtree.

### 7.2 Silver must never see a zero

A silver partner has no page at `/partners/<slug>/`; the URL 404s by design
(`apps/web/CLAUDE.md`, "Partner pages: gold has one, silver does not"). Its view
count is therefore not *low*, it is **undefined**.

**Rendering `0` is a bug, not a rounding.** "0 visitas" reads as "nobody came to
see you"; the true statement is "this metric does not exist at your tier". The
views card for a partner with no own page renders an explanatory line and a link
to what gold adds — never a numeral.

The predicate is **"does this partner have a public page?"**, derived the same way
the carousel derives its link (gold **and** a slug), and NOT a bare `tier ===
'silver'` check. A gold partner missing its slug fails the same way and must get
the same treatment; `resolvePartnerLogoLink` already fails closed on exactly that
case.

The clicks card is unaffected: a silver partner with a `websiteUrl` receives real
clicks (§5.3), and hiding a number we do have is the mirror-image error.

### 7.3 The panel says whose numbers these are

The block carries the presentation's own sentence, not a paraphrase:

> Todas las estadísticas que te mostramos son de lo que pasa dentro de Hospeda —
> nuestras páginas y nuestro newsletter. De lo que publicamos afuera te damos
> constancia, no medición.
> — `presentacion/aliados/index.astro:158-160`

Two reasons this is a requirement and not decoration. First, the partner read that
exact sentence before signing, and a panel that omits it invites the question it
was written to pre-empt. Second, it is the standing instruction of the sibling
component: a stats block placed next to the mentions log is the precise position
from which the log starts looking like a performance report.

### 7.4 Windows

`7d` / `30d`, matching `EntityViewWindowSchema` and the host widget. No custom
ranges. Whether anything longer is offered depends on OQ-1.

## 8. Risks

- **R-1 · `EntityTypeEnum` is shared by four subsystems and adding a value has
  measurable blast radius.** The enum feeds user tags (`r_entity_tag`), bookmarks
  (`user_bookmarks`), QR codes (`qr_codes.entity_type`) and `entity_views`. Adding
  `PARTNER` breaks, in this order: the frozen-count guard
  (`entity-type.enum.test.ts:11-19`, `toHaveLength(12)`) and three exhaustive
  `Record<EntityTypeEnum, …>` maps (`entity-access-registry.ts:87`,
  `entity-search.utils.ts:362` and `:496`). **All four fail loudly** — one test,
  three compile errors — which is the good kind of blast radius. Mitigation is to
  treat A-1 as one atomic change and to run `pnpm typecheck` across `admin` and
  `service-core`, not just `schemas`.
  The known-bad pattern in this repo is the *quiet* half: a new enum value that
  needs a companion row (the `revalidation_config` case) is invisible until
  production. `RevalidationEntityTypeEnum` already has `partner`, so that specific
  trap is not armed here — but the guard must still be run, not assumed.
- **R-2 · `ALTER TYPE … ADD VALUE` is not transactional in older Postgres and is
  irreversible.** An enum value cannot be dropped. Once `PARTNER` exists in
  `entity_type_enum` it is permanent; this is acceptable (the same is true of the
  other twelve) but it means the naming decision is final.
- **R-3 · The click beacon lands on the home page**, which is under active
  performance work (HOS-160, HOS-168). A React island for one listener would be a
  regression against those specs. OQ-2 is scoped around that constraint.
- **R-4 · The 95-day purge destroys history that cannot be rebuilt.** This is the
  `batchId` lesson from `partner_mention.dbschema.ts:76-78` — *"It must exist from
  the first migration or never: which rows were logged together is not derivable
  after the fact"* — applied to time series. Whatever is not rolled up before day
  95 is gone. OQ-1.
- **R-5 · The copy/code disagreement on silver clickability (§5.3) will surface
  the moment a silver partner sees a non-zero click count** on a logo the
  commercial table says is not clickable. This spec does not create the
  disagreement and does not resolve it; it should be filed as its own issue
  against HOS-294's surface.
- **R-6 · Curated partners are invisible to their own numbers** (§5.5). If the
  commercial page has been sent to a partner who was later entered by hand, the
  promise is already unfulfillable for them today. OQ-4 decides what is done about
  it; doing nothing is a valid answer only if it is a decision.

## 9. Acceptance criteria

Each is exercisable — a named test, a request that can be issued, or an
observation on a running page. Nothing here asserts an intention.

- **AC-1** — `POST /api/v1/public/views` with `{"entityType":"PARTNER","entityId":"<uuid>"}`
  and a non-bot User-Agent answers `202 {"accepted":true}` and inserts exactly one
  `entity_views` row. Before A-1 the same request answers `400` — a regression
  test asserts both directions, since a route that accepts everything and a route
  that accepts nothing both pass a one-sided test.
- **AC-2** — `EntityTypeEnum` has 13 values and the frozen-count guard asserts 13,
  not 12. Verified by the test file itself.
- **AC-3** — Loading `/{lang}/partners/<gold-slug>/` in a browser produces exactly
  one `POST /api/v1/public/views` request, observable in the network panel, and
  the response headers still carry the `detail` cache class
  (`s-maxage=3600, stale-while-revalidate=3600`). The second half is the real
  assertion: it proves the count did not cost the cache.
- **AC-4** — Clicking a gold logo in the home carousel records exactly ONE click
  event, and clicking the corresponding logo in the `aria-hidden` duplicate track
  records ZERO. Asserted with a DOM test over the rendered marquee, not by
  inspecting the source — a `toContain` over the file cannot tell the two tracks
  apart.
- **AC-5** — Clicking a logo that points to an external site records the click AND
  the navigation still occurs. Asserted by spying on the beacon transport and
  confirming no `preventDefault`.
- **AC-6** — `GET /protected/partners/mine/stats` as an actor who owns no partner
  answers 200 with an "unavailable" payload — never 403, never 404. Same assertion
  the mentions log already carries: a 403 would confirm a partner exists.
- **AC-7** — `GET /protected/partners/mine/stats` declares no `requiredPermissions`
  and no `requireEntitlement`. Asserted by a **static guard** over the route module,
  in the shape HOS-376 uses for its role-blind routes — N future call sites cannot
  each be trusted to remember, and a runtime test would pass against a route that
  simply happens not to be gated yet.
- **AC-8** — The stats section and the mentions section render as two `<section>`
  elements with distinct headings and no shared ancestor other than the page
  layout, and no key under `account.partnerStats.*` appears under
  `account.partnerMentions.*`. Asserted structurally, because this is exactly the
  invariant `PartnerMentionsSection.astro:16-21` asked for.
- **AC-9** — For a partner with no public page, the views card renders **no
  numeral at all** — asserted by a negative match on digits inside the card, not
  by asserting the string "0" is absent, which passes on a card rendering `0
  visitas` in a locale that spells it differently.
- **AC-10** — The panel renders the "todas las estadísticas … de lo que pasa
  dentro de Hospeda" sentence in all three locales, guarded by the existing i18n
  coverage mechanism.
- **AC-11** — No file changed by this spec references `partners.analytics`,
  `PartnerAnalytics` or `incrementAnalytics`. Asserted by a static guard so it
  survives a future contributor who finds the column and assumes it is the
  intended home.
- **AC-12** — (Phase B only, if OQ-3 resolves in favour) A partner whose mention
  row names a campaign sees that campaign's `totalRecipients`, opened count and
  clicked count; a partner whose mention row names no campaign sees the mention in
  the log and no newsletter numbers. Both halves asserted — the second is what
  proves the panel does not invent a zero for an unlinked mention.

## 10. Open questions

Each carries options, trade-offs, blast radius and a recommendation.

### OQ-1 · `entity_views` or a persistent aggregate? (the 95-day question)

That `entity_views` is the right mechanism and `partners.analytics` is not is
settled by §2.2 and §5.1 — the dead column has no time dimension, no callers, one
production bug to its name and an explicit repo-level prohibition. The real
question is what happens at day 95.

1. **`entity_views` alone.** *Does:* 7d/30d windows, exactly as the host widget.
   *Pros:* zero new tables, zero new crons; the purge cron already exists and is
   tuned (30-day window + 65 days slack). *Cons:* on day 96 the first month is
   irrecoverable. A partner — a municipality especially — asking "how did last
   season go?" gets nothing, forever. *Impact:* none beyond A-1.
2. **`entity_views` + a monthly rollup written before the purge.** *Does:* a small
   append-only monthly aggregate (`entity_type`, `entity_id`, `month`, `total`,
   `unique`), written by a monthly cron, read for anything older than the live
   window. *Pros:* history survives; the rollup is one `GROUP BY` and is written
   for **every** trackable type, not only PARTNER, so it does not become a
   partner-only special case that silently returns zeros when someone later reads
   it for accommodations. *Cons:* one table, one cron, one more thing that can
   fail silently. *Impact:* additive; nothing existing changes behaviour.
3. **Raise the TTL.** *Pros:* one constant. *Cons:* unbounded growth of an
   append-only event table that every entity type writes to, to serve a read
   pattern that only needs monthly totals. Wrong tool.

**Recommendation: 2.** Not because history is promised — the commercial page
promises no retention window — but because of R-4: option 1 is only reversible
until day 95, and after that the decision has been made by a cron rather than by
the owner. The rollup is the cheapest way to keep the choice open, and writing it
for all types rather than for PARTNER alone costs strictly less code than
filtering.

### OQ-2 · How is the logo click instrumented?

The panel must show a number, so the count has to reach **our** database — the
same reasoning HOS-734 recorded when it wired the beacon and deliberately skipped
PostHog for commerce: the beacon *"feeds the real owner-facing stat"*, PostHog
feeds funnels.

1. **A second `entity_views` row.** *Pros:* zero new anything. *Cons:* corrupts
   the view count for the same `(entityType, entityId)` — a click would be
   indistinguishable from a page view, and the views card would over-report by
   however many clicks the logo got. Disqualifying.
2. **An `event_type` column on `entity_views`.** *Pros:* one table, one endpoint.
   *Cons:* a migration on a hot append-only table shared by five entity types, and
   every existing query must learn to filter — a fail-open, since a query that
   forgets the filter silently over-counts and looks fine.
3. **A dedicated append-only `partner_logo_clicks`**, shaped like `entity_views`
   (`partner_id`, `visitorHash`, `destination`, `clickedAt`), captured by a sibling
   public endpoint, purged by the same TTL. *Pros:* no existing query changes;
   the semantics stay honest; `destination: 'own_page' | 'external'` records the
   §5.3 distinction without taking a position on it. *Cons:* a second table and a
   second endpoint that look 80% like the first.
4. **PostHog only.** *Pros:* no backend work. *Cons:* the panel would have to
   query PostHog server-side on an authenticated page render. Against the
   precedent, and a third-party outage would take the panel down.

**Recommendation: 3**, plus — orthogonally — the near-zero-JS delivery R-3
demands: one delegated `click` listener in a small inline `<script>` on
`PartnersSection.astro`, scoped to the visible track, reading `data-partner-id`
off the anchor. No React island on the home page.

On timing: fire on `click` with `navigator.sendBeacon`, never `preventDefault`,
never a delay. `sendBeacon` exists for exactly the unload case, and the fallback
already in `view-capture.ts` uses `fetch(keepalive: true)`.

On whether the two destinations count the same: **yes, both count**, tagged. The
promise is "cuántos entraron desde tu logo" and it draws no distinction. Storing
the tag costs one column and makes a future distinction possible without a
backfill.

### OQ-3 · Is the `partner_mentions` ↔ `newsletter_campaigns` relation added?

Without it the newsletter metric is not computable at all. What is needed is
narrower than it first looks: because the promise is campaign-level (NG-2), a
single reference per mention row is sufficient.

1. **Nullable `campaign_id` FK on `partner_mentions`.** *Pros:* one column;
   `channel` is already singular per row (`partner_mention.dbschema.ts:34-42`), so
   one FK per row is exact rather than a compromise. The admin form changes from
   "type a URL" to "pick a campaign", which also removes a class of typo. *Cons:*
   a column that is meaningful for one of six channel values. Per HOS-377's own
   precedent the per-channel rule belongs in Zod, not in a CHECK constraint — *"a
   CHECK encoding the per-channel logic would have to be rewritten every time a
   channel is added"* (`:90-94`).
2. **A join table.** *Pros:* models many-to-many. *Cons:* there is no many-to-many
   here — one mention row is one appearance in one place — so it is a table to
   carry a column.
3. **Do not add it; drop the newsletter metric from the panel.** *Pros:* zero
   work. *Cons:* the commercial page promises it, in detail, to people who have
   already signed. Requires retracting published copy.
4. **Do not add it; defer.** Ship Phase A, keep the promise open.

**Recommendation: 1, scheduled as Phase B, not deferred indefinitely.** It is one
nullable FK, an admin-form change and an aggregate query — small enough that
option 3 (retracting a signed promise) is not worth its cost. But it is genuinely
separable from Phase A, so it must not hold the shippable half hostage.

### OQ-4 · What happens to curated partners with no `ownerUserId`?

Restating §5.5: they can never see the panel, because every read is scoped by
ownership and fails closed. This is a product decision.

1. **Accept it silently.** *Pros:* nothing to build. *Cons:* the failure is
   invisible to ops — nobody knows which partners cannot see what was promised
   until one of them asks.
2. **Accept it, but make it visible.** An admin-side indicator on the partner row
   ("no owner account — this partner cannot see their panel"), so ops can act
   before the partner complains. *Pros:* cheap, honest. *Cons:* still no panel.
3. **A dedicated admin action to assign an owner** —
   `POST /admin/partners/{id}/assign-owner`, in the shape of the existing
   `review-content` and `revoke` endpoints. *Pros:* fits the codebase exactly;
   `ownerUserId` stays out of `updatePartnerSchema`, so the HOS-278 D1 guarantee
   ("an admin must not be able to hand the listing to a different account as an
   unremarkable field edit") survives — a deliberate action is not a field that
   rode along. *Cons:* one endpoint, one admin UI affordance, one audit concern.
4. **Auto-create an account for every curated partner.** *Cons:* see OQ-5.
5. **Email a periodic report instead.** *Pros:* no account needed. *Cons:* a
   second, divergent rendering of the same numbers, and email is the one channel
   where a wrong number cannot be corrected after sending.

**Recommendation: 2 + 3.** Make the gap visible so it stops being silent, and give
ops one deliberate action to close it when a curated partner asks. Together they
turn "these partners are structurally excluded" into "these partners are excluded
until someone chooses otherwise", which is what the schema comment intended.

### OQ-5 · Is an account created for every partner at activation?

The owner's original question, now answerable with §5.5 in hand: **two of the
three branches already produce an owner without creating anything.** Branch 1
links an existing account at approval; branch 2 backfills via the claim token.
Auto-creation would only ever fire for branch 3.

1. **Auto-create at activation.** *Pros:* the panel is universally reachable.
   *Cons:* an unverified Better Auth identity nobody asked for, holding a password
   nobody set, tied to an email address an admin typed. It creates a real login
   surface for a person who has not consented to one — and if the typed address is
   wrong, an account for a stranger. Also has to answer what happens when that
   person later signs up normally with the same email.
2. **Never auto-create; use the claim path.** The mechanism already exists and is
   already hashed, single-use and fail-closed (`digestClaimToken`,
   `claimTokenMatches`). *Pros:* no unrequested identities; reuses tested code.
   *Cons:* the claim token is currently bound to an alliance lead, so a curated
   partner (which has no lead) cannot be issued one without extending that flow.
3. **Never auto-create; ops assigns on request** — OQ-4 option 3.

**Recommendation: 3, with 2 as a later refinement.** Creating accounts nobody
asked for is the kind of decision that is trivial to make and expensive to
reverse, and it is not needed: the partner who wants their numbers can sign up in
a minute, after which assigning ownership is one admin action. If the volume of
such requests ever justifies it, extending the claim token to curated partners
(option 2) is the better second step — it is a mechanism the codebase already
trusts.

### OQ-6 · What is done with the dead `partners.analytics` column?

1. **Leave it.** *Pros:* zero risk. *Cons:* it stays a trap — it is named exactly
   what a future contributor would search for, and it is what this very issue
   proposed using. The prohibition currently lives in a comment on a *different*
   table's file.
2. **Drop it, in a separate migration and a separate PR.** *Pros:* removes the
   trap. No backfill is required — nothing reads it (§2.2) — so this is a pure
   contract, not an expand/contract pair. *Cons:* the drop touches more than the
   column: `partner.schema.ts:56`, `partner.create.schema.ts:36`,
   `PARTNER_OWNER_FORBIDDEN_FIELDS` (`partner.owner.schema.ts:102`),
   `PartnerModel.incrementAnalytics`, and the `stripShapeDefaults` regression test
   that exists *because* of this column
   (`packages/schemas/test/partial-patch-preserves-unsent-fields.test.ts:24`) —
   which must be re-pointed at another defaulted JSONB field rather than deleted,
   or the guard it represents is lost with its subject.
3. **Drop it inside this spec.** *Cons:* a statistics feature carrying a
   destructive migration is how a rollback becomes complicated. No.

**Recommendation: 2, filed as its own chore issue, blocked on nothing.** And note
the sibling: `sponsorship.analytics`
(`packages/db/src/schemas/sponsorship/sponsorship.dbschema.ts:48`) is the same
JSONB-counter shape and should be assessed in the same issue rather than
rediscovered later. This spec's own obligation is only AC-11: touch neither.

## 11. Implementation notes

- **Order.** A-1 is atomic and lands first; nothing else compiles without it.
  A-2/A-3/A-4/A-5 are independent of one another afterwards.
- **The i18n subtree is `account.partnerStats.*`.** Chosen so no key can collide
  with `account.partnerMentions.*`, which is what AC-8 asserts.
- **The stats section ships zero JavaScript**, like its sibling. That keeps its
  keys out of `CLIENT_I18N_KEY_PREFIXES` — adding one would fail the guard test,
  which recomputes that list from the real import graph and rejects entries in
  both directions (`PartnerMentionsSection.astro:26-30`).
- **`/mi-cuenta/*` is never edge-cached**, so reading the session server-side in
  the new section is correct — the same note the mentions component carries.
- **The capture endpoint answers 202 for a bot and 202 for a DB outage.** Any test
  asserting "the beacon worked" by checking the HTTP status is vacuous. Assert the
  row.
- **This spec adds no environment variable.** `HOSPEDA_VIEWS_HASH_SECRET` already
  exists and is what `computeVisitorHash` reads.
- **Migrations.** One structural (`ALTER TYPE`), via `pnpm db:generate`. No extras
  carril, no seed data-migration — no catalog row changes, so the dual-write rule
  does not apply. If OQ-1 resolves to option 2, one more structural migration for
  the rollup table.
- **Smoke labels.** Phase A warrants `status-needs-smoke-local` (the beacon and
  the double-track click are browser behaviour a unit test approximates) and
  `status-needs-smoke-staging` (the cache headers on the gold page under real
  Cloudflare, which is the one assertion in AC-3 that cannot be made locally).

## 12. Linear

Canonical tracking:
HOS-1063
