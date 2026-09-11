/**
 * subscription-linked-entities.service.test.ts (HOS-1181 wiring)
 *
 * The bridge is one function with three effects, and every billing-lifecycle
 * site calls IT rather than the effects (see
 * `subscription-linked-entities-bridge.guard.test.ts` for the static pin on
 * the call sites). What this file proves is the other half of that promise:
 * ONE bridge call really does drive all three effects, with the arguments
 * each of them needs.
 *
 * The three effects cover the three LISTING verticals, so this is also where
 * "a payment brings the listing back" is wired for each of them:
 *
 * - gastronomy + experience — visibility is derived, so the commerce half
 *   carrying the NEW status is what brings a paid listing's visibility back
 *   (the flip itself is pinned in
 *   `packages/service-core/test/services/commerce/commerce-visibility.test.ts`).
 * - accommodation — the cache half refreshes the owner's status rows, and the
 *   HOS-1181 win-back half republishes the listings billing took down.
 *
 * @module test/services/subscription-linked-entities.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const reconcileCommerceMock = vi.fn();
vi.mock('../../src/services/commerce-reconcile.service', () => ({
    reconcileCommerceListingForSubscription: (...args: unknown[]) => reconcileCommerceMock(...args)
}));

const syncCacheMock = vi.fn();
vi.mock('../../src/services/entity-subscription-cache.service', () => ({
    syncAccommodationSubscriptionCacheForSubscription: (...args: unknown[]) =>
        syncCacheMock(...args)
}));

const winBackMock = vi.fn();
vi.mock('../../src/services/accommodation-winback-republish.service', () => ({
    republishBillingUnpublishedAccommodations: (...args: unknown[]) => winBackMock(...args)
}));

// Import after mocks — the real reconciler, built from the mocked halves.
import { reconcileSubscriptionLinkedEntities } from '../../src/services/subscription-linked-entities.service';

const CALL_ARGS = {
    subscriptionId: 'sub-paid-1',
    subscriptionStatus: 'active',
    source: 'mp-webhook'
} as const;

beforeEach(() => {
    vi.clearAllMocks();
    reconcileCommerceMock.mockResolvedValue(undefined);
    syncCacheMock.mockResolvedValue(undefined);
    winBackMock.mockResolvedValue({
        republished: 1,
        failed: 0,
        clearedStale: 0,
        pending: 0
    });
});

describe('reconcileSubscriptionLinkedEntities drives all three effects (HOS-1181)', () => {
    it('calls the commerce half with the subscription id, the NEW status and the source', async () => {
        // The status is the one input the commerce half DOES trust: its
        // visibility is derived from the subscription that just moved.
        await reconcileSubscriptionLinkedEntities({ ...CALL_ARGS });

        expect(reconcileCommerceMock).toHaveBeenCalledOnce();
        expect(reconcileCommerceMock).toHaveBeenCalledWith({ ...CALL_ARGS });
    });

    it('calls the accommodation cache half with the subscription id and source', async () => {
        await reconcileSubscriptionLinkedEntities({ ...CALL_ARGS });

        expect(syncCacheMock).toHaveBeenCalledOnce();
        expect(syncCacheMock).toHaveBeenCalledWith({
            subscriptionId: CALL_ARGS.subscriptionId,
            source: CALL_ARGS.source
        });
    });

    it('calls the HOS-1181 win-back republish half with the subscription id and source', async () => {
        // The win-back deliberately receives NO status: it re-derives the
        // owner's subscription itself, exactly like the cache half.
        await reconcileSubscriptionLinkedEntities({ ...CALL_ARGS });

        expect(winBackMock).toHaveBeenCalledOnce();
        expect(winBackMock).toHaveBeenCalledWith({
            subscriptionId: CALL_ARGS.subscriptionId,
            source: CALL_ARGS.source
        });
    });

    it('runs all three on ONE bridge call — no effect is behind a second entry point', async () => {
        await reconcileSubscriptionLinkedEntities({ ...CALL_ARGS });

        expect(reconcileCommerceMock).toHaveBeenCalledOnce();
        expect(syncCacheMock).toHaveBeenCalledOnce();
        expect(winBackMock).toHaveBeenCalledOnce();
    });
});
