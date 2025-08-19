import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/access/users/new')({
    component: () => (
        <SidebarPageLayout title="Users - New">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
