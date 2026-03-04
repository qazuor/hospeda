/**
 * Event Location Events Tab Route
 *
 * Displays events held at a specific event location.
 */

import { PageTabs, eventLocationTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEventLocationQuery } from '@/features/event-locations/hooks/useEventLocationQuery';
import { useTranslations } from '@/hooks/use-translations';
import { CalendarIcon, InfoIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/events/locations/$id_/events')({
    component: EventLocationEventsPage
});

function EventLocationEventsPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const { data: location, isLoading } = useEventLocationQuery(id);

    if (isLoading) {
        return (
            <SidebarPageLayout titleKey="admin-pages.titles.eventLocations">
                <div className="space-y-4">
                    <PageTabs
                        tabs={eventLocationTabs}
                        basePath={`/events/locations/${id}`}
                    />
                    <div className="rounded-lg border bg-card p-6">
                        <div className="space-y-4">
                            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
                            <div className="h-32 animate-pulse rounded bg-muted" />
                        </div>
                    </div>
                </div>
            </SidebarPageLayout>
        );
    }

    const locationName =
        location?.placeName || t('admin-pages.events.locationEvents.defaultLocationName');

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.eventLocations">
            <div className="space-y-4">
                <PageTabs
                    tabs={eventLocationTabs}
                    basePath={`/events/locations/${id}`}
                />

                <div className="rounded-lg border bg-card p-6">
                    <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.events')}</h2>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                                    {t('admin-pages.events.locationEvents.eventsAt')} {locationName}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.events.locationEvents.noEvents')}
                                </p>
                            </CardContent>
                        </Card>

                        {/* Coming Soon Note */}
                        <div className="flex gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                            <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                            <div>
                                <p className="font-medium text-blue-900 text-sm dark:text-blue-200">
                                    {t('admin-pages.events.locationEvents.comingSoon')}
                                </p>
                                <p className="mt-1 text-blue-800 text-sm dark:text-blue-300">
                                    {t('admin-pages.events.locationEvents.comingSoonDesc')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
