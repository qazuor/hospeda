/**
 * @file _authed/content/partner-types/index.tsx
 * @description Partner type catalog screen (HOS-2336 AC-3.1).
 *
 * Guarded in `beforeLoad` by `PARTNER_TYPE_VIEW`, so a viewer without it is
 * redirected before anything renders. Write buttons are gated separately by
 * the create/update/delete/restore permissions.
 */

import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { PartnerTypesScreen } from '@/features/partner-types/components/PartnerTypesScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

export const Route = createFileRoute('/_authed/content/partner-types/')({
    beforeLoad: ({ context }) => requireAdminPermission(context, PermissionEnum.PARTNER_TYPE_VIEW),
    component: PartnerTypesPage
});

function PartnerTypesPage() {
    return (
        <SidebarPageLayout titleKey="admin-pages.partnerTypes.title">
            <PartnerTypesScreen />
        </SidebarPageLayout>
    );
}
