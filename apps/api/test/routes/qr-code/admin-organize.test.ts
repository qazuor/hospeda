/**
 * HOS-2679 — organising QR codes in the admin: the decorated list, the
 * campaign and tag filters, the per-code tag set and the tag catalog.
 *
 * Same harness as `admin.test.ts`: the REAL `@repo/service-core` runs (so the
 * schemas, permission gates and error mapping are the production ones) and only
 * the `@repo/db` models are stubbed. The two filter builders come from the shared
 * db mock and answer marker objects, so a probe can assert which filter reached
 * the query without rendering SQL.
 *
 * Runs under the default `apps/api` vitest config.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
    const codes = new Map<string, Record<string, unknown>>();
    const tags = new Map<string, Record<string, unknown>>();
    const links = new Map<string, string[]>();
    return {
        codes,
        tags,
        links,
        codeFindAll: vi.fn(async (..._args: readonly unknown[]) => ({
            items: [...codes.values()],
            total: codes.size
        })),
        codeFindById: vi.fn(async (id: string) => codes.get(id) ?? null),
        distinctCampaigns: vi.fn(async () => [] as string[]),
        tagFindLiveBySlug: vi.fn(async (slug: string) => {
            for (const tag of tags.values()) {
                if (tag.slug === slug && !tag.deletedAt) return tag;
            }
            return null;
        }),
        tagCountLiveByIds: vi.fn(
            async (ids: readonly string[]) =>
                ids.filter((id) => tags.has(id) && !tags.get(id)?.deletedAt).length
        ),
        tagCreate: vi.fn(async (data: Record<string, unknown>) => {
            const row = {
                id: '99999999-0000-4000-8000-000000000001',
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                updatedAt: new Date('2026-01-01T00:00:00.000Z'),
                createdById: null,
                updatedById: null,
                deletedAt: null,
                deletedById: null,
                ...data
            };
            tags.set(row.id, row);
            return row;
        }),
        tagUpdate: vi.fn(async (where: Record<string, unknown>, data: Record<string, unknown>) => {
            const existing = tags.get(where.id as string);
            if (!existing) return null;
            const merged = { ...existing, ...data };
            tags.set(where.id as string, merged);
            return merged;
        }),
        tagSoftDelete: vi.fn(async (_where: Record<string, unknown>) => 1),
        setLinks: vi.fn(async (qrCodeId: string, tagIds: readonly string[]) => {
            links.set(qrCodeId, [...tagIds]);
        })
    };
});

vi.mock(
    '@repo/service-core',
    async (importOriginal) => await importOriginal<Record<string, unknown>>()
);

vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../../helpers/mocks/db-mock');
    const base = createDbMock() as Record<string, unknown>;
    const refsFor = (qrCodeId: string) =>
        (db.links.get(qrCodeId) ?? []).flatMap((id) => {
            const tag = db.tags.get(id);
            return tag && !tag.deletedAt
                ? [{ id: tag.id, name: tag.name, slug: tag.slug, color: tag.color }]
                : [];
        });
    return {
        ...base,
        QrCodeModel: class {
            getTable() {
                return base.qrCodes;
            }
            async findAll(...args: unknown[]) {
                return db.codeFindAll(...args);
            }
            async findById(id: string) {
                return db.codeFindById(id);
            }
            async findOne(where: Record<string, unknown>) {
                return db.codes.get(where.id as string) ?? null;
            }
            async findDistinctRawUtmCampaigns() {
                return db.distinctCampaigns();
            }
        },
        QrCodeTagModel: class {
            getTable() {
                return base.qrCodeTags;
            }
            async findById(id: string) {
                return db.tags.get(id) ?? null;
            }
            async findOne(where: Record<string, unknown>) {
                return db.tags.get(where.id as string) ?? null;
            }
            async findLiveBySlug(slug: string) {
                return db.tagFindLiveBySlug(slug);
            }
            async countLiveByIds(ids: readonly string[]) {
                return db.tagCountLiveByIds(ids);
            }
            async create(data: Record<string, unknown>) {
                return db.tagCreate(data);
            }
            async update(where: Record<string, unknown>, data: Record<string, unknown>) {
                return db.tagUpdate(where, data);
            }
            async softDelete(where: Record<string, unknown>) {
                return db.tagSoftDelete(where);
            }
            async findAll() {
                return { items: [...db.tags.values()], total: db.tags.size };
            }
        },
        RQrCodeQrCodeTagModel: class {
            async setTagsForQrCode(qrCodeId: string, tagIds: readonly string[]) {
                return db.setLinks(qrCodeId, tagIds);
            }
            async findTagRefsByQrCodeIds(ids: readonly string[]) {
                return new Map(ids.map((id) => [id, refsFor(id)] as const));
            }
        }
    };
});

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { adminQrCodeRoutes } from '../../../src/routes/qr-code/admin/index.js';
import { adminQrCodeTagRoutes } from '../../../src/routes/qr-code/admin-tags/index.js';
import type { AppBindings } from '../../../src/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MANUAL_ID = '11111111-1111-4111-8111-111111111111';
const GENERATED_ID = '22222222-2222-4222-8222-222222222222';
const EXTERNAL_ID = '33333333-3333-4333-8333-333333333333';
const TAG_ID = '44444444-4444-4444-8444-444444444444';
const MISSING_ID = '99999999-9999-4999-8999-999999999999';

const RENDER = {
    errorCorrectionLevel: 'M',
    format: 'SVG',
    margin: 4,
    size: null,
    foregroundColor: '#000000',
    backgroundColor: '#ffffff',
    centerLogo: 'NONE'
};

function codeRow(over: Record<string, unknown>): Record<string, unknown> {
    return {
        description: null,
        source: 'MANUAL',
        entityType: null,
        entityId: null,
        purpose: null,
        renderOptions: RENDER,
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        deletedAt: null,
        createdById: null,
        updatedById: null,
        deletedById: null,
        ...over
    };
}

const tagRow = {
    id: TAG_ID,
    name: 'Verano 2026',
    slug: 'verano-2026',
    color: 'BLUE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdById: null,
    updatedById: null,
    deletedAt: null,
    deletedById: null
};

const ALL_QR = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.QR_CODE_VIEW,
    PermissionEnum.QR_CODE_CREATE,
    PermissionEnum.QR_CODE_UPDATE,
    PermissionEnum.QR_CODE_DELETE
];

const adminActor = {
    id: '77777777-7777-4777-8777-777777777777',
    roles: [RoleEnum.ADMIN] as readonly RoleEnum[],
    permissions: ALL_QR
};

const readOnlyActor = {
    id: '66666666-6666-4666-8666-666666666666',
    roles: [RoleEnum.EDITOR] as readonly RoleEnum[],
    permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.QR_CODE_VIEW]
};

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type Probe = { readonly status: number; readonly body: Record<string, unknown> };

function buildApp(actor: Record<string, unknown> = adminActor): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.use((c, next) => {
        c.set('actor', actor as never);
        return next();
    });
    app.route('/codes', adminQrCodeRoutes);
    app.route('/tags', adminQrCodeTagRoutes);
    return app;
}

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

const errorCode = (res: Probe) => (res.body.error as Record<string, unknown> | undefined)?.code;

beforeEach(() => {
    db.codes.clear();
    db.tags.clear();
    db.links.clear();
    db.codes.set(
        MANUAL_ID,
        codeRow({
            id: MANUAL_ID,
            slug: 'Mana2345',
            label: 'Cartelera',
            targetUrl: 'https://hospeda.com.ar/es/destinos/colon/?ref=a#mapa'
        })
    );
    db.codes.set(
        GENERATED_ID,
        codeRow({
            id: GENERATED_ID,
            slug: 'Gene2345',
            label: 'Menú',
            source: 'GENERATED',
            entityType: 'VENUE',
            entityId: '55555555-5555-4555-8555-555555555555',
            purpose: 'MENU',
            targetUrl: 'https://hospeda.com.ar/es/gastronomia/bar/menu/'
        })
    );
    db.codes.set(
        EXTERNAL_ID,
        codeRow({
            id: EXTERNAL_ID,
            slug: 'Exte2345',
            label: 'Instagram',
            targetUrl: 'https://instagram.com/hospeda?utm_campaign=verano'
        })
    );
    db.tags.set(TAG_ID, { ...tagRow });
    db.links.set(MANUAL_ID, [TAG_ID]);
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// The decorated list
// ---------------------------------------------------------------------------

describe('GET /admin/qr-codes — decorated rows', () => {
    it('carries the scan URL, the landing UTMs and the tags of each row', async () => {
        // Act
        const res = await probe(buildApp(), '/codes');

        // Assert
        expect(res.status).toBe(200);
        const items = (res.body.data as { items: Record<string, unknown>[] }).items;
        const byId = new Map(items.map((item) => [item.id, item]));

        const manual = byId.get(MANUAL_ID);
        expect(manual?.scanUrl).toBe('http://localhost:4321/qr/Mana2345/');
        // A manual code with no UTMs of its own lands with the platform default.
        expect(manual?.scanUtm).toStrictEqual({
            utm_source: 'qr',
            utm_medium: 'print',
            utm_campaign: 'manual',
            utm_content: null,
            utm_term: null
        });
        expect(manual?.tags).toStrictEqual([
            { id: TAG_ID, name: 'Verano 2026', slug: 'verano-2026', color: 'BLUE' }
        ]);

        // A generated code: the entity→campaign mapping of qr-attribution.ts.
        expect(byId.get(GENERATED_ID)?.scanUtm).toStrictEqual({
            utm_source: 'qr',
            utm_medium: 'print',
            utm_campaign: 'venue',
            utm_content: 'menu',
            utm_term: null
        });
        expect(byId.get(GENERATED_ID)?.tags).toStrictEqual([]);

        // An external target is never decorated: only what it already carries.
        expect(byId.get(EXTERNAL_ID)?.scanUtm).toStrictEqual({
            utm_source: null,
            utm_medium: null,
            utm_campaign: 'verano',
            utm_content: null,
            utm_term: null
        });
    });

    it('keeps the stored targetUrl raw: the UTMs are computed, never written', async () => {
        const res = await probe(buildApp(), '/codes');

        const items = (res.body.data as { items: Record<string, unknown>[] }).items;
        expect(items.find((item) => item.id === MANUAL_ID)?.targetUrl).toBe(
            'https://hospeda.com.ar/es/destinos/colon/?ref=a#mapa'
        );
    });
});

describe('GET /admin/qr-codes — HOS-2679 filters', () => {
    it('combines column filters with the campaign and tag conditions', async () => {
        // Act
        const res = await probe(
            buildApp(),
            `/codes?source=MANUAL&isActive=true&utmCampaign=verano%202026&tagIds=${TAG_ID}&search=plaza`
        );

        // Assert
        expect(res.status).toBe(200);
        const [where, , conditions] = db.codeFindAll.mock.calls[0] as [
            Record<string, unknown>,
            unknown,
            unknown[]
        ];
        expect(where).toStrictEqual({ source: 'MANUAL', isActive: true, deletedAt: null });
        expect(conditions).toContainEqual({
            __qrFilter: 'utmCampaign',
            encodedValues: ['verano%202026', 'verano+2026', 'verano 2026']
        });
        expect(conditions).toContainEqual({ __qrFilter: 'tagIds', tagIds: [TAG_ID] });
        // The free-text search still applies on top: three conditions in all.
        expect(conditions).toHaveLength(3);
    });

    it('accepts several tag ids, comma-separated', async () => {
        const other = '88888888-8888-4888-8888-888888888888';

        const res = await probe(buildApp(), `/codes?tagIds=${TAG_ID},${other}`);

        expect(res.status).toBe(200);
        const conditions = db.codeFindAll.mock.calls[0]?.[2] as unknown[];
        expect(conditions).toStrictEqual([{ __qrFilter: 'tagIds', tagIds: [TAG_ID, other] }]);
    });

    it('answers 400 for a malformed tag id, without querying', async () => {
        const res = await probe(buildApp(), '/codes?tagIds=nope');

        expect(res.status).toBe(400);
        expect(db.codeFindAll).not.toHaveBeenCalled();
    });

    it('never forwards the non-column filters into the where map', async () => {
        await probe(buildApp(), `/codes?utmCampaign=x&tagIds=${TAG_ID}`);

        const where = db.codeFindAll.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(where).not.toHaveProperty('utmCampaign');
        expect(where).not.toHaveProperty('tagIds');
    });
});

describe('GET /admin/qr-codes/campaigns', () => {
    it('answers the decoded distinct campaigns and is not read as an id', async () => {
        db.distinctCampaigns.mockResolvedValue(['verano%202026', 'verano+2026', 'Costanera']);

        const res = await probe(buildApp(readOnlyActor), '/codes/campaigns');

        expect(res.status).toBe(200);
        expect(res.body.data).toStrictEqual({ items: ['Costanera', 'verano 2026'] });
        expect(db.codeFindById).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// The tag set of one code
// ---------------------------------------------------------------------------

describe('PUT /admin/qr-codes/{id}/tags', () => {
    it('replaces the set and answers the tags now carried', async () => {
        const res = await probe(buildApp(), `/codes/${GENERATED_ID}/tags`, {
            method: 'PUT',
            body: { tagIds: [TAG_ID] }
        });

        expect(res.status).toBe(200);
        expect(db.setLinks).toHaveBeenCalledWith(GENERATED_ID, [TAG_ID]);
        expect(res.body.data).toStrictEqual({
            items: [{ id: TAG_ID, name: 'Verano 2026', slug: 'verano-2026', color: 'BLUE' }]
        });
    });

    it('clears the set with an empty list', async () => {
        const res = await probe(buildApp(), `/codes/${MANUAL_ID}/tags`, {
            method: 'PUT',
            body: { tagIds: [] }
        });

        expect(res.status).toBe(200);
        expect(db.setLinks).toHaveBeenCalledWith(MANUAL_ID, []);
        expect(res.body.data).toStrictEqual({ items: [] });
    });

    it('answers 400 UNKNOWN_TAG for an id that is not a live tag, writing nothing', async () => {
        const res = await probe(buildApp(), `/codes/${MANUAL_ID}/tags`, {
            method: 'PUT',
            body: { tagIds: [MISSING_ID] }
        });

        expect(res.status).toBe(400);
        expect(errorCode(res)).toBe('VALIDATION_ERROR');
        expect(db.setLinks).not.toHaveBeenCalled();
    });

    it('answers 404 for a code that does not exist', async () => {
        const res = await probe(buildApp(), `/codes/${MISSING_ID}/tags`, {
            method: 'PUT',
            body: { tagIds: [TAG_ID] }
        });

        expect(res.status).toBe(404);
        expect(db.setLinks).not.toHaveBeenCalled();
    });

    it('answers 400 for a body that is not a tag list', async () => {
        const res = await probe(buildApp(), `/codes/${MANUAL_ID}/tags`, {
            method: 'PUT',
            body: { tagIds: 'all' }
        });

        expect(res.status).toBe(400);
        expect(db.setLinks).not.toHaveBeenCalled();
    });

    it('refuses a read-only QR operator', async () => {
        const res = await probe(buildApp(readOnlyActor), `/codes/${MANUAL_ID}/tags`, {
            method: 'PUT',
            body: { tagIds: [] }
        });

        expect(res.status).toBe(403);
        expect(db.setLinks).not.toHaveBeenCalled();
    });
});

describe('GET /admin/qr-codes/{id}/tags', () => {
    it('lets a read-only operator read the set', async () => {
        const res = await probe(buildApp(readOnlyActor), `/codes/${MANUAL_ID}/tags`);

        expect(res.status).toBe(200);
        expect(res.body.data).toStrictEqual({
            items: [{ id: TAG_ID, name: 'Verano 2026', slug: 'verano-2026', color: 'BLUE' }]
        });
    });

    it('answers 404 for a missing code', async () => {
        const res = await probe(buildApp(), `/codes/${MISSING_ID}/tags`);
        expect(res.status).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// The tag catalog
// ---------------------------------------------------------------------------

describe('/admin/qr-code-tags', () => {
    it('creates a tag with a derived slug', async () => {
        const res = await probe(buildApp(), '/tags', {
            method: 'POST',
            body: { name: 'Costanera', color: 'GREEN' }
        });

        expect([200, 201]).toContain(res.status);
        const written = db.tagCreate.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(written.slug).toBe('costanera');
        expect(written.color).toBe('GREEN');
    });

    it('answers 409 for a name that slugs onto a live tag', async () => {
        const res = await probe(buildApp(), '/tags', {
            method: 'POST',
            body: { name: 'verano   2026' }
        });

        expect(res.status).toBe(409);
        expect(db.tagCreate).not.toHaveBeenCalled();
    });

    it('answers 400 for a caller-supplied slug', async () => {
        const res = await probe(buildApp(), '/tags', {
            method: 'POST',
            body: { name: 'x', slug: 'x' }
        });

        expect(res.status).toBe(400);
    });

    it('refuses a read-only QR operator on create', async () => {
        const res = await probe(buildApp(readOnlyActor), '/tags', {
            method: 'POST',
            body: { name: 'Costanera' }
        });

        expect(res.status).toBe(403);
        expect(db.tagCreate).not.toHaveBeenCalled();
    });

    it('renames a tag and re-derives its slug', async () => {
        const res = await probe(buildApp(), `/tags/${TAG_ID}`, {
            method: 'PATCH',
            body: { name: 'Invierno 2026' }
        });

        expect(res.status).toBe(200);
        const patch = db.tagUpdate.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(patch.name).toBe('Invierno 2026');
        expect(patch.slug).toBe('invierno-2026');
    });

    it('soft-deletes a tag', async () => {
        const res = await probe(buildApp(), `/tags/${TAG_ID}`, { method: 'DELETE' });

        expect(res.status).toBe(200);
        expect(db.tagSoftDelete).toHaveBeenCalledTimes(1);
        expect(res.body.data).toStrictEqual({ success: true });
    });

    it('lists the catalog for a read-only operator', async () => {
        const res = await probe(buildApp(readOnlyActor), '/tags?pageSize=100');

        expect(res.status).toBe(200);
        const items = (res.body.data as { items: Record<string, unknown>[] }).items;
        expect(items.map((item) => item.id)).toStrictEqual([TAG_ID]);
    });
});
