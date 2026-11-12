import { VerticalEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    listener: undefined as
        | ((event: { userId: string; vertical: VerticalEnum }) => void)
        | undefined,
    subscribe: vi.fn(),
    sync: vi.fn(),
    ports: vi.fn(),
    error: vi.fn()
}));

vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        billing: {
            onCoverageChanged: (listener: typeof mocks.listener) => {
                mocks.subscribe();
                mocks.listener = listener;
                return vi.fn();
            }
        }
    })
}));
vi.mock('../../../src/utils/listing-featured/listing-featured-ports', () => ({
    getListingFeaturedPorts: mocks.ports
}));
vi.mock('../../../../../packages/verticals/src/featured/sync-listing-featured', () => ({
    syncListingFeatured: mocks.sync
}));
vi.mock('../../../src/utils/logger', () => ({ apiLogger: { error: mocks.error } }));

import {
    drainListingFeaturedSyncs,
    subscribeListingFeaturedSync
} from '../../../src/utils/listing-featured/featured-sync-listener';

describe('HOS-1718 the coverage notice drives the listing featured sync', () => {
    let stop: (() => void) | undefined;

    afterEach(() => {
        stop?.();
        stop = undefined;
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.listener = undefined;
        mocks.sync.mockResolvedValue({ featuredOn: [], featuredOff: [] });
        mocks.ports.mockReturnValue({});
    });

    it.each([
        VerticalEnum.ACCOMMODATION,
        VerticalEnum.VENUE,
        VerticalEnum.EXPERIENCE
    ])('syncs on a notice of each listing vertical: %s', async (vertical) => {
        // Arrange
        stop = subscribeListingFeaturedSync();
        // Act
        mocks.listener?.({ userId: 'u1', vertical });
        await drainListingFeaturedSyncs();
        // Assert
        expect(mocks.sync).toHaveBeenCalledTimes(1);
        expect(mocks.sync).toHaveBeenCalledWith({ ports: {}, userId: 'u1', vertical });
    });

    it.each([
        VerticalEnum.TOURIST,
        VerticalEnum.PARTNER
    ])('ignores tourist and partner notices: %s', async (vertical) => {
        // Arrange
        stop = subscribeListingFeaturedSync();
        // Act
        mocks.listener?.({ userId: 'u1', vertical });
        await drainListingFeaturedSyncs();
        // Assert
        expect(mocks.sync).toHaveBeenCalledTimes(0);
    });

    it('a failing sync is logged and does not reject', async () => {
        // Arrange
        stop = subscribeListingFeaturedSync();
        mocks.sync.mockRejectedValueOnce(new Error('expected test failure'));
        // Act
        mocks.listener?.({ userId: 'u1', vertical: VerticalEnum.ACCOMMODATION });
        // Assert
        await expect(drainListingFeaturedSyncs()).resolves.toBeUndefined();
        expect(mocks.error).toHaveBeenCalledTimes(1);
    });

    it('subscribing twice registers one listener', async () => {
        // Arrange
        stop = subscribeListingFeaturedSync();
        subscribeListingFeaturedSync();
        // Act
        mocks.listener?.({ userId: 'u1', vertical: VerticalEnum.VENUE });
        await drainListingFeaturedSyncs();
        // Assert
        expect(mocks.subscribe).toHaveBeenCalledTimes(1);
        expect(mocks.sync).toHaveBeenCalledTimes(1);
    });
});
