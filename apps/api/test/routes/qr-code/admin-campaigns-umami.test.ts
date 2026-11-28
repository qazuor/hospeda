/**
 * HOS-2679 PR 2 — the QR campaigns ↔ Umami admin routes.
 *
 * Same harness as `admin-organize.test.ts`: the REAL `@repo/service-core` runs
 * and only the `@repo/db` models are stubbed. Umami is a stubbed global `fetch`;
 * the env is the real one with the Umami variables overridden per test.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    counts: [] as Array<{ raw: string; count: number }>,
    env: {} as Record<string, string | undefined>
}));

vi.mock(
    '@repo/service-core',
    async (importOriginal) => await importOriginal<Record<string, unknown>>()
);

vi.mock('../../../src/utils/env', async (importOriginal) => {
    // `env` is a live `let` binding, assigned when the app validates it: read it lazily.
    const actual = await importOriginal<{ env: Record<string, unknown> | undefined }>();
    return {
        ...actual,
        env: new Proxy({} as Record<string, unknown>, {
            get: (_target, key: string) => (key in state.env ? state.env[key] : actual.env?.[key])
        })
    };
});

vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../../helpers/mocks/db-mock');
    const base = createDbMock() as Record<string, unknown>;
    return {
        ...base,
        QrCodeModel: class {
            getTable() {
                return base.qrCodes;
            }
            async countLiveByRawUtmCampaign() {
                return state.counts;
            }
        },
        QrCodeTagModel: class {
            getTable() {
                return base.qrCodeTags;
            }
        },
        RQrCodeQrCodeTagModel: class {}
    };
});

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { adminQrCodeRoutes } from '../../../src/routes/qr-code/admin/index.js';
import type { AppBindings } from '../../../src/types';

const WEBSITE = '0f3c2a5e-1111-4222-8333-444455556666';
const UMAMI_ENV = {
    HOSPEDA_UMAMI_URL: 'https://umami.test',
    HOSPEDA_UMAMI_WEBSITE_ID_WEB: WEBSITE,
    HOSPEDA_UMAMI_API_KEY: 'umami_read',
    HOSPEDA_UMAMI_WRITE_API_KEY: 'umami_write'
};

function actorWith(permissions: readonly PermissionEnum[]) {
    return {
        id: '77777777-7777-4777-8777-777777777777',
        roles: [RoleEnum.ADMIN] as readonly RoleEnum[],
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, ...permissions]
    };
}

const viewer = actorWith([PermissionEnum.QR_CODE_VIEW]);
const updater = actorWith([PermissionEnum.QR_CODE_VIEW, PermissionEnum.QR_CODE_UPDATE]);
const creator = actorWith([PermissionEnum.QR_CODE_VIEW, PermissionEnum.QR_CODE_CREATE]);

type Probe = { readonly status: number; readonly body: Record<string, unknown> };

function buildApp(actor: Record<string, unknown>): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.use((c, next) => {
        c.set('actor', actor as never);
        return next();
    });
    app.route('/codes', adminQrCodeRoutes);
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

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' }
    });
}

function segmentsPage(rows: ReadonlyArray<readonly [string, string]>): Response {
    return jsonResponse({
        data: rows.map(([id, name]) => ({ id, type: 'segment', name, parameters: {} })),
        count: rows.length
    });
}

const errorOf = (res: Probe) => res.body.error as Record<string, unknown> | undefined;
const dataOf = (res: Probe) => res.body.data as Record<string, unknown>;

const fetchMock = vi.fn();

beforeEach(() => {
    state.counts = [
        { raw: 'verano', count: 2 },
        { raw: 'verano+2026', count: 1 }
    ];
    state.env = { ...UMAMI_ENV };
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('GET /admin/qr-codes/campaigns/umami', () => {
    it('lists campaigns with counts and Umami state from one list call', async () => {
        // Arrange
        fetchMock.mockResolvedValueOnce(segmentsPage([['s1', 'QR · verano']]));

        // Act
        const res = await probe(buildApp(viewer), '/codes/campaigns/umami');

        // Assert
        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const data = dataOf(res);
        expect(data.canCreateSegments).toBe(true);
        const items = data.items as Array<Record<string, unknown>>;
        expect(items.map((item) => [item.campaign, item.qrCount])).toEqual([
            ['verano', 2],
            ['verano 2026', 1]
        ]);
        expect((items[0]?.umami as Record<string, unknown>).status).toBe('segment');
        expect((items[1]?.umami as Record<string, unknown>).status).toBe('missing');
    });

    it('answers 200 with unavailable rows when Umami is down', async () => {
        fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

        const res = await probe(buildApp(viewer), '/codes/campaigns/umami');

        expect(res.status).toBe(200);
        const items = dataOf(res).items as Array<{ umami: { status: string } }>;
        expect(items.every((item) => item.umami.status === 'unavailable')).toBe(true);
    });

    it('answers 200 with unavailable rows and no call when Umami is not configured', async () => {
        state.env = {
            HOSPEDA_UMAMI_URL: undefined,
            HOSPEDA_UMAMI_WEBSITE_ID_WEB: undefined,
            HOSPEDA_UMAMI_API_KEY: undefined,
            HOSPEDA_UMAMI_WRITE_API_KEY: undefined
        };

        const res = await probe(buildApp(viewer), '/codes/campaigns/umami');

        expect(res.status).toBe(200);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(dataOf(res).canCreateSegments).toBe(false);
    });

    it('refuses an actor without QR_CODE_VIEW with 403', async () => {
        const res = await probe(buildApp(actorWith([])), '/codes/campaigns/umami');

        expect(res.status).toBe(403);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('POST /admin/qr-codes/campaigns/umami-segment', () => {
    const path = '/codes/campaigns/umami-segment';

    it('creates the segment when missing (QR_CODE_UPDATE)', async () => {
        // Arrange
        fetchMock
            .mockResolvedValueOnce(segmentsPage([['x', 'QR · verano 2026']]))
            .mockResolvedValueOnce(
                jsonResponse({ id: 'new', type: 'segment', name: 'QR · verano', parameters: {} })
            );

        // Act
        const res = await probe(buildApp(updater), path, {
            method: 'POST',
            body: { campaign: 'verano' }
        });

        // Assert
        expect(res.status).toBe(201);
        expect(dataOf(res).created).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('is idempotent: an existing exact match answers created false (QR_CODE_CREATE)', async () => {
        fetchMock.mockResolvedValueOnce(segmentsPage([['s1', 'QR · verano']]));

        const res = await probe(buildApp(creator), path, {
            method: 'POST',
            body: { campaign: 'verano' }
        });

        expect(res.status).toBe(200);
        expect(dataOf(res).created).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('answers 404 for a campaign no QR carries, before calling Umami', async () => {
        const res = await probe(buildApp(updater), path, {
            method: 'POST',
            body: { campaign: 'invierno' }
        });

        expect(res.status).toBe(404);
        expect(errorOf(res)?.code).toBe('NOT_FOUND');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('answers 400 for an unknown body key (strict)', async () => {
        const res = await probe(buildApp(updater), path, {
            method: 'POST',
            body: { campaign: 'verano', name: 'x' }
        });

        expect(res.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('answers 503 UMAMI_WRITE_NOT_CONFIGURED without the write key', async () => {
        state.env = { ...UMAMI_ENV, HOSPEDA_UMAMI_WRITE_API_KEY: undefined };

        const res = await probe(buildApp(updater), path, {
            method: 'POST',
            body: { campaign: 'verano' }
        });

        expect(res.status).toBe(503);
        expect(errorOf(res)?.code).toBe('SERVICE_UNAVAILABLE');
        expect(errorOf(res)?.reason).toBe('UMAMI_WRITE_NOT_CONFIGURED');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('answers 503 UMAMI_KEY_REJECTED when Umami refuses the key', async () => {
        fetchMock
            .mockResolvedValueOnce(segmentsPage([]))
            .mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401));

        const res = await probe(buildApp(updater), path, {
            method: 'POST',
            body: { campaign: 'verano' }
        });

        expect(res.status).toBe(503);
        expect(errorOf(res)?.reason).toBe('UMAMI_KEY_REJECTED');
    });

    it('refuses a viewer without CREATE or UPDATE with 403', async () => {
        const res = await probe(buildApp(viewer), path, {
            method: 'POST',
            body: { campaign: 'verano' }
        });

        expect(res.status).toBe(403);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
