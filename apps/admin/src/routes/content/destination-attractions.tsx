import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/content/destination-attractions')({
    component: () => (
        <SidebarPageLayout title="Destination Attractions">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
