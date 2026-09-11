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
 * 2. `trialVerdict === 'payment_required'` — the only state that opens a
 *    payment. Under `has_active_sub` the backend ATTACHES the listing and
 *    publishes it synchronously (HOS-688 §6.8 branch 2); under
 *    `trial_available` it grants a local trial and never tells MercadoPago the
 *    subscription exists (HOS-1184). In both cases asking the owner to confirm
 *    a payer would be asking about a charge that never happens.
 *
 *    This gate was `!hasVerticalSubscription` until HOS-1184, which was correct
 *    only while "not already paying" meant "about to pay".
 */

import type { CommerceTrialVerdictKind } from '@repo/schemas';
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
        // `(key, count, params?)` — the real `PluralTranslationFn` takes NO
        // fallback. The old stub here declared one, which would let a call site
        // pass a default string and look correct in this file while the real
        // function treated it as `params` and rendered the raw key.
        tPlural: (key: string, count: number) => `${key} [${count}]`
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
    // HOS-1184: was `hasVerticalSubscription?: boolean`. The dialog now gates on
    // one of three states rather than on "not already paying", because that used
    // to include the trial — and a free publish must not be stopped behind a
    // payment-email screen.
    trialVerdict?: CommerceTrialVerdictKind;
}) {
    render(
        <CommerceListingActions
            // The component's own prop type is narrower than this fixture needs
            // to be; the fields it actually reads are all present.
            listing={COMPLETE_DRAFT as never}
            locale="es"
            trialVerdict={overrides.trialVerdict ?? 'payment_required'}
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
        renderActions({ ownPreapprovalEnabled: true, trialVerdict: 'has_active_sub' });

        await user.click(screen.getByTestId(PUBLISH_BUTTON));

        await waitFor(() => {
            expect(startOwnerListingCheckoutMock).toHaveBeenCalledTimes(1);
        });
        expect(screen.queryByRole('button', { name: DIALOG_CONFIRM })).toBeNull();
    });

    it('skips the dialog when a trial is available (HOS-1184)', async () => {
        // The state this gate did NOT have until HOS-1184, and the one where a
        // stale `!hasVerticalSubscription` would have been worst: the owner is
        // about to publish free for thirty days, and the old condition would
        // have stopped them at a screen asking who is paying.
        const user = userEvent.setup();
        renderActions({ ownPreapprovalEnabled: true, trialVerdict: 'trial_available' });

        await user.click(screen.getByTestId(PUBLISH_BUTTON));

        await waitFor(() => {
            expect(startOwnerListingCheckoutMock).toHaveBeenCalledTimes(1);
        });
        expect(screen.queryByRole('button', { name: DIALOG_CONFIRM })).toBeNull();
    });

    it('reloads instead of redirecting when the publish granted a trial', async () => {
        // `appliedEffect: 'trial'` carries an IN-APP sentinel in `checkoutUrl`,
        // exactly as `'attached'` does. Following it would send an owner who
        // just published for free to the payment-method page — a redirect that
        // does not fail, it just lies about what happened.
        startOwnerListingCheckoutMock.mockResolvedValue({
            ok: true,
            data: {
                checkoutUrl: 'https://hospeda.test/mi-cuenta/pago',
                localSubscriptionId: 'sub-trial-1',
                expiresAt: '2026-10-05T00:00:00.000Z',
                appliedEffect: 'trial'
            }
        });
        const user = userEvent.setup();
        renderActions({ trialVerdict: 'trial_available' });

        await user.click(screen.getByTestId(PUBLISH_BUTTON));

        await waitFor(() => {
            expect(window.location.reload).toHaveBeenCalledTimes(1);
        });
        expect(window.location.href).toBe('');
    });
});
