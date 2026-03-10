import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { PageTabs, destinationTabs } from '@/components/layout/PageTabs';
import { useDestinationPage } from '@/features/destinations/hooks/useDestinationPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { DestinationUpdateInputSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Destination Edit Route Configuration
 */
export const Route = createFileRoute('/_authed/destinations/$id_/edit')({
    component: DestinationEditPage,
    loader: async ({ params }) => ({ destinationId: params.id }),
    errorComponent: createErrorComponent('Destination'),
    pendingComponent: createPendingComponent()
});

/**
 * Destination Edit Page Component
 */
function DestinationEditPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useDestinationPage(id);

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.DESTINATION_UPDATE]}>
            <div className="space-y-4">
                {/* Level 3 Navigation: Page Tabs */}
                <PageTabs
                    tabs={destinationTabs}
                    basePath={`/destinations/${id}`}
                />

                <EntityPageBase
                    entityType="destination"
                    entityId={id}
                    initialMode="edit"
                    entityData={entityData}
                    zodSchema={DestinationUpdateInputSchema}
                >
                    <EntityEditContent entityType="destination" />
                </EntityPageBase>
            </div>
        </RoutePermissionGuard>
    );
}
