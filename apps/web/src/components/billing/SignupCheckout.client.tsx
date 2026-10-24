import { useId, useMemo, useState } from 'react';
import type { StartSubscriptionResponse } from '@/lib/api/endpoints-protected';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import {
    formatSignupWindowEnd,
    resolveDeclaredPayerEmail,
    resolveSignupPendingAttempt,
    resolveSignupPlanName,
    resolveSignupRejection,
    SIGNUP_CYCLE_LABEL_KEY,
    SIGNUP_VERTICAL_LABEL_KEY,
    type SignupPendingAttempt,
    type SignupPlanSummary,
    type SignupTouristVipNotice,
    type SignupTrialNotice
} from '@/lib/billing/signup-checkout';
import { formatPrice } from '@/lib/format-utils';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import { PendingAttemptPanel } from './PendingAttemptPanel';
import styles from './SignupCheckout.module.css';

/** Props for the minimum protected signup checkout island. */
export interface SignupCheckoutProps {
    readonly locale: SupportedLocale;
    readonly billingOptionId: string;
    readonly accountEmail: string;
    readonly plansHref: string;
    readonly trialNotice: SignupTrialNotice | null;
    readonly touristVipNotice: SignupTouristVipNotice | null;
    readonly planSummary: SignupPlanSummary | null;
    readonly pendingAttempt: SignupPendingAttempt | null;
}

