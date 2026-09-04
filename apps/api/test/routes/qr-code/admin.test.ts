/**
 * HOS-981 PR 3 — `/api/v1/admin/qr-codes`.
 *
 * ## What is real here, and why that matters
 *
 * `@repo/service-core` is un-mocked file-locally. `test/setup.ts` replaces the
 * whole package, and under that mock every route error becomes a 500 and every
 * service call becomes a stub — a suite written on top of it would be probing
 * the mock, not the routes. Only the two `@repo/db` MODELS are stubbed, so
 * `QrCodeService` really runs: the update schema really parses the body, the
 * permission gate really fires, the render engine really draws.
 *
 * ## The assertions that carry weight
 *
 * Two of them, and both are about a value that reaches the model or the wire,
 * never about the shape of a response the stub itself produced:
 *
 *   1. **A code can be retargeted.** That is the entire product — the printed
 *      symbol never changes, the destination does — so there is a test that the
 *      new `targetUrl` is the value written.
 *   2. **A partial render patch does not repaint the code.** The stored
 *      foreground here is RED, and the probe sends a margin. If the update
 *      schema stops stripping the nested defaults, `foregroundColor: '#000000'`
 *      appears in the write and this file goes red.
 *
 * Everything asserted on the write uses `toStrictEqual` rather than
 * `objectContaining`, which is blind to a field being present that should not
 * be — and here the harm is done by the extra fields, not the missing ones.
 *
 * Runs under the default `apps/api` vitest config.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The stubbed `qr_codes` table. Hoisted so the (also hoisted) `vi.mock` factory
 * can close over it.
 */
const qrDb = vi.hoisted(() => {
    const rows = new Map<string, Record<string, unknown>>();
    return {
        rows,
        findById: vi.fn(async (id: string) => rows.get(id) ?? null),
        findOne: vi.fn(async (where: Record<string, unknown>) => {
            if (typeof where.id === 'string') return rows.get(where.id) ?? null;
            for (const row of rows.values()) {
                if (row.slug === where.slug) return row;
            }
            return null;
        }),
        findAll: vi.fn(async (..._args: readonly unknown[]) => ({
            items: [...rows.values()],
            total: rows.size
        })),
        /**
         * Answers with a COMPLETE row. The route validates its response against
         * `QrCodeAdminSchema`, so a stub that echoed only what it was given
         * would 500 on the missing audit columns — a failure about the fixture,
         * not about the route.
         */
        create: vi.fn(async (data: Record<string, unknown>) => ({
            id: '55555555-5555-4555-8555-555555555555',
            description: null,
            entityType: null,
            entityId: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            deletedAt: null,
            createdById: null,
            updatedById: null,
            deletedById: null,
            ...data
        })),
        update: vi.fn(async (_where: Record<string, unknown>, data: Record<string, unknown>) => {
            const id = _where.id as string;
            const existing = rows.get(id);
            if (!existing) return null;
            const merged = { ...existing, ...data };
            rows.set(id, merged);
            return merged;
        }),
        softDelete: vi.fn(async (_where: Record<string, unknown>) => 1),
        getTable: vi.fn()
    };
});

// Restores the real service-core for this file only. Must precede any import of
// the package.
vi.mock(
    '@repo/service-core',
    async (importOriginal) => await importOriginal<Record<string, unknown>>()
);

// OVERRIDES the QR models with controllable ones, keeping the rest of the shared
// stub so `routes/index.ts` and service-core still import cleanly.
vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../../helpers/mocks/db-mock');
    const base = createDbMock() as Record<string, unknown>;
    return {
        ...base,
        QrCodeModel: class {
            // The same table stub the shared mock exports as `qrCodes`, so the
            // sort-field validation in `adminList` and the search-condition
            // builder both see the real column set.
            getTable() {
                return base.qrCodes;
            }
            async findById(id: string) {
                return qrDb.findById(id);
            }
            async findOne(where: Record<string, unknown>) {
                return qrDb.findOne(where);
            }
            async findAll(...args: unknown[]) {
                return qrDb.findAll(...args);
            }
            async create(data: Record<string, unknown>) {
                return qrDb.create(data);
            }
            async update(where: Record<string, unknown>, data: Record<string, unknown>) {
                return qrDb.update(where, data);
            }
            async softDelete(where: Record<string, unknown>) {
                return qrDb.softDelete(where);
            }
        },
        QrCodeScanModel: class {
            async create(data: Record<string, unknown>) {
                return data;
            }
        }
    };
});

