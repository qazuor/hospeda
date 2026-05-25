/**
 * Admin IA — EDITOR role configuration (T-013)
 *
 * The EDITOR is a content-focused role with access to the personal hub, the full
 * editorial section, analytics, and their account settings. The dashboard is
 * relabelled "Dashboard editorial" to match the role's framing. Quick-create
 * surfaces the three main content creation actions.
 *
 * Design source of truth:
 *   `.claude/audit/admin-redesign/proposals/01-information-architecture.md` §17.
 *
 * @see apps/admin/src/config/ia/schema.ts  — RoleConfigSchema
 * @see apps/admin/src/config/ia/sections.ts — Section IDs referenced in mainMenu
 * @see apps/admin/src/config/ia/dashboards.ts — Dashboard IDs
 * @see apps/admin/src/config/ia/create-actions.ts — Action IDs in showQuickCreate
 */

import type { z } from 'zod';
import type { RoleConfigSchema } from '../schema';

/**
 * Role configuration for EDITOR.
 *
 * - Scoped main menu: personal hub, editorial, analytics, and account settings.
 * - The `editorDashboard` shows editorial KPIs (posts published, upcoming events,
 *   newsletter stats, editorial calendar — SPEC-155 will fill in the real widgets).
 * - Quick-create exposes `newPost`, `newEvent`, and `newCampaign` — the three
 *   primary content creation actions for this role.
 * - Account link is surfaced in the main nav because EDITOR is not a power user
 *   who works exclusively from the sidebar.
 * - Bottom nav surfaces the 4 sections that match the main menu for mobile parity.
 * - FAB defaults to the most frequent editorial action: create a new post.
 * - `labelOverrides`: the `inicioSidebar.dashboard` item label is changed to
 *   "Dashboard editorial" to reinforce the editorial context for this role.
 *
 * @example
 * ```ts
 * import { editorRole } from '@/config/ia/roles/editor';
 * editorRole.topbar.showQuickCreate; // ['newPost', 'newEvent', 'newCampaign']
 * editorRole.mobile.fab; // 'newPost'
 * ```
 */
export const editorRole: z.input<typeof RoleConfigSchema> = {
    enabled: true,
    label: { es: 'Editor', en: 'Editor', pt: 'Editor' },
    mainMenu: ['inicio', 'editorial', 'analisis', 'miCuenta'],
    dashboard: 'editorDashboard',
    topbar: {
        showSearch: true,
        showQuickCreate: ['newPost', 'newEvent', 'newCampaign'],
        accountInMenu: true
    },
    mobile: {
        bottomNav: ['inicio', 'editorial', 'analisis', 'miCuenta'],
        fab: 'newPost'
    },
    labelOverrides: {
        'inicioSidebar.dashboard': {
            es: 'Dashboard editorial',
            en: 'Editorial dashboard',
            pt: 'Painel editorial'
        }
    }
};
