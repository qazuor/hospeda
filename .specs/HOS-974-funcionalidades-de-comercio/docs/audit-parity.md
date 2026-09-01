# Half A · Parity matrix — measurement complete, decisions pending

**Measured** 2026-09-01 against `origin/staging`. Every cell in the measurement
columns is **MEASURED** with file:line evidence unless marked otherwise; the two
decision columns are **empty on purpose** — they are the owner's to fill.

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

| Key | Gastronomy | Experiences | Free today? | Decision for gastronomy | Decision for experiences |
|---|---|---|---|---|---|
| `CAN_USE_RICH_DESCRIPTION` | GATE MISSING | GATE MISSING | **YES — confirmed live** | | |
| `CAN_EMBED_VIDEO` | GATE MISSING | GATE MISSING | **YES via the API** — public schemas expose `videos: true`; no front-end renders it yet | | |
| `EDIT_ACCOMMODATION_INFO` | GATE MISSING | GATE MISSING | **YES — and gating it would lock every commerce owner out (see F-11)** | | |
| `AI_TEXT_IMPROVE` | ALREADY WORKS | ALREADY WORKS | **PARTIALLY** — only for dual-role actors (see F-12) | | |
| `CAN_CONTACT_WHATSAPP_DISPLAY` | FEATURE MISSING | FEATURE MISSING | No — but a dead typed field is a latent trap (F-13) | | |
| `CAN_CONTACT_WHATSAPP_DIRECT` | FEATURE MISSING | FEATURE MISSING | No — refines a channel neither vertical exposes | | |
| `VIEW_BASIC_STATS` | FEATURE MISSING | FEATURE MISSING | No | | |
| `VIEW_ADVANCED_STATS` | FEATURE MISSING | FEATURE MISSING | No — no conceptual analogue | | |
| `FEATURED_LISTING` | FEATURE MISSING | FEATURE MISSING | No — but see F-14 on the `isFeatured` name clash | | |
| `HAS_VERIFICATION_BADGE` | FEATURE MISSING | FEATURE MISSING | No — column does not exist | | |
| `CREATE_PROMOTIONS` | FEATURE MISSING | FEATURE MISSING | No — data model bound to `accommodationId` | | |
| `AI_CHAT` | FEATURE MISSING | FEATURE MISSING | No — hardcoded to `accommodations` | | |
| `AI_TRANSLATE` | FEATURE MISSING | FEATURE MISSING | No — the service itself knows neither vertical | | |
| `AI_ACCOMMODATION_IMPORT` | FEATURE MISSING | FEATURE MISSING | No — a commerce equivalent is a new feature, not a port | | |
| `PUBLISH_ACCOMMODATIONS` | FEATURE MISSING | FEATURE MISSING | No — no owner self-publish flow in either vertical | | |
| `CAN_USE_CALENDAR` | FEATURE MISSING | FEATURE MISSING | No — no table; FK is accommodation-only | | |
| `CAN_SYNC_EXTERNAL_CALENDAR` | FEATURE MISSING | FEATURE MISSING | No | | |
| `RESPOND_REVIEWS` | phantom everywhere | phantom everywhere | No | | |
| `PRIORITY_SUPPORT` | phantom everywhere | phantom everywhere | No | | |
| `CUSTOM_BRANDING` | phantom everywhere | phantom everywhere | No | | |

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

## How to fill the decision columns

For each row, per vertical, one of:

- **`TIER: basic` / `TIER: pro` / `TIER: premium`** — which tier grants it.
- **`ADDON`** — sold separately rather than bundled (feeds H4/HOS-977).
- **`DOES NOT APPLY`** — with the reason written down. A justified no is what stops
  the same proposal returning in six months.
- **`BLOCKED`** — needs something built first; name what.

The four rows marked free today deserve their answer first, and the answer carries
a cost either way: leave them ungated and the cheapest tier grants them to
everyone, or gate them and take something away from owners who already had it.
