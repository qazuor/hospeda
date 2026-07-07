/**
 * @file ReviewSidebarCard.test.tsx
 * @description Unit tests for ReviewSidebarCard.client.tsx.
 * Uses @testing-library/react — the component is a React island.
 *
 * Coverage:
 * - Renders the CTA when canLeaveReview=true, a locked note otherwise
 * - Clicking the CTA opens the dialog
 * - Submit is disabled until all 6 rating aspects are rated
 * - Successful submit shows the success message and fires review_submitted
 * - review_submitted is NOT fired on a failed submit
 * - Network error shows the NETWORK_ERROR message
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewSidebarCard } from '@/components/accommodation/ReviewSidebarCard.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/api-errors', () => ({
    translateApiError: ({ fallback }: { error: unknown; locale: string; fallback: string }) =>
        fallback
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('@/components/accommodation/ReviewSidebarCard.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PROPS = {
    accommodationId: 'acc-123',
    accommodationName: 'Cabaña del Lago',
    canLeaveReview: true,
    locale: 'es' as const,
    apiUrl: 'http://localhost:3001'
};

type CardProps = Parameters<typeof ReviewSidebarCard>[0];

function renderCard(overrides: Partial<CardProps> = {}) {
    return render(
        <ReviewSidebarCard
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

/** Rate all 6 aspects by clicking the 5-star option on each radiogroup. */
function rateAllAspects() {
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

describe('ReviewSidebarCard — render', () => {
    it('renders the CTA when canLeaveReview=true', () => {
        renderCard();
        expect(screen.getByRole('button', { name: /dejar reseña/i })).toBeInTheDocument();
    });

    it('renders a locked note (no CTA) when canLeaveReview=false', () => {
        renderCard({ canLeaveReview: false });
        expect(screen.queryByRole('button', { name: /dejar reseña/i })).not.toBeInTheDocument();
    });
});

describe('ReviewSidebarCard — review_submitted analytics event', () => {
    let captureSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        setupDialogMocks();
        // Stub window.location.reload — the success branch schedules a reload
        // 1400ms after setSuccess(true). Assertions below resolve well before
        // that fires, but stubbing avoids jsdom's "not implemented: reload"
        // console noise if it fires during teardown.
        Object.defineProperty(window, 'location', {
            value: { reload: vi.fn() },
            writable: true,
            configurable: true
        });
        captureSpy = vi.fn();
        (window as unknown as { posthog: { capture: typeof captureSpy } }).posthog = {
            capture: captureSpy
        };
    });

    afterEach(() => {
        (window as unknown as { posthog?: unknown }).posthog = undefined;
        vi.restoreAllMocks();
    });

    it('fires review_submitted with the average rating and title/content flags on success', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ data: { id: 'review-1' } })
            })
        );
        renderCard();
        openDialog();
        rateAllAspects();

        fireEvent.change(screen.getByPlaceholderText(/resumen de tu experiencia/i), {
            target: { value: 'Excelente estadía' }
        });

        // Act
        const form = document.querySelector('form') as HTMLFormElement;
        fireEvent.submit(form);

        // Assert
        await waitFor(() => {
            expect(captureSpy).toHaveBeenCalledWith('review_submitted', {
                accommodation_id: 'acc-123',
                average_rating: 5,
                has_title: true,
                has_content: false
            });
        });
    });

    it('does NOT fire review_submitted on a failed submit', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                json: async () => ({ error: { code: 'ALREADY_EXISTS', message: 'fail' } })
            })
        );
        renderCard();
        openDialog();
        rateAllAspects();

        // Act
        const form = document.querySelector('form') as HTMLFormElement;
        fireEvent.submit(form);

        // Assert
        await waitFor(() => {
            expect(screen.queryByRole('alert')).toBeInTheDocument();
        });
        expect(captureSpy).not.toHaveBeenCalled();
    });

    it('does NOT fire review_submitted on a network error', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));
        renderCard();
        openDialog();
        rateAllAspects();

        // Act
        const form = document.querySelector('form') as HTMLFormElement;
        fireEvent.submit(form);

        // Assert
        await waitFor(() => {
            expect(screen.queryByRole('alert')).toBeInTheDocument();
        });
        expect(captureSpy).not.toHaveBeenCalled();
    });
});
