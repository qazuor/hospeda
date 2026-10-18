import type { AdminSubscriptionCancellationPreviewResponse } from '@repo/schemas';
import { useTranslations } from '@/hooks/use-translations';
import { formatCancellationAmount, formatCancellationDate } from '../cancellation-format';
import {
    CANCELLATION_ADDON_WHEN_OFF_KEYS,
    CANCELLATION_CYCLE_KEYS,
    CANCELLATION_ORIGIN_KEYS
} from '../cancellation-reasons';

export function CancellationPreviewDetails({
    preview
}: {
    readonly preview: AdminSubscriptionCancellationPreviewResponse;
}) {
    const { t, locale } = useTranslations();
    const date =
        preview.origin === 'ACTIVE' || preview.origin === 'CANCEL_SCHEDULED'
            ? formatCancellationDate({ iso: preview.serviceEndsAt, locale })
            : preview.origin === 'GRACE_PERIOD'
              ? formatCancellationDate({ iso: preview.graceEndsAt, locale })
              : formatCancellationDate({ iso: new Date().toISOString(), locale });
    const effectKey = `admin-billing.subscriptionCancellation.effects.${preview.origin}` as const;
    const effect = t(effectKey, date ? { date } : undefined);
    return (
        <div className="space-y-3">
            <p data-testid="subscription-cancellation-origin">
                {t('admin-billing.subscriptionCancellation.origin.label', {
                    state: t(CANCELLATION_ORIGIN_KEYS[preview.origin])
                })}
            </p>
            <p data-testid={`subscription-cancellation-effect-${preview.origin}`}>{effect}</p>
            <p data-testid="subscription-cancellation-authorization">
                {t(`admin-billing.subscriptionCancellation.authorization.${preview.paymentMethod}`)}
            </p>
            {preview.addons.length > 0 ? (
                <section
                    className="space-y-2"
                    data-testid="subscription-cancellation-addons"
                >
                    <p>{t('admin-billing.subscriptionCancellation.addons.title')}</p>
                    <ul className="list-disc space-y-1 pl-5">
                        {preview.addons.map((addon) => {
                            const whenOff = t(CANCELLATION_ADDON_WHEN_OFF_KEYS[addon.whenOff], {
                                name: addon.name,
                                price: formatCancellationAmount({
                                    cents: addon.price,
                                    locale,
                                    currency: addon.currency
                                }),
                                cycle: t(CANCELLATION_CYCLE_KEYS[addon.cycle]),
                                date
                            });
                            return (
                                <li
                                    key={addon.addonInstanceId}
                                    data-testid={`subscription-cancellation-addon-${addon.whenOff}`}
                                >
                                    {whenOff}
                                </li>
                            );
                        })}
                    </ul>
                    <p>{t('admin-billing.subscriptionCancellation.addons.comeBack')}</p>
                </section>
            ) : null}
            <p data-testid="subscription-cancellation-no-refund">
                {t('admin-billing.subscriptionCancellation.noRefund')}
            </p>
        </div>
    );
}
