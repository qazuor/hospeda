import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';
import { ServiceOrderStatusEnum } from '../../src/enums/service-order-status.enum';
import { ServiceOrderStatusSchema } from '../../src/enums/service-order-status.schema';

describe('ServiceOrderStatusEnum', () => {
    describe('enum values', () => {
        it('should have correct enum values', () => {
            expect(ServiceOrderStatusEnum.PENDING).toBe('PENDING');
            expect(ServiceOrderStatusEnum.IN_PROGRESS).toBe('IN_PROGRESS');
            expect(ServiceOrderStatusEnum.COMPLETED).toBe('COMPLETED');
            expect(ServiceOrderStatusEnum.CANCELLED).toBe('CANCELLED');
            expect(ServiceOrderStatusEnum.REFUNDED).toBe('REFUNDED');
        });

        it('should have exactly 5 values', () => {
            const values = Object.values(ServiceOrderStatusEnum);
            expect(values).toHaveLength(5);
        });

        it('should contain all expected values', () => {
            const values = Object.values(ServiceOrderStatusEnum);
            expect(values).toEqual(
                expect.arrayContaining([
                    'PENDING',
                    'IN_PROGRESS',
                    'COMPLETED',
                    'CANCELLED',
                    'REFUNDED'
                ])
            );
        });
    });

    describe('ServiceOrderStatusSchema validation', () => {
        it('should validate correct enum values', () => {
            expect(ServiceOrderStatusSchema.parse('PENDING')).toBe('PENDING');
            expect(ServiceOrderStatusSchema.parse('IN_PROGRESS')).toBe('IN_PROGRESS');
            expect(ServiceOrderStatusSchema.parse('COMPLETED')).toBe('COMPLETED');
            expect(ServiceOrderStatusSchema.parse('CANCELLED')).toBe('CANCELLED');
            expect(ServiceOrderStatusSchema.parse('REFUNDED')).toBe('REFUNDED');
        });

        it('should reject invalid values', () => {
            expect(() => ServiceOrderStatusSchema.parse('INVALID')).toThrow();
            expect(() => ServiceOrderStatusSchema.parse('')).toThrow();
            expect(() => ServiceOrderStatusSchema.parse(null)).toThrow();
            expect(() => ServiceOrderStatusSchema.parse(undefined)).toThrow();
        });

        it('should have correct error message for invalid values', () => {
            try {
                ServiceOrderStatusSchema.parse('INVALID');
                expect.fail('Should have thrown an error');
            } catch (error) {
                const zodError = error as ZodError;
                expect(zodError.issues[0]?.message).toBe(
                    'zodError.enums.serviceOrderStatus.invalid'
                );
            }
        });
    });
});
