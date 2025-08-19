import { MainPageLayout } from '@/components/layout/MainPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/notifications')({
    component: () => (
        <MainPageLayout title="Notifications">
            <div>TODO: add content</div>
        </MainPageLayout>
    )
});
