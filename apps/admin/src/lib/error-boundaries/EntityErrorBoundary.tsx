import { adminLogger } from '@/utils/logger';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import React from 'react';

/**
 * Error fallback component for entity-related errors
 * Provides user-friendly error messages and recovery options
 */
interface EntityErrorFallbackProps {
    readonly error: Error;
    readonly resetErrorBoundary: () => void;
    readonly entityName?: string;
    readonly entityId?: string;
}

const EntityErrorFallback: React.FC<EntityErrorFallbackProps> = ({
    error,
    resetErrorBoundary,
    entityName = 'item',
    entityId
}) => {
    const queryClient = useQueryClient();
    const router = useRouter();

    /**
     * Handle retry with cache invalidation
     */
    const handleRetryWithRefresh = () => {
        if (entityName && entityId) {
            // Invalidate related queries
            queryClient.invalidateQueries({
                queryKey: [entityName]
            });
        }
        resetErrorBoundary();
    };

    /**
     * Navigate back to list
     */
    const handleGoBack = () => {
        router.history.back();
    };

    /**
     * Navigate to home
     */
    const handleGoHome = () => {
        router.navigate({ to: '/' });
    };

    /**
     * Determine error type and message
     */
    const getErrorInfo = () => {
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            return {
                title: `${entityName.charAt(0).toUpperCase() + entityName.slice(1)} Not Found`,
                message: `The ${entityName} you're looking for doesn't exist or may have been deleted.`,
                type: 'not-found' as const
            };
        }

        if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
            return {
                title: 'Access Denied',
                message: `You don't have permission to view this ${entityName}.`,
                type: 'forbidden' as const
            };
        }

        if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            return {
                title: 'Connection Error',
                message: 'Unable to connect to the server. Please check your internet connection.',
                type: 'network' as const
            };
        }

        return {
            title: 'Something Went Wrong',
            message: `An error occurred while loading the ${entityName}. Please try again.`,
            type: 'generic' as const
        };
    };

    const errorInfo = getErrorInfo();

    return (
        <div className="flex min-h-[400px] items-center justify-center p-6">
            <div className="w-full max-w-md text-center">
                {/* Error Icon */}
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                    <svg
                        className="h-8 w-8 text-red-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-label="Error icon"
                    >
                        <title>Error</title>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                    </svg>
                </div>

                {/* Error Title */}
                <h2 className="mb-2 font-semibold text-gray-900 text-lg">{errorInfo.title}</h2>

                {/* Error Message */}
                <p className="mb-6 text-gray-600">{errorInfo.message}</p>

                {/* Entity ID (if available) */}
                {entityId && <p className="mb-4 font-mono text-gray-500 text-sm">ID: {entityId}</p>}

                {/* Action Buttons */}
                <div className="space-y-3">
                    {errorInfo.type === 'network' && (
                        <button
                            type="button"
                            onClick={handleRetryWithRefresh}
                            className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            Retry with Refresh
                        </button>
                    )}

                    {errorInfo.type !== 'not-found' && (
                        <button
                            type="button"
                            onClick={resetErrorBoundary}
                            className="w-full rounded-md bg-gray-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                        >
                            Try Again
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleGoBack}
                        className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        Go Back
                    </button>

                    <button
                        type="button"
                        onClick={handleGoHome}
                        className="w-full text-blue-600 text-sm transition-colors hover:text-blue-800"
                    >
                        Return to Dashboard
                    </button>
                </div>

                {/* Development Error Details */}
                {process.env.NODE_ENV === 'development' && (
                    <details className="mt-6 text-left">
                        <summary className="cursor-pointer text-gray-500 text-sm">
                            Error Details (Development)
                        </summary>
                        <pre className="mt-2 overflow-auto rounded bg-gray-100 p-3 text-red-600 text-xs">
                            {error.stack || error.message}
                        </pre>
                    </details>
                )}
            </div>
        </div>
    );
};

/**
 * Props for EntityErrorBoundary component
 */
interface EntityErrorBoundaryProps {
    readonly children: React.ReactNode;
    readonly entityName?: string;
    readonly entityId?: string;
    readonly onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    readonly fallback?: React.ComponentType<EntityErrorFallbackProps>;
}

/**
 * Basic Error Boundary implementation
 */
class BasicErrorBoundary extends React.Component<
    {
        readonly children: React.ReactNode;
        readonly fallback: React.ComponentType<EntityErrorFallbackProps>;
        readonly entityName?: string;
        readonly entityId?: string;
        readonly onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    },
    { hasError: boolean; error?: Error }
> {
    constructor(props: BasicErrorBoundary['props']) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error for monitoring
        adminLogger.error(
            `Entity Error Boundary caught error: ${error.message}`,
            `Entity: ${this.props.entityName}, ID: ${this.props.entityId}, Stack: ${error.stack}`
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
                    entityName={this.props.entityName}
                    entityId={this.props.entityId}
                />
            );
        }

        return this.props.children;
    }
}

/**
 * Error boundary specifically designed for entity-related components
 * Provides context-aware error handling and recovery options
 */
export const EntityErrorBoundary: React.FC<EntityErrorBoundaryProps> = ({
    children,
    entityName,
    entityId,
    onError,
    fallback: FallbackComponent = EntityErrorFallback
}) => {
    return (
        <BasicErrorBoundary
            fallback={FallbackComponent}
            entityName={entityName}
            entityId={entityId}
            onError={onError}
        >
            {children}
        </BasicErrorBoundary>
    );
};

/**
 * Higher-order component to wrap components with EntityErrorBoundary
 */
export const withEntityErrorBoundary = <P extends Record<string, unknown>>(
    Component: React.ComponentType<P>,
    options: {
        readonly entityName?: string;
        readonly getEntityId?: (props: P) => string | undefined;
        readonly onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    } = {}
) => {
    const WrappedComponent = (props: P) => {
        const entityId = options.getEntityId?.(props);

        return (
            <EntityErrorBoundary
                entityName={options.entityName}
                entityId={entityId}
                onError={options.onError}
            >
                <Component {...props} />
            </EntityErrorBoundary>
        );
    };

    WrappedComponent.displayName = `withEntityErrorBoundary(${Component.displayName || Component.name})`;

    return WrappedComponent;
};
