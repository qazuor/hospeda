import type { PaymentModel } from '@repo/db';
import {
    type Payment,
    PaymentProviderEnum,
    PaymentStatusEnum,
    PermissionEnum,
    RoleEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentService } from '../../../src/services/payment/payment.service.js';
import type { Actor } from '../../../src/types/index.js';

describe('PaymentService', () => {
    let service: PaymentService;
    let mockModel: PaymentModel;
    let mockActor: Actor;
    let ctx: import('../../../src/types/index.js').ServiceContext;

    // Mock data
    const mockPayment: Payment = {
        id: '00000000-0000-0000-0000-000000000001',
        invoiceId: '00000000-0000-0000-0000-000000000002',
        amount: '100.00',
        currency: 'USD',
        provider: PaymentProviderEnum.MERCADO_PAGO,
        status: PaymentStatusEnum.PENDING,
        providerPaymentId: 'mp-12345',
        paidAt: undefined,
        metadata: undefined,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        createdById: '',
        updatedById: '',
        deletedAt: undefined,
        deletedById: undefined
    };

    beforeEach(() => {
        ctx = {
            logger: {
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn()
            }
        } as unknown as import('../../../src/types/index.js').ServiceContext;

        mockActor = {
            id: '00000000-0000-0000-0000-000000000100',
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.CLIENT_UPDATE]
        };

        mockModel = {
            processWithProvider: vi.fn(),
            handleWebhook: vi.fn(),
            syncStatus: vi.fn(),
            findByInvoice: vi.fn(),
            findByProvider: vi.fn(),
            findPending: vi.fn(),
            markApproved: vi.fn(),
            markRejected: vi.fn(),
            retryPayment: vi.fn(),
            isSuccessful: vi.fn(),
            isPending: vi.fn(),
            canBeRefunded: vi.fn(),
            getTotalSuccessfulForInvoice: vi.fn(),
            withInvoice: vi.fn(),
            cancel: vi.fn()
        } as unknown as PaymentModel;

        service = new PaymentService(ctx, mockModel);
    });

    // =========================================================================
    // processWithProvider
    // =========================================================================

    describe('processWithProvider', () => {
        it('should process payment with provider', async () => {
            const data = {
                invoiceId: '00000000-0000-0000-0000-000000000002',
                amount: 100,
                currency: 'USD',
                provider: PaymentProviderEnum.MERCADO_PAGO,
                providerPaymentId: 'mp-12345'
            };

            vi.mocked(mockModel.processWithProvider).mockResolvedValue(mockPayment);

            const result = await service.processWithProvider(mockActor, data);

            expect(result.data).toEqual(mockPayment);
            expect(result.error).toBeUndefined();
            expect(mockModel.processWithProvider).toHaveBeenCalledWith(data);
        });

        it('should return null when invoice not found', async () => {
            const data = {
                invoiceId: 'nonexistent',
                amount: 100,
                currency: 'USD',
                provider: PaymentProviderEnum.MERCADO_PAGO
            };

            vi.mocked(mockModel.processWithProvider).mockRejectedValue(
                new Error('INVOICE_NOT_FOUND')
            );

            const result = await service.processWithProvider(mockActor, data);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('NOT_FOUND');
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.processWithProvider(
                actorWithoutPermission,
                {
                    invoiceId: 'invoice-id',
                    amount: 100,
                    currency: 'USD',
                    provider: PaymentProviderEnum.MERCADO_PAGO
                }
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // handleWebhook
    // =========================================================================

    describe('handleWebhook', () => {
        it('should handle webhook from payment provider', async () => {
            const providerPaymentId = 'mp-12345';
            const newStatus = PaymentStatusEnum.APPROVED;
            const webhookData = { status: 'approved', payment_id: 'mp-12345' };

            const approvedPayment: Payment = {
                ...mockPayment,
                status: PaymentStatusEnum.APPROVED,
                paidAt: new Date('2025-01-15')
            };

            vi.mocked(mockModel.handleWebhook).mockResolvedValue(approvedPayment);

            const result = await service.handleWebhook(
                mockActor,
                providerPaymentId,
                newStatus,
                webhookData
            );

            expect(result.data).toEqual(approvedPayment);
            expect(mockModel.handleWebhook).toHaveBeenCalledWith(
                providerPaymentId,
                newStatus,
                webhookData
            );
        });

        it('should return error when payment not found', async () => {
            const providerPaymentId = 'nonexistent';
            const newStatus = PaymentStatusEnum.APPROVED;

            vi.mocked(mockModel.handleWebhook).mockRejectedValue(new Error('PAYMENT_NOT_FOUND'));

            const result = await service.handleWebhook(mockActor, providerPaymentId, newStatus);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('NOT_FOUND');
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.handleWebhook(
                actorWithoutPermission,
                'mp-12345',
                PaymentStatusEnum.APPROVED
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // syncStatus
    // =========================================================================

    describe('syncStatus', () => {
        it('should sync payment status with provider', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';

            vi.mocked(mockModel.syncStatus).mockResolvedValue(mockPayment);

            const result = await service.syncStatus(mockActor, paymentId);

            expect(result.data).toEqual(mockPayment);
            expect(mockModel.syncStatus).toHaveBeenCalledWith(paymentId);
        });

        it('should return null when payment not found', async () => {
            const paymentId = 'nonexistent';

            vi.mocked(mockModel.syncStatus).mockResolvedValue(null);

            const result = await service.syncStatus(mockActor, paymentId);

            expect(result.data).toBeNull();
            expect(result.error).toBeUndefined();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.syncStatus(
                actorWithoutPermission,
                'payment-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findByInvoice
    // =========================================================================

    describe('findByInvoice', () => {
        it('should find payments by invoice', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000002';
            const mockPayments: Payment[] = [mockPayment];

            vi.mocked(mockModel.findByInvoice).mockResolvedValue(mockPayments);

            const result = await service.findByInvoice(mockActor, invoiceId);

            expect(result.data).toEqual(mockPayments);
            expect(mockModel.findByInvoice).toHaveBeenCalledWith(invoiceId);
        });

        it('should return empty array when no payments found', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000002';

            vi.mocked(mockModel.findByInvoice).mockResolvedValue([]);

            const result = await service.findByInvoice(mockActor, invoiceId);

            expect(result.data).toEqual([]);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.findByInvoice(
                actorWithoutPermission,
                'invoice-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findByProvider
    // =========================================================================

    describe('findByProvider', () => {
        it('should find payments by provider', async () => {
            const provider = PaymentProviderEnum.MERCADO_PAGO;
            const mockPayments: Payment[] = [mockPayment];

            vi.mocked(mockModel.findByProvider).mockResolvedValue(mockPayments);

            const result = await service.findByProvider(mockActor, provider);

            expect(result.data).toEqual(mockPayments);
            expect(mockModel.findByProvider).toHaveBeenCalledWith(provider);
        });

        it('should return empty array when no payments found', async () => {
            const provider = PaymentProviderEnum.STRIPE;

            vi.mocked(mockModel.findByProvider).mockResolvedValue([]);

            const result = await service.findByProvider(mockActor, provider);

            expect(result.data).toEqual([]);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.findByProvider(
                actorWithoutPermission,
                PaymentProviderEnum.MERCADO_PAGO
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findPending
    // =========================================================================

    describe('findPending', () => {
        it('should find pending payments', async () => {
            const mockPayments: Payment[] = [mockPayment];

            vi.mocked(mockModel.findPending).mockResolvedValue(mockPayments);

            const result = await service.findPending(mockActor);

            expect(result.data).toEqual(mockPayments);
            expect(mockModel.findPending).toHaveBeenCalled();
        });

        it('should return empty array when no pending payments', async () => {
            vi.mocked(mockModel.findPending).mockResolvedValue([]);

            const result = await service.findPending(mockActor);

            expect(result.data).toEqual([]);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.findPending(actorWithoutPermission);

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // markApproved
    // =========================================================================

    describe('markApproved', () => {
        it('should mark payment as approved', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';
            const paidAt = new Date('2025-01-15');

            const approvedPayment: Payment = {
                ...mockPayment,
                status: PaymentStatusEnum.APPROVED,
                paidAt
            };

            vi.mocked(mockModel.markApproved).mockResolvedValue(approvedPayment);

            const result = await service.markApproved(mockActor, paymentId, paidAt);

            expect(result.data).toEqual(approvedPayment);
            expect(mockModel.markApproved).toHaveBeenCalledWith(paymentId, paidAt);
        });

        it('should mark payment as approved with current date if not provided', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';

            const approvedPayment: Payment = {
                ...mockPayment,
                status: PaymentStatusEnum.APPROVED,
                paidAt: new Date()
            };

            vi.mocked(mockModel.markApproved).mockResolvedValue(approvedPayment);

            const result = await service.markApproved(mockActor, paymentId);

            expect(result.data).toEqual(approvedPayment);
            expect(mockModel.markApproved).toHaveBeenCalled();
        });

        it('should return null when payment not found', async () => {
            const paymentId = 'nonexistent';

            vi.mocked(mockModel.markApproved).mockResolvedValue(null);

            const result = await service.markApproved(mockActor, paymentId);

            expect(result.data).toBeNull();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.markApproved(
                actorWithoutPermission,
                'payment-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // markRejected
    // =========================================================================

    describe('markRejected', () => {
        it('should mark payment as rejected', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';
            const reason = 'Insufficient funds';

            const rejectedPayment: Payment = {
                ...mockPayment,
                status: PaymentStatusEnum.REJECTED
            };

            vi.mocked(mockModel.markRejected).mockResolvedValue(rejectedPayment);

            const result = await service.markRejected(mockActor, paymentId, reason);

            expect(result.data).toEqual(rejectedPayment);
            expect(mockModel.markRejected).toHaveBeenCalledWith(paymentId, reason);
        });

        it('should mark payment as rejected without reason', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';

            const rejectedPayment: Payment = {
                ...mockPayment,
                status: PaymentStatusEnum.REJECTED
            };

            vi.mocked(mockModel.markRejected).mockResolvedValue(rejectedPayment);

            const result = await service.markRejected(mockActor, paymentId);

            expect(result.data).toEqual(rejectedPayment);
            expect(mockModel.markRejected).toHaveBeenCalledWith(paymentId, undefined);
        });

        it('should return null when payment not found', async () => {
            const paymentId = 'nonexistent';

            vi.mocked(mockModel.markRejected).mockResolvedValue(null);

            const result = await service.markRejected(mockActor, paymentId);

            expect(result.data).toBeNull();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.markRejected(
                actorWithoutPermission,
                'payment-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // retryPayment
    // =========================================================================

    describe('retryPayment', () => {
        it('should retry failed payment', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';
            const newProviderPaymentId = 'mp-67890';

            const retriedPayment: Payment = {
                ...mockPayment,
                status: PaymentStatusEnum.PENDING,
                providerPaymentId: newProviderPaymentId
            };

            vi.mocked(mockModel.retryPayment).mockResolvedValue(retriedPayment);

            const result = await service.retryPayment(mockActor, paymentId, newProviderPaymentId);

            expect(result.data).toEqual(retriedPayment);
            expect(mockModel.retryPayment).toHaveBeenCalledWith(paymentId, newProviderPaymentId);
        });

        it('should retry payment without new provider payment ID', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';

            const retriedPayment: Payment = {
                ...mockPayment,
                status: PaymentStatusEnum.PENDING
            };

            vi.mocked(mockModel.retryPayment).mockResolvedValue(retriedPayment);

            const result = await service.retryPayment(mockActor, paymentId);

            expect(result.data).toEqual(retriedPayment);
            expect(mockModel.retryPayment).toHaveBeenCalledWith(paymentId, undefined);
        });

        it('should reject retry when payment cannot be retried', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';

            vi.mocked(mockModel.retryPayment).mockRejectedValue(
                new Error('PAYMENT_CANNOT_BE_RETRIED')
            );

            const result = await service.retryPayment(mockActor, paymentId);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('should return error when payment not found', async () => {
            const paymentId = 'nonexistent';

            vi.mocked(mockModel.retryPayment).mockRejectedValue(new Error('PAYMENT_NOT_FOUND'));

            const result = await service.retryPayment(mockActor, paymentId);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe('NOT_FOUND');
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.retryPayment(
                actorWithoutPermission,
                'payment-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // isSuccessful
    // =========================================================================

    describe('isSuccessful', () => {
        it('should return true when payment is successful', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';

            vi.mocked(mockModel.isSuccessful).mockResolvedValue(true);

            const result = await service.isSuccessful(mockActor, paymentId);

            expect(result.data).toBe(true);
            expect(mockModel.isSuccessful).toHaveBeenCalledWith(paymentId);
        });

        it('should return false when payment is not successful', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';

            vi.mocked(mockModel.isSuccessful).mockResolvedValue(false);

            const result = await service.isSuccessful(mockActor, paymentId);

            expect(result.data).toBe(false);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.isSuccessful(
                actorWithoutPermission,
                'payment-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // isPending
    // =========================================================================

    describe('isPending', () => {
        it('should return true when payment is pending', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';

            vi.mocked(mockModel.isPending).mockResolvedValue(true);

            const result = await service.isPending(mockActor, paymentId);

            expect(result.data).toBe(true);
            expect(mockModel.isPending).toHaveBeenCalledWith(paymentId);
        });

        it('should return false when payment is not pending', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';

            vi.mocked(mockModel.isPending).mockResolvedValue(false);

            const result = await service.isPending(mockActor, paymentId);

            expect(result.data).toBe(false);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.isPending(
                actorWithoutPermission,
                'payment-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // canBeRefunded
    // =========================================================================

    describe('canBeRefunded', () => {
        it('should return true when payment can be refunded', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';

            vi.mocked(mockModel.canBeRefunded).mockResolvedValue(true);

            const result = await service.canBeRefunded(mockActor, paymentId);

            expect(result.data).toBe(true);
            expect(mockModel.canBeRefunded).toHaveBeenCalledWith(paymentId);
        });

        it('should return false when payment cannot be refunded', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';

            vi.mocked(mockModel.canBeRefunded).mockResolvedValue(false);

            const result = await service.canBeRefunded(mockActor, paymentId);

            expect(result.data).toBe(false);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.canBeRefunded(
                actorWithoutPermission,
                'payment-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // getTotalSuccessfulForInvoice
    // =========================================================================

    describe('getTotalSuccessfulForInvoice', () => {
        it('should get total successful payments for invoice', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000002';
            const total = 250.5;

            vi.mocked(mockModel.getTotalSuccessfulForInvoice).mockResolvedValue(total);

            const result = await service.getTotalSuccessfulForInvoice(mockActor, invoiceId);

            expect(result.data).toBe(total);
            expect(mockModel.getTotalSuccessfulForInvoice).toHaveBeenCalledWith(invoiceId);
        });

        it('should return 0 when no successful payments', async () => {
            const invoiceId = '00000000-0000-0000-0000-000000000002';

            vi.mocked(mockModel.getTotalSuccessfulForInvoice).mockResolvedValue(0);

            const result = await service.getTotalSuccessfulForInvoice(mockActor, invoiceId);

            expect(result.data).toBe(0);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.getTotalSuccessfulForInvoice(
                actorWithoutPermission,
                'invoice-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // withInvoice
    // =========================================================================

    describe('withInvoice', () => {
        it('should get payment with invoice data', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';
            const mockPaymentWithInvoice = {
                ...mockPayment,
                invoice: {
                    id: '00000000-0000-0000-0000-000000000002',
                    invoiceNumber: 'INV-2025-000001',
                    total: 121,
                    status: 'OPEN'
                }
            };

            vi.mocked(mockModel.withInvoice).mockResolvedValue(mockPaymentWithInvoice as any);

            const result = await service.withInvoice(mockActor, paymentId);

            expect(result.data).toEqual(mockPaymentWithInvoice);
            expect(mockModel.withInvoice).toHaveBeenCalledWith(paymentId);
        });

        it('should return null when payment not found', async () => {
            const paymentId = 'nonexistent';

            vi.mocked(mockModel.withInvoice).mockResolvedValue(null);

            const result = await service.withInvoice(mockActor, paymentId);

            expect(result.data).toBeNull();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.withInvoice(
                actorWithoutPermission,
                'payment-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // cancel
    // =========================================================================

    describe('cancel', () => {
        it('should cancel payment', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';
            const reason = 'Customer requested cancellation';

            const cancelledPayment: Payment = {
                ...mockPayment,
                status: PaymentStatusEnum.CANCELLED
            };

            vi.mocked(mockModel.cancel).mockResolvedValue(cancelledPayment);

            const result = await service.cancel(mockActor, paymentId, reason);

            expect(result.data).toEqual(cancelledPayment);
            expect(mockModel.cancel).toHaveBeenCalledWith(paymentId, reason);
        });

        it('should cancel payment without reason', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';

            const cancelledPayment: Payment = {
                ...mockPayment,
                status: PaymentStatusEnum.CANCELLED
            };

            vi.mocked(mockModel.cancel).mockResolvedValue(cancelledPayment);

            const result = await service.cancel(mockActor, paymentId);

            expect(result.data).toEqual(cancelledPayment);
            expect(mockModel.cancel).toHaveBeenCalledWith(paymentId, undefined);
        });

        it('should return null when payment not found', async () => {
            const paymentId = 'nonexistent';

            vi.mocked(mockModel.cancel).mockResolvedValue(null);

            const result = await service.cancel(mockActor, paymentId);

            expect(result.data).toBeNull();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.cancel(
                actorWithoutPermission,
                'payment-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });
});
