/**
 * Destination Accommodations Tab Route
 *
 * Displays accommodations associated with a specific destination.
 */

import { PageTabs, destinationTabs } from '@/components/layout/PageTabs';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/destinations/$id/accommodations')({
    component: DestinationAccommodationsPage
});

function DestinationAccommodationsPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();

    return (
        <div className="space-y-4">
            <PageTabs
                tabs={destinationTabs}
                basePath={`/destinations/${id}`}
            />

            <div className="rounded-lg border bg-card p-6">
                <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.accommodations')}</h2>
                <p className="text-muted-foreground">{t('ui.pages.todoAddContent')}</p>
            </div>
        </div>
    );
}
