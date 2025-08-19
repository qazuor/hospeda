import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/posts/')({
    component: () => (
        <SidebarPageLayout title="Posts - List">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
