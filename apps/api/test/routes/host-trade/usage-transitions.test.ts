/**
 * The shared usage transitions (HOS-376 T-033).
 *
 * ```
 * POST /api/v1/protected/host-trades/usages/{id}/confirm
 * POST /api/v1/protected/host-trades/usages/{id}/reject
 * POST /api/v1/protected/host-trades/usages/{id}/reject/undo
 * ```
 *
 * The property worth pinning is that these endpoints are ROLE-BLIND. One pair
 * serves a host and a provider identically, because `declaredBy` on the row
 * decides who the counterpart is. A future "tidy-up" that branched on the
 * actor's role would break the account that is both — which spec §6.2 supports
 * on purpose — and it would break it silently, since every single-role caller
 * would keep working.
 *
 * The other is that EVERY refusal is 404. A 403 anywhere here would confirm the
 * id exists.
 *
 * @module test/routes/host-trade/usage-transitions
 */

import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const { mockConfirm, mockReject, mockUndo } = vi.hoisted(() => ({
    mockConfirm: vi.fn(),
    mockReject: vi.fn(),
    mockUndo: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeUsageService: vi.fn().mockImplementation(function () {
            return {
                confirmUsage: mockConfirm,
                rejectUsage: mockReject,
                undoRejection: mockUndo
            };
        })
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedConfirmUsageRoute, protectedRejectUsageRoute, protectedUndoRejectionRoute } =
    await import('../../../src/routes/host-trade/protected/usage-transitions.js');

const { createErrorHandler } = await import('../../../src/middlewares/response.js');

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const USAGE_ID = '33333333-3333-4333-8333-333333333333';

const MOCK_USAGE = {
    id: USAGE_ID,
    hostTradeId: '22222222-2222-4222-8222-222222222222',
    hostUserId: ACTOR_ID,
    declaredBy: 'PROVIDER',
    declaredById: '44444444-4444-4444-8444-444444444444',
    creationChannel: 'LINKED_SELECTOR',
    status: 'CONFIRMED',
    servicedAt: '2026-08-01',
    note: null,
    expiresAt: new Date('2026-09-01T00:00:00Z').toISOString(),
    confirmedAt: new Date('2026-08-02T00:00:00Z').toISOString(),
    rejectedAt: null,
    rejectionNote: null,
    createdAt: new Date('2026-08-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-08-02T00:00:00Z').toISOString()
};

function buildApp(roles: RoleEnum[] = [RoleEnum.USER]): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use((c, next) => {
        c.set('actor', { id: ACTOR_ID, roles, permissions: [] });
        return next();
    });
    app.route('/', protectedConfirmUsageRoute);
    app.route('/', protectedRejectUsageRoute);
    app.route('/', protectedUndoRejectionRoute);
    return app;
}

const post = (app: Hono<AppBindings>, path: string, body?: unknown) =>
    app.request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {})
    });

beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockResolvedValue({ data: { usage: MOCK_USAGE } });
    mockReject.mockResolvedValue({
        data: { usage: { ...MOCK_USAGE, status: 'REJECTED', confirmedAt: null } }
    });
    mockUndo.mockResolvedValue({
        data: { usage: { ...MOCK_USAGE, status: 'PENDING', confirmedAt: null } }
    });
});

