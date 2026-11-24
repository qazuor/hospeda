import type { PricingSituationVertical } from '@repo/schemas';
import { useState } from 'react';
import {
    loadPlanChangeChoices,
    type PlanChangeChoice,
    parsePayerEmail,
    submitPlanChange
} from '@/lib/billing/plan-change-offer';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './PlanChangeOffer.module.css';
import { Alert, Button, Field, OptionCard, OptionCardGrid, TextInput } from './ui';

/** Props for the owner-facing plan-change offer. */
export interface PlanChangeOfferProps {
    readonly subscriptionId: string;
    readonly vertical: PricingSituationVertical;
    readonly locale: SupportedLocale;
    readonly promo?: boolean;
    readonly courtesyMonths?: number;
}

/** List other choices, confirm the consequences, and display the server outcome. */
export function PlanChangeOffer({
    subscriptionId,
    vertical,
    locale,
    promo = false,
    courtesyMonths = 0
}: PlanChangeOfferProps) {
    const { t, tPlural } = createTranslations(locale);
    const [state, setState] = useState<
        'closed' | 'loading' | 'choices' | 'confirm' | 'pending' | 'done' | 'error'
    >('closed');
    const [choices, setChoices] = useState<readonly PlanChangeChoice[]>([]);
    const [selected, setSelected] = useState<PlanChangeChoice | null>(null);
    const [message, setMessage] = useState('');
    const [payerEmail, setPayerEmail] = useState('');
    const [payerEmailError, setPayerEmailError] = useState(false);

    async function open() {
        setState('loading');
        const loaded = await loadPlanChangeChoices({ subscriptionId, vertical, locale });
        if (!loaded) {
            setState('error');
            return;
        }
        setChoices(loaded.choices);
        setPayerEmail(loaded.declaredPayerEmail);
        setState('choices');
    }

    async function submitSelectedPlanChange() {
        if (!selected) return;
        const email = parsePayerEmail({ value: payerEmail });
        if (!email) {
            setPayerEmailError(true);
            return;
        }
        setPayerEmailError(false);
        setState('pending');
        const result = await submitPlanChange({
            subscriptionId,
            billingOptionId: selected.id,
            payerEmail: email,
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
            data-expanded={state === 'closed' ? undefined : 'true'}
        >
            {state === 'closed' && (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void open()}
                >
                    {t('account.subscription.mine.planChange.open')}
                </Button>
            )}
            {state === 'loading' && (
                <p aria-live="polite">{t('account.subscription.mine.planChange.loading')}</p>
            )}
            {state === 'choices' && (
                <div className={styles.panel}>
                    <h4>{t('account.subscription.mine.planChange.heading')}</h4>
                    <div
                        data-testid="plan-change-options"
                        className={styles.choices}
                    >
                        <OptionCardGrid>
                            {choices.map((choice) => (
                                <OptionCard
                                    key={choice.id}
                                    title={choice.label}
                                    data-billing-option-id={choice.id}
                                    onClick={() => {
                                        setSelected(choice);
                                        setState('confirm');
                                    }}
                                />
                            ))}
                        </OptionCardGrid>
                    </div>
                    <div className={styles.actions}>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setState('closed')}
                        >
                            {t('account.subscription.mine.planChange.back')}
                        </Button>
                    </div>
                </div>
            )}
            {state === 'confirm' && selected && (
                <div className={styles.panel}>
                    <h4>{t('account.subscription.mine.planChange.confirmHeading')}</h4>
                    <p>{selected.label}</p>
                    <Alert
                        tone="info"
                        locale={locale}
                    >
                        <p>{t('account.subscription.mine.planChange.confirmCheckout')}</p>
                        <p>{t('account.subscription.mine.planChange.confirmScheduled')}</p>
                    </Alert>
                    <Field
                        label={t('account.subscription.mine.planChange.payerEmailLabel')}
                        locale={locale}
                        hint={t('account.subscription.mine.planChange.payerEmailHint')}
                        error={
                            payerEmailError ? (
                                <span data-testid="plan-change-payer-email-error">
                                    {t('account.subscription.mine.planChange.payerEmailInvalid')}
                                </span>
                            ) : undefined
                        }
                        className={styles.field}
                        required
                    >
                        <TextInput
                            type="email"
                            name="payerEmail"
                            autoComplete="email"
                            value={payerEmail}
                            data-testid="plan-change-payer-email"
                            onChange={(event) => setPayerEmail(event.target.value)}
                        />
                    </Field>
                    {promo && (
                        <Alert
                            tone="warning"
                            locale={locale}
                        >
                            <p data-testid="plan-change-promo-warning">
                                {t('account.subscription.mine.planChange.promoLost')}
                            </p>
                        </Alert>
                    )}
                    {selected.cycle !== 'monthly' && courtesyMonths > 0 && (
                        <Alert
                            tone="warning"
                            locale={locale}
                        >
                            <p data-testid="plan-change-courtesy-warning">
                                {tPlural(
                                    'account.subscription.mine.planChange.courtesyLost',
                                    courtesyMonths,
                                    { count: courtesyMonths }
                                )}
                            </p>
                        </Alert>
                    )}
                    <div className={styles.actions}>
                        <Button
                            size="sm"
                            onClick={() => void submitSelectedPlanChange()}
                        >
                            {t('account.subscription.mine.planChange.confirm')}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setState('choices')}
                        >
                            {t('account.subscription.mine.planChange.back')}
                        </Button>
                    </div>
                </div>
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
