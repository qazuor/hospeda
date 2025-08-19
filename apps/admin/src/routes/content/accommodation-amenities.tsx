import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/content/accommodation-amenities')({
    component: () => (
        <SidebarPageLayout title="Accommodation Amenities">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
