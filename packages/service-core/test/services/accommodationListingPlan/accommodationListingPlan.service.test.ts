import type { AccommodationListingPlanModel } from '@repo/db';
import {
    type AccommodationListingPlan,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationListingPlanService } from '../../../src/services/accommodationListingPlan/accommodationListingPlan.service.js';
import type { Actor, ServiceContext } from '../../../src/types/index.js';

// Mock AccommodationListingPlanModel
const mockModel: AccommodationListingPlanModel = {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
    hardDelete: vi.fn(),
    findAll: vi.fn(),
    findActive: vi.fn(),
    findWithTrial: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn()
} as unknown as AccommodationListingPlanModel;

// Mock data
const mockAccommodationListingPlan: AccommodationListingPlan = {
    id: 'plan-123',
    name: 'Basic Plan',
    limits: {
        maxListings: 10,
        maxPhotos: 50
    },
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

describe('AccommodationListingPlanService', () => {
    let service: AccommodationListingPlanService;
    let mockContext: ServiceContext;

    // Test Actors
    const adminActor: Actor = {
        id: 'admin-123',
        role: RoleEnum.ADMIN,
        permissions: []
    };

    const userWithPermission: Actor = {
        id: 'user-456',
        role: RoleEnum.USER,
        permissions: [PermissionEnum.ACCOMMODATION_LISTING_PLAN_CREATE]
    };

    const userWithoutPermission: Actor = {
        id: 'user-789',
        role: RoleEnum.USER,
        permissions: []
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockContext = {
            userId: 'admin-123',
            role: RoleEnum.ADMIN,
            permissions: []
        };
        service = new AccommodationListingPlanService(mockContext, mockModel);
    });

    // ============================================================================
    // PERMISSION HOOKS TESTS (11 hooks × 3 scenarios = 33 tests)
    // ============================================================================

    describe('Permission Hooks', () => {
        describe('_canCreate', () => {
            it('should allow admin to create', () => {
                expect(() => service._canCreate(adminActor, {})).not.toThrow();
            });

            it('should allow user with CREATE permission', () => {
                expect(() => service._canCreate(userWithPermission, {})).not.toThrow();
            });

            it('should deny user without CREATE permission', () => {
                expect(() => service._canCreate(userWithoutPermission, {})).toThrow(
                    'Permission denied: Insufficient permissions to create accommodation listing plans'
                );
            });
        });

        describe('_canUpdate', () => {
            it('should allow admin to update', () => {
                expect(() => service._canUpdate(adminActor, 'plan-123', {})).not.toThrow();
            });

            it('should allow user with UPDATE permission', () => {
                const actor: Actor = {
                    ...userWithPermission,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_PLAN_UPDATE]
                };
                expect(() => service._canUpdate(actor, 'plan-123', {})).not.toThrow();
            });

            it('should deny user without UPDATE permission', () => {
                expect(() => service._canUpdate(userWithoutPermission, 'plan-123', {})).toThrow(
                    'Permission denied: Insufficient permissions to update accommodation listing plans'
                );
            });
        });

        describe('_canPatch', () => {
            it('should allow admin to patch', () => {
                expect(() =>
                    service._canPatch(adminActor, mockAccommodationListingPlan, {})
                ).not.toThrow();
            });

            it('should allow user with UPDATE permission', () => {
                const actor: Actor = {
                    ...userWithPermission,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_PLAN_UPDATE]
                };
                expect(() =>
                    service._canPatch(actor, mockAccommodationListingPlan, {})
                ).not.toThrow();
            });

            it('should deny user without UPDATE permission', () => {
                expect(() =>
                    service._canPatch(userWithoutPermission, mockAccommodationListingPlan, {})
                ).toThrow(
                    'Permission denied: Insufficient permissions to patch accommodation listing plans'
                );
            });
        });

        describe('_canDelete', () => {
            it('should allow admin to delete', () => {
                expect(() =>
                    service._canDelete(adminActor, mockAccommodationListingPlan)
                ).not.toThrow();
            });

            it('should allow user with DELETE permission', () => {
                const actor: Actor = {
                    ...userWithPermission,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_PLAN_DELETE]
                };
                expect(() => service._canDelete(actor, mockAccommodationListingPlan)).not.toThrow();
            });

            it('should deny user without DELETE permission', () => {
                expect(() =>
                    service._canDelete(userWithoutPermission, mockAccommodationListingPlan)
                ).toThrow(
                    'Permission denied: Insufficient permissions to delete accommodation listing plans'
                );
            });
        });

        describe('_canHardDelete', () => {
            it('should allow admin to hard delete', () => {
                expect(() =>
                    service._canHardDelete(adminActor, mockAccommodationListingPlan)
                ).not.toThrow();
            });

            it('should allow user with HARD_DELETE permission', () => {
                const actor: Actor = {
                    ...userWithPermission,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_PLAN_HARD_DELETE]
                };
                expect(() =>
                    service._canHardDelete(actor, mockAccommodationListingPlan)
                ).not.toThrow();
            });

            it('should deny user without HARD_DELETE permission', () => {
                expect(() =>
                    service._canHardDelete(userWithoutPermission, mockAccommodationListingPlan)
                ).toThrow(
                    'Permission denied: Insufficient permissions to permanently delete accommodation listing plans'
                );
            });
        });

        describe('_canRestore', () => {
            it('should allow admin to restore', () => {
                expect(() =>
                    service._canRestore(adminActor, mockAccommodationListingPlan)
                ).not.toThrow();
            });

            it('should allow user with RESTORE permission', () => {
                const actor: Actor = {
                    ...userWithPermission,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_PLAN_RESTORE]
                };
                expect(() =>
                    service._canRestore(actor, mockAccommodationListingPlan)
                ).not.toThrow();
            });

            it('should deny user without RESTORE permission', () => {
                expect(() =>
                    service._canRestore(userWithoutPermission, mockAccommodationListingPlan)
                ).toThrow(
                    'Permission denied: Insufficient permissions to restore accommodation listing plans'
                );
            });
        });

        describe('_canView', () => {
            it('should allow admin to view', () => {
                expect(() =>
                    service._canView(adminActor, mockAccommodationListingPlan)
                ).not.toThrow();
            });

            it('should allow user with VIEW permission', () => {
                const actor: Actor = {
                    ...userWithPermission,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_PLAN_VIEW]
                };
                expect(() => service._canView(actor, mockAccommodationListingPlan)).not.toThrow();
            });

            it('should deny user without VIEW permission', () => {
                expect(() =>
                    service._canView(userWithoutPermission, mockAccommodationListingPlan)
                ).toThrow(
                    'Permission denied: Insufficient permissions to view accommodation listing plans'
                );
            });
        });

        describe('_canList', () => {
            it('should allow admin to list', () => {
                expect(() => service._canList(adminActor, {})).not.toThrow();
            });

            it('should allow user with VIEW permission', () => {
                const actor: Actor = {
                    ...userWithPermission,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_PLAN_VIEW]
                };
                expect(() => service._canList(actor, {})).not.toThrow();
            });

            it('should deny user without VIEW permission', () => {
                expect(() => service._canList(userWithoutPermission, {})).toThrow(
                    'Permission denied: Insufficient permissions to list accommodation listing plans'
                );
            });
        });

        describe('_canActivate', () => {
            it('should allow admin to activate', () => {
                expect(() =>
                    service._canActivate(adminActor, mockAccommodationListingPlan)
                ).not.toThrow();
            });

            it('should allow user with STATUS_MANAGE permission', () => {
                const actor: Actor = {
                    ...userWithPermission,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_PLAN_STATUS_MANAGE]
                };
                expect(() =>
                    service._canActivate(actor, mockAccommodationListingPlan)
                ).not.toThrow();
            });

            it('should deny user without STATUS_MANAGE permission', () => {
                expect(() =>
                    service._canActivate(userWithoutPermission, mockAccommodationListingPlan)
                ).toThrow(
                    'Permission denied: Insufficient permissions to activate accommodation listing plans'
                );
            });
        });

        describe('_canDeactivate', () => {
            it('should allow admin to deactivate', () => {
                expect(() =>
                    service._canDeactivate(adminActor, mockAccommodationListingPlan)
                ).not.toThrow();
            });

            it('should allow user with STATUS_MANAGE permission', () => {
                const actor: Actor = {
                    ...userWithPermission,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_PLAN_STATUS_MANAGE]
                };
                expect(() =>
                    service._canDeactivate(actor, mockAccommodationListingPlan)
                ).not.toThrow();
            });

            it('should deny user without STATUS_MANAGE permission', () => {
                expect(() =>
                    service._canDeactivate(userWithoutPermission, mockAccommodationListingPlan)
                ).toThrow(
                    'Permission denied: Insufficient permissions to deactivate accommodation listing plans'
                );
            });
        });

        describe('_canArchive', () => {
            it('should allow admin to archive', () => {
                expect(() =>
                    service._canArchive(adminActor, mockAccommodationListingPlan)
                ).not.toThrow();
            });

            it('should allow user with STATUS_MANAGE permission', () => {
                const actor: Actor = {
                    ...userWithPermission,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_PLAN_STATUS_MANAGE]
                };
                expect(() =>
                    service._canArchive(actor, mockAccommodationListingPlan)
                ).not.toThrow();
            });

            it('should deny user without STATUS_MANAGE permission', () => {
                expect(() =>
                    service._canArchive(userWithoutPermission, mockAccommodationListingPlan)
                ).toThrow(
                    'Permission denied: Insufficient permissions to archive accommodation listing plans'
                );
            });
        });
    });

    // ============================================================================
    // BUSINESS METHODS TESTS (2 methods × 5 scenarios = 10 tests)
    // ============================================================================

    describe('Business Methods', () => {
        describe('activate', () => {
            it('should activate a plan successfully', async () => {
                vi.mocked(mockModel.activate).mockResolvedValue({
                    ...mockAccommodationListingPlan,
                    isActive: true
                });

                const result = await service.activate({
                    actor: adminActor,
                    planId: 'plan-123'
                });

                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.isActive).toBe(true);
                }
                expect(mockModel.activate).toHaveBeenCalledWith('plan-123');
            });

            it('should deny permission without proper role', async () => {
                const result = await service.activate({
                    actor: userWithoutPermission,
                    planId: 'plan-123'
                });

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.code).toBe(ServiceErrorCode.FORBIDDEN);
                    expect(result.error.message).toContain(
                        'Permission denied: Insufficient permissions to activate accommodation listing plans'
                    );
                }
            });

            it('should handle non-existent plan', async () => {
                vi.mocked(mockModel.activate).mockRejectedValue(
                    new Error('Accommodation listing plan not found')
                );

                const result = await service.activate({
                    actor: adminActor,
                    planId: 'non-existent'
                });

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
                }
            });

            it('should handle database errors', async () => {
                vi.mocked(mockModel.activate).mockRejectedValue(
                    new Error('Database connection error')
                );

                const result = await service.activate({
                    actor: adminActor,
                    planId: 'plan-123'
                });

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
                }
            });

            it('should allow user with STATUS_MANAGE permission', async () => {
                const actor: Actor = {
                    ...userWithPermission,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_PLAN_STATUS_MANAGE]
                };

                vi.mocked(mockModel.activate).mockResolvedValue({
                    ...mockAccommodationListingPlan,
                    isActive: true
                });

                const result = await service.activate({
                    actor,
                    planId: 'plan-123'
                });

                expect(result.success).toBe(true);
            });
        });

        describe('deactivate', () => {
            it('should deactivate a plan successfully', async () => {
                vi.mocked(mockModel.deactivate).mockResolvedValue({
                    ...mockAccommodationListingPlan,
                    isActive: false
                });

                const result = await service.deactivate({
                    actor: adminActor,
                    planId: 'plan-123'
                });

                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.isActive).toBe(false);
                }
                expect(mockModel.deactivate).toHaveBeenCalledWith('plan-123');
            });

            it('should deny permission without proper role', async () => {
                const result = await service.deactivate({
                    actor: userWithoutPermission,
                    planId: 'plan-123'
                });

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.code).toBe(ServiceErrorCode.FORBIDDEN);
                    expect(result.error.message).toContain(
                        'Permission denied: Insufficient permissions to deactivate accommodation listing plans'
                    );
                }
            });

            it('should handle non-existent plan', async () => {
                vi.mocked(mockModel.deactivate).mockRejectedValue(
                    new Error('Accommodation listing plan not found')
                );

                const result = await service.deactivate({
                    actor: adminActor,
                    planId: 'non-existent'
                });

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
                }
            });

            it('should handle database errors', async () => {
                vi.mocked(mockModel.deactivate).mockRejectedValue(
                    new Error('Database connection error')
                );

                const result = await service.deactivate({
                    actor: adminActor,
                    planId: 'plan-123'
                });

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
                }
            });

            it('should allow user with STATUS_MANAGE permission', async () => {
                const actor: Actor = {
                    ...userWithPermission,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_PLAN_STATUS_MANAGE]
                };

                vi.mocked(mockModel.deactivate).mockResolvedValue({
                    ...mockAccommodationListingPlan,
                    isActive: false
                });

                const result = await service.deactivate({
                    actor,
                    planId: 'plan-123'
                });

                expect(result.success).toBe(true);
            });
        });
    });
});
