import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/accommodations/new')({
    component: () => (
        <SidebarPageLayout title="Accommodations - New">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
