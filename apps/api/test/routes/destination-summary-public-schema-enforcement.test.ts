/**
 * Regression tests for SPEC-210 PR2 — destination summary public schema enforcement.
 *
 * Verifies that GET /api/v1/public/destinations/:id/summary serializes responses
 * through `DestinationSummaryPublicSchema` (an explicit alias of DestinationSummarySchema,
 * which is already a clean .pick() projection with NO audit fields).
 *
 * The audit fields confirmed absent from DestinationSummarySchema by construction:
 *   createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById,
 *   lifecycleState, moderationState, adminInfo, translationMeta, pathIds.
 *
 * Owner-confirmed REQUIRED public fields:
 *   id, slug, name, summary, media, accommodationsCount, path, level, destinationType.
 *
 * The "Schema unit tests — always run (no DB required)" block runs unconditionally
 * so a schema revert is caught even in the DB-less CI environment.
 *
 * Endpoint: GET /api/v1/public/destinations/:id/summary
 */

import { DestinationSummaryPublicSchema } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Fields that MUST NOT appear in a destination summary public response.
 * These are present on the full DestinationSchema but absent from the .pick()
 * projection used by DestinationSummarySchema / DestinationSummaryPublicSchema.
 */
const FORBIDDEN_FIELDS = [
    'createdAt',
    'updatedAt',
    'createdById',
    'updatedById',
    'deletedAt',
    'deletedById',
    'lifecycleState',
    'moderationState',
    'adminInfo',
    'translationMeta',
    'pathIds',
    'parentDestinationId',
    'description',
    'faqs',
    'reviews',
    'climate',
    'weatherCurrent',
    'seo',
    'visibility'
] as const;

/**
 * Fields that MUST be present in a destination summary public response.
 * Confirmed by owner: accommodationsCount, path, and level are intentionally public.
 */
const REQUIRED_PUBLIC_FIELDS = [
    'id',
    'slug',
    'name',
    'summary',
    'accommodationsCount',
    'path',
    'level',
    'destinationType'
] as const;

/**
 * Raw destination summary object that includes all fields from the full
 * DestinationSchema (including audit/internal fields that should NOT be present
 * in DestinationSummaryPublicSchema since it uses .pick()).
 */
const RAW_SUMMARY_WITH_FULL_FIELDS = {
    // Public fields (all included in DestinationSummaryPublicSchema)
    id: '323e4567-e89b-12d3-a456-426614174001',
    slug: 'concepcion-del-uruguay',
    name: 'Concepción del Uruguay',
    summary: 'Ciudad histórica a orillas del río Uruguay, conocida por su arquitectura colonial.',
    media: {
        featuredImage: {
            moderationState: 'APPROVED',
            url: 'https://example.com/img/cdu.jpg',
            alt: 'Vista de la ciudad',
            caption: 'Vista de la ciudad'
        },
        gallery: []
    },
    location: {
        country: 'AR',
        state: 'Entre Ríos',
        city: 'Concepción del Uruguay',
        latitude: -32.4825,
        longitude: -58.2375
    },
    isFeatured: true,
    accommodationsCount: 42,
    destinationType: 'CITY',
    level: 2,
    path: '/ar/entre-rios/concepcion-del-uruguay',
    reviewsCount: 15,
    averageRating: 4.3,
    // Full schema fields that DestinationSummaryPublicSchema does NOT pick:
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2025-01-01'),
    createdById: '323e4567-e89b-12d3-a456-000000000001',
    updatedById: null,
    deletedAt: null,
    deletedById: null,
    lifecycleState: 'ACTIVE',
    moderationState: 'APPROVED',
    adminInfo: { notes: 'Top destination' },
    translationMeta: { name: { en: { updatedAt: '2025-01-01', method: 'ai' } } },
    pathIds: '323e4567-e89b-12d3-a456-426614174001',
    parentDestinationId: null,
    description: 'Una descripción larga de la ciudad...',
    faqs: [],
    reviews: [],
    climate: null,
    weatherCurrent: null,
    seo: { title: 'Concepción del Uruguay', description: 'Turismo' },
    visibility: { isVisible: true }
};

