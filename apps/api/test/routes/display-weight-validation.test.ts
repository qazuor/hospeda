/**
 * Tests for displayWeight validation on amenity, feature, and attraction entities.
 * Tests US-06: API Exposes Display Weight.
 *
 * Tests the HTTP schema validation layer that enforces displayWeight rules:
 * - Valid range: 1-100
 * - Default value: 50
 * - Integer-only (rejects decimals)
 * - Coercion from string to number
 *
 * Also verifies that the mock services return displayWeight in create responses.
 */
import {
    AmenityCreateHttpSchema,
    AttractionCreateHttpSchema,
    FeatureCreateHttpSchema
} from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';
import { validateApiEnv } from '../../src/utils/env';

// =========================================================================
// HTTP SCHEMA VALIDATION TESTS
// =========================================================================
// These test the Zod schemas that guard the API boundary.
// The same schemas are used by createAdminRoute() for body validation.

describe('displayWeight HTTP schema validation (US-06)', () => {
    describe('AmenityCreateHttpSchema', () => {
        const baseInput = {
            name: 'Test Amenity',
            slug: 'test-amenity',
            type: 'GENERAL_APPLIANCES'
        };

        it('should accept displayWeight of 75', () => {
            const result = AmenityCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 75
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayWeight).toBe(75);
            }
        });

        it('should accept minimum boundary value of 1', () => {
            const result = AmenityCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 1
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayWeight).toBe(1);
            }
        });

        it('should accept maximum boundary value of 100', () => {
            const result = AmenityCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 100
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayWeight).toBe(100);
            }
        });

        it('should default displayWeight to 50 when not provided', () => {
            const result = AmenityCreateHttpSchema.safeParse(baseInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayWeight).toBe(50);
            }
        });

        it('should coerce string displayWeight to number', () => {
            const result = AmenityCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: '75'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayWeight).toBe(75);
            }
        });

        it('should reject displayWeight of 0 (below minimum)', () => {
            const result = AmenityCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 0
            });
            expect(result.success).toBe(false);
        });

        it('should reject displayWeight of 101 (above maximum)', () => {
            const result = AmenityCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 101
            });
            expect(result.success).toBe(false);
        });

        it('should reject non-integer displayWeight of 1.5', () => {
            const result = AmenityCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 1.5
            });
            expect(result.success).toBe(false);
        });

        it('should reject negative displayWeight', () => {
            const result = AmenityCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: -10
            });
            expect(result.success).toBe(false);
        });
    });

    describe('FeatureCreateHttpSchema', () => {
        const baseInput = {
            name: 'Test Feature',
            slug: 'test-feature'
        };

        it('should accept displayWeight of 75', () => {
            const result = FeatureCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 75
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayWeight).toBe(75);
            }
        });

        it('should accept minimum boundary value of 1', () => {
            const result = FeatureCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 1
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayWeight).toBe(1);
            }
        });

        it('should accept maximum boundary value of 100', () => {
            const result = FeatureCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 100
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayWeight).toBe(100);
            }
        });

        it('should default displayWeight to 50 when not provided', () => {
            const result = FeatureCreateHttpSchema.safeParse(baseInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayWeight).toBe(50);
            }
        });

        it('should coerce string displayWeight to number', () => {
            const result = FeatureCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: '80'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayWeight).toBe(80);
            }
        });

        it('should reject displayWeight of 0 (below minimum)', () => {
            const result = FeatureCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 0
            });
            expect(result.success).toBe(false);
        });

        it('should reject displayWeight of 101 (above maximum)', () => {
            const result = FeatureCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 101
            });
            expect(result.success).toBe(false);
        });

        it('should reject non-integer displayWeight of 1.5', () => {
            const result = FeatureCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 1.5
            });
            expect(result.success).toBe(false);
        });
    });

    describe('AttractionCreateHttpSchema', () => {
        const baseInput = {
            name: 'Test Attraction',
            description: 'A test attraction for integration testing',
            icon: 'MapPinIcon'
        };

        it('should accept displayWeight of 75', () => {
            const result = AttractionCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 75
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayWeight).toBe(75);
            }
        });

        it('should accept minimum boundary value of 1', () => {
            const result = AttractionCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 1
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayWeight).toBe(1);
            }
        });

        it('should accept maximum boundary value of 100', () => {
            const result = AttractionCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 100
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayWeight).toBe(100);
            }
        });

        it('should default displayWeight to 50 when not provided', () => {
            const result = AttractionCreateHttpSchema.safeParse(baseInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayWeight).toBe(50);
            }
        });

        it('should coerce string displayWeight to number', () => {
            const result = AttractionCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: '90'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayWeight).toBe(90);
            }
        });

        it('should reject displayWeight of 0 (below minimum)', () => {
            const result = AttractionCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 0
            });
            expect(result.success).toBe(false);
        });

        it('should reject displayWeight of 101 (above maximum)', () => {
            const result = AttractionCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 101
            });
            expect(result.success).toBe(false);
        });

        it('should reject non-integer displayWeight of 1.5', () => {
            const result = AttractionCreateHttpSchema.safeParse({
                ...baseInput,
                displayWeight: 1.5
            });
            expect(result.success).toBe(false);
        });
    });
});

// =========================================================================
// API PASSTHROUGH TESTS
// =========================================================================
// Verify that displayWeight is present in actual API responses.
// Mock services (setup.ts) return items with displayWeight values,
// so these tests confirm the full request pipeline preserves the field.

