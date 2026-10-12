import { useMemo, useState } from 'react';
import type { StartSubscriptionResponse } from '@/lib/api/endpoints-protected';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import {
    formatSignupWindowEnd,
    isDisplayableCheckoutUrl,
    resolveSignupRejection,
    SIGNUP_VERTICAL_LABEL_KEY
} from '@/lib/billing/signup-checkout';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './SignupCheckout.module.css';

/** Props for the minimum protected signup checkout island. */
export interface SignupCheckoutProps {
    readonly locale: SupportedLocale;
    readonly billingOptionId: string;
    readonly plansHref: string;
}

type CheckoutView =
    | { readonly state: 'idle' | 'submitting' }
    | { readonly state: 'pending'; readonly data: StartSubscriptionResponse }
    | { readonly state: 'rejected'; readonly rejection: ReturnType<typeof resolveSignupRejection> };

/** Render and start a signup only after an explicit confirmation click. */
export function SignupCheckout({ locale, billingOptionId, plansHref }: SignupCheckoutProps) {
    const [view, setView] = useState<CheckoutView>({ state: 'idle' });
    const { t } = useMemo(() => createTranslations(locale), [locale]);

    const start = async () => {
        if (view.state === 'submitting' || view.state === 'pending') return;
        setView({ state: 'submitting' });
        try {
            const result = await billingSubscriptionApi.start({ billingOptionId });
            if (!result.ok) {
                setView({
                    state: 'rejected',
                    rejection: resolveSignupRejection({ error: result.error })
                });
                return;
            }
            if (!isDisplayableCheckoutUrl({ checkoutUrl: result.data.checkoutUrl })) {
                setView({ state: 'rejected', rejection: resolveSignupRejection({}) });
                return;
            }
            setView({ state: 'pending', data: result.data });
        } catch {
            setView({ state: 'rejected', rejection: resolveSignupRejection({}) });
        }
    };

    const pending = view.state === 'pending' ? view.data : null;
    const rejected = view.state === 'rejected' ? view.rejection : null;
    const busy = view.state === 'submitting';

    return (
        <section
            className={styles.container}
            data-testid="signup-checkout"
            data-state={view.state}
        >
            {view.state !== 'pending' && (
                <>
                    <h1>{t('billing.checkout.signup.title')}</h1>
                    <p>{t('billing.checkout.signup.intro')}</p>
                </>
            )}
            {view.state === 'idle' || view.state === 'submitting' ? (
                <button
                    className={styles.primary}
                    type="button"
                    data-testid="signup-checkout-confirm"
                    disabled={busy}
                    onClick={() => void start()}
                >
                    {busy
                        ? t('billing.checkout.signup.submitting')
                        : t('billing.checkout.signup.confirm')}
                </button>
            ) : null}
            {pending && (
                <div
                    className={styles.message}
                    data-testid="signup-checkout-pending"
                    data-subscription-id={pending.subscriptionId}
                    data-vertical={pending.vertical}
                >
                    <h2>
                        {t('billing.checkout.signup.pending.title', undefined, {
                            vertical: t(
                                SIGNUP_VERTICAL_LABEL_KEY[pending.vertical] ??
                                    'billing.checkout.signup.vertical.unknown'
                            )
                        })}
                    </h2>
                    <a
                        data-testid="signup-checkout-resume-link"
                        href={pending.checkoutUrl}
                        rel="noopener noreferrer"
                    >
                        {t('billing.checkout.signup.pending.resume')}
                    </a>
                    <p>
                        {t('billing.checkout.signup.pending.windowEnds', undefined, {
                            date: formatSignupWindowEnd({
                                iso: pending.authorizationWindowEndsAt,
                                locale
                            })
                        })}
                    </p>
                    <time
                        data-testid="signup-checkout-window-ends"
                        dateTime={pending.authorizationWindowEndsAt}
                    >
                        {formatSignupWindowEnd({ iso: pending.authorizationWindowEndsAt, locale })}
                    </time>
                </div>
            )}
            {rejected && (
                <div
                    className={styles.message}
                    data-testid="signup-checkout-rejection"
                    data-reason={rejected.reason}
                    role="alert"
                >
                    <p>{t(rejected.messageKey)}</p>
                    {rejected.showPlansLink && (
                        <a
                            data-testid="signup-checkout-plans-link"
                            href={plansHref}
                        >
                            {t('billing.checkout.signup.rejection.seePlans')}
                        </a>
                    )}
                    {rejected.retryable && (
                        <button
                            type="button"
                            data-testid="signup-checkout-retry"
                            onClick={() => setView({ state: 'idle' })}
                        >
                            {t('billing.checkout.signup.retry')}
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}
