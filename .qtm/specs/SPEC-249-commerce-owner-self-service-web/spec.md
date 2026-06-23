---
specId: SPEC-249
title: Commerce owner self-service web area (operational editing + force-password + credential email)
slug: commerce-owner-self-service-web
type: feature
complexity: medium
status: in-progress
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

## 2. Background (current state, RE-VERIFIED 2026-06-20 post-SPEC-239 merge)

> **Important:** this spec's original §2 (draft) was written before SPEC-239 finished.
> SPEC-239 then shipped to staging (63/64) and built most of Parts B and C. The
> following reflects the **actual code on `staging` today** (file evidence in §9).

- **Web** (`apps/web`): public commerce pages exist for **both** verticals —
  `/[lang]/gastronomia` and `/[lang]/experiencias` (+ `[slug]` detail). The
  authenticated owner self-service area (Part A) **does NOT exist** — there is no web
  page consuming `updateOwn`, and web does not yet know the `COMMERCE_OWNER` role.
- **Authenticated account shell**: `/[lang]/mi-cuenta/*` is the existing logged-in
  self-service area (host dashboard, properties, inbox), gated by middleware via
  `PROTECTED_SEGMENTS = ['mi-cuenta']`, rendered with `AccountLayout.astro`, session in
  `Astro.locals.user`. `account-roles.ts` exposes `isHostRole` / `ROLES_WITH_ACCOMMODATIONS_NAV`
  but has **no** commerce helper yet.
- **Service**: `BaseCommerceListingService` + `GastronomyService.updateOwn()` **and**
  `ExperienceService.updateOwn()` exist and enforce per-section `COMMERCE_*_EDIT_OWN`
  permissions (operational fields only: `openingHours`, `contactInfo`, `socialNetworks`,
  `media`, `menuUrl`, `priceRange`, `richDescription`, `amenityIds`, `featureIds`).
  Identity fields (`name`, `slug`, `type`, `destinationId`) are admin-only and absent
  from the owner-update schema. **Ownership is 1:N** (no `UNIQUE(ownerId)`): one owner can
  own several gastronomy and/or experience listings.
- **Protected API (already built)**: `gastronomy/protected/patch.ts` + `getById.ts` and
  `experience/protected/patch.ts` + `getById.ts` already back `updateOwn` (owner-scoped,
  per-section perms, `NOT_FOUND` for non-owners). Part A web only needs to **consume** these.
- **Roles**: `COMMERCE_OWNER` role + granular `COMMERCE_*_EDIT_OWN` permissions exist.
  Seeded owners (`gastro-owner-*@local.test`) exist.
- **Part B — ALREADY BUILT (SPEC-239)**: `users.must_change_password` column exists;
  web middleware (`apps/web/src/middleware.ts`) redirects `mustChangePassword` sessions to
  `/[lang]/mi-cuenta/cambiar-contrasena`; API `mustChangePasswordGate()` blocks
  `/protected/*` until cleared; `POST /protected/auth/change-password` clears the flag.
  → **Verify with a smoke, do not rebuild.**
- **Part C — ALREADY BUILT (SPEC-239)**: `@repo/notifications` template
  `CommerceOwnerCredentials` + `CommerceOwnerProvisioningService.provisionCommerceOwner()`
  - admin route `provision-owner.ts` + Brevo transport send the credential email on
  provisioning. → **Verify with a smoke, do not rebuild.**
- **Lead flow**: `commerce_leads` + admin inbox + `mark-handled.ts` (approve/reject) +
  `provision-owner.ts` (create owner user) + `start-subscription.ts` exist as **separate**
  admin actions. Approve does NOT yet auto-provision (this is the AC-6 gap, in scope).

## 3. Scope (REVISED — decisions locked 2026-06-20)

Parts B and C are **already implemented** by SPEC-239. This spec therefore covers:
**Part A (build) + AC-6 lead→provision wiring (build) + B/C smoke verification (verify only)**.

### Part A — Owner self-service web edit surface (primary build)

A logged-in `COMMERCE_OWNER` can view and edit the **operational** fields of the
listing(s) they own, in the web app, reusing the existing protected `updateOwn` endpoints:

- **Shell decision (OQ-1):** a **subsection under `/[lang]/mi-cuenta`** (working name
  `mi-cuenta/comercio`), reusing `AccountLayout.astro` and the existing middleware
  protection — NOT a bespoke top-level `/mi-comercio` area. Add a `isCommerceOwnerRole`
  helper to `account-roles.ts` and gate the commerce nav entry with it.
- **Verticals decision (OQ-6):** cover **gastronomy AND experiences from day 1** (both
  extend `BaseCommerceListingService`, both have protected `patch`/`getById`). Ownership
  is 1:N, so the entry point is a **list of the owner's listings (across both verticals)**
  → per-listing operational editor.
- **Operational-only editor:** `openingHours`, `contactInfo`, `socialNetworks`, `media`,
  `menuUrl`, `priceRange`, `richDescription`, `amenityIds`, `featureIds`. Identity/core
  fields are **read-only** (admin-controlled). Web styling conventions: vanilla CSS /
  CSS Modules, native forms (NOT Tailwind / NOT TanStack Form — those are admin-only).
- Writes go through the existing protected/owner endpoints (`gastronomy|experience
  /protected/patch`) backed by `updateOwn`; non-owners get `NOT_FOUND`.

### Part B — Force-password-change on first login (VERIFY ONLY)

Already built by SPEC-239 (column + web middleware gate + API gate + change-password
endpoint + page). This spec only adds a **smoke/regression test** asserting a freshly
provisioned `COMMERCE_OWNER` is forced through `mi-cuenta/cambiar-contrasena` before any
other authenticated action, and the flag clears afterward. No new mechanism.

### Part C — Credential email on provisioning (VERIFY ONLY)

Already built by SPEC-239 (`CommerceOwnerCredentials` template + provisioning service +
Brevo transport). This spec only adds a **smoke/regression test** asserting provisioning
sends the credential email (against the notifications stub). No new template.

### Part D — Lead → provision in one admin action (AC-6, BUILD)

Today `mark-handled.ts` (approve) and `provision-owner.ts` (create owner) and
`start-subscription.ts` are separate steps. Wire a single "approve & provision" path so
approving a lead provisions the owner user + sends the credential email in one action.
(Listing creation / subscription start remain explicit admin steps unless atomization
shows they can be safely folded in — to be decided at task time, not assumed here.)

## 4. Out of scope (hard constraints)

- **No identity/core editing by owners.** Owners never edit `name`, `slug`, `type`,
  `destinationId`, lifecycle/visibility/moderation/featured — those stay admin-only.
- **No new billing/subscription behaviour.** Visibility is still driven by the
  commerce-subscription reconciler from SPEC-239.
- **No public self-onboarding.** The model stays admin-sells (lead → admin provisions).
  Owners only edit AFTER an admin creates their account + listing.

## 5. Acceptance criteria (high level — to be atomized)

- **AC-1**: A `COMMERCE_OWNER` reaching `mi-cuenta/comercio` sees a list of only the
  listings they own (gastronomy + experiences); a non-owner / tourist cannot reach it
  (redirect / `NOT_FOUND`).
- **AC-2**: The owner can edit each operational field group on a gastronomy listing and
  on an experience listing and persist it; the change is reflected on the public ficha.
  Identity/core fields are visible but not editable.
- **AC-3**: A forged identity/core field in the owner's submit is rejected/stripped
  server-side (regression test on `updateOwn` for both verticals).
