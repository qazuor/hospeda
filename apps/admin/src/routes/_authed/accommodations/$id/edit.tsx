import { EntityEditPage } from '@/components/entity-detail/EntityEditPage';
import { useEntityDetail } from '@/components/entity-detail/hooks/useEntityDetail';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { accommodationsDetailConfig } from '@/features/accommodations/config/accommodations-detail.config';
import { createFileRoute, useParams } from '@tanstack/react-router';

/**
 * Accommodation edit route
 * Handles editing of accommodation details at /accommodations/$id/edit
 */
export const Route = createFileRoute('/_authed/accommodations/$id/edit')({
    component: AccommodationEditPage
});

function AccommodationEditPage() {
    const params = useParams({ strict: false });
    const entityId = (params as Record<string, unknown>).id as string;

    // Get entity data to extract slug and name for breadcrumbs
    const { data } = useEntityDetail({
        config: accommodationsDetailConfig,
        id: entityId
    });

    // Create entity context for breadcrumbs
    const entityContext = data
        ? {
              slug: (data as { slug?: string }).slug,
              name: (data as { name?: string }).name,
              type: 'accommodation'
          }
        : undefined;

    return (
        <SidebarPageLayout
            title="Accommodation - Edit"
            entityContext={entityContext}
        >
            <EntityEditPage config={accommodationsDetailConfig} />
        </SidebarPageLayout>
    );
}
