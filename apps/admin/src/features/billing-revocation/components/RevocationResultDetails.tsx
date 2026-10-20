/**
 * @file RevocationResultDetails.tsx
 * What the revocation did (HOS-1678, H9): the row is cancelled and without
 * service, the refund that was requested (money only goes out once a person
 * confirms it, INV:D11), what the provider call ended in and, when present,
 * why the prior notice was escalated. It also offers RF4 for the S36 refund.
 */

import { CheckCircleIcon } from '@repo/icons';
import type { SubscriptionRevocationResponse } from '@repo/schemas';
import { useTranslations } from '@/hooks/use-translations';
import { formatRevocationAmount, formatRevocationInstant } from '../revocation-format';
import { REVOCATION_CANCEL_CALL_KEYS, REVOCATION_ESCALATED_KEYS } from '../revocation-reasons';
import { RevocationRefundSettlement } from './RevocationRefundSettlement';

/** Props of {@link RevocationResultDetails}. RO-RO. */
export interface RevocationResultDetailsProps {
    /** What the act answered. */
    readonly result: SubscriptionRevocationResponse;
    /** Currency of the revoked payment, from the preview that was confirmed. */
    readonly currency: string | null;
}

/**
 * Renders the outcome of a successful revocation.
 *
 * @param props - The act's answer and the payment currency.
 */
export function RevocationResultDetails({ result, currency }: RevocationResultDetailsProps) {
    const { t, locale } = useTranslations();

    return (
        <div
            className="space-y-2"
            data-testid="subscription-revocation-result"
        >
            <p className="flex items-center gap-2 font-semibold">
                <CheckCircleIcon
                    size={18}
                    className="shrink-0 text-green-600"
                />
                <span>{t('admin-billing.subscriptionRevocation.result.title')}</span>
            </p>
            <p>
                {t('admin-billing.subscriptionRevocation.result.cancelled', {
                    serviceEndedAt: formatRevocationInstant({ iso: result.serviceEndedAt, locale })
                })}
            </p>
            <p>
                {t('admin-billing.subscriptionRevocation.result.refund', {
                    amount: formatRevocationAmount({
                        cents: result.refundAmount,
                        locale,
                        currency
                    }),
                    refundId: result.refundId
                })}
            </p>
            <p
                data-testid="subscription-revocation-result-cancel-call"
                data-cancel-call={result.cancelCall}
            >
                {t(REVOCATION_CANCEL_CALL_KEYS[result.cancelCall])}
            </p>
            {result.escalated ? (
                <p data-testid="subscription-revocation-result-escalated">
                    {t(REVOCATION_ESCALATED_KEYS[result.escalated])}
                </p>
            ) : null}
            <RevocationRefundSettlement result={result} />
        </div>
    );
}
