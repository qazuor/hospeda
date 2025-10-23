import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { SubscriptionItemSourceTypeEnum } from '../../src/enums/index.js';
import { SubscriptionItemSourceTypeEnumSchema } from '../../src/enums/subscription-item-source-type.schema.js';

describe('SubscriptionItemSourceTypeEnumSchema', () => {
    it('should validate valid subscription item source type values', () => {
        // Test each enum value
        // biome-ignore lint/complexity/noForEach: <explanation>
        Object.values(SubscriptionItemSourceTypeEnum).forEach((sourceType) => {
            expect(() => SubscriptionItemSourceTypeEnumSchema.parse(sourceType)).not.toThrow();
        });
    });

    it('should validate SUBSCRIPTION source type', () => {
        expect(() =>
            SubscriptionItemSourceTypeEnumSchema.parse(SubscriptionItemSourceTypeEnum.SUBSCRIPTION)
        ).not.toThrow();
    });

    it('should validate PURCHASE source type', () => {
        expect(() =>
            SubscriptionItemSourceTypeEnumSchema.parse(SubscriptionItemSourceTypeEnum.PURCHASE)
        ).not.toThrow();
    });

    it('should reject invalid subscription item source type values', () => {
        const invalidSourceTypes = [
            'invalid-source-type',
            'ORDER', // Not in this enum
            'PAYMENT',
            'INVOICE',
            'TRIAL',
            '',
            null,
            undefined,
            123,
            {},
            []
        ];

        // biome-ignore lint/complexity/noForEach: <explanation>
        invalidSourceTypes.forEach((sourceType) => {
            expect(() => SubscriptionItemSourceTypeEnumSchema.parse(sourceType)).toThrow(ZodError);
        });
    });

    it('should provide appropriate error message for invalid values', () => {
        try {
            SubscriptionItemSourceTypeEnumSchema.parse('invalid-source-type');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe(
                'zodError.enums.subscriptionItemSourceType.invalid'
            );
        }
    });

    it('should infer correct TypeScript type', () => {
        const validSourceType = SubscriptionItemSourceTypeEnumSchema.parse(
            SubscriptionItemSourceTypeEnum.SUBSCRIPTION
        );

        // TypeScript should infer this as SubscriptionItemSourceTypeEnum
        expect(typeof validSourceType).toBe('string');
        expect(Object.values(SubscriptionItemSourceTypeEnum)).toContain(validSourceType);
    });

    it('should have all required source types for polymorphic system', () => {
        const requiredSourceTypes = ['subscription', 'purchase'];

        const enumValues = Object.values(SubscriptionItemSourceTypeEnum);
        expect(enumValues).toHaveLength(requiredSourceTypes.length);

        // biome-ignore lint/complexity/noForEach: <explanation>
        requiredSourceTypes.forEach((required) => {
            expect(enumValues).toContain(required);
        });
    });

    it('should support polymorphic subscription item creation', () => {
        // Test that source types work with polymorphic system
        const subscriptionSource = SubscriptionItemSourceTypeEnumSchema.parse(
            SubscriptionItemSourceTypeEnum.SUBSCRIPTION
        );
        const purchaseSource = SubscriptionItemSourceTypeEnumSchema.parse(
            SubscriptionItemSourceTypeEnum.PURCHASE
        );

        expect(subscriptionSource).toBe('subscription');
        expect(purchaseSource).toBe('purchase');

        // These will be used to determine the source of a subscription item
        const sources = [subscriptionSource, purchaseSource];
        expect(sources).toHaveLength(2);

        // biome-ignore lint/complexity/noForEach: <explanation>
        sources.forEach((source) => {
            expect(typeof source).toBe('string');
            expect(source.length).toBeGreaterThan(0);
        });
    });
});
