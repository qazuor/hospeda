import { formatCurrency, formatDate, toBcp47Locale } from '@repo/i18n';
import { AlertTriangleIcon, CheckIcon, RefreshIcon } from '@repo/icons';
/**
 * Subscription card component displaying the user's current plan and billing info.
 *
 * Fetches subscription data from the protected API endpoint and renders the
 * current plan status. Handles loading, error, and loaded states.
 *
 * @example
 * ```tsx
 * <SubscriptionCard locale="es" upgradeHref="/es/precios/turistas" />
 * ```
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SubscriptionData } from '../../lib/api/endpoints-protected';
import { userApi } from '../../lib/api/endpoints-protected';
import type { SupportedLocale } from '../../lib/i18n';
import { webLogger } from '../../lib/logger';

/** Props for the SubscriptionCard component */
interface SubscriptionCardProps {
    readonly locale: 'es' | 'en' | 'pt';
    readonly upgradeHref: string;
    readonly onChangePlan?: () => void;
    readonly onCancelSubscription?: () => void;
    readonly onReactivate?: () => void;
    readonly onUpdatePayment?: () => void;
}

/** Stable keys for skeleton feature rows (avoids index key lint warning) */
const SKELETON_FEATURE_KEYS = ['feat-1', 'feat-2', 'feat-3', 'feat-4'] as const;

/** Status badge color classes by subscription status */
const STATUS_BADGE_CLASSES: Readonly<Record<SubscriptionData['status'] | 'free', string>> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    trial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    expired: 'bg-surface-alt text-text-secondary',
    past_due: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    free: 'bg-surface-alt text-text-secondary'
} as const;

/**
 * Format a date string as a localized long date using @repo/i18n.
 */
function formatLocalDate(dateString: string, locale: string): string {
    return formatDate({
        date: dateString,
        locale: toBcp47Locale(locale),
        options: { year: 'numeric', month: 'long', day: 'numeric' }
    });
}

/**
 * Format an ARS price as a localized currency string using @repo/i18n.
 * Example output: "$1.500 ARS/mes"
 */
function formatArsPrice(amount: number, locale: string): string {
    const formatted = formatCurrency({
        value: amount,
        locale: toBcp47Locale(locale),
        currency: 'ARS'
    });
    return `${formatted}/mes`;
}

/**
 * Compute remaining trial days from a trialEndsAt ISO string.
 * Returns 0 if the date is in the past.
 */
