import { MainPageLayout } from '@/components/layout/MainPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/me/profile')({
    component: () => (
        <MainPageLayout title="My Profile">
            <div>TODO: add content</div>
        </MainPageLayout>
    )
});
