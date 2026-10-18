import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { ReconciliationMarkEventsScreen } from '@/features/billing-reconciliation/components/ReconciliationMarkEventsScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

export const Route = createFileRoute('/_authed/billing/reconciliation/$markId/events')({
    beforeLoad: ({ context }) =>
        requireAdminPermission(context, PermissionEnum.BILLING_SUBSCRIPTION_INSPECT),
    component: ReconciliationMarkEventsPage
});

function ReconciliationMarkEventsPage() {
    const { markId } = Route.useParams();
    return (
        <SidebarPageLayout titleKey="admin-billing.reconciliationMarks.eventsTitle">
            <ReconciliationMarkEventsScreen markId={markId} />
        </SidebarPageLayout>
    );
}
