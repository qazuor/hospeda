/**
 * HOS-1001 — orphan-payment queue table rendering.
 *
 * The queue existed with no reader at all: `billing_orphan_payments` had a
 * writer, triage columns, and nothing anywhere that could show a row to a
 * person. Three claims of the reader are guarded here, all of which fail
 * SILENTLY if broken:
 *
 * 1. The header count is `unresolvedTotal`, NOT the number of rows on screen.
 *    The list is filtered and paged; the incident count must not be, or an
 *    operator narrows the view to one flow and an open incident stops being
 *    counted without ever being resolved.
 * 2. `livemode` is rendered per row. A sandbox test charge and a genuine
 *    stranded charge are otherwise the same row, and "did real money move" is
 *    the first thing a triage decision needs.
 * 3. An already-triaged row offers no resolve button. The API refuses to close
 *    a closed row (409); a button that produces a guaranteed error is worse
 *    than no button.
 *
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrphanQueueTable } from '../OrphanQueueTable';
import type { OrphanQueueItem } from '../types';

// The GLOBAL stub in `test/setup.tsx` defines `tPlural: (key, _count) => key`,
// which DISCARDS the count — under it, claim 3 below ("the header count is the
// unfiltered total") passes whichever number the component hands over, and the
// test asserts nothing. Overridden here so the count reaches the assertion.
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        tPlural: (key: string, count: number) => `${key}:${count}`,
        locale: 'es'
    })
}));

/** A real-money charge whose ledger write failed — the HOS-1001 case. */
const LEDGER_WRITE_FAILED: OrphanQueueItem = {
    id: '11111111-1111-4111-8111-111111111111',
    provider: 'mercadopago',
    providerPaymentId: '175261062381',
    flow: 'addon-purchase',
    reason: 'ledger-write-failed',
    subscriptionId: '22222222-2222-4222-8222-222222222222',
    customerId: '33333333-3333-4333-8333-333333333333',
    amountInCents: 500_000,
    currency: 'ARS',
    livemode: true,
    observedStatus: null,
    source: 'addon-checkout',
    status: 'unresolved',
    resolutionNote: null,
    resolvedById: null,
    resolvedAt: null,
    metadata: { ledgerWriteError: 'billing_payments insert failed' },
    detectedAt: new Date('2026-09-01T10:00:00Z')
};

/** A sandbox charge — same shape, and it must not read as real money. */
const SANDBOX_ROW: OrphanQueueItem = {
    ...LEDGER_WRITE_FAILED,
    id: '44444444-4444-4444-8444-444444444444',
    providerPaymentId: 'sandbox-payment-1',
    livemode: false
};

/** A row somebody already triaged. */
const ALREADY_RESOLVED: OrphanQueueItem = {
    ...LEDGER_WRITE_FAILED,
    id: '55555555-5555-4555-8555-555555555555',
    providerPaymentId: 'settled-payment-1',
    status: 'resolved',
    resolutionNote: 'Backfilled through the rescue tool.',
    resolvedById: '66666666-6666-4666-8666-666666666666',
    resolvedAt: new Date('2026-09-02T08:00:00Z')
};

const RESOLVE_BUTTON_KEY = 'admin-billing.reconciliation.queue.resolveButton';
const LIVEMODE_REAL_KEY = 'admin-billing.reconciliation.queue.livemodeReal';
const LIVEMODE_SANDBOX_KEY = 'admin-billing.reconciliation.queue.livemodeSandbox';

function renderQueue(items: OrphanQueueItem[], unresolvedTotal = items.length) {
    const onResolve = vi.fn();
    const result = render(
        <OrphanQueueTable
            items={items}
            isLoading={false}
            isError={false}
            unresolvedTotal={unresolvedTotal}
            onResolve={onResolve}
        />
    );
    return { ...result, onResolve };
}

