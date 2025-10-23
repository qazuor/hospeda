import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';

import { NotificationRecipientTypeEnum } from '../../src/enums/notification-recipient-type.enum.js';
import { NotificationRecipientTypeSchema } from '../../src/enums/notification-recipient-type.schema.js';

describe('NotificationRecipientTypeEnum', () => {
    it('should have correct enum values', () => {
        expect(NotificationRecipientTypeEnum.USER).toBe('USER');
        expect(NotificationRecipientTypeEnum.CLIENT).toBe('CLIENT');
    });

    it('should have only expected enum values', () => {
        const values = Object.values(NotificationRecipientTypeEnum);
        expect(values).toHaveLength(2);
        expect(values).toEqual(['USER', 'CLIENT']);
    });
});

describe('NotificationRecipientTypeSchema', () => {
    it('should validate valid notification recipient types', () => {
        expect(NotificationRecipientTypeSchema.parse('USER')).toBe('USER');
        expect(NotificationRecipientTypeSchema.parse('CLIENT')).toBe('CLIENT');
    });

    it('should reject invalid notification recipient types', () => {
        expect(() => NotificationRecipientTypeSchema.parse('INVALID')).toThrow();
        expect(() => NotificationRecipientTypeSchema.parse('')).toThrow();
        expect(() => NotificationRecipientTypeSchema.parse(null)).toThrow();
        expect(() => NotificationRecipientTypeSchema.parse(undefined)).toThrow();
    });

    it('should have correct error message for invalid values', () => {
        try {
            NotificationRecipientTypeSchema.parse('INVALID');
            expect.fail('Should have thrown an error');
        } catch (error) {
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe(
                'zodError.enums.notificationRecipientType.invalid'
            );
        }
    });
});
