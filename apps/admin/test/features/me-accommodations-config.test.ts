/**
 * SPEC-185 Phase 4 — T-011 & T-012: host portfolio grid-only config + route migration.
 *
 * Pure data / source-scan tests. No component rendering, no jsdom.
 *
 * T-011 — config properties
 *   - apiEndpoint is '/api/v1/admin/accommodations' (same owner-scoped endpoint)
 *   - viewConfig.defaultView === 'grid'
 *   - viewConfig.allowViewToggle === false
 *   - filterBarConfig exists and only contains status + type selects
 *   - admin-only filter 'includeDeleted' is absent (HOST portfolio)
 *   - config is separate from accommodationsConfig (different name/basePath)
 *
 * T-012 — route migration
 *   - The route re-exports MeAccommodationsRoute from the config
 *   - The hand-rolled Card grid and useAccommodationListQuery direct call are gone
 *   - The route file no longer owns any JSX grid rendering logic
 *
 * Owner-scoping proof: meAccommodationsConfig.apiEndpoint hits the same server
 * route that AccommodationService._executeAdminSearch applies forced owner-scoping
 * on (SPEC-169 §5.2). A HOST with ACCOMMODATION_VIEW_OWN gets ownerId overwritten
 * server-side — no bypass is possible regardless of client-supplied params.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accommodationsConfig } from '../../src/features/accommodations/config/accommodations.config';
import {
    MeAccommodationsRoute,
    meAccommodationsConfig
} from '../../src/features/accommodations/config/me-accommodations.config';

const routeSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/me/accommodations/index.tsx'),
    'utf8'
);

// ---------------------------------------------------------------------------
// T-011 — config shape
// ---------------------------------------------------------------------------

describe('T-011 — meAccommodationsConfig shape', () => {
    describe('owner-scoped API endpoint', () => {
        it('uses the admin accommodations endpoint (server-side owner-scoping enforced)', () => {
            expect(meAccommodationsConfig.apiEndpoint).toBe('/api/v1/admin/accommodations');
        });

        it('uses the same endpoint as the admin list (scoping is server-side, not client-side)', () => {
            // Both configs share the endpoint; differentiation is purely server-side via
            // ACCOMMODATION_VIEW_OWN → forced ownerId = actor.id (SPEC-169).
            expect(meAccommodationsConfig.apiEndpoint).toBe(accommodationsConfig.apiEndpoint);
        });
    });

    describe('grid-only view config', () => {
        it('defaultView is "grid"', () => {
            expect(meAccommodationsConfig.viewConfig?.defaultView).toBe('grid');
        });

        it('allowViewToggle is false (table mode never reachable)', () => {
            expect(meAccommodationsConfig.viewConfig?.allowViewToggle).toBe(false);
        });

        it('gridConfig is defined', () => {
            expect(meAccommodationsConfig.viewConfig?.gridConfig).toBeDefined();
        });

        it('gridConfig has desktop column count of 3', () => {
            expect(meAccommodationsConfig.viewConfig?.gridConfig?.columns.desktop).toBe(3);
        });
    });

    describe('config identity — separate from admin list', () => {
        it('name is "me-accommodations" (distinct from "accommodations")', () => {
            expect(meAccommodationsConfig.name).toBe('me-accommodations');
        });

        it('basePath is "/me/accommodations" (not "/accommodations")', () => {
            expect(meAccommodationsConfig.basePath).toBe('/me/accommodations');
        });

        it('entityKey is "accommodation" (same i18n entity)', () => {
            expect(meAccommodationsConfig.entityKey).toBe('accommodation');
        });
    });

    describe('filter bar — host-relevant subset', () => {
        it('filterBarConfig is defined', () => {
            expect(meAccommodationsConfig.filterBarConfig).toBeDefined();
        });

        it('includes a select filter for status', () => {
            const filters = meAccommodationsConfig.filterBarConfig?.filters ?? [];
            const statusFilter = filters.find((f) => f.paramKey === 'status');
            expect(statusFilter).toBeDefined();
            expect(statusFilter?.type).toBe('select');
        });

        it('includes a select filter for type (accommodation type)', () => {
            const filters = meAccommodationsConfig.filterBarConfig?.filters ?? [];
            const typeFilter = filters.find((f) => f.paramKey === 'type');
            expect(typeFilter).toBeDefined();
            expect(typeFilter?.type).toBe('select');
        });

        it('does NOT include "includeDeleted" (admin-only filter)', () => {
            // Hosts should not be able to undelete their own accommodations from
            // the portfolio view — that's an admin operation.
            const filters = meAccommodationsConfig.filterBarConfig?.filters ?? [];
            const includeDeleted = filters.find((f) => f.paramKey === 'includeDeleted');
            expect(includeDeleted).toBeUndefined();
        });

        it('does NOT include "isFeatured" (staff-only toggle)', () => {
            const filters = meAccommodationsConfig.filterBarConfig?.filters ?? [];
            const isFeatured = filters.find((f) => f.paramKey === 'isFeatured');
            expect(isFeatured).toBeUndefined();
        });

        it('status filter has DRAFT, ACTIVE, and ARCHIVED options', () => {
            const filters = meAccommodationsConfig.filterBarConfig?.filters ?? [];
            const statusFilter = filters.find((f) => f.paramKey === 'status') as
                | { options: ReadonlyArray<{ value: string }> }
                | undefined;
            const values = statusFilter?.options.map((o) => o.value) ?? [];
            expect(values).toContain('DRAFT');
            expect(values).toContain('ACTIVE');
            expect(values).toContain('ARCHIVED');
        });
    });

    describe('pagination config', () => {
        it('has a defaultPageSize', () => {
            expect(meAccommodationsConfig.paginationConfig?.defaultPageSize).toBeGreaterThan(0);
        });

        it('allowedPageSizes is non-empty', () => {
            expect(
                meAccommodationsConfig.paginationConfig?.allowedPageSizes.length
            ).toBeGreaterThan(0);
        });
    });

    describe('peek drawer fields', () => {
        it('peekFields is defined and non-empty', () => {
            expect(meAccommodationsConfig.peekFields?.length).toBeGreaterThan(0);
        });

        it('peekFields includes an id field', () => {
            const hasId = meAccommodationsConfig.peekFields?.some((f) => f.accessorKey === 'id');
            expect(hasId).toBe(true);
        });
    });

    describe('createColumns factory', () => {
        it('createColumns is defined (reused from shared accommodations columns)', () => {
            expect(meAccommodationsConfig.createColumns).toBeDefined();
        });
    });

    describe('createEntityListPage output', () => {
        it('MeAccommodationsRoute is exported from the config module', () => {
            // Exported by createEntityListPage; presence confirms createEntityListPage ran
            expect(MeAccommodationsRoute).toBeDefined();
        });
    });
});

// ---------------------------------------------------------------------------
// T-012 — route migration assertions (source-level scan)
// ---------------------------------------------------------------------------

describe('T-012 — me/accommodations route migration', () => {
    describe('framework wiring', () => {
        it('re-exports MeAccommodationsRoute as Route', () => {
            expect(routeSrc).toContain('MeAccommodationsRoute');
            expect(routeSrc).toContain('export const Route = MeAccommodationsRoute');
        });

        it('imports from me-accommodations.config', () => {
            expect(routeSrc).toContain('me-accommodations.config');
        });
    });

    describe('hand-rolled grid eliminated', () => {
        it('no longer imports Shadcn Card directly', () => {
            // The old bespoke grid used @/components/ui/card; createEntityListPage owns rendering
            expect(routeSrc).not.toContain("from '@/components/ui/card'");
        });

        it('no longer imports useAccommodationListQuery directly', () => {
            // Data fetching is now handled by createEntityApi inside the framework
            expect(routeSrc).not.toContain('useAccommodationListQuery');
        });

        it('no longer contains hand-rolled grid JSX (md:grid-cols-2 lg:grid-cols-3)', () => {
            // The bespoke layout used these Tailwind classes in JSX
            expect(routeSrc).not.toContain('md:grid-cols-2 lg:grid-cols-3');
        });

        it('no longer imports useAuthContext for ownerId filter', () => {
            // Old route used useAuthContext to inject ownerId={user.id}; scoping is now server-side
            expect(routeSrc).not.toContain('useAuthContext');
        });

        it('no longer imports useNavigate from tanstack router', () => {
            // Routing is handled by the framework; the route file no longer owns navigation
            expect(routeSrc).not.toContain('useNavigate');
        });
    });

    describe('owner-scoping not broken', () => {
        it('does not pass ownerId as a query param to the API', () => {
            // Scoping is server-side (SPEC-169). The old code passed
            // `ownerId: user.id` to useAccommodationListQuery; the migrated
            // route must not do that.
            expect(routeSrc).not.toContain('ownerId:');
            expect(routeSrc).not.toContain('ownerId =');
        });
    });
});

// ---------------------------------------------------------------------------
// FIX-3 — EntityListPage honours allowViewToggle + defaultView (source-scan)
// ---------------------------------------------------------------------------

const entityListPageSrc = readFileSync(
    resolve(__dirname, '../../src/components/entity-list/EntityListPage.tsx'),
    'utf8'
);

describe('FIX-3 — EntityListPage grid-only implementation', () => {
    describe('DataTableToolbar showViewToggle prop', () => {
        it('EntityListPage passes showViewToggle to DataTableToolbar', () => {
            expect(entityListPageSrc).toContain('showViewToggle');
        });

        it('showViewToggle is wired to viewConfig.allowViewToggle', () => {
            expect(entityListPageSrc).toContain('showViewToggle={viewConfig.allowViewToggle}');
        });
    });

    describe('validateSearch uses viewConfig.defaultView as fallback', () => {
        it('validateSearch references viewConfig.defaultView for the view param', () => {
            expect(entityListPageSrc).toContain('viewConfig.defaultView');
        });
    });

    describe('meAccommodationsConfig grid-only constraints', () => {
        it('allowViewToggle is false (toggle will be hidden)', () => {
            expect(meAccommodationsConfig.viewConfig?.allowViewToggle).toBe(false);
        });

        it('defaultView is grid (page starts in grid without ?view= in URL)', () => {
            expect(meAccommodationsConfig.viewConfig?.defaultView).toBe('grid');
        });
    });
});
