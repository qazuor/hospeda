import { PermissionCategoryEnum } from '../enums/permission.enum.js';
import { PermissionEnum } from '../enums/permission.enum.js';

/**
 * Permission catalog grouping (SPEC-170).
 *
 * Derives each {@link PermissionEnum}'s {@link PermissionCategoryEnum} by a
 * longest-prefix match of the permission's TypeScript KEY (e.g.
 * `ACCOMMODATION_LISTING_CREATE`) against the category enum VALUES (which are
 * the same UPPER_SNAKE prefixes, e.g. `ACCOMMODATION_LISTING`). No
 * hand-maintained static map is needed — the mapping is computed at module load.
 *
 * Permissions whose key has no matching category prefix (platform-level grants
 * such as `LOGS_VIEW_ALL`, `SEO_MANAGE`) fall back to the `SYSTEM` catch-all.
 */

/** Category values sorted longest-first so subcategories win over parents. */
const CATEGORIES_LONGEST_FIRST: readonly PermissionCategoryEnum[] = Object.values(
    PermissionCategoryEnum
).sort((a, b) => b.length - a.length);

/**
 * Resolves the category for a permission KEY by longest-prefix match.
 * Falls back to {@link PermissionCategoryEnum.SYSTEM} when nothing matches.
 */
const deriveCategory = (permissionKey: string): PermissionCategoryEnum => {
    const matched = CATEGORIES_LONGEST_FIRST.find(
        (category) => permissionKey === category || permissionKey.startsWith(`${category}_`)
    );
    return matched ?? PermissionCategoryEnum.SYSTEM;
};

/**
 * Frozen map of every {@link PermissionEnum} value to its
 * {@link PermissionCategoryEnum}. Pre-computed at module load for O(1) lookup.
 */
export const PERMISSION_TO_CATEGORY: Readonly<Record<PermissionEnum, PermissionCategoryEnum>> =
    (() => {
        const result = {} as Record<PermissionEnum, PermissionCategoryEnum>;
        for (const [key, value] of Object.entries(PermissionEnum)) {
            result[value as PermissionEnum] = deriveCategory(key);
        }
        return Object.freeze(result);
    })();

/**
 * Returns every permission grouped by category, for a categorized picker.
 *
 * Categories are ordered alphabetically; permissions within each category are
 * sorted alphabetically by their enum value. Only categories that actually have
 * at least one permission are included.
 */
export const getPermissionsByCategory = (): ReadonlyMap<
    PermissionCategoryEnum,
    readonly PermissionEnum[]
> => {
    const grouped = new Map<PermissionCategoryEnum, PermissionEnum[]>();
    for (const permission of Object.values(PermissionEnum)) {
        const category = PERMISSION_TO_CATEGORY[permission];
        const list = grouped.get(category) ?? [];
        list.push(permission);
        grouped.set(category, list);
    }

    const sortedEntries = [...grouped.entries()]
        .map(([category, permissions]) => [category, [...permissions].sort()] as const)
        .sort(([a], [b]) => a.localeCompare(b));

    return new Map(sortedEntries);
};
