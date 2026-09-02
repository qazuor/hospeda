/**
 * @file CommerceListingActions.payer-email.test.tsx
 * @description Regression coverage for HOS-1008: the commerce owner
 * self-checkout was the one flow with no payer-email confirmation screen.
 *
 * With `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` on, the `payer_email` we
 * declare when creating the preapproval is BINDING — only whoever uses or
 * types that exact address can authorize the charge, and MercadoPago never
 * shows the user which one it expects. A commerce owner whose MercadoPago
 * account differs from their signup email simply could not pay, with no way
 * to find out why.
 *
 * Two gates gate the dialog, and this file pins BOTH, because getting either
 * one wrong is invisible in a browser:
 *
 * 1. `ownPreapprovalEnabled` — with the flag off (production today) the hosted
 *    share-link checkout discards `payer_email` entirely, so the dialog would
 *    be a pure extra click in a flow that bills.
 * 2. `!hasVerticalSubscription` — with a subscription already held for this
 *    vertical the backend ATTACHES the listing and publishes it synchronously
 *    (HOS-688 §6.8 branch 2). No payment is opened, so asking the owner to
 *    confirm a payer would be asking about a charge that never happens.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceListingActions } from '../../../src/components/commerce/CommerceListingActions.client';

const startOwnerListingCheckoutMock = vi.fn();

vi.mock('../../../src/lib/commerce/owner-listings', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../../src/lib/commerce/owner-listings')>();
    return {
        ...actual,
        startOwnerListingCheckout: (...args: unknown[]) => startOwnerListingCheckoutMock(...args)
    };
});

vi.mock('../../../src/lib/auth-client', () => ({
    useSession: () => ({ data: { user: { email: 'owner@local.test' } }, isPending: false })
}));

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/lib/billing/checkout-pending', () => ({
    storePendingCheckoutSubId: vi.fn()
}));

/** A draft listing that is complete — i.e. the CTA is enabled. */
const COMPLETE_DRAFT = {
    id: '11111111-1111-4111-8111-111111111111',
    vertical: 'gastronomy' as const,
    slug: 'la-parrilla',
    name: 'La Parrilla',
    isPublic: false,
    subscriptionStatus: null,
    completeness: { complete: true, missing: [] as readonly string[] }
};

const DIALOG_CONFIRM = 'Continuar';
const PUBLISH_BUTTON = 'commerce-publish-button';

function renderActions(overrides: {
    ownPreapprovalEnabled?: boolean;
    hasVerticalSubscription?: boolean;
}) {
    render(
        <CommerceListingActions
            // The component's own prop type is narrower than this fixture needs
            // to be; the fields it actually reads are all present.
            listing={COMPLETE_DRAFT as never}
            locale="es"
            hasVerticalSubscription={overrides.hasVerticalSubscription ?? false}
            {...(overrides.ownPreapprovalEnabled === undefined
                ? {}
                : { ownPreapprovalEnabled: overrides.ownPreapprovalEnabled })}
        />
    );
}

beforeEach(() => {
    // jsdom throws "Not implemented: navigation" on both `location.href = …`
    // and `location.reload()`, which the checkout's two success branches do.
    // Left unstubbed those errors are printed but not thrown, so the suite
    // stays green while burying anything real in the same output. `pathname`
    // is included because several helpers in this app read it and the usual
    // one-field stub is a known trap here.
    Object.defineProperty(window, 'location', {
        value: { href: '', pathname: '/', reload: vi.fn() },
        writable: true,
        configurable: true
    });
    startOwnerListingCheckoutMock.mockReset();
    startOwnerListingCheckoutMock.mockResolvedValue({
        ok: true,
        data: {
            checkoutUrl: 'https://mp.example/checkout',
            localSubscriptionId: 'sub-1',
            expiresAt: '2026-09-01T00:00:00.000Z',
            appliedEffect: 'attached'
        }
    });
});

describe('CommerceListingActions — payer-email confirmation (HOS-1008)', () => {
    it('shows the confirmation dialog before checkout when the flag is on', async () => {
        const user = userEvent.setup();
        renderActions({ ownPreapprovalEnabled: true });

        await user.click(screen.getByTestId(PUBLISH_BUTTON));

        expect(screen.getByRole('button', { name: DIALOG_CONFIRM })).toBeInTheDocument();
        // The checkout must NOT have fired yet — the whole point is that the
        // owner sees and can edit the address before the preapproval binds it.
        expect(startOwnerListingCheckoutMock).not.toHaveBeenCalled();
    });

    it('forwards the confirmed email to the checkout', async () => {
        const user = userEvent.setup();
        renderActions({ ownPreapprovalEnabled: true });

        await user.click(screen.getByTestId(PUBLISH_BUTTON));
        await user.click(screen.getByRole('button', { name: DIALOG_CONFIRM }));

        await waitFor(() => {
            expect(startOwnerListingCheckoutMock).toHaveBeenCalledWith(
                expect.objectContaining({ payerEmail: 'owner@local.test' })
            );
        });
    });

    it('with the flag OFF goes straight to checkout and sends no payerEmail', async () => {
        // The regression that matters most: a flag covering the backend while
        // letting the UX through is not a flag. With it off this component
        // must behave exactly as it did before HOS-1008.
        const user = userEvent.setup();
        renderActions({ ownPreapprovalEnabled: false });

        await user.click(screen.getByTestId(PUBLISH_BUTTON));

        await waitFor(() => {
            expect(startOwnerListingCheckoutMock).toHaveBeenCalledTimes(1);
        });
        expect(screen.queryByRole('button', { name: DIALOG_CONFIRM })).toBeNull();

        const call = startOwnerListingCheckoutMock.mock.calls[0]?.[0] as Record<string, unknown>;
        // Asserted as an ABSENT KEY, not as `undefined`: `objectContaining`
        // is blind to a missing field.
        //
        // Scope note: this proves what the COMPONENT passes, not what the
        // helper puts on the wire — `startOwnerListingCheckout` is mocked
        // here, so its body never runs. "No HTTP body is sent" is a separate
        // claim, proved in `test/lib/commerce/start-owner-listing-checkout.test.ts`.
        // A mutation confirmed the gap is real: making the helper always send
        // a body left every test in THIS file green.
        expect(Object.hasOwn(call, 'payerEmail')).toBe(false);
    });

    it('omitting the prop entirely behaves like the flag being off', async () => {
        // Fail-closed default. A page that forgets to pass the prop must get
        // today's behavior, not a step that does nothing.
        const user = userEvent.setup();
        renderActions({});

        await user.click(screen.getByTestId(PUBLISH_BUTTON));

        await waitFor(() => {
            expect(startOwnerListingCheckoutMock).toHaveBeenCalledTimes(1);
        });
        expect(screen.queryByRole('button', { name: DIALOG_CONFIRM })).toBeNull();
    });

    it('skips the dialog when the vertical already has a subscription', async () => {
        // HOS-688 §6.8 branch 2: the backend attaches and publishes
        // synchronously, opening no payment. Asking the owner to confirm a
        // payer here would be asking about a charge that never happens.
        const user = userEvent.setup();
        renderActions({ ownPreapprovalEnabled: true, hasVerticalSubscription: true });

        await user.click(screen.getByTestId(PUBLISH_BUTTON));

        await waitFor(() => {
            expect(startOwnerListingCheckoutMock).toHaveBeenCalledTimes(1);
        });
        expect(screen.queryByRole('button', { name: DIALOG_CONFIRM })).toBeNull();
    });
});
