---
title: Tourist Exclusive Deals & VIP Promotions
linear: HOS-21
statusSource: linear
created: 2026-07-01
type: feature
areas:
  - web
  - billing
---

# Tourist Exclusive Deals & VIP Promotions

> Migrated from `.qtm/specs/SPEC-313-tourist-exclusive-deals/spec.md` on 2026-07-01 as part of the Linear tracking migration. Canonical tracking is now HOS-21.
>
> **✅ Cross-spec conflict RESOLVED (2026-07-02):** two independent efforts
> touched this stub on 2026-07-01, in opposite directions — `staging`
> consolidated it with SPEC-316 pending SPEC-286's OQ-5, while SPEC-286
> separately resolved that OQ-5 (renamed `VIP_PROMOTIONS_ACCESS` →
> `VIP_VISIBILITY_ACCESS`) and absorbed part of this stub's scope.
>
> A codebase audit on 2026-07-02 (see Divergence Report below) confirmed
> SPEC-286's absorption was **scoped only to the notification/subscription
> half** (G-2/T-012: `PromoOfferEvaluatorService` → daily email digest via
> `alerts-digest.job.ts`). No browsable, plan-gated listing surface exists
> anywhere in `apps/web` or `apps/api`. **Decision: HOS-21 proceeds
> standalone** as the "curated, gated deals listing" feature — a genuinely
> different concept from SPEC-286's point-in-time alert emails, though both
> read from the same `owner_promotions` table.

## Overview

Tourist-plus and tourist-vip tiers should have access to a curated, gated listing of exclusive deals — active owner promotions visible only to paying tourists (`EXCLUSIVE_DEALS` entitlement), reusing the existing `owner_promotions` data model rather than a new content type. Tourist-vip additionally sees a VIP-only subset of promotions above what plus tourists see, giving vip a real differentiator (today vip has no unique feature that plus does not also have). Owner-promotions already exist and have an ungated public listing endpoint (`GET /api/v1/public/owner-promotions`), but that endpoint serves an unrelated use case (the per-accommodation `PromotionBanner` on accommodation detail pages) and must not be conflated with this feature's gated, cross-accommodation curated listing.

## Why now

Part of the SPEC-310 roadmap to stop selling unimplemented features. `EXCLUSIVE_DEALS` is listed as a plan perk for plus/vip tourists but the gate function is a phantom — `gateExclusiveDeals()` exists (`apps/api/src/middlewares/tourist-entitlements.ts:500-517`) but is wired to zero routes, explicitly flagged in code as `// PHANTOM-GATE (SPEC-145): route not built yet ... Do NOT build the route without a spec`. This spec is that spec.

## ⚠️ Naming collision with SPEC-286 — RESOLVED

SPEC-286 found that `VIP_PROMOTIONS_ACCESS` was actually a real, working accommodation-**visibility** perk, unrelated to "VIP promotions" as a deals/offers concept, and renamed it to `VIP_VISIBILITY_ACCESS` (SPEC-286 T-001, commit `8333b7fc4`). As of this review, `VIP_PROMOTIONS_ACCESS` still exists as an enum member in `packages/billing/src/types/entitlement.types.ts` but has **zero metadata** in `entitlements.config.ts` and **zero plan assignment** in `plans.config.ts` — it is fully orphaned and free to reuse. See Decision D4 below for whether this spec reuses it or introduces a new key.

## Scope

- Reuse `owner_promotions` (`packages/db/src/schemas/owner-promotion/owner_promotion.dbschema.ts`) as the data source — no new deals table. See Data Model below for the one new column proposed (D1).
- Gate a new, dedicated listing surface behind `EXCLUSIVE_DEALS`: only tourist-plus and tourist-vip can view it (see API Design / D3).
- Vip tier sees the union of plus-tier deals plus vip-only deals (additive, not a separate concept) — **confirmed by owner 2026-07-02**.
- Implement the gated deals listing (plus tier first, then vip extension) on the web tourist UI (`apps/web`) plus the necessary API route(s) (`apps/api`).

## Out of scope (initial)

