import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AdminSearchBaseSchema,
    AdminStatusFilterSchema,
    parseAdminSort
} from '../../src/common/admin-search.schema.js';

describe('AdminSearchBaseSchema', () => {
    describe('defaults', () => {
        it('should apply all defaults when parsing empty object', () => {
            const result = AdminSearchBaseSchema.parse({});

            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(20);
            expect(result.search).toBeUndefined();
            expect(result.sort).toBe('createdAt:desc');
            expect(result.status).toBe('all');
            expect(result.includeDeleted).toBe(false);
            expect(result.createdAfter).toBeUndefined();
            expect(result.createdBefore).toBeUndefined();
        });
    });

    describe('page', () => {
        it('should accept valid page numbers', () => {
            expect(AdminSearchBaseSchema.parse({ page: 1 }).page).toBe(1);
            expect(AdminSearchBaseSchema.parse({ page: 100 }).page).toBe(100);
        });

        it('should coerce string to number', () => {
            expect(AdminSearchBaseSchema.parse({ page: '5' }).page).toBe(5);
        });

        it('should reject zero or negative page', () => {
            expect(() => AdminSearchBaseSchema.parse({ page: 0 })).toThrow(ZodError);
            expect(() => AdminSearchBaseSchema.parse({ page: -1 })).toThrow(ZodError);
        });

        it('should reject non-integer page', () => {
            expect(() => AdminSearchBaseSchema.parse({ page: 1.5 })).toThrow(ZodError);
        });
    });

    describe('pageSize', () => {
        it('should accept valid pageSize values', () => {
            expect(AdminSearchBaseSchema.parse({ pageSize: 1 }).pageSize).toBe(1);
            expect(AdminSearchBaseSchema.parse({ pageSize: 50 }).pageSize).toBe(50);
            expect(AdminSearchBaseSchema.parse({ pageSize: 100 }).pageSize).toBe(100);
        });

        it('should coerce string to number', () => {
            expect(AdminSearchBaseSchema.parse({ pageSize: '25' }).pageSize).toBe(25);
        });

        it('should reject pageSize over 100', () => {
            expect(() => AdminSearchBaseSchema.parse({ pageSize: 101 })).toThrow(ZodError);
        });

        it('should reject zero or negative pageSize', () => {
            expect(() => AdminSearchBaseSchema.parse({ pageSize: 0 })).toThrow(ZodError);
            expect(() => AdminSearchBaseSchema.parse({ pageSize: -1 })).toThrow(ZodError);
        });
    });

    describe('search', () => {
        it('should accept valid search strings', () => {
            expect(AdminSearchBaseSchema.parse({ search: 'hotel' }).search).toBe('hotel');
            expect(AdminSearchBaseSchema.parse({ search: '' }).search).toBe('');
        });

        it('should reject search strings over 200 characters', () => {
            const longSearch = 'a'.repeat(201);
            expect(() => AdminSearchBaseSchema.parse({ search: longSearch })).toThrow(ZodError);
        });

        it('should accept search strings up to 200 characters', () => {
            const maxSearch = 'a'.repeat(200);
            expect(AdminSearchBaseSchema.parse({ search: maxSearch }).search).toBe(maxSearch);
        });
    });

    describe('sort', () => {
        it('should accept valid sort strings', () => {
            expect(AdminSearchBaseSchema.parse({ sort: 'name:asc' }).sort).toBe('name:asc');
            expect(AdminSearchBaseSchema.parse({ sort: 'createdAt:desc' }).sort).toBe(
                'createdAt:desc'
            );
            expect(AdminSearchBaseSchema.parse({ sort: 'updated_at:asc' }).sort).toBe(
                'updated_at:asc'
            );
        });

        it('should reject invalid sort format', () => {
            expect(() => AdminSearchBaseSchema.parse({ sort: 'name' })).toThrow(ZodError);
            expect(() => AdminSearchBaseSchema.parse({ sort: 'name:invalid' })).toThrow(ZodError);
            expect(() => AdminSearchBaseSchema.parse({ sort: ':asc' })).toThrow(ZodError);
            expect(() => AdminSearchBaseSchema.parse({ sort: 'name:' })).toThrow(ZodError);
        });
    });

    describe('status', () => {
        it('should accept "all" as default', () => {
            expect(AdminSearchBaseSchema.parse({}).status).toBe('all');
        });

        it('should accept valid lifecycle status values', () => {
            expect(AdminSearchBaseSchema.parse({ status: 'DRAFT' }).status).toBe('DRAFT');
            expect(AdminSearchBaseSchema.parse({ status: 'ACTIVE' }).status).toBe('ACTIVE');
            expect(AdminSearchBaseSchema.parse({ status: 'ARCHIVED' }).status).toBe('ARCHIVED');
        });

        it('should accept "all" explicitly', () => {
            expect(AdminSearchBaseSchema.parse({ status: 'all' }).status).toBe('all');
        });

        it('should reject invalid status values', () => {
            expect(() => AdminSearchBaseSchema.parse({ status: 'INVALID' })).toThrow(ZodError);
            expect(() => AdminSearchBaseSchema.parse({ status: 'published' })).toThrow(ZodError);
            expect(() => AdminSearchBaseSchema.parse({ status: 'inactive' })).toThrow(ZodError);
        });
    });

    describe('includeDeleted', () => {
        it('should default to false', () => {
            expect(AdminSearchBaseSchema.parse({}).includeDeleted).toBe(false);
        });

        it('should accept boolean values', () => {
            expect(AdminSearchBaseSchema.parse({ includeDeleted: true }).includeDeleted).toBe(true);
            expect(AdminSearchBaseSchema.parse({ includeDeleted: false }).includeDeleted).toBe(
                false
            );
        });

        it('should coerce string "true" to boolean true', () => {
            expect(AdminSearchBaseSchema.parse({ includeDeleted: 'true' }).includeDeleted).toBe(
                true
            );
        });

        it('should coerce falsy values to false', () => {
            // queryBooleanParam: only "true", true, "1" are truthy
            // everything else resolves to false via the .default(false) chain
            expect(AdminSearchBaseSchema.parse({ includeDeleted: '' }).includeDeleted).toBe(false);
            expect(AdminSearchBaseSchema.parse({ includeDeleted: 0 }).includeDeleted).toBe(false);
        });

        it('should coerce string "false" to boolean false (queryBooleanParam fix)', () => {
            // Unlike z.coerce.boolean() where Boolean("false") === true,
            // queryBooleanParam correctly treats "false" as falsy
            expect(AdminSearchBaseSchema.parse({ includeDeleted: 'false' }).includeDeleted).toBe(
                false
            );
        });

        it('should coerce string "1" to boolean true', () => {
            expect(AdminSearchBaseSchema.parse({ includeDeleted: '1' }).includeDeleted).toBe(true);
        });

        it('should coerce string "0" to boolean false', () => {
            expect(AdminSearchBaseSchema.parse({ includeDeleted: '0' }).includeDeleted).toBe(false);
        });
    });

    describe('createdAfter / createdBefore', () => {
        it('should accept valid ISO date strings', () => {
            const result = AdminSearchBaseSchema.parse({
                createdAfter: '2025-01-01T00:00:00.000Z',
                createdBefore: '2025-12-31T23:59:59.999Z'
            });

            expect(result.createdAfter).toBeInstanceOf(Date);
            expect(result.createdBefore).toBeInstanceOf(Date);
        });

        it('should accept Date objects', () => {
            const now = new Date();
            const result = AdminSearchBaseSchema.parse({
                createdAfter: now
            });

            expect(result.createdAfter).toBeInstanceOf(Date);
        });

        it('should leave undefined when not provided', () => {
            const result = AdminSearchBaseSchema.parse({});

            expect(result.createdAfter).toBeUndefined();
            expect(result.createdBefore).toBeUndefined();
        });
    });

    describe('combined validation', () => {
        it('should parse a complete admin search query', () => {
            const result = AdminSearchBaseSchema.parse({
                page: '2',
                pageSize: '50',
                search: 'hotel luxury',
                sort: 'name:asc',
                status: 'ACTIVE',
                includeDeleted: 'true',
                createdAfter: '2025-06-01T00:00:00.000Z',
                createdBefore: '2025-12-31T23:59:59.999Z'
            });

            expect(result.page).toBe(2);
            expect(result.pageSize).toBe(50);
            expect(result.search).toBe('hotel luxury');
            expect(result.sort).toBe('name:asc');
            expect(result.status).toBe('ACTIVE');
            expect(result.includeDeleted).toBe(true);
            expect(result.createdAfter).toBeInstanceOf(Date);
            expect(result.createdBefore).toBeInstanceOf(Date);
        });
    });
});

