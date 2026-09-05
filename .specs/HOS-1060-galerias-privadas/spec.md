---
title: Private per-tourist galleries for experiences — the provider hands over the photos, Hospeda never touches the money
linear: HOS-1060
statusSource: linear
created: 2026-09-05
type: feature
areas:
  - billing
  - api
  - db
  - web
---

# Private per-tourist galleries for experiences

## 1. Summary

Hospeda sells the experience provider **the capability to create a private photo
gallery per customer**. The provider uploads the outing's photos, sends the
tourist a secret link, and the tourist opens it, looks at their photos and
downloads them.

**Hospeda does not touch the money for the photos.** Whether the provider
charges for them, and how, is between the provider and their customer. That
distinction is the whole business decision (owner, 2026-09-01) and it is worth
restating because every design choice below follows from it: the alternative —
Hospeda selling the photos to the tourist and remitting — would make the platform
an intermediary for third-party payments, with reconciliation, refunds and
liability over a transaction that is not ours, and would break the rule that
**the business pays, not the tourist**.

There is **no public gallery** in this issue. The experience ficha already has
one; this is only the private half.

## 2. What is already decided, and is not up for discussion

Every row below is an owner decision recorded on the Linear issue (2026-09-01 and
2026-09-04). This spec implements them; it does not reopen them.

| # | Decision | Date |
|---|---|---|
| D-1 | **Access is a secret link with a long token.** No accounts, no passwords, nothing touching the auth system. If a real tourist account is ever needed it is layered ON TOP; the reverse cannot be done without breaking everybody's access. | 2026-09-01 |
| D-2 | **No public gallery.** The ficha has one. | 2026-09-01 |
| D-3 | **Hospeda does not touch the money** for the photos. | 2026-09-01 |
| D-4 | **Galleries expire and a cron deletes them.** Photos of identifiable people that live forever are a liability, not an asset, and storage is the only line item here with an unbounded recurring cost. | 2026-09-01 |
| D-5 | **30 days from CREATION** (not from the outing date). | 2026-09-04 |
| D-6 | **Three warnings to the tourist: 10, 5 and 1 day before deletion.** | 2026-09-04 |
| D-7 | **The provider can extend a gallery.** | 2026-09-04 |
| D-8 | **Sold as escalón AND complemento, not one or the other.** `experience-premium` grants the capability with a cap on active galleries; the packs both enable it lower down and raise it at the top. | 2026-09-04 |
| D-9 | **Three expansion packs: +5, +10, +20**, at different prices. They **enable** galleries on `-basico` and `-pro`, and **raise the cap** on `-premium`. | 2026-09-04 |
| D-10 | **When a pack lapses or the provider downgrades, existing galleries stay alive until they expire on their own. What switches off is creating new ones.** The tourist does not pay for a commercial matter between Hospeda and the provider, and the storage cost extinguishes itself anyway. Same rule if the whole subscription is cancelled. | 2026-09-04 |
| D-11 | **The download is served by a server route**, never a client-initiated download. Several product surfaces block those — the same problem HOS-1058 hit. | 2026-09-01 |
| D-12 | **`AddonDefinition` gains `productDomain`, declared on all eight existing add-ons**, in the same PR as the packs. Closes HOS-974 D-C for everyone at once instead of add-on by add-on. | 2026-09-04 |

## 3. What is still open

These are NOT blockers for phase 1; each is bound to the phase that needs it.

| # | Question | Needed by | Working assumption |
|---|---|---|---|
| OQ-1 | **Who may ask for a photo to be deleted early** (right of image), and how the request is served. | Phase 3 | The tourist over their own gallery, and the provider over the galleries they created. To be confirmed by the owner. |
| OQ-2 | **Minors in the photos.** | Phase 3 | Unresolved. Needs an owner decision before the feature is publicly announced, not before it is built. |
| OQ-3 | **Can the provider extend a gallery an unlimited number of times, or once?** | Phase 4 | Unlimited, each extension resetting to 30 days. To be confirmed. |
| OQ-4 | **The premium base cap** — this spec ships `20`. | Before the packs are activated | Derived from the issue's own example ("un proveedor con dos salidas al mes no necesita lo mismo que uno con veinte") and from the pack ladder topping out at +20. A gallery lives 30 days, so the cap is roughly "outings per month". |
| OQ-5 | **The three pack prices** — this spec ships ARS $8.000 / $14.000 / $24.000 per month. | Before the packs are activated | Derived, not decided: sub-linear per gallery (1.600 / 1.400 / 1.200), and all three below the $20.000 step from `experience-basico` to `experience-pro`, so buying capacity never quietly costs more than moving up the ladder. |

