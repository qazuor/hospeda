/**
 * HOS-765 — the destination field is NEVER filled from the candidate list.
 *
 * This is the most load-bearing test of the rescue screen, and the one whose
 * failure would be silent everywhere else. The tool's non-negotiable rule is
 * "it PROPOSES, a human DECIDES": crediting one person's charge to another
 * person's subscription is the exact failure the whole area exists to prevent,
 * and the one signal that would let software decide — `preapproval.payer_email` —
 * comes back empty from MercadoPago on every real preapproval.
 *
 * A convenience "prefill the top candidate" change would look like a small
 * usability win, would break nothing, and would quietly turn an operator's
 * confirmation click into a rubber stamp on a guess. So the emptiness is
 * asserted directly, with a fixture that carries candidates precisely so the
 * assertion has something to fail against.
 *
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Divergence } from '../types';

vi.mock('@/lib/errors', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/errors')>();
    return { ...actual, translateAdminApiError: () => 'translated-error' };
});

import { ReconcileActionDialog } from '../ReconcileActionDialog';

const mockAddToast = vi.fn();

/**
 * Mutations stubbed as idle — this suite never submits.
 *
 * Built per-prop rather than shared: the two mutations carry DIFFERENT payload
 * and result types, so one stub cast to both would only typecheck by widening
 * away the distinction the component relies on.
 */
type DialogProps = Parameters<typeof ReconcileActionDialog>[0];

const idleForceLink = {
    mutateAsync: vi.fn(),
    isPending: false
} as unknown as DialogProps['forceLinkMutation'];

const idleBackfill = {
    mutateAsync: vi.fn(),
    isPending: false
} as unknown as DialogProps['backfillMutation'];

const CANDIDATE_SUBSCRIPTION_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_SUBSCRIPTION_ID = '22222222-2222-4222-8222-222222222222';

/**
 * An orphan preapproval carrying TWO candidates, one of them a strong match.
 *
 * The strong match is the point: a fixture with zero candidates would let the
 * assertion pass for the wrong reason (nothing to prefill from), so it would
 * stay green even if the component were changed to prefill.
 */
const ORPHAN_WITH_CANDIDATES: Divergence = {
    kind: 'orphan-preapproval',
    preapprovalId: 'f6d89f718c1d4e2287a9aa0e5da209bb',
    mpStatus: 'authorized',
    reason: 'Hospeda Basic',
    amountInCents: 1_800_000,
    currency: 'ARS',
    createdAt: new Date('2026-08-25T10:00:00Z'),
    nextPaymentDate: new Date('2026-09-24T10:00:00Z'),
    externalReference: null,
    preapprovalPlanId: '87e4dae690bb447183995806c19d2db4',
    payerId: '123',
    payerEmail: null,
    payerEmailFromPayment: 'real@example.com',
    sourcePaymentId: '175261062381',
    candidates: [
        {
            localSubscriptionId: CANDIDATE_SUBSCRIPTION_ID,
            localSubscriptionStatus: 'abandoned',
            customerId: '33333333-3333-4333-8333-333333333333',
            customerEmail: 'real@example.com',
            customerDisplayName: 'Real Person',
            pendingCheckoutId: '44444444-4444-4444-8444-444444444444',
            pendingCheckoutPayerEmail: 'real@example.com',
            createdAt: new Date('2026-08-25T09:00:00Z'),
            matchedOn: ['payer-email', 'mp-plan-id']
        },
        {
            localSubscriptionId: OTHER_SUBSCRIPTION_ID,
            localSubscriptionStatus: 'pending_provider',
            customerId: '55555555-5555-4555-8555-555555555555',
            customerEmail: 'someone.else@example.com',
            customerDisplayName: 'Someone Else',
            pendingCheckoutId: null,
            pendingCheckoutPayerEmail: null,
            createdAt: new Date('2026-08-25T08:00:00Z'),
            matchedOn: ['mp-plan-id']
        }
    ]
};

