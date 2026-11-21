/**
 * Tests for GET /api/v1/public/partner-types (HOS-2336).
 *
 * The route is a thin wrapper over `PartnerTypeService.getPublicList` (the
 * ACTIVE filter and the ordering are asserted at the service and model
 * layers). Here we pin what the ROUTE owns: a guest reaches it, it returns the
 * list untouched, the payload satisfies `PublicPartnerTypeListSchema`, and the
 * whole route is mounted on the real app (with no write verb on the public
 * tier).
 *
 * @module test/routes/partner-type/public-list
 */

import { PublicPartnerTypeListSchema, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';
import { APP_IMPORT_TIMEOUT_MS } from '../../helpers/app-import-timeout';

const { mockGetPublicList } = vi.hoisted(() => ({ mockGetPublicList: vi.fn() }));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        PartnerTypeService: vi.fn().mockImplementation(function () {
            return { getPublicList: mockGetPublicList };
        })
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { publicListPartnerTypesRoute } = await import(
    '../../../src/routes/partner-type/public/list.js'
);

const GUEST_ID = '00000000-0000-4000-8000-000000000000';

const LIST = {
    items: [
        {
            slug: 'business',
            nameI18n: { es: 'Comercio', en: 'Business', pt: 'Comércio' },
            displayWeight: 10
        },
        {
            slug: 'media',
            nameI18n: { es: 'Medio', en: 'Media outlet', pt: 'Meio de comunicação' },
            displayWeight: 40
        }
    ]
};

function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError((error, c) => {
        if (error instanceof ServiceError) {
            return c.json({ success: false, error: { code: error.code } }, 500);
        }
        if (error instanceof HTTPException) return error.getResponse();
        return c.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, 500);
    });
    app.use((c, next) => {
        c.set('actor', { id: GUEST_ID, roles: [RoleEnum.GUEST], permissions: [] });
        return next();
    });
    app.route('/', publicListPartnerTypesRoute);
    return app;
}

beforeEach(() => {
    mockGetPublicList.mockReset();
    mockGetPublicList.mockResolvedValue({ data: LIST, error: undefined });
});

describe('GET /api/v1/public/partner-types', () => {
    it('200 for a guest, returning the list untouched and schema-valid', async () => {
        const res = await buildApp().request('/');
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toEqual(LIST);
        expect(PublicPartnerTypeListSchema.safeParse(body.data).success).toBe(true);
        expect(mockGetPublicList.mock.calls[0]?.[0]).toMatchObject({ id: GUEST_ID });
    });

    it('200 with an empty list when no type is active', async () => {
        mockGetPublicList.mockResolvedValue({ data: { items: [] }, error: undefined });

        const res = await buildApp().request('/');
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.items).toEqual([]);
    });

    it('propagates a service error instead of answering an empty list', async () => {
        mockGetPublicList.mockResolvedValue({
            data: undefined,
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'db down' }
        });

        expect((await buildApp().request('/')).status).toBe(500);
    });
});

describe('Route registration (real app)', () => {
    const HEADERS = { 'user-agent': 'vitest', accept: 'application/json' };

    it(
        'mounts the public list without an auth gate',
        async () => {
            const { initApp } = await import('../../../src/app.js');
            const res = await initApp().request('/api/v1/public/partner-types', {
                method: 'GET',
                headers: HEADERS
            });
            expect(res.status).not.toBe(404);
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        },
        APP_IMPORT_TIMEOUT_MS
    );

    it(
        'exposes no write verb on the public tier',
        async () => {
            const { initApp } = await import('../../../src/app.js');
            const res = await initApp().request('/api/v1/public/partner-types', {
                method: 'POST',
                headers: HEADERS
            });
            expect(res.status).toBe(404);
        },
        APP_IMPORT_TIMEOUT_MS
    );
});
