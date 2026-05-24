/**
 * Admin IA — HOST role configuration (T-013)
 *
 * The HOST sees only the sections relevant to managing their own accommodation
 * portfolio: their personal hub, their listings, guest inquiries, billing, and
 * account settings. The dashboard label is overridden to "Mi negocio" to reflect
 * the business-owner framing appropriate for this role.
 *
 * Design source of truth:
 *   `.claude/audit/admin-redesign/proposals/01-information-architecture.md` §16.
 *
 * @see apps/admin/src/config/ia/schema.ts  — RoleConfigSchema
 * @see apps/admin/src/config/ia/sections.ts — Section IDs referenced in mainMenu
 * @see apps/admin/src/config/ia/dashboards.ts — Dashboard IDs
 * @see apps/admin/src/config/ia/sidebars.ts  — inicioSidebar (item 'dashboard' overridden here)
 */

import type { z } from 'zod';
import type { RoleConfigSchema } from '../schema';

/**
 * Role configuration for HOST.
 *
 * - Scoped main menu: personal hub, own accommodations, guest inquiries, billing,
 *   and account settings.
 * - The `hostDashboard` shows KPIs scoped to the host's own data (active listings,
 *   month revenue, upcoming check-ins, subscription status — SPEC-155 will fill
 *   in the real widget set).
 * - Quick-create is limited to `newAccommodation` — the only entity a HOST creates.
 * - Account link is surfaced in the main nav (not hidden to the avatar dropdown)
 *   so HOST can navigate to `miCuenta` directly.
 * - Bottom nav surfaces the 4 most-used sections for mobile access.
 * - FAB is the single most common action: create a new accommodation.
 * - `labelOverrides`: the `inicioSidebar.dashboard` item label is changed to
 *   "Mi negocio" to reflect the host's business context rather than a generic
 *   "Dashboard" label.
 *
 * @example
 * ```ts
 * import { hostRole } from '@/config/ia/roles/host';
 * hostRole.mobile.fab; // 'newAccommodation'
 * hostRole.labelOverrides['inicioSidebar.dashboard'].es; // 'Mi negocio'
 * ```
 */
export const hostRole: z.input<typeof RoleConfigSchema> = {
    enabled: true,
    label: { es: 'Anfitrión', en: 'Host', pt: 'Anfitrião' },
    mainMenu: ['inicio', 'misAlojamientos', 'consultas', 'miFacturacion', 'miCuenta'],
    dashboard: 'hostDashboard',
    topbar: {
        showSearch: false,
        showQuickCreate: ['newAccommodation'],
        accountInMenu: true
    },
    mobile: {
        bottomNav: ['inicio', 'misAlojamientos', 'consultas', 'miCuenta'],
        fab: 'newAccommodation'
    },
    labelOverrides: {
        'inicioSidebar.dashboard': {
            es: 'Mi negocio',
            en: 'My business',
            pt: 'Meu negócio'
        }
    }
};
