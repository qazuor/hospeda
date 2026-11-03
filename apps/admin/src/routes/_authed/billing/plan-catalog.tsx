import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { PlanCatalogScreen } from '@/features/billing-plan-catalog/components/PlanCatalogScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

/** Protects the admin plan catalog editor with its action 18 permission. */
export const Route = createFileRoute('/_authed/billing/plan-catalog')({
    beforeLoad: ({ context }) =>
        requireAdminPermission(context, PermissionEnum.MAINTENANCE_MODE_WRITE),
    component: PlanCatalogPage
});

function PlanCatalogPage() {
    return (
        <SidebarPageLayout titleKey="admin-billing.planCatalogEditor.title">
            <PlanCatalogScreen />
        </SidebarPageLayout>
    );
}
