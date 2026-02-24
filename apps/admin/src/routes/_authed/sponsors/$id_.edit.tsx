import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { useSponsorPage } from '@/features/sponsors/hooks/useSponsorPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Sponsor Edit Route Configuration
 */
export const Route = createFileRoute('/_authed/sponsors/$id_/edit')({
    component: SponsorEditPage,
    loader: async ({ params }) => ({ sponsorId: params.id }),
    errorComponent: createErrorComponent('Sponsor'),
    pendingComponent: createPendingComponent()
});

/**
 * Sponsor Edit Page Component
 */
function SponsorEditPage() {
    const { id } = Route.useParams();
    // Use the hook at the top level
    const entityData = useSponsorPage(id);

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.POST_SPONSOR_UPDATE]}>
            <EntityPageBase
                entityType="sponsor"
                entityId={id}
                initialMode="edit"
                entityData={entityData}
            >
                <EntityEditContent entityType="sponsor" />
            </EntityPageBase>
        </RoutePermissionGuard>
    );
}
