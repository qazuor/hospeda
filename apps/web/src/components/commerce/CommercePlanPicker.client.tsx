/**
 * @file CommercePlanPicker.client.tsx
 * @description Accessible tier picker for a commerce vertical (HOS-1119).
 *
 * Renders every tier handed to it as a radio group — name, monthly price, and
 * what it adds over the previous (cheaper) tier, derived from the
 * entitlement diff (`deriveCommercePlanTierDiffs`). Labels for each added
 * entitlement are hand-written i18n copy (`entitlement-labels.ts`); the diff
 * itself is derived, never hand-maintained per pair of tiers.
 *
 * Used by two callers, both of which pre-filter `plans` to whatever set makes
 * sense for them — this component has no notion of "current plan":
 *
 * - `CommerceListingActions` (create-checkout flow): every active tier of the
 *   vertical, shown only when the owner is choosing their FIRST subscription.
 * - `CommercePlanChange` (tier-change flow): every tier priced DIFFERENTLY
 *   from the owner's current one — dearer and cheaper both, since HOS-1122.
 *   Only an identically-priced tier is withheld, because that is the one the
 *   API still 422s. That caller also passes {@link CommercePlanPickerProps.planNotes}
 *   so each card says what choosing it actually does, which is not the same
 *   sentence in the two directions: a dearer tier is charged now, a cheaper one
 *   is free and takes effect at period end.
 *
 * Props are a narrow, serializable `CommercePlanOption[]` — never
 * `@repo/billing` or the full `PublicPlanData` — per the static guard
 * (`apps/web/test/static-guards/billing-barrel-client-isolation.test.ts`).
 *
 * Accessibility: a native `<input type="radio">` group (implicit keyboard
 * arrow-key navigation between options, correct `<label>` association via
 * `htmlFor`), wrapped in a `role="radiogroup"` container labelled by the
 * picker's own heading.
 */

import type { JSX } from 'react';
import { useId, useState } from 'react';
import {
    COMMERCE_ENTITLEMENT_FALLBACK_LABEL,
    COMMERCE_ENTITLEMENT_I18N_SUFFIX
} from '@/lib/commerce/entitlement-labels';
import { type CommercePlanOption, deriveCommercePlanTierDiffs } from '@/lib/commerce/plan-options';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { getIntlLocale } from '@/lib/pricing-plans';
import styles from './CommercePlanPicker.module.css';

/** Props for {@link CommercePlanPicker}. */
export interface CommercePlanPickerProps {
    /** The tiers to offer — already filtered/sorted by the caller. */
    readonly plans: readonly CommercePlanOption[];
    /** Active locale for translations and price formatting. */
    readonly locale: SupportedLocale;
    /** Called with the chosen tier's slug when the owner confirms. */
    readonly onConfirm: (planSlug: string) => void;
    /** Called when the owner dismisses the picker without choosing. */
    readonly onCancel: () => void;
    /** Disables all interaction while a request driven by a previous confirm is in flight. */
    readonly isPending?: boolean;
    /**
     * Optional per-tier note, keyed by slug, rendered under that tier's card
     * (HOS-1122).
     *
     * Plain data rather than a render callback so the picker stays free of any
     * notion of "current plan" — it renders a string somebody else decided.
     * The checkout flow passes nothing and is unchanged; the tier-change flow
     * passes the direction copy, including the date a downgrade takes effect,
     * which only it can know.
     */
    readonly planNotes?: Readonly<Record<string, string>>;
}

/**
 * Format ARS centavos as a locale-aware currency string.
 *
 * @param cents - Price in ARS centavos.
 * @param intlLocale - BCP47 tag from {@link getIntlLocale}.
 * @returns A formatted price string (e.g. "$15.000").
 */
function formatArsPrice(cents: number, intlLocale: string): string {
    const pesos = cents / 100;
    try {
        return new Intl.NumberFormat(intlLocale, {
            style: 'currency',
            currency: 'ARS',
            maximumFractionDigits: 0,
            minimumFractionDigits: 0
        }).format(pesos);
    } catch {
        return `$${pesos.toLocaleString('es-AR')}`;
    }
}

/**
 * CommercePlanPicker — radio-group tier selector shared by the create-checkout
 * and tier-upgrade commerce flows.
 *
 * @param props - {@link CommercePlanPickerProps}.
 */
export function CommercePlanPicker({
    plans,
    locale,
    onConfirm,
    onCancel,
    isPending = false,
    planNotes
}: CommercePlanPickerProps): JSX.Element {
    const { t } = createTranslations(locale);
    const groupName = useId();
    const titleId = useId();
    const intlLocale = getIntlLocale(locale);

    const tierDiffs = deriveCommercePlanTierDiffs(plans);
    const [selectedSlug, setSelectedSlug] = useState<string | null>(
        tierDiffs[0]?.plan.slug ?? null
    );

    function handleConfirm(): void {
        if (!selectedSlug || isPending) {
            return;
        }
        onConfirm(selectedSlug);
    }

    return (
        <div className={styles.root}>
            <h2
                id={titleId}
                className={styles.title}
            >
                {t('commerce.owner.planPicker.title', 'Elegí tu plan')}
            </h2>
            <p className={styles.subtitle}>
                {t(
                    'commerce.owner.planPicker.subtitle',
                    'Podés cambiar de plan más adelante desde tu cuenta.'
                )}
            </p>

            <div
                role="radiogroup"
                aria-labelledby={titleId}
                className={styles.list}
            >
                {tierDiffs.map(({ plan, addedEntitlements }) => {
                    const inputId = `${groupName}-${plan.slug}`;
                    const isSelected = selectedSlug === plan.slug;
                    return (
                        <label
                            key={plan.slug}
                            htmlFor={inputId}
                            className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                        >
                            <input
                                type="radio"
                                id={inputId}
                                name={groupName}
                                value={plan.slug}
                                checked={isSelected}
                                onChange={() => setSelectedSlug(plan.slug)}
                                disabled={isPending}
                                className={styles.radio}
                            />
                            <span className={styles.cardBody}>
                                <span className={styles.cardHeader}>
                                    <span className={styles.planName}>{plan.name}</span>
                                    <span className={styles.planPrice}>
                                        {formatArsPrice(plan.monthlyPriceArs, intlLocale)}
                                        <span className={styles.planPriceUnit}>
                                            {t('pricing.period.month', '/mes')}
                                        </span>
                                    </span>
                                </span>
                                {addedEntitlements.length > 0 && (
                                    <ul className={styles.addedList}>
                                        {addedEntitlements.map((key) => (
                                            <li key={key}>
                                                {t(
                                                    `commerce.owner.entitlements.${
                                                        COMMERCE_ENTITLEMENT_I18N_SUFFIX[key] ?? key
                                                    }`,
                                                    COMMERCE_ENTITLEMENT_FALLBACK_LABEL[key] ?? key
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {planNotes?.[plan.slug] !== undefined && (
                                    <span className={styles.planNote}>{planNotes[plan.slug]}</span>
                                )}
                            </span>
                        </label>
                    );
                })}
            </div>

            <div className={styles.footer}>
                <button
                    type="button"
                    className={styles.btnCancel}
                    onClick={onCancel}
                    disabled={isPending}
                >
                    {t('common.cancel', 'Cancelar')}
                </button>
                <button
                    type="button"
                    className={styles.btnConfirm}
                    onClick={handleConfirm}
                    disabled={isPending || !selectedSlug}
                    aria-busy={isPending}
                >
                    {t('commerce.owner.planPicker.confirm', 'Continuar')}
                </button>
            </div>
        </div>
    );
}
