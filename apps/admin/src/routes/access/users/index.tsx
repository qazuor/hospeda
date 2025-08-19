import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/access/users/')({
    component: () => (
        <SidebarPageLayout title="Users - List">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
