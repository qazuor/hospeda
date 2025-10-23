import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';
import { NotificationTypeEnum } from '../../src/enums/notification-type.enum';
import { NotificationTypeSchema } from '../../src/enums/notification-type.schema';

describe('NotificationTypeEnum', () => {
    describe('enum values', () => {
        it('should have correct enum values', () => {
            expect(NotificationTypeEnum.TRIAL_EXPIRING).toBe('TRIAL_EXPIRING');
            expect(NotificationTypeEnum.TRIAL_EXPIRED).toBe('TRIAL_EXPIRED');
            expect(NotificationTypeEnum.PAYMENT_DUE).toBe('PAYMENT_DUE');
            expect(NotificationTypeEnum.PAYMENT_FAILED).toBe('PAYMENT_FAILED');
            expect(NotificationTypeEnum.PAYMENT_SUCCESS).toBe('PAYMENT_SUCCESS');
            expect(NotificationTypeEnum.SUBSCRIPTION_RENEWED).toBe('SUBSCRIPTION_RENEWED');
            expect(NotificationTypeEnum.SUBSCRIPTION_CANCELLED).toBe('SUBSCRIPTION_CANCELLED');
            expect(NotificationTypeEnum.INVOICE_GENERATED).toBe('INVOICE_GENERATED');
            expect(NotificationTypeEnum.SERVICE_ORDER_UPDATE).toBe('SERVICE_ORDER_UPDATE');
            expect(NotificationTypeEnum.CAMPAIGN_STATUS_CHANGE).toBe('CAMPAIGN_STATUS_CHANGE');
            expect(NotificationTypeEnum.LISTING_APPROVED).toBe('LISTING_APPROVED');
            expect(NotificationTypeEnum.LISTING_REJECTED).toBe('LISTING_REJECTED');
            expect(NotificationTypeEnum.SYSTEM_MAINTENANCE).toBe('SYSTEM_MAINTENANCE');
            expect(NotificationTypeEnum.CUSTOM).toBe('CUSTOM');
        });

        it('should have exactly 14 values', () => {
            const values = Object.values(NotificationTypeEnum);
            expect(values).toHaveLength(14);
        });

        it('should contain all expected values', () => {
            const values = Object.values(NotificationTypeEnum);
            expect(values).toEqual(
                expect.arrayContaining([
                    'TRIAL_EXPIRING',
                    'TRIAL_EXPIRED',
                    'PAYMENT_DUE',
                    'PAYMENT_FAILED',
                    'PAYMENT_SUCCESS',
                    'SUBSCRIPTION_RENEWED',
                    'SUBSCRIPTION_CANCELLED',
                    'INVOICE_GENERATED',
                    'SERVICE_ORDER_UPDATE',
                    'CAMPAIGN_STATUS_CHANGE',
                    'LISTING_APPROVED',
                    'LISTING_REJECTED',
                    'SYSTEM_MAINTENANCE',
                    'CUSTOM'
                ])
            );
        });
    });

    describe('NotificationTypeSchema validation', () => {
        it('should validate business notifications', () => {
            expect(NotificationTypeSchema.parse('TRIAL_EXPIRING')).toBe('TRIAL_EXPIRING');
            expect(NotificationTypeSchema.parse('TRIAL_EXPIRED')).toBe('TRIAL_EXPIRED');
            expect(NotificationTypeSchema.parse('PAYMENT_DUE')).toBe('PAYMENT_DUE');
            expect(NotificationTypeSchema.parse('PAYMENT_FAILED')).toBe('PAYMENT_FAILED');
            expect(NotificationTypeSchema.parse('PAYMENT_SUCCESS')).toBe('PAYMENT_SUCCESS');
        });

        it('should validate subscription notifications', () => {
            expect(NotificationTypeSchema.parse('SUBSCRIPTION_RENEWED')).toBe(
                'SUBSCRIPTION_RENEWED'
            );
            expect(NotificationTypeSchema.parse('SUBSCRIPTION_CANCELLED')).toBe(
                'SUBSCRIPTION_CANCELLED'
            );
            expect(NotificationTypeSchema.parse('INVOICE_GENERATED')).toBe('INVOICE_GENERATED');
        });

        it('should validate service and campaign notifications', () => {
            expect(NotificationTypeSchema.parse('SERVICE_ORDER_UPDATE')).toBe(
                'SERVICE_ORDER_UPDATE'
            );
            expect(NotificationTypeSchema.parse('CAMPAIGN_STATUS_CHANGE')).toBe(
                'CAMPAIGN_STATUS_CHANGE'
            );
            expect(NotificationTypeSchema.parse('LISTING_APPROVED')).toBe('LISTING_APPROVED');
            expect(NotificationTypeSchema.parse('LISTING_REJECTED')).toBe('LISTING_REJECTED');
        });

        it('should validate system notifications', () => {
            expect(NotificationTypeSchema.parse('SYSTEM_MAINTENANCE')).toBe('SYSTEM_MAINTENANCE');
            expect(NotificationTypeSchema.parse('CUSTOM')).toBe('CUSTOM');
        });

        it('should reject invalid values', () => {
            expect(() => NotificationTypeSchema.parse('INVALID')).toThrow();
            expect(() => NotificationTypeSchema.parse('')).toThrow();
            expect(() => NotificationTypeSchema.parse(null)).toThrow();
            expect(() => NotificationTypeSchema.parse(undefined)).toThrow();
        });

        it('should have correct error message for invalid values', () => {
            try {
                NotificationTypeSchema.parse('INVALID');
                expect.fail('Should have thrown an error');
            } catch (error) {
                const zodError = error as ZodError;
                expect(zodError.issues[0]?.message).toBe('zodError.enums.notificationType.invalid');
            }
        });
    });
});
