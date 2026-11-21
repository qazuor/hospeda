/**
 * HOS-2270 (G-5, AC-8, AC-9): the accommodation door of the owner-promotion routes.
 *
 * `/protected/owner-promotions` is the accommodation owner's API. A promotion that
 * hangs from a venue does not exist there: get, update, patch and delete answer 404,
 * the list returns only accommodation promotions, and the public by-id read answers
 * nothing for it. An accommodation promotion keeps working exactly as before.
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createErrorHandler } from '../../../../src/middlewares/response';
import { protectedGetOwnerPromotionByIdRoute } from '../../../../src/routes/owner-promotion/protected/get';
import { protectedListOwnOwnerPromotionsRoute } from '../../../../src/routes/owner-promotion/protected/list';
import { protectedPatchOwnerPromotionRoute } from '../../../../src/routes/owner-promotion/protected/patch';
import { protectedDeleteOwnerPromotionRoute } from '../../../../src/routes/owner-promotion/protected/softDelete';
import { protectedUpdateOwnerPromotionRoute } from '../../../../src/routes/owner-promotion/protected/update';
import { publicGetOwnerPromotionByIdRoute } from '../../../../src/routes/owner-promotion/public/getById';
import type { AppBindings } from '../../../../src/types';

const OWNER = '11111111-1111-4111-8111-111111111111';
const PROMOTION = '99999999-9999-4999-8999-999999999999';

const mocks = vi.hoisted(() => ({
    getById: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    list: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        OwnerPromotionService: class {
            getById = mocks.getById;
            update = mocks.update;
            softDelete = mocks.softDelete;
            list = mocks.list;
        }
    };
});

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: vi.fn() })
}));

const base = {
    id: PROMOTION,
    slug: 'promo',
    ownerId: OWNER,
    title: 'Promo',
    description: null,
    discountType: 'percentage',
    discountValue: 10,
    minNights: null,
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: null,
    maxRedemptions: null,
    currentRedemptions: 0,
    lifecycleState: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};
const venuePromotion = {
    ...base,
    entityType: 'venue',
    entityId: '22222222-2222-4222-8222-222222222222',
    accommodationId: null
};
const accommodationPromotion = {
    ...base,
    entityType: 'accommodation',
    entityId: '33333333-3333-4333-8333-333333333333',
    accommodationId: '33333333-3333-4333-8333-333333333333'
};

function app(route: Hono<AppBindings>, path = '/case') {
    const hono = new Hono<AppBindings>();
    hono.onError(createErrorHandler());
    hono.use((ctx, next) => {
        ctx.set('actor', {
            id: OWNER,
            roles: [RoleEnum.HOST],
            permissions: Object.values(PermissionEnum),
            emailVerified: true
        } as never);
        return next();
    });
    hono.route(path, route);
    return hono;
}

const json = { 'content-type': 'application/json' };

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getById.mockResolvedValue({ data: venuePromotion });
    mocks.update.mockResolvedValue({ data: accommodationPromotion });
    mocks.softDelete.mockResolvedValue({ data: { count: 1 } });
    mocks.list.mockResolvedValue({ data: { items: [], total: 0 } });
});

describe('AC-8: a venue promotion is a 404 through the accommodation door', () => {
    it('GET by id', async () => {
        const response = await app(protectedGetOwnerPromotionByIdRoute).request(
            `/case/${PROMOTION}`
        );

        expect(response.status).toBe(404);
    });

    it('PUT and PATCH never reach the service', async () => {
        const put = await app(protectedUpdateOwnerPromotionRoute).request(`/case/${PROMOTION}`, {
            method: 'PUT',
            headers: json,
            body: JSON.stringify({ title: 'x' })
        });
        const patch = await app(protectedPatchOwnerPromotionRoute).request(`/case/${PROMOTION}`, {
            method: 'PATCH',
            headers: json,
            body: JSON.stringify({ title: 'x' })
        });

        expect(put.status).toBe(404);
        expect(patch.status).toBe(404);
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it('DELETE never reaches the service', async () => {
        const response = await app(protectedDeleteOwnerPromotionRoute).request(
            `/case/${PROMOTION}`,
            { method: 'DELETE' }
        );

        expect(response.status).toBe(404);
        expect(mocks.softDelete).not.toHaveBeenCalled();
    });

    it('the 404 reads byte-identical to a promotion that does not exist', async () => {
        mocks.getById.mockResolvedValueOnce({ data: venuePromotion });
        const venue = await app(protectedGetOwnerPromotionByIdRoute).request(`/case/${PROMOTION}`);
        mocks.getById.mockResolvedValueOnce({
            error: Object.assign(new Error('ownerPromotion not found'), { code: 'NOT_FOUND' })
        });
        const missing = await app(protectedGetOwnerPromotionByIdRoute).request(
            `/case/${PROMOTION}`
        );

        expect((await venue.json()).error.message).toBe((await missing.json()).error.message);
    });
});

describe('an accommodation promotion keeps working exactly as before', () => {
    beforeEach(() => {
        mocks.getById.mockResolvedValue({ data: accommodationPromotion });
    });

    it('GET by id answers it', async () => {
        const response = await app(protectedGetOwnerPromotionByIdRoute).request(
            `/case/${PROMOTION}`
        );

        expect(response.status).toBe(200);
    });

    it('DELETE soft-deletes it', async () => {
        const response = await app(protectedDeleteOwnerPromotionRoute).request(
            `/case/${PROMOTION}`,
            { method: 'DELETE' }
        );

        expect(response.status).toBe(200);
        expect(mocks.softDelete).toHaveBeenCalledTimes(1);
    });
});

describe('AC-9: lists and the public read', () => {
    it('the owner list asks only for accommodation promotions', async () => {
        await app(protectedListOwnOwnerPromotionsRoute).request('/case');

        expect(mocks.list).toHaveBeenCalledTimes(1);
        expect(mocks.list.mock.calls[0]?.[1]?.where).toMatchObject({
            ownerId: OWNER,
            entityType: 'accommodation'
        });
    });

    it('the public by-id read answers nothing for a venue promotion', async () => {
        const response = await app(publicGetOwnerPromotionByIdRoute).request(`/case/${PROMOTION}`);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data).toBeNull();
    });
});
