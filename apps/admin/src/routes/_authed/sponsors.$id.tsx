import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { useSponsorPage } from '@/features/sponsors/hooks/useSponsorPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Sponsor View Route Configuration
 */
export const Route = createFileRoute('/_authed/sponsors/$id')({
    component: SponsorViewPage,
    loader: async ({ params }) => ({ sponsorId: params.id }),
    errorComponent: createErrorComponent('Sponsor'),
    pendingComponent: createPendingComponent()
});

/**
 * Sponsor View Page Component
 */
function SponsorViewPage() {
    const { id } = Route.useParams();

    // Use the hook at the top level
    const entityData = useSponsorPage(id);

    return (
        <EntityPageBase
            entityType="sponsor"
            entityId={id}
            initialMode="view"
            entityData={entityData}
        >
            <EntityViewContent
                entityType="sponsor"
                entityId={id}
                sections={entityData.sections}
                entity={entityData.entity || {}}
                userPermissions={entityData.userPermissions}
            />
        </EntityPageBase>
    );
}
