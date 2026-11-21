/**
 * @file account-nav-icons.ts
 * @description Icon per account nav entry id (HOS-2413 review fix).
 *
 * Icon components cannot cross an Astro island boundary, so the hydrated
 * `AccountBar` cannot receive them as props from the shell. They are resolved
 * here, from the same single-source nav config the sidebar uses, and imported
 * directly by whichever component renders the links (the server shell and the
 * mobile drawer), so both draw the same icons.
 *
 * @module lib/account-nav-icons
 */

import type { IconProps } from '@repo/icons';
import type { ComponentType } from 'react';
import { ACCOUNT_DISCOVERY_DOORS } from '@/config/discovery-doors';
import { ACCOUNT_NAV_GROUPS, PROVIDER_NAV_GROUP } from '@/config/navigation';

/** Nav entry id (item or door) to its icon component. */
export const ACCOUNT_NAV_ICONS: Readonly<Record<string, ComponentType<IconProps>>> =
    Object.fromEntries([
        ...[...ACCOUNT_NAV_GROUPS, PROVIDER_NAV_GROUP].flatMap((group) =>
            group.items.map((item) => [item.id, item.icon] as const)
        ),
        ...ACCOUNT_DISCOVERY_DOORS.map((door) => [door.id, door.icon] as const)
    ]);
