import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/me/accommodations/')({
    component: MyAccommodations
});

function MyAccommodations() {
    const { t } = useTranslations();

    return (
        <SidebarPageLayout title={t('admin-pages.titles.myAccommodations')}>
            <div>TODO: add content</div>
        </SidebarPageLayout>
    );
}
