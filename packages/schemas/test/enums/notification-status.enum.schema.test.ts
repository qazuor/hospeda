import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';

import { NotificationStatusEnum } from '../../src/enums/notification-status.enum.js';
import { NotificationStatusSchema } from '../../src/enums/notification-status.schema.js';

describe('NotificationStatusEnum', () => {
    it('should have correct enum values', () => {
        expect(NotificationStatusEnum.PENDING).toBe('PENDING');
        expect(NotificationStatusEnum.SENT).toBe('SENT');
        expect(NotificationStatusEnum.DELIVERED).toBe('DELIVERED');
        expect(NotificationStatusEnum.FAILED).toBe('FAILED');
        expect(NotificationStatusEnum.READ).toBe('READ');
    });

    it('should have only expected enum values', () => {
        const values = Object.values(NotificationStatusEnum);
        expect(values).toHaveLength(5);
        expect(values).toEqual(['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ']);
    });
});

describe('NotificationStatusSchema', () => {
    it('should validate valid notification statuses', () => {
        expect(NotificationStatusSchema.parse('PENDING')).toBe('PENDING');
        expect(NotificationStatusSchema.parse('SENT')).toBe('SENT');
        expect(NotificationStatusSchema.parse('DELIVERED')).toBe('DELIVERED');
        expect(NotificationStatusSchema.parse('FAILED')).toBe('FAILED');
        expect(NotificationStatusSchema.parse('READ')).toBe('READ');
    });

    it('should reject invalid notification statuses', () => {
        expect(() => NotificationStatusSchema.parse('INVALID')).toThrow();
        expect(() => NotificationStatusSchema.parse('')).toThrow();
        expect(() => NotificationStatusSchema.parse(null)).toThrow();
        expect(() => NotificationStatusSchema.parse(undefined)).toThrow();
    });

    it('should have correct error message for invalid values', () => {
        try {
            NotificationStatusSchema.parse('INVALID');
            expect.fail('Should have thrown an error');
        } catch (error) {
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe('zodError.enums.notificationStatus.invalid');
        }
    });
});
