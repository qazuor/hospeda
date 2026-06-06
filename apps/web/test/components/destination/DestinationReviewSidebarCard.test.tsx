/**
 * @file DestinationReviewSidebarCard.test.tsx
 * @description Unit tests for DestinationReviewSidebarCard.client.tsx.
 * Uses @testing-library/react — the component is a React island.
 *
 * Coverage:
 * - Renders the sidebar card with the CTA button (card + inline variants)
 * - Clicking the CTA opens the dialog
 * - Submit is disabled until all 18 dimensions are rated
 * - Rating all 5 category rows (propagation) enables the submit button
 * - Category rating propagates to every dimension in the category
 * - Expanding a category allows overriding individual dimensions
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

type CardProps = Parameters<typeof DestinationReviewSidebarCard>[0];

function renderCard(overrides: Partial<CardProps> = {}) {
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

/** Rate everything by clicking star 5 on each visible star row.
 *  With categories collapsed (default) this clicks the 5 category rows,
 *  which propagate the value to all 18 dimensions. */
function rateAllDimensions() {
    // All star buttons have aria-label "<label>: <star>".
    // We click every button whose aria-label ends with ": 5".
    const fiveStarButtons = screen
        .getAllByRole('radio')
        .filter((btn) => btn.getAttribute('aria-label')?.endsWith(': 5'));
    for (const btn of fiveStarButtons) {
        fireEvent.click(btn);
    }
}

/** Expand a collapsed category block by clicking its toggle button. */
function expandCategory(label: RegExp) {
    const toggle = screen.getByRole('button', { name: label });
    fireEvent.click(toggle);
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

describe('DestinationReviewSidebarCard — collapsible categories', () => {
    beforeEach(() => {
        setupDialogMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders the 5 category rows collapsed by default (no dimension rows visible)', () => {
        renderCard();
        openDialog();
        // Category star rows are visible…
        expect(
            screen.getByRole('radiogroup', { name: /naturaleza y paisaje/i })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('radiogroup', { name: /experiencia y seguridad/i })
        ).toBeInTheDocument();
        // …but individual dimension rows are not (collapsed).
        expect(screen.queryByRole('radiogroup', { name: /^paisaje$/i })).not.toBeInTheDocument();
    });

    it('rating a category propagates the value to all its dimensions', () => {
        renderCard();
        openDialog();
        const catStar4 = screen.getByRole('radio', { name: /naturaleza y paisaje: 4/i });
        fireEvent.click(catStar4);
        expandCategory(/naturaleza y paisaje/i);
        // All 5 dimensions of the category now show value 4.
        for (const dim of [/^paisaje: 4$/i, /^playas: 4$/i, /^espacios verdes: 4$/i]) {
            expect(screen.getByRole('radio', { name: dim })).toHaveAttribute(
                'aria-checked',
                'true'
            );
        }
    });

    it('expanding a category allows overriding one dimension; header shows the rounded average', () => {
        renderCard();
        openDialog();
        fireEvent.click(screen.getByRole('radio', { name: /naturaleza y paisaje: 4/i }));
        expandCategory(/naturaleza y paisaje/i);
        fireEvent.click(screen.getByRole('radio', { name: /^paisaje: 5$/i }));
        // The overridden dimension holds its own value…
        expect(screen.getByRole('radio', { name: /^paisaje: 5$/i })).toHaveAttribute(
            'aria-checked',
            'true'
        );
        // …a sibling keeps the category value…
        expect(screen.getByRole('radio', { name: /^playas: 4$/i })).toHaveAttribute(
            'aria-checked',
            'true'
        );
        // …and the header shows the rounded average: (5+4+4+4+4)/5 = 4.2 → 4.
        expect(screen.getByRole('radio', { name: /^naturaleza y paisaje: 4$/i })).toHaveAttribute(
            'aria-checked',
            'true'
        );
    });

    it('header average only counts rated dimensions (partial rating)', () => {
        renderCard();
        openDialog();
        expandCategory(/naturaleza y paisaje/i);
        // Rate a single dimension: the header average reflects it (5/1 = 5).
        fireEvent.click(screen.getByRole('radio', { name: /^paisaje: 5$/i }));
        expect(screen.getByRole('radio', { name: /^naturaleza y paisaje: 5$/i })).toHaveAttribute(
            'aria-checked',
            'true'
        );
    });

    it('rating all 5 categories enables submit (propagates to all 18 dims)', () => {
        renderCard();
        openDialog();
        rateAllDimensions();
        expect(screen.getByRole('button', { name: /enviar reseña/i })).not.toBeDisabled();
    });

    it('shows the rated count per category in the toggle (0/5 → 5/5)', () => {
        renderCard();
        openDialog();
        expect(
            screen.getByRole('button', { name: /naturaleza y paisaje 0\/5/i })
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('radio', { name: /naturaleza y paisaje: 3/i }));
        expect(
            screen.getByRole('button', { name: /naturaleza y paisaje 5\/5/i })
        ).toBeInTheDocument();
    });

    it('submits individual values after a per-dimension override', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({})
        } as Response);
        global.fetch = fetchMock;
        renderCard();
        openDialog();
        rateAllDimensions(); // all categories → 5
        expandCategory(/naturaleza y paisaje/i);
        fireEvent.click(screen.getByRole('radio', { name: /^paisaje: 3$/i }));
        const form = document.querySelector('form');
        if (form) fireEvent.submit(form);
        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalled();
        });
        const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
        expect(body.rating.landscape).toBe(3);
        expect(body.rating.beaches).toBe(5);
        expect(body.rating.safety).toBe(5);
    });
});

describe('DestinationReviewSidebarCard — inline variant', () => {
    it('renders only the CTA button (no card title) in inline variant', () => {
        renderCard({ variant: 'inline' });
        expect(screen.getByRole('button', { name: /dejar reseña/i })).toBeInTheDocument();
        expect(screen.queryByText(/tu opinión/i)).not.toBeInTheDocument();
    });

    it('inline CTA opens the dialog', () => {
        setupDialogMocks();
        renderCard({ variant: 'inline' });
        openDialog();
        expect(screen.getByRole('heading', { name: /escribir reseña/i })).toBeInTheDocument();
        vi.restoreAllMocks();
    });
});
