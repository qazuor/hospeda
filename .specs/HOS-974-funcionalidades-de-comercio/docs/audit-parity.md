# Half A · Parity matrix — complete

**Measured** 2026-09-01 against `origin/staging`; **decided** 2026-09-01 by the
owner. Every cell in the measurement columns is **MEASURED** with file:line
evidence unless marked otherwise. The two decision columns are the owner's
verdicts, recorded verbatim — all 40 of them (20 keys × 2 verticals).

## How each column was measured

- **Enforced for accommodation?** — counted the sites that require **the key**
  (`EntitlementKey.<KEY>`), then read each hit to separate a real enforcement
  (`requireEntitlement`, a `hasEntitlement` that decides render, a service check)
  from a mere mention (config, types, tests, marketing copy). Grepping for the
  named middleware helper does **not** work here: four helpers marked
  `// PHANTOM-GATE` are mounted on no route while the keys they name are enforced
  elsewhere through the generic `requireEntitlement`.
- **Surface in the vertical?** — `ALREADY WORKS` / `GATE MISSING` (the feature
  exists and is reusable, the check assumes accommodation) / `FEATURE MISSING`.
- **Free today?** — the column that orders everything else. With
  `entitlements: []`, anything that works on a commerce listing today works **for
  every commerce owner at no charge**. Gating it later takes it away from someone
  who had it.

## The matrix

Gastronomy and experiences are separate domains and are answered separately.

### Enforced for accommodation

| Key | Enforced? | Notes |
|---|---|---|
| `AI_CHAT` | ✅ | hardcoded to the `accommodations` table |
| `AI_TEXT_IMPROVE` | ✅ | endpoint is entity-agnostic (no id in the body) |
| `AI_TRANSLATE` | ✅ | the underlying service knows 5 entity types; neither vertical is one |
| `AI_ACCOMMODATION_IMPORT` | ✅ | imports from Airbnb/Booking — accommodation by definition |
| `PUBLISH_ACCOMMODATIONS` | ✅ | |
| `EDIT_ACCOMMODATION_INFO` | ✅ | `accommodation/protected/patch.ts:126` |
| `CAN_USE_CALENDAR` | ✅ 4 routes | occupancy tables FK directly to `accommodation` |
| `CAN_SYNC_EXTERNAL_CALENDAR` | ✅ 3 routes | |
| `FEATURED_LISTING` | ✅ 4 sites | resolver + addon + expiry cron + admin toggle |
| `HAS_VERIFICATION_BADGE` | ✅ | `entitlement-filter.ts`, fail-closed |
| `CAN_USE_RICH_DESCRIPTION` | ✅ | read filter + `gateRichDescription` mounted on patch |
| `CAN_EMBED_VIDEO` | ✅ | **was** phantom; fixed by `f58eff4e7` — see Findings |
| `CUSTOM_BRANDING` | ❌ **phantom** | 0 routes; no field in ANY vertical, accommodation included |
| `VIEW_BASIC_STATS` | ✅ 5 routes | all under `conversations/`, `views/`, `host/` |
| `VIEW_ADVANCED_STATS` | ✅ 2 routes | favourites breakdown + market comparison |
| `CAN_CONTACT_WHATSAPP_DISPLAY` | ✅ 2 sites | `getWhatsApp.ts` (fail-closed) + list filter |
| `CAN_CONTACT_WHATSAPP_DIRECT` | ✅ | same endpoint |
| `RESPOND_REVIEWS` | ❌ **phantom** | "reply to a review" exists in NO vertical |
| `CREATE_PROMOTIONS` | ✅ 3 routes | model bound to `accommodationId` |
| `PRIORITY_SUPPORT` | ❌ **phantom** | no code anywhere — an operational promise, not software |

### Gastronomy and experiences — surface, cost, and what it would take

Sorted by **how urgently a decision is needed**, not alphabetically. The ones
running free come first: every day they stay ungated is another owner who will
lose something when a tier finally claims them.

