---
specId: SPEC-164
title: Admin Billing Access — SUPER_ADMIN-Only
status: draft
complexity: medium-high
owner: qazuor
created: 2026-05-27
revised: 2026-05-27
parent: (none)
related:
  - SPEC-155 (admin-dashboards-v1 — origin of this extraction via T-002 blast-radius audit)
  - SPEC-143 (billing-testing-coverage — billing admin surface smoke coverage)
  - SPEC-145 (billing-entitlements-and-limits-enforcement — entitlement gating at API layer)
---

# SPEC-164 — Admin Billing Access — SUPER_ADMIN-Only

> **Status**: DRAFT — extracted from SPEC-155 T-002 blast-radius audit, 2026-05-27.

## 1. Origin

SPEC-155 (Admin Dashboards V1) originally included "Change 2 — REVOKE from ADMIN" in its permission changes section. That change was described as revoking `BILLING_METRICS_VIEW` and `SUBSCRIPTION_VIEW_ALL` from the ADMIN role. During SPEC-155 planning, the T-002 blast-radius audit was commissioned to determine whether this revoke was safe.

The audit revealed two critical findings that changed the scope of the work:

1. **The named permissions do not exist.** `BILLING_METRICS_VIEW` and `SUBSCRIPTION_VIEW_ALL` are not defined in `packages/schemas/src/enums/permission.enum.ts`. The actual ADMIN billing permissions are six distinct entries with different names (see §5).

2. **The blast radius is wider than anticipated.** Removing all six real billing permissions from ADMIN touches not just the permission seed, but also the SPEC-154 IA config (`roles/admin.ts`, `sidebars.ts`), the 14 admin billing route files, and several sidebar items that gate on permissions not part of the billing-six but that live in the same `comercialSidebar` (sponsorships, promotions, payments, invoices, exchange rates).

Because of this blast radius, and because the role-model change is entirely orthogonal to the widget-rendering work in SPEC-155, the change was extracted into this dedicated spec. SPEC-155 now references SPEC-164 as the receiver of this work; SPEC-155 §2 explicitly states "the revoke belongs to SPEC-164".

## 2. Goal

Make the admin panel's billing surface SUPER_ADMIN-only by:

- Removing the six real billing permissions from the ADMIN role seed.
- Updating the SPEC-154 IA config so ADMIN no longer sees the "Comercial" section in the nav — with no dead links, no disabled-but-visible items, and no 403-producing pages.
- Ensuring billing-settings and billing-cron (which currently gate on `ACCESS_PANEL_ADMIN` rather than a billing permission) are re-gated to a billing permission so the removal is complete.
- Resolving an explicit open question about sponsorships and promotions before shipping the seed change.

SUPER_ADMIN retains full billing access automatically via the `actor.ts` runtime bypass (line 157: `permissions: Object.values(PermissionEnum)`) and requires no separate change.

## 3. Scope

### IN — what this spec covers

- **Seed change**: remove all six billing permissions from the `[RoleEnum.ADMIN]` array in `packages/seed/src/required/rolePermissions.seed.ts`.
- **IA config — role file**: remove `'comercial'` from ADMIN's `mainMenu` and `mobile.bottomNav` arrays in `apps/admin/src/config/ia/roles/admin.ts`.
- **IA config — sidebar**: update `apps/admin/src/config/ia/sidebars.ts`:
  - Set `onMissing: 'hide'` (or equivalent) on all items inside `comercialSidebar` that gate on billing permissions, so they disappear entirely when the permission is absent rather than rendering as a broken or disabled state.
  - Re-gate `billing-cron` (currently `['ACCESS_PANEL_ADMIN']`) onto a billing permission (`BILLING_READ_ALL` is the natural choice as the base gate for the whole billing tier).
  - Re-gate `billing-settings` (currently `['ACCESS_PANEL_ADMIN']`) onto the same billing permission.
