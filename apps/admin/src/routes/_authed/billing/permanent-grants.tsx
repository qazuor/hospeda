import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { PermanentGrantsScreen } from '@/features/billing-permanent-grants/components/PermanentGrantsScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

export const Route = createFileRoute('/_authed/billing/permanent-grants')({
    beforeLoad: ({ context }) =>
        requireAdminPermission(context, PermissionEnum.BILLING_GRANT_COMPLIMENTARY),
    validateSearch: z.object({ userId: z.uuid().optional() }),
    component: PermanentGrantsPage
});

function PermanentGrantsPage() {
    const { userId } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <SidebarPageLayout titleKey="admin-billing.permanentGrants.title">
            <PermanentGrantsScreen
                initialUserId={userId}
                onSearch={(next) => {
                    void navigate({ search: { userId: next } });
                }}
            />
        </SidebarPageLayout>
    );
}
