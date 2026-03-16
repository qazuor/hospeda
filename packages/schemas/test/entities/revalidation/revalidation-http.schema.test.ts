import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    ManualRevalidateRequestSchema,
    RevalidateEntityRequestSchema,
    RevalidateTypeRequestSchema,
    RevalidationResponseSchema,
    RevalidationStatsSchema
} from '../../../src/entities/revalidation/revalidation.http.schema.js';

// ---------------------------------------------------------------------------
// ManualRevalidateRequestSchema
// ---------------------------------------------------------------------------

describe('ManualRevalidateRequestSchema', () => {
    describe('Valid data', () => {
        it('should validate a request with a single path', () => {
            const data = { paths: ['/en/accommodations/hotel-palace'] };
            const result = ManualRevalidateRequestSchema.parse(data);
            expect(result.paths).toHaveLength(1);
            expect(result.paths[0]).toBe('/en/accommodations/hotel-palace');
        });

        it('should validate a request with multiple paths', () => {
            const data = {
                paths: [
                    '/en/accommodations/hotel-palace',
                    '/es/alojamientos/hotel-palace',
                    '/pt/acomodacoes/hotel-palace'
                ]
            };
            const result = ManualRevalidateRequestSchema.parse(data);
            expect(result.paths).toHaveLength(3);
        });

        it('should validate a request with an optional reason', () => {
            const data = {
                paths: ['/en/destinations/litoral'],
                reason: 'Content updated by editor'
            };
            const result = ManualRevalidateRequestSchema.parse(data);
            expect(result.reason).toBe('Content updated by editor');
        });

        it('should validate a request without reason (optional)', () => {
            const data = { paths: ['/en/events/festival-2024'] };
            const result = ManualRevalidateRequestSchema.safeParse(data);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.reason).toBeUndefined();
            }
        });

        it('should accept exactly 100 paths (maximum boundary)', () => {
            const paths = Array.from({ length: 100 }, (_, i) => `/path-${i}`);
            const result = ManualRevalidateRequestSchema.safeParse({ paths });
            expect(result.success).toBe(true);
        });

        it('should accept reason up to 500 characters (maximum boundary)', () => {
            const data = {
                paths: ['/en/test'],
                reason: 'A'.repeat(500)
            };
            expect(ManualRevalidateRequestSchema.safeParse(data).success).toBe(true);
        });
    });

    describe('Invalid data', () => {
        it('should reject empty paths array', () => {
            const data = { paths: [] };
            const result = ManualRevalidateRequestSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject more than 100 paths', () => {
            const paths = Array.from({ length: 101 }, (_, i) => `/path-${i}`);
            const result = ManualRevalidateRequestSchema.safeParse({ paths });
            expect(result.success).toBe(false);
        });

        it('should reject paths containing empty strings', () => {
            const data = { paths: [''] };
            const result = ManualRevalidateRequestSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject reason exceeding 500 characters', () => {
            const data = {
                paths: ['/en/test'],
                reason: 'A'.repeat(501)
            };
            expect(ManualRevalidateRequestSchema.safeParse(data).success).toBe(false);
        });

        it('should reject missing paths field', () => {
            const result = ManualRevalidateRequestSchema.safeParse({});
            expect(result.success).toBe(false);
        });

        it('should throw ZodError when using .parse() with invalid input', () => {
            expect(() => ManualRevalidateRequestSchema.parse({ paths: [] })).toThrow(ZodError);
        });
    });
});

// ---------------------------------------------------------------------------
// RevalidateEntityRequestSchema
// ---------------------------------------------------------------------------

