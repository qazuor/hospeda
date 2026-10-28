/**
 * Venue Gallery Tab Route (HOS-382)
 *
 * Relational-gallery counterpart of `accommodations/$id_.gallery.tsx`, for the
 * venue listing vertical. The `venue_media` table (HOS-372) is the
 * source of truth for venue listing photos; the old `media.featuredImage`
 * / `media.gallery` fields are removed from the edit form (see
 * `listingSections.ts`).
 *
 * Mirrors the pattern of `$id_.seo.tsx` (the only other venue sub-tab
 * route today): `SidebarPageLayout` + `PageTabs` with `venueTabs`, rather
 * than accommodation's dedicated `AccommodationSubTabLayout` wrapper — that
 * component is accommodation-specific and venue/experience routes don't
 * use it.
 */

import { createFileRoute } from '@tanstack/react-router';
import { PageTabs, venueTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { ListingGalleryManager } from '@/features/listing';
import { useVenueQuery } from '@/features/venue';

export const Route = createFileRoute('/_authed/venues/$id_/gallery')({
    component: VenueGalleryPage
});

function VenueGalleryPage() {
    const { id } = Route.useParams();
    // Reuses the shared detail query cache key (also hit by the view/edit
    // routes via useVenuePage) so navigating between tabs after visiting
    // one of those doesn't trigger a second network fetch — only the alt-text
    // derivation below needs `name`, so no dedicated lightweight query exists.
    //
    // This query runs IN PARALLEL with ListingGalleryManager's own media-list
    // query, and can settle later (a fresh cold load hits the full admin
    // entity detail, not just the gallery rows). `isLoading` is threaded
    // through as `isEntityLoading` so the manager's loading gate covers BOTH
    // queries — otherwise the upload controls could render before `name`
    // resolves, producing an upload with no `alt` at all (there is no
    // update-media endpoint to backfill it afterwards).
    const { data: venue, isLoading: isVenueLoading } = useVenueQuery(id);

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.gastronomiesView">
            <div className="space-y-4">
                <PageTabs
                    tabs={venueTabs}
                    basePath={`/venues/${id}`}
                />

                <div className="rounded-lg border bg-card p-6">
                    <ListingGalleryManager
                        vertical="venue"
                        entityId={id}
                        entityName={venue?.name}
                        isEntityLoading={isVenueLoading}
                    />
                </div>
            </div>
        </SidebarPageLayout>
    );
}
