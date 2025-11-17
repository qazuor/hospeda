import type { PaymentModel } from '@repo/db';
import {
    LifecycleStatusEnum,
    type Payment,
    PaymentMethodEnum,
    PaymentStatusEnum,
    PaymentTypeEnum,
    PermissionEnum,
    PriceCurrencyEnum,
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
        userId: '00000000-0000-0000-0000-000000000002',
        paymentPlanId: '00000000-0000-0000-0000-000000000003',
        invoiceId: null,
        type: PaymentTypeEnum.ONE_TIME,
        amount: 100.0,
        currency: PriceCurrencyEnum.USD,
        paymentMethod: PaymentMethodEnum.CREDIT_CARD,
        status: PaymentStatusEnum.PENDING,
        mercadoPagoPaymentId: 'mp-12345',
        mercadoPagoPreferenceId: null,
        externalReference: null,
        description: null,
        metadata: null,
        processedAt: null,
        expiresAt: null,
        failureReason: null,
        mercadoPagoResponse: null,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        isActive: true,
        isDeleted: false,
        adminInfo: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
        createdById: '',
        updatedById: '',
        deletedById: null
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
            permissions: [
                PermissionEnum.PAYMENT_CREATE,
                PermissionEnum.PAYMENT_UPDATE,
                PermissionEnum.PAYMENT_DELETE,
                PermissionEnum.PAYMENT_VIEW,
                PermissionEnum.PAYMENT_RESTORE,
                PermissionEnum.PAYMENT_HARD_DELETE,
                PermissionEnum.PAYMENT_PROCESS,
                PermissionEnum.PAYMENT_REFUND,
                PermissionEnum.PAYMENT_CANCEL
            ]
        };

        mockModel = {
            handleMercadoPagoWebhook: vi.fn(),
            findByUser: vi.fn(),
            findByPricingPlan: vi.fn(),
            findPending: vi.fn(),
            markApproved: vi.fn(),
            markRejected: vi.fn(),
            retryPayment: vi.fn(),
            isSuccessful: vi.fn(),
            isPending: vi.fn(),
            canBeRefunded: vi.fn(),
            getTotalSuccessfulForUser: vi.fn(),
            withRelations: vi.fn(),
            cancel: vi.fn()
        } as unknown as PaymentModel;

        service = new PaymentService(ctx, mockModel);
    });

    // =========================================================================
    // handleMercadoPagoWebhook
    // =========================================================================

    describe('handleMercadoPagoWebhook', () => {
        it('should handle webhook from Mercado Pago', async () => {
            const mercadoPagoPaymentId = 'mp-12345';
            const newStatus = PaymentStatusEnum.APPROVED;
            const webhookData = { status: 'approved', payment_id: 'mp-12345' };

            const approvedPayment: Payment = {
                ...mockPayment,
                status: PaymentStatusEnum.APPROVED,
                processedAt: new Date('2025-01-15')
            };

            vi.mocked(mockModel.handleMercadoPagoWebhook).mockResolvedValue(approvedPayment);

            const result = await service.handleMercadoPagoWebhook(
                mockActor,
                mercadoPagoPaymentId,
                newStatus,
                webhookData
            );

            expect(result.data).toEqual(approvedPayment);
            expect(mockModel.handleMercadoPagoWebhook).toHaveBeenCalledWith(
                mercadoPagoPaymentId,
                newStatus,
                webhookData
            );
        });

        it('should return error when payment not found', async () => {
            const mercadoPagoPaymentId = 'nonexistent';
            const newStatus = PaymentStatusEnum.APPROVED;

            vi.mocked(mockModel.handleMercadoPagoWebhook).mockRejectedValue(
                new Error('PAYMENT_NOT_FOUND')
            );

            const result = await service.handleMercadoPagoWebhook(
                mockActor,
                mercadoPagoPaymentId,
                newStatus
            );

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

            const result = await serviceWithoutPermission.handleMercadoPagoWebhook(
                actorWithoutPermission,
                'mp-12345',
                PaymentStatusEnum.APPROVED
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findByUser
    // =========================================================================

    describe('findByUser', () => {
        it('should find payments by user', async () => {
            const userId = '00000000-0000-0000-0000-000000000002';
            const mockPayments: Payment[] = [mockPayment];

            vi.mocked(mockModel.findByUser).mockResolvedValue(mockPayments);

            const result = await service.findByUser(mockActor, userId);

            expect(result.data).toEqual(mockPayments);
            expect(mockModel.findByUser).toHaveBeenCalledWith(userId);
        });

        it('should return empty array when no payments found', async () => {
            const userId = '00000000-0000-0000-0000-000000000002';

            vi.mocked(mockModel.findByUser).mockResolvedValue([]);

            const result = await service.findByUser(mockActor, userId);

            expect(result.data).toEqual([]);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.findByUser(
                actorWithoutPermission,
                'user-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findByPricingPlan
    // =========================================================================

    describe('findByPricingPlan', () => {
        it('should find payments by pricing plan', async () => {
            const planId = '00000000-0000-0000-0000-000000000003';
            const mockPayments: Payment[] = [mockPayment];

            vi.mocked(mockModel.findByPricingPlan).mockResolvedValue(mockPayments);

            const result = await service.findByPricingPlan(mockActor, planId);

            expect(result.data).toEqual(mockPayments);
            expect(mockModel.findByPricingPlan).toHaveBeenCalledWith(planId);
        });

        it('should return empty array when no payments found', async () => {
            const planId = '00000000-0000-0000-0000-000000000003';

            vi.mocked(mockModel.findByPricingPlan).mockResolvedValue([]);

            const result = await service.findByPricingPlan(mockActor, planId);

            expect(result.data).toEqual([]);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.findByPricingPlan(
                actorWithoutPermission,
                'plan-id'
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
                status: PaymentStatusEnum.APPROVED
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
                status: PaymentStatusEnum.APPROVED
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
                status: PaymentStatusEnum.PENDING
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
    // getTotalSuccessfulForUser
    // =========================================================================

    describe('getTotalSuccessfulForUser', () => {
        it('should get total successful payments for user', async () => {
            const userId = '00000000-0000-0000-0000-000000000002';
            const total = 250.5;

            vi.mocked(mockModel.getTotalSuccessfulForUser).mockResolvedValue(total);

            const result = await service.getTotalSuccessfulForUser(mockActor, userId);

            expect(result.data).toBe(total);
            expect(mockModel.getTotalSuccessfulForUser).toHaveBeenCalledWith(userId);
        });

        it('should return 0 when no successful payments', async () => {
            const userId = '00000000-0000-0000-0000-000000000002';

            vi.mocked(mockModel.getTotalSuccessfulForUser).mockResolvedValue(0);

            const result = await service.getTotalSuccessfulForUser(mockActor, userId);

            expect(result.data).toBe(0);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.getTotalSuccessfulForUser(
                actorWithoutPermission,
                'user-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // withRelations
    // =========================================================================

    describe('withRelations', () => {
        it('should get payment with relations data', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000001';
            const mockPaymentWithRelations = {
                ...mockPayment,
                user: {
                    id: '00000000-0000-0000-0000-000000000002',
                    email: 'user@example.com',
                    username: 'testuser'
                },
                pricingPlan: {
                    id: '00000000-0000-0000-0000-000000000003',
                    name: 'Premium Plan',
                    price: 100.0
                }
            };

            vi.mocked(mockModel.withRelations).mockResolvedValue(mockPaymentWithRelations as any);

            const result = await service.withRelations(mockActor, paymentId);

            expect(result.data).toEqual(mockPaymentWithRelations);
            expect(mockModel.withRelations).toHaveBeenCalledWith(paymentId);
        });

        it('should return null when payment not found', async () => {
            const paymentId = 'nonexistent';

            vi.mocked(mockModel.withRelations).mockResolvedValue(null);

            const result = await service.withRelations(mockActor, paymentId);

            expect(result.data).toBeNull();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new PaymentService(ctx, mockModel);

            const result = await serviceWithoutPermission.withRelations(
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
