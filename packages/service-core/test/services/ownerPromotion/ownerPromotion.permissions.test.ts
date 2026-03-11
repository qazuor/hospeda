import type { OwnerPromotion, UserIdType } from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    checkCanCount,
    checkCanCreate,
    checkCanHardDelete,
    checkCanList,
    checkCanRestore,
    checkCanSearch,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanUpdateVisibility,
    checkCanView
} from '../../../src/services/owner-promotion/ownerPromotion.permissions';
import { ServiceError } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';
import {
    createMockOwnerPromotion,
    createMockOwnerPromotionCreateInput
} from '../../factories/ownerPromotionFactory';
import { getMockId } from '../../factories/utilsFactory';

const createActor = (
    permissions: PermissionEnum[] = [],
    id = 'actor-id',
    role: RoleEnum = RoleEnum.ADMIN
) => ({ id, role, permissions });

const withOwner = (ownerId: UserIdType): OwnerPromotion => createMockOwnerPromotion({ ownerId });

const expectForbidden = (fn: () => void, messageFragment: string) => {
    try {
        fn();
        throw new Error('Expected ServiceError but no error was thrown');
    } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        if (err instanceof ServiceError) {
            expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(err.message).toMatch(messageFragment);
        }
    }
};

const mockUserId = getMockId('user', 'owner') as UserIdType;
const otherUserId = getMockId('user', 'other') as UserIdType;

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(permissionUtils, 'hasPermission').mockImplementation((actor, permission) => {
        return actor.permissions.includes(permission);
    });
    vi.spyOn(permissionUtils, 'checkGenericPermission').mockImplementation(
        (actor, anyPermission, ownPermission, isEntityOwner, errorMessage) => {
            const can =
                actor.permissions.includes(anyPermission) ||
                (actor.permissions.includes(ownPermission) && isEntityOwner);
            if (!can) {
                throw new ServiceError(ServiceErrorCode.FORBIDDEN, errorMessage);
            }
        }
    );
});

