/**
 * SubscriptionStatusCard Component
 *
 * Displays the current user's subscription status, including plan details,
 * billing information, and next renewal date. Syncs subscription data to
 * the billing nanostore for global state management.
 *
 * @module components/billing/SubscriptionStatusCard
 */

'use client';

import type { QZPaySubscription } from '@qazuor/qzpay-core';
import { useSubscription } from '@qazuor/qzpay-react';
import { type ReactElement, useEffect, useState } from 'react';
import { updateBillingSubscription } from '../../store/billing';
import { CancelSubscriptionDialog } from './CancelSubscriptionDialog';
import { PlanChangeDialog } from './PlanChangeDialog';

/**
 * Extended subscription type with optional backend-populated fields
 * The base QZPaySubscription type doesn't include plan details,
 * but our backend populates these fields for convenience
 */
interface SubscriptionWithPlanDetails extends QZPaySubscription {
    planName?: string;
    price?: number;
    currency?: string;
}

/**
 * Props for SubscriptionStatusCard component
 */
export interface SubscriptionStatusCardProps {
    /**
     * Billing customer ID to fetch subscription for
     * @example "cus_abc123"
     */
    customerId: string;
}

/**
 * Map subscription status to Spanish labels and colors
 */
interface StatusConfig {
    label: string;
    colorClass: string;
    bgColorClass: string;
    ariaLabel: string;
}

/**
 * Get status configuration based on subscription status
 *
 * @param subscription - QZPay subscription object
 * @returns Status configuration with label and color classes
 */
function getStatusConfig(subscription: SubscriptionWithPlanDetails): StatusConfig {
    // Check if in trial
    if (subscription.status === 'trialing' || subscription.trialEnd) {
        const now = Date.now();
        const trialEnd = subscription.trialEnd ? new Date(subscription.trialEnd).getTime() : 0;

        if (trialEnd > now) {
            return {
                label: 'En prueba',
                colorClass: 'text-blue-700',
                bgColorClass: 'bg-blue-100',
                ariaLabel: 'Suscripción en período de prueba'
            };
        }
    }

    // Map status to config
    const statusMap: Record<string, StatusConfig> = {
        active: {
            label: 'Activa',
            colorClass: 'text-green-700',
            bgColorClass: 'bg-green-100',
            ariaLabel: 'Suscripción activa'
        },
        past_due: {
            label: 'Pago pendiente',
            colorClass: 'text-yellow-700',
            bgColorClass: 'bg-yellow-100',
            ariaLabel: 'Suscripción con pago pendiente'
        },
        canceled: {
            label: 'Cancelada',
            colorClass: 'text-red-700',
            bgColorClass: 'bg-red-100',
            ariaLabel: 'Suscripción cancelada'
        },
        paused: {
            label: 'Pausada',
            colorClass: 'text-gray-700',
            bgColorClass: 'bg-gray-100',
            ariaLabel: 'Suscripción pausada'
        }
    };

    return (
        statusMap[subscription.status] || {
            label: subscription.status,
            colorClass: 'text-gray-700',
            bgColorClass: 'bg-gray-100',
            ariaLabel: `Suscripción en estado: ${subscription.status}`
        }
    );
}

/**
 * Format currency amount to ARS format
 *
 * @param amount - Amount in cents
 * @returns Formatted currency string
 */
function formatCurrency(amount: number): string {
    const amountInPesos = amount / 100;
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
    }).format(amountInPesos);
}

/**
 * Format date to es-AR locale
 *
 * @param dateInput - Date string or Date object
 * @returns Formatted date string
 */
