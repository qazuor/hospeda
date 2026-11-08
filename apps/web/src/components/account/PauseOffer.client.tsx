import { useState } from 'react';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import { parsePausePreview, pauseDate } from '@/lib/billing/pause-offer';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './PlanChangeOffer.module.css';

type Preview = NonNullable<ReturnType<typeof parsePausePreview>>;
/** Props for the customer pause flow. */
export interface PauseOfferProps {
    readonly subscriptionId: string;
    readonly locale: SupportedLocale;
}

/** Show pause eligibility and all consequences before sending the selected duration. */
export function PauseOffer({ subscriptionId, locale }: PauseOfferProps) {
    const { t, tPlural } = createTranslations(locale);
    const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'pending' | 'done' | 'error'>(
        'idle'
    );
    const [preview, setPreview] = useState<Preview | null>(null);
    const [months, setMonths] = useState(1);
    const [endAt, setEndAt] = useState('');
    const [errorReason, setErrorReason] = useState<string | null>(null);
    async function open() {
        setErrorReason(null);
        setState('loading');
        try {
            const value = parsePausePreview(
                await billingSubscriptionApi.pausePreview({ subscriptionId })
            );
            if (!value) {
                setState('error');
                return;
            }
            setPreview(value);
            setState('ready');
        } catch {
            setState('error');
        }
    }
    async function applyPause() {
        if (!preview?.offered || !preview.expectedEndAtByMonths[String(months)]) return;
        setState('pending');
        try {
            const result = await billingSubscriptionApi.pause({
                subscriptionId,
                months,
                ...(preview.courtesyForfeit ? { courtesyForfeitConfirmed: true as const } : {})
            });
            if (!result.ok) {
                setErrorReason(result.error.status === 409 ? (result.error.reason ?? null) : null);
                setState('error');
                return;
            }
            setEndAt(result.data.expectedEndAt);
            setState('done');
        } catch {
            setState('error');
        }
    }
    const end = preview?.offered ? preview.expectedEndAtByMonths[String(months)] : null;
    return (
        <section
            className={styles.root}
            data-testid="pause-offer"
        >
            {state === 'idle' && (
                <button
                    type="button"
                    className={styles.primary}
                    onClick={() => void open()}
                >
                    {t('account.subscription.mine.pause.open')}
                </button>
            )}
            {(state === 'loading' || state === 'pending') && (
                <p aria-live="polite">{t('account.subscription.mine.pause.pending')}</p>
            )}
            {state === 'error' && (
                <p role="alert">
                    {errorReason && Object.hasOwn(PAUSE_REASON_KEYS, errorReason)
                        ? t(
                              `account.subscription.mine.pause.reason.${errorReason as keyof typeof PAUSE_REASON_KEYS}`
                          )
                        : t('account.subscription.mine.pause.error')}
                </p>
            )}
            {state === 'ready' && preview && !preview.offered && (
                <p data-testid="pause-refusal">
                    {preview.reason === 'COURTESY_IN_FORCE' && preview.courtesyEndsAt
                        ? t('account.subscription.mine.pause.reason.COURTESY_IN_FORCE', undefined, {
                              date: pauseDate(preview.courtesyEndsAt, locale)
                          })
                        : t(
                              `account.subscription.mine.pause.reason.${Object.hasOwn(PAUSE_REASON_KEYS, preview.reason) ? (preview.reason as keyof typeof PAUSE_REASON_KEYS) : 'other'}`
                          )}
                </p>
            )}
            {state === 'ready' && preview?.offered && (
                <>
                    {preview.courtesyForfeit && (
                        <p data-testid="pause-courtesy-forfeit">
                            {t('account.subscription.mine.pause.courtesyForfeit', undefined, {
                                date: pauseDate(preview.courtesyForfeit.endsAt, locale)
                            })}
                        </p>
                    )}
                    <label htmlFor={`pause-months-${subscriptionId}`}>
                        {t('account.subscription.mine.pause.months')}
                    </label>
                    <select
                        id={`pause-months-${subscriptionId}`}
                        value={months}
                        onChange={(event) => setMonths(Number(event.target.value))}
                    >
                        {Array.from(
                            { length: preview.months.max - preview.months.min + 1 },
                            (_, i) => i + preview.months.min
                        ).map((value) => (
                            <option
                                key={value}
                                value={value}
                            >
                                {tPlural('account.subscription.mine.pause.monthCount', value, {
                                    count: value
                                })}
                            </option>
                        ))}
                    </select>
                    {end && (
                        <div data-testid="pause-confirmation">
                            {preview.courtesyForfeit && (
                                <p>{t('account.subscription.mine.pause.courtesyConfirmation')}</p>
                            )}
                            <p>
                                {t('account.subscription.mine.pause.confirmation', undefined, {
                                    date: pauseDate(end, locale)
                                })}
                            </p>
                            <p>{t('account.subscription.mine.pause.listing')}</p>
                            <p>{t('account.subscription.mine.pause.addonsVertical')}</p>
                            {preview.addons.vertical.map((name) => (
                                <p key={name}>{name}</p>
                            ))}
                            {preview.addons.account.map((addon) => (
                                <p key={addon.name}>
                                    {t(
                                        addon.pauses
                                            ? 'account.subscription.mine.pause.addonPauses'
                                            : 'account.subscription.mine.pause.addonContinues',
                                        undefined,
                                        { name: addon.name }
                                    )}
                                </p>
                            ))}
                            <button
                                type="button"
                                className={styles.primary}
                                onClick={() => void applyPause()}
                            >
                                {t('account.subscription.mine.pause.confirm')}
                            </button>
                        </div>
                    )}
                </>
            )}
            {state === 'done' && (
                <p role="status">
                    {t('account.subscription.mine.pause.done', undefined, {
                        date: pauseDate(endAt, locale)
                    })}
                </p>
            )}
        </section>
    );
}
const PAUSE_REASON_KEYS = {
    NOT_PRINCIPAL: true,
    NOT_ACTIVE: true,
    MANUAL_PAYER: true,
    NOT_MONTHLY: true,
    PLAN_DISALLOWS_PAUSE: true,
    MONTHS_OUT_OF_RANGE: true,
    PAUSE_COUNT_EXHAUSTED: true,
    MONTHS_EXHAUSTED: true,
    COURTESY_FORFEIT_NOT_CONFIRMED: true,
    LOST_RACE: true
} as const;
