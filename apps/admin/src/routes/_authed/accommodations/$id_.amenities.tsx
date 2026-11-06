/**
 * Accommodation Amenities Tab Route
 *
 * Displays and manages amenities for a specific accommodation.
 */

import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import {
    AccommodationAmenitiesList,
    type AccommodationAmenityRow
} from '@/features/accommodations/components/AccommodationAmenitiesList';
import { AccommodationSubTabLayout } from '@/features/accommodations/components/AccommodationSubTabLayout';
import { useAccommodationQuery } from '@/features/accommodations/hooks/useAccommodationQuery';
import { useTranslations } from '@/hooks/use-translations';

export const Route = createFileRoute('/_authed/accommodations/$id_/amenities')({
    component: AccommodationAmenitiesPage
});

function AccommodationAmenitiesPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const { data: accommodation, isLoading } = useAccommodationQuery(id);

    // The admin detail endpoint returns the real relation under `amenities`.
    const rawAmenities = (accommodation as { amenities?: unknown } | undefined)?.amenities;
    const amenities: readonly AccommodationAmenityRow[] = Array.isArray(rawAmenities)
        ? (rawAmenities as AccommodationAmenityRow[])
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
                    <AccommodationAmenitiesList amenities={amenities} />
                )}
            </div>
        </AccommodationSubTabLayout>
    );
}