- **Page-guard decision (explicit)**: decide — per open question in §8 — whether the 14 billing route files under `apps/admin/src/routes/_authed/billing/*.tsx` each receive an explicit `beforeLoad` permission guard, or whether the combined effect of (a) the IA config removing the nav link and (b) the API returning 403 on all billing calls constitutes sufficient protection. This decision is a required input before implementation starts; the spec documents both options and their tradeoffs in §5.
- **Leak closure**: verify and close the `billing-cron` and `billing-settings` accessibility leak described above.
- **Tests**: seed tests asserting ADMIN lacks all six billing permissions and SUPER_ADMIN retains them (via seed presence — the runtime bypass is separately covered by existing `actor.ts` tests); IA config validation tests asserting `comercial` is absent from ADMIN's menu entries; a graceful-degradation test confirming no 500s or unhandled errors when an ADMIN session navigates to any billing URL directly.

### OUT — explicit exclusions

- **Dashboard widget visibility** — the SUPER_ADMIN-only dashboard card (card I, "Estadísticas de billing") is gated in SPEC-155 via `onMissing: 'hide'` in the dashboard config. SPEC-164 does not touch dashboard configs.
- **SPEC-155 dashboard implementation** — any widget, renderer, source resolver, or aggregation route defined in SPEC-155 is out of scope here.
- **Non-billing sections** — this spec does not alter permissions for catalog, editorial, community, platform, or analysis sections.
- **API-level billing route changes** — the `billing-admin-guard.middleware.ts` (which gates on `ACCESS_API_ADMIN`, not on the billing-six) is not changed. The API-level gate for qzpay-hono write operations remains role-based as documented. This spec only changes which seed permissions ADMIN holds.
- **SUPER_ADMIN permission changes** — SUPER_ADMIN already receives `Object.values(PermissionEnum)` at runtime via `apps/api/src/middlewares/actor.ts`; no seed or middleware change is needed for SUPER.
- **Sponsorships and promotions permissions** — ADMIN currently holds `SPONSORSHIP_VIEW_ANY`, `SPONSORSHIP_UPDATE_ANY`, and related `_ANY` permissions, as well as `OWNER_PROMOTION_VIEW_ANY` and related. Whether these are "billing" in the sense of this spec is an open question (see §8). They are out of scope until the owner decides.
- **New sidebar sections or redesign** — the `comercialSidebar` content itself is not redesigned; only ADMIN's access to it is removed.

### Future considerations

- If sponsorships/promotions are decided in-scope (§8), their `_ANY` permission entries for ADMIN must be added to the seed change task in this spec before shipping.
- The `billing-admin-guard.middleware.ts` gating model (role-check vs. permission-check) is an existing inconsistency worth a future cleanup spec, but is not unblocked by SPEC-164.

## 4. Acceptance criteria

### A. API-level gating

- AC-1: Given a user with role ADMIN (not SUPER_ADMIN). When they send any authenticated request to any route under `/api/v1/admin/billing/*` or `/api/v1/protected/billing/*` that requires a billing permission. Then the API returns 403 and no billing data is returned.
- AC-2: Given a user with role ADMIN. When they send a GET request to `/api/v1/protected/billing/plans`. Then the response is 403 (plans require `PRICING_PLAN_VIEW`, which ADMIN retains... or does not — this is conditional on the open question about non-billing-six permissions; see §8. For the core billing-six only: plans currently use `PRICING_PLAN_VIEW` which is NOT in the billing-six, so this must be verified in the blast-radius task before the seed lands).
- AC-3: Given a user with role SUPER_ADMIN. When they access any billing API route. Then the response is 200 and data loads correctly.

### B. Navigation — no dead links, no broken states

- AC-4: Given a user with role ADMIN. When the admin panel sidebar renders. Then no "Comercial" section appears in the main navigation or the mobile bottom nav.
- AC-5: Given a user with role ADMIN. When the admin panel renders any page. Then no billing-related nav item (plans, subscriptions, add-ons, metrics, payments, invoices, promo codes, owner promotions, sponsorships, exchange rates, webhook events, billing cron, billing settings) appears in the sidebar.
- AC-6: Given a user with role SUPER_ADMIN. When the admin panel renders. Then the full "Comercial" section with all billing sub-items appears correctly.

