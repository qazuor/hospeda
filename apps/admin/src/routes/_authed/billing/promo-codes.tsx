import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { PromoCodesScreen } from '@/features/billing-promo-codes/components/PromoCodesScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

export const Route = createFileRoute('/_authed/billing/promo-codes')({
    beforeLoad: ({ context }) =>
        requireAdminPermission(context, PermissionEnum.BILLING_MANAGE_PROMO_CODES),
    component: PromoCodesPage
});

function PromoCodesPage() {
    return (
        <SidebarPageLayout titleKey="admin-billing.promoCodes.editor.title">
            <PromoCodesScreen />
        </SidebarPageLayout>
    );
}
