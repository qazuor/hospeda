import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { PlanMigrationScreen } from '@/features/billing-plan-migration/components/PlanMigrationScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

/** Protects action 17 with its dedicated SUPER_ADMIN permission. */
export const Route = createFileRoute('/_authed/billing/plan-migration')({
    beforeLoad: ({ context }) =>
        requireAdminPermission(context, PermissionEnum.BILLING_MIGRATE_PLAN),
    component: PlanMigrationPage
});

function PlanMigrationPage() {
    return (
        <SidebarPageLayout titleKey="admin-pages.planMigration.title">
            <PlanMigrationScreen />
        </SidebarPageLayout>
    );
}
