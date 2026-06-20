---
specId: SPEC-249
title: Commerce owner self-service web area (operational editing + force-password + credential email)
slug: commerce-owner-self-service-web
type: feature
complexity: medium
status: draft
created: 2026-06-20
base: staging
dependsOn:
  - SPEC-239
tags:
  - commerce
  - gastronomy
  - web
  - owner
  - auth
  - self-service
  - admin-sells
---

# SPEC-249 — Commerce owner self-service web area

## 1. Origin

Surfaced during the SPEC-239 staging-readiness browser smoke (2026-06-20). SPEC-239
shipped the **admin-sells** model (admin creates the commerce user + listing) and the
public pages, but the **consumer-facing half of the loop is missing**:

- There is **no web surface** where a logged-in commerce owner (`COMMERCE_OWNER`) can
  edit the **operational** fields of their own listing. The only edit path today is the
  admin panel, gated by `COMMERCE_*_EDIT_OWN` permissions — which is not where a real
  merchant is meant to work.
- The **force-password-change on first login** described by SPEC-239 (admin emails
  credentials → owner must change password before using the account) is **not built**
  end to end (the `mustChangePassword` mechanism is absent / unverified — SPEC-239
  baseline flagged it as "must be built").
- Approving a lead does **not** create the user + send credentials automatically; it
  only flips the lead status. The admin must provision the user/listing manually, and
  there is **no credential email**.

This spec closes that loop so the admin-sells flow works for a real merchant.

## 2. Background (current state, verified 2026-06-20)

- **Web** (`apps/web`): only public commerce pages exist — `/[lang]/gastronomia`
  (listing) and `/[lang]/gastronomia/[slug]` (detail). No owner-authenticated area, no
  `change-password` page (only `auth/reset-password` + `auth/forgot-password`).
- **Service**: `GastronomyService.updateOwn()` / `BaseCommerceListingService` already
  exist and enforce per-section `COMMERCE_*_EDIT_OWN` permissions (operational fields
  only: `openingHours`, `contactInfo`, `socialNetworks`, `media`, `menuUrl`,
  `priceRange`, `richDescription`, `amenityIds`, `featureIds`). Identity fields
  (`name`, `slug`, `type`, `destinationId`) are admin-only and absent from the
  owner-update schema.
- **Roles**: `COMMERCE_OWNER` role + granular `COMMERCE_*_EDIT_OWN` permissions exist
  (SPEC-239). Seeded commerce owners exist (`gastro-owner-*@local.test`) but with
  `must_change_password = false`.
- **Lead flow**: `commerce_leads` + admin inbox (`/platform/commerce-leads`) + Resolver
  (approve/reject) exist. No user-provisioning or email on approval.
- **Auth**: Better Auth (`apps/api/src/lib/auth.ts`). No `mustChangePassword` gate.

## 3. Scope — three parts

### Part A — Owner self-service web edit surface (primary)

A logged-in `COMMERCE_OWNER` can view and edit the **operational** fields of the
listing(s) they own, on the **web** app, reusing the existing `updateOwn` service path:

- A route (working name `/[lang]/mi-comercio`) gated by an authenticated session +
  `COMMERCE_OWNER` ownership. Lists the owner's listings; if exactly one, deep-links
  straight to its editor.
- An operational-only editor: `openingHours`, `contactInfo`, `socialNetworks`, `media`,
  `menuUrl`, `priceRange`, `richDescription`, `amenityIds`, `featureIds`. Identity/core
  fields are **read-only** (admin-controlled). Web styling conventions (vanilla CSS /
  CSS Modules, native forms — NOT Tailwind/TanStack Form).
- Writes go through the existing protected/owner endpoint backed by
  `GastronomyService.updateOwn` (per-section `COMMERCE_*_EDIT_OWN` enforcement,
  ownership → `NOT_FOUND` for non-owners).

### Part B — Force-password-change on first login

- A `mustChangePassword` flag on the user (build if absent), set `true` when an admin
  provisions a commerce owner.
- A web gate: a session whose user has `mustChangePassword = true` is redirected to a
  change-password page and cannot use the rest of the authenticated app until they set
  a new password (clears the flag).

### Part C — Credential email on provisioning

- When an admin provisions a commerce owner (from an approved lead or directly), send
  an email with login credentials (or a set-password link) via the existing
  notifications/email infrastructure. Optionally wire "approve lead → create user +
  listing + email" so the admin-sells flow is one action instead of several manual steps.

## 4. Out of scope (hard constraints)

- **No identity/core editing by owners.** Owners never edit `name`, `slug`, `type`,
  `destinationId`, lifecycle/visibility/moderation/featured — those stay admin-only.
- **No new billing/subscription behaviour.** Visibility is still driven by the
  commerce-subscription reconciler from SPEC-239.
- **No public self-onboarding.** The model stays admin-sells (lead → admin provisions).
  Owners only edit AFTER an admin creates their account + listing.

## 5. Acceptance criteria (high level — to be atomized)

- **AC-1**: A `COMMERCE_OWNER` logging into the web app lands on (or can reach) a
  self-service area listing only the listings they own; a non-owner / tourist cannot
  reach it (403/redirect).
- **AC-2**: The owner can edit each operational field group and persist it; the change
  is reflected on the public ficha. Identity/core fields are visible but not editable.
- **AC-3**: A forged identity/core field in the owner's submit is rejected/stripped
  server-side (regression test on `updateOwn`).
- **AC-4**: A user with `mustChangePassword = true` is forced to change their password
  on first web login before any other authenticated action; the flag clears afterward.
- **AC-5**: Provisioning a commerce owner sends a credential / set-password email
  (asserted against the notifications stub).
- **AC-6** (optional, if Part C integration chosen): approving a lead provisions the
  user + listing + sends the email in one admin action.

## 6. Open questions (RESOLVE BEFORE TASK GENERATION)

- **OQ-1 — Route & shell.** `/[lang]/mi-comercio` as a bespoke web area, or reuse a
  generic "my account" shell? One page per listing or a list + detail?
- **OQ-2 — Owner with multiple listings.** Can one `COMMERCE_OWNER` own several
  listings (gastronomy + experience)? If yes, the area must list and switch between them.
- **OQ-3 — Force-password mechanism.** Build a `mustChangePassword` column + Better Auth
  hook + web gate, OR reuse the existing reset-password / magic-link flow (email a
  set-password link instead of a temp password)?
- **OQ-4 — Email content & provider.** Temp password vs set-password link? Which
  template / sender via `@repo/notifications`?
- **OQ-5 — Lead → provision integration (Part C).** Keep approve-lead and create-listing
  separate (admin does both manually), or wire a single "approve & provision" action?
- **OQ-6 — Scope across verticals.** Gastronomy only first, or gastronomy + experiences
  (both extend `BaseCommerceListingService`) from the start?

## 7. Dependencies

- **SPEC-239** (commerce listing core + gastronomy) — provides the service layer
  (`updateOwn`, `COMMERCE_*_EDIT_OWN`), the `COMMERCE_OWNER` role, the lead flow, and the
  admin-sells model this spec completes. Must be merged first.

## 8. Notes

This spec was created from the SPEC-239 smoke session. The owner-edit service path
(`updateOwn`) and permissions already exist — the bulk of the work is the **web
surface**, the **force-password gate**, and the **credential email**, not new business
logic. Resolve §6 before generating tasks.
