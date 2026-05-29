import { LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { filterAndSortSections, getAccommodationAnchorIds } from '../section-sorter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSection(
    id: string,
    viewPerms?: PermissionEnum[],
    editPerms?: PermissionEnum[]
): SectionConfig {
    return {
        id,
        layout: LayoutTypeEnum.GRID,
        fields: [],
        permissions: {
            view: viewPerms,
            edit: editPerms
        }
    };
}

// ---------------------------------------------------------------------------
// filterAndSortSections
// ---------------------------------------------------------------------------

describe('filterAndSortSections', () => {
    const openSection = makeSection('open'); // no permissions required
    const staffOnly = makeSection(
        'staff-section',
        [PermissionEnum.ACCOMMODATION_PUBLISH],
        [PermissionEnum.ACCOMMODATION_PUBLISH]
    );
    const basicInfo = makeSection('basic-info');
    const gallery = makeSection('gallery');
    const statesModeration = makeSection(
        'states-moderation',
        [PermissionEnum.ACCOMMODATION_PUBLISH],
        [PermissionEnum.ACCOMMODATION_PUBLISH]
    );

    // ---- Permission filtering ----

    it('includes sections with no required permissions', () => {
        const result = filterAndSortSections([openSection], {
            userPermissions: [],
            mode: 'view'
        });
        expect(result.map((s) => s.id)).toEqual(['open']);
    });

    it('excludes sections when user lacks required view permissions', () => {
        const result = filterAndSortSections([staffOnly], {
            userPermissions: [],
            mode: 'view'
        });
        expect(result).toHaveLength(0);
    });

    it('includes sections when user has at least one required view permission', () => {
        const result = filterAndSortSections([staffOnly], {
            userPermissions: [PermissionEnum.ACCOMMODATION_PUBLISH],
            mode: 'view'
        });
        expect(result).toHaveLength(1);
    });

    it('uses edit permissions when mode is "edit"', () => {
        // staffOnly requires ACCOMMODATION_PUBLISH for edit
        const withoutPerm = filterAndSortSections([staffOnly], {
            userPermissions: [],
            mode: 'edit'
        });
        expect(withoutPerm).toHaveLength(0);

        const withPerm = filterAndSortSections([staffOnly], {
            userPermissions: [PermissionEnum.ACCOMMODATION_PUBLISH],
            mode: 'edit'
        });
        expect(withPerm).toHaveLength(1);
    });

    // ---- Anchor ordering ----

    it('returns sections in original order when no anchors provided', () => {
        const result = filterAndSortSections([gallery, basicInfo, openSection], {
            userPermissions: [],
            mode: 'view'
        });
        expect(result.map((s) => s.id)).toEqual(['gallery', 'basic-info', 'open']);
    });

    it('moves anchored section to the top', () => {
        const result = filterAndSortSections([basicInfo, gallery, statesModeration], {
            userPermissions: [PermissionEnum.ACCOMMODATION_PUBLISH],
            mode: 'edit',
            anchorIds: ['states-moderation']
        });
        expect(result[0]?.id).toBe('states-moderation');
        expect(result.map((s) => s.id)).toEqual(['states-moderation', 'basic-info', 'gallery']);
    });

    it('respects the order of multiple anchor IDs', () => {
        const pricing = makeSection('pricing');
        const result = filterAndSortSections([basicInfo, pricing, gallery, statesModeration], {
            userPermissions: [PermissionEnum.ACCOMMODATION_PUBLISH],
            mode: 'edit',
            anchorIds: ['states-moderation', 'pricing']
        });
        expect(result[0]?.id).toBe('states-moderation');
        expect(result[1]?.id).toBe('pricing');
    });

    it('ignores anchor IDs for sections filtered out by permissions', () => {
        // statesModeration requires ACCOMMODATION_PUBLISH
        const result = filterAndSortSections([basicInfo, gallery, statesModeration], {
            userPermissions: [], // no permission — statesModeration filtered
            mode: 'edit',
            anchorIds: ['states-moderation']
        });
        // states-moderation should not appear at all
        expect(result.map((s) => s.id)).not.toContain('states-moderation');
        expect(result.map((s) => s.id)).toEqual(['basic-info', 'gallery']);
    });

    it('does not mutate the original sections array', () => {
        const original = [basicInfo, gallery, statesModeration];
        const originalCopy = [...original];
        filterAndSortSections(original, {
            userPermissions: [PermissionEnum.ACCOMMODATION_PUBLISH],
            mode: 'edit',
            anchorIds: ['states-moderation']
        });
        expect(original).toEqual(originalCopy);
    });
});

// ---------------------------------------------------------------------------
// getAccommodationAnchorIds
// ---------------------------------------------------------------------------

describe('getAccommodationAnchorIds', () => {
    it('returns ["states-moderation"] when user has ACCOMMODATION_PUBLISH', () => {
        const result = getAccommodationAnchorIds([PermissionEnum.ACCOMMODATION_PUBLISH]);
        expect(result).toEqual(['states-moderation']);
    });

    it('returns ["states-moderation"] when user has ACCOMMODATION_UPDATE_ANY', () => {
        const result = getAccommodationAnchorIds([PermissionEnum.ACCOMMODATION_UPDATE_ANY]);
        expect(result).toEqual(['states-moderation']);
    });

    it('returns empty array for a host with only own-update permission', () => {
        const result = getAccommodationAnchorIds([PermissionEnum.ACCOMMODATION_UPDATE_OWN]);
        expect(result).toEqual([]);
    });

    it('returns empty array when user has no permissions', () => {
        const result = getAccommodationAnchorIds([]);
        expect(result).toEqual([]);
    });
});
