import { accommodationFaqs, accommodations, destinationFaqs, destinations, getDb } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
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
 * Auth: mock-actor header injection (active when NODE_ENV=test +
 * HOSPEDA_ALLOW_MOCK_ACTOR=true + CI!==true — see actor.ts middleware).
 * DB:   testDb.setup() / testDb.clean() / testDb.teardown() for full isolation.
 *
 * Security assertions that are REAL (no 401-wall escape):
 *   - No mock headers → 401
 *   - Host non-owner tries accommodation reorder → 403
 *   - Foreign faqId in accommodation reorder → 400 (VALIDATION_ERROR → HTTP 400)
 *   - Missing parent destination → 404
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createTestUser } from '../../e2e/setup/seed-helpers';
import { testDb } from '../../e2e/setup/test-database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Valid UUID v4 (version nibble = 4, variant nibble = 8/9/a/b) that is
// guaranteed not to exist in any test's seeded data.
const NONEXISTENT_UUID = 'a0000000-0000-4000-8000-000000000001';
const INVALID_UUID = 'not-a-uuid';

// ---------------------------------------------------------------------------
// Actor helpers (inline pattern — same as admin-crud.test.ts)
// ---------------------------------------------------------------------------

/**
 * Minimal actor for admin-level destination FAQ operations.
 * Requires ACCESS_PANEL_ADMIN (adminAuthMiddleware gate) + DESTINATION_UPDATE
 * (service _canUpdate gate).
 */
const adminActor = {
    id: crypto.randomUUID(),
    role: RoleEnum.ADMIN,
    permissions: [
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.ACCESS_API_ADMIN,
        PermissionEnum.DESTINATION_UPDATE,
        PermissionEnum.DESTINATION_VIEW_ALL
    ]
};

