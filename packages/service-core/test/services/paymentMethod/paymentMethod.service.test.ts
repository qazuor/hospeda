import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentMethodModel } from '@repo/db';
import {
    PermissionEnum,
    RoleEnum,
    type UpdatePaymentMethod
} from '@repo/schemas';
import { PaymentMethodService } from '../../../src/services/paymentMethod/paymentMethod.service';
import type { Actor, ServiceContext } from '../../../src/types';

// Mock PaymentMethodModel
const mockPaymentMethodModel = {
    create: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    findAll: vi.fn(),
    findAllWithRelations: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    hardDelete: vi.fn(),
    restore: vi.fn(),
    count: vi.fn(),
    // Business methods
    validateCard: vi.fn(),
    tokenize: vi.fn(),
    checkExpiration: vi.fn(),
    setAsDefault: vi.fn(),
    findByClient: vi.fn(),
    getDefaultForClient: vi.fn(),
    findExpired: vi.fn(),
    createWithCard: vi.fn(),
    remove: vi.fn(),
    updateExpiry: vi.fn()
} as unknown as PaymentMethodModel;

// Test data - using DB schema fields
const mockPaymentMethod: any = {
    id: '00000000-0000-0000-0000-000000000001',
    clientId: '00000000-0000-0000-0000-000000000002',
    provider: 'stripe',
    token: 'tok_test123',
    brand: 'visa',
    last4: '4242',
    expiresAt: new Date('2025-12-31'),
    defaultMethod: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null
};

const mockActor: Actor = {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'test@example.com',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.CLIENT_UPDATE]
};

const mockContext: ServiceContext = {
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
} as unknown as ServiceContext;

