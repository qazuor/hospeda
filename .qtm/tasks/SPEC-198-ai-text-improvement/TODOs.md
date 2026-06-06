# SPEC-198: AI Text Improvement (HOST)

## Progress: 4/10 tasks (40%)

**Average Complexity:** 3.3/10
**Critical Path:** T-001 → T-003 → T-004 → T-006 + T-007 → T-008 → T-009 → T-010 (10 steps)
**Parallel Tracks:** 2 (backend chain T-001→T-006, frontend chain T-007→T-010)
**Parent:** SPEC-173 (AI foundation, completed 2026-06-05, PR #1466)
**Branch:** spec/SPEC-198-ai-text-improvement (from staging)
**Worktree:** /home/qazuor/projects/WEBS/hospeda-spec-198-ai-text-improvement

> ⛔ **SS12 Decision Protocol** (SPEC-173 §12): STOP and consult owner on any ambiguity. All 9 owner decisions in spec.md §4 are pre-approved 2026-06-05.
>
> ⚠️ **CRITICAL gotchas**:
>
> - Middleware order: `entitlementMiddleware()` MUST be first in `options.middlewares` (wrong order = 503 on every request).
> - Mid-stream moderation: error event after token events MUST discard accumulated tokens (never expose partial moderation-blocked content).
> - AC-12 audit flag is **SHOULD-only** — do NOT modify `BaseCrudService`; do NOT forward `_aiMeta` to update API.
> - Path is `/api/v1/protected/ai/text-improve` (NOT `/admin/`).

---

### Setup Phase

- [x] **T-001** (complexity: 2) - Schema: AiTextImproveRequestSchema in @repo/schemas
  - AiTextImproveFieldTypeSchema, AI_TEXT_IMPROVE_MAX_LENGTH const, AiTextImproveRequestSchema (strict + superRefine)
  - Files: packages/schemas/src/entities/ai/ai-text-improve.schema.ts, index.ts
  - Blocked by: none
  - Blocks: T-002, T-003

- [x] **T-002** (complexity: 2) - Schema unit tests
  - 13 cases per spec §9.1; enum-resilience (toContain, NEVER toHaveLength)
  - File: packages/schemas/src/entities/ai/**tests**/ai-text-improve.schema.test.ts
  - Blocked by: T-001
  - Blocks: —

- [x] **T-007** (complexity: 2) - i18n keys aiTextImprove.* in es/en/pt
  - 11 error codes × 3 locales + base keys; check-locales gate
  - Files: packages/i18n/src/locales/{es,en,pt}/admin-common.json
  - Blocked by: none
  - Blocks: T-008, T-009

### Core Phase

- [x] **T-003** (complexity: 4) - API route: text-improve.ts
  - createProtectedStreamingRoute + middleware stack (entitlement FIRST) + buildTextImprovePrompt + streamHandler
  - File: apps/api/src/routes/ai/protected/text-improve.ts
  - Blocked by: T-001
  - Blocks: T-004, T-005

- [ ] **T-004** (complexity: 2) - Barrel routes/ai/protected/index.ts + mount
  - protectedAiRoutes router; mount at /api/v1/protected/ai; sibling-spec slots
  - Files: apps/api/src/routes/ai/protected/index.ts, routes/index.ts
  - Blocked by: T-003
  - Blocks: T-006

- [ ] **T-005** (complexity: 3) - Route handler unit tests
  - 6 cases; vi.mock createConfiguredAiService
  - File: apps/api/src/routes/ai/protected/**tests**/text-improve.test.ts
  - Blocked by: T-003
  - Blocks: —

- [ ] **T-008** (complexity: 4) - useAiTextImprove hook + tests
  - State machine + SSE parser + AbortController; 9 hook tests
  - Files: apps/admin/src/features/accommodations/hooks/useAiTextImprove.ts + **tests**/
  - Blocked by: T-007
  - Blocks: T-009

- [ ] **T-009** (complexity: 5) - AiTextImprovePanel component + tests
  - Trigger + panel + a11y + HTTP→i18n error map; 13 component tests
  - Files: apps/admin/src/features/accommodations/components/AiTextImprovePanel.tsx + **tests**/
  - Blocked by: T-007, T-008
  - Blocks: T-010

### Integration Phase

- [ ] **T-006** (complexity: 4) - API integration tests (live DB)
  - 10 cases per spec §9.3; mock-actor headers + entitlement mock; 100% middleware order
  - File: apps/api/test/integration/ai/text-improve.test.ts
  - Blocked by: T-004
  - Blocks: —

- [ ] **T-010** (complexity: 5) - Wire panel into fields + edit page
  - RichTextField.onAiImprove (TipTap setContent), TextareaField.onAiImprove (form.setFieldValue), useAccommodationPage.canUseAiTextImprove, $id_.edit.tsx mount, aiAssistedFields ref
  - Files: RichTextField.tsx, TextareaField.tsx, useAccommodationPage.ts, $id_.edit.tsx
  - Blocked by: T-009
  - Blocks: —

---

## Quality Gate

Before marking SPEC-198 complete, all of the following MUST be green:

- [ ] `pnpm lint` — pass
- [ ] `pnpm typecheck` — pass
- [ ] `pnpm test` — all unit + component + integration tests pass
- [ ] `pnpm --filter @repo/i18n check-locales` — pass
- [ ] Coverage ≥ 90% on new code paths; 100% on middleware composition order
- [ ] AC-1 through AC-12 from spec §7 covered by tests
- [ ] PR opened against `staging` with CI green
- [ ] Real-DB + 4-role Chrome smoke (owner-basico + owner-profesional + tourist-free + complex-basico) signed off

## Out of Scope (V1)

- Web surface (apps/web) — owner-decided 2026-06-05
- Tourist-facing AI
- `ai_text_improve_history` table (V2)
- Fields beyond `description` + `summary` (V2)
- Server-side audit `_meta` forwarding (SHOULD only, follow-up)
- Title, FAQs, SEO fields (V2)
