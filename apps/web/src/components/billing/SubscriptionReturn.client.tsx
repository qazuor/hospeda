import { useEffect, useMemo, useRef, useState } from 'react';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import {
    RETURN_POLL_INTERVAL_MS,
    RETURN_POLL_MAX_ATTEMPTS,
    type ReturnView,
    resolveReturnView,
    retryCheckout,
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
    /** Account email, declared on the new authorization. */
    readonly accountEmail: string;
}

/**
 * Result screen shown after the payer returns from Mercado Pago.
 *
 * Reads the real status; while the webhook has not arrived it re-reads on a
 * bounded cadence. A rejected first charge offers ONE explicit button that
 * starts a new checkout for the same option. There are no automatic retries.
 */
export function SubscriptionReturn({
    locale,
    subscriptionId,
    initialStatus,
    billingOptionId,
    accountEmail
}: SubscriptionReturnProps) {
    const { t } = useMemo(() => createTranslations(locale), [locale]);
    const [status, setStatus] = useState<string | null>(initialStatus);
    const [attempt, setAttempt] = useState(0);
    const [retryMessageKey, setRetryMessageKey] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);
    const retryingRef = useRef(false);
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

    const onRetry = async () => {
        if (retryingRef.current || !billingOptionId) return;
        retryingRef.current = true;
        setRetrying(true);
        setRetryMessageKey(null);
        const outcome = await retryCheckout({
            start: billingSubscriptionApi.start,
            billingOptionId,
            payerEmail: accountEmail
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

    return (
        <section
            className={`${styles.panel} ${view === 'confirmed' ? styles.confirmed : ''}`}
            data-testid="subscription-return"
            data-view={view}
            aria-live="polite"
        >
            <h2>{t(`billing.checkout.return.${view}.title`)}</h2>
            <p>{t(`billing.checkout.return.${view}.body`)}</p>
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
            {view === 'stillProcessing' && (
                <button
                    type="button"
                    className={styles.action}
                    onClick={() => window.location.reload()}
                >
                    {t('billing.checkout.return.stillProcessing.refresh')}
                </button>
            )}
        </section>
    );
}
