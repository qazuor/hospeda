/**
 * Destination Accommodations Tab Route
 *
 * Displays accommodations associated with a specific destination.
 */

import { PageTabs, destinationTabs } from '@/components/layout/PageTabs';
import { Badge } from '@/components/ui/badge';
import { useDestinationQuery } from '@/features/destinations/hooks/useDestinationQuery';
import { useTranslations } from '@/hooks/use-translations';
import { Link, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/destinations/$id_/accommodations')({
    component: DestinationAccommodationsPage
});

function DestinationAccommodationsPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const { data: destination, isLoading } = useDestinationQuery(id);

    // API response may include joined relations not in base Destination type
    const destinationWithRelations = destination as
        | (typeof destination & {
              accommodations?: Array<Record<string, unknown>>;
          })
        | undefined;
    const accommodations = Array.isArray(destinationWithRelations?.accommodations)
        ? destinationWithRelations.accommodations
        : [];

    return (
        <div className="space-y-4">
            <PageTabs
                tabs={destinationTabs}
                basePath={`/destinations/${id}`}
            />

            <div className="rounded-lg border bg-card p-6">
                <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.accommodations')}</h2>

                {isLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                                key={i}
                                className="h-16 animate-pulse rounded-md bg-muted"
                            />
                        ))}
                    </div>
                ) : accommodations.length === 0 ? (
                    <div className="py-8 text-center">
                        <p className="text-muted-foreground">
                            No accommodations found for this destination.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {accommodations.map((acc: Record<string, unknown>) => (
                            <div
                                key={String(acc.id)}
                                className="flex items-center justify-between py-3"
                            >
                                <div>
                                    <Link
                                        to="/accommodations/$id"
                                        params={{ id: String(acc.id) }}
                                        className="font-medium text-primary hover:underline"
                                    >
                                        {String(acc.name || 'Unnamed')}
                                    </Link>
                                    {acc.type ? (
                                        <Badge
                                            variant="secondary"
                                            className="ml-2"
                                        >
                                            {String(acc.type)}
                                        </Badge>
                                    ) : null}
                                </div>
                                {acc.lifecycleState ? (
                                    <Badge
                                        variant={
                                            acc.lifecycleState === 'ACTIVE' ? 'success' : 'outline'
                                        }
                                    >
                                        {String(acc.lifecycleState)}
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
