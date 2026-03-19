import { useTranslations } from '@/hooks/use-translations';
import { reportComponentError } from '@/lib/errors';
import { AlertTriangleIcon } from '@repo/icons';
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
    const { t } = useTranslations();
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
                title: t('admin-common.errorBoundary.query.networkError.title'),
                message: t('admin-common.errorBoundary.query.networkError.description'),
                showInvalidate: true,
                showClear: false
            };
        }

        if (errorMessage.includes('timeout')) {
            return {
                title: t('admin-common.errorBoundary.query.timeout.title'),
                message: t('admin-common.errorBoundary.query.timeout.description'),
                showInvalidate: true,
                showClear: false
            };
        }

        if (errorMessage.includes('500') || errorMessage.includes('server')) {
            return {
                title: t('admin-common.errorBoundary.query.serverError.title'),
                message: t('admin-common.errorBoundary.query.serverError.description'),
                showInvalidate: true,
                showClear: false
            };
        }

        if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
            return {
                title: t('admin-common.errorBoundary.query.authRequired.title'),
                message: t('admin-common.errorBoundary.query.authRequired.description'),
                showInvalidate: false,
                showClear: true
            };
        }

        return {
            title: t('admin-common.errorBoundary.query.generic.title'),
            message: t('admin-common.errorBoundary.query.generic.description'),
            showInvalidate: true,
            showClear: true
        };
    };

    const errorInfo = getErrorInfo();

    return (
        <div className="flex min-h-[200px] items-center justify-center p-4">
            <div className="w-full max-w-sm text-center">
                {/* Error Icon */}
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950">
                    <AlertTriangleIcon
                        size={24}
                        weight="bold"
                        className="text-orange-600 dark:text-orange-400"
                        aria-label="Query error icon"
                    />
                </div>

                {/* Error Title */}
                <h3 className="mb-2 font-medium text-foreground">{errorInfo.title}</h3>

                {/* Error Message */}
                <p className="mb-4 text-muted-foreground text-sm">{errorInfo.message}</p>

                {/* Query Key (if available and in development) */}
                {import.meta.env.DEV && queryKey && (
                    <p className="mb-3 font-mono text-muted-foreground text-xs">
                        Query: {JSON.stringify(queryKey)}
                    </p>
                )}

                {/* Action Buttons */}
                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={resetErrorBoundary}
                        className="w-full rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                        {t('admin-common.errorBoundary.actions.tryAgain')}
                    </button>

                    {errorInfo.showInvalidate && (
                        <button
                            type="button"
                            onClick={handleRetryWithInvalidation}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 font-medium text-foreground text-sm transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        >
                            {t('admin-common.errorBoundary.query.actions.refreshData')}
                        </button>
                    )}

                    {errorInfo.showClear && (
                        <button
                            type="button"
                            onClick={handleRetryWithClear}
                            className="w-full text-muted-foreground text-sm transition-colors hover:text-foreground"
                        >
                            {t('admin-common.errorBoundary.query.actions.clearCacheRetry')}
                        </button>
                    )}
                </div>

                {/* Development Error Details */}
                {import.meta.env.DEV && (
                    <details className="mt-4 text-left">
                        <summary className="cursor-pointer text-muted-foreground text-xs">
                            {t('admin-common.errorBoundary.devOnly.title')}
                        </summary>
                        <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-destructive text-xs">
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
        // Report error to monitoring system
        reportComponentError(
            error,
            errorInfo.componentStack ?? undefined,
            `QueryErrorBoundary:${this.props.queryKey ? JSON.stringify(this.props.queryKey) : 'unknown'}`
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
