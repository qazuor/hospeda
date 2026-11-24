import { useState } from 'react';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import { scheduleSubscriptionRefresh } from '@/lib/billing/refresh-subscription-card';
import { formatSelfCancelDate, parseCancellationPreview } from '@/lib/billing/self-cancel';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './PlanChangeOffer.module.css';
import { Alert, Button } from './ui';

type PausedPreview = Extract<
    NonNullable<ReturnType<typeof parseCancellationPreview>>,
    { origin: 'PAUSED' }
>;
/** Props for cancellation from an open pause. */
export interface PausedCancelProps {
    readonly subscriptionId: string;
    readonly locale: SupportedLocale;
    readonly planName: string;
    readonly verticalLabel: string;
}

/** Read S22 consequences before confirming the existing cancellation route. */
export function PausedCancel({
    subscriptionId,
    locale,
    planName,
    verticalLabel
}: PausedCancelProps) {
    const { t, tPlural } = createTranslations(locale);
    const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'pending' | 'done' | 'error'>(
        'idle'
    );
    const [preview, setPreview] = useState<PausedPreview | null>(null);
    const [outcome, setOutcome] = useState<'CANCELLED' | 'SCHEDULED'>('CANCELLED');
    const date = (iso: string) => formatSelfCancelDate({ iso, locale }) ?? '';
    async function open() {
        setState('loading');
        try {
            const value = parseCancellationPreview({
                result: await billingSubscriptionApi.cancellationPreview({ subscriptionId })
            });
            if (value?.origin !== 'PAUSED') {
                setState('error');
                return;
            }
            setPreview(value);
            setState('ready');
        } catch {
            setState('error');
        }
    }
    async function applyCancellation() {
        if (!preview) return;
        setState('pending');
        try {
            const result = await billingSubscriptionApi.cancel({ subscriptionId });
            if (
                !result.ok ||
                (result.data.outcome !== 'CANCELLED' && result.data.outcome !== 'SCHEDULED')
            ) {
                setState('error');
                return;
            }
            setOutcome(result.data.outcome);
            setState('done');
            scheduleSubscriptionRefresh({});
        } catch {
            setState('error');
        }
    }
    return (
        <section
            className={styles.root}
            data-testid="paused-cancel"
            data-expanded={state === 'idle' ? undefined : 'true'}
        >
            {state === 'idle' && (
                <Button
                    variant="danger-ghost"
                    size="sm"
                    onClick={() => void open()}
                >
                    {t('account.subscription.cancel.open')}
                </Button>
            )}
            {(state === 'loading' || state === 'pending') && (
                <p aria-live="polite">{t('account.subscription.cancel.pending')}</p>
            )}
            {state === 'error' && (
                <p role="alert">{t('account.subscription.mine.pausedCancel.error')}</p>
            )}
            {state === 'ready' && preview && (
                <div className={styles.panel}>
                    <h4>
                        {t('account.subscription.cancel.heading', undefined, {
                            plan: planName,
                            vertical: verticalLabel
                        })}
                    </h4>
                    <Alert
                        tone="warning"
                        locale={locale}
                    >
                        <p data-testid="paused-cancel-end">
                            {preview.basis === 'CREDIT'
                                ? t('account.subscription.mine.pausedCancel.creditEnd', undefined, {
                                      date: date(preview.serviceEndsAt)
                                  })
                                : t('account.subscription.mine.pausedCancel.today')}
                        </p>
                        {preview.courtesyMonthsLost > 0 && (
                            <p>
                                {tPlural(
                                    'account.subscription.mine.pausedCancel.courtesyLost',
                                    preview.courtesyMonthsLost,
                                    { count: preview.courtesyMonthsLost }
                                )}
                            </p>
                        )}
                    </Alert>
                    <div className={styles.actions}>
                        <Button
                            variant="danger"
                            size="sm"
                            onClick={() => void applyCancellation()}
                        >
                            {t('account.subscription.mine.pausedCancel.confirm')}
                        </Button>
                    </div>
                </div>
            )}
            {state === 'done' && preview && (
                <p role="status">
                    {outcome === 'SCHEDULED'
                        ? t('account.subscription.mine.pausedCancel.doneCredit', undefined, {
                              date: date(preview.serviceEndsAt)
                          })
                        : t('account.subscription.mine.pausedCancel.doneToday')}
                </p>
            )}
        </section>
    );
}
