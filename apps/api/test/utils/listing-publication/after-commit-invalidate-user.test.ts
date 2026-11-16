import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    invalidation: vi.fn(),
    invalidatePublicPath: vi.fn(),
    scheduleRevalidation: vi.fn(),
    execute: vi.fn()
}));
vi.mock('../../../src/utils/effective-set-cache', () => ({
    invalidateEffectiveSetsForUser: mocks.invalidation
}));
vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ billing: {} })
}));
vi.mock('@repo/db', () => ({
    buildEmailDedupKey: vi.fn(),
    buildEventOccurrence: vi.fn(),
    buildScheduleOccurrence: vi.fn(),
    emailOutboxModel: {},
    getDb: () => ({ execute: mocks.execute }),
    listingModerationModel: {},
    listingPublicationModel: {},
    listingPurgeModel: {},
    listingRetentionModel: {},
    listingRetentionScheduleModel: {},
    trials: {},
    users: {}
}));
vi.mock('@repo/service-core', () => ({
    getRevalidationService: () => ({ scheduleRevalidation: mocks.scheduleRevalidation })
}));
vi.mock('../../../src/middlewares/cache', () => ({
    invalidateCacheByPathPrefix: mocks.invalidatePublicPath
}));
vi.mock('../../../src/utils/clock', () => ({ getClock: () => ({ clock: {} }) }));
vi.mock('../../../src/utils/logger', () => ({ apiLogger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('../../../src/utils/trial/trial-campaign-outbox', () => ({
    buildTrialCampaignOutbox: vi.fn()
}));
vi.mock('../../../src/utils/listing-publication/trial-start-reader', () => ({
    buildTrialStartReader: vi.fn()
}));

import { getListingPublicationPorts } from '../../../src/utils/listing-publication/ports';

describe('TEST:1698:2 AC:1698:2 after-commit cache invalidation', () => {
    function deferred<T>() {
        let resolve!: (value: T) => void;
        const promise = new Promise<T>((done) => {
            resolve = done;
        });
        return { promise, resolve };
    }

    beforeEach(() => vi.clearAllMocks());

    it('waits for effective-set invalidation after commit', async () => {
        const pending = deferred<void>();
        mocks.invalidation.mockReturnValue(pending.promise);
        let settled = false;
        const invalidation = getListingPublicationPorts()
            .afterCommit.invalidateUser({ userId: 'u1' })
            .then(() => {
                settled = true;
            });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(settled).toBe(false);
        expect(mocks.invalidation).toHaveBeenCalledWith('u1');
        expect(mocks.invalidation).toHaveBeenCalledTimes(1);
        pending.resolve(undefined);
        await invalidation;
        expect(settled).toBe(true);
    });

    it('resolves undefined when invalidation completes', async () => {
        mocks.invalidation.mockResolvedValue(undefined);
        await expect(
            getListingPublicationPorts().afterCommit.invalidateUser({ userId: 'u1' })
        ).resolves.toBeUndefined();
    });

    it.each([
        [
            VerticalEnum.ACCOMMODATION,
            ['/api/v1/public/accommodations', '/api/v1/public/destinations', '/api/v1/public/users']
        ],
        [VerticalEnum.VENUE, ['/api/v1/public/venues']],
        [VerticalEnum.EXPERIENCE, ['/api/v1/public/experiences']]
    ] as const)('invalidates every %s memory cache before scheduling CDN purge', async (vertical, paths) => {
        mocks.execute.mockResolvedValue({ rows: [{ slug: 'listing', destinationSlug: null }] });
        mocks.invalidatePublicPath.mockImplementation(() => {
            expect(mocks.scheduleRevalidation).not.toHaveBeenCalled();
        });

        await getListingPublicationPorts().afterCommit.revalidate({
            vertical,
            listingIds: ['listing-id']
        });

        expect(mocks.invalidatePublicPath.mock.calls).toEqual(
            paths.map((pathPrefix) => [{ pathPrefix }])
        );
        expect(mocks.scheduleRevalidation).toHaveBeenCalledWith({
            entityType: vertical,
            id: 'listing-id',
            slug: 'listing',
            destinationSlug: undefined
        });
    });
});
