/**
 * HOS-1141 — a broken actor path may not cost the redirect.
 *
 * ## What this file exists to stop
 *
 * Forwarding the scanner's cookie so `qr_code_scans.user_id` can be populated
 * made the API's global `actorMiddleware` resolve a real actor on the QR
 * resolution route. That middleware fails LOUD by design (HOS-296): a failed
 * role read is an outage, surfaced as 503, because degrading it would change
 * WHO the actor is on routes where identity changes the answer.
 *
 * On THIS route identity changes nothing — the response body is byte-identical
 * for a guest and a signed-in scanner — so that policy turned a metrics column
 * into a new way for the redirect to fail. Measured before the fix, with
 * `getUserRoles` throwing:
 *
 * ```
 * HTTP status ............ 503
 * handler reached? ....... findOne calls = 0
 * scan row written? ...... createScan calls = 0
 * ```
 *
 * A signed-in visitor got a dead sticker because a role table was briefly
 * unreadable — and a printed QR that leads nowhere cannot be corrected, which
 * is the premise the whole epic rests on.
 *
 * ## Why the assertions look the way they do
 *
 * Every probe here asserts the SCAN ROW, not only the status code. That is the
 * lesson of this PR's mutation 4: removing the user-agent truncation left the
 * status at a perfectly healthy 200 while the scan silently vanished, and a
 * status-only test saw nothing. "The redirect survived" and "the scan was
 * recorded" are two different guarantees and both are load-bearing here.
 *
 * The negative control is equally load-bearing: without it, widening
 * `ACTOR_OPTIONAL_PATH_PATTERNS` to `/^.*$/` — which would restore the exact
 * fail-open HOS-296 was written to prevent, on every route in the API — would
 * leave this whole file green.
 *
 * Runs under the default `apps/api` vitest config.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Controllable stand-ins for the two QR models. */
const qrDb = vi.hoisted(() => {
    const rows = new Map<string, Record<string, unknown>>();
    return {
        rows,
        findOne: vi.fn(async (where: { slug: string }) => rows.get(where.slug) ?? null),
        createScan: vi.fn(async (data: Record<string, unknown>) => ({
            id: '99999999-9999-4999-8999-999999999999',
            scannedAt: new Date(),
            ...data
        }))
    };
});

/**
 * The role read, which is the failure this file is about. Stubbed at the
 * package boundary rather than at the database, because `resolveHeldRoles`
 * treats a THROW and an EMPTY RESULT as the same outage and both have to be
 * reachable from a test.
 */
const roleReader = vi.hoisted(() => ({
    getUserRoles: vi.fn(async (): Promise<readonly string[]> => [])
}));

// The real service-core, with only the role read replaced. `test/setup.ts`
// mocks the whole package, and under that mock the route's errors all collapse
// into one shape — which would make every probe below compare artefacts of the
// mock rather than the behaviour.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, getUserRoles: roleReader.getUserRoles };
});

vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../../helpers/mocks/db-mock');
    const base = createDbMock() as Record<string, unknown>;
    return {
        ...base,
        QrCodeModel: class {
            async findOne(where: { slug: string }) {
                return qrDb.findOne(where);
            }
        },
        QrCodeScanModel: class {
            async create(data: Record<string, unknown>) {
                return qrDb.createScan(data);
            }
        }
    };
});

import { RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import type { AppBindings } from '../../../src/types';

const SLUG = 'Live2345';
const QR_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_URL = 'https://hospeda.com.ar/es/destinos/colon/';
const SIGNED_IN_USER_ID = '55555555-5555-4555-8555-555555555555';

/** The path the route is really mounted at (`routes/index.ts`). */
const REAL_MOUNT = '/api/v1/public/qr';
/** Any other mount, to prove the tolerance is scoped to a path and not global. */
const FOREIGN_MOUNT = '/api/v1/public/not-qr';

/**
 * Builds an app with the REAL `actorMiddleware`, which is the component under
 * test. A middleware standing in for `authMiddleware` sets the session user, so
 * the actor branch that reads roles is the one that runs.
 */
async function buildApp(mount: string): Promise<Hono<AppBindings>> {
    const { actorMiddleware } = await import('../../../src/middlewares/actor.js');
    const { publicResolveQrCodeRoute } = await import(
        '../../../src/routes/qr-code/public/resolve.js'
    );

    const app = new Hono<AppBindings>();
    app.use((c, next) => {
        c.set('user', { id: SIGNED_IN_USER_ID } as never);
        return next();
    });
    app.use(actorMiddleware());
    app.route(mount, publicResolveQrCodeRoute);
    return app;
}

beforeEach(() => {
    qrDb.rows.clear();
    qrDb.rows.set(SLUG, {
        id: QR_ID,
        slug: SLUG,
        targetUrl: TARGET_URL,
        label: 'Cartel de la plaza',
        description: null,
        source: 'MANUAL',
        entityType: null,
        entityId: null,
        renderOptions: {},
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        deletedAt: null,
        createdById: null,
        updatedById: null,
        deletedById: null
    });
    qrDb.findOne.mockClear();
    qrDb.createScan.mockClear();
    roleReader.getUserRoles.mockReset();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('QR resolution — a failing actor path degrades instead of 503ing', () => {
    it.each([
        [
            'the role read THROWS',
            () => roleReader.getUserRoles.mockRejectedValue(new Error('user_role is unreachable'))
        ],
        ['the role read returns an EMPTY set', () => roleReader.getUserRoles.mockResolvedValue([])]
    ])('still resolves, and still records the scan, when %s', async (_label, arrange) => {
        arrange();
        const app = await buildApp(REAL_MOUNT);

        const res = await app.request(`${REAL_MOUNT}/${SLUG}`, {
            headers: { 'user-agent': 'Mozilla/5.0 (iPhone) Mobile' }
        });
        const body = (await res.json()) as { data?: { targetUrl?: string } };

        // The visit survives.
        expect(res.status).toBe(200);
        expect(body.data?.targetUrl).toBe(TARGET_URL);

        // And the scan is still counted — the half a status-only assertion
        // cannot see. This is exactly the shape mutation 4 exposed elsewhere in
        // this PR: HTTP 200 with zero rows written.
        expect(qrDb.createScan).toHaveBeenCalledTimes(1);

        // Attributed to nobody, because a guest actor is all that could be
        // honestly resolved. Not the guest sentinel UUID, which would be a
        // foreign key pointing at a users row that does not exist.
        expect(qrDb.createScan.mock.calls[0]?.[0]).toMatchObject({
            qrCodeId: QR_ID,
            userId: null,
            targetUrlAtScan: TARGET_URL
        });
    });

    it('attributes the scan normally when the role read WORKS', async () => {
        // Non-vacuity. Without this, an implementation that hardcoded
        // `userId: null` — losing the column's whole purpose — would satisfy
        // every other assertion in this file.
        roleReader.getUserRoles.mockResolvedValue([RoleEnum.USER]);
        const app = await buildApp(REAL_MOUNT);

        const res = await app.request(`${REAL_MOUNT}/${SLUG}`, {
            headers: { 'user-agent': 'Mozilla/5.0 (iPhone) Mobile' }
        });

        expect(res.status).toBe(200);
        expect(qrDb.createScan.mock.calls[0]?.[0]).toMatchObject({
            userId: SIGNED_IN_USER_ID
        });
    });

    it('STILL answers 503 on a route that is not actor-optional', async () => {
        // The negative control, and the reason the allowlist is not a loophole.
        // HOS-296's fail-loud identity policy has to remain intact everywhere
        // it was not deliberately relaxed: widening the pattern list to match
        // every path would restore the exact fail-open it was written to
        // prevent, and without this probe that widening would be invisible.
        roleReader.getUserRoles.mockRejectedValue(new Error('user_role is unreachable'));
        const app = await buildApp(FOREIGN_MOUNT);

        const res = await app.request(`${FOREIGN_MOUNT}/${SLUG}`, {
            headers: { 'user-agent': 'Mozilla/5.0 (iPhone) Mobile' }
        });

        expect(res.status).toBe(503);
        // The handler never ran, so nothing was recorded — the pre-fix
        // behaviour, preserved where it belongs.
        expect(qrDb.findOne).not.toHaveBeenCalled();
        expect(qrDb.createScan).not.toHaveBeenCalled();
    });

    it('does not treat a path that merely STARTS like the QR route as actor-optional', async () => {
        // `/api/v1/public/qrx/...` is a different route. Anchoring matters: an
        // unanchored pattern would hand the tolerance to anything sharing the
        // prefix, which is how an allowlist quietly stops being a list.
        roleReader.getUserRoles.mockRejectedValue(new Error('user_role is unreachable'));
        const app = await buildApp('/api/v1/public/qrx');

        const res = await app.request(`/api/v1/public/qrx/${SLUG}`, {
            headers: { 'user-agent': 'Mozilla/5.0 (iPhone) Mobile' }
        });

        expect(res.status).toBe(503);
    });
});