| Key | Gastronomy | Experiences | Free today? | Decision — gastronomy | Decision — experiences |
|---|---|---|---|---|---|
| `CAN_USE_RICH_DESCRIPTION` | GATE MISSING | GATE MISSING | **YES — confirmed live** | `TIER: pro` | `TIER: pro` |
| `CAN_EMBED_VIDEO` | GATE MISSING | GATE MISSING | **YES via the API** — public schemas expose `videos: true`; no front-end renders it yet | `TIER: pro` | `TIER: pro` |
| `EDIT_ACCOMMODATION_INFO` | GATE MISSING | GATE MISSING | **YES — and gating it would lock every commerce owner out (see F-11)** | `TIER: basic` — as a new key `EDIT_GASTRONOMY_INFO` | `TIER: basic` — as a new key `EDIT_EXPERIENCE_INFO` |
| `AI_TEXT_IMPROVE` | ALREADY WORKS | ALREADY WORKS | **PARTIALLY** — only for dual-role actors (see F-12) | `TIER: pro` | `TIER: pro` |
| `CAN_CONTACT_WHATSAPP_DISPLAY` | FEATURE MISSING | FEATURE MISSING | No — but a dead typed field is a latent trap (F-13) | `TIER: basic` | `TIER: basic` |
| `CAN_CONTACT_WHATSAPP_DIRECT` | FEATURE MISSING | FEATURE MISSING | No — refines a channel neither vertical exposes | `TIER: basic` | `TIER: basic` |
| `VIEW_BASIC_STATS` | FEATURE MISSING | FEATURE MISSING | No | `TIER: basic` | `TIER: basic` |
| `VIEW_ADVANCED_STATS` | FEATURE MISSING | FEATURE MISSING | No — no conceptual analogue | `TIER: premium` | `TIER: premium` |
| `FEATURED_LISTING` | FEATURE MISSING | FEATURE MISSING | No — but see F-14 on the `isFeatured` name clash | `TIER: premium` **and also an `ADDON`** | `TIER: premium` **and also an `ADDON`** |
| `HAS_VERIFICATION_BADGE` | FEATURE MISSING | FEATURE MISSING | No — column does not exist | `LATER` | `LATER` |
| `CREATE_PROMOTIONS` | FEATURE MISSING | FEATURE MISSING | No — data model bound to `accommodationId` | `TIER: basic` | `TIER: basic` |
| `AI_CHAT` | FEATURE MISSING | FEATURE MISSING | No — hardcoded to `accommodations` | `TIER: premium` | `TIER: premium` |
| `AI_TRANSLATE` | FEATURE MISSING | FEATURE MISSING | No — the service itself knows neither vertical | `TIER: basic` | `TIER: basic` |
| `AI_ACCOMMODATION_IMPORT` | FEATURE MISSING | FEATURE MISSING | No — a commerce equivalent is a new feature, not a port | `TIER: premium` | `TIER: premium` |
| `PUBLISH_ACCOMMODATIONS` | FEATURE MISSING | FEATURE MISSING | No — no owner self-publish flow in either vertical | `TIER: basic` — as a new key `PUBLISH_GASTRONOMY` | `TIER: basic` — as a new key `PUBLISH_EXPERIENCE` |
| `CAN_USE_CALENDAR` | FEATURE MISSING | FEATURE MISSING | No — no table; FK is accommodation-only | `DOES NOT APPLY` | `LATER` — **not this key**: HOS-1040 |
| `CAN_SYNC_EXTERNAL_CALENDAR` | FEATURE MISSING | FEATURE MISSING | No | `DOES NOT APPLY` | `DOES NOT APPLY` — there is no excursion OTA to sync with |
| `RESPOND_REVIEWS` | phantom everywhere | phantom everywhere | No | `TIER: basic` — stays `upcoming` (D-B) | `TIER: basic` — stays `upcoming` (D-B) |
| `PRIORITY_SUPPORT` | phantom everywhere | phantom everywhere | No | `TIER: pro` — stays `upcoming` (D-B) | `TIER: pro` — stays `upcoming` (D-B) |
| `CUSTOM_BRANDING` | phantom everywhere | phantom everywhere | No | `TIER: premium` — stays `upcoming` (D-B) | `TIER: premium` — stays `upcoming` (D-B) |

`TIER: basic` means the cheapest **paid** tier grants it and every tier above
inherits it. There is no free commerce tier — publishing costs money — so `basic`
is the floor of the product, not a giveaway.

## What the measurement found

### F-11 · Gating edit would lock every commerce owner out, not "close a leak"

