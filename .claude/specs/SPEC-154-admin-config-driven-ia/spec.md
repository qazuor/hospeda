---
specId: SPEC-154
title: Admin Config-Driven Information Architecture
status: draft
complexity: high
owner: qazuor
created: 2026-05-22
parent: (none)
related:
  - SPEC-153 (admin-design-tokens — independent, Wave 1 parallel)
  - SPEC-155 (admin-dashboards-v1 — depends on this)
  - SPEC-156 (admin-settings-reorganization — depends on this)
---

# SPEC-154 — Admin Config-Driven Information Architecture

> **Status**: DRAFT — base scope captured during the admin redesign planning session 2026-05-22. Architecture locked in `.claude/audit/admin-redesign/proposals/01-information-architecture.md` (v0.10+) and Zod schema specs locked in `02-config-schema.md` (v0.2+).

## 1. Origin

Phase 1 audit revealed the admin sidebar/topbar/main-menu has the right idea (config-driven sections, permission-gated items) but the config is scattered across `apps/admin/src/components/layout/sidebar/configs/*.section.tsx` files with TSX-mixed-with-config and several smells (sibling items duplicated across sections like Amenities/Features/Attractions, fragile route → section pattern matching, ad-hoc cherry-pick handling).

Owner aligned with a config-driven IA principle: **"que sea editable, sin modificar código, solo editando config"**. The new architecture moves the whole IA (sections, sidebars, role configs, dashboards refs, tabs, topbar+mobile per-role, label overrides) into a typed TS config validated at boot with Zod.

## 2. Goal

Build `apps/admin/src/config/ia/` infrastructure + Zod schema + role configs (4 active + 2 deferred) + IA renderer components (sidebar/topbar/main-menu reading from config). Existing admin sidebar/topbar/main-menu migrates to consume the new config.

Editing "what a user sees" becomes **one line in config**, no React touched.

## 3. Scope

### IN
- `apps/admin/src/config/ia/schema.ts` — Zod schemas + inferred TS types per doc 02.
- `apps/admin/src/config/ia/sections.ts` — 7 main sections (Inicio, Catálogo, Editorial, Comunidad, Comercial, Plataforma, Análisis).
- `apps/admin/src/config/ia/sidebars.ts` — sidebar configs per section (universe — items filtered per role at render time).
- `apps/admin/src/config/ia/dashboards.ts` — dashboard stubs (filled by SPEC-155).
- `apps/admin/src/config/ia/tabs.ts` — tab configs per detail entity (accommodation, post, event, user, subscription, etc.).
- `apps/admin/src/config/ia/roles/{host,editor,admin,super-admin,sponsor,client-manager}.ts` — role configs (sponsor + client-manager with `enabled: false`).
- `apps/admin/src/config/ia/permission-bundles.ts` — `expandPermissions()` function (resolves wildcards at boot).
- `apps/admin/src/config/ia/create-actions.ts` — registry of "Crear X" actions referenced by topbar + mobile FAB.
- `apps/admin/src/config/ia/index.ts` — composes everything + runs Zod parse.
- `apps/admin/src/config/ia/validate.ts` — boot validation entry point (throws on error with formatted path).
- IA renderer components:
  - `apps/admin/src/components/layout/main-menu/MainMenu.tsx` (Level 1, per role config)
  - `apps/admin/src/components/layout/sidebar/Sidebar.tsx` migrated to consume config
  - `apps/admin/src/components/layout/topbar/Topbar.tsx` reads `topbar` per-role config
  - `apps/admin/src/components/layout/mobile-nav/BottomNav.tsx` reads `mobile.bottomNav`
  - `apps/admin/src/components/layout/quick-create/QuickCreate.tsx` reads `topbar.showQuickCreate`
- Permission cherry-pick UX (`onMissing: 'disable' | 'hide'`) at every navigation level.
- Inicio sidebar (V1: 2 items per `01-information-architecture.md` §19): Dashboard + Mi inbox (beta).

