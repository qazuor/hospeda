---
specId: SPEC-319
title: Accommodation Verification Badge (Premium)
type: feature
complexity: medium
status: draft
created: 2026-06-30T00:00:00Z
base: staging
---

# SPEC-319 — Accommodation Verification Badge (Premium)

> **Stub (backlog).** Created from the SPEC-310 plan-packaging audit, which found this feature is advertised in the billing plans but is phantom (no DB column exists; only dead filter interface code referencing a `HAS_VERIFICATION_BADGE` concept with no backing data). This stub captures the objective; it must go through full discovery (/task-master:spec-review or /spec) before implementation.

## Overview

Owner-premium subscribers' accommodations should display a "verified" trust badge (`HAS_VERIFICATION_BADGE` entitlement) on their listing cards and detail page, signaling to tourists that the property has been validated. This is the second of the two features that give owner-premium real exclusives (alongside SPEC-318 custom branding). The verification process itself — automatic on premium subscription vs. earned through a manual admin check — must be defined during discovery.

## Why now

Part of the SPEC-310 roadmap to stop selling unimplemented features. `HAS_VERIFICATION_BADGE` is advertised as a premium trust signal, but the accommodation table has no `isVerified` column, there is no admin verification workflow, and the badge is never rendered on any listing card or detail page. The dead filter interface code is the only trace in the codebase.

## Scope (to refine in discovery)

- Add an `is_verified` boolean (or equivalent) column to the accommodation table and expose it in the public API.
- Define and implement the verification granting mechanism: auto-set on premium subscription activation, or an admin-triggered approval step.
- Render the verification badge on accommodation listing cards and the detail page.
- If admin-triggered: add an admin interface for reviewing and granting/revoking verification.

## Out of scope (initial)

- Anything beyond the single feature; pricing/limit calibration lives in SPEC-310.

## Open questions

- Is the badge auto-granted when an owner subscribes to premium (simple), or does it require a manual verification process where admins review documents/photos (trust-building but operational overhead)?
- Should verification be revocable (e.g., if the owner downgrades from premium, does the badge disappear automatically)?

## Related

- Parent audit: SPEC-310 (plan packaging recalibration).
- SPEC-318 (owner custom branding) — the other owner-premium exclusive; these two define the full premium tier value and should be planned together.
