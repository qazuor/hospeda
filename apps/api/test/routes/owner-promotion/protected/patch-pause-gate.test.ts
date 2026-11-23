/**
 * Owner decision 18 (Mi cuenta UI epic): an accommodation owner WITHOUT
 * `create_promotions` can still pause a promotion, and nothing else. Editing
 * and re-activating keep the plan gate.
 */
import { PermissionEnum, RoleEnum, type VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createErrorHandler } from '../../../../src/middlewares/response';
import { protectedPatchOwnerPromotionRoute } from '../../../../src/routes/owner-promotion/protected/patch';
import type { AppBindings } from '../../../../src/types';

const OWNER = '11111111-1111-4111-8111-111111111111';
const PROMOTION = '99999999-9999-4999-8999-999999999999';
const LISTING = '33333333-3333-4333-8333-333333333333';

const mocks = vi.hoisted(() => ({
    getById: vi.fn(),
    update: vi.fn(),
    effectiveSet: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        OwnerPromotionService: class {
            getById = mocks.getById;
            update = mocks.update;
        }
    };
});

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mocks.effectiveSet })
}));

const promotion = {
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
    entityType: 'accommodation',
    entityId: LISTING,
    accommodationId: LISTING,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

function app() {
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
    hono.route('/case', protectedPatchOwnerPromotionRoute);
    return hono;
}

const patch = (body: Record<string, unknown>) =>
    app().request(`/case/${PROMOTION}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    });

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getById.mockResolvedValue({ data: promotion });
    mocks.update.mockResolvedValue({ data: { ...promotion, lifecycleState: 'INACTIVE' } });
    // A covered plan WITHOUT create_promotions.
    mocks.effectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: true,
                inheritsTouristVip: false,
                entries: []
            })
    );
});

describe('PATCH /owner-promotions/:id without create_promotions', () => {
    it('pauses the promotion', async () => {
        const response = await patch({ lifecycleState: 'INACTIVE' });

        expect(response.status).toBe(200);
        expect(mocks.update).toHaveBeenCalledTimes(1);
    });

    it('refuses an edit with ENTITLEMENT_REQUIRED', async () => {
        const response = await patch({ title: 'Otra' });

        expect(response.status).toBe(403);
        expect((await response.json()).error.code).toBe('ENTITLEMENT_REQUIRED');
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it('refuses a re-activation', async () => {
        const response = await patch({ lifecycleState: 'ACTIVE' });

        expect(response.status).toBe(403);
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it('refuses a pause bundled with another change', async () => {
        const response = await patch({ lifecycleState: 'INACTIVE', title: 'Otra' });

        expect(response.status).toBe(403);
        expect(mocks.update).not.toHaveBeenCalled();
    });
});
