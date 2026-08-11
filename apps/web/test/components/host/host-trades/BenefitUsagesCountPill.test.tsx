/**
 * @file BenefitUsagesCountPill.test.tsx
 * @description Tests for the pending-usages nav badge (HOS-376 T-047).
 *
 * The spec's rule for this badge is a single sentence — IT TURNS OFF WHEN THE
 * USAGE IS RESOLVED, NOT WHEN THE PAGE IS SEEN — and every test here exists to
 * hold one half of it:
 *
 *  - Resolving one drops the count, because the panel announces the change and
 *    the badge re-reads.
 *  - Merely mounting (i.e. the host looking at the page) marks nothing as seen.
 *    A "seen" mechanism would make the pending row vanish from the badge while
 *    still waiting on an answer, which is the one failure this feature cannot
 *    afford: the whole point is that somebody is waiting.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCountPending } = vi.hoisted(() => ({ mockCountPending: vi.fn() }));

vi.mock('@/lib/api/endpoints-protected', () => ({
    hostTradesApi: {
        countPendingUsages: (...args: unknown[]) => mockCountPending(...args)
    }
}));

import {
    BENEFIT_USAGES_UPDATED_EVENT,
    BenefitUsagesCountPill
} from '../../../../src/components/host/host-trades/BenefitUsagesCountPill.client';

function renderPill() {
    return render(<BenefitUsagesCountPill locale="es" />);
}

beforeEach(() => {
    mockCountPending.mockReset();
    mockCountPending.mockResolvedValue({ ok: true, data: { count: 3 } });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('BenefitUsagesCountPill — what it shows', () => {
    it('shows the pending count once it has read it', async () => {
        renderPill();

        expect(await screen.findByText('3')).toBeInTheDocument();
    });

    it('renders nothing at all when nothing is pending', async () => {
        mockCountPending.mockResolvedValue({ ok: true, data: { count: 0 } });
        const { container } = renderPill();

        await waitFor(() => expect(mockCountPending).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when the count cannot be read', async () => {
        // A badge that rendered an error, or a zero, would either shout at a
        // host who has nothing pending or lie to one who does.
        mockCountPending.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'boom' }
        });
        const { container } = renderPill();

        await waitFor(() => expect(mockCountPending).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it('states the number in words for assistive technology, not just as a glyph', async () => {
        renderPill();

        const pill = await screen.findByRole('status');
        expect(pill).toHaveAttribute('aria-label', expect.stringContaining('3'));
        expect(pill.getAttribute('aria-label')?.length).toBeGreaterThan(1);
    });

    it('reads as singular when exactly one usage is pending', async () => {
        // The label is the only place the badge speaks: the glyph is a bare
        // numeral, so "1 usos esperan tu confirmación" is what a screen-reader
        // user actually hears. Asserting the count is present is not enough —
        // that is how the un-pluralised string reached staging.
        mockCountPending.mockResolvedValue({ ok: true, data: { count: 1 } });
        renderPill();

        const pill = await screen.findByRole('status');
        expect(pill).toHaveAttribute('aria-label', '1 uso espera tu confirmación');
    });

    it('reads as plural for more than one', async () => {
        renderPill();

        const pill = await screen.findByRole('status');
        expect(pill).toHaveAttribute('aria-label', '3 usos esperan tu confirmación');
    });

    it('caps the glyph at 99+ while keeping the real number in the label', async () => {
        mockCountPending.mockResolvedValue({ ok: true, data: { count: 128 } });
        renderPill();

        expect(await screen.findByText('99+')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveAttribute(
            'aria-label',
            expect.stringContaining('128')
        );
    });
});

describe('BenefitUsagesCountPill — it clears on RESOLVE, not on view', () => {
    it('re-reads and disappears when a usage is resolved elsewhere on the page', async () => {
        mockCountPending.mockResolvedValueOnce({ ok: true, data: { count: 1 } });
        renderPill();
        expect(await screen.findByText('1')).toBeInTheDocument();

        mockCountPending.mockResolvedValue({ ok: true, data: { count: 0 } });
        window.dispatchEvent(new CustomEvent(BENEFIT_USAGES_UPDATED_EVENT));

        await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    });

    it('marks nothing as seen — mounting is not resolving', async () => {
        renderPill();

        await waitFor(() => expect(mockCountPending).toHaveBeenCalledTimes(1));
        // Reading the count is the ONLY call the badge makes. Anything else here
        // would be a "seen" mechanism, and a pending usage that disappears from
        // the badge because someone glanced at it is still waiting for an answer.
        expect(mockCountPending).toHaveBeenCalledWith();
    });

    it('stops listening once unmounted, so a later resolve cannot re-read', async () => {
        const { unmount } = renderPill();
        await waitFor(() => expect(mockCountPending).toHaveBeenCalledTimes(1));

        unmount();
        window.dispatchEvent(new CustomEvent(BENEFIT_USAGES_UPDATED_EVENT));

        await waitFor(() => expect(mockCountPending).toHaveBeenCalledTimes(1));
    });
});
