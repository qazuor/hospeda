---
title: Partner statistics — the numbers the commercial page already promised
linear: HOS-1063
statusSource: linear
created: 2026-09-04
decisionsResolvedOn: 2026-09-04
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

### 1.1 Decision status — resolved 2026-09-04

**All six open questions in §10 were decided by the owner on 2026-09-04.** They
are kept in place, each marked RESOLVED with its decision and its date. A
resolved question is not deleted here: deleting it deletes the reason the choice
was made, and these six are exactly the kind that get re-litigated in three
months by someone who finds the dead column or the empty newsletter card and
assumes nobody thought about it. **§10 is a decision record, not a to-do list.**

Two of the decisions are worth flagging up front because they change what this
document previously said:

- **OQ-5 inverted the spec's own recommendation.** The spec recommended *never*
  auto-creating accounts; the owner decided account provisioning must be
  automatic for whoever needs access. The spec now carries the owner's decision,
  with the technical caveat that shapes *how* it is automatic (§10 OQ-5).
- **That inversion opened a new question, OQ-7 — resolved the same day.** Every
  ACTIVE partner of either tier qualifies; panel access is not tier-gated, and
  each card is gated by whether its underlying surface exists. **Nothing in this
  spec is blocked.** §6.4 records what the question was and why the evidence
  settled it that way.

## 2. Three corrections before anything is built

All three are load-bearing. Implementing HOS-1063 from the issue text alone would
rebuild something already in production and resurrect a column the repo forbids;
§2.3 was added on 2026-09-04 after the owner, reading this spec, was led into a
fourth misreading it had invited.

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
Disposal is OQ-6, resolved 2026-09-04: drop it, in its own issue, together with
the re-pointing of the regression test that exists because of it.

### 2.3 Three different things are being confused, and only ONE of them is missing

This subsection exists because the spec as first written invited a misreading,
and the owner hit it. The question, verbatim (2026-09-04):

> «¿qué pasa con las publicaciones en redes? además de la parte automática del
> newsletter, ¿yo podría agregar a mano lo de redes?»

**Yes — and it is not something to build, because it is already in production and
already manual.** Three distinct things live near each other here. Confusing any
two of them produces a wrong plan, so they are separated once, here, and referred
to by these names for the rest of the document.

| | What it is | State | What HOS-1063 does to it |
|---|---|---|---|
| **(a) The appearance log** | An admin records, by hand, that a mention happened: channel, date, link. Six channels — `INSTAGRAM`, `FACEBOOK`, `TWITTER`, `NEWSLETTER`, `WHATSAPP`, `OTHER`. | **Shipped** (HOS-377). Admin CRUD at `apps/api/src/routes/partners/admin/mentions/{create,list,update,delete}.ts`; partner-facing read at `GET /protected/partners/mine/mentions`. | **Nothing.** It stays manual, forever, by design. Only its on-page neighbour changes (§2.1). |
| **(b) The newsletter ↔ campaign link** | Which *campaign* a `NEWSLETTER` row refers to. | **Missing.** The row holds admin-typed free text and a URL; there is no FK, so nothing can say which send it was. | **This is the only gap.** One nullable FK — OQ-3, Phase B. |
| **(c) Social reach and clicks** | How many people saw or clicked an Instagram/Facebook post. | **Does not exist and never will.** | **Nothing, deliberately.** NG-1, NG-6. |

Three consequences, stated flatly because each has already been assumed
backwards at least once:

1. **(a) is not automatic and must not become automatic.** The presentation sells
   it as *constancia*, not *medición*: "Sí te informamos cuándo se publicó, con el
   enlace a la publicación, para que entres y la veas vos mismo"
   (`presentacion/aliados/index.astro:153`). A human typing what they actually
   did is the entire product here. The schema says the same thing in its own
   words — *"It is deliberately a LOG OF FACTS, not an analytics table. There is
   no reach, impression or click column and there must never be one"*
   (`partner_mention.dbschema.ts:16-18`).
2. **(b) is not about adding social numbers.** It adds nothing the partner can
   see about Instagram. It only lets a `NEWSLETTER` row point at the campaign
   whose sent/opened/clicked counts **already exist** in
   `newsletter_campaign_deliveries` (§5.4). Today those numbers exist and are
   unreachable, because nothing connects the mention to the send.
3. **(c) is a refusal, not a backlog item.** It is the line the commercial page
   draws before the prospect signs, and both halves of that line are load-bearing:
   promising social metrics later would contradict a document the partner has
   already read.

**The short answer to the owner's question:** adding social appearances by hand
is what already happens today — that is (a), it is live, and this spec does not
touch it. The automatic half is only ever (b): matching a newsletter entry to the
campaign it belongs to so its existing numbers become readable.

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
- **G-6** — A curated partner with no owner account can be given one by a
  deliberate admin action, so "this partner cannot see what we promised them" is a
  state ops can fix rather than a structural dead end (OQ-4).
- **G-7** — A partner who needs the panel gets their account **without anyone
  having to remember to do it**, and that account belongs to a real person who
  asked for it. Automatic ≠ fabricated: the invitation is what fires
  automatically, the account is what the recipient creates (OQ-5).
- **G-8** — The appearance log (§2.3 (a)) is not made automatic, not extended
  with reach or click columns, and not merged into the stats block.

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
- **NG-5** — Dropping `partners.analytics` is not done here. OQ-6 resolved to
  dropping it in **its own issue**; this spec's only obligation to that column is
  AC-11 (touch neither it nor its sibling).
