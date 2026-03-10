import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { useAttractionPage } from '@/features/attractions/hooks/useAttractionPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { AttractionUpdateInputSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Attraction Edit Route Configuration
 */
export const Route = createFileRoute('/_authed/content/destination-attractions/$id_/edit')({
    component: AttractionEditPage,
    loader: async ({ params }) => ({ attractionId: params.id }),
    errorComponent: createErrorComponent('Attraction'),
    pendingComponent: createPendingComponent()
});

/**
 * Attraction Edit Page Component
 */
function AttractionEditPage() {
    const { id } = Route.useParams();
    const entityData = useAttractionPage(id);

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.ATTRACTION_UPDATE]}>
            <div className="space-y-4">
                <EntityPageBase
                    entityType="attraction"
                    entityId={id}
                    initialMode="edit"
                    entityData={entityData}
                    zodSchema={AttractionUpdateInputSchema}
                >
                    <EntityEditContent entityType="attraction" />
                </EntityPageBase>
            </div>
        </RoutePermissionGuard>
    );
}
