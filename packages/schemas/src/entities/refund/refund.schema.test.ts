import { describe, expect, it } from 'vitest';
import { RefundReasonEnum, RefundSchema, RefundStatusEnum } from './refund.schema.js';

describe('RefundSchema', () => {
    const validRefundData = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        paymentId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        refundNumber: 'REF-2024-001',
        amount: 50.0,
        currency: 'USD',
        reason: RefundReasonEnum.CUSTOMER_REQUEST,
        status: RefundStatusEnum.PENDING,
        createdAt: new Date('2024-01-15T00:00:00Z'),
        updatedAt: new Date('2024-01-15T00:00:00Z'),
        createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
        updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d483'
    };

    it('should validate a complete valid refund', () => {
        expect(() => RefundSchema.parse(validRefundData)).not.toThrow();
    });

    it('should validate refund with optional description', () => {
        const withDescription = {
            ...validRefundData,
            description: 'Customer requested full refund'
        };
        expect(() => RefundSchema.parse(withDescription)).not.toThrow();
    });

    it('should validate processed refund', () => {
        const processedRefund = {
            ...validRefundData,
            status: RefundStatusEnum.COMPLETED,
            processedAt: new Date('2024-01-16T00:00:00Z'),
            processedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d484'
        };
        expect(() => RefundSchema.parse(processedRefund)).not.toThrow();
    });

    it('should validate refund with provider data', () => {
        const withProviderData = {
            ...validRefundData,
            providerRefundId: 'stripe_re_123456',
            providerResponse: {
                status: 'succeeded',
                transactionId: 'txn_123456'
            }
        };
        expect(() => RefundSchema.parse(withProviderData)).not.toThrow();
    });

    it('should validate failed refund', () => {
        const failedRefund = {
            ...validRefundData,
            status: RefundStatusEnum.FAILED,
            failureReason: 'Insufficient funds in merchant account'
        };
        expect(() => RefundSchema.parse(failedRefund)).not.toThrow();
    });
});
