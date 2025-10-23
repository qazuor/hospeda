import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { SubscriptionStatusEnum } from '../../src/enums/index.js';
import { SubscriptionStatusEnumSchema } from '../../src/enums/subscription-status.schema.js';

describe('SubscriptionStatusEnumSchema - Business Model Spec', () => {
    it('should validate valid subscription status values', () => {
        // Test each enum value
        // biome-ignore lint/complexity/noForEach: <explanation>
        Object.values(SubscriptionStatusEnum).forEach((status) => {
            expect(() => SubscriptionStatusEnumSchema.parse(status)).not.toThrow();
        });
    });

    it('should validate ACTIVE subscription status', () => {
        expect(() =>
            SubscriptionStatusEnumSchema.parse(SubscriptionStatusEnum.ACTIVE)
        ).not.toThrow();
    });

    it('should validate PAST_DUE subscription status', () => {
        expect(() =>
            SubscriptionStatusEnumSchema.parse(SubscriptionStatusEnum.PAST_DUE)
        ).not.toThrow();
    });

    it('should validate CANCELLED subscription status', () => {
        expect(() =>
            SubscriptionStatusEnumSchema.parse(SubscriptionStatusEnum.CANCELLED)
        ).not.toThrow();
    });

    it('should validate EXPIRED subscription status', () => {
        expect(() =>
            SubscriptionStatusEnumSchema.parse(SubscriptionStatusEnum.EXPIRED)
        ).not.toThrow();
    });

    it('should reject invalid subscription status values', () => {
        const invalidStatuses = [
            'invalid-status',
            'PENDING', // Not in business model spec
            'PAUSED', // Not in business model spec
            'TRIAL',
            'SUSPENDED',
            '',
            null,
            undefined,
            123,
            {},
            []
        ];

        // biome-ignore lint/complexity/noForEach: <explanation>
        invalidStatuses.forEach((status) => {
            expect(() => SubscriptionStatusEnumSchema.parse(status)).toThrow(ZodError);
        });
    });

    it('should provide appropriate error message for invalid values', () => {
        try {
            SubscriptionStatusEnumSchema.parse('invalid-status');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe('zodError.enums.subscriptionStatus.invalid');
        }
    });

    it('should infer correct TypeScript type', () => {
        const validStatus = SubscriptionStatusEnumSchema.parse(SubscriptionStatusEnum.ACTIVE);

        // TypeScript should infer this as SubscriptionStatusEnum
        expect(typeof validStatus).toBe('string');
        expect(Object.values(SubscriptionStatusEnum)).toContain(validStatus);
    });

    it('should have all required subscription statuses for business model', () => {
        const requiredStatuses = [
            'active',
            'paused',
            'past_due',
            'cancelled',
            'expired',
            'pending'
        ];

        const enumValues = Object.values(SubscriptionStatusEnum);
        expect(enumValues).toHaveLength(requiredStatuses.length);

        // biome-ignore lint/complexity/noForEach: <explanation>
        requiredStatuses.forEach((required) => {
            expect(enumValues).toContain(required);
        });
    });

    it('should support subscription lifecycle transitions', () => {
        // Test subscription status transitions for business logic
        const activeStatus = SubscriptionStatusEnumSchema.parse(SubscriptionStatusEnum.ACTIVE);
        const pastDueStatus = SubscriptionStatusEnumSchema.parse(SubscriptionStatusEnum.PAST_DUE);
        const cancelledStatus = SubscriptionStatusEnumSchema.parse(
            SubscriptionStatusEnum.CANCELLED
        );
        const expiredStatus = SubscriptionStatusEnumSchema.parse(SubscriptionStatusEnum.EXPIRED);

        expect(activeStatus).toBe('active');
        expect(pastDueStatus).toBe('past_due');
        expect(cancelledStatus).toBe('cancelled');
        expect(expiredStatus).toBe('expired');

        // These represent the complete subscription lifecycle
        const lifecycle = [activeStatus, pastDueStatus, cancelledStatus, expiredStatus];
        expect(lifecycle).toHaveLength(4);
    });
});
