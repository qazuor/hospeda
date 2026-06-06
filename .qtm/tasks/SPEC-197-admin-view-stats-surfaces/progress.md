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
