/**
 * HOS-981 — `GET /api/v1/public/qr/{slug}`.
 *
 * The load-bearing assertion in this file is the PAIRED one: a slug that never
 * existed and a slug that was retired must be answered with the same object,
 * compared as one value. Two adjacent green assertions — "404 for the unknown
 * one" next to "404 for the retired one" — is precisely what the defect looks
 * like from inside a suite, because both can be 404 while the message, the code
 * or the body shape differ (the HOS-600 finding lived in a single capital
 * letter). So every not-found case here is compared against the others with
 * `toEqual`, never with `expect.objectContaining`, which is blind to a field
 * only one side carries.
 *
 * ## What is real and what is stubbed, and why it matters
 *
 * `@repo/service-core` is un-mocked file-locally: `test/setup.ts` replaces the
 * whole package including `ServiceError`, and under that mock every route error
 * becomes a 500 — a paired probe would then compare two artefacts of the mock
 * and pass with the bug in place. Only the two `@repo/db` MODELS are stubbed,
 * so `QrCodeService.resolveBySlug` really runs. That is deliberate: the rule
 * "unknown, retired and deleted are one answer" is enforced inside the service,
 * so a test that stubbed `resolveBySlug` itself would probe the same branch
 * three times and could not see a mutation that made a retired code answer
 * differently.
 *
 * Runs under the default `apps/api` vitest config.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Per-test control over what the stubbed models return. Hoisted so the
 * `vi.mock` factory below (which is hoisted too) can close over it. */
const qrDb = vi.hoisted(() => {
    const rows = new Map<string, Record<string, unknown>>();
    return {
        rows,
        /** Every read of `qr_codes` this route can cause passes through here. */
        findOne: vi.fn(async (where: { slug: string }) => rows.get(where.slug) ?? null),
        createScan: vi.fn(async (data: { qrCodeId: string }) => ({
            id: '99999999-9999-4999-8999-999999999999',
            qrCodeId: data.qrCodeId,
            scannedAt: new Date()
        }))
    };
});

// Restores the real service-core for this file only. Must precede any import of
// the package.
vi.mock(
    '@repo/service-core',
    async (importOriginal) => await importOriginal<Record<string, unknown>>()
);

// OVERRIDES the two QR models with controllable ones. The global mock
// (`helpers/mocks/db-mock.ts`) already carries both — it has to, because
// `routes/index.ts` constructs a `QrCodeService` at module scope and every
// app-booting test would otherwise throw — but its stubs are static, and these
// probes need `findOne` to answer differently per slug and `create` to be
// spy-able. Everything else keeps the shared stub so the rest of service-core
// still imports cleanly.
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
            async create(data: { qrCodeId: string }) {
                return qrDb.createScan(data);
            }
        }
    };
});

import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { Hono } from 'hono';
import type { AppBindings } from '../../../src/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Slugs use the QR alphabet, which excludes the ambiguous characters
 * `0 1 I O U l o u` — a slug has to survive being read off a sticker.
 */
const LIVE_SLUG = 'Live2345';
const RETIRED_SLUG = 'Retired2';
const DELETED_SLUG = 'Erased23';
const UNKNOWN_SLUG = 'Missing2';

const LIVE_ID = '11111111-1111-4111-8111-111111111111';
const RETIRED_ID = '22222222-2222-4222-8222-222222222222';
const DELETED_ID = '33333333-3333-4333-8333-333333333333';

const TARGET_URL = 'https://hospeda.com.ar/es/destinos/colon/';

/** A guest actor, which is what every real caller of this endpoint is. */
const guestActor = {
    id: '00000000-0000-4000-8000-000000000000',
    roles: [RoleEnum.GUEST] as readonly RoleEnum[],
    permissions: []
};

function qrRow({
    id,
    slug,
    isActive,
    deletedAt
}: {
    readonly id: string;
    readonly slug: string;
    readonly isActive: boolean;
    readonly deletedAt: Date | null;
}): Record<string, unknown> {
    return {
        id,
        slug,
        targetUrl: TARGET_URL,
        label: 'Cartel de la plaza',
        description: 'Interno, no debe salir por la API pública',
        source: 'MANUAL',
        entityType: null,
        entityId: null,
        renderOptions: {},
        isActive,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        deletedAt,
        createdById: '44444444-4444-4444-8444-444444444444',
        updatedById: null,
        deletedById: null
    };
}

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------

type Probe = { readonly status: number; readonly body: unknown };

/**
 * Builds the app around the real route. No error handler is attached: the route
 * factory catches internally and formats through the REAL `handleRouteError`,
 * so what these probes compare is the body production actually sends.
 */