### OUT
- Dashboard widget implementations (SPEC-155).
- Settings page moves (SPEC-156).
- Visual identity tokens (SPEC-153).
- Sponsor + Client Manager role activation (deferred — `enabled: false` configs only).
- DB-backed config (post-V1 phase 2 feature).
- CommandPalette real implementation (post-V1 per Phase 2 audit).

## 4. Acceptance criteria

### A. Config infrastructure
- AC-1: All schema types per doc 02 §3-§12 implemented in `schema.ts` with Zod validation.
- AC-2: Boot validation crashes the app with a clear multi-line error message pointing to the offending key/path when config is invalid.
- AC-3: Cross-reference validations (doc 02 §13) all implemented and tested with unit tests.
- AC-4: `expandPermissions()` correctly expands `*`, `FOO_*`, and exact values. `*` restricted to SUPER_ADMIN role only (enforced in schema).
- AC-5: Role config schema enforces partial config when `enabled: false` (sponsor, client-manager can omit mainMenu/dashboard/topbar/mobile).

### B. Sections + sidebars
- AC-6: 7 main sections defined matching IA doc §2 (Inicio, Catálogo, Editorial, Comunidad, Comercial, Plataforma, Análisis).
- AC-7: SUPER_ADMIN sees the full sidebar trees from IA doc §13 in each section (this is the source-of-truth tree).
- AC-8: Sidebar items support `link`, `group` (2-level cap, no nested groups), and `separator` types per schema §5.
- AC-9: Each section sidebar has at least 1 item with `permissions` referencing real `PermissionEnum` values.

### C. Role configs
- AC-10: HOST role config matches IA doc §12: 5 main menu items, Mi cuenta in menu, no Cmd+K, `newAccommodation` FAB, bottom nav with 4 items.
- AC-11: SUPER_ADMIN role config matches IA doc §13: 7 main menu items, Mi cuenta in topbar avatar, Cmd+K active, quick create all.
- AC-12: ADMIN role config matches IA doc §16: same 7 sections as SUPER_ADMIN with `onMissing: 'hide'` items (Configuración crítica, Auditoría, Debug) hidden via permission gates.
- AC-13: EDITOR role config matches IA doc §17: 4 main menu items (Inicio, Editorial, Análisis, Mi cuenta), no Catálogo nav (data via selectors), `newPost` FAB.
- AC-14: SPONSOR + CLIENT_MANAGER roles defined with `enabled: false`. Role selector in admin user management excludes them.

### D. Renderer components
- AC-15: Sidebar renders based on `useCurrentSection()` + `useCurrentSidebar()` reading from config.
- AC-16: Items hidden via `onMissing: 'hide'` do NOT render at all; items disabled via `onMissing: 'disable'` render greyed with tooltip "Requiere permiso X".
- AC-17: Sections with 0 accessible items don't appear in main menu (cherry-pick rule §8 Level 1).
- AC-18: Topbar renders `showSearch`, `showQuickCreate`, `accountInMenu` per current user's role.
- AC-19: Mobile bottom nav appears on screens <768px when `mobile.bottomNav` is non-null; hamburger fallback otherwise.

### E. Migration of existing admin
- AC-20: Existing `apps/admin/src/components/layout/sidebar/configs/*.section.tsx` files removed; their data lives in the new config system.
- AC-21: Section registry in `__root.tsx` removed in favor of config-driven section list.
- AC-22: All existing admin routes still navigable from the new config-driven sidebar (no regression in reachable pages).

### F. Inicio sidebar
- AC-23: Inicio section has its own sidebar (was none before). 2 items in V1: Dashboard + Mi inbox (labeled `(beta)`).
- AC-24: Mi inbox route reuses existing `/notifications` page (no new backend wiring in this SPEC).

## 5. Technical approach

Implementation order:

