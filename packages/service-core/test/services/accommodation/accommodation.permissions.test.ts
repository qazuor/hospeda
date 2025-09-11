import type { AccommodationType, TagId } from '@repo/types';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    TagColorEnum,
    type UserId,
    VisibilityEnum
} from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    checkCanCreate,
    checkCanHardDelete,
    checkCanList,
    checkCanRestore,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanView
} from '../../../src/services/accommodation/accommodation.permissions';
import { ServiceError } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';
import { createAccommodation } from '../../factories/accommodationFactory';
import { getMockId } from '../../factories/utilsFactory';

const createActor = (
    permissions: PermissionEnum[] = [],
    id = 'actor-id',
    role: RoleEnum = RoleEnum.ADMIN
) => ({ id, role, permissions });

const mockTag = {
    id: getMockId('tag') as TagId,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: getMockId('user') as UserId,
    updatedById: getMockId('user') as UserId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.APPROVED,
    name: 'tag',
    slug: 'tag',
    description: 'desc',
    color: TagColorEnum.BLUE,
    icon: 'icon'
};

const withOwner = (
    ownerId: UserId,
    visibility: VisibilityEnum = VisibilityEnum.PRIVATE
): AccommodationType => {
    // Aseguramos que reviewsCount, averageRating y tags estén presentes
    return {
        ...createAccommodation({ ownerId, visibility }),
        reviewsCount: 1,
        averageRating: 5,
        tags: [mockTag]
    };
};

const expectForbidden = (fn: () => void, message: string) => {
    try {
        fn();
        throw new Error('Should have thrown');
    } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        if (err instanceof ServiceError) {
            expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(err.message).toMatch(message);
        }
    }
};

const mockUserId = getMockId('user', 'owner') as UserId;
const otherUserId = getMockId('user', 'other') as UserId;

