# SPEC-164: Admin Billing Access — SUPER_ADMIN-Only

## Progress: 8/8 tasks (100%) — implementation complete, pending PR + staging smoke

**Average Complexity:** 2.1/4 (max)
**Critical Path:** T-001 -> T-002 -> T-003 -> T-007 -> T-008 (5 steps)
**Parallel Tracks:** 4 identified (after T-001: the T-002/T-003 seed track, T-004, T-005, T-006 run in parallel)

---

### Setup Phase

- [x] **T-001** (complexity: 2) - Blast-radius + safety verification (read-only go/no-go) ✓ DONE
  - GO on all 19. 20 perm names confirmed; POST_SPONSOR_MANAGE (kept) ≠ POST_SPONSORSHIP_MANAGE (revoked); renderer-wiring re-confirmed. One accepted consequence: post-editor 'Patrocinio' field becomes view-only for ADMIN (owner-approved under WIDE).
  - Blocked by: none
  - Blocks: T-002, T-004, T-005, T-006

### Core Phase

- [x] **T-002** (complexity: 1) - Seed revoke — remove 19 perms from ADMIN ✓ DONE
  - 19 removed (verified via direct read: ADMIN block 300-529 has none of the 19; keeps POST_SPONSOR_MANAGE L392 + ACCESS_PANEL_ADMIN L460). SUPER retains 19. Not committed yet.
  - Blocked by: T-001
  - Blocks: T-003, T-007

- [x] **T-004** (complexity: 1) - Remove 'comercial' from ADMIN mainMenu + bottomNav (+ IA tests) ✓ DONE
  - 'comercial' out of both arrays (now 6 sections each). 6 assertions pass (admin-role.config.test.ts). Not committed yet.
  - Blocked by: T-001
  - Blocks: T-007

- [x] **T-005** (complexity: 3) - onMissing:'hide' sweep + re-gate billing-cron/billing-settings ✓ DONE
  - 19 comercialSidebar items got onMissing:'hide' (5 groups + 13 group-links + billing-settings). billing-cron + billing-settings re-gated ACCESS_PANEL_ADMIN -> BILLING_READ_ALL (verified L621/L633). 6 assertions pass (comercial-sidebar.config.test.ts). Not committed yet.
  - Blocked by: T-001
  - Blocks: T-007

### Integration Phase

- [x] **T-006** (complexity: 3) - beforeLoad BILLING_READ_ALL guard on the 14 billing route files ✓ DONE
  - Shared helper lib/billing-access.ts (requireBillingAccess → redirect /auth/forbidden). All 14 routes guarded. 7 unit tests pass. Not committed yet.
  - Blocked by: T-001
  - Blocks: T-007

### Testing Phase

- [x] **T-003** (complexity: 2) - Seed tests — ADMIN revoke + retained + SUPER retention ✓ DONE
  - 45 tests pass (packages/seed/test/required/rolePermissions.seed.test.ts). AC-15/16/17 covered.
  - Blocked by: T-002
  - Blocks: T-007

- [x] **T-007** (complexity: 3) - Integration test — ADMIN 403-not-500 / SUPER 200 ✓ DONE
  - 8/8 pass (apps/api/test/e2e/flows/billing/spec-164-admin-billing-authz.test.ts). ADMIN→403 on metrics/plans/promo-codes/sponsorships; SUPER→200/not-403. (qzpay promo-code write 500 is a pre-existing schema-strip quirk; auth gate verified.)
  - Blocked by: T-002, T-003, T-004, T-005, T-006
  - Blocks: T-008

- [x] **T-008** (complexity: 2) - Graceful-degradation test — ADMIN direct-URL clean rejection ✓ DONE
  - Approach (b): +7 assertions in billing-access.test.ts (14 pass). AC-8 (redirect before render) + AC-9 (thrown value is a redirect, not an Error → no 500). Full in-browser direct-URL degradation deferred to manual/staging smoke.
  - Blocked by: T-007
  - Blocks: none

---

## Dependency Graph

Level 0: T-001
Level 1: T-002, T-004, T-005, T-006
Level 2: T-003
Level 3: T-007
Level 4: T-008

## Suggested Start

Begin with **T-001** (complexity: 2) — no dependencies, unblocks T-002/T-004/T-005/T-006. It is read-only (verification + go/no-go), so it is safe to run before any code change and re-confirms the renderer-wiring + WIDE-scope safety before the seed revoke lands.
