import { useTranslations } from '@/hooks/use-translations';
import { reportComponentError } from '@/lib/errors';
import { AlertTriangleIcon } from '@repo/icons';
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
    const { t } = useTranslations();
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
                title: t('admin-common.errorBoundary.notFound.title'),
                message: t('admin-common.errorBoundary.notFound.description'),
                type: 'not-found' as const
            };
        }

        if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
            return {
                title: t('admin-common.errorBoundary.accessDenied.title'),
                message: t('admin-common.errorBoundary.accessDenied.description'),
                type: 'forbidden' as const
            };
        }

        if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            return {
                title: t('admin-common.errorBoundary.connectionError.title'),
                message: t('admin-common.errorBoundary.connectionError.description'),
                type: 'network' as const
            };
        }

        return {
            title: t('admin-common.errorBoundary.generic.title'),
            message: t('admin-common.errorBoundary.generic.description'),
            type: 'generic' as const
        };
    };

    const errorInfo = getErrorInfo();

    return (
        <div className="flex min-h-[400px] items-center justify-center p-6">
            <div className="w-full max-w-md text-center">
                {/* Error Icon */}
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                    <AlertTriangleIcon
                        size={32}
                        weight="bold"
                        className="text-destructive"
                        aria-label="Error icon"
                    />
                </div>

                {/* Error Title */}
                <h2 className="mb-2 font-semibold text-foreground text-lg">{errorInfo.title}</h2>

                {/* Error Message */}
                <p className="mb-6 text-muted-foreground">{errorInfo.message}</p>

                {/* Entity ID (if available) */}
                {entityId && (
                    <p className="mb-4 font-mono text-muted-foreground text-sm">ID: {entityId}</p>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                    {errorInfo.type === 'network' && (
                        <button
                            type="button"
                            onClick={handleRetryWithRefresh}
                            className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        >
                            {t('admin-common.errorBoundary.actions.retryWithRefresh')}
                        </button>
                    )}

                    {errorInfo.type !== 'not-found' && (
                        <button
                            type="button"
                            onClick={resetErrorBoundary}
                            className="w-full rounded-md bg-secondary px-4 py-2 font-medium text-secondary-foreground text-sm transition-colors hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2"
                        >
                            {t('admin-common.errorBoundary.actions.tryAgain')}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleGoBack}
                        className="w-full rounded-md border border-border bg-background px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                        {t('admin-common.errorBoundary.actions.goBack')}
                    </button>

                    <button
                        type="button"
                        onClick={handleGoHome}
                        className="w-full text-primary text-sm transition-colors hover:text-primary/80"
                    >
                        {t('admin-common.errorBoundary.actions.returnToDashboard')}
                    </button>
                </div>

                {/* Development Error Details */}
                {import.meta.env.DEV && (
                    <details className="mt-6 text-left">
                        <summary className="cursor-pointer text-muted-foreground text-sm">
                            {t('admin-common.errorBoundary.devOnly.title')}
                        </summary>
                        <pre className="mt-2 overflow-auto rounded bg-muted p-3 text-destructive text-xs">
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
        // Report error to monitoring system
        reportComponentError(
            error,
            errorInfo.componentStack ?? undefined,
            `EntityErrorBoundary:${this.props.entityName || 'unknown'}`
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
