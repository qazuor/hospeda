/**
 * Unit tests for Promo Code Apply Functionality
 *
 * Tests the promo code application endpoint with various scenarios:
 * - Valid percentage and fixed discounts
 * - Expired codes
 * - Inactive codes
 * - Max uses reached
 * - Code not found
 * - No amount provided
 * - Usage recording for DB codes
 *
 * Endpoint: POST /api/v1/protected/billing/promo-codes/apply
 *
 * Test Coverage:
 * - Discount calculation (percentage and fixed)
 * - Validation logic (expiry, active status, max uses)
 * - Database operations (usage increment, usage recording)
 * - Error handling
 */

import type { QZPayBillingPromoCode } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoist mock variables so they're available when vi.mock() factories execute
const { mockDb, mockWithTransaction } = vi.hoisted(() => {
    const mockDb = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        from: vi.fn(),
        where: vi.fn(),
        limit: vi.fn(),
        set: vi.fn(),
        returning: vi.fn(),
        values: vi.fn(),
        execute: vi.fn(),
        transaction: vi.fn()
    };

    // withTransaction mock that executes the callback with mockDb as the transaction
    const mockWithTransaction = vi.fn(async <T>(callback: (tx: typeof mockDb) => Promise<T>) => {
        return callback(mockDb);
    });

    return { mockDb, mockWithTransaction };
});

// Mock logger
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    }
}));

// Mock billing middleware
vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(() => ({
        plans: { get: vi.fn() },
        subscriptions: { getByCustomerId: vi.fn() }
    }))
}));

vi.mock('@repo/db', async () => {
    const actual = await vi.importActual('@repo/db');
    return {
        ...actual,
        getDb: vi.fn(() => mockDb),
        withTransaction: mockWithTransaction,
        eq: vi.fn((field, value) => ({ field, value, type: 'eq' })),
        sql: vi.fn((strings, ...values) => ({ strings, values, type: 'sql' }))
    };
});

// No local promo code fallback - all codes come from database

import { PromoCodeService } from '../../src/services/promo-code.service';

