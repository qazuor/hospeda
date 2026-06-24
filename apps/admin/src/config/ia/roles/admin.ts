/**
 * Admin IA — ADMIN role configuration (T-012)
 *
 * The ADMIN has access to all 7 top-level sections, the shared admin base
 * dashboard (cards A–G), full quick-create access, and a compact icon-only
 * bottom nav on mobile (all 7 sections).
 *
 * The ADMIN dashboard (`adminBaseDashboard`) is the shared 7-card base.
 * Cards H–I (Audit Logs + Billing stats) are SUPER_ADMIN-only and exist only
 * in `superAdminOnlySection` / `superAdminDashboard` — ADMIN never receives
 * them because they are absent from `adminBaseDashboard` by config.
 *
 * Design source of truth:
 *   `.claude/audit/admin-redesign/proposals/01-information-architecture.md` §13.
 *   `.qtm/specs/SPEC-155-admin-dashboards-v1/spec.md` §4 AC-8, AC-31.
 *
 * @see apps/admin/src/config/ia/schema.ts    — RoleConfigSchema
 * @see apps/admin/src/config/ia/sections.ts  — Section IDs referenced in mainMenu
 * @see apps/admin/src/config/ia/dashboards.ts — Dashboard IDs
 */

import type { z } from 'zod';
import type { RoleConfigSchema } from '../schema';

/**
 * Role configuration for ADMIN.
 *
 * - All 7 sections are exposed in the main menu (same as SUPER_ADMIN).
 * - The `adminBaseDashboard` shows cards A–G (shared with SUPER_ADMIN base).
 *   SUPER_ADMIN-only cards H–I are absent from this dashboard by config
 *   (SPEC-155 AC-31) — no permission check required to hide them from ADMIN.
 * - Quick-create shows all registered create actions, filtered at render time by
 *   the user's permissions.
 * - Bottom nav exposes all 7 sections on mobile (icon-only compact mode); no FAB.
 * - No label overrides — canonical labels apply throughout.
 *
 * @example
 * ```ts
 * import { adminRole } from '@/config/ia/roles/admin';
 * adminRole.dashboard; // 'adminBaseDashboard'
 * ```
 */
export const adminRole: z.input<typeof RoleConfigSchema> = {
    enabled: true,
    label: { es: 'Admin', en: 'Admin', pt: 'Admin' },
    mainMenu: [
        'inicio',
        'catalogo',
        'editorial',
        'marketing',
        'comunidad',
        'comercial',
        'plataforma',
        'analisis'
    ],
    dashboard: 'adminBaseDashboard',
    topbar: {
        showSearch: true,
        showQuickCreate: 'all',
        accountInMenu: false
    },
    mobile: {
        bottomNav: [
            'inicio',
            'catalogo',
            'editorial',
            'comunidad',
            'comercial',
            'plataforma',
            'analisis'
        ],
        fab: null
    }
};
