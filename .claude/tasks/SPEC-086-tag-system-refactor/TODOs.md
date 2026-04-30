# SPEC-086: Tag System Refactor — Task Overview

**Epic:** Tag System Refactor (Two Subsystems: PostTag + User-Tag)
**Status:** pending
**Total tasks:** 46
**Average complexity:** 3.1
**Source documents:**
- spec.md — full functional + technical specification
- decisions.md — 24 architectural decisions (D-001..D-024)
- tag-seeds.md — canonical tag content (25 INTERNAL + 30 SYSTEM + 34 PostTag) and example assignments

---

## Phase Breakdown

| Phase | Count | Range |
|-------|-------|-------|
| core | 19 | T-005..T-023 |
| integration | 18 | T-024..T-041 |
| setup | 4 | T-001..T-004 |
| testing | 5 | T-042..T-046 |

---

## Tasks by Phase

### CORE Phase

- [ ] **T-005** (c:3) — Refactor tags DB schema: drop slug/notes, add type/ownerId/description
  - blockedBy: T-001 | blocks: T-011, T-015
- [ ] **T-006** (c:3) — Refactor r_entity_tag DB schema: add assignedById, change PK
  - blockedBy: T-002 | blocks: T-016
- [ ] **T-007** (c:3) — Create post_tags DB schema table
  - blockedBy: T-001, T-002 | blocks: T-012, T-016
- [ ] **T-008** (c:2) — Create r_post_post_tag DB schema join table
  - blockedBy: T-002, T-007 | blocks: T-016
- [ ] **T-009** (c:2) — Add SYSTEM_USER_ID constant to @repo/db
  - blockedBy: — | blocks: T-036
- [ ] **T-010** (c:2) — Apply DB schema changes via pnpm db:fresh-dev
  - blockedBy: T-005, T-006, T-007, T-008 | blocks: T-015, T-016, T-017
- [ ] **T-011** (c:4) — Refactor tag Zod schemas in @repo/schemas
  - blockedBy: T-005 | blocks: T-015, T-018, T-019
- [ ] **T-012** (c:3) — Create PostTag Zod schemas in @repo/schemas
  - blockedBy: T-007 | blocks: T-017, T-020, T-024
- [ ] **T-013** (c:3) — Create tag permission helper schemas in @repo/schemas
  - blockedBy: — | blocks: T-018, T-019, T-024, T-025, T-026, T-027
- [ ] **T-014** (c:2) — Create tag i18n Zod key schemas for es/en/pt validation
  - blockedBy: — | blocks: T-035
- [ ] **T-015** (c:4) — Refactor TagModel and REntityTagModel in @repo/db
  - blockedBy: T-010, T-011 | blocks: T-018, T-019
- [ ] **T-016** (c:4) — Create PostTagModel and RPostPostTagModel in @repo/db
  - blockedBy: T-010, T-006, T-007, T-008 | blocks: T-020
- [ ] **T-017** (c:4) — Create PostTagService extending BaseCrudRelatedService
  - blockedBy: T-012, T-016 | blocks: T-024
- [ ] **T-018** (c:3) — Implement TagService type invariants and cross-type name collision check
  - blockedBy: T-003, T-011, T-015 | blocks: T-019, T-021
- [ ] **T-019** (c:4) — Implement TagService quota enforcement with advisory lock
  - blockedBy: T-018 | blocks: T-021
- [ ] **T-020** (c:4) — Implement TagService picker visibility and entity-tag scoping
  - blockedBy: T-015, T-016 | blocks: T-021
- [ ] **T-021** (c:4) — Implement TagService entity-access check and assignedById injection on assign
  - blockedBy: T-018, T-019, T-020 | blocks: T-025, T-026, T-027, T-028
- [ ] **T-022** (c:3) — Implement TagService hard delete and impact count
  - blockedBy: T-003, T-015 | blocks: T-025, T-026
- [ ] **T-023** (c:3) — Implement TagService user-tag CRUD for own tags (USER type)
  - blockedBy: T-018, T-019, T-020 | blocks: T-028
### INTEGRATION Phase

- [ ] **T-024** (c:4) — Create PostTag admin and public API routes
  - blockedBy: T-003, T-012, T-017, T-013 | blocks: T-029, T-042
- [ ] **T-025** (c:4) — Create admin API routes for INTERNAL and SYSTEM user-tags
  - blockedBy: T-003, T-013, T-021, T-022 | blocks: T-029, T-042
- [ ] **T-026** (c:3) — Create admin API routes for USER tag moderation and cross-user attribution
  - blockedBy: T-003, T-021, T-022 | blocks: T-029, T-042
- [ ] **T-027** (c:4) — Create admin API routes for own USER tag CRUD
  - blockedBy: T-003, T-013, T-021, T-022, T-023 | blocks: T-032, T-042
- [ ] **T-028** (c:4) — Create admin API routes for entity tag assignment
  - blockedBy: T-003, T-013, T-021, T-023 | blocks: T-033, T-042
- [ ] **T-029** (c:4) — Create Admin UI: PostTag management section
  - blockedBy: T-024 | blocks: T-043
- [ ] **T-030** (c:3) — Create Admin UI: SYSTEM and INTERNAL tag management sections
  - blockedBy: T-025 | blocks: T-043
