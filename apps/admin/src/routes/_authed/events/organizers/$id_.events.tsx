/**
 * Event Organizer Events Tab Route
 *
 * Displays events organized by a specific event organizer.
 */

import { PageTabs, eventOrganizerTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEventOrganizerQuery } from '@/features/event-organizers/hooks/useEventOrganizerQuery';
import { useTranslations } from '@/hooks/use-translations';
import { CalendarIcon, InfoIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/events/organizers/$id_/events')({
    component: EventOrganizerEventsPage
});

function EventOrganizerEventsPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const { data: organizer, isLoading } = useEventOrganizerQuery(id);

    if (isLoading) {
        return (
            <SidebarPageLayout titleKey="admin-pages.titles.eventOrganizers">
                <div className="space-y-4">
                    <PageTabs
                        tabs={eventOrganizerTabs}
                        basePath={`/events/organizers/${id}`}
                    />
                    <div className="rounded-lg border bg-card p-6">
                        <div className="space-y-4">
                            <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
                            <div className="h-32 animate-pulse rounded bg-gray-100" />
                        </div>
                    </div>
                </div>
            </SidebarPageLayout>
        );
    }

    const organizerName = organizer?.name || 'Organizer';

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.eventOrganizers">
            <div className="space-y-4">
                <PageTabs
                    tabs={eventOrganizerTabs}
                    basePath={`/events/organizers/${id}`}
                />

                <div className="rounded-lg border bg-card p-6">
                    <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.events')}</h2>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                                    Events by {organizerName}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground text-sm">
                                    No events found for this organizer.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Coming Soon Note */}
                        <div className="flex gap-3 rounded-md border border-blue-200 bg-blue-50 p-4">
                            <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                            <div>
                                <p className="font-medium text-blue-900 text-sm">Coming Soon</p>
                                <p className="mt-1 text-blue-800 text-sm">
                                    This tab will display all events organized by this organizer,
                                    including past, current, and upcoming events with quick actions.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
