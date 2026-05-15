import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { useAttractionPage } from '@/features/attractions/hooks/useAttractionPage';
import { useDeleteAttractionMutation } from '@/features/attractions/hooks/useAttractionQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

/**
 * Attraction View Route Configuration
 */
export const Route = createFileRoute('/_authed/content/destination-attractions/$id')({
    component: AttractionViewPage,
    loader: async ({ params }) => ({ attractionId: params.id }),
    errorComponent: createErrorComponent('Attraction'),
    pendingComponent: createPendingComponent()
});

/**
 * Attraction View Page Component
 */
function AttractionViewPage() {
    const { id } = Route.useParams();
    const navigate = useNavigate();
    const { t } = useTranslations();
    const entityData = useAttractionPage(id);

    const attraction = entityData.entity as { name?: string } | undefined;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <DeleteRowButton
                    entityId={id}
                    entityName={attraction?.name || id}
                    entityLabel={t('admin-entities.entities.attraction.singular')}
                    permission={PermissionEnum.ATTRACTION_DELETE}
                    useDeleteMutation={useDeleteAttractionMutation}
                    variant="full"
                    entityGender="f"
                    onDeleted={() => navigate({ to: '/content/destination-attractions' })}
                />
            </div>
            <EntityPageBase
                entityType="attraction"
                entityId={id}
                initialMode="view"
                entityData={entityData}
            >
                <EntityViewContent
                    entityType="attraction"
                    entityId={id}
                    sections={entityData.sections}
                    entity={entityData.entity || {}}
                    userPermissions={entityData.userPermissions}
                />
            </EntityPageBase>
        </div>
    );
}
