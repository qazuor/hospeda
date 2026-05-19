import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageTabs, accommodationTabs } from '@/components/layout/PageTabs';
import type { ReactNode } from 'react';

/**
 * Props for AccommodationSubTabLayout.
 */
export interface AccommodationSubTabLayoutProps {
    /** Accommodation ID — used to build the PageTabs basePath. */
    readonly accommodationId: string;
    /**
     * Display name of the accommodation. Shown as the page `<h1>` and used to
     * resolve the entity segment in the breadcrumb. Falls back to the ID while
     * loading so the layout never has an empty heading.
     */
    readonly entityName?: string;
    /** Content rendered below the tabs. */
    readonly children: ReactNode;
}

/**
 * Shared layout for accommodation sub-tab routes (amenities, pricing,
 * reviews). Adds the breadcrumb and the entity-context `<h1>` that the
 * audit found missing (SPEC-135 F-023), so an operator landing on a
 * deep-link tab can immediately see which accommodation they're editing.
 *
 * View/edit pages do NOT use this layout — they get the same context via
 * `EntityPageBase`. The sub-tabs are standalone routes that previously
 * rendered just `<PageTabs>` + content with no parent identity.
 */
export function AccommodationSubTabLayout({
    accommodationId,
    entityName,
    children
}: AccommodationSubTabLayoutProps) {
    const displayName = entityName?.trim() ? entityName : accommodationId;

    return (
        <div className="space-y-4">
            <Breadcrumbs entityContext={{ name: entityName, type: 'accommodation' }} />

            <h1 className="font-semibold text-2xl text-foreground">{displayName}</h1>

            <PageTabs
                tabs={accommodationTabs}
                basePath={`/accommodations/${accommodationId}`}
            />

            {children}
        </div>
    );
}