## 4. Hazards this spec is written around

### H-1 — The order is load-bearing: the GRANT always ships before the GATE

A gate mounted before the grant exists takes capabilities away from owners who
have them today. **The absence of a gate is not a leak; it is what makes the
product work right now.** This is why phase 1 grants
`MANAGE_EXPERIENCE_PRIVATE_GALLERIES` on `experience-premium` and declares
`productDomain` on every add-on, while mounting no check that reads either.

### H-2 — The limit engine fails OPEN (R-2 of HOS-973)

An unknown limit key is resolved as **UNLIMITED** across five layers, without
raising anything. `max_active_private_galleries` is a brand-new key, so this
applies in full:

- **Every** commerce tier declares it, gastronomy included, at an explicit `0`.
  A missing key and a zero are opposite claims. This mirrors what
  `commerceVerticalTier` already does with `aiChatPerMonth`, and the parameter is
  REQUIRED with no default for the same reason.
- The data migration writes the five zeros as well as the twenty. Shipping the
  grant and the premium cap without the zeros would be worse than shipping
  neither.
- **The cap is asserted end to end against the real creation route** (phase 2),
  never with `checkLimit` and a hand-built context — that always comes back
  green. Until that route exists, this spec's tests assert only what they can
  honestly assert: that every tier declares the key, that its value is never
  `-1`, and that a nonzero cap and the grant always travel together.

### H-3 — `productDomain` must not become a second `?? ACCOMMODATION`

HOS-1078 removed exactly that default from `productDomainForLimitKey`, where it
answered confidently for keys nobody had mapped. `productDomainForAddonSlug`
returns `undefined` for a slug the catalogue does not know, and
`addon-catalog.mapper.ts` propagates that `undefined` rather than guessing.
**Every future caller must fail CLOSED on it.**

### H-4 — An active add-on for a feature that does not exist means the buyer pays for nothing

`ai-support-monthly` sets the precedent and states the reason. The three packs
ship `isActive: false` and are activated by the phase that ships the gallery
itself, alongside the prices the owner confirms (OQ-4, OQ-5).

### H-5 — Photos of identifiable people

The access is restricted and scoped to whoever was actually there, which makes
this far more manageable than a public gallery, but it does not make it
disappear. D-4/D-5/D-6 bound the exposure in time; OQ-1 and OQ-2 bound it in
rights, and they must be answered before phase 3 ships.

### H-6 — A DERIVED add-on domain already exists, and it is not this one

Measured during phase 1, and worth recording because the issue's own framing
implies otherwise. `apps/web/src/lib/billing/addon-domain.ts` (HOS-689) already
exports a `resolveAddonProductDomain` that DERIVES the domain from the add-on's
`affectsLimitKey` through `productDomainForLimitKey`, and gates the
`/mi-cuenta/addons/` catalogue with it. So the cross-vertical purchase the owner
described is **already refused on that page** for any add-on that raises a cap.

What is genuinely open, and what phase 1's declared field is for:

- the derivation has nothing to read for an add-on whose `affectsLimitKey` is
  `null` (`visibility-boost-7d`/`-30d`), so it coerces those to accommodation by
  hand;
- it cannot tell apart two add-ons raising the SAME cap for different verticals;
- **it gates the catalogue page, not the purchase route.** The API's
  `POST /billing/addons/{slug}/purchase` still asks nothing about domain.

The declared field is named `productDomainForAddonSlug` (mirroring
`productDomainForLimitKey`) precisely so the two cannot be confused. Folding the
derivation into the declaration, and mounting the API-side refusal, are follow-up
work — see §9.

## 5. Phases

### Phase 1 — The billing rail (this PR)

Self-contained, ships nothing user-visible, and unblocks everything else.

- **`AddonDefinition.productDomain`** (D-12), declared on all eight existing
  add-ons. Required property with a nullable value, so a new catalogue entry
  cannot omit it while the DB-row mapper can still answer "unknown" honestly.
  `resolveAddonProductDomain(slug)` is the one place that answers the question,
  reading the catalogue (a Model C `'capability'` fact: config wins), which is
  also why the eight existing `billing_addons` rows need no backfill — the
  domain was never stored in them.
- **`EntitlementKey.MANAGE_EXPERIENCE_PRIVATE_GALLERIES`**, granted by
  `experience-premium` through `extraEntitlements` (the HOS-1058 pattern) and by
  the three packs through `grantsEntitlement`. First key in the catalogue with
  two independent, additive sources.
