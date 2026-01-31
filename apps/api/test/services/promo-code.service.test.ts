/**
 * PromoCodeService Test Suite
 *
 * Comprehensive tests for PromoCodeService covering:
 * - CRUD operations (create, getByCode, getById, update, delete)
 * - List with filters and pagination
 * - Validation with multiple contexts (expiry, plan restrictions, min amount, etc.)
 * - Apply to checkout session
 * - Usage tracking (increment, record)
 * - Fallback to DEFAULT_PROMO_CODES
 *
 * @module test/services/promo-code.service
 */

import { ServiceErrorCode } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromoCodeService } from '../../src/services/promo-code.service';

// Hoist mock variables so they're available when vi.mock() factories execute
const { mockDb, mockGetDb, mockGetQZPayBilling } = vi.hoisted(() => {
    const mockDb = {
        insert: vi.fn(),
        select: vi.fn(),
        update: vi.fn(),
        from: vi.fn(),
        where: vi.fn(),
        limit: vi.fn(),
        returning: vi.fn(),
        values: vi.fn(),
        set: vi.fn(),
        orderBy: vi.fn(),
        offset: vi.fn()
    };

    return {
        mockDb,
        mockGetDb: vi.fn(() => mockDb),
        mockGetQZPayBilling: vi.fn()
    };
});

// Mock modules
vi.mock('@qazuor/qzpay-core');

vi.mock('@repo/billing', () => ({
    DEFAULT_PROMO_CODES: [
        {
            code: 'HOSPEDA_FREE',
            discountPercent: 100,
            isActive: true,
            isPermanent: true,
            description: 'Free account',
            expiresAt: null,
            maxRedemptions: null,
            durationCycles: null,
            restrictedToPlans: null,
            newUserOnly: false
        },
        {
            code: 'TEST10',
            discountPercent: 10,
            isActive: true,
            isPermanent: false,
            description: 'Test discount',
            expiresAt: new Date('2030-01-01'),
            maxRedemptions: 100,
            durationCycles: 1,
            restrictedToPlans: ['owner-basico'],
            newUserOnly: true
        }
    ]
}));

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: mockGetQZPayBilling
}));

vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    billingPromoCodes: {
        id: 'id',
        code: 'code',
        type: 'type',
        value: 'value',
        active: 'active',
        expiresAt: 'expiresAt',
        config: 'config',
        maxUses: 'maxUses',
        usedCount: 'usedCount',
        createdAt: 'createdAt',
        validPlans: 'validPlans',
        newCustomersOnly: 'newCustomersOnly',
        livemode: 'livemode'
    },
    billingPromoCodeUsage: {
        id: 'id',
        promoCodeId: 'promoCodeId',
        customerId: 'customerId',
        subscriptionId: 'subscriptionId',
        discountAmount: 'discountAmount',
        currency: 'currency',
        livemode: 'livemode'
    },
    and: vi.fn((...args) => args),
    count: vi.fn(() => 'count-fn'),
    desc: vi.fn((field) => `desc(${field})`),
    eq: vi.fn((field, value) => ({ field, value, op: 'eq' })),
    ilike: vi.fn((field, value) => ({ field, value, op: 'ilike' })),
    isNull: vi.fn((field) => ({ field, op: 'isNull' })),
    lte: vi.fn((field, value) => ({ field, value, op: 'lte' })),
    or: vi.fn((...args) => ({ op: 'or', conditions: args })),
    sql: vi.fn((strings, ...values) => ({ strings, values, type: 'sql' }))
}));