describe('OwnerPromotion Permissions', () => {
    // ------------------------------------------------------------------ create
    describe('checkCanCreate', () => {
        it('allows with OWNER_PROMOTION_CREATE permission', () => {
            expect(() =>
                checkCanCreate(
                    createActor([PermissionEnum.OWNER_PROMOTION_CREATE]),
                    createMockOwnerPromotionCreateInput()
                )
            ).not.toThrow();
        });

        it('forbids without permission', () => {
            expectForbidden(
                () => checkCanCreate(createActor([]), createMockOwnerPromotionCreateInput()),
                'create owner promotion'
            );
        });
    });

    // ------------------------------------------------------------------ update
    describe('checkCanUpdate', () => {
        it('allows with OWNER_PROMOTION_UPDATE_ANY permission', () => {
            expect(() =>
                checkCanUpdate(
                    createActor([PermissionEnum.OWNER_PROMOTION_UPDATE_ANY]),
                    withOwner(mockUserId)
                )
            ).not.toThrow();
        });

        it('allows with OWNER_PROMOTION_UPDATE_OWN when actor is the owner', () => {
            expect(() =>
                checkCanUpdate(
                    createActor([PermissionEnum.OWNER_PROMOTION_UPDATE_OWN], mockUserId),
                    withOwner(mockUserId)
                )
            ).not.toThrow();
        });

        it('forbids with OWNER_PROMOTION_UPDATE_OWN when actor is not the owner', () => {
            expectForbidden(
                () =>
                    checkCanUpdate(
                        createActor([PermissionEnum.OWNER_PROMOTION_UPDATE_OWN], otherUserId),
                        withOwner(mockUserId)
                    ),
                'update owner promotion'
            );
        });

        it('forbids without any permission', () => {
            expectForbidden(
                () => checkCanUpdate(createActor([]), withOwner(mockUserId)),
                'update owner promotion'
            );
        });
    });

    // --------------------------------------------------------------- soft-delete
    describe('checkCanSoftDelete', () => {
        it('allows with OWNER_PROMOTION_SOFT_DELETE_ANY permission', () => {
            expect(() =>
                checkCanSoftDelete(
                    createActor([PermissionEnum.OWNER_PROMOTION_SOFT_DELETE_ANY]),
                    withOwner(mockUserId)
                )
            ).not.toThrow();
        });

        it('allows with OWNER_PROMOTION_SOFT_DELETE_OWN when actor is the owner', () => {
            expect(() =>
                checkCanSoftDelete(
                    createActor([PermissionEnum.OWNER_PROMOTION_SOFT_DELETE_OWN], mockUserId),
                    withOwner(mockUserId)
                )
            ).not.toThrow();
        });

        it('forbids with OWNER_PROMOTION_SOFT_DELETE_OWN when actor is not the owner', () => {
            expectForbidden(
                () =>
                    checkCanSoftDelete(
                        createActor([PermissionEnum.OWNER_PROMOTION_SOFT_DELETE_OWN], otherUserId),
                        withOwner(mockUserId)
                    ),
                'delete owner promotion'
            );
        });

        it('forbids without any permission', () => {
            expectForbidden(
                () => checkCanSoftDelete(createActor([]), withOwner(mockUserId)),
                'delete owner promotion'
            );
        });
    });

    // --------------------------------------------------------------- hard-delete
    describe('checkCanHardDelete', () => {
        it('allows with OWNER_PROMOTION_HARD_DELETE_ANY permission', () => {
            expect(() =>
                checkCanHardDelete(
                    createActor([PermissionEnum.OWNER_PROMOTION_HARD_DELETE_ANY]),
                    withOwner(mockUserId)
                )
            ).not.toThrow();
        });

        it('allows with OWNER_PROMOTION_HARD_DELETE_OWN when actor is the owner', () => {
            expect(() =>
                checkCanHardDelete(
                    createActor([PermissionEnum.OWNER_PROMOTION_HARD_DELETE_OWN], mockUserId),
                    withOwner(mockUserId)
                )
            ).not.toThrow();
        });

        it('forbids with OWNER_PROMOTION_HARD_DELETE_OWN when actor is not the owner', () => {
            expectForbidden(
                () =>
                    checkCanHardDelete(
                        createActor([PermissionEnum.OWNER_PROMOTION_HARD_DELETE_OWN], otherUserId),
                        withOwner(mockUserId)
                    ),
                'permanently delete owner promotion'
            );
        });

        it('forbids without any permission', () => {
            expectForbidden(
                () => checkCanHardDelete(createActor([]), withOwner(mockUserId)),
                'permanently delete owner promotion'
            );
        });
    });

    // ------------------------------------------------------------------ restore
    describe('checkCanRestore', () => {
        it('allows with OWNER_PROMOTION_RESTORE_ANY permission', () => {
            expect(() =>
                checkCanRestore(
                    createActor([PermissionEnum.OWNER_PROMOTION_RESTORE_ANY]),
                    withOwner(mockUserId)
                )
            ).not.toThrow();
        });

        it('allows with OWNER_PROMOTION_RESTORE_OWN when actor is the owner', () => {
            expect(() =>
                checkCanRestore(
                    createActor([PermissionEnum.OWNER_PROMOTION_RESTORE_OWN], mockUserId),
                    withOwner(mockUserId)
                )
            ).not.toThrow();
        });

        it('forbids with OWNER_PROMOTION_RESTORE_OWN when actor is not the owner', () => {
            expectForbidden(
                () =>
                    checkCanRestore(
                        createActor([PermissionEnum.OWNER_PROMOTION_RESTORE_OWN], otherUserId),
                        withOwner(mockUserId)
                    ),
                'restore owner promotion'
            );
        });

        it('forbids without any permission', () => {
            expectForbidden(
                () => checkCanRestore(createActor([]), withOwner(mockUserId)),
                'restore owner promotion'
            );
        });
    });

    // -------------------------------------------------------------------- view
    describe('checkCanView', () => {
        it('allows with OWNER_PROMOTION_VIEW_ANY permission', () => {
            expect(() =>
                checkCanView(
                    createActor([PermissionEnum.OWNER_PROMOTION_VIEW_ANY]),
                    withOwner(mockUserId)
                )
            ).not.toThrow();
        });

        it('allows with OWNER_PROMOTION_VIEW_OWN when actor is the owner', () => {
            expect(() =>
                checkCanView(
                    createActor([PermissionEnum.OWNER_PROMOTION_VIEW_OWN], mockUserId),
                    withOwner(mockUserId)
                )
            ).not.toThrow();
        });

        it('forbids with OWNER_PROMOTION_VIEW_OWN when actor is not the owner', () => {
            expectForbidden(
                () =>
                    checkCanView(
                        createActor([PermissionEnum.OWNER_PROMOTION_VIEW_OWN], otherUserId),
                        withOwner(mockUserId)
                    ),
                'view owner promotion'
            );
        });

        it('forbids without any permission', () => {
            expectForbidden(
                () => checkCanView(createActor([]), withOwner(mockUserId)),
                'view owner promotion'
            );
        });
    });

    // -------------------------------------------------------------------- list
    describe('checkCanList', () => {
        it('allows with OWNER_PROMOTION_VIEW_ANY permission', () => {
            expect(() =>
                checkCanList(createActor([PermissionEnum.OWNER_PROMOTION_VIEW_ANY]))
            ).not.toThrow();
        });

        it('allows with OWNER_PROMOTION_VIEW_OWN permission', () => {
            expect(() =>
                checkCanList(createActor([PermissionEnum.OWNER_PROMOTION_VIEW_OWN]))
            ).not.toThrow();
        });

        it('forbids without any view permission', () => {
            expectForbidden(() => checkCanList(createActor([])), 'list owner promotions');
        });
    });

    // ------------------------------------------------------------------ search
    describe('checkCanSearch', () => {
        it('allows with OWNER_PROMOTION_VIEW_ANY permission', () => {
            expect(() =>
                checkCanSearch(createActor([PermissionEnum.OWNER_PROMOTION_VIEW_ANY]))
            ).not.toThrow();
        });

        it('allows with OWNER_PROMOTION_VIEW_OWN permission', () => {
            expect(() =>
                checkCanSearch(createActor([PermissionEnum.OWNER_PROMOTION_VIEW_OWN]))
            ).not.toThrow();
        });

        it('forbids without any view permission', () => {
            expectForbidden(() => checkCanSearch(createActor([])), 'search owner promotions');
        });
    });

    // ------------------------------------------------------------------ count
    describe('checkCanCount', () => {
        it('allows with OWNER_PROMOTION_VIEW_ANY permission', () => {
            expect(() =>
                checkCanCount(createActor([PermissionEnum.OWNER_PROMOTION_VIEW_ANY]))
            ).not.toThrow();
        });

        it('allows with OWNER_PROMOTION_VIEW_OWN permission', () => {
            expect(() =>
                checkCanCount(createActor([PermissionEnum.OWNER_PROMOTION_VIEW_OWN]))
            ).not.toThrow();
        });

        it('forbids without any view permission', () => {
            expectForbidden(() => checkCanCount(createActor([])), 'count owner promotions');
        });
    });

    // -------------------------------------------------------- update-visibility
    describe('checkCanUpdateVisibility', () => {
        it('allows with OWNER_PROMOTION_UPDATE_VISIBILITY_ANY permission', () => {
            expect(() =>
                checkCanUpdateVisibility(
                    createActor([PermissionEnum.OWNER_PROMOTION_UPDATE_VISIBILITY_ANY]),
                    withOwner(mockUserId),
                    'PUBLIC'
                )
            ).not.toThrow();
        });

        it('allows with OWNER_PROMOTION_UPDATE_VISIBILITY_OWN when actor is the owner', () => {
            expect(() =>
                checkCanUpdateVisibility(
                    createActor([PermissionEnum.OWNER_PROMOTION_UPDATE_VISIBILITY_OWN], mockUserId),
                    withOwner(mockUserId),
                    'PRIVATE'
                )
            ).not.toThrow();
        });

        it('forbids with OWNER_PROMOTION_UPDATE_VISIBILITY_OWN when actor is not the owner', () => {
            expectForbidden(
                () =>
                    checkCanUpdateVisibility(
                        createActor(
                            [PermissionEnum.OWNER_PROMOTION_UPDATE_VISIBILITY_OWN],
                            otherUserId
                        ),
                        withOwner(mockUserId),
                        'PUBLIC'
                    ),
                'update owner promotion visibility'
            );
        });

        it('forbids without any permission', () => {
            expectForbidden(
                () => checkCanUpdateVisibility(createActor([]), withOwner(mockUserId), 'PUBLIC'),
                'update owner promotion visibility'
            );
        });
    });
});
