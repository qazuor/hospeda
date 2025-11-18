import { PriceCurrencyEnum, RefundStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefundModel } from '../../src/models/invoice/refund.model';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

describe('RefundModel', () => {
    let refundModel: RefundModel;
    let mockDb: any;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Create mock with all Drizzle methods returning this for chaining
        mockDb = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            values: vi.fn().mockReturnThis(),
            returning: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis()
        };

        const clientModule = await import('../../src/client');
        vi.mocked(clientModule.getDb).mockReturnValue(mockDb);

        refundModel = new RefundModel();
    });

    describe('Constructor', () => {
        it('should create instance', () => {
            expect(refundModel).toBeInstanceOf(RefundModel);
        });

        it('should have correct table name', () => {
            const tableName = (refundModel as any).getTableName();
            expect(tableName).toBe('refunds');
        });
    });

    describe('processRefund', () => {
        it('should process valid refund', async () => {
            const mockPayment = [
                {
                    id: 'payment-1',
                    amount: '100.00',
                    status: 'approved'
                }
            ];
            const mockRefund = {
                id: 'refund-1',
                paymentId: 'payment-1',
                clientId: 'client-1',
                refundNumber: 'REF-001',
                amount: '50.00',
                currency: PriceCurrencyEnum.USD,
                reason: 'customer_request',
                status: RefundStatusEnum.PENDING
            };

            // First query: get payment
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce(mockPayment);

            // Second query: get total refunded
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce([{ total: '0' }]);

            // Insert refund
            mockDb.insert.mockReturnValueOnce(mockDb);
            mockDb.values.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([mockRefund]);

            const result = await refundModel.processRefund(
                'payment-1',
                'client-1',
                'REF-001',
                50,
                PriceCurrencyEnum.USD,
                'customer_request'
            );

            expect(result).toBeDefined();
            expect(result?.amount).toBe('50.00');
        });

        it('should throw error for non-existent payment', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([]);

            await expect(
                refundModel.processRefund(
                    'non-existent',
                    'client-1',
                    'REF-002',
                    50,
                    PriceCurrencyEnum.USD,
                    'customer_request'
                )
            ).rejects.toThrow('PAYMENT_NOT_FOUND');
        });

        it('should throw error for non-refundable payment status', async () => {
            const mockPayment = [
                {
                    id: 'payment-1',
                    amount: '100.00',
                    status: 'pending'
                }
            ];

            mockDb.select().from().where().limit.mockResolvedValue(mockPayment);

            await expect(
                refundModel.processRefund(
                    'payment-1',
                    'client-1',
                    'REF-003',
                    50,
                    PriceCurrencyEnum.USD,
                    'customer_request'
                )
            ).rejects.toThrow('PAYMENT_NOT_REFUNDABLE');
        });

        it('should throw error for invalid refund amount', async () => {
            const mockPayment = [
                {
                    id: 'payment-1',
                    amount: '100.00',
                    status: 'approved'
                }
            ];

            mockDb.select().from().where().limit.mockResolvedValue(mockPayment);

            await expect(
                refundModel.processRefund(
                    'payment-1',
                    'client-1',
                    'REF-004',
                    0,
                    PriceCurrencyEnum.USD,
                    'customer_request'
                )
            ).rejects.toThrow('INVALID_REFUND_AMOUNT');
        });

        it('should throw error for amount exceeding payment', async () => {
            const mockPayment = [
                {
                    id: 'payment-1',
                    amount: '100.00',
                    status: 'approved'
                }
            ];

            mockDb.select().from().where().limit.mockResolvedValue(mockPayment);

            await expect(
                refundModel.processRefund(
                    'payment-1',
                    'client-1',
                    'REF-005',
                    150,
                    PriceCurrencyEnum.USD,
                    'customer_request'
                )
            ).rejects.toThrow('INVALID_REFUND_AMOUNT');
        });

        it('should throw error if refund exceeds remaining amount', async () => {
            const mockPayment = [
                {
                    id: 'payment-1',
                    amount: '100.00',
                    status: 'approved'
                }
            ];

            mockDb.select().from().where().limit.mockResolvedValue(mockPayment);

            vi.spyOn(refundModel, 'getTotalRefundedForPayment').mockResolvedValue(80);

            await expect(
                refundModel.processRefund(
                    'payment-1',
                    'client-1',
                    'REF-006',
                    30,
                    PriceCurrencyEnum.USD,
                    'customer_request'
                )
            ).rejects.toThrow('REFUND_AMOUNT_EXCEEDS_REMAINING');
        });
    });

    describe('findByPayment', () => {
        it('should find refunds for payment', async () => {
            const mockRefunds = [
                { id: 'refund-1', paymentId: 'payment-1' },
                { id: 'refund-2', paymentId: 'payment-1' }
            ];

            mockDb.select().from().where().orderBy().limit.mockResolvedValue(mockRefunds);

            const result = await refundModel.findByPayment('payment-1');

            expect(result).toHaveLength(2);
        });

        it('should return empty array if no refunds', async () => {
            mockDb.select().from().where().orderBy().limit.mockResolvedValue([]);

            const result = await refundModel.findByPayment('payment-1');

            expect(result).toHaveLength(0);
        });
    });

    describe('calculateRefundable', () => {
        it('should calculate refundable amount correctly', async () => {
            const mockPayment = [{ amount: '100.00' }];

            mockDb.select().from().where().limit.mockResolvedValue(mockPayment);
            vi.spyOn(refundModel, 'getTotalRefundedForPayment').mockResolvedValue(30);

            const result = await refundModel.calculateRefundable('payment-1');

            expect(result).toBe(70);
        });

        it('should return 0 if payment not found', async () => {
            mockDb.select().from().where().limit.mockResolvedValue([]);

            const result = await refundModel.calculateRefundable('non-existent');

            expect(result).toBe(0);
        });

        it('should not return negative amounts', async () => {
            const mockPayment = [{ amount: '100.00' }];

            mockDb.select().from().where().limit.mockResolvedValue(mockPayment);
            vi.spyOn(refundModel, 'getTotalRefundedForPayment').mockResolvedValue(150);

            const result = await refundModel.calculateRefundable('payment-1');

            expect(result).toBe(0);
        });
    });

    describe('getTotalRefundedForPayment', () => {
        it('should calculate total refunded amount', async () => {
            mockDb
                .select()
                .from()
                .where.mockResolvedValue([{ total: '50.00' }]);

            const result = await refundModel.getTotalRefundedForPayment('payment-1');

            expect(result).toBe(50);
        });

        it('should return 0 if no refunds', async () => {
            mockDb
                .select()
                .from()
                .where.mockResolvedValue([{ total: null }]);

            const result = await refundModel.getTotalRefundedForPayment('payment-1');

            expect(result).toBe(0);
        });
    });

    describe('canRefund', () => {
        it('should return true for refundable payment', async () => {
            const mockPayment = [
                {
                    status: 'approved',
                    amount: '100.00'
                }
            ];

            mockDb.select().from().where().limit.mockResolvedValue(mockPayment);

            const result = await refundModel.canRefund('payment-1');

            expect(result).toBe(true);
        });

        it('should return false if payment not found', async () => {
            mockDb.select().from().where().limit.mockResolvedValue([]);

            const result = await refundModel.canRefund('non-existent');

            expect(result).toBe(false);
        });

        it('should return false for non-refundable status', async () => {
            const mockPayment = [
                {
                    status: 'pending',
                    amount: '100.00'
                }
            ];

            mockDb.select().from().where().limit.mockResolvedValue(mockPayment);

            const result = await refundModel.canRefund('payment-1');

            expect(result).toBe(false);
        });

        it('should validate specific amount', async () => {
            const mockPayment = [
                {
                    status: 'approved',
                    amount: '100.00'
                }
            ];

            mockDb.select().from().where().limit.mockResolvedValue(mockPayment);
            vi.spyOn(refundModel, 'calculateRefundable').mockResolvedValue(50);

            const result = await refundModel.canRefund('payment-1', 30);

            expect(result).toBe(true);
        });

        it('should reject amount exceeding refundable', async () => {
            const mockPayment = [
                {
                    status: 'approved',
                    amount: '100.00'
                }
            ];

            mockDb.select().from().where().limit.mockResolvedValue(mockPayment);
            vi.spyOn(refundModel, 'calculateRefundable').mockResolvedValue(50);

            const result = await refundModel.canRefund('payment-1', 70);

            expect(result).toBe(false);
        });
    });

    describe('validateRefundAmount', () => {
        it('should validate positive amounts', async () => {
            vi.spyOn(refundModel, 'calculateRefundable').mockResolvedValue(10000);

            const result = await refundModel.validateRefundAmount('payment-id', 5000);

            expect(result.valid).toBe(true);
        });

        it('should reject negative amounts', async () => {
            const result = await refundModel.validateRefundAmount('payment-id', -1000);

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('AMOUNT_MUST_BE_POSITIVE');
        });

        it('should reject zero amounts', async () => {
            const result = await refundModel.validateRefundAmount('payment-id', 0);

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('AMOUNT_MUST_BE_POSITIVE');
        });

        it('should reject amounts exceeding refundable', async () => {
            vi.spyOn(refundModel, 'calculateRefundable').mockResolvedValue(5000);

            const result = await refundModel.validateRefundAmount('payment-id', 10000);

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('AMOUNT_EXCEEDS_REFUNDABLE');
            expect(result.refundableAmount).toBe(5000);
        });
    });

    describe('checkRefundPolicy', () => {
        it('should allow refund within policy period', async () => {
            const recentDate = new Date();
            recentDate.setDate(recentDate.getDate() - 10);

            mockDb
                .select()
                .from()
                .where()
                .limit.mockResolvedValue([
                    {
                        createdAt: recentDate,
                        status: 'approved'
                    }
                ]);

            const result = await refundModel.checkRefundPolicy('payment-1');

            expect(result.allowed).toBe(true);
        });

        it('should reject if payment not found', async () => {
            mockDb.select().from().where().limit.mockResolvedValue([]);

            const result = await refundModel.checkRefundPolicy('non-existent');

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('PAYMENT_NOT_FOUND');
        });

        it('should reject if payment status not refundable', async () => {
            mockDb
                .select()
                .from()
                .where()
                .limit.mockResolvedValue([
                    {
                        createdAt: new Date(),
                        status: 'pending'
                    }
                ]);

            const result = await refundModel.checkRefundPolicy('payment-1');

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('PAYMENT_STATUS_NOT_REFUNDABLE');
        });

        it('should reject if refund period expired', async () => {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 35);

            mockDb
                .select()
                .from()
                .where()
                .limit.mockResolvedValue([
                    {
                        createdAt: oldDate,
                        status: 'approved'
                    }
                ]);

            const result = await refundModel.checkRefundPolicy('payment-1');

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('REFUND_PERIOD_EXPIRED');
        });
    });

    describe('withPayment', () => {
        it('should return refund with payment data', async () => {
            const mockResult = [
                {
                    refunds: { id: 'refund-1', paymentId: 'payment-1' },
                    payments: { id: 'payment-1', amount: '100.00' }
                }
            ];

            mockDb.select().from().innerJoin = vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue(mockResult)
                })
            });

            const clientModule = await import('../../src/client');
            vi.mocked(clientModule.getDb).mockReturnValue(mockDb);

            const result = await refundModel.withPayment('refund-1');

            expect(result).toBeDefined();
        });

        it('should return null if refund not found', async () => {
            mockDb.select().from().innerJoin = vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([])
                })
            });

            const clientModule = await import('../../src/client');
            vi.mocked(clientModule.getDb).mockReturnValue(mockDb);

            const result = await refundModel.withPayment('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('findByDateRange', () => {
        it('should find refunds within date range', async () => {
            const mockRefunds = [
                { id: 'refund-1', refundedAt: new Date('2024-01-15') },
                { id: 'refund-2', refundedAt: new Date('2024-01-20') }
            ];

            mockDb.select().from().where().orderBy().limit.mockResolvedValue(mockRefunds);

            const result = await refundModel.findByDateRange(
                new Date('2024-01-01'),
                new Date('2024-01-31')
            );

            expect(result).toHaveLength(2);
        });
    });

    describe('getRefundStats', () => {
        it('should return refund statistics', async () => {
            vi.spyOn(refundModel, 'getTotalRefundedForPayment').mockResolvedValue(60);
            vi.spyOn(refundModel, 'calculateRefundable').mockResolvedValue(40);
            vi.spyOn(refundModel, 'findByPayment').mockResolvedValue([
                { id: 'r1' },
                { id: 'r2' }
            ] as any);

            const stats = await refundModel.getRefundStats('payment-1');

            expect(stats.totalRefunded).toBe(60);
            expect(stats.remainingRefundable).toBe(40);
            expect(stats.refundCount).toBe(2);
        });
    });

    describe('reverseRefund', () => {
        it('should reverse refund successfully', async () => {
            const mockReversed = {
                id: 'refund-1',
                deletedAt: new Date()
            };

            mockDb.update().set().where().returning.mockResolvedValue([mockReversed]);

            const result = await refundModel.reverseRefund('refund-1', 'Error in refund');

            expect(result).toBeDefined();
            expect(result?.deletedAt).toBeDefined();
        });

        it('should return null if refund not found', async () => {
            mockDb.update().set().where().returning.mockResolvedValue([]);

            const result = await refundModel.reverseRefund('non-existent');

            expect(result).toBeNull();
        });
    });
});
