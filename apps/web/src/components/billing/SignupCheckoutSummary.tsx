import { KeyValueList } from '@/components/account/ui/KeyValueList';
import { Section } from '@/components/account/ui/Section';
import {
    resolveSignupPlanName,
    SIGNUP_CYCLE_LABEL_KEY,
    SIGNUP_VERTICAL_LABEL_KEY,
    type SignupPlanSummary
} from '@/lib/billing/signup-checkout';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './SignupCheckout.module.css';
import { formatSignupAmount, SignupPromoLine } from './SignupPromoLine';

/** Checkout facts and the API's promotional total, without synthesizing any amounts. */
export function SignupCheckoutSummary({
    plan,
    locale,
    vertical
}: {
    readonly plan: SignupPlanSummary;
    readonly locale: SupportedLocale;
    readonly vertical: keyof typeof SIGNUP_VERTICAL_LABEL_KEY | null;
}) {
    const { t } = createTranslations(locale);
    return (
        <div
            className={styles.planSummary}
            data-testid="signup-checkout-plan-summary"
        >
            <Section
                title={t('billing.checkout.signup.summary.title')}
                helpId="section:suscripcion.plan"
            >
                <KeyValueList
                    items={[
                        {
                            key: 'plan',
                            label: t('billing.checkout.signup.summary.plan'),
                            value: resolveSignupPlanName({ plan, t })
                        },
                        {
                            key: 'vertical',
                            label: t('billing.checkout.signup.summary.vertical'),
                            value: t(
                                vertical
                                    ? SIGNUP_VERTICAL_LABEL_KEY[vertical]
                                    : 'billing.checkout.signup.vertical.unknown'
                            )
                        },
                        {
                            key: 'cycle',
                            label: t('billing.checkout.signup.summary.period'),
                            value: t(SIGNUP_CYCLE_LABEL_KEY[plan.cycle])
                        },
                        {
                            key: 'total',
                            label: t('billing.checkout.signup.summary.total'),
                            value: (
                                <>
                                    {formatSignupAmount({
                                        amount: plan.promo?.amount ?? plan.amount,
                                        currency: plan.currency,
                                        locale
                                    })}
                                    {plan.promo && (
                                        <del
                                            className={styles.listPrice}
                                            data-testid="signup-checkout-list-price"
                                        >
                                            {formatSignupAmount({
                                                amount: plan.amount,
                                                currency: plan.currency,
                                                locale
                                            })}
                                        </del>
                                    )}
                                </>
                            )
                        }
                    ]}
                />
                <SignupPromoLine
                    plan={plan}
                    locale={locale}
                />
            </Section>
        </div>
    );
}
