/**
 * @file BenefitUsagesPanel.test.tsx
 * @description Tests for the host's benefit-usage screen (HOS-376 T-046).
 *
 * The behaviours pinned here are the ones that break silently:
 *
 *  - The two lists mean different things. A row the HOST declared waits on the
 *    provider, so it belongs in the history and never among the actions he is
 *    asked to take.
 *  - Rejecting goes through a confirmation that SAYS it is reversible, and the
 *    undo action on a rejected row is what makes that sentence true. Undo is
 *    offered only where it works — a rejection made by the provider is not the
 *    host's to reverse, and a button for it would answer 404.
 *  - Nothing is written before the dialog is confirmed. A reject that fired on
 *    the first click would be the one destructive action on the page happening
 *    without confirmation.
 *  - Every transition re-reads both lists, because confirming moves a row across
 *    them and rejecting can trip the provider's suspension threshold.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockListUsages, mockListPending, mockConfirm, mockReject, mockUndo, mockGetMyReview } =
    vi.hoisted(() => ({
        mockListUsages: vi.fn(),
        mockListPending: vi.fn(),
        mockConfirm: vi.fn(),
        mockReject: vi.fn(),
        mockUndo: vi.fn(),
        mockGetMyReview: vi.fn()
    }));

vi.mock('@/lib/api/endpoints-protected', () => ({
    hostTradesApi: {
        listUsages: (...args: unknown[]) => mockListUsages(...args),
        listPendingUsages: (...args: unknown[]) => mockListPending(...args),
        confirmUsage: (...args: unknown[]) => mockConfirm(...args),
        rejectUsage: (...args: unknown[]) => mockReject(...args),
        undoUsageRejection: (...args: unknown[]) => mockUndo(...args),
        // The review dialog reads this back on open to decide between
        // publishing and editing, so the panel's mock has to answer it.
        getMyReview: (...args: unknown[]) => mockGetMyReview(...args)
    }
}));

import { BenefitUsagesPanel } from '../../../../src/components/host/host-trades/BenefitUsagesPanel.client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROVIDER = {
    id: '22222222-2222-4222-8222-222222222222',
    slug: 'plomero-centro',
    name: 'Plomero Centro',
    category: 'PLOMERIA' as const
};

const OTHER_PROVIDER = {
    ...PROVIDER,
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Cerrajería Sur'
};

type PanelUsage = Parameters<typeof BenefitUsagesPanel>[0]['initialPending'][number];

function makeUsage(overrides: Partial<PanelUsage> = {}): PanelUsage {
    return {
        id: 'usage-1',
        hostTradeId: PROVIDER.id,
        hostUserId: '11111111-1111-4111-8111-111111111111',
        declaredBy: 'PROVIDER',
        declaredById: '33333333-3333-4333-8333-333333333333',
        creationChannel: 'LINKED_SELECTOR',
        status: 'PENDING',
        servicedAt: '2026-08-01',
        note: null,
        expiresAt: '2026-09-01T00:00:00.000Z',
        confirmedAt: null,
        rejectedAt: null,
        rejectionNote: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        hostTrade: PROVIDER,
        hasReview: false,
        ...overrides
    } as PanelUsage;
}

function renderPanel({
    pending = [makeUsage()],
    history = [makeUsage()],
    total = 1,
    loadFailed = false
}: {
    pending?: PanelUsage[];
    history?: PanelUsage[];
    total?: number;
    loadFailed?: boolean;
} = {}) {
    return render(
        <BenefitUsagesPanel
            initialHistory={history}
            initialHistoryTotal={total}
            initialPending={pending}
            loadFailed={loadFailed}
            locale="es"
        />
    );
}

/** The inbox section, by its heading. */
function inbox() {
    return screen.getByRole('region', { name: /esperan tu confirmación/i });
}

/** The history section, by its heading. */
function history() {
    return screen.getByRole('region', { name: /historial/i });
}

