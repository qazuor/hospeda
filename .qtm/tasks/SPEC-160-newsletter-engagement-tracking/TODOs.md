# SPEC-160: Newsletter Engagement Tracking (Open / Click)

## Progress: 0/5 tasks (0%)

**Average Complexity:** 2.2/3 (max)
**Critical Path:** T-001 -> T-002 -> T-005 (3 steps)
**Parallel Tracks:** 2 (T-002/T-003 after T-001; T-004 fully independent/optional)

> RE-SCOPED: backend shipped under SPEC-101. This is frontend-only (admin EDITOR dashboard Card C).

---

### Core Phase

- [ ] **T-001** (complexity: 3) - Add getEditorOpenRateCard() data-source and remove stale PHASE 2 comment
  - Resolve last-sent campaign, reuse use-campaign-metrics hook, expose openRate%. Remove stale comment (AC-3, AC-4).
  - Blocked by: none
  - Blocks: T-002, T-003

- [ ] **T-002** (complexity: 2) - Render EDITOR Card C open-rate widget
  - Bind data-source to Card C, format "N%" 0 decimals (AC-1).
  - Blocked by: T-001
  - Blocks: T-005

- [ ] **T-003** (complexity: 2) - Implement Card C empty-state for no-sends
  - Neutral "—" when no sent campaign, no throw (AC-2).
  - Blocked by: T-001
  - Blocks: T-005

### Integration Phase

- [ ] **T-004** (complexity: 2) - [DECISION] Optionally expose computed openRatePct/clickRatePct in metrics API
  - Nice-to-have. Decide client-side math (keep) vs API-computed pct. Does NOT block the must-have card.
  - Blocked by: none
  - Blocks: none

### Testing Phase

- [ ] **T-005** (complexity: 2) - Tests and coverage gate for Card C
  - AC-1 + AC-2 render paths, coverage >= 90% (AC-5).
  - Blocked by: T-002, T-003
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-004
Level 1: T-002, T-003
Level 2: T-005

## Suggested Start

Begin with **T-001** (complexity: 3) - no dependencies, unblocks T-002 and T-003. T-004 is an optional API-shape decision that can run in parallel or be skipped.
