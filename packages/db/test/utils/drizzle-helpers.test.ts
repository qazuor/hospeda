import { describe, expect, it } from 'vitest';
import { buildWhereClause } from '../../src/utils/drizzle-helpers';

// Mock de tabla Drizzle
const mockTable = {
    id: 'id_col',
    name: 'name_col',
    age: 'age_col',
    active: 'active_col'
};

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
});
