/**
 * @file CommercePlanChange.client.tsx
 * @description Tier-upgrade CTA + flow for an owner who already holds a
 * commerce subscription for one vertical (HOS-1119, second half — the first
 * half is the checkout-time picker in `CommercePlanPicker`/
 * `CommerceListingActions`).
 *
 * Mounted once per vertical the owner already subscribes to
 * (`mi-cuenta/comercio/index.astro` — see that file's doc for why this is
 * mounted THERE rather than on `mi-cuenta/suscripcion`). Renders nothing when
 * there is no costlier tier to move to: a vertical with only one active tier
 * (experience, today) or an owner already on the top tier both degrade to no
 * CTA at all, matching "commerce supports upgrades only" — the UI never
 * offers a move the API would 422.
 *
 * Reuses {@link CommercePlanPicker} pre-filtered to tiers STRICTLY costlier
 * than the current one — the picker itself has no notion of "current plan",
 * so that filtering happens here, once, from `plans` + `currentPlanSlug`.
 */

import type { JSX } from 'react';
import { useState } from 'react';
import { Dialog } from '@/components/shared/ui/Dialog.client';
import { storePendingCheckoutSubId } from '@/lib/billing/checkout-pending';
import type { CommerceVertical } from '@/lib/commerce/owner-listings';
import { changeCommercePlan } from '@/lib/commerce/owner-listings';
import type { CommercePlanOption } from '@/lib/commerce/plan-options';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './CommercePlanChange.module.css';
import { CommercePlanPicker } from './CommercePlanPicker.client';

/** Props for {@link CommercePlanChange}. */
export interface CommercePlanChangeProps {
    /** Which vertical this subscription belongs to. */
    readonly vertical: CommerceVertical;
    /** Slug of the owner's current tier for this vertical. */
    readonly currentPlanSlug: string;
    /** Display name of the current tier (rendered next to the CTA). */
    readonly currentPlanName: string;
    /** Every active tier of the vertical (unfiltered — this component filters). */
    readonly plans: readonly CommercePlanOption[];
    /** Active locale for translations and price formatting. */
    readonly locale: SupportedLocale;
}

/**
 * CommercePlanChange — "cambiar de plan" CTA + picker for an existing
 * commerce subscription.
 *
 * @param props - {@link CommercePlanChangeProps}.
 */
export function CommercePlanChange({
    vertical,
    currentPlanSlug,
    currentPlanName,
    plans,
    locale
}: CommercePlanChangeProps): JSX.Element | null {
    const { t } = createTranslations(locale);
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const currentPlan = plans.find((plan) => plan.slug === currentPlanSlug);
    // Filtered on PRICE, not on `sortOrder`, because price is the exact
    // predicate the API refuses by: `change-plan.ts` answers 422 when
    // `targetPrice.unitAmount <= currentPrice.unitAmount`. The two agree in
    // today's catalogue, which is precisely why picking the wrong one would go
    // unnoticed — a future tier that sorts later but is not dearer would be
    // offered here and rejected there, and the owner would read a generic
    // "no pudimos cambiar tu plan" for a choice this component handed them.
    const upgradeOptions = currentPlan
        ? plans.filter((plan) => plan.monthlyPriceArs > currentPlan.monthlyPriceArs)
        : [];

    // Nothing to upgrade TO — degrade to no CTA at all (single-tier verticals,
    // or an owner already on the top tier). Matches the checkout picker's own
    // safe degradation with 0/1 available plans.
    if (upgradeOptions.length === 0) {
        return null;
    }

    async function handleConfirm(planSlug: string): Promise<void> {
        setIsSubmitting(true);
        setErrorMessage(null);

        try {
            const result = await changeCommercePlan({ vertical, planSlug });

            if (!result.ok) {
                const key = `commerce.owner.planChange.error.${result.error.status}`;
                setErrorMessage(
                    t(
                        key,
                        t(
                            'commerce.owner.planChange.error.generic',
                            'No pudimos cambiar tu plan. Probá de nuevo más tarde.'
                        )
                    )
                );
                return;
            }

            if (result.data.status === 'pending_payment') {
                storePendingCheckoutSubId(result.data.localSubscriptionId);
                window.location.href = result.data.checkoutUrl;
                return;
            }

            // `active` — applied at once (the subscription was trialing), no
            // charge. Reload so the page re-fetches the new current plan.
            window.location.reload();
        } catch {
            setErrorMessage(
                t(
                    'commerce.owner.planChange.error.generic',
                    'No pudimos cambiar tu plan. Probá de nuevo más tarde.'
                )
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className={styles.summary}>
            <span className={styles.currentPlan}>
                {t('commerce.owner.planChange.currentLabel', 'Plan actual')}
                {': '}
                <strong>{currentPlanName}</strong>
            </span>
            <button
                type="button"
                className={styles.changeCta}
                onClick={() => {
                    setErrorMessage(null);
                    setIsPickerOpen(true);
                }}
            >
                {t('commerce.owner.planChange.cta', 'Cambiar de plan')}
            </button>

            <Dialog
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                ariaLabel={t('commerce.owner.planPicker.title', 'Elegí tu plan')}
                size="md"
            >
                {errorMessage && (
                    <p
                        className={styles.error}
                        role="alert"
                    >
                        {errorMessage}
                    </p>
                )}
                <CommercePlanPicker
                    plans={upgradeOptions}
                    locale={locale}
                    isPending={isSubmitting}
                    onConfirm={(planSlug) => void handleConfirm(planSlug)}
                    onCancel={() => setIsPickerOpen(false)}
                />
            </Dialog>
        </div>
    );
}
