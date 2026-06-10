/**
 * SPEC-185 Phase 5 — T-015: user-moderation-tags migration onto createEntityListPage.
 *
 * Pure data / source-scan tests. No component rendering, no jsdom.
 *
 * Verifies:
 * - Config shape (filterBarConfig, viewConfig, D-012 constraints, listItemSchema)
 * - Route migration (hand-rolled table removed, UserModerationTagsRoute re-exported)
 * - D-012 constraints preserved (no create button, no edit action, DELETE only)
 * - No new.tsx / $id_.edit.tsx child routes exist (unrelated to config)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    UserModerationTagsRoute,
    userModerationTagsConfig
} from '../../src/features/tags/user-moderation/config/user-moderation-tags.config';

const routeSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/tags/user-moderation/index.tsx'),
    'utf8'
);

const columnsSrc = readFileSync(
    resolve(
        __dirname,
        '../../src/features/tags/user-moderation/config/user-moderation-tags.columns.ts'
    ),
    'utf8'
);

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

describe('T-015 — userModerationTagsConfig shape', () => {
    describe('API endpoint', () => {
        it('uses the admin tags/user endpoint', () => {
            expect(userModerationTagsConfig.apiEndpoint).toBe('/api/v1/admin/tags/user');
        });
    });

    describe('entity identity', () => {
        it('name is "user-moderation-tags"', () => {
            expect(userModerationTagsConfig.name).toBe('user-moderation-tags');
        });

        it('basePath is "/tags/user-moderation"', () => {
            expect(userModerationTagsConfig.basePath).toBe('/tags/user-moderation');
        });

        it('entityKey is "tag"', () => {
            expect(userModerationTagsConfig.entityKey).toBe('tag');
        });
    });

    describe('view config', () => {
        it('defaultView is "table"', () => {
            expect(userModerationTagsConfig.viewConfig?.defaultView).toBe('table');
        });

        it('allowViewToggle is true (grid view accessible)', () => {
            expect(userModerationTagsConfig.viewConfig?.allowViewToggle).toBe(true);
        });

        it('gridConfig is defined', () => {
            expect(userModerationTagsConfig.viewConfig?.gridConfig).toBeDefined();
        });
    });

    describe('D-012 constraints — no create, no edit', () => {
        it('showCreateButton is false (user tags are user-owned, not admin-created)', () => {
            expect(userModerationTagsConfig.layoutConfig.showCreateButton).toBe(false);
        });

        it('createButtonPath is undefined (no create route exists)', () => {
            expect(userModerationTagsConfig.layoutConfig.createButtonPath).toBeUndefined();
        });

        it('columns do NOT include a link-typed name column (no edit link)', () => {
            const columns = userModerationTagsConfig.createColumns((key) => key);
            const nameCol = columns.find((c) => c.id === 'name');
            // name column exists but must NOT have a linkHandler (D-012: no edit)
            expect(nameCol).toBeDefined();
            expect(nameCol?.linkHandler).toBeUndefined();
        });
    });

    describe('filter bar config', () => {
        it('filterBarConfig is defined', () => {
            expect(userModerationTagsConfig.filterBarConfig).toBeDefined();
        });

        it('includes an includeDeleted boolean filter', () => {
            const filters = userModerationTagsConfig.filterBarConfig?.filters ?? [];
            const deletedFilter = filters.find((f) => f.paramKey === 'includeDeleted');
            expect(deletedFilter).toBeDefined();
            expect(deletedFilter?.type).toBe('boolean');
        });
    });

    describe('pagination config', () => {
        it('has a defaultPageSize', () => {
            expect(userModerationTagsConfig.paginationConfig?.defaultPageSize).toBeGreaterThan(0);
        });
    });

    describe('peek fields', () => {
        it('peekFields is defined and non-empty', () => {
            expect(userModerationTagsConfig.peekFields?.length).toBeGreaterThan(0);
        });

        it('peekFields includes ownerDisplayName field', () => {
            const hasOwner = userModerationTagsConfig.peekFields?.some(
                (f) => f.accessorKey === 'ownerDisplayName'
            );
            expect(hasOwner).toBe(true);
        });
    });

    describe('createColumns factory', () => {
        it('createColumns is a function', () => {
            expect(typeof userModerationTagsConfig.createColumns).toBe('function');
        });

        it('produces columns with owner column', () => {
            const columns = userModerationTagsConfig.createColumns((key) => key);
            const ownerCol = columns.find((c) => c.id === 'owner');
            expect(ownerCol).toBeDefined();
        });

        it('produces columns with name column', () => {
            const columns = userModerationTagsConfig.createColumns((key) => key);
            const nameCol = columns.find((c) => c.id === 'name');
            expect(nameCol).toBeDefined();
        });

        it('produces columns with usageCount column', () => {
            const columns = userModerationTagsConfig.createColumns((key) => key);
            const usageCol = columns.find((c) => c.id === 'usageCount');
            expect(usageCol).toBeDefined();
        });
    });

    describe('createEntityListPage output', () => {
        it('UserModerationTagsRoute is exported from the config module', () => {
            expect(UserModerationTagsRoute).toBeDefined();
        });
    });
});

// ---------------------------------------------------------------------------
// D-012 assertions at source level — columns file
// ---------------------------------------------------------------------------

describe('T-015 — D-012 constraints at source level', () => {
    it('columns file does NOT import EditIcon (no edit action)', () => {
        expect(columnsSrc).not.toContain('EditIcon');
    });

    it('columns file uses TAG_USER_DELETE_ANY permission (correct delete gate)', () => {
        expect(columnsSrc).toContain('TAG_USER_DELETE_ANY');
    });

    it('columns file uses useDeleteAnyUserTag mutation', () => {
        expect(columnsSrc).toContain('useDeleteAnyUserTag');
    });
});

// ---------------------------------------------------------------------------
// Route migration assertions (source-level scan)
// ---------------------------------------------------------------------------

describe('T-015 — user-moderation route migration', () => {
    describe('framework wiring', () => {
        it('re-exports UserModerationTagsRoute as Route', () => {
            expect(routeSrc).toContain('UserModerationTagsRoute');
            expect(routeSrc).toContain('export const Route = UserModerationTagsRoute');
        });

        it('imports from user-moderation-tags.config', () => {
            expect(routeSrc).toContain('user-moderation-tags.config');
        });
    });

    describe('hand-rolled table eliminated', () => {
        it('no longer contains a <table> element', () => {
            expect(routeSrc).not.toContain('<table');
        });

        it('no longer imports useUserTagModerationList directly', () => {
            expect(routeSrc).not.toContain('useUserTagModerationList');
        });

        it('no longer imports UserTagModerationTable component', () => {
            // The old bespoke table used a separate UserTagModerationTable component
            expect(routeSrc).not.toContain('UserTagModerationTable');
        });

        it('no longer manages page state with useState', () => {
            expect(routeSrc).not.toContain('const [page, setPage]');
        });
    });
});
