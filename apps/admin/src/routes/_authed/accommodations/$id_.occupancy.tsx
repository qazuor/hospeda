/**
 * Accommodation Occupancy Tab Route (HOS-43 Phase 1)
 *
 * Read-only occupancy calendar view for a specific accommodation. Content is
 * gated client-side by `ACCOMMODATION_OCCUPANCY_VIEW` via `PermissionGate`
 * (mirroring the `SOCIAL_POST_APPROVE` precedent) — the admin API endpoint
 * enforces the same permission server-side (`adminAuthMiddleware`), so this
 * is defense-in-depth against a needless 403 fetch, not the sole guard.
 */

import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { AccommodationOccupancyList } from '@/features/accommodations/components/AccommodationOccupancyList';
import { AccommodationSubTabLayout } from '@/features/accommodations/components/AccommodationSubTabLayout';
import { useAccommodationQuery } from '@/features/accommodations/hooks/useAccommodationQuery';
import { useTranslations } from '@/hooks/use-translations';

export const Route = createFileRoute('/_authed/accommodations/$id_/occupancy')({
    component: AccommodationOccupancyPage
});

function AccommodationOccupancyPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const { data: accommodation } = useAccommodationQuery(id);

    return (
        <AccommodationSubTabLayout
            accommodationId={id}
            entityName={accommodation?.name}
        >
            <div className="rounded-lg border bg-card p-6">
                <h2 className="mb-4 font-semibold text-lg">
                    {t('admin-pages.accommodations.occupancy.title')}
                </h2>

                <PermissionGate permissions={[PermissionEnum.ACCOMMODATION_OCCUPANCY_VIEW]}>
                    <AccommodationOccupancyList accommodationId={id} />
                </PermissionGate>
            </div>
        </AccommodationSubTabLayout>
    );
}