- **NG-6** — No reach, impression or click column is added to `partner_mentions`,
  now or later. §2.3 (c). This is stated as a non-goal and not only as a
  non-decision because the stats block landing beside the log (§7.1) is precisely
  the moment someone proposes "while we are here, add the numbers to the log too".
- **NG-7** — No Better Auth account is created from an admin-typed email address
  without the addressee acting. OQ-5 is satisfied by an automatic **invitation**,
  not by an automatic identity — see OQ-5 for why the distinction is the whole
  decision.
- **NG-8** — No entitlement or plan-level gate is placed on the panel route
  itself. §5.6 explains why an entitlement check is the wrong instrument here;
  which partners are *invited* is a separate matter (OQ-7) and is decided at
  invitation time, not at read time.

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
instruments the click must be near-zero JavaScript. Resolved by OQ-2: an inline
delegated listener, not an island (A-3, AC-16).

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
that requires new modelling. Resolved by OQ-3: a nullable `campaign_id` FK,
delivered as Phase B (§6.2). Note what this is and is not — it is §2.3 (b), the
newsletter↔campaign link, and it adds no social measurement of any kind.

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
closed. That is a product decision, not an implementation detail to route around
— and it was made: OQ-4 + OQ-5 resolved it into Phase C (§6.3). The owner's rule
is that anyone who needs a panel must have a user, so an owner-less partner is
not an acceptable resting state.

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

### 5.7 What the presentation actually promises per tier — read line by line

OQ-5's decision turns on the phrase «los que tienen estadísticas en su plan», so
the commercial page was re-read specifically for that. **The finding is that the
presentation does not make statistics a tier feature at all.** Every line that
mentions numbers, with its tier scope:

| Line | Says | Tier scope |
|---|---|---|
| `:143-147` "Sí te damos números" | page views + logo clicks; newsletter sent/opened/clicked | **No tier mentioned.** Addressed to the prospect, whichever level they take |
| `:157-161` "todas las estadísticas … dentro de Hospeda" | the platform/social boundary | **No tier mentioned** |
| `:170-184` the two-level comparison table, 8 rows | logo in carousel · logo clickable · where the click goes · own page · social posts · newsletter · priority · appearance log | **Has NO statistics row.** Not one of the eight rows mentions numbers, statistics or a panel |
| `:176` | "Se puede hacer clic en tu logo" | plata **—** · oro **sí** |
| `:178` | "Página propia" | plata **—** · oro **sí** |
| `:180` | "Entrás en el newsletter" | plata **sí** · oro **sí** |
| `:182` | "Registro con enlace de cada aparición" | plata **sí** · oro **sí** |
| `:213` | "El newsletter … de esos sí tenemos números para pasarte" | in "La difusión", **both tiers** |
| `:214` | "Todo queda anotado. Cada aparición se registra en tu panel" | **both tiers** |
| `:324` | "Tus números y tu registro de difusión, en el mismo panel: las visitas a tu página, y cada aparición con su fecha y su enlace" | in "Qué manejás vos", **no tier mentioned** |
| `:336` | "En nivel plata no hay página propia: tu logo está en la portada **pero no lleva a ningún lado**" | plata, explicit |

**Conclusion, and it is the load-bearing one for OQ-7:** the page gates the
*surfaces*, never the *statistics*. Nothing is sold as "gold gets numbers, silver
does not". What follows mechanically:

| Metric | Promised to silver? | Why |
|---|---|---|
| Page views | **No** | Not withheld — silver has no page to view (`:178`, `:336`). The metric is undefined, not zero (§7.2) |
| Logo clicks | **Per the copy, no** | `:176` and `:336` both say the silver logo is not clickable. **The code disagrees** (§5.3, R-5) |
| Newsletter numbers | **Yes** | `:180` and `:213` are unqualified. Silver is in the newsletter, and its numbers are promised |
| Appearance log | **Yes** | `:182` and `:214`. Already shipped and already ungated |

So a silver partner is promised at least two of the four things a gold partner
is, and one of those two (the log) is already rendering for them today. **A panel
that silver cannot open would break a promise the page makes in four separate
places.** That is what OQ-7 has to confirm, because the owner's phrase implies a
subset the presentation does not define.

## 6. Proposed design

All six questions are answered (§10), so the phases below are no longer
"blocked/unblocked" — they are a delivery order. **Only §6.4 is blocked, and only
on OQ-7.**

### 6.1 Phase A — the two in-platform metrics

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

**A-3 · Logo-click capture.** **Decided (OQ-2): a dedicated append-only
`partner_logo_clicks` table** (`partner_id`, `visitorHash`, `destination`,
`clickedAt`), a sibling public capture endpoint shaped like
`POST /api/v1/public/views` (`skipAuth`, bot-filtered, rate-limited, always 202),
purged by the same TTL cron. `destination: 'own_page' | 'external'` is stored so
the §5.3 distinction is recorded without this spec taking a position on it. Both
destinations count — the promise is "cuántos entraron desde tu logo" and draws no
distinction.

**Delivery is a delegated listener in a small inline `<script>` on
`PartnersSection.astro`, NOT a React island** — R-3: the carousel is on the home
page, whose JS budget is the subject of HOS-160 and HOS-168, and one listener does
not justify hydrating a component there.

Three further things are fixed here:

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

