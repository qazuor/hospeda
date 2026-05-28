# SPEC-156: Admin Settings Reorganization — V1 Page Consolidation

## Progress: 10/44 tasks (23%)

**Average Complexity:** 2.7/4 (max)
**Complexity Distribution:** 1→4 tasks · 2→12 tasks · 3→20 tasks · 4→8 tasks
**PR Strategy:** 4 PRs in order (tech-analysis D3) — PR-1 → PR-2 → PR-3 → PR-4
**Critical Path:** T-001 → T-002 → T-004 → T-009 → T-PR1-QG → T-028 → T-029 → T-PR3-QG → T-033 → T-034 → T-PR4-QG (~11 steps across all 4 PRs)
**Parallel Tracks (PR-2):** 14 independent route relocations (T-012..T-025) fan into T-026 IA config update

References:
- [spec.md](../../specs/SPEC-156-admin-settings-reorganization/spec.md)
- [tech-analysis.md](../../specs/SPEC-156-admin-settings-reorganization/tech-analysis.md)

---

## PR-1 — platform_settings infrastructure (11 tasks, depends on: SPEC-154 merged ✓)

Goal: ship the foundational DB table, service, admin + public endpoints, and the 8 new permissions so PR-2/3/4 can build on top.

### Setup Phase

- [x] **T-001** (complexity: 2) — ✅ Create `platform_settings` DB schema *(completed 2026-05-28)*
  - Schema only; migration generation deferred to future production-release prep (owner decision after discovering project does NOT use drizzle migration journal in dev — uses `db:push` directly per packages/db/CLAUDE.md).
  - Files: `packages/db/src/schemas/platform/{platform-settings.dbschema.ts,index.ts}` (new) + `packages/db/src/schemas/index.ts` (export added).

- [x] **T-002** (complexity: 2) — ✅ Create `PlatformSettings` model extending `BaseModelImpl` *(completed 2026-05-28)*
  - `findByKey(key, tx?)` + `upsertByKey(key, value, actorId, tx?)` via `insert().onConflictDoUpdate().returning()`. 5/5 unit tests passing. Singleton `platformSettingsModel` exported.
  - Files: `packages/db/src/models/platform/{platform-settings.model.ts,index.ts}` (new) + `packages/db/src/models/index.ts` (export added) + `packages/db/test/models/platform-settings.model.test.ts` (new).

- [x] **T-003** (complexity: 3) — ✅ Create Zod schemas (discriminated union by key) *(completed 2026-05-28)*
  - 6 schemas + discriminated union response. Dir naming follows repo convention `entities/platformSettings/` (camelCase). 22/22 tests passing, typecheck clean.
  - Files: `packages/schemas/src/entities/platformSettings/{platform-settings.schema.ts,index.ts}` (new) + `packages/schemas/src/entities/index.ts` (export added) + `packages/schemas/test/entities/platformSettings/platform-settings.schema.test.ts` (new).

- [x] **T-005** (complexity: 2) — ✅ Add 8 new permissions to `permission.enum.ts` *(completed 2026-05-28)*
  - All 8 entries added with JSDoc, dot-notation values, distinct from legacy perms. 14/14 new tests + 91/91 enum suite passing. Coexists with `SETTINGS_MANAGE`/`SYSTEM_MAINTENANCE_MODE`/`BILLING_READ_ALL`/`BILLING_MANAGE`.
  - Files: `packages/schemas/src/enums/permission.enum.ts` (8 entries appended) + `packages/schemas/src/enums/__tests__/permission-platform-settings.test.ts` (new, 14 tests).

- [x] **T-006** (complexity: 3) — ✅ Assign new permissions to role bundles + tests *(completed 2026-05-28)*
  - **Finding**: bundles live in `packages/seed/src/required/rolePermissions.seed.ts` (NOT in `@repo/schemas` as tech-analysis assumed). Wired all 8 perms across 7 roles per tech-analysis §2.3. 67 new tests + 118/118 suite passing. HOST has BILLING_VIEW_OWN but NOT BILLING_READ_ALL (SPEC-164 boundary preserved).
  - Files: `packages/seed/src/required/rolePermissions.seed.ts` (7 bundle blocks edited) + `packages/seed/test/required/rolePermissions.seed.test.ts` (SPEC-156 describe appended).

### Core Phase

