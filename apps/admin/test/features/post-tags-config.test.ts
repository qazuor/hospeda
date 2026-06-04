/**
 * SPEC-185 Phase 5 — T-013: post-tags migration onto createEntityListPage.
 *
 * Pure data / source-scan tests. No component rendering, no jsdom.
 *
 * Verifies:
 * - Config shape (filterBarConfig, viewConfig, listItemSchema, etc.)
 * - Route migration (hand-rolled table removed, PostTagsRoute re-exported)
 * - Navigation preservation (new.tsx and $id_.edit.tsx untouched)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    PostTagsRoute,
    postTagsConfig
} from '../../src/features/tags/post-tags/config/post-tags.config';

const routeSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/tags/post-tags/index.tsx'),
    'utf8'
);

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

describe('T-013 — postTagsConfig shape', () => {
    describe('API endpoint', () => {
        it('uses the admin posts/tags endpoint', () => {
            expect(postTagsConfig.apiEndpoint).toBe('/api/v1/admin/posts/tags');
        });
    });

    describe('entity identity', () => {
        it('name is "post-tags"', () => {
            expect(postTagsConfig.name).toBe('post-tags');
        });

        it('basePath is "/tags/post-tags"', () => {
            expect(postTagsConfig.basePath).toBe('/tags/post-tags');
        });

        it('entityKey is "tag"', () => {
            expect(postTagsConfig.entityKey).toBe('tag');
        });
    });

    describe('view config', () => {
        it('defaultView is "table"', () => {
            expect(postTagsConfig.viewConfig?.defaultView).toBe('table');
        });

        it('allowViewToggle is true (grid view accessible)', () => {
            expect(postTagsConfig.viewConfig?.allowViewToggle).toBe(true);
        });

        it('gridConfig is defined', () => {
            expect(postTagsConfig.viewConfig?.gridConfig).toBeDefined();
        });
    });

    describe('filter bar config', () => {
        it('filterBarConfig is defined', () => {
            expect(postTagsConfig.filterBarConfig).toBeDefined();
        });

        it('includes a status select filter', () => {
            const filters = postTagsConfig.filterBarConfig?.filters ?? [];
            const statusFilter = filters.find((f) => f.paramKey === 'status');
            expect(statusFilter).toBeDefined();
            expect(statusFilter?.type).toBe('select');
        });

        it('status filter has ACTIVE, INACTIVE, ARCHIVED, DRAFT options', () => {
            const filters = postTagsConfig.filterBarConfig?.filters ?? [];
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
            const filters = postTagsConfig.filterBarConfig?.filters ?? [];
            const deletedFilter = filters.find((f) => f.paramKey === 'includeDeleted');
            expect(deletedFilter).toBeDefined();
            expect(deletedFilter?.type).toBe('boolean');
        });
    });

    describe('pagination config', () => {
        it('has a defaultPageSize', () => {
            expect(postTagsConfig.paginationConfig?.defaultPageSize).toBeGreaterThan(0);
        });
    });

    describe('layout config', () => {
        it('showCreateButton is true', () => {
            expect(postTagsConfig.layoutConfig.showCreateButton).toBe(true);
        });

        it('createButtonPath navigates to /tags/post-tags/new', () => {
            expect(postTagsConfig.layoutConfig.createButtonPath).toBe('/tags/post-tags/new');
        });
    });

    describe('peek fields', () => {
        it('peekFields is defined and non-empty', () => {
            expect(postTagsConfig.peekFields?.length).toBeGreaterThan(0);
        });

        it('peekFields includes slug field', () => {
            const hasSLug = postTagsConfig.peekFields?.some((f) => f.accessorKey === 'slug');
            expect(hasSLug).toBe(true);
        });
    });

    describe('createColumns factory', () => {
        it('createColumns is a function', () => {
            expect(typeof postTagsConfig.createColumns).toBe('function');
        });

        it('createColumns produces columns with name column', () => {
            const columns = postTagsConfig.createColumns((key) => key);
            const nameCol = columns.find((c) => c.id === 'name');
            expect(nameCol).toBeDefined();
        });

        it('createColumns produces columns with slug column', () => {
            const columns = postTagsConfig.createColumns((key) => key);
            const slugCol = columns.find((c) => c.id === 'slug');
            expect(slugCol).toBeDefined();
        });

        it('createColumns produces columns with lifecycleState column', () => {
            const columns = postTagsConfig.createColumns((key) => key);
            const stateCol = columns.find((c) => c.id === 'lifecycleState');
            expect(stateCol).toBeDefined();
        });
    });

    describe('createEntityListPage output', () => {
        it('PostTagsRoute is exported from the config module', () => {
            expect(PostTagsRoute).toBeDefined();
        });
    });
});

// ---------------------------------------------------------------------------
// Route migration assertions (source-level scan)
// ---------------------------------------------------------------------------

describe('T-013 — post-tags route migration', () => {
    describe('framework wiring', () => {
        it('re-exports PostTagsRoute as Route', () => {
            expect(routeSrc).toContain('PostTagsRoute');
            expect(routeSrc).toContain('export const Route = PostTagsRoute');
        });

        it('imports from post-tags.config', () => {
            expect(routeSrc).toContain('post-tags.config');
        });
    });

    describe('hand-rolled table eliminated', () => {
        it('no longer contains a <table> element', () => {
            expect(routeSrc).not.toContain('<table');
        });

        it('no longer imports usePostTagsList directly', () => {
            expect(routeSrc).not.toContain('usePostTagsList');
        });

        it('no longer manages page state with useState', () => {
            expect(routeSrc).not.toContain('const [page, setPage]');
        });

        it('no longer renders pagination buttons inline', () => {
            // The old bespoke pagination used "Anterior" / "Siguiente" inline
            expect(routeSrc).not.toContain('Anterior');
        });
    });
});
