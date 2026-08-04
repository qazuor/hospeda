/**
 * @file ReviewSidebarCard.test.tsx
 * @description Unit tests for ReviewSidebarCard.client.tsx.
 * Uses @testing-library/react — the component is a React island.
 *
 * Since HOS-369 WB0-7 the card resolves its own session and review eligibility
 * instead of receiving them as SSR props, so those two inputs are now MOCKS
 * (`@/lib/auth-cache` and the conversation store) rather than props. The three
 * render states are unchanged; only where they come from moved.
 *
 * Coverage:
 * - Renders the anonymous `children` fallback with no session (the SSR/cached
 *   output), the CTA for an eligible visitor, a locked note otherwise
 * - Clicking the CTA opens the dialog
 * - Submit is disabled until all 6 rating aspects are rated
 * - Successful submit shows the success message and fires review_submitted
 * - review_submitted is NOT fired on a failed submit
 * - Network error shows the NETWORK_ERROR message
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAuthSnapshot } from '../../helpers/auth-session';

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

const trackEventSpy = vi.fn();

vi.mock('@/lib/analytics/posthog-client', () => ({
    trackEvent: (...args: unknown[]) => trackEventSpy(...args)
}));

vi.mock('@/components/accommodation/ReviewSidebarCard.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

const mockReadCachedAuthMe = vi.fn();

vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe: () => mockReadCachedAuthMe(),
    // A cached AUTHENTICATED snapshot resolves synchronously inside the hook's
    // mount effect. Anything else falls through to this deliberately pending
    // fetch, which is the unresolved state a guest must also see.
    fetchAuthMe: () => new Promise(() => undefined),
    writeCachedAuthMe: () => undefined,
    resetInFlightAuthMe: () => undefined
}));

const mockConversation = vi.fn();

vi.mock('@/store/accommodation-conversation-store', () => ({
    useAccommodationConversation: (params: { readonly accommodationId: string }) =>
        mockConversation(params)
}));

// Imported after the mocks so the module graph picks them up.
import { ReviewSidebarCard } from '@/components/accommodation/ReviewSidebarCard.client';

/** Signed in, and already contacted the host — the eligible-reviewer case. */
function arrangeEligible(): void {
    mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
    mockConversation.mockReturnValue({
        conversationId: 'conv-1',
        hasConversation: true,
        isResolving: false
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PROPS = {
    accommodationId: 'acc-123',
    accommodationName: 'Cabaña del Lago',
    locale: 'es' as const,
    apiUrl: 'http://localhost:3001',
    children: <div data-testid="signin-cta">Iniciá sesión para opinar</div>
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

// Every suite below except the render one is about the review FORM, which only
// exists for an eligible visitor. Arranging that here keeps those suites
// reading exactly as they did when eligibility was an SSR prop.
beforeEach(() => {
    mockReadCachedAuthMe.mockReset();
    mockConversation.mockReset();
    arrangeEligible();
});

describe('ReviewSidebarCard — render', () => {
    beforeEach(() => {
        // This suite owns the gating, so it starts from "no conversation" and
        // each test arranges the session it is actually about.
        mockReadCachedAuthMe.mockReset();
        mockConversation.mockReturnValue({
            conversationId: null,
            hasConversation: false,
            isResolving: false
        });
    });

    it('renders the anonymous children while no session is resolved', () => {
        // The SSR / edge-cached output. Asserting the card is ABSENT is the
        // half that matters: a review CTA in cached HTML would be shown to
        // every visitor, signed in or not.
        mockReadCachedAuthMe.mockReturnValue(null);
        renderCard();

        expect(screen.getByTestId('signin-cta')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /dejar reseña/i })).not.toBeInTheDocument();
    });

    it('renders the anonymous children for a confirmed guest', () => {
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: false }));
        renderCard();

        expect(screen.getByTestId('signin-cta')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /dejar reseña/i })).not.toBeInTheDocument();
    });

    it('renders the CTA for a signed-in visitor who contacted the host', () => {
        arrangeEligible();
        renderCard();

        expect(screen.getByRole('button', { name: /dejar reseña/i })).toBeInTheDocument();
        expect(screen.queryByTestId('signin-cta')).not.toBeInTheDocument();
    });

    it('renders a locked note (no CTA) for a signed-in visitor with no conversation', () => {
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
        renderCard();

        expect(screen.queryByRole('button', { name: /dejar reseña/i })).not.toBeInTheDocument();
        // Not the anonymous fallback either — this visitor IS signed in.
        expect(screen.queryByTestId('signin-cta')).not.toBeInTheDocument();
    });

    it('asks the store about the accommodation it was given', () => {
        arrangeEligible();
        renderCard();
        expect(mockConversation).toHaveBeenCalledWith({ accommodationId: 'acc-123' });
    });
});

describe('ReviewSidebarCard — content min-length gate (HOS-190)', () => {
    beforeEach(() => {
        setupDialogMocks();
    });

    it('disables submit and shows a field error when content is 1-9 chars', () => {
        renderCard();
        openDialog();
        rateAllAspects();

        fireEvent.change(screen.getByPlaceholderText(/comparte tu experiencia en detalle/i), {
            target: { value: 'too short' } // 9 chars
        });

        expect(screen.getByRole('button', { name: /enviar reseña/i })).toBeDisabled();
        expect(
            screen.getByText('El comentario debe tener al menos 10 caracteres')
        ).toBeInTheDocument();
    });

    it('does NOT call fetch when content is under the minimum and the form is submitted', () => {
        vi.stubGlobal('fetch', vi.fn());
        renderCard();
        openDialog();
        rateAllAspects();

        fireEvent.change(screen.getByPlaceholderText(/comparte tu experiencia en detalle/i), {
            target: { value: 'short' }
        });

        const form = document.querySelector('form') as HTMLFormElement;
        fireEvent.submit(form);

        expect(global.fetch).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    it('re-enables submit once content reaches 10+ chars (or is cleared back to empty/optional)', () => {
        renderCard();
        openDialog();
        rateAllAspects();

        const textarea = screen.getByPlaceholderText(/comparte tu experiencia en detalle/i);
        fireEvent.change(textarea, { target: { value: 'short' } });
        expect(screen.getByRole('button', { name: /enviar reseña/i })).toBeDisabled();

        fireEvent.change(textarea, { target: { value: 'now this is long enough' } });
        expect(screen.getByRole('button', { name: /enviar reseña/i })).not.toBeDisabled();
    });
});

describe('ReviewSidebarCard — review_submitted analytics event', () => {
    beforeEach(() => {
        setupDialogMocks();
        // Stub window.location.reload — the success branch schedules a reload
        // 1400ms after setSuccess(true). Assertions below resolve well before
        // that fires, but stubbing avoids jsdom's "not implemented: reload"
        // console noise if it fires during teardown.
        Object.defineProperty(window, 'location', {
            value: { reload: vi.fn(), hostname: 'localhost' },
            writable: true,
            configurable: true
        });
        trackEventSpy.mockClear();
    });

    afterEach(() => {
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
            expect(trackEventSpy).toHaveBeenCalledWith('review_submitted', {
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
        expect(trackEventSpy).not.toHaveBeenCalled();
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
        expect(trackEventSpy).not.toHaveBeenCalled();
    });
});