function renderDialog(overrides: { prefillLocalSubscriptionId?: string | null } = {}) {
    return render(
        <ReconcileActionDialog
            divergence={ORPHAN_WITH_CANDIDATES}
            action="force-link"
            open={true}
            onOpenChange={vi.fn()}
            forceLinkMutation={idleForceLink}
            backfillMutation={idleBackfill}
            addToast={mockAddToast}
            {...overrides}
        />
    );
}

/** The destination input, found by its label's `htmlFor` id. */
function destinationInput(): HTMLInputElement {
    return screen.getByLabelText(
        /admin-billing\.reconciliation\.actionDialog\.localSubscriptionIdLabel/
    ) as HTMLInputElement;
}

describe('ReconcileActionDialog — never auto-fills the destination', () => {
    it('opens with an EMPTY destination even though the divergence has candidates', () => {
        renderDialog();

        // Instrument check first: if the fixture lost its candidates, the real
        // assertion below would pass for a reason that has nothing to do with
        // the behaviour under test.
        expect(ORPHAN_WITH_CANDIDATES.candidates.length).toBeGreaterThan(0);

        expect(destinationInput().value).toBe('');
    });

    it('does not fall back to the highest-ranked candidate', () => {
        renderDialog();

        const value = destinationInput().value;
        expect(value).not.toBe(CANDIDATE_SUBSCRIPTION_ID);
        expect(value).not.toBe(OTHER_SUBSCRIPTION_ID);
    });

    it('accepts a destination only from an EXPLICIT operator choice', () => {
        // `prefillLocalSubscriptionId` is the one channel that can put a value in
        // the field, and it is set by the operator clicking "use this" on a
        // candidate row — never derived from the candidate list itself.
        renderDialog({ prefillLocalSubscriptionId: CANDIDATE_SUBSCRIPTION_ID });

        expect(destinationInput().value).toBe(CANDIDATE_SUBSCRIPTION_ID);
    });
});

describe('ReconcileActionDialog — confirm gating', () => {
    /** The confirm button, which is the submit button of the dialog's form. */
    function confirmButton(): HTMLButtonElement {
        return screen.getByRole('button', {
            name: /admin-billing\.reconciliation\.actionDialog\.forceLinkConfirmButton/
        }) as HTMLButtonElement;
    }

    function reasonField(): HTMLTextAreaElement {
        return screen.getByLabelText(
            /admin-billing\.reconciliation\.actionDialog\.reasonLabel/
        ) as HTMLTextAreaElement;
    }

    it('is disabled on open, with both fields empty', () => {
        renderDialog();
        expect(confirmButton()).toBeDisabled();
    });

    it('stays disabled with a valid destination but a reason under 10 characters', () => {
        // The minimum is not decoration: the reason is the only part of the audit
        // record a future reader cannot reconstruct from the ids. The ids say WHAT
        // was bound; nothing but this says why a human decided these two things
        // were the same person.
        renderDialog({ prefillLocalSubscriptionId: CANDIDATE_SUBSCRIPTION_ID });

        fireEvent.change(reasonField(), { target: { value: 'short' } });

        expect(confirmButton()).toBeDisabled();
    });

    it('stays disabled with a valid reason but a destination that is not a uuid', () => {
        renderDialog({ prefillLocalSubscriptionId: 'not-a-uuid' });

        fireEvent.change(reasonField(), {
            target: { value: 'verified the payer email against the linked payment' }
        });

        expect(confirmButton()).toBeDisabled();
    });

    it('enables only once BOTH a uuid destination and a long-enough reason are present', () => {
        renderDialog({ prefillLocalSubscriptionId: CANDIDATE_SUBSCRIPTION_ID });

        fireEvent.change(reasonField(), {
            target: { value: 'verified the payer email against the linked payment' }
        });

        expect(confirmButton()).not.toBeDisabled();
    });
});
