import { CheckCircleIcon } from '@repo/icons';
import type { AdminSubscriptionCancellationResponse } from '@repo/schemas';
import { useTranslations } from '@/hooks/use-translations';
import { formatCancellationDate } from '../cancellation-format';
import {
    CANCELLATION_CANCEL_CALL_KEYS,
    CANCELLATION_ESCALATED_KEYS,
    CANCELLATION_OUTCOME_KEYS
} from '../cancellation-reasons';
export function CancellationResultDetails({
    result
}: {
    readonly result: AdminSubscriptionCancellationResponse;
}) {
    const { t, locale } = useTranslations();
    const date = result.serviceEndsAt
        ? formatCancellationDate({ iso: result.serviceEndsAt, locale })
        : null;
    const outcome = t(CANCELLATION_OUTCOME_KEYS[result.outcome], date ? { date } : undefined);
    return (
        <div
            className="space-y-2"
            data-testid="subscription-cancellation-result"
        >
            <p className="flex items-center gap-2 font-semibold">
                <CheckCircleIcon
                    size={18}
                    className="shrink-0 text-green-600"
                />
                <span>{outcome}</span>
            </p>
            {result.cancelCall ? (
                <p
                    data-testid="subscription-cancellation-result-cancel-call"
                    data-cancel-call={result.cancelCall}
                >
                    {t(CANCELLATION_CANCEL_CALL_KEYS[result.cancelCall])}
                </p>
            ) : null}
            {result.escalated ? (
                <p data-testid="subscription-cancellation-result-escalated">
                    {t(CANCELLATION_ESCALATED_KEYS[result.escalated])}
                </p>
            ) : null}
        </div>
    );
}
