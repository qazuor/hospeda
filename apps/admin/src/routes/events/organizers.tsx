import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/events/organizers')({
    component: () => (
        <SidebarPageLayout title="Event Organizers">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
