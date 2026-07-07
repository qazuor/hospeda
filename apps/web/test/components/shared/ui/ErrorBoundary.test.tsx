/**
 * @file ErrorBoundary.test.tsx
 * @description React Testing Library tests for the ErrorBoundary component,
 * including the Sentry error-reporting hook added for production hardening.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Component, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/components/shared/ui/ErrorBoundary';

const captureExceptionMock = vi.fn();

vi.mock('@sentry/astro', () => ({
    captureException: (...args: unknown[]) => captureExceptionMock(...args)
}));

/**
 * A child that throws on render so we can exercise componentDidCatch.
 */
class Thrower extends Component<{ shouldThrow: boolean; children?: ReactNode }> {
    render() {
        if (this.props.shouldThrow) {
            throw new Error('boom');
        }
        return this.props.children ?? null;
    }
}

describe('ErrorBoundary', () => {
    beforeEach(() => {
        captureExceptionMock.mockClear();
        // React logs the error to console.error as well; silence it for clean test output.
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders children when there is no error', () => {
        render(
            <ErrorBoundary>
                <Thrower shouldThrow={false}>
                    <span>content</span>
                </Thrower>
            </ErrorBoundary>
        );

        expect(screen.getByText('content')).toBeInTheDocument();
        expect(captureExceptionMock).not.toHaveBeenCalled();
    });

    it('reports the error to Sentry with the React component stack', () => {
        render(
            <ErrorBoundary>
                <Thrower shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(captureExceptionMock).toHaveBeenCalledTimes(1);
        const [error, context] = captureExceptionMock.mock.calls[0] as [
            Error,
            { contexts: { react: { componentStack: string } } }
        ];
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('boom');
        expect(context.contexts.react.componentStack).toEqual(expect.any(String));
    });

    it('shows the fallback UI and allows retrying after an error', async () => {
        const user = userEvent.setup();
        render(
            <ErrorBoundary>
                <Thrower shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong loading this section.')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Try again' }));

        // Retry resets state; the child re-throws immediately since shouldThrow is
        // still true, so the fallback is shown again (proves handleRetry ran).
        expect(screen.getByText('Something went wrong loading this section.')).toBeInTheDocument();
        expect(captureExceptionMock).toHaveBeenCalledTimes(2);
    });

    it('renders a custom fallback when provided', () => {
        render(
            <ErrorBoundary fallback={<div>custom fallback</div>}>
                <Thrower shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('custom fallback')).toBeInTheDocument();
    });
});
