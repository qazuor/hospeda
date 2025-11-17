import type { ServiceListingModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceListingStatusEnum } from '@repo/schemas';
import type { ServiceListing } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    checkCanActivate,
    checkCanCreate,
    checkCanDeactivate,
    checkCanDelete,
    checkCanHardDelete,
    checkCanList,
    checkCanPatch,
    checkCanPublish,
    checkCanRestore,
    checkCanUpdate,
    checkCanView
} from '../../../src/services/serviceListing/serviceListing.permissions.js';
import { ServiceListingService } from '../../../src/services/serviceListing/serviceListing.service.js';
import type { Actor, ServiceContext } from '../../../src/types/index.js';

describe('ServiceListingService', () => {
    let service: ServiceListingService;
    let mockModel: ServiceListingModel;
    let mockContext: ServiceContext;

    const validAdminActor: Actor = {
        id: 'admin-123',
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.SERVICE_LISTING_CREATE,
            PermissionEnum.SERVICE_LISTING_UPDATE,
            PermissionEnum.SERVICE_LISTING_DELETE,
            PermissionEnum.SERVICE_LISTING_VIEW,
            PermissionEnum.SERVICE_LISTING_RESTORE,
            PermissionEnum.SERVICE_LISTING_HARD_DELETE,
            PermissionEnum.SERVICE_LISTING_STATUS_MANAGE
        ]
    };

    const validUserWithPermissions: Actor = {
        id: 'user-with-perms-123',
        role: RoleEnum.USER,
        permissions: [
            PermissionEnum.SERVICE_LISTING_CREATE,
            PermissionEnum.SERVICE_LISTING_UPDATE,
            PermissionEnum.SERVICE_LISTING_DELETE,
            PermissionEnum.SERVICE_LISTING_VIEW,
            PermissionEnum.SERVICE_LISTING_RESTORE,
            PermissionEnum.SERVICE_LISTING_HARD_DELETE,
            PermissionEnum.SERVICE_LISTING_STATUS_MANAGE
        ]
    };

    const validUserWithoutPermissions: Actor = {
        id: 'user-no-perms-123',
        role: RoleEnum.USER,
        permissions: []
    };

    const mockServiceListing: ServiceListing = {
        id: 'listing-123',
        clientId: 'client-123',
        touristServiceId: 'service-123',
        listingPlanId: 'plan-123',
        title: 'Amazing Tour Experience',
        description: 'A wonderful tour through beautiful landscapes',
        basePrice: 50000,
        listingDetails: {
            availabilityType: 'scheduled',
            scheduleDetails: {
                daysOfWeek: [1, 2, 3, 4, 5],
                timeSlots: [
                    { startTime: '09:00', endTime: '12:00' },
                    { startTime: '14:00', endTime: '17:00' }
                ]
            },
            bookingSettings: {
                advanceBookingDays: 2,
                cancellationPolicy: '24 hours before',
                minParticipants: 2,
                maxParticipants: 20,
                instantBooking: true
            },
            highlights: ['Scenic views', 'Expert guide', 'Lunch included'],
            amenities: ['Wi-Fi', 'Air conditioning', 'Restrooms']
        },
        status: ServiceListingStatusEnum.DRAFT,
        isActive: false,
        isFeatured: false,
        isTrialListing: false,
        trialStartDate: null,
        trialEndDate: null,
        publishedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
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
            findByService: vi.fn(),
            findByPlan: vi.fn(),
            findByStatus: vi.fn(),
            findActive: vi.fn(),
            findFeatured: vi.fn(),
            findWithTrial: vi.fn(),
            activate: vi.fn(),
            deactivate: vi.fn(),
            publish: vi.fn(),
            pause: vi.fn()
        } as unknown as ServiceListingModel;

        mockContext = {} as ServiceContext;

        service = new ServiceListingService(mockContext, mockModel);
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
                expect(() => checkCanUpdate(validAdminActor, mockServiceListing)).not.toThrow();
            });

            it('should allow user with UPDATE permission', () => {
                expect(() =>
                    checkCanUpdate(validUserWithPermissions, mockServiceListing)
                ).not.toThrow();
            });

            it('should deny user without UPDATE permission', () => {
                expect(() =>
                    checkCanUpdate(validUserWithoutPermissions, mockServiceListing)
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canPatch', () => {
            it('should allow admin to patch', () => {
                expect(() => checkCanPatch(validAdminActor, mockServiceListing, {})).not.toThrow();
            });

            it('should allow user with UPDATE permission', () => {
                expect(() =>
                    checkCanPatch(validUserWithPermissions, mockServiceListing, {})
                ).not.toThrow();
            });

            it('should deny user without UPDATE permission', () => {
                expect(() =>
                    checkCanPatch(validUserWithoutPermissions, mockServiceListing, {})
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canDelete', () => {
            it('should allow admin to delete', () => {
                expect(() => checkCanDelete(validAdminActor, mockServiceListing)).not.toThrow();
            });

            it('should allow user with DELETE permission', () => {
                expect(() =>
                    checkCanDelete(validUserWithPermissions, mockServiceListing)
                ).not.toThrow();
            });

            it('should deny user without DELETE permission', () => {
                expect(() =>
                    checkCanDelete(validUserWithoutPermissions, mockServiceListing)
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canRestore', () => {
            const deletedListing: ServiceListing = {
                ...mockServiceListing,
                deletedAt: new Date(),
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
                expect(() => checkCanHardDelete(validAdminActor, mockServiceListing)).not.toThrow();
            });

            it('should allow user with HARD_DELETE permission', () => {
                expect(() =>
                    checkCanHardDelete(validUserWithPermissions, mockServiceListing)
                ).not.toThrow();
            });

            it('should deny user without HARD_DELETE permission', () => {
                expect(() =>
                    checkCanHardDelete(validUserWithoutPermissions, mockServiceListing)
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canView', () => {
            it('should allow admin to view', () => {
                expect(() => checkCanView(validAdminActor, mockServiceListing)).not.toThrow();
            });

            it('should allow user with VIEW permission', () => {
                expect(() =>
                    checkCanView(validUserWithPermissions, mockServiceListing)
                ).not.toThrow();
            });

            it('should deny user without VIEW permission', () => {
                expect(() => checkCanView(validUserWithoutPermissions, mockServiceListing)).toThrow(
                    'Insufficient permissions'
                );
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
                expect(() => checkCanActivate(validAdminActor, mockServiceListing)).not.toThrow();
            });

            it('should allow user with STATUS_MANAGE permission', () => {
                expect(() =>
                    checkCanActivate(validUserWithPermissions, mockServiceListing)
                ).not.toThrow();
            });

            it('should deny user without STATUS_MANAGE permission', () => {
                expect(() =>
                    checkCanActivate(validUserWithoutPermissions, mockServiceListing)
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canDeactivate', () => {
            const activeListing = {
                ...mockServiceListing,
                isActive: true,
                status: ServiceListingStatusEnum.ACTIVE
            };

            it('should allow admin to deactivate', () => {
                expect(() => checkCanDeactivate(validAdminActor, activeListing)).not.toThrow();
            });

            it('should allow user with STATUS_MANAGE permission', () => {
                expect(() =>
                    checkCanDeactivate(validUserWithPermissions, activeListing)
                ).not.toThrow();
            });

            it('should deny user without STATUS_MANAGE permission', () => {
                expect(() =>
                    checkCanDeactivate(validUserWithoutPermissions, activeListing)
                ).toThrow('Insufficient permissions');
            });
        });

        describe('_canPublish', () => {
            it('should allow admin to publish', () => {
                expect(() => checkCanPublish(validAdminActor, mockServiceListing)).not.toThrow();
            });

            it('should allow user with STATUS_MANAGE permission', () => {
                expect(() =>
                    checkCanPublish(validUserWithPermissions, mockServiceListing)
                ).not.toThrow();
            });

            it('should deny user without STATUS_MANAGE permission', () => {
                expect(() =>
                    checkCanPublish(validUserWithoutPermissions, mockServiceListing)
                ).toThrow('Insufficient permissions');
            });
        });
    });

    // ============================================================================
    // BUSINESS METHODS TESTS (20 tests: 4 methods × 5 scenarios)
    // ============================================================================

    describe('Business Methods', () => {
        describe('activate', () => {
            it('should activate draft listing successfully', async () => {
                const activatedListing = {
                    ...mockServiceListing,
                    isActive: true,
                    status: ServiceListingStatusEnum.ACTIVE
                };
                vi.mocked(mockModel.activate).mockResolvedValue(activatedListing);

                const result = await service.activate({
                    actor: validAdminActor,
                    listingId: mockServiceListing.id
                });

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data!.isActive).toBe(true);
                expect(result.data!.status).toBe(ServiceListingStatusEnum.ACTIVE);
                expect(mockModel.activate).toHaveBeenCalledWith(mockServiceListing.id);
            });

            it('should deny activation without permission', async () => {
                const result = await service.activate({
                    actor: validUserWithoutPermissions,
                    listingId: mockServiceListing.id
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Insufficient permissions');
                expect(mockModel.activate).not.toHaveBeenCalled();
            });

            it('should handle non-existent listing', async () => {
                vi.mocked(mockModel.activate).mockRejectedValue(
                    new Error('Service listing not found: non-existent-id')
                );

                const result = await service.activate({
                    actor: validAdminActor,
                    listingId: 'non-existent-id'
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Service listing not found');
            });

            it('should handle database errors gracefully', async () => {
                vi.mocked(mockModel.activate).mockRejectedValue(
                    new Error('Database connection failed')
                );

                const result = await service.activate({
                    actor: validAdminActor,
                    listingId: mockServiceListing.id
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Database connection failed');
            });

            it('should allow user with STATUS_MANAGE permission to activate', async () => {
                const activatedListing = {
                    ...mockServiceListing,
                    isActive: true,
                    status: ServiceListingStatusEnum.ACTIVE
                };
                vi.mocked(mockModel.activate).mockResolvedValue(activatedListing);

                const result = await service.activate({
                    actor: validUserWithPermissions,
                    listingId: mockServiceListing.id
                });

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(mockModel.activate).toHaveBeenCalledWith(mockServiceListing.id);
            });
        });

        describe('deactivate', () => {
            const activeListing = {
                ...mockServiceListing,
                isActive: true,
                status: ServiceListingStatusEnum.ACTIVE
            };

            it('should deactivate active listing successfully', async () => {
                const deactivatedListing = {
                    ...activeListing,
                    isActive: false
                };
                vi.mocked(mockModel.deactivate).mockResolvedValue(deactivatedListing);

                const result = await service.deactivate({
                    actor: validAdminActor,
                    listingId: activeListing.id
                });

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data!.isActive).toBe(false);
                expect(mockModel.deactivate).toHaveBeenCalledWith(activeListing.id);
            });

            it('should deny deactivation without permission', async () => {
                const result = await service.deactivate({
                    actor: validUserWithoutPermissions,
                    listingId: activeListing.id
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Insufficient permissions');
                expect(mockModel.deactivate).not.toHaveBeenCalled();
            });

            it('should handle non-existent listing', async () => {
                vi.mocked(mockModel.deactivate).mockRejectedValue(
                    new Error('Service listing not found: non-existent-id')
                );

                const result = await service.deactivate({
                    actor: validAdminActor,
                    listingId: 'non-existent-id'
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Service listing not found');
            });

            it('should handle database errors gracefully', async () => {
                vi.mocked(mockModel.deactivate).mockRejectedValue(
                    new Error('Database connection failed')
                );

                const result = await service.deactivate({
                    actor: validAdminActor,
                    listingId: activeListing.id
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Database connection failed');
            });

            it('should allow user with STATUS_MANAGE permission to deactivate', async () => {
                const deactivatedListing = {
                    ...activeListing,
                    isActive: false
                };
                vi.mocked(mockModel.deactivate).mockResolvedValue(deactivatedListing);

                const result = await service.deactivate({
                    actor: validUserWithPermissions,
                    listingId: activeListing.id
                });

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(mockModel.deactivate).toHaveBeenCalledWith(activeListing.id);
            });
        });

        describe('publish', () => {
            it('should publish draft listing successfully', async () => {
                const publishedListing = {
                    ...mockServiceListing,
                    status: ServiceListingStatusEnum.ACTIVE,
                    isActive: true,
                    publishedAt: new Date()
                };
                vi.mocked(mockModel.publish).mockResolvedValue(publishedListing);

                const result = await service.publish({
                    actor: validAdminActor,
                    listingId: mockServiceListing.id
                });

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data!.status).toBe(ServiceListingStatusEnum.ACTIVE);
                expect(result.data!.isActive).toBe(true);
                expect(result.data!.publishedAt).toBeDefined();
                expect(mockModel.publish).toHaveBeenCalledWith(mockServiceListing.id);
            });

            it('should deny publishing without permission', async () => {
                const result = await service.publish({
                    actor: validUserWithoutPermissions,
                    listingId: mockServiceListing.id
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Insufficient permissions');
                expect(mockModel.publish).not.toHaveBeenCalled();
            });

            it('should handle non-existent listing', async () => {
                vi.mocked(mockModel.publish).mockRejectedValue(
                    new Error('Service listing not found: non-existent-id')
                );

                const result = await service.publish({
                    actor: validAdminActor,
                    listingId: 'non-existent-id'
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Service listing not found');
            });

            it('should handle database errors gracefully', async () => {
                vi.mocked(mockModel.publish).mockRejectedValue(
                    new Error('Database connection failed')
                );

                const result = await service.publish({
                    actor: validAdminActor,
                    listingId: mockServiceListing.id
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Database connection failed');
            });

            it('should allow user with STATUS_MANAGE permission to publish', async () => {
                const publishedListing = {
                    ...mockServiceListing,
                    status: ServiceListingStatusEnum.ACTIVE,
                    isActive: true,
                    publishedAt: new Date()
                };
                vi.mocked(mockModel.publish).mockResolvedValue(publishedListing);

                const result = await service.publish({
                    actor: validUserWithPermissions,
                    listingId: mockServiceListing.id
                });

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(mockModel.publish).toHaveBeenCalledWith(mockServiceListing.id);
            });
        });

        describe('pause', () => {
            const activeListing = {
                ...mockServiceListing,
                status: ServiceListingStatusEnum.ACTIVE,
                isActive: true
            };

            it('should pause active listing successfully', async () => {
                const pausedListing = {
                    ...activeListing,
                    status: ServiceListingStatusEnum.PAUSED,
                    isActive: false
                };
                vi.mocked(mockModel.pause).mockResolvedValue(pausedListing);

                const result = await service.pause({
                    actor: validAdminActor,
                    listingId: activeListing.id
                });

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data!.status).toBe(ServiceListingStatusEnum.PAUSED);
                expect(result.data!.isActive).toBe(false);
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
                    new Error('Service listing not found: non-existent-id')
                );

                const result = await service.pause({
                    actor: validAdminActor,
                    listingId: 'non-existent-id'
                });

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(result.error!.message).toContain('Service listing not found');
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
                    status: ServiceListingStatusEnum.PAUSED,
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
    });
});
