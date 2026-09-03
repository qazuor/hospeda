/**
 * Unit tests for `isAccommodationDomainSubscription` (HOS-1119) — the gate that
 * keeps a COMMERCE plan upgrade out of the accommodation-only restoration step
 * in `confirmPlanUpgrade`.
 *
 * ## Why this is its own file
 *
 * The behaviour is one boolean, and every one of its three answers is a
 * different kind of silence:
 *
 * - Answering `true` for a commerce subscription runs
 *   `applyUpgradeRestorationsOrWarn` with a gastronomy plan id. That function
 *   restores accommodations and promotions against the caps of the plan it is
 *   handed; a commerce tier declares neither, and every layer beneath resolves
 *   an unknown limit key as *unlimited*. No error, no log — just rows quietly
 *   un-restricted.
 * - Answering `false` for an accommodation subscription silently skips the
 *   restoration a paying host is owed.
 * - Answering `false` because the hydration READ failed turns a transient
 *   database blip into that same skip, for every host at once.
 *
 * `test/routes/webhooks/payment-logic.test.ts` reaches this code only through
 * `confirmPlanUpgrade`, whose `@repo/db` mock serves a fixed SEQUENCE of
 * `select` chains and has no terminal for the un-`limit`ed hydration query. The
 * branch would therefore be exercised there only by way of its own catch — a
 * green test that proves the fallback works and says nothing about the gate.
 *
 * @module test/routes/webhooks/accommodation-domain-subscription
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────
// Module mocks (declared BEFORE the import of the module under test).
// ──────────────────────────────────────────────────────────────────────────

const { mockApiLoggerWarn } = vi.hoisted(() => ({ mockApiLoggerWarn: vi.fn() }));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: mockApiLoggerWarn, error: vi.fn(), debug: vi.fn() }
}));

const { mockHydrate } = vi.hoisted(() => ({ mockHydrate: vi.fn() }));
// `importOriginal` so `subscriptionMatchesDomain` stays the REAL canonical
// predicate. Stubbing it too would leave this file asserting that one mock
// agrees with another, and the accommodation-fails-open rule it encodes is
// precisely half of what is under test here.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual, hydrateSubscriptionProductDomains: mockHydrate };
});

import { isAccommodationDomainSubscription } from '../../../src/routes/webhooks/mercadopago/payment-logic';

const SUB = { id: 'sub-1', customerId: 'cust-1' };

/** Makes the hydration return the subscription stamped with `productDomain`. */
function hydratesTo(productDomain: string | null) {
    mockHydrate.mockResolvedValue([{ ...SUB, productDomain }]);
}

describe('isAccommodationDomainSubscription (HOS-1119)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('is true for an accommodation subscription', async () => {
        hydratesTo('accommodation');
        await expect(isAccommodationDomainSubscription(SUB)).resolves.toBe(true);
    });

    it('is FALSE for each commerce vertical and for partner', async () => {
        // The whole point. A `true` here hands a gastronomy plan id to a
        // function that reads accommodation and promotion caps off it.
        for (const domain of ['gastronomy', 'experience', 'partner']) {
            hydratesTo(domain);
            await expect(isAccommodationDomainSubscription(SUB)).resolves.toBe(false);
        }
    });

    it('is true for a legacy row whose product_domain is NULL', async () => {
        // SPEC-239's accommodation-fails-open rule: the column post-dates most
        // rows, so a null is "accommodation", not "unknown".
        hydratesTo(null);
        await expect(isAccommodationDomainSubscription(SUB)).resolves.toBe(true);
    });

    it('is true when the hydration returns nothing at all', async () => {
        mockHydrate.mockResolvedValue([]);
        await expect(isAccommodationDomainSubscription(SUB)).resolves.toBe(true);
    });

    it('falls open to accommodation — and LOGS — when the hydration read throws', async () => {
        // A database blip must not cost every host their restoration. The log is
        // asserted because a silent fallback here is indistinguishable from a
        // subscription that genuinely is accommodation.
        mockHydrate.mockRejectedValue(new Error('connection reset'));

        await expect(isAccommodationDomainSubscription(SUB)).resolves.toBe(true);
        expect(mockApiLoggerWarn).toHaveBeenCalledWith(
            expect.objectContaining({ subscriptionId: 'sub-1' }),
            expect.stringContaining('hydration failed')
        );
    });

    it('does NOT read the database when the subscription already carries a domain', async () => {
        // Not an optimisation assertion: `hydrateSubscriptionProductDomains`
        // leaves an explicit value untouched by contract, so a caller that
        // already knows the domain must be believed rather than re-queried.
        mockHydrate.mockImplementation(
            async (subs: readonly { productDomain?: string | null }[]) => subs
        );

        await expect(
            isAccommodationDomainSubscription({ ...SUB, productDomain: 'gastronomy' })
        ).resolves.toBe(false);
    });
});
