import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { PageTabs, destinationTabs } from '@/components/layout/PageTabs';
import { useDestinationPage } from '@/features/destinations/hooks/useDestinationPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Destination View Route Configuration
 */
export const Route = createFileRoute('/_authed/destinations/$id')({
    component: DestinationViewPage,
    loader: async ({ params }) => ({ destinationId: params.id }),
    errorComponent: createErrorComponent('Destination'),
    pendingComponent: createPendingComponent()
});

/**
 * Destination View Page Component
 */
function DestinationViewPage() {
    const { id } = Route.useParams();

    // Use the hook at the top level
    const entityData = useDestinationPage(id);

    return (
        <div className="space-y-4">
            {/* Level 3 Navigation: Page Tabs */}
            <PageTabs
                tabs={destinationTabs}
                basePath={`/destinations/${id}`}
            />

            <EntityPageBase
                entityType="destination"
                entityId={id}
                initialMode="view"
                entityData={entityData}
            >
                <EntityViewContent
                    entityType="destination"
                    entityId={id}
                    sections={entityData.sections}
                    entity={entityData.entity || {}}
                    userPermissions={entityData.userPermissions}
                />
            </EntityPageBase>
        </div>
    );
}
