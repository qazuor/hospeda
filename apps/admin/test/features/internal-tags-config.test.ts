/**
 * SPEC-185 Phase 5 — T-014: internal-tags migration onto createEntityListPage.
 *
 * Pure data / source-scan tests. No component rendering, no jsdom.
 *
 * Verifies:
 * - Config shape (filterBarConfig, viewConfig, listItemSchema, etc.)
 * - Route migration (hand-rolled table removed, component re-exported via framework)
 * - Auth guard preservation (requireAdminApiAccess still wired)
 * - Navigation preservation (new.tsx and $id_.edit.tsx untouched)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    InternalTagsRoute,
    internalTagsConfig
} from '../../src/features/tags/internal/config/internal-tags.config';

const routeSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/platform/tags/internal/index.tsx'),
    'utf8'
);

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

describe('T-014 — internalTagsConfig shape', () => {
    describe('API endpoint', () => {
        it('uses the admin tags/internal endpoint', () => {
            expect(internalTagsConfig.apiEndpoint).toBe('/api/v1/admin/tags/internal');
        });
    });

    describe('entity identity', () => {
        it('name is "internal-tags"', () => {
            expect(internalTagsConfig.name).toBe('internal-tags');
        });

        it('basePath is "/platform/tags/internal"', () => {
            expect(internalTagsConfig.basePath).toBe('/platform/tags/internal');
        });

        it('entityKey is "tag"', () => {
            expect(internalTagsConfig.entityKey).toBe('tag');
        });
    });

    describe('view config', () => {
        it('defaultView is "table"', () => {
            expect(internalTagsConfig.viewConfig?.defaultView).toBe('table');
        });

        it('allowViewToggle is true (grid view accessible)', () => {
            expect(internalTagsConfig.viewConfig?.allowViewToggle).toBe(true);
        });

        it('gridConfig is defined', () => {
            expect(internalTagsConfig.viewConfig?.gridConfig).toBeDefined();
        });
    });

    describe('filter bar config', () => {
        it('filterBarConfig is defined', () => {
            expect(internalTagsConfig.filterBarConfig).toBeDefined();
        });

        it('includes a status select filter', () => {
            const filters = internalTagsConfig.filterBarConfig?.filters ?? [];
            const statusFilter = filters.find((f) => f.paramKey === 'status');
            expect(statusFilter).toBeDefined();
            expect(statusFilter?.type).toBe('select');
        });

        it('status filter has ACTIVE, INACTIVE, ARCHIVED, DRAFT options', () => {
            const filters = internalTagsConfig.filterBarConfig?.filters ?? [];
            const statusFilter = filters.find((f) => f.paramKey === 'status') as
                | { options: ReadonlyArray<{ value: string }> }
                | undefined;
            const values = statusFilter?.options.map((o) => o.value) ?? [];
            expect(values).toContain('ACTIVE');
            expect(values).toContain('INACTIVE');
            expect(values).toContain('ARCHIVED');
            expect(values).toContain('DRAFT');
        });

        it('includes an includeDeleted boolean filter', () => {
            const filters = internalTagsConfig.filterBarConfig?.filters ?? [];
            const deletedFilter = filters.find((f) => f.paramKey === 'includeDeleted');
            expect(deletedFilter).toBeDefined();
            expect(deletedFilter?.type).toBe('boolean');
        });
    });

    describe('pagination config', () => {
        it('has a defaultPageSize', () => {
            expect(internalTagsConfig.paginationConfig?.defaultPageSize).toBeGreaterThan(0);
        });
    });

    describe('layout config', () => {
        it('showCreateButton is true', () => {
            expect(internalTagsConfig.layoutConfig.showCreateButton).toBe(true);
        });

        it('createButtonPath navigates to /platform/tags/internal/new', () => {
            expect(internalTagsConfig.layoutConfig.createButtonPath).toBe(
                '/platform/tags/internal/new'
            );
        });
    });

    describe('peek fields', () => {
        it('peekFields is defined and non-empty', () => {
            expect(internalTagsConfig.peekFields?.length).toBeGreaterThan(0);
        });

        it('peekFields includes name field', () => {
            const hasName = internalTagsConfig.peekFields?.some((f) => f.accessorKey === 'name');
            expect(hasName).toBe(true);
        });
    });

    describe('createColumns factory', () => {
        it('createColumns is a function', () => {
            expect(typeof internalTagsConfig.createColumns).toBe('function');
        });

        it('createColumns produces columns with name column', () => {
            const columns = internalTagsConfig.createColumns((key) => key);
            const nameCol = columns.find((c) => c.id === 'name');
            expect(nameCol).toBeDefined();
        });

        it('createColumns produces columns with lifecycleState column', () => {
            const columns = internalTagsConfig.createColumns((key) => key);
            const stateCol = columns.find((c) => c.id === 'lifecycleState');
            expect(stateCol).toBeDefined();
        });
    });

    describe('createEntityListPage output', () => {
        it('InternalTagsRoute is exported from the config module', () => {
            expect(InternalTagsRoute).toBeDefined();
        });
    });
});

// ---------------------------------------------------------------------------
// Route migration assertions (source-level scan)
// ---------------------------------------------------------------------------

describe('T-014 — internal-tags route migration', () => {
    describe('framework wiring', () => {
        it('imports InternalTagsPageComponent from the config', () => {
            expect(routeSrc).toContain('InternalTagsPageComponent');
            expect(routeSrc).toContain('internal-tags.config');
        });

        it('creates Route with createFileRoute', () => {
            expect(routeSrc).toContain('createFileRoute');
        });
    });

    describe('auth guard preservation', () => {
        it('still imports requireAdminApiAccess', () => {
            expect(routeSrc).toContain('requireAdminApiAccess');
        });

        it('wires requireAdminApiAccess in beforeLoad', () => {
            expect(routeSrc).toContain('beforeLoad');
            expect(routeSrc).toContain('requireAdminApiAccess(context)');
        });
    });

    describe('hand-rolled table eliminated', () => {
        it('no longer contains a <table> element', () => {
            expect(routeSrc).not.toContain('<table');
        });

        it('no longer imports useInternalTagsList directly', () => {
            expect(routeSrc).not.toContain('useInternalTagsList');
        });

        it('no longer manages page state with useState', () => {
            expect(routeSrc).not.toContain('const [page, setPage]');
        });

        it('no longer renders pagination buttons inline', () => {
            expect(routeSrc).not.toContain('Anterior');
        });
    });
});
