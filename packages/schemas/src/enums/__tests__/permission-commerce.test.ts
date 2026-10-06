import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../permission.enum.js';

// TEST:U1:5 / TEST:U1:6 — retired role and seven permission values stay absent.
import { RoleEnum } from '../role.enum.js';

const RETIRED_PERMISSIONS = [
    'commerce.editOwn',
    'commerce.create',
    'commerce.viewAll',
    'commerce.editAll',
    'commerce.delete',
    'commerce.moderateReview',
    'commerce.moderationChange'
] as const;

describe('retired commerce role and permissions', () => {
    it('has none of the seven retired permission values', () => {
        const values = Object.values(PermissionEnum);
        for (const permission of RETIRED_PERMISSIONS) {
            expect(values).not.toContain(permission);
        }
    });

    it('has no COMMERCE_OWNER role', () => {
        expect(Object.values(RoleEnum)).not.toContain('COMMERCE_OWNER');
    });

    it('has no category that names both listing verticals (HOS-1417)', () => {
        expect(Object.values(PermissionCategoryEnum)).not.toContain('COMMERCE');
    });
});

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