import { PermissionEnum, QrCodeFormatEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { Hono } from 'hono';
import type { AppBindings } from '../../../src/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RED_ID = '11111111-1111-4111-8111-111111111111';
const RED_SLUG = 'Live2345';
const ORIGINAL_TARGET = 'https://hospeda.com.ar/es/destinos/colon/';
const NEW_TARGET = 'https://hospeda.com.ar/es/alojamientos/hotel-plaza/';
const MISSING_ID = '99999999-9999-4999-8999-999999999999';

/**
 * A code configured RED. The colour is the fixture's whole reason for existing:
 * it is what a defective margin patch destroys, and black is the value it would
 * be destroyed INTO — so a fixture left at the default black could not tell the
 * two apart.
 */
function redQrRow(): Record<string, unknown> {
    return {
        id: RED_ID,
        slug: RED_SLUG,
        targetUrl: ORIGINAL_TARGET,
        label: 'Cartelera plaza Ramírez',
        description: null,
        source: 'MANUAL',
        entityType: null,
        entityId: null,
        renderOptions: {
            errorCorrectionLevel: 'M',
            format: 'SVG',
            margin: 4,
            size: null,
            foregroundColor: '#ff0000',
            backgroundColor: '#ffffff'
        },
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        deletedAt: null,
        createdById: '44444444-4444-4444-8444-444444444444',
        updatedById: null,
        deletedById: null
    };
}

/** An operator who may reach the admin panel and holds all four QR verbs. */
const adminActor = {
    id: '77777777-7777-4777-8777-777777777777',
    roles: [RoleEnum.ADMIN] as readonly RoleEnum[],
    permissions: [
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.QR_CODE_VIEW,
        PermissionEnum.QR_CODE_CREATE,
        PermissionEnum.QR_CODE_UPDATE,
        PermissionEnum.QR_CODE_DELETE
    ]
};

/** An operator who may reach the panel and holds no QR verb at all. */
const unprivilegedActor = {
    id: '88888888-8888-4888-8888-888888888888',
    roles: [RoleEnum.EDITOR] as readonly RoleEnum[],
    permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
};

/**
 * The delegation the split exists for: somebody who may find a printed code and
 * download its image, and nothing else.
 *
 * This actor is what makes the four permissions more than four names for one
 * gate. Every write probe below runs against it, so a route that quietly
 * accepted `QR_CODE_VIEW` for a write would fail here rather than in production.
 */
const readOnlyActor = {
    id: '66666666-6666-4666-8666-666666666666',
    roles: [RoleEnum.EDITOR] as readonly RoleEnum[],
    permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.QR_CODE_VIEW]
};

/**
 * An operator still carrying only the gate PR 1 borrowed.
 *
 * `SETTINGS_MANAGE` opened every QR route until this release. If a route still
 * answered to it, the whole point of the split — delegating QR without settings,
 * and withholding settings-holders from nothing — would be quietly undone, and
 * no other probe here would notice.
 */
const legacySettingsActor = {
    id: '55555555-5555-4555-8555-555555555556',
    roles: [RoleEnum.ADMIN] as readonly RoleEnum[],
    permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.SETTINGS_MANAGE]
};

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------

type Probe = { readonly status: number; readonly body: Record<string, unknown> };

/**
 * Builds the app around the REAL admin router, including its authorization
 * middleware. No error handler is attached: the route factory formats through
 * the real `handleRouteError`, so these probes see the bodies production sends.
 */
