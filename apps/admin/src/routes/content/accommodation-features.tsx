import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/content/accommodation-features')({
    component: () => (
        <SidebarPageLayout title="Accommodation Features">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
