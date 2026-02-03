/**
 * CheckoutResultBanner Component Tests
 *
 * Tests for the checkout result banner component that displays
 * success/cancelled messages after checkout completion
 *
 * @module test/components/billing/CheckoutResultBanner.test
 */

import { CheckoutResultBanner } from '@/components/billing/CheckoutResultBanner';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('CheckoutResultBanner', () => {
    let replaceStateMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.useFakeTimers();

        // Mock window.history.replaceState
        replaceStateMock = vi.fn();
        Object.defineProperty(window, 'history', {
            value: {
                replaceState: replaceStateMock
            },
            writable: true
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('Rendering behavior', () => {
        it('should render nothing when no checkout param', () => {
            const { container } = render(<CheckoutResultBanner />);
            expect(container.firstChild).toBeNull();
        });

        it('should render nothing when result is null', () => {
            const { container } = render(<CheckoutResultBanner result={null} />);
            expect(container.firstChild).toBeNull();
        });

        it('should render nothing for unknown result values', () => {
            const { container } = render(<CheckoutResultBanner result={'unknown' as any} />);
            expect(container.firstChild).toBeNull();
        });
    });

    describe('Success banner', () => {
        it('should render success banner when result="success"', () => {
            render(<CheckoutResultBanner result="success" />);

            const banner = screen.getByRole('alert');
            expect(banner).toBeInTheDocument();
        });

        it('should show correct success message text', () => {
            render(<CheckoutResultBanner result="success" />);

            expect(screen.getByText('¡Gracias por tu compra!')).toBeInTheDocument();
            expect(screen.getByText('Tu suscripción está activa.')).toBeInTheDocument();
        });

        it('should have role="alert" for success', () => {
            render(<CheckoutResultBanner result="success" />);

            const banner = screen.getByRole('alert');
            expect(banner).toBeInTheDocument();
        });

        it('should have green styling for success', () => {
            render(<CheckoutResultBanner result="success" />);

            const banner = screen.getByRole('alert');
            expect(banner).toHaveClass('bg-green-50');
            expect(banner).toHaveClass('border-green-200');
        });
    });

    describe('Cancelled banner', () => {
        it('should render cancelled banner when result="cancelled"', () => {
            const { container } = render(<CheckoutResultBanner result="cancelled" />);

            const banner = container.querySelector('output');
            expect(banner).toBeInTheDocument();
        });

        it('should show correct cancelled message text', () => {
            render(<CheckoutResultBanner result="cancelled" />);

            expect(screen.getByText('Tu compra fue cancelada')).toBeInTheDocument();
            expect(
                screen.getByText('Podés intentar nuevamente cuando quieras.')
            ).toBeInTheDocument();
        });

        it('should use output element for cancelled', () => {
            const { container } = render(<CheckoutResultBanner result="cancelled" />);

            const banner = container.querySelector('output');
            expect(banner).toBeInTheDocument();
        });

        it('should have yellow styling for cancelled', () => {
            const { container } = render(<CheckoutResultBanner result="cancelled" />);

            const banner = container.querySelector('output');
            expect(banner).toHaveClass('bg-yellow-50');
            expect(banner).toHaveClass('border-yellow-200');
        });
    });

    describe('Dismiss functionality', () => {
        it('should have dismiss button', () => {
            render(<CheckoutResultBanner result="success" />);

            const dismissButton = screen.getByRole('button', {
                name: /cerrar mensaje/i
            });
            expect(dismissButton).toBeInTheDocument();
        });

        it('should dismiss on click', () => {
            render(<CheckoutResultBanner result="success" />);

            const dismissButton = screen.getByRole('button', {
                name: /cerrar mensaje/i
            });

            fireEvent.click(dismissButton);

            // Banner should be removed
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('should auto-dismiss after 10 seconds', () => {
            render(<CheckoutResultBanner result="success" />);

            // Banner should be visible initially
            expect(screen.getByRole('alert')).toBeInTheDocument();

            // Fast-forward time by 10 seconds
            act(() => {
                vi.advanceTimersByTime(10000);
            });

            // Banner should be dismissed
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('should not auto-dismiss before 10 seconds', () => {
            render(<CheckoutResultBanner result="success" />);

            // Banner should be visible initially
            expect(screen.getByRole('alert')).toBeInTheDocument();

            // Fast-forward time by 9 seconds (not enough)
            act(() => {
                vi.advanceTimersByTime(9000);
            });

            // Banner should still be visible
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    describe('URL param handling', () => {
        it('should clean URL query params on mount with success', () => {
            // Mock window.location
            (window as any).location = undefined;
            window.location = {
                search: '?checkout=success&other=param',
                pathname: '/test-page'
            } as any;

            render(<CheckoutResultBanner />);

            // Should call replaceState to clean URL
            expect(replaceStateMock).toHaveBeenCalledWith({}, '', '/test-page?other=param');
        });

        it('should clean URL query params on mount with cancelled', () => {
            // Mock window.location
            (window as any).location = undefined;
            window.location = {
                search: '?checkout=cancelled',
                pathname: '/pricing'
            } as any;

            render(<CheckoutResultBanner />);

            // Should call replaceState to clean URL
            expect(replaceStateMock).toHaveBeenCalledWith({}, '', '/pricing');
        });

        it('should read success from URL params', () => {
            // Mock window.location
            (window as any).location = undefined;
            window.location = {
                search: '?checkout=success',
                pathname: '/test'
            } as any;

            render(<CheckoutResultBanner />);

            // Should show success banner
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText('¡Gracias por tu compra!')).toBeInTheDocument();
        });

        it('should read cancelled from URL params', () => {
            // Mock window.location
            (window as any).location = undefined;
            window.location = {
                search: '?checkout=cancelled',
                pathname: '/test'
            } as any;

            const { container } = render(<CheckoutResultBanner />);

            // Should show cancelled banner
            expect(container.querySelector('output')).toBeInTheDocument();
            expect(screen.getByText('Tu compra fue cancelada')).toBeInTheDocument();
        });

        it('should not render for invalid URL param values', () => {
            // Mock window.location
            (window as any).location = undefined;
            window.location = {
                search: '?checkout=invalid',
                pathname: '/test'
            } as any;

            const { container } = render(<CheckoutResultBanner />);

            // Should not render anything
            expect(container.firstChild).toBeNull();
        });
    });
});
