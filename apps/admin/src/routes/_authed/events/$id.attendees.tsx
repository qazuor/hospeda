/**
 * Event Attendees Tab Route
 *
 * Displays and manages attendees for a specific event.
 */

import { PageTabs, eventTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useEventQuery } from '@/features/events/hooks/useEventQuery';
import { useTranslations } from '@/hooks/use-translations';
import { InfoIcon, UsersIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/events/$id/attendees')({
    component: EventAttendeesPage
});

function EventAttendeesPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const { data: event, isLoading } = useEventQuery(id);

    // API response may include extended fields not in base Event type
    const eventExtended = event as
        | (typeof event & {
              capacity?: number;
              maxAttendees?: number;
          })
        | undefined;
    const capacity = (eventExtended?.capacity || eventExtended?.maxAttendees) as number | undefined;

    if (isLoading) {
        return (
            <SidebarPageLayout titleKey="admin-pages.titles.eventsView">
                <div className="space-y-4">
                    <PageTabs
                        tabs={eventTabs}
                        basePath={`/events/${id}`}
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

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.eventsView">
            <div className="space-y-4">
                <PageTabs
                    tabs={eventTabs}
                    basePath={`/events/${id}`}
                />

                <div className="rounded-lg border bg-card p-6">
                    <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.attendees')}</h2>

                    <div className="space-y-4">
                        {/* Empty State */}
                        <div className="py-12 text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                <UsersIcon className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="mb-2 font-semibold text-lg">Attendee Management</h3>

                            {capacity !== undefined && (
                                <Card className="mx-auto mb-4 max-w-sm">
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground text-sm">
                                                Event Capacity
                                            </span>
                                            <span className="font-semibold text-lg">
                                                {capacity} attendees
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            <p className="text-muted-foreground text-sm">
                                The attendee registration and tracking system is currently under
                                development.
                            </p>
                        </div>

                        {/* Info Card */}
                        <div className="flex gap-3 rounded-md border border-blue-200 bg-blue-50 p-4">
                            <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                            <div>
                                <p className="font-medium text-blue-900 text-sm">Coming Soon</p>
                                <p className="mt-1 text-blue-800 text-sm">
                                    The full attendee management system will be available in a
                                    future update. Features will include:
                                </p>
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-blue-800 text-sm">
                                    <li>View and manage all registered attendees</li>
                                    <li>Check-in functionality with QR code scanning</li>
                                    <li>Export attendee lists and reports</li>
                                    <li>Send notifications and updates to attendees</li>
                                    <li>Track attendance statistics and trends</li>
                                    <li>Manage waitlists when events reach capacity</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
