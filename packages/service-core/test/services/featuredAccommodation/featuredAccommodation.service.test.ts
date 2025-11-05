import type { FeaturedAccommodationModel } from '@repo/db';
import { FeaturedStatusEnum, FeaturedTypeEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import type { FeaturedAccommodation } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeaturedAccommodationService } from '../../../src/services/featuredAccommodation/featuredAccommodation.service.js';
import type { Actor, ServiceContext } from '../../../src/types/service-context.js';

describe('FeaturedAccommodationService', () => {
    let service: FeaturedAccommodationService;
    let mockModel: FeaturedAccommodationModel;
    let mockContext: ServiceContext;

    const validAdminActor: Actor = {
        id: 'admin-123',
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.FEATURED_ACCOMMODATION_CREATE,
            PermissionEnum.FEATURED_ACCOMMODATION_UPDATE,
            PermissionEnum.FEATURED_ACCOMMODATION_DELETE,
            PermissionEnum.FEATURED_ACCOMMODATION_VIEW,
            PermissionEnum.FEATURED_ACCOMMODATION_RESTORE,
            PermissionEnum.FEATURED_ACCOMMODATION_HARD_DELETE,
            PermissionEnum.FEATURED_ACCOMMODATION_STATUS_MANAGE
        ]
    };

    const validUserWithPermissions: Actor = {
        id: 'user-with-perms-123',
        role: RoleEnum.USER,
        permissions: [
            PermissionEnum.FEATURED_ACCOMMODATION_CREATE,
            PermissionEnum.FEATURED_ACCOMMODATION_UPDATE,
            PermissionEnum.FEATURED_ACCOMMODATION_DELETE,
            PermissionEnum.FEATURED_ACCOMMODATION_VIEW,
            PermissionEnum.FEATURED_ACCOMMODATION_RESTORE,
            PermissionEnum.FEATURED_ACCOMMODATION_HARD_DELETE,
            PermissionEnum.FEATURED_ACCOMMODATION_STATUS_MANAGE
        ]
    };

    const validUserWithoutPermissions: Actor = {
        id: 'user-no-perms-123',
        role: RoleEnum.USER,
        permissions: []
    };

    const mockFeaturedAccommodation: FeaturedAccommodation = {
        id: 'featured-123',
        clientId: 'client-123',
        accommodationId: 'accommodation-123',
        featuredType: FeaturedTypeEnum.HOME,
        fromDate: new Date('2024-01-01').toISOString(),
        toDate: new Date('2024-12-31').toISOString(),
        status: FeaturedStatusEnum.ACTIVE,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
            updateById: vi.fn(),
            softDelete: vi.fn(),
            hardDelete: vi.fn(),
            restore: vi.fn(),
            count: vi.fn(),
            featureOnHome: vi.fn(),
            featureInDestination: vi.fn(),
            featureInSearch: vi.fn(),
            isActive: vi.fn(),
            calculateVisibility: vi.fn(),
            getPlacementStats: vi.fn(),
            getPriority: vi.fn(),
            updatePriority: vi.fn(),
            resolvePriorityConflicts: vi.fn(),
            findByType: vi.fn(),
            findByAccommodation: vi.fn(),
            findActive: vi.fn(),
            withAccommodation: vi.fn()
        } as unknown as FeaturedAccommodationModel;

        mockContext = {} as ServiceContext;

        service = new FeaturedAccommodationService(mockContext, mockModel);
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
                expect(() => service._canCreate(validUserWithoutPermissions, {})).toThrow();
                expect(() => service._canCreate(validUserWithoutPermissions, {})).toThrow(
                    'Permission denied: Only admins or authorized users can create featured accommodations'
                );
            });
        });

        describe('_canUpdate', () => {
            it('should allow admin to update', () => {
                expect(() => service._canUpdate(validAdminActor, 'featured-123', {})).not.toThrow();
            });

            it('should allow user with UPDATE permission', () => {
                expect(() =>
                    service._canUpdate(validUserWithPermissions, 'featured-123', {})
                ).not.toThrow();
            });

            it('should deny user without UPDATE permission', () => {
                expect(() =>
                    service._canUpdate(validUserWithoutPermissions, 'featured-123', {})
                ).toThrow();
                expect(() =>
                    service._canUpdate(validUserWithoutPermissions, 'featured-123', {})
                ).toThrow(
                    'Permission denied: Only admins or authorized users can update featured accommodations'
                );
            });
        });

        describe('_canSoftDelete', () => {
            it('should allow admin to soft delete', () => {
                expect(() => service._canSoftDelete(validAdminActor, 'featured-123')).not.toThrow();
            });

            it('should allow user with DELETE permission', () => {
                expect(() =>
                    service._canSoftDelete(validUserWithPermissions, 'featured-123')
                ).not.toThrow();
            });

            it('should deny user without DELETE permission', () => {
                expect(() =>
                    service._canSoftDelete(validUserWithoutPermissions, 'featured-123')
                ).toThrow();
                expect(() =>
                    service._canSoftDelete(validUserWithoutPermissions, 'featured-123')
                ).toThrow(
                    'Permission denied: Only admins or authorized users can delete featured accommodations'
                );
            });
        });

        describe('_canHardDelete', () => {
            it('should allow admin to hard delete', () => {
                expect(() => service._canHardDelete(validAdminActor, 'featured-123')).not.toThrow();
            });

            it('should allow user with HARD_DELETE permission', () => {
                expect(() =>
                    service._canHardDelete(validUserWithPermissions, 'featured-123')
                ).not.toThrow();
            });

            it('should deny user without HARD_DELETE permission', () => {
                expect(() =>
                    service._canHardDelete(validUserWithoutPermissions, 'featured-123')
                ).toThrow();
                expect(() =>
                    service._canHardDelete(validUserWithoutPermissions, 'featured-123')
                ).toThrow(
                    'Permission denied: Only admins or authorized users can permanently delete featured accommodations'
                );
            });
        });

        describe('_canRestore', () => {
            it('should allow admin to restore', () => {
                expect(() => service._canRestore(validAdminActor, 'featured-123')).not.toThrow();
            });

            it('should allow user with RESTORE permission', () => {
                expect(() =>
                    service._canRestore(validUserWithPermissions, 'featured-123')
                ).not.toThrow();
            });

            it('should deny user without RESTORE permission', () => {
                expect(() =>
                    service._canRestore(validUserWithoutPermissions, 'featured-123')
                ).toThrow();
                expect(() =>
                    service._canRestore(validUserWithoutPermissions, 'featured-123')
                ).toThrow(
                    'Permission denied: Only admins or authorized users can restore featured accommodations'
                );
            });
        });

        describe('_canView', () => {
            it('should allow admin to view', () => {
                expect(() => service._canView(validAdminActor, 'featured-123')).not.toThrow();
            });

            it('should allow user with VIEW permission', () => {
                expect(() =>
                    service._canView(validUserWithPermissions, 'featured-123')
                ).not.toThrow();
            });

            it('should deny user without VIEW permission', () => {
                expect(() =>
                    service._canView(validUserWithoutPermissions, 'featured-123')
                ).toThrow();
                expect(() => service._canView(validUserWithoutPermissions, 'featured-123')).toThrow(
                    'Permission denied: Only admins or authorized users can view featured accommodations'
                );
            });
        });

        describe('_canList', () => {
            it('should allow admin to list', () => {
                expect(() => service._canList(validAdminActor)).not.toThrow();
            });

            it('should allow user with VIEW permission', () => {
                expect(() => service._canList(validUserWithPermissions)).not.toThrow();
            });

            it('should deny user without VIEW permission', () => {
                expect(() => service._canList(validUserWithoutPermissions)).toThrow();
                expect(() => service._canList(validUserWithoutPermissions)).toThrow(
                    'Permission denied: Only admins or authorized users can list featured accommodations'
                );
            });
        });

        describe('_canSearch', () => {
            it('should allow admin to search', () => {
                expect(() => service._canSearch(validAdminActor, {})).not.toThrow();
            });

            it('should allow user with VIEW permission', () => {
                expect(() => service._canSearch(validUserWithPermissions, {})).not.toThrow();
            });

            it('should deny user without VIEW permission', () => {
                expect(() => service._canSearch(validUserWithoutPermissions, {})).toThrow();
                expect(() => service._canSearch(validUserWithoutPermissions, {})).toThrow(
                    'Permission denied: Only admins or authorized users can search featured accommodations'
                );
            });
        });

        describe('_canCount', () => {
            it('should allow admin to count', () => {
                expect(() => service._canCount(validAdminActor, {})).not.toThrow();
            });

            it('should allow user with VIEW permission', () => {
                expect(() => service._canCount(validUserWithPermissions, {})).not.toThrow();
            });

            it('should deny user without VIEW permission', () => {
                expect(() => service._canCount(validUserWithoutPermissions, {})).toThrow();
                expect(() => service._canCount(validUserWithoutPermissions, {})).toThrow(
                    'Permission denied: Only admins or authorized users can count featured accommodations'
                );
            });
        });

        describe('_canManageStatus', () => {
            it('should allow admin to manage status', () => {
                expect(() =>
                    service._canManageStatus(validAdminActor, 'featured-123')
                ).not.toThrow();
            });

            it('should allow user with STATUS_MANAGE permission', () => {
                expect(() =>
                    service._canManageStatus(validUserWithPermissions, 'featured-123')
                ).not.toThrow();
            });

            it('should deny user without STATUS_MANAGE permission', () => {
                expect(() =>
                    service._canManageStatus(validUserWithoutPermissions, 'featured-123')
                ).toThrow();
                expect(() =>
                    service._canManageStatus(validUserWithoutPermissions, 'featured-123')
                ).toThrow(
                    'Permission denied: Only admins or authorized users can manage featured accommodation status'
                );
            });
        });

        describe('_canManagePriority', () => {
            it('should allow admin to manage priority', () => {
                expect(() =>
                    service._canManagePriority(validAdminActor, 'featured-123')
                ).not.toThrow();
            });

            it('should allow user with STATUS_MANAGE permission', () => {
                expect(() =>
                    service._canManagePriority(validUserWithPermissions, 'featured-123')
                ).not.toThrow();
            });

            it('should deny user without STATUS_MANAGE permission', () => {
                expect(() =>
                    service._canManagePriority(validUserWithoutPermissions, 'featured-123')
                ).toThrow();
                expect(() =>
                    service._canManagePriority(validUserWithoutPermissions, 'featured-123')
                ).toThrow('Permission denied: Only admins or authorized users can manage priority');
            });
        });
    });

    // ============================================================================
    // CUSTOM FINDER TESTS (3 tests)
    // ============================================================================

    describe('Custom Finders', () => {
        describe('findActive', () => {
            it('should return active featured accommodations', async () => {
                const mockActive = [mockFeaturedAccommodation];
                vi.mocked(mockModel.findActive).mockResolvedValue(mockActive);

                const result = await service.findActive(validAdminActor);

                expect(result.data).toEqual(mockActive);
                expect(mockModel.findActive).toHaveBeenCalledOnce();
            });
        });

        describe('findByType', () => {
            it('should return featured accommodations by type', async () => {
                const mockByType = [mockFeaturedAccommodation];
                vi.mocked(mockModel.findByType).mockResolvedValue(mockByType);

                const result = await service.findByType(validAdminActor, FeaturedTypeEnum.HOME);

                expect(result.data).toEqual(mockByType);
                expect(mockModel.findByType).toHaveBeenCalledWith(FeaturedTypeEnum.HOME);
            });
        });

        describe('findByAccommodation', () => {
            it('should return featured accommodations by accommodation ID', async () => {
                const mockByAccommodation = [mockFeaturedAccommodation];
                vi.mocked(mockModel.findByAccommodation).mockResolvedValue(mockByAccommodation);

                const result = await service.findByAccommodation(
                    validAdminActor,
                    'accommodation-123'
                );

                expect(result.data).toEqual(mockByAccommodation);
                expect(mockModel.findByAccommodation).toHaveBeenCalledWith('accommodation-123');
            });
        });
    });

    // ============================================================================
    // BUSINESS LOGIC TESTS (10 tests)
    // ============================================================================

    describe('Business Logic', () => {
        describe('featureOnHome', () => {
            it('should feature accommodation on home page', async () => {
                vi.mocked(mockModel.featureOnHome).mockResolvedValue(mockFeaturedAccommodation);

                const result = await service.featureOnHome(
                    validAdminActor,
                    'client-123',
                    'accommodation-123',
                    new Date('2024-01-01'),
                    new Date('2024-12-31')
                );

                expect(result.data).toEqual(mockFeaturedAccommodation);
                expect(mockModel.featureOnHome).toHaveBeenCalledWith({
                    clientId: 'client-123',
                    accommodationId: 'accommodation-123',
                    fromDate: new Date('2024-01-01'),
                    toDate: new Date('2024-12-31'),
                    createdById: validAdminActor.id
                });
            });
        });

        describe('featureInDestination', () => {
            it('should feature accommodation in destination pages', async () => {
                vi.mocked(mockModel.featureInDestination).mockResolvedValue(
                    mockFeaturedAccommodation
                );

                const result = await service.featureInDestination(
                    validAdminActor,
                    'client-123',
                    'accommodation-123',
                    new Date('2024-01-01'),
                    new Date('2024-12-31')
                );

                expect(result.data).toEqual(mockFeaturedAccommodation);
                expect(mockModel.featureInDestination).toHaveBeenCalledWith({
                    clientId: 'client-123',
                    accommodationId: 'accommodation-123',
                    fromDate: new Date('2024-01-01'),
                    toDate: new Date('2024-12-31'),
                    createdById: validAdminActor.id
                });
            });
        });

        describe('featureInSearch', () => {
            it('should feature accommodation in search results', async () => {
                vi.mocked(mockModel.featureInSearch).mockResolvedValue(mockFeaturedAccommodation);

                const result = await service.featureInSearch(
                    validAdminActor,
                    'client-123',
                    'accommodation-123',
                    new Date('2024-01-01'),
                    new Date('2024-12-31')
                );

                expect(result.data).toEqual(mockFeaturedAccommodation);
                expect(mockModel.featureInSearch).toHaveBeenCalledWith({
                    clientId: 'client-123',
                    accommodationId: 'accommodation-123',
                    fromDate: new Date('2024-01-01'),
                    toDate: new Date('2024-12-31'),
                    createdById: validAdminActor.id
                });
            });
        });

        describe('isActive', () => {
            it('should check if featured accommodation is active', async () => {
                vi.mocked(mockModel.isActive).mockResolvedValue(true);

                const result = await service.isActive(validAdminActor, 'featured-123');

                expect(result.data).toBe(true);
                expect(mockModel.isActive).toHaveBeenCalledWith('featured-123');
            });
        });

        describe('calculateVisibility', () => {
            it('should calculate visibility score', async () => {
                vi.mocked(mockModel.calculateVisibility).mockResolvedValue(100);

                const result = await service.calculateVisibility(validAdminActor, 'featured-123');

                expect(result.data).toBe(100);
                expect(mockModel.calculateVisibility).toHaveBeenCalledWith('featured-123');
            });
        });

        describe('getPlacementStats', () => {
            it('should get placement statistics', async () => {
                const mockStats = {
                    views: 5000,
                    clicks: 250,
                    conversions: 25,
                    position: 1
                };
                vi.mocked(mockModel.getPlacementStats).mockResolvedValue(mockStats);

                const result = await service.getPlacementStats(validAdminActor, 'featured-123');

                expect(result.data).toEqual(mockStats);
                expect(mockModel.getPlacementStats).toHaveBeenCalledWith('featured-123');
            });
        });

        describe('getPriority', () => {
            it('should get featured accommodation priority', async () => {
                vi.mocked(mockModel.getPriority).mockResolvedValue(5);

                const result = await service.getPriority(validAdminActor, 'featured-123');

                expect(result.data).toBe(5);
                expect(mockModel.getPriority).toHaveBeenCalledWith('featured-123');
            });
        });

        describe('updatePriority', () => {
            it('should update featured accommodation priority', async () => {
                vi.mocked(mockModel.updatePriority).mockResolvedValue(mockFeaturedAccommodation);

                const result = await service.updatePriority(validAdminActor, 'featured-123', 10);

                expect(result.data).toEqual(mockFeaturedAccommodation);
                expect(mockModel.updatePriority).toHaveBeenCalledWith('featured-123', 10);
            });
        });

        describe('resolvePriorityConflicts', () => {
            it('should resolve priority conflicts', async () => {
                const mockResolved = [mockFeaturedAccommodation];
                vi.mocked(mockModel.resolvePriorityConflicts).mockResolvedValue(mockResolved);

                const result = await service.resolvePriorityConflicts(
                    validAdminActor,
                    FeaturedTypeEnum.HOME
                );

                expect(result.data).toEqual(mockResolved);
                expect(mockModel.resolvePriorityConflicts).toHaveBeenCalledWith(
                    FeaturedTypeEnum.HOME
                );
            });
        });

        describe('withAccommodation', () => {
            it('should get featured accommodation with accommodation details', async () => {
                const mockWithAccommodation = {
                    ...mockFeaturedAccommodation,
                    accommodation: { id: 'accommodation-123', name: 'Test Hotel' }
                };
                vi.mocked(mockModel.withAccommodation).mockResolvedValue(mockWithAccommodation);

                const result = await service.withAccommodation(validAdminActor, 'featured-123');

                expect(result.data).toEqual(mockWithAccommodation);
                expect(mockModel.withAccommodation).toHaveBeenCalledWith('featured-123');
            });
        });
    });
});