async function buildApp(actor: Record<string, unknown> = adminActor): Promise<Hono<AppBindings>> {
    const { adminQrCodeRoutes } = await import('../../../src/routes/qr-code/admin/index.js');
    const app = new Hono<AppBindings>();
    app.use((c, next) => {
        c.set('actor', actor as never);
        return next();
    });
    app.route('/', adminQrCodeRoutes);
    return app;
}

/**
 * Issues one request. The `user-agent` header is not decoration: without it the
 * middleware chain short-circuits and the handler is never reached, which reads
 * from inside a suite exactly like a handler that returned nothing.
 */
async function probe(
    app: Hono<AppBindings>,
    path: string,
    init?: { method?: string; body?: unknown }
): Promise<Probe> {
    const res = await app.request(path, {
        method: init?.method ?? 'GET',
        headers: {
            'user-agent': 'vitest',
            ...(init?.body === undefined ? {} : { 'content-type': 'application/json' })
        },
        body: init?.body === undefined ? undefined : JSON.stringify(init.body)
    });
    const text = await res.text();
    try {
        return { status: res.status, body: text ? JSON.parse(text) : {} };
    } catch {
        return { status: res.status, body: { raw: text } };
    }
}

beforeEach(() => {
    qrDb.rows.clear();
    qrDb.rows.set(RED_ID, redQrRow());
    for (const fn of [
        qrDb.findById,
        qrDb.findOne,
        qrDb.findAll,
        qrDb.create,
        qrDb.update,
        qrDb.softDelete
    ]) {
        fn.mockClear();
    }
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// The feature: changing where a printed code sends people
// ---------------------------------------------------------------------------

describe('PATCH /admin/qr-codes/{id} — retargeting is the product', () => {
    it('writes the new destination and answers with it', async () => {
        const app = await buildApp();

        const res = await probe(app, `/${RED_ID}`, {
            method: 'PATCH',
            body: { targetUrl: NEW_TARGET }
        });

        expect(res.status).toBe(200);
        expect(qrDb.update).toHaveBeenCalledTimes(1);

        const [where, patch] = qrDb.update.mock.calls[0] as [
            Record<string, unknown>,
            Record<string, unknown>
        ];
        expect(where).toStrictEqual({ id: RED_ID });
        expect(patch.targetUrl).toBe(NEW_TARGET);

        // And it comes back out, so the panel shows the change rather than the
        // value it just replaced.
        expect((res.body.data as Record<string, unknown>).targetUrl).toBe(NEW_TARGET);
    });

    /**
     * The slug is already printed on stickers in the field. `.strict()` on the
     * update schema refuses it; asserting the model was never touched is what
     * proves the refusal happened instead of the key being quietly dropped.
     */
    it('refuses a body that tries to rename the slug', async () => {
        const app = await buildApp();

        const res = await probe(app, `/${RED_ID}`, {
            method: 'PATCH',
            body: { slug: 'Rena2ed4' }
        });

        expect(res.status).toBe(400);
        expect(qrDb.update).not.toHaveBeenCalled();
        expect(qrDb.rows.get(RED_ID)?.slug).toBe(RED_SLUG);
    });

    /**
     * THE COLOUR-SURVIVAL PROBE.
     *
     * Sends a margin and nothing else. What is asserted is the object handed to
     * the model: if the nested defaults come back, `foregroundColor: '#000000'`
     * rides along and the stored red is written away with no error anywhere.
     */
    it('a margin-only patch does not repaint a red code', async () => {
        const app = await buildApp();

        const res = await probe(app, `/${RED_ID}`, {
            method: 'PATCH',
            body: { renderOptions: { margin: 8 } }
        });

        expect(res.status).toBe(200);
        const patch = qrDb.update.mock.calls[0]?.[1] as {
            renderOptions: Record<string, unknown>;
        };

        expect(patch.renderOptions).toStrictEqual({ margin: 8 });
        expect(patch.renderOptions).not.toHaveProperty('foregroundColor');
    });

    it('refuses an unknown render option instead of storing it', async () => {
        const app = await buildApp();

        const res = await probe(app, `/${RED_ID}`, {
            method: 'PATCH',
            body: { renderOptions: { logoUrl: 'https://example.com/logo.png' } }
        });

        expect(res.status).toBe(400);
        expect(qrDb.update).not.toHaveBeenCalled();
    });

    it('answers 404 for an id that does not exist', async () => {
        const app = await buildApp();

        const res = await probe(app, `/${MISSING_ID}`, {
            method: 'PATCH',
            body: { targetUrl: NEW_TARGET }
        });

        expect(res.status).toBe(404);
    });

    it('refuses an admin who holds no QR permission', async () => {
        const app = await buildApp(unprivilegedActor);

        const res = await probe(app, `/${RED_ID}`, {
            method: 'PATCH',
            body: { targetUrl: NEW_TARGET }
        });

        expect(res.status).toBe(403);
        expect(qrDb.update).not.toHaveBeenCalled();
    });

    /** Reading a code is not authority to move where it points. */
    it('refuses a read-only QR operator', async () => {
        const app = await buildApp(readOnlyActor);

        const res = await probe(app, `/${RED_ID}`, {
            method: 'PATCH',
            body: { targetUrl: NEW_TARGET }
        });

        expect(res.status).toBe(403);
        expect(qrDb.update).not.toHaveBeenCalled();
    });

    /** The borrowed gate no longer opens this route. */
    it('refuses an operator carrying only SETTINGS_MANAGE', async () => {
        const app = await buildApp(legacySettingsActor);

        const res = await probe(app, `/${RED_ID}`, {
            method: 'PATCH',
            body: { targetUrl: NEW_TARGET }
        });

        expect(res.status).toBe(403);
        expect(qrDb.update).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

describe('GET /admin/qr-codes', () => {
    it('paginates with page + pageSize', async () => {
        const app = await buildApp();

        const res = await probe(app, '/?page=1&pageSize=5');

        expect(res.status).toBe(200);
        expect(qrDb.findAll).toHaveBeenCalledTimes(1);
        const pagination = qrDb.findAll.mock.calls[0]?.[1] as Record<string, unknown> | undefined;
        expect(pagination?.page).toBe(1);
        expect(pagination?.pageSize).toBe(5);
    });

    /**
     * `limit` is not a synonym the factory tolerates. A 400 here is the desired
     * behaviour: silently ignoring it would answer a request for five rows with
     * the default twenty and look like a working endpoint.
     */
    it('rejects `limit` rather than ignoring it', async () => {
        const app = await buildApp();

        const res = await probe(app, '/?limit=5');

        expect(res.status).toBe(400);
        expect(qrDb.findAll).not.toHaveBeenCalled();
    });

    /**
     * A free-text search must reach the model as an actual SQL condition. The
     * failure mode being guarded is not "wrong rows" but "no filter at all":
     * `buildSearchCondition` drops unknown columns silently and then returns
     * `undefined`, so a regression answers every search with the whole table.
     */
    it('turns ?search= into a real SQL condition over the QR columns', async () => {
        const app = await buildApp();

        const res = await probe(app, '/?search=plaza');

        expect(res.status).toBe(200);
        const conditions = qrDb.findAll.mock.calls[0]?.[2] as unknown[] | undefined;
        expect(Array.isArray(conditions)).toBe(true);
        expect(conditions).toHaveLength(1);

        // An OR over exactly the three searchable columns, named by their
        // physical column names — so a regression to the base class's `['name']`
        // default (a column `qr_codes` does not have) produces no condition at
        // all and this assertion fails on the empty array above.
        expect(conditions?.[0]).toStrictEqual({
            type: 'or',
            conditions: [
                { type: 'safeIlike', col: 'label', term: 'plaza' },
                { type: 'safeIlike', col: 'slug', term: 'plaza' },
                { type: 'safeIlike', col: 'target_url', term: 'plaza' }
            ]
        });
    });

    it('passes no condition when nothing was searched for', async () => {
        const app = await buildApp();

        await probe(app, '/');

        expect(qrDb.findAll.mock.calls[0]?.[2]).toBeUndefined();
    });
});

describe('GET /admin/qr-codes/{id}', () => {
    it('returns the code', async () => {
        const app = await buildApp();

        const res = await probe(app, `/${RED_ID}`);

        expect(res.status).toBe(200);
        expect((res.body.data as Record<string, unknown>).slug).toBe(RED_SLUG);
    });

    /**
     * 404, not a 200 carrying `null`. `getById` resolves an absent row without
     * an error, so an unguarded handler renders an empty detail page and reports
     * nothing wrong.
     */
    it('answers 404 for an id that does not exist', async () => {
        const app = await buildApp();

        const res = await probe(app, `/${MISSING_ID}`);

        expect(res.status).toBe(404);
        expect((res.body.error as Record<string, unknown> | undefined)?.code).toBe(
            ServiceErrorCode.NOT_FOUND
        );
    });
});

// ---------------------------------------------------------------------------
// The download
// ---------------------------------------------------------------------------

describe('GET /admin/qr-codes/{id}/download', () => {
    /**
     * The symbol encodes the platform's indirection, NEVER the target. Encoding
     * the destination would put it in the ink and take the whole feature away:
     * the code could no longer be retargeted.
     *
     * Asserted on the DRAWN BYTES, not on the reported `scanUrl`. That
     * distinction is not pedantry — it was measured: a mutation that fed the
     * renderer `targetUrl` while still reporting the right `scanUrl` passed the
     * field-only version of this test with all twenty green. The engine is
     * deterministic (same string + same options → same bytes), so rendering
     * both candidates here and comparing is exact.
     */
    it('encodes /qr/{slug}/ and not the target URL', async () => {
        const { renderQrSvg } = await import('../../../src/utils/qr-render.js');
        const options = redQrRow().renderOptions as never;
        const app = await buildApp();

        const res = await probe(app, `/${RED_ID}/download`);

        expect(res.status).toBe(200);
        const data = res.body.data as Record<string, unknown>;
        expect(data.scanUrl).toBe(`http://localhost:4321/qr/${RED_SLUG}/`);

        const indirection = await renderQrSvg({
            data: `http://localhost:4321/qr/${RED_SLUG}/`,
            options
        });
        const destination = await renderQrSvg({ data: ORIGINAL_TARGET, options });

        expect(data.svg).toBe(indirection);
        // Non-vacuity: the two strings really are different symbols, so the
        // equality above is a claim and not a coincidence.
        expect(indirection).not.toBe(destination);
        expect(data.svg).not.toBe(destination);
    });

    /** Defaults to the stored format, and hands back markup ready to inline. */
    it('renders SVG with the code’s own stored options', async () => {
        const app = await buildApp();

        const res = await probe(app, `/${RED_ID}/download`);

        const data = res.body.data as Record<string, unknown>;
        expect(data.format).toBe(QrCodeFormatEnum.SVG);
        expect(data.filename).toBe(`qr-${RED_SLUG}.svg`);
        expect(String(data.svg)).toContain('<svg');
        // The stored red really reached the renderer — this is what makes the
        // "download matches the preview" claim non-vacuous.
        expect(String(data.svg)).toContain('#ff0000');
        expect(String(data.dataUrl)).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it('honours ?format=PNG without touching the stored configuration', async () => {
        const app = await buildApp();

        const res = await probe(app, `/${RED_ID}/download?format=PNG`);

        const data = res.body.data as Record<string, unknown>;
        expect(data.format).toBe(QrCodeFormatEnum.PNG);
        expect(data.filename).toBe(`qr-${RED_SLUG}.png`);
        expect(String(data.dataUrl)).toMatch(/^data:image\/png;base64,/);
        expect(data.svg).toBeNull();
        // A download is a read: nothing about the code changed.
        expect(qrDb.update).not.toHaveBeenCalled();
        expect(qrDb.rows.get(RED_ID)?.renderOptions).toMatchObject({ format: 'SVG' });
    });

    it('answers 404 for an id that does not exist', async () => {
        const app = await buildApp();

        const res = await probe(app, `/${MISSING_ID}/download`);

        expect(res.status).toBe(404);
    });

    /**
     * The positive half of the delegation, and the reason `download` is gated on
     * VIEW rather than on a write verb: somebody granted only reading must be
     * able to print the sticker. Without this the four permissions could all be
     * wired to the strictest gate and every refusal test above would still pass.
     */
    it('lets a read-only QR operator download', async () => {
        const app = await buildApp(readOnlyActor);

        const res = await probe(app, `/${RED_ID}/download`);

        expect(res.status).toBe(200);
        expect((res.body.data as Record<string, unknown>).filename).toBe(`qr-${RED_SLUG}.svg`);
    });

    it('refuses an operator carrying only SETTINGS_MANAGE', async () => {
        const app = await buildApp(legacySettingsActor);

        const res = await probe(app, `/${RED_ID}/download`);

        expect(res.status).toBe(403);
    });
});

// ---------------------------------------------------------------------------
// Writing and retiring
// ---------------------------------------------------------------------------

describe('POST /admin/qr-codes', () => {
    it('creates a code and mints a slug when none was given', async () => {
        const app = await buildApp();

        const res = await probe(app, '/', {
            method: 'POST',
            body: {
                targetUrl: NEW_TARGET,
                label: 'Folleto temporada 2026',
                source: 'MANUAL'
            }
        });

        expect(res.status).toBe(201);
        const written = qrDb.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(String(written.slug)).toMatch(
            /^[23456789ABCDEFGHJKLMNPQRSTVWXYZabcdefghijkmnpqrstvwxyz]{8}$/
        );
        // Created codes carry a COMPLETE render document — the create path is
        // the counterpart of the update path's partial patch, and must stay so.
        expect(written.renderOptions).toStrictEqual({
            errorCorrectionLevel: 'M',
            format: 'SVG',
            margin: 4,
            size: null,
            foregroundColor: '#000000',
            backgroundColor: '#ffffff',
            centerLogo: 'NONE'
        });
    });

    /** Reading codes is not authority to mint one. */
    it('refuses a read-only QR operator', async () => {
        const app = await buildApp(readOnlyActor);

        const res = await probe(app, '/', {
            method: 'POST',
            body: { targetUrl: NEW_TARGET, label: 'Folleto', source: 'MANUAL' }
        });

        expect(res.status).toBe(403);
        expect(qrDb.create).not.toHaveBeenCalled();
    });

    it('refuses a MANUAL code that names an entity', async () => {
        const app = await buildApp();

        const res = await probe(app, '/', {
            method: 'POST',
            body: {
                targetUrl: NEW_TARGET,
                label: 'Folleto',
                source: 'MANUAL',
                entityType: 'HOST_TRADE',
                entityId: MISSING_ID
            }
        });

        expect(res.status).toBe(400);
        expect(qrDb.create).not.toHaveBeenCalled();
    });
});

describe('DELETE /admin/qr-codes/{id}', () => {
    it('soft-deletes and reports success', async () => {
        const app = await buildApp();

        const res = await probe(app, `/${RED_ID}`, { method: 'DELETE' });

        expect(res.status).toBe(200);
        expect(qrDb.softDelete).toHaveBeenCalledTimes(1);
        expect((res.body.data as Record<string, unknown>).success).toBe(true);
    });

    it('refuses an admin who holds no QR permission', async () => {
        const app = await buildApp(unprivilegedActor);

        const res = await probe(app, `/${RED_ID}`, { method: 'DELETE' });

        expect(res.status).toBe(403);
        expect(qrDb.softDelete).not.toHaveBeenCalled();
    });

    it('refuses a read-only QR operator', async () => {
        const app = await buildApp(readOnlyActor);

        const res = await probe(app, `/${RED_ID}`, { method: 'DELETE' });

        expect(res.status).toBe(403);
        expect(qrDb.softDelete).not.toHaveBeenCalled();
    });
});
