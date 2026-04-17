import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @repo/db before importing the module under test
vi.mock('@repo/db', () => ({
    billingPromoCodes: { usedCount: 'usedCount', id: 'id' },
    billingPromoCodeUsage: {},
    eq: vi.fn(),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        strings,
        values,
        _type: 'sql'
    })),
    getDb: vi.fn(),
    withTransaction: vi.fn()
}));

vi.mock('../../src/services/billing/promo-code/promo-code.crud.js', () => ({
    getPromoCodeByCode: vi.fn()
}));

import * as dbModule from '@repo/db';
import * as promoCrudModule from '../../src/services/billing/promo-code/promo-code.crud.js';
import {
    applyPromoCode,
    incrementPromoCodeUsage,
    recordPromoCodeUsage,
    tryRedeemAtomically
} from '../../src/services/billing/promo-code/promo-code.redemption.js';

const mockWithTransaction = dbModule.withTransaction as ReturnType<typeof vi.fn>;
const mockGetDb = dbModule.getDb as ReturnType<typeof vi.fn>;
const mockGetPromoCodeByCode = promoCrudModule.getPromoCodeByCode as ReturnType<typeof vi.fn>;

describe('promo-code.redemption', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ──────────────────────────────────────────────────────────────────────────
    // tryRedeemAtomically
    // ──────────────────────────────────────────────────────────────────────────

    describe('tryRedeemAtomically', () => {
        it('should return success when promo code is found and under max uses', async () => {
            // Arrange
            const updatedCode = {
                id: 'pc1',
                code: 'SAVE10',
                usedCount: 1,
                maxUses: 10,
                active: true
            };
            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = {
                        execute: vi.fn().mockResolvedValue({
                            rows: [{ id: 'pc1', usedCount: 0, maxUses: 10 }]
                        }),
                        update: vi.fn().mockReturnValue({
                            set: vi.fn().mockReturnValue({
                                where: vi.fn().mockReturnValue({
                                    returning: vi.fn().mockResolvedValue([updatedCode])
                                })
                            })
                        })
                    };
                    return fn(tx);
                }
            );

            // Act
            const result = await tryRedeemAtomically('pc1');

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toEqual(updatedCode);
        });

        it('should return failure when promo code is not found', async () => {
            // Arrange
            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = {
                        execute: vi.fn().mockResolvedValue({ rows: [] })
                    };
                    return fn(tx);
                }
            );

            // Act
            const result = await tryRedeemAtomically('pc-missing');

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NOT_FOUND');
        });

        it('should return failure when max uses is reached', async () => {
            // Arrange
            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = {
                        execute: vi.fn().mockResolvedValue({
                            rows: [{ id: 'pc1', usedCount: 5, maxUses: 5 }]
                        })
                    };
                    return fn(tx);
                }
            );

            // Act
            const result = await tryRedeemAtomically('pc1');

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('PROMO_CODE_MAX_USES');
        });

        it('should return failure when transaction throws', async () => {
            // Arrange
            mockWithTransaction.mockRejectedValue(new Error('db failure'));

            // Act
            const result = await tryRedeemAtomically('pc1');

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });

        it('should succeed when maxUses is null (unlimited)', async () => {
            // Arrange
            const updatedCode = { id: 'pc1', code: 'FREE', usedCount: 1, maxUses: null };
            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = {
                        execute: vi.fn().mockResolvedValue({
                            rows: [{ id: 'pc1', usedCount: 99, maxUses: null }]
                        }),
                        update: vi.fn().mockReturnValue({
                            set: vi.fn().mockReturnValue({
                                where: vi.fn().mockReturnValue({
                                    returning: vi.fn().mockResolvedValue([updatedCode])
                                })
                            })
                        })
                    };
                    return fn(tx);
                }
            );

            // Act
            const result = await tryRedeemAtomically('pc1');

            // Assert
            expect(result.success).toBe(true);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // incrementPromoCodeUsage
    // ──────────────────────────────────────────────────────────────────────────

    describe('incrementPromoCodeUsage', () => {
        it('should return success when code is found and updated', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            returning: vi.fn().mockResolvedValue([{ id: 'pc1', usedCount: 2 }])
                        })
                    })
                })
            });

            // Act
            const result = await incrementPromoCodeUsage('pc1');

            // Assert
            expect(result.success).toBe(true);
        });

        it('should return failure when code is not found', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            returning: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            });

            // Act
            const result = await incrementPromoCodeUsage('pc-missing');

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NOT_FOUND');
        });

        it('should return failure when db throws', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            returning: vi.fn().mockRejectedValue(new Error('db failure'))
                        })
                    })
                })
            });

            // Act
            const result = await incrementPromoCodeUsage('pc1');

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });

        it('should use ctx.tx instead of getDb when ctx is provided', async () => {
            // Arrange
            const txUpdate = vi.fn().mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([{ id: 'pc1', usedCount: 3 }])
                    })
                })
            });
            const mockTx = { update: txUpdate };

            // Act
            const result = await incrementPromoCodeUsage('pc1', { tx: mockTx as never });

            // Assert
            expect(result.success).toBe(true);
            // getDb should NOT have been called — ctx.tx was used instead
            expect(mockGetDb).not.toHaveBeenCalled();
            expect(txUpdate).toHaveBeenCalled();
        });

        it('should fall back to getDb when ctx is provided but tx is undefined', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            returning: vi.fn().mockResolvedValue([{ id: 'pc1', usedCount: 2 }])
                        })
                    })
                })
            });

            // Act
            const result = await incrementPromoCodeUsage('pc1', {});

            // Assert
            expect(result.success).toBe(true);
            expect(mockGetDb).toHaveBeenCalledOnce();
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // recordPromoCodeUsage
    // ──────────────────────────────────────────────────────────────────────────

    describe('recordPromoCodeUsage', () => {
        it('should create usage record and return success', async () => {
            // Arrange
            const usageRecord = { id: 'u1', promoCodeId: 'pc1', customerId: 'cust1' };
            mockGetDb.mockReturnValue({
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([usageRecord])
                    })
                })
            });

            // Act
            const result = await recordPromoCodeUsage({
                promoCodeId: 'pc1',
                customerId: 'cust1',
                discountAmount: 500,
                currency: 'ARS'
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toEqual(usageRecord);
        });

        it('should return failure when insert returns empty', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([])
                    })
                })
            });

            // Act
            const result = await recordPromoCodeUsage({
                promoCodeId: 'pc1',
                customerId: 'cust1',
                discountAmount: 500,
                currency: 'ARS'
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });

        it('should use ctx.tx instead of getDb when ctx is provided', async () => {
            // Arrange
            const usageRecord = { id: 'u1', promoCodeId: 'pc1', customerId: 'cust1' };
            const txInsert = vi.fn().mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([usageRecord])
                })
            });
            const mockTx = { insert: txInsert };

            // Act
            const result = await recordPromoCodeUsage(
                {
                    promoCodeId: 'pc1',
                    customerId: 'cust1',
                    discountAmount: 500,
                    currency: 'ARS'
                },
                { tx: mockTx as never }
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toEqual(usageRecord);
            // getDb should NOT have been called — ctx.tx was used instead
            expect(mockGetDb).not.toHaveBeenCalled();
            expect(txInsert).toHaveBeenCalled();
        });

        it('should fall back to getDb when ctx is provided but tx is undefined', async () => {
            // Arrange
            const usageRecord = { id: 'u1', promoCodeId: 'pc1', customerId: 'cust1' };
            mockGetDb.mockReturnValue({
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([usageRecord])
                    })
                })
            });

            // Act
            const result = await recordPromoCodeUsage(
                {
                    promoCodeId: 'pc1',
                    customerId: 'cust1',
                    discountAmount: 500,
                    currency: 'ARS'
                },
                {}
            );

            // Assert
            expect(result.success).toBe(true);
            expect(mockGetDb).toHaveBeenCalledOnce();
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // applyPromoCode
    // ──────────────────────────────────────────────────────────────────────────

    describe('applyPromoCode', () => {
        it('should return failure when promo code is not found', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({ success: false });

            // Act
            const result = await applyPromoCode('INVALID', 'cust1', 5000);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NOT_FOUND');
        });

        it('should return failure when promo code is inactive', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: true,
                data: {
                    id: 'pc1',
                    code: 'SAVE10',
                    type: 'percentage',
                    value: 10,
                    active: false
                }
            });

            // Act
            const result = await applyPromoCode('SAVE10', 'cust1', 5000);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('should return failure when promo code is expired', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: true,
                data: {
                    id: 'pc1',
                    code: 'OLD10',
                    type: 'percentage',
                    value: 10,
                    active: true,
                    expiresAt: new Date('2000-01-01').toISOString()
                }
            });

            // Act
            const result = await applyPromoCode('OLD10', 'cust1', 5000);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('should compute percentage discount and return success', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: true,
                data: {
                    id: 'pc1',
                    code: 'SAVE10',
                    type: 'percentage',
                    value: 10,
                    active: true,
                    expiresAt: null
                }
            });
            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = {
                        execute: vi.fn().mockResolvedValue({
                            rows: [{ id: 'pc1', usedCount: 0, maxUses: null, expiresAt: null }]
                        }),
                        update: vi.fn().mockReturnValue({
                            set: vi.fn().mockReturnValue({
                                where: vi.fn().mockResolvedValue([])
                            })
                        }),
                        insert: vi.fn().mockReturnValue({
                            values: vi.fn().mockResolvedValue([])
                        })
                    };
                    return fn(tx);
                }
            );

            // Act
            const result = await applyPromoCode('SAVE10', 'cust1', 5000);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.discountAmount).toBe(500);
                expect(result.data.finalAmount).toBe(4500);
                expect(result.data.originalAmount).toBe(5000);
            }
        });

        it('should compute fixed discount and cap at original amount', async () => {
            // Arrange
            mockGetPromoCodeByCode.mockResolvedValue({
                success: true,
                data: {
                    id: 'pc2',
                    code: 'FLAT200',
                    type: 'fixed',
                    value: 200,
                    active: true,
                    expiresAt: null
                }
            });
            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = {
                        execute: vi.fn().mockResolvedValue({
                            rows: [{ id: 'pc2', usedCount: 0, maxUses: null, expiresAt: null }]
                        }),
                        update: vi.fn().mockReturnValue({
                            set: vi.fn().mockReturnValue({
                                where: vi.fn().mockResolvedValue([])
                            })
                        }),
                        insert: vi.fn().mockReturnValue({
                            values: vi.fn().mockResolvedValue([])
                        })
                    };
                    return fn(tx);
                }
            );

            // Act
            const result = await applyPromoCode('FLAT200', 'cust1', 100);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                // discount is capped at original amount (100), so finalAmount = 0
                expect(result.data.discountAmount).toBe(100);
                expect(result.data.finalAmount).toBe(0);
            }
        });
    });
});
