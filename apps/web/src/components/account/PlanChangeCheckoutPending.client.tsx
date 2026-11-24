import { useState } from 'react';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import { scheduleSubscriptionRefresh } from '@/lib/billing/refresh-subscription-card';
import { isDisplayableCheckoutUrl } from '@/lib/billing/signup-checkout';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import styles from './PlanChangeOffer.module.css';
import { Button, LinkButton } from './ui';

/** Props for the open plan-change checkout actions. */
export interface PlanChangeCheckoutPendingProps {
    /** The pending successor S40 abandons when the person cancels. */
    readonly successorId: string;
    /** The successor's applied MP checkout, or null when it cannot be resumed. */
    readonly checkoutUrl: string | null;
    readonly locale: SupportedLocale;
}

/**
 * HOS-2344: while a plan change waits for MP authorization, offer to resume that same
 * checkout or to cancel the attempt (S40 on the successor), which brings back «Cambiar de plan».
 */
export function PlanChangeCheckoutPending({
    successorId,
    checkoutUrl,
    locale
}: PlanChangeCheckoutPendingProps) {
    const { t } = createTranslations(locale);
    const [state, setState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
    const resumeHref = resolveSafeExternalUrl(
        checkoutUrl && isDisplayableCheckoutUrl({ checkoutUrl }) ? checkoutUrl : undefined
    );

    async function cancel() {
        if (state === 'pending') return;
        setState('pending');
        try {
            const result = await billingSubscriptionApi.cancelPendingAttempt({
                subscriptionId: successorId
            });
            if (!result.ok) {
                setState('error');
                return;
            }
            setState('done');
            scheduleSubscriptionRefresh({});
        } catch {
            setState('error');
        }
    }

    if (state === 'done')
        return (
            <p
                className={styles.root}
                aria-live="polite"
                data-expanded="true"
                data-testid="my-subscription-plan-change-cancelled"
            >
                {t('account.subscription.mine.planChange.checkoutCancelled')}
            </p>
        );

    return (
        <section
            className={styles.root}
            data-testid="my-subscription-plan-change-pending"
            data-expanded={state === 'error' ? 'true' : undefined}
        >
            <div className={styles.actions}>
                {resumeHref && (
                    <LinkButton
                        size="sm"
                        data-testid="my-subscription-plan-change-resume"
                        href={resumeHref}
                    >
                        {t('account.subscription.mine.planChange.resumeCheckout')}
                    </LinkButton>
                )}
                <Button
                    variant="secondary"
                    size="sm"
                    data-testid="my-subscription-plan-change-cancel"
                    disabled={state === 'pending'}
                    onClick={() => void cancel()}
                >
                    {state === 'pending'
                        ? t('account.subscription.mine.planChange.cancellingCheckout')
                        : t('account.subscription.mine.planChange.cancelCheckout')}
                </Button>
            </div>
            {state === 'error' && (
                <p
                    role="alert"
                    data-testid="my-subscription-plan-change-cancel-error"
                >
                    {t('account.subscription.mine.planChange.cancelCheckoutError')}
                </p>
            )}
        </section>
    );
}
