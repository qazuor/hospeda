import type { PricingSituationVertical } from '@repo/schemas';
import { useState } from 'react';
import {
    loadPlanChangeChoices,
    type PlanChangeChoice,
    submitPlanChange
} from '@/lib/billing/plan-change-offer';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './PlanChangeOffer.module.css';

/** Props for the owner-facing plan-change offer. */
export interface PlanChangeOfferProps {
    readonly subscriptionId: string;
    readonly vertical: PricingSituationVertical;
    readonly locale: SupportedLocale;
}

/** List other choices, confirm the consequences, and display the server outcome. */
export function PlanChangeOffer({ subscriptionId, vertical, locale }: PlanChangeOfferProps) {
    const { t } = createTranslations(locale);
    const [state, setState] = useState<
        'closed' | 'loading' | 'choices' | 'confirm' | 'pending' | 'done' | 'error'
    >('closed');
    const [choices, setChoices] = useState<readonly PlanChangeChoice[]>([]);
    const [selected, setSelected] = useState<PlanChangeChoice | null>(null);
    const [message, setMessage] = useState('');

    async function open() {
        setState('loading');
        const loaded = await loadPlanChangeChoices({ subscriptionId, vertical, locale });
        if (!loaded) {
            setState('error');
            return;
        }
        setChoices(loaded);
        setState('choices');
    }

    async function confirm() {
        if (!selected) return;
        setState('pending');
        const result = await submitPlanChange({
            subscriptionId,
            billingOptionId: selected.id,
            locale
        });
        if (result.kind === 'redirect') {
            window.location.assign(result.checkoutUrl);
            return;
        }
        setMessage(result.message);
        setState('done');
    }

    return (
        <section
            className={styles.root}
            data-testid="plan-change-offer"
        >
            {state === 'closed' && (
                <button
                    type="button"
                    className={styles.primary}
                    onClick={() => void open()}
                >
                    {t('account.subscription.mine.planChange.open')}
                </button>
            )}
            {state === 'loading' && (
                <p aria-live="polite">{t('account.subscription.mine.planChange.loading')}</p>
            )}
            {state === 'choices' && (
                <>
                    <h4>{t('account.subscription.mine.planChange.heading')}</h4>
                    <ul
                        data-testid="plan-change-options"
                        className={styles.list}
                    >
                        {choices.map((choice) => (
                            <li
                                key={choice.id}
                                data-billing-option-id={choice.id}
                            >
                                <button
                                    type="button"
                                    className={styles.choice}
                                    onClick={() => {
                                        setSelected(choice);
                                        setState('confirm');
                                    }}
                                >
                                    {choice.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                    <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => setState('closed')}
                    >
                        {t('account.subscription.mine.planChange.back')}
                    </button>
                </>
            )}
            {state === 'confirm' && selected && (
                <>
                    <h4>{t('account.subscription.mine.planChange.confirmHeading')}</h4>
                    <p>{selected.label}</p>
                    <p>{t('account.subscription.mine.planChange.confirmCheckout')}</p>
                    <p>{t('account.subscription.mine.planChange.confirmScheduled')}</p>
                    <button
                        type="button"
                        className={styles.primary}
                        onClick={() => void confirm()}
                    >
                        {t('account.subscription.mine.planChange.confirm')}
                    </button>
                    <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => setState('choices')}
                    >
                        {t('account.subscription.mine.planChange.back')}
                    </button>
                </>
            )}
            {state === 'pending' && (
                <p aria-live="polite">{t('account.subscription.mine.planChange.pending')}</p>
            )}
            {state === 'done' && (
                <p
                    role="status"
                    data-testid="plan-change-result"
                >
                    {message}
                </p>
            )}
            {state === 'error' && (
                <p role="alert">{t('account.subscription.mine.planChange.error')}</p>
            )}
        </section>
    );
}
