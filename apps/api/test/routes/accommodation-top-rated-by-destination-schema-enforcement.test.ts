/**
 * Regression tests for SPEC-210 PR1 — accommodation getTopRatedByDestination route.
 *
 * Documents and reproduces TWO bugs present before the SPEC-210 fix:
 *
 * BUG 1 — SHAPE BUG (latent 500):
 *   The handler returned `result.data || []` which resolves to
 *   `{ accommodations: Accommodation[] }` (the AccommodationListWrapper shape).
 *   The responseSchema was `AccommodationTopRatedOutputSchema =
 *   PaginationResultSchema(AccommodationSchema)` which expects
 *   `{ data: [...], pagination: {...} }`.
 *   `stripWithSchema` is strict: when safeParse fails it throws
 *   `ServiceError(INTERNAL_ERROR)` → HTTP 500.
 *   Fix: handler wraps the flat array into `{ data: [...], pagination: {...} }`.
 *
 * BUG 2 — SECURITY LEAK:
 *   The responseSchema used `AccommodationSchema` (full entity) exposing
 *   `createdById`, `updatedById`, `deletedAt`, `deletedById`, `adminInfo`,
 *   `moderationState`, `lastWarnedAt`, `translationMeta`, etc.
 *   Fix: responseSchema uses `PaginationResultSchema(AccommodationPublicSchema)`
 *   which strips all internal-only fields at the schema layer.
 *
 * Endpoint: GET /api/v1/public/accommodations/destination/{destinationId}/top-rated
 */

import { AccommodationPublicSchema, PaginationResultSchema } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

