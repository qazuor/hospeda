import { defaultLocale, trans } from '@repo/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingErrorBoundary } from '../../../src/components/billing/BillingErrorBoundary';

/**
 * Helper to get a translation string, throwing if the key is missing
 */
function t(key: string): string {
    const value = trans[defaultLocale][key];
    if (value === undefined) {
        throw new Error(`Missing translation key: ${key}`);
    }
    return value;
}

/**
 * Test component that throws an error when shouldThrow prop is true
 */
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) {
        throw new Error('Test error');
    }
    return <div>Normal content</div>;
}

describe('BillingErrorBoundary', () => {
    // Suppress console.error for these tests
    const originalError = console.error;
    beforeEach(() => {
        console.error = vi.fn();
    });
    afterEach(() => {
        console.error = originalError;
    });

    it('should render children normally when no error occurs', () => {
        // Arrange & Act
        render(
            <BillingErrorBoundary>
                <div>Test content</div>
            </BillingErrorBoundary>
        );

        // Assert
        expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should show error fallback when a child component throws error', () => {
        // Arrange & Act
        render(
            <BillingErrorBoundary>
                <ThrowError shouldThrow={true} />
            </BillingErrorBoundary>
        );

        // Assert
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(t('billing.errorBoundary.title'))).toBeInTheDocument();
        expect(screen.getByText(t('billing.errorBoundary.message'))).toBeInTheDocument();
        expect(
            screen.getByRole('button', {
                name: t('billing.errorBoundary.tryAgain')
            })
        ).toBeInTheDocument();
    });

    it('should show custom fallback when provided', () => {
        // Arrange
        const customFallback = <div>Custom error UI</div>;

        // Act
        render(
            <BillingErrorBoundary fallback={customFallback}>
                <ThrowError shouldThrow={true} />
            </BillingErrorBoundary>
        );

        // Assert
        expect(screen.getByText('Custom error UI')).toBeInTheDocument();
        expect(screen.queryByText(t('billing.errorBoundary.title'))).not.toBeInTheDocument();
    });

    it('should reset error state when retry button is clicked', () => {
        // Arrange - Component that conditionally throws based on external state
        let shouldThrow = true;

        function ConditionalError() {
            if (shouldThrow) {
                throw new Error('Conditional error');
            }
            return <div>Recovered content</div>;
        }

        const { rerender } = render(
            <BillingErrorBoundary>
                <ConditionalError />
            </BillingErrorBoundary>
        );

        // Assert - error state is shown
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(t('billing.errorBoundary.title'))).toBeInTheDocument();

        // Act - stop throwing before retry
        shouldThrow = false;

        // Click retry button to reset error boundary
        const retryButton = screen.getByRole('button', {
            name: t('billing.errorBoundary.tryAgain')
        });
        fireEvent.click(retryButton);

        // Force rerender to pick up the state change
        rerender(
            <BillingErrorBoundary>
                <ConditionalError />
            </BillingErrorBoundary>
        );

        // Assert - after retry and stopping the error, normal content appears
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByText('Recovered content')).toBeInTheDocument();
    });

    it("should have role='alert' attribute on error state container", () => {
        // Arrange & Act
        render(
            <BillingErrorBoundary>
                <ThrowError shouldThrow={true} />
            </BillingErrorBoundary>
        );

        // Assert
        const alertElement = screen.getByRole('alert');
        expect(alertElement).toHaveAttribute('role', 'alert');
    });

    it('should log error to console when caught', () => {
        // Arrange
        const consoleErrorSpy = vi.spyOn(console, 'error');

        // Act
        render(
            <BillingErrorBoundary>
                <ThrowError shouldThrow={true} />
            </BillingErrorBoundary>
        );

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('BillingErrorBoundary caught error:'),
            expect.any(Error),
            expect.any(Object)
        );
    });
});
