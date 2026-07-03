import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { getAccommodationAnchorIds } from '@/components/entity-pages/utils/section-sorter';
import { PageTabs, accommodationTabs } from '@/components/layout/PageTabs';
import { AccommodationQualityScore } from '@/features/accommodations/components/AccommodationQualityScore';
import { useAccommodationHeaderProps } from '@/features/accommodations/hooks/useAccommodationHeaderProps';
import { useAccommodationPage } from '@/features/accommodations/hooks/useAccommodationPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';

/**
 * Accommodation View Route Configuration
 */
export const Route = createFileRoute('/_authed/accommodations/$id')({
    component: AccommodationViewPage,
    loader: async ({ params }) => ({ accommodationId: params.id }),
    errorComponent: createErrorComponent('Accommodation'),
    pendingComponent: createPendingComponent()
});

/**
 * Accommodation View Page Component
 */
function AccommodationViewPage() {
    const { id } = Route.useParams();

    const entityData = useAccommodationPage(id);

    // Determine section anchor order based on user permissions (spec §4.4):
    // staff sees "states-moderation" first; hosts don't see it at all.
    const anchorSectionIds = useMemo(
        () => getAccommodationAnchorIds(entityData.userPermissions),
        [entityData.userPermissions]
    );

    // Derive media / subtitle / badges from the loaded entity.
    const headerProps = useAccommodationHeaderProps({ entity: entityData.entity });

    return (
        <div className="space-y-4">
            <PageTabs
                tabs={accommodationTabs}
                basePath={`/accommodations/${id}`}
            />

            <EntityPageBase
                entityType="accommodation"
                entityId={id}
                initialMode="view"
                entityData={entityData}
                headerMedia={headerProps.media}
                headerSubtitle={headerProps.subtitle}
                headerBadges={headerProps.badges}
                qualityScore={({ isReduced }) => <AccommodationQualityScore compact={isReduced} />}
            >
                <EntityViewContent
                    entityType="accommodation"
                    entityId={id}
                    sections={entityData.sections}
                    entity={entityData.entity ?? {}}
                    userPermissions={entityData.userPermissions}
                    anchorSectionIds={anchorSectionIds}
                />
            </EntityPageBase>
        </div>
    );
}
