import { describe, expect, it } from 'vitest';
import {
    type PointOfInterestBatchRequest,
    PointOfInterestBatchRequestSchema,
    type PointOfInterestBatchResponse,
    PointOfInterestBatchResponseSchema
} from '../../../src/entities/point-of-interest/point-of-interest.batch.schema.js';
import { createValidPointOfInterest } from '../../fixtures/point-of-interest.fixtures.js';

describe('PointOfInterestBatchRequestSchema', () => {
    describe('valid inputs', () => {
        it('should validate a valid batch request with IDs only', () => {
            const validRequest: PointOfInterestBatchRequest = {
                ids: [
                    '550e8400-e29b-41d4-a716-446655440000',
                    '550e8400-e29b-41d4-a716-446655440001'
                ]
            };

            const result = PointOfInterestBatchRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ids).toHaveLength(2);
                expect(result.data.fields).toBeUndefined();
            }
        });

        it('should validate a valid batch request with IDs and fields', () => {
            const validRequest: PointOfInterestBatchRequest = {
                ids: ['550e8400-e29b-41d4-a716-446655440000'],
                fields: ['id', 'slug', 'nameI18n']
            };

            const result = PointOfInterestBatchRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.fields).toEqual(['id', 'slug', 'nameI18n']);
            }
        });

        it('should validate a batch request with the maximum allowed 100 IDs', () => {
            const ids = Array.from(
                { length: 100 },
                (_, i) => `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`
            );

            const result = PointOfInterestBatchRequestSchema.safeParse({ ids });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ids).toHaveLength(100);
            }
        });
    });

    describe('invalid inputs', () => {
        it('should reject an empty IDs array (min 1)', () => {
            const result = PointOfInterestBatchRequestSchema.safeParse({ ids: [] });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toContain(
                    'At least one point of interest ID is required'
                );
            }
        });

        it('should reject more than 100 IDs (max 100)', () => {
            const ids = Array.from(
                { length: 101 },
                (_, i) => `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`
            );

            const result = PointOfInterestBatchRequestSchema.safeParse({ ids });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toContain(
                    'Maximum 100 point of interest IDs allowed per request'
                );
            }
        });

        it('should reject invalid UUID format in IDs', () => {
            const result = PointOfInterestBatchRequestSchema.safeParse({
                ids: ['invalid-uuid']
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toContain(
                    'Invalid point of interest ID format'
                );
            }
        });

        it('should reject missing ids field', () => {
            const result = PointOfInterestBatchRequestSchema.safeParse({});
            expect(result.success).toBe(false);
        });
    });
});

describe('PointOfInterestBatchResponseSchema', () => {
    it('should validate an empty response array', () => {
        const validResponse: PointOfInterestBatchResponse = [];
        const result = PointOfInterestBatchResponseSchema.safeParse(validResponse);
        expect(result.success).toBe(true);
    });

    it('should validate a response with only null values (not-found items)', () => {
        const validResponse: PointOfInterestBatchResponse = [null, null];
        const result = PointOfInterestBatchResponseSchema.safeParse(validResponse);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.every((item) => item === null)).toBe(true);
        }
    });

    it('should validate a response with a real point-of-interest item requiring only id', () => {
        const poi = createValidPointOfInterest();
        const result = PointOfInterestBatchResponseSchema.safeParse([{ id: poi.id }, null]);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data[0]?.id).toBe(poi.id);
            expect(result.data[1]).toBeNull();
        }
    });

    it('should reject an item missing the required id field', () => {
        const result = PointOfInterestBatchResponseSchema.safeParse([{ slug: 'no-id-here' }]);
        expect(result.success).toBe(false);
    });

    it('should reject non-array input', () => {
        const result = PointOfInterestBatchResponseSchema.safeParse('not-an-array');
        expect(result.success).toBe(false);
    });
});
