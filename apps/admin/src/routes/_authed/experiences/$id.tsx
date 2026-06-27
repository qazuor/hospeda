/**
 * Experience view page — displays a single experience listing with:
 *  - General fields via EntityViewContent (flat mode)
 *  - FAQs sub-tab (FaqManager, experiences entity type)
 *  - Reviews moderation sub-tab (pending reviews + approve/reject actions)
 *  - Assign-owner action (OwnerSelect + useAssignExperienceOwnerMutation)
 *  - Delete action
 *
 * Mirrors the gastronomy view page pattern (SPEC-240 T-028).
 */

import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { FaqManager } from '@/components/faqs/FaqManager';
import { OwnerSelect } from '@/components/selects/OwnerSelect';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui-wrapped';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    useAssignExperienceOwnerMutation,
    useDeleteExperienceMutation,
    useExperiencePage,
    useExperiencePendingReviewsQuery,
    useModerateExperienceReviewMutation
} from '@/features/experience';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

/** Route configuration for the experience view page. */
export const Route = createFileRoute('/_authed/experiences/$id')({
    component: ExperienceViewPage,
    loader: async ({ params }) => ({ experienceId: params.id }),
    errorComponent: createErrorComponent('Experience'),
    pendingComponent: createPendingComponent()
});

// ---------------------------------------------------------------------------
// Reviews moderation sub-tab
// ---------------------------------------------------------------------------

/** Minimal review shape returned by the pending-reviews endpoint. */
interface PendingReview {
    readonly id: string;
    readonly authorName?: string;
    readonly comment?: string;
    readonly rating?: number;
}

/**
 * Inline reviews moderation panel displayed as a sub-tab in the view page.
 *
 * @param experienceId - UUID of the parent experience entity
 */
function ExperienceReviewsPanel({
    experienceId: _experienceId
}: { readonly experienceId: string }) {
    const { t } = useTranslations();
    const { data: reviewsData, isLoading } = useExperiencePendingReviewsQuery({
        page: 1,
        pageSize: 20
    });
    const moderateMutation = useModerateExperienceReviewMutation();

    const reviews = (reviewsData?.items ?? []) as PendingReview[];

    if (isLoading) {
        return (
            <div className="py-8 text-center text-muted-foreground">
                {t('admin-entities.messages.loading')}
            </div>
        );
    }

    if (reviews.length === 0) {
        return (
            <div className="py-8 text-center text-muted-foreground">
                {t('admin-entities.experience.reviews.noPending')}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {reviews.map((review) => (
                <Card key={review.id}>
                    <CardHeader>
                        <CardTitle className="text-base">
                            {review.authorName ?? t('admin-entities.experience.reviews.anonymous')}
                            {review.rating !== undefined && (
                                <span className="ml-2 text-muted-foreground text-sm">
                                    ★ {review.rating}
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {review.comment && (
                            <p className="mb-4 text-muted-foreground text-sm">{review.comment}</p>
                        )}
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="default"
                                disabled={moderateMutation.isPending}
                                onClick={() =>
                                    moderateMutation.mutate({
                                        reviewId: review.id,
                                        decision: 'APPROVED'
                                    })
                                }
                            >
                                {t('admin-entities.experience.reviews.approve')}
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                disabled={moderateMutation.isPending}
                                onClick={() =>
                                    moderateMutation.mutate({
                                        reviewId: review.id,
                                        decision: 'REJECTED'
                                    })
                                }
                            >
                                {t('admin-entities.experience.reviews.reject')}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Assign-owner panel
// ---------------------------------------------------------------------------

/**
 * Inline assign-owner panel shown at the top of the view page.
 *
 * @param experienceId - UUID of the experience entity
 * @param currentOwnerId - Currently assigned owner UUID (if any)
 */
function ExperienceAssignOwner({
    experienceId,
    currentOwnerId
}: {
    readonly experienceId: string;
    readonly currentOwnerId?: string | null;
}) {
    const { t } = useTranslations();
    const [selectedOwnerId, setSelectedOwnerId] = useState<string | undefined>(
        currentOwnerId ?? undefined
    );
    const assignMutation = useAssignExperienceOwnerMutation();

    const handleAssign = () => {
        if (!selectedOwnerId) return;
        assignMutation.mutate({ id: experienceId, ownerId: selectedOwnerId });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-medium text-sm">
                    {t('admin-entities.experience.assignOwner.title')}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end gap-3">
                <div className="flex-1">
                    <OwnerSelect
                        value={selectedOwnerId}
                        onValueChange={setSelectedOwnerId}
                    />
                </div>
                <Button
                    size="sm"
                    disabled={!selectedOwnerId || assignMutation.isPending}
                    onClick={handleAssign}
                >
                    {assignMutation.isPending
                        ? t('admin-entities.messages.saving')
                        : t('admin-entities.experience.assignOwner.button')}
                </Button>
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// View page
// ---------------------------------------------------------------------------

/**
 * View page for a single experience listing.
 * Displays fields read-only, FAQs sub-tab, reviews moderation sub-tab,
 * assign-owner panel, and delete action.
 */
function ExperienceViewPage() {
    const { id } = Route.useParams();
    const navigate = useNavigate();
    const { t } = useTranslations();
    const entityData = useExperiencePage(id);

    const experience = entityData.entity as { name?: string; ownerId?: string | null } | undefined;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <DeleteRowButton
                    entityId={id}
                    entityName={experience?.name ?? id}
                    entityLabel={t('admin-entities.entities.experience.singular')}
                    permission={PermissionEnum.COMMERCE_DELETE}
                    useDeleteMutation={useDeleteExperienceMutation}
                    variant="full"
                    entityGender="f"
                    onDeleted={() => navigate({ to: '/experiences' })}
                />
            </div>

            <ExperienceAssignOwner
                experienceId={id}
                currentOwnerId={experience?.ownerId}
            />

            <EntityPageBase
                entityType="experience"
                entityId={id}
                initialMode="view"
                entityData={entityData}
            >
                <Tabs defaultValue="general">
                    <TabsList>
                        <TabsTrigger value="general">
                            {t('admin-entities.experience.tabs.general')}
                        </TabsTrigger>
                        <TabsTrigger value="faqs">
                            {t('admin-entities.experience.tabs.faqs')}
                        </TabsTrigger>
                        <TabsTrigger value="reviews">
                            {t('admin-entities.experience.tabs.reviews')}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent
                        value="general"
                        className="mt-4"
                    >
                        <EntityViewContent
                            entityType="experience"
                            entityId={id}
                            sections={entityData.sections}
                            entity={entityData.entity ?? {}}
                            userPermissions={entityData.userPermissions}
                            flat
                        />
                    </TabsContent>

                    <TabsContent
                        value="faqs"
                        className="mt-4"
                    >
                        <div className="rounded-lg border bg-card p-6">
                            <FaqManager
                                entityType="experiences"
                                parentId={id}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent
                        value="reviews"
                        className="mt-4"
                    >
                        <ExperienceReviewsPanel experienceId={id} />
                    </TabsContent>
                </Tabs>
            </EntityPageBase>
        </div>
    );
}
