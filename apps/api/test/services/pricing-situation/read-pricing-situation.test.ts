/**
 * HOS-2665: a person who holds a plan through a live permanent grant reads
 * `GRANTED`, with the order inheritance → subscription → grant → vertical.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    inherits: vi.fn(),
    findLiveCommitment: vi.fn(),
    findSellableCurrentVersions: vi.fn(),
    readLivePermanentGrantPlan: vi.fn(),
    resolveSubscribeDestinationForUser: vi.fn()
}));

vi.mock('@repo/db', () => ({
    and: vi.fn(),
    eq: vi.fn(),
    getDb: vi.fn(),
    trials: {},
    subscriptionModel: { findLiveCommitment: mocks.findLiveCommitment },
    planCatalogModel: { findSellableCurrentVersions: mocks.findSellableCurrentVersions }
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    readLivePermanentGrantPlan: mocks.readLivePermanentGrantPlan
}));

vi.mock('../../../src/routes/billing-subscription/tourist-vip-inheritance', () => ({
    touristVipInheritance: { inherits: mocks.inherits }
}));

vi.mock('../../../src/services/listing-publication/subscribe-destination.service', () => ({
    resolveSubscribeDestinationForUser: mocks.resolveSubscribeDestinationForUser
}));

import { readPricingSituation } from '../../../src/services/pricing-situation/read-pricing-situation';
import { injectClock } from '../../../src/utils/clock';

injectClock({ clock: { now: () => new Date('2026-11-27T12:00:00.000Z') } });

const userId = '00000000-0000-4000-8000-000000000001';
const grant = {
    planId: '00000000-0000-4000-8000-0000000000a1',
    planVersionId: '00000000-0000-4000-8000-0000000000b1',
    planName: 'Turista VIP',
    since: new Date('2026-11-01T10:00:00.000Z')
};
const granted = {
    situation: 'GRANTED',
    planId: grant.planId,
    planVersionId: grant.planVersionId,
    planName: 'Turista VIP',
    since: '2026-11-01T10:00:00.000Z'
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.inherits.mockResolvedValue(false);
    mocks.findLiveCommitment.mockResolvedValue(null);
    mocks.findSellableCurrentVersions.mockResolvedValue([{ id: 'sellable' }]);
    mocks.readLivePermanentGrantPlan.mockResolvedValue({ plan: null });
    mocks.resolveSubscribeDestinationForUser.mockResolvedValue({ destination: 'COVERED' });
});

describe('HOS-2665 readPricingSituation with a live permanent grant', () => {
    it('reports GRANTED for a tourist VIP held through a grant instead of CHECKOUT', async () => {
        // Arrange
        mocks.readLivePermanentGrantPlan.mockResolvedValue({ plan: grant });

        // Act
        const result = await readPricingSituation({ userId, vertical: 'tourist' });

        // Assert
        expect(result).toEqual(granted);
        expect(mocks.readLivePermanentGrantPlan).toHaveBeenCalledWith({
            userId,
            vertical: 'tourist'
        });
        expect(mocks.findSellableCurrentVersions).not.toHaveBeenCalled();
    });

    it('still reports CHECKOUT for a tourist without a grant', async () => {
        expect(await readPricingSituation({ userId, vertical: 'tourist' })).toEqual({
            situation: 'CHECKOUT'
        });
    });

    it('keeps inherited tourist VIP first, before reading any grant', async () => {
        mocks.inherits.mockResolvedValue(true);
        mocks.readLivePermanentGrantPlan.mockResolvedValue({ plan: grant });

        expect(await readPricingSituation({ userId, vertical: 'tourist' })).toEqual({
            situation: 'TOURIST_VIP_INHERITED'
        });
        expect(mocks.readLivePermanentGrantPlan).not.toHaveBeenCalled();
    });

    for (const vertical of ['accommodation', 'venue', 'experience'] as const) {
        it(`reports GRANTED for a ${vertical} host covered by a grant instead of COVERED`, async () => {
            mocks.readLivePermanentGrantPlan.mockResolvedValue({ plan: grant });

            expect(await readPricingSituation({ userId, vertical })).toEqual(granted);
            expect(mocks.resolveSubscribeDestinationForUser).not.toHaveBeenCalled();
        });
    }

    it('keeps COVERED for a host covered by something other than a grant', async () => {
        const getDb = (await import('@repo/db')).getDb as unknown as ReturnType<typeof vi.fn>;
        getDb.mockReturnValue({
            select: () => ({
                from: () => ({ where: () => ({ limit: async () => [] }) })
            })
        });

        expect(await readPricingSituation({ userId, vertical: 'accommodation' })).toEqual({
            situation: 'COVERED'
        });
    });

    it('lets a live subscription win over a grant (the person is paying)', async () => {
        const subscription = {
            status: 'ACTIVE',
            planVersionId: '00000000-0000-4000-8000-0000000000c1',
            billingOptionId: '00000000-0000-4000-8000-0000000000d1'
        };
        mocks.findLiveCommitment.mockResolvedValue({ subscription });
        mocks.readLivePermanentGrantPlan.mockResolvedValue({ plan: grant });

        for (const vertical of ['tourist', 'accommodation'] as const) {
            expect(await readPricingSituation({ userId, vertical })).toEqual({
                situation: 'SUBSCRIBED',
                ...subscription
            });
        }
        expect(mocks.readLivePermanentGrantPlan).not.toHaveBeenCalled();
    });
});
