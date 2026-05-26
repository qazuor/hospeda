/**
 * Admin IA — ADMIN role configuration (T-012)
 *
 * The ADMIN has access to all 7 top-level sections, an admin-scoped dashboard,
 * full quick-create access, and a compact icon-only bottom nav on mobile (all 7
 * sections). The ADMIN dashboard is a subset of SUPER_ADMIN's — it excludes the
 * system-ops widgets (Sentry, crons, audit).
 *
 * Design source of truth:
 *   `.claude/audit/admin-redesign/proposals/01-information-architecture.md` §13.
 *
 * @see apps/admin/src/config/ia/schema.ts  — RoleConfigSchema
 * @see apps/admin/src/config/ia/sections.ts — Section IDs referenced in mainMenu
 * @see apps/admin/src/config/ia/dashboards.ts — Dashboard IDs
 */

import type { z } from 'zod';
import type { RoleConfigSchema } from '../schema';

/**
 * Role configuration for ADMIN.
 *
 * - All 7 sections are exposed in the main menu (same as SUPER_ADMIN).
 * - The `adminDashboard` shows global KPIs without the system-ops block that
 *   is reserved for SUPER_ADMIN (Sentry errors, failed crons, admin audit preview).
 * - Quick-create shows all registered create actions, filtered at render time by
 *   the user's permissions.
 * - Bottom nav exposes all 7 sections on mobile (icon-only compact mode); no FAB.
 * - No label overrides — canonical labels apply throughout.
 *
 * @example
 * ```ts
 * import { adminRole } from '@/config/ia/roles/admin';
 * adminRole.dashboard; // 'adminDashboard'
 * ```
 */
export const adminRole: z.input<typeof RoleConfigSchema> = {
    enabled: true,
    label: { es: 'Admin', en: 'Admin', pt: 'Admin' },
    mainMenu: [
        'inicio',
        'catalogo',
        'editorial',
        'comunidad',
        'comercial',
        'plataforma',
        'analisis'
    ],
    dashboard: 'adminDashboard',
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
