/**
 * Destination FAQs Tab Route
 *
 * Renders the FaqManager for FAQs associated with a specific destination.
 * Mirrors the pattern of $id_.attractions.tsx — uses DestinationSubTabLayout
 * as the wrapper and fetches the destination name for the breadcrumb.
 *
 * No explicit beforeLoad permission guard is added here: the parent
 * _authed.tsx already enforces authentication for all routes under
 * /_authed/. FAQ read access is gated by the admin API (DESTINATION_UPDATE
 * covers FAQ editing; the tab is visible to all authenticated admins who can
 * view the entity's detail page). This mirrors the pattern used by every
 * other destination sub-tab in this project.
 */

import { FaqManager } from '@/components/faqs/FaqManager';
import { DestinationSubTabLayout } from '@/features/destinations/components/DestinationSubTabLayout';
import { useDestinationQuery } from '@/features/destinations/hooks/useDestinationQuery';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/destinations/$id_/faqs')({
    component: DestinationFaqsPage
});

function DestinationFaqsPage() {
    const { id } = Route.useParams();
    const { data: destination } = useDestinationQuery(id);

    return (
        <DestinationSubTabLayout
            destinationId={id}
            entityName={destination?.name}
        >
            <div className="rounded-lg border bg-card p-6">
                <FaqManager
                    entityType="destinations"
                    parentId={id}
                />
            </div>
        </DestinationSubTabLayout>
    );
}
