import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { PermissionEnum } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for filtering and ordering sections by user role / permissions.
 */
export interface SectionSortOptions {
    /**
     * User permissions used to filter sections by `section.permissions.view`
     * (for view mode) or `section.permissions.edit` (for edit mode).
     */
    readonly userPermissions: readonly PermissionEnum[];
    /**
     * Current page mode. Affects which `permissions` sub-key is checked.
     * - `'view'` → checks `section.permissions.view`
     * - `'edit'` → checks `section.permissions.edit`
     */
    readonly mode: 'view' | 'edit';
    /**
     * IDs of sections that must be anchored at the top of the list, in order.
     * The anchor sections appear first; the remaining sections follow in their
     * original config order.
     *
     * Typical use: `['states-moderation']` for staff roles so that the
     * moderation section always appears first (spec §4.4).
     */
    readonly anchorIds?: readonly string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the user has at least one of the required permissions,
 * or when no permissions are declared for this section/mode (open to all).
 */
function hasAccess(
    section: SectionConfig,
    mode: 'view' | 'edit',
    userPermissions: readonly PermissionEnum[]
): boolean {
    const required = mode === 'view' ? section.permissions?.view : section.permissions?.edit;

    if (!required || required.length === 0) return true;
    return required.some((p) => userPermissions.includes(p));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Filters and sorts sections for the accordion based on user permissions and
 * optional anchor rules.
 *
 * 1. **Filter** — removes any section the user cannot access in the current mode.
 * 2. **Anchor** — moves sections whose `id` is in `anchorIds` to the top, in
 *    the order given by `anchorIds`. All remaining sections follow in their
 *    original position.
 *
 * @param sections  - Full section list (already filtered by mode by the caller).
 * @param options   - Sort / filter options.
 * @returns A new array; the original is not mutated.
 *
 * @example
 * ```ts
 * // Staff sees "states-moderation" first
 * const ordered = filterAndSortSections(editSections, {
 *   userPermissions,
 *   mode: 'edit',
 *   anchorIds: ['states-moderation'],
 * });
 * ```
 */
export function filterAndSortSections(
    sections: readonly SectionConfig[],
    options: SectionSortOptions
): SectionConfig[] {
    const { userPermissions, mode, anchorIds = [] } = options;

    // 1. Filter by permissions
    const accessible = sections.filter((s) => hasAccess(s, mode, userPermissions));

    if (anchorIds.length === 0) return [...accessible];

    // 2. Split into anchored and rest
    const anchored: SectionConfig[] = [];
    const rest: SectionConfig[] = [];

    for (const section of accessible) {
        if (anchorIds.includes(section.id)) {
            anchored.push(section);
        } else {
            rest.push(section);
        }
    }

    // Sort anchored sections in the order specified by anchorIds
    anchored.sort((a, b) => anchorIds.indexOf(a.id) - anchorIds.indexOf(b.id));

    return [...anchored, ...rest];
}

// ---------------------------------------------------------------------------
// Permission-to-anchor resolver for accommodation (spec §4.4)
// ---------------------------------------------------------------------------

/**
 * Returns the anchor IDs for accommodation sections based on whether the user
 * has staff-level moderation permissions.
 *
 * Staff (has `ACCOMMODATION_PUBLISH` or `ACCOMMODATION_UPDATE_ANY`) →
 *   anchor `['states-moderation']` at top.
 * Host →
 *   no anchors (moderation section is filtered out by permissions anyway).
 *
 * Generalise this per-entity via a config map in the future.
 */
export function getAccommodationAnchorIds(
    userPermissions: readonly PermissionEnum[]
): readonly string[] {
    // Staff indicator: can publish or update any accommodation
    const staffPermissions: readonly PermissionEnum[] = [
        PermissionEnum.ACCOMMODATION_PUBLISH,
        PermissionEnum.ACCOMMODATION_UPDATE_ANY
    ];

    const isStaff = staffPermissions.some((p) => userPermissions.includes(p));
    return isStaff ? ['states-moderation'] : [];
}
