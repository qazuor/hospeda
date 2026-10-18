/**
 * Administrative action 8 without refund (HOS-1696).
 * Support opens this page directly with the subscription id.
 */

import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { SubscriptionCancellationScreen } from '@/features/billing-cancellation/components/SubscriptionCancellationScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

export const Route = createFileRoute('/_authed/billing/subscriptions/$subscriptionId/cancellation')(
    {
        beforeLoad: ({ context }) =>
            requireAdminPermission(context, PermissionEnum.BILLING_CANCEL_SUBSCRIPTION),
        component: SubscriptionCancellationPage
    }
);

function SubscriptionCancellationPage() {
    const { subscriptionId } = Route.useParams();
    return (
        <SidebarPageLayout titleKey="admin-billing.subscriptionCancellation.title">
            <SubscriptionCancellationScreen subscriptionId={subscriptionId} />
        </SidebarPageLayout>
    );
}
