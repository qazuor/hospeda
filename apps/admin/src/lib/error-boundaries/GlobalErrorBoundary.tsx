import { adminLogger } from '@/utils/logger';
import React from 'react';

/**
 * Global error fallback component
 * Provides a last-resort error UI when other error boundaries fail
 */
interface GlobalErrorFallbackProps {
    readonly error: Error;
    readonly resetErrorBoundary: () => void;
}

const GlobalErrorFallback: React.FC<GlobalErrorFallbackProps> = ({ error, resetErrorBoundary }) => {
    /**
     * Reload the entire application
     */
    const handleReload = () => {
        window.location.reload();
    };

    /**
     * Navigate to home page
     */
    const handleGoHome = () => {
        window.location.href = '/';
    };

    /**
     * Report error to support (placeholder)
     */
    const handleReportError = () => {
        // TODO: Implement error reporting to support system
        const errorReport = {
            message: error.message,
            stack: error.stack,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        };

        adminLogger.error(errorReport, 'Error report');

        // For now, copy to clipboard
        navigator.clipboard
            .writeText(JSON.stringify(errorReport, null, 2))
            .then(() => {
                alert('Error details copied to clipboard. Please share with support.');
            })
            .catch(() => {
                alert('Unable to copy error details. Please take a screenshot.');
            });
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
            <div className="w-full max-w-lg text-center">
                {/* Error Icon */}
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                    <svg
                        className="h-10 w-10 text-red-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-label="Global error icon"
                    >
                        <title>Global Error</title>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                    </svg>
                </div>

                {/* Error Title */}
                <h1 className="mb-4 font-bold text-2xl text-gray-900">
                    Oops! Something went wrong
                </h1>

                {/* Error Message */}
                <p className="mb-6 text-gray-600">
                    We're sorry, but something unexpected happened. Our team has been notified and
                    is working to fix the issue.
                </p>

                {/* Action Buttons */}
                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={resetErrorBoundary}
                        className="w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        Try Again
                    </button>

                    <button
                        type="button"
                        onClick={handleReload}
                        className="w-full rounded-md border border-gray-300 bg-white px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        Reload Page
                    </button>

                    <button
                        type="button"
                        onClick={handleGoHome}
                        className="w-full text-blue-600 transition-colors hover:text-blue-800"
                    >
                        Go to Dashboard
                    </button>
                </div>

                {/* Report Error Button */}
                <div className="mt-8 border-gray-200 border-t pt-6">
                    <button
                        type="button"
                        onClick={handleReportError}
                        className="text-gray-500 text-sm transition-colors hover:text-gray-700"
                    >
                        Report this error to support
                    </button>
                </div>

                {/* Development Error Details */}
                {process.env.NODE_ENV === 'development' && (
                    <details className="mt-6 text-left">
                        <summary className="cursor-pointer text-gray-500 text-sm">
                            Error Details (Development Only)
                        </summary>
                        <div className="mt-4 rounded-md bg-gray-100 p-4">
                            <h4 className="font-medium text-gray-900 text-sm">Error Message:</h4>
                            <p className="mt-1 text-red-600 text-sm">{error.message}</p>

                            {error.stack && (
                                <>
                                    <h4 className="mt-4 font-medium text-gray-900 text-sm">
                                        Stack Trace:
                                    </h4>
                                    <pre className="mt-1 overflow-auto text-red-600 text-xs">
                                        {error.stack}
                                    </pre>
                                </>
                            )}
                        </div>
                    </details>
                )}
            </div>
        </div>
    );
};

/**
 * Props for GlobalErrorBoundary component
 */
interface GlobalErrorBoundaryProps {
    readonly children: React.ReactNode;
    readonly onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    readonly fallback?: React.ComponentType<GlobalErrorFallbackProps>;
}

/**
 * Basic Global Error Boundary implementation
 */
class BasicGlobalErrorBoundary extends React.Component<
    {
        readonly children: React.ReactNode;
        readonly fallback: React.ComponentType<GlobalErrorFallbackProps>;
        readonly onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    },
    { hasError: boolean; error?: Error }
> {
    constructor(props: BasicGlobalErrorBoundary['props']) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error for monitoring
        adminLogger.error(
            `Global Error Boundary caught error: ${error.message}`,
            `URL: ${window.location.href}, UserAgent: ${navigator.userAgent}, Stack: ${error.stack}`
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
                />
            );
        }

        return this.props.children;
    }
}

/**
 * Global error boundary that catches all unhandled errors in the application
 * Should be placed at the root level to catch errors from any component
 */
export const GlobalErrorBoundary: React.FC<GlobalErrorBoundaryProps> = ({
    children,
    onError,
    fallback: FallbackComponent = GlobalErrorFallback
}) => {
    return (
        <BasicGlobalErrorBoundary
            fallback={FallbackComponent}
            onError={onError}
        >
            {children}
        </BasicGlobalErrorBoundary>
    );
};

/**
 * Hook to manually trigger error boundary
 * Useful for testing or programmatic error handling
 */
export const useErrorBoundary = () => {
    const [error, setError] = React.useState<Error | null>(null);

    React.useEffect(() => {
        if (error) {
            throw error;
        }
    }, [error]);

    const throwError = React.useCallback((error: Error | string) => {
        const errorObj = typeof error === 'string' ? new Error(error) : error;
        setError(errorObj);
    }, []);

    return { throwError };
};
