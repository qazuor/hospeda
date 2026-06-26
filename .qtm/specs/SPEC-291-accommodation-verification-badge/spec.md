---
specId: SPEC-291
title: Accommodation Verification Badge
type: feat
complexity: medium
status: draft
created: 2026-06-26
tags: [owner, verification, trust, entitlements, web]
---

# SPEC-291 — Accommodation Verification Badge

> Builds a feature that today is **dead code**. Surfaced during the SPEC-282 review
> (owner-side audit).

## 1. Summary

The entitlement `HAS_VERIFICATION_BADGE` is granted to premium owner/complex plans,
but the feature **does not exist**. `apps/api/src/utils/entitlement-filter.ts`
references a `verificationBadge?: boolean` interface field and strips it when the
owner lacks the entitlement — but **no DB column, no schema field, and no service
ever produces it**, and **nothing renders a badge** in the web app. The filter is
dead code guarding a field that is never set.

This spec builds the real verification-badge feature: a trust signal on verified
accommodations, gated by the owner's plan (and presumably an actual verification
step).

## 2. Context

- **Verified 2026-06-26:** dead filter code only; no DB column, no producer, no
  render.

## 3. Goals

- **G-1** Define what "verified" means (manual admin verification? document check?)
  and persist it (DB column + schema).
- **G-2** Gate badge display on `HAS_VERIFICATION_BADGE` **and** an actual verified
  state.
- **G-3** Render the badge on listing cards + detail page.

## 4. Non-Goals

- No automated identity/KYC verification in v1 (manual admin verification — OQ-1).

## 5. Open Questions

- **OQ-1** Verification process: manual admin toggle vs a document/identity flow.
- **OQ-2** Does the badge require BOTH the entitlement AND a verified state, or just
  one? (Recommended: both — a free owner who is verified should not show it if the
  badge is a paid perk; confirm.)

## 6. Relationship to SPEC-282

The "Badge de verificación" row stays *Próximamente* until this ships.
