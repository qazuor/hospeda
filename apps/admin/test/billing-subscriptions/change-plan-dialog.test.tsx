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

function makeSubscription(planSlug: string): Subscription {
    return {
        id: 'sub-1',
        userId: 'user-1',
        userName: 'Test Host',
        userEmail: 'host@local.test',
        planSlug,
        status: 'active',
        startDate: '2026-01-01',
        currentPeriodEnd: '2026-02-01',
        monthlyAmount: 15000,
        cancelAtPeriodEnd: false
    };
}

function renderDialog(planSlug: string) {
    return render(
        <ChangePlanDialog
            subscription={makeSubscription(planSlug)}
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
