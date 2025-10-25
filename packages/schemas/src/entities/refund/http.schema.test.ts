import { describe, expect, it } from 'vitest';
import {
    CreateRefundHTTPSchema,
    RefundQueryHTTPSchema,
    UpdateRefundHTTPSchema
} from './http.schema.js';
import { RefundReasonEnum, RefundStatusEnum } from './refund.schema.js';

describe('Refund HTTP Schemas', () => {
    const validCreateData = {
        paymentId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        refundNumber: 'REF-2024-001',
        amount: 50.0,
        currency: 'USD',
        reason: RefundReasonEnum.CUSTOMER_REQUEST
    };

    describe('CreateRefundHTTPSchema', () => {
        it('should validate valid create data', () => {
            expect(() => CreateRefundHTTPSchema.parse(validCreateData)).not.toThrow();
        });

        it('should convert string amount to number', () => {
            const dataWithStringAmount = {
                ...validCreateData,
                amount: '50.00'
            };
            const result = CreateRefundHTTPSchema.parse(dataWithStringAmount);
            expect(result.amount).toBe(50.0);
            expect(typeof result.amount).toBe('number');
        });

        it('should validate create data with description', () => {
            const dataWithDescription = {
                ...validCreateData,
                description: 'Customer requested refund for cancellation'
            };
            expect(() => CreateRefundHTTPSchema.parse(dataWithDescription)).not.toThrow();
        });

        it('should reject invalid string amount', () => {
            const dataWithInvalidAmount = {
                ...validCreateData,
                amount: 'invalid-amount'
            };
            expect(() => CreateRefundHTTPSchema.parse(dataWithInvalidAmount)).toThrow();
        });

        it('should reject negative string amount', () => {
            const dataWithNegativeAmount = {
                ...validCreateData,
                amount: '-10.00'
            };
            expect(() => CreateRefundHTTPSchema.parse(dataWithNegativeAmount)).toThrow();
        });

        it('should reject zero string amount', () => {
            const dataWithZeroAmount = {
                ...validCreateData,
                amount: '0'
            };
            expect(() => CreateRefundHTTPSchema.parse(dataWithZeroAmount)).toThrow();
        });
    });

    describe('UpdateRefundHTTPSchema', () => {
        it('should validate empty update data', () => {
            expect(() => UpdateRefundHTTPSchema.parse({})).not.toThrow();
        });

        it('should convert string amount to number', () => {
            const updateData = { amount: '75.00' };
            const result = UpdateRefundHTTPSchema.parse(updateData);
            expect(result.amount).toBe(75.0);
            expect(typeof result.amount).toBe('number');
        });

        it('should convert string date to Date object', () => {
            const updateData = { processedAt: '2024-01-20T00:00:00Z' };
            const result = UpdateRefundHTTPSchema.parse(updateData);
            expect(result.processedAt).toBeInstanceOf(Date);
        });

        it('should validate status update', () => {
            const updateData = { status: RefundStatusEnum.COMPLETED };
            expect(() => UpdateRefundHTTPSchema.parse(updateData)).not.toThrow();
        });

        it('should validate provider data update', () => {
            const updateData = {
                providerRefundId: 'stripe_re_123456',
                failureReason: 'Insufficient funds'
            };
            expect(() => UpdateRefundHTTPSchema.parse(updateData)).not.toThrow();
        });

        it('should reject invalid string amount', () => {
            const updateData = { amount: 'invalid' };
            expect(() => UpdateRefundHTTPSchema.parse(updateData)).toThrow();
        });

        it('should reject invalid string date', () => {
            const updateData = { processedAt: 'invalid-date' };
            expect(() => UpdateRefundHTTPSchema.parse(updateData)).toThrow();
        });
    });

    describe('RefundQueryHTTPSchema', () => {
        it('should validate empty query', () => {
            expect(() => RefundQueryHTTPSchema.parse({})).not.toThrow();
        });

        it('should convert string amounts to numbers', () => {
            const query = {
                amountMin: '10.00',
                amountMax: '100.00'
            };
            const result = RefundQueryHTTPSchema.parse(query);
            expect(result.amountMin).toBe(10.0);
            expect(result.amountMax).toBe(100.0);
        });

        it('should convert string dates to Date objects', () => {
            const query = {
                processedAtFrom: '2024-01-01T00:00:00Z',
                processedAtTo: '2024-12-31T23:59:59Z'
            };
            const result = RefundQueryHTTPSchema.parse(query);
            expect(result.processedAtFrom).toBeInstanceOf(Date);
            expect(result.processedAtTo).toBeInstanceOf(Date);
        });

        it('should validate status filter', () => {
            const query = { status: RefundStatusEnum.COMPLETED };
            expect(() => RefundQueryHTTPSchema.parse(query)).not.toThrow();
        });

        it('should validate reason filter', () => {
            const query = { reason: RefundReasonEnum.BILLING_ERROR };
            expect(() => RefundQueryHTTPSchema.parse(query)).not.toThrow();
        });

        it('should validate provider refund ID filter', () => {
            const query = { providerRefundId: 'stripe_re_123456' };
            expect(() => RefundQueryHTTPSchema.parse(query)).not.toThrow();
        });

        it('should reject invalid amount range after conversion', () => {
            const query = {
                amountMin: '100.00',
                amountMax: '10.00'
            };
            expect(() => RefundQueryHTTPSchema.parse(query)).toThrow();
        });

        it('should reject invalid date range after conversion', () => {
            const query = {
                processedAtFrom: '2024-12-31T00:00:00Z',
                processedAtTo: '2024-01-01T00:00:00Z'
            };
            expect(() => RefundQueryHTTPSchema.parse(query)).toThrow();
        });

        it('should reject negative amount strings', () => {
            const query = { amountMin: '-10.00' };
            expect(() => RefundQueryHTTPSchema.parse(query)).toThrow();
        });

        it('should reject invalid number strings', () => {
            const query = { amountMin: 'not-a-number' };
            expect(() => RefundQueryHTTPSchema.parse(query)).toThrow();
        });

        it('should reject invalid date strings', () => {
            const query = { processedAtFrom: 'not-a-date' };
            expect(() => RefundQueryHTTPSchema.parse(query)).toThrow();
        });
    });
});
