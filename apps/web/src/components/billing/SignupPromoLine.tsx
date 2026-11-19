import type { SignupPlanSummary } from '@/lib/billing/signup-checkout';
import { SIGNUP_CYCLE_LABEL_KEY } from '@/lib/billing/signup-checkout';
import { formatPrice } from '@/lib/format-utils';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './SignupCheckout.module.css';

/** Format minor units the way the rest of the checkout does. */
export function formatSignupAmount({
    amount,
    currency,
    locale
}: {
    readonly amount: number;
    readonly currency: SignupPlanSummary['currency'];
    readonly locale: SupportedLocale;
}): string {
    return formatPrice({
        amount: amount / 100,
        currency,
        locale,
        showDecimals: amount % 100 !== 0
    });
}

/**
 * The line that explains a promo applied to the pending subscription: the code,
 * the amount that will be charged and how many charges it lasts (HOS-2382).
 * Renders nothing when the plan carries no promo, so a plan without one is
 * unchanged. Amounts come from the API; nothing is computed here.
 */
export function SignupPromoLine({
    plan,
    locale
}: {
    readonly plan: SignupPlanSummary;
    readonly locale: SupportedLocale;
}) {
    const promo = plan.promo;
    if (!promo) return null;
    const { t, tPlural } = createTranslations(locale);
    const params = {
        code: promo.codes.join(', '),
        amount: formatSignupAmount({ amount: promo.amount, currency: plan.currency, locale }),
        cycle: t(SIGNUP_CYCLE_LABEL_KEY[plan.cycle]),
        listAmount: formatSignupAmount({ amount: plan.amount, currency: plan.currency, locale })
    };
    return (
        <p
            className={styles.promoLine}
            data-testid="signup-checkout-promo"
        >
            {promo.chargesLeft === null
                ? t('billing.checkout.signup.promo.forever', undefined, params)
                : tPlural('billing.checkout.signup.promo.limited', promo.chargesLeft, {
                      ...params,
                      count: promo.chargesLeft
                  })}
        </p>
    );
}
