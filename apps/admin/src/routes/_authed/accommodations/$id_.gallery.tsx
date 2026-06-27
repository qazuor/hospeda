/**
 * Accommodation Gallery Tab Route (SPEC-204)
 *
 * Replaces the old redirect stub with the real GalleryManager page.
 * The relational `accommodation_media` table is now the source of truth for
 * accommodation photos; the old JSONB fields (`media.featuredImage`,
 * `media.gallery`) are removed from the edit form (see gallery.consolidated.ts).
 *
 * Mirrors the pattern of $id_.faqs.tsx:
 *   - Uses AccommodationSubTabLayout as the wrapper (breadcrumb + h1 + PageTabs)
 *   - Reads the accommodation name from useAccommodationQuery for the breadcrumb
 *   - No explicit permission guard — _authed.tsx already enforces authentication;
 *     the API enforces ACCOMMODATION_GALLERY_MANAGE for write operations
 */

import { AccommodationSubTabLayout } from '@/features/accommodations/components/AccommodationSubTabLayout';
import { GalleryManager } from '@/features/accommodations/components/GalleryManager';
import { useAccommodationQuery } from '@/features/accommodations/hooks/useAccommodationQuery';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/accommodations/$id_/gallery')({
    component: AccommodationGalleryPage
});

function AccommodationGalleryPage() {
    const { id } = Route.useParams();
    const { data: accommodation } = useAccommodationQuery(id);

    return (
        <AccommodationSubTabLayout
            accommodationId={id}
            entityName={accommodation?.name}
        >
            <div className="rounded-lg border bg-card p-6">
                <GalleryManager accommodationId={id} />
            </div>
        </AccommodationSubTabLayout>
    );
}
