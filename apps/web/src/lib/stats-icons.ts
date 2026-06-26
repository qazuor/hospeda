/**
 * @file stats-icons.ts
 * @description Minimal icon resolver for the homepage `StatsSection` /
 * `AnimatedCounter` island.
 *
 * WHY THIS EXISTS:
 * `AnimatedCounter` previously resolved its icon through the app-wide
 * `WEB_ICON_MAP` (`@/lib/icon-map`, ~77 icons). That map is statically
 * imported, so `AnimatedCounter` — which is EAGERLY hydrated on the home —
 * dragged all 77 icons into the homepage bundle even though the stats grid
 * only ever renders five. This module isolates just the icons the stats grid
 * uses, so the home pays for five icons instead of seventy-seven.
 *
 * UNIVERSE:
 * The only consumer of `AnimatedCounter` is
 * `apps/web/src/components/sections/StatsSection.astro`, and the only icon
 * names it passes come from `apps/web/src/pages/[lang]/index.astro`
 * (`platformStats`): `BuildingIcon`, `CompassIcon`, `StarIcon`, `PostIcon`,
 * `CalendarDotsIcon`.
 *
 * ADDING ICONS: if `StatsSection` gains a new stat with a new icon name, add
 * the named import here and the corresponding entry to `STATS_ICON_MAP`. Do
 * NOT route this through `WEB_ICON_MAP` — that reintroduces the 77-icon
 * eager cost on the home.
 */

import type { IconProps } from '@repo/icons';
import { BuildingIcon, CalendarDotsIcon, CompassIcon, PostIcon, StarIcon } from '@repo/icons';
import type { ComponentType } from 'react';

/** Icon component type shared by all `@repo/icons` wrappers. */
type IconComponent = ComponentType<IconProps>;

/**
 * Lookup table of the icon names the homepage stats grid can render.
 * Keyed by the `*Icon` name strings stored in `platformStats`.
 */
const STATS_ICON_MAP: Readonly<Record<string, IconComponent>> = Object.freeze({
    BuildingIcon,
    CompassIcon,
    StarIcon,
    PostIcon,
    CalendarDotsIcon
});

/**
 * Resolve a stats-grid icon name to its component.
 *
 * @param params - Receive object.
 * @param params.iconName - Icon name string (e.g. `"BuildingIcon"`), or
 *   `null`/`undefined` when the stat has no icon.
 * @returns The matching icon component, or `undefined` when the name is not in
 *   the stats universe (the caller renders no icon in that case).
 */
export function resolveStatsIcon({
    iconName
}: {
    readonly iconName: string | null | undefined;
}): IconComponent | undefined {
    if (!iconName) return undefined;
    return STATS_ICON_MAP[iconName];
}
