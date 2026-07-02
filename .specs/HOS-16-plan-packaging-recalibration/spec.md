---
title: Plan Packaging Recalibration (Entitlements & Limits Sanitation)
linear: HOS-16
statusSource: linear
created: 2026-07-01
type: feature
areas:
  - billing
  - admin
---

# Plan Packaging Recalibration (Entitlements & Limits Sanitation)

> Migrated from `.qtm/specs/SPEC-310-plan-packaging-recalibration/spec.md` on 2026-07-01 as part of the Linear tracking migration. Canonical tracking is now HOS-16.

> Discovery-first. Owner-driven product decision. This spec is the **single source of truth for the target packaging** of every billing plan. The implementation of the still-missing features is tracked as SEPARATE specs (see Roadmap), not here.

## Overview

**Goal.** Realign Hospeda's billing plan packaging (which entitlements + numeric limits each plan carries) with two principles the owner set:

1. **Commercial ladder that makes sense** — free is a usable hook with a ceiling that's felt quickly; the first paid tier is a real, worthwhile unlock; the next tier is worth the jump.
2. **Honest catalog** — stop the structural problems where plans advertise features that don't exist, where a more expensive tier is weaker than a cheaper one, and where obsolete entitlements linger.

**Motivation.** A full audit of the plan catalog (5 background explorations during discovery) revealed the packaging had drifted badly from the implemented reality:

- **Complex plans (3) can't be sold** — the complex/multi-property vertical isn't implemented. They're active and (partly) exposed anyway.
- **Tourist paid tiers were ~all phantom** — of 14 tourist entitlements, only 3 are implemented (favorites + read/write reviews) and all 3 are on the FREE plan. `tourist-plus` and `tourist-vip` charged for 0 working exclusive features at audit time; the only real differentiator is the favorites limit. (Comparator + search-history ARE built — SPEC-288/289 — but unmerged.)
- **Owner tiers carry phantoms too** — owner-basico advertises 3 phantom features (respond-reviews, calendar, whatsapp); owner-premium has 0 real exclusive features (custom-branding + verification-badge both phantom) and only differs from pro by limits.
- **`AD_FREE` is obsolete** — there is no ad system to be free from.

This spec fixes the **packaging** (what each plan claims + the numeric ladders). The missing features get built via the Roadmap specs so the catalog becomes true.

## Scope

### In scope

1. **Hide the complex plans** (option A — reversible): set `isActive: false` in config + one-time DB `UPDATE` on staging/prod. Keep all code/types/enum/test-users intact for re-activation when the complex vertical is built.
2. **Remove the obsolete `AD_FREE` entitlement** from the catalog (enum, plan grants, comparison table).
3. **Recalibrate tourist limits + move `CAN_VIEW_RECOMMENDATIONS` free→plus** (target tables below).
4. **Recalibrate owner limits + grant `CREATE_PROMOTIONS` to owner-basico** (target tables below).
5. **Coordinate the comparator limits** (plus 2→3, vip 4→5) with the unmerged SPEC-288.
6. Keep all other (currently phantom) entitlements in the catalog/comparison table — they are NOT hidden; they are delivered by the Roadmap specs.

### Out of scope

- Building any of the missing features (each is its own spec — see Roadmap).
- Consumer-side AI quotas (`MAX_AI_SEARCH`, `MAX_AI_CHAT_CONSUMER`) — governed by **SPEC-283**.
- The complex vertical itself.
- `priority-support` / `vip-support` delivery — these stay as **operational promises** (no code).
- `calendar` / `sync-calendar` — **deferred**, pending a product decision on availability modeling (Hospeda is a directory, not a booking platform).

## Target packaging — TOURIST (decided)

Three tiers kept (free / plus / vip). VIP gains real exclusives once its 3 features are built.

### Entitlements

| Tier | Entitlements |
|---|---|
| FREE | SAVE_FAVORITES, READ_REVIEWS, WRITE_REVIEWS |
| PLUS (+) | CAN_COMPARE_ACCOMMODATIONS 🟡, CAN_VIEW_SEARCH_HISTORY 🟡, CAN_VIEW_RECOMMENDATIONS❌, PRICE_ALERTS❌, EXCLUSIVE_DEALS❌, CAN_ATTACH_REVIEW_PHOTOS❌, CAN_CONTACT_WHATSAPP_DISPLAY❌ |
| VIP (+) | CAN_CONTACT_WHATSAPP_DIRECT❌, VIP_SUPPORT (operational), VIP_PROMOTIONS_ACCESS❌ |

- **Remove `AD_FREE`** (obsolete).
- **Move `CAN_VIEW_RECOMMENDATIONS` free→plus.**
- 🟡 = built but unmerged (SPEC-288/289) · ❌ = to build (Roadmap).

### Limits

| Limit | free | plus | vip |
|---|---|---|---|
| MAX_FAVORITES | 5 | 25 | -1 |
| MAX_COMPARE_ITEMS | — | 3 *(2→3, coord SPEC-288)* | 5 *(4→5)* |
| MAX_SEARCH_HISTORY_ENTRIES | — | 50 | 200 |
| MAX_ACTIVE_ALERTS | — | 5 | -1 |
| MAX_AI_SEARCH `[SPEC-283]` | 10 | 50 | 200 |
| MAX_AI_CHAT_CONSUMER `[SPEC-283]` | 10 | 50 | 200 |

## Target packaging — OWNER (decided; 3 open questions)

### Feature decisions

- **calendar + sync-calendar**: deferred (availability modeling, no booking).
- **priority-support**: operational promise, no code.
- **owner-premium exclusives**: custom-branding + verification-badge → built (Roadmap).