### C. Billing-cron and billing-settings leak closed

- AC-7: Given a user with role ADMIN (after the re-gating change). When the sidebar is rendered. Then the `billing-cron` and `billing-settings` items are hidden (not merely disabled) — they currently show for any user with `ACCESS_PANEL_ADMIN`, which ADMIN retains.
- AC-8: Given a user with role ADMIN. When they navigate directly to `/billing/cron` or `/billing/settings` via URL. Then either (a) the page renders an explicit 403/unauthorized state, or (b) `beforeLoad` redirects them away — the exact behavior is the page-guard decision (§8 open question).

### D. No 500s or unhandled errors

- AC-9: Given a user with role ADMIN. When they navigate directly to any URL under `/billing/*` (via address bar bypass). Then the page renders a clean error state (403 / "no access") rather than throwing an unhandled exception, rendering partial data, or showing a broken layout.
- AC-10: Given a user with role ADMIN. When the dashboard page loads. Then no billing data requests are made (no wasted API calls that will 403).

### E. SUPER_ADMIN retention

- AC-11: Given a user with role SUPER_ADMIN. When they view the admin dashboard. Then the billing statistics card (SPEC-155 card I) is visible and loads data correctly.
- AC-12: Given a user with role SUPER_ADMIN. When they access any admin billing page. Then full read and write access is available (no regressions from the ADMIN revoke).

### F. Tests

- AC-13: A vitest test asserts that `ROLE_PERMISSIONS[RoleEnum.ADMIN]` does NOT include `BILLING_READ_ALL`, `BILLING_MANAGE`, `MANAGE_SUBSCRIPTIONS`, `BILLING_PROMO_CODE_READ`, `BILLING_PROMO_CODE_MANAGE`, or `BILLING_METRICS_READ`.
- AC-14: A vitest test asserts that `ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN]` includes all six of the above permissions (the seed list, not the runtime bypass).
- AC-15: A vitest test asserts that the ADMIN role config (`adminRole.mainMenu`) does NOT contain `'comercial'` and that `adminRole.mobile.bottomNav` does NOT contain `'comercial'`.
- AC-16: An integration test confirms that a seeded ADMIN actor calling any billing admin API route receives 403, not 500.

## 5. Technical approach

### The six real billing permissions

These are the permissions that must be removed from `[RoleEnum.ADMIN]` in `rolePermissions.seed.ts`. They are confirmed present in `packages/schemas/src/enums/permission.enum.ts` and in the ADMIN array at lines 529-534 of the seed file:

| Permission enum value | String value | What it gates |
|---|---|---|
| `BILLING_READ_ALL` | `billing.readAll` | Base gate for the entire billing API tier; webhook events, usage, notifications |
| `BILLING_MANAGE` | `billing.manage` | Write ops: expire, activate add-ons, etc. |
| `MANAGE_SUBSCRIPTIONS` | `subscription.manage` | Full subscription management (cancel, change-plan, force-cancel, extend-trial) |
| `BILLING_PROMO_CODE_READ` | `billing.promoCode.read` | View promo codes |
| `BILLING_PROMO_CODE_MANAGE` | `billing.promoCode.manage` | Create / update / delete promo codes |
| `BILLING_METRICS_READ` | `billing.metrics.read` | View billing metrics and analytics |

> **Critical finding from T-002 audit**: The permissions `BILLING_METRICS_VIEW` and `SUBSCRIPTION_VIEW_ALL` referenced in SPEC-155's original "Change 2" section DO NOT EXIST in `packages/schemas/src/enums/permission.enum.ts`. If a task had shipped the seed change using those names, the removal would have silently done nothing — ADMIN would have retained full billing access. This spec uses the correct names above.

### SUPER_ADMIN bypass — why no SUPER change is needed