describe('RevalidateEntityRequestSchema', () => {
    describe('Valid data', () => {
        it('should validate a request with entityType and entityId', () => {
            const data = {
                entityType: 'accommodation' as const,
                entityId: 'some-entity-uuid'
            };
            const result = RevalidateEntityRequestSchema.parse(data);
            expect(result.entityType).toBe('accommodation');
            expect(result.entityId).toBe('some-entity-uuid');
        });

        it('should validate all valid entity types', () => {
            const validTypes = [
                'accommodation',
                'destination',
                'event',
                'post',
                'accommodation_review',
                'destination_review',
                'tag',
                'amenity'
            ] as const;
            for (const entityType of validTypes) {
                const result = RevalidateEntityRequestSchema.safeParse({
                    entityType,
                    entityId: 'abc-123'
                });
                expect(result.success).toBe(true);
            }
        });

        it('should validate a request with an optional reason', () => {
            const data = {
                entityType: 'event' as const,
                entityId: 'event-id-456',
                reason: 'Event was updated'
            };
            const result = RevalidateEntityRequestSchema.parse(data);
            expect(result.reason).toBe('Event was updated');
        });

        it('should validate without reason (optional)', () => {
            const data = { entityType: 'tag' as const, entityId: 'tag-id-789' };
            expect(RevalidateEntityRequestSchema.safeParse(data).success).toBe(true);
        });

        it('should accept reason up to 500 characters', () => {
            const data = {
                entityType: 'post' as const,
                entityId: 'post-id-abc',
                reason: 'B'.repeat(500)
            };
            expect(RevalidateEntityRequestSchema.safeParse(data).success).toBe(true);
        });
    });

    describe('Invalid data', () => {
        it('should reject an invalid entityType', () => {
            const data = { entityType: 'user', entityId: 'user-id-123' };
            expect(RevalidateEntityRequestSchema.safeParse(data).success).toBe(false);
        });

        it('should reject an empty entityId', () => {
            const data = { entityType: 'accommodation' as const, entityId: '' };
            expect(RevalidateEntityRequestSchema.safeParse(data).success).toBe(false);
        });

        it('should reject a missing entityId', () => {
            const data = { entityType: 'accommodation' as const };
            expect(RevalidateEntityRequestSchema.safeParse(data).success).toBe(false);
        });

        it('should reject a missing entityType', () => {
            const data = { entityId: 'some-id' };
            expect(RevalidateEntityRequestSchema.safeParse(data).success).toBe(false);
        });

        it('should reject reason exceeding 500 characters', () => {
            const data = {
                entityType: 'amenity' as const,
                entityId: 'amenity-id',
                reason: 'C'.repeat(501)
            };
            expect(RevalidateEntityRequestSchema.safeParse(data).success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// RevalidateTypeRequestSchema
// ---------------------------------------------------------------------------

describe('RevalidateTypeRequestSchema', () => {
    describe('Valid data', () => {
        it('should validate a request with only entityType', () => {
            const data = { entityType: 'destination' as const };
            const result = RevalidateTypeRequestSchema.parse(data);
            expect(result.entityType).toBe('destination');
        });

        it('should validate a request with entityType and reason', () => {
            const data = {
                entityType: 'post' as const,
                reason: 'Bulk content refresh'
            };
            const result = RevalidateTypeRequestSchema.parse(data);
            expect(result.reason).toBe('Bulk content refresh');
        });

        it('should validate all valid entity types', () => {
            const validTypes = [
                'accommodation',
                'destination',
                'event',
                'post',
                'accommodation_review',
                'destination_review',
                'tag',
                'amenity'
            ] as const;
            for (const entityType of validTypes) {
                expect(RevalidateTypeRequestSchema.safeParse({ entityType }).success).toBe(true);
            }
        });
    });

    describe('Invalid data', () => {
        it('should reject missing entityType', () => {
            expect(RevalidateTypeRequestSchema.safeParse({}).success).toBe(false);
        });

        it('should reject invalid entityType', () => {
            expect(
                RevalidateTypeRequestSchema.safeParse({ entityType: 'booking' }).success
            ).toBe(false);
        });

        it('should reject reason exceeding 500 characters', () => {
            const data = {
                entityType: 'tag' as const,
                reason: 'D'.repeat(501)
            };
            expect(RevalidateTypeRequestSchema.safeParse(data).success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// RevalidationResponseSchema
// ---------------------------------------------------------------------------

describe('RevalidationResponseSchema', () => {
    describe('Valid data', () => {
        it('should validate a successful response with all fields', () => {
            const data = {
                success: true,
                revalidated: ['/en/accommodations/hotel-palace', '/es/alojamientos/hotel-palace'],
                failed: [],
                duration: 245
            };
            const result = RevalidationResponseSchema.parse(data);
            expect(result.success).toBe(true);
            expect(result.revalidated).toHaveLength(2);
            expect(result.failed).toHaveLength(0);
            expect(result.duration).toBe(245);
        });

        it('should validate a partial failure response', () => {
            const data = {
                success: false,
                revalidated: ['/en/accommodations/hotel-a'],
                failed: ['/en/accommodations/hotel-b'],
                duration: 500
            };
            const result = RevalidationResponseSchema.parse(data);
            expect(result.success).toBe(false);
            expect(result.revalidated).toHaveLength(1);
            expect(result.failed).toHaveLength(1);
        });

        it('should validate a response with empty revalidated and failed arrays', () => {
            const data = { success: true, revalidated: [], failed: [], duration: 0 };
            const result = RevalidationResponseSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should accept duration of 0 (integer boundary)', () => {
            const data = { success: true, revalidated: [], failed: [], duration: 0 };
            expect(RevalidationResponseSchema.safeParse(data).success).toBe(true);
        });
    });

    describe('Invalid data', () => {
        it('should reject missing success field', () => {
            const data = { revalidated: [], failed: [], duration: 100 };
            expect(RevalidationResponseSchema.safeParse(data).success).toBe(false);
        });

        it('should reject missing revalidated field', () => {
            const data = { success: true, failed: [], duration: 100 };
            expect(RevalidationResponseSchema.safeParse(data).success).toBe(false);
        });

        it('should reject missing failed field', () => {
            const data = { success: true, revalidated: [], duration: 100 };
            expect(RevalidationResponseSchema.safeParse(data).success).toBe(false);
        });

        it('should reject missing duration field', () => {
            const data = { success: true, revalidated: [], failed: [] };
            expect(RevalidationResponseSchema.safeParse(data).success).toBe(false);
        });

        it('should reject non-integer duration', () => {
            const data = { success: true, revalidated: [], failed: [], duration: 10.5 };
            expect(RevalidationResponseSchema.safeParse(data).success).toBe(false);
        });

        it('should reject non-boolean success', () => {
            const data = { success: 'yes', revalidated: [], failed: [], duration: 100 };
            expect(RevalidationResponseSchema.safeParse(data).success).toBe(false);
        });

        it('should throw ZodError when using .parse() on invalid input', () => {
            expect(() => RevalidationResponseSchema.parse({})).toThrow(ZodError);
        });
    });
});

// ---------------------------------------------------------------------------
// RevalidationStatsSchema
// ---------------------------------------------------------------------------

describe('RevalidationStatsSchema', () => {
    const createValidStats = () => ({
        totalRevalidations: 500,
        successRate: 0.95,
        avgDurationMs: 210,
        lastRevalidation: new Date('2024-06-01T12:00:00Z'),
        byEntityType: { accommodation: 300, destination: 200 },
        byTrigger: { manual: 100, cron: 300, hook: 100 }
    });

    describe('Valid data', () => {
        it('should validate a complete stats object', () => {
            const result = RevalidationStatsSchema.parse(createValidStats());
            expect(result.totalRevalidations).toBe(500);
            expect(result.successRate).toBe(0.95);
            expect(result.avgDurationMs).toBe(210);
            expect(result.lastRevalidation).toBeInstanceOf(Date);
        });

        it('should validate stats with null lastRevalidation', () => {
            const data = { ...createValidStats(), lastRevalidation: null };
            const result = RevalidationStatsSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should coerce string lastRevalidation to Date', () => {
            const data = { ...createValidStats(), lastRevalidation: '2024-06-01T12:00:00Z' };
            const result = RevalidationStatsSchema.parse(data);
            expect(result.lastRevalidation).toBeInstanceOf(Date);
        });

        it('should accept successRate boundary values (0 and 1)', () => {
            expect(
                RevalidationStatsSchema.safeParse({ ...createValidStats(), successRate: 0 }).success
            ).toBe(true);
            expect(
                RevalidationStatsSchema.safeParse({ ...createValidStats(), successRate: 1 }).success
            ).toBe(true);
        });

        it('should accept totalRevalidations of 0', () => {
            const data = { ...createValidStats(), totalRevalidations: 0 };
            expect(RevalidationStatsSchema.safeParse(data).success).toBe(true);
        });

        it('should accept empty byEntityType and byTrigger records', () => {
            const data = { ...createValidStats(), byEntityType: {}, byTrigger: {} };
            expect(RevalidationStatsSchema.safeParse(data).success).toBe(true);
        });
    });

    describe('Invalid data', () => {
        it('should reject successRate below 0', () => {
            const data = { ...createValidStats(), successRate: -0.1 };
            expect(RevalidationStatsSchema.safeParse(data).success).toBe(false);
        });

        it('should reject successRate above 1', () => {
            const data = { ...createValidStats(), successRate: 1.01 };
            expect(RevalidationStatsSchema.safeParse(data).success).toBe(false);
        });

        it('should reject non-integer totalRevalidations', () => {
            const data = { ...createValidStats(), totalRevalidations: 10.5 };
            expect(RevalidationStatsSchema.safeParse(data).success).toBe(false);
        });

        it('should reject non-integer avgDurationMs', () => {
            const data = { ...createValidStats(), avgDurationMs: 100.5 };
            expect(RevalidationStatsSchema.safeParse(data).success).toBe(false);
        });

        it('should reject missing required fields', () => {
            expect(RevalidationStatsSchema.safeParse({}).success).toBe(false);
        });

        it('should reject non-number values in byEntityType record', () => {
            const data = {
                ...createValidStats(),
                byEntityType: { accommodation: 'many' }
            };
            expect(RevalidationStatsSchema.safeParse(data).success).toBe(false);
        });

        it('should throw ZodError when using .parse() on invalid input', () => {
            expect(() => RevalidationStatsSchema.parse({ successRate: 2 })).toThrow(ZodError);
        });
    });

    describe('Type inference', () => {
        it('should produce correct runtime types', () => {
            const result = RevalidationStatsSchema.parse(createValidStats());
            expect(typeof result.totalRevalidations).toBe('number');
            expect(typeof result.successRate).toBe('number');
            expect(typeof result.avgDurationMs).toBe('number');
            expect(result.lastRevalidation).toBeInstanceOf(Date);
            expect(typeof result.byEntityType).toBe('object');
            expect(typeof result.byTrigger).toBe('object');
        });
    });
});