function formatDate(dateInput: string | Date): string {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

    return new Intl.DateTimeFormat('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);
}

/**
 * Calculate days remaining in trial
 *
 * @param trialEnd - Trial end date
 * @returns Number of days remaining
 */
function getDaysRemainingInTrial(trialEnd: Date | string): number {
    const now = Date.now();
    const end = typeof trialEnd === 'string' ? new Date(trialEnd) : trialEnd;
    const diff = end.getTime() - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Check if subscription is in trial
 *
 * @param subscription - QZPay subscription
 * @returns True if in trial
 */
function isInTrial(subscription: SubscriptionWithPlanDetails): boolean {
    if (!subscription.trialEnd) return false;

    const now = Date.now();
    const trialEnd = new Date(subscription.trialEnd).getTime();
    return trialEnd > now;
}

/**
 * Check if subscription is cancelled but still active until period end
 *
 * @param subscription - QZPay subscription
 * @returns True if cancelled but active until end of period
 */
function isCancelledButActive(subscription: SubscriptionWithPlanDetails): boolean {
    return (
        subscription.status === 'canceled' &&
        subscription.cancelAtPeriodEnd === true &&
        !!subscription.currentPeriodEnd
    );
}

/**
 * LoadingSkeleton Component
 *
 * Displays a loading skeleton matching the card layout
 */
function LoadingSkeleton(): ReactElement {
    return (
        <>
            <div
                className="animate-pulse rounded-xl border border-gray-200 bg-white p-6 shadow-md"
                // biome-ignore lint/a11y/useSemanticElements: loading indicator pattern used in tests
                role="status"
                aria-busy="true"
                aria-label="Cargando información de suscripción"
            >
                <div className="mb-4 flex items-start justify-between">
                    <div className="flex-1">
                        <div className="mb-2 h-6 w-3/4 rounded bg-gray-200" />
                        <div className="h-4 w-1/2 rounded bg-gray-200" />
                    </div>
                    <div className="h-6 w-24 rounded-full bg-gray-200" />
                </div>
                <div className="mb-6 space-y-3">
                    <div className="h-4 w-full rounded bg-gray-200" />
                    <div className="h-4 w-5/6 rounded bg-gray-200" />
                </div>
                <div className="flex gap-3">
                    <div className="h-10 flex-1 rounded bg-gray-200" />
                    <div className="h-10 flex-1 rounded bg-gray-200" />
                </div>
            </div>
        </>
    );
}

/**
 * ErrorState Component
 *
 * Displays error state with retry button
 */
function ErrorState(props: { onRetry: () => void }): ReactElement {
    return (
        <div
            className="rounded-xl border-red-400 border-l-4 bg-white p-6 shadow-md"
            role="alert"
        >
            <div className="flex items-start gap-3">
                {/* Error icon */}
                <svg
                    className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                >
                    <title>Error</title>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>

                <div className="flex-1">
                    <h3 className="mb-2 font-semibold text-gray-900 text-lg">
                        No pudimos cargar tu suscripción
                    </h3>
                    <p className="mb-4 text-gray-600">
                        Ocurrió un error al cargar los datos de tu suscripción. Por favor, intentá
                        nuevamente.
                    </p>
                    <button
                        type="button"
                        onClick={props.onRetry}
                        className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * EmptyState Component
 *
 * Displays empty state when user has no subscription
 */
function EmptyState(): ReactElement {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-md">
            <div className="py-8 text-center">
                {/* Empty icon */}
                <svg
                    className="mx-auto mb-4 h-16 w-16 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                >
                    <title>Sin suscripción</title>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                </svg>

                <h3 className="mb-2 font-semibold text-gray-900 text-xl">
                    No tenés suscripción activa
                </h3>
                <p className="mb-6 text-gray-600">
                    Elegí un plan para comenzar a publicar tus alojamientos
                </p>

                <a
                    href="/precios/propietarios"
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                    Ver planes
                    <svg
                        className="ml-2 h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                    >
                        <title>Arrow right</title>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                    </svg>
                </a>
            </div>
        </div>
    );
}

/**
 * TrialState Component
 *
 * Displays trial information with countdown and CTA
 */
function TrialState(props: { subscription: SubscriptionWithPlanDetails }): ReactElement {
    const { subscription } = props;
    const daysRemaining = subscription.trialEnd
        ? getDaysRemainingInTrial(subscription.trialEnd)
        : 0;

    const statusConfig = getStatusConfig(subscription);

    return (
        <div className="rounded-xl border-blue-400 border-l-4 bg-white p-6 shadow-md">
            {/* Status badge */}
            <div className="mb-4 flex items-start justify-between">
                <div className="flex-1">
                    <h3 className="mb-1 font-bold text-2xl text-gray-900">
                        {subscription.planName || 'Plan de prueba'}
                    </h3>
                </div>
                <span
                    className={`inline-flex items-center rounded-full px-3 py-1 font-medium text-sm ${statusConfig.colorClass} ${statusConfig.bgColorClass}`}
                    aria-label={statusConfig.ariaLabel}
                >
                    {statusConfig.label}
                </span>
            </div>

            {/* Trial countdown */}
            <div className="mb-4">
                <p className="text-gray-700 text-lg">
                    Te quedan{' '}
                    <span className="font-bold text-blue-600">
                        {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}
                    </span>{' '}
                    de prueba
                </p>
                <p className="mt-1 text-gray-500 text-sm">No se realizó ningún cobro</p>
            </div>

            {/* CTA */}
            <a
                href="/precios/propietarios"
                className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
                Suscribirse ahora
            </a>
        </div>
    );
}

/**
 * ActiveSubscriptionState Component
 *
 * Displays active subscription with full details
 */
function ActiveSubscriptionState(props: {
    subscription: SubscriptionWithPlanDetails;
    customerId: string;
    onCancelSuccess: () => void;
}): ReactElement {
    const { subscription, customerId, onCancelSuccess } = props;
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [showPlanChangeDialog, setShowPlanChangeDialog] = useState(false);
    const statusConfig = getStatusConfig(subscription);

    // Get subscription ID from subscription object
    const subscriptionId = subscription.id;

    // Determine billing interval
    const billingInterval = subscription.interval === 'year' ? 'Anual' : 'Mensual';

    // Format price
    const priceText = subscription.price
        ? `${formatCurrency(subscription.price)}/${subscription.interval === 'year' ? 'año' : 'mes'}`
        : '';

    return (
        <>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-md">
                {/* Header with plan name and status */}
                <div className="mb-6 flex items-start justify-between">
                    <div className="flex-1">
                        <h3 className="mb-1 font-bold text-2xl text-gray-900">
                            {subscription.planName || 'Plan activo'}
                        </h3>
                        <p className="text-gray-600">{billingInterval}</p>
                    </div>
                    <span
                        className={`inline-flex items-center rounded-full px-3 py-1 font-medium text-sm ${statusConfig.colorClass} ${statusConfig.bgColorClass}`}
                        aria-label={statusConfig.ariaLabel}
                    >
                        {statusConfig.label}
                    </span>
                </div>

                {/* Details */}
                <div className="mb-6 space-y-3">
                    {/* Price */}
                    {priceText && (
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">Precio</span>
                            <span className="font-semibold text-gray-900 text-lg">{priceText}</span>
                        </div>
                    )}

                    {/* Next renewal */}
                    {subscription.currentPeriodEnd && (
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">Próxima renovación</span>
                            <span className="font-medium text-gray-900">
                                {formatDate(subscription.currentPeriodEnd)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                        type="button"
                        onClick={() => setShowPlanChangeDialog(true)}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        Cambiar de plan
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowCancelDialog(true)}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                        Cancelar suscripción
                    </button>
                </div>
            </div>

            {/* Plan change dialog */}
            <PlanChangeDialog
                isOpen={showPlanChangeDialog}
                onClose={() => setShowPlanChangeDialog(false)}
                currentPlanId={subscription.planId || subscription.id}
                currentPlanPrice={subscription.price || 0}
                subscriptionId={subscriptionId}
                customerId={customerId}
                onSuccess={() => {
                    setShowPlanChangeDialog(false);
                    onCancelSuccess();
                }}
            />

            {/* Cancel confirmation dialog */}
            <CancelSubscriptionDialog
                isOpen={showCancelDialog}
                onClose={() => setShowCancelDialog(false)}
                customerId={customerId}
                subscriptionId={subscriptionId}
                planName={subscription.planName}
                onSuccess={() => {
                    setShowCancelDialog(false);
                    onCancelSuccess();
                }}
            />
        </>
    );
}

/**
 * CancelledState Component
 *
 * Displays cancelled subscription pending end of period
 */
function CancelledState(props: {
    subscription: SubscriptionWithPlanDetails;
    customerId: string;
    onReactivateSuccess: () => void;
}): ReactElement {
    const { subscription, customerId, onReactivateSuccess } = props;
    const [isReactivating, setIsReactivating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { resume } = useSubscription({ customerId });

    // Get subscription ID from subscription object
    const subscriptionId = subscription.id;

    /**
     * Handle reactivate subscription
     */
    const handleReactivate = async () => {
        setIsReactivating(true);
        setError(null);

        try {
            await resume(subscriptionId);
            onReactivateSuccess();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'No pudimos reactivar tu suscripción. Por favor, intentá nuevamente.'
            );
        } finally {
            setIsReactivating(false);
        }
    };

    return (
        <div className="rounded-xl border-yellow-400 border-l-4 bg-white p-6 shadow-md">
            <div className="mb-4 flex items-start gap-3">
                {/* Warning icon */}
                <svg
                    className="mt-1 h-6 w-6 flex-shrink-0 text-yellow-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                >
                    <title>Advertencia</title>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                </svg>

                <div className="flex-1">
                    <h3 className="mb-2 font-semibold text-gray-900 text-xl">
                        Suscripción cancelada
                    </h3>
                    <p className="mb-4 text-gray-700">
                        Tu plan se cancelará el{' '}
                        {subscription.currentPeriodEnd && (
                            <span className="font-medium">
                                {formatDate(subscription.currentPeriodEnd)}
                            </span>
                        )}
                        . Podés seguir usándolo hasta esa fecha.
                    </p>

                    {/* Error message */}
                    {error && (
                        <div
                            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3"
                            role="alert"
                        >
                            <p className="text-red-800 text-sm">{error}</p>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleReactivate}
                        disabled={isReactivating}
                        className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isReactivating ? (
                            <span className="flex items-center gap-2">
                                <svg
                                    className="h-4 w-4 animate-spin"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <title>Cargando</title>
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
                                Reactivando...
                            </span>
                        ) : (
                            'Reactivar suscripción'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * SubscriptionStatusCard Component
 *
 * Main component that manages subscription data fetching and state rendering.
 * Automatically syncs fetched subscription to the billing nanostore for use
 * throughout the application.
 *
 * States handled:
 * - Loading: Skeleton card
 * - Error: Error message with retry
 * - Empty: No subscription (CTA to pricing)
 * - Trial: Trial countdown and subscribe CTA
 * - Active: Full subscription details with actions
 * - Cancelled: Cancellation notice with reactivate option
 *
 * @param props - Component props
 * @returns React element displaying subscription status
 *
 * @example
 * ```tsx
 * import { SubscriptionStatusCard } from '@/components/billing';
 *
 * <SubscriptionStatusCard customerId="cus_abc123" />
 * ```
 */
export function SubscriptionStatusCard({ customerId }: SubscriptionStatusCardProps): ReactElement {
    // Fetch subscription data using qzpay-react hook
    const { data, isLoading, error, refetch } = useSubscription({ customerId });

    /**
     * Handle successful cancel/reactivate
     */
    const handleMutationSuccess = () => {
        void refetch();
    };

    // Sync to nanostore when data changes
    useEffect(() => {
        if (data && !Array.isArray(data)) {
            // Single subscription (not array)
            updateBillingSubscription(data);
        } else if (Array.isArray(data) && data.length > 0) {
            // Multiple subscriptions - use first active one
            const activeSubscription = data.find(
                (sub) => sub.status === 'active' || sub.status === 'trialing'
            );
            // data[0] is guaranteed to exist because we check data.length > 0
            updateBillingSubscription(activeSubscription ?? (data[0] as QZPaySubscription));
        } else if (!data || (Array.isArray(data) && data.length === 0)) {
            // No subscription
            updateBillingSubscription(null);
        }
    }, [data]);

    // Loading state
    if (isLoading) {
        return <LoadingSkeleton />;
    }

    // Error state
    if (error) {
        return <ErrorState onRetry={() => void refetch()} />;
    }

    // No subscription (empty state)
    if (!data || (Array.isArray(data) && data.length === 0)) {
        return <EmptyState />;
    }

    // Extract single subscription (handle array or single object)
    // If array, prefer active or trialing subscription
    const subscription: SubscriptionWithPlanDetails | undefined = Array.isArray(data)
        ? data.find((sub) => sub.status === 'active' || sub.status === 'trialing') || data[0]
        : data;

    // Safety check - should not happen due to empty state check above
    if (!subscription) {
        return <EmptyState />;
    }

    // Trial state
    if (isInTrial(subscription)) {
        return <TrialState subscription={subscription} />;
    }

    // Cancelled but still active until period end
    if (isCancelledButActive(subscription)) {
        return (
            <CancelledState
                subscription={subscription}
                customerId={customerId}
                onReactivateSuccess={handleMutationSuccess}
            />
        );
    }

    // Active subscription
    if (subscription.status === 'active') {
        return (
            <ActiveSubscriptionState
                subscription={subscription}
                customerId={customerId}
                onCancelSuccess={handleMutationSuccess}
            />
        );
    }

    // Fallback for other statuses (paused, past_due, etc.)
    return (
        <ActiveSubscriptionState
            subscription={subscription}
            customerId={customerId}
            onCancelSuccess={handleMutationSuccess}
        />
    );
}
