/**
 * @file homepage-stats.ts
 * @description Statistics strip data for the homepage, matching Figma design (node 26:797).
 *
 * Contains 5 platform-wide stat counters shown in the statistics section.
 * Values are integers rendered with a count-up animation via AnimatedCounter.
 * Labels are resolved via the `t()` helper using the provided i18n keys.
 */

import type { StatItemData } from './types';

/**
 * Array of 5 platform statistics for the homepage stats strip.
 *
 * Each item includes a Phosphor icon name, a numeric value, and an i18n key
 * for the label. Values match the Figma design (node 26:797).
 *
 * @example
 * ```ts
 * import { homepageStats } from '@/data/homepage-stats';
 * homepageStats.forEach(stat => console.log(stat.icon, stat.value));
 * ```
 */
export const homepageStats: readonly StatItemData[] = [
    {
        icon: 'BuildingIcon',
        value: 120,
        labelKey: 'home.statistics.accommodations'
    },
    {
        icon: 'CompassIcon',
        value: 25,
        labelKey: 'home.statistics.destinations'
    },
    {
        icon: 'StarIcon',
        value: 500,
        labelKey: 'home.statistics.reviews'
    },
    {
        icon: 'PostIcon',
        value: 15,
        labelKey: 'home.statistics.posts'
    },
    {
        icon: 'UsersIcon',
        value: 2000,
        labelKey: 'home.statistics.experience'
    }
] as const;
