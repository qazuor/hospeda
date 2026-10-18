import type { TranslationKey } from '@repo/i18n';
import { AlertCircleIcon } from '@repo/icons';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors';
import {
    CANCELLATION_REASON_KEYS,
    isKnownCancellationReason,
    readCancellationReason
} from '../cancellation-reasons';

export function CancellationPreviewRefusal({
    error,
    onRetry
}: {
    readonly error: unknown;
    readonly onRetry: () => void;
}) {
    const { t } = useTranslations();
    const status = isApiError(error) ? error.status : undefined;
    const reason = readCancellationReason({ error });
    const unavailableKey: TranslationKey =
        status === 404
            ? 'admin-billing.subscriptionCancellation.blocked.SUBSCRIPTION_NOT_FOUND'
            : 'admin-billing.subscriptionCancellation.loadError';
    if (status === undefined || status >= 500 || reason === null)
        return (
            <div
                className="space-y-2"
                data-testid="subscription-cancellation-load-error"
            >
                <p>{t(unavailableKey)}</p>
                <button
                    type="button"
                    className="underline"
                    onClick={onRetry}
                >
                    {t('admin-billing.subscriptionCancellation.retry')}
                </button>
            </div>
        );
    return (
        <div
            className="space-y-2"
            data-testid="subscription-cancellation-blocked"
            data-reason={reason}
        >
            <p className="flex items-start gap-2 font-medium text-destructive">
                <AlertCircleIcon
                    size={16}
                    className="mt-0.5 shrink-0"
                />
                <span>{t('admin-billing.subscriptionCancellation.blocked.intro')}</span>
            </p>
            <p>
                {isKnownCancellationReason(reason)
                    ? reason === 'CANCELLATION_ORIGIN_CHANGED'
                        ? t(
                              'admin-billing.subscriptionCancellation.notice.CANCELLATION_ORIGIN_CHANGED'
                          )
                        : t(CANCELLATION_REASON_KEYS[reason])
                    : t('admin-billing.subscriptionCancellation.blocked.unknown', { reason })}
            </p>
        </div>
    );
}
