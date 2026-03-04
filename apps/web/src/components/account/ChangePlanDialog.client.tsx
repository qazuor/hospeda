import { formatCurrency, toBcp47Locale } from '@repo/i18n';
import { CheckIcon } from '@repo/icons';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { billingApi } from '../../lib/api/endpoints-protected';
import type { PlanItem } from '../../lib/api/endpoints-protected';
import type { SupportedLocale } from '../../lib/i18n';
import { addToast } from '../../store/toast-store';
import { Modal } from '../ui/Modal.client';

/**
 * Props for the ChangePlanDialog component
 */
export interface ChangePlanDialogProps {
    /** Whether the dialog is open */
    readonly open: boolean;
    /** Callback to close the dialog */
    readonly onClose: () => void;
    /** Slug of the user's current plan */
    readonly currentPlanSlug: string;
    /** Locale for i18n */
    readonly locale: SupportedLocale;
}

/**
 * Determines a rough tier index for a plan slug to detect downgrades.
 * Higher index = higher tier plan.
 */
function getPlanTierIndex(slug: string): number {
    const tiers = ['free', 'basic', 'starter', 'pro', 'professional', 'business', 'enterprise'];
    const lowerSlug = slug.toLowerCase();
    const found = tiers.findIndex((t) => lowerSlug.includes(t));
    return found === -1 ? 0 : found;
}

/**
 * Dialog for changing the user's subscription plan.
 * Fetches available plans and allows selecting a new one.
 *
 * @example
 * ```tsx
 * <ChangePlanDialog
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   currentPlanSlug="pro"
 *   locale="es"
 * />
 * ```
 */
export function ChangePlanDialog({
    open,
    onClose,
    currentPlanSlug,
    locale
}: ChangePlanDialogProps) {
    const { t } = useTranslation({ locale, namespace: 'account' });

    const [plans, setPlans] = useState<PlanItem[]>([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    /** Get monthly price for a plan */
    const getMonthlyPrice = (plan: PlanItem): number => {
        const monthly = plan.prices.find((p) => p.billingInterval === 'monthly');
        return monthly?.unitAmount ?? 0;
    };

    /** Get currency for a plan */
    const getPlanCurrency = (plan: PlanItem): string => {
        return plan.prices[0]?.currency ?? 'ARS';
    };

    /** Fetch plans when dialog opens */
    const fetchPlans = useCallback(async () => {
        setIsLoadingPlans(true);
        try {
            const result = await billingApi.listPlans();
            if (result.ok && result.data) {
                const items = result.data.items ?? [];
                setPlans([...items]);
            }
        } finally {
            setIsLoadingPlans(false);
        }
    }, []);

    // biome-ignore lint/correctness/useExhaustiveDependencies: fetch only when dialog opens
    useEffect(() => {
        if (open) {
            fetchPlans();
            setSelectedPlanId(null);
        }
    }, [open]);

    /** Handle plan change confirmation */
    const handleConfirm = async () => {
        if (!selectedPlanId) return;
        setIsSubmitting(true);
        try {
            const result = await billingApi.changePlan({
                planId: selectedPlanId,
                billingInterval: 'monthly'
            });
            if (result.ok) {
                addToast({ type: 'success', message: t('subscription.changePlanSuccess') });
                onClose();
            } else {
                addToast({ type: 'error', message: t('subscription.changePlanError') });
            }
        } catch {
            addToast({ type: 'error', message: t('subscription.changePlanError') });
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedPlan = plans.find((p) => p.id === selectedPlanId);
    const isDowngrade =
        selectedPlan !== undefined &&
        getPlanTierIndex(selectedPlan.slug) < getPlanTierIndex(currentPlanSlug);

    return (
        <Modal
            title={t('subscription.changePlanTitle')}
            open={open}
            onClose={onClose}
            locale={locale}
            className="max-w-3xl"
        >
            {/* Loading state */}
            {isLoadingPlans && (
                <div className="flex items-center justify-center py-12">
                    <div className="h-10 w-10 animate-spin rounded-full border-primary border-b-2" />
                </div>
            )}

            {/* Plan grid */}
            {!isLoadingPlans && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {plans.map((plan) => {
                            const isCurrent = plan.slug === currentPlanSlug;
                            const isSelected = plan.id === selectedPlanId;
                            const price = getMonthlyPrice(plan);
                            const currency = getPlanCurrency(plan);

                            return (
                                <button
                                    key={plan.id}
                                    type="button"
                                    disabled={isCurrent}
                                    onClick={() => setSelectedPlanId(plan.id)}
                                    className={`relative rounded-lg border-2 p-4 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                                        isCurrent
                                            ? 'cursor-default border-primary/50 bg-primary/5 opacity-80'
                                            : isSelected
                                              ? 'border-primary bg-primary/5 shadow-md'
                                              : 'border-border bg-surface hover:border-primary/50 hover:shadow-sm'
                                    }`}
                                    aria-pressed={isSelected}
                                    aria-label={`${plan.name}${isCurrent ? ` (${t('subscription.currentPlanBadge')})` : ''}`}
                                >
                                    {/* Current plan badge */}
                                    {isCurrent && (
                                        <span className="absolute top-2 right-2 rounded-full bg-primary px-2 py-0.5 font-medium text-white text-xs">
                                            {t('subscription.currentPlanBadge')}
                                        </span>
                                    )}

                                    {/* Selected checkmark */}
                                    {isSelected && !isCurrent && (
                                        <span className="absolute top-2 right-2 text-primary">
                                            <CheckIcon
                                                size="sm"
                                                weight="bold"
                                                aria-hidden="true"
                                            />
                                        </span>
                                    )}

                                    <h3 className="mb-1 font-semibold text-base text-text">
                                        {plan.name}
                                    </h3>
                                    <p className="mb-3 line-clamp-2 text-text-secondary text-xs">
                                        {plan.description}
                                    </p>
                                    <p className="mb-3 font-bold text-lg text-text">
                                        {price === 0
                                            ? t('subscription.freePlanPrice')
                                            : formatCurrency({
                                                  value: price / 100,
                                                  currency,
                                                  locale: toBcp47Locale(locale)
                                              })}
                                    </p>

                                    {/* Features */}
                                    {plan.features.length > 0 && (
                                        <ul className="space-y-1">
                                            {plan.features.slice(0, 3).map((feature) => (
                                                <li
                                                    key={feature}
                                                    className="flex items-center gap-1.5 text-text-secondary text-xs"
                                                >
                                                    <CheckIcon
                                                        size="xs"
                                                        weight="bold"
                                                        className="shrink-0 text-primary"
                                                        aria-hidden="true"
                                                    />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Downgrade warning */}
                    {isDowngrade && (
                        <div className="rounded-md bg-amber-50 p-3 text-amber-800 text-sm dark:bg-amber-900/20 dark:text-amber-300">
                            {t('subscription.changePlanDowngradeWarning')}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 border-border border-t pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="rounded-md border border-border px-4 py-2 font-medium text-sm text-text transition-colors hover:bg-surface-alt disabled:opacity-50"
                        >
                            {t('profileEdit.cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={!selectedPlanId || isSubmitting}
                            className="rounded-md bg-primary px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
                        >
                            {isSubmitting
                                ? `${t('subscription.changePlanButton')}...`
                                : selectedPlan
                                  ? t('subscription.changePlanConfirm', undefined, {
                                        plan: selectedPlan.name
                                    })
                                  : t('subscription.changePlanButton')}
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
