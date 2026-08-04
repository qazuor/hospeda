/**
 * Gastronomy Gallery Tab Route (HOS-382)
 *
 * Relational-gallery counterpart of `accommodations/$id_.gallery.tsx`, for the
 * gastronomy commerce vertical. The `gastronomy_media` table (HOS-372) is the
 * source of truth for gastronomy listing photos; the old `media.featuredImage`
 * / `media.gallery` fields are removed from the edit form (see
 * `commerceSections.ts`).
 *
 * Mirrors the pattern of `$id_.seo.tsx` (the only other gastronomy sub-tab
 * route today): `SidebarPageLayout` + `PageTabs` with `gastronomyTabs`, rather
 * than accommodation's dedicated `AccommodationSubTabLayout` wrapper — that
 * component is accommodation-specific and gastronomy/experience routes don't
 * use it.
 */

import { createFileRoute } from '@tanstack/react-router';
import { gastronomyTabs, PageTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { CommerceGalleryManager } from '@/features/commerce';
import { useGastronomyQuery } from '@/features/gastronomy';

export const Route = createFileRoute('/_authed/gastronomies/$id_/gallery')({
    component: GastronomyGalleryPage
});

function GastronomyGalleryPage() {
    const { id } = Route.useParams();
    // Reuses the shared detail query cache key (also hit by the view/edit
    // routes via useGastronomyPage) so navigating between tabs after visiting
    // one of those doesn't trigger a second network fetch — only the alt-text
    // derivation below needs `name`, so no dedicated lightweight query exists.
    //
    // This query runs IN PARALLEL with CommerceGalleryManager's own media-list
    // query, and can settle later (a fresh cold load hits the full admin
    // entity detail, not just the gallery rows). `isLoading` is threaded
    // through as `isEntityLoading` so the manager's loading gate covers BOTH
    // queries — otherwise the upload controls could render before `name`
    // resolves, producing an upload with no `alt` at all (there is no
    // update-media endpoint to backfill it afterwards).
    const { data: gastronomy, isLoading: isGastronomyLoading } = useGastronomyQuery(id);

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.gastronomiesView">
            <div className="space-y-4">
                <PageTabs
                    tabs={gastronomyTabs}
                    basePath={`/gastronomies/${id}`}
                />

                <div className="rounded-lg border bg-card p-6">
                    <CommerceGalleryManager
                        vertical="gastronomy"
                        entityId={id}
                        entityName={gastronomy?.name}
                        isEntityLoading={isGastronomyLoading}
                    />
                </div>
            </div>
        </SidebarPageLayout>
    );
}
