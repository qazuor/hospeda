# SPEC-032: Interactive CLI Tool for Development Workflows

## Progress: 13/29 tasks (45%)

**Average Complexity:** 2.6/4 (max)
**Phases:** setup (done), core (done), integration (partial), testing (partial), gaps-fix (new), gaps-testing (new), gaps-validation (new)

---

### Setup Phase

- [x] **T-001** (complexity: 2) - Scaffold project structure, install fuse.js, configure biome override and vitest
- [x] **T-002** (complexity: 2) - Create TypeScript interfaces in types.ts

### Core Phase

- [x] **T-003** (complexity: 2) - Create categories module with definitions and display order
- [x] **T-004** (complexity: 3) - Create curated command registry with all 45 commands
- [x] **T-005** (complexity: 4) - Create auto-discovery module for workspace scripts
- [x] **T-006** (complexity: 2) - Create fuzzy search module with Fuse.js
- [x] **T-007** (complexity: 3) - Create command history module with atomic file operations
- [x] **T-008** (complexity: 3) - Create terminal formatting module for output display
- [x] **T-009** (complexity: 3) - Create command runner module with signal handling

### Integration Phase

- [x] **T-010** (complexity: 4) - Create direct mode module for CLI argument handling
- [ ] **T-011** (complexity: 4) - Create interactive mode module with search and category navigation [in-progress] *(missing interactive.test.ts)*
- [ ] **T-012** (complexity: 3) - Create main entry point with arg routing and CLI bootstrapper [in-progress] *(missing main.test.ts)*

### Testing Phase

- [x] **T-013** (complexity: 3) - Write unit tests for categories and registry modules
- [ ] **T-014** (complexity: 3) - Write unit and integration tests for discovery module *(file does not exist)*
- [ ] **T-015** (complexity: 3) - Write unit tests for search and history modules [in-progress] *(history tests use duplicated functions)*
- [ ] **T-016** (complexity: 3) - Write unit tests for format and runner modules [in-progress] *(runCommand() untested)*
- [x] **T-017** (complexity: 3) - Write unit tests for direct mode module

### Docs Phase

- [x] **T-018** (complexity: 1) - Update CLAUDE.md key commands section to document pnpm cli

### Gaps Fix Phase [NEW]

- [ ] **T-019** (complexity: 2) - Create utils.ts and fix type safety [NEW]
  - GAPs: 007, 009, 019, 023, 027
- [ ] **T-020** (complexity: 3) - Fix runner.ts security and robustness [NEW]
  - GAPs: 001 (CRITICAL), 003, 004, 032 | blocked by T-019
- [ ] **T-021** (complexity: 3) - Fix discovery.ts deduplication and hardening [NEW]
  - GAPs: 015 (CRITICAL), 024, 035, 038, 020, 012, 041, 043 | blocked by T-019
- [ ] **T-022** (complexity: 3) - Fix history.ts testability and validation [NEW]
  - GAPs: 005, 010, 031, 045, 025 | blocked by T-019
- [ ] **T-023** (complexity: 3) - Fix format.ts and interactive.ts display issues [NEW]
  - GAPs: 016, 039, 040, 011, 013, 008 | blocked by T-019
- [ ] **T-024** (complexity: 3) - Fix interactive.ts and direct.ts UX issues [NEW]
  - GAPs: 017, 027, 048, 049, 042 | blocked by T-019
- [ ] **T-025** (complexity: 2) - Refactor main.ts for testability and fix registry [NEW]
  - GAPs: 047, 006, 046 | blocked by T-019
- [ ] **T-026** (complexity: 2) - Fix vitest and TypeScript config [NEW]
  - GAPs: 033, 034

### Gaps Testing Phase [NEW]

- [ ] **T-027** (complexity: 4) - Create 3 missing test files and fix runner tests [NEW]
  - GAPs: 002, 021, 022 | blocked by T-020, T-021, T-022, T-023, T-025
- [ ] **T-028** (complexity: 3) - Refactor history.test.ts and add edge cases [NEW]
  - GAPs: 031, 028, 018, 044 | blocked by T-024, T-025

