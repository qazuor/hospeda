import type { SubscriptionData } from '../../lib/api/endpoints-protected';
import {
    SubscriptionFeaturesList,
    SubscriptionUpgradeCta
} from './SubscriptionFeaturesList.client';
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge.client';
import type { ActionCallback, TFunction } from './subscription-card.types';
import {
    computeTrialDaysRemaining,
    formatArsPrice,
    formatLocalDate
} from './subscription-card.utils';

/** Props for the SubscriptionActiveView component */
interface SubscriptionActiveViewProps {
    readonly subscription: SubscriptionData;
    readonly locale: 'es' | 'en' | 'pt';
    readonly upgradeHref: string;
    readonly t: TFunction;
    readonly features: readonly string[];
    readonly statusLabels: Record<string, string>;
    readonly onChangePlan?: ActionCallback;
    readonly onCancelSubscription?: ActionCallback;
    readonly onReactivate?: ActionCallback;
    readonly onUpdatePayment?: ActionCallback;
}

/**
 * Loaded state view for an authenticated user with an active paid subscription.
 * Renders plan header, price, billing info, features list, and contextual action buttons.
 *
 * @param subscription - Current subscription data from the API
 * @param locale - Locale for date and currency formatting
 * @param upgradeHref - URL for the upgrade/pricing page
 * @param t - Translation function
 * @param features - Array of translated feature description strings
 * @param statusLabels - Map of status keys to translated labels
 * @param onChangePlan - Optional callback for the "change plan" action
 * @param onCancelSubscription - Optional callback for the "cancel" action
 * @param onReactivate - Optional callback for the "reactivate" action
 * @param onUpdatePayment - Optional callback for the "update payment" action
 */
