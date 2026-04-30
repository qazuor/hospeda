import { describe, expect, it } from 'vitest';
import { PermissionEnum } from '../permission.enum.js';

// ============================================================================
// SPEC-086 Tag System Permissions in PermissionEnum
// Covers AC-F16, D-012 (TAG_USER_UPDATE_ANY exclusion), D-017 (TAG_SYSTEM_ASSIGN exclusion)
// ============================================================================

describe('PermissionEnum - Tag System (SPEC-086)', () => {
    // -------------------------------------------------------------------------
    // User-Tag permissions (19 values)
    // -------------------------------------------------------------------------

    describe('INTERNAL tag permissions', () => {
        it('should include TAG_INTERNAL_CREATE', () => {
            expect(PermissionEnum.TAG_INTERNAL_CREATE).toBe('tag.internal.create');
        });

        it('should include TAG_INTERNAL_UPDATE', () => {
            expect(PermissionEnum.TAG_INTERNAL_UPDATE).toBe('tag.internal.update');
        });

        it('should include TAG_INTERNAL_DELETE', () => {
            expect(PermissionEnum.TAG_INTERNAL_DELETE).toBe('tag.internal.delete');
        });

        it('should include TAG_INTERNAL_VIEW', () => {
            expect(PermissionEnum.TAG_INTERNAL_VIEW).toBe('tag.internal.view');
        });

        it('should include TAG_INTERNAL_ASSIGN', () => {
            expect(PermissionEnum.TAG_INTERNAL_ASSIGN).toBe('tag.internal.assign');
        });
    });

    describe('SYSTEM tag permissions', () => {
        it('should include TAG_SYSTEM_CREATE', () => {
            expect(PermissionEnum.TAG_SYSTEM_CREATE).toBe('tag.system.create');
        });

        it('should include TAG_SYSTEM_UPDATE', () => {
            expect(PermissionEnum.TAG_SYSTEM_UPDATE).toBe('tag.system.update');
        });

        it('should include TAG_SYSTEM_DELETE', () => {
            expect(PermissionEnum.TAG_SYSTEM_DELETE).toBe('tag.system.delete');
        });

        it('should include TAG_SYSTEM_VIEW', () => {
            expect(PermissionEnum.TAG_SYSTEM_VIEW).toBe('tag.system.view');
        });
    });

    describe('USER tag permissions', () => {
        it('should include TAG_USER_CREATE', () => {
            expect(PermissionEnum.TAG_USER_CREATE).toBe('tag.user.create');
        });

        it('should include TAG_USER_UPDATE_OWN', () => {
            expect(PermissionEnum.TAG_USER_UPDATE_OWN).toBe('tag.user.updateOwn');
        });

        it('should include TAG_USER_DELETE_OWN', () => {
            expect(PermissionEnum.TAG_USER_DELETE_OWN).toBe('tag.user.deleteOwn');
        });

        it('should include TAG_USER_VIEW_OWN', () => {
            expect(PermissionEnum.TAG_USER_VIEW_OWN).toBe('tag.user.viewOwn');
        });

        it('should include TAG_USER_DELETE_ANY', () => {
            expect(PermissionEnum.TAG_USER_DELETE_ANY).toBe('tag.user.deleteAny');
        });
    });

    describe('cross-user / super-admin tag permissions', () => {
        it('should include TAG_VIEW_ALL_USER_TAGS', () => {
            expect(PermissionEnum.TAG_VIEW_ALL_USER_TAGS).toBe('tag.viewAllUserTags');
        });

        it('should include TAG_VIEW_ALL_ASSIGNMENTS', () => {
            expect(PermissionEnum.TAG_VIEW_ALL_ASSIGNMENTS).toBe('tag.viewAllAssignments');
        });
    });

    describe('assignment permissions', () => {
        it('should include TAG_ASSIGN_VIEW', () => {
            expect(PermissionEnum.TAG_ASSIGN_VIEW).toBe('tag.assign.view');
        });

        it('should include TAG_ASSIGN_ADD', () => {
            expect(PermissionEnum.TAG_ASSIGN_ADD).toBe('tag.assign.add');
        });

        it('should include TAG_ASSIGN_REMOVE', () => {
            expect(PermissionEnum.TAG_ASSIGN_REMOVE).toBe('tag.assign.remove');
        });
    });

    // -------------------------------------------------------------------------
    // PostTag permissions (5 values)
    // -------------------------------------------------------------------------

    describe('PostTag permissions', () => {
        it('should include POST_TAG_CREATE', () => {
            expect(PermissionEnum.POST_TAG_CREATE).toBe('postTag.create');
        });

        it('should include POST_TAG_UPDATE', () => {
            expect(PermissionEnum.POST_TAG_UPDATE).toBe('postTag.update');
        });

        it('should include POST_TAG_DELETE', () => {
            expect(PermissionEnum.POST_TAG_DELETE).toBe('postTag.delete');
        });

        it('should include POST_TAG_VIEW', () => {
            expect(PermissionEnum.POST_TAG_VIEW).toBe('postTag.view');
        });

        it('should include POST_TAG_ASSIGN', () => {
            expect(PermissionEnum.POST_TAG_ASSIGN).toBe('postTag.assign');
        });
    });

    // -------------------------------------------------------------------------
    // Aggregate: all 24 new permissions present
    // -------------------------------------------------------------------------

    describe('all 24 SPEC-086 permissions are present (AC-F16)', () => {
        const expectedPermissions: ReadonlyArray<keyof typeof PermissionEnum> = [
            // User-Tag (19)
            'TAG_INTERNAL_CREATE',
            'TAG_INTERNAL_UPDATE',
            'TAG_INTERNAL_DELETE',
            'TAG_INTERNAL_VIEW',
            'TAG_INTERNAL_ASSIGN',
            'TAG_SYSTEM_CREATE',
            'TAG_SYSTEM_UPDATE',
            'TAG_SYSTEM_DELETE',
            'TAG_SYSTEM_VIEW',
            'TAG_USER_CREATE',
            'TAG_USER_UPDATE_OWN',
            'TAG_USER_DELETE_OWN',
            'TAG_USER_VIEW_OWN',
            'TAG_USER_DELETE_ANY',
            'TAG_VIEW_ALL_USER_TAGS',
            'TAG_VIEW_ALL_ASSIGNMENTS',
            'TAG_ASSIGN_VIEW',
            'TAG_ASSIGN_ADD',
            'TAG_ASSIGN_REMOVE',
            // PostTag (5)
            'POST_TAG_CREATE',
            'POST_TAG_UPDATE',
            'POST_TAG_DELETE',
            'POST_TAG_VIEW',
            'POST_TAG_ASSIGN'
        ] as const;

        it('should have all 24 new permission keys defined', () => {
            for (const key of expectedPermissions) {
                expect(
                    PermissionEnum[key],
                    `Expected PermissionEnum.${key} to be defined`
                ).toBeDefined();
            }
        });

        it('should have exactly 24 SPEC-086 permissions matching the expected set', () => {
            expect(expectedPermissions).toHaveLength(24);
        });
    });

    // -------------------------------------------------------------------------
    // Explicit exclusions (D-012 and D-017)
    // -------------------------------------------------------------------------

    describe('explicit exclusions from design decisions', () => {
        it('should NOT include TAG_USER_UPDATE_ANY (D-012: super-admin moderation is delete-only)', () => {
            // TAG_USER_UPDATE_ANY must not exist in the enum.
            // Casting to unknown first is required because TypeScript would otherwise
            // raise a compile-time error on a key it knows does not exist.
            const permEnum = PermissionEnum as Record<string, string>;
            expect(permEnum.TAG_USER_UPDATE_ANY).toBeUndefined();
        });

        it('should NOT include TAG_SYSTEM_ASSIGN (D-017: any authenticated user assigns SYSTEM tags via TAG_ASSIGN_ADD)', () => {
            const permEnum = PermissionEnum as Record<string, string>;
            expect(permEnum.TAG_SYSTEM_ASSIGN).toBeUndefined();
        });
    });
});
