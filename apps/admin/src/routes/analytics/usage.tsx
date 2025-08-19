import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/analytics/usage')({
    component: () => (
        <SidebarPageLayout title="Analytics - Usage">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
