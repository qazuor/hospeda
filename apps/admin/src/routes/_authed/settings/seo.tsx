import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/settings/seo')({
    component: () => (
        <SidebarPageLayout title="Settings - SEO">
            <div>TODO: add content</div>
        </SidebarPageLayout>
    )
});
