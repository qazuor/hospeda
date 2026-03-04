import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoriteButton } from '../../../src/components/ui/FavoriteButton.client';
import * as toastStore from '../../../src/store/toast-store';

// Mock toast store
vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * Helper: mock the initial check status GET call.
 * When isAuthenticated=true, FavoriteButton calls GET /check on mount.
 */
function mockCheckResponse(isFavorited = false) {
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { isFavorited, bookmarkId: isFavorited ? 'bk-1' : null } })
    });
}

/**
 * Helper: mock the toggle POST call.
 */
function mockToggleResponse(toggled = true) {
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { toggled, bookmark: toggled ? { id: 'bk-new' } : null } })
    });
}

describe('FavoriteButton.client.tsx', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render button with heart icon', () => {
            mockCheckResponse();
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button');
            expect(button).toBeInTheDocument();

            const svg = button.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveAttribute('aria-hidden', 'true');
        });

        it('should render with outline heart when not favorited', () => {
            mockCheckResponse(false);
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={true}
                />
            );

            const svg = screen.getByRole('button').querySelector('svg');
            expect(svg?.getAttribute('class')).toContain('text-text-secondary');
        });

        it('should render with filled heart when initialFavorited is true', () => {
            mockCheckResponse(true);
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={true}
                    isAuthenticated={true}
                />
            );

            const svg = screen.getByRole('button').querySelector('svg');
            expect(svg?.getAttribute('class')).toContain('text-red-500');
        });

        it('should apply custom className', () => {
            mockCheckResponse();
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    isAuthenticated={true}
                    className="custom-class"
                />
            );

            const button = screen.getByRole('button');
            expect(button.className).toContain('custom-class');
        });
    });

    describe('Accessibility', () => {
        it('should have correct aria-label when not favorited (Spanish)', () => {
            mockCheckResponse(false);
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={true}
                    locale="es"
                />
            );

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-label', 'Agregar a favoritos');
        });

        it('should have correct aria-label when favorited (Spanish)', () => {
            mockCheckResponse(true);
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={true}
                    isAuthenticated={true}
                    locale="es"
                />
            );

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-label', 'Quitar de favoritos');
        });

        it('should have correct aria-label when not favorited (English)', () => {
            mockCheckResponse(false);
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={true}
                    locale="en"
                />
            );

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-label', 'Add to favorites');
        });

        it('should have correct aria-label when favorited (English)', () => {
            mockCheckResponse(true);
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={true}
                    isAuthenticated={true}
                    locale="en"
                />
            );

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-label', 'Remove from favorites');
        });

        it('should have type="button" attribute', () => {
            mockCheckResponse();
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('type', 'button');
        });

        it('should have focus-visible styles', () => {
            mockCheckResponse();
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button');
            expect(button.className).toContain('focus-visible:outline');
        });
    });

    describe('Initial State Check', () => {
        it('should check bookmark status on mount when authenticated', async () => {
            mockCheckResponse(true);
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    isAuthenticated={true}
                />
            );

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('/api/v1/protected/user-bookmarks/check'),
                    expect.objectContaining({
                        method: 'GET',
                        credentials: 'include'
                    })
                );
            });

            // Should update to favorited state based on API response
            await waitFor(() => {
                const svg = screen.getByRole('button').querySelector('svg');
                expect(svg?.getAttribute('class')).toContain('text-red-500');
            });
        });

        it('should not check bookmark status when not authenticated', async () => {
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    isAuthenticated={false}
                />
            );

            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('Optimistic Updates', () => {
        it('should toggle visual state immediately on click', async () => {
            mockCheckResponse(false);
            mockToggleResponse(true);

            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={true}
                />
            );

            // Wait for check call to complete
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            const button = screen.getByRole('button');
            let svg = button.querySelector('svg');

            // Initially not favorited (outline heart)
            expect(svg?.getAttribute('class')).toContain('text-text-secondary');

            // Click to favorite
            fireEvent.click(button);

            // Immediately updated (filled heart) - optimistic
            svg = button.querySelector('svg');
            expect(svg?.getAttribute('class')).toContain('text-red-500');

            await waitFor(() => {
                // check + toggle = 2 calls
                expect(mockFetch).toHaveBeenCalledTimes(2);
            });
        });

        it('should call API with correct parameters', async () => {
            mockCheckResponse(false);
            mockToggleResponse(true);

            render(
                <FavoriteButton
                    entityId="dest-456"
                    entityType="destination"
                    initialFavorited={false}
                    isAuthenticated={true}
                />
            );

            // Wait for check call
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            const button = screen.getByRole('button');
            fireEvent.click(button);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3001/api/v1/protected/user-bookmarks',
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ entityId: 'dest-456', entityType: 'DESTINATION' })
                    }
                );
            });
        });

        it('should update aria-label after optimistic toggle', async () => {
            mockCheckResponse(false);
            mockToggleResponse(true);

            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={true}
                    locale="es"
                />
            );

            // Wait for check call
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            const button = screen.getByRole('button');

            // Initially not favorited
            expect(button).toHaveAttribute('aria-label', 'Agregar a favoritos');

            // Click to favorite
            fireEvent.click(button);

            // Aria-label updated immediately
            expect(button).toHaveAttribute('aria-label', 'Quitar de favoritos');

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('Authentication Check', () => {
        it('should show AuthRequiredPopover when not authenticated', () => {
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    isAuthenticated={false}
                    locale="es"
                />
            );

            const button = screen.getByRole('button');
            fireEvent.click(button);

            // Popover should be visible
            const popover = screen.getByRole('dialog');
            expect(popover).toBeInTheDocument();
            expect(popover).toHaveTextContent('Debes iniciar sesión para guardar favoritos');
        });

        it('should not call API when not authenticated', async () => {
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    isAuthenticated={false}
                />
            );

            const button = screen.getByRole('button');
            fireEvent.click(button);

            // Wait a bit to ensure no API call is made
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should not toggle state when not authenticated', () => {
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={false}
                />
            );

            const button = screen.getByRole('button');
            const svg = button.querySelector('svg');

            // Initially not favorited
            expect(svg?.getAttribute('class')).toContain('text-text-secondary');

            // Click without authentication
            fireEvent.click(button);

            // State should not change
            expect(svg?.getAttribute('class')).toContain('text-text-secondary');
        });

        it('should use English locale in AuthRequiredPopover when locale is en', () => {
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    isAuthenticated={false}
                    locale="en"
                />
            );

            const button = screen.getByRole('button');
            fireEvent.click(button);

            const popover = screen.getByRole('dialog');
            expect(popover).toHaveTextContent('You must sign in to save favorites');
        });
    });

    describe('Error Handling', () => {
        it('should revert state on API error', async () => {
            mockCheckResponse(false);
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={true}
                />
            );

            // Wait for check call
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            const button = screen.getByRole('button');
            let svg = button.querySelector('svg');

            // Initially not favorited
            expect(svg?.getAttribute('class')).toContain('text-text-secondary');

            // Click to favorite
            fireEvent.click(button);

            // Immediately favorited (optimistic)
            svg = button.querySelector('svg');
            expect(svg?.getAttribute('class')).toContain('text-red-500');

            // Wait for API call to fail and state to revert
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(2);
            });

            await waitFor(() => {
                svg = button.querySelector('svg');
                expect(svg?.getAttribute('class')).toContain('text-text-secondary');
            });
        });

        it('should show error toast on API failure (Spanish)', async () => {
            mockCheckResponse(false);
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={true}
                    locale="es"
                />
            );

            // Wait for check call
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            const button = screen.getByRole('button');
            fireEvent.click(button);

            await waitFor(() => {
                expect(toastStore.addToast).toHaveBeenCalledWith({
                    type: 'error',
                    message: 'Error al guardar favorito. Por favor, intenta de nuevo.',
                    duration: 5000
                });
            });
        });

        it('should show error toast on API failure (English)', async () => {
            mockCheckResponse(false);
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={true}
                    locale="en"
                />
            );

            // Wait for check call
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            const button = screen.getByRole('button');
            fireEvent.click(button);

            await waitFor(() => {
                expect(toastStore.addToast).toHaveBeenCalledWith({
                    type: 'error',
                    message: 'Failed to save favorite. Please try again.',
                    duration: 5000
                });
            });
        });

        it('should revert state on HTTP error response', async () => {
            mockCheckResponse(false);
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ error: 'Server error' })
            });

            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={true}
                />
            );

            // Wait for check call
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            const button = screen.getByRole('button');
            let svg = button.querySelector('svg');

            // Initially not favorited
            expect(svg?.getAttribute('class')).toContain('text-text-secondary');

            // Click to favorite
            fireEvent.click(button);

            // Immediately favorited (optimistic)
            svg = button.querySelector('svg');
            expect(svg?.getAttribute('class')).toContain('text-red-500');

            // Wait for API call to fail and state to revert
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(2);
            });

            await waitFor(() => {
                svg = button.querySelector('svg');
                expect(svg?.getAttribute('class')).toContain('text-text-secondary');
            });
        });
    });

    describe('Entity Types', () => {
        it('should work with accommodation entity type', async () => {
            mockCheckResponse(false);
            mockToggleResponse(true);

            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    isAuthenticated={true}
                />
            );

            // Wait for check call
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            const button = screen.getByRole('button');
            fireEvent.click(button);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3001/api/v1/protected/user-bookmarks',
                    expect.objectContaining({
                        body: JSON.stringify({ entityId: 'acc-123', entityType: 'ACCOMMODATION' })
                    })
                );
            });
        });

        it('should work with destination entity type', async () => {
            mockCheckResponse(false);
            mockToggleResponse(true);

            render(
                <FavoriteButton
                    entityId="dest-456"
                    entityType="destination"
                    isAuthenticated={true}
                />
            );

            // Wait for check call
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            const button = screen.getByRole('button');
            fireEvent.click(button);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3001/api/v1/protected/user-bookmarks',
                    expect.objectContaining({
                        body: JSON.stringify({ entityId: 'dest-456', entityType: 'DESTINATION' })
                    })
                );
            });
        });

        it('should work with event entity type', async () => {
            mockCheckResponse(false);
            mockToggleResponse(true);

            render(
                <FavoriteButton
                    entityId="evt-789"
                    entityType="event"
                    isAuthenticated={true}
                />
            );

            // Wait for check call
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            const button = screen.getByRole('button');
            fireEvent.click(button);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3001/api/v1/protected/user-bookmarks',
                    expect.objectContaining({
                        body: JSON.stringify({ entityId: 'evt-789', entityType: 'EVENT' })
                    })
                );
            });
        });
    });

    describe('Styling', () => {
        it('should have rounded-full class for circular button', () => {
            mockCheckResponse();
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button');
            expect(button.className).toContain('rounded-full');
        });

        it('should have hover styles', () => {
            mockCheckResponse();
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button');
            expect(button.className).toContain('hover:bg-surface-alt');
        });

        it('should have transition classes', () => {
            mockCheckResponse();
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button');
            expect(button.className).toContain('transition-colors');
        });

        it('should have transition on heart icon', () => {
            mockCheckResponse();
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    isAuthenticated={true}
                />
            );

            const svg = screen.getByRole('button').querySelector('svg');
            expect(svg?.getAttribute('class')).toContain('transition-colors');
        });
    });

    describe('Multiple Toggles', () => {
        it('should handle multiple toggle operations', async () => {
            mockCheckResponse(false);
            mockToggleResponse(true);
            mockToggleResponse(false);

            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={true}
                />
            );

            // Wait for check call
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            const button = screen.getByRole('button');
            let svg = button.querySelector('svg');

            // First toggle (favorite)
            expect(svg?.getAttribute('class')).toContain('text-text-secondary');
            fireEvent.click(button);
            svg = button.querySelector('svg');
            expect(svg?.getAttribute('class')).toContain('text-red-500');

            await waitFor(() => {
                // check + first toggle = 2 calls
                expect(mockFetch).toHaveBeenCalledTimes(2);
            });

            // Second toggle (unfavorite)
            svg = button.querySelector('svg');
            fireEvent.click(button);
            svg = button.querySelector('svg');
            expect(svg?.getAttribute('class')).toContain('text-text-secondary');

            await waitFor(() => {
                // check + two toggles = 3 calls
                expect(mockFetch).toHaveBeenCalledTimes(3);
            });
        });
    });

    describe('Toggle Sync', () => {
        it('should sync state with server response after toggle', async () => {
            mockCheckResponse(false);
            // Server says toggled=true (bookmark created)
            mockToggleResponse(true);

            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={true}
                />
            );

            // Wait for check call
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            const button = screen.getByRole('button');
            fireEvent.click(button);

            // After API response, state should be synced with server (toggled=true = favorited)
            await waitFor(() => {
                const svg = button.querySelector('svg');
                expect(svg?.getAttribute('class')).toContain('text-red-500');
            });
        });
    });
});
