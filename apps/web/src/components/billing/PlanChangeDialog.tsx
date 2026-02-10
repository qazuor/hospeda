/**
 * PlanChangeDialog Component
 *
 * Dialog for changing subscription plans. Displays available plans with
 * price differences, upgrade/downgrade warnings, and handles plan changes
 * via the QZPay subscription mutation.
 *
 * @module components/billing/PlanChangeDialog
 */

'use client';

import { useTranslations } from '@repo/i18n';
import { type ReactElement, useEffect, useMemo, useState } from 'react';

/**
 * Props for PlanChangeDialog component
 */
export interface PlanChangeDialogProps {
    /**
     * Whether the dialog is open
     */
    isOpen: boolean;

    /**
     * Callback to close the dialog
     */
    onClose: () => void;

    /**
     * Current plan ID
     */
    currentPlanId: string;

    /**
     * Current plan price in cents (for price difference calculation)
     */
    currentPlanPrice: number;

    /**
     * Subscription ID to update
     */
    subscriptionId: string;

    /**
     * Customer ID for the subscription
     */
    customerId: string;

    /**
     * Optional plan category filter ('owner' | 'tourist')
     * If provided, only plans matching this category will be shown
     */
    category?: string;

    /**
     * Callback after successful plan change
     */
    onSuccess?: () => void;
}

/**
 * Format currency amount to ARS format
 *
 * @param amountInCents - Amount in cents
 * @returns Formatted currency string
 */
function formatCurrency(amountInCents: number): string {
    const amountInPesos = amountInCents / 100;
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
    }).format(amountInPesos);
}

/**
 * Calculate price difference between current and target plan
 *
 * @param currentPrice - Current plan price in cents
 * @param targetPrice - Target plan price in cents
 * @returns Object with difference amount and whether it's an upgrade
 */
function calculatePriceDifference(
    currentPrice: number,
    targetPrice: number
): { difference: number; isUpgrade: boolean } {
    const difference = targetPrice - currentPrice;
    return {
        difference: Math.abs(difference),
        isUpgrade: difference > 0
    };
}

/**
 * Plan type for display
 */
interface DisplayPlan {
    id: string;
    name: string;
    description: string;
    slug: string;
    prices: Array<{ amount: number }>;
    interval: string;
    metadata?: { category?: string };
}

/**
 * Result type for usePlans hook
 */
interface UsePlansResult {
    plans: DisplayPlan[];
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

/**
 * Hook wrapper to safely use usePlans with fallback
 * Returns empty data if not in QZPayProvider context
 */
function usePlansOrFallback(): UsePlansResult {
    try {
        // Dynamic require for conditional hook import with graceful degradation
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { usePlans } = require('@qazuor/qzpay-react');
        return usePlans({ activeOnly: true });
    } catch {
        // Not in QZPayProvider context - return empty result
        return {
            plans: [],
            isLoading: false,
            error: null,
            refetch: async () => {}
        };
    }
}

/**
 * Result type for useSubscription hook
 */
interface UseSubscriptionResult {
    update: (subscriptionId: string, data: { planId: string }) => Promise<void>;
    cancel: (subscriptionId: string, options?: { cancelAtPeriodEnd?: boolean }) => Promise<void>;
    resume: (subscriptionId: string) => Promise<void>;
}

/**
 * Hook wrapper to safely use useSubscription with fallback
 * Returns no-op functions if not in QZPayProvider context
 */
function useSubscriptionOrFallback(customerId: string): UseSubscriptionResult {
    try {
        // Dynamic require for conditional hook import
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useSubscription } = require('@qazuor/qzpay-react');
        return useSubscription({ customerId });
    } catch {
        // Not in QZPayProvider context - return no-op result
        return {
            update: async () => {
                throw new Error('Billing context not available');
            },
            cancel: async () => {
                throw new Error('Billing context not available');
            },
            resume: async () => {
                throw new Error('Billing context not available');
            }
        };
    }
}

