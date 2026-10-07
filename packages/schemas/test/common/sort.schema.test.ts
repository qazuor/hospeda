import { describe, expect, it } from 'vitest';
import { HttpSortingSchema } from '../../src/api/http/base-http.schema.js';
import { BaseSearchSchema, SortFieldSchema } from '../../src/common/pagination.schema.js';

describe('SortFieldSchema', () => {
    it('parses a valid sort field object', () => {
        const result = SortFieldSchema.parse({ field: 'name', order: 'asc' });
        expect(result).toEqual({ field: 'name', order: 'asc' });
    });

    it('rejects an empty field', () => {
        const result = SortFieldSchema.safeParse({ field: '', order: 'asc' });
        expect(result.success).toBe(false);
    });

    it('rejects an order outside the enum', () => {
        const result = SortFieldSchema.safeParse({ field: 'name', order: 'DESC' });
        expect(result.success).toBe(false);
    });
});

describe('BaseSearchSchema — sorts', () => {
    it('accepts an empty object (all fields optional)', () => {
        const result = BaseSearchSchema.parse({});
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(10);
        expect(result.sorts).toBeUndefined();
    });

    it('accepts up to 5 sort entries', () => {
        const sorts = [
            { field: 'a', order: 'asc' as const },
            { field: 'b', order: 'desc' as const },
            { field: 'c', order: 'asc' as const },
            { field: 'd', order: 'desc' as const },
            { field: 'e', order: 'asc' as const }
        ];
        const result = BaseSearchSchema.parse({ sorts });
        expect(result.sorts).toEqual(sorts);
    });

    it('rejects more than 5 sort entries with the i18n key zodError.common.sort.maxFields', () => {
        const sorts = Array.from({ length: 6 }, (_, i) => ({
            field: `f${i}`,
            order: 'asc' as const
        }));
        const result = BaseSearchSchema.safeParse({ sorts });
        expect(result.success).toBe(false);
        if (result.success) return;
        const issue = result.error.issues.find((i) => i.path[0] === 'sorts');
        expect(issue).toBeDefined();
        if (!issue) return;
        expect(issue.code).toBe('too_big');
        expect(issue.message).toBe('zodError.common.sort.maxFields');
        // Zod v4 uses `origin: 'array'` instead of v3's `type: 'array'`.
        expect((issue as { origin?: string }).origin).toBe('array');
    });

    it('no longer carries featuredFirst (removed with the featured columns, HOS-1419)', () => {
        const result = BaseSearchSchema.parse({ featuredFirst: true });
        expect('featuredFirst' in result).toBe(false);
    });

    it('keeps the legacy sortBy/sortOrder fields', () => {
        const result = BaseSearchSchema.parse({ sortBy: 'name', sortOrder: 'desc' });
        expect(result.sortBy).toBe('name');
        expect(result.sortOrder).toBe('desc');
    });
});

describe('HttpSortingSchema — CSV sorts transform', () => {
    it('parses a happy-path CSV into ordered SortField objects', () => {
        const result = HttpSortingSchema.parse({ sorts: 'averageRating:desc,name:asc' });
        expect(result.sorts).toEqual([
            { field: 'averageRating', order: 'desc' },
            { field: 'name', order: 'asc' }
        ]);
    });

    it('defaults missing order to asc', () => {
        const result = HttpSortingSchema.parse({ sorts: 'name' });
        expect(result.sorts).toEqual([{ field: 'name', order: 'asc' }]);
    });

    it('coerces an unknown order value to asc', () => {
        const result = HttpSortingSchema.parse({ sorts: 'name:invalid' });
        expect(result.sorts).toEqual([{ field: 'name', order: 'asc' }]);
    });

    it('drops entries with an empty field (e.g. ":desc")', () => {
        const result = HttpSortingSchema.parse({ sorts: ':desc' });
        expect(result.sorts).toEqual([]);
    });

    it('returns an empty array for an empty string', () => {
        const result = HttpSortingSchema.parse({ sorts: '' });
        expect(result.sorts).toEqual([]);
    });

    it('truncates to the first 5 entries', () => {
        const csv = 'a:asc,b:asc,c:asc,d:asc,e:asc,f:asc';
        const result = HttpSortingSchema.parse({ sorts: csv });
        expect(result.sorts).toHaveLength(5);
        expect(result.sorts?.map((s) => s.field)).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('preserves duplicate field names in declared order (Postgres honors them)', () => {
        const result = HttpSortingSchema.parse({ sorts: 'name:asc,name:desc' });
        expect(result.sorts).toEqual([
            { field: 'name', order: 'asc' },
            { field: 'name', order: 'desc' }
        ]);
    });

    it('trims whitespace around field and order', () => {
        const result = HttpSortingSchema.parse({ sorts: '  name : asc ,   rating:desc' });
        expect(result.sorts).toEqual([
            { field: 'name', order: 'asc' },
            { field: 'rating', order: 'desc' }
        ]);
    });
});

describe('HttpSortingSchema — featuredFirst removed (HOS-1419)', () => {
    it('does not expose featuredFirst any more', () => {
        expect(Object.keys(HttpSortingSchema.shape)).not.toContain('featuredFirst');
    });
});
