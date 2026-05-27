/**
 * Dashboard Data-Source Registration Index — SPEC-155 T-018..T-021
 *
 * This barrel file is the **single import point** that triggers all per-role
 * `registerDataSource()` calls at module load time. Import this file once in
 * the application entry point (or the dashboard page) to ensure every role's
 * sources are registered before any widget renderer calls `resolveDataSource`.
 *
 * ## Module load order
 *
 * The registration order must respect the duplicate-detection guard in
 * `dashboard-sources.ts`: sources registered in `dashboard-sources.ts` itself
 * (T-017 built-ins: `admin.entities.counts`, `admin.users.stats`) run first
 * because they are registered at `dashboard-sources.ts` module load time.
 * The per-role files below extend the registry without re-registering the
 * built-in sources.
 *
 * ## Usage
 *
 * ```ts
 * // In apps/admin/src/router.tsx or the dashboard route:
 * import '@/lib/dashboard-sources/index';
 * ```
 *
 * @module dashboard-sources/index
 * @see apps/admin/src/lib/dashboard-sources.ts — T-017 built-ins + registry API
 * @see apps/admin/src/lib/dashboard-sources/host.ts — T-018: HOST sources
 * @see apps/admin/src/lib/dashboard-sources/editor.ts — T-019: EDITOR sources
 * @see apps/admin/src/lib/dashboard-sources/admin.ts — T-020: ADMIN/SUPER base sources
 * @see apps/admin/src/lib/dashboard-sources/super.ts — T-021: SUPER_ADMIN-only sources
 */

// Side-effect imports — each module registers its sources at load time.
import './host';
import './editor';
import './admin';
import './super';
