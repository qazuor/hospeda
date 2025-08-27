import { EntityViewPage } from '@/components/entity-detail/EntityViewPage';
import { useEntityDetail } from '@/components/entity-detail/hooks/useEntityDetail';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { accommodationsDetailConfig } from '@/features/accommodations/config/accommodations-detail.config';
import { createFileRoute, useParams } from '@tanstack/react-router';

/**
 * Accommodation detail view route
 * Handles viewing accommodation details at /accommodations/$id
 */
export const Route = createFileRoute('/accommodations/$id/')({
    component: AccommodationViewPage
});

function AccommodationViewPage() {
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
            title="Accommodation - View"
            entityContext={entityContext}
        >
            <EntityViewPage config={accommodationsDetailConfig} />
        </SidebarPageLayout>
    );
}
