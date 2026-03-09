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
 * - Atomic redemption (usage increment, usage recording)
 * - Error handling
 *
 * Mocking strategy: mocks the service sub-modules (promo-code.crud,
 * @repo/db withTransaction) instead of the raw DB query chain.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock variables for service sub-modules
// ---------------------------------------------------------------------------
const { mockGetPromoCodeByCode, mockWithTransaction } = vi.hoisted(() => {
    return {
        mockGetPromoCodeByCode: vi.fn(),
        mockWithTransaction: vi.fn()
    };
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

// Mock the CRUD sub-module (service layer) instead of @repo/db
vi.mock('../../src/services/promo-code.crud', () => ({
    getPromoCodeByCode: mockGetPromoCodeByCode
}));

// Mock @repo/db only for withTransaction (needed by redemption module)
// and drizzle helpers, but NOT for raw query chain (select/from/where/limit)
vi.mock('@repo/db', async () => {
    const actual = await vi.importActual('@repo/db');
    return {
        ...actual,
        getDb: vi.fn(() => ({})),
        withTransaction: mockWithTransaction,
        eq: vi.fn((field, value) => ({ field, value, type: 'eq' })),
        sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
            strings,
            values,
            type: 'sql'
        }))
    };
});

// Mock env
vi.mock('../../src/utils/env', () => ({
    env: {
        NODE_ENV: 'test'
    }
}));

import { PromoCodeService } from '../../src/services/promo-code.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a promo code DTO matching the PromoCode interface returned
 * by getPromoCodeByCode.
 */
function makePromoCode(
    overrides: Partial<{
        id: string;
        code: string;
        type: 'percentage' | 'fixed';
        value: number;
        active: boolean;
        expiresAt: string | null;
        maxUses: number | null;
        timesRedeemed: number;
        validPlans: string[] | null;
        newCustomersOnly: boolean;
        createdAt: string;
        updatedAt: string;
    }> = {}
) {
    return {
        id: 'promo-123',
        code: 'SAVE20',
        type: 'percentage' as const,
        value: 20,
        active: true,
        expiresAt: null,
        maxUses: null,
        timesRedeemed: 0,
        validPlans: null,
        newCustomersOnly: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides
    };
}

/**
 * Configure mockWithTransaction to execute the callback and return success.
 * Simulates a successful atomic redemption (lock + increment + record usage).
 */
function setupSuccessfulRedemption() {
    mockWithTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        // Create a mock transaction object that supports the operations
        // used inside applyPromoCode's withTransaction callback
        const mockTx = {
            execute: vi.fn().mockResolvedValue({
                rows: [{ usedCount: 0, maxUses: null }]
            }),
            update: vi.fn().mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([{}])
                    })
                })
            }),
            insert: vi.fn().mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([{}])
                })
            })
        };
        return callback(mockTx);
    });
}

/**
 * Configure mockWithTransaction to simulate max-uses-exceeded inside
 * the atomic lock path.
 */
function setupMaxUsesExceeded({ usedCount, maxUses }: { usedCount: number; maxUses: number }) {
    mockWithTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
            execute: vi.fn().mockResolvedValue({
                rows: [{ usedCount, maxUses }]
            }),
            update: vi.fn(),
            insert: vi.fn()
        };
        return callback(mockTx);
    });
}

