import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/index.js';
import {
    PERMISSION_TO_CATEGORY,
    getPermissionsByCategory
} from '../../src/utils/permission-grouping.js';

/** Reverse map PermissionEnum value -> KEY (e.g. 'accommodation.create' -> 'ACCOMMODATION_CREATE'). */
const VALUE_TO_KEY = Object.fromEntries(
    Object.entries(PermissionEnum).map(([key, value]) => [value, key])
) as Record<string, string>;

const ALL_PERMISSIONS = Object.values(PermissionEnum);
const ALL_CATEGORY_VALUES = new Set<string>(Object.values(PermissionCategoryEnum));

describe('permission-grouping (SPEC-170)', () => {
    describe('PERMISSION_TO_CATEGORY', () => {
        it('maps every permission to a valid PermissionCategoryEnum', () => {
            for (const permission of ALL_PERMISSIONS) {
                const category = PERMISSION_TO_CATEGORY[permission];
                expect(ALL_CATEGORY_VALUES.has(category)).toBe(true);
            }
        });

        it('maps a simple permission to its category (ACCOMMODATION_CREATE -> ACCOMMODATION)', () => {
            expect(PERMISSION_TO_CATEGORY[PermissionEnum.ACCOMMODATION_CREATE]).toBe(
                PermissionCategoryEnum.ACCOMMODATION
            );
        });

        it('maps PERMISSION_VIEW to the PERMISSION category', () => {
            expect(PERMISSION_TO_CATEGORY[PermissionEnum.PERMISSION_VIEW]).toBe(
                PermissionCategoryEnum.PERMISSION
            );
        });

        it('prefers the longest-matching category prefix (subcategory wins)', () => {
            // ACCOMMODATION_LISTING_* must map to ACCOMMODATION_LISTING, not ACCOMMODATION.
            const listingPerm = Object.entries(PermissionEnum).find(([key]) =>
                key.startsWith('ACCOMMODATION_LISTING_')
            );
            if (listingPerm) {
                const [, value] = listingPerm;
                const category = PERMISSION_TO_CATEGORY[value as PermissionEnum];
                expect([
                    PermissionCategoryEnum.ACCOMMODATION_LISTING,
                    PermissionCategoryEnum.ACCOMMODATION_LISTING_PLAN
                ]).toContain(category);
                expect(category).not.toBe(PermissionCategoryEnum.ACCOMMODATION);
            }
        });

        it('only assigns SYSTEM when no category is a prefix of the permission key', () => {
            for (const permission of ALL_PERMISSIONS) {
                const category = PERMISSION_TO_CATEGORY[permission];
                const key = VALUE_TO_KEY[permission];
                if (!key) continue;
                if (category === PermissionCategoryEnum.SYSTEM && key !== 'SYSTEM') {
                    // Falling back to SYSTEM is only valid when NO non-SYSTEM category prefixes the key.
                    const hasNonSystemPrefix = Object.values(PermissionCategoryEnum).some(
                        (cat) =>
                            cat !== PermissionCategoryEnum.SYSTEM &&
                            (key === cat || key.startsWith(`${cat}_`))
                    );
                    expect(hasNonSystemPrefix).toBe(false);
                }
            }
        });

        it('assigns the category whose value prefixes the key (no mismatches)', () => {
            for (const permission of ALL_PERMISSIONS) {
                const category = PERMISSION_TO_CATEGORY[permission];
                const key = VALUE_TO_KEY[permission];
                if (!key) continue;
                const matches = key === category || key.startsWith(`${category}_`);
                // Either the category prefixes the key, or it is the SYSTEM catch-all.
                expect(matches || category === PermissionCategoryEnum.SYSTEM).toBe(true);
            }
        });
    });

    describe('getPermissionsByCategory', () => {
        const grouped = getPermissionsByCategory();

        it('groups every permission exactly once', () => {
            const total = [...grouped.values()].reduce((sum, perms) => sum + perms.length, 0);
            expect(total).toBe(ALL_PERMISSIONS.length);

            const seen = new Set<string>();
            for (const perms of grouped.values()) {
                for (const p of perms) {
                    expect(seen.has(p)).toBe(false);
                    seen.add(p);
                }
            }
        });

        it('only uses valid PermissionCategoryEnum keys', () => {
            for (const category of grouped.keys()) {
                expect(ALL_CATEGORY_VALUES.has(category)).toBe(true);
            }
        });

        it('sorts permissions alphabetically within each category', () => {
            for (const perms of grouped.values()) {
                const sorted = [...perms].sort();
                expect(perms).toEqual(sorted);
            }
        });
    });
});
