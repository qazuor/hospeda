---
specId: SPEC-164
title: Admin Billing Access — SUPER_ADMIN-Only
status: in-progress
complexity: medium-high
owner: qazuor
created: 2026-05-27
revised: 2026-05-27
parent: (none)
related:
  - SPEC-155 (admin-dashboards-v1 — origin of this extraction via T-002 blast-radius audit)
  - SPEC-154 (admin-config-driven-ia — owns the IA config files this spec edits)
  - SPEC-143 (billing-testing-coverage — billing admin surface smoke coverage)
  - SPEC-145 (billing-entitlements-and-limits-enforcement — entitlement gating at API layer)
---

# SPEC-164 — Admin Billing Access — SUPER_ADMIN-Only

> **Status**: IN-PROGRESS — finalized 2026-05-27 after first-hand blast-radius verification (engram `spec/spec-164/corrected-blast-radius` #839, `spec/spec-164/billing-tier-architecture` #834, `spec/spec-164/renderer-wiring-and-wide-safety`). The original DRAFT premise was wrong and has been corrected; see §5.

## 1. Origin

SPEC-155 (Admin Dashboards V1) originally included "Change 2 — REVOKE from ADMIN" in its permission changes section. That change was described as revoking `BILLING_METRICS_VIEW` and `SUBSCRIPTION_VIEW_ALL` from the ADMIN role. During SPEC-155 planning, the T-002 blast-radius audit was commissioned to determine whether this revoke was safe.

The audit, plus a first-hand re-verification, revealed several findings that changed the scope and the mechanism of the work:

1. **The named permissions do not exist.** `BILLING_METRICS_VIEW` and `SUBSCRIPTION_VIEW_ALL` are not defined in `packages/schemas/src/enums/permission.enum.ts`. The actual ADMIN billing permissions are six distinct entries with different names (see §5).

2. **The seed revoke does NOT, by itself, hide the Comercial section.** The `comercialSidebar` items gate on VIEW permissions that ADMIN never held in the first place (`PRICING_PLAN_VIEW`, `SUBSCRIPTION_VIEW`, `PAYMENT_VIEW`, …). The section is hidden by removing `'comercial'` from the role's `mainMenu`, not by the data-layer revoke. The original DRAFT premise ("removing the billing-six hides the Comercial section") is mostly false. See §5.

3. **The real protection mechanism is multi-layer**: (a) `mainMenu`/`bottomNav` removal hides the top-level nav entry; (b) the seed revoke enforces at the API/data layer; (c) `onMissing: 'hide'` on the billing sidebar items prevents leakage when the sidebar renders on direct URL navigation; (d) re-gating `billing-cron`/`billing-settings` off `ACCESS_PANEL_ADMIN` closes a concrete leak; (e) `beforeLoad` guards on the 14 billing route files stop direct-URL page render.

Because of this blast radius, and because the role-model change is orthogonal to the widget-rendering work in SPEC-155, the change was extracted into this dedicated spec. SPEC-155 references SPEC-164 as the receiver of this work.

## 2. Goal

Make the admin panel's billing surface SUPER_ADMIN-only by:

- Removing **nineteen** permissions from the ADMIN role seed (the billing-six plus the sponsorship/owner-promotion `_ANY` set plus `POST_SPONSORSHIP_MANAGE` — see §3 / §5 / OQ-1).
- Removing `'comercial'` from ADMIN's `mainMenu` and `mobile.bottomNav` so the section disappears from the nav.
- Setting `onMissing: 'hide'` on the billing sidebar items, and re-gating `billing-cron` and `billing-settings` off `ACCESS_PANEL_ADMIN`, so that an ADMIN who navigates directly to a `/billing/*` URL cannot see a leaked or greyed-out billing sidebar.
- Adding `beforeLoad` permission guards (checking `BILLING_READ_ALL`) to the 14 billing route files so direct-URL access is rejected at the page-render level.
- Ensuring ADMIN receives a clean 403 (never a 500) on every admin billing API call.

SUPER_ADMIN retains full billing access automatically via the `actor.ts` runtime bypass (`apps/api/src/middlewares/actor.ts:153-162`: `permissions: Object.values(PermissionEnum)`) and requires no separate change.

## 3. Scope

### IN — what this spec covers

- **Seed change (WIDE — OQ-1 resolved)**: remove the following **19** permissions from the `[RoleEnum.ADMIN]` array in `packages/seed/src/required/rolePermissions.seed.ts`:
  - **Billing-six**: `BILLING_READ_ALL`, `BILLING_MANAGE`, `MANAGE_SUBSCRIPTIONS`, `BILLING_PROMO_CODE_READ`, `BILLING_PROMO_CODE_MANAGE`, `BILLING_METRICS_READ`.
  - **Sponsorship `_ANY` (6)**: `SPONSORSHIP_VIEW_ANY`, `SPONSORSHIP_UPDATE_ANY`, `SPONSORSHIP_SOFT_DELETE_ANY`, `SPONSORSHIP_HARD_DELETE_ANY`, `SPONSORSHIP_RESTORE_ANY`, `SPONSORSHIP_UPDATE_VISIBILITY_ANY`.
  - **Owner-promotion `_ANY` (6)**: `OWNER_PROMOTION_VIEW_ANY`, `OWNER_PROMOTION_UPDATE_ANY`, `OWNER_PROMOTION_SOFT_DELETE_ANY`, `OWNER_PROMOTION_HARD_DELETE_ANY`, `OWNER_PROMOTION_RESTORE_ANY`, `OWNER_PROMOTION_UPDATE_VISIBILITY_ANY`.
  - **Post-sponsorship (1)**: `POST_SPONSORSHIP_MANAGE` (`post.sponsorship.manage`). NOTE: this is distinct from `POST_SPONSOR_MANAGE` (`post.sponsor.manage`), which ADMIN **keeps** — see §5 and the safety check in §7.
- **IA config — role file** (`apps/admin/src/config/ia/roles/admin.ts`): remove `'comercial'` from `mainMenu` and from `mobile.bottomNav`.
- **IA config — sidebar** (`apps/admin/src/config/ia/sidebars.ts`, `comercialSidebar`):
  - Set `onMissing: 'hide'` on the billing items so they are removed from the DOM (not rendered greyed-out) when the gating permission is absent.
  - Re-gate `billing-cron` (currently `permissions: ['ACCESS_PANEL_ADMIN']`) onto `BILLING_READ_ALL`.
  - Re-gate `billing-settings` (currently `permissions: ['ACCESS_PANEL_ADMIN']`, top-level link) onto `BILLING_READ_ALL`.
- **Page guards (OQ-2 resolved = Option B)**: add an explicit `beforeLoad` permission guard (checking `BILLING_READ_ALL`) to each of the 14 billing route files under `apps/admin/src/routes/_authed/billing/*.tsx`.
- **Tests**: seed tests (ADMIN lacks the 19; SUPER_ADMIN seed retains them); IA config validation tests (`comercial` absent from ADMIN `mainMenu`/`bottomNav`); an integration test (ADMIN → 403, SUPER_ADMIN → 200 on admin billing API); a graceful-degradation test (ADMIN direct-URL → clean error state, never 500).

### OUT — explicit exclusions

- **Dashboard widget visibility** — the SUPER_ADMIN-only billing card (SPEC-155 card I) is gated in SPEC-155 via `onMissing: 'hide'` on the dashboard config. SPEC-164 does not touch dashboard configs.
- **SPEC-155 dashboard implementation** — any widget, renderer, source resolver, or aggregation route from SPEC-155 is out of scope here.
- **Non-billing sections** — catalog, editorial, community, platform, analysis section permissions are unchanged.
- **HOST self-billing (protected tier)** — `/api/v1/protected/billing/*` (plan-change, pause/resume, start-paid, usage) is gated by `billingAdminGuardMiddleware` (`ACCESS_API_ADMIN`) + `billingOwnershipMiddleware`, NOT by the billing-six (engram #834). The revoke touches ONLY the admin tier (`/api/v1/admin/billing/*`, base-gated by `BILLING_READ_ALL`). HOST self-billing is unaffected. NO `BILLING_READ_ALL`-style guard may be added to any protected-tier / "Mi facturación" surface.
- **`billing-admin-guard.middleware.ts` model** — the protected-tier guard gates on `ACCESS_API_ADMIN`, not the billing-six; it is not changed by this spec.
- **SUPER_ADMIN changes** — none needed; the `actor.ts` runtime bypass grants every `PermissionEnum` value.
- **Exchange-rates page/API gating** — the `exchange-rates` sidebar item already gates on `EXCHANGE_RATE_VIEW`, which ADMIN does not hold, so it is already super-only on nav (confirmed). Re-gating the exchange-rates page/API itself is out of scope (the `beforeLoad` `BILLING_READ_ALL` guard in T-007 covers the route file regardless).
- **`comercialSidebar` redesign** — only ADMIN's access to it is changed; its content is not redesigned.

### Future considerations

- The split between `POST_SPONSOR_MANAGE` (kept) and `POST_SPONSORSHIP_MANAGE` (revoked) is subtle; a future cleanup could clarify the naming or consolidate.
- The role-vs-permission inconsistency in `billing-admin-guard.middleware.ts` is worth a future cleanup spec but is not unblocked by SPEC-164.

## 4. Acceptance criteria

### A. API-level gating

- AC-1: Given an ADMIN user (not SUPER_ADMIN). When they call any route under `/api/v1/admin/billing/*` that requires `BILLING_READ_ALL` (or any of the revoked perms). Then the API returns **403** and no billing data is returned.
- AC-2: Given an ADMIN user. When they call any admin sponsorship or owner-promotion management route requiring a revoked `_ANY` permission (e.g. `SPONSORSHIP_VIEW_ANY`). Then the API returns **403**.
- AC-3: Given a SUPER_ADMIN user. When they access any billing / sponsorship / owner-promotion admin route. Then the response is **200** and data loads correctly (runtime bypass).

### B. Navigation — section hidden via mainMenu removal

- AC-4: Given an ADMIN user. When the admin panel main navigation renders. Then no "Comercial" section appears in the main menu or the mobile bottom nav (because `'comercial'` is removed from `mainMenu`/`bottomNav` — NOT because of the seed revoke).
- AC-5: Given a SUPER_ADMIN user. When the admin panel renders. Then the full "Comercial" section with all billing sub-items appears correctly.

### C. Billing items hidden (not disabled) on direct navigation

- AC-6: Given an ADMIN user. When they navigate directly to a `/billing/*` URL (so the pathname-driven sidebar resolver renders `comercialSidebar`, see §5). Then every billing sidebar item is **omitted from the DOM** (`onMissing: 'hide'`), not rendered greyed-out/disabled.
- AC-7: Given an ADMIN user on a `/billing/*` URL. When the sidebar renders. Then `billing-cron` and `billing-settings` are hidden — they no longer survive via `ACCESS_PANEL_ADMIN` because they are re-gated onto `BILLING_READ_ALL`.

### D. Page guards — direct-URL rejected

- AC-8: Given an ADMIN user. When they navigate directly to any of the 14 `/billing/*` routes via the address bar. Then the `beforeLoad` guard rejects access (redirect to forbidden / dashboard) before the page component renders.
- AC-9: Given an ADMIN user. When they hit any `/billing/*` URL directly. Then no unhandled exception, no 500, no partial-data render, no broken layout — a clean rejected/forbidden state only.
- AC-10: Given an ADMIN user. When the dashboard loads. Then no billing data requests are fired that would 403.

### E. SUPER_ADMIN retention

- AC-11: Given a SUPER_ADMIN user. When they view the dashboard. Then the billing statistics card (SPEC-155 card I) is visible and loads.
- AC-12: Given a SUPER_ADMIN user. When they access any admin billing / sponsorship / owner-promotion page. Then full read+write access is available (no regression from the ADMIN revoke).

### F. Non-billing ADMIN workflows intact (WIDE-scope safety)

- AC-13: Given an ADMIN user. When they manage post sponsors via the editorial surface (which uses `POST_SPONSOR_MANAGE`, retained). Then the workflow still functions — the revoke of `POST_SPONSORSHIP_MANAGE` (a distinct permission) does not affect it.
- AC-14: Given an ADMIN user. When they use any non-billing admin page (catalog, editorial, community, platform, analysis, access). Then no regression results from the 19-permission revoke.
- AC-14b: Given an ADMIN user editing a post. When the post editor's relations section renders the `sponsorshipId` "Patrocinio" field. Then the field is **view-only** (visible via `POST_VIEW_ALL`, not editable because its `edit` gate is `POST_SPONSORSHIP_MANAGE`, revoked). This is an **accepted consequence** of the WIDE revoke (owner decision 2026-05-27): assigning a post's sponsorship contract is a commercial operation reserved for SUPER_ADMIN. Editing remains available to SUPER_ADMIN via the runtime bypass.

### G. Tests

- AC-15: A vitest test asserts `ROLE_PERMISSIONS[RoleEnum.ADMIN]` does NOT include any of the **19** revoked permissions (billing-six + 6 sponsorship `_ANY` + 6 owner-promotion `_ANY` + `POST_SPONSORSHIP_MANAGE`).
- AC-16: A vitest test asserts `ROLE_PERMISSIONS[RoleEnum.ADMIN]` still includes `POST_SPONSOR_MANAGE` (the kept, distinct permission) and `ACCESS_PANEL_ADMIN`.
- AC-17: A vitest test asserts `ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN]` still lists all 19 in the seed (independent of the runtime bypass).
- AC-18: An IA config test asserts `adminRole.mainMenu` does NOT contain `'comercial'` and `adminRole.mobile.bottomNav` does NOT contain `'comercial'`.
- AC-19: An integration test confirms a seeded ADMIN actor calling admin billing API routes receives **403, not 500**; and a SUPER_ADMIN actor receives 200 on the same routes.

## 5. Technical approach

### 5.1 The billing-six (data-layer revoke)

Confirmed present in the ADMIN array (`packages/seed/src/required/rolePermissions.seed.ts`, ADMIN block, billing comment block) and in `packages/schemas/src/enums/permission.enum.ts`:

| Permission enum value | String value | What it gates |
|---|---|---|
| `BILLING_READ_ALL` | `billing.readAll` | Base gate for the admin billing API tier (`/api/v1/admin/billing/*`); webhook events |
| `BILLING_MANAGE` | `billing.manage` | Admin write ops (expire, activate add-ons, …) |
| `MANAGE_SUBSCRIPTIONS` | `subscription.manage` | Admin subscription mgmt (cancel, change-plan, force-cancel, extend-trial) |
| `BILLING_PROMO_CODE_READ` | `billing.promoCode.read` | View promo codes |
| `BILLING_PROMO_CODE_MANAGE` | `billing.promoCode.manage` | Create / update / delete promo codes |
| `BILLING_METRICS_READ` | `billing.metrics.read` | View billing metrics + the `metricas-uso` sidebar item |

> **Critical finding (T-002 audit)**: `BILLING_METRICS_VIEW` and `SUBSCRIPTION_VIEW_ALL` (SPEC-155's original "Change 2") DO NOT EXIST in the enum. Shipping with those names would silently no-op the revoke. This spec uses the correct names.

### 5.2 The corrected blast radius (why the DRAFT premise was wrong)

First-hand reading of `comercialSidebar` (`apps/admin/src/config/ia/sidebars.ts`) shows the items gate on VIEW permissions ADMIN never held: `PRICING_PLAN_VIEW`, `SUBSCRIPTION_VIEW`, `SUBSCRIPTION_ITEM_VIEW`, `PAYMENT_VIEW`, `INVOICE_VIEW`, `DISCOUNT_CODE_VIEW`, `OWNER_PROMOTION_VIEW` (non-`_ANY`), `SPONSORSHIP_VIEW` (non-`_ANY`), `POST_SPONSOR_VIEW`, `EXCHANGE_RATE_VIEW`.

Within the ADMIN seed block, ADMIN holds only **three** sidebar-gating permissions: `ACCESS_PANEL_ADMIN`, `BILLING_READ_ALL`, `BILLING_METRICS_READ`. Consequences:

- The billing-six revoke, **by itself**, only changes two items: `metricas-uso` (gated on `BILLING_METRICS_READ`) and `webhook-events` (gated on `BILLING_READ_ALL`), and collapses the `ops-billing` group gate (`EXCHANGE_RATE_VIEW || BILLING_READ_ALL`). It does **not** hide the Comercial section.
- The other ~10 `comercialSidebar` items were never visible-by-permission to ADMIN; they were already gated out.

So the section-hide mechanism is **removing `'comercial'` from `mainMenu`/`bottomNav`**, not the seed revoke.

### 5.3 `onMissing` defaults to `'disable'`, not `'hide'`

`apps/admin/src/config/ia/schema.ts` (`ItemBaseFields.onMissing`) declares `OnMissingSchema.default('disable')`. None of the `comercialSidebar` items set `onMissing`. Therefore, today, items ADMIN lacks permission for render **greyed-out with a "Requiere permiso X" tooltip**, not removed from the DOM. To truly hide them (the pattern `plataformaSidebar` already uses for super-only items), each billing item must set `onMissing: 'hide'`.

### 5.4 The WIDE `_ANY` revoke is nav-invisible — its effect is API-level

`comercialSidebar` gates the sponsorship/promotion items on the **non-`_ANY`** VIEW perms (`SPONSORSHIP_VIEW`, `OWNER_PROMOTION_VIEW`, `POST_SPONSOR_VIEW`), which ADMIN already lacks. Revoking the `_ANY` set + `POST_SPONSORSHIP_MANAGE` therefore changes **nothing** in the nav. Its sole effect is at the API: it closes ADMIN's ability to view/manage **any** sponsorship or owner-promotion platform-wide (the `_ANY` perms are consumed by `packages/service-core/src/services/sponsorship/*` and `.../owner-promotion/*`, which back the `/billing/sponsorships` and `/billing/owner-promotions` admin pages). This is a valid security tightening; the rationale is **API-surface closure**, not nav removal.

### 5.5 The real leaks

- `billing-settings` (top-level link in `comercialSidebar`) and `billing-cron` (inside the `ops-billing` group) both gate on `ACCESS_PANEL_ADMIN`, which ADMIN **keeps** after the revoke. They therefore survive the seed change. `billing-settings` is a top-level link, so it survives regardless of any group-level hide. Both must be re-gated onto `BILLING_READ_ALL`.

### 5.6 Renderer wiring — STEP 2 resolved (DEFINITIVE)

**Question**: after `'comercial'` is removed from ADMIN's `mainMenu`, can an ADMIN ever cause `comercialSidebar` to render (e.g. by typing a `/billing/*` URL)?

**Answer: YES.** Traced first-hand:

- `apps/admin/src/components/layout/main-menu/MainMenu.tsx` is the only consumer of `roleConfig.mainMenu` — it renders the top-level section entries. Removing `'comercial'` removes only that top-level entry.
- `apps/admin/src/hooks/use-current-sidebar.ts` → `apps/admin/src/hooks/use-current-section.ts` resolves the **active** sidebar purely by **pathname → sidebar-link membership**, iterating over **all** `validatedConfig.sections` (`useCurrentSection` Phase 1/Phase 2). It does **not** filter by the role's `mainMenu`.
- `apps/admin/src/config/ia/sections.ts` defines the `comercial` section globally (`route: '/billing/plans'`, `sidebar: 'comercialSidebar'`), independent of any role.

Therefore, an ADMIN who navigates directly to any `/billing/*` URL will match the `comercial` section and `useCurrentSidebar` returns `comercialSidebar`, which then renders. The per-item permission gate still applies, but with the current `onMissing: 'disable'` default the items render **greyed-out** rather than hidden, and `billing-cron`/`billing-settings` render **fully** (they gate on `ACCESS_PANEL_ADMIN`, which ADMIN keeps).

**Implication**: the `onMissing: 'hide'` sweep (T-005) and the `billing-cron`/`billing-settings` re-gate (T-005) are **strictly required** to avoid a real leak on direct URL navigation — they are NOT merely defense-in-depth. The `beforeLoad` page guards (T-006) are the page-render-level backstop on top of that.

### 5.7 SUPER_ADMIN bypass — why no SUPER change is needed

`apps/api/src/middlewares/actor.ts:153-162`: when the role is `RoleEnum.SUPER_ADMIN`, the actor is built with `permissions: Object.values(PermissionEnum)` — every enum value, regardless of the seed table. The seed still lists the 19 for SUPER_ADMIN for documentation clarity, but the runtime grant is unconditional. Revoking from ADMIN does not touch SUPER_ADMIN.

### 5.8 Two-tier billing architecture (why HOST self-billing is safe)

Per engram #834: TIER 1 `/api/v1/protected/billing/*` is gated by `billingAdminGuardMiddleware` (`ACCESS_API_ADMIN`) + `billingOwnershipMiddleware` — HOST self-service lives here and is scoped to the actor's own resources. TIER 2 `/api/v1/admin/billing/*` is base-gated by `BILLING_READ_ALL`. The revoke touches ONLY TIER 2. HOST self-billing is unaffected and must not receive any `BILLING_READ_ALL` guard.

## 6. Task breakdown (atomic, complexity ≤ 4)

### Phase 0 — Verification (blocker)

| # | Task | Complexity | Blocks |
|---|------|:---:|---|
| T-001 | **Blast-radius + safety verification.** (a) Re-confirm the 19 permission names against `permission.enum.ts` and the current ADMIN seed array. (b) Confirm the renderer-wiring finding (§5.6): that `useCurrentSidebar`/`useCurrentSection` resolve by pathname with no `mainMenu` filtering, so `comercialSidebar` renders for ADMIN on direct `/billing/*` URLs. (c) **WIDE non-billing safety check**: confirm no NON-billing ADMIN workflow gates on the revoked `_ANY` perms or `POST_SPONSORSHIP_MANAGE` — verify the `/sponsors` entity page gates on `POST_SPONSOR_VIEW` (already absent for ADMIN) and editorial post-sponsorship uses `POST_SPONSOR_MANAGE` (kept, distinct). Produce a written go/no-go note. | 2 | T-002, T-004, T-005, T-006 |

### Phase 1 — Seed change

| # | Task | Complexity | Blocks |
|---|------|:---:|---|
| T-002 | **Seed revoke (19 perms)**: remove the billing-six, the 6 sponsorship `_ANY`, the 6 owner-promotion `_ANY`, and `POST_SPONSORSHIP_MANAGE` from `[RoleEnum.ADMIN]` in `packages/seed/src/required/rolePermissions.seed.ts`. Leave `POST_SPONSOR_MANAGE` and `ACCESS_PANEL_ADMIN` intact. | 1 | T-003, T-007 |
| T-003 | **Seed tests**: assert ADMIN lacks all 19 (AC-15); ADMIN keeps `POST_SPONSOR_MANAGE` + `ACCESS_PANEL_ADMIN` (AC-16); SUPER_ADMIN seed still lists the 19 (AC-17). | 2 | T-007 |

### Phase 2 — IA config (nav hide + leak closure)

| # | Task | Complexity | Blocks |
|---|------|:---:|---|
| T-004 | Remove `'comercial'` from `mainMenu` and `mobile.bottomNav` in `apps/admin/src/config/ia/roles/admin.ts`. Add IA config validation tests (AC-18). | 1 | T-007 |
| T-005 | In `apps/admin/src/config/ia/sidebars.ts` (`comercialSidebar`): set `onMissing: 'hide'` on the billing items (sweep), and re-gate `billing-cron` + `billing-settings` from `['ACCESS_PANEL_ADMIN']` to `['BILLING_READ_ALL']`. (Strictly required per §5.6, not defense-in-depth.) | 3 | T-007 |

### Phase 3 — Page guards

| # | Task | Complexity | Blocks |
|---|------|:---:|---|
| T-006 | Add a `beforeLoad` permission guard (checking `BILLING_READ_ALL`) to each of the 14 billing route files under `apps/admin/src/routes/_authed/billing/`: `addons.tsx`, `cron.tsx`, `exchange-rates.tsx`, `invoices.tsx`, `metrics.tsx`, `notification-logs.tsx`, `owner-promotions.tsx`, `payments.tsx`, `plans.tsx`, `promo-codes.tsx`, `settings.tsx`, `sponsorships.tsx`, `subscriptions.tsx`, `webhook-events.tsx`. Redirect to the forbidden/dashboard route on missing permission. | 3 | T-007 |

### Phase 4 — Integration + degradation tests

| # | Task | Complexity | Blocks |
|---|------|:---:|---|
| T-007 | **Integration test**: seed an ADMIN actor; call representative admin billing endpoints (one read, one write) + one admin sponsorship `_ANY` endpoint; assert all return **403, not 500** (AC-19, AC-1, AC-2). Assert a SUPER_ADMIN actor gets 200 on the same endpoints (AC-3). | 3 | T-008 |
| T-008 | **Graceful-degradation test**: with an ADMIN session, navigate directly to a `/billing/*` URL; assert the `beforeLoad` guard rejects cleanly and no 500/unhandled error/partial render occurs (AC-8, AC-9). | 2 | — |

**Total tasks**: 8. Average complexity 2.1.

### Dependency order

```
T-001 → T-002 → T-003
T-001 → T-004
T-001 → T-005
T-001 → T-006
T-002 + T-003 + T-004 + T-005 + T-006 → T-007 → T-008
```

## 7. Risks

| Risk | Likelihood | Mitigation |
|------|:---:|---|
| Phantom permissions: shipping with the WRONG names (e.g. non-existent `BILLING_METRICS_VIEW`) silently no-ops the revoke | High (happened in SPEC-155 §3 draft) | T-001 cross-checks all 19 names against `permission.enum.ts`. AC-15/AC-17 tests catch mismatches. |
| Direct-URL leak via the pathname-driven sidebar resolver: ADMIN types `/billing/*`, `comercialSidebar` renders, billing items show greyed-out and `billing-cron`/`billing-settings` show fully (they keep `ACCESS_PANEL_ADMIN`) | High (confirmed in §5.6) | T-005 sets `onMissing: 'hide'` + re-gates the two leaks onto `BILLING_READ_ALL`. T-006 adds `beforeLoad` guards. AC-6/AC-7/AC-8 cover it. |
| Wrong-name revoke of `POST_SPONSOR_MANAGE` instead of `POST_SPONSORSHIP_MANAGE` would break editorial post-sponsor management for ADMIN | Medium | The two are distinct enum members (`post.sponsor.manage` vs `post.sponsorship.manage`). T-002 revokes only `POST_SPONSORSHIP_MANAGE`; AC-13/AC-16 assert `POST_SPONSOR_MANAGE` is retained. |
| **WIDE-scope breakage**: revoking the sponsorship/owner-promotion `_ANY` perms breaks a NON-billing ADMIN workflow | Low | **T-001 verified (go/no-go, engram `spec/spec-164/t001-go-no-go`)**: the 12 `_ANY` perms are consumed ONLY by the `packages/service-core` sponsorship/owner-promotion services backing the `/billing/*` admin pages — no non-billing surface depends on them. The `/sponsors` entity page gates on `POST_SPONSOR_VIEW` (ADMIN already lacks it). **One accepted consequence found** for `POST_SPONSORSHIP_MANAGE`: it gates `edit` (no OR fallback) on the `sponsorshipId` "Patrocinio" field in the editorial post editor (`apps/admin/src/features/posts/config/sections/relations.consolidated.ts:96-114`). After the revoke, ADMIN can still VIEW that field (`POST_VIEW_ALL`) but can no longer assign/edit the post↔sponsorship-contract link. **Owner decision (2026-05-27): accepted under WIDE** — post-sponsorship-contract assignment is a commercial operation, so the field is view-only for ADMIN. The two other `POST_SPONSORSHIP_MANAGE` references (`config/ia/tabs.ts:123`, `lib/menu.ts:236`) OR-combine it with `POST_SPONSOR_MANAGE` (kept) and are unaffected. |
| HOST self-billing regression from over-broad guarding | Low | Two-tier architecture (§5.8, engram #834): revoke touches only the admin tier. Scope explicitly forbids adding `BILLING_READ_ALL` guards to protected-tier surfaces. |
| SUPER_ADMIN regression: seed mistake removes the 19 from SUPER_ADMIN | Low | AC-17 asserts SUPER_ADMIN seed retains them; the `actor.ts` runtime bypass is a second safety net. |
| 14-file `beforeLoad` churn collides with SPEC-155 frontend work | Low | SPEC-155 does not edit the billing route files; T-006 is additive per file. |

## 8. Resolved decisions

These were open questions in the DRAFT; both are now resolved and must NOT be re-opened.

### RD-1 — Scope of the revoke = **WIDE** (OQ-1 resolved)

**Decision**: revoke the full set of **19** permissions (billing-six + 6 sponsorship `_ANY` + 6 owner-promotion `_ANY` + `POST_SPONSORSHIP_MANAGE`).

**Rationale**: "billing is SUPER_ADMIN-only" includes sponsorship and owner-promotion platform-wide management, which are commercial/financial operations belonging to the Comercial surface. The revoke is API-surface closure (§5.4) and is verified non-breaking for non-billing ADMIN workflows (§7 WIDE-scope risk, T-001). `POST_SPONSOR_MANAGE` (editorial post-sponsor management, distinct permission) is explicitly **retained**.

### RD-2 — Page guard strategy = **Option B (explicit `beforeLoad`)** (OQ-2 resolved)

**Decision**: add an explicit `beforeLoad` permission guard (checking `BILLING_READ_ALL`) to each of the 14 billing route files.

**Rationale**: because the sidebar resolver is pathname-driven and role-agnostic on direct navigation (§5.6), nav-hide alone is insufficient. Option B gives a clean page-render-level rejection (no flicker of API-error states), an explicit signal to future developers, and defense-in-depth on top of the API 403 and the `onMissing: 'hide'` sweep. The cost is 14 small additive edits.

## 9. Dependencies

- **REQUIRED — SPEC-154** (admin-config-driven-ia): the IA config files (`roles/admin.ts`, `sidebars.ts`, `sections.ts`, `schema.ts`) and the section→sidebar resolver hooks (`use-current-section.ts`, `use-current-sidebar.ts`) exist and behave as described because SPEC-154 shipped. SPEC-164 edits these files.
- **NO blocking dependency on SPEC-155**: the SPEC-155 billing card is gated independently via dashboard config. The two changes are parallel and should not conflict.
- **Coordination with SPEC-155**: SPEC-155's original task list contained a duplicate "Change 2" revoke (with the wrong permission names). Once SPEC-164 lands, those SPEC-155 tasks are superseded and must be removed from SPEC-155 to avoid a double-revoke / phantom-name revoke.

## 10. References

- `packages/seed/src/required/rolePermissions.seed.ts` — ADMIN array (billing-six in the BILLING comment block; sponsorship `_ANY` + owner-promotion `_ANY` blocks; `POST_SPONSORSHIP_MANAGE` in the "POST Sponsorship management" block; `POST_SPONSOR_MANAGE` retained in the POST block). SUPER_ADMIN array key at the top of the export.
- `packages/schemas/src/enums/permission.enum.ts` — canonical enum; `POST_SPONSOR_MANAGE` = `post.sponsor.manage`, `POST_SPONSORSHIP_MANAGE` = `post.sponsorship.manage` (distinct); `BILLING_METRICS_VIEW` / `SUBSCRIPTION_VIEW_ALL` confirmed ABSENT.
- `apps/api/src/middlewares/actor.ts` (`if (userRole === RoleEnum.SUPER_ADMIN)` → `permissions: Object.values(PermissionEnum)`) — SUPER_ADMIN runtime bypass.
- `apps/api/src/middlewares/billing-admin-guard.middleware.ts` — protected-tier guard (`ACCESS_API_ADMIN`); not changed.
- `apps/admin/src/config/ia/roles/admin.ts` — `adminRole.mainMenu` and `adminRole.mobile.bottomNav` both list `'comercial'`.
- `apps/admin/src/config/ia/sections.ts` — `comercial` section (`route: '/billing/plans'`, `sidebar: 'comercialSidebar'`), defined globally.
- `apps/admin/src/config/ia/sidebars.ts` — `comercialSidebar`; `billing-cron` (`ops-billing` group) and `billing-settings` (top-level link) both gate on `['ACCESS_PANEL_ADMIN']`.
- `apps/admin/src/config/ia/schema.ts` — `OnMissingSchema` with `.default('disable')`; `PermissionGateSchema` is OR-logic.
- `apps/admin/src/hooks/use-current-section.ts` + `use-current-sidebar.ts` — pathname-driven sidebar resolution with NO `mainMenu` filtering (the renderer-wiring finding, §5.6).
- `apps/admin/src/components/layout/main-menu/MainMenu.tsx` — the only consumer of `roleConfig.mainMenu`.
- `apps/admin/src/components/layout/sidebar/{Sidebar,SidebarGroup,SidebarItem}.tsx` — apply the per-item permission gate + `onMissing` behavior.
- `apps/admin/src/routes/_authed/billing/*.tsx` (14 files) — billing route files; today none has a `beforeLoad` permission guard.
- `packages/service-core/src/services/sponsorship/*`, `.../owner-promotion/*` — sole consumers of the revoked `_ANY` perms.
- Engram: `spec/spec-164/billing-tier-architecture` (#834), `spec/spec-164/corrected-blast-radius` (#839), `spec/spec-164/renderer-wiring-and-wide-safety`.
- `.claude/specs/SPEC-155-admin-dashboards-v1/spec.md` — original "Change 2" with the incorrect names; references SPEC-164 as the receiver.
