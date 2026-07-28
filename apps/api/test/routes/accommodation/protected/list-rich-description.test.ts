/**
 * BETA-199 — GET /api/v1/protected/accommodations must NOT carry the premium
 * rich-description pair.
 *
 * `AccommodationProtectedSchema` declares `richDescription` +
 * `richDescriptionI18n` so the owner's editor GET can show translation status for
 * that field. Declaring them there declares them for all eight routes on that
 * schema, so every route other than `getById` drops the pair unconditionally.
 *
 * `rich-description-strip.guard.test.ts` proves the strip is CALLED in each of
 * them. This proves it WORKS on the one route whose shape differs: the list maps
 * over items instead of stripping a single object, and passing the array itself
 * would object-spread it into `{0: …, 1: …}`.
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';

const { mockList } = vi.hoisted(() => ({ mockList: vi.fn() }));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        // `function` (not an arrow) — the route calls this with `new`.
        AccommodationService: vi.fn().mockImplementation(function () {
            return { list: mockList };
        })
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { protectedListOwnAccommodationsRoute } = await import(
    '../../../../src/routes/accommodation/protected/list.js'
);

/** One listing row, premium pair included as the service layer returns it. */
function accommodationRow(id: string) {
    return {
        id,
        slug: `casa-${id.slice(0, 4)}`,
        name: 'Casa BETA-199',
        type: 'HOUSE',
        summary: 'A test accommodation for the rich-description strip regression.',
        description:
            'A description long enough to satisfy the accommodation read schema without tripping any minimum-length bound.',
        richDescription: '<p>Contenido premium</p>',
        richDescriptionI18n: { es: '<p>Contenido premium</p>', en: '<p>Premium</p>', pt: null },
        isFeatured: false,
        ownerId: OWNER_ID,
        destinationId: '66666666-6666-4666-8666-666666666666',
        media: { featuredImage: { url: 'https://example.com/i.jpg', moderationState: 'APPROVED' } },
        location: { street: 'Av. Costanera', number: '123' },
        averageRating: 4.5,
        reviewsCount: 3,
        visibility: 'PUBLIC',
        lifecycleState: 'ACTIVE',
        seo: null,
        price: { price: 150, currency: 'ARS' },
        tags: [],
        extraInfo: { capacity: 4, minNights: 1, bedrooms: 2, bathrooms: 1 },
        contactInfo: null,
        socialNetworks: null,
        faqs: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
    };
}

const SERVICE_ERROR_HTTP_STATUS: Partial<Record<ServiceErrorCode, number>> = {
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.VALIDATION_ERROR]: 400,
    [ServiceErrorCode.INTERNAL_ERROR]: 500
};

function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();

    app.onError((error, c) => {
        if (error instanceof ServiceError) {
            const status = SERVICE_ERROR_HTTP_STATUS[error.code] ?? 500;
            return c.json(
                { success: false, error: { code: error.code, message: error.message } },
                status as 400 | 401 | 403 | 404 | 500
            );
        }
        if (error instanceof HTTPException) {
            return error.getResponse();
        }
        return c.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: String(error) } },
            500
        );
    });

    app.use((c, next) => {
        c.set('actor', {
            id: OWNER_ID,
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        return next();
    });

    app.route('/', protectedListOwnAccommodationsRoute);
    return app;
}

beforeEach(() => {
    mockList.mockResolvedValue({
        data: {
            items: [
                accommodationRow('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
                accommodationRow('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
            ],
            total: 2
        },
        error: undefined
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('GET /api/v1/protected/accommodations — rich-description strip (BETA-199)', () => {
    it('drops both premium fields from every item', async () => {
        const res = await buildApp().request('/');

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toHaveLength(2);

        for (const item of body.data.items) {
            expect(item).not.toHaveProperty('richDescription');
            expect(item).not.toHaveProperty('richDescriptionI18n');
            // A strip, not a truncation — the listing itself must still work.
            expect(item.name).toBe('Casa BETA-199');
            expect(item.ownerId).toBe(OWNER_ID);
        }
    });

    it('strips per item rather than over the array', async () => {
        // `stripRichDescriptionFields` throws on an array (a missing `.map` would
        // otherwise object-spread it into `{0: …, 1: …}` and surface far away as
        // an opaque schema error). Two distinct ids prove the mapping happened.
        const res = await buildApp().request('/');
        const body = await res.json();

        expect(body.data.items.map((item: { id: string }) => item.id)).toEqual([
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
        ]);
    });

    it('survives an empty page', async () => {
        mockList.mockResolvedValue({ data: { items: [], total: 0 }, error: undefined });

        const res = await buildApp().request('/');

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toEqual([]);
    });
});