### Gaps Validation Phase [NEW]

- [ ] **T-029** (complexity: 1) - Run quality gate and update spec status [NEW]
  - GAP: 037 | blocked by T-027, T-028

---

## Dependency Graph

```
Level 0: T-019, T-026 (independent)
Level 1: T-020, T-021, T-022, T-023, T-024, T-025 (all blocked by T-019)
Level 2: T-027 (blocked by T-020..T-023, T-025), T-028 (blocked by T-024, T-025)
Level 3: T-029 (blocked by T-027, T-028)
```

## Parallel Tracks

1. **T-019** (foundation) must complete first to unblock all gap-fix tasks
2. **T-026** (config) is independent and can run in parallel with anything
3. **T-020..T-025** can all run in parallel after T-019
4. **T-027 + T-028** (testing) can run in parallel after source fixes
5. **T-029** (quality gate) is the final task

## GAP Coverage Map

| GAP | Severity | Task | Description |
|-----|----------|------|-------------|
| 001 | CRITICAL | T-020 | shell: true injection |
| 002 | CRITICAL | T-027 | 3 test files missing |
| 015 | CRITICAL | T-021 | Deduplication broken |
| 003 | HIGH | T-020 | Signal handler leak |
| 004 | HIGH | T-020 | Shell command splitting |
| 005 | HIGH | T-022 | History entry validation |
| 006 | HIGH | T-025 | Dangerous commands coverage |
| 016 | HIGH | T-023 | ID overflow in format |
| 021 | HIGH | T-027 | runCommand() no tests |
| 031 | HIGH | T-028 | history.test.ts tests duplicates |
| 039 | HIGH | T-023 | formatDangerWarning undefined |
| 007 | MEDIUM | T-019 | findMonorepoRoot fragile |
| 008 | MEDIUM | T-023 | Dead _categories param |
| 009 | MEDIUM | T-019 | Type safety dangerous |
| 010 | MEDIUM | T-022 | Race condition history |
| 011 | LOW | T-023 | Hardcoded version |
| 012 | LOW | T-021 | YAML parser docs |
| 013 | LOW | T-023 | Magic number 48 |
| 017 | MEDIUM | T-024 | Dynamic imports |
| 018 | MEDIUM | T-028 | Performance tests |
| 019 | MEDIUM | T-019 | inferCategory incomplete |
| 020 | LOW | T-021 | Comment "regex" |
| 022 | MEDIUM | T-027 | format tests missing |
| 023 | MEDIUM | T-019 | findMonorepoRoot tests |
| 024 | MEDIUM | T-021 | Path traversal |
| 025 | MEDIUM | T-022 | DoS query length |
| 027 | LOW | T-019 | ExitPromptError guard |
| 028 | LOW | T-028 | Edge cases tests |
| 032 | MEDIUM | T-020 | Missing cwd in spawn |
| 033 | MEDIUM | T-026 | vitest coverage config |
| 034 | MEDIUM | T-026 | tsconfig.json missing |
| 035 | MEDIUM | T-021 | JSON.parse no Zod |
| 037 | MEDIUM | T-029 | workspace.yaml graceful |
| 038 | MEDIUM | T-021 | Package names unsanitized |
| 040 | MEDIUM | T-023 | ID_PAD inconsistent |
| 041 | MEDIUM | T-021 | TURBO exclusion docs |
| 042 | LOW | T-024 | Unknown flags warning |
| 043 | LOW | T-021 | Lifecycle hooks excluded |
| 044 | LOW | T-028 | DANGEROUS_IDS hardcoded |
| 045 | LOW | T-022 | maxCount negative |
| 046 | MEDIUM | T-025 | format:md:claude missing |
| 047 | MEDIUM | T-025 | process.exit testability |
| 048 | MEDIUM | T-024 | Recent not updated |
| 049 | LOW | T-024 | --list --all broken |
| 050 | LOW | T-019 | Import duplicated |

## Suggested Start

Begin with **T-019** (complexity: 2) - Create utils.ts and fix type safety. It unblocks all 6 gap-fix tasks (T-020..T-025). **T-026** (config) can run in parallel.
