import type { ReactNode } from 'react';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageTabs, pointOfInterestTabs } from '@/components/layout/PageTabs';

/**
 * Props for PointOfInterestSubTabLayout.
 */
export interface PointOfInterestSubTabLayoutProps {
    /** Point-of-interest ID — used to build the PageTabs basePath. */
    readonly pointOfInterestId: string;
    /**
     * Display name of the point of interest (already resolved via
     * `resolveI18nText(poi.nameI18n)` by the caller). Shown as the page
     * `<h1>` and used to resolve the entity segment in the breadcrumb. Falls
     * back to the ID while loading so the layout never has an empty heading.
     */
    readonly entityName?: string;
    /** Content rendered below the tabs. */
    readonly children: ReactNode;
}

/**
 * Shared layout for point-of-interest sub-tab routes (Overview, Categories,
 * Destinations, Edit). Adds the breadcrumb and the entity-context `<h1>`,
 * mirroring `DestinationSubTabLayout`/`AccommodationSubTabLayout` (HOS-144
 * §6.6) — a small, per-entity wrapper rather than a shared generic
 * `EntitySubTabLayout`, consistent with the established codebase convention.
 *
 * Unlike the destinations/accommodations precedent (where the main `$id.tsx`
 * view uses a bare `<PageTabs>` and the SubTabLayout is reserved for
 * standalone sub-tab routes without their own `EntityPageBase` header), POI's
 * `$id.tsx` also wraps in this layout (HOS-144 Phase 2 task definition) so
 * the Overview / Categories / Destinations / Edit tab strip stays consistent
 * across all four routes — Categories and Destinations have no
 * `EntityPageBase` context of their own to derive a header from.
 */
export function PointOfInterestSubTabLayout({
    pointOfInterestId,
    entityName,
    children
}: PointOfInterestSubTabLayoutProps) {
    const displayName = entityName?.trim() ? entityName : pointOfInterestId;

    return (
        <div className="space-y-4">
            <Breadcrumbs entityContext={{ name: entityName, type: 'pointOfInterest' }} />

            <h1 className="font-semibold text-2xl text-foreground">{displayName}</h1>

            <PageTabs
                tabs={pointOfInterestTabs}
                basePath={`/content/points-of-interest/${pointOfInterestId}`}
            />

            {children}
        </div>
    );
}
