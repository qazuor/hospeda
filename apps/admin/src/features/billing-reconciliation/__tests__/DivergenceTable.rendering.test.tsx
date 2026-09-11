/**
 * HOS-765 — divergence table and truncation banner rendering.
 *
 * Two claims worth guarding, both of which fail SILENTLY if broken:
 *
 * 1. A `truncated` report says so. When the MercadoPago sweep hits its page
 *    ceiling, `pagination.total` is a FLOOR rather than a count. A report that
 *    presents itself as complete tells the operator "there are no other
 *    divergences" on evidence that only says "we stopped looking" — and the
 *    charge nobody looked for stays unrecorded.
 * 2. A missing payer email reads as "cannot attribute yet", never as an error.
 *    `preapproval.payer_email` comes back EMPTY from MercadoPago on every real
 *    preapproval, so the email worth anything is recovered from a linked
 *    PAYMENT — and a preapproval that has been authorized but never charged
 *    simply has no payment to recover it from. That is a normal state on the
 *    happy path, not a failure, and an operator who reads it as breakage will
 *    distrust a working tool.
 *
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DivergenceTable } from '../DivergenceTable';
import { TruncatedBanner } from '../TruncatedBanner';
import type { Divergence } from '../types';

const NOT_ATTRIBUTABLE_KEY = 'admin-billing.reconciliation.notAttributableYet';

/** An orphan preapproval with NO linked payment — so no recoverable payer email. */
const ORPHAN_WITHOUT_PAYMENT: Divergence = {
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
    // Empty on every real preapproval — measured, and the reason the whole
    // payment-side recovery exists.
    payerEmail: null,
    payerEmailFromPayment: null,
    sourcePaymentId: null,
    candidates: []
};

/** An unrecorded payment, which DOES carry the real payer email. */
const UNRECORDED_PAYMENT: Divergence = {
    kind: 'unrecorded-payment',
    mpPaymentId: '175261062381',
    mpStatus: 'approved',
    mpStatusDetail: 'accredited',
    amountInCents: 750_000,
    currency: 'ARS',
    approvedAt: new Date('2026-08-01T10:00:00Z'),
    createdAt: new Date('2026-08-01T09:59:00Z'),
    payerEmail: 'real.payer@example.com',
    payerId: '456',
    preapprovalId: 'abc123',
    externalReference: null,
    description: 'Hospeda',
    candidates: []
};

function renderTable(divergences: Divergence[]) {
    return render(
        <DivergenceTable
            divergences={divergences}
            isLoading={false}
            isError={false}
            onViewDetails={vi.fn()}
            onReconcile={vi.fn()}
        />
    );
}

describe('TruncatedBanner', () => {
    it('renders the warning when the sweep was truncated', () => {
        render(<TruncatedBanner truncated={true} />);

        expect(
            screen.getByText('admin-billing.reconciliation.truncatedBanner.title')
        ).toBeInTheDocument();
    });

    it('renders NOTHING when the sweep was complete', () => {
        const { container } = render(<TruncatedBanner truncated={false} />);

        // Asserted on the container being empty rather than on a queryBy being
        // null: a typo'd query would also return null and pass, while an empty
        // container can only be produced by the component rendering nothing.
        expect(container).toBeEmptyDOMElement();
    });
});

describe('DivergenceTable — both kinds render', () => {
    it('renders an orphan preapproval by its preapproval id', () => {
        renderTable([ORPHAN_WITHOUT_PAYMENT]);

        expect(screen.getByText('f6d89f718c1d4e2287a9aa0e5da209bb')).toBeInTheDocument();
        expect(
            screen.getByText('admin-billing.reconciliation.kinds.orphanPreapproval')
        ).toBeInTheDocument();
    });

    it('renders an unrecorded payment by its payment id', () => {
        renderTable([UNRECORDED_PAYMENT]);

        expect(screen.getByText('175261062381')).toBeInTheDocument();
        expect(
            screen.getByText('admin-billing.reconciliation.kinds.unrecordedPayment')
        ).toBeInTheDocument();
    });

    it('renders both kinds together in one list', () => {
        // The endpoint reports both sides of the ledger through one call on
        // purpose — they are usually two views of a single incident — so the
        // table must not drop one when the other is present.
        renderTable([ORPHAN_WITHOUT_PAYMENT, UNRECORDED_PAYMENT]);

        expect(screen.getByText('f6d89f718c1d4e2287a9aa0e5da209bb')).toBeInTheDocument();
        expect(screen.getByText('175261062381')).toBeInTheDocument();
    });
});

describe('DivergenceTable — an absent payer email is "not attributable yet"', () => {
    it('shows the not-attributable label when no payment supplied an email', () => {
        renderTable([ORPHAN_WITHOUT_PAYMENT]);

        expect(screen.getByText(NOT_ATTRIBUTABLE_KEY)).toBeInTheDocument();
    });

    it('shows the real email — not the label — when a payment supplied one', () => {
        renderTable([UNRECORDED_PAYMENT]);

        expect(screen.getByText('real.payer@example.com')).toBeInTheDocument();
        expect(screen.queryByText(NOT_ATTRIBUTABLE_KEY)).not.toBeInTheDocument();
    });

    it('prefers the PAYMENT email over the preapproval one on an orphan', () => {
        // The preapproval's own `payer_email` is empty in reality; the column
        // must read `payerEmailFromPayment`. A component that read the wrong
        // field would show "not attributable yet" here even though the email is
        // right there — which is precisely the state that made the pre-HOS-765
        // correlation code blind.
        renderTable([
            {
                ...ORPHAN_WITHOUT_PAYMENT,
                payerEmailFromPayment: 'recovered@example.com',
                sourcePaymentId: '999'
            }
        ]);

        expect(screen.getByText('recovered@example.com')).toBeInTheDocument();
        expect(screen.queryByText(NOT_ATTRIBUTABLE_KEY)).not.toBeInTheDocument();
    });
});