describe('AdminStatusFilterSchema', () => {
    it('should accept all valid values', () => {
        const validValues = ['all', 'DRAFT', 'ACTIVE', 'ARCHIVED'];

        for (const value of validValues) {
            expect(AdminStatusFilterSchema.parse(value)).toBe(value);
        }
    });

    it('should default to "all"', () => {
        expect(AdminStatusFilterSchema.parse(undefined)).toBe('all');
    });
});

describe('parseAdminSort', () => {
    it('should parse sort string into field and direction', () => {
        expect(parseAdminSort('createdAt:desc')).toEqual({
            field: 'createdAt',
            direction: 'desc'
        });

        expect(parseAdminSort('name:asc')).toEqual({
            field: 'name',
            direction: 'asc'
        });
    });

    it('should throw on missing direction', () => {
        expect(() => parseAdminSort('name')).toThrow('Invalid sort format');
    });

    it('should throw on invalid direction', () => {
        expect(() => parseAdminSort('name:invalid')).toThrow('Invalid sort format');
    });

    it('should throw on empty string', () => {
        expect(() => parseAdminSort('')).toThrow('Invalid sort format');
    });

    it('should throw on missing field', () => {
        expect(() => parseAdminSort(':asc')).toThrow('Invalid sort format');
    });
});