1. **Schema first** — write `schema.ts` with all Zod schemas + cross-reference validations + unit tests. Catches design errors early.
2. **Permission expansion** — `permission-bundles.ts` with `expandPermissions()` + unit tests. Used in role configs.
3. **Sections + sidebars** — define the 7 sections + their sidebar trees (universe — SUPER_ADMIN sees everything).
4. **Role configs** — 4 active + 2 deferred. Each role's config is one file.
5. **Top-level composer** — `index.ts` wires sections + sidebars + roles + tabs + dashboards + create-actions into final `AdminIAConfig`.
6. **Validation entry** — `validate.ts` runs at module load, throws with formatted errors.
7. **Renderer components** — build new MainMenu, Sidebar, Topbar, BottomNav, QuickCreate components consuming the config.
8. **Migration** — wire `_authed.tsx` layout to use new components. Remove old sidebar configs. Verify visually.
9. **Permission UX** — implement `onMissing: 'disable'` (greyed + tooltip) and `'hide'` (rendered as nothing) at L1/L2/L3.
10. **Tests** — boot validation tests + visibility logic tests + permission expansion tests.

## 6. Task breakdown (atomic, complexity ≤ 4)

Estimated 32-35 tasks. Atomization at implementation time.

Indicative breakdown:
- Schema + types: 6-8 tasks (one per schema module — section, sidebar items discriminated union, role, dashboard, tabs, topbar, mobile, create-action, top-level + validations).
- Permission infrastructure: 3 tasks (`expandPermissions`, wildcard validation, role-level config validation).
- Configs (data): 7-8 tasks (sections file, sidebars file, 4 active role files, 2 deferred role files, dashboards stub file, tabs file, create-actions file).
- Top-level composer + validation entry: 2 tasks.
- Renderer components: 5-6 tasks (MainMenu, Sidebar, Topbar, BottomNav, QuickCreate, common hooks).
- Migration of existing layout: 4-5 tasks (delete old configs, wire new components in `_authed.tsx`, smoke test all routes accessible).
- Permission UX implementation: 3 tasks (disable rendering, hide rendering, tooltip+messaging).
- Tests: 4-5 tasks (boot validation, cherry-pick logic, expansion logic, role-level acceptance tests, end-to-end smoke).

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Config-driven nav causes route resolution slowdown | Permission filtering is O(items) per render. Memoize per-user. Profile and add memoization if needed. |
| Boot validation throws in dev and blocks startup | Expected — that's the design. Document clear error messages. Provide a `IA_VALIDATION_LENIENT` env flag for emergency dev override (off by default in CI). |
| Cross-reference validations have edge cases (labelOverrides paths, etc.) | Comprehensive unit tests per validation function. Generate sample invalid configs and assert errors. |
| `[data-app="admin"]` set timing — must apply before tokens read | Set on `<html>` in `__root.tsx` SSR. Verify hydration works. Tailwind v4 should pick it up automatically. |
| Migration breaks navigation to existing pages | Smoke test EVERY existing route after migration. Compare main menu / sidebar item count before/after per role. |
| TanStack Start file-based routing vs config-driven sidebar drift | Sidebar items reference route strings; if route file moves/renames, config doesn't auto-update. Add tooling: a script that lists all routes + asserts every sidebar `link` item points to a real route. Add to CI. |
| Permission cherry-pick has surprising UX edge cases | Manual QA per role + automated visibility tests. Document in IA doc §8 with examples. |

## 8. Rollback plan

- Pre-merge: smoke test full admin navigation per role.
- Post-merge: each layer rollbackable independently:
  - Renderer components: revert + re-enable old sidebar configs from git.
  - Config infrastructure: package stays; old layout components re-pointed.
- Catastrophic rollback: full revert of merge commit. Old admin sidebar restored.

## 9. Dependencies

- **External**: none.
- **Internal**: none (independent — Wave 1 parallel with SPEC-153).

## 10. References

- `.claude/audit/admin-redesign/proposals/01-information-architecture.md` (v0.10+) — IA decisions, 19 sections, per-role configs.
- `.claude/audit/admin-redesign/proposals/02-config-schema.md` (v0.2+) — Zod schema definitions, cross-reference validations, validation entry point.
- `.claude/audit/admin-redesign/phase-1/02-navigation.md` (audit of current admin nav).
- `.claude/audit/admin-redesign/phase-1/03-roles-permissions.md` (audit of permission model — 791 permissions, 9 roles).
- `apps/admin/src/components/layout/{sidebar,header}/*` (current admin nav implementation — to be migrated).
