import { RevalidateEntityButton } from '@/components/RevalidateEntityButton';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { PageTabs, accommodationTabs } from '@/components/layout/PageTabs';
import { useAccommodationPage } from '@/features/accommodations/hooks/useAccommodationPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { AccommodationUpdateInputSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Accommodation Edit Route Configuration
 */
export const Route = createFileRoute('/_authed/accommodations/$id_/edit')({
    component: AccommodationEditPage,
    loader: async ({ params }) => ({ accommodationId: params.id }),
    errorComponent: createErrorComponent('Accommodation'),
    pendingComponent: createPendingComponent()
});

/**
 * Accommodation Edit Page Component
 */
function AccommodationEditPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useAccommodationPage(id);

    return (
        <RoutePermissionGuard
            permissions={[
                PermissionEnum.ACCOMMODATION_UPDATE_OWN,
                PermissionEnum.ACCOMMODATION_UPDATE_ANY
            ]}
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    {/* Level 3 Navigation: Page Tabs */}
                    <PageTabs
                        tabs={accommodationTabs}
                        basePath={`/accommodations/${id}`}
                    />
                    <RevalidateEntityButton
                        entityType="accommodation"
                        entityId={id}
                    />
                </div>

                <EntityPageBase
                    entityType="accommodation"
                    entityId={id}
                    initialMode="edit"
                    entityData={entityData}
                    zodSchema={AccommodationUpdateInputSchema}
                >
                    <EntityEditContent entityType="accommodation" />
                </EntityPageBase>
            </div>
        </RoutePermissionGuard>
    );
}
