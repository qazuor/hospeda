import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { TranslationSection } from '@/features/content/components/TranslationSection';
import { usePointOfInterestPage } from '@/features/points-of-interest/hooks/usePointOfInterestPage';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';

/**
 * Point Of Interest Edit Route Configuration
 */
export const Route = createFileRoute('/_authed/content/points-of-interest/$id_/edit')({
    component: PointOfInterestEditPage,
    loader: async ({ params }) => ({ pointOfInterestId: params.id }),
    errorComponent: createErrorComponent('PointOfInterest'),
    pendingComponent: createPendingComponent()
});

/**
 * Point Of Interest Edit Page Component
 *
 * NOTE (HOS-144 §6.3): no `zodSchema` is passed to `EntityPageBase` here.
 * `usePointOfInterestPage` layers two synthetic form-only fields
 * (`coordinates`, `keywords`) on top of the real entity shape — passing the
 * package's `PointOfInterestUpdateInputSchema` (flat numeric `lat`/`long`,
 * `keywords: text[]`) would validate the RAW, untransformed form values
 * against a shape they structurally don't match (missing `lat`/`long`,
 * wrong `keywords` type), permanently failing `EntityFormProvider`'s
 * pre-save `validateForm()` and blocking every save. Other entities
 * (destinations, accommodations) can pass their update schema directly here
 * because their `CoordinatesField` value maps 1:1 onto the real column
 * shape — POI's flat `lat`/`long` doubles do not, so this route intentionally
 * relies on the fallback required-field check plus server-side validation
 * errors (surfaced via `parseApiValidationErrors` in `EntityEditContent`).
 *
 * Phase 5 (HOS-144): mounts `<TranslationSection entityType="pointOfInterest" .../>`
 * below the form, matching the destinations/events/posts edit pages — HOS-143
 * G-6 already ships the backend AI-translate widening for `pointOfInterest`.
 */
function PointOfInterestEditPage() {
    const { id } = Route.useParams();
    const entityData = usePointOfInterestPage(id);

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.POINT_OF_INTEREST_UPDATE]}>
            <div className="space-y-4">
                <EntityPageBase
                    entityType="pointOfInterest"
                    entityId={id}
                    initialMode="edit"
                    entityData={entityData}
                >
                    <EntityEditContent
                        entityType="pointOfInterest"
                        flat
                    />
                    {entityData.entity && (
                        <TranslationSection
                            entityType="pointOfInterest"
                            entityId={id}
                            entity={entityData.entity as Record<string, unknown>}
                        />
                    )}
                </EntityPageBase>
            </div>
        </RoutePermissionGuard>
    );
}
