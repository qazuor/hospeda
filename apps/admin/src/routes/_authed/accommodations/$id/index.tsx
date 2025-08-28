import { EntityViewPage } from '@/components/entity-detail/EntityViewPage';
import { useEntityDetail } from '@/components/entity-detail/hooks/useEntityDetail';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { accommodationsDetailConfig } from '@/features/accommodations/config/accommodations-detail.config';
import { createEntityLoader } from '@/lib/loaders/entity-loader';
import { entityDetailSearchSchema } from '@/lib/search-params';
import { createFileRoute, useParams } from '@tanstack/react-router';

/**
 * Accommodation detail view route
 * Handles viewing accommodation details at /accommodations/$id
 * Uses loader for prefetching data and validates search params
 */
export const Route = createFileRoute('/_authed/accommodations/$id/')({
    loader: createEntityLoader(accommodationsDetailConfig),
    validateSearch: entityDetailSearchSchema,
    component: AccommodationViewPage
});

function AccommodationViewPage() {
    const params = useParams({ strict: false });
    const entityId = (params as Record<string, unknown>).id as string;

    // Get validated search params (ready for future integration)
    // const search = Route.useSearch();

    // TODO [566826a6-86ac-433f-a4c3-f73bcf284839]: Integrate search params with EntityViewPage component
    // const { switchTab, toggleEdit, setLayout } = useEntityDetailSearch(
    //     search,
    //     entityDetailSearchSchema,
    //     defaultEntityDetailSearch
    // );

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
