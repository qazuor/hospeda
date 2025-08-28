import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/analytics/business')({
    component: () => (
        <SidebarPageLayout title="Analytics - Business">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