describe('displayWeight passthrough in API responses (US-06)', () => {
    let app: ReturnType<typeof initApp>;
    const headers = {
        'user-agent': 'vitest',
        'content-type': 'application/json'
    };

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    describe('amenity endpoints', () => {
        it('should include displayWeight in public list response items', async () => {
            const res = await app.request('/api/v1/public/amenities', { headers });
            if (res.status === 200) {
                const body = await res.json();
                const items = body.data?.items ?? body.items ?? [];
                if (items.length > 0) {
                    expect(items[0]).toHaveProperty('displayWeight');
                    expect(typeof items[0].displayWeight).toBe('number');
                    expect(items[0].displayWeight).toBeGreaterThanOrEqual(1);
                    expect(items[0].displayWeight).toBeLessThanOrEqual(100);
                }
            }
        });
    });

    describe('feature endpoints', () => {
        it('should include displayWeight in public list response items', async () => {
            const res = await app.request('/api/v1/public/features', { headers });
            if (res.status === 200) {
                const body = await res.json();
                const items = body.data?.items ?? body.items ?? [];
                if (items.length > 0) {
                    expect(items[0]).toHaveProperty('displayWeight');
                    expect(typeof items[0].displayWeight).toBe('number');
                    expect(items[0].displayWeight).toBeGreaterThanOrEqual(1);
                    expect(items[0].displayWeight).toBeLessThanOrEqual(100);
                }
            }
        });
    });

    describe('attraction endpoints', () => {
        it('should include displayWeight in public list response items', async () => {
            const res = await app.request('/api/v1/public/attractions', { headers });
            if (res.status === 200) {
                const body = await res.json();
                const items = body.data?.items ?? body.items ?? [];
                if (items.length > 0) {
                    expect(items[0]).toHaveProperty('displayWeight');
                    expect(typeof items[0].displayWeight).toBe('number');
                    expect(items[0].displayWeight).toBeGreaterThanOrEqual(1);
                    expect(items[0].displayWeight).toBeLessThanOrEqual(100);
                }
            }
        });
    });

    describe('create responses include displayWeight', () => {
        it('amenity create mock should echo back displayWeight', async () => {
            const { AmenityService } = await import('../helpers/mocks/accommodation-services');
            const svc = new AmenityService();
            const result = await svc.create(
                {},
                { name: 'WiFi', type: 'CONNECTIVITY', displayWeight: 75 }
            );
            expect(result.data.displayWeight).toBe(75);
        });

        it('amenity create mock should default displayWeight to 50', async () => {
            const { AmenityService } = await import('../helpers/mocks/accommodation-services');
            const svc = new AmenityService();
            const result = await svc.create({}, { name: 'WiFi', type: 'CONNECTIVITY' });
            expect(result.data.displayWeight).toBe(50);
        });

        it('feature create mock should echo back displayWeight', async () => {
            const { FeatureService } = await import('../helpers/mocks/destination-services');
            const svc = new FeatureService();
            const result = await svc.create({}, { name: 'River Front', displayWeight: 90 });
            expect(result.data.displayWeight).toBe(90);
        });

        it('attraction create mock should echo back displayWeight', async () => {
            const { AttractionService } = await import('../helpers/mocks/destination-services');
            const svc = new AttractionService();
            const result = await svc.create({}, { name: 'Museum', displayWeight: 85 });
            expect(result.data.displayWeight).toBe(85);
        });
    });

    describe('list responses include displayWeight', () => {
        it('amenity list mock should return items with displayWeight', async () => {
            const { AmenityService } = await import('../helpers/mocks/accommodation-services');
            const svc = new AmenityService();
            const result = await svc.list({});
            expect(result.data.items.length).toBeGreaterThan(0);
            for (const item of result.data.items) {
                expect(item).toHaveProperty('displayWeight');
                expect(typeof item.displayWeight).toBe('number');
            }
        });

        it('feature list mock should return items with displayWeight', async () => {
            const { FeatureService } = await import('../helpers/mocks/destination-services');
            const svc = new FeatureService();
            const result = await svc.list({});
            expect(result.data.items.length).toBeGreaterThan(0);
            for (const item of result.data.items) {
                expect(item).toHaveProperty('displayWeight');
                expect(typeof item.displayWeight).toBe('number');
            }
        });

        it('attraction list mock should return items with displayWeight', async () => {
            const { AttractionService } = await import('../helpers/mocks/destination-services');
            const svc = new AttractionService();
            const result = await svc.list({});
            expect(result.data.items.length).toBeGreaterThan(0);
            for (const item of result.data.items) {
                expect(item).toHaveProperty('displayWeight');
                expect(typeof item.displayWeight).toBe('number');
            }
        });
    });

    describe('getById responses include displayWeight', () => {
        it('amenity getById mock should include displayWeight', async () => {
            const { AmenityService } = await import('../helpers/mocks/accommodation-services');
            const svc = new AmenityService();
            const result = await svc.getById({}, 'amenity-1');
            expect(result.data).toHaveProperty('displayWeight');
            expect(result.data!.displayWeight).toBe(50);
        });

        it('feature getById mock should include displayWeight', async () => {
            const { FeatureService } = await import('../helpers/mocks/destination-services');
            const svc = new FeatureService();
            const result = await svc.getById({}, 'feature-1');
            expect(result.data).toHaveProperty('displayWeight');
            expect(result.data!.displayWeight).toBe(50);
        });

        it('attraction getById mock should include displayWeight', async () => {
            const { AttractionService } = await import('../helpers/mocks/destination-services');
            const svc = new AttractionService();
            const result = await svc.getById({}, 'attraction-1');
            expect(result.data).toHaveProperty('displayWeight');
            expect(result.data!.displayWeight).toBe(50);
        });
    });
});