describe('PaymentMethodService', () => {
    let service: PaymentMethodService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new PaymentMethodService(mockContext, mockPaymentMethodModel);
    });

    // =========================================================================
    // PERMISSION HOOKS TESTS
    // =========================================================================

    describe('Permission Hooks', () => {
        const unauthorizedActor: Actor = {
            id: 'user-id',
            email: 'user@example.com',
            role: RoleEnum.USER,
            permissions: []
        };

        describe('_canCreate', () => {
            it('should allow ADMIN to create', async () => {
                const createData: any = {
                    clientId: '123e4567-e89b-12d3-a456-426614174000', // Valid UUID v1
                    type: 'credit_card' as const,
                    displayName: 'Visa ending in 4242',
                    isDefault: false,
                    cardLast4: '4242',
                    cardBrand: 'visa',
                    cardExpiryMonth: 12,
                    cardExpiryYear: 2025
                };

                mockPaymentMethodModel.create = vi.fn().mockResolvedValue(mockPaymentMethod);

                const result = await service.create(mockActor, createData);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
            });

            it('should allow user with CLIENT_UPDATE permission', async () => {
                const authorizedUser: Actor = {
                    ...unauthorizedActor,
                    permissions: [PermissionEnum.CLIENT_UPDATE]
                };

                const createData: any = {
                    clientId: '123e4567-e89b-12d3-a456-426614174000', // Valid UUID v1
                    type: 'credit_card' as const,
                    displayName: 'Visa ending in 4242',
                    isDefault: false,
                    cardLast4: '4242',
                    cardBrand: 'visa',
                    cardExpiryMonth: 12,
                    cardExpiryYear: 2025
                };

                mockPaymentMethodModel.create = vi.fn().mockResolvedValue(mockPaymentMethod);

                const result = await service.create(authorizedUser, createData);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
            });

            it('should deny unauthorized user', async () => {
                // Validation happens BEFORE permission check in BaseCrudService
                // So we need valid data, but actor without permissions
                const createData: any = {
                    clientId: '123e4567-e89b-12d3-a456-426614174000', // Valid UUID v1
                    type: 'credit_card' as const,
                    displayName: 'Visa ending in 4242',
                    isDefault: false,
                    cardLast4: '4242',
                    cardBrand: 'visa',
                    cardExpiryMonth: 12,
                    cardExpiryYear: 2025
                };

                const result = await service.create(unauthorizedActor, createData);

                expect(result.error).toBeDefined();
                expect(result.error?.message.toLowerCase()).toContain('permission');
            });
        });

        describe('_canUpdate', () => {
            it('should allow ADMIN to update', async () => {
                const updateData: UpdatePaymentMethod = { isDefault: true };

                mockPaymentMethodModel.findById = vi.fn().mockResolvedValue(mockPaymentMethod);
                mockPaymentMethodModel.update = vi
                    .fn()
                    .mockResolvedValue({ ...mockPaymentMethod, ...updateData });

                const result = await service.update(mockActor, mockPaymentMethod.id, updateData);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
            });

            it('should deny unauthorized user', async () => {
                const updateData: UpdatePaymentMethod = { isDefault: true };

                mockPaymentMethodModel.findById = vi.fn().mockResolvedValue(mockPaymentMethod);

                const result = await service.update(
                    unauthorizedActor,
                    mockPaymentMethod.id,
                    updateData
                );

                expect(result.error).toBeDefined();
                expect(result.error?.message.toLowerCase()).toContain('permission');
            });
        });

        describe('_canView', () => {
            it('should allow ADMIN to view', async () => {
                mockPaymentMethodModel.findOne = vi.fn().mockResolvedValue(mockPaymentMethod);

                const result = await service.getById(mockActor, mockPaymentMethod.id);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
            });

            it('should deny unauthorized user', async () => {
                // Entity must exist for permission check to occur
                mockPaymentMethodModel.findOne = vi.fn().mockResolvedValue(mockPaymentMethod);

                const result = await service.getById(unauthorizedActor, mockPaymentMethod.id);

                expect(result.error).toBeDefined();
                expect(result.error?.message.toLowerCase()).toContain('permission');
            });
        });

        describe('_canList', () => {
            it('should allow ADMIN to list', async () => {
                mockPaymentMethodModel.findAllWithRelations = vi
                    .fn()
                    .mockResolvedValue({ items: [mockPaymentMethod], total: 1 });

                const result = await service.list(mockActor, {});

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
            });

            it('should deny unauthorized user', async () => {
                mockPaymentMethodModel.findAllWithRelations = vi
                    .fn()
                    .mockResolvedValue({ items: [], total: 0 });

                const result = await service.list(unauthorizedActor, {});

                expect(result.error).toBeDefined();
                expect(result.error?.message.toLowerCase()).toContain('permission');
            });
        });

        describe('_canSoftDelete', () => {
            it('should allow ADMIN to soft delete', async () => {
                mockPaymentMethodModel.findById = vi.fn().mockResolvedValue(mockPaymentMethod);
                mockPaymentMethodModel.softDelete = vi.fn().mockResolvedValue(undefined);

                const result = await service.softDelete(mockActor, mockPaymentMethod.id);

                expect(result.error).toBeUndefined();
            });

            it('should deny unauthorized user', async () => {
                mockPaymentMethodModel.findById = vi.fn().mockResolvedValue(mockPaymentMethod);

                const result = await service.softDelete(unauthorizedActor, mockPaymentMethod.id);

                expect(result.error).toBeDefined();
                expect(result.error?.message.toLowerCase()).toContain('permission');
            });
        });

        describe('_canHardDelete', () => {
            it('should allow ADMIN to hard delete', async () => {
                mockPaymentMethodModel.findById = vi.fn().mockResolvedValue(mockPaymentMethod);
                mockPaymentMethodModel.hardDelete = vi.fn().mockResolvedValue(undefined);

                const result = await service.hardDelete(mockActor, mockPaymentMethod.id);

                expect(result.error).toBeUndefined();
            });

            it('should deny non-admin user', async () => {
                const nonAdmin: Actor = {
                    ...mockActor,
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.CLIENT_UPDATE]
                };

                mockPaymentMethodModel.findById = vi.fn().mockResolvedValue(mockPaymentMethod);

                const result = await service.hardDelete(nonAdmin, mockPaymentMethod.id);

                expect(result.error).toBeDefined();
                expect(result.error?.message.toLowerCase()).toContain('permission');
            });
        });
    });

    // =========================================================================
    // BUSINESS METHODS TESTS
    // =========================================================================

    describe('Business Methods', () => {
        describe('validateCard', () => {
            it('should validate valid card successfully', async () => {
                const cardData = {
                    number: '4242424242424242',
                    expiryMonth: 12,
                    expiryYear: 2025,
                    cvv: '123'
                };

                mockPaymentMethodModel.validateCard = vi
                    .fn()
                    .mockResolvedValue({ valid: true });

                const result = await service.validateCard(mockActor, cardData);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data?.valid).toBe(true);
            });

            it('should reject invalid card number', async () => {
                const cardData = {
                    number: '1234567890123456',
                    expiryMonth: 12,
                    expiryYear: 2025,
                    cvv: '123'
                };

                mockPaymentMethodModel.validateCard = vi.fn().mockResolvedValue({
                    valid: false,
                    reason: 'INVALID_CARD_NUMBER'
                });

                const result = await service.validateCard(mockActor, cardData);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data?.valid).toBe(false);
                expect(result.data?.reason).toBe('INVALID_CARD_NUMBER');
            });

            it('should reject expired card', async () => {
                const cardData = {
                    number: '4242424242424242',
                    expiryMonth: 1,
                    expiryYear: 2020,
                    cvv: '123'
                };

                mockPaymentMethodModel.validateCard = vi.fn().mockResolvedValue({
                    valid: false,
                    reason: 'CARD_EXPIRED'
                });

                const result = await service.validateCard(mockActor, cardData);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data?.valid).toBe(false);
                expect(result.data?.reason).toBe('CARD_EXPIRED');
            });

            it('should deny unauthorized user', async () => {
                const unauthorizedActor: Actor = {
                    id: 'user-id',
                    email: 'user@example.com',
                    role: RoleEnum.USER,
                    permissions: []
                };

                const cardData = {
                    number: '4242424242424242',
                    expiryMonth: 12,
                    expiryYear: 2025,
                    cvv: '123'
                };

                const result = await service.validateCard(unauthorizedActor, cardData);

                expect(result.error).toBeDefined();
                expect(result.error?.message.toLowerCase()).toContain('permission');
            });
        });

        describe('tokenize', () => {
            it('should tokenize card successfully', async () => {
                const cardData = {
                    number: '4242424242424242',
                    expiryMonth: 12,
                    expiryYear: 2025,
                    cvv: '123',
                    holderName: 'John Doe'
                };

                mockPaymentMethodModel.tokenize = vi.fn().mockResolvedValue({
                    success: true,
                    token: 'tok_123',
                    brand: 'visa',
                    last4: '4242'
                });

                const result = await service.tokenize(mockActor, cardData);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data?.success).toBe(true);
                expect(result.data?.token).toBe('tok_123');
                expect(result.data?.brand).toBe('visa');
            });

            it('should fail on invalid card', async () => {
                const cardData = {
                    number: '1234567890123456',
                    expiryMonth: 12,
                    expiryYear: 2025,
                    cvv: '123',
                    holderName: 'John Doe'
                };

                mockPaymentMethodModel.tokenize = vi.fn().mockResolvedValue({
                    success: false,
                    error: 'Invalid card data'
                });

                const result = await service.tokenize(mockActor, cardData);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data?.success).toBe(false);
                expect(result.data?.error).toBeDefined();
            });

            it('should deny unauthorized user', async () => {
                const unauthorizedActor: Actor = {
                    id: 'user-id',
                    email: 'user@example.com',
                    role: RoleEnum.USER,
                    permissions: []
                };

                const cardData = {
                    number: '4242424242424242',
                    expiryMonth: 12,
                    expiryYear: 2025,
                    cvv: '123',
                    holderName: 'John Doe'
                };

                const result = await service.tokenize(unauthorizedActor, cardData);

                expect(result.error).toBeDefined();
                expect(result.error?.message.toLowerCase()).toContain('permission');
            });
        });

        describe('checkExpiration', () => {
            it('should return expired status for expired card', async () => {
                const expiredPaymentMethod = {
                    ...mockPaymentMethod,
                    expiresAt: new Date('2020-12-31')
                };

                mockPaymentMethodModel.checkExpiration = vi.fn().mockResolvedValue({
                    expired: true,
                    expiresAt: expiredPaymentMethod.expiresAt
                });

                const result = await service.checkExpiration(
                    mockActor,
                    expiredPaymentMethod.id
                );

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data?.expired).toBe(true);
                expect(result.data?.expiresAt).toBeDefined();
            });

            it('should return not expired for valid card', async () => {
                mockPaymentMethodModel.checkExpiration = vi.fn().mockResolvedValue({
                    expired: false,
                    expiresAt: mockPaymentMethod.expiresAt
                });

                const result = await service.checkExpiration(mockActor, mockPaymentMethod.id);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data?.expired).toBe(false);
            });

            it('should deny unauthorized user', async () => {
                const unauthorizedActor: Actor = {
                    id: 'user-id',
                    email: 'user@example.com',
                    role: RoleEnum.USER,
                    permissions: []
                };

                const result = await service.checkExpiration(
                    unauthorizedActor,
                    mockPaymentMethod.id
                );

                expect(result.error).toBeDefined();
                expect(result.error?.message.toLowerCase()).toContain('permission');
            });
        });

        describe('setAsDefault', () => {
            it('should set payment method as default', async () => {
                mockPaymentMethodModel.setAsDefault = vi.fn().mockResolvedValue({
                    success: true
                });

                const result = await service.setAsDefault(mockActor, mockPaymentMethod.id);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data?.success).toBe(true);
            });

            it('should fail when payment method not found', async () => {
                mockPaymentMethodModel.setAsDefault = vi.fn().mockResolvedValue({
                    success: false,
                    error: 'Payment method not found'
                });

                const result = await service.setAsDefault(mockActor, 'non-existent-id');

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data?.success).toBe(false);
                expect(result.data?.error).toBeDefined();
            });

            it('should deny unauthorized user', async () => {
                const unauthorizedActor: Actor = {
                    id: 'user-id',
                    email: 'user@example.com',
                    role: RoleEnum.USER,
                    permissions: []
                };

                const result = await service.setAsDefault(unauthorizedActor, mockPaymentMethod.id);

                expect(result.error).toBeDefined();
                expect(result.error?.message.toLowerCase()).toContain('permission');
            });
        });

        describe('findByClient', () => {
            it('should return payment methods for client', async () => {
                const clientMethods = [mockPaymentMethod];

                mockPaymentMethodModel.findByClient = vi.fn().mockResolvedValue(clientMethods);

                const result = await service.findByClient(
                    mockActor,
                    mockPaymentMethod.clientId
                );

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data).toHaveLength(1);
                expect(result.data?.[0]?.id).toBe(mockPaymentMethod.id);
            });

            it('should return empty array when no methods found', async () => {
                mockPaymentMethodModel.findByClient = vi.fn().mockResolvedValue([]);

                const result = await service.findByClient(mockActor, 'non-existent-client');

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data).toHaveLength(0);
            });

            it('should deny unauthorized user', async () => {
                const unauthorizedActor: Actor = {
                    id: 'user-id',
                    email: 'user@example.com',
                    role: RoleEnum.USER,
                    permissions: []
                };

                const result = await service.findByClient(
                    unauthorizedActor,
                    mockPaymentMethod.clientId
                );

                expect(result.error).toBeDefined();
                expect(result.error?.message.toLowerCase()).toContain('permission');
            });
        });

        describe('getDefaultForClient', () => {
            it('should return default payment method', async () => {
                const defaultMethod = { ...mockPaymentMethod, defaultMethod: true };

                mockPaymentMethodModel.getDefaultForClient = vi
                    .fn()
                    .mockResolvedValue(defaultMethod);

                const result = await service.getDefaultForClient(
                    mockActor,
                    mockPaymentMethod.clientId
                );

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data?.defaultMethod).toBe(true);
            });

            it('should return null when no default found', async () => {
                mockPaymentMethodModel.getDefaultForClient = vi.fn().mockResolvedValue(null);

                const result = await service.getDefaultForClient(
                    mockActor,
                    'client-without-default'
                );

                expect(result.error).toBeUndefined();
                expect(result.data).toBeNull();
            });

            it('should deny unauthorized user', async () => {
                const unauthorizedActor: Actor = {
                    id: 'user-id',
                    email: 'user@example.com',
                    role: RoleEnum.USER,
                    permissions: []
                };

                const result = await service.getDefaultForClient(
                    unauthorizedActor,
                    mockPaymentMethod.clientId
                );

                expect(result.error).toBeDefined();
                expect(result.error?.message.toLowerCase()).toContain('permission');
            });
        });

        describe('findExpired', () => {
            it('should return expired payment methods', async () => {
                const expiredMethod = {
                    ...mockPaymentMethod,
                    expiresAt: new Date('2020-12-31')
                };

                mockPaymentMethodModel.findExpired = vi.fn().mockResolvedValue([expiredMethod]);

                const result = await service.findExpired(mockActor);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data).toHaveLength(1);
            });

            it('should return empty array when no expired methods', async () => {
                mockPaymentMethodModel.findExpired = vi.fn().mockResolvedValue([]);

                const result = await service.findExpired(mockActor);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data).toHaveLength(0);
            });

            it('should deny unauthorized user', async () => {
                const unauthorizedActor: Actor = {
                    id: 'user-id',
                    email: 'user@example.com',
                    role: RoleEnum.USER,
                    permissions: []
                };

                const result = await service.findExpired(unauthorizedActor);

                expect(result.error).toBeDefined();
                expect(result.error?.message.toLowerCase()).toContain('permission');
            });
        });

        describe('createWithCard', () => {
            it('should create payment method with card', async () => {
                const cardData = {
                    clientId: mockPaymentMethod.clientId,
                    provider: 'stripe',
                    cardNumber: '4242424242424242',
                    expiryMonth: 12,
                    expiryYear: 2025,
                    cvv: '123',
                    holderName: 'John Doe',
                    setAsDefault: true
                };

                mockPaymentMethodModel.createWithCard = vi.fn().mockResolvedValue({
                    success: true,
                    paymentMethod: mockPaymentMethod
                });

                const result = await service.createWithCard(mockActor, cardData);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data?.success).toBe(true);
                expect(result.data?.paymentMethod).toBeDefined();
            });

            it('should fail on tokenization error', async () => {
                const cardData = {
                    clientId: mockPaymentMethod.clientId,
                    provider: 'stripe',
                    cardNumber: '1234567890123456',
                    expiryMonth: 12,
                    expiryYear: 2025,
                    cvv: '123',
                    holderName: 'John Doe'
                };

                mockPaymentMethodModel.createWithCard = vi.fn().mockResolvedValue({
                    success: false,
                    error: 'Card tokenization failed'
                });

                const result = await service.createWithCard(mockActor, cardData);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data?.success).toBe(false);
                expect(result.data?.error).toBeDefined();
            });

            it('should deny unauthorized user', async () => {
                const unauthorizedActor: Actor = {
                    id: 'user-id',
                    email: 'user@example.com',
                    role: RoleEnum.USER,
                    permissions: []
                };

                const cardData = {
                    clientId: mockPaymentMethod.clientId,
                    provider: 'stripe',
                    cardNumber: '4242424242424242',
                    expiryMonth: 12,
                    expiryYear: 2025,
                    cvv: '123',
                    holderName: 'John Doe'
                };

                const result = await service.createWithCard(unauthorizedActor, cardData);

                expect(result.error).toBeDefined();
                expect(result.error?.message.toLowerCase()).toContain('permission');
            });
        });

        describe('remove', () => {
            it('should remove payment method', async () => {
                mockPaymentMethodModel.remove = vi.fn().mockResolvedValue({
                    success: true
                });

                const result = await service.remove(mockActor, mockPaymentMethod.id);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data?.success).toBe(true);
            });

            it('should fail when payment method not found', async () => {
                mockPaymentMethodModel.remove = vi.fn().mockResolvedValue({
                    success: false,
                    error: 'Payment method not found'
                });

                const result = await service.remove(mockActor, 'non-existent-id');

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                expect(result.data?.success).toBe(false);
                expect(result.data?.error).toBeDefined();
            });

            it('should deny unauthorized user', async () => {
                const unauthorizedActor: Actor = {
                    id: 'user-id',
                    email: 'user@example.com',
                    role: RoleEnum.USER,
                    permissions: []
                };

                const result = await service.remove(unauthorizedActor, mockPaymentMethod.id);

                expect(result.error).toBeDefined();
                expect(result.error?.message.toLowerCase()).toContain('permission');
            });
        });

        describe('updateExpiry', () => {
            it('should update expiry date', async () => {
                const updatedMethod = {
                    ...mockPaymentMethod,
                    expiresAt: new Date('2026-12-31')
                };

                mockPaymentMethodModel.updateExpiry = vi.fn().mockResolvedValue(updatedMethod);

                const result = await service.updateExpiry(
                    mockActor,
                    mockPaymentMethod.id,
                    12,
                    2026
                );

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
            });

            it('should return null when payment method not found', async () => {
                mockPaymentMethodModel.updateExpiry = vi.fn().mockResolvedValue(null);

                const result = await service.updateExpiry(mockActor, 'non-existent-id', 12, 2026);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeNull();
            });

            it('should deny unauthorized user', async () => {
                const unauthorizedActor: Actor = {
                    id: 'user-id',
                    email: 'user@example.com',
                    role: RoleEnum.USER,
                    permissions: []
                };

                const result = await service.updateExpiry(
                    unauthorizedActor,
                    mockPaymentMethod.id,
                    12,
                    2026
                );

                expect(result.error).toBeDefined();
                expect(result.error?.message.toLowerCase()).toContain('permission');
            });
        });
    });
});
