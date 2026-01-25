/**
 * @file Entity Error Boundary
 *
 * Specialized error boundary for entity-related operations with:
 * - Entity-specific error handling
 * - Recovery mechanisms
 * - User-friendly error messages
 * - Logging and reporting
 */

import { Icon } from '@/components/icons';
import { Button } from '@/components/ui-wrapped';
import { reportComponentError } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { Component, type ReactNode } from 'react';

/**
 * Entity Error Boundary Props
 */
type EntityErrorBoundaryProps = {
    readonly children: ReactNode;
    readonly entityName?: string;
    readonly entityId?: string;
    readonly operation?: 'view' | 'edit' | 'create' | 'delete' | 'list';
    readonly fallback?: ReactNode;
    readonly onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    readonly showDetails?: boolean;
};

/**
 * Entity Error Boundary State
 */
type EntityErrorBoundaryState = {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
    retryCount: number;
};

/**
 * Entity Error Boundary Component
 *
 * Provides specialized error handling for entity operations with recovery options.
 *
 * @example
 * ```tsx
 * <EntityErrorBoundary
 *   entityName="accommodation"
 *   entityId="123"
 *   operation="edit"
 *   onError={(error) => console.error('Entity error:', error)}
 * >
 *   <EntityEditPage />
 * </EntityErrorBoundary>
 * ```
 */
export class EntityErrorBoundary extends Component<
    EntityErrorBoundaryProps,
    EntityErrorBoundaryState
> {
    private readonly maxRetries = 3;

    constructor(props: EntityErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            retryCount: 0
        };
    }

    static getDerivedStateFromError(error: Error): Partial<EntityErrorBoundaryState> {
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
        reportComponentError(
            error,
            errorInfo.componentStack ?? undefined,
            `EntityErrorBoundary:${this.props.entityName || 'unknown'}:${this.props.operation || 'unknown'}`
        );
    }

    private handleRetry = () => {
        if (this.state.retryCount < this.maxRetries) {
            this.setState((prevState) => ({
                hasError: false,
                error: null,
                errorInfo: null,
                retryCount: prevState.retryCount + 1
            }));
        }
    };

    private handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            retryCount: 0
        });
    };

    private getOperationText(operation?: string): string {
        if (!operation) return t('error.boundary.operations.access');
        const key = `error.boundary.operations.${operation}` as Parameters<typeof t>[0];
        return t(key) || operation;
    }

    private getErrorMessage(): { title: string; message: string } {
        const { entityName, operation } = this.props;
        const { error } = this.state;
        const entity = entityName || 'elemento';
        const operationText = this.getOperationText(operation);

        // Entity-specific error messages
        if (error?.message.includes('404') || error?.message.includes('not found')) {
            return {
                title: t('error.boundary.entity.notFoundTitle', { entity }),
                message: t('error.boundary.entity.notFoundMessage', { entity })
            };
        }

        if (error?.message.includes('403') || error?.message.includes('unauthorized')) {
            return {
                title: t('error.boundary.entity.accessDeniedTitle'),
                message: t('error.boundary.entity.accessDeniedMessage', {
                    operation: operationText,
                    entity
                })
            };
        }

        if (error?.message.includes('network') || error?.message.includes('fetch')) {
            return {
                title: t('error.boundary.entity.connectionErrorTitle'),
                message: t('error.boundary.entity.connectionErrorMessage')
            };
        }

        if (error?.message.includes('validation')) {
            return {
                title: t('error.boundary.entity.validationErrorTitle'),
                message: t('error.boundary.entity.validationErrorMessage')
            };
        }

        // Generic error message
        return {
            title: t('error.boundary.entity.genericErrorTitle'),
            message: t('error.boundary.entity.genericErrorMessage', {
                operation: operationText,
                entity
            })
        };
    }

    render() {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const { title, message } = this.getErrorMessage();
            const canRetry = this.state.retryCount < this.maxRetries;

            return (
                <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
                    <div className="mb-6 rounded-full bg-red-100 p-4">
                        <Icon
                            name="alert-triangle"
                            size="xl"
                            variant="error"
                            ariaLabel="Error"
                        />
                    </div>

                    <h2 className="mb-2 font-semibold text-gray-900 text-xl">{title}</h2>

                    <p className="mb-6 max-w-md text-gray-600">{message}</p>

                    <div className="flex gap-3">
                        {canRetry && (
                            <Button onClick={this.handleRetry}>
                                <Icon
                                    name="refresh"
                                    size="sm"
                                    className="mr-2"
                                />
                                {t('error.boundary.entity.tryAgain')}
                                {this.state.retryCount > 0 && (
                                    <span className="ml-1 text-xs">
                                        {t('error.boundary.entity.retryCount', {
                                            count: this.state.retryCount,
                                            max: this.maxRetries
                                        })}
                                    </span>
                                )}
                            </Button>
                        )}

                        <Button
                            variant="outline"
                            onClick={this.handleReset}
                        >
                            <Icon
                                name="home"
                                size="sm"
                                className="mr-2"
                            />
                            {t('error.boundary.entity.goBack')}
                        </Button>
                    </div>

                    {this.props.showDetails && this.state.error && (
                        <details className="mt-6 max-w-2xl">
                            <summary className="cursor-pointer text-gray-500 text-sm hover:text-gray-700">
                                {t('error.boundary.entity.showErrorDetails')}
                            </summary>
                            <pre className="mt-2 overflow-auto rounded bg-gray-100 p-4 text-left text-gray-800 text-xs">
                                {this.state.error.stack}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
