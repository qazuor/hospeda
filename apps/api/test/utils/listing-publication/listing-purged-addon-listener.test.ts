import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    delivered: vi.fn(async (_listingId: string) => undefined),
    subscribe: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    subscribeListingPurgedAddons: (source: {
        onListingPurged: (listener: (event: { listingId: string }) => Promise<void>) => () => void;
    }) => {
        mocks.subscribe();
        return source.onListingPurged(async ({ listingId }) => mocks.delivered(listingId));
    }
}));
vi.mock('../../../src/utils/listing-publication/listing-inverse', async () => {
    const emitter = await import('../../../src/utils/listing-publication/listing-purged-emitter');
    return {
        createApiListingInverse: () => ({
            onListingPurged: emitter.onListingPurged,
            listing: vi.fn(),
            listingPurged: vi.fn()
        })
    };
});
vi.mock('../../../src/utils/payment-provider', () => ({ getPaymentProvider: () => ({}) }));
vi.mock('../../../src/utils/clock', () => ({
    getClock: () => ({ clock: { now: () => new Date() } })
}));
vi.mock('../../../src/utils/listing-access/coverage-notices', () => ({
    getCoverageNotices: () => ({})
}));
vi.mock('../../../src/routes/billing-subscription/before-cancel-notice', () => ({
    beforeCancelNotice: {}
}));

import {
    drainListingPurgedAddonCancellations,
    subscribeListingPurgedAddonCancellation
} from '../../../src/utils/listing-publication/listing-purged-addon-listener';
import { emitListingPurged } from '../../../src/utils/listing-publication/listing-purged-emitter';

afterEach(() => vi.clearAllMocks());

describe('TEST:B10:7 AC:B10:6 API listing purged addon listener', () => {
    it('registers one emitter listener, passes the listing id, and removes it on shutdown', async () => {
        const stop = subscribeListingPurgedAddonCancellation();
        const secondStop = subscribeListingPurgedAddonCancellation();
        expect(mocks.subscribe).toHaveBeenCalledTimes(1);
        const listingId = crypto.randomUUID();
        await emitListingPurged({ listingId });
        await vi.waitFor(() => expect(mocks.delivered).toHaveBeenCalledWith(listingId));
        await drainListingPurgedAddonCancellations();
        expect(mocks.delivered).toHaveBeenCalledTimes(1);
        stop();
        secondStop();
        await emitListingPurged({ listingId });
        await new Promise((resolve) => setTimeout(resolve, 70));
        expect(mocks.delivered).toHaveBeenCalledTimes(1);
    });

    it('starts and stops the listener from the API lifecycle', () => {
        const source = readFileSync(new URL('../../../src/index.ts', import.meta.url), 'utf8');
        expect(source).toContain(
            'const unsubscribeListingPurgedAddons = subscribeListingPurgedAddonCancellation();'
        );
        expect(source).toContain('unsubscribeListingPurgedAddons?.();');
    });
});
