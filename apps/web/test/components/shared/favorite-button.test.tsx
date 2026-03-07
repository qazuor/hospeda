/**
 * @file favorite-button.test.tsx
 * @description Integration tests for FavoriteButton.client.tsx.
 *
 * Covers: initial render, aria-label by state, unauthenticated popover,
 * optimistic update on click, API success sync, API failure rollback,
 * mount-time bookmark status fetch for authenticated users.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/icons', () => ({
    FavoriteIcon: ({ weight }: { weight: string }) => (
        <div
            data-testid="favorite-icon"
            data-weight={weight}
        />
    ),
    UserIcon: () => <div data-testid="user-icon" />,
    CloseIcon: () => <div data-testid="close-icon" />
}));

vi.mock('@sentry/astro', () => ({
    captureException: vi.fn()
}));

vi.mock('../../../src/lib/env', () => ({
    getApiUrl: () => 'http://localhost:3001'
}));

vi.mock('../../../src/lib/logger', () => ({
    webLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

// AuthRequiredPopover - stub so its internals don't interfere
vi.mock('../../../src/components/auth/AuthRequiredPopover.client', () => ({
    AuthRequiredPopover: ({
        message,
        onClose
    }: {
        message: string;
        onClose: () => void;
    }) => (
        <div
            data-testid="auth-required-popover"
            data-message={message}
        >
            <button
                type="button"
                onClick={onClose}
                data-testid="popover-close"
            >
                close
            </button>
        </div>
    )
}));

import { FavoriteButton } from '../../../src/components/shared/FavoriteButton.client';
import { addToast } from '../../../src/store/toast-store';

const addToastMock = addToast as ReturnType<typeof vi.fn>;

beforeEach(() => {
    addToastMock.mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// Helper to make fetch return a resolved response
function mockFetchOnce(body: unknown, ok = true) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(body), {
            status: ok ? 200 : 500,
            headers: { 'Content-Type': 'application/json' }
        })
    );
}

describe('FavoriteButton.client.tsx', () => {
    describe('Initial render - unauthenticated', () => {
        it('should render a button element', () => {
            render(
                <FavoriteButton
                    entityId="acc-1"
                    entityType="accommodation"
                />
            );
            expect(screen.getByRole('button')).toBeInTheDocument();
        });

        it('should show "add to favorites" aria-label when not favorited', () => {
            render(
                <FavoriteButton
                    entityId="acc-1"
                    entityType="accommodation"
                    initialFavorited={false}
                    locale="es"
                />
            );
            expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Agregar a favoritos');
        });

        it('should render a heart icon with regular weight when not favorited', () => {
            render(
                <FavoriteButton
                    entityId="acc-1"
                    entityType="accommodation"
                    initialFavorited={false}
                />
            );
            expect(screen.getByTestId('favorite-icon')).toHaveAttribute('data-weight', 'regular');
        });

        it('should show "remove from favorites" aria-label when favorited', () => {
            render(
                <FavoriteButton
                    entityId="acc-1"
                    entityType="accommodation"
                    initialFavorited={true}
                    locale="es"
                />
            );
            expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Quitar de favoritos');
        });

        it('should render heart icon with fill weight when favorited', () => {
            render(
                <FavoriteButton
                    entityId="acc-1"
                    entityType="accommodation"
                    initialFavorited={true}
                />
            );
            expect(screen.getByTestId('favorite-icon')).toHaveAttribute('data-weight', 'fill');
        });
    });

    describe('Unauthenticated click', () => {
        it('should show the AuthRequiredPopover when unauthenticated user clicks', async () => {
            render(
                <FavoriteButton
                    entityId="acc-1"
                    entityType="accommodation"
                    isAuthenticated={false}
                />
            );
            expect(screen.queryByTestId('auth-required-popover')).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button'));
            expect(screen.getByTestId('auth-required-popover')).toBeInTheDocument();
        });

        it('should hide the AuthRequiredPopover when its onClose fires', async () => {
            render(
                <FavoriteButton
                    entityId="acc-1"
                    entityType="accommodation"
                    isAuthenticated={false}
                />
            );
            fireEvent.click(screen.getByRole('button'));
            fireEvent.click(screen.getByTestId('popover-close'));
            expect(screen.queryByTestId('auth-required-popover')).not.toBeInTheDocument();
        });

        it('should NOT call fetch when unauthenticated user clicks', () => {
            const fetchSpy = vi.spyOn(globalThis, 'fetch');
            render(
                <FavoriteButton
                    entityId="acc-1"
                    entityType="accommodation"
                    isAuthenticated={false}
                />
            );
            fireEvent.click(screen.getByRole('button'));
            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });

    describe('Authenticated click - optimistic update', () => {
        it('should toggle icon to fill immediately (optimistic) before API responds', async () => {
            const fetchSpy = mockFetchOnce({ toggled: true });

            render(
                <FavoriteButton
                    entityId="acc-1"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={true}
                />
            );

            fireEvent.click(screen.getByRole('button'));

            // Optimistically the icon should be filled right away
            expect(screen.getByTestId('favorite-icon')).toHaveAttribute('data-weight', 'fill');

            await act(async () => {});
            fetchSpy.mockRestore();
        });

        it('should sync to server-returned state after successful API call', async () => {
            const fetchSpy = mockFetchOnce({ toggled: false });

            render(
                <FavoriteButton
                    entityId="acc-1"
                    entityType="accommodation"
                    initialFavorited={false}
                    isAuthenticated={true}
                />
            );

            await act(async () => {
                fireEvent.click(screen.getByRole('button'));
            });

            // Server returned toggled=false so state should revert to regular
            await waitFor(() => {
                expect(screen.getByTestId('favorite-icon')).toHaveAttribute(
                    'data-weight',
                    'regular'
                );
            });

            fetchSpy.mockRestore();
        });

        it('should revert state and show error toast when API call fails', async () => {
            // The component fires two fetch calls when isAuthenticated=true:
            // 1. checkBookmarkStatus on mount (GET user-bookmarks/check)
            // 2. toggleFavorite on click (POST user-bookmarks)
            // We need to mock both: mount call succeeds, toggle call fails.
            const fetchSpy = vi
                .spyOn(globalThis, 'fetch')
                .mockResolvedValueOnce(
                    // Mount: checkBookmarkStatus returns isFavorited=false
                    new Response(JSON.stringify({ isFavorited: false }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                )
                .mockRejectedValueOnce(new Error('Network error'));

            await act(async () => {
                render(
                    <FavoriteButton
                        entityId="acc-1"
                        entityType="accommodation"
                        initialFavorited={false}
                        isAuthenticated={true}
                    />
                );
            });

            await act(async () => {
                fireEvent.click(screen.getByRole('button'));
            });

            await waitFor(() => {
                // Reverted to original state
                expect(screen.getByTestId('favorite-icon')).toHaveAttribute(
                    'data-weight',
                    'regular'
                );
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'error' })
                );
            });

            fetchSpy.mockRestore();
        });
    });

    describe('Mount-time bookmark status fetch (authenticated)', () => {
        it('should call the bookmark check endpoint on mount when authenticated', async () => {
            const fetchSpy = mockFetchOnce({ isFavorited: true });

            await act(async () => {
                render(
                    <FavoriteButton
                        entityId="acc-2"
                        entityType="accommodation"
                        initialFavorited={false}
                        isAuthenticated={true}
                    />
                );
            });

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining('user-bookmarks/check'),
                expect.objectContaining({ method: 'GET', credentials: 'include' })
            );

            fetchSpy.mockRestore();
        });

        it('should NOT call the bookmark check endpoint when not authenticated', async () => {
            const fetchSpy = vi.spyOn(globalThis, 'fetch');

            await act(async () => {
                render(
                    <FavoriteButton
                        entityId="acc-2"
                        entityType="accommodation"
                        isAuthenticated={false}
                    />
                );
            });

            expect(fetchSpy).not.toHaveBeenCalled();
            fetchSpy.mockRestore();
        });
    });

    describe('Locale support', () => {
        it('should use English labels when locale is en', () => {
            render(
                <FavoriteButton
                    entityId="acc-1"
                    entityType="accommodation"
                    locale="en"
                    initialFavorited={false}
                />
            );
            expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Add to favorites');
        });

        it('should use Portuguese labels when locale is pt', () => {
            render(
                <FavoriteButton
                    entityId="acc-1"
                    entityType="accommodation"
                    locale="pt"
                    initialFavorited={true}
                />
            );
            expect(screen.getByRole('button')).toHaveAttribute(
                'aria-label',
                'Remover dos favoritos'
            );
        });
    });

    describe('Accessibility', () => {
        it('should have type=button on the heart button', () => {
            render(
                <FavoriteButton
                    entityId="acc-1"
                    entityType="accommodation"
                />
            );
            expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
        });
    });
});
