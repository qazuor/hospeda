/**
 * @file start-owner-listing-checkout.test.ts
 * @description Covers what `CommerceListingActions.payer-email.test.tsx`
 * structurally cannot (HOS-1008).
 *
 * That file mocks `startOwnerListingCheckout` in order to assert on the
 * ARGUMENTS the component passes it — so the helper's own body never runs
 * there. A mutation proved the gap: making the helper send `body: { payerEmail }`
 * unconditionally (i.e. `{ payerEmail: undefined }` whenever the flag is off)
 * left all five of those tests green.
 *
 * The contract that matters here is not "payerEmail is undefined" but **"no
 * body is sent at all"**: with `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` off,
 * this request must be byte-identical to the pre-HOS-1008 one, and a body of
 * `{}` is not the same request as no body.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startOwnerListingCheckout } from '../../../src/lib/commerce/owner-listings';

const postProtectedMock = vi.fn();

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
        postProtected: (...args: unknown[]) => postProtectedMock(...args),
        getProtected: vi.fn()
    }
}));

beforeEach(() => {
    postProtectedMock.mockReset();
    postProtectedMock.mockResolvedValue({ ok: true, data: {} });
});

/** The single argument object the helper hands to `apiClient.postProtected`. */
function lastCall(): Record<string, unknown> {
    return postProtectedMock.mock.calls[0]?.[0] as Record<string, unknown>;
}

describe('startOwnerListingCheckout — request body (HOS-1008)', () => {
    it('sends NO body key at all when no payer email was confirmed', async () => {
        await startOwnerListingCheckout({
            vertical: 'gastronomy',
            listingId: 'listing-1'
        });

        // `Object.hasOwn`, not `toBeUndefined()`: a present key holding
        // `undefined` serializes to `{}` and is a different request from
        // sending nothing, which is exactly the mutation this test exists
        // to kill.
        expect(Object.hasOwn(lastCall(), 'body')).toBe(false);
    });

    it('sends the confirmed payer email as the body when there is one', async () => {
        await startOwnerListingCheckout({
            vertical: 'experience',
            listingId: 'listing-2',
            payerEmail: 'owner@local.test'
        });

        expect(lastCall().body).toEqual({ payerEmail: 'owner@local.test' });
    });

    it('keeps the per-click idempotency key on both paths', async () => {
        // AC-15: one key per click. Losing it on the new branch would let a
        // double-click open two MercadoPago preapprovals for one listing.
        await startOwnerListingCheckout({
            vertical: 'gastronomy',
            listingId: 'listing-3',
            payerEmail: 'owner@local.test'
        });

        const headers = lastCall().headers as Record<string, string>;
        expect(headers['X-Idempotency-Key']).toEqual(expect.any(String));
        expect(headers['X-Idempotency-Key'].length).toBeGreaterThan(0);
    });

    it('targets the vertical-scoped start-subscription path', async () => {
        await startOwnerListingCheckout({
            vertical: 'experience',
            listingId: 'listing-4'
        });

        expect(lastCall().path).toContain('/experience/listing-4/start-subscription');
    });
});
