/**
 * Point Of Interest Destinations Tab Route
 *
 * Renders `PoiDestinationRelationManager` for the destination relations of a
 * specific point of interest (HOS-144 §6.6). Mirrors the pattern of
 * `destinations/$id_.faqs.tsx` — uses `PointOfInterestSubTabLayout` as the
 * wrapper and resolves the POI's display name for the breadcrumb/heading.
 *
 * No explicit `beforeLoad` permission guard is added here: the parent
 * `_authed.tsx` already enforces authentication for all routes under
 * `/_authed/`. Destination-relation read/write access is gated by the admin
 * API (`POINT_OF_INTEREST_*` permissions per HOS-143's route file), matching
 * every other point-of-interest/destination sub-tab in this project.
 */

import { createFileRoute } from '@tanstack/react-router';
import { PoiDestinationRelationManager } from '@/features/points-of-interest/components/PoiDestinationRelationManager';
import { PointOfInterestSubTabLayout } from '@/features/points-of-interest/components/PointOfInterestSubTabLayout';
import { usePointOfInterestQuery } from '@/features/points-of-interest/hooks/usePointOfInterestQuery';
import { resolveI18nText } from '@/utils/i18n-text';

export const Route = createFileRoute('/_authed/content/points-of-interest/$id_/destinations')({
    component: PointOfInterestDestinationsPage
});

function PointOfInterestDestinationsPage() {
    const { id } = Route.useParams();
    const { data: pointOfInterest } = usePointOfInterestQuery(id);

    const displayName = pointOfInterest ? resolveI18nText(pointOfInterest.nameI18n) : undefined;

    return (
        <PointOfInterestSubTabLayout
            pointOfInterestId={id}
            entityName={displayName}
        >
            <div className="rounded-lg border bg-card p-6">
                <PoiDestinationRelationManager pointOfInterestId={id} />
            </div>
        </PointOfInterestSubTabLayout>
    );
}
