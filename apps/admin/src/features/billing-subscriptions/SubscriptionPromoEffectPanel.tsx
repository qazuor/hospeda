/**
 * SubscriptionPromoEffectPanel
 *
 * Renders the active promo-effect block inside SubscriptionDetailsDialog.
 * Handles all effectKind variants: discount (remaining / forever),
 * comp (complimentary), trial_extension, and exhausted.
 *
 * @module features/billing-subscriptions/SubscriptionPromoEffectPanel
 */

import { useTranslations } from '@/hooks/use-translations';
import type { SubscriptionPromoEffectResponse } from '@repo/schemas';
import { formatArs, formatDate } from './utils';

/**
 * Props for SubscriptionPromoEffectPanel
 */
export interface SubscriptionPromoEffectPanelProps {
    /** Promo-effect data returned by the API. `null` while loading. */
    readonly effect: SubscriptionPromoEffectResponse | null;
    /** Whether the promo-effect query is still loading. */
    readonly isLoading: boolean;
    /**
     * Trial end date from the parent subscription.
     * Only used when effectKind === 'trial_extension'.
     */
    readonly trialEnd?: string;
}

/**
 * Renders a "Active promotion" block for the subscription detail dialog.
 *
 * - Returns `null` when there is no promo (`hasPromo === false`) or while loading.
 * - Covers all AC cases from SPEC-262 T-011:
 *   - discount + remainingCycles > 0  → "Discount: -X% for N more cycle(s)"
 *   - discount + durationCycles null  → "Discount: -X% forever"
 *   - comp                           → "Complimentary (never billed)"
 *   - trial_extension                → "Trial extended +N day(s)"
 *   - exhausted (remainingCycles = 0) → "Promo exhausted" (neutral, not error)
 */
export function SubscriptionPromoEffectPanel({
    effect,
    isLoading,
    trialEnd
}: SubscriptionPromoEffectPanelProps) {
    const { t, locale } = useTranslations();

    if (isLoading || !effect || !effect.hasPromo) {
        return null;
    }

    const formattedValue =
        effect.value !== null
            ? effect.valueKind === 'percentage'
                ? `${effect.value}%`
                : formatArs(effect.value / 100, locale)
            : null;

    const renderMessage = () => {
        if (effect.exhausted) {
            return (
                <span className="text-muted-foreground text-sm">
                    {t('admin-billing.subscriptions.promoEffect.exhausted')}
                </span>
            );
        }

        if (effect.effectKind === 'comp') {
            return (
                <span className="font-medium text-secondary-foreground text-sm">
                    {t('admin-billing.subscriptions.promoEffect.complimentary')}
                </span>
            );
        }

        if (effect.effectKind === 'trial_extension') {
            return (
                <span className="text-sm">
                    {t('admin-billing.subscriptions.promoEffect.trialExtended').replace(
                        '{days}',
                        String(effect.extraDays ?? 0)
                    )}
                    {trialEnd && (
                        <span className="ml-1 text-muted-foreground text-xs">
                            ({formatDate(trialEnd, locale)})
                        </span>
                    )}
                </span>
            );
        }

        if (effect.effectKind === 'discount' && formattedValue !== null) {
            if (effect.durationCycles === null) {
                return (
                    <span className="font-medium text-green-700 text-sm dark:text-green-400">
                        {t('admin-billing.subscriptions.promoEffect.discountForever').replace(
                            '{value}',
                            formattedValue
                        )}
                    </span>
                );
            }
            if (effect.remainingCycles !== null && effect.remainingCycles > 0) {
                return (
                    <span className="font-medium text-green-700 text-sm dark:text-green-400">
                        {t('admin-billing.subscriptions.promoEffect.discountForCycles')
                            .replace('{value}', formattedValue)
                            .replace('{count}', String(effect.remainingCycles))}
                    </span>
                );
            }
        }

        return null;
    };

    const message = renderMessage();
    if (message === null) {
        return null;
    }

    return (
        <div>
            <h3 className="mb-2 font-medium text-sm">
                {t('admin-billing.subscriptions.promoEffect.title')}
                {effect.code && (
                    <span className="ml-2 font-mono text-muted-foreground text-xs">
                        ({effect.code})
                    </span>
                )}
            </h3>
            <div className="rounded-md border bg-card p-3">{message}</div>
        </div>
    );
}
