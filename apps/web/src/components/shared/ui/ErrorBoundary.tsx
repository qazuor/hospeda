/**
 * @file ErrorBoundary.tsx
 * @description React error boundary for catching and displaying errors in React islands.
 * Shows a user-friendly fallback UI with a retry button when an island crashes.
 */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
    /** Child components to wrap */
    readonly children: ReactNode;
    /** Optional custom fallback UI */
    readonly fallback?: ReactNode;
}

interface ErrorBoundaryState {
    readonly hasError: boolean;
    readonly error: Error | null;
}

/**
 * React error boundary that catches errors in child component trees.
 * Displays a retry button allowing users to recover from transient errors.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <MyIsland />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('[ErrorBoundary] Caught error in React island:', error, errorInfo);
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div
                    style={{
                        padding: '16px 24px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--muted, #f5f5f5)',
                        border: '1px solid var(--border, #e0e0e0)',
                        textAlign: 'center',
                        fontFamily: 'var(--font-sans, system-ui, sans-serif)'
                    }}
                >
                    <p
                        style={{
                            color: 'var(--muted-foreground, #666)',
                            fontSize: '14px',
                            margin: '0 0 12px 0'
                        }}
                    >
                        Something went wrong loading this section.
                    </p>
                    <button
                        type="button"
                        onClick={this.handleRetry}
                        style={{
                            padding: '8px 20px',
                            borderRadius: 'var(--radius-button, 8px)',
                            backgroundColor: 'var(--accent, #f59e0b)',
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 600,
                            fontFamily: 'var(--font-sans, system-ui, sans-serif)'
                        }}
                    >
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