`apps/api/src/middlewares/actor.ts` line 153-162: when the authenticated user's role is `RoleEnum.SUPER_ADMIN`, the actor is built with `permissions: Object.values(PermissionEnum)` — every permission in the enum, regardless of what the seed table contains. The seed still lists the billing-six for SUPER_ADMIN for documentation clarity, but the runtime behavior is unconditional. Revoking from ADMIN does not affect SUPER_ADMIN in any way.

### IA config changes

Three touch points in the SPEC-154 config:

1. **`apps/admin/src/config/ia/roles/admin.ts`** — `mainMenu` currently lists `'comercial'` at index 4. `mobile.bottomNav` also lists `'comercial'`. Both must be removed. This makes "Comercial" invisible to ADMIN without touching the section definition itself.

2. **`apps/admin/src/config/ia/sidebars.ts` — `comercialSidebar`** — The sidebar currently uses per-item `permissions` arrays that the SPEC-154 renderer uses to show/hide items. After the seed revoke, ADMIN will have none of the billing-six, but the sidebar items use different permission names (`PRICING_PLAN_VIEW`, `SUBSCRIPTION_VIEW`, `PAYMENT_VIEW`, `INVOICE_VIEW`, `DISCOUNT_CODE_VIEW`, `OWNER_PROMOTION_VIEW`, `SPONSORSHIP_VIEW`, `BILLING_METRICS_READ`, `BILLING_READ_ALL`, `EXCHANGE_RATE_VIEW`, `ACCESS_PANEL_ADMIN`). Whether ADMIN retains access to the non-billing-six items in this sidebar (payments, invoices, sponsorships, promotions, exchange rates) depends on the open question in §8. Regardless, the `onMissing` behavior for all items that ADMIN has no permission for must be set to `'hide'` (not `'disabled'`) to prevent dead links.

3. **`billing-cron` and `billing-settings` leak** — both items currently use `permissions: ['ACCESS_PANEL_ADMIN']`. ADMIN has `ACCESS_PANEL_ADMIN` (it is the permission granting access to the admin panel itself). This means even after removing the billing-six, an ADMIN user can still reach `/billing/cron` and `/billing/settings` via the sidebar. These two items must be re-gated onto `BILLING_READ_ALL` (which ADMIN will no longer hold after the seed change).

### Page guard decision (option analysis)

The 14 billing route files under `apps/admin/src/routes/_authed/billing/*.tsx` currently have **no `beforeLoad` permission check** (confirmed: zero matches for `beforeLoad`, `RoutePermissionGuard`, `hasPermission`, or `checkPermission` in those files). The question is whether to add explicit guards.

**Option A — No page-level guards (rely on IA config + API 403)**
- The nav link is hidden by IA config, so ADMIN cannot reach billing pages via navigation.
- If ADMIN types the URL directly, the page renders and fires API calls; those calls return 403; the page shows the API error state.
- Pro: no code change to 14 route files; simpler.
- Con: a direct URL visit results in a degraded but visible page shell with API errors. For a security-conscious product this may be acceptable (no data is leaked — the API guards the data), but it is not a clean UX.
- Con: any future addition of a billing nav link that bypasses the IA config (e.g., a widget with a hardcoded link) would silently expose the page.

**Option B — Add `beforeLoad` permission guard to each billing page**
- Each route file gets a `beforeLoad` that checks for `BILLING_READ_ALL` (or a more specific permission) and redirects to a 403 page or the dashboard.
- Pro: defense in depth; clean UX (no flickering API errors); explicit signal to future developers.
- Con: touches 14 files; each file becomes slightly larger.
- Con: must be kept in sync if billing permissions change.

**Recommendation** (owner to decide via §8 open question): Option B is the cleaner and more defensible choice. The cost is 14 small file edits. The benefit is that the billing surface is properly guarded at the page-render level, not just at the nav-hide level. If the owner prefers Option A for speed, AC-9 still passes (clean error state, not 500).

## 6. Task breakdown (atomic, complexity ≤ 4)

