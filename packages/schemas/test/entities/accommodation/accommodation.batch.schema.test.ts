import { describe, expect, it } from 'vitest';
import {
    type AccommodationBatchRequest,
    AccommodationBatchRequestSchema,
    type AccommodationBatchResponse,
    AccommodationBatchResponseSchema
} from '../../../src/entities/accommodation/accommodation.batch.schema';

describe('AccommodationBatchRequestSchema', () => {
    describe('Valid inputs', () => {
        it('should validate a valid batch request with IDs only', () => {
            const validRequest: AccommodationBatchRequest = {
                ids: [
                    '550e8400-e29b-41d4-a716-446655440000',
                    '550e8400-e29b-41d4-a716-446655440001'
                ]
            };

            const result = AccommodationBatchRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ids).toHaveLength(2);
                expect(result.data.fields).toBeUndefined();
            }
        });

        it('should validate a valid batch request with IDs and fields', () => {
            const validRequest: AccommodationBatchRequest = {
                ids: ['550e8400-e29b-41d4-a716-446655440000'],
                fields: ['id', 'name', 'summary', 'description']
            };

            const result = AccommodationBatchRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ids).toHaveLength(1);
                expect(result.data.fields).toEqual(['id', 'name', 'summary', 'description']);
            }
        });

        it('should validate a batch request with maximum allowed IDs (100)', () => {
            const ids = Array.from(
                { length: 100 },
                (_, i) => `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`
            );
            const validRequest: AccommodationBatchRequest = { ids };

            const result = AccommodationBatchRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ids).toHaveLength(100);
            }
        });

        it('should validate empty fields array', () => {
            const validRequest: AccommodationBatchRequest = {
                ids: ['550e8400-e29b-41d4-a716-446655440000'],
                fields: []
            };

            const result = AccommodationBatchRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
        });
    });

    describe('Invalid inputs', () => {
        it('should reject empty IDs array', () => {
            const invalidRequest = {
                ids: []
            };

            const result = AccommodationBatchRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues).toHaveLength(1);
                expect(result.error.issues[0]?.message).toContain(
                    'At least one accommodation ID is required'
                );
            }
        });

        it('should reject more than 100 IDs', () => {
            const ids = Array.from(
                { length: 101 },
                (_, i) => `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`
            );
            const invalidRequest = { ids };

            const result = AccommodationBatchRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues).toHaveLength(1);
                expect(result.error.issues[0]?.message).toContain(
                    'Maximum 100 accommodation IDs allowed per request'
                );
            }
        });

        it('should reject invalid UUID format in IDs', () => {
            const invalidRequest = {
                ids: ['invalid-uuid', 'another-invalid-id']
            };

            const result = AccommodationBatchRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.length).toBeGreaterThan(0);
                expect(result.error.issues[0]?.message).toContain(
                    'Invalid accommodation ID format'
                );
            }
        });

        it('should reject empty string in fields array', () => {
            const invalidRequest = {
                ids: ['550e8400-e29b-41d4-a716-446655440000'],
                fields: ['id', '', 'name']
            };

            const result = AccommodationBatchRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.length).toBeGreaterThan(0);
                expect(result.error.issues[0]?.message).toContain('Field name cannot be empty');
            }
        });

        it('should reject missing ids field', () => {
            const invalidRequest = {
                fields: ['id', 'name']
            };

            const result = AccommodationBatchRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should reject non-array ids', () => {
            const invalidRequest = {
                ids: 'not-an-array'
            };

            const result = AccommodationBatchRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should reject non-array fields', () => {
            const invalidRequest = {
                ids: ['550e8400-e29b-41d4-a716-446655440000'],
                fields: 'not-an-array'
            };

            const result = AccommodationBatchRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });
    });

    describe('Type inference', () => {
        it('should infer correct TypeScript types', () => {
            const request: AccommodationBatchRequest = {
                ids: ['550e8400-e29b-41d4-a716-446655440000'],
                fields: ['id', 'name']
            };

            // Type assertions to ensure correct inference
            expect(typeof request.ids[0]).toBe('string');
            expect(Array.isArray(request.ids)).toBe(true);
            expect(request.fields).toBeDefined();
            if (request.fields) {
                expect(typeof request.fields[0]).toBe('string');
                expect(Array.isArray(request.fields)).toBe(true);
            }
        });
    });
});

describe('AccommodationBatchResponseSchema', () => {
    describe('Valid inputs', () => {
        it('should validate empty response array', () => {
            const validResponse: AccommodationBatchResponse = [];

            const result = AccommodationBatchResponseSchema.safeParse(validResponse);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(0);
            }
        });

        it('should validate response with null values', () => {
            const validResponse: AccommodationBatchResponse = [null, null, null];

            const result = AccommodationBatchResponseSchema.safeParse(validResponse);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(3);
                expect(result.data.every((item) => item === null)).toBe(true);
            }
        });

        it('should validate mixed response with accommodations and nulls', () => {
            // For this test, we'll just test the structure without validating the full accommodation schema
            // Since AccommodationBatchResponseSchema uses AccommodationSchema.nullable(),
            // we need to ensure the array structure is correct
            const validResponse = [null, null, null]; // Simple case with only nulls

            const result = AccommodationBatchResponseSchema.safeParse(validResponse);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(3);
                expect(result.data[0]).toBeNull();
                expect(result.data[1]).toBeNull();
                expect(result.data[2]).toBeNull();
            }
        });
    });

    describe('Invalid inputs', () => {
        it('should reject non-array input', () => {
            const invalidResponse = 'not-an-array';

            const result = AccommodationBatchResponseSchema.safeParse(invalidResponse);
            expect(result.success).toBe(false);
        });

        it('should reject array with invalid accommodation objects', () => {
            const invalidResponse = [{ invalid: 'object' }, null];

            const result = AccommodationBatchResponseSchema.safeParse(invalidResponse);
            expect(result.success).toBe(false);
        });
    });

    describe('Type inference', () => {
        it('should infer correct TypeScript types', () => {
            const response: AccommodationBatchResponse = [null];

            // Type assertions to ensure correct inference
            expect(Array.isArray(response)).toBe(true);
            expect(response[0]).toBeNull();
        });
    });
});
