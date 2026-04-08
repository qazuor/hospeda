/**
 * @file icon-map.ts
 * @description Local icon resolver for the web app. Maps icon name strings
 * used in homepage data files to their actual icon components.
 *
 * This avoids importing the full @repo/icons resolver (220+ icons) which
 * would prevent tree-shaking and bloat the client bundle. Only the icons
 * actually used by the web app are included here.
 */

import type { IconProps } from '@repo/icons';
import {
    BuildingIcon,
    CalendarDotsIcon,
    CompassIcon,
    PostIcon,
    SearchIcon,
    ShieldIcon,
    SparkleIcon,
    StarIcon,
    UsersIcon
} from '@repo/icons';
import type { ComponentType } from 'react';

/** Map of icon name strings to their React components. */
const WEB_ICON_MAP: Record<string, ComponentType<IconProps>> = {
    BuildingIcon,
    CalendarDotsIcon,
    CompassIcon,
    PostIcon,
    SearchIcon,
    ShieldIcon,
    SparkleIcon,
    StarIcon,
    UsersIcon
};

/**
 * Resolve an icon name string to its React component.
 * Returns undefined if the icon name is not in the local map.
 *
 * @example
 * ```ts
 * const Icon = resolveWebIcon('BuildingIcon');
 * if (Icon) return <Icon size={24} />;
 * ```
 */
export function resolveWebIcon({
    iconName
}: {
    readonly iconName: string;
}): ComponentType<IconProps> | undefined {
    return WEB_ICON_MAP[iconName];
}
