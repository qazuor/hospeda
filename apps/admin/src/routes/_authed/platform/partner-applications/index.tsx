import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { PartnerApplicationPanelScreen } from '@/features/partner-applications/components/PartnerApplicationPanelScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

export const Route = createFileRoute('/_authed/platform/partner-applications/')({
    beforeLoad: ({ context }) =>
        requireAdminPermission(context, PermissionEnum.PARTNER_RESOLVE_APPLICATION),
    component: PartnerApplicationPanelPage
});

function PartnerApplicationPanelPage() {
    return (
        <SidebarPageLayout titleKey="admin-entities.partnerApplicationPanel.title">
            <PartnerApplicationPanelScreen />
        </SidebarPageLayout>
    );
}
