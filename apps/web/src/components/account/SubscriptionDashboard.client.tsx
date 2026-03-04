/**
 * Subscription dashboard orchestrator component.
 *
 * Coordinates the SubscriptionCard with action dialogs (ChangePlan, Cancel)
 * and renders the full billing dashboard sections (usage, addons, invoices, payments).
 *
 * @example
 * ```astro
 * <SubscriptionDashboard client:idle locale={locale} />
 * ```
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SubscriptionData } from '../../lib/api/endpoints-protected';
import { billingApi, userApi } from '../../lib/api/endpoints-protected';
import type { SupportedLocale } from '../../lib/i18n';
import { webLogger } from '../../lib/logger';
import { addToast } from '../../store/toast-store';
import { ActiveAddons } from './ActiveAddons.client';
import { CancelSubscriptionDialog } from './CancelSubscriptionDialog.client';
import { ChangePlanDialog } from './ChangePlanDialog.client';
import { InvoiceHistory } from './InvoiceHistory.client';
import { PaymentHistory } from './PaymentHistory.client';
import { SubscriptionCard } from './SubscriptionCard.client';
import { UsageOverview } from './UsageOverview.client';

/** Props for the SubscriptionDashboard component */
interface SubscriptionDashboardProps {
    readonly locale: SupportedLocale;
}

/**
 * Full subscription dashboard with plan card, actions, usage, addons, and history.
 */
export function SubscriptionDashboard({ locale }: SubscriptionDashboardProps) {
    const { t } = useTranslation({ locale, namespace: 'account' });

    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [isChangePlanOpen, setIsChangePlanOpen] = useState(false);
    const [isCancelOpen, setIsCancelOpen] = useState(false);

    /** Fetch subscription data to know current plan slug and status */
    const fetchSubscription = useCallback(async () => {
        try {
            const result = await userApi.getSubscription();
            if (result.ok && result.data) {
                setSubscription(result.data.subscription);
            }
        } catch (err) {
            webLogger.error('Error fetching subscription for dashboard:', err);
        }
    }, []);

    useEffect(() => {
        fetchSubscription();
    }, [fetchSubscription]);

    /** Handle reactivation action */
    const handleReactivate = async () => {
        if (!subscription) return;
        try {
            const result = await billingApi.reactivateSubscription({
                planId: subscription.planSlug
            });
            if (result.ok) {
                addToast({ type: 'success', message: t('subscription.changePlanSuccess') });
                fetchSubscription();
            } else {
                addToast({ type: 'error', message: t('subscription.changePlanError') });
            }
        } catch {
            addToast({ type: 'error', message: t('subscription.changePlanError') });
        }
    };

    /** Handle update payment action (redirect to checkout) */
    const handleUpdatePayment = async () => {
        if (!subscription) return;
        try {
            const result = await billingApi.createCheckout({
                planId: subscription.planSlug,
                billingInterval: 'monthly'
            });
            if (result.ok && result.data?.checkoutUrl) {
                window.location.href = result.data.checkoutUrl;
            } else {
                addToast({ type: 'error', message: t('subscription.changePlanError') });
            }
        } catch {
            addToast({ type: 'error', message: t('subscription.changePlanError') });
        }
    };

    const hasPaidPlan = subscription !== null && subscription.monthlyPriceArs > 0;
    const currentPlanSlug = subscription?.planSlug ?? 'free';

    return (
        <div className="space-y-8">
            {/* Subscription card with action buttons */}
            <SubscriptionCard
                locale={locale as 'es' | 'en' | 'pt'}
                upgradeHref="#"
                onChangePlan={() => setIsChangePlanOpen(true)}
                onCancelSubscription={() => setIsCancelOpen(true)}
                onReactivate={handleReactivate}
                onUpdatePayment={handleUpdatePayment}
            />

            {/* Usage overview */}
            {hasPaidPlan && <UsageOverview locale={locale} />}

            {/* Active add-ons */}
            {hasPaidPlan && <ActiveAddons locale={locale} />}

            {/* Invoice history */}
            {hasPaidPlan && <InvoiceHistory locale={locale} />}

            {/* Payment history */}
            {hasPaidPlan && <PaymentHistory locale={locale} />}

            {/* Change plan dialog */}
            <ChangePlanDialog
                open={isChangePlanOpen}
                onClose={() => {
                    setIsChangePlanOpen(false);
                    fetchSubscription();
                }}
                currentPlanSlug={currentPlanSlug}
                locale={locale}
            />

            {/* Cancel subscription dialog */}
            {subscription && (
                <CancelSubscriptionDialog
                    open={isCancelOpen}
                    onClose={() => {
                        setIsCancelOpen(false);
                        fetchSubscription();
                    }}
                    subscriptionId={subscription.planSlug}
                    locale={locale}
                />
            )}
        </div>
    );
}
