import type { SubscriptionRevocationResponse } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { ExternalRefundSettlementForm } from '@/features/billing-reconciliation/components/ExternalRefundSettlementForm';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';

/** Props for {@link RevocationRefundSettlement}. RO-RO. */
export interface RevocationRefundSettlementProps {
    /** The successful S36 result held in screen memory. */
    readonly result: SubscriptionRevocationResponse;
}

/**
 * Offers RF4 for the RF1 created by S36: without B6, that request can only be
 * closed by recording the refund already made outside the flow. The result
 * lives in memory, so this action is available immediately after revocation.
 */
export function RevocationRefundSettlement({ result }: RevocationRefundSettlementProps) {
    const { t } = useTranslations();
    const allowed = useHasPermission(PermissionEnum.BILLING_SETTLE_EXTERNAL);
    if (!allowed)
        return (
            <p data-testid="subscription-revocation-settlement-forbidden">
                {t('admin-billing.subscriptionRevocation.settlement.noPermission')}
            </p>
        );
    return (
        <section
            data-testid="subscription-revocation-settlement"
            className="space-y-3"
        >
            <h3 className="font-semibold">
                {t('admin-billing.subscriptionRevocation.settlement.title')}
            </h3>
            <p>
                {t('admin-billing.subscriptionRevocation.settlement.intro', {
                    refundId: result.refundId
                })}
            </p>
            <ExternalRefundSettlementForm
                idSuffix={result.refundId}
                testId="subscription-revocation-settlement-form"
                payments={[
                    {
                        paymentId: result.payment.id,
                        source: result.payment.source,
                        amountMinor: result.refundAmount
                    }
                ]}
                defaultChannel={
                    result.payment.source === 'PAYMENT' ? 'PROVIDER_PANEL' : 'BANK_TRANSFER'
                }
                requestedRefund={{ refundId: result.refundId, amountMinor: result.refundAmount }}
                describeSuccess={({ response }) =>
                    response.closedRequestedRefund
                        ? t('admin-billing.subscriptionRevocation.settlement.success.closed', {
                              refundId: response.refundId,
                              status: response.status
                          })
                        : t('admin-billing.subscriptionRevocation.settlement.success.separate', {
                              refundId: response.refundId,
                              status: response.status,
                              requestedRefundId: result.refundId
                          })
                }
            />
        </section>
    );
}
