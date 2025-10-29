import { PaymentProviderEnum, PaymentStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { PaymentModel } from '../../src/models/invoice/payment.model';

// Define the Payment type for testing
interface Payment {
    id: string;
    invoiceId: string;
    amount: string;
    currency: string;
    provider: string;
    status: string;
    paidAt?: Date | null;
    providerPaymentId?: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdById?: string | null;
    updatedById?: string | null;
    deletedAt?: Date | null;
    deletedById?: string | null;
    adminInfo?: any;
}

// Mock data
const mockPayment: Payment = {
    id: '550e8400-e29b-41d4-a716-446655440020',
    invoiceId: '550e8400-e29b-41d4-a716-446655440001',
    amount: '110.00',
    currency: 'USD',
    provider: PaymentProviderEnum.MERCADO_PAGO,
    status: PaymentStatusEnum.PENDING,
    paidAt: null,
    providerPaymentId: 'mp_123456789',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    createdById: '550e8400-e29b-41d4-a716-446655440000',
    updatedById: '550e8400-e29b-41d4-a716-446655440000',
    deletedAt: null,
    deletedById: null,
    adminInfo: null
};

const mockApprovedPayment: Payment = {
    ...mockPayment,
    id: '550e8400-e29b-41d4-a716-446655440021',
    status: PaymentStatusEnum.APPROVED,
    paidAt: new Date('2024-01-01T10:30:00Z')
};

const mockRejectedPayment: Payment = {
    ...mockPayment,
    id: '550e8400-e29b-41d4-a716-446655440022',
    status: PaymentStatusEnum.REJECTED
};

const mockInvoice = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    clientId: '550e8400-e29b-41d4-a716-446655440002',
    invoiceNumber: 'INV-2024-000001',
    status: 'open',
    totalAmount: '110.00'
};

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

