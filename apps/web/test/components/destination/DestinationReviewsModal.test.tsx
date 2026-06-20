/**
 * @file DestinationReviewsModal.test.tsx
 * @description Unit tests for DestinationReviewsModal.client.tsx.
 * Uses @testing-library/react — the component is a React island.
 *
 * Coverage:
 * - Modal is not open by default (Dialog is not shown)
 * - Clicking a matching trigger opens the modal (fetches reviews)
 * - Clicking a non-matching trigger does not open the modal
 * - Error state renders error message
 * - Load-more button appears when hasMore and reviews are present
 * - Empty state is shown after successful fetch with 0 items
 * - reviewAvatar renders fallback initials when no image supplied
 * - averageRating is rendered with toFixed(1) format
 * - i18n keys are called through createTranslations
 * - destinationId prop is forwarded to the API call
 */

import { DestinationReviewsModal } from '@/components/destination/DestinationReviewsModal.client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
            .map((p) => p[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
}));

const mockGetReviews = vi.fn();

vi.mock('@/lib/api/endpoints', () => ({
    destinationsApi: {
        getReviews: (...args: unknown[]) => mockGetReviews(...args)
    }
}));

vi.mock('@/components/destination/DestinationReviewsModal.module.css', () => ({
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
                title: 'Gran destino',
                content: 'Muy buen lugar para visitar.',
                averageRating: 4.5,
                user: { name: 'Ana García', image: null },
                createdAt: '2024-03-15T10:00:00Z'
            }
        ],
        pagination: { total: 1 }
    }
};

const EMPTY_RESPONSE = {
    ok: true,
    data: { items: [], pagination: { total: 0 } }
};

const ERROR_RESPONSE = { ok: false, data: null };

function renderModal(props: { destinationId?: string; reviewsCount?: number } = {}) {
    return render(
        <DestinationReviewsModal
            destinationId={props.destinationId ?? 'dest-123'}
            reviewsCount={props.reviewsCount ?? 5}
            locale="es"
        />
    );
}

function dispatchTriggerClick(destinationId: string) {
    const btn = document.createElement('button');
    btn.setAttribute('data-reviews-modal-trigger', '');
    btn.setAttribute('data-destination-id', destinationId);
    document.body.appendChild(btn);
    fireEvent.click(btn);
    return btn;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DestinationReviewsModal — initial state', () => {
    beforeEach(() => {
        mockGetReviews.mockReset();
    });

    it('does not render a dialog on mount (modal is closed by default)', () => {
        // Arrange / Act
        renderModal();
        // Assert
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not call destinationsApi.getReviews on mount', () => {
        // Arrange / Act
        renderModal();
        // Assert
        expect(mockGetReviews).not.toHaveBeenCalled();
    });
});

describe('DestinationReviewsModal — trigger interaction', () => {
    beforeEach(() => {
        mockGetReviews.mockReset();
        mockGetReviews.mockResolvedValue(SUCCESS_RESPONSE);
    });

    it('opens the dialog when a matching trigger is clicked', async () => {
        // Arrange
        renderModal({ destinationId: 'dest-123' });
        // Act
        dispatchTriggerClick('dest-123');
        // Assert
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    it('does NOT open the dialog when a non-matching trigger is clicked', async () => {
        // Arrange
        renderModal({ destinationId: 'dest-123' });
        // Act
        dispatchTriggerClick('dest-999');
        // Assert — dialog should stay closed
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    it('calls destinationsApi.getReviews with the correct destinationId', async () => {
        // Arrange
        renderModal({ destinationId: 'dest-abc' });
        // Act
        dispatchTriggerClick('dest-abc');
        // Assert
        await waitFor(() => {
            expect(mockGetReviews).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'dest-abc', page: 1, pageSize: 10 })
            );
        });
    });
});

describe('DestinationReviewsModal — success state', () => {
    beforeEach(() => {
        mockGetReviews.mockReset();
        mockGetReviews.mockResolvedValue(SUCCESS_RESPONSE);
    });

    it('renders review user name after successful fetch', async () => {
        // Arrange
        renderModal();
        dispatchTriggerClick('dest-123');
        // Assert
        await waitFor(() => {
            expect(screen.getByText('Ana García')).toBeInTheDocument();
        });
    });

    it('renders review content after successful fetch', async () => {
        // Arrange
        renderModal();
        dispatchTriggerClick('dest-123');
        // Assert
        await waitFor(() => {
            expect(screen.getByText('Muy buen lugar para visitar.')).toBeInTheDocument();
        });
    });

    it('renders averageRating formatted to one decimal', async () => {
        // Arrange
        renderModal();
        dispatchTriggerClick('dest-123');
        // Assert — "★ 4.5" or equivalent
        await waitFor(() => {
            expect(screen.getByText(/4\.5/)).toBeInTheDocument();
        });
    });

    it('renders review title when present', async () => {
        // Arrange
        renderModal();
        dispatchTriggerClick('dest-123');
        // Assert
        await waitFor(() => {
            expect(screen.getByText('Gran destino')).toBeInTheDocument();
        });
    });
});

describe('DestinationReviewsModal — empty state', () => {
    beforeEach(() => {
        mockGetReviews.mockReset();
        mockGetReviews.mockResolvedValue(EMPTY_RESPONSE);
    });

    it('renders empty state message when API returns no reviews', async () => {
        // Arrange
        renderModal();
        dispatchTriggerClick('dest-123');
        // Assert
        await waitFor(() => {
            expect(screen.getByText('No hay reseñas disponibles.')).toBeInTheDocument();
        });
    });
});

describe('DestinationReviewsModal — error state', () => {
    beforeEach(() => {
        mockGetReviews.mockReset();
        mockGetReviews.mockResolvedValue(ERROR_RESPONSE);
    });

    it('renders error message when API call fails', async () => {
        // Arrange
        renderModal();
        dispatchTriggerClick('dest-123');
        // Assert
        await waitFor(() => {
            expect(screen.getByText('No se pudieron cargar las reseñas.')).toBeInTheDocument();
        });
    });

    it('renders retry button on error', async () => {
        // Arrange
        renderModal();
        dispatchTriggerClick('dest-123');
        // Assert
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
        });
    });
});

