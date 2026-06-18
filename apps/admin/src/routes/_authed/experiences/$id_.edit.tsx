/**
 * Experience edit page — allows admins to update an existing experience listing.
 *
 * Uses `EntityPageBase` in edit mode with `EntityEditContent` (flat layout).
 * Gate-protected by COMMERCE_EDIT_ALL.
 *
 * Mirrors the gastronomy edit page pattern (SPEC-240 T-028).
 */

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { FaqManager } from '@/components/faqs/FaqManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui-wrapped';
import { useExperiencePage } from '@/features/experience';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { ExperienceUpdateInputSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';

/** Route configuration for the experience edit page. */
export const Route = createFileRoute('/_authed/experiences/$id_/edit')({
    component: ExperienceEditPage,
    loader: async ({ params }) => ({ experienceId: params.id }),
    errorComponent: createErrorComponent('Experience'),
    pendingComponent: createPendingComponent()
});

/**
 * Edit page for an existing experience listing.
 * Includes the main edit form (flat) and a FAQs sub-tab for managing FAQs
 * alongside editing the entity fields.
 */
function ExperienceEditPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const entityData = useExperiencePage(id);

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.COMMERCE_EDIT_ALL]}>
            <div className="space-y-4">
                <EntityPageBase
                    entityType="experience"
                    entityId={id}
                    initialMode="edit"
                    entityData={entityData}
                    zodSchema={ExperienceUpdateInputSchema}
                >
                    <Tabs defaultValue="general">
                        <TabsList>
                            <TabsTrigger value="general">
                                {t('admin-entities.experience.tabs.general')}
                            </TabsTrigger>
                            <TabsTrigger value="faqs">
                                {t('admin-entities.experience.tabs.faqs')}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent
                            value="general"
                            className="mt-4"
                        >
                            <EntityEditContent
                                entityType="experience"
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
                    </Tabs>
                </EntityPageBase>
            </div>
        </RoutePermissionGuard>
    );
}
