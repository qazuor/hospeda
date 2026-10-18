import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { ReconciliationMarksScreen } from '@/features/billing-reconciliation/components/ReconciliationMarksScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

export const Route = createFileRoute('/_authed/billing/reconciliation/')({
    beforeLoad: ({ context }) =>
        requireAdminPermission(context, PermissionEnum.BILLING_SUBSCRIPTION_INSPECT),
    component: ReconciliationMarksPage
});

function ReconciliationMarksPage() {
    return (
        <SidebarPageLayout titleKey="admin-billing.reconciliationMarks.title">
            <ReconciliationMarksScreen />
        </SidebarPageLayout>
    );
}
