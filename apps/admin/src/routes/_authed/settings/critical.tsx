import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/settings/critical')({
    component: () => (
        <SidebarPageLayout title="Settings - Portal (Critical)">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
