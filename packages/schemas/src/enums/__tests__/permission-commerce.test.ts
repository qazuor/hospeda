import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../permission.enum.js';

// ============================================================================
// SPEC-253 COMMERCE permissions and COMMERCE category
// (Replaces SPEC-239 test — 10 per-section perms removed, COMMERCE_EDIT_OWN added)
// ============================================================================

describe('SPEC-253 COMMERCE permissions', () => {
    it('should have COMMERCE category in PermissionCategoryEnum', () => {
        expect(PermissionCategoryEnum.COMMERCE).toBe('COMMERCE');
    });

    describe('owner write permission (single, SPEC-253 D2=b)', () => {
        it('should have COMMERCE_EDIT_OWN with correct value', () => {
            expect(PermissionEnum.COMMERCE_EDIT_OWN).toBe('commerce.editOwn');
        });
    });

    describe('admin-level permissions (5)', () => {
        it('should have COMMERCE_CREATE', () => {
            expect(PermissionEnum.COMMERCE_CREATE).toBe('commerce.create');
        });

        it('should have COMMERCE_VIEW_ALL', () => {
            expect(PermissionEnum.COMMERCE_VIEW_ALL).toBe('commerce.viewAll');
        });

        it('should have COMMERCE_EDIT_ALL', () => {
            expect(PermissionEnum.COMMERCE_EDIT_ALL).toBe('commerce.editAll');
        });

        it('should have COMMERCE_DELETE', () => {
            expect(PermissionEnum.COMMERCE_DELETE).toBe('commerce.delete');
        });

        it('should have COMMERCE_MODERATE_REVIEW', () => {
            expect(PermissionEnum.COMMERCE_MODERATE_REVIEW).toBe('commerce.moderateReview');
        });

        it('should have COMMERCE_MODERATION_CHANGE (HOS-686)', () => {
            expect(PermissionEnum.COMMERCE_MODERATION_CHANGE).toBe('commerce.moderationChange');
        });
    });

    it('should have exactly 7 COMMERCE entries (COMMERCE_EDIT_OWN + 6 admin)', () => {
        // Arrange
        const commercePerms = Object.values(PermissionEnum).filter((v) =>
            v.startsWith('commerce.')
        );
        // Assert: 1 owner (COMMERCE_EDIT_OWN) + 6 admin-level = 7 total
        // (was 15 in SPEC-239: 10 per-section + 5 admin; collapsed to 6 in
        // SPEC-253 D2=b; COMMERCE_MODERATION_CHANGE added in HOS-686)
        expect(commercePerms).toHaveLength(7);
    });

    describe('HOS-686 listing moderation is NOT review moderation', () => {
        it('the two are distinct enum values', () => {
            // The naming trap named in HOS-589 §6.7: grepping "moderate" under
            // commerce finds the REVIEW permission first, and concluding the
            // listing case is already covered is the reasonable — and wrong —
            // reading.
            expect(PermissionEnum.COMMERCE_MODERATION_CHANGE).not.toBe(
                PermissionEnum.COMMERCE_MODERATE_REVIEW
            );
        });

        it('is spelled camelCase like the rest of the commerce family, not dotted', () => {
            // `commerce.moderation.change` (the accommodation/event/post
            // spelling) would add a 14th dual-spelled family to the baseline
            // frozen by `permission-naming-convention.guard.test.ts`.
            expect(PermissionEnum.COMMERCE_MODERATION_CHANGE.split('.')).toHaveLength(2);
        });
    });

    it('should NOT contain any of the removed per-section COMMERCE_*_EDIT_OWN perms', () => {
        const removedValues = [
            'commerce.schedule.editOwn',
            'commerce.contact.editOwn',
            'commerce.social.editOwn',
            'commerce.media.editOwn',
            'commerce.menu.editOwn',
            'commerce.priceRange.editOwn',
            'commerce.richDescription.editOwn',
            'commerce.amenities.editOwn',
            'commerce.features.editOwn',
            'commerce.faqs.editOwn'
        ];
        const allValues = Object.values(PermissionEnum);
        for (const removed of removedValues) {
            expect(allValues).not.toContain(removed);
        }
    });

    it('owner with COMMERCE_EDIT_OWN can gate on the single permission (AC-2)', () => {
        // The value must be distinct from any admin perm to ensure correct gating.
        expect(PermissionEnum.COMMERCE_EDIT_OWN).not.toBe(PermissionEnum.COMMERCE_EDIT_ALL);
        expect(PermissionEnum.COMMERCE_EDIT_OWN).not.toBe(PermissionEnum.COMMERCE_CREATE);
    });
});