async function buildApp(): Promise<Hono<AppBindings>> {
    const { publicResolveQrCodeRoute } = await import(
        '../../../src/routes/qr-code/public/resolve.js'
    );
    const app = new Hono<AppBindings>();
    app.use((c, next) => {
        c.set('actor', guestActor);
        return next();
    });
    app.route('/', publicResolveQrCodeRoute);
    return app;
}

/**
 * Issues one GET and captures the complete answer. `metadata` is replaced by
 * its sorted key list rather than dropped: `timestamp` and `requestId` vary per
 * request by design and disclose nothing, but a probe that grew or lost a
 * metadata field would still be caught.
 */
async function probe(app: Hono<AppBindings>, slug: string): Promise<Probe> {
    const res = await app.request(`/${encodeURIComponent(slug)}`, {
        headers: { 'user-agent': 'vitest' }
    });
    const text = await res.text();
    let body: unknown;
    try {
        body = JSON.parse(text);
    } catch {
        return { status: res.status, body: text };
    }
    if (body && typeof body === 'object' && 'metadata' in body) {
        const { metadata, ...rest } = body as Record<string, unknown>;
        body = { ...rest, metadataKeys: Object.keys(metadata as object).sort() };
    }
    return { status: res.status, body };
}

beforeEach(() => {
    qrDb.rows.clear();
    qrDb.rows.set(
        LIVE_SLUG,
        qrRow({ id: LIVE_ID, slug: LIVE_SLUG, isActive: true, deletedAt: null })
    );
    qrDb.rows.set(
        RETIRED_SLUG,
        qrRow({ id: RETIRED_ID, slug: RETIRED_SLUG, isActive: false, deletedAt: null })
    );
    qrDb.rows.set(
        DELETED_SLUG,
        qrRow({
            id: DELETED_ID,
            slug: DELETED_SLUG,
            isActive: true,
            deletedAt: new Date('2026-02-01T00:00:00.000Z')
        })
    );
    qrDb.findOne.mockClear();
    qrDb.createScan.mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// The paired probe
// ---------------------------------------------------------------------------

describe('GET /public/qr/{slug} — every unresolvable slug answers the same thing', () => {
    it('a retired code is indistinguishable from one that never existed', async () => {
        const app = await buildApp();

        const retired = await probe(app, RETIRED_SLUG);
        const unknown = await probe(app, UNKNOWN_SLUG);

        // Whole-object equality. This is the assertion that fails when a
        // mutation gives the retired branch its own message, its own code or
        // its own body shape.
        expect(retired).toEqual(unknown);

        // And the shared answer really is the 404 the contract prescribes, so a
        // regression that broke BOTH into an identical 500 cannot pass by being
        // uniformly wrong.
        expect(retired.status).toBe(404);
        const error = (retired.body as { error?: { code?: string; message?: string } }).error;
        expect(error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(error?.code).not.toBe(ServiceErrorCode.INTERNAL_ERROR);

        // R5 / anti-enumeration: the refusal names neither the slug that was
        // asked about nor the reason it failed. Echoing the slug back would
        // hand a scanner a way to confirm which of its guesses reached a row,
        // and naming the reason would undo the collapse above.
        expect(error?.message).toEqual(expect.any(String));
        expect(error?.message).not.toContain(RETIRED_SLUG);
        expect(error?.message).not.toMatch(/retired|inactive|deleted|disabled/i);
    });

    it('a soft-deleted code is indistinguishable from one that never existed', async () => {
        const app = await buildApp();

        const deleted = await probe(app, DELETED_SLUG);
        const unknown = await probe(app, UNKNOWN_SLUG);

        expect(deleted).toEqual(unknown);
        expect(deleted.status).toBe(404);
    });

    it.each([
        ['too short for the slug schema', 'ab'],
        ['a path-traversal attempt', '../../etc/passwd'],
        ['a zero-width character inside a valid slug', 'Live​2345'],
        ['a character outside the QR alphabet', 'Live0011'],
        ['an absurd length', 'A'.repeat(4096)]
    ])('a malformed slug (%s) answers the same 404, never a 400 or a 500', async (_label, bad) => {
        const app = await buildApp();

        const malformed = await probe(app, bad);
        const unknown = await probe(app, UNKNOWN_SLUG);

        expect(malformed).toEqual(unknown);
        expect(malformed.status).toBe(404);
    });

    it('answers 404 for a malformed slug WITHOUT reading the database', async () => {
        // The other half of the oracle. A value that never reaches a query
        // cannot be told apart by how long the answer took, and it satisfies
        // the contract's "no step may touch the database with a value an
        // earlier step did not validate".
        const app = await buildApp();

        await probe(app, '../../etc/passwd');
        await probe(app, 'A'.repeat(4096));
        await probe(app, 'ab');

        expect(qrDb.findOne).not.toHaveBeenCalled();

        // Instrument check: the spy DOES see a read on a well-formed slug, so
        // the assertion above cannot be green because the stub was bypassed.
        await probe(app, UNKNOWN_SLUG);
        expect(qrDb.findOne).toHaveBeenCalledTimes(1);
    });

    it('does not record a scan for a code that did not resolve', async () => {
        const app = await buildApp();

        await probe(app, RETIRED_SLUG);
        await probe(app, UNKNOWN_SLUG);
        await probe(app, DELETED_SLUG);

        expect(qrDb.createScan).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// The resolving path
// ---------------------------------------------------------------------------

describe('GET /public/qr/{slug} — a live code', () => {
    it('answers 200 with the target URL and records exactly one scan', async () => {
        const app = await buildApp();

        const res = await probe(app, LIVE_SLUG);

        expect(res.status).toBe(200);
        const data = (res.body as { data?: Record<string, unknown> }).data;
        expect(data?.targetUrl).toBe(TARGET_URL);
        expect(data?.slug).toBe(LIVE_SLUG);
        expect(data?.id).toBe(LIVE_ID);

        expect(qrDb.createScan).toHaveBeenCalledTimes(1);
        expect(qrDb.createScan).toHaveBeenCalledWith({ qrCodeId: LIVE_ID });
    });

    it('discloses the three resolution fields and NOTHING else', async () => {
        // Key equality, not `objectContaining`: the risk here is a field that
        // should not be present, which `objectContaining` cannot see. `label`
        // and `description` are operator-facing and this endpoint requires no
        // authentication.
        const app = await buildApp();

        const res = await probe(app, LIVE_SLUG);
        const data = (res.body as { data?: Record<string, unknown> }).data ?? {};

        expect(Object.keys(data).sort()).toEqual(['id', 'slug', 'targetUrl']);
    });

    it('records the scan with the code id and nothing else (no IP, no user-agent)', async () => {
        const app = await buildApp();

        await probe(app, LIVE_SLUG);

        const [payload] = qrDb.createScan.mock.calls[0] ?? [];
        expect(Object.keys(payload ?? {})).toEqual(['qrCodeId']);
    });
});

// ---------------------------------------------------------------------------
// The scan is lost before the redirect is
// ---------------------------------------------------------------------------

/**
 * A failed scan write reaches the route in TWO different shapes, and both have
 * to be swallowed. The distinction is not academic — it is the base service's
 * documented behaviour and it was found by mutating this file:
 *
 *   - An ordinary `Error` is caught by `BaseService.ln`, converted to a
 *     `ServiceError` and RETURNED as `result.error`. A route that only wrapped
 *     the call in `try`/`catch` would let this one through untouched.
 *   - A `DbError` (`error.name === 'DbError'`) is deliberately RE-THROWN by
 *     `ln` so the HTTP layer can map its type — which is exactly the shape a
 *     real database outage produces. A route that only checked `result.error`
 *     would 500 on it.
 *
 * Only the second shape can break the response, because the route's `catch`
 * covers the first one as well. That makes the `result.error` branch a LOGGING
 * branch, so it is pinned by asserting the log rather than the status — a
 * status-only pair here would leave that branch free to be deleted (measured:
 * mutating it to rethrow left every status assertion green).
 */
describe('GET /public/qr/{slug} — a failing scan write never costs the visit', () => {
    it('still answers 200, and LOGS, when the scan write comes back as a returned error', async () => {
        const { apiLogger } = await import('../../../src/utils/logger.js');
        const logged = vi.spyOn(apiLogger, 'error');
        qrDb.createScan.mockRejectedValueOnce(new Error('qr_code_scans is unreachable'));
        const app = await buildApp();

        const res = await probe(app, LIVE_SLUG);

        expect(res.status).toBe(200);
        expect((res.body as { data?: { targetUrl?: string } }).data?.targetUrl).toBe(TARGET_URL);

        // The behavioural half is guaranteed by the route's `catch`, so the
        // status assertion above cannot see this branch disappear. The log can.
        expect(
            logged.mock.calls.some(
                (call) => typeof call[1] === 'string' && call[1].includes('QR scan not recorded')
            )
        ).toBe(true);
    });

    it('still answers 200 when the scan write throws a DbError', async () => {
        const dbError = Object.assign(new Error('connection terminated'), { name: 'DbError' });
        qrDb.createScan.mockRejectedValueOnce(dbError);
        const app = await buildApp();

        const res = await probe(app, LIVE_SLUG);

        expect(res.status).toBe(200);
        expect((res.body as { data?: { targetUrl?: string } }).data?.targetUrl).toBe(TARGET_URL);
    });
});
