import { faker } from '@faker-js/faker';
import { VisibilityEnum } from '@repo/types';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    WithAccommodationIdParamsSchema,
    WithDateRangeParamsSchema,
    WithEventIdParamsSchema,
    WithVisibilityParamsSchema
} from '../../src/common/params.schema.js';

describe('Common Params Schemas', () => {
    describe('WithAccommodationIdParamsSchema', () => {
        it('should validate valid accommodation ID', () => {
            const validParams = {
                accommodationId: faker.string.uuid()
            };

            expect(() => WithAccommodationIdParamsSchema.parse(validParams)).not.toThrow();

            const parsed = WithAccommodationIdParamsSchema.parse(validParams);
            expect(parsed.accommodationId).toBe(validParams.accommodationId);
        });

        it('should reject invalid accommodation ID', () => {
            const invalidParams = {
                accommodationId: 'not-a-uuid'
            };

            expect(() => WithAccommodationIdParamsSchema.parse(invalidParams)).toThrow(ZodError);
        });

        it('should reject missing accommodation ID', () => {
            const invalidParams = {};

            expect(() => WithAccommodationIdParamsSchema.parse(invalidParams)).toThrow(ZodError);
        });
    });

    describe('WithEventIdParamsSchema', () => {
        it('should validate valid event ID', () => {
            const validParams = {
                eventId: faker.string.uuid()
            };

            expect(() => WithEventIdParamsSchema.parse(validParams)).not.toThrow();

            const parsed = WithEventIdParamsSchema.parse(validParams);
            expect(parsed.eventId).toBe(validParams.eventId);
        });

        it('should reject invalid event ID', () => {
            const invalidParams = {
                eventId: 'not-a-uuid'
            };

            expect(() => WithEventIdParamsSchema.parse(invalidParams)).toThrow(ZodError);
        });

        it('should reject missing event ID', () => {
            const invalidParams = {};

            expect(() => WithEventIdParamsSchema.parse(invalidParams)).toThrow(ZodError);
        });
    });

    describe('WithVisibilityParamsSchema', () => {
        it('should validate valid visibility values', () => {
            const visibilityValues = Object.values(VisibilityEnum);

            for (const visibility of visibilityValues) {
                const validParams = { visibility };
                expect(() => WithVisibilityParamsSchema.parse(validParams)).not.toThrow();

                const parsed = WithVisibilityParamsSchema.parse(validParams);
                expect(parsed.visibility).toBe(visibility);
            }
        });

        it('should validate empty object (visibility is optional)', () => {
            const validParams = {};

            expect(() => WithVisibilityParamsSchema.parse(validParams)).not.toThrow();

            const parsed = WithVisibilityParamsSchema.parse(validParams);
            expect(parsed.visibility).toBeUndefined();
        });

        it('should reject invalid visibility value', () => {
            const invalidParams = {
                visibility: 'INVALID_VISIBILITY'
            };

            expect(() => WithVisibilityParamsSchema.parse(invalidParams)).toThrow(ZodError);
        });
    });

    describe('WithDateRangeParamsSchema', () => {
        it('should validate valid date range', () => {
            const fromDate = faker.date.past();
            const toDate = faker.date.future();
            const validParams = {
                fromDate,
                toDate
            };

            expect(() => WithDateRangeParamsSchema.parse(validParams)).not.toThrow();

            const parsed = WithDateRangeParamsSchema.parse(validParams);
            expect(parsed.fromDate).toEqual(fromDate);
            expect(parsed.toDate).toEqual(toDate);
        });

        it('should validate with only fromDate', () => {
            const fromDate = faker.date.past();
            const validParams = { fromDate };

            expect(() => WithDateRangeParamsSchema.parse(validParams)).not.toThrow();

            const parsed = WithDateRangeParamsSchema.parse(validParams);
            expect(parsed.fromDate).toEqual(fromDate);
            expect(parsed.toDate).toBeUndefined();
        });

        it('should validate with only toDate', () => {
            const toDate = faker.date.future();
            const validParams = { toDate };

            expect(() => WithDateRangeParamsSchema.parse(validParams)).not.toThrow();

            const parsed = WithDateRangeParamsSchema.parse(validParams);
            expect(parsed.fromDate).toBeUndefined();
            expect(parsed.toDate).toEqual(toDate);
        });

        it('should validate empty object (both dates are optional)', () => {
            const validParams = {};

            expect(() => WithDateRangeParamsSchema.parse(validParams)).not.toThrow();

            const parsed = WithDateRangeParamsSchema.parse(validParams);
            expect(parsed.fromDate).toBeUndefined();
            expect(parsed.toDate).toBeUndefined();
        });

        it('should reject invalid date types', () => {
            const invalidParams = {
                fromDate: 'not-a-date',
                toDate: 'also-not-a-date'
            };

            expect(() => WithDateRangeParamsSchema.parse(invalidParams)).toThrow(ZodError);
        });
    });
});