describe('Promo Code Apply Functionality', () => {
    let service: PromoCodeService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new PromoCodeService();
    });

    describe('Valid Discount Calculations', () => {
        it('should apply percentage discount correctly', async () => {
            // Arrange
            const promo = makePromoCode({ code: 'SAVE20', type: 'percentage', value: 20 });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promo });
            setupSuccessfulRedemption();

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
            const promo = makePromoCode({
                id: 'promo-456',
                code: 'FLAT500',
                type: 'fixed',
                value: 500
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promo });
            setupSuccessfulRedemption();

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
            const promo = makePromoCode({
                id: 'promo-789',
                code: 'BIGDISCOUNT',
                type: 'fixed',
                value: 10000
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promo });
            setupSuccessfulRedemption();

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
            const promo = makePromoCode({
                id: 'promo-000',
                code: 'NOAMOUNT',
                type: 'percentage',
                value: 50
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promo });
            setupSuccessfulRedemption();

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

            const promo = makePromoCode({
                id: 'promo-expired',
                code: 'EXPIRED',
                type: 'percentage',
                value: 10,
                expiresAt: expiredDate.toISOString()
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promo });

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
            const promo = makePromoCode({
                id: 'promo-inactive',
                code: 'INACTIVE',
                type: 'percentage',
                value: 10,
                active: false
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promo });

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
            const promo = makePromoCode({
                id: 'promo-maxed',
                code: 'MAXED',
                type: 'percentage',
                value: 10,
                maxUses: 100,
                timesRedeemed: 100
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promo });
            setupMaxUsesExceeded({ usedCount: 100, maxUses: 100 });

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
            mockGetPromoCodeByCode.mockResolvedValue({
                success: false,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Promo code not found' }
            });

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
        it('should call withTransaction for DB codes', async () => {
            // Arrange
            const promo = makePromoCode({
                id: 'promo-db',
                code: 'DBCODE',
                type: 'percentage',
                value: 10,
                maxUses: 100,
                timesRedeemed: 5
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promo });
            setupSuccessfulRedemption();

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('DBCODE', checkoutId, 1000);

            // Assert
            expect(result.success).toBe(true);
            // Verify the service used withTransaction for atomic redemption
            expect(mockWithTransaction).toHaveBeenCalledOnce();
        });

        it('should return not found for code not in database', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: false,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Promo code not found' }
            });

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('NONEXISTENT', checkoutId, 1000);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
            }
        });

        it('should record usage with correct discount amount', async () => {
            // Arrange
            const promo = makePromoCode({
                id: 'promo-record',
                code: 'RECORD',
                type: 'fixed',
                value: 250
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promo });

            let capturedInsertValues: Record<string, unknown> | null = null;
            mockWithTransaction.mockImplementation(
                async (callback: (tx: unknown) => Promise<unknown>) => {
                    const mockTx = {
                        execute: vi.fn().mockResolvedValue({
                            rows: [{ usedCount: 0, maxUses: null }]
                        }),
                        update: vi.fn().mockReturnValue({
                            set: vi.fn().mockReturnValue({
                                where: vi.fn().mockResolvedValue(undefined)
                            })
                        }),
                        insert: vi.fn().mockImplementation(() => ({
                            values: vi
                                .fn()
                                .mockImplementation((values: Record<string, unknown>) => {
                                    capturedInsertValues = values;
                                    return {
                                        returning: vi.fn().mockResolvedValue([{}])
                                    };
                                })
                        }))
                    };
                    return callback(mockTx);
                }
            );

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';
            const amount = 5000;

            // Act
            const result = await service.apply('RECORD', checkoutId, amount);

            // Assert
            expect(result.success).toBe(true);
            expect(capturedInsertValues).toBeDefined();
            expect(capturedInsertValues!.promoCodeId).toBe('promo-record');
            expect(capturedInsertValues!.customerId).toBe(checkoutId);
            expect(capturedInsertValues!.discountAmount).toBe(250);
            expect(capturedInsertValues!.currency).toBe('ARS');
        });
    });

    describe('Error Handling', () => {
        it('should handle service error during getByCode', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Database connection failed'
                }
            });

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('ERROR', checkoutId, 1000);

            // Assert
            // apply() converts any non-successful getByCode result to NOT_FOUND
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.NOT_FOUND);
                expect(result.error.message).toBe('Promo code not found');
            }
        });

        it('should handle transaction error during atomic redemption', async () => {
            // Arrange
            const promo = makePromoCode({
                id: 'promo-error',
                code: 'ERROR',
                type: 'percentage',
                value: 10
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promo });
            // Simulate transaction failure
            mockWithTransaction.mockRejectedValue(new Error('Transaction failed'));

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('ERROR', checkoutId, 1000);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            }
        });

        it('should handle non-Error exceptions', async () => {
            // Arrange
            // When getPromoCodeByCode rejects (throws), applyPromoCode's outer
            // catch block returns INTERNAL_ERROR (not NOT_FOUND).
            mockGetPromoCodeByCode.mockRejectedValue('String error');

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const result = await service.apply('ERROR', checkoutId, 1000);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
                expect(result.error.message).toBe('Failed to apply promo code');
            }
        });
    });

    describe('Code Normalization', () => {
        it('should normalize code to uppercase', async () => {
            // Arrange
            const promo = makePromoCode({
                id: 'promo-upper',
                code: 'UPPERCASE',
                type: 'percentage',
                value: 10
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promo });
            setupSuccessfulRedemption();

            const checkoutId = '550e8400-e29b-41d4-a716-446655440000';

            // Act - Pass lowercase
            const result = await service.apply('uppercase', checkoutId, 1000);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.code).toBe('UPPERCASE');
            }
            // Verify the CRUD service was called with the uppercase code
            expect(mockGetPromoCodeByCode).toHaveBeenCalledWith('UPPERCASE');
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero amount correctly', async () => {
            // Arrange
            const promo = makePromoCode({
                id: 'promo-zero',
                code: 'ZERO',
                type: 'percentage',
                value: 50
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promo });
            setupSuccessfulRedemption();

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
            const promo = makePromoCode({
                id: 'promo-available',
                code: 'AVAILABLE',
                type: 'percentage',
                value: 15,
                maxUses: 100,
                timesRedeemed: 50
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promo });
            setupSuccessfulRedemption();

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

            const promo = makePromoCode({
                id: 'promo-future',
                code: 'FUTURE',
                type: 'percentage',
                value: 25,
                expiresAt: futureDate.toISOString()
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promo });
            setupSuccessfulRedemption();

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
            const promo = makePromoCode({
                id: 'promo-round',
                code: 'ROUND',
                type: 'percentage',
                value: 33
            });
            mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: promo });
            setupSuccessfulRedemption();

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
