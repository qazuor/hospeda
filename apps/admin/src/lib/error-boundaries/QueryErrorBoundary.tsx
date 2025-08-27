import { adminLogger } from '@/utils/logger';
import { useQueryClient } from '@tanstack/react-query';
import React from 'react';

/**
 * Error fallback component for TanStack Query errors
 * Provides query-specific error handling and recovery options
 */
interface QueryErrorFallbackProps {
    readonly error: Error;
    readonly resetErrorBoundary: () => void;
    readonly queryKey?: readonly unknown[];
}

const QueryErrorFallback: React.FC<QueryErrorFallbackProps> = ({
    error,
    resetErrorBoundary,
    queryKey
}) => {
    const queryClient = useQueryClient();

    /**
     * Handle retry with query invalidation
     */
    const handleRetryWithInvalidation = () => {
        if (queryKey) {
            queryClient.invalidateQueries({ queryKey });
        }
        resetErrorBoundary();
    };

    /**
     * Handle retry with cache clearing
     */
    const handleRetryWithClear = () => {
        if (queryKey) {
            queryClient.removeQueries({ queryKey });
        } else {
            queryClient.clear();
        }
        resetErrorBoundary();
    };

    /**
     * Determine error type and provide appropriate message
     */
    const getErrorInfo = () => {
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            return {
                title: 'Network Error',
                message: 'Unable to fetch data. Please check your connection and try again.',
                showInvalidate: true,
                showClear: false
            };
        }

        if (errorMessage.includes('timeout')) {
            return {
                title: 'Request Timeout',
                message: 'The request took too long to complete. Please try again.',
                showInvalidate: true,
                showClear: false
            };
        }

        if (errorMessage.includes('500') || errorMessage.includes('server')) {
            return {
                title: 'Server Error',
                message: 'The server encountered an error. Please try again in a moment.',
                showInvalidate: true,
                showClear: false
            };
        }

        if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
            return {
                title: 'Authentication Required',
                message: 'Please sign in to access this data.',
                showInvalidate: false,
                showClear: true
            };
        }

        return {
            title: 'Data Loading Error',
            message: 'An error occurred while loading data. Please try again.',
            showInvalidate: true,
            showClear: true
        };
    };

    const errorInfo = getErrorInfo();

    return (
        <div className="flex min-h-[200px] items-center justify-center p-4">
            <div className="w-full max-w-sm text-center">
                {/* Error Icon */}
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                    <svg
                        className="h-6 w-6 text-orange-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-label="Query error icon"
                    >
                        <title>Query Error</title>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                </div>

                {/* Error Title */}
                <h3 className="mb-2 font-medium text-gray-900">{errorInfo.title}</h3>

                {/* Error Message */}
                <p className="mb-4 text-gray-600 text-sm">{errorInfo.message}</p>

                {/* Query Key (if available and in development) */}
                {process.env.NODE_ENV === 'development' && queryKey && (
                    <p className="mb-3 font-mono text-gray-400 text-xs">
                        Query: {JSON.stringify(queryKey)}
                    </p>
                )}

                {/* Action Buttons */}
                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={resetErrorBoundary}
                        className="w-full rounded-md bg-blue-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        Try Again
                    </button>

                    {errorInfo.showInvalidate && (
                        <button
                            type="button"
                            onClick={handleRetryWithInvalidation}
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            Refresh Data
                        </button>
                    )}

                    {errorInfo.showClear && (
                        <button
                            type="button"
                            onClick={handleRetryWithClear}
                            className="w-full text-gray-500 text-sm transition-colors hover:text-gray-700"
                        >
                            Clear Cache & Retry
                        </button>
                    )}
                </div>

                {/* Development Error Details */}
                {process.env.NODE_ENV === 'development' && (
                    <details className="mt-4 text-left">
                        <summary className="cursor-pointer text-gray-400 text-xs">
                            Error Details
                        </summary>
                        <pre className="mt-2 overflow-auto rounded bg-gray-50 p-2 text-red-600 text-xs">
                            {error.stack || error.message}
                        </pre>
                    </details>
                )}
            </div>
        </div>
    );
};

/**
 * Props for QueryErrorBoundary component
 */
interface QueryErrorBoundaryProps {
    readonly children: React.ReactNode;
    readonly queryKey?: readonly unknown[];
    readonly onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    readonly fallback?: React.ComponentType<QueryErrorFallbackProps>;
}

/**
 * Basic Error Boundary for Query components
 */
class BasicQueryErrorBoundary extends React.Component<
    {
        readonly children: React.ReactNode;
        readonly fallback: React.ComponentType<QueryErrorFallbackProps>;
        readonly queryKey?: readonly unknown[];
        readonly onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    },
    { hasError: boolean; error?: Error }
> {
    constructor(props: BasicQueryErrorBoundary['props']) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error for monitoring
        adminLogger.error(
            `Query Error Boundary caught error: ${error.message}`,
            `QueryKey: ${JSON.stringify(this.props.queryKey)}, Stack: ${error.stack}`
        );

        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);
    }

    render() {
        if (this.state.hasError && this.state.error) {
            const FallbackComponent = this.props.fallback;
            return (
                <FallbackComponent
                    error={this.state.error}
                    resetErrorBoundary={() => this.setState({ hasError: false, error: undefined })}
                    queryKey={this.props.queryKey}
                />
            );
        }

        return this.props.children;
    }
}

/**
 * Error boundary specifically designed for TanStack Query components
 */
export const QueryErrorBoundary: React.FC<QueryErrorBoundaryProps> = ({
    children,
    queryKey,
    onError,
    fallback: FallbackComponent = QueryErrorFallback
}) => {
    return (
        <BasicQueryErrorBoundary
            fallback={FallbackComponent}
            queryKey={queryKey}
            onError={onError}
        >
            {children}
        </BasicQueryErrorBoundary>
    );
};

/**
 * Higher-order component to wrap query components with QueryErrorBoundary
 */
export const withQueryErrorBoundary = <P extends Record<string, unknown>>(
    Component: React.ComponentType<P>,
    options: {
        readonly getQueryKey?: (props: P) => readonly unknown[] | undefined;
        readonly onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    } = {}
) => {
    const WrappedComponent = (props: P) => {
        const queryKey = options.getQueryKey?.(props);

        return (
            <QueryErrorBoundary
                queryKey={queryKey}
                onError={options.onError}
            >
                <Component {...props} />
            </QueryErrorBoundary>
        );
    };

    WrappedComponent.displayName = `withQueryErrorBoundary(${Component.displayName || Component.name})`;

    return WrappedComponent;
};
