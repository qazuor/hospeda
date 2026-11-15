import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { TemporaryCourtesyScreen } from '@/features/billing-temporary-courtesy/components/TemporaryCourtesyScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

/** Direct ACC_1 page for temporary courtesy. */
export const Route = createFileRoute('/_authed/billing/subscriptions/$subscriptionId/courtesy')({
    beforeLoad: ({ context }) =>
        requireAdminPermission(context, PermissionEnum.BILLING_GRANT_COMPLIMENTARY),
    component: CourtesyPage
});

function CourtesyPage() {
    const { subscriptionId } = Route.useParams();
    return (
        <SidebarPageLayout titleKey="admin-billing.temporaryCourtesy.title">
            <TemporaryCourtesyScreen subscriptionId={subscriptionId} />
        </SidebarPageLayout>
    );
}
