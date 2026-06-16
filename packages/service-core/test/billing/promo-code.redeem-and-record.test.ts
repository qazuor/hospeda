/**
 * Unit tests for redeemAndRecordUsage() from promo-code.redemption.ts
 *
 * Covers the main uncovered paths:
 * - Happy path: increments usage + inserts usage record in single transaction
 * - NOT_FOUND when promo code does not exist
 * - PROMO_CODE_MAX_USES when global usedCount >= maxUses
 * - PROMO_CODE_MAX_USES_PER_CUSTOMER when per-customer limit is exceeded
 * - Accepts outer tx (does not open a new transaction)
 * - Opens its own transaction when no outerTx is provided
 * - INTERNAL_ERROR on db failure
 * - Returns correct promoCode + usageRecord in success data
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks (must be declared before imports) ────────────────────────

vi.mock('@repo/db', () => ({
    billingPromoCodes: { usedCount: 'usedCount', id: 'id', maxUses: 'maxUses' },
    billingPromoCodeUsage: { id: 'id', promoCodeId: 'promoCodeId', customerId: 'customerId' },
    eq: vi.fn((col: unknown, val: unknown) => ({ _eq: { col, val } })),
    count: vi.fn(() => ({ _count: true })),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        _sql: { strings, values }
    })),
    getDb: vi.fn(),
    withTransaction: vi.fn()
}));

vi.mock('../../src/services/billing/promo-code/promo-code.crud.js', () => ({
    getPromoCodeByCode: vi.fn()
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────

import * as dbModule from '@repo/db';
import { redeemAndRecordUsage } from '../../src/services/billing/promo-code/promo-code.redemption.js';

const mockWithTransaction = dbModule.withTransaction as ReturnType<typeof vi.fn>;

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Builds a mock promo code row.
 */
function makePromoCodeRow(
    overrides: Partial<{
        id: string;
        code: string;
        usedCount: number;
        maxUses: number | null;
        maxPerCustomer: number | null;
        active: boolean;
    }> = {}
) {
    return {
        id: overrides.id ?? 'pc-uuid-1',
        code: overrides.code ?? 'SAVE10',
        usedCount: overrides.usedCount ?? 0,
        maxUses: overrides.maxUses !== undefined ? overrides.maxUses : null,
        maxPerCustomer: overrides.maxPerCustomer !== undefined ? overrides.maxPerCustomer : null,
        active: overrides.active ?? true,
        type: 'percentage',
        value: 10,
        expiresAt: null
    };
}

/**
 * Builds a mock tx for the happy path of redeemAndRecordUsage.
 *
 * The function inside the transaction does (in order):
 * 1. tx.select().from().where().for('update')  → [lockedRow]  (FOR UPDATE lock)
 * 2. tx.select().from().where()               → [{ total: customerUseCount }] (per-customer count, only if maxPerCustomer is set)
 * 3. tx.update().set().where().returning()    → [updatedCode]
 * 4. tx.insert().values().returning({ id })   → [usageRecord]
 */
