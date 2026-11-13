import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { AddonPurchasesFreezeCard } from '@/features/billing-addon-freeze/components/AddonPurchasesFreezeCard';
import { SignupFreezeCard } from '@/features/billing-signup-freeze/components/SignupFreezeCard';
import { requireAdminPermission } from '@/lib/admin-api-access';

export const Route = createFileRoute('/_authed/billing/settings')({
    beforeLoad: ({ context }) =>
        requireAdminPermission(context, PermissionEnum.BILLING_SETTINGS_VIEW),
    component: BillingSettingsPage
});

/** Billing settings page for signup and addon purchase controls. */
export function BillingSettingsPage() {
    return (
        <SidebarPageLayout titleKey="admin-billing.settings.title">
            <SignupFreezeCard />
            <AddonPurchasesFreezeCard />
        </SidebarPageLayout>
    );
}