- [x] **T-004** (complexity: 4) — ✅ `PlatformSettingsService` with SEO revalidation hook *(completed 2026-05-28)*
  - Extends `BaseService` (NOT `BaseCrudService` — key-value upsert doesn't fit CRUD-by-id). `get` + `upsert` methods with discriminated-union validation per key + permission gates + best-effort `revalidateByEntityType({ entityType: 'post' })` on SEO writes. 14/14 tests passing.
  - Files: `packages/service-core/src/services/platformSettings/{platform-settings.service.ts,index.ts}` (new) + `packages/service-core/src/services/index.ts` (export added) + `packages/service-core/test/services/platformSettings/platform-settings.service.test.ts` (new, 14 tests).

- [x] **T-007** (complexity: 3) — ✅ Wire `BILLING_VIEW_OWN` / `SUBSCRIPTION_VIEW_OWN` in billing middleware *(completed 2026-05-28)*
  - New `billingPermMiddleware` mounted in `createBillingRoutesHandler`. **T-006 expansion**: added perms to USER + CLIENT_MANAGER + SPONSOR (paying roles). EDITOR still excluded → middleware adds real value. 10/10 mw tests + 17/17 checkout integration + 126/126 rolePermissions.
  - Files: new `billing-perm.middleware.ts` + new test + extended `billing/index.ts` (mount) + extended `rolePermissions.seed.ts` (3 role bundles) + extended T-006 tests + `auth.ts` factories + `db-mock.ts` (PlatformSettingsModel stub).

- [x] **T-008** (complexity: 3) — ✅ Admin endpoint `GET /api/v1/admin/platform-settings/:key` *(completed 2026-05-28)*
  - `createAdminRoute` with `ACCESS_PANEL_ADMIN` defense-in-depth + per-key permission gate enforced at service layer. Returns row or null. Date → ISO-8601 serialization at boundary. 5/5 tests passing.
  - Files: `apps/api/src/routes/platform-settings/{admin/index.ts,index.ts}` (new) + `apps/api/src/routes/index.ts` (import + mount) + `apps/api/test/routes/platform-settings-admin.test.ts` (new, 5 tests).

- [x] **T-009** (complexity: 4) — ✅ Admin endpoint `PATCH /api/v1/admin/platform-settings/:key` *(completed 2026-05-28)*
  - Extends T-008 file with `adminPatchPlatformSettingsRoute`. Body `{ value: unknown }` at route; per-key discriminated validation in service. SEO writes trigger best-effort revalidation. 6/6 route tests + 14 service tests cover behavior.
  - Files: `apps/api/src/routes/platform-settings/admin/index.ts` (extended) + `apps/api/test/routes/platform-settings-admin.test.ts` (extended).

- [x] **T-010** (complexity: 3) — ✅ Public endpoint `GET /api/v1/public/announcements` *(completed 2026-05-28)*
  - Extended service with `findActiveAnnouncements()` (no actor, server-side date filter). `createPublicRoute` with `cacheTTL: 300` + rate limit. 4/4 route tests + 7 new service tests. URL spec-exact.
  - Files: extended `packages/service-core/src/services/platformSettings/platform-settings.service.ts` + tests + NEW `apps/api/src/routes/platform-settings/public/index.ts` + index update + mount in `apps/api/src/routes/index.ts` + NEW `apps/api/test/routes/platform-settings-public.test.ts`.

### Testing Phase

- [ ] **T-PR1-QG** (complexity: 2) — PR-1 quality gate + open PR to `staging`
  - typecheck + lint + tests + manual curl smoke.
  - Blocked by: T-007, T-009, T-010 · Blocks: T-029, T-028

---

## PR-2 — Page relocations + IA config (16 tasks, depends on: PR-1 merged)

Goal: move all 15+ pages to their new IA locations + add 301 redirects + update the SPEC-154 config + honest disclosure labels.

### Core Phase (relocations — all parallelizable)

- [ ] **T-012** (complexity: 2) — Move `/me/profile` → `/mi-cuenta/perfil` + 301 redirect
- [ ] **T-013** (complexity: 3) — Split `/me/settings` → `/mi-cuenta/preferencias.tsx`
- [ ] **T-014** (complexity: 3) — Split `/me/settings` → `/mi-cuenta/notificaciones.tsx` + honest disclosure on SMS/Push (blocks: T-026 · blocked by: T-013)
- [ ] **T-015** (complexity: 2) — Move `/me/change-password` → `/mi-cuenta/seguridad/cambiar-password.tsx` + redirect
- [ ] **T-016** (complexity: 1) — New `/mi-cuenta/seguridad/index.tsx` landing (blocked by: T-015)
- [ ] **T-017** (complexity: 1) — New `/mi-cuenta/datos.tsx` GDPR placeholder
- [ ] **T-018** (complexity: 1) — Move `/me/tags` → `/mi-cuenta/etiquetas` + redirect
- [ ] **T-019** (complexity: 3) — Move `/settings/critical` → `/plataforma/critical` + redirect (DATA layer preserved; rewritten in PR-3)
- [ ] **T-020** (complexity: 3) — Move `/settings/seo` → `/plataforma/configuracion/seo` + redirect (DATA layer preserved)
- [ ] **T-021** (complexity: 2) — Move `/revalidation` → `/plataforma/cache/revalidacion` + redirect (preserve 3 tabs)
- [ ] **T-022** (complexity: 1) — Move `/billing/cron` → `/plataforma/ops/cron` + redirect
- [ ] **T-023** (complexity: 2) — Move `/billing/webhook-events` → `/plataforma/ops/webhooks` + redirect
- [ ] **T-024** (complexity: 2) — Move `/billing/notification-logs` → `/plataforma/email/logs` + redirect
- [ ] **T-025** (complexity: 3) — Move `/tags/internal` + `/tags/system` → `/plataforma/tags/{internas,sistema}` + 6 redirect files

### Integration Phase

- [ ] **T-026** (complexity: 4) — Update IA config (`sidebars.ts`, `roles/*.ts`, `sections.ts`, tests) for new sections + routes
  - Single config edit surfaces all relocations (SPEC-154 promise).
  - Blocked by: T-012..T-025 (all relocations) · Blocks: T-PR2-QG

### Testing Phase

- [ ] **T-PR2-QG** (complexity: 2) — PR-2 quality gate + open PR to `staging`
  - Blocked by: T-026, T-PR1-QG · Blocks: T-029, T-030

---

## PR-3 — localStorage → API migration (5 tasks, depends on: PR-1 + PR-2 merged)

Goal: switch the data source of `/plataforma/critical` and `/plataforma/configuracion/seo` from per-browser localStorage to the new admin endpoints. Helper migrates existing localStorage values on first load per browser (tech-analysis D4).

### Integration Phase

- [ ] **T-028** (complexity: 4) — Create localStorage→API migration helper utility
  - Per-browser one-shot with cookie flag `_settings_migrated`. Idempotent. Preserves localStorage on PATCH failure.
  - Blocked by: T-PR1-QG · Blocks: T-029, T-030, T-PR3-QG

- [ ] **T-029** (complexity: 4) — Rewrite `/plataforma/critical` data source: localStorage → API
  - TanStack Query + PATCH mutation. Permission gate `MAINTENANCE_MODE_WRITE`.
  - Blocked by: T-019, T-028, T-009, T-PR2-QG · Blocks: T-PR3-QG

- [ ] **T-030** (complexity: 3) — Rewrite `/plataforma/configuracion/seo` data source: localStorage → API
  - Auto-revalidation server-side; UI toast acknowledges it.
  - Blocked by: T-020, T-028, T-009, T-PR2-QG · Blocks: T-031, T-PR3-QG

### Testing Phase

- [ ] **T-031** (complexity: 3) — Integration test: SEO PATCH triggers auto-revalidation
  - Asserts the cross-service wiring works.
  - Blocked by: T-030 · Blocks: T-PR3-QG

- [ ] **T-PR3-QG** (complexity: 2) — PR-3 quality gate + open PR + cross-device smoke
  - Verify maintenance toggle reflects across browsers; SEO change revalidates web pages.
  - Blocked by: T-029, T-030, T-031 · Blocks: T-033, T-038

---

## PR-4 — Mi facturación HOST + anuncios + web display + smoke (12 tasks, depends on: PR-1+2+3 merged)

Goal: ship the HOST self-billing landing page, the announcements editor, the web display component, and the final per-role smoke + permission audit. Closes Admin V1.

### Core Phase

- [ ] **T-033** (complexity: 3) — Mi facturación landing route `/mi-cuenta/facturacion` + permission gate
  - `BILLING_VIEW_OWN` + `SUBSCRIPTION_VIEW_OWN`.
  - Blocked by: T-PR3-QG, T-007, T-019 · Blocks: T-034, T-036, T-037, T-042, T-043

- [ ] **T-034** (complexity: 4) — `SubscriptionSummarySection` component (Mi plan actual)
  - Consumes `/protected/billing/subscriptions?pageSize=1` + `/protected/billing/invoices?pageSize=1&sort=date_desc`.
  - Blocked by: T-033 · Blocks: T-PR4-QG

- [ ] **T-035** (complexity: 3) — Standalone `<UsageProgressBar>` component
  - Thresholds: 80% warning, 95% danger, 100% blocked. NOT widget infra (tech-analysis D5).
  - Blocked by: none · Blocks: T-036

- [ ] **T-036** (complexity: 3) — `PlanUsageSection` component (Uso de mi plan)
  - Consumes `/protected/billing/usage`. Uses `UsageProgressBar`. Shows "Actualizar plan" CTA at danger threshold.
  - Blocked by: T-033, T-035 · Blocks: T-PR4-QG

- [ ] **T-037** (complexity: 3) — `BillingActionsSection` component (Actions)
  - Deep links to web via `PUBLIC_WEB_URL` + single path constant.
  - Blocked by: T-033 · Blocks: T-PR4-QG

- [ ] **T-038** (complexity: 3) — Anuncios editor — list view `/plataforma/critical/anuncios/index.tsx`
  - Permission gate `MAINTENANCE_MODE_WRITE` (SUPER_ADMIN).
  - Blocked by: T-PR3-QG · Blocks: T-039, T-040, T-PR4-QG

- [ ] **T-039** (complexity: 4) — Anuncios editor — create form (`new.tsx`)
  - i18n ×3 + variant + dismissible + dates. Zod `safeParse` inside handler (admin convention).
  - Blocked by: T-038 · Blocks: T-PR4-QG

- [ ] **T-040** (complexity: 3) — Anuncios editor — edit form (`$id.edit.tsx`)
  - Mirror of T-039 with pre-fill.
  - Blocked by: T-038, T-039 · Blocks: T-PR4-QG

### Integration Phase

- [ ] **T-041** (complexity: 4) — Web `<GlobalAnnouncements>` Astro component
  - Consumes `/api/v1/public/announcements`. Renders banners with variant + dismissible cookie state. CSS Modules (web convention).
  - Blocked by: T-010 · Blocks: T-PR4-QG

### Testing Phase

- [ ] **T-042** (complexity: 3) — Per-role manual smoke test (settings tour checklist)
  - Uses SPEC-143 dev `*@local.test` users. Documented checklist with sign-off per role.
  - Blocked by: T-034, T-036, T-037, T-038, T-039, T-040, T-041 · Blocks: T-PR4-QG

- [ ] **T-043** (complexity: 3) — Permission gate audit + automated AC test
  - Parametrized test asserting each AC-22..AC-27 gate enforces.
  - Blocked by: T-033 · Blocks: T-PR4-QG

- [ ] **T-PR4-QG** (complexity: 2) — PR-4 quality gate + open PR + post-soak staging→main promotion
  - Final SPEC-156 verification + index updates + engram `spec/SPEC-156/completed` + schedule cleanup follow-up.
  - Blocked by: T-034, T-036, T-037, T-038, T-039, T-040, T-041, T-042, T-043 · Blocks: none

---

## Dependency Graph (high-level by level)

```
Level 0 (parallel, no deps):  T-001, T-003, T-005, T-012, T-013, T-015, T-017, T-018,
                              T-019, T-020, T-021, T-022, T-023, T-024, T-025, T-035
Level 1:                      T-002, T-006, T-014, T-016
Level 2:                      T-004, T-007
Level 3:                      T-008, T-010
Level 4:                      T-009, T-026, T-041 (waits on T-010 only)
Level 5:                      T-PR1-QG, T-PR2-QG
Level 6:                      T-028
Level 7:                      T-029, T-030
Level 8:                      T-031
Level 9:                      T-PR3-QG
Level 10:                     T-033, T-038
Level 11:                     T-034, T-036, T-037, T-039, T-043
Level 12:                     T-040
Level 13:                     T-042
Level 14:                     T-PR4-QG
```

PR-2 page relocation tasks (T-012..T-025) are all at Level 0 — fully parallelizable (each is independent route move). The bottleneck is T-026 (IA config update) which gathers all of them.

---

## Suggested start

Begin with the PR-1 setup-phase tasks that have no dependencies — these can run in parallel:

1. **T-001** (complexity: 2) — DB schema + migration (foundation for everything else in PR-1)
2. **T-003** (complexity: 3) — Zod schemas (independent, unblocks 4 tasks)
3. **T-005** (complexity: 2) — New permissions enum entries (independent, unblocks role bundles)

After these, T-002 + T-006 unlock, then the rest of PR-1 cascades.

While PR-1 backend work is in progress, PR-2 page relocations (T-012..T-025) can also start since they only depend on the IA config update (T-026) which is gated by all of them — purely parallel work, no blockers from PR-1 for the route moves themselves.

---

## Notes

- **All decisions D1-D8 resolved on 2026-05-28.** Owner overrode R1 (chose to create new permissions literal vs map to existing). D2 (web display), D3 (4 PRs), D8 (`/mi-cuenta/facturacion` path) all aligned with recommendations. D4-D7 applied with default recommendations.
- **PR ordering is strict**: PR-2/3/4 depend on prior PRs being merged to staging. Each PR has its own quality gate (T-PR{1-4}-QG) covering typecheck + lint + tests + manual smoke per CLAUDE.md branch workflow.
- **Billing smoke not required** for PR-1 (no billing core changes — only adds gating perms + reads existing endpoints). Per-role smoke for PR-4 (T-042) covers the user-facing surface.
- **Migration helper cleanup** is scheduled as a follow-up task ~30 days post-deploy (tech-analysis D4) — NOT part of SPEC-156.
- **IDs T-011, T-027, T-032 intentionally skipped** to keep quality-gate markers (T-PR{1-3}-QG) visually distinct from regular tasks. Numbering is sparse but unique.
