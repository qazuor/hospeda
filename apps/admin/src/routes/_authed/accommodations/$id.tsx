import { type PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { getAccommodationAnchorIds } from '@/components/entity-pages/utils/section-sorter';
import { accommodationTabs, PageTabs } from '@/components/layout/PageTabs';
import { AccommodationQualityScore } from '@/features/accommodations/components/AccommodationQualityScore';
import { useAccommodationHeaderProps } from '@/features/accommodations/hooks/useAccommodationHeaderProps';
import { useAccommodationPage } from '@/features/accommodations/hooks/useAccommodationPage';
import { useAccommodationQuery } from '@/features/accommodations/hooks/useAccommodationQuery';
import { EffectiveSetSubjectProvider } from '@/features/billing/effective-set-subject';
import { ListingModerationCard } from '@/features/listing/components/ListingModerationCard';
import { ListingPurgeOnRequestCard } from '@/features/listing/components/ListingPurgeOnRequestCard';
import { canEditListing } from '@/features/listing/config/listing-moderation-actions';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';

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
    const { data: accommodation, isLoading, error } = useAccommodationQuery(id);
    if (isLoading) return <AccommodationPending />;
    if (error) throw error;
    if (!accommodation) throw new Error('accommodation not found');
    return (
        <EffectiveSetSubjectProvider
            value={{ userId: accommodation.ownerId, vertical: VerticalEnum.ACCOMMODATION }}
        >
            <AccommodationViewContent
                id={id}
                name={accommodation.name ?? id}
                publicationStatus={accommodation.publicationStatus}
            />
        </EffectiveSetSubjectProvider>
    );
}

const AccommodationPending = createPendingComponent();

function AccommodationViewContent({
    id,
    name,
    publicationStatus
}: {
    readonly id: string;
    readonly name: string;
    readonly publicationStatus: PublicationStatusEnum | null | undefined;
}) {
    const navigate = useNavigate();
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

            {/* HOS-1493 action 23: the same action row as venue and
                experience, with the px-6 inset of the entity card below. */}
            <div className="space-y-4 px-6 pt-6">
                <div className="flex justify-end">
                    <ListingPurgeOnRequestCard
                        vertical="accommodation"
                        entityId={id}
                        entityName={name}
                        onPurged={() => navigate({ to: '/accommodations' })}
                        publicationStatus={publicationStatus}
                    />
                </div>

                {/* HOS-1684: the listing's publication state and its moderation
                    by action, with reason (`POST /:id/moderate`), as on
                    venue and experience. */}
                <ListingModerationCard
                    vertical="accommodation"
                    entityId={id}
                    entityName={name}
                    publicationStatus={publicationStatus}
                />
            </div>

            <EntityPageBase
                entityType="accommodation"
                entityId={id}
                initialMode="view"
                entityData={{
                    ...entityData,
                    canEdit:
                        entityData.canEdit &&
                        canEditListing({ publicationStatus: publicationStatus })
                }}
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
