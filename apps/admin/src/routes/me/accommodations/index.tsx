import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/me/accommodations/')({
    component: () => (
        <SidebarPageLayout title="My Accommodations">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
