import type { AccommodationListingModel } from '@repo/db';
import { ListingStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import type { AccommodationListing } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    checkCanActivate,
    checkCanArchive,
    checkCanCreate,
    checkCanDelete,
    checkCanHardDelete,
    checkCanList,
    checkCanPatch,
    checkCanPause,
    checkCanRestore,
    checkCanUpdate,
    checkCanView
} from '../../../src/services/accommodationListing/accommodationListing.permissions.js';
import { AccommodationListingService } from '../../../src/services/accommodationListing/accommodationListing.service.js';
import type { Actor, ServiceContext } from '../../../src/types/index.js';

describe('AccommodationListingService', () => {
    let service: AccommodationListingService;
    let mockModel: AccommodationListingModel;
    let mockContext: ServiceContext;

    const validAdminActor: Actor = {
        id: 'admin-123',
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCOMMODATION_LISTING_CREATE,
            PermissionEnum.ACCOMMODATION_LISTING_UPDATE,
            PermissionEnum.ACCOMMODATION_LISTING_DELETE,
            PermissionEnum.ACCOMMODATION_LISTING_VIEW,
            PermissionEnum.ACCOMMODATION_LISTING_RESTORE,
            PermissionEnum.ACCOMMODATION_LISTING_HARD_DELETE,
            PermissionEnum.ACCOMMODATION_LISTING_STATUS_MANAGE
        ]
    };

    const validUserWithPermissions: Actor = {
        id: 'user-with-perms-123',
        role: RoleEnum.USER,
        permissions: [
            PermissionEnum.ACCOMMODATION_LISTING_CREATE,
            PermissionEnum.ACCOMMODATION_LISTING_UPDATE,
            PermissionEnum.ACCOMMODATION_LISTING_DELETE,
            PermissionEnum.ACCOMMODATION_LISTING_VIEW,
            PermissionEnum.ACCOMMODATION_LISTING_RESTORE,
            PermissionEnum.ACCOMMODATION_LISTING_HARD_DELETE,
            PermissionEnum.ACCOMMODATION_LISTING_STATUS_MANAGE
        ]
    };

    const validUserWithoutPermissions: Actor = {
        id: 'user-no-perms-123',
        role: RoleEnum.USER,
        permissions: []
    };

    const mockAccommodationListing: AccommodationListing = {
        id: 'listing-123',
        clientId: 'client-123',
        accommodationId: 'accommodation-123',
        listingPlanId: 'plan-123',
        fromDate: '2024-01-01T00:00:00.000Z',
        toDate: '2024-12-31T23:59:59.999Z',
        trialEndsAt: '2024-02-01T00:00:00.000Z',
        isTrial: true,
        status: ListingStatusEnum.ACTIVE,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        deletedAt: null,
        createdById: 'admin-123',
        updatedById: null,
        deletedById: null
    };

    beforeEach(() => {
        mockModel = {
            create: vi.fn(),
            findById: vi.fn(),
            findAll: vi.fn(),
            update: vi.fn(),
            softDelete: vi.fn(),
            hardDelete: vi.fn(),
            restore: vi.fn(),
            count: vi.fn(),
            findByClient: vi.fn(),
            findByAccommodation: vi.fn(),
            findByPlan: vi.fn(),
            findByStatus: vi.fn(),
            findActive: vi.fn(),
            findWithActiveTrial: vi.fn(),
            activate: vi.fn(),
            pause: vi.fn(),
            archive: vi.fn()
        } as unknown as AccommodationListingModel;

        mockContext = {} as ServiceContext;

        service = new AccommodationListingService(mockContext, mockModel);
    });

    // ============================================================================
    // PERMISSION HOOKS TESTS (33 tests: 11 hooks × 3 scenarios)
    // ============================================================================

    describe('Permission Hooks', () => {
        describe('_canCreate', () => {
            it('should allow admin to create', () => {
                expect(() => checkCanCreate(validAdminActor, {})).not.toThrow();
            });

            it('should allow user with CREATE permission', () => {
                expect(() => checkCanCreate(validUserWithPermissions, {})).not.toThrow();
            });

            it('should deny user without CREATE permission', () => {
                expect(() => checkCanCreate(validUserWithoutPermissions, {})).toThrow(
                    'Insufficient permissions'
                );
            });
        });

        describe('_canUpdate', () => {
            it('should allow admin to update', () => {
                expect(() =>
                    checkCanUpdate(validAdminActor, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should allow user with UPDATE permission', () => {
                expect(() =>
                    checkCanUpdate(validUserWithPermissions, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should deny user without UPDATE permission', () => {
                expect(() =>
                    checkCanUpdate(validUserWithoutPermissions, mockAccommodationListing)
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canPatch', () => {
            it('should allow admin to patch', () => {
                expect(() =>
                    checkCanPatch(validAdminActor, mockAccommodationListing, {})
                ).not.toThrow();
            });

            it('should allow user with UPDATE permission', () => {
                expect(() =>
                    checkCanPatch(validUserWithPermissions, mockAccommodationListing, {})
                ).not.toThrow();
            });

            it('should deny user without UPDATE permission', () => {
                expect(() =>
                    checkCanPatch(validUserWithoutPermissions, mockAccommodationListing, {})
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canDelete', () => {
            it('should allow admin to delete', () => {
                expect(() =>
                    checkCanDelete(validAdminActor, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should allow user with DELETE permission', () => {
                expect(() =>
                    checkCanDelete(validUserWithPermissions, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should deny user without DELETE permission', () => {
                expect(() =>
                    checkCanDelete(validUserWithoutPermissions, mockAccommodationListing)
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canRestore', () => {
            const deletedListing: AccommodationListing = {
                ...mockAccommodationListing,
                deletedAt: new Date('2024-01-02T00:00:00.000Z'),
                deletedById: 'admin-123'
            };

            it('should allow admin to restore', () => {
                expect(() => checkCanRestore(validAdminActor, deletedListing)).not.toThrow();
            });

            it('should allow user with RESTORE permission', () => {
                expect(() =>
                    checkCanRestore(validUserWithPermissions, deletedListing)
                ).not.toThrow();
            });

            it('should deny user without RESTORE permission', () => {
                expect(() => checkCanRestore(validUserWithoutPermissions, deletedListing)).toThrow(
                    'Insufficient permissions'
                );
            });
        });

        describe('_canHardDelete', () => {
            it('should allow admin to hard delete', () => {
                expect(() =>
                    checkCanHardDelete(validAdminActor, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should allow user with HARD_DELETE permission', () => {
                expect(() =>
                    checkCanHardDelete(validUserWithPermissions, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should deny user without HARD_DELETE permission', () => {
                expect(() =>
                    checkCanHardDelete(validUserWithoutPermissions, mockAccommodationListing)
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canView', () => {
            it('should allow admin to view', () => {
                expect(() => checkCanView(validAdminActor, mockAccommodationListing)).not.toThrow();
            });

            it('should allow user with VIEW permission', () => {
                expect(() =>
                    checkCanView(validUserWithPermissions, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should deny user without VIEW permission', () => {
                expect(() =>
                    checkCanView(validUserWithoutPermissions, mockAccommodationListing)
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canList', () => {
            it('should allow admin to list', () => {
                expect(() => checkCanList(validAdminActor)).not.toThrow();
            });

            it('should allow user with VIEW permission', () => {
                expect(() => checkCanList(validUserWithPermissions)).not.toThrow();
            });

            it('should deny user without VIEW permission', () => {
                expect(() => checkCanList(validUserWithoutPermissions)).toThrow(
                    'Insufficient permissions'
                );
            });
        });

        describe('_canActivate', () => {
            it('should allow admin to activate', () => {
                expect(() =>
                    checkCanActivate(validAdminActor, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should allow user with STATUS_MANAGE permission', () => {
                expect(() =>
                    checkCanActivate(validUserWithPermissions, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should deny user without STATUS_MANAGE permission', () => {
                expect(() =>
                    checkCanActivate(validUserWithoutPermissions, mockAccommodationListing)
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canPause', () => {
            const activeListing = {
                ...mockAccommodationListing,
                status: ListingStatusEnum.ACTIVE
            };

            it('should allow admin to pause', () => {
                expect(() => checkCanPause(validAdminActor, activeListing)).not.toThrow();
            });

            it('should allow user with STATUS_MANAGE permission', () => {
                expect(() => checkCanPause(validUserWithPermissions, activeListing)).not.toThrow();
            });

            it('should deny user without STATUS_MANAGE permission', () => {
                expect(() => checkCanPause(validUserWithoutPermissions, activeListing)).toThrow(
                    'Insufficient permissions'
                );
            });
        });

        describe('_canArchive', () => {
            it('should allow admin to archive', () => {
                expect(() =>
                    checkCanArchive(validAdminActor, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should allow user with STATUS_MANAGE permission', () => {
                expect(() =>
                    checkCanArchive(validUserWithPermissions, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should deny user without STATUS_MANAGE permission', () => {
                expect(() =>
                    checkCanArchive(validUserWithoutPermissions, mockAccommodationListing)
                ).toThrow('Insufficient permissions');
            });
        });
    });

    // ============================================================================
    // BUSINESS METHODS TESTS (15 tests: 3 methods × 5 scenarios)
    // ============================================================================

    describe('Business Methods', () => {
        describe('activate', () => {
            it('should activate paused listing successfully', async () => {
                const activatedListing = {
                    ...mockAccommodationListing,
                    status: ListingStatusEnum.ACTIVE,
                    isActive: true
                };
                vi.mocked(mockModel.activate).mockResolvedValue(activatedListing);

                const result = await service.activate({
                    actor: validAdminActor,
                    listingId: mockAccommodationListing.id
                });

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data!.status).toBe(ListingStatusEnum.ACTIVE);
                expect(mockModel.activate).toHaveBeenCalledWith(mockAccommodationListing.id);
            });

            it('should deny activation without permission', async () => {
                const result = await service.activate({
                    actor: validUserWithoutPermissions,
                    listingId: mockAccommodationListing.id
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Insufficient permissions');
                expect(mockModel.activate).not.toHaveBeenCalled();
            });

            it('should handle non-existent listing', async () => {
                vi.mocked(mockModel.activate).mockRejectedValue(
                    new Error('Accommodation listing not found: non-existent-id')
                );

                const result = await service.activate({
                    actor: validAdminActor,
                    listingId: 'non-existent-id'
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Accommodation listing not found');
            });

            it('should handle database errors gracefully', async () => {
                vi.mocked(mockModel.activate).mockRejectedValue(
                    new Error('Database connection failed')
                );

                const result = await service.activate({
                    actor: validAdminActor,
                    listingId: mockAccommodationListing.id
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Database connection failed');
            });

            it('should allow user with STATUS_MANAGE permission to activate', async () => {
                const activatedListing = {
                    ...mockAccommodationListing,
                    status: ListingStatusEnum.ACTIVE,
                    isActive: true
                };
                vi.mocked(mockModel.activate).mockResolvedValue(activatedListing);

                const result = await service.activate({
                    actor: validUserWithPermissions,
                    listingId: mockAccommodationListing.id
                });

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(mockModel.activate).toHaveBeenCalledWith(mockAccommodationListing.id);
            });
        });

        describe('pause', () => {
            const activeListing = {
                ...mockAccommodationListing,
                status: ListingStatusEnum.ACTIVE,
                isActive: true
            };

            it('should pause active listing successfully', async () => {
                const pausedListing = {
                    ...activeListing,
                    status: ListingStatusEnum.PAUSED,
                    isActive: false
                };
                vi.mocked(mockModel.pause).mockResolvedValue(pausedListing);

                const result = await service.pause({
                    actor: validAdminActor,
                    listingId: activeListing.id
                });

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data!.status).toBe(ListingStatusEnum.PAUSED);
                expect(mockModel.pause).toHaveBeenCalledWith(activeListing.id);
            });

            it('should deny pausing without permission', async () => {
                const result = await service.pause({
                    actor: validUserWithoutPermissions,
                    listingId: activeListing.id
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Insufficient permissions');
                expect(mockModel.pause).not.toHaveBeenCalled();
            });

            it('should handle non-existent listing', async () => {
                vi.mocked(mockModel.pause).mockRejectedValue(
                    new Error('Accommodation listing not found: non-existent-id')
                );

                const result = await service.pause({
                    actor: validAdminActor,
                    listingId: 'non-existent-id'
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Accommodation listing not found');
            });

            it('should handle database errors gracefully', async () => {
                vi.mocked(mockModel.pause).mockRejectedValue(
                    new Error('Database connection failed')
                );

                const result = await service.pause({
                    actor: validAdminActor,
                    listingId: activeListing.id
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Database connection failed');
            });

            it('should allow user with STATUS_MANAGE permission to pause', async () => {
                const pausedListing = {
                    ...activeListing,
                    status: ListingStatusEnum.PAUSED,
                    isActive: false
                };
                vi.mocked(mockModel.pause).mockResolvedValue(pausedListing);

                const result = await service.pause({
                    actor: validUserWithPermissions,
                    listingId: activeListing.id
                });

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(mockModel.pause).toHaveBeenCalledWith(activeListing.id);
            });
        });

        describe('archive', () => {
            it('should archive active listing successfully', async () => {
                const archivedListing = {
                    ...mockAccommodationListing,
                    status: ListingStatusEnum.ARCHIVED,
                    isActive: false
                };
                vi.mocked(mockModel.archive).mockResolvedValue(archivedListing);

                const result = await service.archive({
                    actor: validAdminActor,
                    listingId: mockAccommodationListing.id
                });

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data!.status).toBe(ListingStatusEnum.ARCHIVED);
                expect(mockModel.archive).toHaveBeenCalledWith(mockAccommodationListing.id);
            });

            it('should deny archiving without permission', async () => {
                const result = await service.archive({
                    actor: validUserWithoutPermissions,
                    listingId: mockAccommodationListing.id
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Insufficient permissions');
                expect(mockModel.archive).not.toHaveBeenCalled();
            });

            it('should handle non-existent listing', async () => {
                vi.mocked(mockModel.archive).mockRejectedValue(
                    new Error('Accommodation listing not found: non-existent-id')
                );

                const result = await service.archive({
                    actor: validAdminActor,
                    listingId: 'non-existent-id'
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Accommodation listing not found');
            });

            it('should handle database errors gracefully', async () => {
                vi.mocked(mockModel.archive).mockRejectedValue(
                    new Error('Database connection failed')
                );

                const result = await service.archive({
                    actor: validAdminActor,
                    listingId: mockAccommodationListing.id
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Database connection failed');
            });

            it('should allow user with STATUS_MANAGE permission to archive', async () => {
                const archivedListing = {
                    ...mockAccommodationListing,
                    status: ListingStatusEnum.ARCHIVED,
                    isActive: false
                };
                vi.mocked(mockModel.archive).mockResolvedValue(archivedListing);

                const result = await service.archive({
                    actor: validUserWithPermissions,
                    listingId: mockAccommodationListing.id
                });

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(mockModel.archive).toHaveBeenCalledWith(mockAccommodationListing.id);
            });
        });
    });
});
