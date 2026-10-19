import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    stopListing: vi.fn(),
    stopTrial: vi.fn(),
    drain: vi.fn(),
    subscribeListing: vi.fn(),
    subscribeTrial: vi.fn(),
    injectClock: vi.fn(),
    injectProvider: vi.fn(),
    buildPorts: vi.fn(),
    defaultProvider: vi.fn(),
    getUserRoles: vi.fn(),
    resolvePermissions: vi.fn()
}));
vi.mock('../../../src/utils/listing-publication/coverage-listener.js', () => ({
    subscribeListingCoverageRecalculation: mocks.subscribeListing,
    drainListingCoverageRecalculations: mocks.drain
}));
vi.mock('../../../src/utils/trial/trial-coverage-listener.js', () => ({
    subscribeTrialCoverageConversion: mocks.subscribeTrial
}));
vi.mock('../../../src/routes/billing-permanent-grant/admin/ports.js', () => ({
    buildPermanentGrantPorts: mocks.buildPorts
}));
vi.mock('../../../src/utils/clock.js', () => ({
    injectClock: mocks.injectClock,
    systemClock: { clock: {} }
}));
vi.mock('../../../src/utils/payment-provider.js', () => ({
    defaultPaymentProvider: mocks.defaultProvider,
    injectPaymentProvider: mocks.injectProvider
}));
vi.mock('../../../src/middlewares/actor.js', () => ({
    resolveEffectivePermissions: mocks.resolvePermissions
}));
vi.mock('@repo/service-core', () => ({ getUserRoles: mocks.getUserRoles }));

import { composeStep3bProcess } from '../../../src/services/cutover-b9a/step-3b.compose.js';

describe('TEST:1698:3 AC:1698:2 step 3b composition drain', () => {
    function deferred<T>() {
        let resolve!: (value: T) => void;
        const promise = new Promise<T>((done) => {
            resolve = done;
        });
        return { promise, resolve };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.stopListing.mockReset();
        mocks.stopTrial.mockReset();
        mocks.drain.mockReset();
        mocks.subscribeListing.mockReturnValue(mocks.stopListing);
        mocks.subscribeTrial.mockReturnValue(mocks.stopTrial);
        mocks.buildPorts.mockReturnValue({});
        mocks.defaultProvider.mockReturnValue({});
    });

    it('TEST:1698:3 AC:1698:2 waits for listing recalculations when stopping', async () => {
        const pending = deferred<void>();
        mocks.drain.mockReturnValue(pending.promise);
        let settled = false;
        const stop = composeStep3bProcess()
            .stop()
            .then(() => {
                settled = true;
            });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(settled).toBe(false);
        pending.resolve(undefined);
        await stop;
        expect(settled).toBe(true);
    });

    it('TEST:1698:3 AC:1698:2 stops both listeners before draining once', async () => {
        mocks.drain.mockResolvedValue(undefined);
        const composition = composeStep3bProcess();
        await expect(composition.stop()).resolves.toBeUndefined();
        expect(mocks.stopTrial).toHaveBeenCalledTimes(1);
        expect(mocks.stopListing).toHaveBeenCalledTimes(1);
        expect(mocks.drain).toHaveBeenCalledTimes(1);
        expect(mocks.stopTrial.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.drain.mock.invocationCallOrder[0]
        );
        expect(mocks.stopListing.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.drain.mock.invocationCallOrder[0]
        );
    });
});
