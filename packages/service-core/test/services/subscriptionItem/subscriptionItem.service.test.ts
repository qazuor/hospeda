import type { SubscriptionItemModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { SubscriptionItem } from '@repo/schemas/entities/subscriptionItem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionItemService } from '../../../src/services/subscriptionItem';
import type { Actor, ServiceContext } from '../../../src/types';

describe('SubscriptionItemService', () => {
    let service: SubscriptionItemService;
    let mockModel: SubscriptionItemModel;
    let ctx: ServiceContext;

    // Test actors
    let adminActor: Actor;
    let superAdminActor: Actor;
    let userActor: Actor;
    let userWithCreatePermissionActor: Actor;
    let userWithUpdatePermissionActor: Actor;
    let userWithDeletePermissionActor: Actor;
    let guestActor: Actor;

    // Mock data
    const mockSubscriptionItem: SubscriptionItem = {
        id: 'sub-item-123',
        sourceId: 'subscription-123',
        sourceType: 'SUBSCRIPTION',
        linkedEntityId: 'accommodation-listing-123',
        entityType: 'ACCOMMODATION_LISTING',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdById: 'user-123',
        updatedById: 'user-123',
        deletedById: null,
        lifecycleState: 'ACTIVE',
        adminInfo: null
    };

    beforeEach(() => {
        ctx = {
            logger: {
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn()
            }
        } as unknown as ServiceContext;

        // Create mock model
        mockModel = {
            findById: vi.fn(),
            findOne: vi.fn(),
            findAll: vi.fn(),
            count: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            softDelete: vi.fn(),
            hardDelete: vi.fn(),
            restore: vi.fn(),
            linkToEntity: vi.fn(),
            unlinkFromEntity: vi.fn(),
            findByEntityType: vi.fn(),
            findByLinkedEntity: vi.fn(),
            findBySource: vi.fn(),
            getLinkedEntity: vi.fn(),
            withLinkedEntity: vi.fn(),
            findAccommodationListings: vi.fn(),
            findCampaigns: vi.fn(),
            findSponsorship: vi.fn(),
            findFeaturedAccommodations: vi.fn(),
            findProfessionalServiceOrders: vi.fn(),
            findBenefitListings: vi.fn(),
            findServiceListings: vi.fn(),
            validateEntityExists: vi.fn(),
            validateSourceExists: vi.fn(),
            getEntityTypesForSource: vi.fn(),
            countByEntityType: vi.fn()
        } as unknown as SubscriptionItemModel;

        service = new SubscriptionItemService(ctx, mockModel);

        // Define test actors
        adminActor = {
            id: 'admin-123',
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.SUBSCRIPTION_ITEM_CREATE,
                PermissionEnum.SUBSCRIPTION_ITEM_UPDATE,
                PermissionEnum.SUBSCRIPTION_ITEM_DELETE
            ]
        };

        superAdminActor = {
            id: 'super-admin-123',
            role: RoleEnum.SUPER_ADMIN,
            permissions: [
                PermissionEnum.SUBSCRIPTION_ITEM_CREATE,
                PermissionEnum.SUBSCRIPTION_ITEM_UPDATE,
                PermissionEnum.SUBSCRIPTION_ITEM_DELETE
            ]
        };

        userActor = {
            id: 'user-123',
            role: RoleEnum.USER,
            permissions: []
        };

        userWithCreatePermissionActor = {
            id: 'user-create-123',
            role: RoleEnum.USER,
            permissions: [PermissionEnum.SUBSCRIPTION_ITEM_CREATE]
        };

        userWithUpdatePermissionActor = {
            id: 'user-update-123',
            role: RoleEnum.USER,
            permissions: [PermissionEnum.SUBSCRIPTION_ITEM_UPDATE]
        };

        userWithDeletePermissionActor = {
            id: 'user-delete-123',
            role: RoleEnum.USER,
            permissions: [PermissionEnum.SUBSCRIPTION_ITEM_DELETE]
        };

        guestActor = {
            id: 'guest-123',
            role: RoleEnum.GUEST,
            permissions: []
        };
    });

    // ============================================================================
    // PERMISSION HOOK TESTS
    // ============================================================================

    describe('Permission Hooks', () => {
        describe('_canCreate', () => {
            it('should allow admin to create', () => {
                expect(() => service._canCreate(adminActor, {})).not.toThrow();
            });

            it('should allow user with SUBSCRIPTION_ITEM_CREATE permission', () => {
                expect(() => service._canCreate(userWithCreatePermissionActor, {})).not.toThrow();
            });

            it('should deny user without permission', () => {
                expect(() => service._canCreate(userActor, {})).toThrow();
            });

            it('should deny guest', () => {
                expect(() => service._canCreate(guestActor, {})).toThrow();
            });
        });

        describe('_canUpdate', () => {
            it('should allow admin to update', () => {
                expect(() => service._canUpdate(adminActor, mockSubscriptionItem)).not.toThrow();
            });

            it('should allow user with SUBSCRIPTION_ITEM_UPDATE permission', () => {
                expect(() =>
                    service._canUpdate(userWithUpdatePermissionActor, mockSubscriptionItem)
                ).not.toThrow();
            });

            it('should deny user without permission', () => {
                expect(() => service._canUpdate(userActor, mockSubscriptionItem)).toThrow();
            });
        });

        describe('_canSoftDelete', () => {
            it('should allow admin to soft delete', () => {
                expect(() =>
                    service._canSoftDelete(adminActor, mockSubscriptionItem)
                ).not.toThrow();
            });

            it('should allow user with SUBSCRIPTION_ITEM_DELETE permission', () => {
                expect(() =>
                    service._canSoftDelete(userWithDeletePermissionActor, mockSubscriptionItem)
                ).not.toThrow();
            });

            it('should deny user without permission', () => {
                expect(() => service._canSoftDelete(userActor, mockSubscriptionItem)).toThrow();
            });
        });

        describe('_canHardDelete', () => {
            it('should allow super admin to hard delete', () => {
                expect(() =>
                    service._canHardDelete(superAdminActor, mockSubscriptionItem)
                ).not.toThrow();
            });

            it('should deny admin from hard delete', () => {
                expect(() => service._canHardDelete(adminActor, mockSubscriptionItem)).toThrow();
            });

            it('should deny user from hard delete', () => {
                expect(() => service._canHardDelete(userActor, mockSubscriptionItem)).toThrow();
            });
        });

        describe('_canRestore', () => {
            it('should allow admin to restore', () => {
                expect(() => service._canRestore(adminActor, mockSubscriptionItem)).not.toThrow();
            });

            it('should allow super admin to restore', () => {
                expect(() =>
                    service._canRestore(superAdminActor, mockSubscriptionItem)
                ).not.toThrow();
            });

            it('should deny user from restore', () => {
                expect(() => service._canRestore(userActor, mockSubscriptionItem)).toThrow();
            });
        });

        describe('_canView', () => {
            it('should allow authenticated user to view', () => {
                expect(() => service._canView(userActor, mockSubscriptionItem)).not.toThrow();
            });

            it('should allow admin to view', () => {
                expect(() => service._canView(adminActor, mockSubscriptionItem)).not.toThrow();
            });

            it('should deny guest from viewing', () => {
                expect(() => service._canView(guestActor, mockSubscriptionItem)).toThrow();
            });
        });

        describe('_canList', () => {
            it('should allow authenticated user to list', () => {
                expect(() => service._canList(userActor)).not.toThrow();
            });

            it('should allow admin to list', () => {
                expect(() => service._canList(adminActor)).not.toThrow();
            });

            it('should deny guest from listing', () => {
                expect(() => service._canList(guestActor)).toThrow();
            });
        });

        describe('_canSearch', () => {
            it('should allow authenticated user to search', () => {
                expect(() => service._canSearch(userActor)).not.toThrow();
            });

            it('should allow admin to search', () => {
                expect(() => service._canSearch(adminActor)).not.toThrow();
            });

            it('should deny guest from searching', () => {
                expect(() => service._canSearch(guestActor)).toThrow();
            });
        });

        describe('_canCount', () => {
            it('should allow authenticated user to count', () => {
                expect(() => service._canCount(userActor)).not.toThrow();
            });

            it('should allow admin to count', () => {
                expect(() => service._canCount(adminActor)).not.toThrow();
            });

            it('should deny guest from counting', () => {
                expect(() => service._canCount(guestActor)).toThrow();
            });
        });
    });

    // ============================================================================
    // POLYMORPHIC VALIDATION TESTS
    // ============================================================================

    describe('Polymorphic Validation', () => {
        describe('validatePolymorphicReference', () => {
            it('should validate existing entity reference', async () => {
                vi.spyOn(mockModel, 'validateEntityExists').mockResolvedValue(true);

                const result = await service.validatePolymorphicReference(
                    userActor,
                    'accommodation-listing-123',
                    'ACCOMMODATION_LISTING'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data?.valid).toBe(true);
            });

            it('should return false for non-existent entity', async () => {
                vi.spyOn(mockModel, 'validateEntityExists').mockResolvedValue(false);

                const result = await service.validatePolymorphicReference(
                    userActor,
                    'non-existent-123',
                    'CAMPAIGN'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data?.valid).toBe(false);
            });

            it('should deny guest access', async () => {
                const result = await service.validatePolymorphicReference(
                    guestActor,
                    'entity-123',
                    'SPONSORSHIP'
                );

                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            });
        });

        describe('generateAccessRights', () => {
            it('should generate correct access right format', async () => {
                const subscriptionItemData = {
                    sourceId: 'subscription-123',
                    sourceType: 'SUBSCRIPTION',
                    linkedEntityId: 'campaign-456',
                    entityType: 'CAMPAIGN'
                };

                const result = await service.generateAccessRights(adminActor, subscriptionItemData);

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data?.accessRight).toBe(
                    'SUBSCRIPTION:subscription-123:CAMPAIGN:campaign-456'
                );
            });

            it('should deny user without create permission', async () => {
                const subscriptionItemData = {
                    sourceId: 'subscription-123',
                    sourceType: 'SUBSCRIPTION',
                    linkedEntityId: 'campaign-456',
                    entityType: 'CAMPAIGN'
                };

                const result = await service.generateAccessRights(userActor, subscriptionItemData);

                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            });
        });
    });

    // ============================================================================
    // BUSINESS LOGIC TESTS
    // ============================================================================

    describe('Business Logic Methods', () => {
        describe('linkToEntity', () => {
            it('should link subscription to accommodation listing', async () => {
                vi.spyOn(mockModel, 'linkToEntity').mockResolvedValue(mockSubscriptionItem);

                const result = await service.linkToEntity(
                    adminActor,
                    'subscription-123',
                    'SUBSCRIPTION',
                    'accommodation-listing-123',
                    'ACCOMMODATION_LISTING'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data?.entityType).toBe('ACCOMMODATION_LISTING');
            });

            it('should link purchase to campaign', async () => {
                const purchaseItem = {
                    ...mockSubscriptionItem,
                    sourceType: 'PURCHASE',
                    entityType: 'CAMPAIGN'
                };
                vi.spyOn(mockModel, 'linkToEntity').mockResolvedValue(purchaseItem);

                const result = await service.linkToEntity(
                    adminActor,
                    'purchase-123',
                    'PURCHASE',
                    'campaign-123',
                    'CAMPAIGN'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data?.sourceType).toBe('PURCHASE');
                expect(result.data?.entityType).toBe('CAMPAIGN');
            });

            it('should fail when model returns null', async () => {
                vi.spyOn(mockModel, 'linkToEntity').mockResolvedValue(null);

                const result = await service.linkToEntity(
                    adminActor,
                    'subscription-123',
                    'SUBSCRIPTION',
                    'entity-123',
                    'SPONSORSHIP'
                );

                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            });

            it('should deny user without permission', async () => {
                const result = await service.linkToEntity(
                    userActor,
                    'subscription-123',
                    'SUBSCRIPTION',
                    'entity-123',
                    'FEATURED_ACCOMMODATION'
                );

                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            });
        });

        describe('unlinkFromEntity', () => {
            it('should unlink entity successfully', async () => {
                vi.spyOn(mockModel, 'unlinkFromEntity').mockResolvedValue(true);

                const result = await service.unlinkFromEntity(
                    adminActor,
                    'subscription-123',
                    'SUBSCRIPTION',
                    'accommodation-listing-123',
                    'ACCOMMODATION_LISTING'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data?.success).toBe(true);
            });

            it('should return false when unlink fails', async () => {
                vi.spyOn(mockModel, 'unlinkFromEntity').mockResolvedValue(false);

                const result = await service.unlinkFromEntity(
                    adminActor,
                    'subscription-123',
                    'SUBSCRIPTION',
                    'non-existent-123',
                    'CAMPAIGN'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data?.success).toBe(false);
            });

            it('should deny user without delete permission', async () => {
                const result = await service.unlinkFromEntity(
                    userActor,
                    'subscription-123',
                    'SUBSCRIPTION',
                    'entity-123',
                    'SPONSORSHIP'
                );

                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            });
        });

        describe('findByEntityType', () => {
            it('should find items by entity type with pagination', async () => {
                const mockResult = {
                    items: [mockSubscriptionItem],
                    total: 1
                };
                vi.spyOn(mockModel, 'findByEntityType').mockResolvedValue(mockResult);

                const result = await service.findByEntityType(userActor, 'ACCOMMODATION_LISTING', {
                    page: 1,
                    pageSize: 10
                });

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data?.items).toHaveLength(1);
                expect(result.data?.total).toBe(1);
            });

            it('should deny guest access', async () => {
                const result = await service.findByEntityType(guestActor, 'CAMPAIGN');

                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            });
        });

        describe('findByLinkedEntity', () => {
            it('should find items by linked entity', async () => {
                vi.spyOn(mockModel, 'findByLinkedEntity').mockResolvedValue([mockSubscriptionItem]);

                const result = await service.findByLinkedEntity(
                    userActor,
                    'accommodation-listing-123'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(1);
            });

            it('should find items by linked entity with type filter', async () => {
                vi.spyOn(mockModel, 'findByLinkedEntity').mockResolvedValue([mockSubscriptionItem]);

                const result = await service.findByLinkedEntity(
                    userActor,
                    'accommodation-listing-123',
                    'ACCOMMODATION_LISTING'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(1);
            });

            it('should return empty array when no items found', async () => {
                vi.spyOn(mockModel, 'findByLinkedEntity').mockResolvedValue([]);

                const result = await service.findByLinkedEntity(userActor, 'non-existent-123');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(0);
            });
        });

        describe('findBySource', () => {
            it('should find items by subscription source', async () => {
                vi.spyOn(mockModel, 'findBySource').mockResolvedValue([mockSubscriptionItem]);

                const result = await service.findBySource(
                    userActor,
                    'subscription-123',
                    'SUBSCRIPTION'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(1);
            });

            it('should find items by purchase source', async () => {
                const purchaseItem = { ...mockSubscriptionItem, sourceType: 'PURCHASE' };
                vi.spyOn(mockModel, 'findBySource').mockResolvedValue([purchaseItem]);

                const result = await service.findBySource(userActor, 'purchase-123', 'PURCHASE');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(1);
                expect(result.data[0]?.sourceType).toBe('PURCHASE');
            });
        });

        describe('getLinkedEntity', () => {
            it('should get linked entity info', async () => {
                const mockLinkedEntity = {
                    linkedEntityId: 'accommodation-listing-123',
                    entityType: 'ACCOMMODATION_LISTING'
                };
                vi.spyOn(mockModel, 'getLinkedEntity').mockResolvedValue(mockLinkedEntity);

                const result = await service.getLinkedEntity(userActor, 'sub-item-123');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data?.linkedEntityId).toBe('accommodation-listing-123');
                expect(result.data?.entityType).toBe('ACCOMMODATION_LISTING');
            });

            it('should return null when item not found', async () => {
                vi.spyOn(mockModel, 'getLinkedEntity').mockResolvedValue(null);

                const result = await service.getLinkedEntity(userActor, 'non-existent-123');

                expect(result.data).toBeNull();
                expect(result.error).toBeUndefined();
            });
        });

        describe('withLinkedEntity', () => {
            it('should get item with linked entity details', async () => {
                const mockWithEntity = {
                    subscriptionItem: mockSubscriptionItem,
                    linkedEntity: { id: 'accommodation-listing-123', name: 'Test Accommodation' }
                };
                vi.spyOn(mockModel, 'withLinkedEntity').mockResolvedValue(mockWithEntity);

                const result = await service.withLinkedEntity(userActor, 'sub-item-123');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data?.subscriptionItem.id).toBe('sub-item-123');
                expect(result.data?.linkedEntity).toBeDefined();
            });

            it('should return null when not found', async () => {
                vi.spyOn(mockModel, 'withLinkedEntity').mockResolvedValue(null);

                const result = await service.withLinkedEntity(userActor, 'non-existent-123');

                expect(result.data).toBeNull();
                expect(result.error).toBeUndefined();
            });
        });
    });

    // ============================================================================
    // TYPE-SPECIFIC FINDER TESTS
    // ============================================================================

    describe('Type-Specific Finders', () => {
        describe('findAccommodationListings', () => {
            it('should find accommodation listing items', async () => {
                vi.spyOn(mockModel, 'findAccommodationListings').mockResolvedValue([
                    mockSubscriptionItem
                ]);

                const result = await service.findAccommodationListings(
                    userActor,
                    'subscription-123',
                    'SUBSCRIPTION'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(1);
            });
        });

        describe('findCampaigns', () => {
            it('should find campaign items', async () => {
                const campaignItem = { ...mockSubscriptionItem, entityType: 'CAMPAIGN' };
                vi.spyOn(mockModel, 'findCampaigns').mockResolvedValue([campaignItem]);

                const result = await service.findCampaigns(
                    userActor,
                    'subscription-123',
                    'SUBSCRIPTION'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(1);
                expect(result.data[0]?.entityType).toBe('CAMPAIGN');
            });
        });

        describe('findSponsorship', () => {
            it('should find sponsorship items', async () => {
                const sponsorshipItem = { ...mockSubscriptionItem, entityType: 'SPONSORSHIP' };
                vi.spyOn(mockModel, 'findSponsorship').mockResolvedValue([sponsorshipItem]);

                const result = await service.findSponsorship(
                    userActor,
                    'subscription-123',
                    'SUBSCRIPTION'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(1);
                expect(result.data[0]?.entityType).toBe('SPONSORSHIP');
            });
        });

        describe('findFeaturedAccommodations', () => {
            it('should find featured accommodation items', async () => {
                const featuredItem = {
                    ...mockSubscriptionItem,
                    entityType: 'FEATURED_ACCOMMODATION'
                };
                vi.spyOn(mockModel, 'findFeaturedAccommodations').mockResolvedValue([featuredItem]);

                const result = await service.findFeaturedAccommodations(
                    userActor,
                    'subscription-123',
                    'SUBSCRIPTION'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(1);
                expect(result.data[0]?.entityType).toBe('FEATURED_ACCOMMODATION');
            });
        });

        describe('findProfessionalServiceOrders', () => {
            it('should find professional service order items', async () => {
                const orderItem = {
                    ...mockSubscriptionItem,
                    entityType: 'PROFESSIONAL_SERVICE_ORDER'
                };
                vi.spyOn(mockModel, 'findProfessionalServiceOrders').mockResolvedValue([orderItem]);

                const result = await service.findProfessionalServiceOrders(
                    userActor,
                    'subscription-123',
                    'SUBSCRIPTION'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(1);
                expect(result.data?.[0]?.entityType).toBe('PROFESSIONAL_SERVICE_ORDER');
            });
        });

        describe('findBenefitListings', () => {
            it('should find benefit listing items', async () => {
                const benefitItem: SubscriptionItem = {
                    ...mockSubscriptionItem,
                    entityType: 'BENEFIT_LISTING'
                };
                vi.spyOn(mockModel, 'findBenefitListings').mockResolvedValue([benefitItem]);

                const result = await service.findBenefitListings(
                    userActor,
                    'subscription-123',
                    'SUBSCRIPTION'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(1);
                expect(result.data?.[0]?.entityType).toBe('BENEFIT_LISTING');
            });
        });

        describe('findServiceListings', () => {
            it('should find service listing items', async () => {
                const serviceItem: SubscriptionItem = {
                    ...mockSubscriptionItem,
                    entityType: 'SERVICE_LISTING'
                };
                vi.spyOn(mockModel, 'findServiceListings').mockResolvedValue([serviceItem]);

                const result = await service.findServiceListings(
                    userActor,
                    'subscription-123',
                    'SUBSCRIPTION'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(1);
                expect(result.data?.[0]?.entityType).toBe('SERVICE_LISTING');
            });
        });
    });

    // ============================================================================
    // AGGREGATION TESTS
    // ============================================================================

    describe('Aggregation Methods', () => {
        describe('getEntityTypesForSource', () => {
            it('should get all entity types used by source', async () => {
                const mockEntityTypes = [
                    'ACCOMMODATION_LISTING',
                    'CAMPAIGN',
                    'FEATURED_ACCOMMODATION'
                ];
                vi.spyOn(mockModel, 'getEntityTypesForSource').mockResolvedValue(mockEntityTypes);

                const result = await service.getEntityTypesForSource(
                    userActor,
                    'subscription-123',
                    'SUBSCRIPTION'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(3);
                expect(result.data).toContain('ACCOMMODATION_LISTING');
                expect(result.data).toContain('CAMPAIGN');
            });

            it('should return empty array when no items', async () => {
                vi.spyOn(mockModel, 'getEntityTypesForSource').mockResolvedValue([]);

                const result = await service.getEntityTypesForSource(
                    userActor,
                    'subscription-123',
                    'SUBSCRIPTION'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data).toHaveLength(0);
            });
        });

        describe('countByEntityType', () => {
            it('should count items by entity type', async () => {
                const mockCounts = {
                    ACCOMMODATION_LISTING: 5,
                    CAMPAIGN: 3,
                    SPONSORSHIP: 2
                };
                vi.spyOn(mockModel, 'countByEntityType').mockResolvedValue(mockCounts);

                const result = await service.countByEntityType(
                    userActor,
                    'subscription-123',
                    'SUBSCRIPTION'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data?.ACCOMMODATION_LISTING).toBe(5);
                expect(result.data?.CAMPAIGN).toBe(3);
                expect(result.data?.SPONSORSHIP).toBe(2);
            });

            it('should return empty object when no items', async () => {
                vi.spyOn(mockModel, 'countByEntityType').mockResolvedValue({});

                const result = await service.countByEntityType(
                    userActor,
                    'subscription-123',
                    'SUBSCRIPTION'
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data && Object.keys(result.data)).toHaveLength(0);
            });

            it('should deny guest access', async () => {
                const result = await service.countByEntityType(
                    guestActor,
                    'subscription-123',
                    'SUBSCRIPTION'
                );

                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            });
        });
    });
});
