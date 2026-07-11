/**
 * @file admin-panel-link.ts
 * @description Shared "admin panel" session-zone link (HOS-131 §6.4/§6.5) —
 * consumed by BOTH `UserMenu.client.tsx` (avatar dropdown session zone) and
 * `MobileMenu.client.tsx` (mobile hamburguesa session zone). NOT a config
 * nav item — its label toggles between staff and host phrasing based on
 * `STAFF_DISCRIMINATOR_PERMISSION`, which the generic i18n-keyed `NavItem`
 * shape in `src/config/navigation.ts` doesn't model, so it stays a small
 * standalone module rather than living in `ACCOUNT_NAV_GROUPS`.
 */

import { type IconProps, ShieldIcon } from '@repo/icons';
import type { ComponentType } from 'react';
import type { SupportedLocale } from '@/lib/i18n';

/** Permission gating the admin-panel session link. */
export const ADMIN_PANEL_PERMISSION = 'access.panelAdmin' as const;

/**
 * Permission that distinguishes platform staff (ADMIN / SUPER_ADMIN /
 * CLIENT_MANAGER / EDITOR) from a HOST. All five roles share
 * `access.panelAdmin`, but only staff get `access.apiAdmin`. Used to pick
 * between the "Modo anfitrión" label (a HOST that just got admin access to
 * manage their own listings) and "Panel de administración" (actual Hospeda
 * staff doing platform-wide work). Also fed to PostHog as `is_staff` by
 * `UserMenu.client.tsx`.
 */
export const STAFF_DISCRIMINATOR_PERMISSION = 'access.apiAdmin' as const;

const ADMIN_PANEL_LABELS = {
    es: { adminPanel: 'Panel de administración', hostMode: 'Modo anfitrión' },
    en: { adminPanel: 'Admin panel', hostMode: 'Host mode' },
    pt: { adminPanel: 'Painel de administração', hostMode: 'Modo anfitrião' }
} as const;

/** The resolved admin-panel session link. */
export interface AdminPanelItem {
    readonly label: string;
    readonly href: string;
    readonly icon: ComponentType<IconProps>;
}

/** Input for `buildAdminPanelItem`. */
export interface BuildAdminPanelItemParams {
    /** Current locale, used to resolve the staff/host label. */
    readonly locale: SupportedLocale;
    /** Admin panel base URL. `undefined` (env var not configured) always hides the link. */
    readonly adminPanelUrl: string | undefined;
    /** The user's effective permission strings (pass `[]` while loading — fail-closed). */
    readonly permissions: readonly string[];
}

/**
 * Builds the session-zone admin-panel link, or `null` when unavailable (no
 * `adminPanelUrl` configured, or the user lacks `ADMIN_PANEL_PERMISSION`).
 *
 * @param params - `{ locale, adminPanelUrl, permissions }` (RO-RO).
 * @returns The resolved `AdminPanelItem`, or `null`.
 */
export function buildAdminPanelItem({
    locale,
    adminPanelUrl,
    permissions
}: BuildAdminPanelItemParams): AdminPanelItem | null {
    if (!adminPanelUrl || !permissions.includes(ADMIN_PANEL_PERMISSION)) {
        return null;
    }
    const labels = ADMIN_PANEL_LABELS[locale] ?? ADMIN_PANEL_LABELS.es;
    const isStaff = permissions.includes(STAFF_DISCRIMINATOR_PERMISSION);
    return {
        label: isStaff ? labels.adminPanel : labels.hostMode,
        href: adminPanelUrl,
        icon: ShieldIcon
    };
}
