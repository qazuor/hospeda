import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';

import { NotificationChannelEnum } from '../../src/enums/notification-channel.enum.js';
import { NotificationChannelSchema } from '../../src/enums/notification-channel.schema.js';

describe('NotificationChannelEnum', () => {
    it('should have correct enum values', () => {
        expect(NotificationChannelEnum.EMAIL).toBe('EMAIL');
        expect(NotificationChannelEnum.SMS).toBe('SMS');
        expect(NotificationChannelEnum.PUSH).toBe('PUSH');
        expect(NotificationChannelEnum.IN_APP).toBe('IN_APP');
    });

    it('should have only expected enum values', () => {
        const values = Object.values(NotificationChannelEnum);
        expect(values).toHaveLength(4);
        expect(values).toEqual(['EMAIL', 'SMS', 'PUSH', 'IN_APP']);
    });
});

describe('NotificationChannelSchema', () => {
    it('should validate valid notification channels', () => {
        expect(NotificationChannelSchema.parse('EMAIL')).toBe('EMAIL');
        expect(NotificationChannelSchema.parse('SMS')).toBe('SMS');
        expect(NotificationChannelSchema.parse('PUSH')).toBe('PUSH');
        expect(NotificationChannelSchema.parse('IN_APP')).toBe('IN_APP');
    });

    it('should reject invalid notification channels', () => {
        expect(() => NotificationChannelSchema.parse('INVALID')).toThrow();
        expect(() => NotificationChannelSchema.parse('')).toThrow();
        expect(() => NotificationChannelSchema.parse(null)).toThrow();
        expect(() => NotificationChannelSchema.parse(undefined)).toThrow();
    });

    it('should have correct error message for invalid values', () => {
        try {
            NotificationChannelSchema.parse('INVALID');
            expect.fail('Should have thrown an error');
        } catch (error) {
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe('zodError.enums.notificationChannel.invalid');
        }
    });
});