**Which cards it renders is per-partner and derived from data, never from
`tier`** — the rules are in §6.4 (2) and the reasoning in §7.2. In Phase A that
means a views card and a clicks card, each present only when the surface it
measures exists for that partner; the newsletter card arrives with Phase B and is
absent, not empty, until then (G-4).

**A-6 · The monthly rollup.** **Decided (OQ-1): `entity_views` plus a monthly
aggregate written before the purge.** A small append-only table
(`entity_type`, `entity_id`, `month`, `total`, `unique`), written by a monthly
cron, read for anything older than the live 30-day window.

Two constraints on it, both from R-4 and neither optional:

- **It is written for EVERY trackable entity type, not for `PARTNER` alone.** A
  partner-only rollup becomes a table that silently returns zeros the first time
  someone reads it for accommodations, and filtering to one type costs strictly
  more code than not filtering.
- **It must land at the same time as A-2/A-3, not later.** The purge cron deletes
  at day 95 and the data it deletes cannot be reconstructed. A rollup added in a
  follow-up issue starts its history on the day it ships, not on the day counting
  started — the `batchId` lesson (`partner_mention.dbschema.ts:76-78`) applied to
  a time series.

### 6.2 Phase B — the newsletter metrics (OQ-3 resolved: build it)

**Decided (OQ-3): add a nullable `campaign_id` FK on `partner_mentions`.** This
is §2.3 (b) and nothing else — it makes the sent/opened/clicked counts that
already exist in `newsletter_campaign_deliveries` reachable from the mention that
refers to them. Three parts:

1. the nullable FK, structural carril;
2. the admin mention form changes from "type a URL" to "pick a campaign" for the
   `NEWSLETTER` channel — which also removes a class of typo. Per HOS-377's own
   precedent the per-channel rule lives in Zod, **not** in a CHECK constraint
   (`partner_mention.dbschema.ts:90-94`);
3. an aggregate read (`GROUP BY campaign_id`) behind the `mine/stats` endpoint.

**Phase A ships without Phase B**, and until B lands the panel **omits** the
newsletter card rather than rendering an empty one (G-4). After B lands, a
mention row with a null `campaign_id` still shows in the log with no numbers
beside it — the null case is permanent, not transitional, because historical
rows will never be backfilled with a campaign nobody recorded. AC-12 asserts both
halves.

### 6.3 Phase C — ownership and access (OQ-4 + OQ-5 resolved)

The panel is worth nothing to a partner who cannot log in. §5.5 established that
curated partners never can. Both decisions here are the owner's.

**C-1 · Admin action to assign an owner.** `POST /admin/partners/{id}/assign-owner`,
a dedicated endpoint in the shape of the existing `review-content` and `revoke`
routes. **`ownerUserId` stays out of `updatePartnerSchema`** — that omission is
the HOS-278 D1 guarantee that an admin cannot hand a listing to a different
account as an unremarkable field edit that rode along in a form submission, and a
deliberate, separately-authorised, separately-audited action preserves it. AC-14
asserts the schema omission survives, because this is exactly the kind of
constraint a future contributor removes to "simplify".

**C-2 · The gap is visible before anyone complains.** An admin-side indicator on
the partner row: *no owner account — this partner cannot see their panel*.
Without it, the failure is silent and ops learns which partners were promised
numbers they cannot reach only when one of them asks.

**C-3 · Automatic invitation, not automatic account.** The owner's decision
(2026-09-04) is that provisioning must not depend on anyone remembering:

> «sólo los que necesitan acceso, por ejemplo los que tienen estadísticas en su
> plan; si ya tenemos el mail del partner haría que la creación sea automática»

So the **system fires the invitation**, automatically, at the moment a partner
qualifies — no admin has to remember and no request has to arrive. **The account
is created when the recipient claims it.** Operationally this is the automatic
behaviour asked for; technically it avoids creating an identity nobody consented
to (see OQ-5 for the full argument and NG-7 for the boundary).

The claim mechanism already exists and is already hashed, single-use and
fail-closed (`digestClaimToken` / `claimTokenMatches`,
`alliance-lead.service.ts:370-382`). **One extension is required:** `claimToken`
lives on `alliance_lead` (`alliance_lead.dbschema.ts`), and a curated partner has
no lead — so the token must become issuable against a partner directly. That is
the entire technical cost of C-3.

**Where the address comes from is not settled by "si ya tenemos el mail".**
Measured: `partners.contactInfo` is nullable jsonb whose `personalEmail` and
`workEmail` are both `nullish()` (`contact.schema.ts:34-38`), so a partner may
have no address at all; and the billing path does not supply one either — it
synthesises `partner-<id>@partners.hospeda.invalid`
(`admin/send-link.ts`). Worse, `contactInfo` is the **public directory** contact
— the address a partner publishes for customers to reach them — which is not
necessarily the address of the person who should hold the account. C-3 therefore
sends to a recorded address when one exists and **surfaces the partner in C-2's
indicator when one does not**, instead of guessing.

### 6.4 Which partners are invited — OQ-7, resolved 2026-09-04

> **Answer: every ACTIVE partner of either tier.** Panel access is not tier-gated;
> each card is gated by whether its underlying surface exists. The analysis that
> follows is what produced that answer and is kept because it is the evidence, not
> the opinion.

Everything above is buildable. The one thing that is not is **the predicate C-3
fires on**: «los que tienen estadísticas en su plan» does not select a subset that
the presentation defines (§5.7 measured this line by line — the commercial page
has no statistics row in its tier table and promises silver at least the
newsletter numbers and the appearance log).