describe('GET /api/v1/public/accommodations/destination/:id/top-rated — schema enforcement (SPEC-210)', () => {
    let app: AppOpenAPI;
    const destinationId = '00000000-0000-0000-0000-000000000001';
    const base = `/api/v1/public/accommodations/destination/${destinationId}/top-rated`;

    beforeAll(async () => {
        app = initApp();
    });

    describe('Route Registration', () => {
        it('should be registered and reachable (not return 404)', async () => {
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                });
                // 404 means the route is not registered at all
                expect(res.status).not.toBe(404);
                expect([200, 400, 401, 403, 500]).toContain(res.status);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });

    describe('Public Access', () => {
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
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });

    describe('BUG 1 — Shape regression (latent 500) (SPEC-210)', () => {
        /**
         * REGRESSION: before SPEC-210 the handler returned `result.data || []`
         * which resolves to `{ accommodations: Accommodation[] }`.
         * The responseSchema `PaginationResultSchema(AccommodationSchema)` expects
         * `{ data: [...], pagination: {...} }`, so `stripWithSchema` would throw
         * ServiceError(INTERNAL_ERROR) → HTTP 500 whenever the service returned data.
         *
         * After the fix, the handler wraps the flat array into the correct paginated
         * envelope `{ data: [...], pagination: {...} }`, so this route must NEVER
         * return 500 when the service returns a successful (possibly empty) result.
         *
         * In the test environment the DB is not available, so the service may
         * return NOT_FOUND or a service error — but NOT a shape-mismatch 500.
         */
        it('should NOT return 500 due to response-schema shape mismatch', async () => {
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                });
                // 500 here means stripWithSchema threw on shape mismatch.
                // Any other status is acceptable (200 success, 400 bad request,
                // 404 not found when DB not available).
                expect(res.status).not.toBe(500);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    // Shape mismatch errors bubble up as ServiceError(INTERNAL_ERROR)
                    // which maps to HTTP 500 — reject that too.
                    expect((error as { status: number }).status).not.toBe(500);
                } else {
                    throw error;
                }
            }
        });

        it('should return a paginated envelope { data, pagination } not a bare array or { accommodations }', async () => {
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                });

                if (res.status === 200) {
                    const body = await res.json();

                    // The standard outer envelope wraps in { success, data, metadata }
                    expect(body).toHaveProperty('success', true);
                    expect(body).toHaveProperty('data');

                    const inner = body.data as Record<string, unknown>;

                    // Must be the paginated shape: { data: [...], pagination: {...} }
                    expect(inner).toHaveProperty('data');
                    expect(Array.isArray(inner.data)).toBe(true);
                    expect(inner).toHaveProperty('pagination');
                    expect(inner.pagination).toBeTypeOf('object');
                    expect(inner.pagination).not.toBeNull();

                    const pagination = inner.pagination as Record<string, unknown>;
                    expect(pagination).toHaveProperty('page');
                    expect(pagination).toHaveProperty('pageSize');
                    expect(pagination).toHaveProperty('total');
                    expect(pagination).toHaveProperty('totalPages');
                    expect(pagination).toHaveProperty('hasNextPage');
                    expect(pagination).toHaveProperty('hasPreviousPage');

                    // Must NOT be the old buggy shapes
                    expect(inner).not.toHaveProperty('accommodations');
                    expect(Array.isArray(inner)).toBe(false);
                }

                expect(res.status).not.toBe(404);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([400, 401, 403, 500]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });

    describe('BUG 2 — Field-level leak regression (SPEC-210)', () => {
        /**
         * REGRESSION: before SPEC-210 the responseSchema used AccommodationSchema
         * (via AccommodationSearchResultSchema = PaginationResultSchema(AccommodationSchema))
         * which is the FULL entity schema. It exposes internal-only fields:
         *   - createdById, updatedById     (BaseAuditFields)
         *   - deletedAt, deletedById       (soft-delete audit)
         *   - adminInfo                    (admin-only moderation notes)
         *   - moderationState              (internal lifecycle flag)
         *   - lastWarnedAt                 (internal operational field)
         *   - translationMeta              (internal translation metadata)
         *   - scheduleData                 (internal scheduling data)
         *
         * After the fix, responseSchema uses PaginationResultSchema(AccommodationPublicSchema)
         * which strips ALL internal-only fields at the schema layer.
         */
        it('should NOT leak internal-only fields in any accommodation item', async () => {
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                });

                if (res.status === 200) {
                    const body = await res.json();
                    // Items live in body.data.data (outer envelope + paginated envelope)
                    const innerData = body?.data as Record<string, unknown> | undefined;
                    const items: unknown[] = Array.isArray(innerData?.data)
                        ? (innerData.data as unknown[])
                        : [];

                    const FORBIDDEN_FIELDS = [
                        'createdById',
                        'updatedById',
                        'deletedAt',
                        'deletedById',
                        'adminInfo',
                        'moderationState',
                        'lastWarnedAt',
                        'translationMeta',
                        'scheduleData'
                    ];

                    for (const item of items) {
                        const record = item as Record<string, unknown>;
                        for (const field of FORBIDDEN_FIELDS) {
                            expect(
                                record,
                                `field '${field}' must not be present in top-rated accommodation items`
                            ).not.toHaveProperty(field);
                        }
                    }
                }

                expect(res.status).not.toBe(404);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([400, 401, 403, 500]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });

        it('should include public card fields in each accommodation item when present', async () => {
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                });

                if (res.status === 200) {
                    const body = await res.json();
                    const innerData = body?.data as Record<string, unknown> | undefined;
                    const items: unknown[] = Array.isArray(innerData?.data)
                        ? (innerData.data as unknown[])
                        : [];

                    for (const item of items) {
                        const record = item as Record<string, unknown>;
                        // Core identification fields that AccommodationPublicSchema always includes
                        expect(record).toHaveProperty('id');
                        expect(record).toHaveProperty('slug');
                        expect(record).toHaveProperty('name');
                    }
                }

                expect(res.status).not.toBe(404);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([400, 401, 403, 500]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });

    describe('Schema unit tests — always run (no DB required)', () => {
        /**
         * These tests call AccommodationPublicSchema.safeParse() directly.
         * They ALWAYS run regardless of DB availability or HTTP response status,
         * ensuring that a schema revert would be caught even in the DB-less CI env.
         *
         * Build a raw object that includes all known internal/audit fields and
         * verify that AccommodationPublicSchema strips every one of them.
         *
         * UUID note: AccommodationIdSchema enforces RFC 4122 variant + version pattern
         * (version 1-8, variant 89ab). Use a well-formed v4 UUID like
         * '123e4567-e89b-12d3-a456-426614174000' in tests — all-zero UUIDs with
         * a non-zero last segment (e.g. '...000000000001') fail the pattern.
         */
        // Well-formed v4 UUIDs safe for use in schema unit tests
        const TEST_UUID = '123e4567-e89b-12d3-a456-426614174000';
        const TEST_UUID_2 = '123e4567-e89b-12d3-a456-426614174001';

        it('AccommodationPublicSchema strips internal audit fields (createdById, updatedById, deletedAt, deletedById)', () => {
            const raw = {
                // Minimum required public fields
                id: TEST_UUID,
                slug: 'test-accommodation',
                name: 'Test Accommodation',
                type: 'CABIN',
                summary: 'A short summary for testing purposes here.',
                description:
                    'A longer description that satisfies the minimum length requirement for accommodation.',
                isFeatured: false,
                destinationId: TEST_UUID_2,
                // Internal/audit fields that must be stripped
                createdById: TEST_UUID,
                updatedById: TEST_UUID,
                deletedAt: new Date(),
                deletedById: TEST_UUID,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = AccommodationPublicSchema.safeParse(raw);
            expect(result.success).toBe(true);
            if (result.success) {
                const data = result.data as Record<string, unknown>;
                expect(data).not.toHaveProperty('createdById');
                expect(data).not.toHaveProperty('updatedById');
                expect(data).not.toHaveProperty('deletedAt');
                expect(data).not.toHaveProperty('deletedById');
            }
        });

        it('AccommodationPublicSchema strips adminInfo and moderationState', () => {
            const raw = {
                id: TEST_UUID,
                slug: 'test-accommodation',
                name: 'Test Accommodation',
                type: 'CABIN',
                summary: 'A short summary for testing purposes here.',
                description:
                    'A longer description that satisfies the minimum length requirement for accommodation.',
                isFeatured: false,
                destinationId: TEST_UUID_2,
                // Admin-only fields that must be stripped
                adminInfo: { notes: 'Internal admin note', favorite: true },
                moderationState: 'PENDING',
                lastWarnedAt: new Date(),
                translationMeta: { es: { name: { status: 'approved' } } }
            };

            const result = AccommodationPublicSchema.safeParse(raw);
            expect(result.success).toBe(true);
            if (result.success) {
                const data = result.data as Record<string, unknown>;
                expect(data).not.toHaveProperty('adminInfo');
                expect(data).not.toHaveProperty('moderationState');
                expect(data).not.toHaveProperty('lastWarnedAt');
                expect(data).not.toHaveProperty('translationMeta');
            }
        });

        it('Pagination envelope with zero results uses positive pageSize and totalPages=0 (no 500 on empty)', () => {
            /**
             * REGRESSION for the pageSize=total bug:
             * When total===0, the old code set pageSize: 0 which fails
             * z.number().int().positive() → stripWithSchema throws → HTTP 500.
             * After the fix: pageSize is the fixed TOP_RATED_PAGE_SIZE constant (10),
             * and totalPages is 0 (semantically honest: zero pages when zero items).
             * Both satisfy their schema constraints: positive() passes for 10, min(0) passes for 0.
             */
            const schema = PaginationResultSchema(AccommodationPublicSchema);

            const emptyEnvelope = {
                data: [],
                pagination: {
                    page: 1,
                    pageSize: 10, // Fixed constant, NOT 0
                    total: 0,
                    totalPages: 0, // 0 pages when 0 items
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };

            const result = schema.safeParse(emptyEnvelope);
            expect(
                result.success,
                'Empty-result envelope must parse successfully — pageSize=10 satisfies positive(), totalPages=0 satisfies min(0)'
            ).toBe(true);
        });
    });

    describe('Path parameter validation', () => {
        it('should return 400 or 422 for a non-UUID destination ID', async () => {
            try {
                const res = await app.request(
                    '/api/v1/public/accommodations/destination/not-a-uuid/top-rated',
                    {
                        method: 'GET',
                        headers: { 'user-agent': 'vitest', accept: 'application/json' }
                    }
                );
                // Invalid UUID should fail param validation
                expect([400, 422]).toContain(res.status);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([400, 401, 403, 422]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });
});