const TOURIST_VIP_NOTICE_KEY: Record<SignupTouristVipNotice['kind'], string> = {
    CANCELLED_ON_RETURN: 'billing.checkout.signup.touristVipNotice.cancelledOnReturn',
    CANCELLED_ON_ACTIVATION: 'billing.checkout.signup.touristVipNotice.cancelledOnActivation',
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
    accountEmail,
    plansHref,
    trialNotice,
    touristVipNotice,
    planSummary,
    pendingAttempt
}: SignupCheckoutProps) {
    const [view, setView] = useState<CheckoutView>({ state: 'idle' });
    const [activePendingAttempt, setActivePendingAttempt] = useState(pendingAttempt);
    const [pendingAttemptCancelled, setPendingAttemptCancelled] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [payerEmail, setPayerEmail] = useState(accountEmail);
    const [payerEmailError, setPayerEmailError] = useState(false);
    const payerEmailInputId = useId();
    const payerEmailHelpId = useId();
    const payerEmailErrorId = useId();
    const { t, tPlural } = useMemo(() => createTranslations(locale), [locale]);

    const start = async () => {
        if (view.state === 'submitting' || view.state === 'pending') return;
        const resolvedEmail = resolveDeclaredPayerEmail({ value: payerEmail });
        if (!resolvedEmail.ok) {
            setPayerEmailError(true);
            return;
        }
        setView({ state: 'submitting' });
        try {
            const result = await billingSubscriptionApi.start({
                billingOptionId,
                payerEmail: resolvedEmail.email
            });
            if (!result.ok) {
                if (result.error.status === 409 && result.error.reason === 'COMMITMENT_TAKEN') {
                    try {
                        const notice = await billingSubscriptionApi.signupNotice({
                            billingOptionId
                        });
                        const found = resolveSignupPendingAttempt({ result: notice });
                        if (found) {
                            setActivePendingAttempt(found);
                            setView({ state: 'idle' });
                            return;
                        }
                    } catch {
                        // Preserve the existing rejection when the refresh cannot be read.
                    }
                }
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

    const cancelPendingAttempt = async () => {
        if (!activePendingAttempt || cancelling) return;
        setCancelling(true);
        try {
            const result = await billingSubscriptionApi.cancelPendingAttempt({
                subscriptionId: activePendingAttempt.subscriptionId
            });
            if (result.ok) {
                setActivePendingAttempt(null);
                setPendingAttemptCancelled(true);
                setView({ state: 'idle' });
                return;
            }
            setView({
                state: 'rejected',
                rejection: resolveSignupRejection({ error: result.error })
            });
        } catch {
            setView({ state: 'rejected', rejection: resolveSignupRejection({}) });
        } finally {
            setCancelling(false);
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
            {view.state !== 'pending' && !activePendingAttempt && (
                <>
                    <h1>{t('billing.checkout.signup.title')}</h1>
                    <p>{t('billing.checkout.signup.intro')}</p>
                </>
            )}
            {activePendingAttempt && view.state === 'idle' && (
                <PendingAttemptPanel
                    attempt={activePendingAttempt}
                    locale={locale}
                    busy={cancelling}
                    onCancel={() => void cancelPendingAttempt()}
                />
            )}
            {pendingAttemptCancelled && (
                <p data-testid="signup-checkout-pending-attempt-cancelled">
                    {t('billing.checkout.signup.pendingAttempt.cancelled')}
                </p>
            )}
            {(view.state === 'idle' || view.state === 'submitting') && !activePendingAttempt ? (
                <>
                    {planSummary && (
                        <div
                            className={styles.planSummary}
                            data-testid="signup-checkout-plan-summary"
                        >
                            {t('billing.checkout.signup.planSummary', undefined, {
                                plan: resolveSignupPlanName({ plan: planSummary, t }),
                                amount: formatPrice({
                                    amount: planSummary.amount / 100,
                                    currency: planSummary.currency,
                                    locale,
                                    showDecimals: planSummary.amount % 100 !== 0
                                }),
                                cycle: t(SIGNUP_CYCLE_LABEL_KEY[planSummary.cycle])
                            })}
                        </div>
                    )}
                    <div className={styles.payerEmailField}>
                        <label
                            className={styles.payerEmailLabel}
                            htmlFor={payerEmailInputId}
                        >
                            {t('billing.checkout.signup.payerEmail.label')}
                        </label>
                        <input
                            id={payerEmailInputId}
                            className={styles.payerEmailInput}
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            data-testid="signup-checkout-payer-email"
                            value={payerEmail}
                            aria-invalid={payerEmailError}
                            aria-describedby={`${payerEmailHelpId}${payerEmailError ? ` ${payerEmailErrorId}` : ''}`}
                            onChange={(event) => {
                                setPayerEmail(event.currentTarget.value);
                                setPayerEmailError(false);
                            }}
                            onBlur={(event) => {
                                setPayerEmailError(
                                    !resolveDeclaredPayerEmail({ value: event.currentTarget.value })
                                        .ok
                                );
                            }}
                        />
                        <p
                            className={styles.payerEmailHint}
                            id={payerEmailHelpId}
                        >
                            {t('billing.checkout.signup.payerEmail.hint')}
                        </p>
                        {payerEmailError && (
                            <p
                                className={styles.payerEmailError}
                                id={payerEmailErrorId}
                                role="alert"
                            >
                                {t('billing.checkout.signup.payerEmail.invalid')}
                            </p>
                        )}
                    </div>
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
                            {touristVipNotice.kind === 'CANCELLED_ON_ACTIVATION' ? (
                                <p>
                                    {touristVipNotice.paidUntil
                                        ? t(
                                              'billing.checkout.signup.touristVipNotice.cancelledOnActivationUntil',
                                              undefined,
                                              {
                                                  date: formatSignupWindowEnd({
                                                      iso: touristVipNotice.paidUntil,
                                                      locale
                                                  })
                                              }
                                          )
                                        : t(TOURIST_VIP_NOTICE_KEY[touristVipNotice.kind])}
                                </p>
                            ) : touristVipNotice.kind === 'UNKNOWN' ? (
                                <>
                                    <p>{t(TOURIST_VIP_NOTICE_KEY[touristVipNotice.kind])}</p>
                                    <p>
                                        {t(
                                            'billing.checkout.signup.touristVipNotice.unknownOnActivation'
                                        )}
                                    </p>
                                </>
                            ) : (
                                <p>{t(TOURIST_VIP_NOTICE_KEY[touristVipNotice.kind])}</p>
                            )}
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
