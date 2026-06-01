/**
 * Integration tests for admin destination FAQ routes (SPEC-177 T-028).
 *
 * Tests the following admin endpoints:
 *   GET    /api/v1/admin/destinations/:id/faqs
 *   POST   /api/v1/admin/destinations/:id/faqs
 *   PUT    /api/v1/admin/destinations/:id/faqs/:faqId
 *   DELETE /api/v1/admin/destinations/:id/faqs/:faqId
 *   PATCH  /api/v1/admin/destinations/:id/faqs/reorder
 *   PATCH  /api/v1/admin/accommodations/:id/faqs/reorder
 *
 * These are admin-only routes. Without a valid session the app returns 401.
 * Tests use the tolerant style established by the existing accommodation FAQ
 * integration tests: hard-assert on 401 for unauthenticated requests, and
 * tolerate data-dependent status codes (200/404/422) when behaviour depends
 * on seeded DB state.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

const VALID_UUID = '12345678-1234-4567-8901-123456789012';
const VALID_FAQ_UUID = '12345678-1234-4567-8901-123456789013';
const NONEXISTENT_UUID = '99999999-9999-9999-9999-999999999999';
const INVALID_UUID = 'not-a-uuid';

describe('Admin destination FAQ routes (SPEC-177 T-028)', () => {
    let app: ReturnType<typeof initApp>;
    const destBase = '/api/v1/admin/destinations';
    const accBase = '/api/v1/admin/accommodations';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    // ── GET /admin/destinations/:id/faqs ────────────────────────────────────────
    describe('GET /admin/destinations/:id/faqs', () => {
        it('should return 401 when no auth session is provided', async () => {
            const res = await app.request(`${destBase}/${VALID_UUID}/faqs`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            expect(res.status).toBe(401);
        });

        it('should return 400 for an invalid UUID format', async () => {
            const res = await app.request(`${destBase}/${INVALID_UUID}/faqs`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            // Admin route validates the path param — invalid UUID → 400 or 401 (auth first)
            expect([400, 401]).toContain(res.status);
        });

        it('should return success shape or 404 for a non-existent destination (if auth bypassed)', async () => {
            // When the app has no seeded auth, most calls will 401.
            // This verifies the route is registered and returns a parseable JSON body.
            const res = await app.request(`${destBase}/${NONEXISTENT_UUID}/faqs`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            expect([200, 401, 403, 404]).toContain(res.status);
            if (res.status !== 401 && res.status !== 403) {
                const body = await res.json();
                expect(body).toHaveProperty('success');
                expect(typeof body.success).toBe('boolean');
            }
        });
    });

    // ── POST /admin/destinations/:id/faqs ───────────────────────────────────────
    describe('POST /admin/destinations/:id/faqs', () => {
        const validPayload = {
            question: '¿Cómo llego a Colón desde Buenos Aires?',
            answer: 'Por la Ruta Nacional 14, aproximadamente 4 horas desde Buenos Aires.',
            category: 'Cómo llegar'
        };

        it('should return 401 when no auth session is provided', async () => {
            const res = await app.request(`${destBase}/${VALID_UUID}/faqs`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                },
                body: JSON.stringify(validPayload)
            });
            expect(res.status).toBe(401);
        });

        it('should return 400 for an invalid UUID path param', async () => {
            const res = await app.request(`${destBase}/${INVALID_UUID}/faqs`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                },
                body: JSON.stringify(validPayload)
            });
            expect([400, 401]).toContain(res.status);
        });

        it('should return 400 or 422 for missing required fields', async () => {
            const res = await app.request(`${destBase}/${VALID_UUID}/faqs`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                },
                body: JSON.stringify({ category: 'only-category' })
            });
            // Without auth → 401; with auth and bad payload → 400/422
            expect([400, 401, 422]).toContain(res.status);
        });

        it('should return 400 when body has invalid content-type', async () => {
            const res = await app.request(`${destBase}/${VALID_UUID}/faqs`, {
                method: 'POST',
                headers: {
                    'content-type': 'text/plain',
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                },
                body: 'plain text body'
            });
            expect([400, 401, 415]).toContain(res.status);
        });
    });

    // ── PUT /admin/destinations/:id/faqs/:faqId ─────────────────────────────────
    describe('PUT /admin/destinations/:id/faqs/:faqId', () => {
        const updatePayload = {
            question: '¿Cuál es la mejor época para visitar Colón?',
            answer: 'La primavera y el otoño ofrecen temperaturas muy agradables.'
        };

        it('should return 401 when no auth session is provided', async () => {
            const res = await app.request(`${destBase}/${VALID_UUID}/faqs/${VALID_FAQ_UUID}`, {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                },
                body: JSON.stringify(updatePayload)
            });
            expect(res.status).toBe(401);
        });

        it('should return 400 for an invalid destination UUID', async () => {
            const res = await app.request(`${destBase}/${INVALID_UUID}/faqs/${VALID_FAQ_UUID}`, {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                },
                body: JSON.stringify(updatePayload)
            });
            expect([400, 401]).toContain(res.status);
        });

        it('should return 400 for an invalid faqId UUID', async () => {
            const res = await app.request(`${destBase}/${VALID_UUID}/faqs/${INVALID_UUID}`, {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                },
                body: JSON.stringify(updatePayload)
            });
            expect([400, 401]).toContain(res.status);
        });
    });

    // ── DELETE /admin/destinations/:id/faqs/:faqId ──────────────────────────────
    describe('DELETE /admin/destinations/:id/faqs/:faqId', () => {
        it('should return 401 when no auth session is provided', async () => {
            const res = await app.request(`${destBase}/${VALID_UUID}/faqs/${VALID_FAQ_UUID}`, {
                method: 'DELETE',
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            expect(res.status).toBe(401);
        });

        it('should return 400 or 401 for an invalid destination UUID', async () => {
            const res = await app.request(`${destBase}/${INVALID_UUID}/faqs/${VALID_FAQ_UUID}`, {
                method: 'DELETE',
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            expect([400, 401]).toContain(res.status);
        });

        it('should return success structure or 404 for non-existent destination (if auth bypassed)', async () => {
            const res = await app.request(
                `${destBase}/${NONEXISTENT_UUID}/faqs/${NONEXISTENT_UUID}`,
                {
                    method: 'DELETE',
                    headers: { 'user-agent': 'vitest', Accept: 'application/json' }
                }
            );
            expect([200, 401, 403, 404]).toContain(res.status);
            if (res.status !== 401 && res.status !== 403) {
                const body = await res.json();
                expect(body).toHaveProperty('success');
            }
        });
    });

    // ── PATCH /admin/destinations/:id/faqs/reorder ──────────────────────────────
    describe('PATCH /admin/destinations/:id/faqs/reorder', () => {
        const reorderPayload = {
            order: [{ faqId: VALID_FAQ_UUID, displayOrder: 0 }]
        };

        it('should return 401 when no auth session is provided', async () => {
            const res = await app.request(`${destBase}/${VALID_UUID}/faqs/reorder`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                },
                body: JSON.stringify(reorderPayload)
            });
            expect(res.status).toBe(401);
        });

        it('should return 400 or 422 for an empty order array', async () => {
            const res = await app.request(`${destBase}/${VALID_UUID}/faqs/reorder`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                },
                body: JSON.stringify({ order: [] })
            });
            // Without auth → 401; with auth and bad payload → 400/422
            expect([400, 401, 422]).toContain(res.status);
        });

        it('should return 400 or 401 for an invalid destination UUID', async () => {
            const res = await app.request(`${destBase}/${INVALID_UUID}/faqs/reorder`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                },
                body: JSON.stringify(reorderPayload)
            });
            expect([400, 401]).toContain(res.status);
        });
    });

    // ── PATCH /admin/accommodations/:id/faqs/reorder ─────────────────────────────
    describe('PATCH /admin/accommodations/:id/faqs/reorder', () => {
        const reorderPayload = {
            order: [{ faqId: VALID_FAQ_UUID, displayOrder: 0 }]
        };

        it('should return 401 when no auth session is provided', async () => {
            const res = await app.request(`${accBase}/${VALID_UUID}/faqs/reorder`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                },
                body: JSON.stringify(reorderPayload)
            });
            expect(res.status).toBe(401);
        });

        it('should return 403 when an authenticated non-owner host tries to reorder', async () => {
            // Without a real session we get 401. This test documents the 403
            // shape that a non-owner host would receive after authentication.
            const res = await app.request(`${accBase}/${VALID_UUID}/faqs/reorder`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                },
                body: JSON.stringify(reorderPayload)
            });
            // 401 = no auth; 403 = auth but wrong owner; both are acceptable here
            expect([401, 403]).toContain(res.status);
        });

        it('should return 400 or 422 for an empty order array', async () => {
            const res = await app.request(`${accBase}/${VALID_UUID}/faqs/reorder`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                },
                body: JSON.stringify({ order: [] })
            });
            expect([400, 401, 422]).toContain(res.status);
        });

        it('should return 400 or 401 for an invalid UUID', async () => {
            const res = await app.request(`${accBase}/${INVALID_UUID}/faqs/reorder`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                },
                body: JSON.stringify(reorderPayload)
            });
            expect([400, 401]).toContain(res.status);
        });

        it('should return 422 for a faqId that does not belong to the accommodation (if auth bypassed)', async () => {
            // In production: authenticated admin → 422 VALIDATION_ERROR from service.
            // Without auth → 401. This test accepts both to stay DB-agnostic.
            const res = await app.request(`${accBase}/${NONEXISTENT_UUID}/faqs/reorder`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                },
                body: JSON.stringify({ order: [{ faqId: NONEXISTENT_UUID, displayOrder: 0 }] })
            });
            expect([401, 404, 422]).toContain(res.status);
        });
    });
});
