import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/sponsors')({
    component: () => (
        <SidebarPageLayout title="Sponsors">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
