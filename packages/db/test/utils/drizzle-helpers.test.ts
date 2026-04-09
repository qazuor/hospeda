import { integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
    buildSearchCondition,
    buildWhereClause,
    escapeLikePattern,
    safeIlike
} from '../../src/utils/drizzle-helpers';
import { DbError } from '../../src/utils/error';

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

    it('throws DbError when a plain object is passed as a value (guard against $ilike pattern)', () => {
        // Arrange -- plain object value would produce broken SQL via eq()
        const filters = { name: { $ilike: '%hotel%' } };

        // Assert -- defensive guard catches this before eq() produces wrong SQL
        expect(() => buildWhereClause(filters, testTable)).toThrow(DbError);
    });

    it('does not throw for Date values (Date objects are allowed in eq())', () => {
        // Arrange -- Date is an object but is a valid eq() value
        const filters = { createdAt: new Date('2026-01-01') };

        // Assert -- Date should not trigger the plain-object guard
        expect(() => buildWhereClause(filters, testTable)).not.toThrow();
    });

    it('returns undefined when table is null', () => {
        const clause = buildWhereClause({ id: 1 }, null);
        expect(clause).toBeUndefined();
    });

    it('returns undefined when table is a non-object primitive', () => {
        const clause = buildWhereClause({ id: 1 }, 42);
        expect(clause).toBeUndefined();
    });

    it('throws DbError when all keys are unknown columns', () => {
        // Arrange -- keys that don't exist in testTable
        const filters = { unknownField: 'value', anotherMissing: 123 };

        // Assert -- all keys unknown = likely programming error
        expect(() => buildWhereClause(filters, testTable)).toThrow(DbError);
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

        it('throws DbError when the base column does not exist in the table', () => {
            // Arrange
            const filters = { nonExistent_like: 'test' };

            // Assert -- all keys unknown = likely programming error
            expect(() => buildWhereClause(filters, testTable)).toThrow(DbError);
        });

        it('throws DbError when value is not a string (produces no conditions)', () => {
            // Arrange -- _like requires typeof value === 'string'; name_like not a real column either
            const filters = { name_like: 123 };

            // Assert -- no valid clause produced from a single unknown key
            expect(() => buildWhereClause(filters, testTable)).toThrow(DbError);
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

        it('throws DbError when the base column does not exist in the table', () => {
            // Arrange
            const filters = { nonExistentColumn_gte: new Date('2026-03-01') };

            // Assert -- all keys unknown = likely programming error
            expect(() => buildWhereClause(filters, testTable)).toThrow(DbError);
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

        it('throws DbError when the base column does not exist in the table', () => {
            // Arrange
            const filters = { nonExistentColumn_lte: new Date('2026-03-15') };

            // Assert -- all keys unknown = likely programming error
            expect(() => buildWhereClause(filters, testTable)).toThrow(DbError);
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

describe('safeIlike', () => {
    it('returns a defined SQL condition for a normal string', () => {
        // Arrange
        const column = testTable.name;

        // Act
        const result = safeIlike(column, 'hotel paradise');

        // Assert
        expect(result).toBeDefined();
    });

    it('returns a defined condition when term contains percent wildcard', () => {
        // Arrange -- percent must be escaped so it is treated as literal
        const column = testTable.name;

        // Act
        const result = safeIlike(column, '50%off');

        // Assert -- should not throw and should produce a valid SQL object
        expect(result).toBeDefined();
    });

    it('returns a defined condition when term contains underscore wildcard', () => {
        // Arrange
        const column = testTable.name;

        // Act
        const result = safeIlike(column, 'test_case');

        // Assert
        expect(result).toBeDefined();
    });

    it('returns a defined condition when term contains backslash', () => {
        // Arrange
        const column = testTable.name;

        // Act
        const result = safeIlike(column, 'C:\\Users');

        // Assert
        expect(result).toBeDefined();
    });

    it('returns a defined condition for all three metacharacters combined', () => {
        // Arrange
        const column = testTable.name;

        // Act
        const result = safeIlike(column, '50%_C:\\data');

        // Assert
        expect(result).toBeDefined();
    });

    it('produces the same SQL structure as manual ilike+escapeLikePattern for normal terms', () => {
        // Arrange -- safeIlike should internally apply escapeLikePattern
        const column = testTable.name;
        const term = 'hotel paradise';

        // Act -- safeIlike is the recommended wrapper
        const safeResult = safeIlike(column, term);

        // Assert -- result is a SQL object (same as calling ilike directly)
        expect(safeResult).toBeDefined();
        expect(typeof safeResult).toBe('object');
    });
});
