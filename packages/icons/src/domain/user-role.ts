/**
 * @file domain/user-role.ts
 * @description Single source of truth for the user-role → visual mapping
 * ({ icon, colorToken }). Shared by `apps/web` and `apps/admin` so a given
 * user role renders with the SAME icon and the SAME color in both surfaces.
 *
 * Keys are lowercase role slugs (matching the lowercased `RoleEnum` values).
 * Unknown roles fall back to `UserIcon` + the `user-role-user` token.
 */

import type { ComponentType } from 'react';
import { EditIcon } from '../icons/actions/EditIcon';
import { AdminIcon } from '../icons/system/AdminIcon';
import { BuildingIcon } from '../icons/system/BuildingIcon';
import { ConfigurationIcon } from '../icons/system/ConfigurationIcon';
import { ShieldIcon } from '../icons/system/ShieldIcon';
import { UserIcon } from '../icons/system/UserIcon';
import { UserSwitchIcon } from '../icons/system/UserSwitchIcon';
import type { IconProps } from '../types';

export interface UserRoleColorScheme {
    readonly bg: string;
    readonly text: string;
    readonly border: string;
}

export interface UserRoleVisual {
    readonly icon: ComponentType<IconProps>;
    /** Per-role design-token name (e.g. `'user-role-admin'`). */
    readonly colorToken: string;
}

/**
 * Canonical user-role → visual map. Keys are lowercase role slugs.
 */
export const USER_ROLE_VISUALS: Readonly<Record<string, UserRoleVisual>> = {
    super_admin: { icon: ShieldIcon, colorToken: 'user-role-super-admin' },
    admin: { icon: AdminIcon, colorToken: 'user-role-admin' },
    editor: { icon: EditIcon, colorToken: 'user-role-editor' },
    host: { icon: BuildingIcon, colorToken: 'user-role-host' },
    user: { icon: UserIcon, colorToken: 'user-role-user' },
    guest: { icon: UserSwitchIcon, colorToken: 'user-role-guest' },
    system: { icon: ConfigurationIcon, colorToken: 'user-role-system' }
};

export const USER_ROLE_FALLBACK_VISUAL: UserRoleVisual = {
    icon: UserIcon,
    colorToken: 'user-role-user'
};

interface UserRoleParams {
    /** Role slug (case-insensitive, e.g. `'SUPER_ADMIN'` or `'host'`). */
    readonly role: string;
}

export function getUserRoleVisual({ role }: UserRoleParams): UserRoleVisual {
    return USER_ROLE_VISUALS[role.toLowerCase()] ?? USER_ROLE_FALLBACK_VISUAL;
}

export function getUserRoleIcon({ role }: UserRoleParams): ComponentType<IconProps> {
    return getUserRoleVisual({ role }).icon;
}

export type UserRoleColorVariant = 'subtle' | 'contrast';

export function getUserRoleColorScheme({
    role,
    variant = 'subtle'
}: UserRoleParams & {
    readonly variant?: UserRoleColorVariant;
}): UserRoleColorScheme {
    const cssToken = getUserRoleVisual({ role }).colorToken;

    if (variant === 'contrast') {
        return {
            bg: `oklch(from var(--${cssToken}) 0.95 calc(c * 0.55) h)`,
            text: `oklch(from var(--${cssToken}) 0.4 c h)`,
            border: `oklch(from var(--${cssToken}) 0.88 calc(c * 0.55) h)`
        };
    }

    return {
        bg: `oklch(from var(--${cssToken}) l c h / 0.15)`,
        text: `var(--${cssToken})`,
        border: `oklch(from var(--${cssToken}) l c h / 0.3)`
    };
}
