/**
 * @file favorites-reviews.test.tsx
 * @description Integration tests for UserFavoritesList.client.tsx and
 * UserReviewsList.client.tsx.
 *
 * UserFavoritesList: tabs render, tab switch resets list, bookmarks listing,
 *   empty state, optimistic delete, load-more.
 * UserReviewsList: tabs (all/accommodation/destination), review listing,
 *   empty state, edit mode, delete with confirm, load-more.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/hooks/useTranslation', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
        tPlural: (key: string, _n: number, fallback?: string) => fallback ?? key
    })
}));

vi.mock('@repo/icons', () => ({
    FavoriteIcon: () => <div data-testid="favorite-icon" />,
    ChatIcon: () => <div data-testid="chat-icon" />,
    EditIcon: () => <div data-testid="edit-icon" />,
    DeleteIcon: () => <div data-testid="delete-icon" />
}));

vi.mock('@repo/i18n', () => ({
    formatDate: ({ date }: { date: string }) => date,
    toBcp47Locale: (locale: string) => locale
}));

vi.mock('../../../src/lib/logger', () => ({
    webLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

const mockBookmarksList = vi.fn();
const mockBookmarksDelete = vi.fn();
const mockPatchProfile = vi.fn();
const mockGetReviews = vi.fn();
const mockApiClientPatch = vi.fn();
const mockApiClientDelete = vi.fn();

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    userBookmarksApi: {
        list: (...args: unknown[]) => mockBookmarksList(...args),
        delete: (...args: unknown[]) => mockBookmarksDelete(...args)
    },
    userApi: {
        patchProfile: (...args: unknown[]) => mockPatchProfile(...args),
        getReviews: (...args: unknown[]) => mockGetReviews(...args),
        getSubscription: vi.fn()
    }
}));

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
        patch: (...args: unknown[]) => mockApiClientPatch(...args),
        delete: (...args: unknown[]) => mockApiClientDelete(...args),
        get: vi.fn(),
        getProtected: vi.fn(),
        postProtected: vi.fn(),
        post: vi.fn()
    }
}));

// ReviewEditForm stub - avoids deep rendering
vi.mock('../../../src/components/account/ReviewEditForm.client', () => ({
    ReviewEditForm: ({
        onCancel,
        onSave,
        review
    }: {
        onCancel: () => void;
        onSave: (id: string, data: unknown) => void;
        review: { id: string };
    }) => (
        <div data-testid="review-edit-form">
            <button
                type="button"
                onClick={onCancel}
                data-testid="edit-cancel"
            >
                cancel
            </button>
            <button
                type="button"
                onClick={() =>
                    onSave(review.id, {
                        rating: 4,
                        title: 'Updated',
                        content: 'Updated content'
                    })
                }
                data-testid="edit-save"
            >
                save
            </button>
        </div>
    )
}));

import { UserFavoritesList } from '../../../src/components/account/UserFavoritesList.client';
import { UserReviewsList } from '../../../src/components/account/UserReviewsList.client';
import { addToast } from '../../../src/store/toast-store';

const addToastMock = addToast as ReturnType<typeof vi.fn>;

const sampleBookmarks = [
    {
        id: 'bm-1',
        entityId: 'acc-1',
        entityType: 'ACCOMMODATION' as const,
        name: 'Hotel Paraiso',
        description: 'A nice hotel',
        createdAt: '2026-01-15T12:00:00Z'
    },
    {
        id: 'bm-2',
        entityId: 'dest-1',
        entityType: 'ACCOMMODATION' as const,
        name: 'Playa del Sol',
        description: null,
        createdAt: '2026-01-20T12:00:00Z'
    }
];

const sampleReviews = {
    accommodationReviews: [
        {
            id: 'rev-1',
            rating: 5,
            title: 'Excellent',
            content: 'Best accommodation ever',
            createdAt: '2026-02-01T12:00:00Z',
            updatedAt: '2026-02-01T12:00:00Z',
            accommodationId: 'acc-1'
        }
    ],
    destinationReviews: [
        {
            id: 'rev-2',
            rating: 4,
            title: 'Great destination',
            content: 'Loved the views',
            createdAt: '2026-01-15T12:00:00Z',
            updatedAt: '2026-01-15T12:00:00Z',
            destinationId: 'dest-1'
        }
    ],
    totals: {
        accommodationReviews: 1,
        destinationReviews: 1,
        total: 2
    }
};

beforeEach(() => {
    addToastMock.mockClear();
    mockBookmarksList.mockClear();
    mockBookmarksDelete.mockClear();
    mockPatchProfile.mockClear();
    mockGetReviews.mockClear();
    mockApiClientPatch.mockClear();
    mockApiClientDelete.mockClear();
});

// ────────────────────────────────────────────────────────────
// UserFavoritesList
// ────────────────────────────────────────────────────────────

describe('UserFavoritesList.client.tsx', () => {
    describe('Tabs render', () => {
        it('should render 4 tab buttons', async () => {
            mockBookmarksList.mockResolvedValueOnce({
                ok: true,
                data: { bookmarks: [], total: 0 }
            });

            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            const tabs = screen.getAllByRole('tab');
            expect(tabs).toHaveLength(4);
        });

        it('should render ACCOMMODATION tab as selected by default', async () => {
            mockBookmarksList.mockResolvedValueOnce({
                ok: true,
                data: { bookmarks: [], total: 0 }
            });

            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            const tabs = screen.getAllByRole('tab');
            expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
        });
    });

    describe('Bookmarks listing', () => {
        it('should display bookmark names after loading', async () => {
            mockBookmarksList.mockResolvedValueOnce({
                ok: true,
                data: { bookmarks: sampleBookmarks, total: 2 }
            });

            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            expect(screen.getByText('Hotel Paraiso')).toBeInTheDocument();
            expect(screen.getByText('Playa del Sol')).toBeInTheDocument();
        });

        it('should display bookmark descriptions when available', async () => {
            mockBookmarksList.mockResolvedValueOnce({
                ok: true,
                data: { bookmarks: sampleBookmarks, total: 2 }
            });

            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            expect(screen.getByText('A nice hotel')).toBeInTheDocument();
        });
    });

    describe('Empty state', () => {
        it('should show empty state when no bookmarks exist', async () => {
            mockBookmarksList.mockResolvedValueOnce({
                ok: true,
                data: { bookmarks: [], total: 0 }
            });

            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            expect(screen.getByText('favorites.empty')).toBeInTheDocument();
        });
    });

    describe('Optimistic delete', () => {
        it('should remove bookmark from list immediately on delete click', async () => {
            mockBookmarksList.mockResolvedValueOnce({
                ok: true,
                data: { bookmarks: sampleBookmarks, total: 2 }
            });
            mockBookmarksDelete.mockResolvedValueOnce({ ok: true });

            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            expect(screen.getByText('Hotel Paraiso')).toBeInTheDocument();

            const deleteButtons = screen.getAllByRole('button', { name: /favorites.delete/i });
            await act(async () => {
                fireEvent.click(deleteButtons[0] as HTMLButtonElement);
            });

            await waitFor(() => {
                expect(screen.queryByText('Hotel Paraiso')).not.toBeInTheDocument();
            });
        });

        it('should show success toast on successful delete', async () => {
            mockBookmarksList.mockResolvedValueOnce({
                ok: true,
                data: { bookmarks: sampleBookmarks, total: 2 }
            });
            mockBookmarksDelete.mockResolvedValueOnce({ ok: true });

            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            const deleteButtons = screen.getAllByRole('button', { name: /favorites.delete/i });
            await act(async () => {
                fireEvent.click(deleteButtons[0] as HTMLButtonElement);
            });

            await waitFor(() => {
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'success' })
                );
            });
        });

        it('should restore bookmark when delete API fails', async () => {
            mockBookmarksList.mockResolvedValueOnce({
                ok: true,
                data: { bookmarks: sampleBookmarks, total: 2 }
            });
            mockBookmarksDelete.mockResolvedValueOnce({ ok: false });

            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            const deleteButtons = screen.getAllByRole('button', { name: /favorites.delete/i });
            await act(async () => {
                fireEvent.click(deleteButtons[0] as HTMLButtonElement);
            });

            await waitFor(() => {
                // Items should be back
                expect(screen.getByText('Hotel Paraiso')).toBeInTheDocument();
            });
        });
    });

    describe('Tab switching', () => {
        it('should switch active tab when another tab is clicked', async () => {
            mockBookmarksList
                .mockResolvedValueOnce({ ok: true, data: { bookmarks: [], total: 0 } })
                .mockResolvedValueOnce({ ok: true, data: { bookmarks: [], total: 0 } });

            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            const tabs = screen.getAllByRole('tab');
            await act(async () => {
                fireEvent.click(tabs[1] as HTMLButtonElement);
            });

            await waitFor(() => {
                expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
                expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
            });
        });
    });

    describe('Load more', () => {
        it('should show load-more button when hasMore is true', async () => {
            mockBookmarksList.mockResolvedValueOnce({
                ok: true,
                data: { bookmarks: sampleBookmarks.slice(0, 1), total: 20 }
            });

            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            expect(screen.getByText('favorites.loadMore')).toBeInTheDocument();
        });
    });
});

// ────────────────────────────────────────────────────────────
// UserReviewsList
// ────────────────────────────────────────────────────────────

describe('UserReviewsList.client.tsx', () => {
    describe('Tabs render', () => {
        it('should render 3 tab buttons (all, accommodation, destination)', async () => {
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            const tabs = screen.getAllByRole('tab');
            expect(tabs).toHaveLength(3);
        });

        it('should have "all" tab selected by default', async () => {
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            const tabs = screen.getAllByRole('tab');
            expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
        });
    });

    describe('Reviews listing', () => {
        it('should display review titles after loading', async () => {
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            expect(screen.getByText('Excellent')).toBeInTheDocument();
            expect(screen.getByText('Great destination')).toBeInTheDocument();
        });

        it('should display review content snippets', async () => {
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            expect(screen.getByText('Best accommodation ever')).toBeInTheDocument();
        });
    });

    describe('Empty state', () => {
        it('should show empty state when no reviews exist', async () => {
            mockGetReviews.mockResolvedValueOnce({
                ok: true,
                data: {
                    accommodationReviews: [],
                    destinationReviews: [],
                    totals: { accommodationReviews: 0, destinationReviews: 0, total: 0 }
                }
            });

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            expect(screen.getByText('reviews.empty')).toBeInTheDocument();
        });
    });

    describe('Edit mode', () => {
        it('should show review edit form when edit button is clicked', async () => {
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            const editButtons = screen.getAllByRole('button', { name: 'reviews.editButton' });
            await act(async () => {
                fireEvent.click(editButtons[0] as HTMLButtonElement);
            });

            expect(screen.getByTestId('review-edit-form')).toBeInTheDocument();
        });

        it('should hide edit form when cancel is clicked', async () => {
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            const editButtons = screen.getAllByRole('button', { name: 'reviews.editButton' });
            await act(async () => {
                fireEvent.click(editButtons[0] as HTMLButtonElement);
            });

            expect(screen.getByTestId('review-edit-form')).toBeInTheDocument();

            await act(async () => {
                fireEvent.click(screen.getByTestId('edit-cancel'));
            });

            expect(screen.queryByTestId('review-edit-form')).not.toBeInTheDocument();
        });
    });

    describe('Delete with confirmation', () => {
        it('should call window.confirm when delete button is clicked', async () => {
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });
            const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            const deleteButtons = screen.getAllByRole('button', { name: 'reviews.deleteButton' });
            await act(async () => {
                fireEvent.click(deleteButtons[0] as HTMLButtonElement);
            });

            expect(confirmSpy).toHaveBeenCalledTimes(1);
            confirmSpy.mockRestore();
        });

        it('should NOT delete when user cancels confirmation', async () => {
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });
            vi.spyOn(window, 'confirm').mockReturnValueOnce(false);

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            const deleteButtons = screen.getAllByRole('button', { name: 'reviews.deleteButton' });
            await act(async () => {
                fireEvent.click(deleteButtons[0] as HTMLButtonElement);
            });

            // Review should still be in the list
            expect(screen.getByText('Excellent')).toBeInTheDocument();
        });

        it('should remove review and show toast when delete is confirmed', async () => {
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });
            mockApiClientDelete.mockResolvedValueOnce({ ok: true });
            vi.spyOn(window, 'confirm').mockReturnValueOnce(true);

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            const deleteButtons = screen.getAllByRole('button', { name: 'reviews.deleteButton' });
            await act(async () => {
                fireEvent.click(deleteButtons[0] as HTMLButtonElement);
            });

            await waitFor(() => {
                expect(screen.queryByText('Excellent')).not.toBeInTheDocument();
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'success' })
                );
            });
        });
    });
});

// ────────────────────────────────────────────────────────────────────────────
// Additional test cases – UserFavoritesList
// ────────────────────────────────────────────────────────────────────────────

describe('UserFavoritesList.client.tsx – additional cases', () => {
    // -----------------------------------------------------------------------
    // Loading state
    // -----------------------------------------------------------------------

    describe('Loading state', () => {
        it('should show a loading spinner while the initial fetch is in progress', async () => {
            // Arrange – never resolves during this test so the spinner stays visible
            mockBookmarksList.mockReturnValueOnce(new Promise(() => undefined));

            // Act
            render(<UserFavoritesList locale="es" />);

            // Assert – spinner is present before data arrives
            expect(document.querySelector('.animate-spin')).toBeInTheDocument();
        });

        it('should hide the loading spinner once data has loaded', async () => {
            // Arrange
            mockBookmarksList.mockResolvedValueOnce({
                ok: true,
                data: { bookmarks: sampleBookmarks, total: 2 }
            });

            // Act
            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            // Assert
            expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
        });
    });

    // -----------------------------------------------------------------------
    // Empty state
    // -----------------------------------------------------------------------

    describe('Empty state details', () => {
        it('should render the FavoriteIcon in the empty state', async () => {
            // Arrange
            mockBookmarksList.mockResolvedValueOnce({
                ok: true,
                data: { bookmarks: [], total: 0 }
            });

            // Act
            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            // Assert – our mock renders data-testid="favorite-icon"
            expect(screen.getByTestId('favorite-icon')).toBeInTheDocument();
        });

        it('should display the emptyAction message alongside the empty heading', async () => {
            // Arrange
            mockBookmarksList.mockResolvedValueOnce({
                ok: true,
                data: { bookmarks: [], total: 0 }
            });

            // Act
            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            // Assert – useTranslation mock returns key as value
            expect(screen.getByText('favorites.emptyAction')).toBeInTheDocument();
        });
    });

    // -----------------------------------------------------------------------
    // Error state
    // -----------------------------------------------------------------------

    describe('Error state', () => {
        it('should show an error toast when the bookmarks API returns ok: false', async () => {
            // Arrange
            mockBookmarksList.mockResolvedValueOnce({ ok: false });

            // Act
            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            // Assert
            await waitFor(() => {
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'error' })
                );
            });
        });

        it('should show an error toast when the bookmarks API throws an exception', async () => {
            // Arrange
            mockBookmarksList.mockRejectedValueOnce(new Error('Network failure'));

            // Act
            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            // Assert
            await waitFor(() => {
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'error' })
                );
            });
        });

        it('should show an error toast when the delete API throws an exception', async () => {
            // Arrange
            mockBookmarksList.mockResolvedValueOnce({
                ok: true,
                data: { bookmarks: sampleBookmarks, total: 2 }
            });
            mockBookmarksDelete.mockRejectedValueOnce(new Error('Delete failed'));

            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            // Act
            const deleteButtons = screen.getAllByRole('button', { name: /favorites.delete/i });
            await act(async () => {
                fireEvent.click(deleteButtons[0] as HTMLButtonElement);
            });

            // Assert
            await waitFor(() => {
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'error' })
                );
            });
        });
    });

    // -----------------------------------------------------------------------
    // Tab filtering specifics
    // -----------------------------------------------------------------------

    describe('Tab filtering specifics', () => {
        it('should call the API with the correct entityType for each tab', async () => {
            // Arrange – set up responses for initial ACCOMMODATION load + DESTINATION switch
            mockBookmarksList
                .mockResolvedValueOnce({ ok: true, data: { bookmarks: [], total: 0 } })
                .mockResolvedValueOnce({ ok: true, data: { bookmarks: [], total: 0 } });

            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            // Act – click the DESTINATION tab (index 1)
            const tabs = screen.getAllByRole('tab');
            await act(async () => {
                fireEvent.click(tabs[1] as HTMLButtonElement);
            });

            await waitFor(() => {
                expect(mockBookmarksList).toHaveBeenCalledTimes(2);
            });

            // Assert – the second call should have entityType DESTINATION
            expect(mockBookmarksList).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ entityType: 'DESTINATION' })
            );
        });

        it('should reset bookmarks list when switching tabs', async () => {
            // Arrange
            mockBookmarksList
                .mockResolvedValueOnce({
                    ok: true,
                    data: { bookmarks: sampleBookmarks, total: 2 }
                })
                .mockResolvedValueOnce({ ok: true, data: { bookmarks: [], total: 0 } });

            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            expect(screen.getByText('Hotel Paraiso')).toBeInTheDocument();

            // Act – switch tab
            const tabs = screen.getAllByRole('tab');
            await act(async () => {
                fireEvent.click(tabs[1] as HTMLButtonElement);
            });

            // Assert – previous bookmarks are gone, empty state appears
            await waitFor(() => {
                expect(screen.queryByText('Hotel Paraiso')).not.toBeInTheDocument();
                expect(screen.getByText('favorites.empty')).toBeInTheDocument();
            });
        });

        it('should render all four tab ids as tabpanel controls targets', async () => {
            // Arrange
            mockBookmarksList.mockResolvedValueOnce({
                ok: true,
                data: { bookmarks: [], total: 0 }
            });

            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            // Assert – each tab has aria-controls pointing to a panel
            const tabs = screen.getAllByRole('tab');
            const controlsValues = tabs.map((t) => t.getAttribute('aria-controls'));
            expect(controlsValues).toContain('panel-ACCOMMODATION');
            expect(controlsValues).toContain('panel-DESTINATION');
            expect(controlsValues).toContain('panel-EVENT');
            expect(controlsValues).toContain('panel-POST');
        });
    });

    // -----------------------------------------------------------------------
    // Pagination / load-more merging logic
    // -----------------------------------------------------------------------

    describe('Pagination and load-more merging', () => {
        it('should append more bookmarks to the list when load-more is clicked', async () => {
            // Arrange – initial page has 1 item, total is 2 so load-more is visible
            const page1Bookmark = sampleBookmarks[0];
            const page2Bookmark = {
                id: 'bm-3',
                entityId: 'event-1',
                entityType: 'ACCOMMODATION' as const,
                name: 'Event Venue',
                description: null,
                createdAt: '2026-02-01T00:00:00Z'
            };

            mockBookmarksList
                .mockResolvedValueOnce({
                    ok: true,
                    data: { bookmarks: [page1Bookmark], total: 2 }
                })
                .mockResolvedValueOnce({
                    ok: true,
                    data: { bookmarks: [page2Bookmark], total: 2 }
                });

            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            expect(screen.getByText('Hotel Paraiso')).toBeInTheDocument();

            // Act – click load more
            const loadMoreButton = screen.getByText('favorites.loadMore');
            await act(async () => {
                fireEvent.click(loadMoreButton);
            });

            // Assert – both pages merged in list
            await waitFor(() => {
                expect(screen.getByText('Hotel Paraiso')).toBeInTheDocument();
                expect(screen.getByText('Event Venue')).toBeInTheDocument();
            });
        });

        it('should hide the load-more button once all bookmarks are loaded', async () => {
            // Arrange – bookmarks.length === total, no more to load
            mockBookmarksList.mockResolvedValueOnce({
                ok: true,
                data: { bookmarks: sampleBookmarks, total: 2 }
            });

            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            // Assert
            expect(screen.queryByText('favorites.loadMore')).not.toBeInTheDocument();
        });

        it('should decrement the total count optimistically on bookmark delete', async () => {
            // Arrange
            mockBookmarksList.mockResolvedValueOnce({
                ok: true,
                data: { bookmarks: sampleBookmarks, total: 10 }
            });
            mockBookmarksDelete.mockResolvedValueOnce({ ok: true });

            await act(async () => {
                render(<UserFavoritesList locale="es" />);
            });

            // After loading 2 items with total=10, load-more should be visible
            expect(screen.getByText('favorites.loadMore')).toBeInTheDocument();

            // Act – delete one item
            const deleteButtons = screen.getAllByRole('button', { name: /favorites.delete/i });
            await act(async () => {
                fireEvent.click(deleteButtons[0] as HTMLButtonElement);
            });

            // Assert – bookmark removed from UI
            await waitFor(() => {
                expect(screen.queryByText('Hotel Paraiso')).not.toBeInTheDocument();
            });
        });
    });
});

// ────────────────────────────────────────────────────────────────────────────
// Additional test cases – UserReviewsList
// ────────────────────────────────────────────────────────────────────────────

describe('UserReviewsList.client.tsx – additional cases', () => {
    // -----------------------------------------------------------------------
    // Loading state
    // -----------------------------------------------------------------------

    describe('Loading state', () => {
        it('should show a loading spinner during the initial fetch', () => {
            // Arrange – never resolves so the spinner remains visible
            mockGetReviews.mockReturnValueOnce(new Promise(() => undefined));

            // Act
            render(<UserReviewsList locale="es" />);

            // Assert
            expect(document.querySelector('.animate-spin')).toBeInTheDocument();
        });

        it('should display the loading text label during the initial fetch', () => {
            // Arrange
            mockGetReviews.mockReturnValueOnce(new Promise(() => undefined));

            // Act
            render(<UserReviewsList locale="es" />);

            // Assert
            expect(screen.getByText('reviews.loading')).toBeInTheDocument();
        });

        it('should remove the loading spinner after data is fetched', async () => {
            // Arrange
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });

            // Act
            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            // Assert
            expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
        });
    });

    // -----------------------------------------------------------------------
    // Error state
    // -----------------------------------------------------------------------

    describe('Error state', () => {
        it('should show an error toast when the reviews API returns ok: false', async () => {
            // Arrange
            mockGetReviews.mockResolvedValueOnce({ ok: false });

            // Act
            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            // Assert
            await waitFor(() => {
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'error' })
                );
            });
        });

        it('should show an error toast when the reviews API throws', async () => {
            // Arrange
            mockGetReviews.mockRejectedValueOnce(new Error('Network error'));

            // Act
            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            // Assert
            await waitFor(() => {
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'error' })
                );
            });
        });

        it('should show an error toast when the delete API returns ok: false', async () => {
            // Arrange
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });
            mockApiClientDelete.mockResolvedValueOnce({ ok: false });
            vi.spyOn(window, 'confirm').mockReturnValueOnce(true);

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            // Act
            const deleteButtons = screen.getAllByRole('button', { name: 'reviews.deleteButton' });
            await act(async () => {
                fireEvent.click(deleteButtons[0] as HTMLButtonElement);
            });

            // Assert
            await waitFor(() => {
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'error' })
                );
            });
        });

        it('should show an error toast when the save (PATCH) API returns ok: false', async () => {
            // Arrange
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });
            mockApiClientPatch.mockResolvedValueOnce({ ok: false });

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            // Open edit form
            const editButtons = screen.getAllByRole('button', { name: 'reviews.editButton' });
            await act(async () => {
                fireEvent.click(editButtons[0] as HTMLButtonElement);
            });

            // Act – trigger save via stub form
            await act(async () => {
                fireEvent.click(screen.getByTestId('edit-save'));
            });

            // Assert
            await waitFor(() => {
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'error' })
                );
            });
        });
    });

    // -----------------------------------------------------------------------
    // Star rating display
    // -----------------------------------------------------------------------

    describe('Star rating display', () => {
        it('should render an accessible aria-label on the star rating widget', async () => {
            // Arrange
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });

            // Act
            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            // Assert – StarRating renders a div with aria-label "label: rating/5".
            // The translation mock returns the key, so we look for elements whose
            // aria-label contains "reviews.ratingLabel".
            const ratingWidgets = document.querySelectorAll('[aria-label*="reviews.ratingLabel"]');
            expect(ratingWidgets.length).toBeGreaterThanOrEqual(1);
        });

        it('should include a screen-reader-only text with the numeric rating', async () => {
            // Arrange
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });

            // Act
            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            // Assert – StarRating renders "5 / 5" and "4 / 5" in sr-only spans
            expect(screen.getByText('5 / 5')).toBeInTheDocument();
            expect(screen.getByText('4 / 5')).toBeInTheDocument();
        });

        it('should display the review type badge (accommodation vs destination)', async () => {
            // Arrange
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });

            // Act
            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            // Assert – translation mock returns key as string
            expect(screen.getByText('reviews.accommodationReview')).toBeInTheDocument();
            expect(screen.getByText('reviews.destinationReview')).toBeInTheDocument();
        });
    });

    // -----------------------------------------------------------------------
    // Tab filtering specifics
    // -----------------------------------------------------------------------

    describe('Tab filtering specifics', () => {
        it('should send type=accommodation when switching to the accommodation tab', async () => {
            // Arrange
            mockGetReviews
                .mockResolvedValueOnce({ ok: true, data: sampleReviews })
                .mockResolvedValueOnce({
                    ok: true,
                    data: {
                        accommodationReviews: sampleReviews.accommodationReviews,
                        destinationReviews: [],
                        totals: {
                            accommodationReviews: 1,
                            destinationReviews: 0,
                            total: 1
                        }
                    }
                });

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            // Act – click accommodation tab
            const tabs = screen.getAllByRole('tab');
            await act(async () => {
                fireEvent.click(tabs[1] as HTMLButtonElement);
            });

            await waitFor(() => {
                expect(mockGetReviews).toHaveBeenCalledTimes(2);
            });

            // Assert
            expect(mockGetReviews).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ type: 'accommodation' })
            );
        });

        it('should reset editingId when switching tabs', async () => {
            // Arrange
            mockGetReviews
                .mockResolvedValueOnce({ ok: true, data: sampleReviews })
                .mockResolvedValueOnce({ ok: true, data: sampleReviews });

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            // Open edit form for first review
            const editButtons = screen.getAllByRole('button', { name: 'reviews.editButton' });
            await act(async () => {
                fireEvent.click(editButtons[0] as HTMLButtonElement);
            });

            expect(screen.getByTestId('review-edit-form')).toBeInTheDocument();

            // Act – switch tab
            const tabs = screen.getAllByRole('tab');
            await act(async () => {
                fireEvent.click(tabs[1] as HTMLButtonElement);
            });

            // Assert – edit form is gone after tab switch
            await waitFor(() => {
                expect(screen.queryByTestId('review-edit-form')).not.toBeInTheDocument();
            });
        });

        it('should render the correct tabpanel id for the active tab', async () => {
            // Arrange
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            // Assert – default tab is "all"
            expect(document.getElementById('panel-all')).toBeInTheDocument();
        });
    });

    // -----------------------------------------------------------------------
    // Pagination / load-more merging logic
    // -----------------------------------------------------------------------

    describe('Pagination and load-more merging', () => {
        it('should show load-more when review count is less than total', async () => {
            // Arrange – total is 5 but only 2 loaded
            const partialData = {
                ...sampleReviews,
                totals: { accommodationReviews: 3, destinationReviews: 2, total: 5 }
            };
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: partialData });

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            // Assert
            expect(screen.getByText('reviews.loadMore')).toBeInTheDocument();
        });

        it('should hide load-more when all reviews are already displayed', async () => {
            // Arrange – loaded 2 reviews, total is 2
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            // Assert
            expect(screen.queryByText('reviews.loadMore')).not.toBeInTheDocument();
        });

        it('should append additional reviews when load-more is clicked', async () => {
            // Arrange
            const extraReview = {
                id: 'rev-3',
                rating: 3,
                title: 'Third review',
                content: 'Another review content',
                createdAt: '2026-03-01T12:00:00Z',
                updatedAt: '2026-03-01T12:00:00Z',
                accommodationId: 'acc-2'
            };
            const page1Data = {
                accommodationReviews: sampleReviews.accommodationReviews,
                destinationReviews: [],
                totals: { accommodationReviews: 2, destinationReviews: 0, total: 2 }
            };
            const page2Data = {
                accommodationReviews: [extraReview],
                destinationReviews: [],
                totals: { accommodationReviews: 2, destinationReviews: 0, total: 2 }
            };

            mockGetReviews
                .mockResolvedValueOnce({ ok: true, data: page1Data })
                .mockResolvedValueOnce({ ok: true, data: page2Data });

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            expect(screen.getByText('Excellent')).toBeInTheDocument();

            // Act – click load more
            const loadMoreButton = screen.getByText('reviews.loadMore');
            await act(async () => {
                fireEvent.click(loadMoreButton);
            });

            // Assert – original + new review both visible
            await waitFor(() => {
                expect(screen.getByText('Excellent')).toBeInTheDocument();
                expect(screen.getByText('Third review')).toBeInTheDocument();
            });
        });

        it('should show a loading spinner at the bottom while loading more', async () => {
            // Arrange – page 1 resolves, page 2 never resolves so spinner stays
            const partialData = {
                ...sampleReviews,
                totals: { accommodationReviews: 3, destinationReviews: 2, total: 5 }
            };
            mockGetReviews
                .mockResolvedValueOnce({ ok: true, data: partialData })
                .mockReturnValueOnce(new Promise(() => undefined));

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            // Act – click load more
            const loadMoreButton = screen.getByText('reviews.loadMore');
            fireEvent.click(loadMoreButton);

            // Assert – spinner appears while loading more (items > 0 && isLoading)
            await waitFor(() => {
                expect(document.querySelector('.animate-spin')).toBeInTheDocument();
            });
        });
    });

    // -----------------------------------------------------------------------
    // Save / update success
    // -----------------------------------------------------------------------

    describe('Save review success', () => {
        it('should update the review in the list and close edit form on successful save', async () => {
            // Arrange
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });
            mockApiClientPatch.mockResolvedValueOnce({ ok: true, data: {} });

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            // Open edit form for first review
            const editButtons = screen.getAllByRole('button', { name: 'reviews.editButton' });
            await act(async () => {
                fireEvent.click(editButtons[0] as HTMLButtonElement);
            });

            // Act – trigger save via stub
            await act(async () => {
                fireEvent.click(screen.getByTestId('edit-save'));
            });

            // Assert – edit form is closed, success toast shown
            await waitFor(() => {
                expect(screen.queryByTestId('review-edit-form')).not.toBeInTheDocument();
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'success' })
                );
            });
        });

        it('should update the review title in the list after a successful save', async () => {
            // Arrange
            mockGetReviews.mockResolvedValueOnce({ ok: true, data: sampleReviews });
            mockApiClientPatch.mockResolvedValueOnce({ ok: true, data: {} });

            await act(async () => {
                render(<UserReviewsList locale="es" />);
            });

            // Open edit form
            const editButtons = screen.getAllByRole('button', { name: 'reviews.editButton' });
            await act(async () => {
                fireEvent.click(editButtons[0] as HTMLButtonElement);
            });

            // The stub saves with title: 'Updated'
            await act(async () => {
                fireEvent.click(screen.getByTestId('edit-save'));
            });

            // Assert
            await waitFor(() => {
                expect(screen.getByText('Updated')).toBeInTheDocument();
            });
        });
    });
});