function buildHappyPathTx(options: {
    lockedRow: ReturnType<typeof makePromoCodeRow>;
    updatedCode: ReturnType<typeof makePromoCodeRow>;
    usageRecord: { id: string };
    customerUseCount?: number;
}) {
    const { lockedRow, updatedCode, usageRecord, customerUseCount = 0 } = options;

    let selectCallIdx = 0;

    return {
        select: vi.fn().mockImplementation(() => {
            const idx = selectCallIdx++;
            if (idx === 0) {
                // FOR UPDATE lock
                return {
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            for: vi.fn().mockResolvedValue([lockedRow])
                        })
                    })
                };
            }
            // Per-customer count query (only reached when maxPerCustomer is set)
            return {
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ total: customerUseCount }])
                })
            };
        }),
        update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([updatedCode])
                })
            })
        }),
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([usageRecord])
            })
        })
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('redeemAndRecordUsage()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when no outerTx is provided', () => {
        it('should open a new transaction and return success on happy path', async () => {
            // Arrange
            const lockedRow = makePromoCodeRow({ usedCount: 2, maxUses: 10 });
            const updatedCode = makePromoCodeRow({ usedCount: 3, maxUses: 10 });
            const usageRecord = { id: 'usage-uuid-1' };

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    return fn(buildHappyPathTx({ lockedRow, updatedCode, usageRecord }));
                }
            );

            // Act
            const result = await redeemAndRecordUsage({
                promoCodeId: 'pc-uuid-1',
                customerId: 'cust-abc',
                discountAmount: 500,
                currency: 'ARS',
                livemode: false
            });

            // Assert
            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.promoCode.usedCount).toBe(3);
            expect(result.data.usageRecord.id).toBe('usage-uuid-1');
            expect(mockWithTransaction).toHaveBeenCalledOnce();
        });

        it('should return NOT_FOUND when promo code does not exist', async () => {
            // Arrange — FOR UPDATE returns empty array
            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = {
                        select: vi.fn().mockReturnValue({
                            from: vi.fn().mockReturnValue({
                                where: vi.fn().mockReturnValue({
                                    for: vi.fn().mockResolvedValue([]) // empty
                                })
                            })
                        })
                    };
                    return fn(tx);
                }
            );

            // Act
            const result = await redeemAndRecordUsage({
                promoCodeId: 'missing-pc-uuid',
                customerId: 'cust-abc',
                discountAmount: 0,
                currency: 'ARS'
            });

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('NOT_FOUND');
        });

        it('should return PROMO_CODE_MAX_USES when usedCount >= maxUses', async () => {
            // Arrange — usedCount is already at the limit
            const lockedRow = makePromoCodeRow({ usedCount: 5, maxUses: 5 });

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    const tx = {
                        select: vi.fn().mockReturnValue({
                            from: vi.fn().mockReturnValue({
                                where: vi.fn().mockReturnValue({
                                    for: vi.fn().mockResolvedValue([lockedRow])
                                })
                            })
                        })
                    };
                    return fn(tx);
                }
            );

            // Act
            const result = await redeemAndRecordUsage({
                promoCodeId: 'pc-uuid-1',
                customerId: 'cust-abc',
                discountAmount: 100,
                currency: 'ARS'
            });

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('PROMO_CODE_MAX_USES');
        });

        it('should allow redemption when maxUses is null (unlimited)', async () => {
            // Arrange — unlimited code
            const lockedRow = makePromoCodeRow({ usedCount: 9999, maxUses: null });
            const updatedCode = makePromoCodeRow({ usedCount: 10000, maxUses: null });
            const usageRecord = { id: 'usage-uuid-2' };

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    return fn(buildHappyPathTx({ lockedRow, updatedCode, usageRecord }));
                }
            );

            // Act
            const result = await redeemAndRecordUsage({
                promoCodeId: 'pc-uuid-1',
                customerId: 'cust-xyz',
                discountAmount: 200,
                currency: 'ARS'
            });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should return PROMO_CODE_MAX_USES_PER_CUSTOMER when per-customer limit is exceeded', async () => {
            // Arrange — customer already used the code once, maxPerCustomer = 1
            const lockedRow = makePromoCodeRow({ usedCount: 3, maxUses: null, maxPerCustomer: 1 });

            mockWithTransaction.mockImplementation(
                async (fn: (tx: unknown) => Promise<unknown>) => {
                    let selectCallIdx = 0;
                    const tx = {
                        select: vi.fn().mockImplementation(() => {
                            const idx = selectCallIdx++;
                            if (idx === 0) {
                                // First call: FOR UPDATE lock
                                return {
                                    from: vi.fn().mockReturnValue({
                                        where: vi.fn().mockReturnValue({
                                            for: vi.fn().mockResolvedValue([lockedRow])
                                        })
                                    })
                                };
                            }
                            // Second call: per-customer count — customer already used once
                            return {
                                from: vi.fn().mockReturnValue({
                                    where: vi.fn().mockResolvedValue([{ total: 1 }])
                                })
                            };
                        })
                    };
                    return fn(tx);
                }
            );

            // Act
            const result = await redeemAndRecordUsage({
                promoCodeId: 'pc-uuid-1',
                customerId: 'cust-already-used',
                discountAmount: 100,
                currency: 'ARS'
            });

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('PROMO_CODE_MAX_USES_PER_CUSTOMER');
        });

        it('should return INTERNAL_ERROR when withTransaction throws', async () => {
            // Arrange
            mockWithTransaction.mockRejectedValue(new Error('Transaction failed'));

            // Act
            const result = await redeemAndRecordUsage({
                promoCodeId: 'pc-uuid-1',
                customerId: 'cust-abc',
                discountAmount: 100,
                currency: 'ARS'
            });

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('INTERNAL_ERROR');
        });
    });

    describe('when outerTx is provided', () => {
        it('should enlist in the outer transaction and NOT call withTransaction', async () => {
            // Arrange
            const lockedRow = makePromoCodeRow({ usedCount: 0, maxUses: null });
            const updatedCode = makePromoCodeRow({ usedCount: 1, maxUses: null });
            const usageRecord = { id: 'usage-uuid-3' };
            const outerTx = buildHappyPathTx({ lockedRow, updatedCode, usageRecord });

            // Act
            const result = await redeemAndRecordUsage({
                promoCodeId: 'pc-uuid-1',
                customerId: 'cust-abc',
                discountAmount: 300,
                currency: 'ARS',
                livemode: true,
                tx: outerTx as unknown as NonNullable<import('@repo/db').QueryContext['tx']>
            });

            // Assert
            expect(result.success).toBe(true);
            expect(mockWithTransaction).not.toHaveBeenCalled();
            if (!result.success) return;
            expect(result.data.usageRecord.id).toBe('usage-uuid-3');
        });

        it('should return NOT_FOUND when promo code is not found inside outer tx', async () => {
            // Arrange
            const outerTx = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            for: vi.fn().mockResolvedValue([]) // empty
                        })
                    })
                })
            };

            // Act
            const result = await redeemAndRecordUsage({
                promoCodeId: 'missing-pc',
                customerId: 'cust-abc',
                discountAmount: 0,
                currency: 'ARS',
                tx: outerTx as unknown as NonNullable<import('@repo/db').QueryContext['tx']>
            });

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.code).toBe('NOT_FOUND');
            expect(mockWithTransaction).not.toHaveBeenCalled();
        });

        it('should pass subscriptionId to the usage record insert', async () => {
            // Arrange
            const lockedRow = makePromoCodeRow({ usedCount: 0 });
            const updatedCode = makePromoCodeRow({ usedCount: 1 });
            const usageRecord = { id: 'usage-uuid-4' };
            const capturedInsertValues: unknown[] = [];

            const outerTx = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            for: vi.fn().mockResolvedValue([lockedRow])
                        })
                    })
                }),
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            returning: vi.fn().mockResolvedValue([updatedCode])
                        })
                    })
                }),
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockImplementation((vals: unknown) => {
                        capturedInsertValues.push(vals);
                        return {
                            returning: vi.fn().mockResolvedValue([usageRecord])
                        };
                    })
                })
            };

            // Act
            const result = await redeemAndRecordUsage({
                promoCodeId: 'pc-uuid-1',
                customerId: 'cust-abc',
                subscriptionId: 'sub-uuid-999',
                discountAmount: 500,
                currency: 'ARS',
                tx: outerTx as unknown as NonNullable<import('@repo/db').QueryContext['tx']>
            });

            // Assert
            expect(result.success).toBe(true);
            const insertedValues = capturedInsertValues[0] as Record<string, unknown> | undefined;
            expect(insertedValues?.subscriptionId).toBe('sub-uuid-999');
        });

        it('should default currency to ARS when not provided', async () => {
            // Arrange
            const lockedRow = makePromoCodeRow({ usedCount: 0 });
            const updatedCode = makePromoCodeRow({ usedCount: 1 });
            const usageRecord = { id: 'usage-uuid-5' };
            const capturedInsertValues: unknown[] = [];

            const outerTx = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            for: vi.fn().mockResolvedValue([lockedRow])
                        })
                    })
                }),
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            returning: vi.fn().mockResolvedValue([updatedCode])
                        })
                    })
                }),
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockImplementation((vals: unknown) => {
                        capturedInsertValues.push(vals);
                        return {
                            returning: vi.fn().mockResolvedValue([usageRecord])
                        };
                    })
                })
            };

            // Act
            const result = await redeemAndRecordUsage({
                promoCodeId: 'pc-uuid-1',
                customerId: 'cust-abc',
                discountAmount: 100,
                // currency intentionally omitted
                tx: outerTx as unknown as NonNullable<import('@repo/db').QueryContext['tx']>
            });

            // Assert
            expect(result.success).toBe(true);
            const insertedValues = capturedInsertValues[0] as Record<string, unknown> | undefined;
            expect(insertedValues?.currency).toBe('ARS');
        });
    });
});
