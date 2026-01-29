import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { useUserPage } from '@/features/users/hooks/useUserPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

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
    // Use the hook at the top level
    const entityData = useUserPage(id);

    return (
        <div className="space-y-4">
            <EntityPageBase
                entityType="user"
                entityId={id}
                initialMode="edit"
                entityData={entityData}
            >
                <EntityEditContent entityType="user" />
            </EntityPageBase>
        </div>
    );
}