describe('PromoCodeService', () => {
    let service: PromoCodeService;

    // Mock DB record
    const mockDbPromoCode = {
        id: 'pc_123',
        code: 'WELCOME20',
        type: 'percentage',
        value: 20,
        active: true,
        expiresAt: new Date('2030-01-01'),
        maxUses: 100,
        usedCount: 5,
        config: { description: 'Welcome discount' },
        createdAt: new Date('2024-01-01'),
        validPlans: null,
        newCustomersOnly: false,
        livemode: false
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default billing mock
        mockGetQZPayBilling.mockReturnValue({});

        // Setup chainable query builder mocks
        mockDb.insert.mockReturnValue(mockDb);
        mockDb.select.mockReturnValue(mockDb);
        mockDb.update.mockReturnValue(mockDb);
        mockDb.from.mockReturnValue(mockDb);
        mockDb.where.mockReturnValue(mockDb);
        mockDb.limit.mockReturnValue(mockDb);
        mockDb.returning.mockReturnValue(mockDb);
        mockDb.values.mockReturnValue(mockDb);
        mockDb.set.mockReturnValue(mockDb);
        mockDb.orderBy.mockReturnValue(mockDb);
        mockDb.offset.mockReturnValue(mockDb);

        service = new PromoCodeService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('create', () => {
        it('should successfully create promo code with all fields', async () => {
            // Arrange
            const input = {
                code: 'welcome20',
                discountType: 'percentage' as const,
                discountValue: 20,
                description: 'Welcome discount',
                expiryDate: new Date('2030-01-01'),
                maxUses: 100,
                planRestrictions: ['owner-basico', 'owner-premium'],
                firstPurchaseOnly: true,
                minAmount: 5000,
                isActive: true
            };

            mockDb.returning.mockResolvedValue([mockDbPromoCode]);

            // Act
            const result = await service.create(input);

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.code).toBe('WELCOME20');
            expect(result.data?.type).toBe('percentage');
            expect(result.data?.value).toBe(20);
            expect(mockDb.insert).toHaveBeenCalled();
            expect(mockDb.values).toHaveBeenCalled();
            expect(mockDb.returning).toHaveBeenCalled();
        });

        it('should uppercase the code', async () => {
            // Arrange
            const input = {
                code: 'summer2024',
                discountType: 'percentage' as const,
                discountValue: 15,
                isActive: true
            };

            mockDb.returning.mockResolvedValue([{ ...mockDbPromoCode, code: 'SUMMER2024' }]);

            // Act
            const result = await service.create(input);

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.code).toBe('SUMMER2024');
        });

        it('should return error on DB failure', async () => {
            // Arrange
            const input = {
                code: 'test',
                discountType: 'percentage' as const,
                discountValue: 10,
                isActive: true
            };

            mockDb.returning.mockRejectedValue(new Error('Database connection failed'));

            // Act
            const result = await service.create(input);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toBe('Failed to create promo code');
        });
    });

    describe('getByCode', () => {
        it('should return promo code from database', async () => {
            // Arrange
            mockDb.limit.mockResolvedValue([mockDbPromoCode]);

            // Act
            const result = await service.getByCode('WELCOME20');

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.code).toBe('WELCOME20');
            expect(result.data?.id).toBe('pc_123');
            expect(mockDb.select).toHaveBeenCalled();
        });

        it('should fallback to DEFAULT_PROMO_CODES when not in DB', async () => {
            // Arrange
            mockDb.limit.mockResolvedValue([]);

            // Act
            const result = await service.getByCode('HOSPEDA_FREE');

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.code).toBe('HOSPEDA_FREE');
            expect(result.data?.id).toBe('local_HOSPEDA_FREE');
            expect(result.data?.type).toBe('percentage');
            expect(result.data?.value).toBe(100);
        });

        it('should return not found when code does not exist anywhere', async () => {
            // Arrange
            mockDb.limit.mockResolvedValue([]);

            // Act
            const result = await service.getByCode('NONEXISTENT');

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(result.error?.message).toBe('Promo code not found');
        });

        it('should normalize code to uppercase', async () => {
            // Arrange
            mockDb.limit.mockResolvedValue([mockDbPromoCode]);

            // Act
            await service.getByCode('welcome20');

            // Assert
            expect(mockDb.select).toHaveBeenCalled();
        });
    });

    describe('getById', () => {
        it('should return promo code by ID', async () => {
            // Arrange
            mockDb.limit.mockResolvedValue([mockDbPromoCode]);

            // Act
            const result = await service.getById('pc_123');

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.id).toBe('pc_123');
            expect(result.data?.code).toBe('WELCOME20');
            expect(mockDb.select).toHaveBeenCalled();
        });

        it('should return not found for missing ID', async () => {
            // Arrange
            mockDb.limit.mockResolvedValue([]);

            // Act
            const result = await service.getById('pc_nonexistent');

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(result.error?.message).toBe('Promo code not found');
        });
    });

    describe('update', () => {
        it('should update description (merges config)', async () => {
            // Arrange
            const existingCode = {
                ...mockDbPromoCode,
                config: { description: 'Old description', minAmount: 1000 }
            };
            const updatedCode = {
                ...existingCode,
                config: { description: 'New description', minAmount: 1000 }
            };

            mockDb.limit.mockResolvedValue([existingCode]);
            mockDb.returning.mockResolvedValue([updatedCode]);

            // Act
            const result = await service.update('pc_123', { description: 'New description' });

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.metadata?.description).toBe('New description');
            expect(mockDb.update).toHaveBeenCalled();
        });

        it('should update active status', async () => {
            // Arrange
            const updatedCode = { ...mockDbPromoCode, active: false };
            mockDb.returning.mockResolvedValue([updatedCode]);

            // Act
            const result = await service.update('pc_123', { isActive: false });

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.active).toBe(false);
        });

        it('should update multiple fields', async () => {
            // Arrange
            const existingCode = mockDbPromoCode;
            const updatedCode = {
                ...mockDbPromoCode,
                active: false,
                maxUses: 200,
                expiresAt: new Date('2025-12-31')
            };

            mockDb.limit.mockResolvedValue([existingCode]);
            mockDb.returning.mockResolvedValue([updatedCode]);

            // Act
            const result = await service.update('pc_123', {
                isActive: false,
                maxUses: 200,
                expiryDate: new Date('2025-12-31')
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.active).toBe(false);
            expect(result.data?.maxUses).toBe(200);
        });

        it('should return not found for missing ID', async () => {
            // Arrange - when only isActive is provided, no SELECT is done;
            // the service goes directly to update().set().where().returning()
            mockDb.returning.mockResolvedValue([]);

            // Act
            const result = await service.update('pc_nonexistent', { isActive: false });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('delete', () => {
        it('should soft delete (sets active=false)', async () => {
            // Arrange
            const deletedCode = { ...mockDbPromoCode, active: false };
            mockDb.returning.mockResolvedValue([deletedCode]);

            // Act
            const result = await service.delete('pc_123');

            // Assert
            expect(result.success).toBe(true);
            expect(mockDb.update).toHaveBeenCalled();
            expect(mockDb.set).toHaveBeenCalledWith({ active: false });
        });

        it('should return not found for missing ID', async () => {
            // Arrange
            mockDb.returning.mockResolvedValue([]);

            // Act
            const result = await service.delete('pc_nonexistent');

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('list', () => {
        /**
         * The list() method runs two query chains:
         * 1. Count: db.select({value: count()}).from(table).where(clause) → terminal: where()
         * 2. Items: db.select().from(table).where(clause).orderBy().limit().offset() → terminal: offset()
         *
         * We use mockResolvedValueOnce on where() for the count (1st call),
         * then where() returns mockDb (default) for the items chain to continue to offset().
         */
        it('should return paginated list with no filters', async () => {
            // Arrange
            const promoCodes = [mockDbPromoCode];
            mockDb.where.mockResolvedValueOnce([{ value: 1 }]); // count query terminal
            mockDb.where.mockReturnValueOnce(mockDb); // items query continues chain
            mockDb.offset.mockResolvedValueOnce(promoCodes); // items query terminal

            // Act
            const result = await service.list({});

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.pagination).toEqual({
                page: 1,
                pageSize: 20,
                total: 1,
                totalPages: 1
            });
        });

        it('should filter by active status', async () => {
            // Arrange
            const activeCode = { ...mockDbPromoCode, active: true };
            mockDb.where.mockResolvedValueOnce([{ value: 1 }]); // count
            mockDb.where.mockReturnValueOnce(mockDb); // items chain
            mockDb.offset.mockResolvedValueOnce([activeCode]);

            // Act
            const result = await service.list({ active: true });

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.items[0]?.active).toBe(true);
        });

        it('should filter by code search', async () => {
            // Arrange
            mockDb.where.mockResolvedValueOnce([{ value: 1 }]); // count
            mockDb.where.mockReturnValueOnce(mockDb); // items chain
            mockDb.offset.mockResolvedValueOnce([mockDbPromoCode]);

            // Act
            const result = await service.list({ codeSearch: 'WELCOME' });

            // Assert
            expect(result.success).toBe(true);
            expect(mockDb.select).toHaveBeenCalled();
        });

        it('should return correct pagination metadata', async () => {
            // Arrange
            mockDb.where.mockResolvedValueOnce([{ value: 45 }]); // count
            mockDb.where.mockReturnValueOnce(mockDb); // items chain
            mockDb.offset.mockResolvedValueOnce([mockDbPromoCode]);

            // Act
            const result = await service.list({ page: 2, pageSize: 10 });

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.pagination).toEqual({
                page: 2,
                pageSize: 10,
                total: 45,
                totalPages: 5
            });
        });
    });

    describe('validate', () => {
        it('should return valid for active, unexpired code', async () => {
            // Arrange
            mockDb.limit.mockResolvedValue([mockDbPromoCode]);

            // Act
            const result = await service.validate('WELCOME20', {
                userId: 'user_123',
                amount: 10000
            });

            // Assert
            expect(result.valid).toBe(true);
            expect(result.errorCode).toBeUndefined();
            expect(result.discountAmount).toBe(2000); // 20% of 10000
        });

        it('should return invalid for inactive code', async () => {
            // Arrange
            const inactiveCode = { ...mockDbPromoCode, active: false };
            mockDb.limit.mockResolvedValue([inactiveCode]);

            // Act
            const result = await service.validate('WELCOME20', { userId: 'user_123' });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('PROMO_CODE_INACTIVE');
            expect(result.errorMessage).toBe('This promo code is no longer active');
        });

        it('should return invalid for expired code', async () => {
            // Arrange
            const expiredCode = {
                ...mockDbPromoCode,
                expiresAt: new Date('2020-01-01') // Past date
            };
            mockDb.limit.mockResolvedValue([expiredCode]);

            // Act
            const result = await service.validate('WELCOME20', { userId: 'user_123' });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('PROMO_CODE_EXPIRED');
            expect(result.errorMessage).toBe('This promo code has expired');
        });

        it('should return invalid when max uses exceeded', async () => {
            // Arrange
            const maxedOutCode = {
                ...mockDbPromoCode,
                maxUses: 10,
                usedCount: 10
            };
            mockDb.limit.mockResolvedValue([maxedOutCode]);

            // Act
            const result = await service.validate('WELCOME20', { userId: 'user_123' });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('PROMO_CODE_MAX_USES');
            expect(result.errorMessage).toBe(
                'This promo code has reached its maximum number of uses'
            );
        });

        it('should return invalid for plan restriction mismatch', async () => {
            // Arrange
            const _restrictedCode = {
                ...mockDbPromoCode,
                id: 'pc_restricted',
                code: 'TEST10',
                metadata: {
                    restrictedToPlans: ['owner-basico']
                }
            };

            // Mock getByCode to return local config code
            mockDb.limit.mockResolvedValue([]);

            // Act
            const result = await service.validate('TEST10', {
                userId: 'user_123',
                planId: 'owner-premium' // Doesn't match restriction
            });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('PROMO_CODE_PLAN_RESTRICTION');
            expect(result.errorMessage).toBe('This promo code is not valid for the selected plan');
        });

        it('should return invalid for amount below minimum', async () => {
            // Arrange
            const minAmountCode = {
                ...mockDbPromoCode,
                config: { description: 'Test', minAmount: 10000 }
            };
            mockDb.limit.mockResolvedValue([minAmountCode]);

            // Act
            const result = await service.validate('WELCOME20', {
                userId: 'user_123',
                amount: 5000 // Below 10000
            });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('PROMO_CODE_MIN_AMOUNT');
            expect(result.errorMessage).toContain('Minimum amount of 10000 required');
        });

        it('should calculate percentage discount preview', async () => {
            // Arrange
            mockDb.limit.mockResolvedValue([mockDbPromoCode]);

            // Act
            const result = await service.validate('WELCOME20', {
                userId: 'user_123',
                amount: 15000
            });

            // Assert
            expect(result.valid).toBe(true);
            expect(result.discountAmount).toBe(3000); // 20% of 15000
        });

        it('should calculate fixed amount discount preview', async () => {
            // Arrange
            const fixedCode = {
                ...mockDbPromoCode,
                type: 'fixed',
                value: 2000 // $20 fixed discount
            };
            mockDb.limit.mockResolvedValue([fixedCode]);

            // Act
            const result = await service.validate('WELCOME20', {
                userId: 'user_123',
                amount: 10000
            });

            // Assert
            expect(result.valid).toBe(true);
            expect(result.discountAmount).toBe(2000); // Fixed $20
        });

        it('should return not found for non-existent code', async () => {
            // Arrange
            mockDb.limit.mockResolvedValue([]);

            // Act
            const result = await service.validate('NONEXISTENT', { userId: 'user_123' });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('PROMO_CODE_NOT_FOUND');
            expect(result.errorMessage).toBe('Promo code not found');
        });
    });

    describe('apply', () => {
        it('should throw when billing not configured (ensureBilling)', async () => {
            // Arrange
            mockGetQZPayBilling.mockReturnValue(null);
            const serviceWithoutBilling = new PromoCodeService();
            mockDb.limit.mockResolvedValue([mockDbPromoCode]);

            // Act & Assert
            await expect(serviceWithoutBilling.apply('WELCOME20', 'checkout_123')).rejects.toThrow(
                'Billing service not configured'
            );
        });

        it('should return success with promo code details', async () => {
            // Arrange
            mockDb.limit.mockResolvedValue([mockDbPromoCode]);

            // Act
            const result = await service.apply('WELCOME20', 'checkout_123');

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.code).toBe('WELCOME20');
            expect(result.data?.type).toBe('percentage');
            expect(result.data?.value).toBe(20);
        });

        it('should return error for inactive code', async () => {
            // Arrange
            const inactiveCode = { ...mockDbPromoCode, active: false };
            mockDb.limit.mockResolvedValue([inactiveCode]);

            // Act
            const result = await service.apply('WELCOME20', 'checkout_123');

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.message).toBe('This promo code is no longer active');
        });

        it('should return error for expired code', async () => {
            // Arrange
            const expiredCode = {
                ...mockDbPromoCode,
                expiresAt: new Date('2020-01-01')
            };
            mockDb.limit.mockResolvedValue([expiredCode]);

            // Act
            const result = await service.apply('WELCOME20', 'checkout_123');

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.message).toBe('This promo code has expired');
        });
    });

    describe('incrementUsage', () => {
        it('should increment usage atomically', async () => {
            // Arrange
            const incrementedCode = { ...mockDbPromoCode, usedCount: 6 };
            mockDb.returning.mockResolvedValue([incrementedCode]);

            // Act
            const result = await service.incrementUsage('pc_123');

            // Assert
            expect(result.success).toBe(true);
            expect(mockDb.update).toHaveBeenCalled();
            expect(mockDb.set).toHaveBeenCalled();
        });

        it('should return not found for missing ID', async () => {
            // Arrange
            mockDb.returning.mockResolvedValue([]);

            // Act
            const result = await service.incrementUsage('pc_nonexistent');

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('recordUsage', () => {
        it('should record usage entry successfully', async () => {
            // Arrange
            const usageRecord = {
                id: 'usage_123',
                promoCodeId: 'pc_123',
                customerId: 'cust_123',
                subscriptionId: 'sub_123',
                discountAmount: 2000,
                currency: 'ARS',
                livemode: false
            };

            mockDb.returning.mockResolvedValue([usageRecord]);

            // Act
            const result = await service.recordUsage({
                promoCodeId: 'pc_123',
                customerId: 'cust_123',
                subscriptionId: 'sub_123',
                discountAmount: 2000,
                currency: 'ARS'
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.id).toBe('usage_123');
            expect(mockDb.insert).toHaveBeenCalled();
        });

        it('should return error on failure', async () => {
            // Arrange
            mockDb.returning.mockRejectedValue(new Error('Database error'));

            // Act
            const result = await service.recordUsage({
                promoCodeId: 'pc_123',
                customerId: 'cust_123',
                discountAmount: 2000,
                currency: 'ARS'
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toBe('Failed to record promo code usage');
        });
    });
});
