/**
 * Destination Events Tab Route
 *
 * Displays events associated with a specific destination.
 */

import { PageTabs, destinationTabs } from '@/components/layout/PageTabs';
import { Badge } from '@/components/ui/badge';
import { useDestinationQuery } from '@/features/destinations/hooks/useDestinationQuery';
import { useTranslations } from '@/hooks/use-translations';
import { Link, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/destinations/$id/events')({
    component: DestinationEventsPage
});

function DestinationEventsPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const { data: destination, isLoading } = useDestinationQuery(id);

    // API response may include joined relations not in base Destination type
    const destinationWithRelations = destination as
        | (typeof destination & {
              events?: Array<Record<string, unknown>>;
          })
        | undefined;
    const events = Array.isArray(destinationWithRelations?.events)
        ? destinationWithRelations.events
        : [];

    /**
     * Format event date to localized string
     */
    const formatEventDate = (event: Record<string, unknown>): string => {
        try {
            const dateValue = event.date as Record<string, unknown> | undefined;
            if (dateValue && typeof dateValue === 'object' && 'start' in dateValue) {
                const startDate = new Date(String(dateValue.start));
                return startDate.toLocaleDateString('es-AR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }
            return 'Date not available';
        } catch {
            return 'Invalid date';
        }
    };

    return (
        <div className="space-y-4">
            <PageTabs
                tabs={destinationTabs}
                basePath={`/destinations/${id}`}
            />

            <div className="rounded-lg border bg-card p-6">
                <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.events')}</h2>

                {isLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                                key={i}
                                className="h-20 animate-pulse rounded-md bg-muted"
                            />
                        ))}
                    </div>
                ) : events.length === 0 ? (
                    <div className="py-8 text-center">
                        <p className="text-muted-foreground">
                            No events found for this destination.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {events.map((event: Record<string, unknown>) => (
                            <div
                                key={String(event.id)}
                                className="flex items-start justify-between py-4"
                            >
                                <div className="flex-1">
                                    <div className="mb-1">
                                        <Link
                                            to="/events/$id"
                                            params={{ id: String(event.id) }}
                                            className="font-medium text-primary hover:underline"
                                        >
                                            {String(event.name || 'Unnamed')}
                                        </Link>
                                        {event.category ? (
                                            <Badge
                                                variant="secondary"
                                                className="ml-2"
                                            >
                                                {String(event.category)}
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <p className="text-muted-foreground text-sm">
                                        {formatEventDate(event)}
                                    </p>
                                </div>
                                {event.lifecycleState ? (
                                    <Badge
                                        variant={
                                            event.lifecycleState === 'ACTIVE'
                                                ? 'success'
                                                : 'outline'
                                        }
                                    >
                                        {String(event.lifecycleState)}
                                    </Badge>
                                ) : null}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
