---
specId: SPEC-313
title: Tourist Exclusive Deals & VIP Promotions
type: feature
complexity: medium
status: draft
created: 2026-06-30T00:00:00Z
base: staging
---

# SPEC-313 — Tourist Exclusive Deals & VIP Promotions

> **Stub (backlog).** Created from the SPEC-310 plan-packaging audit, which found this feature is advertised in the billing plans but is a phantom gate (`gateExclusiveDeals` PHANTOM-GATE; no deals entity, no route, no UI). This stub captures the objective; it must go through full discovery (/task-master:spec-review or /spec) before implementation. Consolidated 2026-07-01 with SPEC-316 (VIP Promotions Access) — see "Related" below — so this spec now covers both the tourist-plus and tourist-vip tiers of the same deals surface as one feature.

## Overview

Tourist-plus and tourist-vip tiers should have access to a curated list of exclusive deals or offers visible only to paying tourists (`EXCLUSIVE_DEALS` entitlement). Tourist-vip additionally gets a VIP-only tier of promotions/perks above plus (`VIP_PROMOTIONS_ACCESS` entitlement) — this is meant to give vip a real exclusive differentiator, since today vip has no unique features that plus does not also have. Owner-promotions already exist in the project but their public list is ungated and unrelated to this feature. Discovery needs to define both (a) whether exclusive-deals are gated visibility into existing owner-promotions or a new dedicated deals concept, and (b) whether the vip tier is simply "sees all plus deals + additional vip-only ones" or a wholly separate concept.

## Why now

Part of the SPEC-310 roadmap to stop selling unimplemented features. `EXCLUSIVE_DEALS` is listed as a plan perk for plus/vip tourists but the gate function is a phantom — there is no backing entity, no route, and no UI surface anywhere in the codebase. `VIP_PROMOTIONS_ACCESS` is likewise advertised as a vip-exclusive perk with not even a gate function written for this purpose — but see the important caveat below.

## ⚠️ Naming collision with SPEC-286

SPEC-286 (Alerts & Offers — Multichannel Notifications) found that `VIP_PROMOTIONS_ACCESS` is **not actually unused** — it is currently a real, working accommodation-**visibility** perk (8 checks in `accommodation.service.ts`, lets vip tourists see restricted/plan-restricted/suspended accommodations), unrelated to "VIP promotions" as a deals/offers concept. SPEC-286's OQ-5 asks whether to keep that visibility behavior, fold it into the offers concept, or rename it. **This spec must not build a competing "VIP promotions" feature on the same entitlement key without resolving SPEC-286 OQ-5 first** — either the visibility perk gets renamed to free up `VIP_PROMOTIONS_ACCESS` for this feature, or this feature needs a different entitlement key for the vip-tier deals content.

## Scope (to refine in discovery)

- Define the "exclusive deal" concept and its data model (relation to existing owner-promotions, or standalone deals table).
- Gate plus-tier access to the deals surface behind `EXCLUSIVE_DEALS`; only tourist-plus and above can view.
- Define the vip-tier extension: same surface with additional vip-only deals, or a separate content type. Gate behind whatever entitlement key SPEC-286 OQ-5 leaves available for this purpose.
- Implement the gated deals listing (plus tier) and its vip extension on the web tourist UI, and the necessary API route(s).

## Out of scope (initial)

- Anything beyond the single feature; pricing/limit calibration lives in SPEC-310.

## Open questions

- Are exclusive deals just a gated visibility filter over existing owner-promotions, or do they represent a new content type that owners/admins create specifically for paying tourists?
- If they are a new concept, who creates and manages them — owners (in the web editor), admins, or Hospeda staff? (Applies to both the plus and vip tiers.)
- Is the vip tier simply "plus deals + additional vip-only ones," or a wholly separate concept? Implementation order likely requires the plus tier first.
- (Blocking, see caveat above) How does SPEC-286 OQ-5 resolve — does this spec keep the `VIP_PROMOTIONS_ACCESS` key, or does it need a new one?

## Related

- Parent audit: SPEC-310 (plan packaging recalibration).
- SPEC-312 (tourist price alerts) — sibling tourist-plus/vip phantom gate.
- **SPEC-316** (VIP Promotions Access) — was a separate stub for exactly the
  vip-tier half of this feature, generated independently by the same SPEC-310
  roadmap audit (created 2026-06-30). Consolidated into this spec on
  2026-07-01 (folded in the vip-tier scope, the SPEC-286 naming-collision
  caveat, and the "who creates vip promotions" open question); marked
  `obsolete` in the tracking indices.
- **SPEC-286** — defines the current real usage of `VIP_PROMOTIONS_ACCESS`;
  its OQ-5 gates how this spec's vip tier can proceed (see caveat above).
