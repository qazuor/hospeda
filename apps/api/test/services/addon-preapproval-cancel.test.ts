/**
 * `closeAddonPreapproval` — the gate every add-on cancellation path goes
 * through (HOS-847 PR 6).
 *
 * ## What is mocked, and what that leaves the assertions worth
 *
 * Only the canonical primitive `hardCancelPreapprovalBestEffort` is replaced —
 * its own behaviour against MercadoPago is covered by its own suites. What is
 * under test here is the TRANSLATION from that primitive's three best-effort
 * outcomes into this module's two-valued, fail-closed verdict, plus the
 * correlation payload it hands Sentry. Both are pure decisions over the
 * primitive's return value, so a stub is the whole world they can see.
 *
 * The case worth naming: `skipped / adapter-unavailable` is NOT a success. The
 * primitive treats it as a clean no-op because for a `comp` subscription there
 * genuinely is nothing to cancel. For a row that HAS an `mp_subscription_id` it
 * means "we never reached MercadoPago", which is indistinguishable, from the
 * customer's card's point of view, from the provider refusing.
 *
 * @module test/services/addon-preapproval-cancel
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHardCancel, mockLoggerError, mockLoggerInfo } = vi.hoisted(() => ({
    mockHardCancel: vi.fn(),
    mockLoggerError: vi.fn(),
    mockLoggerInfo: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: mockLoggerInfo,
        warn: vi.fn(),
        error: mockLoggerError
    }
}));

vi.mock('../../src/services/billing/preapproval-hard-cancel', () => ({
    hardCancelPreapprovalBestEffort: mockHardCancel
}));

import { closeAddonPreapproval } from '../../src/services/addon-preapproval-cancel.js';

/** A recurring purchase: it has a preapproval of its own. */
const RECURRING = {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    addonSlug: 'extra-accommodations-20',
    mpSubscriptionId: 'preapproval-abc123'
} as const;

/** A one-time purchase: nothing was ever created at MercadoPago. */
const ONE_TIME = {
    id: 'a1b2c3d4-0000-4000-8000-000000000002',
    addonSlug: 'visibility-boost-7d',
    mpSubscriptionId: null
} as const;

describe('closeAddonPreapproval', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('closes without calling MercadoPago when the purchase has no preapproval', async () => {
        const outcome = await closeAddonPreapproval({
            purchase: ONE_TIME,
            source: 'user-cancel'
        });

        expect(outcome).toEqual({ closed: true, kind: 'no-preapproval' });
        // Every one-time add-on takes this branch. Calling the provider with a
        // null id would be a wasted round-trip on the platform's most common
        // cancellation by far.
        expect(mockHardCancel).not.toHaveBeenCalled();
    });

    it('closes when MercadoPago accepts the irreversible cancel', async () => {
        mockHardCancel.mockResolvedValue({ kind: 'cancelled' });

        const outcome = await closeAddonPreapproval({
            purchase: RECURRING,
            source: 'user-cancel'
        });

        expect(outcome).toEqual({ closed: true, kind: 'cancelled' });
        expect(mockLoggerError).not.toHaveBeenCalled();
    });

    it('REFUSES when MercadoPago rejects the cancel', async () => {
        mockHardCancel.mockResolvedValue({ kind: 'failed', error: 'MP 500 upstream' });

        const outcome = await closeAddonPreapproval({
            purchase: RECURRING,
            source: 'user-cancel'
        });

        expect(outcome.closed).toBe(false);
        expect(outcome).toEqual({ closed: false, reason: 'MP 500 upstream' });
    });

    it('REFUSES when the payment adapter was unavailable — a skip is not a success', async () => {
        mockHardCancel.mockResolvedValue({ kind: 'skipped', reason: 'adapter-unavailable' });

        const outcome = await closeAddonPreapproval({
            purchase: RECURRING,
            source: 'plan-cancellation'
        });

        expect(outcome.closed).toBe(false);
        // The reason has to say WHY, because "skipped" reads like success in a
        // log line and this is the one skip that is not.
        expect(outcome).toEqual({
            closed: false,
            reason: 'MercadoPago was not reached (adapter-unavailable)'
        });
    });

    it('captures the adapter-unavailable refusal to Sentry, and does not double-report a failure', async () => {
        mockHardCancel.mockResolvedValue({ kind: 'skipped', reason: 'adapter-unavailable' });
        await closeAddonPreapproval({ purchase: RECURRING, source: 'expiry' });

        // `{ capture: true }` is NOT implicit on apiLogger.error — without it
        // this refusal never reaches Sentry at all.
        expect(mockLoggerError).toHaveBeenCalledWith(
            expect.objectContaining({ addonPurchaseId: RECURRING.id }),
            expect.any(String),
            { capture: true }
        );

        mockLoggerError.mockClear();
        mockHardCancel.mockResolvedValue({ kind: 'failed', error: 'boom' });
        await closeAddonPreapproval({ purchase: RECURRING, source: 'expiry' });

        // The primitive already captured this one under the
        // `addon_hard_cancel_preapproval` tag; capturing again would file the
        // same incident twice.
        expect(mockLoggerError).toHaveBeenCalledWith(expect.any(Object), expect.any(String), {
            capture: false
        });
    });

    it('hands the primitive the purchase id and names it in the Sentry extra', async () => {
        mockHardCancel.mockResolvedValue({ kind: 'cancelled' });

        await closeAddonPreapproval({
            purchase: RECURRING,
            source: 'admin-subscription-cancel'
        });

        expect(mockHardCancel).toHaveBeenCalledWith({
            // `subscriptionId` is the primitive's correlation field; an add-on
            // has no subscription of its own, so it carries the purchase id —
            // which is why `extra` has to say so.
            subscriptionId: RECURRING.id,
            mpSubscriptionId: RECURRING.mpSubscriptionId,
            billing: undefined,
            source: 'addon-cancellation',
            extra: {
                addonPurchaseId: RECURRING.id,
                addonSlug: RECURRING.addonSlug,
                addonCancelSource: 'admin-subscription-cancel'
            }
        });
    });
});
