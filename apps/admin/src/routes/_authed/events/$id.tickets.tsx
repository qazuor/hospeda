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
import { createFileRoute } from '@tanstack/react-router';
import { DollarSign, Info, Users } from 'lucide-react';

export const Route = createFileRoute('/_authed/events/$id/tickets')({
    component: EventTicketsPage
});

function EventTicketsPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const { data: event, isLoading } = useEventQuery(id);

    const pricing = event?.pricing as Record<string, unknown> | undefined;
    const isFree = pricing?.isFree === true;
    const price = pricing?.price as number | undefined;
    const currency = String(pricing?.currency || 'ARS');
    const capacity = (event?.capacity || event?.maxAttendees) as number | undefined;

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
                    <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.tickets')}</h2>

                    <div className="space-y-4">
                        {/* Pricing Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Pricing Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <span className="mb-1 block font-medium text-sm">
                                            Event Type
                                        </span>
                                        <Badge variant={isFree ? 'default' : 'secondary'}>
                                            {isFree ? 'Free Event' : 'Paid Event'}
                                        </Badge>
                                    </div>
                                </div>

                                {!isFree && price !== undefined && (
                                    <div>
                                        <span className="mb-1 block font-medium text-sm">
                                            Ticket Price
                                        </span>
                                        <p className="font-semibold text-muted-foreground text-xl">
                                            {currency} ${price.toFixed(2)}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Capacity Card */}
                        {capacity !== undefined && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Capacity</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-3">
                                        <Users className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <span className="mb-1 block font-medium text-sm">
                                                Maximum Attendees
                                            </span>
                                            <p className="font-semibold text-muted-foreground text-xl">
                                                {capacity} people
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Coming Soon Note */}
                        <div className="flex gap-3 rounded-md border border-blue-200 bg-blue-50 p-4">
                            <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                            <div>
                                <p className="font-medium text-blue-900 text-sm">Coming Soon</p>
                                <p className="mt-1 text-blue-800 text-sm">
                                    Advanced ticket management features will be available in a
                                    future update. You will be able to:
                                </p>
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-blue-800 text-sm">
                                    <li>Create multiple ticket types and tiers</li>
                                    <li>Set dynamic pricing and early bird discounts</li>
                                    <li>Configure ticket availability windows</li>
                                    <li>Manage ticket inventory and sales</li>
                                    <li>Generate QR codes for ticket validation</li>
                                    <li>Track ticket sales and revenue</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
