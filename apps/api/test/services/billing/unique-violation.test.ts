/**
 * Unit tests for {@link isUniqueConstraintViolation}.
 *
 * The case that matters is the Drizzle-wrapped one: `DrizzleQueryError` has
 * no `code` of its own, so a naive `error.code === '23505'` check is always
 * `false` on the value a real `catch` block receives, and a bug here reads
 * as "the race never happens" rather than as a visible test failure. Every
 * fixture below builds the SAME shape verified in
 * `packages/db/test/integration/tx-propagation.test.ts` (case 8): an outer
 * wrapper with no `code`, whose `.cause` is a `pg.DatabaseError`-shaped
 * object carrying `code` and `constraint`.
 *
 * @module test/services/billing/unique-violation
 */
import { describe, expect, it } from 'vitest';
import { isUniqueConstraintViolation } from '../../../src/services/billing/unique-violation';

/** A bare `pg.DatabaseError`-shaped unique-violation error, no wrapping. */
function bareUniqueViolation(constraint?: string): Error {
    const err = new Error('duplicate key value violates unique constraint');
    return Object.assign(err, {
        code: '23505',
        ...(constraint === undefined ? {} : { constraint })
    });
}

/**
 * The real Drizzle-wrapped shape: an outer `DrizzleQueryError`-like error
 * with NO `code`, whose `.cause` is the pg driver's `DatabaseError` carrying
 * `code` and `constraint`. Verified against real PostgreSQL in
 * `packages/db/test/integration/tx-propagation.test.ts`.
 */
function drizzleWrappedUniqueViolation(constraint?: string): Error {
    const pgError = bareUniqueViolation(constraint);
    const wrapper = new Error('Failed query: update "billing_subscriptions" ...');
    return Object.assign(wrapper, { cause: pgError });
}

/** Two levels of wrapping — an extra layer on top of the Drizzle shape. */
function doubleWrappedUniqueViolation(constraint?: string): Error {
    const inner = drizzleWrappedUniqueViolation(constraint);
    const outer = new Error('service-layer wrapper');
    return Object.assign(outer, { cause: inner });
}

describe('isUniqueConstraintViolation', () => {
    it('returns true for a bare pg error carrying code 23505', () => {
        // Arrange
        const error = bareUniqueViolation();

        // Act
        const result = isUniqueConstraintViolation({ error });

        // Assert
        expect(result).toBe(true);
    });

    it('returns true for a Drizzle-wrapped 23505 error (code lives on .cause, not top-level)', () => {
        // Arrange
        const error = drizzleWrappedUniqueViolation();

        // Act
        const result = isUniqueConstraintViolation({ error });

        // Assert
        expect(result).toBe(true);
    });

    it('returns true for a two-level-wrapped 23505 error (cause.cause)', () => {
        // Arrange
        const error = doubleWrappedUniqueViolation();

        // Act
        const result = isUniqueConstraintViolation({ error });

        // Assert
        expect(result).toBe(true);
    });

    it('returns false for a different SQLSTATE (23503 — foreign key violation)', () => {
        // Arrange
        const pgError = Object.assign(new Error('foreign key violation'), { code: '23503' });
        const error = Object.assign(new Error('wrapper'), { cause: pgError });

        // Act
        const result = isUniqueConstraintViolation({ error });

        // Assert
        expect(result).toBe(false);
    });

    it('returns false when no error in the chain carries a code', () => {
        // Arrange
        const inner = new Error('plain failure, no code');
        const error = Object.assign(new Error('wrapper'), { cause: inner });

        // Act
        const result = isUniqueConstraintViolation({ error });

        // Assert
        expect(result).toBe(false);
    });

    it('returns false, without throwing, for null', () => {
        // Arrange / Act
        const result = isUniqueConstraintViolation({ error: null });

        // Assert
        expect(result).toBe(false);
    });

    it('returns false, without throwing, for undefined', () => {
        // Arrange / Act
        const result = isUniqueConstraintViolation({ error: undefined });

        // Assert
        expect(result).toBe(false);
    });

    it('returns false, without throwing, for a plain string', () => {
        // Arrange / Act
        const result = isUniqueConstraintViolation({
            error: 'duplicate key value violates unique constraint'
        });

        // Assert
        expect(result).toBe(false);
    });

    it('returns false, without hanging, for a circular cause chain', () => {
        // Arrange
        const a = new Error('a');
        const b = new Error('b');
        Object.assign(a, { cause: b });
        Object.assign(b, { cause: a });

        // Act
        const result = isUniqueConstraintViolation({ error: a });

        // Assert
        expect(result).toBe(false);
    });

    it('matches when constraintName is given and the violated constraint has that exact name', () => {
        // Arrange
        const error = drizzleWrappedUniqueViolation('billing_subscriptions_mp_id_uniq');

        // Act
        const result = isUniqueConstraintViolation({
            error,
            constraintName: 'billing_subscriptions_mp_id_uniq'
        });

        // Assert
        expect(result).toBe(true);
    });

    it('does not match when constraintName is given but a DIFFERENT constraint violated', () => {
        // Arrange
        const error = drizzleWrappedUniqueViolation('some_other_unique_index');

        // Act
        const result = isUniqueConstraintViolation({
            error,
            constraintName: 'billing_subscriptions_mp_id_uniq'
        });

        // Assert
        expect(result).toBe(false);
    });

    it('does not match when constraintName is given but the violation carries no constraint name', () => {
        // Arrange
        const error = drizzleWrappedUniqueViolation(undefined);

        // Act
        const result = isUniqueConstraintViolation({
            error,
            constraintName: 'billing_subscriptions_mp_id_uniq'
        });

        // Assert
        expect(result).toBe(false);
    });
});
