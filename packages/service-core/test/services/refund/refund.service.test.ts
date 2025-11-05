import type { RefundModel } from '@repo/db';
import { PermissionEnum, type Refund, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefundService } from '../../../src/services/refund/refund.service.js';
import type { Actor } from '../../../src/types/index.js';

describe('RefundService', () => {
    let service: RefundService;
    let mockModel: RefundModel;
    let mockActor: Actor;
    let ctx: import('../../../src/types/index.js').ServiceContext;

    // Mock data
    const mockRefund: Refund = {
        id: '00000000-0000-0000-0000-000000000001',
        paymentId: '00000000-0000-0000-0000-000000000002',
        amountMinor: 12100, // $121.00
        reason: 'Customer requested',
        refundedAt: new Date('2025-01-15'),
        createdAt: new Date('2025-01-15'),
        updatedAt: new Date('2025-01-15'),
        createdById: '',
        updatedById: '',
        deletedAt: undefined,
        deletedById: undefined,
        adminInfo: undefined
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
            processRefund: vi.fn(),
            findByPayment: vi.fn(),
            calculateRefundable: vi.fn(),
            getTotalRefundedForPayment: vi.fn(),
            canRefund: vi.fn(),
            validateRefundAmount: vi.fn(),
            checkRefundPolicy: vi.fn(),
            withPayment: vi.fn(),
            findByDateRange: vi.fn(),
            getRefundStats: vi.fn(),
            reverseRefund: vi.fn()
        } as unknown as RefundModel;

        service = new RefundService(ctx, mockModel);
    });

    // =========================================================================
    // processRefund
    // =========================================================================

    describe('processRefund', () => {
        it('should process refund', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000002';
            const amount = 121.0;
            const reason = 'Customer requested';

            vi.mocked(mockModel.processRefund).mockResolvedValue(mockRefund);

            const result = await service.processRefund(mockActor, paymentId, amount, reason);

            expect(result.data).toEqual(mockRefund);
            expect(result.error).toBeUndefined();
            expect(mockModel.processRefund).toHaveBeenCalledWith(paymentId, amount, reason);
        });

        it('should return null when payment not found', async () => {
            const paymentId = 'nonexistent';
            const amount = 121.0;

            vi.mocked(mockModel.processRefund).mockResolvedValue(null);

            const result = await service.processRefund(mockActor, paymentId, amount);

            expect(result.data).toBeNull();
            expect(result.error).toBeUndefined();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new RefundService(ctx, mockModel);

            const result = await serviceWithoutPermission.processRefund(
                actorWithoutPermission,
                'payment-id',
                100
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findByPayment
    // =========================================================================

    describe('findByPayment', () => {
        it('should find refunds by payment', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000002';
            const mockRefunds: Refund[] = [mockRefund];

            vi.mocked(mockModel.findByPayment).mockResolvedValue(mockRefunds);

            const result = await service.findByPayment(mockActor, paymentId);

            expect(result.data).toEqual(mockRefunds);
            expect(mockModel.findByPayment).toHaveBeenCalledWith(paymentId);
        });

        it('should return empty array when no refunds found', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000002';

            vi.mocked(mockModel.findByPayment).mockResolvedValue([]);

            const result = await service.findByPayment(mockActor, paymentId);

            expect(result.data).toEqual([]);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new RefundService(ctx, mockModel);

            const result = await serviceWithoutPermission.findByPayment(
                actorWithoutPermission,
                'payment-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // calculateRefundable
    // =========================================================================

    describe('calculateRefundable', () => {
        it('should calculate refundable amount', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000002';
            const refundableAmount = 121.0;

            vi.mocked(mockModel.calculateRefundable).mockResolvedValue(refundableAmount);

            const result = await service.calculateRefundable(mockActor, paymentId);

            expect(result.data).toBe(refundableAmount);
            expect(mockModel.calculateRefundable).toHaveBeenCalledWith(paymentId);
        });

        it('should return 0 when payment not found', async () => {
            const paymentId = 'nonexistent';

            vi.mocked(mockModel.calculateRefundable).mockResolvedValue(0);

            const result = await service.calculateRefundable(mockActor, paymentId);

            expect(result.data).toBe(0);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new RefundService(ctx, mockModel);

            const result = await serviceWithoutPermission.calculateRefundable(
                actorWithoutPermission,
                'payment-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // getTotalRefundedForPayment
    // =========================================================================

    describe('getTotalRefundedForPayment', () => {
        it('should get total refunded amount', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000002';
            const totalRefunded = 50.0;

            vi.mocked(mockModel.getTotalRefundedForPayment).mockResolvedValue(totalRefunded);

            const result = await service.getTotalRefundedForPayment(mockActor, paymentId);

            expect(result.data).toBe(totalRefunded);
            expect(mockModel.getTotalRefundedForPayment).toHaveBeenCalledWith(paymentId);
        });

        it('should return 0 when no refunds exist', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000002';

            vi.mocked(mockModel.getTotalRefundedForPayment).mockResolvedValue(0);

            const result = await service.getTotalRefundedForPayment(mockActor, paymentId);

            expect(result.data).toBe(0);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new RefundService(ctx, mockModel);

            const result = await serviceWithoutPermission.getTotalRefundedForPayment(
                actorWithoutPermission,
                'payment-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // canRefund
    // =========================================================================

    describe('canRefund', () => {
        it('should check if payment can be refunded', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000002';

            vi.mocked(mockModel.canRefund).mockResolvedValue(true);

            const result = await service.canRefund(mockActor, paymentId);

            expect(result.data).toBe(true);
            expect(mockModel.canRefund).toHaveBeenCalledWith(paymentId, undefined);
        });

        it('should check if payment can be refunded with specific amount', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000002';
            const amount = 100.0;

            vi.mocked(mockModel.canRefund).mockResolvedValue(true);

            const result = await service.canRefund(mockActor, paymentId, amount);

            expect(result.data).toBe(true);
            expect(mockModel.canRefund).toHaveBeenCalledWith(paymentId, amount);
        });

        it('should return false when refund not allowed', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000002';

            vi.mocked(mockModel.canRefund).mockResolvedValue(false);

            const result = await service.canRefund(mockActor, paymentId);

            expect(result.data).toBe(false);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new RefundService(ctx, mockModel);

            const result = await serviceWithoutPermission.canRefund(
                actorWithoutPermission,
                'payment-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // validateRefundAmount
    // =========================================================================

    describe('validateRefundAmount', () => {
        it('should validate refund amount as valid', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000002';
            const amount = 100.0;
            const validation = { valid: true };

            vi.mocked(mockModel.validateRefundAmount).mockResolvedValue(validation);

            const result = await service.validateRefundAmount(mockActor, paymentId, amount);

            expect(result.data).toEqual(validation);
            expect(mockModel.validateRefundAmount).toHaveBeenCalledWith(paymentId, amount);
        });

        it('should validate refund amount as invalid with reason', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000002';
            const amount = 500.0;
            const validation = {
                valid: false,
                reason: 'AMOUNT_EXCEEDS_REFUNDABLE',
                refundableAmount: 121.0
            };

            vi.mocked(mockModel.validateRefundAmount).mockResolvedValue(validation);

            const result = await service.validateRefundAmount(mockActor, paymentId, amount);

            expect(result.data).toEqual(validation);
            expect(result.data?.valid).toBe(false);
            expect(result.data?.reason).toBe('AMOUNT_EXCEEDS_REFUNDABLE');
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new RefundService(ctx, mockModel);

            const result = await serviceWithoutPermission.validateRefundAmount(
                actorWithoutPermission,
                'payment-id',
                100
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // checkRefundPolicy
    // =========================================================================

    describe('checkRefundPolicy', () => {
        it('should check refund policy as allowed', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000002';
            const policyCheck = { allowed: true };

            vi.mocked(mockModel.checkRefundPolicy).mockResolvedValue(policyCheck);

            const result = await service.checkRefundPolicy(mockActor, paymentId);

            expect(result.data).toEqual(policyCheck);
            expect(mockModel.checkRefundPolicy).toHaveBeenCalledWith(paymentId);
        });

        it('should check refund policy as not allowed with reason', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000002';
            const policyCheck = { allowed: false, reason: 'REFUND_PERIOD_EXPIRED' };

            vi.mocked(mockModel.checkRefundPolicy).mockResolvedValue(policyCheck);

            const result = await service.checkRefundPolicy(mockActor, paymentId);

            expect(result.data).toEqual(policyCheck);
            expect(result.data?.allowed).toBe(false);
            expect(result.data?.reason).toBe('REFUND_PERIOD_EXPIRED');
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new RefundService(ctx, mockModel);

            const result = await serviceWithoutPermission.checkRefundPolicy(
                actorWithoutPermission,
                'payment-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // withPayment
    // =========================================================================

    describe('withPayment', () => {
        it('should get refund with payment data', async () => {
            const refundId = '00000000-0000-0000-0000-000000000001';
            const refundWithPayment = {
                ...mockRefund,
                payment: {
                    id: '00000000-0000-0000-0000-000000000002',
                    amount: 121.0,
                    status: 'APPROVED'
                }
            };

            vi.mocked(mockModel.withPayment).mockResolvedValue(refundWithPayment);

            const result = await service.withPayment(mockActor, refundId);

            expect(result.data).toEqual(refundWithPayment);
            expect(mockModel.withPayment).toHaveBeenCalledWith(refundId);
        });

        it('should return null when refund not found', async () => {
            const refundId = 'nonexistent';

            vi.mocked(mockModel.withPayment).mockResolvedValue(null);

            const result = await service.withPayment(mockActor, refundId);

            expect(result.data).toBeNull();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new RefundService(ctx, mockModel);

            const result = await serviceWithoutPermission.withPayment(
                actorWithoutPermission,
                'refund-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // findByDateRange
    // =========================================================================

    describe('findByDateRange', () => {
        it('should find refunds within date range', async () => {
            const startDate = new Date('2025-01-01');
            const endDate = new Date('2025-01-31');
            const mockRefunds: Refund[] = [mockRefund];

            vi.mocked(mockModel.findByDateRange).mockResolvedValue(mockRefunds);

            const result = await service.findByDateRange(mockActor, startDate, endDate);

            expect(result.data).toEqual(mockRefunds);
            expect(mockModel.findByDateRange).toHaveBeenCalledWith(startDate, endDate);
        });

        it('should return empty array when no refunds in range', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');

            vi.mocked(mockModel.findByDateRange).mockResolvedValue([]);

            const result = await service.findByDateRange(mockActor, startDate, endDate);

            expect(result.data).toEqual([]);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new RefundService(ctx, mockModel);

            const result = await serviceWithoutPermission.findByDateRange(
                actorWithoutPermission,
                new Date(),
                new Date()
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // getRefundStats
    // =========================================================================

    describe('getRefundStats', () => {
        it('should get refund statistics', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000002';
            const stats = {
                totalRefunded: 50.0,
                refundCount: 2,
                remainingRefundable: 71.0
            };

            vi.mocked(mockModel.getRefundStats).mockResolvedValue(stats);

            const result = await service.getRefundStats(mockActor, paymentId);

            expect(result.data).toEqual(stats);
            expect(mockModel.getRefundStats).toHaveBeenCalledWith(paymentId);
        });

        it('should return zero stats when no refunds', async () => {
            const paymentId = '00000000-0000-0000-0000-000000000002';
            const stats = {
                totalRefunded: 0,
                refundCount: 0,
                remainingRefundable: 121.0
            };

            vi.mocked(mockModel.getRefundStats).mockResolvedValue(stats);

            const result = await service.getRefundStats(mockActor, paymentId);

            expect(result.data).toEqual(stats);
            expect(result.data?.totalRefunded).toBe(0);
            expect(result.data?.refundCount).toBe(0);
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new RefundService(ctx, mockModel);

            const result = await serviceWithoutPermission.getRefundStats(
                actorWithoutPermission,
                'payment-id'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });

    // =========================================================================
    // reverseRefund
    // =========================================================================

    describe('reverseRefund', () => {
        it('should reverse refund', async () => {
            const refundId = '00000000-0000-0000-0000-000000000001';
            const reason = 'Accidental refund';

            const reversedRefund: Refund = {
                ...mockRefund,
                deletedAt: new Date('2025-01-20'),
                adminInfo: {
                    notes: `Reversed: ${reason}`,
                    favorite: false
                }
            };

            vi.mocked(mockModel.reverseRefund).mockResolvedValue(reversedRefund);

            const result = await service.reverseRefund(mockActor, refundId, reason);

            expect(result.data).toEqual(reversedRefund);
            expect(mockModel.reverseRefund).toHaveBeenCalledWith(refundId, reason);
        });

        it('should reverse refund without reason', async () => {
            const refundId = '00000000-0000-0000-0000-000000000001';

            const reversedRefund: Refund = {
                ...mockRefund,
                deletedAt: new Date('2025-01-20')
            };

            vi.mocked(mockModel.reverseRefund).mockResolvedValue(reversedRefund);

            const result = await service.reverseRefund(mockActor, refundId);

            expect(result.data).toEqual(reversedRefund);
            expect(mockModel.reverseRefund).toHaveBeenCalledWith(refundId, undefined);
        });

        it('should return null when refund not found', async () => {
            const refundId = 'nonexistent';

            vi.mocked(mockModel.reverseRefund).mockResolvedValue(null);

            const result = await service.reverseRefund(mockActor, refundId);

            expect(result.data).toBeNull();
        });

        it('should deny access without permission', async () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            const serviceWithoutPermission = new RefundService(ctx, mockModel);

            const result = await serviceWithoutPermission.reverseRefund(
                actorWithoutPermission,
                'refund-id',
                'reason'
            );

            expect(result.error).toBeDefined();
            expect(result.error?.message.toLowerCase()).toContain('permission');
        });
    });
});
