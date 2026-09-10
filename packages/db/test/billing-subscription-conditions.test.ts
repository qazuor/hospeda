/**
 * Tests for the shared `mp_subscription_id` predicates (HOS-1326).
 *
 * These pin the generated SQL, not a mock's idea of it. Two suites in `apps/api`
 * stub `hasNoLinkedPreapprovalCondition` because they replace `@repo/db`
 * wholesale and cannot run real drizzle over their string column markers — so
 * this file is what stops the real predicate from drifting away from those stubs
 * unnoticed. Without it, "the predicate is correct" would rest on the same mock
 * that consumes it, which is the failure mode HOS-1326 was filed for twice.
 *
 * The assertion is on the SQL text because that is the artifact that reaches
 * Postgres: the bug being prevented is a WHERE that reads `IS NULL` on a column
 * holding `''`, and only the emitted SQL can show whether both are covered.
 *
 * @module test/billing-subscription-conditions
 */

import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
    hasLinkedPreapprovalCondition,
    hasNoLinkedPreapprovalCondition
} from '../src/utils/billing-subscription-conditions.ts';

const dialect = new PgDialect();

/**
 * Renders a drizzle condition to the SQL text Postgres would receive.
 *
 * Uses the real Postgres dialect rather than poking at the condition object, so
 * the assertions below are about the emitted statement — the only artifact that
 * can actually show whether both the null and the empty-string spelling are
 * covered. Literals arrive as `$n` placeholders, so the parameter list is
 * returned alongside.
 */
function renderSql(condition: unknown): { text: string; params: readonly unknown[] } {
    // biome-ignore lint/suspicious/noExplicitAny: dialect takes a drizzle SQL node
    const query = dialect.sqlToQuery(condition as any);
    return { text: query.sql.toLowerCase(), params: query.params };
}

describe('hasNoLinkedPreapprovalCondition', () => {
    it('covers BOTH the null and the empty-string spelling', () => {
        const { text, params } = renderSql(hasNoLinkedPreapprovalCondition());

        // The whole point: an `IS NULL`-only predicate matched zero rows for the
        // checkout it was written to close, because qzpay persists a missing
        // preapproval id as ''.
        expect(text).toContain('is null');
        expect(text).toContain(' or ');
        // The empty string is compared as a bound parameter, so it shows up here
        // rather than inline. Asserting it is what makes this test fail if the
        // second half is ever dropped.
        expect(params).toContain('');
    });

    it('is an OR, not an AND — the two spellings are alternatives', () => {
        const { text } = renderSql(hasNoLinkedPreapprovalCondition());
        expect(text).not.toContain(' and ');
    });
});

describe('hasLinkedPreapprovalCondition', () => {
    it('is not satisfied by "not null" alone — it also excludes the empty string', () => {
        const { text, params } = renderSql(hasLinkedPreapprovalCondition());

        expect(text).toContain('is not null');
        // The `<>` half is what makes this the true complement. A hand-rolled
        // `IS NOT NULL` would admit the `''` rows that mean "no preapproval",
        // which on the data-migration side would relabel a row it must not touch.
        expect(text).toContain(' and ');
        expect(params).toContain('');
    });

    it('and its complement name the same column', () => {
        const positive = renderSql(hasLinkedPreapprovalCondition()).text;
        const negative = renderSql(hasNoLinkedPreapprovalCondition()).text;

        // Both must be about `mp_subscription_id` and nothing else — a pair that
        // silently drifted onto different columns would still "pass" every
        // shape-only assertion above.
        expect(positive).toContain('mp_subscription_id');
        expect(negative).toContain('mp_subscription_id');
    });
});
