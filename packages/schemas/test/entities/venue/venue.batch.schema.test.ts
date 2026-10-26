import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    VenueBatchRequestSchema,
    VenueBatchResponseSchema
} from '../../../src/entities/venue/venue.batch.schema.js';

describe('GastronomyBatchRequestSchema', () => {
    it('should validate a valid batch request with one ID', () => {
        const data = { ids: [faker.string.uuid()] };
        expect(() => VenueBatchRequestSchema.parse(data)).not.toThrow();
    });

    it('should validate a batch request with multiple IDs', () => {
        const data = {
            ids: [faker.string.uuid(), faker.string.uuid(), faker.string.uuid()]
        };
        expect(() => VenueBatchRequestSchema.parse(data)).not.toThrow();
    });

    it('should validate a batch request with optional fields array', () => {
        const data = {
            ids: [faker.string.uuid()],
            fields: ['id', 'name', 'type']
        };
        expect(() => VenueBatchRequestSchema.parse(data)).not.toThrow();
    });

    it('should reject empty ids array', () => {
        expect(() => VenueBatchRequestSchema.parse({ ids: [] })).toThrow(ZodError);
    });

    it('should reject ids array exceeding 100', () => {
        const data = {
            ids: Array.from({ length: 101 }, () => faker.string.uuid())
        };
        expect(() => VenueBatchRequestSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject invalid UUID in ids', () => {
        expect(() => VenueBatchRequestSchema.parse({ ids: ['not-a-uuid'] })).toThrow(ZodError);
    });
});

describe('GastronomyBatchResponseSchema', () => {
    it('should validate an array with null items (not-found entries)', () => {
        const data = [null, null];
        expect(() => VenueBatchResponseSchema.parse(data)).not.toThrow();
    });
});