// ============================================================================
// HOS-1077 — the per-vertical split of the COMMERCE family
//
// The block above freezes the legacy seven at exactly 7. It keeps passing after
// the split precisely because the new values are `gastronomy.*`/`experience.*`
// and not `commerce.*` — which is the naming decision, restated as a test that
// would have caught the alternative.
// ============================================================================

describe('HOS-1077 per-vertical commerce permissions', () => {
    const VERTICALS = [
        {
            name: 'gastronomy',
            category: PermissionCategoryEnum.GASTRONOMY,
            permissions: {
                editOwn: PermissionEnum.GASTRONOMY_EDIT_OWN,
                create: PermissionEnum.GASTRONOMY_CREATE,
                viewAll: PermissionEnum.GASTRONOMY_VIEW_ALL,
                editAll: PermissionEnum.GASTRONOMY_EDIT_ALL,
                delete: PermissionEnum.GASTRONOMY_DELETE,
                moderateReview: PermissionEnum.GASTRONOMY_MODERATE_REVIEW,
                moderationChange: PermissionEnum.GASTRONOMY_MODERATION_CHANGE
            }
        },
        {
            name: 'experience',
            category: PermissionCategoryEnum.EXPERIENCE,
            permissions: {
                editOwn: PermissionEnum.EXPERIENCE_EDIT_OWN,
                create: PermissionEnum.EXPERIENCE_CREATE,
                viewAll: PermissionEnum.EXPERIENCE_VIEW_ALL,
                editAll: PermissionEnum.EXPERIENCE_EDIT_ALL,
                delete: PermissionEnum.EXPERIENCE_DELETE,
                moderateReview: PermissionEnum.EXPERIENCE_MODERATE_REVIEW,
                moderationChange: PermissionEnum.EXPERIENCE_MODERATION_CHANGE
            }
        }
    ] as const;

    for (const vertical of VERTICALS) {
        describe(`${vertical.name}.*`, () => {
            it('has its own category', () => {
                expect(vertical.category).toBe(vertical.name.toUpperCase());
            });

            it('has exactly 7 members, mirroring the commerce family', () => {
                const values = Object.values(PermissionEnum).filter((v) =>
                    v.startsWith(`${vertical.name}.`)
                );
                expect(values).toHaveLength(7);
            });

            it('spells every value as two camelCase segments, not a dotted third', () => {
                // A dotted third segment (`gastronomy.moderation.change`) would add
                // a dual-spelled family to the baseline frozen by
                // `permission-naming-convention.guard.test.ts`.
                for (const value of Object.values(vertical.permissions)) {
                    expect(value.split('.')).toHaveLength(2);
                }
            });

            it('slots map onto the commerce family one for one', () => {
                for (const [slot, value] of Object.entries(vertical.permissions)) {
                    expect(value).toBe(`${vertical.name}.${slot}`);
                }
            });
        });
    }

    it('the two verticals share no permission value', () => {
        // If any value were shared, granting one vertical would grant the other
        // — the exact defect HOS-1077 exists to remove.
        const gastronomy = Object.values(VERTICALS[0].permissions);
        const experience = Object.values(VERTICALS[1].permissions);
        expect(gastronomy.filter((v) => (experience as string[]).includes(v))).toEqual([]);
    });

    it('neither vertical reuses a legacy commerce.* value', () => {
        const legacy = Object.values(PermissionEnum).filter((v) => v.startsWith('commerce.'));
        const split = [
            ...Object.values(VERTICALS[0].permissions),
            ...Object.values(VERTICALS[1].permissions)
        ];
        expect(split.filter((v) => (legacy as string[]).includes(v))).toEqual([]);
    });
});
