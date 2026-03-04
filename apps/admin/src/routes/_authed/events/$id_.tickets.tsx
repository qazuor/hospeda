/**
 * Event Tickets Tab Route
 *
 * Displays and manages tickets for a specific event.
 */

import { PageTabs, eventTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEventQuery } from '@/features/events/hooks/useEventQuery';
import { useTranslations } from '@/hooks/use-translations';
import { formatCurrency } from '@repo/i18n';
import { DollarSignIcon, InfoIcon, UsersIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/events/$id_/tickets')({
    component: EventTicketsPage
});

function EventTicketsPage() {
    const { id } = Route.useParams();
    const { t, locale } = useTranslations();
    const { data: event, isLoading } = useEventQuery(id);

    // API response may include extended fields not in base Event type
    const eventExtended = event as
        | (typeof event & {
              capacity?: number;
              maxAttendees?: number;
          })
        | undefined;
    const pricing = event?.pricing as Record<string, unknown> | undefined;
    const isFree = pricing?.isFree === true;
    const price = pricing?.price as number | undefined;
    const currency = String(pricing?.currency || 'ARS');
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
                    <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.tickets')}</h2>

                    <div className="space-y-4">
                        {/* Pricing Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    {t('admin-pages.events.tickets.pricingInfo')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <DollarSignIcon className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <span className="mb-1 block font-medium text-sm">
                                            {t('admin-pages.events.tickets.eventType')}
                                        </span>
                                        <Badge variant={isFree ? 'default' : 'secondary'}>
                                            {isFree
                                                ? t('admin-pages.events.tickets.freeEvent')
                                                : t('admin-pages.events.tickets.paidEvent')}
                                        </Badge>
                                    </div>
                                </div>

                                {!isFree && price !== undefined && (
                                    <div>
                                        <span className="mb-1 block font-medium text-sm">
                                            {t('admin-pages.events.tickets.ticketPrice')}
                                        </span>
                                        <p className="font-semibold text-muted-foreground text-xl">
                                            {formatCurrency({ value: price, locale, currency })}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Capacity Card */}
                        {capacity !== undefined && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        {t('admin-pages.events.tickets.capacity')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-3">
                                        <UsersIcon className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <span className="mb-1 block font-medium text-sm">
                                                {t('admin-pages.events.tickets.maxAttendees')}
                                            </span>
                                            <p className="font-semibold text-muted-foreground text-xl">
                                                {capacity} {t('admin-pages.events.tickets.people')}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Coming Soon Note */}
                        <div className="flex gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                            <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                            <div>
                                <p className="font-medium text-blue-900 text-sm dark:text-blue-200">
                                    {t('admin-pages.events.tickets.comingSoon')}
                                </p>
                                <p className="mt-1 text-blue-800 text-sm dark:text-blue-300">
                                    {t('admin-pages.events.tickets.comingSoonDesc')}
                                </p>
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-blue-800 text-sm dark:text-blue-300">
                                    <li>{t('admin-pages.events.tickets.featureTicketTypes')}</li>
                                    <li>{t('admin-pages.events.tickets.featureDynamicPricing')}</li>
                                    <li>{t('admin-pages.events.tickets.featureAvailability')}</li>
                                    <li>{t('admin-pages.events.tickets.featureInventory')}</li>
                                    <li>{t('admin-pages.events.tickets.featureQr')}</li>
                                    <li>{t('admin-pages.events.tickets.featureSalesTracking')}</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
