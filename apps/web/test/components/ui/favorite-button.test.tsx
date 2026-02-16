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
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={true}
                />
            );

            const svg = screen.getByRole('button').querySelector('svg');
            expect(svg).toHaveAttribute('fill', 'none');
            expect(svg?.getAttribute('class')).toContain('text-gray-600');
        });

        it('should render with filled heart when initialFavorited is true', () => {
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={true}
                    isAuthenticated={true}
                />
            );

            const svg = screen.getByRole('button').querySelector('svg');
            expect(svg).toHaveAttribute('fill', 'currentColor');
            expect(svg?.getAttribute('class')).toContain('text-red-500');
        });

        it('should apply custom className', () => {
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

    describe('Optimistic Updates', () => {
        it('should toggle visual state immediately on click', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            });

            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button');
            let svg = button.querySelector('svg');

            // Initially not favorited (outline heart)
            expect(svg).toHaveAttribute('fill', 'none');
            expect(svg?.getAttribute('class')).toContain('text-gray-600');

            // Click to favorite
            fireEvent.click(button);

            // Immediately updated (filled heart) - optimistic
            svg = button.querySelector('svg');
            expect(svg).toHaveAttribute('fill', 'currentColor');
            expect(svg?.getAttribute('class')).toContain('text-red-500');

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });
        });

        it('should call API with correct parameters', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            });

            render(
                <FavoriteButton
                    entityId="dest-456"
                    entityType="destination"
                    initialFavorited={false}
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button');
            fireEvent.click(button);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/v1/favorites', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ entityId: 'dest-456', entityType: 'destination' })
                });
            });
        });

        it('should update aria-label after optimistic toggle', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            });

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

            // Initially not favorited
            expect(button).toHaveAttribute('aria-label', 'Agregar a favoritos');

            // Click to favorite
            fireEvent.click(button);

            // Aria-label updated immediately
            expect(button).toHaveAttribute('aria-label', 'Quitar de favoritos');

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
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
            expect(svg).toHaveAttribute('fill', 'none');

            // Click without authentication
            fireEvent.click(button);

            // State should not change
            expect(svg).toHaveAttribute('fill', 'none');
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
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button');
            let svg = button.querySelector('svg');

            // Initially not favorited
            expect(svg).toHaveAttribute('fill', 'none');

            // Click to favorite
            fireEvent.click(button);

            // Immediately favorited (optimistic)
            svg = button.querySelector('svg');
            expect(svg).toHaveAttribute('fill', 'currentColor');

            // Wait for API call to fail and state to revert
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            await waitFor(() => {
                svg = button.querySelector('svg');
                expect(svg).toHaveAttribute('fill', 'none');
            });
        });

        it('should show error toast on API failure (Spanish)', async () => {
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

            const button = screen.getByRole('button');
            let svg = button.querySelector('svg');

            // Initially not favorited
            expect(svg).toHaveAttribute('fill', 'none');

            // Click to favorite
            fireEvent.click(button);

            // Immediately favorited (optimistic)
            svg = button.querySelector('svg');
            expect(svg).toHaveAttribute('fill', 'currentColor');

            // Wait for API call to fail and state to revert
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            await waitFor(() => {
                svg = button.querySelector('svg');
                expect(svg).toHaveAttribute('fill', 'none');
            });
        });
    });

    describe('Entity Types', () => {
        it('should work with accommodation entity type', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            });

            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button');
            fireEvent.click(button);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    '/api/v1/favorites',
                    expect.objectContaining({
                        body: JSON.stringify({ entityId: 'acc-123', entityType: 'accommodation' })
                    })
                );
            });
        });

        it('should work with destination entity type', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            });

            render(
                <FavoriteButton
                    entityId="dest-456"
                    entityType="destination"
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button');
            fireEvent.click(button);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    '/api/v1/favorites',
                    expect.objectContaining({
                        body: JSON.stringify({ entityId: 'dest-456', entityType: 'destination' })
                    })
                );
            });
        });

        it('should work with event entity type', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            });

            render(
                <FavoriteButton
                    entityId="evt-789"
                    entityType="event"
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button');
            fireEvent.click(button);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    '/api/v1/favorites',
                    expect.objectContaining({
                        body: JSON.stringify({ entityId: 'evt-789', entityType: 'event' })
                    })
                );
            });
        });
    });

    describe('Styling', () => {
        it('should have rounded-full class for circular button', () => {
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
            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button');
            expect(button.className).toContain('hover:bg-gray-100');
        });

        it('should have transition classes', () => {
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
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ success: true })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ success: true })
                });

            render(
                <FavoriteButton
                    entityId="acc-123"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button');
            let svg = button.querySelector('svg');

            // First toggle (favorite)
            expect(svg).toHaveAttribute('fill', 'none');
            fireEvent.click(button);
            expect(svg).toHaveAttribute('fill', 'currentColor');

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            // Second toggle (unfavorite)
            svg = button.querySelector('svg');
            fireEvent.click(button);
            expect(svg).toHaveAttribute('fill', 'none');

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(2);
            });
        });
    });
});