Zero routes under `apps/api/src/routes/gastronomy/` and `.../experience/` mention
`entitlementMiddleware`, `requireEntitlement` or `hasEntitlement`. The equivalent
accommodation route gates at `accommodation/protected/patch.ts:126`.

That absence is **not an oversight to be patched**. With `entitlements: []`,
mounting the gate today would deny every commerce owner the ability to edit their
own listing — the missing gate is the only reason the product works at all.

The real question for H2/H3 is therefore not "should edit be gated" but "what does
the cheapest tier have to grant so that gating edit does not break the people
already paying".

### F-12 · `AI_TEXT_IMPROVE` leaks through role, not through vertical

The endpoint takes `{fieldValue, fieldType, locale}` with **no entity id**, so it
can only gate on the actor's entitlements — it cannot know what the text belongs
to. An actor holding both `HOST` and `COMMERCE_OWNER` already improves commerce
copy for free. A pure `COMMERCE_OWNER` falls back to `TOURIST_FREE_PLAN` and is
blocked.

Same feature, available or not depending on a role that has nothing to do with the
vertical. Any decision to sell this per tier has to deal with the shape of the
endpoint first.

### F-13 · A dead typed field is a loaded gun

`GastronomyContactBlock.astro` reads `socialNetworks.whatsapp` **with no gate**.
The field does not exist in the real `SocialNetworkSchema` (facebook, instagram,
twitter, linkedIn, tiktok, youtube), the owner editor does not offer it, and no
seed fixture carries it — so nothing writes it today and it is **not** an active
leak. (Not verified against production rows.)

But the render path is live. Any manual import or migration that writes that key
straight into the JSONB publishes a WhatsApp number publicly, ungated, with no
warning. Worth deleting on its own merits, independent of any tiering decision.

### F-14 · `isFeatured` means two different things

Gastronomy and experiences already have an `isFeatured` flag, rendered today in
cards and headers. It is **admin curation**, not the entitlement — the
accommodation equivalent of `featuredByEntitlement` exists in neither table, and
neither does the machinery (resolver, reconcile cron, addon grant table).

Reading the name alone produces a false "featured is being given away". It is not.

### F-15 · Statistics are closer than they look, and further than they look

`EntityTypeEnum` already carries `GASTRONOMY` and `EXPERIENCE`, and `entity_views`
reuses that same Postgres enum — the table would accept those rows **without a
migration**. What blocks capture is one narrower Zod enum,
`TrackableEntityTypeSchema`, which lists only accommodation, post and event, plus
the fact that no view tracker is mounted on either commerce detail page.

So basic view counts are genuinely cheap. `VIEW_ADVANCED_STATS` is not: favourites
breakdown and market comparison are accommodation-specific in their business
logic, not merely in their gate, and have no obvious analogue for a restaurant.

## Defects this measurement confirmed or found

| Issue | State after measuring |
|---|---|
| **HOS-357** (`CAN_EMBED_VIDEO` gates nothing) | **ALREADY FIXED** by `f58eff4e7`, whose message says it outright. The issue is still open and should be closed. |
| **HOS-924** (experience publishable with WhatsApp only, contact not shown) | **CONFIRMED, and wider than reported** — see below. |
| **HOS-363** (experience WhatsApp CTA never renders) | **Still true, cause now different.** After HOS-815 `contactInfo` does reach the public payload, but `whatsapp` stays excluded, so the early return still fires every time. The component's own JSDoc documents itself as dormant. |
| `socialNetworks.whatsapp` dead field | **New** — F-13. No issue yet. |
| `AI_TEXT_IMPROVE` dual-role leak | **New** — F-12. No issue yet. |

### HOS-924 is a three-field problem, not one

`hasReachableContactChannel` accepts any of `homePhone`, `workPhone`,
`mobilePhone`, `whatsapp`, `personalEmail`, `workEmail` as enough to publish.
`ExperiencePublicContactInfoSchema` exposes only `workEmail`, `workPhone`,
`mobilePhone`, `website`.

Three fields — **`whatsapp`, `homePhone` and `personalEmail`** — are sufficient to
publish and are never displayed. An experience whose owner filled any one of them
alone passes every validator and ships a public page with no way to contact it.

