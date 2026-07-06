# HOS-67: Social Posts — GPT/MAKE Config Export

## Progress: 0/11 tasks (0%)

**Average Complexity:** 1.9/3 (max)
**Critical Path:** T-005 -> T-007 -> T-008 -> T-011 (4 steps)
**Parallel Tracks:** 2 (cleanup R-6 track and feature G-6 track are independent until PR)

---

### Cleanup Phase (R-6 — dead code removal)

- [ ] **T-001** (complexity: 2) - Remove dead Make.com inbound callback routes and their mounting
  - Delete claim/result/jobs-index route files + unwire in routes/index.ts (L110/585/603-604)
  - Blocked by: none
  - Blocks: T-002

- [ ] **T-002** (complexity: 3) - Remove handleMakeCallbackClaim/Result handlers and their types from dispatch service
  - dispatchTarget keeps its own retry/exhaust; handlers are the dead parallel path. Drags T-047 test blocks + legacy scenarios.
  - Blocked by: T-001
  - Blocks: T-003, T-004

- [ ] **T-003** (complexity: 1) - Remove HOSPEDA_MAKE_INBOUND_KEY from env registry, env schema and .env.example
  - Lives in BOTH env-registry.hospeda.ts and apps/api/src/utils/env-schema.ts. Coolify unset is operator action (AC-4).
  - Blocked by: T-002
  - Blocks: none

- [ ] **T-004** (complexity: 1) - Remove social-make-callback.schema.ts if orphaned after handler deletion
  - Grep exports; delete + de-barrel only if unused by the live path.
  - Blocked by: T-002
  - Blocks: none

### Core Phase (G-6 — endpoint)

- [ ] **T-005** (complexity: 3) - Add GET /api/v1/admin/social/make-webhook-schema endpoint
  - Mirror gpt-action-schema.ts; programmatic JSON Schema of SocialMakePayloadSchema/MakeWebhookResponseSchema; SOCIAL_SETTINGS_MANAGE; never leak the API key.
  - Blocked by: none
  - Blocks: T-006, T-007

- [ ] **T-006** (complexity: 2) - Test make-webhook-schema is generated, not hand-written (AC-1)
  - Auth gate + schema-shape assertion tied to the Zod source + no raw secret.
  - Blocked by: T-005
  - Blocks: none

### Integration Phase (G-6 — admin UI)

- [ ] **T-007** (complexity: 2) - Add admin hook + types to consume make-webhook-schema (and GPT schema fetch)
  - Blocked by: T-005
  - Blocks: T-008

- [ ] **T-008** (complexity: 3) - Build Integration Config Export admin page with GPT + Make panels
  - Two panels, copy-to-clipboard, masked x-make-apikey reveal, @repo/icons only.
  - Blocked by: T-007
  - Blocks: T-009, T-010, T-011

- [ ] **T-009** (complexity: 1) - Add i18n keys for the Integration Config Export page (es/en/pt)
  - Blocked by: T-008
  - Blocks: none

- [ ] **T-010** (complexity: 1) - Register the Integration Config Export route in admin nav
  - Blocked by: T-008
  - Blocks: none

### Testing Phase

- [ ] **T-011** (complexity: 2) - Component tests for the export panels (AC-2)
  - Render + copy-to-clipboard + masked reveal.
  - Blocked by: T-008
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-005
Level 1: T-002, T-006, T-007
Level 2: T-003, T-004, T-008
Level 3: T-009, T-010, T-011

## Suggested Start

Two independent tracks. Recommended: start the **cleanup track** with **T-001**
(R-6 is the base and lands as the first atomic commit), then the **feature track**
from **T-005**. T-001 and T-005 have no dependencies and can even be worked in
parallel.

## Notes

- AC-3 satisfied across T-001+T-002 (routes + handlers + legacy test rework).
- AC-4 code side is T-003; the Coolify unset is an operator step recorded at PR time.
- R-1 (verify no live Make.com scenario hits the dead callback URLs) is a Make.com
  dashboard check before merge — owner action, not a code task.