function computeTrialDaysRemaining(trialEndsAt: string): number {
    const remaining = Math.ceil(
        (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, remaining);
}

/** Props for the StatusBadge sub-component */
interface StatusBadgeProps {
    readonly statusKey: SubscriptionData['status'] | 'free';
    readonly label: string;
}

/**
 * Accessible status pill badge.
 * Uses both color AND visible text (WCAG requirement - not color alone).
 */
function StatusBadge({ statusKey, label }: StatusBadgeProps) {
    const colorClasses = STATUS_BADGE_CLASSES[statusKey];
    return (
        <output
            className={`inline-block rounded-full px-2 py-1 font-medium text-sm ${colorClasses}`}
        >
            {label}
        </output>
    );
}

/** Props for the FeaturesList sub-component */
interface FeaturesListProps {
    readonly features: readonly string[];
    readonly heading: string;
}

/**
 * Semantic features list with check icons.
 */
function FeaturesList({ features, heading }: FeaturesListProps) {
    return (
        <div className="space-y-3">
            <h3 className="font-semibold text-sm text-text-secondary uppercase tracking-wide">
                {heading}
            </h3>
            <ul className="space-y-2">
                {features.map((feature) => (
                    <li
                        key={feature}
                        className="flex items-center gap-2 text-sm text-text-secondary"
                    >
                        <CheckIcon
                            size="xs"
                            weight="bold"
                            className="shrink-0 text-green-500"
                            aria-hidden="true"
                        />
                        {feature}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** Props for the UpgradeCTA sub-component */
interface UpgradeCtaProps {
    readonly heading: string;
    readonly description: string;
    readonly buttonText: string;
    readonly href: string;
}

/**
 * Upgrade call-to-action section for free plan users.
 */
function UpgradeCta({ heading, description, buttonText, href }: UpgradeCtaProps) {
    return (
        <div className="space-y-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 p-4">
            <h3 className="font-semibold text-text">{heading}</h3>
            <p className="text-sm text-text-secondary">{description}</p>
            <a
                href={href}
                className="mt-2 inline-block rounded-md bg-primary px-4 py-2 font-semibold text-sm text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
            >
                {buttonText}
            </a>
        </div>
    );
}

/** Translation function type used by sub-components */
type TFunction = (key: string, fallback?: string, params?: Record<string, unknown>) => string;

/** Callback type for subscription action buttons */
type ActionCallback = () => void;

/**
 * Loaded state for an authenticated user with an active paid subscription.
 */
interface ActiveSubscriptionViewProps {
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

function ActiveSubscriptionView({
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
}: ActiveSubscriptionViewProps) {
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
                <StatusBadge
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
                <p className="rounded-md bg-amber-50 px-3 py-2 font-medium text-amber-800 text-sm dark:bg-amber-900/20 dark:text-amber-300">
                    {t('subscription.trialEndsIn', undefined, { days: trialDaysRemaining })}
                </p>
            )}

            {/* Past due warning with grace period countdown */}
            {status === 'past_due' && (
                <div
                    className="rounded-md bg-red-50 px-3 py-2 dark:bg-red-900/20"
                    role="alert"
                >
                    <p className="font-medium text-red-700 text-sm dark:text-red-300">
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
                        className="mt-1 inline-block font-semibold text-red-700 text-sm underline hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
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
                <p className="rounded-md bg-red-50 px-3 py-2 font-medium text-red-700 text-sm dark:bg-red-900/20 dark:text-red-300">
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
            <FeaturesList
                features={features}
                heading={t('subscription.featuresHeading')}
            />

            {/* Upgrade CTA - only for free plan */}
            {isFree && (
                <>
                    <hr className="border-border" />
                    <UpgradeCta
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
                                        className="rounded-md bg-primary px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                                    >
                                        {t('subscription.changePlanButton')}
                                    </button>
                                )}
                                {onCancelSubscription && (
                                    <button
                                        type="button"
                                        onClick={onCancelSubscription}
                                        className="rounded-md border border-red-300 px-4 py-2 font-medium text-red-600 text-sm transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
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
                                className="rounded-md bg-primary px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                            >
                                {t('subscription.viewPlansButton')}
                            </button>
                        )}
                        {(status === 'cancelled' || status === 'expired') && onReactivate && (
                            <button
                                type="button"
                                onClick={onReactivate}
                                className="rounded-md bg-primary px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                            >
                                {t('subscription.reactivateButton')}
                            </button>
                        )}
                        {status === 'past_due' && onUpdatePayment && (
                            <button
                                type="button"
                                onClick={onUpdatePayment}
                                className="rounded-md bg-primary px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
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

/**
 * Loaded state for a user with no subscription (free plan fallback).
 */
interface FreePlanViewProps {
    readonly upgradeHref: string;
    readonly t: TFunction;
    readonly features: readonly string[];
    readonly statusLabels: Record<string, string>;
}

function FreePlanView({ upgradeHref, t, features, statusLabels }: FreePlanViewProps) {
    return (
        <div className="space-y-6">
            {/* Plan header */}
            <div className="space-y-2">
                <h2 className="font-bold text-text text-xl">{t('subscription.freePlanName')}</h2>
                <StatusBadge
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
            <FeaturesList
                features={features}
                heading={t('subscription.featuresHeading')}
            />

            <hr className="border-border" />

            {/* Upgrade CTA */}
            <UpgradeCta
                heading={t('subscription.upgradeHeading')}
                description={t('subscription.upgradeDescription')}
                buttonText={t('subscription.upgradeButton')}
                href={upgradeHref}
            />
        </div>
    );
}

/**
 * Subscription card React island.
 * Displays the authenticated user's current subscription plan and status.
 * Fetches data on mount and shows appropriate loading, error, or loaded states.
 */
export function SubscriptionCard({
    locale,
    upgradeHref,
    onChangePlan,
    onCancelSubscription,
    onReactivate,
    onUpdatePayment
}: SubscriptionCardProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    const [data, setData] = useState<SubscriptionData | null>(null);

    const { t } = useTranslation({ locale: locale as SupportedLocale, namespace: 'account' });
    const { t: tUi } = useTranslation({ locale: locale as SupportedLocale, namespace: 'ui' });

    const features = [
        t('subscription.feature1'),
        t('subscription.feature2'),
        t('subscription.feature3'),
        t('subscription.feature4')
    ] as const;

    const statusLabels: Record<string, string> = {
        active: t('subscription.statusActive'),
        trial: t('subscription.statusTrial'),
        cancelled: t('subscription.statusCancelled'),
        expired: t('subscription.statusExpired'),
        past_due: t('subscription.statusPastDue'),
        pending: t('subscription.statusPending'),
        free: t('subscription.statusFree')
    };

    const fetchSubscription = useCallback(async () => {
        setIsLoading(true);
        setError(false);

        try {
            const result = await userApi.getSubscription();

            if (result.ok && result.data) {
                setData(result.data.subscription);
            } else {
                setError(true);
            }
        } catch (err) {
            setError(true);
            webLogger.error('Error fetching subscription:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSubscription();
    }, [fetchSubscription]);

    // Loading state
    if (isLoading) {
        return (
            <output
                className="block rounded-lg border border-border p-6"
                aria-busy="true"
                aria-label={t('subscription.loading')}
            >
                <span className="sr-only">{t('subscription.loading')}</span>

                {/* Skeleton placeholder matching the loaded state height */}
                <div className="animate-pulse space-y-4">
                    {/* Plan name skeleton */}
                    <div className="h-6 w-1/3 rounded bg-surface-alt" />

                    {/* Status badge skeleton */}
                    <div className="h-5 w-20 rounded bg-surface-alt" />

                    {/* Price skeleton */}
                    <div className="h-8 w-1/4 rounded bg-surface-alt" />

                    {/* Divider */}
                    <div className="border-border border-t" />

                    {/* Features heading skeleton */}
                    <div className="h-4 w-2/5 rounded bg-surface-alt" />

                    {/* Feature list skeleton */}
                    <div className="space-y-2">
                        {SKELETON_FEATURE_KEYS.map((key) => (
                            <div
                                key={key}
                                className="flex items-center gap-2"
                            >
                                <div className="h-3 w-3 shrink-0 rounded-full bg-surface-alt" />
                                <div className="h-3 w-3/5 rounded bg-surface-alt" />
                            </div>
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="border-border border-t" />

                    {/* Upgrade section skeleton */}
                    <div className="space-y-2">
                        <div className="h-5 w-1/4 rounded bg-surface-alt" />
                        <div className="h-4 w-4/5 rounded bg-surface-alt" />
                        <div className="mt-2 h-10 w-28 rounded bg-surface-alt" />
                    </div>
                </div>

                {/* Visible loading text below skeleton */}
                <div className="mt-6 flex items-center gap-3 border-border border-t pt-4">
                    <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-primary border-b-2" />
                    <span className="text-sm text-text-secondary">{t('subscription.loading')}</span>
                </div>
            </output>
        );
    }

    // Error state with retry button
    if (error) {
        return (
            <div
                className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800/50 dark:bg-red-900/20"
                role="alert"
            >
                <div className="flex flex-col items-center gap-4 text-center">
                    <AlertTriangleIcon
                        size="lg"
                        weight="fill"
                        className="text-red-500 dark:text-red-400"
                        aria-hidden="true"
                    />
                    <p className="font-medium text-red-700 text-sm dark:text-red-400">
                        {t('subscription.loadError')}
                    </p>
                    <button
                        type="button"
                        onClick={fetchSubscription}
                        aria-label={tUi('accessibility.retryLoading')}
                        className="inline-flex items-center gap-2 rounded-md border border-error/30 bg-surface px-4 py-2 font-medium text-error text-sm transition-colors hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2"
                    >
                        <RefreshIcon
                            size="xs"
                            weight="bold"
                            aria-hidden="true"
                        />
                        {t('subscription.retry')}
                    </button>
                </div>
            </div>
        );
    }

    // Loaded state
    return (
        <div className="rounded-lg border border-border p-6 shadow-sm">
            {data !== null ? (
                <ActiveSubscriptionView
                    subscription={data}
                    locale={locale}
                    upgradeHref={upgradeHref}
                    t={t}
                    features={features}
                    statusLabels={statusLabels}
                    onChangePlan={onChangePlan}
                    onCancelSubscription={onCancelSubscription}
                    onReactivate={onReactivate}
                    onUpdatePayment={onUpdatePayment}
                />
            ) : (
                <FreePlanView
                    upgradeHref={upgradeHref}
                    t={t}
                    features={features}
                    statusLabels={statusLabels}
                />
            )}
        </div>
    );
}
