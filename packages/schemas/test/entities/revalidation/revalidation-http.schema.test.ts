import { isValidCacheTag } from '@repo/cache-tags';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    ManualRevalidateRequestSchema,
    RevalidateEntityRequestSchema,
    RevalidateTypeRequestSchema,
    RevalidationHealthSchema,
    RevalidationResponseSchema,
    RevalidationStatsSchema
} from '../../../src/entities/revalidation/revalidation.http.schema.js';
import { RevalidationEntityTypeEnum } from '../../../src/entities/revalidation/revalidation-config.schema.js';

// ---------------------------------------------------------------------------
// ManualRevalidateRequestSchema
// ---------------------------------------------------------------------------

describe('ManualRevalidateRequestSchema', () => {
    describe('Valid data — tags branch', () => {
        it('should validate a request with a single tag', () => {
            const data = { tags: ['accom-hotel-palace'] };
            const result = ManualRevalidateRequestSchema.parse(data);
            expect('tags' in result && result.tags).toHaveLength(1);
            expect('tags' in result && result.tags[0]).toBe('accom-hotel-palace');
        });

        it('should validate a request with multiple tags', () => {
            const data = {
                tags: ['accom-hotel-palace', 'list-accom', 'home']
            };
            const result = ManualRevalidateRequestSchema.parse(data);
            expect('tags' in result && result.tags).toHaveLength(3);
        });

        it('should validate a request with an optional reason', () => {
            const data = {
                tags: ['dest-litoral'],
                reason: 'Content updated by editor'
            };
            const result = ManualRevalidateRequestSchema.parse(data);
            expect(result.reason).toBe('Content updated by editor');
        });

        it('should validate a request without reason (optional)', () => {
            const data = { tags: ['event-festival-2024'] };
            const result = ManualRevalidateRequestSchema.safeParse(data);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.reason).toBeUndefined();
            }
        });

        it('should accept exactly 100 tags (maximum boundary)', () => {
            const tags = Array.from({ length: 100 }, (_, i) => `tag-${i}`);
            const result = ManualRevalidateRequestSchema.safeParse({ tags });
            expect(result.success).toBe(true);
        });

        it('should accept reason up to 500 characters (maximum boundary)', () => {
            const data = {
                tags: ['accom-test'],
                reason: 'A'.repeat(500)
            };
            expect(ManualRevalidateRequestSchema.safeParse(data).success).toBe(true);
        });
    });

    describe('Invalid data — tags branch', () => {
        it('should reject empty tags array', () => {
            const data = { tags: [] };
            const result = ManualRevalidateRequestSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject more than 100 tags', () => {
            const tags = Array.from({ length: 101 }, (_, i) => `tag-${i}`);
            const result = ManualRevalidateRequestSchema.safeParse({ tags });
            expect(result.success).toBe(false);
        });

        it('should reject tags containing empty strings', () => {
            const data = { tags: [''] };
            const result = ManualRevalidateRequestSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject a tag containing a comma (the Cache-Tag list separator)', () => {
            const data = { tags: ['bad,tag'] };
            expect(ManualRevalidateRequestSchema.safeParse(data).success).toBe(false);
        });

        it('should reject a tag containing a space', () => {
            const data = { tags: ['bad tag'] };
            expect(ManualRevalidateRequestSchema.safeParse(data).success).toBe(false);
        });

        it('should reject reason exceeding 500 characters', () => {
            const data = {
                tags: ['accom-test'],
                reason: 'A'.repeat(501)
            };
            expect(ManualRevalidateRequestSchema.safeParse(data).success).toBe(false);
        });

        it('should reject a body with neither tags nor purgeEverything', () => {
            const result = ManualRevalidateRequestSchema.safeParse({});
            expect(result.success).toBe(false);
        });

        it('should throw ZodError when using .parse() with invalid input', () => {
            expect(() => ManualRevalidateRequestSchema.parse({ tags: [] })).toThrow(ZodError);
        });
    });

    describe('Valid data — purgeEverything branch', () => {
        it('should validate a bare whole-zone purge request', () => {
            const data = { purgeEverything: true as const };
            const result = ManualRevalidateRequestSchema.parse(data);
            expect('purgeEverything' in result && result.purgeEverything).toBe(true);
        });

        it('should validate a whole-zone purge request with a reason', () => {
            const data = { purgeEverything: true as const, reason: 'Deploy changed every asset' };
            const result = ManualRevalidateRequestSchema.parse(data);
            expect(result.reason).toBe('Deploy changed every asset');
        });
    });

    describe('Invalid data — purgeEverything branch', () => {
        it('should reject purgeEverything: false (not the literal true)', () => {
            const data = { purgeEverything: false };
            expect(ManualRevalidateRequestSchema.safeParse(data).success).toBe(false);
        });

        it('should reject a body carrying BOTH tags and purgeEverything', () => {
            // Both branches are `.strict()`, which is what makes them mutually
            // exclusive. A plain `z.union` of non-strict objects would match this
            // against the FIRST branch and drop the flag silently: the operator
            // asks for a whole-zone flush, the request succeeds, and they get a
            // tag purge. On an endpoint whose contract is that the destructive
            // path is only reachable deliberately, an ambiguous body has to be
            // rejected rather than resolved in the caller's favour.
            const data = { tags: ['accom-test'], purgeEverything: true as const };
            expect(ManualRevalidateRequestSchema.safeParse(data).success).toBe(false);
        });

        it('should reject an unknown key rather than ignoring it', () => {
            // Non-vacuity for `.strict()`: without it this passes, and so does
            // the mixed-key body above.
            const data = { tags: ['accom-test'], purgeEverythingg: true };
            expect(ManualRevalidateRequestSchema.safeParse(data).success).toBe(false);
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
            // Derived from the enum rather than hand-listed. The hand-listed
            // version of this test named the original eight and stayed green
            // through the whole five-value drift that HOS-389 §4b fixed — it
            // could only ever confirm that the values it already knew about
            // still parsed, which is the one thing that was never in doubt.
            for (const entityType of RevalidationEntityTypeEnum.options) {
                const result = RevalidateEntityRequestSchema.safeParse({
                    entityType,
                    entityId: 'abc-123'
                });
                expect(result.success, `entity type "${entityType}" was rejected`).toBe(true);
            }
        });

        it('should accept the commerce listing types (HOS-389 §4b regression)', () => {
            // The admin "revalidate" button on a gastronomy/experience edit page
            // posts exactly this body. While these two were missing from the
            // enum the request failed validation, which is what made the button
            // unaddable in the first place.
            for (const entityType of ['gastronomy', 'experience'] as const) {
                const result = RevalidateEntityRequestSchema.safeParse({
                    entityType,
                    entityId: 'abc-123'
                });
                expect(result.success, `entity type "${entityType}" was rejected`).toBe(true);
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
            expect(RevalidateTypeRequestSchema.safeParse({ entityType: 'booking' }).success).toBe(
                false
            );
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

// ---------------------------------------------------------------------------
// RevalidationHealthSchema (HOS-369)
// ---------------------------------------------------------------------------

describe('RevalidationHealthSchema', () => {
    const createValidHealth = () => ({
        status: 'operational' as const,
        adapter: 'active' as const,
        environmentFlushTarget: 'prod:all',
        latencyMs: 3
    });

    it('should validate an operational report naming its flush target', () => {
        const result = RevalidationHealthSchema.parse(createValidHealth());
        expect(result.environmentFlushTarget).toBe('prod:all');
        expect(result.status).toBe('operational');
    });

    it("should accept the 'unresolved' sentinel as a flush target", () => {
        const result = RevalidationHealthSchema.parse({
            status: 'not_initialized',
            adapter: 'none',
            environmentFlushTarget: 'unresolved'
        });
        expect(result.environmentFlushTarget).toBe('unresolved');
    });

    it('should REQUIRE environmentFlushTarget — a consumer must never have to read a missing key as "probably fine"', () => {
        const { environmentFlushTarget: _omitted, ...withoutTarget } = createValidHealth();
        expect(RevalidationHealthSchema.safeParse(withoutTarget).success).toBe(false);
    });

    it('should reject an unknown status', () => {
        expect(
            RevalidationHealthSchema.safeParse({
                ...createValidHealth(),
                status: 'purged'
            }).success
        ).toBe(false);
    });

    it('should throw ZodError when using .parse() on invalid input', () => {
        expect(() => RevalidationHealthSchema.parse({ status: 'operational' })).toThrow(ZodError);
    });
});

// ---------------------------------------------------------------------------
// Drift guard for the duplicated cache-tag rule
// ---------------------------------------------------------------------------

/**
 * `CacheTagSchema` in `revalidation.http.schema.ts` re-states the tag validity
 * rule instead of importing `isValidCacheTag`, because `@repo/schemas` is
 * consumed from SOURCE by apps that would then all need `@repo/cache-tags`
 * declared themselves (importing it broke `apps/admin`'s test run).
 *
 * A duplicated rule that nothing compares is a rule that drifts. This asserts
 * the two agree on the same corpus — which is why `@repo/cache-tags` is a
 * devDependency here, and only a devDependency.
 */
describe('cache-tag validation stays in sync with @repo/cache-tags', () => {
    const CASES: ReadonlyArray<string> = [
        'accom-cabana-del-rio',
        'list-accom',
        'home',
        'pricing',
        'site-config',
        'accom-3f1a2b4c-0000-4000-8000-000000000001',
        // Namespaced forms (HOS-369 W1-2) — the shape actually sent to
        // Cloudflare now. The colon is 0x3A, inside the pattern's \x2D-\x7E
        // range, so these must pass on BOTH sides; the degenerate colon cases
        // below pin down that the two also agree on the edges of that claim.
        'prod:accom-cabana-del-rio',
        'prod:list-accom',
        'preview:home',
        'dev:site-config',
        'test:pricing',
        'prod:',
        ':home',
        'prod::home',
        'prod:has space',
        `prod:${'a'.repeat(1024)}`,
        'a',
        'UPPER-CASE',
        'with.dots-and_underscores~tilde',
        '!#$%&()*+',
        '',
        ' leading-space',
        'trailing-space ',
        'has space',
        'has,comma',
        'concepción',
        'emoji-🙂',
        'tab\there',
        'newline\nhere',
        'a'.repeat(1024),
        'a'.repeat(1025)
    ];

    it('accepts and rejects exactly the same tags as isValidCacheTag', () => {
        const disagreements = CASES.filter((tag) => {
            const bySchema = ManualRevalidateRequestSchema.safeParse({ tags: [tag] }).success;
            const byPackage = isValidCacheTag({ tag });
            return bySchema !== byPackage;
        });

        expect(disagreements).toEqual([]);
    });

    it('is non-vacuous — the corpus contains both accepted and rejected tags', () => {
        const accepted = CASES.filter((tag) => isValidCacheTag({ tag }));
        expect(accepted.length).toBeGreaterThan(5);
        expect(CASES.length - accepted.length).toBeGreaterThan(5);
    });
});
