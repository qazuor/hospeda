import { useTranslations } from '@/hooks/use-translations';
import { reportComponentError } from '@/lib/errors';
import { showErrorToast, showInfoToast } from '@/lib/errors';
import { AlertTriangleIcon } from '@repo/icons';
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
    const { t } = useTranslations();

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
     * Report error to support
     */
    const handleReportError = () => {
        const errorReport = {
            message: error.message,
            stack: error.stack,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        };

        // Report error to monitoring system
        reportComponentError(error, error.stack, 'GlobalErrorBoundary');

        // Copy to clipboard and show toast notification
        navigator.clipboard
            .writeText(JSON.stringify(errorReport, null, 2))
            .then(() => {
                showInfoToast(
                    'Error Copied',
                    'Error details copied to clipboard. Please share with support.'
                );
            })
            .catch(() => {
                showErrorToast({
                    error: new Error('Clipboard access denied'),
                    title: 'Copy Failed',
                    description: 'Unable to copy error details. Please take a screenshot.',
                    report: false
                });
            });
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
            <div className="w-full max-w-lg text-center">
                {/* Error Icon */}
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                    <AlertTriangleIcon
                        size={40}
                        weight="bold"
                        className="text-destructive"
                        aria-label="Global error icon"
                    />
                </div>

                {/* Error Title */}
                <h1 className="mb-4 font-bold text-2xl text-foreground">
                    {t('admin-common.errorBoundary.global.title')}
                </h1>

                {/* Error Message */}
                <p className="mb-6 text-muted-foreground">
                    {t('admin-common.errorBoundary.global.description')}
                </p>

                {/* Action Buttons */}
                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={resetErrorBoundary}
                        className="w-full rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                        {t('admin-common.errorBoundary.actions.tryAgain')}
                    </button>

                    <button
                        type="button"
                        onClick={handleReload}
                        className="w-full rounded-md border border-border bg-background px-4 py-3 font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                        {t('admin-common.errorBoundary.actions.reloadPage')}
                    </button>

                    <button
                        type="button"
                        onClick={handleGoHome}
                        className="w-full text-primary transition-colors hover:text-primary/80"
                    >
                        {t('admin-common.errorBoundary.actions.returnToDashboard')}
                    </button>
                </div>

                {/* Report Error Button */}
                <div className="mt-8 border-border border-t pt-6">
                    <button
                        type="button"
                        onClick={handleReportError}
                        className="text-muted-foreground text-sm transition-colors hover:text-foreground"
                    >
                        {t('admin-common.errorBoundary.actions.reportError')}
                    </button>
                </div>

                {/* Development Error Details */}
                {process.env.NODE_ENV === 'development' && (
                    <details className="mt-6 text-left">
                        <summary className="cursor-pointer text-muted-foreground text-sm">
                            {t('admin-common.errorBoundary.devOnly.title')}
                        </summary>
                        <div className="mt-4 rounded-md bg-muted p-4">
                            <h4 className="font-medium text-foreground text-sm">
                                {t('admin-common.errorBoundary.devOnly.errorMessage')}:
                            </h4>
                            <p className="mt-1 text-destructive text-sm">{error.message}</p>

                            {error.stack && (
                                <>
                                    <h4 className="mt-4 font-medium text-foreground text-sm">
                                        {t('admin-common.errorBoundary.devOnly.stackTrace')}:
                                    </h4>
                                    <pre className="mt-1 overflow-auto text-destructive text-xs">
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
        // Report error to monitoring system
        reportComponentError(error, errorInfo.componentStack ?? undefined, 'GlobalErrorBoundary');

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
