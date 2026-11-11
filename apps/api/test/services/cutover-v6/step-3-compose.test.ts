import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    stopListing: vi.fn(),
    stopEffectiveSetInvalidation: vi.fn(),
    drain: vi.fn(),
    subscribeListing: vi.fn(),
    subscribeEffectiveSetInvalidation: vi.fn()
}));
vi.mock('../../../src/utils/listing-publication/coverage-listener.js', () => ({
    subscribeListingCoverageRecalculation: mocks.subscribeListing,
    drainListingCoverageRecalculations: mocks.drain
}));
vi.mock('../../../src/utils/effective-set-coverage-invalidation.js', () => ({
    subscribeEffectiveSetCoverageInvalidation: mocks.subscribeEffectiveSetInvalidation
}));

import { composeStep3Process } from '../../../src/services/cutover-v6/step-3.compose.js';

describe('HOS-2091 step 3 composes the coverage listeners', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.subscribeListing.mockReturnValue(mocks.stopListing);
        mocks.subscribeEffectiveSetInvalidation.mockReturnValue(mocks.stopEffectiveSetInvalidation);
    });

    it('subscribes the listing recalculation and the effective-set invalidation once each', () => {
        // Arrange

        // Act
        composeStep3Process();

        // Assert
        expect(mocks.subscribeListing).toHaveBeenCalledTimes(1);
        expect(mocks.subscribeEffectiveSetInvalidation).toHaveBeenCalledTimes(1);
    });

    it('stop unsubscribes both and waits for the listing recalculations', async () => {
        // Arrange
        let resolveDrain!: () => void;
        mocks.drain.mockReturnValue(
            new Promise<void>((resolve) => {
                resolveDrain = resolve;
            })
        );
        let settled = false;
        const composition = composeStep3Process();

        // Act
        const stopping = composition.stop().then(() => {
            settled = true;
        });
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Assert
        expect(settled).toBe(false);
        expect(mocks.stopListing).toHaveBeenCalledTimes(1);
        expect(mocks.stopEffectiveSetInvalidation).toHaveBeenCalledTimes(1);
        resolveDrain();
        await stopping;
        expect(settled).toBe(true);
    });
});
