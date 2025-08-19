import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/tags')({
    component: () => (
        <SidebarPageLayout title="Settings - Tags">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
