---
spec-id: SPEC-203
title: Self-serve plan management UI (web)
type: feature
complexity: medium
status: draft
created: 2026-06-06T00:00:00Z
parent: SPEC-193
depends_on: [SPEC-167, SPEC-147]
relates_to: [SPEC-145]
priority: medium
base: staging
worktree: null
---

# SPEC-203: Self-serve plan management UI (web)

> Draft created during SPEC-167 realign (decision D-4, owner 2026-06-06). The web app has NO plan-change
> UI today: the only billing surface is the checkout CTA (`PlanPurchaseButton` → `start-paid`); the
> `change-plan` endpoint is admin-consumed only. SPEC-167 and SPEC-147 both deliver API-complete flows
> that need this UI surface; building it inside either would duplicate the same page.

## 1. Problem

Hosts cannot manage their subscription from the web app. There is no "my subscription" page: no way to
see the current plan, change plan (upgrade/downgrade), choose which resources to keep on a downgrade
(SPEC-167 preview contract), or cancel (SPEC-147). All of these flows exist (or will exist) at the API
level but have no self-serve surface.

## 2. Scope sketch (to formalize before atomization)

- "My subscription" page in `apps/web` (Astro + React islands, CSS Modules, i18n es/en/pt):
  current plan, renewal date, payment status.
- Plan change flow: pick target plan → if downgrade, render the SPEC-167 restriction preview
  ("you'll exceed the new plan — here's what gets restricted") + the choose-what-to-keep selector
  (`keepIds`) → confirm → scheduled-change confirmation state.
- Cancel button + flow (SPEC-147 soft-cancel API).
- Consumes only `/api/v1/protected/*` endpoints (web app never calls admin tier).

## 3. Dependencies

- SPEC-167 must land first: defines the preview contract + `keepIds` field this UI consumes.
- SPEC-147 must land first: defines the cancel API this UI consumes.

## 4. Out of scope

- Any new API endpoints (everything is delivered by SPEC-167/147).
- Admin UI changes.
