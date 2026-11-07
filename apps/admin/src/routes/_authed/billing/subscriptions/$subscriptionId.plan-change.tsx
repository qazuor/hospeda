import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { BillingPlanChangeScreen } from '@/features/billing-plan-change/components/BillingPlanChangeScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

export const Route = createFileRoute('/_authed/billing/subscriptions/$subscriptionId/plan-change')({
    beforeLoad: ({ context }) =>
        requireAdminPermission(context, PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN),
    component: BillingPlanChangePage
});

function BillingPlanChangePage() {
    const { subscriptionId } = Route.useParams();
    return (
        <SidebarPageLayout titleKey="admin-billing.subscriptionPlanChange.title">
            <BillingPlanChangeScreen subscriptionId={subscriptionId} />
        </SidebarPageLayout>
    );
}
