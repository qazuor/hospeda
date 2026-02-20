/**
 * User Detail Page Route
 *
 * Displays user profile information with tabs for permissions and activity.
 */

import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { PageTabs, userTabs } from '@/components/layout/PageTabs';
import { ImpersonateButton } from '@/features/users/components/ImpersonateButton';
import { useUserPage } from '@/features/users/hooks/useUserPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/access/users/$id')({
    component: UserViewPage,
    loader: async ({ params }) => ({ userId: params.id }),
    errorComponent: createErrorComponent('User'),
    pendingComponent: createPendingComponent()
});

function UserViewPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useUserPage(id);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <PageTabs
                    tabs={userTabs}
                    basePath={`/access/users/${id}`}
                />
                <ImpersonateButton
                    userId={id}
                    variant="full"
                />
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
