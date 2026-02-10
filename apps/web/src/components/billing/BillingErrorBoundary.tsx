import { defaultLocale, trans } from '@repo/i18n';
import { Component, type ReactNode } from 'react';

/**
 * Props for BillingErrorBoundary component
 */
interface BillingErrorBoundaryProps {
    /**
     * Child components to render
     */
    children: ReactNode;
    /**
     * Optional custom fallback UI to show when error occurs
     */
    fallback?: ReactNode;
}

/**
 * State for BillingErrorBoundary component
 */
interface BillingErrorBoundaryState {
    /**
     * Whether an error has been caught
     */
    hasError: boolean;
    /**
     * The caught error instance
     */
    error: Error | null;
}

/**
 * Error boundary component for billing-related components
 *
 * Catches errors in child components and displays a user-friendly fallback UI.
 * Provides a retry mechanism to reset the error state and attempt re-rendering.
 *
 * @example
 * ```tsx
 * <BillingErrorBoundary>
 *   <PaymentForm />
 * </BillingErrorBoundary>
 * ```
 *
 * @example With custom fallback
 * ```tsx
 * <BillingErrorBoundary fallback={<CustomErrorUI />}>
 *   <SubscriptionPanel />
 * </BillingErrorBoundary>
 * ```
 */
export class BillingErrorBoundary extends Component<
    BillingErrorBoundaryProps,
    BillingErrorBoundaryState
> {
    constructor(props: BillingErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    /**
     * Static lifecycle method to update state when error is caught
     *
     * @param error - The error that was thrown
     * @returns Updated state indicating error occurred
     */
    static getDerivedStateFromError(error: Error): BillingErrorBoundaryState {
        return { hasError: true, error };
    }

    /**
     * Lifecycle method called after error is caught
     * Logs error details to console
     *
     * @param error - The error that was thrown
     * @param errorInfo - Additional error information from React
     */
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error('BillingErrorBoundary caught error:', error, errorInfo);
    }

    /**
     * Resets the error state to allow retry
     */
    handleReset = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div
                    role="alert"
                    className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-8"
                >
                    <h2 className="mb-4 font-semibold text-2xl text-red-800">
                        {trans[defaultLocale]['billing.errorBoundary.title']}
                    </h2>
                    <p className="mb-6 max-w-md text-center text-red-600">
                        {trans[defaultLocale]['billing.errorBoundary.message']}
                    </p>
                    <button
                        type="button"
                        onClick={this.handleReset}
                        className="rounded-md bg-red-600 px-6 py-2 text-white transition-colors hover:bg-red-700"
                    >
                        {trans[defaultLocale]['billing.errorBoundary.tryAgain']}
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
