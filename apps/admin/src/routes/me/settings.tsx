import { MainPageLayout } from '@/components/layout/MainPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/me/settings')({
    component: () => (
        <MainPageLayout title="My Settings">
            <div>TODO: add content</div>
        </MainPageLayout>
    )
});
