import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    GastronomyBatchRequestSchema,
    GastronomyBatchResponseSchema
} from '../../../src/entities/gastronomy/gastronomy.batch.schema.js';

describe('GastronomyBatchRequestSchema', () => {
    it('should validate a valid batch request with one ID', () => {
        const data = { ids: [faker.string.uuid()] };
        expect(() => GastronomyBatchRequestSchema.parse(data)).not.toThrow();
    });

    it('should validate a batch request with multiple IDs', () => {
        const data = {
            ids: [faker.string.uuid(), faker.string.uuid(), faker.string.uuid()]
        };
        expect(() => GastronomyBatchRequestSchema.parse(data)).not.toThrow();
    });

    it('should validate a batch request with optional fields array', () => {
        const data = {
            ids: [faker.string.uuid()],
            fields: ['id', 'name', 'type']
        };
        expect(() => GastronomyBatchRequestSchema.parse(data)).not.toThrow();
    });

    it('should reject empty ids array', () => {
        expect(() => GastronomyBatchRequestSchema.parse({ ids: [] })).toThrow(ZodError);
    });

    it('should reject ids array exceeding 100', () => {
        const data = {
            ids: Array.from({ length: 101 }, () => faker.string.uuid())
        };
        expect(() => GastronomyBatchRequestSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject invalid UUID in ids', () => {
        expect(() => GastronomyBatchRequestSchema.parse({ ids: ['not-a-uuid'] })).toThrow(ZodError);
    });
});

describe('GastronomyBatchResponseSchema', () => {
    it('should validate an array with null items (not-found entries)', () => {
        const data = [null, null];
        expect(() => GastronomyBatchResponseSchema.parse(data)).not.toThrow();
    });
});