### Limits

| Cupo / Feature | básico ($15) | pro ($35) | premium ($75) |
|---|---|---|---|
| MAX_ACCOMMODATIONS | 1 *(OQ-3)* | 3 | 10 |
| MAX_PHOTOS_PER_ACCOMMODATION | 5→15 | 15→30 | 30→50 |
| CREATE_PROMOTIONS (entitlement) | ✗→✓ | ✓ | ✓ |
| MAX_ACTIVE_PROMOTIONS | 0→2 | 3→5 | -1 |
| FEATURED_LISTING | ✗ (upsell pro, OQ-1) | ✓ 🟡 | ✓ 🟡 |
| MAX_AI_TEXT_IMPROVE_PER_MONTH | 20→50 | 100→250 | 1000→1250 |
| MAX_AI_CHAT_PER_MONTH (owner-side) | 20→50 | 100→250 | 2000→1250 |
| MAX_AI_TRANSLATE_PER_MONTH | 200 | 500→1000 | 2000→5000 |
| MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH | 200→10 *(OQ-2)* | 500→50 | 2000→250 |

Owner-side AI ladder = **×5 parejo**: text/chat 50/250/1250 · translate 200/1000/5000 · import 10/50/250.

## COMPLEX — hide (option A)

`complex-basico/pro/premium` → `isActive: false` in `plans.config.ts` + one-time `UPDATE billing_plans SET active=false WHERE name IN ('complex-basico','complex-pro','complex-premium')` on staging/prod. The public `GET /api/v1/public/plans` already filters `active=true`. `active` is a Model-C commercial field (DB wins) so re-seeds won't reactivate. Code/types/enum/dev test-users untouched. Validator stays green (complex remains in ALL_PLANS).

## Technical approach

- Plan grants + limits: `packages/billing/src/config/plans.config.ts` (the `TOURIST_*` shared constants + each plan's entitlement/limit maps).
- Remove `AD_FREE`: `packages/billing/src/types/entitlement.types.ts` + `entitlements.config.ts` + any comparison-table row + grant lists. Check exhaustive maps.
- Hide complex: `isActive: false` in the 3 complex plan objects + a DB migration/`UPDATE` (extras carril or one-off ops SQL).
- Seeders reflect config: `packages/seed/src/required/billingEntitlements.seed.ts` / `billingLimits.seed.ts` / `billingPlans.seed.ts` (Model-C: capability fields propagate, commercial fields DB-wins).
- Comparison table: `apps/web/src/components/billing/PlanComparisonTable.astro` (remove ad-free row; the still-phantom rows stay as "próximamente"/upcoming until their Roadmap spec ships).
- Coordinate comparator limits with the unmerged SPEC-288 branch (`spec/SPEC-289-search-history`).

## Roadmap (features to build — separate specs)

**Actions (not specs):** merge SPEC-288 (comparator), SPEC-289 (search-history), PR #1900 (owner-promotions tourist display).
**Operational (no code):** priority-support (owner), vip-support (tourist).
**Deferred (product decision):** calendar + sync-calendar (owner).

**Backlog specs created with this spec:** SPEC-311 whatsapp-contact · SPEC-312 price-alerts · SPEC-313 exclusive-deals · SPEC-314 review-photos · SPEC-315 recommendations · SPEC-316 vip-promotions-access · SPEC-317 respond-reviews · SPEC-318 custom-branding · SPEC-319 verification-badge · SPEC-320 featured-listing-automation · SPEC-321 ai-text-improve-web-editor.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Hiding complex breaks startup validator | API won't boot | Keep complex in ALL_PLANS (option A) — validator still finds a default per category |
| Reducing an existing limit downgrades current users | Bad UX for paying users | Pre-go-live, few/no real owner subs; verify before applying; net change is mostly upward |
| Removing `AD_FREE` hits an exhaustive map | Compile error | Resolve all `EntitlementKey` references; CI typecheck catches it |
| Comparator limit conflict with SPEC-288 | Merge friction | Decide final values here; apply on/after SPEC-288 merge |
| Model-C: config `isActive:false` not applied to existing DB | Complex stays visible | The one-time `UPDATE` is mandatory on each env |

## Suggested tasks (phased)

- **Setup**: confirm 3 open questions; confirm comparator final values vs SPEC-288.
- **Core (billing config)**: remove `AD_FREE`; move recommendations free→plus; apply tourist + owner limit recalibration; grant CREATE_PROMOTIONS to owner-basico; set complex `isActive:false`.
- **Core (DB)**: one-time `UPDATE` to deactivate complex on staging/prod.
- **Integration**: update seeders if needed; remove ad-free row from comparison table.
- **Testing**: update billing grant-matrix/limit tests for the new values; regression test that `AD_FREE` is gone and complex is inactive in public plans.
- **Docs**: update `docs/billing/endpoint-gate-matrix.md` + plan docs.

## Open questions

- **OQ-1**: `FEATURED_LISTING` in owner-basico — keep as pro upsell (recommended) or include in basico?
- **OQ-2**: AI import basico = 10 (recommended, it's a one-off op) — acceptable or higher?
- **OQ-3**: owner-basico `MAX_ACCOMMODATIONS` = 1 (recommended, individual host) or raise to 2?

## Related

- SPEC-283 (graduated consumer AI limits) — owns the consumer AI quotas; do not touch them here.
- SPEC-216 (owner inherits tourist-VIP) — the inheritance mechanism this builds on.
- SPEC-288 / SPEC-289 — comparator + search-history, built-unmerged; their limits are set here.
- SPEC-311…321 — the feature roadmap that makes the catalog true.

## 13. Linear

Canonical tracking:
HOS-16
