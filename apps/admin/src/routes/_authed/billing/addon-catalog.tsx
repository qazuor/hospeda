import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { AddonCatalogScreen } from '@/features/billing-addon-catalog/AddonCatalogScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

/** Protects the action 20 editor with its existing publication permission. */
export const Route = createFileRoute('/_authed/billing/addon-catalog')({
    beforeLoad: ({ context }) =>
        requireAdminPermission(context, PermissionEnum.BILLING_PUBLISH_ADDON_VERSION),
    component: AddonCatalogPage
});

function AddonCatalogPage() {
    return (
        <SidebarPageLayout titleKey="admin-billing.addonCatalogEditor.title">
            <AddonCatalogScreen />
        </SidebarPageLayout>
    );
}
