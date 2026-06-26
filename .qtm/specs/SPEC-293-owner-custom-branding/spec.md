---
specId: SPEC-293
title: Owner Custom Branding
type: feat
complexity: medium
status: draft
created: 2026-06-26
tags: [owner, branding, entitlements, web]
---

# SPEC-293 — Owner Custom Branding

> Builds a feature that today is only a **billing flag**. Surfaced during the
> SPEC-282 review (owner-side audit).

## 1. Summary

The entitlement `CUSTOM_BRANDING` is granted to premium owner/complex plans, but the
feature **does not exist**: there is no DB field, no route, no UI — only the billing
config grant and an admin display label.

This spec defines and builds custom branding for premium owners.

## 2. Context

- **Verified 2026-06-26:** billing config + a display label only; zero
  implementation.

## 3. Goals

- **G-1** Define the branding surface (logo, colors, cover, a branded listing/owner
  page — scope in OQ-1).
- **G-2** Persist branding settings (DB + schema) gated by `CUSTOM_BRANDING`.
- **G-3** Render the branding where decided (owner's listings / a branded mini-page).

## 4. Non-Goals

- No full white-label/custom-domain in v1 (OQ-2).

## 5. Open Questions

- **OQ-1** Branding scope v1: logo + accent color on the owner's listings, or a
  fuller branded owner page?
- **OQ-2** Custom domain / full white-label — in or out of scope?

## 6. Relationship to SPEC-282

The "Branding personalizado" row stays *Próximamente* until this ships.
