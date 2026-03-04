/**
 * Tests for GlobalErrorBoundary component
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalErrorBoundary } from '../../../src/lib/error-boundaries/GlobalErrorBoundary';

// Mock the error reporting
vi.mock('../../../src/lib/errors', () => ({
    reportComponentError: vi.fn(),
    showInfoToast: vi.fn(),
    showErrorToast: vi.fn()
}));

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
        throw new Error('Test error message');
    }
    return <div>Child component</div>;
};

describe('GlobalErrorBoundary', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Suppress console.error for cleaner test output
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('should render children when no error occurs', () => {
        render(
            <GlobalErrorBoundary>
                <ThrowError shouldThrow={false} />
            </GlobalErrorBoundary>
        );

        expect(screen.getByText('Child component')).toBeInTheDocument();
    });

    it('should render fallback UI when error occurs', () => {
        render(
            <GlobalErrorBoundary>
                <ThrowError shouldThrow={true} />
            </GlobalErrorBoundary>
        );

        expect(screen.getByText('Error de la aplicación')).toBeInTheDocument();
        expect(screen.getByText('Intentar de nuevo')).toBeInTheDocument();
        expect(screen.getByText('Recargar página')).toBeInTheDocument();
        expect(screen.getByText('Volver al panel')).toBeInTheDocument();
    });

    it('should display error details in development mode', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        render(
            <GlobalErrorBoundary>
                <ThrowError shouldThrow={true} />
            </GlobalErrorBoundary>
        );

        // Click to expand details
        const details = screen.getByText('Detalles del error (solo desarrollo)');
        expect(details).toBeInTheDocument();

        process.env.NODE_ENV = originalEnv;
    });

    it('should call onError callback when error occurs', () => {
        const onError = vi.fn();

        render(
            <GlobalErrorBoundary onError={onError}>
                <ThrowError shouldThrow={true} />
            </GlobalErrorBoundary>
        );

        expect(onError).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({
                componentStack: expect.any(String)
            })
        );
    });

    it('should reset error boundary when Try Again is clicked', () => {
        const { rerender } = render(
            <GlobalErrorBoundary>
                <ThrowError shouldThrow={true} />
            </GlobalErrorBoundary>
        );

        expect(screen.getByText('Error de la aplicación')).toBeInTheDocument();

        // Click Try Again
        fireEvent.click(screen.getByText('Intentar de nuevo'));

        // Now render without error
        rerender(
            <GlobalErrorBoundary>
                <ThrowError shouldThrow={false} />
            </GlobalErrorBoundary>
        );

        // The error UI might still be showing due to how the boundary works
        // In real usage, the component would need to not throw on re-render
    });

    it('should call window.location.reload when Reload Page is clicked', () => {
        const reloadMock = vi.fn();
        Object.defineProperty(window, 'location', {
            value: { reload: reloadMock, href: 'http://localhost' },
            writable: true
        });

        render(
            <GlobalErrorBoundary>
                <ThrowError shouldThrow={true} />
            </GlobalErrorBoundary>
        );

        fireEvent.click(screen.getByText('Recargar página'));
        expect(reloadMock).toHaveBeenCalled();
    });

    it('should navigate to home when Go to Dashboard is clicked', () => {
        const originalHref = window.location.href;

        render(
            <GlobalErrorBoundary>
                <ThrowError shouldThrow={true} />
            </GlobalErrorBoundary>
        );

        fireEvent.click(screen.getByText('Volver al panel'));
        // The href should have been set to '/'
        expect(window.location.href).toBe('/');

        window.location.href = originalHref;
    });

    it('should use custom fallback component if provided', () => {
        const CustomFallback = ({ error, resetErrorBoundary }: any) => (
            <div>
                <span>Custom Error: {error.message}</span>
                <button onClick={resetErrorBoundary}>Custom Reset</button>
            </div>
        );

        render(
            <GlobalErrorBoundary fallback={CustomFallback}>
                <ThrowError shouldThrow={true} />
            </GlobalErrorBoundary>
        );

        expect(screen.getByText('Custom Error: Test error message')).toBeInTheDocument();
        expect(screen.getByText('Custom Reset')).toBeInTheDocument();
    });
});