describe('PaymentModel', () => {
    let mockDb: any;
    let paymentModel: PaymentModel;

    beforeEach(() => {
        mockDb = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            values: vi.fn().mockReturnThis(),
            returning: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis()
        };

        vi.mocked(dbUtils.getDb).mockReturnValue(mockDb);
        paymentModel = new PaymentModel();
    });

    describe('processWithProvider', () => {
        it('should create payment successfully', async () => {
            // Mock invoice validation
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([mockInvoice]);

            // Mock payment creation
            mockDb.insert.mockReturnValueOnce(mockDb);
            mockDb.values.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([mockPayment]);

            const result = await paymentModel.processWithProvider({
                invoiceId: mockInvoice.id,
                amount: 110,
                provider: PaymentProviderEnum.MERCADO_PAGO,
                providerPaymentId: 'mp_123456789'
            });

            expect(result).toEqual(mockPayment);
            expect(mockDb.insert).toHaveBeenCalled();
        });

        it('should throw error if invoice not found', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([]);

            await expect(
                paymentModel.processWithProvider({
                    invoiceId: 'nonexistent-id',
                    amount: 110,
                    provider: PaymentProviderEnum.MERCADO_PAGO
                })
            ).rejects.toThrow('INVOICE_NOT_FOUND');
        });
    });

    describe('handleWebhook', () => {
        it('should update payment status from webhook', async () => {
            // Mock find payment by provider ID
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([mockPayment]);

            // Mock update payment
            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([mockApprovedPayment]);

            const result = await paymentModel.handleWebhook(
                'mp_123456789',
                PaymentStatusEnum.APPROVED
            );

            expect(result).toEqual(mockApprovedPayment);
            expect(mockDb.update).toHaveBeenCalled();
        });

        it('should throw error if payment not found', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([]);

            await expect(
                paymentModel.handleWebhook('nonexistent-id', PaymentStatusEnum.APPROVED)
            ).rejects.toThrow('PAYMENT_NOT_FOUND');
        });
    });

    describe('syncStatus', () => {
        it('should sync payment status', async () => {
            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([mockPayment]);

            const result = await paymentModel.syncStatus(mockPayment.id);

            expect(result).toEqual(mockPayment);
            expect(mockDb.update).toHaveBeenCalled();
        });
    });

    describe('findByInvoice', () => {
        it('should find payments by invoice', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.orderBy.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([mockPayment]);

            const result = await paymentModel.findByInvoice(mockInvoice.id);

            expect(result).toEqual([mockPayment]);
        });
    });

    describe('findByProvider', () => {
        it('should find payments by provider', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.orderBy.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([mockPayment]);

            const result = await paymentModel.findByProvider(PaymentProviderEnum.MERCADO_PAGO);

            expect(result).toEqual([mockPayment]);
        });
    });

    describe('findPending', () => {
        it('should find pending payments', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.orderBy.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([mockPayment]);

            const result = await paymentModel.findPending();

            expect(result).toEqual([mockPayment]);
        });
    });

    describe('markApproved', () => {
        it('should mark payment as approved', async () => {
            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([mockApprovedPayment]);

            const result = await paymentModel.markApproved(mockPayment.id);

            expect(result).toEqual(mockApprovedPayment);
            expect(mockDb.update).toHaveBeenCalled();
        });

        it('should mark payment as approved with custom paidAt', async () => {
            const customPaidAt = new Date('2024-01-15T15:30:00Z');
            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([
                {
                    ...mockApprovedPayment,
                    paidAt: customPaidAt
                }
            ]);

            const result = await paymentModel.markApproved(mockPayment.id, customPaidAt);

            expect(result?.paidAt).toEqual(customPaidAt);
        });
    });

    describe('markRejected', () => {
        it('should mark payment as rejected', async () => {
            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([mockRejectedPayment]);

            const result = await paymentModel.markRejected(mockPayment.id, 'Insufficient funds');

            expect(result).toEqual(mockRejectedPayment);
        });
    });

    describe('retryPayment', () => {
        it('should retry rejected payment', async () => {
            // Mock payment status check
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([{ status: PaymentStatusEnum.REJECTED }]);

            // Mock update
            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([
                {
                    ...mockPayment,
                    status: PaymentStatusEnum.PENDING
                }
            ]);

            const result = await paymentModel.retryPayment(mockPayment.id, 'mp_987654321');

            expect(result?.status).toBe(PaymentStatusEnum.PENDING);
        });

        it('should throw error if payment cannot be retried', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([{ status: PaymentStatusEnum.APPROVED }]);

            await expect(paymentModel.retryPayment(mockPayment.id)).rejects.toThrow(
                'PAYMENT_CANNOT_BE_RETRIED'
            );
        });

        it('should throw error if payment not found', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([]);

            await expect(paymentModel.retryPayment('nonexistent-id')).rejects.toThrow(
                'PAYMENT_NOT_FOUND'
            );
        });
    });

    describe('isSuccessful', () => {
        it('should return true for approved payment', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([{ status: PaymentStatusEnum.APPROVED }]);

            const result = await paymentModel.isSuccessful(mockPayment.id);

            expect(result).toBe(true);
        });

        it('should return false for rejected payment', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([{ status: PaymentStatusEnum.REJECTED }]);

            const result = await paymentModel.isSuccessful(mockPayment.id);

            expect(result).toBe(false);
        });

        it('should return false if payment not found', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([]);

            const result = await paymentModel.isSuccessful('nonexistent-id');

            expect(result).toBe(false);
        });
    });

    describe('isPending', () => {
        it('should return true for pending payment', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([{ status: PaymentStatusEnum.PENDING }]);

            const result = await paymentModel.isPending(mockPayment.id);

            expect(result).toBe(true);
        });

        it('should return false for approved payment', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([{ status: PaymentStatusEnum.APPROVED }]);

            const result = await paymentModel.isPending(mockPayment.id);

            expect(result).toBe(false);
        });
    });

    describe('canBeRefunded', () => {
        it('should return true for approved payment', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([
                {
                    status: PaymentStatusEnum.APPROVED,
                    amount: '110.00'
                }
            ]);

            const result = await paymentModel.canBeRefunded(mockPayment.id);

            expect(result).toBe(true);
        });

        it('should return false for rejected payment', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([
                {
                    status: PaymentStatusEnum.REJECTED,
                    amount: '110.00'
                }
            ]);

            const result = await paymentModel.canBeRefunded(mockPayment.id);

            expect(result).toBe(false);
        });
    });

    describe('getTotalSuccessfulForInvoice', () => {
        it('should calculate total successful payments', async () => {
            const successfulPayments = [
                { amount: '110.00', status: PaymentStatusEnum.APPROVED },
                { amount: '50.00', status: PaymentStatusEnum.AUTHORIZED }
            ];

            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(successfulPayments);

            const result = await paymentModel.getTotalSuccessfulForInvoice(mockInvoice.id);

            expect(result).toBe(160);
        });
    });

    describe('withInvoice', () => {
        it('should return payment with invoice data', async () => {
            const joinResult = {
                payments: mockPayment,
                invoices: mockInvoice
            };

            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.innerJoin.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([joinResult]);

            const result = await paymentModel.withInvoice(mockPayment.id);

            expect(result).toEqual({
                ...mockPayment,
                invoice: mockInvoice
            });
        });

        it('should return null if payment not found', async () => {
            mockDb.select.mockReturnValueOnce(mockDb);
            mockDb.from.mockReturnValueOnce(mockDb);
            mockDb.innerJoin.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.limit.mockReturnValueOnce([]);

            const result = await paymentModel.withInvoice('nonexistent-id');

            expect(result).toBeNull();
        });
    });

    describe('cancel', () => {
        it('should cancel payment', async () => {
            const cancelledPayment = {
                ...mockPayment,
                status: PaymentStatusEnum.CANCELLED
            };

            mockDb.update.mockReturnValueOnce(mockDb);
            mockDb.set.mockReturnValueOnce(mockDb);
            mockDb.where.mockReturnValueOnce(mockDb);
            mockDb.returning.mockReturnValueOnce([cancelledPayment]);

            const result = await paymentModel.cancel(mockPayment.id, 'User requested');

            expect(result).toEqual(cancelledPayment);
        });
    });
});
