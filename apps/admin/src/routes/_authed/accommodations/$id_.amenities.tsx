/**
 * Accommodation Amenities Tab Route
 *
 * Displays and manages amenities for a specific accommodation.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AccommodationSubTabLayout } from '@/features/accommodations/components/AccommodationSubTabLayout';
import { useAccommodationQuery } from '@/features/accommodations/hooks/useAccommodationQuery';
import { useTranslations } from '@/hooks/use-translations';
import { Link, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/accommodations/$id_/amenities')({
    component: AccommodationAmenitiesPage
});

function AccommodationAmenitiesPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const { data: accommodation, isLoading } = useAccommodationQuery(id);

    // Extract amenities from tags if they exist
    const rawData = accommodation as Record<string, unknown> | undefined;
    const tags = rawData?.tags as Record<string, unknown> | undefined;
    const amenities: unknown[] = Array.isArray(tags?.amenities)
        ? (tags.amenities as unknown[])
        : [];

    return (
        <AccommodationSubTabLayout
            accommodationId={id}
            entityName={accommodation?.name}
        >
            <div className="rounded-lg border bg-card p-6">
                <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.amenities')}</h2>

                {isLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                                key={i}
                                className="h-12 animate-pulse rounded-md bg-muted"
                            />
                        ))}
                    </div>
                ) : amenities.length === 0 ? (
                    <div className="space-y-4 py-6 text-center">
                        <p className="text-muted-foreground">
                            {t('admin-pages.accommodations.amenities.empty')}
                        </p>
                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                        >
                            <Link
                                to="/accommodations/$id/edit"
                                params={{ id }}
                            >
                                {t('admin-pages.accommodations.amenities.editCta')}
                            </Link>
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {amenities.map((amenity: unknown, index: number) => {
                            const amenityData =
                                typeof amenity === 'string'
                                    ? { name: amenity, category: 'general' }
                                    : (amenity as {
                                          name: string;
                                          category?: string;
                                          icon?: string;
                                      });

                            return (
                                // biome-ignore lint/suspicious/noArrayIndexKey: amenity data may not have stable IDs
                                <Card key={index}>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            {amenityData.icon && (
                                                <span className="text-xl">{amenityData.icon}</span>
                                            )}
                                            <span>{amenityData.name}</span>
                                        </CardTitle>
                                    </CardHeader>
                                    {amenityData.category && (
                                        <CardContent className="pt-0">
                                            <Badge variant="secondary">
                                                {amenityData.category}
                                            </Badge>
                                        </CardContent>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </AccommodationSubTabLayout>
    );
}
