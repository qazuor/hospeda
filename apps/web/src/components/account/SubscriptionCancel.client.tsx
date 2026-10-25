import { useState } from 'react';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import {
    ADDON_LINE_KEY,
    END_LINE_KEY,
    formatSelfCancelDate,
    parseCancellationPreview
} from '@/lib/billing/self-cancel';
import { formatPrice } from '@/lib/format-utils';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './SubscriptionCancel.module.css';

type Preview = Exclude<ReturnType<typeof parseCancellationPreview>, null>;
type State =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'loadError'
    | 'pending'
    | 'done'
    | 'actError'
    | 'stateChanged';
/** Props of the inline cancellation flow. */
export interface SubscriptionCancelProps {
    /** The subscription being cancelled. */
    readonly subscriptionId: string;
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** The localized plan name shown on the card. */
    readonly planName: string;
    /** The localized vertical label shown on the card. */
    readonly verticalLabel: string;
}

/** Inline cancellation flow; confirmation presents consequences and fails closed without a valid preview. */
export function SubscriptionCancel({
    subscriptionId,
    locale,
    planName,
    verticalLabel
}: SubscriptionCancelProps) {
    const { t } = createTranslations(locale);
    const [state, setState] = useState<State>('idle');
    const [preview, setPreview] = useState<Preview | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);
    const headingId = `self-cancel-heading-${subscriptionId}`;

    async function loadPreview() {
        setState('loading');
        try {
            const parsed = parseCancellationPreview({
                result: await billingSubscriptionApi.cancellationPreview({ subscriptionId })
            });
            if (!parsed) {
                setState('loadError');
                return;
            }
            setPreview(parsed);
            setState('ready');
        } catch {
            setState('loadError');
        }
    }
    async function confirmCancellation() {
        if (!preview || preview.origin === 'CANCEL_SCHEDULED') return;
        setState('pending');
        try {
            const result = await billingSubscriptionApi.cancel({ subscriptionId });
            if (!result.ok) {
                setState(result.error?.status === 409 ? 'stateChanged' : 'actError');
                return;
            }
            const parsed = result.data;
            setEndDate(
                preview.origin === 'ACTIVE' && parsed.serviceEndsAt
                    ? formatSelfCancelDate({ iso: parsed.serviceEndsAt, locale })
                    : null
            );
            setState('done');
        } catch {
            setState('actError');
        }
    }
    const dateFor = (iso: string) => formatSelfCancelDate({ iso, locale }) ?? '';
    const endLine = (value: Preview) => {
        switch (value.origin) {
            case 'ACTIVE':
                return t(END_LINE_KEY.ACTIVE, undefined, { date: dateFor(value.serviceEndsAt) });
            case 'GRACE_PERIOD':
                return t(END_LINE_KEY.GRACE_PERIOD, undefined, {
                    date: dateFor(value.graceEndsAt)
                });
            case 'SUSPENDED':
                return t(END_LINE_KEY.SUSPENDED);
            case 'CANCEL_SCHEDULED':
                return t('account.subscription.mine.scheduledUntil', undefined, {
                    date: dateFor(value.serviceEndsAt)
                });
        }
    };
    if (state === 'idle')
        return (
            <button
                type="button"
                className={styles.open}
                data-testid="self-cancel-open"
                onClick={() => void loadPreview()}
            >
                {t('account.subscription.cancel.open')}
            </button>
        );
    if (state === 'loading' || state === 'pending')
        return (
            <div
                className={styles.flow}
                aria-busy="true"
            >
                <p>{t('account.subscription.cancel.pending')}</p>
                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.confirm}
                        disabled
                    >
                        {t('account.subscription.cancel.confirm')}
                    </button>
                    <button
                        type="button"
                        className={styles.back}
                        disabled
                    >
                        {t('account.subscription.cancel.back')}
                    </button>
                </div>
            </div>
        );
    if (state === 'done')
        return (
            <p
                className={styles.note}
                data-testid="self-cancel-done"
            >
                {endDate
                    ? t('account.subscription.cancel.doneScheduled', undefined, { date: endDate })
                    : t('account.subscription.cancel.doneEnded')}
            </p>
        );
    if (state === 'stateChanged')
        return <div role="alert">{t('account.subscription.cancel.stateChanged')}</div>;
    if (state === 'actError')
        return (
            <div
                role="alert"
                className={styles.flow}
            >
                <p>{t('account.subscription.cancel.actError')}</p>
                <button
                    type="button"
                    className={styles.confirm}
                    onClick={() => void confirmCancellation()}
                >
                    {t('account.subscription.cancel.retry')}
                </button>
            </div>
        );
    if (state === 'loadError')
        return (
            <div
                role="alert"
                className={styles.flow}
            >
                <p>{t('account.subscription.cancel.loadError')}</p>
                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.retry}
                        onClick={() => void loadPreview()}
                    >
                        {t('account.subscription.cancel.retry')}
                    </button>
                    <button
                        type="button"
                        className={styles.back}
                        onClick={() => setState('idle')}
                    >
                        {t('account.subscription.cancel.back')}
                    </button>
                </div>
            </div>
        );
    if (!preview) return null;
    return (
        <section
            className={styles.panel}
            aria-labelledby={headingId}
        >
            <h4
                id={headingId}
                className={styles.heading}
                data-testid="self-cancel-heading"
            >
                {t('account.subscription.cancel.heading', undefined, {
                    plan: planName,
                    vertical: verticalLabel
                })}
            </h4>
            <p data-testid="self-cancel-end">{endLine(preview)}</p>
            <p>{t('account.subscription.cancel.noMoreCharges')}</p>
            {preview.addons.length > 0 && (
                <>
                    <h3>{t('account.subscription.cancel.addonsTitle')}</h3>
                    <ul>
                        {preview.addons.map((addon) => {
                            const cycle = t(`listing.owner.purgeAddons.cycle.${addon.cycle}`);
                            const price = formatPrice({
                                amount: addon.price / 100,
                                currency: addon.currency,
                                locale,
                                showDecimals: true
                            });
                            const key = ADDON_LINE_KEY[addon.whenOff];
                            const text =
                                addon.whenOff === 'CHARGE_CUT_TODAY' ||
                                addon.whenOff === 'AT_SERVICE_END'
                                    ? t(key, undefined, {
                                          name: addon.name,
                                          price,
                                          cycle,
                                          date: dateFor(
                                              preview.origin === 'ACTIVE' ||
                                                  preview.origin === 'CANCEL_SCHEDULED'
                                                  ? preview.serviceEndsAt
                                                  : preview.origin === 'GRACE_PERIOD'
                                                    ? preview.graceEndsAt
                                                    : new Date().toISOString()
                                          )
                                      })
                                    : t(key, undefined, { name: addon.name, price, cycle });
                            return <li key={addon.addonInstanceId}>{text}</li>;
                        })}
                    </ul>
                    <p>{t('account.subscription.cancel.addonsComeBack')}</p>
                </>
            )}
            <div className={styles.actions}>
                {preview.origin === 'CANCEL_SCHEDULED' ? (
                    <p>{endLine(preview)}</p>
                ) : (
                    <button
                        type="button"
                        className={styles.confirm}
                        data-testid="self-cancel-confirm"
                        aria-describedby={headingId}
                        onClick={() => void confirmCancellation()}
                    >
                        {t('account.subscription.cancel.confirm')}
                    </button>
                )}
                <button
                    type="button"
                    className={styles.back}
                    onClick={() => setState('idle')}
                >
                    {t('account.subscription.cancel.back')}
                </button>
            </div>
        </section>
    );
}
