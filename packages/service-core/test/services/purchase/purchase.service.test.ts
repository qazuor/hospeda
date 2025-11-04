import type { PurchaseModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Purchase } from '@repo/schemas/entities/purchase';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PurchaseService } from '../../../src/services/purchase/purchase.service';
import type { Actor, ServiceContext } from '../../../src/types';

describe('PurchaseService', () => {
    let service: PurchaseService;
    let mockModel: PurchaseModel;
    let adminActor: Actor;
    let userActor: Actor;
    let guestActor: Actor;

    const mockPurchase: Purchase = {
        id: 'purchase-123',
        clientId: 'client-123',
        pricingPlanId: 'plan-123',
        purchasedAt: new Date('2024-01-15'),
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
        deletedAt: null,
        createdById: 'user-123',
        updatedById: 'user-123',
        deletedById: null
    };

    beforeEach(() => {
        const ctx: ServiceContext = {
            logger: {
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn()
            }
        };

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
            findByPlan: vi.fn(),
            calculateTotal: vi.fn(),
            createFromCart: vi.fn(),
            processPayment: vi.fn(),
            markComplete: vi.fn(),
            withClient: vi.fn(),
            withPlan: vi.fn(),
            getRecentPurchases: vi.fn(),
            withItems: vi.fn()
        } as unknown as PurchaseModel;

        service = new PurchaseService(ctx, mockModel);

        adminActor = {
            id: 'admin-123',
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.PURCHASE_CREATE,
                PermissionEnum.PURCHASE_UPDATE,
                PermissionEnum.PURCHASE_DELETE,
                PermissionEnum.PURCHASE_VIEW
            ]
        };

        userActor = {
            id: 'user-123',
            role: RoleEnum.USER,
            permissions: []
        };

        guestActor = {
            id: '',
            role: RoleEnum.GUEST,
            permissions: []
        };
    });

    // ============================================================================
    // PERMISSION HOOKS TESTS
    // ============================================================================

    describe('Permission Hooks', () => {
        describe('_canCreate', () => {
            it('should allow admin to create purchase', () => {
                expect(() => service._canCreate(adminActor, {})).not.toThrow();
            });

            it('should allow user with PURCHASE_CREATE permission', () => {
                const actorWithPermission = {
                    ...userActor,
                    permissions: [PermissionEnum.PURCHASE_CREATE]
                };
                expect(() => service._canCreate(actorWithPermission, {})).not.toThrow();
            });

            it('should deny user without permission', () => {
                expect(() => service._canCreate(userActor, {})).toThrow('Permission denied');
            });

            it('should deny guest', () => {
                expect(() => service._canCreate(guestActor, {})).toThrow('Permission denied');
            });
        });

        describe('_canUpdate', () => {
            it('should allow admin to update purchase', () => {
                expect(() => service._canUpdate(adminActor, mockPurchase)).not.toThrow();
            });

            it('should allow user with PURCHASE_UPDATE permission', () => {
                const actorWithPermission = {
                    ...userActor,
                    permissions: [PermissionEnum.PURCHASE_UPDATE]
                };
                expect(() => service._canUpdate(actorWithPermission, mockPurchase)).not.toThrow();
            });

            it('should deny user without permission', () => {
                expect(() => service._canUpdate(userActor, mockPurchase)).toThrow(
                    'Permission denied'
                );
            });
        });

        describe('_canSoftDelete', () => {
            it('should allow admin to soft delete purchase', () => {
                expect(() => service._canSoftDelete(adminActor, mockPurchase)).not.toThrow();
            });

            it('should allow user with PURCHASE_DELETE permission', () => {
                const actorWithPermission = {
                    ...userActor,
                    permissions: [PermissionEnum.PURCHASE_DELETE]
                };
                expect(() =>
                    service._canSoftDelete(actorWithPermission, mockPurchase)
                ).not.toThrow();
            });

            it('should deny user without permission', () => {
                expect(() => service._canSoftDelete(userActor, mockPurchase)).toThrow(
                    'Permission denied'
                );
            });
        });

        describe('_canHardDelete', () => {
            it('should allow super admin to hard delete purchase', () => {
                const superAdminActor = { ...adminActor, role: RoleEnum.SUPER_ADMIN };
                expect(() => service._canHardDelete(superAdminActor, mockPurchase)).not.toThrow();
            });

            it('should deny regular admin', () => {
                expect(() => service._canHardDelete(adminActor, mockPurchase)).toThrow(
                    'Permission denied'
                );
            });
        });

        describe('_canRestore', () => {
            it('should allow admin to restore purchase', () => {
                expect(() => service._canRestore(adminActor, mockPurchase)).not.toThrow();
            });

            it('should allow super admin to restore purchase', () => {
                const superAdminActor = { ...adminActor, role: RoleEnum.SUPER_ADMIN };
                expect(() => service._canRestore(superAdminActor, mockPurchase)).not.toThrow();
            });

            it('should deny regular user', () => {
                expect(() => service._canRestore(userActor, mockPurchase)).toThrow(
                    'Permission denied'
                );
            });
        });

        describe('_canView', () => {
            it('should allow authenticated user to view purchase', () => {
                expect(() => service._canView(userActor, mockPurchase)).not.toThrow();
            });

            it('should deny guest', () => {
                expect(() => service._canView(guestActor, mockPurchase)).toThrow(
                    'Permission denied'
                );
            });
        });

        describe('_canList', () => {
            it('should allow authenticated user to list purchases', () => {
                expect(() => service._canList(userActor)).not.toThrow();
            });

            it('should deny guest', () => {
                expect(() => service._canList(guestActor)).toThrow('Permission denied');
            });
        });

        describe('_canSearch', () => {
            it('should allow authenticated user to search purchases', () => {
                expect(() => service._canSearch(userActor)).not.toThrow();
            });

            it('should deny guest', () => {
                expect(() => service._canSearch(guestActor)).toThrow('Permission denied');
            });
        });

        describe('_canCount', () => {
            it('should allow authenticated user to count purchases', () => {
                expect(() => service._canCount(userActor)).not.toThrow();
            });

            it('should deny guest', () => {
                expect(() => service._canCount(guestActor)).toThrow('Permission denied');
            });
        });
    });

    // ============================================================================
    // BUSINESS LOGIC METHODS TESTS
    // ============================================================================

    describe('Business Logic Methods', () => {
        describe('findByClient', () => {
            it('should find purchases by client ID with pagination', async () => {
                const mockResult = {
                    items: [mockPurchase],
                    total: 1
                };
                vi.spyOn(mockModel, 'findByClient').mockResolvedValue(mockResult);

                const result = await service.findByClient(userActor, 'client-123', {
                    page: 1,
                    pageSize: 10
                });

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data.items).toHaveLength(1);
                expect(result.data.total).toBe(1);
                expect(mockModel.findByClient).toHaveBeenCalledWith(
                    'client-123',
                    { page: 1, pageSize: 10 },
                    undefined
                );
            });

            it('should return empty array when no purchases found', async () => {
                vi.spyOn(mockModel, 'findByClient').mockResolvedValue({ items: [], total: 0 });

                const result = await service.findByClient(userActor, 'client-999');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(result.data.items).toHaveLength(0);
                expect(result.data.total).toBe(0);
            });

            it('should deny guest access', async () => {
                const result = await service.findByClient(guestActor, 'client-123');

                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            });
        });

        describe('findByPlan', () => {
            it('should find purchases by pricing plan ID', async () => {
                const mockResult = {
                    items: [mockPurchase],
                    total: 1
                };
                vi.spyOn(mockModel, 'findByPlan').mockResolvedValue(mockResult);

                const result = await service.findByPlan(userActor, 'plan-123', {
                    page: 1,
                    pageSize: 10
                });

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                if (result.data) {
                    expect(result.data.items).toHaveLength(1);
                    expect(result.data.total).toBe(1);
                }
            });

            it('should return empty array when no purchases found', async () => {
                vi.spyOn(mockModel, 'findByPlan').mockResolvedValue({ items: [], total: 0 });

                const result = await service.findByPlan(userActor, 'plan-999');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                if (result.data) {
                    expect(result.data.items).toHaveLength(0);
                }
            });

            it('should deny guest access', async () => {
                const result = await service.findByPlan(guestActor, 'plan-123');

                expect(result.error).toBeDefined();
                if (result.error) {
                    expect(result.error.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            });
        });

        describe('calculateTotal', () => {
            it('should calculate total for pricing plan', async () => {
                vi.spyOn(mockModel, 'calculateTotal').mockResolvedValue(1500);

                const result = await service.calculateTotal(userActor, 'plan-123', 2);

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                if (result.data) {
                    expect(result.data.total).toBe(1500);
                }
                expect(mockModel.calculateTotal).toHaveBeenCalledWith('plan-123', 2, undefined);
            });

            it('should return null when plan not found', async () => {
                vi.spyOn(mockModel, 'calculateTotal').mockResolvedValue(null);

                const result = await service.calculateTotal(userActor, 'plan-999', 1);

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                if (result.data) {
                    expect(result.data.total).toBeNull();
                }
            });

            it('should deny guest access', async () => {
                const result = await service.calculateTotal(guestActor, 'plan-123', 1);

                expect(result.error).toBeDefined();
                if (result.error) {
                    expect(result.error.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            });
        });

        describe('createFromCart', () => {
            it('should create purchase from cart data', async () => {
                vi.spyOn(mockModel, 'createFromCart').mockResolvedValue(mockPurchase);

                const purchaseData = {
                    clientId: 'client-123',
                    pricingPlanId: 'plan-123',
                    purchasedAt: new Date('2024-01-15')
                };

                const result = await service.createFromCart(adminActor, purchaseData);

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                if (result.data) {
                    expect(result.data.id).toBe('purchase-123');
                }
                expect(mockModel.createFromCart).toHaveBeenCalledWith(purchaseData, undefined);
            });

            it('should throw error when purchase creation fails', async () => {
                vi.spyOn(mockModel, 'createFromCart').mockResolvedValue(null);

                const purchaseData = {
                    clientId: 'client-123',
                    pricingPlanId: 'plan-123'
                };

                const result = await service.createFromCart(adminActor, purchaseData);

                expect(result.error).toBeDefined();
                if (result.error) {
                    expect(result.error.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
                    expect(result.error.message).toContain('Failed to create purchase from cart');
                }
            });

            it('should deny user without permission', async () => {
                const purchaseData = {
                    clientId: 'client-123',
                    pricingPlanId: 'plan-123'
                };

                const result = await service.createFromCart(userActor, purchaseData);

                expect(result.error).toBeDefined();
                if (result.error) {
                    expect(result.error.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            });
        });

        describe('processPayment', () => {
            it('should process payment for purchase (admin only)', async () => {
                vi.spyOn(mockModel, 'processPayment').mockResolvedValue(mockPurchase);

                const paymentData = {
                    paymentId: 'payment-123',
                    paymentMethod: 'credit_card'
                };

                const result = await service.processPayment(
                    adminActor,
                    'purchase-123',
                    paymentData
                );

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                if (result.data) {
                    expect(result.data.id).toBe('purchase-123');
                }
                expect(mockModel.processPayment).toHaveBeenCalledWith(
                    'purchase-123',
                    paymentData,
                    undefined
                );
            });

            it('should throw error when purchase not found', async () => {
                vi.spyOn(mockModel, 'processPayment').mockResolvedValue(null);

                const result = await service.processPayment(adminActor, 'purchase-999');

                expect(result.error).toBeDefined();
                if (result.error) {
                    expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
                }
            });

            it('should deny non-admin user', async () => {
                const result = await service.processPayment(userActor, 'purchase-123');

                expect(result.error).toBeDefined();
                if (result.error) {
                    expect(result.error.code).toBe(ServiceErrorCode.FORBIDDEN);
                    expect(result.error.message).toContain('Only admins can process payments');
                }
            });
        });

        describe('markComplete', () => {
            it('should mark purchase as complete (admin only)', async () => {
                vi.spyOn(mockModel, 'markComplete').mockResolvedValue(mockPurchase);

                const result = await service.markComplete(adminActor, 'purchase-123');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                if (result.data) {
                    expect(result.data.id).toBe('purchase-123');
                }
                expect(mockModel.markComplete).toHaveBeenCalledWith('purchase-123', undefined);
            });

            it('should throw error when purchase not found', async () => {
                vi.spyOn(mockModel, 'markComplete').mockResolvedValue(null);

                const result = await service.markComplete(adminActor, 'purchase-999');

                expect(result.error).toBeDefined();
                if (result.error) {
                    expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
                }
            });

            it('should deny non-admin user', async () => {
                const result = await service.markComplete(userActor, 'purchase-123');

                expect(result.error).toBeDefined();
                if (result.error) {
                    expect(result.error.code).toBe(ServiceErrorCode.FORBIDDEN);
                    expect(result.error.message).toContain(
                        'Only admins can mark purchases as complete'
                    );
                }
            });
        });

        describe('getWithClient', () => {
            it('should get purchase with client information', async () => {
                const mockResult = {
                    purchase: mockPurchase,
                    client: {
                        id: 'client-123',
                        name: 'Test Client',
                        billingEmail: 'client@test.com'
                    }
                };
                vi.spyOn(mockModel, 'withClient').mockResolvedValue(mockResult);

                const result = await service.getWithClient(userActor, 'purchase-123');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                if (result.data) {
                    expect(result.data?.purchase.id).toBe('purchase-123');
                    expect(result.data?.client.name).toBe('Test Client');
                }
            });

            it('should return null when purchase not found', async () => {
                vi.spyOn(mockModel, 'withClient').mockResolvedValue(null);

                const result = await service.getWithClient(userActor, 'purchase-999');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                if (result.data) {
                    expect(result.data).toBeNull();
                }
            });

            it('should deny guest access', async () => {
                const result = await service.getWithClient(guestActor, 'purchase-123');

                expect(result.error).toBeDefined();
                if (result.error) {
                    expect(result.error.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            });
        });

        describe('getWithPlan', () => {
            it('should get purchase with pricing plan information', async () => {
                const mockResult = {
                    purchase: mockPurchase,
                    pricingPlan: {
                        id: 'plan-123',
                        amountMinor: 10000,
                        currency: 'USD',
                        billingScheme: 'monthly'
                    }
                };
                vi.spyOn(mockModel, 'withPlan').mockResolvedValue(mockResult);

                const result = await service.getWithPlan(userActor, 'purchase-123');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                if (result.data) {
                    expect(result.data?.purchase.id).toBe('purchase-123');
                    expect(result.data?.pricingPlan.amountMinor).toBe(10000);
                }
            });

            it('should return null when purchase not found', async () => {
                vi.spyOn(mockModel, 'withPlan').mockResolvedValue(null);

                const result = await service.getWithPlan(userActor, 'purchase-999');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                if (result.data) {
                    expect(result.data).toBeNull();
                }
            });

            it('should deny guest access', async () => {
                const result = await service.getWithPlan(guestActor, 'purchase-123');

                expect(result.error).toBeDefined();
                if (result.error) {
                    expect(result.error.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            });
        });

        describe('getRecentPurchases', () => {
            it('should get recent purchases for a client', async () => {
                vi.spyOn(mockModel, 'getRecentPurchases').mockResolvedValue([mockPurchase]);

                const result = await service.getRecentPurchases(userActor, 'client-123', 5);

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                if (result.data) {
                    expect(result.data).toHaveLength(1);
                    expect(result.data[0].id).toBe('purchase-123');
                }
                expect(mockModel.getRecentPurchases).toHaveBeenCalledWith(
                    'client-123',
                    5,
                    undefined
                );
            });

            it('should return empty array when no recent purchases', async () => {
                vi.spyOn(mockModel, 'getRecentPurchases').mockResolvedValue([]);

                const result = await service.getRecentPurchases(userActor, 'client-999');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                if (result.data) {
                    expect(result.data).toHaveLength(0);
                }
            });

            it('should deny guest access', async () => {
                const result = await service.getRecentPurchases(guestActor, 'client-123');

                expect(result.error).toBeDefined();
                if (result.error) {
                    expect(result.error.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            });
        });

        describe('getWithItems', () => {
            it('should get purchase with subscription items', async () => {
                const mockResult = {
                    purchase: mockPurchase,
                    items: [
                        {
                            id: 'item-123',
                            linkedEntityId: 'entity-123',
                            entityType: 'accommodation'
                        }
                    ]
                };
                vi.spyOn(mockModel, 'withItems').mockResolvedValue(mockResult);

                const result = await service.getWithItems(userActor, 'purchase-123');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                if (result.data) {
                    expect(result.data?.purchase.id).toBe('purchase-123');
                    expect(result.data?.items).toHaveLength(1);
                    expect(result.data?.items[0].entityType).toBe('accommodation');
                }
            });

            it('should return null when purchase not found', async () => {
                vi.spyOn(mockModel, 'withItems').mockResolvedValue(null);

                const result = await service.getWithItems(userActor, 'purchase-999');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                if (result.data) {
                    expect(result.data).toBeNull();
                }
            });

            it('should handle empty items array', async () => {
                const mockResult = {
                    purchase: mockPurchase,
                    items: []
                };
                vi.spyOn(mockModel, 'withItems').mockResolvedValue(mockResult);

                const result = await service.getWithItems(userActor, 'purchase-123');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                if (result.data) {
                    expect(result.data?.items).toHaveLength(0);
                }
            });

            it('should deny guest access', async () => {
                const result = await service.getWithItems(guestActor, 'purchase-123');

                expect(result.error).toBeDefined();
                if (result.error) {
                    expect(result.error.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            });
        });
    });
});
