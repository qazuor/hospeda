import { useState } from 'react';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import { pauseDate } from '@/lib/billing/pause-offer';
import { formatPrice } from '@/lib/format-utils';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './PlanChangeOffer.module.css';

/** Props for the customer resume flow. */
export interface ResumeOfferProps {
    readonly subscriptionId: string;
    readonly locale: SupportedLocale;
}

/** Resume a customer pause and show only the next charge date and amount. */
export function ResumeOffer({ subscriptionId, locale }: ResumeOfferProps) {
    const { t } = createTranslations(locale);
    const [state, setState] = useState<'idle' | 'confirm' | 'pending' | 'done' | 'error'>('idle');
    const [charge, setCharge] = useState<{
        at: string;
        amountMinor: number;
        currency: string;
    } | null>(null);
    async function applyResume() {
        setState('pending');
        try {
            const result = await billingSubscriptionApi.resume({ subscriptionId });
            if (!result.ok || !result.data.nextCharge) {
                setState('error');
                return;
            }
            setCharge(result.data.nextCharge);
            setState('done');
        } catch {
            setState('error');
        }
    }
    return (
        <section
            className={styles.root}
            data-testid="resume-offer"
        >
            {state === 'idle' && (
                <button
                    type="button"
                    className={styles.primary}
                    onClick={() => setState('confirm')}
                >
                    {t('account.subscription.mine.resume.open')}
                </button>
            )}
            {state === 'confirm' && (
                <div data-testid="resume-confirmation">
                    <p>{t('account.subscription.mine.resume.confirmation')}</p>
                    <button
                        type="button"
                        className={styles.primary}
                        onClick={() => void applyResume()}
                    >
                        {t('account.subscription.mine.resume.confirm')}
                    </button>
                </div>
            )}
            {state === 'pending' && (
                <p aria-live="polite">{t('account.subscription.mine.resume.pending')}</p>
            )}
            {state === 'error' && <p role="alert">{t('account.subscription.mine.resume.error')}</p>}
            {state === 'done' && charge && (
                <p
                    role="status"
                    data-testid="resume-result"
                >
                    {t('account.subscription.mine.resume.done', undefined, {
                        date: pauseDate(charge.at, locale),
                        amount: formatPrice({
                            amount: charge.amountMinor / 100,
                            currency: charge.currency,
                            locale,
                            showDecimals: charge.amountMinor % 100 !== 0
                        })
                    })}
                </p>
            )}
        </section>
    );
}
