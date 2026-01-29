import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { useSponsorPage } from '@/features/sponsors/hooks/useSponsorPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
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
        <EntityPageBase
            entityType="sponsor"
            entityId={id}
            initialMode="edit"
            entityData={entityData}
        >
            <EntityEditContent entityType="sponsor" />
        </EntityPageBase>
    );
}