Grouped by phase. The seed change (T-003) is hard-gated by the blast-radius verification (T-001) and the sponsorship decision (OQ-1 from §8). The IA config changes (T-002, T-004) can proceed in parallel once the sponsorship decision is resolved. Page guards (T-005) can proceed once the decision from §8 OQ-2 is made.

### Phase 0 — Pre-conditions (blockers)

| # | Task | Complexity | Blocks |
|---|------|:---:|---|
| T-001 | **Full blast-radius verification**: enumerate every admin billing sidebar item and its `permissions` array; cross-check each against `permission.enum.ts` and the current ADMIN seed array. Confirm which sidebar items become inaccessible from the billing-six revoke alone vs. which remain accessible because they gate on non-billing-six permissions (e.g., `PRICING_PLAN_VIEW`, `PAYMENT_VIEW`, `INVOICE_VIEW`). Produce a written list: "items hidden after revoke" vs. "items still visible — need sponsorship decision". This finding is the input to T-002, T-003, T-004. | 2 | T-002, T-003, T-004, T-005 |

### Phase 1 — IA config changes

| # | Task | Complexity | Blocks |
|---|------|:---:|---|
| T-002 | Remove `'comercial'` from `mainMenu` and `mobile.bottomNav` in `apps/admin/src/config/ia/roles/admin.ts`. Add IA config tests (AC-15). | 1 | T-007 |
| T-003 | Re-gate `billing-cron` and `billing-settings` in `apps/admin/src/config/ia/sidebars.ts` from `['ACCESS_PANEL_ADMIN']` to `['BILLING_READ_ALL']`. Confirm `onMissing: 'hide'` behavior applies to all billing sidebar items for users without billing permissions. | 2 | T-007 |
| T-004 | Audit remaining `comercialSidebar` items (payments, invoices, sponsorships, promotions, exchange rates): for each item that ADMIN will lose access to after the revoke (from T-001 list), verify `onMissing: 'hide'` is set. For items that ADMIN retains (e.g., `EXCHANGE_RATE_VIEW` if ADMIN keeps that), note them explicitly so the owner is aware. | 2 | — |

### Phase 2 — Seed change

| # | Task | Complexity | Blocks |
|---|------|:---:|---|
| T-005 | **Seed change** (BLOCKED by T-001, and by sponsorship decision if owner scopes them in): remove `BILLING_READ_ALL`, `BILLING_MANAGE`, `MANAGE_SUBSCRIPTIONS`, `BILLING_PROMO_CODE_READ`, `BILLING_PROMO_CODE_MANAGE`, `BILLING_METRICS_READ` from `[RoleEnum.ADMIN]` in `packages/seed/src/required/rolePermissions.seed.ts`. | 1 | T-006, T-007 |
| T-006 | Seed tests: add vitest assertions for AC-13 and AC-14 (ADMIN does not hold billing-six; SUPER_ADMIN seed still lists them). Run seed tests green before merging. | 2 | T-008 |

### Phase 3 — Page guards (conditional on §8 OQ-2 decision)

| # | Task | Complexity | Blocks |
|---|------|:---:|---|
| T-007 | If owner chooses **Option B**: add `beforeLoad` permission guard (checking `BILLING_READ_ALL`) to each of the 14 billing route files: `addons.tsx`, `cron.tsx`, `exchange-rates.tsx`, `invoices.tsx`, `metrics.tsx`, `notification-logs.tsx`, `owner-promotions.tsx`, `payments.tsx`, `plans.tsx`, `promo-codes.tsx`, `settings.tsx`, `sponsorships.tsx`, `subscriptions.tsx`, `webhook-events.tsx`. | 3 | T-008 |

### Phase 4 — Integration tests and verification

| # | Task | Complexity | Blocks |
|---|------|:---:|---|
| T-008 | Integration test: seed an ADMIN actor; call representative billing API endpoints (one read, one write); assert all return 403 (AC-16). Also test SUPER_ADMIN actor gets 200 on same endpoints. | 3 | — |
| T-009 | Graceful-degradation test: in a test environment with an ADMIN session, navigate directly to `/billing/plans` via URL; assert the page renders a clean error state (not a 500 or unhandled exception) — satisfies AC-9. | 2 | — |

