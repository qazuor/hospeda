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

describe('BaseSearchSchema — sorts + featuredFirst', () => {
    it('accepts an empty object (all fields optional)', () => {
        const result = BaseSearchSchema.parse({});
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(10);
        expect(result.sorts).toBeUndefined();
        expect(result.featuredFirst).toBeUndefined();
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

    it('accepts featuredFirst: true', () => {
        const result = BaseSearchSchema.parse({ featuredFirst: true });
        expect(result.featuredFirst).toBe(true);
    });

    it('accepts featuredFirst: false', () => {
        const result = BaseSearchSchema.parse({ featuredFirst: false });
        expect(result.featuredFirst).toBe(false);
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

describe('HttpSortingSchema — featuredFirst strict boolean coercion', () => {
    it("coerces the literal 'true' to true", () => {
        const result = HttpSortingSchema.parse({ featuredFirst: 'true' });
        expect(result.featuredFirst).toBe(true);
    });

    it("coerces the literal 'false' to false (NOT truthy)", () => {
        const result = HttpSortingSchema.parse({ featuredFirst: 'false' });
        expect(result.featuredFirst).toBe(false);
    });

    it('rejects any non-literal string (no lax coercion)', () => {
        const result = HttpSortingSchema.safeParse({ featuredFirst: 'truthy' });
        expect(result.success).toBe(false);
    });

    it('allows omitting featuredFirst entirely', () => {
        const result = HttpSortingSchema.parse({});
        expect(result.featuredFirst).toBeUndefined();
    });
});
