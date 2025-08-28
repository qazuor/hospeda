import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/destinations/new')({
    component: () => (
        <SidebarPageLayout title="Destinations - New">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