/**
 * PlanChangeDialog Component
 *
 * Displays a modal dialog for changing subscription plans.
 * Shows available plans with price differences and warnings.
 *
 * @param props - Component props
 * @returns React element with plan change dialog
 *
 * @example
 * ```tsx
 * import { PlanChangeDialog } from '@/components/billing';
 *
 * function MyComponent() {
 *   const [isOpen, setIsOpen] = useState(false);
 *
 *   return (
 *     <>
 *       <button onClick={() => setIsOpen(true)}>Change plan</button>
 *       <PlanChangeDialog
 *         isOpen={isOpen}
 *         onClose={() => setIsOpen(false)}
 *         currentPlanId="plan_123"
 *         currentPlanPrice={999900}
 *         subscriptionId="sub_123"
 *         customerId="cus_123"
 *         category="owner"
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function PlanChangeDialog({
    isOpen,
    onClose,
    currentPlanId,
    currentPlanPrice,
    subscriptionId,
    customerId,
    category,
    onSuccess
}: PlanChangeDialogProps): ReactElement | null {
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [isChanging, setIsChanging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);

    const { t } = useTranslations();

    // Fetch available plans using QZPay hook with graceful fallback
    const {
        plans: rawPlans,
        isLoading: plansLoading,
        error: plansError,
        refetch: refetchPlans
    } = usePlansOrFallback();

    // Get subscription mutation for updating plan with graceful fallback
    const { update: updateSubscription } = useSubscriptionOrFallback(customerId);

    // Filter and map plans based on category
    const plansData: DisplayPlan[] = useMemo(() => {
        if (!rawPlans || !Array.isArray(rawPlans)) return [];

        const filtered = category
            ? rawPlans.filter((p) => p.metadata?.category === category)
            : rawPlans;

        return filtered.map((p) => ({
            id: p.id,
            name: p.name || '',
            description: p.description || '',
            slug: p.slug || p.id,
            prices: p.prices || [{ amount: 0 }],
            interval: p.interval || 'month',
            metadata: p.metadata
        }));
    }, [rawPlans, category]);

    // Reset state when dialog closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedPlanId(null);
            setError(null);
            setShowSuccess(false);
        }
    }, [isOpen]);

    // Don't render if not open
    if (!isOpen) {
        return null;
    }

    // Find the selected plan to get its slug for the API call
    const selectedPlan = useMemo(
        () => plansData.find((p) => p.id === selectedPlanId),
        [plansData, selectedPlanId]
    );

    /**
     * Handle plan change confirmation
     * Calls the QZPay subscription update API to change the plan
     */
    const handleConfirm = async () => {
        if (!selectedPlanId || !selectedPlan) return;

        setIsChanging(true);
        setError(null);

        try {
            // Call the QZPay hook to update the subscription plan
            await updateSubscription(subscriptionId, {
                planId: selectedPlanId
            });

            setShowSuccess(true);

            // Show success message for 2 seconds before closing
            setTimeout(() => {
                setShowSuccess(false);
                onSuccess?.();
                onClose();
            }, 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('billing.plans.error.changeFallback'));
        } finally {
            setIsChanging(false);
        }
    };

    /**
     * Handle retry after error
     */
    const handleRetry = () => {
        setError(null);
        void handleConfirm();
    };

    /**
     * Handle dialog close
     */
    const handleClose = () => {
        if (!isChanging) {
            onClose();
        }
    };

    /**
     * Handle keyboard events
     */
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape' && !isChanging) {
            handleClose();
        }
    };

    // Extract plans array from response
    const plans = Array.isArray(plansData) ? plansData : [];

    // Calculate selected plan price and differences (selectedPlan is already defined via useMemo above)
    const selectedPlanPrice = selectedPlan?.prices?.[0]?.amount || 0;
    const priceDiff = selectedPlan
        ? calculatePriceDifference(currentPlanPrice, selectedPlanPrice)
        : null;
    const isDowngrade = priceDiff && !priceDiff.isUpgrade;

    return (
        <div onKeyDown={handleKeyDown}>
            {/* Backdrop */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop is decorative, close on Escape handled by parent */}
            <div
                className="fixed inset-0 z-40 animate-fade-in bg-black/50"
                onClick={handleClose}
                aria-hidden="true"
            />

            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                // biome-ignore lint/a11y/useSemanticElements: custom dialog overlay with backdrop management
                role="dialog"
                aria-modal="true"
                aria-labelledby="plan-change-dialog-title"
            >
                <div className="max-h-[90vh] w-full max-w-2xl animate-scale-in overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
                    {/* Success State */}
                    {showSuccess ? (
                        <div className="py-4 text-center">
                            {/* Success icon */}
                            <svg
                                className="mx-auto mb-4 h-16 w-16 text-green-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                            >
                                <title>{t('billing.common.success')}</title>
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>

                            <h3 className="mb-2 font-semibold text-gray-900 text-xl">
                                {t('billing.plans.success.title')}
                            </h3>
                            <p className="text-gray-600">{t('billing.plans.success.message')}</p>
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="mb-6">
                                <h2
                                    id="plan-change-dialog-title"
                                    className="mb-2 font-bold text-2xl text-gray-900"
                                >
                                    {t('billing.plans.changeTitle')}
                                </h2>
                                <p className="text-gray-600">
                                    {t('billing.plans.changeDescription')}
                                </p>
                            </div>

                            {/* Loading state */}
                            {plansLoading && (
                                <div className="py-8 text-center">
                                    <svg
                                        className="mx-auto mb-4 h-8 w-8 animate-spin text-primary-600"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                    >
                                        <title>{t('billing.common.loading')}</title>
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    <p className="text-gray-600">
                                        {t('billing.plans.loadingPlans')}
                                    </p>
                                </div>
                            )}

                            {/* Error state (plan fetch) */}
                            {plansError && (
                                <div
                                    className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4"
                                    role="alert"
                                >
                                    <div className="flex items-start gap-2">
                                        <svg
                                            className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            xmlns="http://www.w3.org/2000/svg"
                                            aria-hidden="true"
                                        >
                                            <title>{t('billing.common.error')}</title>
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                        </svg>
                                        <div className="flex-1">
                                            <p className="text-red-800 text-sm">
                                                {t('billing.plans.error.loadPlans')}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => void refetchPlans()}
                                                className="mt-2 font-medium text-red-600 text-sm underline hover:text-red-700"
                                            >
                                                {t('billing.common.retry')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Plans list */}
                            {!plansLoading && !plansError && plans.length > 0 && (
                                <div className="mb-6 space-y-3">
                                    {plans.map((plan) => {
                                        const isCurrentPlan = plan.id === currentPlanId;
                                        const isSelected = plan.id === selectedPlanId;
                                        const planPrice = plan.prices?.[0]?.amount || 0;
                                        const diff = calculatePriceDifference(
                                            currentPlanPrice,
                                            planPrice
                                        );

                                        return (
                                            <button
                                                key={plan.id}
                                                type="button"
                                                onClick={() => setSelectedPlanId(plan.id)}
                                                disabled={isCurrentPlan || isChanging}
                                                className={`w-full rounded-lg border-2 p-4 text-left transition-all${isCurrentPlan ? 'cursor-default border-gray-300 bg-gray-50' : ''}
													${isSelected && !isCurrentPlan ? 'border-primary-500 bg-primary-50' : ''}
													${!isSelected && !isCurrentPlan ? 'border-gray-200 hover:border-primary-300 hover:bg-gray-50' : ''}
													${isChanging ? 'cursor-not-allowed opacity-50' : ''}
												`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="mb-1 flex items-center gap-2">
                                                            <h3 className="font-semibold text-gray-900 text-lg">
                                                                {plan.name}
                                                            </h3>
                                                            {isCurrentPlan && (
                                                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700 text-xs">
                                                                    {t('billing.plans.currentPlan')}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <p className="mb-2 text-gray-600 text-sm">
                                                            {plan.description}
                                                        </p>

                                                        <div className="flex items-baseline gap-2">
                                                            <span className="font-bold text-2xl text-gray-900">
                                                                {formatCurrency(planPrice)}
                                                            </span>
                                                            <span className="text-gray-600">
                                                                {t('billing.common.perMonth')}
                                                            </span>

                                                            {/* Price difference */}
                                                            {!isCurrentPlan && (
                                                                <span
                                                                    className={`font-medium text-sm ${
                                                                        diff.isUpgrade
                                                                            ? 'text-orange-600'
                                                                            : 'text-green-600'
                                                                    }`}
                                                                >
                                                                    {diff.isUpgrade ? '+' : '-'}
                                                                    {formatCurrency(
                                                                        diff.difference
                                                                    )}
                                                                    {t('billing.common.perMonth')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Selection indicator */}
                                                    {isSelected && !isCurrentPlan && (
                                                        <svg
                                                            className="h-6 w-6 flex-shrink-0 text-primary-600"
                                                            fill="currentColor"
                                                            viewBox="0 0 24 24"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            aria-hidden="true"
                                                        >
                                                            <title>
                                                                {t('billing.plans.selected')}
                                                            </title>
                                                            <path
                                                                fillRule="evenodd"
                                                                d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                                                                clipRule="evenodd"
                                                            />
                                                        </svg>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* No plans */}
                            {!plansLoading && !plansError && plans.length === 0 && (
                                <div className="py-8 text-center">
                                    <p className="text-gray-600">
                                        {t('billing.plans.noPlansAvailable')}
                                    </p>
                                </div>
                            )}

                            {/* Downgrade warning */}
                            {isDowngrade && selectedPlanId && (
                                <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                                    <div className="flex gap-3">
                                        <svg
                                            className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            xmlns="http://www.w3.org/2000/svg"
                                            aria-hidden="true"
                                        >
                                            <title>{t('billing.common.warning')}</title>
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                            />
                                        </svg>
                                        <div className="flex-1">
                                            <p className="mb-1 font-medium text-sm text-yellow-800">
                                                {t('billing.plans.downgradeWarning.title')}
                                            </p>
                                            <ul className="list-inside list-disc space-y-1 text-sm text-yellow-700">
                                                <li>
                                                    {t(
                                                        'billing.plans.downgradeWarning.appliedAtEnd'
                                                    )}
                                                </li>
                                                <li>
                                                    {t(
                                                        'billing.plans.downgradeWarning.loseFeatures'
                                                    )}
                                                </li>
                                                <li>
                                                    {t(
                                                        'billing.plans.downgradeWarning.dataPreserved'
                                                    )}
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Error message (mutation) */}
                            {error && (
                                <div
                                    className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4"
                                    role="alert"
                                >
                                    <div className="flex items-start gap-2">
                                        <svg
                                            className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            xmlns="http://www.w3.org/2000/svg"
                                            aria-hidden="true"
                                        >
                                            <title>{t('billing.common.error')}</title>
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                        </svg>
                                        <div className="flex-1">
                                            <p className="text-red-800 text-sm">{error}</p>
                                            <button
                                                type="button"
                                                onClick={handleRetry}
                                                className="mt-2 font-medium text-red-600 text-sm underline hover:text-red-700"
                                            >
                                                {t('billing.common.retry')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={isChanging}
                                    className="flex-1 rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {t('billing.common.cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={!selectedPlanId || isChanging || plansLoading}
                                    className="flex-1 rounded-lg bg-primary-600 px-4 py-2 font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isChanging ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg
                                                className="h-4 w-4 animate-spin"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                aria-hidden="true"
                                            >
                                                <title>{t('billing.common.loading')}</title>
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                />
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                />
                                            </svg>
                                            {t('billing.plans.changing')}
                                        </span>
                                    ) : (
                                        t('billing.plans.confirmChange')
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
