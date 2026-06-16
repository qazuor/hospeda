/**
 * @file PlanPicker.client.tsx
 * @description Step 1 of the plan-change flow (SPEC-203 T-005).
 *
 * Shows the available owner plans, marks the current one, and lets the host
 * select an upgrade or downgrade target. Emits the chosen plan ID + interval
 * to the parent via `onSelect`.
 */

import type { PublicPlanData } from '@/lib/billing/fetch-plans';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './PlanPicker.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The direction of the plan change relative to the current plan. */
type PlanDirection = 'current' | 'upgrade' | 'downgrade';

/** Props for the PlanPicker component. */
export interface PlanPickerProps {
    /** Available plans list to pick from. */
    readonly plans: readonly PublicPlanData[];
    /** Slug of the host's current plan (used to mark it and infer direction). */
    readonly currentPlanSlug: string;
    /** Active locale for i18n. */
    readonly locale: SupportedLocale;
    /** Called when the host confirms a target plan. */
    readonly onSelect: (params: {
        readonly planId: string;
        readonly planSlug: string;
        readonly billingInterval: 'monthly' | 'annual';
        readonly direction: PlanDirection;
    }) => void;
    /** Called when the host dismisses the flow. */
    readonly onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive the change direction for a candidate plan.
 *
 * Uses `sortOrder` as the tier proxy: higher sortOrder = higher tier = upgrade.
 * Falls back to price comparison when sortOrders are equal.
 *
 * @param candidatePlan - Plan being evaluated
 * @param currentPlan - Host's active plan
 * @returns The direction of the change
 */
function getDirection({
    candidatePlan,
    currentPlan
}: {
    readonly candidatePlan: PublicPlanData;
    readonly currentPlan: PublicPlanData;
}): PlanDirection {
    if (candidatePlan.slug === currentPlan.slug) return 'current';
    if (candidatePlan.sortOrder > currentPlan.sortOrder) return 'upgrade';
    if (candidatePlan.sortOrder < currentPlan.sortOrder) return 'downgrade';
    // Equal sortOrder — fall back to price
    if (candidatePlan.monthlyPriceArs > currentPlan.monthlyPriceArs) return 'upgrade';
    if (candidatePlan.monthlyPriceArs < currentPlan.monthlyPriceArs) return 'downgrade';
    return 'current';
}

/**
 * Format ARS cents as a readable price string.
 *
 * @param cents - Price in centavos
 * @returns Human-readable price like "$1.200"
 */
function formatPrice(cents: number): string {
    const pesos = cents / 100;
    return `$${pesos.toLocaleString('es-AR')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PlanPicker — step 1 of the host plan-change flow.
 *
 * Renders one card per available plan. The current plan is marked as such and
 * is not selectable. Other plans show their direction badge (upgrade/downgrade)
 * and have a "Select" button. The host must also choose monthly vs annual
 * billing before confirming.
 *
 * @param props - {@link PlanPickerProps}
 */
export function PlanPicker({
    plans,
    currentPlanSlug,
    locale,
    onSelect,
    onDismiss
}: PlanPickerProps) {
    const { t } = createTranslations(locale);

    const currentPlan = plans.find((p) => p.slug === currentPlanSlug);

    /**
     * Handle plan selection. Uses monthly billing by default; annual only
     * when the plan supports it and is an upgrade. The billing interval
     * selection in the actual confirm step (T-008) is handled separately;
     * here we pick the baseline to pass along.
     */
    function handleSelect({
        plan,
        interval
    }: {
        readonly plan: PublicPlanData;
        readonly interval: 'monthly' | 'annual';
    }) {
        const direction = currentPlan
            ? getDirection({ candidatePlan: plan, currentPlan })
            : 'upgrade';
        onSelect({
            planId: plan.id,
            planSlug: plan.slug,
            billingInterval: interval,
            direction
        });
    }

    return (
        <dialog
            className={styles.root}
            open
            aria-modal="true"
            aria-labelledby="plan-picker-title"
        >
            <div className={styles.header}>
                <h2
                    id="plan-picker-title"
                    className={styles.title}
                >
                    {t('account.pages.subscription.planPicker.title', 'Cambiar plan')}
                </h2>
                <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={onDismiss}
                    aria-label={t('common.close', 'Cerrar')}
                >
                    ×
                </button>
            </div>

            <p className={styles.subtitle}>
                {t(
                    'account.pages.subscription.planPicker.subtitle',
                    'Elegí el plan al que querés cambiar.'
                )}
            </p>

            <ul
                className={styles.planList}
                aria-label={t(
                    'account.pages.subscription.planPicker.listLabel',
                    'Planes disponibles'
                )}
            >
                {plans.map((plan) => {
                    const direction = currentPlan
                        ? getDirection({ candidatePlan: plan, currentPlan })
                        : 'upgrade';
                    const isCurrent = direction === 'current';
                    const hasAnnual = plan.annualPriceArs !== null && plan.annualPriceArs > 0;

                    return (
                        <li
                            key={plan.id}
                            className={`${styles.planCard} ${isCurrent ? styles.planCardCurrent : ''}`}
                        >
                            <div className={styles.planCardInner}>
                                <div className={styles.planInfo}>
                                    <div className={styles.planNameRow}>
                                        <span className={styles.planName}>{plan.name}</span>
                                        {isCurrent && (
                                            <span className={styles.badgeCurrent}>
                                                {t(
                                                    'account.pages.subscription.planPicker.currentBadge',
                                                    'Plan actual'
                                                )}
                                            </span>
                                        )}
                                        {!isCurrent && direction === 'upgrade' && (
                                            <span className={styles.badgeUpgrade}>
                                                {t(
                                                    'account.pages.subscription.planPicker.upgradeBadge',
                                                    'Mejora'
                                                )}
                                            </span>
                                        )}
                                        {!isCurrent && direction === 'downgrade' && (
                                            <span className={styles.badgeDowngrade}>
                                                {t(
                                                    'account.pages.subscription.planPicker.downgradeBadge',
                                                    'Reducción'
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    <p className={styles.planPrice}>
                                        {formatPrice(plan.monthlyPriceArs)}
                                        <span className={styles.planPriceUnit}>
                                            {t('pricing.period.month', '/mes')}
                                        </span>
                                    </p>
                                </div>

                                {!isCurrent && (
                                    <div className={styles.planActions}>
                                        <button
                                            type="button"
                                            className={styles.btnSelect}
                                            onClick={() =>
                                                handleSelect({ plan, interval: 'monthly' })
                                            }
                                        >
                                            {t(
                                                'account.pages.subscription.planPicker.selectMonthly',
                                                'Mensual'
                                            )}
                                        </button>
                                        {hasAnnual && (
                                            <button
                                                type="button"
                                                className={`${styles.btnSelect} ${styles.btnSelectAnnual}`}
                                                onClick={() =>
                                                    handleSelect({ plan, interval: 'annual' })
                                                }
                                            >
                                                {t(
                                                    'account.pages.subscription.planPicker.selectAnnual',
                                                    'Anual'
                                                )}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>

            <div className={styles.footer}>
                <button
                    type="button"
                    className={styles.btnCancel}
                    onClick={onDismiss}
                >
                    {t('common.cancel', 'Cancelar')}
                </button>
            </div>
        </dialog>
    );
}