- Anything beyond this single feature; pricing/limit calibration lives in SPEC-310.
- Real-time invalidation of the listing when a promotion expires mid-session (acceptable to show stale data until next fetch/pagination for v1).
- Any changes to the existing ungated `GET /api/v1/public/owner-promotions` endpoint or `PromotionBanner.astro` — those stay as-is, unrelated to this feature (see D3).
- Admin curation UI beyond what already exists for `owner_promotions`, unless D2 resolves to admin-only VIP creation (in which case a new admin action is in scope).

## User Stories

- As a tourist-plus subscriber, I want to browse a curated list of exclusive deals from accommodations so I can find current discounts not visible to free users.
- As a tourist-vip subscriber, I want to see additional VIP-only deals beyond what plus tourists see, so my higher subscription tier has a clear, tangible differentiator.
- As a free tourist (or unauthenticated visitor), when I try to access the exclusive deals page, I want a clear upgrade prompt instead of an error or an empty page, so I understand why I can't see it and what to do next.
- As an owner, I want to mark one of my promotions as VIP-only (self-service, same form I already use to create promotions) so it reaches only the platform's highest-tier tourists.

## Acceptance Criteria

- Given an authenticated tourist-plus or tourist-vip user, when they navigate to the exclusive deals listing, then they see a paginated list of active, non-expired, non-plan-restricted owner promotions eligible for their tier.
- Given a free tourist or unauthenticated visitor, when they call the gated endpoint, then the API returns `403` with `error.code === 'ENTITLEMENT_REQUIRED'` and an `upgradeUrl`, and the web UI renders an upgrade CTA to `/suscriptores/planes` (mirroring the `AlertsList.client.tsx` precedent) instead of a broken or empty state.
- Given a tourist-vip user, when they view the listing, then it includes both plus-tier deals and any deals flagged VIP-only, visually distinguished from plus-tier deals.
- Given a tourist-plus user, when they view the listing, then VIP-only deals are excluded entirely (not shown greyed-out or teased).
- Given no active deals exist for the tourist's tier, when they load the listing, then the UI shows an explicit empty state ("no hay ofertas activas por ahora"), not an error and not a silent blank screen.
- Given a promotion's owner is downgraded mid-cycle and the promotion becomes `planRestricted = true`, when any tourist loads the listing, then that promotion no longer appears (already enforced by `OwnerPromotionService._executeSearch`, no new work needed — confirm via test).
- Given a deal references an accommodation the calling tourist cannot see under the platform's accommodation-visibility rules, when they load the exclusive-deals listing, then that deal is excluded from the response entirely.

## Data Model

Reuses `owner_promotions` (`packages/db/src/schemas/owner-promotion/owner_promotion.dbschema.ts:7-79`). Existing columns: `id`, `slug`, `ownerId` (FK→users), `accommodationId` (FK→accommodations, nullable), `title`, `description`, `discountType`, `discountValue`, `minNights`, `validFrom`, `validUntil`, `maxRedemptions`, `currentRedemptions`, `lifecycleState`, `planRestricted` (owner-side plan limit flag — unrelated to tourist-side gating, do not conflate), audit fields.

**D1 [CONFIRMED by owner 2026-07-02]:** add a new column `touristAudience` (enum: `'plus' | 'vip'`, default `'plus'`, NOT NULL) to mark whether a promotion is visible to plus-and-up tourists (default) or reserved for vip-only. This is additive: `'vip'` rows are excluded from the plus-tier query and included in the vip-tier query alongside all `'plus'` rows. Owner-editable via self-service (D2) — the create/update payload for `owner_promotions` gains this field, with the same `_OWN` permission model as today (no new role gating).

Migration carril: this is a structural column addition → goes through `pnpm db:generate` + `pnpm db:migrate` (not the extras carril), per `packages/db/CLAUDE.md`.

## API Design

**D3 [CONFIRMED by owner 2026-07-02]:** new dedicated protected route (proposed path: `apps/api/src/routes/owner-promotion/protected/exclusive-deals.ts`, or a new tourist-facing namespace if that fits existing route grouping better) using a list route factory (`createListRoute` or equivalent), gated by `gateExclusiveDeals()` wired exactly per the `gateAlerts` precedent (`apps/api/src/routes/price-alert/protected/create.ts:97` → `apps/api/src/middlewares/tourist-entitlements.ts:117-168`): entitlement check first (403 `ENTITLEMENT_REQUIRED` + `upgradeUrl: '/suscriptores/planes'` if missing), no limit-check needed here (this is a read, not a create).

