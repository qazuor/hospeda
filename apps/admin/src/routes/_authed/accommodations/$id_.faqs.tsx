/**
 * Accommodation FAQs Tab Route
 *
 * Renders the FaqManager for FAQs associated with a specific accommodation.
 * Wires the AI text-improvement entitlement so FAQ answer fields can be
 * improved via the AiTextImprovePanel (SPEC-198.2).
 *
 * Mirrors the pattern of $id_.amenities.tsx — uses AccommodationSubTabLayout
 * as the wrapper and fetches the accommodation name for the breadcrumb.
 *
 * No explicit beforeLoad permission guard is added here: the parent
 * _authed.tsx already enforces authentication for all routes under
 * /_authed/. FAQ read access is gated by the admin API (ACCOMMODATION_FAQS_EDIT
 * covers FAQ editing; the tab is visible to all authenticated admins who can
 * view the entity's detail page). This mirrors the pattern used by every
 * other accommodation sub-tab in this project.
 */

import { FaqManager } from '@/components/faqs/FaqManager';
import { AccommodationSubTabLayout } from '@/features/accommodations/components/AccommodationSubTabLayout';
import { useAccommodationQuery } from '@/features/accommodations/hooks/useAccommodationQuery';
import { useMyEntitlements } from '@/features/billing/use-my-entitlements';
import { EntitlementKey } from '@repo/billing';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/accommodations/$id_/faqs')({
    component: AccommodationFaqsPage
});

function AccommodationFaqsPage() {
    const { id } = Route.useParams();
    const { data: accommodation } = useAccommodationQuery(id);
    const { has: hasEntitlement } = useMyEntitlements();
    const canUseAiTextImprove = hasEntitlement(EntitlementKey.AI_TEXT_IMPROVE);

    return (
        <AccommodationSubTabLayout
            accommodationId={id}
            entityName={accommodation?.name}
        >
            <div className="rounded-lg border bg-card p-6">
                <FaqManager
                    entityType="accommodations"
                    parentId={id}
                    canUseAiTextImprove={canUseAiTextImprove}
                />
            </div>
        </AccommodationSubTabLayout>
    );
}
