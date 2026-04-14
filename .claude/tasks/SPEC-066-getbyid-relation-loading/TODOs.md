# SPEC-066: getById Relation Loading Consistency

## Progress: 0/7 tasks (0%)

**Average Complexity:** 2.4/4 (max)
**Critical Path:** T-001 -> T-003 -> T-006 -> T-007 (4 steps)
**Parallel Tracks:** 3 identified

---

### Setup Phase

- [ ] **T-004** (complexity: 1) - Update modelMockFactory with findOneWithRelations mock
  - Add findOneWithRelations to StandardModelMock, createModelMock(), MockBaseModel
  - Blocked by: none
  - Blocks: T-006

### Core Phase

- [ ] **T-001** (complexity: 4) - Implement findOneWithRelations() on BaseModel
  - New method on base.model.ts mirroring findAllWithRelations but with findFirst()
  - Blocked by: none
  - Blocks: T-003, T-005

- [ ] **T-002** (complexity: 1) - Add getDefaultGetByIdRelations() hook to BaseCrudPermissions
  - Non-abstract method defaulting to getDefaultListRelations()
  - Blocked by: none
  - Blocks: T-003, T-006

- [ ] **T-003** (complexity: 2) - Modify getByField() to use findOneWithRelations when relations defined
  - Conditional call: findOneWithRelations vs findOne based on relations config
  - Blocked by: T-001, T-002
  - Blocks: T-006

### Testing Phase

- [ ] **T-005** (complexity: 4) - Unit tests for findOneWithRelations() in db package
  - New file: packages/db/test/base/findOneWithRelations.test.ts (8 test cases)
  - Blocked by: T-001
  - Blocks: T-007

- [ ] **T-006** (complexity: 4) - Unit tests for getDefaultGetByIdRelations() and getByField() relation behavior
  - Modify: packages/service-core/test/base/crud/getById.test.ts (8 test cases)
  - Blocked by: T-002, T-003, T-004
  - Blocks: T-007

### Verification Phase

- [ ] **T-007** (complexity: 1) - Run full quality gate
  - pnpm typecheck + lint + test — zero regressions
  - Blocked by: T-005, T-006
  - Blocks: none

---

## Dependency Graph

```
Level 0: T-001, T-002, T-004  (parallel — no dependencies)
Level 1: T-003                 (blocked by T-001, T-002)
Level 2: T-005, T-006          (parallel — T-005 needs T-001; T-006 needs T-002, T-003, T-004)
Level 3: T-007                 (blocked by T-005, T-006)
```

## Suggested Start

Begin with **T-001** (complexity: 4), **T-002** (complexity: 1), and **T-004** (complexity: 1) in parallel — they have no dependencies and unblock all downstream tasks.
