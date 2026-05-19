/**
 * User Detail Page Route
 *
 * Displays user profile information with tabs for permissions and activity.
 */

import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { PageTabs, userTabs } from '@/components/layout/PageTabs';
import { ImpersonateButton } from '@/features/users/components/ImpersonateButton';
import { useUserPage } from '@/features/users/hooks/useUserPage';
import { useDeleteUserMutation } from '@/features/users/hooks/useUserQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/access/users/$id')({
    component: UserViewPage,
    loader: async ({ params }) => ({ userId: params.id }),
    errorComponent: createErrorComponent('User'),
    pendingComponent: createPendingComponent()
});

function UserViewPage() {
    const { id } = Route.useParams();
    const navigate = useNavigate();
    const { t } = useTranslations();
    // Use the hook at the top level
    const entityData = useUserPage(id);

    const userEntity = entityData.entity as { displayName?: string; slug?: string } | undefined;
    const displayName = userEntity?.displayName || userEntity?.slug || id;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <PageTabs
                    tabs={userTabs}
                    basePath={`/access/users/${id}`}
                />
                <div className="flex items-center gap-2">
                    <ImpersonateButton
                        userId={id}
                        variant="full"
                    />
                    <DeleteRowButton
                        entityId={id}
                        entityName={displayName}
                        entityLabel={t('admin-entities.entities.user.singular')}
                        permission={PermissionEnum.USER_DELETE}
                        useDeleteMutation={useDeleteUserMutation}
                        variant="full"
                        onDeleted={() => navigate({ to: '/access/users' })}
                    />
                </div>
            </div>

            <EntityPageBase
                entityType="user"
                entityId={id}
                initialMode="view"
                entityData={entityData}
            >
                <EntityViewContent
                    entityType="user"
                    entityId={id}
                    sections={entityData.sections}
                    entity={entityData.entity || {}}
                    userPermissions={entityData.userPermissions}
                />
            </EntityPageBase>
        </div>
    );
}
