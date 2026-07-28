/**
 * Guards for the SQL-clause introspection helpers themselves.
 *
 * These helpers back every soft-delete assertion in the HOS-288 suites, so a bug
 * here does not fail a test — it hands out a false GREEN on the exact security
 * property the branch exists to protect. That happened once already: `and(...)`
 * and `or(...)` compile to the identical `['(', <joined>, ')']` chunk shape, and
 * the walker distinguished them not at all, so a clause where `deleted_at IS NULL`
 * was merely one branch of an `or(...)` — a query that DOES return soft-deleted
 * rows — reported `hasSoftDeleteCondition === true`.
 */
import { and, eq, isNull, or } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { accommodations } from '../../src/schemas/accommodation/accommodation.dbschema';
import { flattenAndConditions, hasSoftDeleteCondition } from './soft-delete-clause';

describe('hasSoftDeleteCondition', () => {
    it('is true for a bare isNull(deletedAt)', () => {
        expect(hasSoftDeleteCondition(isNull(accommodations.deletedAt))).toBe(true);
    });

    it('is true when the predicate is one conjunct of a flat and()', () => {
        const clause = and(
            eq(accommodations.visibility, 'PUBLIC'),
            isNull(accommodations.deletedAt)
        );
        expect(hasSoftDeleteCondition(clause)).toBe(true);
    });

    it('is true when the predicate is nested one AND level down', () => {
        // The shape `BaseModelImpl` produces when a caller-supplied `where` has two
        // or more keys AND an additionalCondition is appended.
        const clause = and(
            and(eq(accommodations.visibility, 'PUBLIC'), isNull(accommodations.deletedAt)),
            eq(accommodations.lifecycleState, 'ACTIVE')
        );
        expect(hasSoftDeleteCondition(clause)).toBe(true);
    });

    it('is FALSE when the predicate is only a branch of an or()', () => {
        // Such a query returns soft-deleted rows whenever the other branch matches,
        // so reporting `true` here would be a false green.
        const clause = or(
            isNull(accommodations.deletedAt),
            eq(accommodations.visibility, 'PRIVATE')
        );
        expect(hasSoftDeleteCondition(clause)).toBe(false);
    });

    it('is FALSE when an or() carrying the predicate is nested inside an and()', () => {
        const clause = and(
            eq(accommodations.visibility, 'PUBLIC'),
            or(isNull(accommodations.deletedAt), eq(accommodations.visibility, 'PRIVATE'))
        );
        expect(hasSoftDeleteCondition(clause)).toBe(false);
    });

    it('is false for an unrelated IS NULL — the column name is checked', () => {
        expect(hasSoftDeleteCondition(isNull(accommodations.destinationId))).toBe(false);
    });

    it('is false for undefined', () => {
        expect(hasSoftDeleteCondition(undefined)).toBe(false);
    });
});

describe('flattenAndConditions', () => {
    it('returns [] for undefined', () => {
        expect(flattenAndConditions(undefined)).toEqual([]);
    });

    it('returns a non-group clause as a single leaf', () => {
        expect(flattenAndConditions(isNull(accommodations.deletedAt))).toHaveLength(1);
    });

    it('descends nested AND groups into leaves', () => {
        const clause = and(
            and(eq(accommodations.visibility, 'PUBLIC'), isNull(accommodations.deletedAt)),
            eq(accommodations.lifecycleState, 'ACTIVE')
        );
        expect(flattenAndConditions(clause)).toHaveLength(3);
    });

    it('keeps an or() group opaque instead of flattening its branches', () => {
        // `and(or(a, b), c)` has TWO conjuncts, not three — treating the OR's
        // branches as conjuncts is what produced the false green.
        const clause = and(
            or(eq(accommodations.type, 'HOTEL'), eq(accommodations.destinationId, 'x')),
            isNull(accommodations.deletedAt)
        );
        expect(flattenAndConditions(clause)).toHaveLength(2);
    });
});
