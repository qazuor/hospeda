/**
 * Event Attendees Tab Route
 *
 * Displays and manages attendees for a specific event.
 */

import { PageTabs, eventTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/events/$id/attendees')({
    component: EventAttendeesPage
});

function EventAttendeesPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.eventsView">
            <div className="space-y-4">
                <PageTabs
                    tabs={eventTabs}
                    basePath={`/events/${id}`}
                />

                <div className="rounded-lg border bg-card p-6">
                    <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.attendees')}</h2>
                    <p className="text-muted-foreground">{t('ui.pages.todoAddContent')}</p>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
