import { describe, expect, it } from 'vitest';
import {
    CreateRefundSchema,
    DeleteRefundSchema,
    RefundKeySchema,
    RestoreRefundSchema,
    UpdateRefundSchema
} from './crud.schema.js';
import { RefundReasonEnum, RefundStatusEnum } from './refund.schema.js';

describe('Refund CRUD Schemas', () => {
    const validCreateData = {
        paymentId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        refundNumber: 'REF-2024-001',
        amount: 50.0,
        currency: 'USD',
        reason: RefundReasonEnum.CUSTOMER_REQUEST
    };

    describe('CreateRefundSchema', () => {
        it('should validate valid create data', () => {
            expect(() => CreateRefundSchema.parse(validCreateData)).not.toThrow();
        });

        it('should validate create data with optional description', () => {
            const withDescription = {
                ...validCreateData,
                description: 'Customer requested refund for cancellation'
            };
            expect(() => CreateRefundSchema.parse(withDescription)).not.toThrow();
        });

        it('should reject invalid payment ID', () => {
            const invalidData = {
                ...validCreateData,
                paymentId: 'invalid-id'
            };
            expect(() => CreateRefundSchema.parse(invalidData)).toThrow();
        });

        it('should reject negative amount', () => {
            const invalidData = {
                ...validCreateData,
                amount: -10
            };
            expect(() => CreateRefundSchema.parse(invalidData)).toThrow();
        });

        it('should reject zero amount', () => {
            const invalidData = {
                ...validCreateData,
                amount: 0
            };
            expect(() => CreateRefundSchema.parse(invalidData)).toThrow();
        });

        it('should reject empty refund number', () => {
            const invalidData = {
                ...validCreateData,
                refundNumber: ''
            };
            expect(() => CreateRefundSchema.parse(invalidData)).toThrow();
        });

        it('should reject too long refund number', () => {
            const invalidData = {
                ...validCreateData,
                refundNumber: 'x'.repeat(101)
            };
            expect(() => CreateRefundSchema.parse(invalidData)).toThrow();
        });

        it('should reject too long description', () => {
            const invalidData = {
                ...validCreateData,
                description: 'x'.repeat(1001)
            };
            expect(() => CreateRefundSchema.parse(invalidData)).toThrow();
        });

        it('should reject invalid currency', () => {
            const invalidData = {
                ...validCreateData,
                currency: 'XYZ'
            };
            expect(() => CreateRefundSchema.parse(invalidData)).toThrow();
        });

        it('should reject invalid reason', () => {
            const invalidData = {
                ...validCreateData,
                reason: 'invalid_reason' as RefundReasonEnum
            };
            expect(() => CreateRefundSchema.parse(invalidData)).toThrow();
        });
    });

    describe('UpdateRefundSchema', () => {
        it('should validate empty update data', () => {
            expect(() => UpdateRefundSchema.parse({})).not.toThrow();
        });

        it('should validate partial update data', () => {
            const updateData = {
                status: RefundStatusEnum.PROCESSING,
                processedAt: new Date('2024-01-16T00:00:00Z')
            };
            expect(() => UpdateRefundSchema.parse(updateData)).not.toThrow();
        });

        it('should validate update with provider data', () => {
            const updateData = {
                providerRefundId: 'stripe_re_123456',
                providerResponse: {
                    status: 'succeeded',
                    transactionId: 'txn_123456'
                }
            };
            expect(() => UpdateRefundSchema.parse(updateData)).not.toThrow();
        });

        it('should validate update with failure reason', () => {
            const updateData = {
                status: RefundStatusEnum.FAILED,
                failureReason: 'Insufficient funds'
            };
            expect(() => UpdateRefundSchema.parse(updateData)).not.toThrow();
        });

        it('should reject invalid partial data', () => {
            const invalidData = {
                amount: -10
            };
            expect(() => UpdateRefundSchema.parse(invalidData)).toThrow();
        });

        it('should reject too long failure reason', () => {
            const invalidData = {
                failureReason: 'x'.repeat(501)
            };
            expect(() => UpdateRefundSchema.parse(invalidData)).toThrow();
        });
    });

    describe('DeleteRefundSchema', () => {
        it('should validate valid ID', () => {
            const data = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };
            expect(() => DeleteRefundSchema.parse(data)).not.toThrow();
        });

        it('should reject invalid ID', () => {
            const data = { id: 'invalid-id' };
            expect(() => DeleteRefundSchema.parse(data)).toThrow();
        });
    });

    describe('RestoreRefundSchema', () => {
        it('should validate valid ID', () => {
            const data = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };
            expect(() => RestoreRefundSchema.parse(data)).not.toThrow();
        });

        it('should reject invalid ID', () => {
            const data = { id: 'invalid-id' };
            expect(() => RestoreRefundSchema.parse(data)).toThrow();
        });
    });

    describe('RefundKeySchema', () => {
        it('should validate valid key', () => {
            const data = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };
            expect(() => RefundKeySchema.parse(data)).not.toThrow();
        });

        it('should reject invalid key', () => {
            const data = { id: 'invalid-id' };
            expect(() => RefundKeySchema.parse(data)).toThrow();
        });
    });
});
