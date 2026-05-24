/**
 * Admin IA — SUPER_ADMIN role configuration (T-012)
 *
 * The SUPER_ADMIN has access to all 7 top-level sections, a dedicated
 * platform dashboard, full quick-create access, and no bottom nav (desktop
 * admin console only). No label overrides are needed — all labels are the
 * canonical defaults defined in the section and sidebar registries.
 *
 * Design source of truth:
 *   `.claude/audit/admin-redesign/proposals/01-information-architecture.md` §12.
 *
 * @see apps/admin/src/config/ia/schema.ts  — RoleConfigSchema
 * @see apps/admin/src/config/ia/sections.ts — Section IDs referenced in mainMenu
 * @see apps/admin/src/config/ia/dashboards.ts — Dashboard IDs
 */

import type { z } from 'zod';
import type { RoleConfigSchema } from '../schema';

/**
 * Role configuration for SUPER_ADMIN.
 *
 * - All 7 sections are exposed in the main menu.
 * - The `superAdminDashboard` shows platform-wide KPIs, MRR, and system health.
 * - Quick-create shows all registered create actions (filtered at render time by
 *   the user's actual permissions, which for SUPER_ADMIN is the full set).
 * - No bottom-nav or FAB — SUPER_ADMIN operates exclusively from desktop.
 * - No label overrides — canonical labels apply throughout.
 *
 * @example
 * ```ts
 * import { superAdminRole } from '@/config/ia/roles/super-admin';
 * superAdminRole.mainMenu; // ['inicio', 'catalogo', 'editorial', ...]
 * ```
 */
export const superAdminRole: z.input<typeof RoleConfigSchema> = {
    enabled: true,
    label: { es: 'Super admin', en: 'Super admin', pt: 'Super admin' },
    mainMenu: [
        'inicio',
        'catalogo',
        'editorial',
        'comunidad',
        'comercial',
        'plataforma',
        'analisis'
    ],
    dashboard: 'superAdminDashboard',
    topbar: {
        showSearch: true,
        showQuickCreate: 'all',
        accountInMenu: false
    },
    mobile: {
        bottomNav: null,
        fab: null
    }
};
