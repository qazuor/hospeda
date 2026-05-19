import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageTabs, destinationTabs } from '@/components/layout/PageTabs';
import type { ReactNode } from 'react';

/**
 * Props for DestinationSubTabLayout.
 */
export interface DestinationSubTabLayoutProps {
    /** Destination ID — used to build the PageTabs basePath. */
    readonly destinationId: string;
    /**
     * Display name of the destination. Shown as the page `<h1>` and used to
     * resolve the entity segment in the breadcrumb. Falls back to the ID while
     * loading so the layout never has an empty heading.
     */
    readonly entityName?: string;
    /** Content rendered below the tabs. */
    readonly children: ReactNode;
}

/**
 * Shared layout for destination sub-tab routes (accommodations, attractions,
 * events). Adds the breadcrumb and the entity-context `<h1>` that axe found
 * missing (page-has-heading-one residual from SPEC-136), so an operator
 * landing on a deep-link tab can immediately see which destination they're
 * editing.
 *
 * Mirrors the same pattern as AccommodationSubTabLayout.
 */
export function DestinationSubTabLayout({
    destinationId,
    entityName,
    children
}: DestinationSubTabLayoutProps) {
    const displayName = entityName?.trim() ? entityName : destinationId;

    return (
        <div className="space-y-4">
            <Breadcrumbs entityContext={{ name: entityName, type: 'destination' }} />

            <h1 className="font-semibold text-2xl text-foreground">{displayName}</h1>

            <PageTabs
                tabs={destinationTabs}
                basePath={`/destinations/${destinationId}`}
            />

            {children}
        </div>
    );
}