- **`LimitKey.MAX_ACTIVE_PRIVATE_GALLERIES`**, mapped to the EXPERIENCE domain,
  declared by all six commerce tiers, and exposed as `PRIVATE_GALLERY_LIMIT_KEY`
  — a bare constant, not a `Record<CommerceVertical, LimitKey>` like its two
  neighbours, because gastronomy has no galleries and inventing a key for it is
  how a cap stops describing anything.
- **The three packs**, `isActive: false` (H-4).
- **Data migration `0096`** — the dual-write half: both lookup rows, the grant,
  six caps, three add-on rows.

**Explicitly NOT in phase 1**: any gate that reads either key (H-1), the gallery
model, storage, tokens, the cron, the emails, the download route, the web
surfaces.

### Phase 2 — The model, the cap, and the creation route

- `experience_private_galleries` (owner, experience, title, `expiresAt`,
  `createdAt`, token hash) and its photos table. `expiresAt` is written as
  `createdAt + 30 days` (D-5) and is the ONLY thing the expiry cron reads.
- `POST /api/v1/protected/experiences/{id}/private-galleries`, behind
  `commerceVerticalEntitlementMiddleware('experience')` +
  `requireEntitlement(MANAGE_EXPERIENCE_PRIVATE_GALLERIES)` + a live count
  against `MAX_ACTIVE_PRIVATE_GALLERIES`.
- **AC: the cap is asserted end to end against this route** (H-2), with a
  provider at the cap refused and the same provider one expiry later allowed.
- The count is of NON-EXPIRED galleries. A lifetime counter would turn the cap
  into a quota that runs out and never refills, which is not what was sold.

### Phase 3 — Storage, upload, and the deletion request

- Photo upload and storage, following the existing commerce-media path.
- OQ-1 and OQ-2 answered and implemented.

### Phase 4 — The token link, the tourist view, and the download

- Long random token, stored hashed, revocable, delivered by the provider through
  whatever channel they like (D-1). No account, no password, no auth change.
- The public gallery view resolved by token.
- **Download served from a server route** (D-11) — never an `<a download>` or a
  script-driven save.
- Provider-side extension (D-7, OQ-3).

### Phase 5 — Expiry, warnings, and the cron

- `private-gallery-expiry.job.ts` in `apps/api/src/cron/jobs/`, following
  `addon-expiry.job.ts`.
- Warning emails at 10, 5 and 1 day (D-6), each sent once per gallery.
- **D-10 is implemented here, and only here**: the cron deletes on `expiresAt`
  and asks nothing about the provider's subscription. What a lapsed pack or a
  downgrade switches off is the phase-2 creation route, which already reads the
  live entitlement and cap on every call. Nothing has to be built to keep an
  existing gallery alive — not building it IS the decision.

### Phase 6 — Surfaces and activation

- The three surfaces HOS-1071 requires: vertical presentation
  (`presentacion/experiencias`), the comparison row + `es/en/pt` i18n, and the
  pricing pages (built by HOS-1032).
- The packs flip to `isActive: true` with the owner-confirmed prices (OQ-4,
  OQ-5), plus their entry in `ADDON_SLUG_BY_LIMIT_KEY`
  (`apps/web/src/lib/billing/plan-usage-config.ts`) so the at-cap row links the
  pack somebody would buy it from.
- **A comparison row is not added before the feature exists**: advertising a
  capability the platform cannot yet deliver is a promise it cannot keep.

## 6. Acceptance criteria — phase 1

| # | Criterion |
|---|---|
| AC-1 | Every add-on in `ALL_ADDONS` declares a `productDomain`; none is `undefined`. |
| AC-2 | Each add-on's domain matches the per-slug table the owner decided, asserted slug by slug rather than by group. |
| AC-3 | Every add-on carrying an `affectsLimitKey` declares the same domain `productDomainForLimitKey` gives that key. |
| AC-4 | `resolveAddonProductDomain` returns `undefined` — never `'accommodation'` — for a slug outside the catalogue, and the mapper propagates that. |
| AC-5 | `experience-premium` grants `MANAGE_EXPERIENCE_PRIVATE_GALLERIES`; no other commerce tier does. |
| AC-6 | All six commerce tiers DECLARE `max_active_private_galleries`; only `experience-premium`'s is nonzero, and none is `-1`. |
| AC-7 | A nonzero gallery cap and the grant always travel together, asserted as a property so a seventh tier inherits it. |
| AC-8 | The three packs point at the gallery cap, grant the capability, are EXPERIENCE-domain, are recurring, and price a bigger pack strictly cheaper per gallery. |
| AC-9 | The three packs ship `isActive: false`, asserted as an explicit set alongside `ai-support-monthly` so activating one has to be a recorded decision. |
| AC-10 | Data migration `0096` is idempotent and creates both lookup rows, the grant, six caps and three add-on rows. |