**Total tasks**: 9. Average complexity 2.1.

### Dependency order

```
T-001 → T-002
T-001 → T-003
T-001 → T-004
T-001 → T-005 (also blocked by OQ-1 decision)
T-005 → T-006
T-002 + T-003 → T-007 (if Option B chosen)
T-006 + T-007 → T-008
T-007 → T-009
```

## 7. Risks

| Risk | Likelihood | Mitigation |
|------|:---:|---|
| Phantom permissions: shipping the seed change with the WRONG permission names (e.g., the non-existent `BILLING_METRICS_VIEW`) would silently leave ADMIN with full billing access — the revoke does nothing | High (this already happened in SPEC-155 §3 original draft) | T-001 explicitly cross-checks every permission name against `permission.enum.ts`. AC-13/AC-14 tests catch mismatches at the data layer. |
| Partial revoke: removing the billing-six but leaving `billing-cron` and `billing-settings` reachable via `ACCESS_PANEL_ADMIN` | High (confirmed leak in current code) | T-003 explicitly re-gates these two items before the seed change ships. AC-7/AC-8 acceptance criteria cover the leak. |
| IA config hiding insufficient: nav items disappear, but a widget or hardcoded link elsewhere still points to a billing page, leaving an ADMIN user in a broken state | Medium | T-004 audits all `comercialSidebar` items for `onMissing` behavior. T-007 (Option B) adds page-level guards as defense in depth. |
| Sidebar items with non-billing-six permissions (payments, invoices, exchange rates, sponsorships) remain visible to ADMIN after the revoke, creating an inconsistent "billing section minus billing" experience | Medium | T-004 documents exactly which items remain; owner decides scope (§8 OQ-1) before shipping. Worst case: some sponsorship/payment items stay visible to ADMIN until a follow-up spec. |
| SUPER_ADMIN regression: a mistake in the seed file accidentally removes billing-six from SUPER_ADMIN | Low | AC-14 test asserts SUPER_ADMIN seed still lists all six. Runtime bypass via `actor.ts` is a second safety net. |
| 14-file page guard churn: if Option B is chosen, 14 files change simultaneously — high PR surface, potential merge conflicts with SPEC-155 frontend work | Low-Medium | T-007 is a pure additive change per file (only `beforeLoad` additions); conflict probability with SPEC-155 is low since SPEC-155 does not modify those route files. |

## 8. Open questions

These questions must be resolved by the owner BEFORE any implementation starts. They gate T-001/T-005 directly.

### OQ-1 — Sponsorships and promotions scope

**Question**: Does "billing is SUPER_ADMIN-only" include the sponsorship and promotion management pages, or only the core billing tier (subscriptions, plans, add-ons, metrics, promo codes, billing ops)?

Current ADMIN seed contains:
- `SPONSORSHIP_VIEW_ANY`, `SPONSORSHIP_UPDATE_ANY`, `SPONSORSHIP_SOFT_DELETE_ANY`, `SPONSORSHIP_HARD_DELETE_ANY`, `SPONSORSHIP_RESTORE_ANY`, `SPONSORSHIP_UPDATE_VISIBILITY_ANY`
- `OWNER_PROMOTION_VIEW_ANY`, `OWNER_PROMOTION_UPDATE_ANY`, `OWNER_PROMOTION_SOFT_DELETE_ANY`, `OWNER_PROMOTION_HARD_DELETE_ANY`, `OWNER_PROMOTION_RESTORE_ANY`, `OWNER_PROMOTION_UPDATE_VISIBILITY_ANY`
- `POST_SPONSORSHIP_MANAGE`

These permissions gate the `/billing/sponsorships`, `/billing/owner-promotions`, and the `sponsors` entity page (which is at `/sponsors`, not under `/billing`). They are in the same sidebar section (`comercialSidebar`) but are arguably content-management operations rather than financial billing operations.

