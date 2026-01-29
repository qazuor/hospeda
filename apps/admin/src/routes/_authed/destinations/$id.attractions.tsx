/**
 * Destination Attractions Tab Route
 *
 * Displays attractions associated with a specific destination.
 */

import { PageTabs, destinationTabs } from '@/components/layout/PageTabs';
import { Badge } from '@/components/ui/badge';
import { useDestinationQuery } from '@/features/destinations/hooks/useDestinationQuery';
import { useTranslations } from '@/hooks/use-translations';
import { Link, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/destinations/$id/attractions')({
    component: DestinationAttractionsPage
});

function DestinationAttractionsPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const { data: destination, isLoading } = useDestinationQuery(id);

    const attractions = Array.isArray(destination?.attractions) ? destination.attractions : [];

    return (
        <div className="space-y-4">
            <PageTabs
                tabs={destinationTabs}
                basePath={`/destinations/${id}`}
            />

            <div className="rounded-lg border bg-card p-6">
                <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.attractions')}</h2>

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
                ) : attractions.length === 0 ? (
                    <div className="py-8 text-center">
                        <p className="text-muted-foreground">
                            No attractions found for this destination.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {attractions.map((attraction: Record<string, unknown>) => (
                            <div
                                key={String(attraction.id)}
                                className="flex items-start justify-between py-4"
                            >
                                <div className="flex-1">
                                    <div className="mb-1">
                                        <Link
                                            to="/attractions/$id"
                                            params={{ id: String(attraction.id) }}
                                            className="font-medium text-primary hover:underline"
                                        >
                                            {String(attraction.name || 'Unnamed')}
                                        </Link>
                                        {attraction.type ? (
                                            <Badge
                                                variant="secondary"
                                                className="ml-2"
                                            >
                                                {String(attraction.type)}
                                            </Badge>
                                        ) : null}
                                    </div>
                                    {attraction.description ? (
                                        <p className="line-clamp-2 text-muted-foreground text-sm">
                                            {String(attraction.description)}
                                        </p>
                                    ) : null}
                                </div>
                                {attraction.lifecycleState ? (
                                    <Badge
                                        variant={
                                            attraction.lifecycleState === 'ACTIVE'
                                                ? 'success'
                                                : 'outline'
                                        }
                                    >
                                        {String(attraction.lifecycleState)}
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
