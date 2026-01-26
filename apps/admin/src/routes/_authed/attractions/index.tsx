/**
 * Attractions List Page Route
 *
 * Displays list of all attractions.
 */

import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/attractions/')({
    component: AttractionsPage
});

function AttractionsPage() {
    const { t } = useTranslations();

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.attractionsList">
            <div className="rounded-lg border bg-card p-6">
                <h2 className="mb-4 font-semibold text-lg">
                    {t('admin-entities.attraction.list')}
                </h2>
                <p className="text-muted-foreground">{t('ui.pages.todoAddContent')}</p>
            </div>
        </SidebarPageLayout>
    );
}
