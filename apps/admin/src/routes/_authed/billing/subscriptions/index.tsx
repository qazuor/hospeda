import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { SubscriptionsListScreen } from '@/features/billing-subscriptions/components/SubscriptionsListScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

/** Administrative subscription finder and list. */
export const Route = createFileRoute('/_authed/billing/subscriptions/')({
    beforeLoad: ({ context }) =>
        requireAdminPermission(context, PermissionEnum.BILLING_SUBSCRIPTION_INSPECT),
    component: SubscriptionsPage
});

function SubscriptionsPage() {
    return (
        <SidebarPageLayout titleKey="admin-billing.subscriptionAdmin.title">
            <SubscriptionsListScreen />
        </SidebarPageLayout>
    );
}