beforeEach(() => {
    mockListUsages.mockReset();
    mockListPending.mockReset();
    mockConfirm.mockReset();
    mockReject.mockReset();
    mockUndo.mockReset();

    mockListUsages.mockResolvedValue({
        ok: true,
        data: { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }
    });
    mockListPending.mockResolvedValue({
        ok: true,
        data: { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }
    });
    mockConfirm.mockResolvedValue({
        ok: true,
        data: { usage: makeUsage({ status: 'CONFIRMED' }) }
    });
    mockReject.mockResolvedValue({ ok: true, data: { usage: makeUsage({ status: 'REJECTED' }) } });
    mockUndo.mockResolvedValue({ ok: true, data: { usage: makeUsage() } });
    mockGetMyReview.mockReset();
    mockGetMyReview.mockResolvedValue({ ok: true, data: { review: null } });
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('BenefitUsagesPanel — what each list shows', () => {
    it('renders the server-provided rows without fetching anything first', () => {
        renderPanel();

        expect(screen.getAllByText('Plomero Centro').length).toBeGreaterThan(0);
        // The page already read both lists; hydrating must not re-read them.
        expect(mockListPending).not.toHaveBeenCalled();
        expect(mockListUsages).not.toHaveBeenCalled();
    });

    it('names the provider on the row rather than showing its id', () => {
        renderPanel({ pending: [makeUsage()], history: [] });

        expect(within(inbox()).getByText('Plomero Centro')).toBeInTheDocument();
        expect(within(inbox()).queryByText(PROVIDER.id)).not.toBeInTheDocument();
    });

    it('falls back to a neutral label when the provider did not resolve', () => {
        renderPanel({ pending: [makeUsage({ hostTrade: null })], history: [] });

        expect(within(inbox()).getByText(/proveedor del directorio/i)).toBeInTheDocument();
    });

    it('offers Confirm and Reject only in the inbox, never in the history', () => {
        renderPanel({ pending: [makeUsage()], history: [makeUsage({ id: 'usage-2' })] });

        expect(within(inbox()).getByRole('button', { name: /confirmar/i })).toBeInTheDocument();
        expect(
            within(history()).queryByRole('button', { name: /confirmar/i })
        ).not.toBeInTheDocument();
    });

    it('shows the empty state when nothing awaits the host', () => {
        renderPanel({ pending: [], history: [makeUsage()] });

        expect(within(inbox()).getByText(/no tenés usos pendientes/i)).toBeInTheDocument();
    });

    it('badges each history row with its state', () => {
        renderPanel({
            pending: [],
            history: [
                makeUsage({ id: 'a', status: 'CONFIRMED' }),
                makeUsage({ id: 'b', status: 'EXPIRED', hostTrade: OTHER_PROVIDER })
            ],
            total: 2
        });

        expect(within(history()).getByText('Confirmado')).toBeInTheDocument();
        expect(within(history()).getByText('Vencido')).toBeInTheDocument();
    });

    it('surfaces a failed server read as an alert', () => {
        renderPanel({ pending: [], history: [], total: 0, loadFailed: true });

        expect(screen.getByRole('alert')).toHaveTextContent(/no pudimos cargar/i);
    });
});

// ---------------------------------------------------------------------------
// Confirming
// ---------------------------------------------------------------------------

describe('BenefitUsagesPanel — confirming', () => {
    it('confirms the row and re-reads both lists', async () => {
        const user = userEvent.setup();
        renderPanel();

        await user.click(within(inbox()).getByRole('button', { name: /confirmar/i }));

        await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith({ id: 'usage-1' }));
        // Confirming moves the row from one list to the other, so patching state
        // locally would drift from what the server now holds.
        await waitFor(() => expect(mockListPending).toHaveBeenCalledTimes(1));
        expect(mockListUsages).toHaveBeenCalledTimes(1);
    });

    it('shows the domain refusal and leaves the row in place', async () => {
        mockConfirm.mockResolvedValue({
            ok: false,
            error: { status: 404, code: 'NOT_FOUND', message: 'gone' }
        });
        const user = userEvent.setup();
        renderPanel();

        await user.click(within(inbox()).getByRole('button', { name: /confirmar/i }));

        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(mockListPending).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Rejecting
// ---------------------------------------------------------------------------

describe('BenefitUsagesPanel — rejecting', () => {
    it('asks for confirmation before rejecting anything', async () => {
        const user = userEvent.setup();
        renderPanel();

        await user.click(within(inbox()).getByRole('button', { name: /^rechazar$/i }));

        expect(await screen.findByText(/¿rechazar este uso\?/i)).toBeInTheDocument();
        // The decisive half: the first click wrote nothing.
        expect(mockReject).not.toHaveBeenCalled();
    });

    it('says the rejection is reversible, which the undo action makes true', async () => {
        const user = userEvent.setup();
        renderPanel();

        await user.click(within(inbox()).getByRole('button', { name: /^rechazar$/i }));

        expect(await screen.findByText(/reversible/i)).toBeInTheDocument();
    });

    it('rejects with the note once confirmed', async () => {
        const user = userEvent.setup();
        renderPanel();

        await user.click(within(inbox()).getByRole('button', { name: /^rechazar$/i }));
        await user.type(await screen.findByLabelText(/contale por qué/i), '  no vino nunca  ');
        await user.click(screen.getByRole('button', { name: /sí, rechazar/i }));

        await waitFor(() =>
            expect(mockReject).toHaveBeenCalledWith({ id: 'usage-1', note: 'no vino nunca' })
        );
    });

    it('omits a whitespace-only note rather than sending an empty string', async () => {
        const user = userEvent.setup();
        renderPanel();

        await user.click(within(inbox()).getByRole('button', { name: /^rechazar$/i }));
        await user.type(await screen.findByLabelText(/contale por qué/i), '   ');
        await user.click(screen.getByRole('button', { name: /sí, rechazar/i }));

        await waitFor(() => expect(mockReject).toHaveBeenCalledTimes(1));
        expect(mockReject.mock.calls[0][0].note).toBeUndefined();
    });

    it('writes nothing when the dialog is dismissed', async () => {
        const user = userEvent.setup();
        renderPanel();

        await user.click(within(inbox()).getByRole('button', { name: /^rechazar$/i }));
        await user.click(await screen.findByRole('button', { name: /volver/i }));

        await waitFor(() => expect(screen.queryByText(/¿rechazar este uso\?/i)).toBeNull());
        expect(mockReject).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Undoing
// ---------------------------------------------------------------------------

describe('BenefitUsagesPanel — undoing a rejection', () => {
    it('offers undo on a provider-declared row the host rejected', async () => {
        const user = userEvent.setup();
        renderPanel({
            pending: [],
            history: [makeUsage({ status: 'REJECTED', declaredBy: 'PROVIDER' })]
        });

        await user.click(within(history()).getByRole('button', { name: /deshacer/i }));

        await waitFor(() => expect(mockUndo).toHaveBeenCalledWith({ id: 'usage-1' }));
    });

    it('does NOT offer undo when the provider was the one who rejected', () => {
        // The host declared it, so the provider refused it. Only the account
        // that rejected may reverse it — the button would answer 404.
        renderPanel({
            pending: [],
            history: [makeUsage({ status: 'REJECTED', declaredBy: 'HOST' })]
        });

        expect(within(history()).queryByRole('button', { name: /deshacer/i })).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// The review call-to-action (T-048 wiring)
// ---------------------------------------------------------------------------

describe('BenefitUsagesPanel — the review call-to-action', () => {
    it('offers reviewing from a CONFIRMED row', async () => {
        const user = userEvent.setup();
        renderPanel({ pending: [], history: [makeUsage({ status: 'CONFIRMED' })] });

        await user.click(within(history()).getByRole('button', { name: /valorar/i }));

        expect(await screen.findByText(/puntuación general/i)).toBeInTheDocument();
    });

    it.each([
        'PENDING',
        'REJECTED',
        'EXPIRED'
    ] as const)('offers nothing to review on a %s row', (status) => {
        // The gate is the spec's hardest precondition: no confirmed usage,
        // no review. Offering the button anyway would send the host to a
        // dialog whose only possible answer is 403 NO_CONFIRMED_USAGE.
        renderPanel({ pending: [], history: [makeUsage({ status })] });

        expect(within(history()).queryByRole('button', { name: /valorar/i })).toBeNull();
    });

    it('offers EDITING, not rating, once the provider was already reviewed', async () => {
        // The dialog decides create-vs-edit from its own read-back, so a fixed
        // "Valorar" label announced the wrong action: the host clicked to write
        // a review and got the editor for one that already existed.
        renderPanel({
            pending: [],
            history: [makeUsage({ status: 'CONFIRMED', hasReview: true })]
        });

        expect(
            within(history()).getByRole('button', { name: /editar tu valoración/i })
        ).toBeInTheDocument();
        expect(within(history()).queryByRole('button', { name: /^valorar a/i })).toBeNull();
    });

    it('offers rating when the provider has not been reviewed yet', () => {
        renderPanel({
            pending: [],
            history: [makeUsage({ status: 'CONFIRMED', hasReview: false })]
        });

        expect(within(history()).getByRole('button', { name: /^valorar a/i })).toBeInTheDocument();
        expect(
            within(history()).queryByRole('button', { name: /editar tu valoración/i })
        ).toBeNull();
    });

    it('does not offer it on a CONFIRMED row whose provider did not resolve', () => {
        // The dialog needs the provider's id to post to and its name to show.
        renderPanel({
            pending: [],
            history: [makeUsage({ status: 'CONFIRMED', hostTrade: null })]
        });

        expect(within(history()).queryByRole('button', { name: /valorar/i })).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// History filter
// ---------------------------------------------------------------------------

describe('BenefitUsagesPanel — the history filter', () => {
    it('asks the API for one state and marks the chip as pressed', async () => {
        const user = userEvent.setup();
        renderPanel({ pending: [], history: [makeUsage()] });

        await user.click(within(history()).getByRole('button', { name: /^confirmados$/i }));

        await waitFor(() =>
            expect(mockListUsages).toHaveBeenCalledWith({
                status: 'CONFIRMED',
                page: 1,
                pageSize: 20
            })
        );
        expect(within(history()).getByRole('button', { name: /^confirmados$/i })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
    });

    it('asks for every state when returning to "Todos"', async () => {
        const user = userEvent.setup();
        renderPanel({ pending: [], history: [makeUsage()] });

        await user.click(within(history()).getByRole('button', { name: /^rechazados$/i }));
        await waitFor(() => expect(mockListUsages).toHaveBeenCalledTimes(1));

        await user.click(within(history()).getByRole('button', { name: /^todos$/i }));

        await waitFor(() => expect(mockListUsages).toHaveBeenCalledTimes(2));
        expect(mockListUsages.mock.calls[1][0].status).toBeUndefined();
    });

    it('does not spend a request re-selecting the active filter', async () => {
        const user = userEvent.setup();
        renderPanel({ pending: [], history: [makeUsage()] });

        await user.click(within(history()).getByRole('button', { name: /^todos$/i }));

        expect(mockListUsages).not.toHaveBeenCalled();
    });

    it('offers "load more" when the record is longer than the page', () => {
        renderPanel({ pending: [], history: [makeUsage()], total: 5 });

        expect(screen.getByRole('button', { name: /ver más/i })).toBeInTheDocument();
    });

    it('hides "load more" once every row is on screen', () => {
        // The complementary case of the one above, in a fresh mount: the props
        // are server-rendered once per page load, so this is a different visit
        // rather than a re-render of the same one.
        renderPanel({ pending: [], history: [makeUsage()], total: 1 });

        expect(screen.queryByRole('button', { name: /ver más/i })).toBeNull();
    });

    it('appends the next page rather than replacing what is on screen', async () => {
        const user = userEvent.setup();
        mockListUsages.mockResolvedValue({
            ok: true,
            data: {
                items: [makeUsage({ id: 'usage-2', hostTrade: OTHER_PROVIDER })],
                pagination: { page: 2, pageSize: 20, total: 2, totalPages: 1 }
            }
        });
        renderPanel({ pending: [], history: [makeUsage()], total: 2 });

        await user.click(screen.getByRole('button', { name: /ver más/i }));

        expect(await within(history()).findByText('Cerrajería Sur')).toBeInTheDocument();
        expect(within(history()).getByText('Plomero Centro')).toBeInTheDocument();
    });
});
