---
specId: SPEC-316
title: VIP Promotions Access
type: feature
complexity: medium
status: draft
created: 2026-06-30T00:00:00Z
base: staging
---

# SPEC-316 — VIP Promotions Access

> **⚠️ RECONCILED with SPEC-286 D-5 (2026-06-30).** SPEC-286 verified that the
> `VIP_PROMOTIONS_ACCESS` entitlement is a *visibility* perk today (8 checks in
> `accommodation.service.ts`), not a promotions feature, and renames its key to
> `VIP_VISIBILITY_ACCESS`. Therefore this spec may NOT reuse that key. If real
> VIP promotions are built here, they MUST define a NEW entitlement. This spec
> stays backlog / discovery-first with that constraint.
>
> **Stub (backlog).** Created from the SPEC-310 plan-packaging audit, which found this feature is advertised in the billing plans but is phantom (no gate function even written; the owner-promotion public list is ungated). This stub captures the objective; it must go through full discovery (/task-master:spec-review or /spec) before implementation.

## Overview

Tourist-vip should have access to a VIP-only tier of promotions or perks (`VIP_PROMOTIONS_ACCESS` entitlement) that goes above and beyond the exclusive deals available to plus tourists (SPEC-313). This gives tourist-vip a real exclusive differentiator — today the vip tier has no unique features that plus does not also have. The relationship between VIP promotions and SPEC-313 exclusive deals must be clarified during discovery.

## Why now

Part of the SPEC-310 roadmap to stop selling unimplemented features. `VIP_PROMOTIONS_ACCESS` is advertised as a vip-exclusive perk but not even a gate function exists in the codebase. Tourist-vip has no real exclusives today, weakening the upgrade value proposition.

## Scope (to refine in discovery)

- Define what "VIP promotions" are and how they differ from SPEC-313 exclusive deals (higher-value deals, early access, special packages, etc.).
- Gate access behind `VIP_PROMOTIONS_ACCESS`; only tourist-vip and above can view.
- Implement the VIP promotions surface on the web tourist UI and necessary API route(s).

## Out of scope (initial)

- Anything beyond the single feature; pricing/limit calibration lives in SPEC-310.

## Open questions

- Is VIP Promotions Access simply a higher tier of the same SPEC-313 exclusive-deals surface (e.g., vip sees all plus deals + additional vip-only ones), or is it a wholly separate concept requiring its own content type?
- Who creates VIP promotions — owners targeting vip tourists, or Hospeda admin curating them manually?

## Related

- Parent audit: SPEC-310 (plan packaging recalibration).
- SPEC-313 (tourist exclusive deals) — likely the lower-tier sibling of this feature; implementation order may depend on SPEC-313 being done first.
