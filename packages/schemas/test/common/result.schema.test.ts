import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AssignmentResultSchema,
    DeleteResultSchema,
    RemovalResultSchema,
    RestoreResultSchema,
    SuccessSchema
} from '../../src/common/result.schema.js';

describe('Result Schemas', () => {
    describe('SuccessSchema', () => {
        it('should validate success result', () => {
            const result = {
                success: true
            };

            expect(() => SuccessSchema.parse(result)).not.toThrow();

            const parsed = SuccessSchema.parse(result);
            expect(parsed.success).toBe(true);
        });

        it('should use default value for success', () => {
            const result = {};

            expect(() => SuccessSchema.parse(result)).not.toThrow();

            const parsed = SuccessSchema.parse(result);
            expect(parsed.success).toBe(true); // Default value
        });

        it('should reject invalid success type', () => {
            const result = {
                success: 'not-boolean'
            };

            expect(() => SuccessSchema.parse(result)).toThrow(ZodError);
        });
    });

    describe('AssignmentResultSchema', () => {
        it('should validate assignment result with true', () => {
            const result = {
                assigned: true
            };

            expect(() => AssignmentResultSchema.parse(result)).not.toThrow();

            const parsed = AssignmentResultSchema.parse(result);
            expect(parsed.assigned).toBe(true);
        });

        it('should validate assignment result with false', () => {
            const result = {
                assigned: false
            };

            expect(() => AssignmentResultSchema.parse(result)).not.toThrow();

            const parsed = AssignmentResultSchema.parse(result);
            expect(parsed.assigned).toBe(false);
        });

        it('should use default value for assigned', () => {
            const result = {};

            expect(() => AssignmentResultSchema.parse(result)).not.toThrow();

            const parsed = AssignmentResultSchema.parse(result);
            expect(parsed.assigned).toBe(true); // Default value
        });

        it('should reject invalid assigned type', () => {
            const result = {
                assigned: 'not-boolean'
            };

            expect(() => AssignmentResultSchema.parse(result)).toThrow(ZodError);
        });
    });

    describe('RemovalResultSchema', () => {
        it('should validate removal result with true', () => {
            const result = {
                removed: true
            };

            expect(() => RemovalResultSchema.parse(result)).not.toThrow();

            const parsed = RemovalResultSchema.parse(result);
            expect(parsed.removed).toBe(true);
        });

        it('should validate removal result with false', () => {
            const result = {
                removed: false
            };

            expect(() => RemovalResultSchema.parse(result)).not.toThrow();

            const parsed = RemovalResultSchema.parse(result);
            expect(parsed.removed).toBe(false);
        });

        it('should use default value for removed', () => {
            const result = {};

            expect(() => RemovalResultSchema.parse(result)).not.toThrow();

            const parsed = RemovalResultSchema.parse(result);
            expect(parsed.removed).toBe(true); // Default value
        });

        it('should reject invalid removed type', () => {
            const result = {
                removed: 'not-boolean'
            };

            expect(() => RemovalResultSchema.parse(result)).toThrow(ZodError);
        });
    });

    describe('DeleteResultSchema', () => {
        it('should validate delete result with success only', () => {
            const result = {
                success: true
            };

            expect(() => DeleteResultSchema.parse(result)).not.toThrow();

            const parsed = DeleteResultSchema.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.deletedAt).toBeUndefined();
        });

        it('should validate delete result with deletedAt', () => {
            const deletedAt = faker.date.recent();
            const result = {
                success: true,
                deletedAt
            };

            expect(() => DeleteResultSchema.parse(result)).not.toThrow();

            const parsed = DeleteResultSchema.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.deletedAt).toEqual(deletedAt);
        });

        it('should use default success value', () => {
            const result = {};

            expect(() => DeleteResultSchema.parse(result)).not.toThrow();

            const parsed = DeleteResultSchema.parse(result);
            expect(parsed.success).toBe(true); // Default value
        });
    });

    describe('RestoreResultSchema', () => {
        it('should validate restore result with success only', () => {
            const result = {
                success: true
            };

            expect(() => RestoreResultSchema.parse(result)).not.toThrow();

            const parsed = RestoreResultSchema.parse(result);
            expect(parsed.success).toBe(true);
        });

        it('should validate restore result with success false', () => {
            const result = {
                success: false
            };

            expect(() => RestoreResultSchema.parse(result)).not.toThrow();

            const parsed = RestoreResultSchema.parse(result);
            expect(parsed.success).toBe(false);
        });

        it('should use default success value', () => {
            const result = {};

            expect(() => RestoreResultSchema.parse(result)).not.toThrow();

            const parsed = RestoreResultSchema.parse(result);
            expect(parsed.success).toBe(true); // Default value
        });
    });
});
