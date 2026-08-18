/**
 * Gastronomy edit page — allows admins to update an existing gastronomy listing.
 *
 * Uses `EntityPageBase` in edit mode with `EntityEditContent` (flat layout).
 * Gate-protected by COMMERCE_EDIT_ALL.
 *
 * HOS-382: the `media.featuredImage` / `media.gallery` field handlers were
 * removed. Those fields used to buffer uploads into a `media` object on
 * PATCH, but the `media` JSONB column was dropped (HOS-372) and the update
 * schema silently strips that key — every photo uploaded through this form
 * was orphaned in Cloudinary with no DB row. Photos are now managed via the
 * dedicated Gallery tab (`/gastronomies/:id/gallery`, `CommerceGalleryManager`),
 * reachable from the `PageTabs` bar below, mirroring accommodations.
 */

import { GastronomyUpdateInputSchema, PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { FaqManager } from '@/components/faqs/FaqManager';
import { gastronomyTabs, PageTabs } from '@/components/layout/PageTabs';
import { RevalidateEntityButton } from '@/components/RevalidateEntityButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui-wrapped';
import { useGastronomyPage } from '@/features/gastronomy';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';

/** Route configuration for the gastronomy edit page. */
export const Route = createFileRoute('/_authed/gastronomies/$id_/edit')({
    component: GastronomyEditPage,
    loader: async ({ params }) => ({ gastronomyId: params.id }),
    errorComponent: createErrorComponent('Gastronomy'),
    pendingComponent: createPendingComponent()
});

/**
 * Edit page for an existing gastronomy listing.
 * Includes the main edit form (flat) and a FAQs sub-tab for managing FAQs
 * alongside editing the entity fields.
 */
function GastronomyEditPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const entityData = useGastronomyPage(id);

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.COMMERCE_EDIT_ALL]}>
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <PageTabs
                        tabs={gastronomyTabs}
                        basePath={`/gastronomies/${id}`}
                    />
                    <RevalidateEntityButton
                        entityType="gastronomy"
                        entityId={id}
                    />
                </div>

                <EntityPageBase
                    entityType="gastronomy"
                    entityId={id}
                    initialMode="edit"
                    entityData={entityData}
                    zodSchema={GastronomyUpdateInputSchema}
                >
                    <Tabs defaultValue="general">
                        <TabsList>
                            <TabsTrigger value="general">
                                {t('admin-entities.gastronomy.tabs.general')}
                            </TabsTrigger>
                            <TabsTrigger value="faqs">
                                {t('admin-entities.gastronomy.tabs.faqs')}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent
                            value="general"
                            className="mt-4"
                        >
                            <EntityEditContent
                                entityType="gastronomy"
                                flat
                            />
                        </TabsContent>

                        <TabsContent
                            value="faqs"
                            className="mt-4"
                        >
                            <div className="rounded-lg border bg-card p-6">
                                <FaqManager
                                    entityType="gastronomies"
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