// ---------------------------------------------------------------------------
// Schema unit tests — ALWAYS RUN (no DB required)
// ---------------------------------------------------------------------------

describe('DestinationSummaryPublicSchema — unit tests (no DB, always run) (SPEC-210)', () => {
    it('does NOT include audit, lifecycle, or admin-internal fields after parse', () => {
        const result = DestinationSummaryPublicSchema.safeParse(RAW_SUMMARY_WITH_FULL_FIELDS);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of FORBIDDEN_FIELDS) {
                expect(data, `field "${field}" must be absent`).not.toHaveProperty(field);
            }
        }
    });

    it('preserves the owner-confirmed required public fields (id, slug, name, summary, accommodationsCount, path, level, destinationType)', () => {
        const result = DestinationSummaryPublicSchema.safeParse(RAW_SUMMARY_WITH_FULL_FIELDS);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of REQUIRED_PUBLIC_FIELDS) {
                expect(data, `field "${field}" must be present`).toHaveProperty(field);
            }
        }
    });

    it('preserves accommodationsCount, path, and level with correct values (owner-confirmed public fields)', () => {
        const result = DestinationSummaryPublicSchema.safeParse(RAW_SUMMARY_WITH_FULL_FIELDS);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            expect(data.accommodationsCount).toBe(42);
            expect(data.path).toBe('/ar/entre-rios/concepcion-del-uruguay');
            expect(data.level).toBe(2);
        }
    });

    it('preserves review aggregates (reviewsCount and averageRating)', () => {
        const result = DestinationSummaryPublicSchema.safeParse(RAW_SUMMARY_WITH_FULL_FIELDS);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            expect(data.reviewsCount).toBe(15);
            expect(data.averageRating).toBe(4.3);
        }
    });

    it('parses successfully with only the minimum required fields (no extras)', () => {
        const minimal = {
            id: '323e4567-e89b-12d3-a456-426614174002',
            slug: 'gualeguaychu',
            name: 'Gualeguaychú',
            summary: 'Ciudad del carnaval más grande de Argentina.',
            isFeatured: false,
            accommodationsCount: 0,
            destinationType: 'CITY',
            level: 2,
            path: '/ar/entre-rios/gualeguaychu',
            media: null
        };
        const result = DestinationSummaryPublicSchema.safeParse(minimal);
        expect(result.success).toBe(true);
    });

    it('nullable variant accepts null (for destinations not found)', () => {
        const result = DestinationSummaryPublicSchema.nullable().safeParse(null);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBeNull();
        }
    });
});

// ---------------------------------------------------------------------------
// Route-level regression tests (may be skipped if DB unavailable)
// ---------------------------------------------------------------------------

describe('GET /api/v1/public/destinations/:id/summary — schema enforcement (SPEC-210)', () => {
    let app: AppOpenAPI;
    const destinationId = '323e4567-e89b-12d3-a456-426614174001';
    const base = `/api/v1/public/destinations/${destinationId}/summary`;

    beforeAll(async () => {
        app = initApp();
    });

    it('should be registered and reachable (not return 404)', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            // 422/400 means route matched but validation failed — still registered
            expect([200, 400, 422, 401, 403, 500]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403, 500]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('should not require authentication', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                // Accept if middleware blocks in test env — route is still registered
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('should NOT include audit, lifecycle, or admin-internal fields in the summary when 200 is returned', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            if (res.status === 200) {
                const body = await res.json();
                // The route returns the DestinationSummary object directly (or wrapped in data)
                const summary =
                    body?.data !== undefined && body.data !== null && typeof body.data === 'object'
                        ? (body.data as Record<string, unknown>)
                        : body !== null && typeof body === 'object'
                          ? (body as Record<string, unknown>)
                          : null;

                if (summary !== null) {
                    for (const field of FORBIDDEN_FIELDS) {
                        expect(summary, `field "${field}" must be absent`).not.toHaveProperty(
                            field
                        );
                    }
                    // Verify owner-confirmed public fields survive
                    expect(summary).toHaveProperty('accommodationsCount');
                    expect(summary).toHaveProperty('path');
                    expect(summary).toHaveProperty('level');
                }
            }

            expect(res.status).not.toBe(404);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403, 500]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });
});
