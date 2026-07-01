/**
 * Integration tests for POST /api/v1/admin/accommodations/:id/verify
 * Verify / unverify accommodation — Admin endpoint (SPEC-291 Phase 3a)
 *
 * Coverage:
 * - Auth: guest actor (no credentials) returns 401
 * - Auth: actor lacking ACCOMMODATION_VERIFY permission returns 403
 * - Happy path verify: isVerified=true → 201 with isVerified:true, service called
 * - Service args: verifyAccommodation called with actor + id + isVerified
 * - Happy path unverify: isVerified=false → 201 with isVerified:false
 * - Error: accommodation not found → 404
 * - Input validation: missing isVerified → 400
 * - Route registration: path does not return 404
 *
 * Testing strategy: minimal Hono app (bypasses global middleware) + mocked
 * @repo/service-core + mocked actor context + mocked createResponse (to bypass
 * AccommodationAdminSchema stripWithSchema validation on lean fixture objects).
 *
 * UUID note: Zod v4 uuid() enforces RFC 4122 version (1-8) and variant ([89abAB])
 * bits — '00000000-0000-0000-0000-000000000001' is invalid (version=0). Use proper
 * v4 UUIDs like 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' in all fixtures.
 *
 * @module test/routes/accommodation-verify
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Hoist mocks — must run before any imports of the mocked modules
// ---------------------------------------------------------------------------

const { mockVerifyAccommodation, mockAdminGetById } = vi.hoisted(() => ({
    mockVerifyAccommodation: vi.fn(),
    mockAdminGetById: vi.fn()
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(() => ({
            verifyAccommodation: mockVerifyAccommodation,
            adminGetById: mockAdminGetById
        }))
    };
});

// Mutable mock actor — allows per-test override via beforeEach/it setup
const { mockActorRef } = vi.hoisted(() => ({
    mockActorRef: {
        value: {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            role: 'SUPER_ADMIN',
            permissions: ['access.panelAdmin', 'accommodation.verify']
        }
    }
}));

vi.mock('../../src/utils/actor.js', () => ({
    getActorFromContext: () => mockActorRef.value,
    // authorization.ts imports isGuestActor — mirror the real logic here
    isGuestActor: (actor: { role: string }) => actor.role === 'GUEST',
    createGuestActor: () => ({ id: 'guest', role: 'GUEST', permissions: [] })
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// Bypass createResponse → stripWithSchema schema validation on lean fixture objects.
// stripWithSchema is a closure-scoped call inside createResponse (same module), so
// mocking the export alone has no effect. We replace createResponse entirely with a
// minimal implementation that returns the same envelope shape the real one does.
vi.mock('../../src/utils/response-helpers.js', async () => {
    const actual = await vi.importActual<typeof import('../../src/utils/response-helpers.js')>(
        '../../src/utils/response-helpers.js'
    );
    return {
        ...actual,
        // biome-ignore lint/suspicious/noExplicitAny: test-only simplification
        createResponse: (data: unknown, c: any, statusCode = 200) =>
            c.json({ success: true, data }, statusCode)
    };
});

// ---------------------------------------------------------------------------
// Route import — MUST come after all vi.mock() calls
// ---------------------------------------------------------------------------

import { adminVerifyAccommodationRoute } from '../../src/routes/accommodation/admin/verify.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACCOMMODATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACTOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BASE_URL = `/${ACCOMMODATION_ID}/verify`;

const ADMIN_ACTOR = {
    id: ACTOR_ID,
    role: 'SUPER_ADMIN',
    permissions: ['access.panelAdmin', 'accommodation.verify']
};

const VERIFIED_DATA = { id: ACCOMMODATION_ID, isVerified: true };
const UNVERIFIED_DATA = { id: ACCOMMODATION_ID, isVerified: false };

// ---------------------------------------------------------------------------
// App factory — minimal Hono app to bypass global middleware chain
// ---------------------------------------------------------------------------

function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>({ strict: false });
    app.route('/', adminVerifyAccommodationRoute);
    return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /:id/verify — adminVerifyAccommodationRoute (SPEC-291 Phase 3a)', () => {
    let app: Hono<AppBindings>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset to full-permission admin actor for each test
        mockActorRef.value = { ...ADMIN_ACTOR };

        // Default service mocks — successful verify
        mockVerifyAccommodation.mockResolvedValue({ data: VERIFIED_DATA, error: undefined });
        mockAdminGetById.mockResolvedValue({ data: VERIFIED_DATA, error: undefined });

        app = buildApp();
    });

    // ── Route registration ─────────────────────────────────────────────────────

    describe('Route registration', () => {
        it('is registered — POST to the path does NOT return 404', async () => {
            const res = await app.request(BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isVerified: true })
            });
            expect(res.status).not.toBe(404);
        });
    });

    // ── Authentication: guest actor → 401 ────────────────────────────────────

    describe('Authentication', () => {
        it('returns 401 when the actor is a guest (unauthenticated)', async () => {
            mockActorRef.value = { id: 'guest', role: 'GUEST', permissions: [] };

            const res = await app.request(BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isVerified: true })
            });

            expect(res.status).toBe(401);
        });
    });

    // ── Authorization: missing permission → 403 ────────────────────────────────

    describe('Authorization', () => {
        it('returns 403 when actor lacks ACCOMMODATION_VERIFY permission', async () => {
            mockActorRef.value = {
                id: ACTOR_ID,
                role: 'SUPER_ADMIN',
                // access.panelAdmin present but accommodation.verify is absent
                permissions: ['access.panelAdmin']
            };

            const res = await app.request(BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isVerified: true })
            });

            expect(res.status).toBe(403);
        });
    });

    // ── Happy path: verify (isVerified: true) ──────────────────────────────────

    describe('Happy path — verify (isVerified: true)', () => {
        it('returns 201 with isVerified:true in the response body', async () => {
            const res = await app.request(BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isVerified: true })
            });

            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data).toBeDefined();
            expect(body.data.id).toBe(ACCOMMODATION_ID);
            expect(body.data.isVerified).toBe(true);
        });

        it('calls verifyAccommodation with the actor, accommodation id, and isVerified=true', async () => {
            await app.request(BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isVerified: true })
            });

            expect(mockVerifyAccommodation).toHaveBeenCalledTimes(1);
            const [calledActor, calledId, calledFlag] = mockVerifyAccommodation.mock.calls[0] as [
                unknown,
                string,
                boolean
            ];
            expect(calledActor).toMatchObject({ id: ACTOR_ID, role: 'SUPER_ADMIN' });
            expect(calledId).toBe(ACCOMMODATION_ID);
            expect(calledFlag).toBe(true);
        });
    });

    // ── Happy path: unverify (isVerified: false) ───────────────────────────────

    describe('Happy path — unverify (isVerified: false)', () => {
        beforeEach(() => {
            mockVerifyAccommodation.mockResolvedValue({ data: UNVERIFIED_DATA, error: undefined });
            mockAdminGetById.mockResolvedValue({ data: UNVERIFIED_DATA, error: undefined });
        });

        it('returns 201 with isVerified:false in the response body', async () => {
            const res = await app.request(BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isVerified: false })
            });

            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.isVerified).toBe(false);
        });

        it('calls verifyAccommodation with isVerified=false', async () => {
            await app.request(BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isVerified: false })
            });

            expect(mockVerifyAccommodation).toHaveBeenCalledTimes(1);
            const [_calledActor, calledId, calledFlag] = mockVerifyAccommodation.mock.calls[0] as [
                unknown,
                string,
                boolean
            ];
            expect(calledId).toBe(ACCOMMODATION_ID);
            expect(calledFlag).toBe(false);
        });
    });

    // ── Error: accommodation not found → 404 ──────────────────────────────────

    describe('Error handling', () => {
        it('returns 404 when verifyAccommodation resolves with NOT_FOUND', async () => {
            mockVerifyAccommodation.mockResolvedValue({
                data: undefined,
                error: { code: 'NOT_FOUND', message: 'Accommodation not found' }
            });

            const res = await app.request(BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isVerified: true })
            });

            expect(res.status).toBe(404);
        });
    });

    // ── Input validation ───────────────────────────────────────────────────────

    describe('Input validation', () => {
        it('returns 400 when the request body is missing the isVerified field', async () => {
            const res = await app.request(BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            expect(res.status).toBe(400);
        });
    });
});
