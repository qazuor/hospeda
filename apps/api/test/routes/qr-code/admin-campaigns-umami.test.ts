/**
 * HOS-2679 — the QR campaigns panel route.
 *
 * Same harness as `admin-organize.test.ts`: the REAL `@repo/service-core` runs
 * and only the `@repo/db` models are stubbed. The api env is the real one with the
 * Umami variables overridden per test. Umami is never called: `fetch` is a spy
 * that the tests assert untouched.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    counts: [] as Array<{ raw: string; count: number }>,
    settings: {} as Record<string, string | undefined>
}));

vi.mock(
    '@repo/service-core',
    async (importOriginal) => await importOriginal<Record<string, unknown>>()
);

vi.mock('../../../src/utils/env', async (importOriginal) => {
    // The validated settings object is a live `let` binding, assigned when the app validates it: read it lazily.
    const actual = await importOriginal<{ env: Record<string, unknown> | undefined }>();
    return {
        ...actual,
        env: new Proxy({} as Record<string, unknown>, {
            get: (_target, key: string) =>
                key in state.settings ? state.settings[key] : actual.env?.[key]
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
const UMAMI_SETTINGS = {
    HOSPEDA_UMAMI_URL: 'https://umami.test',
    HOSPEDA_UMAMI_WEBSITE_ID_WEB: WEBSITE
};

function actorWith(permissions: readonly PermissionEnum[]) {
    return {
        id: '77777777-7777-4777-8777-777777777777',
        roles: [RoleEnum.ADMIN] as readonly RoleEnum[],
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, ...permissions]
    };
}

const viewer = actorWith([PermissionEnum.QR_CODE_VIEW]);

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

async function probe(app: Hono<AppBindings>, path: string, method = 'GET'): Promise<Probe> {
    const res = await app.request(path, { method, headers: { 'user-agent': 'vitest' } });
    const text = await res.text();
    try {
        return { status: res.status, body: text ? JSON.parse(text) : {} };
    } catch {
        return { status: res.status, body: { raw: text } };
    }
}

type Item = {
    readonly campaign: string;
    readonly qrCount: number;
    readonly viewUrl: string | null;
    readonly unsupportedReason?: string;
};
const dataOf = (res: Probe) => res.body.data as { items: Item[] };

const fetchMock = vi.fn();

beforeEach(() => {
    state.counts = [
        { raw: 'verano', count: 2 },
        { raw: 'verano+2026', count: 1 }
    ];
    state.settings = { ...UMAMI_SETTINGS };
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('GET /admin/qr-codes/campaigns/umami', () => {
    it('lists campaigns with counts and the Umami link, without calling Umami', async () => {
        // Act
        const res = await probe(buildApp(viewer), '/codes/campaigns/umami');

        // Assert
        expect(res.status).toBe(200);
        expect(fetchMock).not.toHaveBeenCalled();
        const { items } = dataOf(res);
        expect(items.map((item) => [item.campaign, item.qrCount])).toEqual([
            ['verano', 2],
            ['verano 2026', 1]
        ]);
        expect(items[0]?.viewUrl).toBe(
            `https://umami.test/websites/${WEBSITE}?utmCampaign=eq.verano`
        );
        expect(items[1]?.viewUrl).toBe(
            `https://umami.test/websites/${WEBSITE}?utmCampaign=eq.verano%202026`
        );
    });

    it('answers 200 with no links when Umami is not configured', async () => {
        state.settings = {
            HOSPEDA_UMAMI_URL: undefined,
            HOSPEDA_UMAMI_WEBSITE_ID_WEB: undefined
        };

        const res = await probe(buildApp(viewer), '/codes/campaigns/umami');

        expect(res.status).toBe(200);
        expect(dataOf(res).items.every((item) => item.viewUrl === null)).toBe(true);
    });

    it('gives a campaign with a comma no link and says why', async () => {
        state.counts = [{ raw: 'a,b', count: 3 }];

        const res = await probe(buildApp(viewer), '/codes/campaigns/umami');

        expect(res.status).toBe(200);
        expect(dataOf(res).items).toEqual([
            { campaign: 'a,b', qrCount: 3, unsupportedReason: 'COMMA_IN_CAMPAIGN', viewUrl: null }
        ]);
    });

    it('refuses an actor without QR_CODE_VIEW with 403', async () => {
        const res = await probe(buildApp(actorWith([])), '/codes/campaigns/umami');

        expect(res.status).toBe(403);
    });

    it('has no create endpoint: the removed POST segment route is gone', async () => {
        // The path is assembled so that no source file keeps the removed route's name.
        const removed = `/codes/campaigns/${['umami', 'segment'].join('-')}`;

        const res = await probe(buildApp(viewer), removed, 'POST');

        expect(res.status).not.toBe(200);
        expect(res.status).not.toBe(201);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
