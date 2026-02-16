# SPEC-008: Phosphor Icons Migration

## Progress: 48/54 tasks (89%)

**Average Complexity:** 2.6/4 (max)
**Critical Path:** T-051 -> T-054 (2 remaining steps)
**Parallel Tracks:** T-005, T-006, T-052, T-053 can run in parallel

---

### Setup Phase (Phase 0: Normalize IconProps) -- 4/6 completed

- [x] **T-001** (complexity: 2) - Update IconProps interface and add IconWeight type export
  - Updated types.ts with IconWeight, weight/mirrored props, SVGAttributes extension
  - Blocked by: none
  - Blocks: T-002

- [x] **T-002** (complexity: 3) - Create createIconComponent factory utility
  - Factory created in create-phosphor-icon.tsx with size, weight, mirrored handling
  - Blocked by: T-001
  - Blocks: T-003, T-005

- [x] **T-003** (complexity: 3) - Write codemod script to update existing icon components
  - SUPERSEDED: Migration done directly via createPhosphorIcon instead of codemod
  - Blocked by: T-002
  - Blocks: T-004

- [x] **T-004** (complexity: 2) - Run codemod on all 386 existing icon components
  - SUPERSEDED: Icons migrated directly to Phosphor wrappers
  - Blocked by: T-003
  - Blocks: T-006, T-007

- [ ] **T-005** (complexity: 3) - Update package unit tests for new props interface
  - Test weight, mirrored, SVGAttributes extension, backward compat
  - Basic tests exist (5/5 pass) but Phosphor-specific tests not written
  - Blocked by: T-002
  - Blocks: T-006

- [ ] **T-006** (complexity: 2) - Update @repo/icons documentation for new props
  - Update CLAUDE.md, README, usage-reference
  - Blocked by: T-004, T-005
  - Blocks: none

### Consolidation Phase - Add Missing Icons (Phase 1) -- COMPLETED (9/9)

- [x] **T-007** (complexity: 3) - Create Lucide-to-@repo/icons mapping audit
- [x] **T-008** (complexity: 3) - Add missing UI/chrome icons to @repo/icons
- [x] **T-009** (complexity: 3) - Add missing action icons to @repo/icons
- [x] **T-010** (complexity: 2) - Add missing status icons to @repo/icons
- [x] **T-011** (complexity: 3) - Add missing rich-text editor icons to @repo/icons
- [x] **T-012** (complexity: 2) - Add missing media icons to @repo/icons
- [x] **T-013** (complexity: 3) - Add missing business icons to @repo/icons
- [x] **T-014** (complexity: 3) - Add missing system icons to @repo/icons
- [x] **T-015** (complexity: 1) - Build and typecheck @repo/icons with all new icons

### Consolidation Phase - Migrate Admin from Lucide (Phase 1) -- COMPLETED (10/10)

- [x] **T-016** (complexity: 3) - Migrate shadcn/ui base components from lucide to @repo/icons
- [x] **T-017** (complexity: 2) - Migrate ui-wrapped components from lucide to @repo/icons
- [x] **T-018** (complexity: 3) - Migrate entity-form layout components from lucide to @repo/icons
- [x] **T-019** (complexity: 3) - Migrate entity-form field components from lucide to @repo/icons
- [x] **T-020** (complexity: 3) - Migrate entity-form view components from lucide to @repo/icons
- [x] **T-021** (complexity: 4) - Migrate billing routes from lucide to @repo/icons
- [x] **T-022** (complexity: 4) - Migrate billing feature components from lucide to @repo/icons
- [x] **T-023** (complexity: 3) - Migrate access routes from lucide to @repo/icons
- [x] **T-024** (complexity: 3) - Migrate events, sponsor, me, and posts routes from lucide to @repo/icons
- [x] **T-025** (complexity: 2) - Migrate remaining admin components from lucide to @repo/icons

### Consolidation Phase - Unify Admin Icon System (Phase 1) -- COMPLETED (3/3)

- [x] **T-026** (complexity: 3) - Expand IconRegistry with all newly added icon mappings
  - Registry expanded with all new icons, IconName type updated
- [x] **T-027** (complexity: 3) - Align admin Icon.tsx ICON_SIZES with package ICON_SIZES
  - Resolved mismatch between Tailwind classes and pixel sizing
- [x] **T-028** (complexity: 2) - Remove lucide-react from admin package.json and verify build
  - Gate task: zero lucide-react imports confirmed, dependency removed

### Consolidation Phase - Admin Inline SVGs (Phase 1b) -- COMPLETED (3/3)

- [x] **T-029** (complexity: 3) - Replace inline SVGs in admin form components with @repo/icons
- [x] **T-030** (complexity: 3) - Replace inline SVGs in admin list/grid components with @repo/icons
- [x] **T-031** (complexity: 3) - Replace CSS border-spinner loaders with LoaderIcon across admin

### Integration Phase - Web2 Inline SVGs (Phase 2) -- COMPLETED (3/3)

- [x] **T-032** (complexity: 2) - Replace inline SVGs in web2 EventCard.astro and Header.astro
- [x] **T-033** (complexity: 2) - Replace inline SVGs in web2 ViewToggle and ShareButtons
- [x] **T-034** (complexity: 2) - Replace inline SVGs in web2 Select.astro and EmptyState.astro

### Integration Phase - Package Cleanup (Phase 2b) -- COMPLETED (1/1)

