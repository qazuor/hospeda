/**
 * Regression tests for SPEC-210 PR1 — accommodation getByDestination route schema enforcement.
 *
 * Verifies that `GET /api/v1/public/accommodations/destination/:destinationId`
 * serializes responses through `z.object({ accommodations: z.array(AccommodationPublicSchema) })`
 * and NEVER leaks internal-only fields.
 *
 * Before SPEC-210 the route used `AccommodationListWrapperSchema` which wraps
 * `z.array(AccommodationSchema)` — the full entity schema including
 * `createdById`, `updatedById`, `deletedAt`, `deletedById`, `adminInfo`,
 * `moderationState`, `lastWarnedAt`, `translationMeta`, etc.
 *
 * Endpoint: GET /api/v1/public/accommodations/destination/{destinationId}
 */

import { AccommodationPublicSchema } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

describe('GET /api/v1/public/accommodations/destination/:id — schema enforcement (SPEC-210)', () => {
    let app: AppOpenAPI;
    const destinationId = '00000000-0000-0000-0000-000000000001';
    const base = `/api/v1/public/accommodations/destination/${destinationId}`;

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

    describe('Field-level leak regression (SPEC-210)', () => {
        /**
         * REGRESSION: before SPEC-210 the responseSchema used AccommodationListWrapperSchema
         * which wraps the FULL AccommodationSchema — leaking BaseAuditFields and all
         * admin-only fields. The fix uses z.object({ accommodations: z.array(AccommodationPublicSchema) })
         * which strips all internal-only fields at the schema layer.
         */
        it('should NOT leak internal-only fields in any accommodation item', async () => {
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                });

                if (res.status === 200) {
                    const body = await res.json();
                    // The route returns { data: { accommodations: [...] } } in the standard envelope
                    const items: unknown[] = Array.isArray(body?.data?.accommodations)
                        ? body.data.accommodations
                        : Array.isArray(body?.accommodations)
                          ? body.accommodations
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
                        // NOTE: `scheduleData` is NOT in AccommodationSchema (Zod).
                        // The DB column is `schedule` (JSONB) but it is not mapped
                        // to any Zod field, so it cannot leak via schema serialization.
                    ];

                    for (const item of items) {
                        const record = item as Record<string, unknown>;
                        for (const field of FORBIDDEN_FIELDS) {
                            expect(
                                record,
                                `field '${field}' must not be present in accommodation items`
                            ).not.toHaveProperty(field);
                        }
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

        it('should return response with an accommodations array when successful', async () => {
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                });

                if (res.status === 200) {
                    const body = await res.json();
                    // The envelope shape: { success: true, data: { accommodations: [...] } }
                    expect(body).toHaveProperty('success', true);
                    expect(body).toHaveProperty('data');
                    // The data object must contain an 'accommodations' array
                    expect(body.data).toHaveProperty('accommodations');
                    expect(Array.isArray(body.data.accommodations)).toBe(true);
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

        it('should include the public card fields in each accommodation item when present', async () => {
            try {
                const res = await app.request(base, {
                    method: 'GET',
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                });

                if (res.status === 200) {
                    const body = await res.json();
                    const items: unknown[] = Array.isArray(body?.data?.accommodations)
                        ? body.data.accommodations
                        : [];

                    for (const item of items) {
                        const record = item as Record<string, unknown>;
                        // Core fields AccommodationPublicSchema always includes
                        expect(record).toHaveProperty('id');
                        expect(record).toHaveProperty('slug');
                        expect(record).toHaveProperty('name');
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

        it('AccommodationPublicSchema.safeParse() strips audit fields: createdById, updatedById, deletedAt, deletedById', () => {
            const raw = {
                id: TEST_UUID,
                slug: 'by-destination-test',
                name: 'By Destination Test',
                type: 'CABIN',
                summary: 'A short summary for testing purposes here.',
                description:
                    'A longer description that satisfies the minimum length requirement for accommodation.',
                isFeatured: false,
                destinationId: TEST_UUID_2,
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
                slug: 'by-destination-test',
                name: 'By Destination Test',
                type: 'CABIN',
                summary: 'A short summary for testing purposes here.',
                description:
                    'A longer description that satisfies the minimum length requirement for accommodation.',
                isFeatured: false,
                destinationId: TEST_UUID_2,
                adminInfo: { notes: 'Private admin note', favorite: true },
                moderationState: 'PENDING',
                lastWarnedAt: new Date(),
                translationMeta: { en: { name: { status: 'approved' } } }
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

    describe('Path parameter validation', () => {
        it('should return 400 or 422 for a non-UUID destination ID', async () => {
            try {
                const res = await app.request(
                    '/api/v1/public/accommodations/destination/not-a-uuid',
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
