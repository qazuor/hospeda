/**
 * @file business-verticals.ts
 * @description The «Administrar …» shortcuts a person can use (HOS-2551).
 *
 * Who has a business vertical is NOT decided here: it is
 * `resolveBusinessVerticals` from `@repo/schemas` (HOS-2562), the one rule the
 * API also applies to the MCP OAuth flow. This module only maps each granted
 * vertical to its shortcut and picks the first destination the person's
 * permissions open. The header user menu and the «real client» gate of
 * «Asistentes de IA» therefore read the same answer, on both sides.
 *
 * Pure: the caller passes the effective permissions and the ownership facts.
 *
 * @module lib/business-verticals
 */

import type { IconProps } from '@repo/icons';
import {
    type BusinessOwnershipFacts,
    type ResolveBusinessVerticalsInput,
    resolveBusinessVerticals
} from '@repo/schemas';
import type { ComponentType } from 'react';
import { BUSINESS_SHORTCUTS, type BusinessShortcut } from '@/config/account-zones';
import { isVisibleByPermissions } from '@/lib/nav-gating';

export type { BusinessOwnershipFacts };

/** Input for {@link resolveBusinessShortcuts}. */
export type ResolveBusinessShortcutsParams = ResolveBusinessVerticalsInput;

/** A shortcut the person can use, with its destination resolved. */
export interface ResolvedBusinessShortcut {
    /** Stable id (the business vertical). */
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
 * @param params - Effective permissions and ownership facts.
 * @returns The visible shortcuts; empty for a pure tourist.
 */
export function resolveBusinessShortcuts(
    params: ResolveBusinessShortcutsParams
): readonly ResolvedBusinessShortcut[] {
    const granted = new Set(resolveBusinessVerticals(params).verticals);
    return BUSINESS_SHORTCUTS.flatMap((shortcut) => {
        if (!granted.has(shortcut.id)) return [];
        const target = shortcut.targets.find((candidate) =>
            isVisibleByPermissions(candidate, params.permissions)
        );
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
