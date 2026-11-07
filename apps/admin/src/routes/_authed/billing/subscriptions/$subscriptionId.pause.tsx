import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { BillingPauseScreen } from '@/features/billing-pause/components/BillingPauseScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

/** Direct action 9 page for support. */
export const Route = createFileRoute('/_authed/billing/subscriptions/$subscriptionId/pause')({
    beforeLoad: ({ context }) =>
        requireAdminPermission(context, PermissionEnum.BILLING_PAUSE_SUBSCRIPTION),
    component: BillingPausePage
});

function BillingPausePage() {
    const { subscriptionId } = Route.useParams();
    return (
        <SidebarPageLayout titleKey="admin-billing.subscriptionPause.title">
            <BillingPauseScreen subscriptionId={subscriptionId} />
        </SidebarPageLayout>
    );
}