And the reason is worth keeping: `whatsapp` is excluded from the public schema
deliberately, so as not to "serve a gated value to everyone", because on
accommodation it is a paid entitlement. **Protecting one business model opened the
hole in the other.**

## The four framework decisions

Taken by the owner on 2026-09-01. They are the reason the matrix above could be
filled at all, and they are settled — H2/H3/H4 build on them, they do not reopen
them.

### D-A · Commerce inherits `TOURIST_VIP_ENTITLEMENTS` whole

All 15 keys (`plans.config.ts:57-73`, counted). A commerce owner is also a tourist
on this platform, so the tourist-side grants come along as a block rather than
being re-derived per vertical — exactly as the six host plans already spread them
(`plans.config.ts:118, 161, 210, 268, 312, 367`), which means every tier of a
vertical gets all 15, not just the top one.

**This cross-checks two rows of the matrix.** `CAN_CONTACT_WHATSAPP_DISPLAY` and
`CAN_CONTACT_WHATSAPP_DIRECT` are *inside* those 15, and the owner independently
placed both at `TIER: basic`. The two answers agree, so D-A grants them and no
separate decision is needed.

### D-B · The three phantom keys are not built now

`RESPOND_REVIEWS`, `PRIORITY_SUPPORT` and `CUSTOM_BRANDING` enforce nothing
anywhere on the platform — accommodation included. Their tier is recorded above so
the comparison page has an answer to give, and they stay `status: 'upcoming'`
there. That is already what the page says, so nothing is being mis-sold today and
nothing has to change to keep it honest.

### D-C · Addons declare `productDomain`

**Rejected**: putting the verticals into `PlanCategory`. That enum carries an
ordinal rank — `tourist < owner < complex` — and a vertical has no place on that
line. `productDomain` already discriminates the four domains and is where the
addon belongs.

### D-D · The tier travels in the checkout body

The way `start-paid.ts:261` already resolves the plan from `body.planSlug`. The
env var is retired.

### Caps

`1 / 3 / 10` listings for both verticals. Today `commerceVerticalTier()` takes a
single `maxListings` and **all six tiers pass `1`** (`plans.config.ts:690, 704,
739, 763, 777, 794`). Widening that factory to take a per-tier cap is the first
change H2 has to make.

## Edit and publish: replicate accommodation

The one verdict the matrix could not answer on its own. Four new keys —
`EDIT_GASTRONOMY_INFO`, `PUBLISH_GASTRONOMY`, `EDIT_EXPERIENCE_INFO`,
`PUBLISH_EXPERIENCE` — granted at all three tiers of their own vertical, and gated
on the commerce routes exactly the way `accommodation/protected/patch.ts:126`
gates its own.

The alternative was to gate on the active subscription alone, which is what
`commerceVerticalTier()`'s own comment describes as today's design: *"Commerce
visibility is driven by the subscription status through
`commerce_listing_subscriptions` + the reconciler, not by the entitlement engine
— … there is simply nothing to put in the first half of that pattern."* That
route costs zero new keys.

**The owner chose parity over economy: one mechanism across the platform, not
two.** The precedent being copied is exact — on accommodation, `EDIT_ACCOMMODATION_INFO`
and `PUBLISH_ACCOMMODATIONS` are already granted by **all six** host plans
(`plans.config.ts:120, 163, 212, 270, 314, 369`), so a key that is uniformly true
across every tier of a vertical is the existing convention, not a compromise
invented here.

### Sequencing is load-bearing

Commerce plans declare `entitlements: []`. Mount the gate before the grant ships
and **every commerce owner loses the ability to edit their own listing** — F-11 is
not a leak to close, it is what makes the product work today. The grant and the
gate go in the same release, and within it the grant goes first.

The same warning covers the other rows that are free today
(`CAN_USE_RICH_DESCRIPTION`, `CAN_EMBED_VIDEO`, `AI_TEXT_IMPROVE`): all three land
on `TIER: pro`, so gating them takes something away from an owner on the entry
tier who has it for free today. That is a deliberate, priced decision — not a
regression to be reported once it ships.

### R-2 applies to every one of these keys

Per HOS-973 R-2, the limit engine resolves an **unknown key as UNLIMITED** and
fails open across five layers without raising. So each new key and each changed
cap has to be asserted end to end against the real route — never with `checkLimit`
and a hand-built context.
