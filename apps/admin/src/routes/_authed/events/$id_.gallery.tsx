/**
 * Event Gallery Tab Route (HOS-390)
 *
 * Relational-gallery counterpart of `posts/$id_.gallery.tsx`, for events. The
 * `event_media` table is the source of truth for event photos; the old
 * `media.featuredImage` / `media.gallery` fields were removed from the edit
 * form (see `sections/contact-media.consolidated.ts`).
 */

import { createFileRoute } from '@tanstack/react-router';
import { eventTabs, PageTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { ContentGalleryManager } from '@/features/content-media';
import { useEventQuery } from '@/features/events/hooks/useEventQuery';

export const Route = createFileRoute('/_authed/events/$id_/gallery')({
    component: EventGalleryPage
});

function EventGalleryPage() {
    const { id } = Route.useParams();
    // Same parallel-query note as the post gallery route: `isEntityLoading`
    // keeps the loading gate up until the entity name resolves, so an upload
    // can never be added with no `alt`.
    const { data: event, isLoading: isEventLoading } = useEventQuery(id);

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.eventsView">
            <div className="space-y-4">
                <PageTabs
                    tabs={eventTabs}
                    basePath={`/events/${id}`}
                />

                <div className="rounded-lg border bg-card p-6">
                    <ContentGalleryManager
                        entity="event"
                        entityId={id}
                        entityName={event?.name}
                        isEntityLoading={isEventLoading}
                    />
                </div>
            </div>
        </SidebarPageLayout>
    );
}
