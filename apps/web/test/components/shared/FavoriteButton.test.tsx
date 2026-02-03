/**
 * FavoriteButton Component Tests
 *
 * Tests for the FavoriteButton component with LimitGate integration
 *
 * @module test/components/shared/FavoriteButton.test
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoriteButton } from '../../../src/components/shared/FavoriteButton.client';

// Mock the hooks
vi.mock('../../../src/hooks/useBookmark', () => ({
    useBookmark: vi.fn(() => ({
        isBookmarked: false,
        isLoading: false,
        toggleBookmark: vi.fn(async () => true),
        setInitialBookmarked: vi.fn()
    }))
}));

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
    webLogger: {
        error: vi.fn(),
        warn: vi.fn()
    }
}));

// Mock LimitFallback
vi.mock('../../../src/components/billing', () => ({
    LimitFallback: vi.fn(({ limitName, currentValue, maxValue, currentPlan }) => (
        <div data-testid="limit-fallback">
            <p>
                Has alcanzado el límite de {maxValue} {limitName}
            </p>
            <p>Plan: {currentPlan}</p>
            <p>
                Uso: {currentValue}/{maxValue}
            </p>
        </div>
    ))
}));

// Mock LimitGate - default to allowing children
vi.mock('@qazuor/qzpay-react', () => ({
    LimitGate: vi.fn(({ children }) => {
        // Default: allow access (within limit)
        return children;
    })
}));

// Mock icons
vi.mock('@repo/icons', () => ({
    FavoriteIcon: vi.fn(({ size, className }) => (
        <svg
            data-testid="favorite-icon"
            data-size={size}
            className={className}
        >
            <title>Favorite</title>
        </svg>
    ))
}));

describe('FavoriteButton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('basic functionality', () => {
        it('should render button with correct aria-label for add action', async () => {
            const { useBookmark } = await import('../../../src/hooks/useBookmark');

            vi.mocked(useBookmark).mockReturnValue({
                isBookmarked: false,
                isLoading: false,
                toggleBookmark: vi.fn(async () => true),
                setInitialBookmarked: vi.fn()
            });

            render(
                <FavoriteButton
                    entityId="test-entity-1"
                    entityType="ACCOMMODATION"
                    initialBookmarked={false}
                />
            );

            await waitFor(() => {
                const button = screen.getByRole('button');
                expect(button).toBeInTheDocument();
                expect(button).toHaveAttribute('aria-label', 'Agregar a favoritos');
            });
        });

        it('should render button with correct aria-label for remove action', async () => {
            const { useBookmark } = await import('../../../src/hooks/useBookmark');

            vi.mocked(useBookmark).mockReturnValue({
                isBookmarked: true,
                isLoading: false,
                toggleBookmark: vi.fn(async () => false),
                setInitialBookmarked: vi.fn()
            });

            render(
                <FavoriteButton
                    entityId="test-entity-1"
                    entityType="ACCOMMODATION"
                    initialBookmarked={true}
                />
            );

            await waitFor(() => {
                const button = screen.getByRole('button');
                expect(button).toBeInTheDocument();
                expect(button).toHaveAttribute('aria-label', 'Quitar de favoritos');
            });
        });

        it('should call toggleBookmark when clicked', async () => {
            const { useBookmark } = await import('../../../src/hooks/useBookmark');
            const mockToggle = vi.fn(async () => true);

            vi.mocked(useBookmark).mockReturnValue({
                isBookmarked: false,
                isLoading: false,
                toggleBookmark: mockToggle,
                setInitialBookmarked: vi.fn()
            });

            render(
                <FavoriteButton
                    entityId="test-entity-1"
                    entityType="ACCOMMODATION"
                    initialBookmarked={false}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('button')).toBeInTheDocument();
            });

            const button = screen.getByRole('button');
            fireEvent.click(button);

            await waitFor(() => {
                expect(mockToggle).toHaveBeenCalledTimes(1);
            });
        });

        it('should call onToggle callback when favorited', async () => {
            const { useBookmark } = await import('../../../src/hooks/useBookmark');
            const mockToggle = vi.fn(async () => true);
            const onToggle = vi.fn();

            vi.mocked(useBookmark).mockReturnValue({
                isBookmarked: false,
                isLoading: false,
                toggleBookmark: mockToggle,
                setInitialBookmarked: vi.fn()
            });

            render(
                <FavoriteButton
                    entityId="test-entity-1"
                    entityType="ACCOMMODATION"
                    initialBookmarked={false}
                    onToggle={onToggle}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('button')).toBeInTheDocument();
            });

            const button = screen.getByRole('button');
            fireEvent.click(button);

            await waitFor(() => {
                expect(onToggle).toHaveBeenCalledWith(true);
            });
        });

        it('should show loading state', async () => {
            const { useBookmark } = await import('../../../src/hooks/useBookmark');

            vi.mocked(useBookmark).mockReturnValue({
                isBookmarked: false,
                isLoading: true,
                toggleBookmark: vi.fn(async () => true),
                setInitialBookmarked: vi.fn()
            });

            render(
                <FavoriteButton
                    entityId="test-entity-1"
                    entityType="ACCOMMODATION"
                    initialBookmarked={false}
                />
            );

            await waitFor(() => {
                const button = screen.getByRole('button');
                expect(button).toBeDisabled();
                expect(screen.getByText('Cargando...')).toBeInTheDocument();
            });
        });

        it('should respect disabled prop', async () => {
            const { useBookmark } = await import('../../../src/hooks/useBookmark');

            vi.mocked(useBookmark).mockReturnValue({
                isBookmarked: false,
                isLoading: false,
                toggleBookmark: vi.fn(async () => true),
                setInitialBookmarked: vi.fn()
            });

            render(
                <FavoriteButton
                    entityId="test-entity-1"
                    entityType="ACCOMMODATION"
                    initialBookmarked={false}
                    disabled={true}
                />
            );

            await waitFor(() => {
                const button = screen.getByRole('button');
                expect(button).toBeDisabled();
            });
        });

        it('should handle toggle errors gracefully', async () => {
            const { useBookmark } = await import('../../../src/hooks/useBookmark');
            const { webLogger } = await import('../../../src/utils/logger');
            const mockToggle = vi.fn(async () => {
                throw new Error('API error');
            });

            vi.mocked(useBookmark).mockReturnValue({
                isBookmarked: false,
                isLoading: false,
                toggleBookmark: mockToggle,
                setInitialBookmarked: vi.fn()
            });

            render(
                <FavoriteButton
                    entityId="test-entity-1"
                    entityType="ACCOMMODATION"
                    initialBookmarked={false}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('button')).toBeInTheDocument();
            });

            const button = screen.getByRole('button');
            fireEvent.click(button);

            await waitFor(() => {
                expect(webLogger.error).toHaveBeenCalledWith(
                    'Failed to toggle bookmark',
                    expect.any(Error)
                );
            });
        });
    });

    describe('LimitGate integration', () => {
        it('should wrap add action with LimitGate', async () => {
            const { LimitGate } = await import('@qazuor/qzpay-react');
            const { useBookmark } = await import('../../../src/hooks/useBookmark');

            vi.mocked(useBookmark).mockReturnValue({
                isBookmarked: false,
                isLoading: false,
                toggleBookmark: vi.fn(async () => true),
                setInitialBookmarked: vi.fn()
            });

            render(
                <FavoriteButton
                    entityId="test-entity-1"
                    entityType="ACCOMMODATION"
                    initialBookmarked={false}
                />
            );

            await waitFor(() => {
                expect(LimitGate).toHaveBeenCalledWith(
                    expect.objectContaining({
                        limitKey: 'max_favorites'
                    }),
                    undefined
                );
            });
        });

        it('should NOT wrap remove action with LimitGate', async () => {
            const { LimitGate } = await import('@qazuor/qzpay-react');
            const { useBookmark } = await import('../../../src/hooks/useBookmark');

            vi.mocked(useBookmark).mockReturnValue({
                isBookmarked: true,
                isLoading: false,
                toggleBookmark: vi.fn(async () => false),
                setInitialBookmarked: vi.fn()
            });

            vi.mocked(LimitGate).mockClear();

            render(
                <FavoriteButton
                    entityId="test-entity-1"
                    entityType="ACCOMMODATION"
                    initialBookmarked={true}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('button')).toBeInTheDocument();
            });

            // LimitGate should NOT be called when already bookmarked
            expect(LimitGate).not.toHaveBeenCalled();
        });

        it('should show LimitFallback when at limit', async () => {
            const { LimitGate } = await import('@qazuor/qzpay-react');
            const { useBookmark } = await import('../../../src/hooks/useBookmark');

            vi.mocked(useBookmark).mockReturnValue({
                isBookmarked: false,
                isLoading: false,
                toggleBookmark: vi.fn(async () => true),
                setInitialBookmarked: vi.fn()
            });

            // Mock LimitGate to show fallback (at limit)
            vi.mocked(LimitGate).mockImplementation(({ fallback }) => {
                return fallback || null;
            });

            render(
                <FavoriteButton
                    entityId="test-entity-1"
                    entityType="ACCOMMODATION"
                    initialBookmarked={false}
                />
            );

            await waitFor(() => {
                expect(screen.getByTestId('limit-fallback')).toBeInTheDocument();
                expect(screen.getByText(/Has alcanzado el límite/)).toBeInTheDocument();
            });
        });

        it('should allow favoriting when within limit', async () => {
            const { LimitGate } = await import('@qazuor/qzpay-react');
            const { useBookmark } = await import('../../../src/hooks/useBookmark');
            const mockToggle = vi.fn(async () => true);

            vi.mocked(useBookmark).mockReturnValue({
                isBookmarked: false,
                isLoading: false,
                toggleBookmark: mockToggle,
                setInitialBookmarked: vi.fn()
            });

            // Mock LimitGate to allow children (within limit)
            vi.mocked(LimitGate).mockImplementation(({ children }) => {
                return children;
            });

            render(
                <FavoriteButton
                    entityId="test-entity-1"
                    entityType="ACCOMMODATION"
                    initialBookmarked={false}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('button')).toBeInTheDocument();
            });

            const button = screen.getByRole('button');
            fireEvent.click(button);

            await waitFor(() => {
                expect(mockToggle).toHaveBeenCalledTimes(1);
            });
        });
    });
});
