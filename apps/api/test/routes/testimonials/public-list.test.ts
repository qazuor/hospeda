import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const { accommodationList, destinationList } = vi.hoisted(() => ({
    accommodationList: vi.fn(),
    destinationList: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationReviewService: class {
            listWithUser = accommodationList;
        },
        DestinationReviewService: class {
            listWithUser = destinationList;
        }
    };
});

const { publicListTestimonialsRoute } = await import(
    '../../../src/routes/testimonials/public/list.js'
);

function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError((error, c) => {
        if (error instanceof ServiceError) {
            const status = error.code === ServiceErrorCode.VALIDATION_ERROR ? 400 : 500;
            return c.json(
                { success: false, error: { code: error.code, message: error.message } },
                status
            );
        }
        if (error instanceof HTTPException) return error.getResponse();
        return c.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: String(error) } },
            500
        );
    });
    app.use((c, next) => {
        c.set('actor', {
            id: '00000000-0000-4000-8000-000000000000',
            roles: [RoleEnum.GUEST],
            permissions: []
        });
        return next();
    });
    app.route('/', publicListTestimonialsRoute);
    return app;
}

function accommodation(id: string, date: string) {
    return {
        id,
        accommodationId: '10000000-0000-4000-8000-000000000000',
        averageRating: 5,
        content: id,
        createdAt: date,
        user: { displayName: id }
    };
}

function destination(id: string, date: string) {
    return {
        id,
        destinationId: '20000000-0000-4000-8000-000000000000',
        averageRating: 4,
        content: id,
        createdAt: date,
        user: { displayName: id }
    };
}

async function request(pageSize = 4) {
    const response = await buildApp().request(`/?pageSize=${pageSize}`, {
        headers: { 'user-agent': 'hospeda-route-test' }
    });
    return {
        response,
        body: (await response.json()) as {
            data: { items: Array<{ id: string }>; pagination: { total: number } };
        }
    };
}

beforeEach(() => {
    accommodationList.mockResolvedValue({
        data: { accommodationReviews: [], total: 0 },
        error: undefined
    });
    destinationList.mockResolvedValue({
        data: { data: [], pagination: { total: 0 } },
        error: undefined
    });
});

afterEach(() => vi.clearAllMocks());

describe('TEST:1705:2 TEST:1705:3r the public testimonials route reports the real total and orders deterministically', () => {
    it('reports both real totals while returning only the requested page', async () => {
        accommodationList.mockResolvedValue({
            data: {
                accommodationReviews: [
                    accommodation(
                        '00000000-0000-4000-8000-000000000011',
                        '2026-01-04T00:00:00.000Z'
                    ),
                    accommodation(
                        '00000000-0000-4000-8000-000000000012',
                        '2026-01-02T00:00:00.000Z'
                    )
                ],
                total: 7
            },
            error: undefined
        });
        destinationList.mockResolvedValue({
            data: {
                data: [
                    destination('00000000-0000-4000-8000-000000000021', '2026-01-03T00:00:00.000Z'),
                    destination('00000000-0000-4000-8000-000000000022', '2026-01-01T00:00:00.000Z')
                ],
                pagination: { total: 5 }
            },
            error: undefined
        });

        const { response, body } = await request(4);
        expect(response.status, JSON.stringify(body)).toBe(200);
        expect(body.data.pagination.total).toBe(12);
        expect(body.data.items.map(({ id }) => id)).toEqual([
            '00000000-0000-4000-8000-000000000011',
            '00000000-0000-4000-8000-000000000021',
            '00000000-0000-4000-8000-000000000012',
            '00000000-0000-4000-8000-000000000022'
        ]);
        expect(body.data.items).toHaveLength(4);
        expect(accommodationList.mock.calls[0]?.[1]).toEqual({ page: 1, pageSize: 2 });
        expect(destinationList.mock.calls[0]?.[1]).toEqual({ page: 1, pageSize: 2 });
    });

    it('returns zero total and no items when both halves are empty', async () => {
        const { response, body } = await request(4);
        expect(response.status).toBe(200);
        expect(body.data.pagination.total).toBe(0);
        expect(body.data.items).toEqual([]);
    });

    it('preserves the other half total and returns 200 when one service reports an error', async () => {
        accommodationList.mockResolvedValue({ error: new Error('unavailable') });
        destinationList.mockResolvedValue({
            data: {
                data: [
                    destination('00000000-0000-4000-8000-000000000021', '2026-01-01T00:00:00.000Z')
                ],
                pagination: { total: 6 }
            },
            error: undefined
        });
        const { response, body } = await request(4);
        expect(response.status).toBe(200);
        expect(body.data.pagination.total).toBe(6);
        expect(body.data.items.map(({ id }) => id)).toEqual([
            '00000000-0000-4000-8000-000000000021'
        ]);
    });

    it('keeps the merged order stable for equal dates regardless of service array order', async () => {
        const time = '2026-01-05T00:00:00.000Z';
        accommodationList.mockResolvedValue({
            data: {
                accommodationReviews: [
                    accommodation('00000000-0000-4000-8000-000000000001', time),
                    accommodation(
                        '00000000-0000-4000-8000-000000000004',
                        '2026-01-06T00:00:00.000Z'
                    )
                ],
                total: 2
            },
            error: undefined
        });
        destinationList.mockResolvedValue({
            data: {
                data: [
                    destination('00000000-0000-4000-8000-000000000002', time),
                    destination('00000000-0000-4000-8000-000000000003', '2026-01-07T00:00:00.000Z')
                ],
                pagination: { total: 2 }
            },
            error: undefined
        });
        const first = await request(4);
        expect(first.body.data.items.map(({ id }) => id)).toEqual([
            '00000000-0000-4000-8000-000000000003',
            '00000000-0000-4000-8000-000000000004',
            '00000000-0000-4000-8000-000000000002',
            '00000000-0000-4000-8000-000000000001'
        ]);

        accommodationList.mockResolvedValue({
            data: {
                accommodationReviews: [
                    accommodation(
                        '00000000-0000-4000-8000-000000000004',
                        '2026-01-06T00:00:00.000Z'
                    ),
                    accommodation('00000000-0000-4000-8000-000000000001', time)
                ],
                total: 2
            },
            error: undefined
        });
        destinationList.mockResolvedValue({
            data: {
                data: [
                    destination('00000000-0000-4000-8000-000000000003', '2026-01-07T00:00:00.000Z'),
                    destination('00000000-0000-4000-8000-000000000002', time)
                ],
                pagination: { total: 2 }
            },
            error: undefined
        });
        const second = await request(4);
        expect(second.body.data.items).toEqual(first.body.data.items);
    });
});