**Options**:
1. Narrow scope: revoke only the billing-six. Sponsorships and promotions remain ADMIN-accessible. The "Comercial" section nav link is hidden for ADMIN, but ADMIN can still reach `/billing/sponsorships` etc. via direct URL — which may be intentional if ADMIN needs to manage these.
2. Wide scope: revoke all billing + sponsorship/promotion `_ANY` permissions from ADMIN. Full "Comercial" removal.
3. Hybrid: revoke billing-six, but also review whether ADMIN should retain `EXCHANGE_RATE_VIEW` (used in the exchange-rates page which is part of billing ops but functionally closer to platform config).

**Impact on T-005**: if Option 2 or 3, additional permission entries must be added to the seed revoke in T-005.

### OQ-2 — Page guard strategy

**Question**: Should the 14 billing route files receive explicit `beforeLoad` permission guards (Option B), or is nav-hiding + API 403 sufficient (Option A)?

See §5 "Page guard decision" for full option analysis and tradeoffs.

**Recommendation**: Option B. But the owner may prefer Option A to keep this spec's scope minimal and accept that a direct URL visit shows an error state rather than a redirect.

## 9. Dependencies

- **REQUIRED — SPEC-154** (admin-config-driven-ia): the IA config files (`roles/admin.ts`, `sidebars.ts`) exist and function as described because SPEC-154 shipped. SPEC-164 modifies these files and depends on SPEC-154 being in production.
- **NO dependency on SPEC-155**: the dashboard widget gating for billing card I (SPEC-155 §4 AC-4) is handled by SPEC-155 independently via `onMissing: 'hide'` on the dashboard config. SPEC-164 does not need to wait for SPEC-155, nor does SPEC-155 need to wait for SPEC-164 — they are parallel changes that should not conflict.
- **Coordination point with SPEC-155**: the seed change in T-005 of this spec removes the billing-six from ADMIN. SPEC-155 T-015 and T-016 in the original task breakdown were the dashboard-spec's versions of the same change. Once SPEC-164 lands, SPEC-155 T-015 and T-016 are superseded by this spec and must be removed from SPEC-155's task list to avoid double-revoke.

## 10. References

- `packages/seed/src/required/rolePermissions.seed.ts` — ADMIN billing-six permissions at lines 522-534; SUPER_ADMIN section starts at line 12.
- `packages/schemas/src/enums/permission.enum.ts` — canonical permission enum; the billing-six confirmed present; `BILLING_METRICS_VIEW` and `SUBSCRIPTION_VIEW_ALL` confirmed ABSENT.
- `apps/api/src/middlewares/actor.ts` lines 152-162 — SUPER_ADMIN runtime bypass (`Object.values(PermissionEnum)`).
- `apps/api/src/middlewares/billing-admin-guard.middleware.ts` — write-op guard for qzpay-hono routes; gates on `ACCESS_API_ADMIN`, NOT on the billing-six. Not changed by this spec.
- `apps/admin/src/config/ia/roles/admin.ts` — ADMIN role config; `'comercial'` at index 4 of `mainMenu` and `mobile.bottomNav`.
- `apps/admin/src/config/ia/sidebars.ts` lines ~427-626 — `comercialSidebar` definition; `billing-cron` and `billing-settings` with `ACCESS_PANEL_ADMIN` leak at lines ~608 and ~623.
- `apps/admin/src/config/ia/dashboards.ts` — references `BILLING_READ_ALL` for the SUPER-only billing card gate; confirms the permission name in use.
- `apps/admin/src/routes/_authed/billing/*.tsx` (14 files) — billing route files confirmed to have no `beforeLoad` permission guards.
- `.claude/specs/SPEC-155-admin-dashboards-v1/spec.md` §3 — original "Change 2" with the incorrect permission names; §2 — states "the revoke belongs to SPEC-164".
- `.claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md` — ADMIN-Q2 open question that originally surfaced the blast radius concern.