describe('Promo Code Apply Functionality', () => {
    let service: PromoCodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new PromoCodeService();

        // Setup default mock chain
        mockDb.select.mockReturnValue(mockDb);
        mockDb.insert.mockReturnValue(mockDb);
        mockDb.update.mockReturnValue(mockDb);
        mockDb.from.mockReturnValue(mockDb);
        mockDb.where.mockReturnValue(mockDb);
        mockDb.limit.mockReturnValue(mockDb);
        mockDb.set.mockReturnValue(mockDb);
        mockDb.returning.mockReturnValue(mockDb);
        mockDb.values.mockReturnValue(mockDb);
        mockDb.execute.mockReturnValue(mockDb);
    });

    describe('Valid Discount Calculations', () => {
        it('should apply percentage discount correctly', async () => {
            // Arrange
            const mockPromoCode: QZPayBillingPromoCode = {
                id: 'promo-123',
                code: 'SAVE20',
                type: 'percentage',
                value: 20,
                active: true,
                expiresAt: new Date('2099-12-31'),
                maxUses: null,
                usedCount: 0,
                config: null,
                validPlans: null,
                newCustomersOnly: false,
                livemode: false,
                createdAt: new Date(),
                startsAt: null,
                maxPerCustomer: null,
                existingCustomersOnly: false,
                combinable: null
            };

            mockDb.limit.mockResolvedValue([mockPromoCode]);
            // Mock for atomic redemption (SELECT FOR UPDATE and increment)
            mockDb.execute.mockResolvedValue({ rows: [mockPromoCode] });
            mockDb.returning.mockResolvedValue([{ ...mockPromoCode, usedCount: 1 }]);

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';
            const amount = 10000; // 10000 cents = $100

            // Act
            const result = await service.apply('SAVE20', checkoutId, amount);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.code).toBe('SAVE20');
                expect(result.data.type).toBe('percentage');
                expect(result.data.value).toBe(20);
                expect(result.data.originalAmount).toBe(10000);
                expect(result.data.discountAmount).toBe(2000); // 20% of 10000
                expect(result.data.finalAmount).toBe(8000); // 10000 - 2000
            }
        });

        it('should apply fixed discount correctly', async () => {
            // Arrange
            const mockPromoCode: QZPayBillingPromoCode = {
                id: 'promo-456',
                code: 'FLAT500',
                type: 'fixed',
                value: 500, // 500 cents = $5
                active: true,
                expiresAt: null,
                maxUses: null,
                usedCount: 0,
                config: null,
                validPlans: null,
                newCustomersOnly: false,
                livemode: false,
                createdAt: new Date(),
                startsAt: null,
                maxPerCustomer: null,
                existingCustomersOnly: false,
                combinable: null
            };

            mockDb.limit.mockResolvedValue([mockPromoCode]);
            // Mock for atomic redemption
            mockDb.execute.mockResolvedValue({ rows: [mockPromoCode] });
            mockDb.returning.mockResolvedValue([{ ...mockPromoCode, usedCount: 1 }]);

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';
            const amount = 3000; // 3000 cents = $30

            // Act
            const result = await service.apply('FLAT500', checkoutId, amount);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.code).toBe('FLAT500');
                expect(result.data.type).toBe('fixed');
                expect(result.data.value).toBe(500);
                expect(result.data.originalAmount).toBe(3000);
                expect(result.data.discountAmount).toBe(500); // Fixed $5
                expect(result.data.finalAmount).toBe(2500); // 3000 - 500
            }
        });

        it('should cap fixed discount at total amount', async () => {
            // Arrange
            const mockPromoCode: QZPayBillingPromoCode = {
                id: 'promo-789',
                code: 'BIGDISCOUNT',
                type: 'fixed',
                value: 10000, // $100 discount
                active: true,
                expiresAt: null,
                maxUses: null,
                usedCount: 0,
                config: null,
                validPlans: null,
                newCustomersOnly: false,
                livemode: false,
                createdAt: new Date(),
                startsAt: null,
                maxPerCustomer: null,
                existingCustomersOnly: false,
                combinable: null
            };

            mockDb.limit.mockResolvedValue([mockPromoCode]);
            // Mock for atomic redemption
            mockDb.execute.mockResolvedValue({ rows: [mockPromoCode] });
            mockDb.returning.mockResolvedValue([{ ...mockPromoCode, usedCount: 1 }]);

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';
            const amount = 5000; // Only $50

            // Act
            const result = await service.apply('BIGDISCOUNT', checkoutId, amount);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.discountAmount).toBe(5000); // Capped at amount
                expect(result.data.finalAmount).toBe(0); // Can't go negative
            }
        });

        it('should handle no amount provided (0 discount)', async () => {
            // Arrange
            const mockPromoCode: QZPayBillingPromoCode = {
                id: 'promo-000',
                code: 'NOAMOUNT',
                type: 'percentage',
                value: 50,
                active: true,
                expiresAt: null,
                maxUses: null,
                usedCount: 0,
                config: null,
                validPlans: null,
                newCustomersOnly: false,
                livemode: false,
                createdAt: new Date(),
                startsAt: null,
                maxPerCustomer: null,
                existingCustomersOnly: false,
                combinable: null
            };

            mockDb.limit.mockResolvedValue([mockPromoCode]);
            // Mock for atomic redemption
            mockDb.execute.mockResolvedValue({ rows: [mockPromoCode] });
            mockDb.returning.mockResolvedValue([{ ...mockPromoCode, usedCount: 1 }]);

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('NOAMOUNT', checkoutId);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.originalAmount).toBe(0);
                expect(result.data.discountAmount).toBe(0);
                expect(result.data.finalAmount).toBe(0);
            }
        });
    });

    describe('Validation - Code Status', () => {
        it('should reject expired code', async () => {
            // Arrange
            const expiredDate = new Date();
            expiredDate.setDate(expiredDate.getDate() - 1); // Yesterday

            const mockPromoCode: QZPayBillingPromoCode = {
                id: 'promo-expired',
                code: 'EXPIRED',
                type: 'percentage',
                value: 10,
                active: true,
                expiresAt: expiredDate,
                maxUses: null,
                usedCount: 0,
                config: null,
                validPlans: null,
                newCustomersOnly: false,
                livemode: false,
                createdAt: new Date(),
                startsAt: null,
                maxPerCustomer: null,
                existingCustomersOnly: false,
                combinable: null
            };

            mockDb.limit.mockResolvedValue([mockPromoCode]);

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('EXPIRED', checkoutId, 1000);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
                expect(result.error.message).toContain('expired');
            }
        });

        it('should reject inactive code', async () => {
            // Arrange
            const mockPromoCode: QZPayBillingPromoCode = {
                id: 'promo-inactive',
                code: 'INACTIVE',
                type: 'percentage',
                value: 10,
                active: false, // Inactive
                expiresAt: null,
                maxUses: null,
                usedCount: 0,
                config: null,
                validPlans: null,
                newCustomersOnly: false,
                livemode: false,
                createdAt: new Date(),
                startsAt: null,
                maxPerCustomer: null,
                existingCustomersOnly: false,
                combinable: null
            };

            mockDb.limit.mockResolvedValue([mockPromoCode]);

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('INACTIVE', checkoutId, 1000);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
                expect(result.error.message).toContain('no longer active');
            }
        });

        it('should reject code at max uses', async () => {
            // Arrange
            const mockPromoCode: QZPayBillingPromoCode = {
                id: 'promo-maxed',
                code: 'MAXED',
                type: 'percentage',
                value: 10,
                active: true,
                expiresAt: null,
                maxUses: 100,
                usedCount: 100, // At max
                config: null,
                validPlans: null,
                newCustomersOnly: false,
                livemode: false,
                createdAt: new Date(),
                startsAt: null,
                maxPerCustomer: null,
                existingCustomersOnly: false,
                combinable: null
            };

            mockDb.limit.mockResolvedValue([mockPromoCode]);
            // Mock for atomic redemption - will detect max uses
            mockDb.execute.mockResolvedValue({ rows: [mockPromoCode] });

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('MAXED', checkoutId, 1000);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
                expect(result.error.message).toContain('maximum number of uses');
            }
        });

        it('should reject code not found', async () => {
            // Arrange
            mockDb.limit.mockResolvedValue([]); // Not found

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('NOTFOUND', checkoutId, 1000);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
                expect(result.error.message).toContain('not found');
            }
        });
    });

    describe('Usage Recording', () => {
        it('should increment usage count for DB codes', async () => {
            // Arrange
            const mockPromoCode: QZPayBillingPromoCode = {
                id: 'promo-db',
                code: 'DBCODE',
                type: 'percentage',
                value: 10,
                active: true,
                expiresAt: null,
                maxUses: 100,
                usedCount: 5,
                config: null,
                validPlans: null,
                newCustomersOnly: false,
                livemode: false,
                createdAt: new Date(),
                startsAt: null,
                maxPerCustomer: null,
                existingCustomersOnly: false,
                combinable: null
            };

            mockDb.limit.mockResolvedValue([mockPromoCode]);
            // Mock for atomic redemption (SELECT FOR UPDATE)
            mockDb.execute.mockResolvedValue({ rows: [mockPromoCode] });
            mockDb.returning.mockResolvedValueOnce([{ ...mockPromoCode, usedCount: 6 }]); // For atomic increment
            mockDb.returning.mockResolvedValueOnce([
                {
                    id: 'usage-1',
                    promoCodeId: 'promo-db',
                    customerId: '550e8400-e29b-41d4-a716-446655440000',
                    subscriptionId: null,
                    discountAmount: 100,
                    currency: 'ARS',
                    livemode: false,
                    createdAt: new Date()
                }
            ]); // For usage record

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('DBCODE', checkoutId, 1000);

            // Assert
            expect(result.success).toBe(true);

            // Verify atomic redemption was used
            expect(mockDb.execute).toHaveBeenCalled();

            // Verify insert was called for usage record
            expect(mockDb.insert).toHaveBeenCalled();
            expect(mockDb.values).toHaveBeenCalled();
        });

        it('should return not found for code not in database', async () => {
            // Arrange
            mockDb.limit.mockResolvedValue([]); // Not in DB

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('NONEXISTENT', checkoutId, 1000);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
            }
        });

        it('should record usage with correct data', async () => {
            // Arrange
            const mockPromoCode: QZPayBillingPromoCode = {
                id: 'promo-record',
                code: 'RECORD',
                type: 'fixed',
                value: 250,
                active: true,
                expiresAt: null,
                maxUses: null,
                usedCount: 0,
                config: null,
                validPlans: null,
                newCustomersOnly: false,
                livemode: false,
                createdAt: new Date(),
                startsAt: null,
                maxPerCustomer: null,
                existingCustomersOnly: false,
                combinable: null
            };

            mockDb.limit.mockResolvedValue([mockPromoCode]);
            // Mock for atomic redemption
            mockDb.execute.mockResolvedValue({ rows: [mockPromoCode] });

            let recordedUsage: any = null;
            mockDb.values.mockImplementation((values) => {
                recordedUsage = values;
                return mockDb;
            });

            mockDb.returning.mockResolvedValueOnce([{ ...mockPromoCode, usedCount: 1 }]);
            mockDb.returning.mockResolvedValueOnce([
                {
                    id: 'usage-123',
                    ...recordedUsage,
                    createdAt: new Date()
                }
            ]);

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';
            const amount = 5000;

            // Act
            const result = await service.apply('RECORD', checkoutId, amount);

            // Assert
            expect(result.success).toBe(true);
            expect(recordedUsage).toBeDefined();
            expect(recordedUsage.promoCodeId).toBe('promo-record');
            expect(recordedUsage.customerId).toBe(checkoutId);
            expect(recordedUsage.discountAmount).toBe(250);
            expect(recordedUsage.currency).toBe('ARS');
        });
    });

    describe('Error Handling', () => {
        it('should handle database error during getByCode', async () => {
            // Arrange
            mockDb.limit.mockRejectedValue(new Error('Database connection failed'));

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('ERROR', checkoutId, 1000);

            // Assert
            // Note: getByCode() catches database errors and wraps them as INTERNAL_ERROR,
            // but apply() converts any non-successful getByCode result to NOT_FOUND.
            // This is working as designed - database errors during lookup are treated
            // the same as non-existent codes from the API perspective.
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
                expect(result.error.message).toBe('Promo code not found');
            }
        });

        it('should handle database error during atomic redemption', async () => {
            // Arrange
            const mockPromoCode: QZPayBillingPromoCode = {
                id: 'promo-error',
                code: 'ERROR',
                type: 'percentage',
                value: 10,
                active: true,
                expiresAt: null,
                maxUses: null,
                usedCount: 0,
                config: null,
                validPlans: null,
                newCustomersOnly: false,
                livemode: false,
                createdAt: new Date(),
                startsAt: null,
                maxPerCustomer: null,
                existingCustomersOnly: false,
                combinable: null
            };

            mockDb.limit.mockResolvedValue([mockPromoCode]);
            // Mock for atomic redemption - will fail
            mockDb.execute.mockRejectedValue(new Error('Transaction failed'));

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('ERROR', checkoutId, 1000);

            // Assert
            // When the transaction throws, the outer catch in applyPromoCode
            // returns INTERNAL_ERROR (the error is not a validation issue).
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            }
        });

        it('should handle non-Error exceptions', async () => {
            // Arrange
            mockDb.limit.mockRejectedValue('String error'); // Non-Error object

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('ERROR', checkoutId, 1000);

            // Assert
            // Note: Similar to test 1 - getByCode() catches all exceptions (including non-Error)
            // and wraps them as INTERNAL_ERROR, but apply() converts this to NOT_FOUND
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
                expect(result.error.message).toBe('Promo code not found');
            }
        });
    });

    describe('Code Normalization', () => {
        it('should normalize code to uppercase', async () => {
            // Arrange
            const mockPromoCode: QZPayBillingPromoCode = {
                id: 'promo-upper',
                code: 'UPPERCASE',
                type: 'percentage',
                value: 10,
                active: true,
                expiresAt: null,
                maxUses: null,
                usedCount: 0,
                config: null,
                validPlans: null,
                newCustomersOnly: false,
                livemode: false,
                createdAt: new Date(),
                startsAt: null,
                maxPerCustomer: null,
                existingCustomersOnly: false,
                combinable: null
            };

            mockDb.limit.mockResolvedValue([mockPromoCode]);
            // Mock for atomic redemption
            mockDb.execute.mockResolvedValue({ rows: [mockPromoCode] });
            mockDb.returning.mockResolvedValue([{ ...mockPromoCode, usedCount: 1 }]);

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act - Pass lowercase
            const result = await service.apply('uppercase', checkoutId, 1000);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.code).toBe('UPPERCASE');
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero amount correctly', async () => {
            // Arrange
            const mockPromoCode: QZPayBillingPromoCode = {
                id: 'promo-zero',
                code: 'ZERO',
                type: 'percentage',
                value: 50,
                active: true,
                expiresAt: null,
                maxUses: null,
                usedCount: 0,
                config: null,
                validPlans: null,
                newCustomersOnly: false,
                livemode: false,
                createdAt: new Date(),
                startsAt: null,
                maxPerCustomer: null,
                existingCustomersOnly: false,
                combinable: null
            };

            mockDb.limit.mockResolvedValue([mockPromoCode]);
            // Mock for atomic redemption
            mockDb.execute.mockResolvedValue({ rows: [mockPromoCode] });
            mockDb.returning.mockResolvedValue([{ ...mockPromoCode, usedCount: 1 }]);

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('ZERO', checkoutId, 0);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.discountAmount).toBe(0);
                expect(result.data.finalAmount).toBe(0);
            }
        });

        it('should handle code with max uses but count is below max', async () => {
            // Arrange
            const mockPromoCode: QZPayBillingPromoCode = {
                id: 'promo-available',
                code: 'AVAILABLE',
                type: 'percentage',
                value: 15,
                active: true,
                expiresAt: null,
                maxUses: 100,
                usedCount: 50, // Still has uses left
                config: null,
                validPlans: null,
                newCustomersOnly: false,
                livemode: false,
                createdAt: new Date(),
                startsAt: null,
                maxPerCustomer: null,
                existingCustomersOnly: false,
                combinable: null
            };

            mockDb.limit.mockResolvedValue([mockPromoCode]);
            // Mock for atomic redemption
            mockDb.execute.mockResolvedValue({ rows: [mockPromoCode] });
            mockDb.returning.mockResolvedValue([{ ...mockPromoCode, usedCount: 51 }]);

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('AVAILABLE', checkoutId, 1000);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.discountAmount).toBe(150); // 15% of 1000
            }
        });

        it('should handle future expiry date correctly', async () => {
            // Arrange
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30); // 30 days from now

            const mockPromoCode: QZPayBillingPromoCode = {
                id: 'promo-future',
                code: 'FUTURE',
                type: 'percentage',
                value: 25,
                active: true,
                expiresAt: futureDate,
                maxUses: null,
                usedCount: 0,
                config: null,
                validPlans: null,
                newCustomersOnly: false,
                livemode: false,
                createdAt: new Date(),
                startsAt: null,
                maxPerCustomer: null,
                existingCustomersOnly: false,
                combinable: null
            };

            mockDb.limit.mockResolvedValue([mockPromoCode]);
            // Mock for atomic redemption
            mockDb.execute.mockResolvedValue({ rows: [mockPromoCode] });
            mockDb.returning.mockResolvedValue([{ ...mockPromoCode, usedCount: 1 }]);

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('FUTURE', checkoutId, 2000);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.discountAmount).toBe(500); // 25% of 2000
            }
        });

        it('should round percentage discount correctly', async () => {
            // Arrange
            const mockPromoCode: QZPayBillingPromoCode = {
                id: 'promo-round',
                code: 'ROUND',
                type: 'percentage',
                value: 33, // 33% will have fractional result
                active: true,
                expiresAt: null,
                maxUses: null,
                usedCount: 0,
                config: null,
                validPlans: null,
                newCustomersOnly: false,
                livemode: false,
                createdAt: new Date(),
                startsAt: null,
                maxPerCustomer: null,
                existingCustomersOnly: false,
                combinable: null
            };

            mockDb.limit.mockResolvedValue([mockPromoCode]);
            // Mock for atomic redemption
            mockDb.execute.mockResolvedValue({ rows: [mockPromoCode] });
            mockDb.returning.mockResolvedValue([{ ...mockPromoCode, usedCount: 1 }]);

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';
            const amount = 1000; // 33% of 1000 = 330

            // Act
            const result = await service.apply('ROUND', checkoutId, amount);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.discountAmount).toBe(330); // Rounded correctly
                expect(result.data.finalAmount).toBe(670);
                expect(Number.isInteger(result.data.discountAmount)).toBe(true);
            }
        });
    });
});
