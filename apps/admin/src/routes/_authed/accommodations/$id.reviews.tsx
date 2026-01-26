/**
 * Accommodation Reviews Tab Route
 *
 * Displays and manages reviews for a specific accommodation.
 */

import { PageTabs, accommodationTabs } from '@/components/layout/PageTabs';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/accommodations/$id/reviews')({
    component: AccommodationReviewsPage
});

function AccommodationReviewsPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();

    return (
        <div className="space-y-4">
            <PageTabs
                tabs={accommodationTabs}
                basePath={`/accommodations/${id}`}
            />

            <div className="rounded-lg border bg-card p-6">
                <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.reviews')}</h2>
                <p className="text-muted-foreground">{t('ui.pages.todoAddContent')}</p>
            </div>
        </div>
    );
}
