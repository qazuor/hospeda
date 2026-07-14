import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { PointOfInterestSubTabLayout } from '@/features/points-of-interest/components/PointOfInterestSubTabLayout';
import { usePointOfInterestPage } from '@/features/points-of-interest/hooks/usePointOfInterestPage';
import { useDeletePointOfInterestMutation } from '@/features/points-of-interest/hooks/usePointOfInterestQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { resolveI18nText } from '@/utils/i18n-text';

/**
 * Point Of Interest View Route Configuration
 */
export const Route = createFileRoute('/_authed/content/points-of-interest/$id')({
    component: PointOfInterestViewPage,
    loader: async ({ params }) => ({ pointOfInterestId: params.id }),
    errorComponent: createErrorComponent('PointOfInterest'),
    pendingComponent: createPendingComponent()
});

/**
 * Point Of Interest View Page Component
 *
 * Wrapped in `PointOfInterestSubTabLayout` (HOS-144 §6.6, T-015) so the
 * Overview / Categories / Destinations / Edit tab strip is available from
 * the entity's landing page, not just its Categories/Destinations sub-tabs.
 */
function PointOfInterestViewPage() {
    const { id } = Route.useParams();
    const navigate = useNavigate();
    const { t } = useTranslations();
    const entityData = usePointOfInterestPage(id);

    const displayName = entityData.entity ? resolveI18nText(entityData.entity.nameI18n) : undefined;

    return (
        <PointOfInterestSubTabLayout
            pointOfInterestId={id}
            entityName={displayName}
        >
            <div className="space-y-4">
                <div className="flex justify-end">
                    <DeleteRowButton
                        entityId={id}
                        entityName={displayName || id}
                        entityLabel={t('admin-entities.entities.pointOfInterest.singular')}
                        permission={PermissionEnum.POINT_OF_INTEREST_DELETE}
                        useDeleteMutation={useDeletePointOfInterestMutation}
                        variant="full"
                        entityGender="m"
                        onDeleted={() => navigate({ to: '/content/points-of-interest' })}
                    />
                </div>
                <EntityPageBase
                    entityType="pointOfInterest"
                    entityId={id}
                    initialMode="view"
                    entityData={entityData}
                >
                    <EntityViewContent
                        entityType="pointOfInterest"
                        entityId={id}
                        sections={entityData.sections}
                        entity={entityData.entity || {}}
                        userPermissions={entityData.userPermissions}
                        flat
                    />
                </EntityPageBase>
            </div>
        </PointOfInterestSubTabLayout>
    );
}
