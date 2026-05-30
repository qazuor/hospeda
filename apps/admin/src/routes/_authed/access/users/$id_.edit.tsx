import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { PageTabs, userTabs } from '@/components/layout/PageTabs';
import { ImpersonateButton } from '@/features/users/components/ImpersonateButton';
import { UserEditDirtyGuard } from '@/features/users/components/UserEditDirtyGuard';
import { useUserHeaderProps } from '@/features/users/hooks/useUserHeaderProps';
import { useUserPage } from '@/features/users/hooks/useUserPage';
import { useDeleteUserMutation } from '@/features/users/hooks/useUserQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum, UserUpdateInputSchema } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

/**
 * User Edit Route Configuration
 */
export const Route = createFileRoute('/_authed/access/users/$id_/edit')({
    component: UserEditPage,
    loader: async ({ params }) => ({ userId: params.id }),
    errorComponent: createErrorComponent('User'),
    pendingComponent: createPendingComponent()
});

/**
 * User Edit Page Component
 */
function UserEditPage() {
    const { id } = Route.useParams();
    const navigate = useNavigate();
    const { t } = useTranslations();
    const entityData = useUserPage(id);

    const userEntity = entityData.entity as { displayName?: string; slug?: string } | undefined;
    const displayName = userEntity?.displayName || userEntity?.slug || id;

    const headerProps = useUserHeaderProps({
        entity: entityData.entity as Record<string, unknown> | undefined
    });

    const headerExtraActions = (
        <>
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
        </>
    );

    const headerTabs = (
        <PageTabs
            tabs={userTabs}
            basePath={`/access/users/${id}`}
            className="!mb-0 !border-b-0"
        />
    );

    return (
        <RoutePermissionGuard
            permissions={[PermissionEnum.USER_UPDATE_ROLES, PermissionEnum.USER_CREATE]}
        >
            <EntityPageBase
                entityType="user"
                entityId={id}
                initialMode="edit"
                entityData={entityData}
                zodSchema={UserUpdateInputSchema}
                headerMedia={headerProps.media}
                headerSubtitle={headerProps.subtitle}
                headerBadges={headerProps.badges}
                headerExtraActions={headerExtraActions}
                headerTabs={headerTabs}
            >
                <EntityEditContent entityType="user" />
                <UserEditDirtyGuard />
            </EntityPageBase>
        </RoutePermissionGuard>
    );
}
