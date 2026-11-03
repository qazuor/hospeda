import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { FixRequestsScreen } from '@/features/listing-fix-requests/components/FixRequestsScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

/** Route for the pending listing fix request queue. */
export const Route = createFileRoute('/_authed/content/fix-requests/')({
    beforeLoad: ({ context }) => requireAdminPermission(context, PermissionEnum.LISTING_MODERATE),
    component: FixRequestsPage
});

function FixRequestsPage() {
    return (
        <SidebarPageLayout titleKey="admin-entities.fixRequestList.title">
            <FixRequestsScreen />
        </SidebarPageLayout>
    );
}
