# SPEC-197 — Progress Notes

## 2026-06-05 — Setup phase complete (4/21)

### T-001 — Permission/entitlement verification (VERIFIED, no code)

- `ANALYTICS_VIEW` assigned in `packages/seed/src/required/rolePermissions.seed.ts`:
  SUPER_ADMIN (line 224), ADMIN (line 532), **and CLIENT_MANAGER (line 642)**.
  Note: the new `/admin/views/*` routes gated by `ANALYTICS_VIEW` will therefore
  also be reachable by CLIENT_MANAGER (staff role). Flagged to owner; spec gates
  by `ANALYTICS_VIEW` only, which is what we implement.
- `EntitlementKey.VIEW_BASIC_STATS = 'view_basic_stats'` confirmed at
  `packages/billing/src/types/entitlement.types.ts:9`.

### T-002 — Schema exports verification (VERIFIED, no code)

- `TrackableEntityTypeSchema` (`entityView.schema.ts:31`) and `EntityViewStatsSchema`
  (`entityView.http.schema.ts:79`) re-exported via `export *` from the
  `entityView/index.ts` barrel.
- `EntityViewWindowSchema = z.enum(['7d','30d'])` (`entityView.query.schema.ts:30`),
  default constant `ENTITY_VIEW_DEFAULT_WINDOW = '30d'` (line 47).
- New SPEC-197 schemas should go in a new `entityView.admin.schema.ts` following the
  one-file-per-category convention, re-exported from the barrel.
- Admin route factory: `createAdminListRoute` / `createAdminRoute` defined in
  `apps/api/src/utils/route-factory-tiered.ts`, imported via the
  `apps/api/src/utils/route-factory` facade (use the facade, not the tiered file).

### T-003 — zodError keys (commit 2e8bdd9ef)

- `adminView` group added to `validation.json` es/en/pt (keys stored WITHOUT the
  `zodError.` prefix — `resolve-validation-message.ts` maps `zodError.X` → `validation.X`).
- check-locales ✓, i18n suite 626 tests ✓.

### T-012 — WindowToggle (commit 25897ecd2)

- `apps/admin/src/components/views/WindowToggle.tsx` + 4 tests ✓.
- No Shadcn ToggleGroup exists in the admin app — implemented the codebase-native
  segmented-toggle pattern (`DataTableToolbar.tsx`): `inline-flex rounded-md border`
  - native buttons with `aria-pressed` and `data-state`. Wrapper is a `<fieldset>`
  (implicit `group` role — biome `useSemanticElements` rejects `role="group"` on div).
- i18n keys `common.window.{7d,30d,ariaLabel}` es/en/pt; `packages/i18n/src/types.ts`
  regenerated via `pnpm --filter @repo/i18n generate-types` (required for new keys).
- Admin test setup mocks `useTranslations` as `t: (key) => key` — tests assert raw keys.

## 2026-06-05/06 — Core through closeout (21/21)

- **Core + routes (T-004..T-011)**: 3 EntityViewModel methods, 6 admin Zod schemas,
  4 EntityViewService admin methods (ANALYTICS_VIEW gate, lazy getter preserved),
  4 /admin/views/* routes via createAdminRoute + gate-matrix rows.
- **Frontend (T-013..T-019)**: new `views` widget type (ViewsWidget) filling the 3
  SPEC-159 deferred slots + admin-card-views; EntityViewStatChips via customRender
  SectionConfig; "Vistas (30d)" derived column ×3 (self-gated); /analytics/views page
  with requireAnalyticsViewAccess guard.
- **T-020 gate**: build 18/18, typecheck 36/36, ~18.9k tests green, CI guards green.
- **Impl PR #1472 merged** (pre-PR review caught UTC-window blocker + 4 majors, fixed
  with regression tests before opening).
- **T-021 real-DB + Chrome smoke** (4 roles: SUPER_ADMIN/ADMIN/EDITOR/HOST) found 4
  more issues → **PR #1473**: response envelope double-wrap on all 7 views routes,
  leftover SPEC-159 deferredSlot (editor card A), chips section raw-id title +
  collapsed default, missing analytics-views entry in `analisisSidebar` (sidebars.ts
  is the real menu source, not menu.ts).
- **Flags for owner**: locked state unreachable (billing defaults grant
  view_basic_stats with plan:null); editor dashboard legacy links 404
  (/contenido/posts, /catalogo/eventos); "ERRORES %" display bug in system status
  card; flaky addon-limit-recalculation timeouts in CI (engram: ci/flaky-addon-limit-recalculation-timeouts).
