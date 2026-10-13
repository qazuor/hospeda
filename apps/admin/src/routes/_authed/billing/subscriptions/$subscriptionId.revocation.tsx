/**
 * Subscription revocation page (HOS-1678)
 *
 * The confirmation of administrative action 8 with reason revocation (ACC:8,
 * S36). Reached only by URL (H1): support pastes the subscription id. Gated
 * twice by `BILLING_CANCEL_SUBSCRIPTION` (H14): here in `beforeLoad` and again
 * by the screen's `PermissionGate`.
 */

import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { SubscriptionRevocationScreen } from '@/features/billing-revocation/components/SubscriptionRevocationScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

export const Route = createFileRoute('/_authed/billing/subscriptions/$subscriptionId/revocation')({
    beforeLoad: ({ context }) =>
        requireAdminPermission(context, PermissionEnum.BILLING_CANCEL_SUBSCRIPTION),
    component: SubscriptionRevocationPage
});

function SubscriptionRevocationPage() {
    const { subscriptionId } = Route.useParams();
    return (
        <SidebarPageLayout titleKey="admin-billing.subscriptionRevocation.title">
            <SubscriptionRevocationScreen subscriptionId={subscriptionId} />
        </SidebarPageLayout>
    );
}
