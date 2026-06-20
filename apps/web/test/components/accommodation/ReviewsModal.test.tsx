/**
 * @file ReviewsModal.test.tsx
 * @description T-010 (SPEC-228): verifies the canonical Spinner replaces the
 * static '...' text and the "load more" button stays mounted while loading.
 */

import { ReviewsModal } from '@/components/accommodation/ReviewsModal.client';
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

vi.mock('@/lib/avatar-utils', () => ({
    getInitialsFromName: (name: string) =>
        name
            .split(' ')
            .map((p: string) => p[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
}));

const mockGetReviews = vi.fn();

vi.mock('@/lib/api/endpoints', () => ({
    accommodationsApi: {
        getReviews: (...args: unknown[]) => mockGetReviews(...args)
    }
}));

vi.mock('@/components/accommodation/ReviewsModal.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/components/shared/feedback/Spinner.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/components/shared/feedback/SkeletonCard.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/components/shared/ui/Dialog.client', () => ({
    Dialog: ({
        isOpen,
        children
    }: { isOpen: boolean; children: React.ReactNode; onClose: () => void }) =>
        isOpen ? <dialog open>{children}</dialog> : null,
    DialogHeader: ({
        children,
        titleId
    }: { children: React.ReactNode; titleId: string; onClose: () => void; closeLabel: string }) => (
        <div id={titleId}>{children}</div>
    ),
    DialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('@/components/ui/GradientButtonReact', () => ({
    GradientButton: ({
        label,
        onClick,
        disabled
    }: { label: string; onClick?: () => void; disabled?: boolean; [key: string]: unknown }) => (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
        >
            {label}
        </button>
    )
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUCCESS_RESPONSE = {
    ok: true,
    data: {
        items: [
            {
                id: 'r1',
                content: 'Gran alojamiento.',
                averageRating: 4.5,
                user: { name: 'Ana García', image: null },
                createdAt: '2024-03-15T10:00:00Z'
            }
        ],
        pagination: { total: 1 }
    }
};

function renderModal(props: { accommodationId?: string; reviewsCount?: number } = {}) {
    return render(
        <ReviewsModal
            accommodationId={props.accommodationId ?? 'acc-123'}
            reviewsCount={props.reviewsCount ?? 5}
            locale="es"
        />
    );
}

function dispatchTriggerClick(accommodationId: string) {
    const btn = document.createElement('button');
    btn.setAttribute('data-reviews-modal-trigger', '');
    btn.setAttribute('data-accommodation-id', accommodationId);
    document.body.appendChild(btn);
    fireEvent.click(btn);
    return btn;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReviewsModal — initial state', () => {
    afterEach(() => {
        // Remove orphan trigger buttons added by dispatchTriggerClick
        for (const el of document.querySelectorAll('[data-reviews-modal-trigger]')) {
            el.remove();
        }
    });
    beforeEach(() => mockGetReviews.mockReset());

    it('does not render a dialog on mount', () => {
        renderModal();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});

describe('ReviewsModal — success state', () => {
    afterEach(() => {
        for (const el of document.querySelectorAll('[data-reviews-modal-trigger]')) {
            el.remove();
        }
    });
    beforeEach(() => {
        mockGetReviews.mockReset();
        mockGetReviews.mockResolvedValue(SUCCESS_RESPONSE);
    });

    it('renders review content after successful fetch', async () => {
        renderModal();
        dispatchTriggerClick('acc-123');
        await waitFor(() => {
            expect(screen.getByText('Gran alojamiento.')).toBeInTheDocument();
        });
    });
});

// ─── T-010: canonical Spinner + load-more stays mounted ───────────────────────

describe('ReviewsModal — T-010 spinner and load-more (SPEC-228)', () => {
    afterEach(() => {
        for (const el of document.querySelectorAll('[data-reviews-modal-trigger]')) {
            el.remove();
        }
    });
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('T-010: shows canonical Spinner (role="status") while loading — no "..."', async () => {
        // Arrange: use a deferred promise so we control when it resolves
        let resolveReviews!: (value: unknown) => void;
        const deferred = new Promise((resolve) => {
            resolveReviews = resolve;
        });
        mockGetReviews.mockReturnValue(deferred);

        // Act
        renderModal();
        dispatchTriggerClick('acc-123');

        // Assert: spinner appears synchronously after setLoading(true)
        await waitFor(() => {
            expect(screen.getByRole('status')).toBeInTheDocument();
        });
        expect(document.body.textContent).not.toContain('...');

        // Resolve the deferred promise so React can finish the async operation
        resolveReviews({ ok: false, data: null });
    });

    it('T-010: Spinner disappears after reviews load', async () => {
        mockGetReviews.mockResolvedValue(SUCCESS_RESPONSE);

        renderModal();
        dispatchTriggerClick('acc-123');

        await waitFor(() => {
            expect(screen.getByText('Ana García')).toBeInTheDocument();
        });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('T-010: load-more button stays mounted while fetching next page', async () => {
        // Arrange: first page resolves; second page is deferred
        const first10 = {
            ok: true,
            data: {
                items: Array.from({ length: 10 }, (_, i) => ({
                    id: `r${i}`,
                    content: `Content ${i}`,
                    averageRating: 4.0,
                    user: { name: `User ${i}`, image: null },
                    createdAt: '2024-01-01T00:00:00Z'
                })),
                pagination: { total: 25 }
            }
        };

        let resolveSecondPage!: (value: unknown) => void;
        const deferredSecond = new Promise((resolve) => {
            resolveSecondPage = resolve;
        });

        mockGetReviews.mockResolvedValueOnce(first10).mockReturnValue(deferredSecond);

        renderModal({ reviewsCount: 25 });
        dispatchTriggerClick('acc-123');

        // Wait for load-more to appear
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Cargar más' })).toBeInTheDocument();
        });

        // Click load more — triggers second (deferred) fetch
        fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));

        // Assert: button stays mounted with the loading label
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Cargando reseñas…' })).toBeInTheDocument();
        });

        // Resolve so React can clean up after the test
        resolveSecondPage({ ok: false, data: null });
    });

    it('T-010: load-more button is disabled while loading next page', async () => {
        const first10 = {
            ok: true,
            data: {
                items: Array.from({ length: 10 }, (_, i) => ({
                    id: `r${i}`,
                    content: `Content ${i}`,
                    averageRating: 4.0,
                    user: { name: `User ${i}`, image: null },
                    createdAt: '2024-01-01T00:00:00Z'
                })),
                pagination: { total: 25 }
            }
        };

        let resolveSecondPage!: (value: unknown) => void;
        const deferredSecond = new Promise((resolve) => {
            resolveSecondPage = resolve;
        });

        mockGetReviews.mockResolvedValueOnce(first10).mockReturnValue(deferredSecond);

        renderModal({ reviewsCount: 25 });
        dispatchTriggerClick('acc-123');

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Cargar más' })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));

        await waitFor(() => {
            const btn = screen.getByRole('button', { name: 'Cargando reseñas…' });
            expect(btn).toBeDisabled();
        });

        // Resolve so React can clean up after the test
        resolveSecondPage({ ok: false, data: null });
    });
});

// ─── T-013: initial-load skeleton (SPEC-228) ─────────────────────────────────

describe('ReviewsModal — T-013 initial-load skeleton (SPEC-228)', () => {
    afterEach(() => {
        for (const el of document.querySelectorAll('[data-reviews-modal-trigger]')) {
            el.remove();
        }
    });
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('T-013: shows skeleton stack on first load (no reviews yet)', async () => {
        // Arrange: never-resolving promise to freeze in loading state
        mockGetReviews.mockReturnValue(new Promise(() => {}));

        // Act
        renderModal();
        dispatchTriggerClick('acc-123');

        // Assert: spinner (role=status) AND aria-hidden skeleton present
        await waitFor(() => {
            expect(screen.getByRole('status')).toBeInTheDocument();
        });
        const skeletons = document.querySelectorAll('[aria-hidden="true"]');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('T-013: skeleton NOT shown when loading more pages (reviews already exist)', async () => {
        // Arrange: first page loads, second page is deferred
        const first10 = {
            ok: true,
            data: {
                items: Array.from({ length: 10 }, (_, i) => ({
                    id: `r${i}`,
                    content: `Content ${i}`,
                    averageRating: 4.0,
                    user: { name: `User ${i}`, image: null },
                    createdAt: '2024-01-01T00:00:00Z'
                })),
                pagination: { total: 25 }
            }
        };

        let resolveSecondPage!: (value: unknown) => void;
        const deferredSecond = new Promise((resolve) => {
            resolveSecondPage = resolve;
        });

        mockGetReviews.mockResolvedValueOnce(first10).mockReturnValue(deferredSecond);

        renderModal({ reviewsCount: 25 });
        dispatchTriggerClick('acc-123');

        // Wait for first page to load and "load more" to appear
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Cargar más' })).toBeInTheDocument();
        });

        // Trigger second page fetch
        fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));

        // Assert: the load-more button label swaps to the loading text
        // (announcing pagination; the pagination Spinner is decorative). The
        // initial-load skeleton (reviews.length === 0) must NOT appear here.
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Cargando reseñas…' })).toBeInTheDocument();
        });

        // Reviews from first page are still visible — skeleton would not cover them
        expect(screen.getByText('Content 0')).toBeInTheDocument();

        resolveSecondPage({ ok: false, data: null });
    });
});
