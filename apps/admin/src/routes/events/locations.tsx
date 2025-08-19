import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/events/locations')({
    component: () => (
        <SidebarPageLayout title="Event Locations">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
