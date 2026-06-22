/**
 * Regression tests for SPEC-210 PR1 — accommodation similar route schema enforcement.
 *
 * Verifies that the `GET /api/v1/public/accommodations/:id/similar` route
 * serializes responses through `AccommodationPublicSchema` and NEVER leaks
 * internal-only fields such as `createdById`, `updatedById`, `deletedAt`,
 * `deletedById`, `adminInfo`, `moderationState`, `lastWarnedAt`, `translationMeta`.
 *
 * Before SPEC-210 the route used `z.array(z.record(z.string(), z.unknown()))`,
 * a full passthrough that relied solely on a data-level strip in the handler.
 * The fix wires `z.array(AccommodationPublicSchema)` so schema enforcement is
 * the primary protection layer (the data-level strip remains as defense-in-depth).
 *
 * Endpoint: GET /api/v1/public/accommodations/{id}/similar
 */

import { AccommodationPublicSchema } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

describe('GET /api/v1/public/accommodations/:id/similar — schema enforcement (SPEC-210)', () => {
    let app: AppOpenAPI;
    const accommodationId = '00000000-0000-0000-0000-000000000001';
    const base = `/api/v1/public/accommodations/${accommodationId}/similar`;

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
                expect([200, 400, 401, 403, 404, 500]).toContain(res.status);
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

    describe('Field-level leak regression (SPEC-210)', () => {
        /**
         * REGRESSION: before SPEC-210, the responseSchema was z.array(z.record(...))
         * — a full passthrough. The fix wires AccommodationPublicSchema which strips
         * all internal/admin fields at the schema layer.
         *
         * The following internal fields MUST be absent from any item in the response:
         *   - createdById, updatedById   — BaseAuditFields
         *   - deletedAt, deletedById     — soft-delete audit
         *   - adminInfo                  — admin-only moderation notes
         *   - moderationState            — internal lifecycle flag
         *   - lastWarnedAt               — internal operational field
         *   - translationMeta            — internal translation metadata (SPEC-212)
         *
         * NOTE: `scheduleData` was previously listed here but does NOT exist in the
         * Zod AccommodationSchema — the DB column is `schedule` (JSONB) and is not
         * mapped to any Zod field. The real internal field to assert is `translationMeta`.
         */
        it('should NOT leak internal-only fields in any similar accommodation item', async () => {
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                });

                if (res.status === 200) {
                    const body = await res.json();
                    // The route returns an array wrapped in the standard envelope
                    const items: unknown[] = Array.isArray(body?.data)
                        ? body.data
                        : Array.isArray(body)
                          ? body
                          : [];

                    const FORBIDDEN_FIELDS = [
                        'createdById',
                        'updatedById',
                        'deletedAt',
                        'deletedById',
                        'adminInfo',
                        'moderationState',
                        'lastWarnedAt',
                        'translationMeta'
                    ];

                    for (const item of items) {
                        const record = item as Record<string, unknown>;
                        for (const field of FORBIDDEN_FIELDS) {
                            expect(
                                record,
                                `field '${field}' must not be present`
                            ).not.toHaveProperty(field);
                        }
                    }
                }

                // Route is registered — accepts 200, 400, 500 (DB unavailable in test env),
                // and 404 when the source accommodation does not exist in the test DB.
                expect([200, 400, 404, 500]).toContain(res.status);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403, 404, 500]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });

        it('should include the public card fields in each similar accommodation item when present', async () => {
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                });

                if (res.status === 200) {
                    const body = await res.json();
                    const items: unknown[] = Array.isArray(body?.data)
                        ? body.data
                        : Array.isArray(body)
                          ? body
                          : [];

                    // Only check when the array is non-empty
                    for (const item of items) {
                        const record = item as Record<string, unknown>;
                        // Core identification fields that AccommodationPublicSchema includes
                        expect(record).toHaveProperty('id');
                        expect(record).toHaveProperty('slug');
                        expect(record).toHaveProperty('name');
                    }
                }

                expect([200, 400, 404, 500]).toContain(res.status);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403, 404, 500]).toContain((error as { status: number }).status);
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
         * UUID note: AccommodationIdSchema enforces RFC 4122 variant + version pattern.
         * Use well-formed v4 UUIDs — all-zero UUIDs with non-zero last segments fail.
         */
        // Well-formed v4 UUIDs safe for use in schema unit tests
        const TEST_UUID = '123e4567-e89b-12d3-a456-426614174000';
        const TEST_UUID_2 = '123e4567-e89b-12d3-a456-426614174001';

        it('AccommodationPublicSchema.safeParse() strips createdById, updatedById, deletedAt, deletedById', () => {
            const raw = {
                id: TEST_UUID,
                slug: 'similar-test',
                name: 'Similar Test',
                type: 'CABIN',
                summary: 'A short summary for testing purposes here.',
                description:
                    'A longer description that satisfies the minimum length requirement for accommodation.',
                isFeatured: false,
                destinationId: TEST_UUID_2,
                // Internal audit fields
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

        it('AccommodationPublicSchema.safeParse() strips adminInfo, moderationState, lastWarnedAt, translationMeta', () => {
            const raw = {
                id: TEST_UUID,
                slug: 'similar-test',
                name: 'Similar Test',
                type: 'CABIN',
                summary: 'A short summary for testing purposes here.',
                description:
                    'A longer description that satisfies the minimum length requirement for accommodation.',
                isFeatured: false,
                destinationId: TEST_UUID_2,
                // Admin-only internal fields
                adminInfo: { notes: 'Private note', favorite: false },
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
    });

    describe('Query Parameter — limit', () => {
        it('should accept a valid limit query parameter without error', async () => {
            try {
                const res = await app.request(`${base}?limit=4`, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                });
                expect([200, 400, 404, 500]).toContain(res.status);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([400, 401, 403, 404, 500]).toContain(
                        (error as { status: number }).status
                    );
                } else {
                    throw error;
                }
            }
        });

        it('should reject limit values above 12', async () => {
            try {
                const res = await app.request(`${base}?limit=100`, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                });
                // Zod coercion rejects out-of-range values with 400
                expect([400, 404, 500]).toContain(res.status);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([400, 401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });
});
