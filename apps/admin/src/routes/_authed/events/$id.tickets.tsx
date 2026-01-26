/**
 * Event Tickets Tab Route
 *
 * Displays and manages tickets for a specific event.
 */

import { PageTabs, eventTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/events/$id/tickets')({
    component: EventTicketsPage
});

function EventTicketsPage() {
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
                    <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.tickets')}</h2>
                    <p className="text-muted-foreground">{t('ui.pages.todoAddContent')}</p>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
