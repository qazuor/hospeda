---
id: SPEC-171
slug: entitlements-staff-unlimited
title: Entitlements service returns unlimited (-1) for staff without plan
status: draft
owner: qazuor
created: 2026-05-29
relatedSpecs:
  - SPEC-143  # billing entitlements baseline
  - SPEC-154  # admin entity view/edit redesign (introduced the frontend shim)
tags:
  - billing
  - entitlements
  - tech-debt
  - admin
---

# SPEC-171 — Entitlements service returns unlimited (-1) for staff without plan

## 1. Summary

The billing entitlements resolver currently treats "no active plan" as "no
entitlements" for every actor, including staff roles (`SUPER_ADMIN`, `EDITOR`).
To make the admin entity edit pages work for staff users (who don't have a
billing customer/subscription), SPEC-154 PR #1303 introduced a frontend hook
(`useShouldShowEntitlementGates`) that checks `actor.role` and bypasses the
gates when the user is staff.

This shim is **conceptually wrong**: the frontend decides what counts as
"staff", duplicating logic that belongs in the backend resolver. Move the
bypass server-side so the motor returns `-1` (unlimited) for staff sin plan
and the frontend shim can be deleted.

## 2. Why now / why not now

**Why this needs to happen**:

- The frontend shim is duplicated logic. Every new entity that uses
  `PlanEntitlementGate` / `PremiumBlock` / `LimitProgressIndicator` will need
  to wire the same hook → drift across surfaces.
- The bypass is invisible to other clients (mobile, partner API). If a future
  consumer hits the same endpoints, it has to re-implement role-aware
  bypassing. Motor-side `-1` fixes this once for everyone.
- Tests of the admin form become simpler: the form trusts the resolver
  instead of carrying its own conditional logic.

**Why it's not urgent**:

- The shim works and is shipped (PR #1303).
- The backend touch is a hot path (`useMyEntitlements`); any change requires
  re-smoking every Phase 4-A surface (PremiumBlock, LimitProgressIndicator,
  quality-score popover).
- No user-facing impact today — pure tech-debt.

**Preferred timing**: BEFORE SPEC-154 Phase 6 (propagate the new shell to
destinations / events / posts / users / catalogs). Once the shim is wired into
5+ entity configs it will be harder to remove.

## 3. Acceptance criteria

- AC-1. Entitlements resolver returns `unlimited` (`-1` for quantitative
  limits, `true` for boolean signals) when the actor has `role` in
  `{SUPER_ADMIN, EDITOR}` and no active billing plan.
- AC-2. The same applies to `GET /me/entitlements` (or whatever endpoint the
  admin uses today): staff sin plan receives an unlimited entitlement set.
- AC-3. The frontend shim `useShouldShowEntitlementGates` is **deleted** from
  `apps/admin` and all consumers fall back to evaluating the entitlements the
  motor returned.
- AC-4. HOST end-to-end smoke (3 roles: super-admin / host-pro / host-basico)
  passes unchanged on the existing Phase 4-A surfaces.
- AC-5. New unit tests in the billing/entitlements package cover the staff
  bypass at the resolver level (no role → 0 entitlements, HOST + plan →
  computed entitlements, SUPER_ADMIN/EDITOR with or without plan → unlimited).

## 4. Open questions

- Q-1. What's the exact staff role list? Spec assumes `SUPER_ADMIN` and
  `EDITOR`. Confirm against the role catalog (engram suggests `MODERATOR`
  exists too — should they bypass too? They're not "billing actors" but they
  may need to edit accommodations on behalf of a host during moderation).
- Q-2. Cache. The entitlements endpoint has a runtime cache (`mem_search`
  hints at ~300s). After the change, does the cache need to key on
  `actor.role`? Otherwise a staff user could be served a cached non-staff
  payload.
- Q-3. Audit surfaces that today assume "staff sees limits" for demo/testing
  (e.g., billing settings page rendering a real customer's plan). Those
  surfaces should keep using the customer's entitlements explicitly, not
  `useMyEntitlements`.

## 5. Scope (not in scope)

**In scope**:

- Resolver-level bypass for staff sin plan
- Cache invalidation/keying review
- Delete frontend shim
- Re-smoke Phase 4-A surfaces

**Not in scope**:

- Granting staff a synthetic "staff plan" record in the billing tables (we
  want `-1` from the resolver, not a fake plan row).
- Changing what staff sees in the billing **admin** surfaces (those should
  display the customer's real plan, untouched).
- Any change to entitlement evaluation for non-staff actors.

## 6. Risks

- R-1. Hidden caller that relied on staff seeing "no entitlements" for
  testing. Mitigated by AC-4 (re-smoke) + AC-5 (unit tests at the resolver).
- R-2. Cache leak between actors of different roles. Mitigated by Q-2 audit.

## 7. References

- Origin: SPEC-154 PR #1303 (introduced the frontend shim)
- Related: SPEC-143 entitlement matrix + test-user seed