- [ ] **T-031** (c:3) — Create Admin UI: USER tag moderation and entity attribution view
  - blockedBy: T-026 | blocks: T-043
- [ ] **T-032** (c:4) — Create Own-Tag Manager page in admin panel
  - blockedBy: T-027, T-035 | blocks: T-044
- [ ] **T-033** (c:4) — Create reusable Tag Picker component in admin panel
  - blockedBy: T-028, T-035 | blocks: T-044
- [ ] **T-034** (c:3) — Implement public PostTag-filtered post listing in web app
  - blockedBy: T-024 | blocks: T-044
- [ ] **T-035** (c:3) — Add tags i18n namespace to es/en/pt locale files
  - blockedBy: T-014 | blocks: T-032, T-033
- [ ] **T-036** (c:2) — Implement required seed R-1: System User
  - blockedBy: T-004, T-009, T-010 | blocks: T-037, T-038, T-039
- [ ] **T-037** (c:2) — Implement required seeds R-2 and R-3: INTERNAL and SYSTEM user-tags
  - blockedBy: T-036 | blocks: T-041
- [ ] **T-038** (c:3) — Delete obsolete 43 tag JSONs and create new tag/postTag JSONs from tag-seeds.md
  - blockedBy: T-036 | blocks: T-039
- [ ] **T-039** (c:2) — Implement required seed R-4: PostTags from tag-seeds.md
  - blockedBy: T-038 | blocks: T-041
- [ ] **T-040** (c:3) — Implement example seeds E-1, E-2, E-3 with assignments per tag-seeds.md
  - blockedBy: T-037, T-039 | blocks: T-041
- [ ] **T-041** (c:2) — Verify full seed pipeline with pnpm db:fresh-dev
  - blockedBy: T-037, T-039, T-040 | blocks: T-045
### SETUP Phase

- [ ] **T-001** (c:2) — Add TagTypeEnum and TagTypePgEnum to enums files
  - blockedBy: — | blocks: T-004, T-005, T-006, T-007
- [ ] **T-002** (c:2) — Expand EntityTypeEnum with 4 new values
  - blockedBy: — | blocks: T-007, T-008
- [ ] **T-003** (c:2) — Add all 24 new permissions to PermissionEnum
  - blockedBy: — | blocks: T-018, T-019, T-020, T-021, T-022, T-023, T-024, T-025, T-026, T-027, T-028
- [ ] **T-004** (c:2) — Add SYSTEM role to RoleEnum for the system user
  - blockedBy: T-001 | blocks: T-036
### TESTING Phase

- [ ] **T-042** (c:4) — Write API integration tests for PostTag and INTERNAL/SYSTEM tag routes
  - blockedBy: T-024, T-025, T-026 | blocks: —
- [ ] **T-043** (c:4) — Write API integration tests for USER tag protected routes and moderation
  - blockedBy: T-027, T-028 | blocks: —
- [ ] **T-044** (c:3) — Write frontend component tests for TagPicker and UserTagManager
  - blockedBy: T-032, T-033, T-034 | blocks: —
- [ ] **T-045** (c:3) — Write cascade and user-delete regression tests
  - blockedBy: T-041 | blocks: —
- [ ] **T-046** (c:2) — Write schema validation and enum presence verification tests
  - blockedBy: T-001, T-002, T-003, T-011, T-035 | blocks: —

---

## Critical Path

```
T-001 → T-005 → T-011 → T-015 → T-018 → T-019 → T-021 → T-025 → T-029 → T-043
```
10 steps. Bottleneck: TagService invariants → quota lock → assign visibility check before reaching API and UI.

---

## Parallel Tracks

- **Track A (DB Schema)**: T-001/T-002 → 4 schema tasks → T-010 checkpoint
- **Track B (Constants + Seeds)**: T-009 → T-036 → T-037/T-038/T-039 → T-041
- **Track C (Zod Schemas)**: T-011/T-012/T-013 in parallel post T-005/T-007
- **Track D (i18n)**: T-014 → T-035 — fully independent
- **Track E (Service methods)**: 6 sub-tasks of TagService refactor parallelizable post T-015

---

## Suggested First Wave (no blockedBy)

Six tasks ready to start in parallel — combined ~2-3 hours, unblock the entire DB schema layer:

- **T-001** (c:2) — Add TagTypeEnum and TagTypePgEnum to enums files
- **T-002** (c:2) — Expand EntityTypeEnum with 4 new values
- **T-003** (c:2) — Add all 24 new permissions to PermissionEnum
- **T-009** (c:2) — Add SYSTEM_USER_ID constant to @repo/db
- **T-013** (c:3) — Create tag permission helper schemas in @repo/schemas
- **T-014** (c:2) — Create tag i18n Zod key schemas for es/en/pt validation

---

## Notes

- All tasks have complexity ≤ 4. No manual splitting required.
- Per D-024, all user-tag UI lives in `apps/admin`. The `apps/web` work in this spec is limited to PostTag display.
- Per D-003, no migration files. Schema applies via `pnpm db:fresh-dev`.
- Tag content seeded from `tag-seeds.md`. If that doc changes, T-037/T-038/T-039 must be updated.
