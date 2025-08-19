import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/access/permissions')({
    component: () => (
        <SidebarPageLayout title="Access - Permissions">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
