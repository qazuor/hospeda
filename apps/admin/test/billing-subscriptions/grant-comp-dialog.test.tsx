/**
 * Tests for GrantCompDialog (HOS-1314).
 *
 * Covers what the pre-existing screen entirely lacked: a plan selector
 * grouped by vertical (so an operator cannot mistake a gastronomy plan for
 * an accommodation one — the issue's own T-1 requirement), the permanent
 * grant confirming with the right payload, and the two directions a "which
 * verticals may be comped" guard can fail:
 *   - too NARROW: a real, active, eligible plan silently excluded from the
 *     selector (nobody can comp it, even though the backend would accept it);
 *   - too WIDE: an inactive or soft-deleted plan offered anyway (an operator
 *     could comp a customer onto a plan nobody can otherwise buy).
 *
 * `test/setup.tsx` mocks `useTranslations` to return the key verbatim, so
 * assertions match on translation keys rather than copy.
 *
 * @module test/billing-subscriptions/grant-comp-dialog.test
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ParsedPlanRecord } from '@/features/billing-plans/hooks';
import { GrantCompDialog } from '@/features/billing-subscriptions/GrantCompDialog';
import type { Subscription } from '@/features/billing-subscriptions/types';

const KEY_TITLE = 'admin-billing.subscriptions.compDialog.title';
const KEY_NO_PLANS = 'admin-billing.subscriptions.compDialog.noPlans';
const KEY_CONFIRM = 'admin-billing.subscriptions.compDialog.confirmButton';
const KEY_DOMAIN_GASTRONOMY = 'admin-billing.subscriptions.productDomainLabels.gastronomy';
const KEY_DOMAIN_ACCOMMODATION = 'admin-billing.subscriptions.productDomainLabels.accommodation';

function makePlan(overrides: Partial<ParsedPlanRecord> = {}): ParsedPlanRecord {
    return {
        id: '33333333-3333-4333-8333-333333333333',
        slug: 'owner-basico',
        name: 'Básico',
        description: 'Plan básico',
        category: 'owner',
        isActive: true,
        isDefault: false,
        sortOrder: 1,
        hasTrial: false,
        trialDays: 0,
        monthlyPriceArs: 500000,
        annualPriceArs: null,
        monthlyPriceUsdRef: 5,
        entitlements: [],
        limits: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        isDeleted: false,
        activeSubscriptionCount: 0,
        publicListing: 'listed',
        productDomain: 'accommodation',
        ...overrides
    };
}

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        customerId: '55555555-5555-4555-8555-555555555555',
        status: 'active',
        rawStatus: 'active',
        user: {
            id: '22222222-2222-4222-8222-222222222222',
            displayName: 'Julieta Ferreyra',
            email: 'julieta@local.test'
        },
        plan: null,
        recurringAmountInCents: null,
        billingInterval: 'month',
        currentPeriodStart: '2026-01-01T00:00:00.000Z',
        currentPeriodEnd: '2026-02-01T00:00:00.000Z',
        trialEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        productDomain: 'accommodation',
        ...overrides
    };
}

describe('GrantCompDialog (HOS-1314)', () => {
    it('renders the title and names the subscriber', () => {
        render(
            <GrantCompDialog
                subscription={makeSubscription()}
                plans={[makePlan()]}
                isOpen={true}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
            />
        );

        expect(screen.getByText(KEY_TITLE)).toBeInTheDocument();
        expect(screen.getByText(/Julieta Ferreyra/)).toBeInTheDocument();
    });

    it('shows the empty-state message and a disabled confirm button when there are no eligible plans', () => {
        render(
            <GrantCompDialog
                subscription={makeSubscription()}
                plans={[]}
                isOpen={true}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
            />
        );

        expect(screen.getByText(KEY_NO_PLANS)).toBeInTheDocument();
        expect(screen.getByText(KEY_CONFIRM).closest('button')).toBeDisabled();
    });

    it('groups plans by vertical, with the domain visible as an optgroup label (T-1)', () => {
        render(
            <GrantCompDialog
                subscription={makeSubscription()}
                plans={[
                    makePlan({ id: 'plan-accom', productDomain: 'accommodation' }),
                    makePlan({
                        id: 'plan-gastro',
                        productDomain: 'gastronomy',
                        slug: 'gastronomy-pro'
                    })
                ]}
                isOpen={true}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
            />
        );

        // `<optgroup label>` is an attribute, not text content — getByText
        // cannot see it. The Dialog also portals its content OUTSIDE the
        // render() container, so the query goes against `document.body`
        // (what `screen`'s own queries already search) rather than the
        // container — a `container.querySelector` here finds nothing at all.
        const groupLabels = [...document.body.querySelectorAll('optgroup')].map((g) =>
            g.getAttribute('label')
        );
        expect(groupLabels).toContain(KEY_DOMAIN_ACCOMMODATION);
        expect(groupLabels).toContain(KEY_DOMAIN_GASTRONOMY);

        const options = screen.getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
        expect(options).toContain('plan-accom');
        expect(options).toContain('plan-gastro');
    });

    // Too NARROW direction: an eligible plan silently excluded from the
    // selector because it belongs to a vertical the grouping doesn't expect.
    it('does not drop a plan whose vertical is not in the preferred DOMAIN_ORDER list', () => {
        render(
            <GrantCompDialog
                subscription={makeSubscription()}
                plans={[
                    // Cast: `productDomain` is a closed union today, so every
                    // real member already sits in DOMAIN_ORDER. This simulates
                    // a future vertical the enum has not grown yet, to prove
                    // the fallback branch does not silently drop it.
                    makePlan({
                        id: 'plan-weird',
                        productDomain: 'some-future-vertical' as ParsedPlanRecord['productDomain']
                    })
                ]}
                isOpen={true}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
            />
        );

        const options = screen.getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
        expect(options).toContain('plan-weird');
    });

    // Too WIDE direction: an inactive or soft-deleted plan must never be
    // offered — comping a customer onto a plan nobody can otherwise buy.
    it('excludes inactive and soft-deleted plans from the selector', () => {
        render(
            <GrantCompDialog
                subscription={makeSubscription()}
                plans={[
                    makePlan({ id: 'plan-active', isActive: true, isDeleted: false }),
                    makePlan({ id: 'plan-inactive', isActive: false, isDeleted: false }),
                    makePlan({ id: 'plan-deleted', isActive: true, isDeleted: true })
                ]}
                isOpen={true}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
            />
        );

        const options = screen.getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
        expect(options).toContain('plan-active');
        expect(options).not.toContain('plan-inactive');
        expect(options).not.toContain('plan-deleted');
    });

    it('confirms with the selected planId and defaults to a monthly interval', () => {
        const onConfirm = vi.fn();
        render(
            <GrantCompDialog
                subscription={makeSubscription()}
                plans={[makePlan({ id: 'plan-accom' })]}
                isOpen={true}
                onClose={vi.fn()}
                onConfirm={onConfirm}
            />
        );

        fireEvent.change(
            screen.getByLabelText('admin-billing.subscriptions.compDialog.planLabel'),
            {
                target: { value: 'plan-accom' }
            }
        );
        fireEvent.click(screen.getByText(KEY_CONFIRM));

        expect(onConfirm).toHaveBeenCalledWith({ planId: 'plan-accom', interval: 'monthly' });
    });

    it('offers an interval choice only when the selected plan has an annual price', () => {
        render(
            <GrantCompDialog
                subscription={makeSubscription()}
                plans={[makePlan({ id: 'plan-no-annual', annualPriceArs: null })]}
                isOpen={true}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
            />
        );

        fireEvent.change(
            screen.getByLabelText('admin-billing.subscriptions.compDialog.planLabel'),
            {
                target: { value: 'plan-no-annual' }
            }
        );

        expect(
            screen.queryByText('admin-billing.subscriptions.compDialog.intervalLabel')
        ).not.toBeInTheDocument();
    });

    it('shows the permanent-grant warning', () => {
        render(
            <GrantCompDialog
                subscription={makeSubscription()}
                plans={[makePlan()]}
                isOpen={true}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
            />
        );

        expect(
            screen.getByText('admin-billing.subscriptions.compDialog.permanentWarning')
        ).toBeInTheDocument();
    });
});
