import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/analytics/debug')({
    component: () => (
        <SidebarPageLayout title="Analytics - Debug">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
