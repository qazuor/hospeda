/**
 * Point Of Interest Categories Tab Route
 *
 * Renders `PoiCategoryManager` for the category assignments of a specific
 * point of interest (HOS-144 §6.4). Mirrors
 * `$id_.destinations.tsx` — uses `PointOfInterestSubTabLayout` as the
 * wrapper and resolves the POI's display name for the breadcrumb/heading.
 *
 * No explicit `beforeLoad` permission guard is added here: the parent
 * `_authed.tsx` already enforces authentication for all routes under
 * `/_authed/`. Category read/write access is gated by the admin API
 * (`POINT_OF_INTEREST_VIEW`/`POI_CATEGORY_UPDATE` per HOS-143's route file),
 * matching every other point-of-interest sub-tab in this project.
 */

import { createFileRoute } from '@tanstack/react-router';
import { PoiCategoryManager } from '@/features/points-of-interest/components/PoiCategoryManager';
import { PointOfInterestSubTabLayout } from '@/features/points-of-interest/components/PointOfInterestSubTabLayout';
import { usePointOfInterestQuery } from '@/features/points-of-interest/hooks/usePointOfInterestQuery';
import { resolveI18nText } from '@/utils/i18n-text';

export const Route = createFileRoute('/_authed/content/points-of-interest/$id_/categories')({
    component: PointOfInterestCategoriesPage
});

function PointOfInterestCategoriesPage() {
    const { id } = Route.useParams();
    const { data: pointOfInterest } = usePointOfInterestQuery(id);

    const displayName = pointOfInterest ? resolveI18nText(pointOfInterest.nameI18n) : undefined;

    return (
        <PointOfInterestSubTabLayout
            pointOfInterestId={id}
            entityName={displayName}
        >
            <div className="rounded-lg border bg-card p-6">
                <PoiCategoryManager pointOfInterestId={id} />
            </div>
        </PointOfInterestSubTabLayout>
    );
}
