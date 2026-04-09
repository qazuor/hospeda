import { integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
    buildSearchCondition,
    buildWhereClause,
    escapeLikePattern
} from '../../src/utils/drizzle-helpers';

// Simple mock table using plain strings (sufficient for eq/isNull tests)
const mockTable = {
    id: 'id_col',
    name: 'name_col',
    age: 'age_col',
    active: 'active_col'
};

/**
 * Real Drizzle table for testing operator suffixes (_like, _gte, _lte).
 * These operators call ilike/gte/lte which require actual PgColumn instances.
 */
const testTable = pgTable('test_items', {
    id: integer('id'),
    name: varchar('name', { length: 255 }),
    description: text('description'),
    price: integer('price'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at')
});

describe('escapeLikePattern', () => {
    it('should escape percent character', () => {
        expect(escapeLikePattern('10%')).toBe('10\\%');
    });

    it('should escape underscore character', () => {
        expect(escapeLikePattern('test_data')).toBe('test\\_data');
    });

    it('should escape backslash character', () => {
        expect(escapeLikePattern('C:\\Users')).toBe('C:\\\\Users');
    });

    it('should escape multiple wildcards in same string', () => {
        expect(escapeLikePattern('100%_off')).toBe('100\\%\\_off');
    });

    it('should escape backslash before other metacharacters (order verification)', () => {
        expect(escapeLikePattern('\\%')).toBe('\\\\\\%');
    });

    it('should return empty string unchanged', () => {
        expect(escapeLikePattern('')).toBe('');
    });

    it('should return normal text unchanged', () => {
        expect(escapeLikePattern('hotel paradise')).toBe('hotel paradise');
    });

    it('should handle string with only metacharacters', () => {
        expect(escapeLikePattern('%_\\')).toBe('\\%\\_\\\\');
    });
});

describe('buildWhereClause', () => {
    it('returns undefined for empty object', () => {
        const clause = buildWhereClause({}, mockTable);
        expect(clause).toBeUndefined();
    });

    it('returns eq for single field', () => {
        const clause = buildWhereClause({ id: 1 }, mockTable);
        // Cannot compare SQL, but can check type and that it is not undefined
        expect(clause).toBeDefined();
    });

    it('returns and(eq, eq) for two fields', () => {
        const clause = buildWhereClause({ id: 1, name: 'foo' }, mockTable);
        expect(clause).toBeDefined();
    });

    it('ignores undefined values', () => {
        const clause = buildWhereClause({ id: 1, name: undefined }, mockTable);
        expect(clause).toBeDefined();
    });

    it('handles different value types', () => {
        const clause = buildWhereClause({ id: 1, name: 'foo', age: 30 }, mockTable);
        expect(clause).toBeDefined();
    });

    it('ignores keys not in table', () => {
        const clause = buildWhereClause({ foo: 123, id: 1 }, mockTable);
        expect(clause).toBeDefined();
    });

    it('handles null values', () => {
        const clause = buildWhereClause({ id: null }, mockTable);
        expect(clause).toBeDefined();
    });

    it('handles mix of undefined and null', () => {
        const clause = buildWhereClause({ id: 1, name: undefined, age: null }, mockTable);
        expect(clause).toBeDefined();
    });

    it('handles boolean values', () => {
        const clause = buildWhereClause({ active: true }, mockTable);
        expect(clause).toBeDefined();
    });

    it('does not crash with prototype pollution', () => {
        const obj = Object.create({ evil: 42 });
        obj.id = 1;
        const clause = buildWhereClause(obj, mockTable);
        expect(clause).toBeDefined();
    });

    it('returns undefined when table is null', () => {
        const clause = buildWhereClause({ id: 1 }, null);
        expect(clause).toBeUndefined();
    });

    it('returns undefined when table is a non-object primitive', () => {
        const clause = buildWhereClause({ id: 1 }, 42);
        expect(clause).toBeUndefined();
    });

    it('returns undefined when all keys are unknown (skipped and logged)', () => {
        // Arrange -- keys that don't exist in testTable
        const filters = { unknownField: 'value', anotherMissing: 123 };

        // Act
        const clause = buildWhereClause(filters, testTable);

        // Assert -- all keys skipped, no clause produced
        expect(clause).toBeUndefined();
    });

    describe('_like suffix (ILIKE comparison)', () => {
        it('produces a clause for a string value on a varchar column', () => {
            // Arrange
            const filters = { name_like: 'hotel' };

            // Act
            const clause = buildWhereClause(filters, testTable);

            // Assert
            expect(clause).toBeDefined();
        });

        it('silently skips when the base column does not exist in the table', () => {
            // Arrange
            const filters = { nonExistent_like: 'test' };

            // Act
            const clause = buildWhereClause(filters, testTable);

            // Assert
            expect(clause).toBeUndefined();
        });

        it('is not applied when value is not a string', () => {
            // Arrange -- _like requires typeof value === 'string'
            const filters = { name_like: 123 };

            // Act -- falls through _like check, tries as regular key 'name_like'
            const clause = buildWhereClause(filters, testTable);

            // Assert -- 'name_like' is not a real column, so undefined
            expect(clause).toBeUndefined();
        });
    });

    describe('_gte suffix (>= comparison)', () => {
        it('produces a clause for a Date value on a timestamp column', () => {
            // Arrange
            const filters = { createdAt_gte: new Date('2026-03-01') };

            // Act
            const clause = buildWhereClause(filters, testTable);

            // Assert
            expect(clause).toBeDefined();
        });

        it('produces a clause for a numeric value on an integer column', () => {
            // Arrange
            const filters = { price_gte: 100 };

            // Act
            const clause = buildWhereClause(filters, testTable);

            // Assert
            expect(clause).toBeDefined();
        });

        it('silently skips when the base column does not exist in the table', () => {
            // Arrange
            const filters = { nonExistentColumn_gte: new Date('2026-03-01') };

            // Act
            const clause = buildWhereClause(filters, testTable);

            // Assert
            expect(clause).toBeUndefined();
        });
    });

    describe('_lte suffix (<= comparison)', () => {
        it('produces a clause for a Date value on a timestamp column', () => {
            // Arrange
            const filters = { createdAt_lte: new Date('2026-03-15') };

            // Act
            const clause = buildWhereClause(filters, testTable);

            // Assert
            expect(clause).toBeDefined();
        });

        it('produces a clause for a numeric value on an integer column', () => {
            // Arrange
            const filters = { price_lte: 500 };

            // Act
            const clause = buildWhereClause(filters, testTable);

            // Assert
            expect(clause).toBeDefined();
        });

        it('silently skips when the base column does not exist in the table', () => {
            // Arrange
            const filters = { nonExistentColumn_lte: new Date('2026-03-15') };

            // Act
            const clause = buildWhereClause(filters, testTable);

            // Assert
            expect(clause).toBeUndefined();
        });
    });

    describe('_gte and _lte combined with other operators', () => {
        it('combines _like with _gte into a single clause', () => {
            // Arrange
            const filters = {
                name_like: 'foo',
                createdAt_gte: new Date('2026-03-01')
            };

            // Act
            const clause = buildWhereClause(filters, testTable);

            // Assert
            expect(clause).toBeDefined();
        });

        it('combines _gte and _lte on different columns', () => {
            // Arrange
            const filters = {
                createdAt_gte: new Date('2026-03-01'),
                updatedAt_lte: new Date('2026-03-31')
            };

            // Act
            const clause = buildWhereClause(filters, testTable);

            // Assert
            expect(clause).toBeDefined();
        });

        it('combines _gte and _lte on the same column (range filter)', () => {
            // Arrange
            const filters = {
                price_gte: 100,
                price_lte: 500
            };

            // Act
            const clause = buildWhereClause(filters, testTable);

            // Assert
            expect(clause).toBeDefined();
        });

        it('combines eq, _gte, and _lte in a single filter', () => {
            // Arrange
            const filters = {
                id: 42,
                price_gte: 100,
                createdAt_lte: new Date('2026-03-31')
            };

            // Act
            const clause = buildWhereClause(filters, testTable);

            // Assert
            expect(clause).toBeDefined();
        });
    });
});

describe('buildSearchCondition', () => {
    it('returns an ilike condition for a single column (not wrapped in or)', () => {
        // Arrange
        const term = 'hotel';
        const columns = ['name'] as const;

        // Act
        const result = buildSearchCondition(term, columns, testTable);

        // Assert -- single column returns the ilike directly, not an or() wrapper
        expect(result).toBeDefined();
    });

    it('returns an OR of ilike conditions for multiple columns', () => {
        // Arrange
        const term = 'beach';
        const columns = ['name', 'description'] as const;

        // Act
        const result = buildSearchCondition(term, columns, testTable);

        // Assert
        expect(result).toBeDefined();
    });

    it('returns undefined for an empty string term', () => {
        // Arrange
        const term = '';
        const columns = ['name'] as const;

        // Act
        const result = buildSearchCondition(term, columns, testTable);

        // Assert
        expect(result).toBeUndefined();
    });

    it('returns undefined for a whitespace-only term', () => {
        // Arrange
        const term = '   ';
        const columns = ['name', 'description'] as const;

        // Act
        const result = buildSearchCondition(term, columns, testTable);

        // Assert
        expect(result).toBeUndefined();
    });

    it('returns undefined when all columns are non-existent', () => {
        // Arrange
        const term = 'search';
        const columns = ['nonExistent', 'alsoMissing'] as const;

        // Act
        const result = buildSearchCondition(term, columns, testTable);

        // Assert
        expect(result).toBeUndefined();
    });

    it('produces conditions only for valid columns when mixed with invalid ones', () => {
        // Arrange
        const term = 'resort';
        const columns = ['name', 'nonExistent', 'description', 'alsoMissing'] as const;

        // Act
        const result = buildSearchCondition(term, columns, testTable);

        // Assert -- two valid columns produce a defined result
        expect(result).toBeDefined();
    });

    it('produces a single ilike when only one column in the mix is valid', () => {
        // Arrange
        const term = 'spa';
        const columns = ['nonExistent', 'name', 'alsoMissing'] as const;

        // Act
        const result = buildSearchCondition(term, columns, testTable);

        // Assert -- only 'name' is valid, so single ilike (not or)
        expect(result).toBeDefined();
    });

    it('returns undefined when table is null', () => {
        // Arrange
        const term = 'search';
        const columns = ['name'] as const;

        // Act
        const result = buildSearchCondition(term, columns, null);

        // Assert
        expect(result).toBeUndefined();
    });

    it('returns undefined when table is a non-object primitive', () => {
        // Arrange
        const term = 'search';
        const columns = ['name'] as const;

        // Act
        const result = buildSearchCondition(term, columns, 42);

        // Assert
        expect(result).toBeUndefined();
    });

    it('trims the search term before matching', () => {
        // Arrange -- term with leading/trailing whitespace
        const term = '  hotel  ';
        const columns = ['name'] as const;

        // Act
        const result = buildSearchCondition(term, columns, testTable);

        // Assert -- trimmed term still produces a valid condition
        expect(result).toBeDefined();
    });

    it('returns undefined when columns array is empty', () => {
        // Arrange
        const term = 'search';
        const columns: readonly string[] = [];

        // Act
        const result = buildSearchCondition(term, columns, testTable);

        // Assert
        expect(result).toBeUndefined();
    });

    it('produces a defined condition when term contains percent wildcard', () => {
        // Arrange -- % in the term should be escaped, not treated as SQL wildcard
        const term = '50%off';
        const columns = ['name'] as const;

        // Act
        const result = buildSearchCondition(term, columns, testTable);

        // Assert -- condition still produced (escaping does not cause undefined)
        expect(result).toBeDefined();
    });

    it('produces a defined condition when term contains underscore wildcard', () => {
        // Arrange
        const term = 'test_data';
        const columns = ['name'] as const;

        // Act
        const result = buildSearchCondition(term, columns, testTable);

        // Assert
        expect(result).toBeDefined();
    });
});

describe('buildWhereClause _like suffix wildcard escaping', () => {
    it('produces a clause when _like value contains percent', () => {
        // Arrange -- percent in value should be escaped before being sent to ILIKE
        const filters = { name_like: '50%off' };

        // Act
        const clause = buildWhereClause(filters, testTable);

        // Assert -- clause is still produced (escaping does not cause undefined)
        expect(clause).toBeDefined();
    });

    it('produces a clause when _like value contains underscore', () => {
        // Arrange
        const filters = { name_like: 'test_case' };

        // Act
        const clause = buildWhereClause(filters, testTable);

        // Assert
        expect(clause).toBeDefined();
    });

    it('produces a clause when _like value contains backslash', () => {
        // Arrange
        const filters = { name_like: 'C:\\Users' };

        // Act
        const clause = buildWhereClause(filters, testTable);

        // Assert
        expect(clause).toBeDefined();
    });
});
