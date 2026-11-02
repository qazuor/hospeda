import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import {
    RETURN_POLL_INTERVAL_MS,
    RETURN_POLL_MAX_ATTEMPTS,
    type ReturnView,
    resolveRetryPayerEmail,
    resolveReturnView,
    retryCheckout,
    retryNeedsEmailField,
    shouldPollAgain
} from '@/lib/billing/subscription-return';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './SubscriptionReturn.module.css';

/** Props of the Mercado Pago return screen (HOS-1979). */
export interface SubscriptionReturnProps {
    readonly locale: SupportedLocale;
    readonly subscriptionId: string;
    /** Status read server-side on the first render; `null` when that read failed. */
    readonly initialStatus: string | null;
    /** Billing option of the attempt, used by the one-click retry. */
    readonly billingOptionId: string | null;
    /** Account email; only prefills the email field when the attempt stored none. */
    readonly accountEmail: string;
    /** Email the payer declared on the rejected attempt (HOS-1890), when stored. */
    readonly declaredPayerEmail: string | null;
}

/**
 * Result screen shown after the payer returns from Mercado Pago.
 *
 * Reads the real status; while the webhook has not arrived it re-reads on a
 * bounded cadence. A rejected first charge offers ONE explicit button that
 * starts a new checkout for the same option, reusing the declared payer email
 * (or asking for it). There are no automatic retries.
 */
export function SubscriptionReturn({
    locale,
    subscriptionId,
    initialStatus,
    billingOptionId,
    accountEmail,
    declaredPayerEmail
}: SubscriptionReturnProps) {
    const { t } = useMemo(() => createTranslations(locale), [locale]);
    const [status, setStatus] = useState<string | null>(initialStatus);
    const [attempt, setAttempt] = useState(0);
    const [retryMessageKey, setRetryMessageKey] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);
    const [typedEmail, setTypedEmail] = useState(declaredPayerEmail ?? accountEmail);
    const [emailError, setEmailError] = useState(false);
    const retryingRef = useRef(false);
    const emailInputId = useId();
    const needsEmailField = retryNeedsEmailField({ declaredPayerEmail });
    const view: ReturnView = resolveReturnView({
        status,
        pollsExhausted: attempt >= RETURN_POLL_MAX_ATTEMPTS
    });

    useEffect(() => {
        if (!shouldPollAgain({ view, attempt })) return;
        const timer = window.setTimeout(async () => {
            try {
                const result = await billingSubscriptionApi.read({ subscriptionId });
                if (result.ok) setStatus(result.data.status);
            } catch {
                // Keep the last known status; the bounded poll simply moves on.
            }
            setAttempt((current) => current + 1);
        }, RETURN_POLL_INTERVAL_MS);
        return () => window.clearTimeout(timer);
    }, [attempt, view, subscriptionId]);

    // bfcache: coming back from Mercado Pago with the Back button restores this page
    // frozen with the retry button locked. Unlock it when the page is shown again.
    useEffect(() => {
        const onPageShow = (event: PageTransitionEvent) => {
            if (!event.persisted) return;
            retryingRef.current = false;
            setRetrying(false);
        };
        window.addEventListener('pageshow', onPageShow);
        return () => window.removeEventListener('pageshow', onPageShow);
    }, []);

    const onRetry = async () => {
        if (retryingRef.current || !billingOptionId) return;
        const email = resolveRetryPayerEmail({ declaredPayerEmail, typed: typedEmail });
        if (!email.ok) {
            setEmailError(true);
            return;
        }
        retryingRef.current = true;
        setRetrying(true);
        setRetryMessageKey(null);
        const outcome = await retryCheckout({
            start: billingSubscriptionApi.start,
            billingOptionId,
            payerEmail: email.email
        });
        if (outcome.kind === 'redirect') {
            // Stay locked: the browser is leaving for Mercado Pago.
            window.location.href = outcome.url;
            return;
        }
        setRetryMessageKey(outcome.rejection.messageKey);
        retryingRef.current = false;
        setRetrying(false);
    };

    const recheck = (
        <button
            type="button"
            className={styles.action}
            onClick={() => window.location.reload()}
        >
            {t(
                view === 'unknown'
                    ? 'billing.checkout.return.unknown.refresh'
                    : 'billing.checkout.return.stillProcessing.refresh'
            )}
        </button>
    );
    return (
        <section
            className={`${styles.panel} ${view === 'confirmed' ? styles.confirmed : ''}`}
            data-testid="subscription-return"
            data-view={view}
            aria-live="polite"
        >
            <h2>{t(`billing.checkout.return.${view}.title`)}</h2>
            <p>{t(`billing.checkout.return.${view}.body`)}</p>
            {view === 'rejected' && billingOptionId && needsEmailField && (
                <div className={styles.field}>
                    <label htmlFor={emailInputId}>
                        {t('billing.checkout.signup.payerEmail.label')}
                    </label>
                    <input
                        id={emailInputId}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        data-testid="subscription-return-payer-email"
                        value={typedEmail}
                        aria-invalid={emailError}
                        onChange={(event) => {
                            setTypedEmail(event.currentTarget.value);
                            setEmailError(false);
                        }}
                    />
                    {emailError && (
                        <p role="alert">{t('billing.checkout.signup.payerEmail.invalid')}</p>
                    )}
                </div>
            )}
            {view === 'rejected' && billingOptionId && (
                <button
                    type="button"
                    className={styles.action}
                    data-testid="subscription-return-retry"
                    disabled={retrying}
                    onClick={onRetry}
                >
                    {retrying
                        ? t('billing.checkout.return.rejected.retrying')
                        : t('billing.checkout.return.rejected.retry')}
                </button>
            )}
            {retryMessageKey && <p role="alert">{t(retryMessageKey)}</p>}
            {(view === 'stillProcessing' || view === 'unknown') && recheck}
        </section>
    );
}
