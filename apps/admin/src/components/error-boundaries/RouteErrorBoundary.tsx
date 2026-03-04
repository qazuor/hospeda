/**
 * @file Route Error Boundary
 *
 * General error boundary for route-level error handling with:
 * - Route-specific error recovery
 * - Navigation helpers
 * - Error reporting
 * - Fallback UI components
 */

import { Icon } from '@/components/icons';
import { Button } from '@/components/ui-wrapped';
import { reportComponentError } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { Component, type ReactNode } from 'react';

/**
 * Route Error Boundary Props
 */
type RouteErrorBoundaryProps = {
    readonly children: ReactNode;
    readonly routeName?: string;
    readonly fallback?: ReactNode;
    readonly onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    readonly showDetails?: boolean;
    readonly enableReporting?: boolean;
};

/**
 * Route Error Boundary State
 */
type RouteErrorBoundaryState = {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
};

/**
 * Route Error Boundary Component
 *
 * Provides route-level error handling with navigation and recovery options.
 *
 * @example
 * ```tsx
 * <RouteErrorBoundary
 *   routeName="accommodations"
 *   onError={(error) => reportError(error)}
 *   enableReporting
 * >
 *   <AccommodationRoutes />
 * </RouteErrorBoundary>
 * ```
 */
export class RouteErrorBoundary extends Component<
    RouteErrorBoundaryProps,
    RouteErrorBoundaryState
> {
    constructor(props: RouteErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<RouteErrorBoundaryState> {
        return {
            hasError: true,
            error
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({
            errorInfo
        });

        // Call custom error handler
        this.props.onError?.(error, errorInfo);

        // Report error to monitoring system
        if (this.props.enableReporting !== false) {
            reportComponentError(
                error,
                errorInfo.componentStack ?? undefined,
                `RouteErrorBoundary:${this.props.routeName || 'unknown'}`
            );
        }
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    private handleGoBack = () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            this.handleGoHome();
        }
    };

    private getErrorType(): 'chunk' | 'network' | 'permission' | 'generic' {
        const { error } = this.state;

        if (error?.message.includes('Loading chunk') || error?.message.includes('ChunkLoadError')) {
            return 'chunk';
        }

        if (error?.message.includes('network') || error?.message.includes('fetch')) {
            return 'network';
        }

        if (error?.message.includes('403') || error?.message.includes('unauthorized')) {
            return 'permission';
        }

        return 'generic';
    }

    private getErrorContent() {
        const errorType = this.getErrorType();
        const routeName = this.props.routeName;

        switch (errorType) {
            case 'chunk':
                return {
                    title: t('error.boundary.route.updateRequiredTitle'),
                    message: t('error.boundary.route.updateRequiredMessage'),
                    icon: 'refresh' as const,
                    primaryAction: {
                        label: t('error.boundary.route.refreshPage'),
                        action: this.handleReload
                    },
                    secondaryAction: {
                        label: t('error.boundary.route.goHome'),
                        action: this.handleGoHome
                    }
                };

            case 'network':
                return {
                    title: t('error.boundary.route.connectionProblemTitle'),
                    message: t('error.boundary.route.connectionProblemMessage'),
                    icon: 'alert-triangle' as const,
                    primaryAction: {
                        label: t('error.boundary.route.tryAgain'),
                        action: this.handleReload
                    },
                    secondaryAction: {
                        label: t('error.boundary.route.goBack'),
                        action: this.handleGoBack
                    }
                };

            case 'permission':
                return {
                    title: t('error.boundary.route.accessDeniedTitle'),
                    message: routeName
                        ? t('error.boundary.route.accessDeniedMessage', { route: routeName })
                        : t('error.boundary.route.accessDeniedMessageGeneric'),
                    icon: 'user' as const,
                    primaryAction: {
                        label: t('error.boundary.route.goHome'),
                        action: this.handleGoHome
                    },
                    secondaryAction: {
                        label: t('error.boundary.route.goBack'),
                        action: this.handleGoBack
                    }
                };

            default:
                return {
                    title: t('error.boundary.route.genericErrorTitle'),
                    message: routeName
                        ? t('error.boundary.route.genericErrorMessage', { route: routeName })
                        : t('error.boundary.route.genericErrorMessageGeneric'),
                    icon: 'alert-triangle' as const,
                    primaryAction: {
                        label: t('error.boundary.route.refreshPage'),
                        action: this.handleReload
                    },
                    secondaryAction: {
                        label: t('error.boundary.route.goHome'),
                        action: this.handleGoHome
                    }
                };
        }
    }

    render() {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const { title, message, icon, primaryAction, secondaryAction } = this.getErrorContent();

            return (
                <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center">
                    <div className="w-full max-w-md">
                        <div className="mb-6 flex justify-center">
                            <div className="rounded-full bg-destructive/10 p-4">
                                <Icon
                                    name={icon}
                                    size="xl"
                                    variant="error"
                                    ariaLabel="Error"
                                />
                            </div>
                        </div>

                        <h1 className="mb-4 font-bold text-2xl text-foreground">{title}</h1>

                        <p className="mb-8 text-muted-foreground">{message}</p>

                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                            <Button
                                onClick={primaryAction.action}
                                className="w-full sm:w-auto"
                            >
                                {primaryAction.label}
                            </Button>

                            <Button
                                variant="outline"
                                onClick={secondaryAction.action}
                                className="w-full sm:w-auto"
                            >
                                {secondaryAction.label}
                            </Button>
                        </div>

                        {this.props.showDetails && this.state.error && (
                            <details className="mt-8 text-left">
                                <summary className="cursor-pointer text-muted-foreground text-sm hover:text-foreground">
                                    {t('error.boundary.route.showTechnicalDetails')}
                                </summary>
                                <div className="mt-4 rounded bg-muted p-4">
                                    <h3 className="mb-2 font-medium text-foreground">
                                        {t('error.boundary.route.errorMessage')}
                                    </h3>
                                    <p className="mb-4 text-foreground text-sm">
                                        {this.state.error.message}
                                    </p>

                                    <h3 className="mb-2 font-medium text-foreground">
                                        {t('error.boundary.route.stackTrace')}
                                    </h3>
                                    <pre className="overflow-auto text-muted-foreground text-xs">
                                        {this.state.error.stack}
                                    </pre>
                                </div>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
