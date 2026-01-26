import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { PageTabs, accommodationTabs } from '@/components/layout/PageTabs';
import { useAccommodationPage } from '@/features/accommodations/hooks/useAccommodationPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
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
        <div className="space-y-4">
            {/* Level 3 Navigation: Page Tabs */}
            <PageTabs
                tabs={accommodationTabs}
                basePath={`/accommodations/${id}`}
            />

            <EntityPageBase
                entityType="accommodation"
                entityId={id}
                initialMode="edit"
                entityData={entityData}
            >
                <EntityEditContent entityType="accommodation" />
            </EntityPageBase>
        </div>
    );
}