export function SubscriptionActiveView({
    subscription,
    locale,
    upgradeHref,
    t,
    features,
    statusLabels,
    onChangePlan,
    onCancelSubscription,
    onReactivate,
    onUpdatePayment
}: SubscriptionActiveViewProps) {
    const {
        planName,
        status,
        monthlyPriceArs,
        trialEndsAt,
        cancelAtPeriodEnd,
        currentPeriodEnd,
        paymentMethod
    } = subscription;

    const trialDaysRemaining =
        status === 'trial' && trialEndsAt ? computeTrialDaysRemaining(trialEndsAt) : null;

    const formattedPeriodEnd = currentPeriodEnd ? formatLocalDate(currentPeriodEnd, locale) : null;

    const isFree = monthlyPriceArs === 0;

    return (
        <div className="space-y-6">
            {/* Plan header */}
            <div className="space-y-2">
                <h2 className="font-bold text-text text-xl">{planName}</h2>
                <SubscriptionStatusBadge
                    statusKey={status}
                    label={statusLabels[status] ?? status}
                />
            </div>

            {/* Price */}
            <div>
                <p className="font-bold text-2xl text-text">
                    {isFree
                        ? t('subscription.freePlanPrice')
                        : formatArsPrice(monthlyPriceArs, locale)}
                </p>
            </div>

            {/* Trial warning */}
            {trialDaysRemaining !== null && (
                <p className="rounded-md bg-accent/15 px-3 py-2 font-medium text-accent-foreground text-sm">
                    {t('subscription.trialEndsIn', undefined, { days: trialDaysRemaining })}
                </p>
            )}

            {/* Past due warning with grace period countdown */}
            {status === 'past_due' && (
                <div
                    className="rounded-md bg-destructive/10 px-3 py-2"
                    role="alert"
                >
                    <p className="font-medium text-destructive text-sm">
                        {subscription.gracePeriodDaysRemaining != null &&
                        subscription.gracePeriodDaysRemaining > 0
                            ? t('subscription.pastDueNoticeWithDays', undefined, {
                                  days: subscription.gracePeriodDaysRemaining
                              })
                            : subscription.gracePeriodDaysRemaining === 0
                              ? t('subscription.pastDueNoticeLastDay')
                              : t('subscription.pastDueNotice')}
                    </p>
                    <a
                        href={upgradeHref}
                        className="mt-1 inline-block font-semibold text-destructive text-sm underline hover:text-destructive/80"
                    >
                        {t('subscription.updatePaymentMethod')}
                    </a>
                </div>
            )}

            {/* Payment method */}
            {paymentMethod && (
                <div className="space-y-1">
                    <h3 className="font-semibold text-sm text-text-secondary uppercase tracking-wide">
                        {t('subscription.paymentMethodLabel')}
                    </h3>
                    <p className="text-sm text-text">
                        {t('subscription.paymentMethodCard', undefined, {
                            brand:
                                paymentMethod.brand.charAt(0).toUpperCase() +
                                paymentMethod.brand.slice(1),
                            last4: paymentMethod.last4
                        })}
                    </p>
                    <p className="text-text-tertiary text-xs">
                        {t('subscription.paymentMethodExpires', undefined, {
                            month: String(paymentMethod.expMonth).padStart(2, '0'),
                            year: paymentMethod.expYear
                        })}
                    </p>
                </div>
            )}

            {/* Cancellation notice */}
            {cancelAtPeriodEnd && formattedPeriodEnd && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 font-medium text-destructive text-sm">
                    {t('subscription.cancelNotice', undefined, { date: formattedPeriodEnd })}
                </p>
            )}

            {/* Renewal info */}
            {!cancelAtPeriodEnd && status === 'active' && formattedPeriodEnd && (
                <p className="text-sm text-text-tertiary">
                    {t('subscription.renewsOn', undefined, { date: formattedPeriodEnd })}
                </p>
            )}

            <hr className="border-border" />

            {/* Features list */}
            <SubscriptionFeaturesList
                features={features}
                heading={t('subscription.featuresHeading')}
            />

            {/* Upgrade CTA - only for free plan */}
            {isFree && (
                <>
                    <hr className="border-border" />
                    <SubscriptionUpgradeCta
                        heading={t('subscription.upgradeHeading')}
                        description={t('subscription.upgradeDescription')}
                        buttonText={t('subscription.upgradeButton')}
                        href={upgradeHref}
                    />
                </>
            )}

            {/* Action buttons based on subscription status */}
            {!isFree && (
                <>
                    <hr className="border-border" />
                    <div className="flex flex-wrap gap-3">
                        {status === 'active' && (
                            <>
                                {onChangePlan && (
                                    <button
                                        type="button"
                                        onClick={onChangePlan}
                                        className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                                    >
                                        {t('subscription.changePlanButton')}
                                    </button>
                                )}
                                {onCancelSubscription && (
                                    <button
                                        type="button"
                                        onClick={onCancelSubscription}
                                        className="rounded-md border border-destructive/40 px-4 py-2 font-medium text-destructive text-sm transition-colors hover:bg-destructive/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-destructive"
                                    >
                                        {t('subscription.cancelButton')}
                                    </button>
                                )}
                            </>
                        )}
                        {status === 'trial' && onChangePlan && (
                            <button
                                type="button"
                                onClick={onChangePlan}
                                className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                            >
                                {t('subscription.viewPlansButton')}
                            </button>
                        )}
                        {(status === 'cancelled' || status === 'expired') && onReactivate && (
                            <button
                                type="button"
                                onClick={onReactivate}
                                className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                            >
                                {t('subscription.reactivateButton')}
                            </button>
                        )}
                        {status === 'past_due' && onUpdatePayment && (
                            <button
                                type="button"
                                onClick={onUpdatePayment}
                                className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                            >
                                {t('subscription.updatePaymentButton')}
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

/** Props for the SubscriptionFreePlanView component */
interface SubscriptionFreePlanViewProps {
    readonly upgradeHref: string;
    readonly t: TFunction;
    readonly features: readonly string[];
    readonly statusLabels: Record<string, string>;
}

/**
 * Loaded state view for a user with no subscription (free plan fallback).
 * Renders plan header, free price label, features list, and upgrade CTA.
 *
 * @param upgradeHref - URL for the upgrade/pricing page
 * @param t - Translation function
 * @param features - Array of translated feature description strings
 * @param statusLabels - Map of status keys to translated labels
 */
export function SubscriptionFreePlanView({
    upgradeHref,
    t,
    features,
    statusLabels
}: SubscriptionFreePlanViewProps) {
    return (
        <div className="space-y-6">
            {/* Plan header */}
            <div className="space-y-2">
                <h2 className="font-bold text-text text-xl">{t('subscription.freePlanName')}</h2>
                <SubscriptionStatusBadge
                    statusKey="free"
                    label={statusLabels.free ?? 'Free'}
                />
            </div>

            {/* Price */}
            <div>
                <p className="font-bold text-2xl text-text">{t('subscription.freePlanPrice')}</p>
            </div>

            <hr className="border-border" />

            {/* Features list */}
            <SubscriptionFeaturesList
                features={features}
                heading={t('subscription.featuresHeading')}
            />

            <hr className="border-border" />

            {/* Upgrade CTA */}
            <SubscriptionUpgradeCta
                heading={t('subscription.upgradeHeading')}
                description={t('subscription.upgradeDescription')}
                buttonText={t('subscription.upgradeButton')}
                href={upgradeHref}
            />
        </div>
    );
}
