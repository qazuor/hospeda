import {
    formatSignupWindowEnd,
    isDisplayableCheckoutUrl,
    SIGNUP_CYCLE_LABEL_KEY,
    type SignupPendingAttempt
} from '@/lib/billing/signup-checkout';
import { formatPrice } from '@/lib/format-utils';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import styles from './SignupCheckout.module.css';

/** Present the pending attempt returned by signupNotice and its available actions. */
export function PendingAttemptPanel({
    attempt,
    locale,
    busy,
    onCancel
}: {
    readonly attempt: SignupPendingAttempt;
    readonly locale: SupportedLocale;
    readonly busy: boolean;
    readonly onCancel: () => void;
}) {
    const { t } = createTranslations(locale);
    const resumeHref = resolveSafeExternalUrl(
        attempt.checkoutUrl && isDisplayableCheckoutUrl({ checkoutUrl: attempt.checkoutUrl })
            ? attempt.checkoutUrl
            : undefined
    );
    const amount = formatPrice({
        amount: attempt.plan.amount / 100,
        currency: attempt.plan.currency,
        locale,
        showDecimals: attempt.plan.amount % 100 !== 0
    });
    const cycle = t(SIGNUP_CYCLE_LABEL_KEY[attempt.plan.cycle]);
    const date = formatSignupWindowEnd({ iso: attempt.authorizationWindowEndsAt, locale });

    return (
        <div
            className={styles.pendingAttempt}
            data-testid="signup-checkout-pending-attempt"
            data-subscription-id={attempt.subscriptionId}
        >
            <h1>{t('billing.checkout.signup.pendingAttempt.title')}</h1>
            <p>
                {t('billing.checkout.signup.pendingAttempt.body', undefined, {
                    plan: attempt.plan.name,
                    amount,
                    cycle,
                    date
                })}
            </p>
            {resumeHref && (
                <a
                    data-testid="signup-checkout-pending-attempt-resume"
                    href={resumeHref}
                    rel="noopener noreferrer"
                >
                    {t('billing.checkout.signup.pendingAttempt.resume')}
                </a>
            )}
            <button
                type="button"
                data-testid="signup-checkout-pending-attempt-cancel"
                disabled={busy}
                onClick={onCancel}
            >
                {busy
                    ? t('billing.checkout.signup.pendingAttempt.cancelling')
                    : t('billing.checkout.signup.pendingAttempt.cancel')}
            </button>
        </div>
    );
}