beforeEach(() => {
    vi.restoreAllMocks();
    // Mock hasPermission to match the actor's permissions array
    vi.spyOn(permissionUtils, 'hasPermission').mockImplementation((actor, permission) => {
        return actor.permissions.includes(permission);
    });
    // Mock checkGenericPermission to throw only if neither ANY nor (OWN and owner) is true
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

describe('Accommodation Permissions', () => {
    it('checkCanCreate allows with permission', () => {
        expect(() =>
            checkCanCreate(createActor([PermissionEnum.ACCOMMODATION_CREATE]), {
                ...createAccommodation({ ownerId: mockUserId }),
                reviewsCount: 1,
                averageRating: 4.5,
                tags: [mockTag],
                features: undefined,
                schedule: undefined
            })
        ).not.toThrow();
    });
    it('checkCanCreate forbids without permission', () => {
        expectForbidden(
            () =>
                checkCanCreate(createActor([]), {
                    ...createAccommodation({ ownerId: mockUserId }),
                    reviewsCount: 1,
                    averageRating: 4.5,
                    tags: [mockTag],
                    features: undefined,
                    schedule: undefined
                }),
            'Permission denied to create accommodation'
        );
    });

    it('checkCanUpdate allows with ANY permission', () => {
        expect(() =>
            checkCanUpdate(
                createActor([PermissionEnum.ACCOMMODATION_UPDATE_ANY]),
                withOwner(mockUserId)
            )
        ).not.toThrow();
    });
    it('checkCanUpdate allows with OWN permission and is owner', () => {
        expect(() =>
            checkCanUpdate(
                createActor([PermissionEnum.ACCOMMODATION_UPDATE_OWN], mockUserId),
                withOwner(mockUserId)
            )
        ).not.toThrow();
    });
    it('checkCanUpdate forbids without permission', () => {
        expectForbidden(
            () => checkCanUpdate(createActor([]), withOwner(mockUserId)),
            'Permission denied to update accommodation'
        );
    });
    it('checkCanUpdate forbids with OWN permission but not owner', () => {
        expectForbidden(
            () =>
                checkCanUpdate(
                    createActor([PermissionEnum.ACCOMMODATION_UPDATE_OWN], otherUserId),
                    withOwner(mockUserId)
                ),
            'Permission denied to update accommodation'
        );
    });

    it('checkCanSoftDelete allows with ANY permission', () => {
        expect(() =>
            checkCanSoftDelete(
                createActor([PermissionEnum.ACCOMMODATION_DELETE_ANY]),
                withOwner(mockUserId)
            )
        ).not.toThrow();
    });
    it('checkCanSoftDelete allows with OWN permission and is owner', () => {
        expect(() =>
            checkCanSoftDelete(
                createActor([PermissionEnum.ACCOMMODATION_DELETE_OWN], mockUserId),
                withOwner(mockUserId)
            )
        ).not.toThrow();
    });
    it('checkCanSoftDelete forbids without permission', () => {
        expectForbidden(
            () => checkCanSoftDelete(createActor([]), withOwner(mockUserId)),
            'Permission denied to delete accommodation'
        );
    });
    it('checkCanSoftDelete forbids with OWN permission but not owner', () => {
        expectForbidden(
            () =>
                checkCanSoftDelete(
                    createActor([PermissionEnum.ACCOMMODATION_DELETE_OWN], otherUserId),
                    withOwner(mockUserId)
                ),
            'Permission denied to delete accommodation'
        );
    });

    it('checkCanHardDelete allows with permission', () => {
        expect(() =>
            checkCanHardDelete(
                createActor([PermissionEnum.ACCOMMODATION_HARD_DELETE]),
                withOwner(mockUserId)
            )
        ).not.toThrow();
    });
    it('checkCanHardDelete forbids without permission', () => {
        expectForbidden(
            () => checkCanHardDelete(createActor([]), withOwner(mockUserId)),
            'Permission denied to permanently delete accommodation'
        );
    });

    it('checkCanRestore allows with ANY permission', () => {
        expect(() =>
            checkCanRestore(
                createActor([PermissionEnum.ACCOMMODATION_RESTORE_ANY]),
                withOwner(mockUserId)
            )
        ).not.toThrow();
    });
    it('checkCanRestore allows with OWN permission and is owner', () => {
        expect(() =>
            checkCanRestore(
                createActor([PermissionEnum.ACCOMMODATION_RESTORE_OWN], mockUserId),
                withOwner(mockUserId)
            )
        ).not.toThrow();
    });
    it('checkCanRestore forbids without permission', () => {
        expectForbidden(
            () => checkCanRestore(createActor([]), withOwner(mockUserId)),
            'Permission denied to restore accommodation'
        );
    });
    it('checkCanRestore forbids with OWN permission but not owner', () => {
        expectForbidden(
            () =>
                checkCanRestore(
                    createActor([PermissionEnum.ACCOMMODATION_RESTORE_OWN], otherUserId),
                    withOwner(mockUserId)
                ),
            'Permission denied to restore accommodation'
        );
    });

    it('checkCanView allows public', () => {
        expect(() =>
            checkCanView(createActor([]), withOwner(otherUserId, VisibilityEnum.PUBLIC))
        ).not.toThrow();
    });
    it('checkCanView allows owner', () => {
        expect(() =>
            checkCanView(createActor([], mockUserId), withOwner(mockUserId, VisibilityEnum.PRIVATE))
        ).not.toThrow();
    });
    it('checkCanView allows with ACCOMMODATION_VIEW_PRIVATE', () => {
        expect(() =>
            checkCanView(
                createActor([PermissionEnum.ACCOMMODATION_VIEW_PRIVATE]),
                withOwner(otherUserId, VisibilityEnum.PRIVATE)
            )
        ).not.toThrow();
    });
    it('checkCanView allows with ACCOMMODATION_VIEW_ALL', () => {
        expect(() =>
            checkCanView(
                createActor([PermissionEnum.ACCOMMODATION_VIEW_ALL]),
                withOwner(otherUserId, VisibilityEnum.PRIVATE)
            )
        ).not.toThrow();
    });
    it('checkCanView forbids private without permission', () => {
        expectForbidden(
            () => checkCanView(createActor([]), withOwner(otherUserId, VisibilityEnum.PRIVATE)),
            'Permission denied to view accommodation'
        );
    });

    it('checkCanList always allows', () => {
        expect(() => checkCanList(createActor([]))).not.toThrow();
    });
});
