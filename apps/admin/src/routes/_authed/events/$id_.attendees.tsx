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

export const Route = createFileRoute('/_authed/events/$id_/attendees')({
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
                            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
                            <div className="h-32 animate-pulse rounded bg-muted" />
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
                            <h3 className="mb-2 font-semibold text-lg">
                                {t('admin-pages.events.attendees.managementTitle')}
                            </h3>

                            {capacity !== undefined && (
                                <Card className="mx-auto mb-4 max-w-sm">
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground text-sm">
                                                {t('admin-pages.events.attendees.eventCapacity')}
                                            </span>
                                            <span className="font-semibold text-lg">
                                                {capacity}{' '}
                                                {t('admin-pages.events.attendees.attendeesUnit')}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            <p className="text-muted-foreground text-sm">
                                {t('admin-pages.events.attendees.underDevelopment')}
                            </p>
                        </div>

                        {/* Info Card */}
                        <div className="flex gap-3 rounded-md border border-info/30 bg-info/10 p-4">
                            <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-info" />
                            <div>
                                <p className="font-medium text-foreground text-sm">
                                    {t('admin-pages.events.attendees.comingSoon')}
                                </p>
                                <p className="mt-1 text-muted-foreground text-sm">
                                    {t('admin-pages.events.attendees.comingSoonDesc')}
                                </p>
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
                                    <li>{t('admin-pages.events.attendees.featureViewManage')}</li>
                                    <li>{t('admin-pages.events.attendees.featureCheckin')}</li>
                                    <li>{t('admin-pages.events.attendees.featureExport')}</li>
                                    <li>
                                        {t('admin-pages.events.attendees.featureNotifications')}
                                    </li>
                                    <li>{t('admin-pages.events.attendees.featureStats')}</li>
                                    <li>{t('admin-pages.events.attendees.featureWaitlists')}</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
