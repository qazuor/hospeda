# HOS-2413: Mi Cuenta UI · Phase 2 · Foundations

## Progress: 5/32 tasks (16%)

Task detail (goal, files, AC, tests) is authoritative in [`../docs/tasks.md`](../docs/tasks.md); IDs match one-to-one. PR plan: spec §12.1.

**Average Complexity:** 3/10 (each task ≤ 3, per docs/tasks.md)

---

### Setup Phase

- [x] **T-001** (complexity: 3) - App tokens in full (HOS-2454): role status, focus ring, radius scale, control heights, app typography, AA link + contrast tests [DONE]
  - Blocked by: none
  - Blocks: T-002
- [x] **T-002** (complexity: 3) - Kit token delta + D4 owner-decision contrast test [DONE]
  - Blocked by: T-001
  - Blocks: T-004, T-005, T-006, T-010, T-016
- [x] **T-003** (complexity: 3) - Kit scaffold, HelpAnchor, account.ui i18n namespace, kit README [DONE]
  - Blocked by: none
  - Blocks: T-004, T-005, T-006, T-010, T-016, T-018, T-023
- [x] **T-008** (complexity: 3) - Account CSS scope + breakpoint guard (frozen, shrink-only exceptions) [DONE]
  - Blocked by: none
  - Blocks: T-009
- [x] **T-009** (complexity: 3) - CSS literals guard (frozen, shrink-only exceptions) [DONE]
  - Blocked by: T-008
  - Blocks: none

### Core Phase

- [ ] **T-004** (complexity: 3) - Button, LinkButton, TextLink
  - Blocked by: T-002, T-003
  - Blocks: T-011, T-013, T-014, T-022, T-024, T-025, T-026, T-027, T-028, T-029
- [ ] **T-005** (complexity: 3) - Section with gradient bar + nesting refusal
  - Blocked by: T-002, T-003
  - Blocks: T-029
- [ ] **T-006** (complexity: 3) - Field, TextInput, InputGroup, PhoneField
  - Blocked by: T-002, T-003
  - Blocks: T-007, T-029
- [ ] **T-007** (complexity: 3) - Select, Textarea (counter), Checkbox(Group), Radio(Group/OptionCard)
  - Blocked by: T-006
  - Blocks: T-029
- [ ] **T-010** (complexity: 3) - StatusPill, CountPill, status-tone.ts
  - Blocked by: T-002, T-003
  - Blocks: T-015, T-019, T-022, T-028, T-029
- [ ] **T-011** (complexity: 3) - Dialog (skin over the shared Dialog)
  - Blocked by: T-004
  - Blocks: T-012, T-013, T-029
- [ ] **T-012** (complexity: 3) - Drawer (bottom / right)
  - Blocked by: T-011
  - Blocks: T-021, T-029
- [ ] **T-013** (complexity: 3) - ConfirmDialog + useConfirm()
  - Blocked by: T-011, T-004
  - Blocks: T-026, T-029
- [ ] **T-014** (complexity: 3) - Pagination (numbered / prevNext / loadMore)
  - Blocked by: T-004
  - Blocks: T-029
- [ ] **T-015** (complexity: 3) - Tabs + NavTabs
  - Blocked by: T-010
  - Blocks: T-029
- [ ] **T-016** (complexity: 3) - Switch + SwitchRow
  - Blocked by: T-002, T-003
  - Blocks: T-029
- [ ] **T-022** (complexity: 3) - PageHeader
  - Blocked by: T-004, T-010
  - Blocks: T-029
- [ ] **T-023** (complexity: 3) - Skeleton + EmptyState
  - Blocked by: T-003
  - Blocks: T-024, T-029
- [ ] **T-024** (complexity: 3) - ErrorState + Alert + AsyncRegion (+ regression test)
  - Blocked by: T-004, T-023
  - Blocks: T-029
- [ ] **T-026** (complexity: 3) - StickySaveBar + useSaveBar
  - Blocked by: T-004, T-013
  - Blocks: T-029
- [ ] **T-027** (complexity: 3) - AutoSaveChip
  - Blocked by: T-004
  - Blocks: T-029
- [ ] **T-028** (complexity: 3) - LockedState
  - Blocked by: T-004, T-010
  - Blocks: T-029

### Integration Phase

- [ ] **T-017** (complexity: 3) - Extract account-nav-model.ts from AccountLayout
  - Blocked by: none
  - Blocks: T-019
- [ ] **T-018** (complexity: 3) - BaseLayout chrome, AccountHeader, AccountFooter, no dock
  - Blocked by: T-003
  - Blocks: T-020, T-025
- [ ] **T-019** (complexity: 3) - AccountSidebar
  - Blocked by: T-010, T-017
  - Blocks: T-020, T-021
- [ ] **T-020** (complexity: 3) - AccountShell.astro + templates + AccountLayout shell switch (default legacy)
  - Blocked by: T-018, T-019
  - Blocks: T-021, T-031
- [ ] **T-021** (complexity: 3) - AccountBar + AccountDrawer
  - Blocked by: T-012, T-019, T-020
  - Blocks: T-031
- [ ] **T-025** (complexity: 3) - Toast + AccountToastRegion on toast-store
  - Blocked by: T-004, T-018
  - Blocks: T-029
- [ ] **T-029** (complexity: 3) - Kit gallery page + HOSPEDA_ACCOUNT_KIT_GALLERY env workflow
  - Blocked by: T-004, T-005, T-006, T-007, T-010, T-011, T-012, T-013, T-014, T-015, T-016, T-022, T-023, T-024, T-025, T-026, T-027, T-028
  - Blocks: T-030

### Testing Phase

- [ ] **T-030** (complexity: 3) - Visual regression suite + CI step + approval docs + retire SPEC-153 web config
  - Blocked by: T-029
  - Blocks: T-031

### Docs Phase

- [ ] **T-032** (complexity: 3) - Docs: kit README, loading-states.md, apps/web/CLAUDE.md pointer
  - Blocked by: T-031
  - Blocks: none

### Cleanup Phase

- [ ] **T-031** (complexity: 3) - Flip the shell default, delete legacy + switch, structural sweep, page baselines
  - Blocked by: T-020, T-021, T-030
  - Blocks: T-032

---

## Suggested Start

PR-1 foundations: T-001 → T-002, T-003, T-008 → T-009 (no dependencies between the token and guard tracks).