**What is blocked:** only the invitation trigger. Not the panel, not the
endpoint, not the cards, not C-1, not C-2. C-3 can be built with its trigger
behind the answer.

**Proposed gate, for the owner to confirm or correct (OQ-7):**

1. **Panel access is not tier-gated.** Any partner with an owner account opens
   the panel. No `tier` check, no entitlement check (NG-8, §5.6).
2. **Each CARD is gated by whether its underlying surface exists for that
   partner, derived from data — never from a tier label.** This is §7.2's
   predicate generalised, and the reason is that a `tier === 'gold'` check would
   be a second, independent source of truth about clickability that drifts from
   the carousel the moment R-5 is resolved either way:

   | Card | Rendered when |
   |---|---|
   | Views | the partner has a public page — gold **and** a slug, the same derivation `resolvePartnerLogoLink` uses |
   | Clicks | `resolvePartnerLogoLink` returns a link at all, so the card can never disagree with what the carousel actually renders |
   | Newsletter | always (Phase B) |
   | Appearance log | always — already the case today |

3. **The invitation therefore fires for every ACTIVE partner of either tier**,
   because under (1) and (2) every active partner has at least two cards with
   real content.

**The two things the owner has to settle**, because the presentation does not:

- **(a) Does silver get a panel?** The gate above says yes, on the evidence of
  §5.7: four separate lines promise silver the newsletter numbers and the
  appearance log, and the log already renders for them. If the intent was
  gold-only, the presentation needs a correction *before* this ships, not after —
  it has already been sent to signed partners.
- **(b) Which side of R-5 wins?** The copy says the silver logo "no lleva a
  ningún lado" (`:176`, `:336`); the code links it to the partner's own
  `websiteUrl` whenever one is filled in (§5.3). If the copy wins, silver has no
  clicks card and the code changes. If the code wins, silver has a real clicks
  number and the copy changes. **The gate above is deliberately written to work
  under either answer** — it reads the same function the carousel reads — so
  Phase A does not wait on R-5. But R-5 must be filed and answered, because a
  silver partner seeing a non-zero click count on a logo the comparison table
  says is not clickable is a contradiction the partner can see.

### 6.5 What is NOT built

- Nothing reads or writes `partners.analytics` (G-5). Dropping it is OQ-6's own
  issue, not this one.
- No admin dashboard.
- No per-partner in-email click attribution (NG-2).
- No reach/impression/click column on `partner_mentions` — §2.3 (c), NG-6.
- No account created from an admin-typed address without the addressee acting —
  NG-7.

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

The clicks card follows the identical rule, one step further: it renders when
`resolvePartnerLogoLink` returns a link **at all**, and is absent when it returns
none (the day-one state — a freshly provisioned partner has `websiteUrl = null`
and no slug, so its logo is not a link and cannot be clicked). A silver partner
with a `websiteUrl` does receive real clicks today (§5.3), and hiding a number we
do have is the mirror-image error.

**Both cards read the same function the carousel reads.** That is the point, not
an implementation convenience: any card whose visibility is derived from `tier`
independently would be a second source of truth about what the home page renders,
and would go wrong the moment R-5 is resolved in either direction. Deriving from
`resolvePartnerLogoLink` makes the panel structurally unable to disagree with the
carousel. §6.4 (2) generalises this to all four cards.

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
ranges.

**OQ-1 resolved in favour of the monthly rollup (A-6), so a longer view is
possible — but it is not part of Phase A.** The rollup's job in Phase A is to
*preserve* the history the 95-day purge would otherwise destroy, not to render
it. Whether the panel later offers a per-month view is a UI decision that can be
made at any time, precisely because A-6 keeps the data. That asymmetry is the
whole reason A-6 ships now: the UI is reversible, the deletion is not.

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
  regression against those specs. **Resolved by OQ-2**: the listener ships as an
  inline delegated `<script>`, and AC-16 fails if a `client:` directive appears on
  `PartnersSection.astro`.
- **R-4 · The 95-day purge destroys history that cannot be rebuilt.** This is the
  `batchId` lesson from `partner_mention.dbschema.ts:76-78` — *"It must exist from
  the first migration or never: which rows were logged together is not derivable
  after the fact"* — applied to time series. Whatever is not rolled up before day
  95 is gone. **Resolved by OQ-1** — the monthly rollup (A-6) — and the mitigation
  only works if A-6 ships **inside Phase A**: a rollup added in a follow-up starts
  its history the day it deploys, not the day counting began.
