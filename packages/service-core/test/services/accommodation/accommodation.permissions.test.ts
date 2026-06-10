import type { Accommodation, UserIdType } from '@repo/schemas';
import {
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    checkCanAdminList,
    checkCanAdminView,
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
import { createMockAccommodation } from '../../factories/accommodationFactory';
import { getMockId } from '../../factories/utilsFactory';

const createActor = (
    permissions: PermissionEnum[] = [],
    id = 'actor-id',
    role: RoleEnum = RoleEnum.ADMIN
) => ({ id, role, permissions });

const withOwner = (
    ownerId: UserIdType,
    visibility: VisibilityEnum = VisibilityEnum.PRIVATE
): Accommodation => {
    // Aseguramos que reviewsCount, averageRating y tags estén presentes
    return {
        ...createMockAccommodation({ ownerId, visibility }),
        reviewsCount: 1,
        averageRating: 5
        // tags: [mockTag] // TODO: Update if tags are needed for accommodation schema
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

const mockUserId = getMockId('user', 'owner') as UserIdType;
const otherUserId = getMockId('user', 'other') as UserIdType;

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
                ...createMockAccommodation({ ownerId: mockUserId }),
                reviewsCount: 1,
                averageRating: 4.5
                // tags: [mockTag], // TODO: Update if tags are needed
                // features: undefined,
                // schedule: undefined
            })
        ).not.toThrow();
    });
    it('checkCanCreate forbids without permission', () => {
        expectForbidden(
            () =>
                checkCanCreate(createActor([]), {
                    ...createMockAccommodation({ ownerId: mockUserId }),
                    reviewsCount: 1,
                    averageRating: 4.5
                    // tags: [mockTag], // TODO: Update if tags are needed
                    // features: undefined,
                    // schedule: undefined
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
    it('checkCanUpdate blocks the owner editing a service-suspended accommodation', () => {
        const suspended = { ...withOwner(mockUserId), ownerSuspended: true };
        expectForbidden(
            () =>
                checkCanUpdate(
                    createActor([PermissionEnum.ACCOMMODATION_UPDATE_OWN], mockUserId),
                    suspended
                ),
            'while the owner subscription is paused'
        );
    });
    it('checkCanUpdate lets UPDATE_ANY staff edit a service-suspended accommodation', () => {
        const suspended = { ...withOwner(mockUserId), ownerSuspended: true };
        expect(() =>
            checkCanUpdate(createActor([PermissionEnum.ACCOMMODATION_UPDATE_ANY]), suspended)
        ).not.toThrow();
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

    it('checkCanView hides a service-suspended owner accommodation as NOT_FOUND for the public', () => {
        const suspended = {
            ...withOwner(otherUserId, VisibilityEnum.PUBLIC),
            ownerSuspended: true
        };
        try {
            checkCanView(createActor([], 'someone-else'), suspended);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.NOT_FOUND);
            }
        }
    });

    it('checkCanView lets the owner view their own service-suspended accommodation', () => {
        const suspended = {
            ...withOwner(mockUserId, VisibilityEnum.PUBLIC),
            ownerSuspended: true
        };
        expect(() => checkCanView(createActor([], mockUserId), suspended)).not.toThrow();
    });

    it('checkCanView lets ACCOMMODATION_VIEW_ALL view a service-suspended accommodation', () => {
        const suspended = {
            ...withOwner(otherUserId, VisibilityEnum.PUBLIC),
            ownerSuspended: true
        };
        expect(() =>
            checkCanView(
                createActor([PermissionEnum.ACCOMMODATION_VIEW_ALL], 'staff-id'),
                suspended
            )
        ).not.toThrow();
    });

    // SPEC-167 T-004: plan-restricted accommodation visibility
    it('checkCanView hides a plan-restricted accommodation as NOT_FOUND for the public', () => {
        const restricted = {
            ...withOwner(otherUserId, VisibilityEnum.PUBLIC),
            planRestricted: true
        };
        try {
            checkCanView(createActor([], 'someone-else'), restricted);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.NOT_FOUND);
            }
        }
    });

    it('checkCanView lets the owner view their own plan-restricted accommodation', () => {
        const restricted = {
            ...withOwner(mockUserId, VisibilityEnum.PUBLIC),
            planRestricted: true
        };
        expect(() => checkCanView(createActor([], mockUserId), restricted)).not.toThrow();
    });

    it('checkCanView lets ACCOMMODATION_VIEW_ALL view a plan-restricted accommodation', () => {
        const restricted = {
            ...withOwner(otherUserId, VisibilityEnum.PUBLIC),
            planRestricted: true
        };
        expect(() =>
            checkCanView(
                createActor([PermissionEnum.ACCOMMODATION_VIEW_ALL], 'staff-id'),
                restricted
            )
        ).not.toThrow();
    });

    it('checkCanView returns NOT_FOUND (not FORBIDDEN) for plan-restricted to avoid leaking existence', () => {
        const restricted = {
            ...withOwner(otherUserId, VisibilityEnum.PUBLIC),
            planRestricted: true
        };
        try {
            checkCanView(createActor([]), restricted);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.NOT_FOUND);
                expect(err.code).not.toBe(ServiceErrorCode.FORBIDDEN);
            }
        }
    });

    // =========================================================================
    // checkCanView — lifecycle state guard (regression: public-draft-visibility)
    //
    // DRAFT/INACTIVE/ARCHIVED accommodations must be hidden (NOT_FOUND) from
    // non-owners without ACCOMMODATION_VIEW_ALL.  The owner and staff must still
    // be able to see their own non-ACTIVE listings.
    // =========================================================================

    describe('checkCanView — lifecycle state guard', () => {
        it('hides a DRAFT accommodation as NOT_FOUND for an anonymous user', () => {
            const draft = {
                ...withOwner(otherUserId, VisibilityEnum.PUBLIC),
                lifecycleState: LifecycleStatusEnum.DRAFT
            };
            try {
                checkCanView(createActor([], 'anonymous-id'), draft);
                throw new Error('Should have thrown');
            } catch (err) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.NOT_FOUND);
                }
            }
        });

        it('hides an INACTIVE accommodation as NOT_FOUND for a non-owner', () => {
            const inactive = {
                ...withOwner(otherUserId, VisibilityEnum.PUBLIC),
                lifecycleState: LifecycleStatusEnum.INACTIVE
            };
            try {
                checkCanView(createActor([], 'another-user'), inactive);
                throw new Error('Should have thrown');
            } catch (err) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.NOT_FOUND);
                }
            }
        });

        it('hides an ARCHIVED accommodation as NOT_FOUND for a non-owner', () => {
            const archived = {
                ...withOwner(otherUserId, VisibilityEnum.PUBLIC),
                lifecycleState: LifecycleStatusEnum.ARCHIVED
            };
            try {
                checkCanView(createActor([], 'another-user'), archived);
                throw new Error('Should have thrown');
            } catch (err) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.NOT_FOUND);
                }
            }
        });

        it('lets the owner view their own DRAFT accommodation (key regression guard)', () => {
            const draft = {
                ...withOwner(mockUserId, VisibilityEnum.PUBLIC),
                lifecycleState: LifecycleStatusEnum.DRAFT
            };
            // Owner must NOT get NOT_FOUND for their own DRAFTs.
            expect(() => checkCanView(createActor([], mockUserId), draft)).not.toThrow();
        });

        it('lets ACCOMMODATION_VIEW_ALL staff view a DRAFT accommodation', () => {
            const draft = {
                ...withOwner(otherUserId, VisibilityEnum.PUBLIC),
                lifecycleState: LifecycleStatusEnum.DRAFT
            };
            expect(() =>
                checkCanView(
                    createActor([PermissionEnum.ACCOMMODATION_VIEW_ALL], 'staff-id'),
                    draft
                )
            ).not.toThrow();
        });

        it('returns NOT_FOUND (not FORBIDDEN) for DRAFT to avoid leaking existence', () => {
            const draft = {
                ...withOwner(otherUserId, VisibilityEnum.PUBLIC),
                lifecycleState: LifecycleStatusEnum.DRAFT
            };
            try {
                checkCanView(createActor([]), draft);
                throw new Error('Should have thrown');
            } catch (err) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.NOT_FOUND);
                    expect(err.code).not.toBe(ServiceErrorCode.FORBIDDEN);
                }
            }
        });
    });

    it('checkCanList always allows', () => {
        expect(() => checkCanList(createActor([]))).not.toThrow();
    });

    describe('checkCanAdminList', () => {
        it('should throw FORBIDDEN when actor lacks both VIEW_ALL and VIEW_OWN', () => {
            expectForbidden(
                () => checkCanAdminList(createActor([])),
                'ACCOMMODATION_VIEW_ALL or ACCOMMODATION_VIEW_OWN required for admin list'
            );
        });

        it('should allow when actor has ACCOMMODATION_VIEW_ALL permission', () => {
            expect(() =>
                checkCanAdminList(createActor([PermissionEnum.ACCOMMODATION_VIEW_ALL]))
            ).not.toThrow();
        });

        // SPEC-169 §5.2: VIEW_OWN authorizes the admin-list path (server forces owner scope).
        it('should allow when actor has only ACCOMMODATION_VIEW_OWN permission', () => {
            expect(() =>
                checkCanAdminList(createActor([PermissionEnum.ACCOMMODATION_VIEW_OWN]))
            ).not.toThrow();
        });
    });

    describe('checkCanAdminView (SPEC-169)', () => {
        const expectErrorCode = (fn: () => void, code: ServiceErrorCode) => {
            let thrown: unknown;
            try {
                fn();
            } catch (err) {
                thrown = err;
            }
            expect(thrown).toBeInstanceOf(ServiceError);
            expect((thrown as ServiceError).code).toBe(code);
        };

        it('VIEW_ALL actor can view ANY accommodation, incl. another owner PUBLIC one (AC-4)', () => {
            const actor = createActor([PermissionEnum.ACCOMMODATION_VIEW_ALL], mockUserId);
            const others = withOwner(otherUserId, VisibilityEnum.PUBLIC);
            expect(() => checkCanAdminView(actor, others)).not.toThrow();
        });

        it('VIEW_OWN actor can view their OWN accommodation (AC-8)', () => {
            const actor = createActor([PermissionEnum.ACCOMMODATION_VIEW_OWN], mockUserId);
            const own = withOwner(mockUserId, VisibilityEnum.PRIVATE);
            expect(() => checkCanAdminView(actor, own)).not.toThrow();
        });

        it('VIEW_OWN actor gets NOT_FOUND on another owner PUBLIC accommodation (AC-9)', () => {
            const actor = createActor([PermissionEnum.ACCOMMODATION_VIEW_OWN], mockUserId);
            const others = withOwner(otherUserId, VisibilityEnum.PUBLIC);
            expectErrorCode(() => checkCanAdminView(actor, others), ServiceErrorCode.NOT_FOUND);
        });

        it('VIEW_OWN actor gets NOT_FOUND on another owner PRIVATE accommodation (AC-9)', () => {
            const actor = createActor([PermissionEnum.ACCOMMODATION_VIEW_OWN], mockUserId);
            const others = withOwner(otherUserId, VisibilityEnum.PRIVATE);
            expectErrorCode(() => checkCanAdminView(actor, others), ServiceErrorCode.NOT_FOUND);
        });

        it('actor with neither VIEW_ALL nor VIEW_OWN gets FORBIDDEN', () => {
            const actor = createActor([], mockUserId);
            const own = withOwner(mockUserId, VisibilityEnum.PRIVATE);
            expectErrorCode(() => checkCanAdminView(actor, own), ServiceErrorCode.FORBIDDEN);
        });
    });
});
