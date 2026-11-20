import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { ProposedRefundsScreen } from '@/features/billing-refunds/components/ProposedRefundsScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

export const Route = createFileRoute('/_authed/billing/reconciliation/refunds')({
    beforeLoad: ({ context }) => requireAdminPermission(context, PermissionEnum.BILLING_REFUND),
    component: ProposedRefundsPage
});

function ProposedRefundsPage() {
    return (
        <SidebarPageLayout titleKey="admin-billing.proposedRefunds.title">
            <ProposedRefundsScreen />
        </SidebarPageLayout>
    );
}