## 7. Surfaces touched — phase 1

| File | Change |
|---|---|
| `packages/billing/src/types/addon.types.ts` | `productDomain` on `AddonDefinition` |
| `packages/billing/src/types/entitlement.types.ts` | `MANAGE_EXPERIENCE_PRIVATE_GALLERIES` |
| `packages/billing/src/types/plan.types.ts` | `MAX_ACTIVE_PRIVATE_GALLERIES` |
| `packages/billing/src/config/addons.config.ts` | domains on 8, three packs, `resolveAddonProductDomain` |
| `packages/billing/src/config/commerce-limits.config.ts` | `PRIVATE_GALLERY_LIMIT_KEY`, domain mapping |
| `packages/billing/src/config/entitlements.config.ts` | definition row |
| `packages/billing/src/config/limits.config.ts` | metadata row |
| `packages/billing/src/config/plans.config.ts` | required `privateGalleries`, six tiers, premium grant |
| `packages/billing/CLAUDE.md` | frozen key counts 51→52, 21→22 |
| `packages/service-core/.../addon-catalog.mapper.ts` | resolves the domain from the catalogue |
| `packages/seed/src/data-migrations/0096-…` | dual-write |
| `apps/api/src/utils/limit-check.ts` | `Record<LimitKey, string>` entry |
| `apps/api/src/services/usage-tracking.service.ts` | `USAGE_KIND_BY_LIMIT_KEY` — `UNBUILT` in phase 1 |
| `apps/web/src/lib/billing-limit-error.ts` | `KNOWN_LIMIT_KEYS` |
| `packages/i18n/.../{es,en,pt}/account.json` | the three pack names + descriptions |
| `packages/i18n/.../{es,en,pt}/billing.json` | `limit.<key>.title`, `comparison.limitLabel.<key>`, `limitHelp.<key>` |
| `apps/admin/.../plan-entitlement-groups.ts` | exhaustiveness over `EntitlementKey` |

Six of these were found only by running the guards, not by reading the issue.
Each is exhaustive over `LimitKey` or `EntitlementKey` and each fails in a
different, quiet way when a key is added without it: an unclassified usage kind
hides the row forever, a missing `account.addons.catalog.<slug>.name` reaches a
buyer's MercadoPago checkout as a raw key, a missing `limitHelp` blanks the plan
card. **A new limit or entitlement key is never a one-file change in this repo.**

## 9. Follow-up work this phase identified

| # | Item | Why it is not phase 1 |
|---|---|---|
| F-1 | Carry `productDomain` on `AddonResponse` and have `apps/web`'s catalogue read the DECLARED domain instead of deriving it (H-6). | Changes the API contract; the derivation is correct today for every add-on that raises a cap. |
| F-2 | Refuse a cross-domain purchase at `POST /billing/addons/{slug}/purchase`, not only in the catalogue UI. | It is a GATE, and H-1 says the grant ships first. The declaration landing in phase 1 is what makes it buildable at all. |
| F-3 | Move `MAX_ACTIVE_PRIVATE_GALLERIES` from `UNBUILT` to `STOCK` and add its counter arm in `getCurrentUsage`. | Belongs with the phase-2 creation route; until then a counter would publish a placeholder zero as fact. |
| F-4 | Give the gallery cap a full `message_one`/`message_other`/`cta` in `billing.limit.*`, and an `ADDON_SLUG_BY_LIMIT_KEY` entry so the at-cap row links the pack. | Both are at-limit UI, which needs the route that can BE at the limit. |

## 10. Context

- HOS-974 — the audit this comes from; D-C is the `productDomain` decision.
- HOS-1071 — the three-surfaces rule.
- HOS-1058 — the printable ficha: the `extraEntitlements` pattern, and the same
  server-route download problem.
- HOS-1051 — the guide profile: the precedent for a capability that went to a
  complemento because it scales with the size of the business.
- HOS-973 R-2 — the fail-open limit engine.
- HOS-1078 — the `?? ACCOMMODATION` that answered for keys nobody had mapped.
