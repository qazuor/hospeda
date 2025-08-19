import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/posts/new')({
    component: () => (
        <SidebarPageLayout title="Posts - New">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
