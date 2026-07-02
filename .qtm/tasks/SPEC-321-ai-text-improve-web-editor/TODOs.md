# SPEC-321: AI Text-Improve in Web Owner Editor

## Progress: 0/6 tasks (0%)

**Average Complexity:** 1.8/3 (max)
**Critical Path:** T-001 -> T-002 -> T-003 -> T-005 -> T-006 (5 steps)
**Parallel Tracks:** 1 identified (T-003 and T-004 can run in parallel once T-002 is done)

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Port useAiTextImprove SSE hook to web
  - New apps/web/src/hooks/useAiTextImprove.ts, ported from admin's SPEC-198 hook
  - Blocked by: none
  - Blocks: T-002

### Core Phase

- [ ] **T-002** (complexity: 2) - Build AiTextImprovePanel presentational component
  - New apps/web/src/components/host/editor/AiTextImprovePanel.client.tsx
  - Blocked by: T-001
  - Blocks: T-003, T-004

- [ ] **T-003** (complexity: 3) - Wire AI-improve button into the description field
  - Handles both plain-textarea and TipTap write-back paths
  - Blocked by: T-002
  - Blocks: T-005

- [ ] **T-004** (complexity: 1) - Wire AI-improve button into the summary field
  - Plain textarea only, same entitlement gate
  - Blocked by: T-002
  - Blocks: T-005

### Integration Phase

- [ ] **T-005** (complexity: 2) - Verify quota/error surfacing and unmount-safety across both fields
  - Cross-cutting integration tests (entitlement/limit errors, unmount mid-stream)
  - Blocked by: T-003, T-004
  - Blocks: T-006

### Testing Phase

- [ ] **T-006** (complexity: 1) - Manual smoke pass across all 4 field-rendering combinations
  - Real dev-environment check (wt:up), no automated test
  - Blocked by: T-005
  - Blocks: none

---

## Dependency Graph

Level 0: T-001
Level 1: T-002
Level 2: T-003, T-004
Level 3: T-005
Level 4: T-006

## Suggested Start

Begin with **T-001** (complexity: 2) - it has no dependencies and unblocks the rest of the chain.
