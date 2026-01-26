/**
 * Destination Attractions Tab Route
 *
 * Displays attractions associated with a specific destination.
 */

import { PageTabs, destinationTabs } from '@/components/layout/PageTabs';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/destinations/$id/attractions')({
    component: DestinationAttractionsPage
});

function DestinationAttractionsPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();

    return (
        <div className="space-y-4">
            <PageTabs
                tabs={destinationTabs}
                basePath={`/destinations/${id}`}
            />

            <div className="rounded-lg border bg-card p-6">
                <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.attractions')}</h2>
                <p className="text-muted-foreground">{t('ui.pages.todoAddContent')}</p>
            </div>
        </div>
    );
}
