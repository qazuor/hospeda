/**
 * Admin IA — SUPER_ADMIN role configuration (T-012)
 *
 * The SUPER_ADMIN has access to all 7 top-level sections, the assembled
 * platform dashboard (base A–G + super-only H–I), full quick-create access,
 * and a compact icon-only bottom nav on mobile exposing all 7 sections.
 *
 * The SUPER_ADMIN dashboard (`superAdminDashboard`) is the assembled 9-card
 * view: `adminBaseDashboard` (cards A–G, shared with ADMIN) spread together
 * with `superAdminOnlySection` (cards H–I, `onMissing: 'hide'`).
 *
 * Design source of truth:
 *   `.claude/audit/admin-redesign/proposals/01-information-architecture.md` §12.
 *   `.qtm/specs/SPEC-155-admin-dashboards-v1/spec.md` §4 AC-8, AC-32.
 *
 * @see apps/admin/src/config/ia/schema.ts    — RoleConfigSchema
 * @see apps/admin/src/config/ia/sections.ts  — Section IDs referenced in mainMenu
 * @see apps/admin/src/config/ia/dashboards.ts — Dashboard IDs
 */

import type { z } from 'zod';
import type { RoleConfigSchema } from '../schema';

/**
 * Role configuration for SUPER_ADMIN.
 *
 * - All 7 sections are exposed in the main menu.
 * - The `superAdminDashboard` shows all 9 cards: base (A–G) + super-only (H–I).
 *   Cards H and I carry `onMissing: 'hide'` as a belt-and-suspenders guard;
 *   in practice only SUPER_ADMIN resolves to this dashboard at all.
 * - Quick-create shows all registered create actions (filtered at render time by
 *   the user's actual permissions, which for SUPER_ADMIN is the full set).
 * - Bottom nav exposes all 7 sections on mobile (icon-only compact mode); no FAB.
 * - No label overrides — canonical labels apply throughout.
 *
 * @example
 * ```ts
 * import { superAdminRole } from '@/config/ia/roles/super-admin';
 * superAdminRole.dashboard; // 'superAdminDashboard'
 * superAdminRole.mainMenu;  // ['inicio', 'catalogo', 'editorial', ...]
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
