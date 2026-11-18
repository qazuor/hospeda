/**
 * @file _authed/content/host-trade-categories/index.tsx
 * @description Provider trade category catalog screen (HOS-919 T-043).
 *
 * Guarded in `beforeLoad` by `HOST_TRADE_CATEGORY_VIEW`, so a viewer without it
 * is redirected before anything renders. Write buttons are gated separately,
 * inside the tabs, by the create/update/delete permissions.
 */

import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { HostTradeCategoriesScreen } from '@/features/host-trade-categories/components/HostTradeCategoriesScreen';
import { requireAdminPermission } from '@/lib/admin-api-access';

export const Route = createFileRoute('/_authed/content/host-trade-categories/')({
    beforeLoad: ({ context }) =>
        requireAdminPermission(context, PermissionEnum.HOST_TRADE_CATEGORY_VIEW),
    component: HostTradeCategoriesPage
});

function HostTradeCategoriesPage() {
    return (
        <SidebarPageLayout titleKey="admin-pages.hostTradeCategories.title">
            <HostTradeCategoriesScreen />
        </SidebarPageLayout>
    );
}