Request: `page`, `pageSize`, optional `accommodationId` filter (reuse `OwnerPromotionSearchSchema.omit({page,pageSize})` shape from the existing public route).

Response: `{ items: OwnerPromotionPublicSchema[], pagination }`, filtered server-side by `lifecycleState=ACTIVE`, `deletedAt=null`, `planRestricted=false`, `validFrom<=now<=validUntil` (already enforced by `_executeSearch`) **plus** `touristAudience` scoped to the caller's tier (plus → `['plus']`, vip → `['plus','vip']`) **plus** the accommodation-visibility cross-check confirmed in Edge Cases below: a deal referencing an `accommodationId` the caller cannot see under `VIP_VISIBILITY_ACCESS`/restricted-accommodation rules is excluded from the response, not just greyed out.

The existing `GET /api/v1/public/owner-promotions` (`apps/api/src/routes/owner-promotion/public/list.ts:22-53`) is explicitly **out of scope** and stays ungated — it serves `PromotionBanner.astro` on accommodation detail pages, a different, unrelated use case per the original spec framing.

## Technical Design / Architecture

- No new architectural pattern. Reuses `BaseCrudService` via `OwnerPromotionService` (add a tourist-audience-aware search method, or extend `_executeSearch` with an optional audience filter param), the existing route-factory pattern, and the `gateAlerts`-proven entitlement-gate middleware skeleton.
- Web: new Astro SSR-shell page (proposed: `apps/web/src/pages/[lang]/mi-cuenta/ofertas-exclusivas/index.astro`) delegating to a client island (proposed: `ExclusiveDealsList.client.tsx`), following the `AlertsList.client.tsx` precedent (`apps/web/src/components/account/AlertsList.client.tsx`) for the 403/`ENTITLEMENT_REQUIRED` → upgrade-prompt UX pattern.
- No caching strategy changes needed beyond what the route factory already provides; single paginated query against an already-indexed table, same shape as the existing public route. **One addition from the confirmed accommodation-visibility edge case (below):** the query must cross-check each deal's `accommodationId` against the caller's accommodation-visibility rules (the same rule `VIP_VISIBILITY_ACCESS` exists for) before returning it — implement as a join/exists-filter against whatever query/service already answers "can this tourist see this accommodation", not a new visibility engine. Locate that existing check during implementation (likely in `accommodation.service.ts`, referenced in SPEC-286's docs as having "8 checks") and reuse it rather than re-deriving the rule here.

## Security / Entitlements Design

- `gateExclusiveDeals()` already implements the correct entitlement-check skeleton (mirrors `gateAlerts`); it must be wired into the new route's `middlewares` array — this is the "un-phantoming" this spec exists to do.
- **D4 [CONFIRMED by owner 2026-07-02]:** vip-tier extension gated by `VIP_PROMOTIONS_ACCESS`, wired with metadata in `entitlements.config.ts` and assigned to the tourist-vip plan in `plans.config.ts` (currently orphaned — enum member only, zero metadata, zero plan assignment).
- Promotion *creation* stays gated exactly as today (`CREATE_PROMOTIONS` entitlement + `MAX_ACTIVE_PROMOTIONS` limit, `apps/api/src/routes/owner-promotion/protected/create.ts:58`) — untouched by this spec except for the `touristAudience` field addition to the create/update payload (D1/D2 dependent).
- No new endpoint gate matrix rows exist for this yet — update `docs/billing/endpoint-gate-matrix.md` when the route lands (currently `gateExclusiveDeals` is listed under "Reserved — Phantom Gates", line ~948; move it to an active row).

## Testing Strategy

- **Unit** (`packages/service-core`): `OwnerPromotionService` tourist-audience-aware search — verify plus tier excludes `'vip'` rows, vip tier includes both, `planRestricted`/expired/soft-deleted rows excluded regardless of tier.
- **Integration/API** (`apps/api`): `gateExclusiveDeals` wiring on the new route — 403 `ENTITLEMENT_REQUIRED` for free tourist and unauthenticated caller, 200 with tier-correct item set for plus and vip, following the existing `gateAlerts` integration test as a template.
- **Component** (`apps/web`): `ExclusiveDealsList.client.tsx` — loading, empty, upgrade-prompt (403), and populated-list states, mirroring `AlertsList.client.tsx`'s existing test coverage shape.
- **E2E**: tourist-plus browses and sees plus-tier deals only; free tourist sees the upgrade CTA and cannot reach the listing; tourist-vip sees plus-tier deals plus vip-only ones, visually distinguished; a deal on an accommodation-visibility-restricted accommodation never appears in any tier's listing.

## Error Handling

- Free tourist / unauthenticated → `403 ENTITLEMENT_REQUIRED` with `upgradeUrl`; web renders the upgrade CTA, never a raw error or blank screen.
- No active/eligible deals for the tourist's tier → explicit empty state, not an error.
- Expired or soft-deleted promotions never appear for any tier — already enforced by `_executeSearch`'s existing filters; this spec must add a regression test confirming it, not new filtering logic.

## Edge Cases

- A promotion expires while a tourist is viewing a already-fetched page of the list: acceptable to show stale data until the next fetch/pagination — no real-time invalidation required for v1 (see Out of scope).
- An owner's plan is downgraded mid-cycle, flipping `planRestricted=true` on their promotion: it must disappear from the tourist-facing listing immediately on next fetch — already covered by existing `_executeSearch` filters (verify with a regression test, do not assume).
- A deal (plus or vip-tier) references an accommodation the tourist cannot otherwise view under accommodation-visibility rules (restricted/suspended/plan-restricted; the same rule class `VIP_VISIBILITY_ACCESS` grants a bypass for on the accommodation-browsing side) — **CONFIRMED by owner 2026-07-02**: the deal is **filtered out** of the exclusive-deals listing, not shown. The two gates (deal visibility vs accommodation visibility) are cross-checked, not independent. See API Design / Technical Design for the implementation note.

## Open questions

All resolved as of 2026-07-02 (owner confirmation via `/task-master:spec-review`):

- ~~Are exclusive deals just a gated visibility filter over existing owner-promotions, or a new content type?~~ **RESOLVED**: gated filter over `owner_promotions`, no new table (see Data Model).
- ~~Is the vip tier "plus deals + additional vip-only ones" or a wholly separate concept?~~ **RESOLVED (confirmed by owner)**: additive (see Scope).
- ~~(Blocking) How does SPEC-286 OQ-5 resolve?~~ **RESOLVED**: `VIP_PROMOTIONS_ACCESS` is orphaned and free to reuse (see D4).
- ~~**D1** — data model mechanism for marking VIP-only deals~~ **RESOLVED (confirmed by owner)**: new `touristAudience` column (see Data Model).
- ~~**D2** — who creates VIP-only deals~~ **RESOLVED (confirmed by owner)**: owner self-service, same form (see User Stories / Security).
- ~~**D3** — route architecture~~ **RESOLVED (confirmed by owner)**: new dedicated gated route, existing public endpoint untouched (see API Design).
- ~~**D4** — vip entitlement key~~ **RESOLVED (confirmed by owner)**: reuse orphaned `VIP_PROMOTIONS_ACCESS`, wire full metadata + plan assignment (see Security / Entitlements Design).
- ~~Edge case: deal referencing an accommodation-visibility-restricted accommodation~~ **RESOLVED (confirmed by owner)**: filtered out of the listing, not shown (see Edge Cases).

No open questions remain. Ready for `/task-master:task-from-spec`.

## Divergence Report (Pass 3 — 2026-07-02)

- Spec claimed owner-promotions' "public list is ungated and unrelated to this feature" → **confirmed accurate**: `apps/api/src/routes/owner-promotion/public/list.ts:22-53` has no `middlewares`, no entitlement check, serves `PromotionBanner.astro` per-accommodation.
- Spec claimed `EXCLUSIVE_DEALS` has "no route" → **confirmed accurate**: `gateExclusiveDeals()` exists (`apps/api/src/middlewares/tourist-entitlements.ts:500-517`) but is wired to zero route files; documented as a Reserved Phantom Gate in `docs/billing/endpoint-gate-matrix.md:948`.
- SPEC-286 absorption claim → **confirmed narrower than the stub's caution implied**: absorption covers only the notification/subscription half (`PromoOfferEvaluatorService` → `alerts-digest.job.ts`, email digest only, not the "multichannel" the spec title suggests — WhatsApp/push are separate, unbuilt G-3 scope). No browsable listing exists anywhere in `apps/web`. HOS-21 is confirmed non-redundant.
- `VIP_PROMOTIONS_ACCESS` status → confirmed fully orphaned: enum member only in `entitlement.types.ts`, zero rows in `entitlements.config.ts`, zero plan assignment in `plans.config.ts`, zero real usage since the SPEC-286 rename.

## Related

- Parent audit: SPEC-310 (plan packaging recalibration).
- SPEC-312 (tourist price alerts) — sibling tourist-plus/vip phantom gate; `gateAlerts` used here as the wiring precedent.
- **SPEC-316** (VIP Promotions Access) — was a separate stub for exactly the vip-tier half of this feature; consolidated into this spec on 2026-07-01; marked `obsolete` in the tracking indices.
- **SPEC-286** — defines the current real usage of `VIP_PROMOTIONS_ACCESS`/`VIP_VISIBILITY_ACCESS` and the notification-digest half of "owner-promo offers to tourists"; confirmed non-overlapping with this spec's gated-listing scope (see Divergence Report).

## 13. Linear

Canonical tracking:
HOS-21

## Revision History

### Review Pass 1 — 2026-07-02

**Passes run:** Initial Assessment, Pass 1 (Completeness Audit), Pass 2 (No-Ambiguity Gate), Pass 3 (Codebase Alignment Audit), Pass 5 (Architecture and Risk Deep-Dive). Pass 4 (External Services) skipped — no external integrations. Pass 6 skipped — no tasks generated yet.

**Summary of changes:**

- Added: User Stories, Acceptance Criteria (BDD), Data Model, API Design, Technical Design/Architecture, Security/Entitlements Design, Testing Strategy, Error Handling, Edge Cases, Divergence Report.
- Modified: cross-spec conflict banner updated to reflect resolution (proceeds standalone, confirmed by owner after codebase research); naming-collision section marked resolved; Scope/Out-of-scope tightened with concrete file paths.
- Flagged: 4 decisions (D1 data model mechanism, D2 who creates VIP-only deals, D3 route architecture, D4 entitlement key) — proposals drafted with a recommended option each, but **not yet confirmed by the owner** (no response received during this review session; proceeding on the documented proposals per "best judgment" fallback, explicitly marked pending in each section above).
- Divergences found: 0 factual errors in the original stub — all its claims (ungated public endpoint, phantom gate, SPEC-286 absorption scope) were accurate, just under-specified. Codebase alignment audit only added precision (file:line), didn't correct anything.
- External refs verified: none (no external services involved).

**Open questions remaining:** D1, D2, D3, D4 (see Open Questions section) — all four have a recommended default documented, but require explicit owner sign-off before implementation starts. One non-blocking edge case (VIP deal on an accommodation-visibility-restricted accommodation) also needs eventual confirmation but does not block spec approval.

### Review Pass 2 — 2026-07-02

**Passes run:** Step 3 (User Decision Questions) — owner walked through every item flagged as unconfirmed in Pass 1, one at a time.

**Summary of changes:**

- Confirmed: VIP-tier additive framing, D1 (`touristAudience` column), D2 (owner self-service), D3 (new dedicated protected route), D4 (reuse `VIP_PROMOTIONS_ACCESS`) — all matched the Pass 1 recommended proposal, now marked `CONFIRMED by owner 2026-07-02` in their respective sections.
- Modified (differs from proposed default): the accommodation-visibility edge case — Pass 1 proposed "show the deal regardless" as the v1 default; owner instead confirmed deals must be **filtered out** when the referenced accommodation isn't visible to the caller. Updated Edge Cases, added a new Acceptance Criterion, an implementation note in API Design/Technical Design (cross-check against the existing accommodation-visibility rule, do not re-derive it), and an E2E test case.
- Flagged: 0 — all items resolved.
- Divergences found: none new this pass.
- External refs verified: none.

**Open questions remaining:** none. Spec is implementation-ready.
