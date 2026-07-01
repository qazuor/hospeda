---
specId: SPEC-313
title: Tourist Exclusive Deals
type: feature
complexity: medium
status: draft
created: 2026-06-30T00:00:00Z
base: staging
---

# SPEC-313 — Tourist Exclusive Deals

> **⛔ SUPERSEDED — ABSORBED by SPEC-286 (2026-06-30).** Surfacing owner-promotion
> offers to tourists is built in SPEC-286 (unified Alerts & Offers) as G-2 + task
> T-012. This spec is archived (obsolete) and is NOT implemented separately. Kept
> for history only.
>
> **Stub (backlog).** Created from the SPEC-310 plan-packaging audit, which found this feature is advertised in the billing plans but is a phantom gate (`gateExclusiveDeals` PHANTOM-GATE; no deals entity, no route, no UI). This stub captures the objective; it must go through full discovery (/task-master:spec-review or /spec) before implementation.

## Overview

Tourist-plus and tourist-vip tiers should have access to a curated list of exclusive deals or offers visible only to paying tourists (`EXCLUSIVE_DEALS` entitlement). Owner-promotions already exist in the project but their public list is ungated and unrelated to this feature. Discovery needs to define whether exclusive-deals are gated visibility into existing owner-promotions or a new dedicated deals concept. Tourist-vip exclusive access is extended further in SPEC-316 (VIP Promotions Access).

## Why now

Part of the SPEC-310 roadmap to stop selling unimplemented features. `EXCLUSIVE_DEALS` is listed as a plan perk for plus/vip tourists but the gate function is a phantom — there is no backing entity, no route, and no UI surface anywhere in the codebase.

## Scope (to refine in discovery)

- Define the "exclusive deal" concept and its data model (relation to existing owner-promotions, or standalone deals table).
- Gate access to the deals surface behind `EXCLUSIVE_DEALS`; only tourist-plus and above can view.
- Implement the gated deals listing on the web tourist UI and the necessary API route(s).

## Out of scope (initial)

- Anything beyond the single feature; pricing/limit calibration lives in SPEC-310.

## Open questions

- Are exclusive deals just a gated visibility filter over existing owner-promotions, or do they represent a new content type that owners/admins create specifically for paying tourists?
- If they are a new concept, who creates and manages them — owners (in the web editor), admins, or Hospeda staff?

## Related

- Parent audit: SPEC-310 (plan packaging recalibration).
- SPEC-316 (VIP Promotions Access) — higher-tier extension of the same deals surface.
- SPEC-312 (tourist price alerts) — sibling tourist-plus/vip phantom gate.
