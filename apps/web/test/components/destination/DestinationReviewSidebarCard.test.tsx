/**
 * @file DestinationReviewSidebarCard.test.tsx
 * @description Unit tests for DestinationReviewSidebarCard.client.tsx.
 * Uses @testing-library/react — the component is a React island.
 *
 * Coverage:
 * - Renders the sidebar card with the CTA button
 * - Clicking the CTA opens the dialog
 * - Submit is disabled until all 18 dimensions are rated
 * - Rating all 18 dimensions enables the submit button
 * - Successful submit shows the pendingNotice text and schedules a reload
 * - 409 ALREADY_EXISTS response shows alreadyReviewed text
 * - Network error shows the NETWORK_ERROR message
 * - ESC / close button closes the dialog
 */

import { DestinationReviewSidebarCard } from '@/components/destination/DestinationReviewSidebarCard.client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/api-errors', () => ({
    translateApiError: ({
        fallback
    }: {
        error: unknown;
        locale: string;
        fallback: string;
    }) => fallback
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('@/components/destination/DestinationReviewSidebarCard.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PROPS = {
    destinationId: 'dest-123',
    destinationName: 'Colón',
    locale: 'es' as const,
    apiUrl: 'http://localhost:3001'
};

function renderCard(overrides: Partial<typeof DEFAULT_PROPS> = {}) {
    return render(
        <DestinationReviewSidebarCard
            {...DEFAULT_PROPS}
            {...overrides}
        />
    );
}

/** Mock showModal so it also sets the `open` attribute on the element,
 *  which is necessary for JSDOM to expose dialog children in the a11y tree. */
function setupDialogMocks() {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute('open');
    });
}

/** Open the review dialog by clicking the CTA button. */
function openDialog() {
    const cta = screen.getByRole('button', { name: /dejar reseña/i });
    fireEvent.click(cta);
}

/** Click star 5 for all 18 rating dimensions. */
function rateAllDimensions() {
    // All star buttons have aria-label "<dimension label>: <star>".
    // We click every button whose aria-label ends with ": 5".
    const fiveStarButtons = screen
        .getAllByRole('radio')
        .filter((btn) => btn.getAttribute('aria-label')?.endsWith(': 5'));
    for (const btn of fiveStarButtons) {
        fireEvent.click(btn);
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DestinationReviewSidebarCard — render', () => {
    it('renders the sidebar card with the CTA button', () => {
        renderCard();
        expect(screen.getByRole('button', { name: /dejar reseña/i })).toBeInTheDocument();
    });

    it('renders the card title', () => {
        renderCard();
        expect(screen.getByText(/tu opinión/i)).toBeInTheDocument();
    });
});

describe('DestinationReviewSidebarCard — dialog open/close', () => {
    beforeEach(() => {
        setupDialogMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('clicking the CTA opens the dialog (showModal is called)', () => {
        renderCard();
        openDialog();
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    });

    it('renders the dialog heading after opening', () => {
        renderCard();
        openDialog();
        expect(screen.getByRole('heading', { name: /escribir reseña/i })).toBeInTheDocument();
    });

    it('closes the dialog when the close button is clicked', () => {
        renderCard();
        openDialog();
        const closeBtn = screen.getByRole('button', { name: /cerrar/i });
        fireEvent.click(closeBtn);
        expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
    });

    it('closes the dialog when ESC is pressed on the dialog element', () => {
        renderCard();
        openDialog();
        const dialog = document.querySelector('dialog');
        expect(dialog).toBeTruthy();
        if (dialog) fireEvent.keyDown(dialog, { key: 'Escape' });
        expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
    });
});

describe('DestinationReviewSidebarCard — submit disabled state', () => {
    beforeEach(() => {
        setupDialogMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('submit button is disabled when no dimensions are rated', () => {
        renderCard();
        openDialog();
        const submitBtn = screen.getByRole('button', { name: /enviar reseña/i });
        expect(submitBtn).toBeDisabled();
    });

    it('shows the ratingRequired hint when not all dimensions are rated', () => {
        renderCard();
        openDialog();
        expect(screen.getByText(/debes seleccionar una calificación/i)).toBeInTheDocument();
    });

    it('submit button is enabled after rating all 18 dimensions', () => {
        renderCard();
        openDialog();
        rateAllDimensions();
        const submitBtn = screen.getByRole('button', { name: /enviar reseña/i });
        expect(submitBtn).not.toBeDisabled();
    });

    it('hides the ratingRequired hint after rating all 18 dimensions', () => {
        renderCard();
        openDialog();
        rateAllDimensions();
        expect(screen.queryByText(/debes seleccionar una calificación/i)).not.toBeInTheDocument();
    });
});

describe('DestinationReviewSidebarCard — successful submit', () => {
    beforeEach(() => {
        setupDialogMocks();
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({})
        } as Response);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows the pendingNotice message after a successful submit', async () => {
        renderCard();
        openDialog();
        rateAllDimensions();
        const form = document.querySelector('form');
        if (form) fireEvent.submit(form);
        await waitFor(
            () => {
                expect(screen.getByText(/pendiente de aprobación/i)).toBeInTheDocument();
            },
            { timeout: 3000 }
        );
    });

    it('schedules a page reload after success (reload called after 1400ms)', async () => {
        const reloadMock = vi.fn();
        Object.defineProperty(window, 'location', {
            value: { reload: reloadMock },
            writable: true,
            configurable: true
        });
        renderCard();
        openDialog();
        rateAllDimensions();
        const form = document.querySelector('form');
        if (form) fireEvent.submit(form);
        // Wait for the success state to appear (fetch resolves).
        await waitFor(
            () => {
                expect(screen.getByText(/pendiente de aprobación/i)).toBeInTheDocument();
            },
            { timeout: 3000 }
        );
        // The reload is scheduled with window.setTimeout(fn, 1400).
        // With real timers we just wait long enough.
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        expect(reloadMock).toHaveBeenCalled();
    });
});

describe('DestinationReviewSidebarCard — 409 ALREADY_EXISTS', () => {
    beforeEach(() => {
        setupDialogMocks();
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ error: { code: 'ALREADY_EXISTS', message: 'Duplicate' } })
        } as Response);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows the alreadyReviewed message on a 409 ALREADY_EXISTS response', async () => {
        renderCard();
        openDialog();
        rateAllDimensions();
        const form = document.querySelector('form');
        if (form) fireEvent.submit(form);
        await waitFor(() => {
            expect(
                screen.getByText(/ya enviaste una reseña para este destino/i)
            ).toBeInTheDocument();
        });
    });

    it('error has role=alert for screen reader announcement', async () => {
        renderCard();
        openDialog();
        rateAllDimensions();
        const form = document.querySelector('form');
        if (form) fireEvent.submit(form);
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });
});

describe('DestinationReviewSidebarCard — network error', () => {
    beforeEach(() => {
        setupDialogMocks();
        global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows the NETWORK_ERROR message when fetch throws', async () => {
        renderCard();
        openDialog();
        rateAllDimensions();
        const form = document.querySelector('form');
        if (form) fireEvent.submit(form);
        await waitFor(() => {
            expect(screen.getByText(/no pudimos conectar con el servidor/i)).toBeInTheDocument();
        });
    });
});
