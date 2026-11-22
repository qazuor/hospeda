/**
 * @file business-verticals.ts
 * @description Resolves the business verticals a person has (HOS-2551), from
 * the `BUSINESS_SHORTCUTS` catalog. One answer feeds the header user menu's
 * «Administración» block and the «real client» check that gates «Asistentes
 * de IA», so the two can never disagree.
 *
 * Pure: the caller passes the visibility predicate (`isVisibleByPermissions`
 * on the client, `isVisibleByRoles` on the server) and the ownership facts.
 *
 * @module lib/business-verticals
 */

import type { IconProps } from '@repo/icons';
import type { ComponentType } from 'react';
import { BUSINESS_SHORTCUTS, type BusinessShortcut } from '@/config/account-zones';
import type { NavVisibilityPredicate } from '@/config/navigation';

/** Row-ownership facts (from `/auth/me`) that grant a vertical. */
export interface BusinessOwnershipFacts {
    /** The account owns a host-trade directory listing (provider). */
    readonly ownsHostTradeListing: boolean;
    /** The account owns a partner row. */
    readonly ownsPartner: boolean;
}

/** Input for {@link resolveBusinessShortcuts}. */
export interface ResolveBusinessShortcutsParams extends BusinessOwnershipFacts {
    /** Permission/role predicate for the gated shortcuts. */
    readonly visibility: NavVisibilityPredicate;
}

/** A shortcut the person can use, with its destination resolved. */
export interface ResolvedBusinessShortcut {
    /** Stable id. */
    readonly id: BusinessShortcut['id'];
    /** i18n key of the label. */
    readonly i18nKey: string;
    /** Icon. */
    readonly icon: ComponentType<IconProps>;
    /** Path segment under the locale. */
    readonly href: string;
}

/**
 * Lists the «Administrar …» shortcuts a person can use, in catalog order.
 *
 * @param params - See {@link ResolveBusinessShortcutsParams}.
 * @returns The visible shortcuts; empty for a pure tourist.
 */
export function resolveBusinessShortcuts({
    visibility,
    ownsHostTradeListing,
    ownsPartner
}: ResolveBusinessShortcutsParams): readonly ResolvedBusinessShortcut[] {
    return BUSINESS_SHORTCUTS.flatMap((shortcut) => {
        const owned =
            shortcut.ownership === 'hostTradeListing'
                ? ownsHostTradeListing
                : shortcut.ownership === 'partner'
                  ? ownsPartner
                  : visibility(shortcut);
        if (!owned) return [];
        const target = shortcut.targets.find((candidate) => visibility(candidate));
        if (!target) return [];
        return [
            {
                id: shortcut.id,
                i18nKey: shortcut.i18nKey,
                icon: shortcut.icon,
                href: target.href
            }
        ];
    });
}

/**
 * Whether the person is a real client: at least one business vertical.
 *
 * @param params - See {@link ResolveBusinessShortcutsParams}.
 * @returns `true` when {@link resolveBusinessShortcuts} lists anything.
 */
export function hasBusinessVertical(params: ResolveBusinessShortcutsParams): boolean {
    return resolveBusinessShortcuts(params).length > 0;
}
