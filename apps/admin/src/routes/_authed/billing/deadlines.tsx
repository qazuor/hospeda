import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { DeadlinesScreen } from '@/features/billing-deadlines/components/DeadlinesScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

export const Route = createFileRoute('/_authed/billing/deadlines')({
    beforeLoad: ({ context }) =>
        requireAdminPermission(context, PermissionEnum.MAINTENANCE_MODE_WRITE),
    component: DeadlinesPage
});

function DeadlinesPage() {
    return (
        <SidebarPageLayout titleKey="admin-billing.deadlinesEditor.title">
            <DeadlinesScreen />
        </SidebarPageLayout>
    );
}