- [x] **T-035** (complexity: 1) - Remove lucide-react from auth-ui and audit remaining packages

### Migration Phase - Phosphor Migration (Phase 3) -- COMPLETED (15/15)

- [x] **T-036** (complexity: 4) - Create complete CurrentIconName to PhosphorIconName mapping table
  - SUPERSEDED: Mapping done directly in code during migration
- [x] **T-037** (complexity: 3) - Add @phosphor-icons/react dependency and create Phosphor wrapper factory
  - @phosphor-icons/react installed, create-phosphor-icon.tsx created
- [x] **T-038** (complexity: 4) - Migrate system category icons to Phosphor wrappers (~98 icons)
  - All 98 system icons migrated to createPhosphorIcon
- [x] **T-039** (complexity: 4) - Migrate amenities category icons to Phosphor wrappers (~89 icons)
  - All 89 amenity icons migrated to Phosphor wrappers
- [x] **T-040** (complexity: 4) - Migrate attractions category icons to Phosphor wrappers (~73 icons)
  - All 73 attraction icons migrated to Phosphor wrappers
- [x] **T-041** (complexity: 4) - Migrate features category icons to Phosphor wrappers (~59 icons)
  - All 59 feature icons migrated to Phosphor wrappers
- [x] **T-042** (complexity: 3) - Migrate utilities category icons to Phosphor wrappers (~39 icons)
  - All 39 utility icons migrated to Phosphor wrappers
- [x] **T-043** (complexity: 3) - Migrate booking category icons to Phosphor wrappers (~20 icons)
  - All 20 booking icons migrated to Phosphor wrappers
- [x] **T-044** (complexity: 2) - Migrate admin category icons to Phosphor wrappers (~16 icons)
  - All 16 admin icons migrated to Phosphor wrappers
- [x] **T-045** (complexity: 2) - Migrate actions category icons to Phosphor wrappers (~16 icons)
  - All 16 action icons migrated to Phosphor wrappers
- [x] **T-046** (complexity: 2) - Migrate entities and communication icons to Phosphor wrappers (~20 icons)
  - All entity and communication icons migrated to Phosphor wrappers
- [x] **T-047** (complexity: 1) - Migrate social category icons to Phosphor wrappers (~4 icons)
  - All 4 social icons migrated to Phosphor wrappers
- [x] **T-048** (complexity: 2) - Wire up weight and mirrored props in Phosphor wrapper factory
  - Props functional, all icons support weight/mirrored
- [x] **T-049** (complexity: 3) - Create visual verification comparison page
  - Showcase page created at /dev/icon-comparison with all weight/size variants
- [x] **T-050** (complexity: 2) - Remove old SVG source files after visual verification
  - SUPERSEDED: Icons replaced in-place, no old files to remove

### Cleanup Phase (Phase 4) -- 0/4 remaining

- [ ] **T-051** (complexity: 2) - Remove lucide-react from root pnpm-lock.yaml and verify clean install
  - lucide-react only in apps/web devDependencies (unused). Remove and regenerate lockfile.
  - Blocked by: T-035, T-050 | Blocks: T-054

- [ ] **T-052** (complexity: 1) - Remove generate-icon.js script and old generation documentation
  - generate-icon.js uses obsolete Lucide pattern. check-phosphor.cjs may also be removable.
  - Blocked by: T-050 | Blocks: none

- [ ] **T-053** (complexity: 3) - Update CLAUDE.md files across monorepo for Phosphor migration
  - Blocked by: T-050 | Blocks: none

- [ ] **T-054** (complexity: 2) - Run final bundle size analysis and document results
  - Current build: ESM 71KB + CJS 94KB + DTS 35KB
  - Blocked by: T-051 | Blocks: none

---

## Known Issues (not tracked as tasks)

1. **39 duplicate icons in utilities/**: Icons in `utilities/` duplicate icons from other categories and are NOT exported in index.ts
2. **Empty navigation/ directory**: `src/icons/navigation/` exists but is empty
3. **README icon count outdated**: Says "386 Icons" but there are 434 files (395 exported)

---

## Dependency Graph

```
Level 0: T-001
Level 1: T-002
Level 2: T-003, T-005
Level 3: T-004
Level 4: T-006, T-007
Level 5: T-008, T-009, T-010, T-011, T-012, T-013, T-014
Level 6: T-015
Level 7: T-016..T-025, T-026, T-029..T-034
Level 8: T-027
Level 9: T-028
Level 10: T-035, T-036
Level 11: T-037
Level 12: T-038..T-047
Level 13: T-048
Level 14: T-049
Level 15: T-050
Level 16: T-051, T-052, T-053
Level 17: T-054
```

## Current Status

**Migration is 100% complete at the code level.** All 434 icons use `createPhosphorIcon` wrappers. Zero custom SVGs remain. Zero lucide-react imports in production code.

**Remaining work is cleanup only:**

Next available tasks (all unblocked):

- **T-005** - Write Phosphor-specific unit tests (weight, mirrored, backward compat)
- **T-051** - Remove lucide-react from apps/web devDependencies + regenerate lockfile
- **T-052** - Delete obsolete generate-icon.js script
- **T-053** - Update CLAUDE.md documentation files

After T-051 completes:

- **T-054** - Bundle size analysis

After T-005 completes:

- **T-006** - Update @repo/icons documentation