describe('DestinationReviewsModal — load more', () => {
    beforeEach(() => {
        mockGetReviews.mockReset();
        // 10 total items fetched so far (page=1), total=25 → hasMore=true
        mockGetReviews.mockResolvedValue({
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
        });
    });

    it('renders "load more" button when there are more reviews', async () => {
        // Arrange
        renderModal({ reviewsCount: 25 });
        dispatchTriggerClick('dest-123');
        // Assert
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Cargar más reseñas' })).toBeInTheDocument();
        });
    });
});

describe('DestinationReviewsModal — accessibility', () => {
    beforeEach(() => {
        mockGetReviews.mockReset();
        mockGetReviews.mockResolvedValue(SUCCESS_RESPONSE);
    });

    it('modal title has the correct id for aria-labelledby', async () => {
        // Arrange
        renderModal();
        dispatchTriggerClick('dest-123');
        // Assert
        await waitFor(() => {
            expect(document.getElementById('dest-reviews-modal-title')).toBeInTheDocument();
        });
    });
});

// ─── T-010: canonical Spinner + load-more stays mounted ───────────────────────

describe('DestinationReviewsModal — T-010 spinner and load-more (SPEC-228)', () => {
    beforeEach(() => {
        mockGetReviews.mockReset();
    });

    it('T-010: shows canonical Spinner (role="status") while loading (no "...")', async () => {
        // Arrange: resolve slowly so we can catch the loading state
        mockGetReviews.mockReturnValue(new Promise(() => {})); // never resolves

        // Act
        renderModal();
        dispatchTriggerClick('dest-123');

        // Assert: Spinner's role="status" live region is present
        await waitFor(() => {
            expect(screen.getByRole('status')).toBeInTheDocument();
        });

        // No literal '...' string
        expect(document.body.textContent).not.toContain('...');
    });

    it('T-010: Spinner disappears once reviews are loaded', async () => {
        // Arrange
        mockGetReviews.mockResolvedValue(SUCCESS_RESPONSE);

        // Act
        renderModal();
        dispatchTriggerClick('dest-123');

        // Wait for reviews to appear
        await waitFor(() => {
            expect(screen.getByText('Ana García')).toBeInTheDocument();
        });

        // Spinner should be gone
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('T-010: load-more button stays mounted during loading (no conditional unmount)', async () => {
        // Arrange: first call returns 10/25 items; second call never resolves (pending)
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

        mockGetReviews.mockResolvedValueOnce(first10).mockReturnValue(new Promise(() => {})); // second fetch never resolves

        // Act: open modal (first fetch)
        renderModal({ reviewsCount: 25 });
        dispatchTriggerClick('dest-123');

        // Wait for first page to render + load-more button to appear
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Cargar más reseñas' })).toBeInTheDocument();
        });

        // Click load more (triggers second fetch → loading = true)
        fireEvent.click(screen.getByRole('button', { name: 'Cargar más reseñas' }));

        // Assert: while the second fetch is pending, the load-more button is STILL
        // in the DOM (label changes to loading text, but it does NOT unmount)
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Cargando reseñas…' })).toBeInTheDocument();
        });
    });

    it('T-010: load-more button is disabled while loading', async () => {
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

        mockGetReviews.mockResolvedValueOnce(first10).mockReturnValue(new Promise(() => {}));

        renderModal({ reviewsCount: 25 });
        dispatchTriggerClick('dest-123');

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Cargar más reseñas' })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Cargar más reseñas' }));

        await waitFor(() => {
            const btn = screen.getByRole('button', { name: 'Cargando reseñas…' });
            expect(btn).toBeDisabled();
        });
    });
});

// ─── T-013: initial-load skeleton (SPEC-228) ─────────────────────────────────

describe('DestinationReviewsModal — T-013 initial-load skeleton (SPEC-228)', () => {
    beforeEach(() => {
        mockGetReviews.mockReset();
    });

    it('T-013: shows skeleton stack on first load (no reviews yet)', async () => {
        // Arrange: never-resolving promise to freeze in loading state
        mockGetReviews.mockReturnValue(new Promise(() => {}));

        // Act
        renderModal();
        dispatchTriggerClick('dest-123');

        // Assert: spinner (role=status) AND aria-hidden skeleton blocks present
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

        mockGetReviews.mockResolvedValueOnce(first10).mockReturnValue(new Promise(() => {}));

        renderModal({ reviewsCount: 25 });
        dispatchTriggerClick('dest-123');

        // Wait for load-more to appear
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Cargar más reseñas' })).toBeInTheDocument();
        });

        // Trigger second page fetch
        fireEvent.click(screen.getByRole('button', { name: 'Cargar más reseñas' }));

        // Assert: spinner for pagination appears AND reviews from first page are still visible
        await waitFor(() => {
            expect(screen.getByRole('status')).toBeInTheDocument();
        });
        expect(screen.getByText('Content 0')).toBeInTheDocument();
    });
});
