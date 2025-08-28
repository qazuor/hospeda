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
import { adminLogger } from '@/utils/logger';
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

        // Report error if enabled
        if (this.props.enableReporting) {
            this.reportError(error, errorInfo);
        }

        // Log error in development
        if (process.env.NODE_ENV === 'development') {
            console.error('Route Error Boundary caught an error:', {
                error,
                errorInfo,
                routeName: this.props.routeName
            });
        }
    }

    private reportError = (error: Error, errorInfo: React.ErrorInfo) => {
        // Here you would integrate with your error reporting service
        // e.g., Sentry, LogRocket, etc.

        // In development, log to console
        if (process.env.NODE_ENV === 'development') {
            adminLogger.log(
                {
                    error: error.message,
                    stack: error.stack,
                    componentStack: errorInfo.componentStack,
                    route: this.props.routeName,
                    timestamp: new Date().toISOString()
                },
                'Reporting error to monitoring service'
            );
        }

        // In production, send to monitoring service
        // Example: Sentry.captureException(error, { extra: errorInfo });
    };

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
                    title: 'Update Required',
                    message:
                        'The application has been updated. Please refresh the page to continue.',
                    icon: 'refresh' as const,
                    primaryAction: {
                        label: 'Refresh Page',
                        action: this.handleReload
                    },
                    secondaryAction: {
                        label: 'Go Home',
                        action: this.handleGoHome
                    }
                };

            case 'network':
                return {
                    title: 'Connection Problem',
                    message:
                        'Unable to load the page. Please check your internet connection and try again.',
                    icon: 'alert-triangle' as const,
                    primaryAction: {
                        label: 'Try Again',
                        action: this.handleReload
                    },
                    secondaryAction: {
                        label: 'Go Back',
                        action: this.handleGoBack
                    }
                };

            case 'permission':
                return {
                    title: 'Access Denied',
                    message: `You don't have permission to access ${routeName ? `the ${routeName}` : 'this page'}.`,
                    icon: 'user' as const,
                    primaryAction: {
                        label: 'Go Home',
                        action: this.handleGoHome
                    },
                    secondaryAction: {
                        label: 'Go Back',
                        action: this.handleGoBack
                    }
                };

            default:
                return {
                    title: 'Something went wrong',
                    message: `An unexpected error occurred${routeName ? ` while loading ${routeName}` : ''}. Our team has been notified.`,
                    icon: 'alert-triangle' as const,
                    primaryAction: {
                        label: 'Reload Page',
                        action: this.handleReload
                    },
                    secondaryAction: {
                        label: 'Go Home',
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
                <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8 text-center">
                    <div className="w-full max-w-md">
                        <div className="mb-6 flex justify-center">
                            <div className="rounded-full bg-red-100 p-4">
                                <Icon
                                    name={icon}
                                    size="xl"
                                    variant="error"
                                    ariaLabel="Error"
                                />
                            </div>
                        </div>

                        <h1 className="mb-4 font-bold text-2xl text-gray-900">{title}</h1>

                        <p className="mb-8 text-gray-600">{message}</p>

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
                                <summary className="cursor-pointer text-gray-500 text-sm hover:text-gray-700">
                                    Show Technical Details
                                </summary>
                                <div className="mt-4 rounded bg-gray-100 p-4">
                                    <h3 className="mb-2 font-medium text-gray-900">
                                        Error Message:
                                    </h3>
                                    <p className="mb-4 text-gray-700 text-sm">
                                        {this.state.error.message}
                                    </p>

                                    <h3 className="mb-2 font-medium text-gray-900">Stack Trace:</h3>
                                    <pre className="overflow-auto text-gray-600 text-xs">
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