describe('OrphanQueueTable — rows render with what triage needs', () => {
    it('renders a queued payment by its provider payment id', () => {
        renderQueue([LEDGER_WRITE_FAILED]);

        expect(screen.getByText('175261062381')).toBeInTheDocument();
        expect(
            screen.getByText('admin-billing.reconciliation.queue.flows.addonPurchase')
        ).toBeInTheDocument();
        expect(
            screen.getByText('admin-billing.reconciliation.queue.reasons.ledgerWriteFailed')
        ).toBeInTheDocument();
    });

    it('renders every queued row, not just the first', () => {
        renderQueue([LEDGER_WRITE_FAILED, SANDBOX_ROW]);

        expect(screen.getByText('175261062381')).toBeInTheDocument();
        expect(screen.getByText('sandbox-payment-1')).toBeInTheDocument();
    });

    it('renders the empty state when the queue has no rows', () => {
        renderQueue([], 0);

        expect(
            screen.getByText('admin-billing.reconciliation.queue.emptyTitle')
        ).toBeInTheDocument();
    });
});

describe('OrphanQueueTable — livemode is visible per row', () => {
    it('marks a real-money charge as real', () => {
        renderQueue([LEDGER_WRITE_FAILED]);

        expect(screen.getByText(LIVEMODE_REAL_KEY)).toBeInTheDocument();
        expect(screen.queryByText(LIVEMODE_SANDBOX_KEY)).not.toBeInTheDocument();
    });

    it('marks a sandbox charge as sandbox', () => {
        renderQueue([SANDBOX_ROW]);

        expect(screen.getByText(LIVEMODE_SANDBOX_KEY)).toBeInTheDocument();
        expect(screen.queryByText(LIVEMODE_REAL_KEY)).not.toBeInTheDocument();
    });

    it('keeps the two apart when both are on screen together', () => {
        // The whole point of the column: mixing them is the state in which a
        // stranded production charge gets waved off as a test.
        renderQueue([LEDGER_WRITE_FAILED, SANDBOX_ROW]);

        expect(screen.getByText(LIVEMODE_REAL_KEY)).toBeInTheDocument();
        expect(screen.getByText(LIVEMODE_SANDBOX_KEY)).toBeInTheDocument();
    });
});

describe('OrphanQueueTable — the header count ignores the filter', () => {
    it('reports the unfiltered unresolved total, not the rows on screen', () => {
        // One row rendered, seven unresolved overall: the header must say SEVEN.
        // The count is asserted explicitly — a header that echoed `items.length`
        // would say one and is the exact regression this guards.
        renderQueue([LEDGER_WRITE_FAILED], 7);

        expect(
            screen.getByText('admin-billing.reconciliation.queue.unresolvedCount:7')
        ).toBeInTheDocument();
        expect(
            screen.queryByText('admin-billing.reconciliation.queue.unresolvedCount:1')
        ).not.toBeInTheDocument();
    });

    it('still reports the unfiltered total when the page shows more rows than it', () => {
        // A `resolved` filter can render rows while nothing is unresolved. The
        // header must then say zero, not two.
        renderQueue([ALREADY_RESOLVED, LEDGER_WRITE_FAILED], 0);

        expect(
            screen.getByText('admin-billing.reconciliation.queue.unresolvedCount:0')
        ).toBeInTheDocument();
    });
});

describe('OrphanQueueTable — only an unresolved row can be resolved', () => {
    it('offers the resolve action on an unresolved row', () => {
        renderQueue([LEDGER_WRITE_FAILED]);

        expect(screen.getByText(RESOLVE_BUTTON_KEY)).toBeInTheDocument();
    });

    it('shows the recorded note instead of a button on a triaged row', () => {
        renderQueue([ALREADY_RESOLVED], 0);

        expect(screen.queryByText(RESOLVE_BUTTON_KEY)).not.toBeInTheDocument();
        expect(screen.getByText('Backfilled through the rescue tool.')).toBeInTheDocument();
    });

    it('hands the clicked row back to the caller', () => {
        const { onResolve } = renderQueue([LEDGER_WRITE_FAILED]);

        screen.getByText(RESOLVE_BUTTON_KEY).click();

        expect(onResolve).toHaveBeenCalledOnce();
        expect(onResolve).toHaveBeenCalledWith(LEDGER_WRITE_FAILED);
    });
});
