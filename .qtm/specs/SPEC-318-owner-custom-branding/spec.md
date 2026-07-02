---
specId: SPEC-318
title: Owner Custom Branding (Premium)
type: feature
complexity: medium
status: draft
created: 2026-06-30T00:00:00Z
base: staging
---

# SPEC-318 — Owner Custom Branding (Premium)

> **Stub (backlog).** Created from the SPEC-310 plan-packaging audit, which found this feature is advertised in the billing plans but is phantom (no DB column, no route, no UI anywhere in the codebase). This stub captures the objective; it must go through full discovery (/task-master:spec-review or /spec) before implementation.

## Overview

Owner-premium subscribers should be able to customize the branding on their accommodation listing or host profile (`CUSTOM_BRANDING` entitlement) — at minimum a logo upload, potentially accent colors or a banner. This is one of the two features that give the owner-premium tier real exclusives (alongside SPEC-319 verification badge). Today owner-premium has no tangible differentiators, undermining its upgrade value proposition.

## Why now

Part of the SPEC-310 roadmap to stop selling unimplemented features. `CUSTOM_BRANDING` is advertised as a premium-only exclusive but has zero implementation: no DB columns exist on accommodations or owner profiles, no API route handles branding uploads, and no owner editor UI surfaces branding controls.

## Scope (to refine in discovery)

- Define which branding fields are in scope: logo (image upload via Cloudinary), accent color, banner image, or a broader theme.
- Add the necessary DB columns (or a `branding` JSONB column) to the accommodation and/or owner-profile table.
- Implement branding upload/update in the owner editor (web) gated behind `CUSTOM_BRANDING`.
- Render the custom branding elements on the public accommodation listing/detail page when present.

## Out of scope (initial)

- Anything beyond the single feature; pricing/limit calibration lives in SPEC-310.

## Open questions

- What is the scope of "branding" for v1 — logo only, or logo + colors + banner? A minimal but meaningful definition is needed to avoid open-ended scope.
- Does custom branding apply per-accommodation (each listing has its own logo/colors) or per-owner-profile (one brand across all of the owner's listings)?

## Related

- Parent audit: SPEC-310 (plan packaging recalibration).
- SPEC-319 (accommodation verification badge) — the other owner-premium exclusive; both should be planned together to define the full premium tier value.
- SPEC-317 (owner review responses) — sibling owner feature at a lower tier.
