import { PermissionEnum } from '@repo/schemas';
import { useTranslations } from '@/hooks/use-translations';
import { useHasAllPermissions } from '@/hooks/use-user-permissions';
import { useSubscriptionOpenRefunds } from '../hooks/useSubscriptionOpenRefunds';
import { RevocationRefundSettlement } from './RevocationRefundSettlement';

/** Props for {@link RevocationOpenRefunds}. RO-RO. */
export interface RevocationOpenRefundsProps {
    /** Subscription whose open refund requests are shown. */
    readonly subscriptionId: string;
}

/**
 * Lists the subscription's RF1 requests so AC:B5:41 can be settled after a reload,
 * when the S36 result held only in memory is gone (D-1 option 2). The query key
 * stays outside `billing-reconciliation` so settlement invalidation preserves success.
 */
export function RevocationOpenRefunds({ subscriptionId }: RevocationOpenRefundsProps) {
    const { t } = useTranslations();
    const allowed = useHasAllPermissions([
        PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
        PermissionEnum.BILLING_SETTLE_EXTERNAL
    ]);
    const query = useSubscriptionOpenRefunds({ subscriptionId, enabled: allowed });

    if (!allowed)
        return (
            <p data-testid="subscription-revocation-open-refunds-forbidden">
                {t('admin-billing.subscriptionRevocation.openRefunds.noPermission')}
            </p>
        );

    return (
        <section
            data-testid="subscription-revocation-open-refunds"
            className="space-y-3"
        >
            <h3 className="font-semibold">
                {t('admin-billing.subscriptionRevocation.openRefunds.title')}
            </h3>
            <p>{t('admin-billing.subscriptionRevocation.openRefunds.intro')}</p>
            {query.isLoading ? (
                <p>{t('admin-billing.subscriptionRevocation.openRefunds.loading')}</p>
            ) : query.error ? (
                <p role="alert">
                    {t('admin-billing.subscriptionRevocation.openRefunds.loadError')}
                </p>
            ) : query.data?.items.length === 0 ? (
                <p data-testid="subscription-revocation-open-refunds-empty">
                    {t('admin-billing.subscriptionRevocation.openRefunds.empty')}
                </p>
            ) : (
                <ul className="space-y-3">
                    {query.data?.items.map((item) => (
                        <li
                            data-testid="subscription-revocation-open-refund"
                            data-refund-id={item.refundId}
                            key={item.refundId}
                        >
                            <RevocationRefundSettlement result={item} />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
