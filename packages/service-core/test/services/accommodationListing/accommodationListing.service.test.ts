import type { AccommodationListingModel } from '@repo/db';
import { ListingStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import type { AccommodationListing } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationListingService } from '../../../src/services/accommodationListing/accommodationListing.service.js';
import type { Actor, ServiceContext } from '../../../src/types/service-context.js';

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
        isActive: true,
        isVerified: true,
        isFeatured: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
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
                expect(() => service._canCreate(validAdminActor, {})).not.toThrow();
            });

            it('should allow user with CREATE permission', () => {
                expect(() => service._canCreate(validUserWithPermissions, {})).not.toThrow();
            });

            it('should deny user without CREATE permission', () => {
                expect(() => service._canCreate(validUserWithoutPermissions, {})).toThrow(
                    'Insufficient permissions'
                );
            });
        });

        describe('_canUpdate', () => {
            it('should allow admin to update', () => {
                expect(() =>
                    service._canUpdate(validAdminActor, mockAccommodationListing.id, {})
                ).not.toThrow();
            });

            it('should allow user with UPDATE permission', () => {
                expect(() =>
                    service._canUpdate(validUserWithPermissions, mockAccommodationListing.id, {})
                ).not.toThrow();
            });

            it('should deny user without UPDATE permission', () => {
                expect(() =>
                    service._canUpdate(validUserWithoutPermissions, mockAccommodationListing.id, {})
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canPatch', () => {
            it('should allow admin to patch', () => {
                expect(() =>
                    service._canPatch(validAdminActor, mockAccommodationListing, {})
                ).not.toThrow();
            });

            it('should allow user with UPDATE permission', () => {
                expect(() =>
                    service._canPatch(validUserWithPermissions, mockAccommodationListing, {})
                ).not.toThrow();
            });

            it('should deny user without UPDATE permission', () => {
                expect(() =>
                    service._canPatch(validUserWithoutPermissions, mockAccommodationListing, {})
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canDelete', () => {
            it('should allow admin to delete', () => {
                expect(() =>
                    service._canDelete(validAdminActor, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should allow user with DELETE permission', () => {
                expect(() =>
                    service._canDelete(validUserWithPermissions, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should deny user without DELETE permission', () => {
                expect(() =>
                    service._canDelete(validUserWithoutPermissions, mockAccommodationListing)
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canRestore', () => {
            const deletedListing: AccommodationListing = {
                ...mockAccommodationListing,
                deletedAt: '2024-01-02T00:00:00.000Z',
                deletedById: 'admin-123'
            };

            it('should allow admin to restore', () => {
                expect(() => service._canRestore(validAdminActor, deletedListing)).not.toThrow();
            });

            it('should allow user with RESTORE permission', () => {
                expect(() =>
                    service._canRestore(validUserWithPermissions, deletedListing)
                ).not.toThrow();
            });

            it('should deny user without RESTORE permission', () => {
                expect(() =>
                    service._canRestore(validUserWithoutPermissions, deletedListing)
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canHardDelete', () => {
            it('should allow admin to hard delete', () => {
                expect(() =>
                    service._canHardDelete(validAdminActor, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should allow user with HARD_DELETE permission', () => {
                expect(() =>
                    service._canHardDelete(validUserWithPermissions, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should deny user without HARD_DELETE permission', () => {
                expect(() =>
                    service._canHardDelete(validUserWithoutPermissions, mockAccommodationListing)
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canView', () => {
            it('should allow admin to view', () => {
                expect(() =>
                    service._canView(validAdminActor, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should allow user with VIEW permission', () => {
                expect(() =>
                    service._canView(validUserWithPermissions, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should deny user without VIEW permission', () => {
                expect(() =>
                    service._canView(validUserWithoutPermissions, mockAccommodationListing)
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canList', () => {
            it('should allow admin to list', () => {
                expect(() => service._canList(validAdminActor, {})).not.toThrow();
            });

            it('should allow user with VIEW permission', () => {
                expect(() => service._canList(validUserWithPermissions, {})).not.toThrow();
            });

            it('should deny user without VIEW permission', () => {
                expect(() => service._canList(validUserWithoutPermissions, {})).toThrow(
                    'Insufficient permissions'
                );
            });
        });

        describe('_canActivate', () => {
            it('should allow admin to activate', () => {
                expect(() =>
                    service._canActivate(validAdminActor, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should allow user with STATUS_MANAGE permission', () => {
                expect(() =>
                    service._canActivate(validUserWithPermissions, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should deny user without STATUS_MANAGE permission', () => {
                expect(() =>
                    service._canActivate(validUserWithoutPermissions, mockAccommodationListing)
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canPause', () => {
            const activeListing = {
                ...mockAccommodationListing,
                status: ListingStatusEnum.ACTIVE
            };

            it('should allow admin to pause', () => {
                expect(() => service._canPause(validAdminActor, activeListing)).not.toThrow();
            });

            it('should allow user with STATUS_MANAGE permission', () => {
                expect(() =>
                    service._canPause(validUserWithPermissions, activeListing)
                ).not.toThrow();
            });

            it('should deny user without STATUS_MANAGE permission', () => {
                expect(() => service._canPause(validUserWithoutPermissions, activeListing)).toThrow(
                    'Insufficient permissions'
                );
            });
        });

        describe('_canArchive', () => {
            it('should allow admin to archive', () => {
                expect(() =>
                    service._canArchive(validAdminActor, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should allow user with STATUS_MANAGE permission', () => {
                expect(() =>
                    service._canArchive(validUserWithPermissions, mockAccommodationListing)
                ).not.toThrow();
            });

            it('should deny user without STATUS_MANAGE permission', () => {
                expect(() =>
                    service._canArchive(validUserWithoutPermissions, mockAccommodationListing)
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

                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.status).toBe(ListingStatusEnum.ACTIVE);
                    expect(result.data.isActive).toBe(true);
                }
                expect(mockModel.activate).toHaveBeenCalledWith(mockAccommodationListing.id);
            });

            it('should deny activation without permission', async () => {
                const result = await service.activate({
                    actor: validUserWithoutPermissions,
                    listingId: mockAccommodationListing.id
                });

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.message).toContain('Insufficient permissions');
                }
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

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.message).toContain('Accommodation listing not found');
                }
            });

            it('should handle database errors gracefully', async () => {
                vi.mocked(mockModel.activate).mockRejectedValue(
                    new Error('Database connection failed')
                );

                const result = await service.activate({
                    actor: validAdminActor,
                    listingId: mockAccommodationListing.id
                });

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.message).toContain('Database connection failed');
                }
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

                expect(result.success).toBe(true);
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

                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.status).toBe(ListingStatusEnum.PAUSED);
                    expect(result.data.isActive).toBe(false);
                }
                expect(mockModel.pause).toHaveBeenCalledWith(activeListing.id);
            });

            it('should deny pausing without permission', async () => {
                const result = await service.pause({
                    actor: validUserWithoutPermissions,
                    listingId: activeListing.id
                });

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.message).toContain('Insufficient permissions');
                }
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

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.message).toContain('Accommodation listing not found');
                }
            });

            it('should handle database errors gracefully', async () => {
                vi.mocked(mockModel.pause).mockRejectedValue(
                    new Error('Database connection failed')
                );

                const result = await service.pause({
                    actor: validAdminActor,
                    listingId: activeListing.id
                });

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.message).toContain('Database connection failed');
                }
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

                expect(result.success).toBe(true);
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

                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.status).toBe(ListingStatusEnum.ARCHIVED);
                    expect(result.data.isActive).toBe(false);
                }
                expect(mockModel.archive).toHaveBeenCalledWith(mockAccommodationListing.id);
            });

            it('should deny archiving without permission', async () => {
                const result = await service.archive({
                    actor: validUserWithoutPermissions,
                    listingId: mockAccommodationListing.id
                });

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.message).toContain('Insufficient permissions');
                }
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

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.message).toContain('Accommodation listing not found');
                }
            });

            it('should handle database errors gracefully', async () => {
                vi.mocked(mockModel.archive).mockRejectedValue(
                    new Error('Database connection failed')
                );

                const result = await service.archive({
                    actor: validAdminActor,
                    listingId: mockAccommodationListing.id
                });

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.message).toContain('Database connection failed');
                }
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

                expect(result.success).toBe(true);
                expect(mockModel.archive).toHaveBeenCalledWith(mockAccommodationListing.id);
            });
        });
    });
});
