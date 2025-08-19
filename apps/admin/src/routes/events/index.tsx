import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/events/')({
    component: () => (
        <SidebarPageLayout title="Events - List">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
