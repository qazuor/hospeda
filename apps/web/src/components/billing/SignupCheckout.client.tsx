import { useMemo, useState } from 'react';
import type { StartSubscriptionResponse } from '@/lib/api/endpoints-protected';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import {
    formatSignupWindowEnd,
    resolveSignupRejection,
    SIGNUP_VERTICAL_LABEL_KEY,
    type SignupTouristVipNotice,
    type SignupTrialNotice
} from '@/lib/billing/signup-checkout';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import styles from './SignupCheckout.module.css';

/** Props for the minimum protected signup checkout island. */
export interface SignupCheckoutProps {
    readonly locale: SupportedLocale;
    readonly billingOptionId: string;
    readonly plansHref: string;
    readonly trialNotice: SignupTrialNotice | null;
    readonly touristVipNotice: SignupTouristVipNotice | null;
}

const TOURIST_VIP_NOTICE_KEY: Record<SignupTouristVipNotice['kind'], string> = {
    CANCELLED_ON_RETURN: 'billing.checkout.signup.touristVipNotice.cancelledOnReturn',
    UNKNOWN: 'billing.checkout.signup.touristVipNotice.unknown'
};

type CheckoutView =
    | { readonly state: 'idle' | 'submitting' }
    | { readonly state: 'pending'; readonly data: StartSubscriptionResponse }
    | { readonly state: 'rejected'; readonly rejection: ReturnType<typeof resolveSignupRejection> };

/** Render and start a signup only after an explicit confirmation click. */
export function SignupCheckout({
    locale,
    billingOptionId,
    plansHref,
    trialNotice,
    touristVipNotice
}: SignupCheckoutProps) {
    const [view, setView] = useState<CheckoutView>({ state: 'idle' });
    const { t, tPlural } = useMemo(() => createTranslations(locale), [locale]);

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
            setView({ state: 'pending', data: result.data });
        } catch {
            setView({ state: 'rejected', rejection: resolveSignupRejection({}) });
        }
    };

    const pending = view.state === 'pending' ? view.data : null;
    const safeCheckoutUrl = pending ? resolveSafeExternalUrl(pending.checkoutUrl) : undefined;
    const rejected = view.state === 'rejected' ? view.rejection : null;
    const busy = view.state === 'submitting';

    return (
        <section
            className={styles.container}
            data-testid="signup-checkout"
            data-state={view.state}
            data-tourist-vip={touristVipNotice?.kind ?? 'NOT_AFFECTED'}
        >
            {view.state !== 'pending' && (
                <>
                    <h1>{t('billing.checkout.signup.title')}</h1>
                    <p>{t('billing.checkout.signup.intro')}</p>
                </>
            )}
            {view.state === 'idle' || view.state === 'submitting' ? (
                <>
                    {trialNotice && (
                        <div
                            className={styles.trialNotice}
                            data-testid="signup-checkout-trial-notice"
                            data-kind={trialNotice.kind}
                            role="note"
                        >
                            {trialNotice.kind === 'RUNNING' ? (
                                <>
                                    <p>
                                        {tPlural(
                                            'billing.checkout.signup.trialNotice.running',
                                            trialNotice.daysLeft,
                                            {
                                                days: trialNotice.daysLeft,
                                                date: formatSignupWindowEnd({
                                                    iso: trialNotice.endsAt,
                                                    locale
                                                })
                                            }
                                        )}
                                    </p>
                                    <p>{t('billing.checkout.signup.trialNotice.endsOnCharge')}</p>
                                    <p>{t('billing.checkout.signup.trialNotice.keepsOnDecline')}</p>
                                </>
                            ) : (
                                <p>{t('billing.checkout.signup.trialNotice.unknown')}</p>
                            )}
                        </div>
                    )}
                    {touristVipNotice && (
                        <div
                            className={styles.trialNotice}
                            data-testid="signup-checkout-tourist-vip-notice"
                            role="note"
                        >
                            <p>{t(TOURIST_VIP_NOTICE_KEY[touristVipNotice.kind])}</p>
                        </div>
                    )}
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
                </>
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
                    {safeCheckoutUrl && (
                        <a
                            data-testid="signup-checkout-resume-link"
                            href={resolveSafeExternalUrl(pending.checkoutUrl)}
                            rel="noopener noreferrer"
                        >
                            {t('billing.checkout.signup.pending.resume')}
                        </a>
                    )}
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