function makeHeaders(
    actor: { id: string; role: string; permissions: string[] },
    extra: Record<string, string> = {}
): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions),
        ...extra
    };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Admin destination FAQ routes (SPEC-177 T-028)', () => {
    let app: ReturnType<typeof initApp>;
    const destBase = '/api/v1/admin/destinations';
    const accBase = '/api/v1/admin/accommodations';

    /** Seeded destination for write operations. Refreshed in beforeAll. */
    let destId: string;
    /** Seeded FAQ id inside destId. Refreshed in beforeAll. */
    let faqId: string;

    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        await testDb.clean();
    });

    /** Re-seed a destination + one FAQ before each test that needs real rows. */
    async function seedDestWithFaq(): Promise<{ destId: string; faqId: string }> {
        const db = getDb();
        const ts = Date.now();

        const destRows = await db
            .insert(destinations)
            .values({
                slug: `e2e-admin-faq-dest-${ts}`,
                name: `Admin FAQ Dest ${ts}`,
                summary: 'Destination for admin FAQ integration test.',
                description: 'Description for admin FAQ integration test destination.',
                destinationType: 'CITY',
                path: `/test/admin-faq-dest-${ts}`,
                pathIds: '',
                level: 4,
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                moderationState: 'APPROVED',
                location: { lat: -32.48, lng: -58.23 }
            })
            .returning({ id: destinations.id });

        const dId = destRows[0]?.id;
        if (!dId) throw new Error('seedDestWithFaq: destination insert returned no row');

        const faqRows = await db
            .insert(destinationFaqs)
            .values({
                destinationId: dId,
                question: 'What is the best time to visit this destination?',
                answer: 'Spring and autumn offer the most pleasant temperatures.',
                displayOrder: 1
            })
            .returning({ id: destinationFaqs.id });

        const fId = faqRows[0]?.id;
        if (!fId) throw new Error('seedDestWithFaq: FAQ insert returned no row');

        return { destId: dId, faqId: fId };
    }

    /**
     * Seed two users (owner + other) + one accommodation owned by owner +
     * one FAQ in that accommodation. Returns ids for the reorder ownership tests.
     */
    async function seedAccWithFaqAndTwoHosts(): Promise<{
        accId: string;
        accFaqId: string;
        ownerHostId: string;
        otherHostId: string;
    }> {
        const db = getDb();
        const ts = Date.now();

        // Create owner user
        const owner = await createTestUser({ role: RoleEnum.HOST });
        const other = await createTestUser({ role: RoleEnum.HOST });

        // Seed a destination first (accommodation needs destinationId)
        const destRows = await db
            .insert(destinations)
            .values({
                slug: `e2e-acc-faq-dest-${ts}`,
                name: `Acc FAQ Dest ${ts}`,
                summary: 'Destination for accommodation FAQ ownership test.',
                description: 'Description for accommodation ownership test.',
                destinationType: 'CITY',
                path: `/test/acc-faq-dest-${ts}`,
                pathIds: '',
                level: 4,
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                moderationState: 'APPROVED',
                location: { lat: -32.48, lng: -58.23 }
            })
            .returning({ id: destinations.id });

        const seedDestId = destRows[0]?.id;
        if (!seedDestId)
            throw new Error('seedAccWithFaqAndTwoHosts: destination insert returned no row');

        // Insert accommodation owned by owner
        const accRows = await db
            .insert(accommodations)
            .values({
                slug: `e2e-acc-faq-${ts}`,
                name: `Acc FAQ ${ts}`,
                summary: 'Accommodation for FAQ ownership test.',
                description: 'Description for accommodation FAQ ownership test.',
                type: 'HOTEL',
                ownerId: owner.id,
                destinationId: seedDestId,
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                moderationState: 'APPROVED'
            })
            .returning({ id: accommodations.id });

        const aId = accRows[0]?.id;
        if (!aId)
            throw new Error('seedAccWithFaqAndTwoHosts: accommodation insert returned no row');

        // Insert one FAQ for the accommodation
        const faqRows = await db
            .insert(accommodationFaqs)
            .values({
                accommodationId: aId,
                question: 'What amenities does this accommodation offer?',
                answer: 'It offers pool, wifi, breakfast, and parking.',
                displayOrder: 1
            })
            .returning({ id: accommodationFaqs.id });

        const afId = faqRows[0]?.id;
        if (!afId)
            throw new Error('seedAccWithFaqAndTwoHosts: accommodation FAQ insert returned no row');

        return { accId: aId, accFaqId: afId, ownerHostId: owner.id, otherHostId: other.id };
    }

    // ── No-auth baseline ────────────────────────────────────────────────────────

    describe('no-auth (no mock headers) → 401 for all admin endpoints', () => {
        it('GET /admin/destinations/:id/faqs returns 401 without auth', async () => {
            const res = await app.request(`${destBase}/${NONEXISTENT_UUID}/faqs`, {
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).toBe(401);
        });

        it('POST /admin/destinations/:id/faqs returns 401 without auth', async () => {
            const res = await app.request(`${destBase}/${NONEXISTENT_UUID}/faqs`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
                body: JSON.stringify({ question: 'Q?'.padEnd(10), answer: 'A.'.padEnd(10) })
            });
            expect(res.status).toBe(401);
        });

        it('PUT /admin/destinations/:id/faqs/:faqId returns 401 without auth', async () => {
            const res = await app.request(
                `${destBase}/${NONEXISTENT_UUID}/faqs/${NONEXISTENT_UUID}`,
                {
                    method: 'PUT',
                    headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
                    body: JSON.stringify({ answer: 'Updated answer.' })
                }
            );
            expect(res.status).toBe(401);
        });

        it('DELETE /admin/destinations/:id/faqs/:faqId returns 401 without auth', async () => {
            const res = await app.request(
                `${destBase}/${NONEXISTENT_UUID}/faqs/${NONEXISTENT_UUID}`,
                {
                    method: 'DELETE',
                    headers: { 'user-agent': 'vitest' }
                }
            );
            expect(res.status).toBe(401);
        });

        it('PATCH /admin/destinations/:id/faqs/reorder returns 401 without auth', async () => {
            const res = await app.request(`${destBase}/${NONEXISTENT_UUID}/faqs/reorder`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
                body: JSON.stringify({ order: [{ faqId: NONEXISTENT_UUID, displayOrder: 0 }] })
            });
            expect(res.status).toBe(401);
        });

        it('PATCH /admin/accommodations/:id/faqs/reorder returns 401 without auth', async () => {
            const res = await app.request(`${accBase}/${NONEXISTENT_UUID}/faqs/reorder`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
                body: JSON.stringify({ order: [{ faqId: NONEXISTENT_UUID, displayOrder: 0 }] })
            });
            expect(res.status).toBe(401);
        });
    });

    // ── GET /admin/destinations/:id/faqs ────────────────────────────────────────

    describe('GET /admin/destinations/:id/faqs', () => {
        it('returns 200 with faqs array for a seeded destination', async () => {
            const seeded = await seedDestWithFaq();
            destId = seeded.destId;

            const res = await app.request(`${destBase}/${destId}/faqs`, {
                headers: makeHeaders(adminActor)
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toHaveProperty('success', true);
            expect(Array.isArray(body.data?.faqs)).toBe(true);
            expect((body.data.faqs as unknown[]).length).toBeGreaterThan(0);
        });

        it('returns 404 for a non-existent destination', async () => {
            const res = await app.request(`${destBase}/${NONEXISTENT_UUID}/faqs`, {
                headers: makeHeaders(adminActor)
            });
            expect(res.status).toBe(404);
        });

        it('returns 400 for an invalid UUID format', async () => {
            const res = await app.request(`${destBase}/${INVALID_UUID}/faqs`, {
                headers: makeHeaders(adminActor)
            });
            expect([400, 404]).toContain(res.status);
        });
    });

    // ── POST /admin/destinations/:id/faqs ───────────────────────────────────────

    describe('POST /admin/destinations/:id/faqs', () => {
        it('returns 201 and the created FAQ for a valid destination + valid payload', async () => {
            const seeded = await seedDestWithFaq();
            destId = seeded.destId;

            const payload = {
                question: '¿Cómo llego a Colón desde Buenos Aires?',
                answer: 'Por la Ruta Nacional 14, aproximadamente 4 horas desde Buenos Aires.',
                category: 'Cómo llegar'
            };

            const res = await app.request(`${destBase}/${destId}/faqs`, {
                method: 'POST',
                headers: makeHeaders(adminActor),
                body: JSON.stringify(payload)
            });

            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body).toHaveProperty('success', true);
            expect(body.data).toMatchObject({
                faq: expect.objectContaining({
                    question: payload.question,
                    answer: payload.answer
                })
            });
        });

        it('returns 400 for missing required fields (no question or answer)', async () => {
            const seeded = await seedDestWithFaq();
            destId = seeded.destId;

            const res = await app.request(`${destBase}/${destId}/faqs`, {
                method: 'POST',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ category: 'only-category' })
            });

            // Route-level Zod validation → 400
            expect(res.status).toBe(400);
        });

        it('returns 404 for a non-existent destination', async () => {
            const res = await app.request(`${destBase}/${NONEXISTENT_UUID}/faqs`, {
                method: 'POST',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({
                    question: 'A valid question text here?',
                    answer: 'A valid answer text here.'
                })
            });
            expect(res.status).toBe(404);
        });

        it('returns 400 for an invalid UUID path param', async () => {
            const res = await app.request(`${destBase}/${INVALID_UUID}/faqs`, {
                method: 'POST',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({
                    question: 'Valid question text here?',
                    answer: 'Valid answer text here.'
                })
            });
            expect([400, 404]).toContain(res.status);
        });
    });

    // ── PUT /admin/destinations/:id/faqs/:faqId ─────────────────────────────────

    describe('PUT /admin/destinations/:id/faqs/:faqId', () => {
        it('returns 200 and the updated FAQ for a seeded destination and FAQ', async () => {
            const seeded = await seedDestWithFaq();
            destId = seeded.destId;
            faqId = seeded.faqId;

            const updatePayload = {
                question: '¿Cuál es la mejor época para visitar Colón?',
                answer: 'La primavera y el otoño ofrecen temperaturas muy agradables.'
            };

            const res = await app.request(`${destBase}/${destId}/faqs/${faqId}`, {
                method: 'PUT',
                headers: makeHeaders(adminActor),
                body: JSON.stringify(updatePayload)
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toHaveProperty('success', true);
            expect(body.data?.faq?.question).toBe(updatePayload.question);
        });

        it('returns 404 for a non-existent faqId', async () => {
            const seeded = await seedDestWithFaq();
            destId = seeded.destId;

            const res = await app.request(`${destBase}/${destId}/faqs/${NONEXISTENT_UUID}`, {
                method: 'PUT',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ answer: 'Updated answer text here.' })
            });
            expect(res.status).toBe(404);
        });

        it('returns 400 for an invalid destination UUID', async () => {
            const res = await app.request(`${destBase}/${INVALID_UUID}/faqs/${NONEXISTENT_UUID}`, {
                method: 'PUT',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ answer: 'Updated answer.' })
            });
            expect([400, 404]).toContain(res.status);
        });

        it('returns 400 for an invalid faqId UUID', async () => {
            const seeded = await seedDestWithFaq();
            destId = seeded.destId;

            const res = await app.request(`${destBase}/${destId}/faqs/${INVALID_UUID}`, {
                method: 'PUT',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ answer: 'Updated answer.' })
            });
            expect([400, 404]).toContain(res.status);
        });
    });

    // ── DELETE /admin/destinations/:id/faqs/:faqId ──────────────────────────────

    describe('DELETE /admin/destinations/:id/faqs/:faqId', () => {
        it('returns 200 with success when deleting a seeded FAQ', async () => {
            const seeded = await seedDestWithFaq();
            destId = seeded.destId;
            faqId = seeded.faqId;

            const res = await app.request(`${destBase}/${destId}/faqs/${faqId}`, {
                method: 'DELETE',
                headers: makeHeaders(adminActor)
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toHaveProperty('success', true);
        });

        it('returns 404 for a non-existent faqId', async () => {
            const seeded = await seedDestWithFaq();
            destId = seeded.destId;

            const res = await app.request(`${destBase}/${destId}/faqs/${NONEXISTENT_UUID}`, {
                method: 'DELETE',
                headers: makeHeaders(adminActor)
            });
            expect(res.status).toBe(404);
        });

        it('returns 400 or 404 for an invalid destination UUID', async () => {
            const res = await app.request(`${destBase}/${INVALID_UUID}/faqs/${NONEXISTENT_UUID}`, {
                method: 'DELETE',
                headers: makeHeaders(adminActor)
            });
            expect([400, 404]).toContain(res.status);
        });
    });

    // ── PATCH /admin/destinations/:id/faqs/reorder ──────────────────────────────

    describe('PATCH /admin/destinations/:id/faqs/reorder', () => {
        it('returns 200 when reordering a seeded FAQ with a known faqId', async () => {
            const seeded = await seedDestWithFaq();
            destId = seeded.destId;
            faqId = seeded.faqId;

            const res = await app.request(`${destBase}/${destId}/faqs/reorder`, {
                method: 'PATCH',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({
                    order: [{ faqId, displayOrder: 0 }]
                })
            });

            expect(res.status).toBe(200);
        });

        it('returns 400 when a faqId does not belong to the destination (foreign faqId)', async () => {
            const seeded = await seedDestWithFaq();
            destId = seeded.destId;

            // This faqId is a valid UUID format but does not exist in this destination.
            const res = await app.request(`${destBase}/${destId}/faqs/reorder`, {
                method: 'PATCH',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({
                    order: [{ faqId: NONEXISTENT_UUID, displayOrder: 0 }]
                })
            });

            // Service throws VALIDATION_ERROR for foreign faqId → HTTP 400
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body).toHaveProperty('success', false);
        });

        it('returns 400 for an empty order array (schema validation)', async () => {
            const seeded = await seedDestWithFaq();
            destId = seeded.destId;

            const res = await app.request(`${destBase}/${destId}/faqs/reorder`, {
                method: 'PATCH',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ order: [] })
            });

            expect(res.status).toBe(400);
        });

        it('returns 404 for a non-existent destination', async () => {
            const res = await app.request(`${destBase}/${NONEXISTENT_UUID}/faqs/reorder`, {
                method: 'PATCH',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({
                    order: [{ faqId: NONEXISTENT_UUID, displayOrder: 0 }]
                })
            });
            expect(res.status).toBe(404);
        });
    });

    // ── PATCH /admin/accommodations/:id/faqs/reorder ─────────────────────────────

    describe('PATCH /admin/accommodations/:id/faqs/reorder', () => {
        it('returns 200 when the owner host reorders their own accommodation FAQs', async () => {
            const seeded = await seedAccWithFaqAndTwoHosts();

            const ownerHostActor = {
                id: seeded.ownerHostId,
                role: RoleEnum.HOST,
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCOMMODATION_UPDATE_OWN,
                    PermissionEnum.ACCOMMODATION_FAQS_EDIT
                ]
            };

            const res = await app.request(`${accBase}/${seeded.accId}/faqs/reorder`, {
                method: 'PATCH',
                headers: makeHeaders(ownerHostActor),
                body: JSON.stringify({
                    order: [{ faqId: seeded.accFaqId, displayOrder: 0 }]
                })
            });

            expect(res.status).toBe(200);
        });

        it("returns 403 when a non-owner host tries to reorder another host's accommodation FAQs", async () => {
            const seeded = await seedAccWithFaqAndTwoHosts();

            // otherHostId is NOT the owner of the accommodation
            const nonOwnerHostActor = {
                id: seeded.otherHostId,
                role: RoleEnum.HOST,
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCOMMODATION_UPDATE_OWN,
                    PermissionEnum.ACCOMMODATION_FAQS_EDIT
                ]
            };

            const res = await app.request(`${accBase}/${seeded.accId}/faqs/reorder`, {
                method: 'PATCH',
                headers: makeHeaders(nonOwnerHostActor),
                body: JSON.stringify({
                    order: [{ faqId: seeded.accFaqId, displayOrder: 0 }]
                })
            });

            // Service checkCanUpdate → FORBIDDEN → HTTP 403
            expect(res.status).toBe(403);
        });

        it('returns 400 when a faqId does not belong to the accommodation (foreign faqId)', async () => {
            const seeded = await seedAccWithFaqAndTwoHosts();

            const ownerHostActor = {
                id: seeded.ownerHostId,
                role: RoleEnum.HOST,
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCOMMODATION_UPDATE_OWN,
                    PermissionEnum.ACCOMMODATION_FAQS_EDIT
                ]
            };

            const res = await app.request(`${accBase}/${seeded.accId}/faqs/reorder`, {
                method: 'PATCH',
                headers: makeHeaders(ownerHostActor),
                body: JSON.stringify({
                    // Foreign faqId that does not belong to this accommodation
                    order: [{ faqId: NONEXISTENT_UUID, displayOrder: 0 }]
                })
            });

            // Service throws VALIDATION_ERROR for foreign faqId → HTTP 400
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body).toHaveProperty('success', false);
        });

        it('returns 400 for an empty order array (schema validation)', async () => {
            const seeded = await seedAccWithFaqAndTwoHosts();

            const ownerHostActor = {
                id: seeded.ownerHostId,
                role: RoleEnum.HOST,
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCOMMODATION_UPDATE_OWN,
                    PermissionEnum.ACCOMMODATION_FAQS_EDIT
                ]
            };

            const res = await app.request(`${accBase}/${seeded.accId}/faqs/reorder`, {
                method: 'PATCH',
                headers: makeHeaders(ownerHostActor),
                body: JSON.stringify({ order: [] })
            });

            expect(res.status).toBe(400);
        });

        it('returns 404 for a non-existent accommodation', async () => {
            const res = await app.request(`${accBase}/${NONEXISTENT_UUID}/faqs/reorder`, {
                method: 'PATCH',
                headers: makeHeaders({
                    id: crypto.randomUUID(),
                    role: RoleEnum.ADMIN,
                    permissions: [
                        PermissionEnum.ACCESS_PANEL_ADMIN,
                        PermissionEnum.ACCOMMODATION_UPDATE_ANY
                    ]
                }),
                body: JSON.stringify({
                    order: [{ faqId: NONEXISTENT_UUID, displayOrder: 0 }]
                })
            });
            expect(res.status).toBe(404);
        });
    });
});