- **R-5 · The copy/code disagreement on silver clickability (§5.3) will surface
  the moment a silver partner sees a non-zero click count** on a logo the
  commercial table says is not clickable. The copy states it **twice** —
  `presentacion/aliados/index.astro:176` ("Se puede hacer clic en tu logo: plata
  —") and `:336` ("tu logo está en la portada pero no lleva a ningún lado") —
  while `resolvePartnerLogoLink` links a silver logo to its `websiteUrl` whenever
  one is filled in. This spec does not create the disagreement and does not
  resolve it; it must be **filed as its own issue** against HOS-294's surface, and
  §6.4 (b) records it as a decision the owner owes. Mitigation, already in the
  design: both the clicks card and the views card derive from
  `resolvePartnerLogoLink` itself (§7.2), so whichever way R-5 goes, the panel
  follows the carousel automatically and no card has to be re-gated.
- **R-6 · Curated partners are invisible to their own numbers** (§5.5).
  **Resolved by OQ-4 + OQ-5 (2026-09-04):** C-1 gives ops a deliberate action to
  assign an owner, C-2 makes the gap visible before a partner complains, and C-3
  fires the invitation automatically. The residual risk is narrower and worth
  naming: **C-2 without C-1 is a report nobody can act on, and C-1 without C-2 is
  an action nobody knows to take.** They ship together or the gap stays silent in
  a new way.
- **R-7 · The invitation can be sent to the wrong person.** `partners.contactInfo`
  is the *public directory* contact — an address the partner publishes for
  customers — and both its email fields are `nullish()`. Sending a claim link to
  it can therefore reach a shared inbox, or nobody. This is exactly why C-3 issues
  an invitation rather than creating the account (NG-7): a claim link that lands
  in the wrong inbox is an unredeemed token, whereas an auto-created account in
  the wrong inbox is a stranger holding a login to a partner's panel. The failure
  mode is bounded by design, not by care.
- **R-8 · The stats block landing beside the appearance log is the moment someone
  proposes merging them.** §7.1 and AC-8 forbid it structurally, and §2.3 explains
  why: the log is *constancia*, the block is *medición*, and the presentation sold
  those as different things. NG-6/G-8 exist so this is a stated refusal rather
  than an omission a future contributor reads as an oversight.

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
- **AC-12** — (Phase B) A partner whose mention row names a campaign sees that
  campaign's `totalRecipients`, opened count and clicked count; a partner whose
  mention row names no campaign sees the mention in the log and no newsletter
  numbers. Both halves asserted — the second is what proves the panel does not
  invent a zero for an unlinked mention, and it is the permanent case, not a
  transitional one (§6.2).
- **AC-13** — A logo click inserts exactly ONE `partner_logo_clicks` row and
  **ZERO `entity_views` rows**, and the views card's number is unchanged by it.
  Both halves are the assertion: the second is the whole reason OQ-2 rejected
  reusing `entity_views`, and a test that only counts the new row passes just as
  well against the rejected design.
- **AC-14** — `updatePartnerSchema.safeParse({ ownerUserId: '<uuid>' })` does not
  yield an `ownerUserId` in its parsed output, and `PartnerModel`'s update path
  never receives one from that schema. Asserted by a **static guard** over the
  schema module, not only by a parse test: this is the HOS-278 D1 guarantee and it
  is removed by a one-line "simplification" that a runtime test on today's fields
  would not notice.
- **AC-15** — Assigning an owner flips a measurable state in both directions:
  before `POST /admin/partners/{id}/assign-owner`, `GET /protected/partners/mine/stats`
  as that user answers the "unavailable" payload; after it, the same request
  answers that partner's stats. Asserting only the post-state passes against an
  endpoint that was already returning stats to everyone.
- **AC-16** — `PartnersSection.astro` contains no `client:` directive, asserted by
  a static guard. R-3's constraint is that the home page gains no island for this;
  the guard fails if one is added, which a rendering test would not.
- **AC-17** — The monthly rollup cron, run over seeded `entity_views` rows of
  **two different entity types**, writes rows for both — not only for `PARTNER`.
  Asserted with an accommodation alongside a partner, because a rollup that
  silently covers one type is indistinguishable from a correct one when only that
  type is tested (A-6).
- **AC-18** — A partner reaching the qualifying state produces exactly one
  invitation and creates **zero `users` rows**. The second half is the assertion
  that matters: it is NG-7, and it is what separates "the invitation is automatic"
  from "the account is fabricated". The *qualifying predicate itself* is OQ-7's and
  its criterion is deferred with it — this AC covers the mechanism, which is
  exercisable today under any predicate.
- **AC-19** — Redeeming the claim token creates the account and backfills
  `partners.ownerUserId`, after which `GET /protected/partners/mine/stats` answers
  for that actor. A second redemption of the same token fails — the existing token
  is single-use and hashed, and reusing the mechanism is only worth anything if
  that property is asserted at the new call site too.
- **AC-20** — `partner_mentions` has no column whose name matches
  `reach|impression|click|view`, asserted by a static guard over the schema. NG-6
  and G-8: the log is a record of facts and the stats block shipping beside it is
  precisely when someone proposes adding performance columns to it.

## 10. Open questions — decision record

**All six questions below were resolved by the owner on 2026-09-04. A seventh,
OQ-7, was opened by OQ-5's answer and resolved the same day. Nothing is open.**

The options and trade-offs are kept verbatim under each resolved question. They
are the reason the choice was made, and a decision recorded without its
alternatives is a decision that gets re-argued from scratch. Five of the six went
the way the spec recommended; **OQ-5 did not, and that inversion is marked
explicitly there rather than quietly edited away.**

| | Question | Decision | Where it lands |
|---|---|---|---|
| OQ-1 | 95-day purge | **RESOLVED** — `entity_views` + monthly rollup (option 2) | A-6 |
| OQ-2 | logo-click mechanism | **RESOLVED** — dedicated `partner_logo_clicks` + inline delegated listener (option 3) | A-3 |
| OQ-3 | newsletter ↔ campaign | **RESOLVED** — nullable `campaign_id` FK (option 1), Phase B | §6.2 |
| OQ-4 | curated partners with no owner | **RESOLVED** — make it visible **and** give ops an assign action (options 2 + 3) | C-1, C-2 |
| OQ-5 | account per partner | **RESOLVED — against the spec's recommendation** — automatic invitation | C-3 |
| OQ-6 | dead `partners.analytics` | **RESOLVED** — drop it in a separate issue (option 2) | its own issue |
| **OQ-7** | **which partners are invited** | **RESOLVED** — every ACTIVE partner of either tier; cards gated by surface, not by tier | C-3 |

### OQ-1 · RESOLVED (2026-09-04) — `entity_views` + monthly rollup

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

> **DECISION (owner, 2026-09-04): option 2 — `entity_views` plus a monthly
> rollup written before the purge.** As recommended.
>
> Rationale, unchanged: not because history is promised — the commercial page
> promises no retention window — but because of R-4. Option 1 is only reversible
> until day 95, and after that the decision has been made by a cron rather than by
> the owner. The rollup is the cheapest way to keep the choice open, and writing
> it for all trackable types rather than for PARTNER alone costs strictly less
> code than filtering.
>
> Lands as **A-6**, and it ships **with Phase A, not after it** — a rollup added
> later starts its history on the day it ships, which defeats the only reason it
> exists. Asserted by AC-17.

### OQ-2 · RESOLVED (2026-09-04) — dedicated `partner_logo_clicks` table

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

> **DECISION (owner, 2026-09-04): option 3 — a dedicated `partner_logo_clicks`
> table — with the listener delivered as a small inline `<script>`, NOT a React
> island.** As recommended, both halves.
>
> The delivery half is not a detail: R-3 is a real constraint, the carousel is on
> the home page, and HOS-160/HOS-168 are actively reducing its JS. One delegated
> `click` listener in an inline `<script>` on `PartnersSection.astro`, scoped to
> the visible track, reading `data-partner-id` off the anchor. Asserted by AC-16.
>
> On timing: fire on `click` with `navigator.sendBeacon`, never `preventDefault`,
> never a delay. `sendBeacon` exists for exactly the unload case, and the fallback
> already in `view-capture.ts` uses `fetch(keepalive: true)`. Asserted by AC-5.
>
> On whether the two destinations count the same: **yes, both count**, tagged. The
> promise is "cuántos entraron desde tu logo" and it draws no distinction. Storing
> the tag costs one column and makes a future distinction possible without a
> backfill — which matters more than it looks, because R-5 may yet force that
> distinction.
>
> Option 1's disqualifying flaw is what AC-13 asserts against: a click landing in
> `entity_views` would inflate the views number by however many clicks the logo
> received, and nothing in the panel would look wrong.

### OQ-3 · RESOLVED (2026-09-04) — nullable `campaign_id` FK, as Phase B

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

> **DECISION (owner, 2026-09-04): option 1 — the nullable `campaign_id` FK,
> scheduled as Phase B.** As recommended.
>
> It is one nullable FK, an admin-form change and an aggregate query — small
> enough that option 3 (retracting a promise already made to signed partners) is
> not worth its cost. But it is genuinely separable from Phase A, so it does not
> hold the shippable half hostage. Lands as **§6.2**, asserted by AC-12.
>
> **Clarification requested by the owner (2026-09-04), recorded because the spec
> as first written invited the opposite reading:**
>
> > «¿qué pasa con las publicaciones en redes? además de la parte automática del
> > newsletter, ¿yo podría agregar a mano lo de redes?»
>
> **Adding social appearances by hand is what already happens, today, in
> production** — the appearance log (HOS-377), where an admin records channel,
> date and link, and the partner sees it. It is §2.3 (a), this spec does not touch
> it, and **it must stay manual**: the presentation sells that half as *constancia,
> no medición*, and the schema forbids reach/click columns on it in writing
> (`partner_mention.dbschema.ts:16-18`). NG-6 and G-8 make that a stated refusal;
> AC-20 guards it.
>
> **OQ-3 adds no social measurement whatsoever.** All it does is let a
> `NEWSLETTER` log entry point at the campaign it refers to, so the
> sent/opened/clicked figures that **already exist** in
> `newsletter_campaign_deliveries` become readable. Today that entry is free text
> and a URL an admin typed, so nothing can say which send it was — the numbers
> exist and are unreachable.
>
> Restated as three separate things, because conflating any two produces a wrong
> plan: **(a)** the manual appearance log — exists, stays manual; **(b)** the
> newsletter↔campaign link — the only gap, and the only thing OQ-3 builds;
> **(c)** social reach and clicks — deliberately never measured. Full table in
> §2.3.

### OQ-4 · RESOLVED (2026-09-04) — make the gap visible AND give ops an action

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

> **DECISION (owner, 2026-09-04): options 2 + 3, framed by a general rule the
> owner stated:**
>
> > «cualquiera que necesite panel (para ver estadísticas por ejemplo) debe tener
> > user»
>
> So an owner-less partner is not an acceptable resting state for anyone who needs
> the panel. Make the gap visible so it stops being silent (**C-2**), and build the
> deliberate admin action that closes it (**C-1**).
>
> **`ownerUserId` stays out of `updatePartnerSchema`.** The dedicated endpoint is
> not ceremony: the omission is the HOS-278 D1 guarantee that a listing cannot be
> handed to a different account as an unremarkable field that rode along in a form
> submission. A deliberate action preserves that; widening the update schema would
> destroy it while looking like a simplification. Asserted by AC-14, and the
> before/after state change by AC-15.
>
> Note the two halves are co-dependent (R-6): C-2 without C-1 is a report nobody
> can act on; C-1 without C-2 is an action nobody knows to take.

### OQ-5 · RESOLVED (2026-09-04) — AUTOMATIC, and this INVERTS the spec's recommendation

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

**The spec recommended: 3, with 2 as a later refinement** — never auto-create,
have ops assign on request. That recommendation was **not adopted.** It is left
here in full, above and in this sentence, because the decision below is a
deliberate override of a stated argument and not an oversight, and because
whoever revisits this in three months is owed both sides.

> **DECISION (owner, 2026-09-04): provisioning is AUTOMATIC.**
>
> > «sólo los que necesitan acceso, por ejemplo los que tienen estadísticas en su
> > plan; si ya tenemos el mail del partner haría que la creación sea automática»
>
> **Why the recommendation was overridden, and it is a good reason:** option 3
> ("ops assigns on request") makes the promise depend on someone remembering. The
> commercial page tells the partner their numbers are waiting in their panel; a
> flow where nothing happens until the partner notices, complains, and an admin
> acts is a promise kept only for the partners who chase it. The owner's rule from
> OQ-4 — whoever needs a panel must have a user — is not satisfiable by a manual
> queue.
>
> **What is built (C-3): the INVITATION fires automatically; the ACCOUNT is
> created when the person claims it.** Operationally this is exactly the automatic
> behaviour asked for — nobody has to remember anything, and the partner's access
> arrives without a request. The distinction is only in who performs the final
> step, and it is worth insisting on for reasons the owner's own framing supports:
>
> - **The email is admin-typed and unverified.** Nothing has confirmed the address
>   exists or that its holder wants an account. Creating the identity anyway means
>   a wrong keystroke provisions a login for a stranger, on a real auth system,
>   holding a partner's data.
> - **It creates a credential nobody set.** A Better Auth row with a password no
>   human chose is an account that can only be entered through a reset flow — i.e.
>   through a claim step anyway, but one that now hangs off an identity that
>   already exists.
> - **"si ya tenemos el mail" is doing more work than it can bear.** Measured:
>   `partners.contactInfo` is nullable jsonb whose `personalEmail` and `workEmail`
>   are both `nullish()` (`contact.schema.ts:34-38`), and the billing path does not
>   supply one either — it synthesises `partner-<id>@partners.hospeda.invalid`
>   (`admin/send-link.ts`). And when an address *is* present it is the **public
>   directory contact**, the one the partner publishes for customers, which is not
>   necessarily the person who should hold the account. So "we already have the
>   email" is true for some partners, false for others, and *ambiguous* for the
>   rest. R-7.
> - **It has to answer a question option 2 does not raise:** what happens when
>   that person later signs up normally with the same address and finds an account
>   already exists that they never made.
>
> **The mechanism already exists**, which is why this costs little: the claim
> token is hashed, single-use and fail-closed (`digestClaimToken` /
> `claimTokenMatches`, `alliance-lead.service.ts:370-382`). **One extension is
> required** — `claimToken` lives on `alliance_lead`
> (`alliance_lead.dbschema.ts`) and a curated partner has no lead, so the token
> must become issuable against a partner directly.
>
> Asserted by AC-18 (one invitation, **zero `users` rows**) and AC-19 (claiming
> creates the account, backfills `ownerUserId`, and the token does not work
> twice). NG-7 states the boundary.
>
> **This decision opened OQ-7, resolved the same day.** «los que tienen
> estadísticas en su plan» had to name a set before C-3 had a trigger, and §5.7
> found that the presentation does not define one. The answer was therefore not to
> invent the subset but to drop the tier gate: **every ACTIVE partner of either
> tier qualifies**, with each card gated by whether its surface exists.

### OQ-6 · RESOLVED (2026-09-04) — drop it, in its own issue

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

> **DECISION (owner, 2026-09-04): option 2 — drop it, in its own issue, blocked
> on nothing.** As recommended. Explicitly **not** option 3: a statistics feature
> carrying a destructive migration is how a rollback becomes complicated.
>
> **Two things that issue must carry, or the drop loses more than the column:**
>
> 1. **`partial-patch-preserves-unsent-fields.test.ts:24` must be RE-POINTED, not
>    deleted.** That regression test exists *because* of this column — a defaulted
>    JSONB field not in `PartnerModel.mergeableJsonbColumns`, which is how an admin
>    editing a partner's name once wiped the accumulated counters (§2.2). Deleting
>    the test alongside its subject removes the guard against the whole class of
>    bug, silently and while looking like tidy cleanup. It must be re-pointed at
>    another defaulted JSONB field so the invariant keeps being asserted.
> 2. **`sponsorship.analytics` is the same shape and belongs in the same issue.**
>    `packages/db/src/schemas/sponsorship/sponsorship.dbschema.ts:48` is the
>    identical JSONB-counter pattern; assessing it now costs one file to read and
>    prevents rediscovering it as a surprise later.
>
> The drop also touches `partner.schema.ts:56`, `partner.create.schema.ts:36`,
> `PARTNER_OWNER_FORBIDDEN_FIELDS` (`partner.owner.schema.ts:102`) and
> `PartnerModel.incrementAnalytics`. No backfill is required — nothing reads it —
> so it is a pure contract, not an expand/contract pair.
>
> **This spec's own obligation remains only AC-11: touch neither column.**

### OQ-7 · ✅ RESOLVED (2026-09-04) — which partners qualify for an invitation?

**Decision: every ACTIVE partner of either tier. Panel access is not tier-gated;
each card is gated by whether its underlying surface exists.** The proposal below
was confirmed as written, and sub-question (a) was answered **yes — a silver
partner does get a panel**.

Sub-question (b) was settled separately, on the same day, on HOS-1159: the
presentation is right and the **code is wrong**, so a silver logo must stop being
clickable. That does not change anything here — under §6.4 (2) the click card is
gated by whether the logo links anywhere, so it simply will not render for silver
once HOS-1159 ships. The card rule was written to survive either answer, and it
did.

**Nothing in this spec is blocked any more.** C-3's trigger now has its predicate.

The reasoning that produced the decision is kept below, unedited, because the
question was not obvious and the evidence is what settles it if anyone reopens it.

---

Opened by OQ-5's decision on 2026-09-04. **It blocked exactly one thing: the
predicate C-3 fires on.** Not the panel, not the endpoint, not the cards, not C-1,
not C-2, not Phase A, not Phase B. C-3's mechanism (AC-18, AC-19) is buildable and
testable under any answer.

The owner's phrase was «sólo los que necesitan acceso, por ejemplo los que tienen
estadísticas en su plan». **§5.7 read the commercial presentation line by line
looking for that subset and did not find one:** the two-level comparison table has
eight rows and not one of them mentions statistics, numbers or a panel. What the
page gates by tier are the *surfaces* — the own page (`:178`) and the logo's
clickability (`:176`, `:336`) — while the newsletter (`:180`, `:213`) and the
appearance log (`:182`, `:214`) are promised to **both** tiers, unqualified.

**Proposed answer, for the owner to confirm or correct:** every ACTIVE partner of
either tier qualifies, because under the card rules in §6.4 every active partner
has at least two cards with real content (newsletter numbers and the appearance
log — the latter already renders for them today). Panel access is not tier-gated;
each card is gated by whether its underlying surface exists, derived from
`resolvePartnerLogoLink` rather than from a `tier` label, so no card can disagree
with what the home page actually renders.

Two sub-questions only the owner can settle:

- **(a) Does a silver partner get a panel at all?** The proposal says yes, on the
  evidence of four separate lines of copy. **If the intent was gold-only, the
  presentation is wrong and must be corrected before this ships** — it has already
  been sent to partners who signed after reading it. This is the half worth
  answering carefully; the other is smaller.
- **(b) Which side of R-5 wins?** The copy says the silver logo "no lleva a ningún
  lado"; the code links it to the partner's `websiteUrl` whenever one is filled
  in. Whichever way it goes, the panel follows automatically under §6.4 (2) — but
  it must be filed and answered, because a silver partner reading a real click
  count on a logo the comparison table says is not clickable is a contradiction
  they can see.

**Recommendation on sequencing:** do not hold Phase A, Phase B, C-1 or C-2 for
this. Build C-3's mechanism, leave its trigger behind the answer, and ship the
rest.

## 11. Implementation notes

- **Order.** A-1 is atomic and lands first; nothing else compiles without it.
  A-2/A-3/A-4/A-5 are independent of one another afterwards. **A-6 is not
  optional-later**: it must ship inside Phase A, because the purge it protects
  against is already running (§6.1 A-6, R-4).
- **Phase independence.** Phase A → Phase B → Phase C is a delivery order, not a
  dependency chain: B needs nothing from A but the panel to render into, and C
  needs nothing from either. **Nothing is blocked** — C-3's trigger got its
  predicate when OQ-7 was resolved (§6.4).
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
- **Migrations**, all structural carril via `pnpm db:generate`. No extras carril
  and **no seed data-migration** — no catalog row changes, so the dual-write rule
  does not apply.

  | Phase | Migration |
  |---|---|
  | A-1 | `ALTER TYPE entity_type_enum ADD VALUE 'PARTNER'` |
  | A-3 | `CREATE TABLE partner_logo_clicks` (OQ-2) |
  | A-6 | `CREATE TABLE` for the monthly rollup (OQ-1) |
  | B | nullable `campaign_id` FK on `partner_mentions` (OQ-3) |
  | C-3 | the claim token becomes issuable against a partner, not only a lead |

  The `ALTER TYPE` is irreversible (R-2). The other four are additive and
  reversible. **Nothing in this spec drops a column** — the one drop this work
  identified is OQ-6's, and it is deliberately in a different issue and a
  different PR precisely so a rollback of the statistics feature never has to
  reason about a destructive migration.
- **Smoke labels.** Phase A warrants `status-needs-smoke-local` (the beacon and
  the double-track click are browser behaviour a unit test approximates) and
  `status-needs-smoke-staging` (the cache headers on the gold page under real
  Cloudflare, which is the one assertion in AC-3 that cannot be made locally).
  **Phase C adds `status-needs-smoke-staging` of its own**: C-3 sends real email
  and the claim redemption creates a real Better Auth identity, neither of which
  a stubbed local run exercises honestly. The two staging smokes cover distinct
  concerns and each needs its own sign-off.
- **Follow-up issues this spec creates and does not do**, so none of them is lost
  when HOS-1063 closes: **(i)** OQ-6's drop of `partners.analytics` plus the
  assessment of `sponsorship.analytics`, with the re-pointing of
  `partial-patch-preserves-unsent-fields.test.ts`; **(ii)** R-5, the silver
  clickability contradiction between the copy and `resolvePartnerLogoLink`, filed
  against HOS-294's surface; **(iii)** OQ-7 itself if the owner's answer requires
  a change to the commercial presentation.

## 12. Linear

Canonical tracking:
HOS-1063
