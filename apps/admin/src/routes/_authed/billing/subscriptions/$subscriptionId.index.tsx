import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { SubscriptionDetailScreen } from '@/features/billing-subscriptions/components/SubscriptionDetailScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

/**
 * Administrative subscription detail. It is an index route so the five action
 * pages stay siblings instead of becoming children of a layout without Outlet.
 */
export const Route = createFileRoute('/_authed/billing/subscriptions/$subscriptionId/')({
    beforeLoad: ({ context }) =>
        requireAdminPermission(context, PermissionEnum.BILLING_SUBSCRIPTION_INSPECT),
    component: SubscriptionDetailPage
});

function SubscriptionDetailPage() {
    const { subscriptionId } = Route.useParams();
    return (
        <SidebarPageLayout titleKey="admin-billing.subscriptionAdmin.detailTitle">
            <SubscriptionDetailScreen subscriptionId={subscriptionId} />
        </SidebarPageLayout>
    );
}
