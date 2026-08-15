/**
 * Tests for the change-plan dialog's empty states (HOS-331).
 *
 * `getChangePlanOptions` returning `[]` has two distinct causes, and the dialog
 * has to say which one it is:
 *
 *  - every sibling plan in the category is switched off (`complex-*` today), or
 *  - the subscription's own plan is not in `ALL_PLANS` at all
 *    (`commerce-listing`, `partner-listing`, `owner-test-daily` are excluded on
 *    purpose), so there is nothing to compute a change against.
 *
 * Both used to render an empty `<select>` and a dead Confirm button with no
 * explanation, which reads as a broken dialog.
 *
 * `test/setup.tsx` mocks `useTranslations` to return the key verbatim, so the
 * assertions below match on translation keys rather than copy.
 *
 * @module test/billing-subscriptions/change-plan-dialog.test
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChangePlanDialog } from '@/features/billing-subscriptions/ChangePlanDialog';
import type { Subscription } from '@/features/billing-subscriptions/types';

const KEY_NO_DESTINATIONS = 'admin-billing.subscriptions.changePlanDialog.noDestinationPlans';
const KEY_NOT_IN_CATALOG = 'admin-billing.subscriptions.changePlanDialog.planNotInCatalog';

function makeSubscription(
    planSlug: string,
    productDomain = 'accommodation',
    priceInCents: number | null = 1500000
): Subscription {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        status: 'active',
        rawStatus: 'active',
        user: {
            id: '22222222-2222-4222-8222-222222222222',
            displayName: 'Test Host',
            email: 'host@local.test'
        },
        plan: {
            id: '33333333-3333-4333-8333-333333333333',
            slug: planSlug,
            displayName: planSlug,
            monthlyPriceInCents: priceInCents,
            productDomain
        },
        recurringAmountInCents: priceInCents,
        billingInterval: 'month',
        currentPeriodStart: '2026-01-01T00:00:00.000Z',
        currentPeriodEnd: '2026-02-01T00:00:00.000Z',
        trialEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        productDomain
    };
}

function renderDialog(planSlug: string, priceInCents: number | null = 1500000) {
    return render(
        <ChangePlanDialog
            subscription={makeSubscription(planSlug, 'accommodation', priceInCents)}
            isOpen={true}
            onClose={vi.fn()}
            onConfirm={vi.fn()}
        />
    );
}

describe('ChangePlanDialog — empty states (HOS-331)', () => {
    it('explains that the category has no active destinations for a retired plan', () => {
        // All three complex tiers are isActive: false, so a complex
        // subscription has nowhere to move.
        renderDialog('complex-basico');
        expect(screen.getByText(KEY_NO_DESTINATIONS)).toBeInTheDocument();
        expect(screen.queryByText(KEY_NOT_IN_CATALOG)).not.toBeInTheDocument();
    });

    it('says the plan is off-catalog when the subscription is on a plan ALL_PLANS excludes', () => {
        // `commerce-listing` is deliberately kept out of ALL_PLANS, so
        // `getPlanBySlug` returns undefined and the category is unknowable.
        renderDialog('commerce-listing');
        expect(screen.getByText(KEY_NOT_IN_CATALOG)).toBeInTheDocument();
        expect(screen.queryByText(KEY_NO_DESTINATIONS)).not.toBeInTheDocument();
    });

    it('shows the slug instead of a blank name over a fake $0 for an off-catalog plan', () => {
        // `formatArs(undefined ?? 0)` rendered "$ 0,00 /mes" next to an empty
        // name for a subscription the customer is actually paying for. With an
        // unknown price the dialog must say nothing rather than invent a zero.
        renderDialog('commerce-listing', null);
        expect(screen.getByText('commerce-listing')).toBeInTheDocument();
        // Anchored so it cannot match the "0,00" tail of a real amount such as
        // "15.000,00 ARS" — the unanchored version passed for the wrong reason.
        expect(screen.queryByText(/(?<![\d.])0,00/)).not.toBeInTheDocument();
    });

    it('shows neither message when destinations exist', () => {
        renderDialog('owner-basico');
        expect(screen.queryByText(KEY_NO_DESTINATIONS)).not.toBeInTheDocument();
        expect(screen.queryByText(KEY_NOT_IN_CATALOG)).not.toBeInTheDocument();
    });

    it('offers the active siblings as options for a normal plan', () => {
        renderDialog('owner-basico');
        const options = screen.getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
        expect(options).toContain('owner-pro');
        expect(options).toContain('owner-premium');
        expect(options).not.toContain('owner-basico');
    });
});
