import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/events/new')({
    component: () => (
        <SidebarPageLayout title="Events - New">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
