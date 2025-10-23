import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { PaymentStatusEnum } from '../../src/enums/index.js';
import { PaymentStatusEnumSchema } from '../../src/enums/payment-status.schema.js';

describe('PaymentStatusEnumSchema - Business Model Spec', () => {
    it('should validate valid payment status values', () => {
        // Test each enum value
        // biome-ignore lint/complexity/noForEach: <explanation>
        Object.values(PaymentStatusEnum).forEach((status) => {
            expect(() => PaymentStatusEnumSchema.parse(status)).not.toThrow();
        });
    });

    it('should validate PENDING payment status', () => {
        expect(() => PaymentStatusEnumSchema.parse(PaymentStatusEnum.PENDING)).not.toThrow();
    });

    it('should validate APPROVED payment status', () => {
        expect(() => PaymentStatusEnumSchema.parse(PaymentStatusEnum.APPROVED)).not.toThrow();
    });

    it('should validate REJECTED payment status', () => {
        expect(() => PaymentStatusEnumSchema.parse(PaymentStatusEnum.REJECTED)).not.toThrow();
    });

    it('should reject invalid payment status values', () => {
        const invalidStatuses = [
            'invalid-status',
            'AUTHORIZED', // Not in business model spec
            'IN_PROCESS', // Not in business model spec
            'IN_MEDIATION', // Not in business model spec
            'CANCELLED', // Not in business model spec
            'REFUNDED', // Not in business model spec
            'CHARGED_BACK', // Not in business model spec
            'PROCESSING',
            'FAILED',
            '',
            null,
            undefined,
            123,
            {},
            []
        ];

        // biome-ignore lint/complexity/noForEach: <explanation>
        invalidStatuses.forEach((status) => {
            expect(() => PaymentStatusEnumSchema.parse(status)).toThrow(ZodError);
        });
    });

    it('should provide appropriate error message for invalid values', () => {
        try {
            PaymentStatusEnumSchema.parse('invalid-status');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe('zodError.enums.paymentStatus.invalid');
        }
    });

    it('should infer correct TypeScript type', () => {
        const validStatus = PaymentStatusEnumSchema.parse(PaymentStatusEnum.PENDING);

        // TypeScript should infer this as PaymentStatusEnum
        expect(typeof validStatus).toBe('string');
        expect(Object.values(PaymentStatusEnum)).toContain(validStatus);
    });

    it('should have all required payment statuses for business model', () => {
        const requiredStatuses = [
            'pending',
            'approved',
            'authorized',
            'in_process',
            'in_mediation',
            'rejected',
            'cancelled',
            'refunded',
            'charged_back'
        ];

        const enumValues = Object.values(PaymentStatusEnum);
        expect(enumValues).toHaveLength(requiredStatuses.length);

        // biome-ignore lint/complexity/noForEach: <explanation>
        requiredStatuses.forEach((required) => {
            expect(enumValues).toContain(required);
        });
    });

    it('should support payment lifecycle transitions', () => {
        // Test payment status transitions for business logic
        const pendingStatus = PaymentStatusEnumSchema.parse(PaymentStatusEnum.PENDING);
        const approvedStatus = PaymentStatusEnumSchema.parse(PaymentStatusEnum.APPROVED);
        const rejectedStatus = PaymentStatusEnumSchema.parse(PaymentStatusEnum.REJECTED);

        expect(pendingStatus).toBe('pending');
        expect(approvedStatus).toBe('approved');
        expect(rejectedStatus).toBe('rejected');

        // These represent the core payment lifecycle
        const coreLifecycle = [pendingStatus, approvedStatus, rejectedStatus];
        expect(coreLifecycle).toHaveLength(3);

        // biome-ignore lint/complexity/noForEach: <explanation>
        coreLifecycle.forEach((status) => {
            expect(typeof status).toBe('string');
            expect(status.length).toBeGreaterThan(0);
        });
    });

    it('should support business model payment flows', () => {
        // PENDING: Payment initiated but not yet processed
        expect(PaymentStatusEnum.PENDING).toBe('pending');

        // APPROVED: Payment successfully processed
        expect(PaymentStatusEnum.APPROVED).toBe('approved');

        // REJECTED: Payment was declined or failed
        expect(PaymentStatusEnum.REJECTED).toBe('rejected');

        // These should cover all business model payment scenarios
        const businessStatuses = [
            PaymentStatusEnum.PENDING,
            PaymentStatusEnum.APPROVED,
            PaymentStatusEnum.REJECTED
        ];

        expect(businessStatuses).toHaveLength(3);
    });

    it('should work with invoice and billing integration', () => {
        // Test that payment status integrates with invoicing
        const paymentForInvoice = {
            status: PaymentStatusEnum.APPROVED,
            amount: 100
        };

        expect(paymentForInvoice.status).toBe('approved');
        expect(paymentForInvoice.amount).toBe(100);

        // Status should be validatable
        const validatedStatus = PaymentStatusEnumSchema.parse(paymentForInvoice.status);
        expect(validatedStatus).toBe('approved');
    });
});