describe('POST /usages/{id}/confirm', () => {
    it('confirms and hands the id straight to the service', async () => {
        const app = buildApp();

        const res = await post(app, `/usages/${USAGE_ID}/confirm`);

        expect(res.status).toBe(201);
        expect(mockConfirm).toHaveBeenCalledWith({ usageId: USAGE_ID }, expect.anything());
    });

    /** AC-6 — and 404, not 403, so the answer admits nothing about the row. */
    it('answers 404 when the actor is not the counterpart', async () => {
        mockConfirm.mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'Usage not found' }
        });
        const app = buildApp();

        const res = await post(app, `/usages/${USAGE_ID}/confirm`);

        expect(res.status).toBe(404);
    });

    it('answers 400 when the usage is no longer PENDING', async () => {
        mockConfirm.mockResolvedValue({
            error: { code: ServiceErrorCode.VALIDATION_ERROR, message: 'Usage is CONFIRMED' }
        });
        const app = buildApp();

        const res = await post(app, `/usages/${USAGE_ID}/confirm`);

        expect(res.status).toBe(400);
    });

    it('rejects an id that is not a uuid', async () => {
        const app = buildApp();

        const res = await post(app, '/usages/not-a-uuid/confirm');

        expect(res.status).toBe(400);
        expect(mockConfirm).not.toHaveBeenCalled();
    });
});

describe('POST /usages/{id}/reject', () => {
    it('passes the note through when one is given', async () => {
        const app = buildApp();

        const res = await post(app, `/usages/${USAGE_ID}/reject`, { note: 'Nunca vino a casa' });

        expect(res.status).toBe(201);
        expect(mockReject).toHaveBeenCalledWith(
            { usageId: USAGE_ID, note: 'Nunca vino a casa' },
            expect.anything()
        );
    });

    /**
     * Refusing must stay cheap: requiring a written explanation to say "that
     * never happened" puts friction on the one control that keeps the public
     * counter honest (§6.5).
     */
    it('accepts a rejection with no note at all', async () => {
        const app = buildApp();

        const res = await post(app, `/usages/${USAGE_ID}/reject`);

        expect(res.status).toBe(201);
        expect(mockReject).toHaveBeenCalledWith(
            { usageId: USAGE_ID, note: undefined },
            expect.anything()
        );
    });

    it('answers 404 when the actor is not the counterpart', async () => {
        mockReject.mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'Usage not found' }
        });
        const app = buildApp();

        const res = await post(app, `/usages/${USAGE_ID}/reject`);

        expect(res.status).toBe(404);
    });
});

describe('POST /usages/{id}/reject/undo', () => {
    it('reverts the rejection', async () => {
        const app = buildApp();

        const res = await post(app, `/usages/${USAGE_ID}/reject/undo`);

        expect(res.status).toBe(201);
        expect(mockUndo).toHaveBeenCalledWith({ usageId: USAGE_ID }, expect.anything());
    });

    /**
     * The undo path must not be swallowed by `/usages/{id}/reject`: they share
     * a prefix, and a request for the undo landing on the reject would silently
     * re-reject a usage the caller was trying to restore.
     */
    it('does not fall through to the reject route', async () => {
        const app = buildApp();

        await post(app, `/usages/${USAGE_ID}/reject/undo`);

        expect(mockUndo).toHaveBeenCalled();
        expect(mockReject).not.toHaveBeenCalled();
    });

    it('answers 404 when somebody other than the rejector undoes it', async () => {
        mockUndo.mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'Usage not found' }
        });
        const app = buildApp();

        const res = await post(app, `/usages/${USAGE_ID}/reject/undo`);

        expect(res.status).toBe(404);
    });
});

describe('role blindness', () => {
    /**
     * THE POINT OF THE SHARED ENDPOINTS. The same request must behave
     * identically whoever the caller is, because the row decides the
     * counterpart. Asserted across the three role shapes that exist in
     * practice — including the account that is BOTH, which is the one a
     * role-branching implementation would break.
     */
    it.each([
        ['a plain user', [RoleEnum.USER]],
        ['a host', [RoleEnum.HOST]],
        ['a host who is also a provider', [RoleEnum.HOST, RoleEnum.USER]]
    ])('confirms identically for %s', async (_label, roles) => {
        const app = buildApp(roles as RoleEnum[]);

        const res = await post(app, `/usages/${USAGE_ID}/confirm`);

        expect(res.status).toBe(201);
        expect(mockConfirm).toHaveBeenCalledWith({ usageId: USAGE_ID }, expect.anything());
    });
});
