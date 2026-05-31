# SPEC-168: Admin Plan Management — runtime-editable plans on the DB

## Progress: 0/23 tasks (0%)

**Average Complexity:** 3.1/4 (max)
**Critical Path:** T-001 → T-003 → T-011 → T-016 → T-017 → T-020 (6 steps)
**Parallel Tracks:** 3 roots (T-001 schemas, T-002 audit helper, T-021 bugfix — all dependency-free)

> Decisions locked (D1–D4): mutate by **UUID** (`billing_plans.id`); slug **immutable** after create; permissions reuse **`BILLING_READ_ALL`/`BILLING_MANAGE`** (super-only, SPEC-164); web → **`/public/plans` + Cloudflare purge**; soft-delete default, hard-delete guarded by no-references.

---

### Setup Phase

- [ ] **T-001** (complexity: 3) — Add plan CRUD Zod schemas as SSOT in @repo/schemas
  - Response/Create/Update/Search mirroring qzpay row + billing_prices. id=UUID, slug write-once.
  - Blocked by: none — Blocks: T-003, T-004, T-005, T-006, T-007, T-018

- [ ] **T-002** (complexity: 2) — Add plan-mutation audit event + before/after diff helper
  - Reuse AuditEventType.BILLING_*; field-level plan diff helper.
  - Blocked by: none — Blocks: T-004, T-005, T-006, T-007

### Core Phase (service-core PlanService over qzpay storage adapter)

- [ ] **T-003** (complexity: 3) — PlanService read (list + getById), row→Response mapping
  - Blocked by: T-001 — Blocks: T-008, T-011

- [ ] **T-004** (complexity: 4) — PlanService create (plan row + billing_prices + audit, in tx)
  - Blocked by: T-001, T-002 — Blocks: T-009

- [ ] **T-005** (complexity: 4) — PlanService update (incl. billing_prices, slug immutable)
  - Blocked by: T-001, T-002 — Blocks: T-009

- [ ] **T-006** (complexity: 3) — PlanService toggleActive + soft-delete
  - Blocked by: T-001, T-002 — Blocks: T-010

- [ ] **T-007** (complexity: 4) — PlanService hard-delete with referential guard (subs WHERE plan_id=uuid)
  - Blocked by: T-001, T-002 — Blocks: T-010

### Integration Phase (API · admin front · web · seed)

- [ ] **T-008** (complexity: 4) — API: rewrite admin read endpoints to DB/service (+502 regression, BILLING_READ_ALL)
  - Blocked by: T-003 — Blocks: T-012, T-023

- [ ] **T-009** (complexity: 4) — API: create/update endpoints (POST /, PUT /:id, BILLING_MANAGE, rate limit, audit)
  - Blocked by: T-004, T-005 — Blocks: T-013, T-017, T-019, T-022, T-023

- [ ] **T-010** (complexity: 4) — API: lifecycle endpoints (toggle, soft-delete, restore, hard-delete guard)
  - Blocked by: T-006, T-007 — Blocks: T-013, T-020, T-022, T-023

- [ ] **T-011** (complexity: 3) — API: switch public /plans to DB/service source
  - Blocked by: T-003 — Blocks: T-016, T-019

- [ ] **T-012** (complexity: 3) — Admin: fix transformPlanRecord/types to DB shape (kill 502)
  - Blocked by: T-008 — Blocks: T-013

- [ ] **T-013** (complexity: 3) — Admin: real plan HTTP adapter + wire mutations
  - Blocked by: T-009, T-010, T-012 — Blocks: T-014, T-015

- [ ] **T-014** (complexity: 3) — Admin: wire PlanDialog to CRUD + restore Create button (slug immutable on edit)
  - Blocked by: T-013 — Blocks: none

- [ ] **T-015** (complexity: 2) — Admin: fix plans page header + i18n copy (es/en/pt)
  - Blocked by: T-013 — Blocks: none

- [ ] **T-016** (complexity: 4) — Web: pricing pages SSG import → runtime /public/plans (SSR + Cache-Control)
  - Blocked by: T-011 — Blocks: T-017, T-020

- [ ] **T-017** (complexity: 3) — Web/API: Cloudflare cache purge on plan save (best-effort)
  - Blocked by: T-009, T-016 — Blocks: T-020

- [ ] **T-018** (complexity: 3) — Seed: harden idempotency so re-seed never clobbers runtime edits
  - Blocked by: T-001 — Blocks: none

### Testing Phase

- [ ] **T-019** (complexity: 3) — Integration: admin price edit reflects in /public/plans
  - Blocked by: T-009, T-011 — Blocks: none

- [ ] **T-020** (complexity: 4) — E2E + staging smoke: edit price → web reflects → checkout charges new
  - Blocked by: T-016, T-017, T-010 — Blocks: none

### Cleanup Phase

- [ ] **T-021** (complexity: 2) — Fix latent bug: migrate-addon-purchases.ts resolves plan by slug vs UUID
  - Blocked by: none — Blocks: none

### Docs Phase

- [ ] **T-022** (complexity: 2) — Docs: operator guide + billing/db CLAUDE.md updates
  - Blocked by: T-009, T-010 — Blocks: none

- [ ] **T-023** (complexity: 1) — Docs: supersede ADR-020 with SPEC-168
  - Blocked by: T-008, T-009, T-010 — Blocks: none

---

## Dependency Graph (levels)

- Level 0: T-001, T-002, T-021
- Level 1: T-003, T-004, T-005, T-006, T-007, T-018
- Level 2: T-008, T-009, T-010, T-011
- Level 3: T-012, T-016, T-019, T-022, T-023
- Level 4: T-013, T-017
- Level 5: T-014, T-015, T-020

## Suggested Start

Begin with **T-001** (complexity: 3) — schemas SSOT, no dependencies, unblocks 6 tasks and gates the whole core layer. T-002 (audit helper) and T-021 (independent bugfix) can run in parallel.