- **AC-4** (verify): A freshly provisioned owner with `mustChangePassword = true` is
  forced through `mi-cuenta/cambiar-contrasena` before any other authenticated action;
  the flag clears afterward. (Mechanism already exists — assert, don't rebuild.)
- **AC-5** (verify): Provisioning a commerce owner sends the `CommerceOwnerCredentials`
  email (asserted against the notifications stub). (Already exists — assert.)
- **AC-6** (build): Approving a lead provisions the owner user + sends the credential
  email in one admin action.

## 6. Open questions — RESOLVED 2026-06-20 (kept for traceability)

- **OQ-1 — Route & shell.** ✅ **Subsection under `/[lang]/mi-cuenta`** (working name
  `mi-cuenta/comercio`), reusing `AccountLayout` + existing middleware. List + per-listing
  editor. Not a bespoke `/mi-comercio`.
- **OQ-2 — Multiple listings.** ✅ **1:N confirmed in code** (no `UNIQUE(ownerId)`). The
  area lists all of the owner's listings and lets them pick one to edit.
- **OQ-3 — Force-password mechanism.** ✅ **Already built (SPEC-239)** — `must_change_password`
  column + web middleware gate + API `mustChangePasswordGate()` + change-password endpoint.
  Reuse as-is; this spec only smoke-tests it.
- **OQ-4 — Email content & provider.** ✅ **Already built (SPEC-239)** — temp-password
  `CommerceOwnerCredentials` template via Brevo transport. Reuse as-is; smoke-test only.
- **OQ-5 — Lead → provision integration.** ✅ **In scope (Part D / AC-6)** — wire a single
  "approve & provision" action (owner user + credential email). Listing/subscription
  remain explicit admin steps unless atomization proves they fold in safely.
- **OQ-6 — Scope across verticals.** ✅ **Gastronomy + Experiences from day 1** (both
  extend `BaseCommerceListingService`, both have protected `patch`/`getById`).

## 7. Dependencies

- **SPEC-239** (commerce listing core + gastronomy) — ✅ **satisfied**: shipped to staging
  (63/64). Provides `updateOwn`, `COMMERCE_*_EDIT_OWN`, `COMMERCE_OWNER`, the lead flow,
  the `must_change_password` gate, and the `CommerceOwnerCredentials` email this spec builds on.
- **SPEC-240** (experiences vertical) — ✅ **satisfied**: `ExperienceService` + protected
  routes already on staging, enabling the day-1 multi-vertical scope.

## 8. Notes

Re-verified against `staging` on 2026-06-20 (after SPEC-239 merged): the original draft's
Parts B and C are **already built** — the real remaining work is the **web owner surface
(Part A, gastronomy + experiences)** plus the **approve→provision wiring (Part D / AC-6)**.
The owner-edit service path and protected endpoints already exist; Part A only consumes them.

## 9. Key file evidence (verified 2026-06-20)

- **Ownership 1:N**: `packages/db/src/schemas/gastronomy/gastronomy.dbschema.ts` (`ownerId`,
  no UNIQUE); `packages/db/src/schemas/experience/experiences.dbschema.ts` (same).
- **Protected owner endpoints (consume these)**: `apps/api/src/routes/gastronomy/protected/{patch,getById}.ts`,
  `apps/api/src/routes/experience/protected/{patch,getById}.ts` (use `updateOwn`).
- **Account shell to extend**: `apps/web/src/pages/[lang]/mi-cuenta/*`,
  `apps/web/src/components/.../AccountLayout.astro`, `apps/web/src/lib/routes.ts`
  (`PROTECTED_SEGMENTS`), `apps/web/src/lib/account-roles.ts` (add `isCommerceOwnerRole`),
  `apps/web/src/middleware.ts` (session + `mustChangePassword` gate).
- **Part B (already built)**: `packages/db/src/schemas/user/user.dbschema.ts`
  (`must_change_password`), `apps/api/src/routes/auth/change-password.ts`,
  `apps/web/src/pages/[lang]/mi-cuenta/cambiar-contrasena/`, `apps/api/src/routes/index.ts`
  (`mustChangePasswordGate`).
- **Part C (already built)**: `packages/notifications/src/templates/commerce/commerce-owner-credentials.tsx`,
  `packages/service-core/src/services/commerce/commerce-owner-provisioning.service.ts`,
  `apps/api/src/routes/commerce/admin/provision-owner.ts`.
- **Part D (AC-6) touch points**: `apps/api/src/routes/commerce/admin/mark-handled.ts`
  (approve/reject), `provision-owner.ts`, `packages/service-core/src/services/commerce/commerce-lead.service.ts`.
