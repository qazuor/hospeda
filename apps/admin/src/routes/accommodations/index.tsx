import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/accommodations/')({
    component: () => (
        <SidebarPageLayout title="Accommodations - List">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
